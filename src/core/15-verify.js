// ============================================================
// v9.0 业务层 · 15-verify（交付验真（时长/提示符/片段判定））
// 对 legacy 的引用一律走依赖注入 dep(name)，不打反向引用环
// ============================================================
const { VERIFY_RANGE_BYTES } = require("./10-vendors.js");
const { toBytes, mediaEnvelopeErrorCode, sniffAudioBytes, kindOf } = require("./08-media.js");
const { HTTP_URL_REGEX, httpRequest, getMobileUserAgent } = require("./07-net.js");
const { ERROR_CODES } = require("./02-error-codes.js");
const { logDebug, logInfo } = require("./01-log.js");
const { durationHintByKey, durationHintKey, normalizeDurationSec, normalizeKeyword } = require("./09-match.js");
const { cfg } = require("./02-config.js");
const { dep } = require("./06-binding.js");

const VERIFY_MIN_ORIGINAL_SEC = 90;     // 原曲短于此不按比例判（防误杀原生短歌）

function isFragmentInfo(info, songInfo) {
  const realDur = info && info.durationSec;
  const origDur = originalDurationSec(songInfo);
  if (!realDur || !origDur || origDur < cfg("verifyMinOriginalSec", VERIFY_MIN_ORIGINAL_SEC)) return false;
  const ratio = realDur / origDur;
  const gap = origDur - realDur;
  return ratio < cfg("verifyDurRatio", VERIFY_DUR_RATIO) && gap > cfg("verifyDurGapSec", VERIFY_DUR_GAP_SEC);
}

const VERIFY_DUR_GAP_SEC = 15;          // 且绝对差值 > 15 秒（双条件，容忍同名不同版本 175s/199s 并存）

const VERIFY_DUR_RATIO = 0.6;           // 真实时长 < 原曲 60%

function originalDurationSec(songInfo) {
  const raw = songInfo?.duration ?? songInfo?.dt ?? songInfo?.interval ?? songInfo?.songDuration;
  // 调用方没给时长时，用子源解析出的旁路提示（D-39 修复的等价实现，无跨桥副作用）
  const hinted = (songInfo && typeof songInfo === "object")
    ? (durationHints.get(songInfo)
        ?? durationHintByKey.get(durationHintKey(songInfo))
        ?? durationHintByKey.get(durationHintNameKey(songInfo))
        ?? 0)
    : 0;
  if ((raw === undefined || raw === null || raw === "") && hinted) return hinted;
  if (typeof raw === "string" && raw.includes(":")) {
    const parts = raw.split(":").map(x => parseInt(x, 10)).filter(x => Number.isFinite(x));
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return 0;
  }
  return normalizeDurationSec(raw);
}

function durationHintNameKey(songInfo) {
  if (!songInfo || typeof songInfo !== "object" || !songInfo.name) return "";
  return "n:" + String(songInfo.name);
}

const durationHints = new Map();

/**
 * v9.1.6（K31）：身份判据。
 * 返回 null = 通过（含「无证据但源不要求」的情形）；返回对象 = 拒绝裁决。
 * 规则：
 *  ①拿到标签且歌名对不上 → MISMATCH（明确错歌，任何源都拒）
 *  ②拿到标签且歌名对上 → 通过（强证据）
 *  ③没标签：只有 `identityStrict` 源才拒（它无法证明交付的是这首歌）；其余源放行，
 *    否则会误杀大量无标签的正常 CDN 直链。
 */
function checkDeliveryIdentity(info, ctx) {
  const want = String(ctx.songInfo?.name || "").trim();
  if (!want) return null;
  const tagTitle = String(info?.tagTitle || "").trim();
  const tagArtist = String(info?.tagArtist || "").trim();
  if (tagTitle) {
    const a = normalizeKeyword(tagTitle);
    const b = normalizeKeyword(want);
    if (a && b && a !== b) {
      // 包含关系放行（「晴天」vs「晴天 (Live)」「平凡之路-巡演版」这类同曲不同版本很常见）
      const contained = a.includes(b) || b.includes(a);
      if (!contained) {
        return {
          ok: false, code: ERROR_CODES.MISMATCH,
          reason: `交付音频自带标签为《${tagTitle}》${tagArtist ? ` / ${tagArtist}` : ""}，与请求《${want}》不符`,
          evidence: "strong", info,
        };
      }
    }
    return null;
  }
  // 无标签：区分「整曲」与「片段」。实测（2026-11-21）星海对
  //   · 无效 mid 999999999 → 裸 mp3 帧 181,521 字节（约 113s），对 180~300s 的请求必判片段
  //   · 真实存在的现场版 182061798 → 同样是裸 mp3 帧、同样无标签
  // 所以「无标签」本身不能当错歌证据，否则会误杀真实现场版。
  // 但**片段兜底**是最危险的一条路：长度差一截的音频被包装成「试听版」交付，
  // 用户点一首不存在的歌会听到别人的声音。故：要求身份的源，无标签时不许走片段兜底。
  if (ctx.identityStrict === true && isFragmentInfo(info, ctx.songInfo)) {
    return {
      ok: false, code: ERROR_CODES.MISMATCH,
      reason: `该源交付的片段没有任何身份标签，无法证明是《${want}》（源标记 identityStrict，拒绝片段兜底）`,
      evidence: "weak", info,
    };
  }
  return null;
}

async function verifyDelivery(audioUrl, ctx = {}, cancelToken = null) {
  if (!cfg("verifyDelivery", true)) return null;
  const probe = await probeAudioDelivery(audioUrl, cfg("verifyTimeoutMs", 3000), cancelToken);
  if (probe.ok === null) {
    // 拿不准就放行（误杀代价高于听到片段）
    logDebug(`[验真] 放行: ${probe.reason}`);
    return null;
  }
  if (probe.ok === false && probe.code) {
    const err = new Error(`${probe.code}: ${probe.reason}`);
    err.code = probe.code;
    err.evidence = probe.evidence || "strong";
    err.probeInfo = probe.info || null;
    throw err;
  }
  // 探针的返回值只有三种：ok=true / ok=false（必带 code）/ ok=null。
  // 上面已分别处理，此处不再留「!probe.ok 但无 code」的死分支（覆盖率实测 0 行）。
  // v9.1.6（K31）：身份判据——交付的到底是不是这首歌。
  // 背景：星海后端对任意 mid 都返回可播音频，旧的四条判据只看时长/体积比例，
  // 一首 113s 的「别人的歌」对 180s 的请求比值 0.63 > 0.6 就能蒙过，被当「试听版」交付。
  // 证据来源：音频自带标签（ID3 TIT2/TPE1、FLAC VORBIS TITLE/ARTIST），实测真曲目有标签、
  // 星海对无效 mid 返回的是裸 mp3 帧（无标签）。
  const ident = checkDeliveryIdentity(probe.info, ctx);
  if (ident) return ident;
  const realDur = probe.info?.durationSec || null;
  const origDur = originalDurationSec(ctx.songInfo);
  // 四条同时满足才拒：真实时长可定 + 原曲可定且≥90s + <60% + 差>15s
  if (realDur && origDur && origDur >= cfg("verifyMinOriginalSec", VERIFY_MIN_ORIGINAL_SEC)) {
    const ratio = realDur / origDur;
    const gap = origDur - realDur;
    if (ratio < cfg("verifyDurRatio", VERIFY_DUR_RATIO) && gap > cfg("verifyDurGapSec", VERIFY_DUR_GAP_SEC)) {
      // 即便是片段也带出真实格式——全档兜底时标签要写真话（实测 flac 档给的是 128kbps mp3）
      return { ok: false, code: ERROR_CODES.PREVIEW_FRAGMENT, reason: `仅 ${realDur}s，原曲 ${origDur}s`, quality: qualityFromDelivery(probe.info, ctx.quality, originalDurationSec(ctx.songInfo)), qualityConfidence: qualityConfidenceOf(probe.info, originalDurationSec(ctx.songInfo)), evidence: probe.evidence || "strong" };
    }
  }
  // medium 证据（无字节、只有体积）：按 3KB/s 下界估「明显短于目标曲目」的试听片段。
  // 依据：128kbps≈16KB/s，5 秒片段≈80KB；180 秒整曲≈2.8MB。保守取 3KB/s×60% 作下界，只拦明显偏小。
  if (!realDur && origDur && origDur >= cfg("verifyMinOriginalSec", VERIFY_MIN_ORIGINAL_SEC) && probe.totalBytes) {
    const minFull = Math.max(128000, origDur * 3000 * VERIFY_DUR_RATIO);
    if (probe.totalBytes < minFull) {
      return {
        ok: false, code: ERROR_CODES.PREVIEW_FRAGMENT,
        reason: `体积仅 ${probe.totalBytes} 字节（< ${Math.round(minFull)}），明显短于 ${origDur}s 整曲`,
        quality: qualityFromDelivery(probe.info, ctx.quality, originalDurationSec(ctx.songInfo)),
        qualityConfidence: qualityConfidenceOf(probe.info, originalDurationSec(ctx.songInfo)),
        evidence: "medium",
      };
    }
  }
  return {
    ok: true,
    quality: qualityFromDelivery(probe.info, ctx.quality, originalDurationSec(ctx.songInfo)),
    qualityConfidence: qualityConfidenceOf(probe.info, originalDurationSec(ctx.songInfo)),
    realDurationSec: realDur,
    format: probe.info?.format || null,
    totalBytes: probe.totalBytes || 0,
    evidence: probe.evidence || "strong",
  };
}

function qualityConfidenceOf(info, durationSec) {
  const fmt = info && info.format;
  if (fmt !== "m4a" && fmt !== "ogg") return "exact";
  if (Number(info && info.bitrateKbps) > 0) return "exact";
  const bytes = Number(info && info.totalBytes) || 0;
  const dur = Number(durationSec) || 0;
  return bytes && dur ? "estimated" : "unknown";
}

function qualityFromDelivery(info, requestedQuality, durationSec) {
  const fmt = info?.format;
  const bytes = Number(info?.totalBytes) || 0;
  const dur = Number(durationSec) || 0;
  const br = info?.bitrateKbps || (bytes && dur ? Math.round((bytes * 8) / dur / 1000) : 0);
  if (fmt === "flac") return br >= 2500 ? "flac24bit" : "flac";
  if (fmt === "wav") return "flac";
  if (fmt === "m4a" || fmt === "ogg") {
    if (br >= 256) return "320k";
    if (br > 0) return "128k";
    // 拿不到总字节/时长：保留请求档（兼容旧行为，不制造新的误标）
    return requestedQuality || "128k";
  }
  if (fmt === "mp3" || fmt === "audio") {
    if (br >= 256) return "320k";
    if (br > 0) return "128k";
    // 码率未知：走这条说明桥没透传字节、只剩响应头（headerEvidence 已不再硬编 128kbps）。
    // 此时既看不见容器也看不见码率，凭空断言 128k 会把真 flac/320k 记成 128k，
    // 再经 noteQualityCeiling 写成该源的降档备档，反向压住本来能出高质的源。保留请求档。
    return requestedQuality || "128k";
  }
  // 其他未知格式：保留请求档
  return requestedQuality || "128k";
}

async function probeAudioDelivery(audioUrl, timeoutMs = 3000, cancelToken = null) {
  if (!audioUrl || typeof audioUrl !== "string" || !HTTP_URL_REGEX.test(audioUrl)) {
    return { ok: false, code: ERROR_CODES.PARAM_ERROR, reason: "非法URL" };
  }
  try {
    const res = await httpRequest(audioUrl, {
      method: "GET",
      headers: { "User-Agent": getMobileUserAgent(), "Range": `bytes=0-${VERIFY_RANGE_BYTES}` },
      timeout: timeoutMs,
      follow_max: 5,
      binary: true,
      cancelToken
    });
    const status = res.statusCode;
    let totalBytes = 0;
    const cr = String((res.headers && res.headers["content-range"]) || "");
    const m = cr.match(/\/\s*(\d+)/);
    if (m) totalBytes = parseInt(m[1], 10) || 0;
    if (!totalBytes) totalBytes = parseInt(String((res.headers && res.headers["content-length"]) || "0"), 10) || 0;
    // 注意：4xx/5xx 与 429 在 httpRequest 内已按状态码抛出（带 err.code），
    // 走 catch 统一映射，这里再判一遍只会得到不可能执行的死分支（覆盖率实测 0 行）。
    const body = res.body;
    const bytes = toBytes(body);
    const mediaErr = bytes ? null : mediaEnvelopeErrorCode(body);
    const totalBytesKnown = totalBytes;
    const fullBody = status === 200 && !String((res.headers && res.headers["content-range"]) || "");
    if (bytes) {
      const info = sniffAudioBytes(bytes, res.headers, totalBytesKnown, fullBody);
      if (info && info.kind === "audio") {
        return {
          ok: true, info, evidence: "strong", statusCode: status,
          contentType: String((res.headers && res.headers["content-type"]) || ""), totalBytes,
        };
      }
      const kind = (info && info.kind) || "unknown";
      if (kind === "empty") {
        return { ok: false, code: ERROR_CODES.NOT_AUDIO, reason: "交付内容为空(0~16 字节，不可能可播)", evidence: "strong", info, statusCode: status, totalBytes };
      }
      if (kind === "playlist") {
        return { ok: false, code: ERROR_CODES.STREAM_PLAYLIST, reason: "交付内容是流播放列表", evidence: "strong", info, statusCode: status, totalBytes };
      }
      if (kind === "json" || kind === "html") {
        return { ok: false, code: ERROR_CODES.NOT_AUDIO, reason: `交付内容不是音频(${kind})`, evidence: "strong", info, statusCode: status, totalBytes };
      }
      // 二进制但认不出形态：能走到这里说明响应头也不是音频（头是音频时 sniff 已判 audio），
      // 所以只能给弱证据，不判死但也不当交付成功。
      return { ok: false, code: ERROR_CODES.NOT_AUDIO, reason: "交付内容无法识别为音频", evidence: "weak", info, statusCode: status, totalBytes };
    }
    if (mediaErr) {
      return { ok: false, code: mediaErr, reason: `桥媒体信封损坏(${mediaErr})`, evidence: "strong", statusCode: status, totalBytes };
    }
    // 无字节（App 桥把二进制体变成了普通对象）：只信响应头，证据降为 medium/weak，
    // 绝不因为「拿不到字节」判 NOT_AUDIO —— 这正是真机全源误判的根因。
    // 但「明确给了空体」（''/{Buffer,data:[]}/零长视图）不是桥问题，是真空交付，必须判死。
    // 没有可识别字节时，仍要按形态判死：文本形态的 playlist/json/html 与空体，
    // 都是「明确不是音频」，不能因为「字节拿不到」就被响应头放行（否则 .m3u8 / 登录页会被当音频交付）。
    if (body !== undefined && body !== null) {
      const bk = kindOf(body);
      if (bk === "playlist") {
        return { ok: false, code: ERROR_CODES.STREAM_PLAYLIST, reason: "交付内容是流播放列表", evidence: "strong", statusCode: status, totalBytes };
      }
      if (bk === "json" || bk === "html") {
        return { ok: false, code: ERROR_CODES.NOT_AUDIO, reason: `交付内容不是音频(${bk})`, evidence: "strong", statusCode: status, totalBytes };
      }
      if (bk === "empty") {
        return { ok: false, code: ERROR_CODES.NOT_AUDIO, reason: "交付内容为空(空体)", evidence: "strong", statusCode: status, totalBytes };
      }
    }
    const hv = headerEvidence(res.headers, totalBytes);
    if (hv.ok === null) {
      // 头信息不足 → 补一次只取头（HEAD 1500ms，405 退回 GET Range 0-0）
      const byHead = await probeByHeaders(audioUrl, Math.min(1500, timeoutMs), cancelToken);
      if (byHead && byHead.ok !== null) {
        return Object.assign({}, byHead, { statusCode: byHead.statusCode || status, totalBytes: byHead.totalBytes || totalBytes });
      }
      return { ok: null, code: ERROR_CODES.NETWORK_ERROR, reason: "无字节且头信息不足", evidence: "weak", statusCode: status };
    }
    return { ok: hv.ok, code: hv.code, reason: hv.reason, info: hv.info, evidence: hv.evidence, statusCode: status, totalBytes };
  } catch (e) {
    const code = (e && e.code) ? e.code : ERROR_CODES.NETWORK_ERROR;
    // 只有 410/404 是确定结论（链接确实死了）才判死链换源，统一映射为 LINK_EXPIRED
    // —— 音频 CDN 的 404 语义就是"这条直链失效"，不是"歌不存在"（歌不存在发生在接口层）
    if (code === ERROR_CODES.LINK_EXPIRED || code === ERROR_CODES.NOT_FOUND) {
      return { ok: false, code: ERROR_CODES.LINK_EXPIRED, reason: `验真失败(${code})`, evidence: "strong" };
    }
    // 429 是确定结论（源在限流），不是「拿不准」——必须判失败并让裁决层转冷却/换源。
    if (code === ERROR_CODES.RATE_LIMIT) {
      return { ok: false, code: ERROR_CODES.RATE_LIMIT, reason: "HTTP 429", evidence: "strong" };
    }
    // 探针没跑完（超时/断连/5xx）：沿用「拿不准就放行」（T66/C8a 契约）——
    // 误杀一首能播的歌，比偶尔放一条没验过的链接更糟；真正的问题是「拿不到字节就判 NOT_AUDIO」，
    // 那种误判已经在上面用响应头证据消掉了。
    return { ok: null, code, reason: `验真未完成(${code})`, evidence: "weak" };
  }
}

async function probeByHeaders(audioUrl, timeoutMs = 1500, cancelToken = null) {
  const tryOnce = async (method, headers) => {
    const res = await httpRequest(audioUrl, {
      method, headers: { "User-Agent": getMobileUserAgent(), ...headers },
      timeout: timeoutMs, follow_max: 5, binary: true, cancelToken,
    });
    const cr = String((res.headers && res.headers["content-range"]) || "");
    const m = cr.match(/\/\s*(\d+)/);
    let totalBytes = m ? (parseInt(m[1], 10) || 0) : (parseInt(String((res.headers && res.headers["content-length"]) || "0"), 10) || 0);
    const hv = headerEvidence(res.headers || {}, totalBytes);
    return { hv, statusCode: res.statusCode, totalBytes, contentType: String((res.headers && res.headers["content-type"]) || "") };
  };
  try {
    const head = await tryOnce("HEAD", {});
    if (head.hv && head.hv.ok !== null) {
      return { ok: head.hv.ok, code: head.hv.code, reason: head.hv.reason, info: head.hv.info, evidence: head.hv.evidence, statusCode: head.statusCode, totalBytes: head.totalBytes, via: "HEAD" };
    }
  } catch (e) { /* HEAD 被拒（405/超时）→ 退回只取头的 GET */ }
  try {
    const get = await tryOnce("GET", { Range: "bytes=0-0" });
    if (get.hv && get.hv.ok !== null) {
      return { ok: get.hv.ok, code: get.hv.code, reason: get.hv.reason, info: get.hv.info, evidence: get.hv.evidence, statusCode: get.statusCode, totalBytes: get.totalBytes, via: "GET-head" };
    }
    return { ok: null, code: ERROR_CODES.NETWORK_ERROR, reason: "只取头也未取得可用证据", evidence: "weak", via: "GET-head" };
  } catch (e) {
    return { ok: null, code: ERROR_CODES.NETWORK_ERROR, reason: `只取头失败(${(e && e.code) || "NETWORK_ERROR"})`, evidence: "weak", via: "none" };
  }
}

function headerEvidence(headers, totalBytes) {
  const ct = String((headers && headers["content-type"]) || "").toLowerCase();
  const info = { kind: "unknown", format: null, durationSec: null, bitrateKbps: null };
  if (/json|html|text\/plain|xml/.test(ct)) {
    return { ok: false, code: ERROR_CODES.NOT_AUDIO, reason: `响应头声明非音频(${ct.split(";")[0]})`, evidence: "strong", info: { kind: "json", format: null, durationSec: null } };
  }
  if (/audio|octet|mpeg|mp3|flac|ogg|aac/.test(ct)) {
    info.kind = "audio";
    info.format = ct.includes("flac") ? "flac" : (ct.includes("mpeg") || ct.includes("mp3") ? "mp3" : "audio");
    // 曾经这里写死 `if (totalBytes && info.format === "mp3") info.bitrateKbps = 128`，
    // 等于把"只知道是 mpeg"当成"确定 128kbps"。实测反例：ikun 的 wy flac 档回真 flac
    // （文件头 66 4c 61 43），content-type 却是 audio/mpeg；若只剩头信息，128kbps 会把
    // 它记成 128k 并写成降档备档。码率改为留空（null），由调用方按"未知"处理。
    return { ok: true, info, evidence: "medium", reason: "仅头信息（桥未透传字节）" };
  }
  return { ok: null, code: ERROR_CODES.NETWORK_ERROR, reason: "响应头不足以判定", evidence: "weak", info };
}

module.exports = {
  VERIFY_MIN_ORIGINAL_SEC,
  isFragmentInfo,
  VERIFY_DUR_GAP_SEC,
  VERIFY_DUR_RATIO,
  originalDurationSec,
  durationHintNameKey,
  durationHints,
  verifyDelivery,
  qualityConfidenceOf,
  qualityFromDelivery,
  probeAudioDelivery,
  probeByHeaders,
  headerEvidence,
};
