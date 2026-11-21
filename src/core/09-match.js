// ============================================================
// v9.0 业务层 · 09-match（身份匹配 / 音质排序）
// 来源：由 legacy.js 整块迁出（v9.0 第六刀 · 种子闭包新增 0）
// ============================================================
const { logWarn, logDebug } = require("./01-log.js");
const { ERROR_CODES } = require("./02-error-codes.js");
const { extractErrorCode, CODE_RANK, QUALITY_BUSINESS_CODES, QUALITY_DELIVERY_CODES, QUALITY_TRANSIENT_CODES } = require("./05-verdict.js");

const QUALITY_CEILING_TTL_MS = 21600000; // 能力备档 6 小时

const Q = ["128k", "320k", "flac", "flac24bit"];

const PLATFORM_QUALITIES = { wy: Q, tx: Q, kw: Q, kg: Q, mg: Q };

const QUALITY_TO_X = {
  // 通用 br 参考（星海 level 语义 / 长青念心 level）：flac24bit/hires 均 999
  br: { "128k": "128", "192k": "192", "320k": "320", flac: "740", flac24bit: "999", "24bit": "999" },
  // 溯音QQ：br 数值（hires=3/atmos=2/master=1/24bit=1 专用值直传）
  suyinQQ: { "128k": 7, "320k": 5, flac: 4, hires: 3, atmos: 2, master: 1, "24bit": 1 },
  // 酷我系（溯音酷我搜索 br 参数）：flac=1 / 320k=5 / 128k=7
  kuwo: { flac: 1, "320k": 5, "128k": 9, "24bit": 1 }, // v8.4 修正：128k br=7→9（实测 br=9 唯一可播 mp3，7/5/1 均 CDN410 死链；flac/320k 为 VIP 链 loginUid 空 410）
  // GD Studio：br 字符串（flac/hires 均走 999 真实 flac）
  gd: { "128k": "128", "192k": "320", "320k": "320", flac: "999", flac24bit: "999", hires: "999" }
};

const QUALITY_PRIORITY = ["flac24bit", "flac", "320k", "128k"];

const QUALITY_RANK = { "128k": 1, "192k": 2, "320k": 3, flac: 4, flac24bit: 5, hires: 4, master: 5, atmos: 5, "24bit": 5 };

function qualityRank(q) { return QUALITY_RANK[String(q || "128k").toLowerCase()] || 1; }

const QUALITY_CEILING_TTL_BY_REASON = {
  definitive: 6 * 3600 * 1000,
  transient: 10 * 60 * 1000,
  unknown: 30 * 60 * 1000,
  rate_limit: 0
};

function classifyQualityFailureCode(code) {
  const c = String(code || "").toUpperCase();
  if (!c) return "unknown";
  if (c === ERROR_CODES.RATE_LIMIT) return "rate_limit";
  if (QUALITY_BUSINESS_CODES.has(c)) return "business";
  if (QUALITY_DELIVERY_CODES.has(c)) return "delivery";
  if (QUALITY_TRANSIENT_CODES.has(c)) return "transient";
  return "unknown";
}

function qualityCeilingReasonForCodes(codes) {
  const list = (codes || []).map(classifyQualityFailureCode);
  if (list.includes("business")) return "definitive";
  if (list.includes("delivery") || list.includes("transient")) return "transient";
  if (list.includes("rate_limit")) return "rate_limit";
  return "unknown";
}

const qualityCeilingMap = new Map(); // 内存态：重启即丢（设计如此）    // `${platform}|${mid}` → { quality, ts }（能力备档：该歌实际最高可得档）

// v9.1.6（K03）：源级能力备档。旧实现只有平台级 key，一个源在这首歌给过 128k
// 就把整个平台的高档请求砍掉，同平台其它能给 flac 的源再没机会被请求到。
// 源级表用于「把该源从它证明拿不到的档里剔掉」，平台级表保留给快照与统计。
const qualityCeilingBySourceMap = new Map(); // `${platform}|${sourceId}|${mid}` → { quality, ts, ... }

function getQualityCeilingBySource(platform, sourceId, songInfo) {
  if (!platform || !sourceId || !songInfo) return "";
  const key = `${platform}|${sourceId}|${getHashOrMid(songInfo)}`;
  const entry = qualityCeilingBySourceMap.get(key);
  if (!entry) return "";
  const deadline = Number(entry.nextProbeAt || (Number(entry.ts || 0) + Number(entry.ttlMs || QUALITY_CEILING_TTL_MS)));
  if (Date.now() >= deadline) {
    qualityCeilingBySourceMap.delete(key);
    return "";
  }
  return entry.quality || "";
}

const durationHintByKey = new Map();

function durationHintKey(songInfo) {
  if (!songInfo || typeof songInfo !== "object") return "";
  if (songInfo.hash) return "h:" + String(songInfo.hash);
  if (!songInfo.name) return "";
  return "n:" + String(songInfo.name) + "|" + String(songInfo.singer ?? songInfo.artist ?? "");
}

const codeRank = (c) => CODE_RANK[c] || 1;

const EVIDENCE_ORDER = { none: 0, weak: 1, medium: 2, strong: 3 };

function strongestEvidence(list) {
  let best = "none";
  for (const e of list) {
    const v = String(e || "none");
    if ((EVIDENCE_ORDER[v] || 0) > (EVIDENCE_ORDER[best] || 0)) best = v;
  }
  return best;
}

function getQualityCeiling(platform, songInfo) {
  const key = `${platform}|${getHashOrMid(songInfo)}`;
  const entry = qualityCeilingMap.get(key);
  if (!entry) return "";
  const deadline = Number(entry.nextProbeAt || (Number(entry.ts || 0) + Number(entry.ttlMs || QUALITY_CEILING_TTL_MS)));
  if (Date.now() >= deadline) {
    qualityCeilingMap.delete(key);
    return "";
  }
  return entry.quality || "";
}

// v9.1.6（K30）：把 App 的 `meta` 摊平到顶层，供各源按自己的字段取 id。
// 背景：App 侧的 `MusicInfoBase` 只有顶层 `id`（各平台语义不同：kw=rid / wy=数字id /
// tx=songmid / mg=copyrightId / kg=hash），其余标识全在 `meta` 下（`meta.strMediaMid`、
// `meta.copyrightId`、`meta.hash`、`meta.id`…）。源仓此前**没有任何摊平**，只有 juhe 一个源
// 手工兜底读过 `songInfo.meta`，等于让每个源各自去猜字段在哪。
// 规则：顶层已存在的键**绝不覆盖**（顶层是调用方显式意图）；只补 meta 里有、顶层没有的。
const SONG_META_PASSTHROUGH_KEYS = [
  "hash", "rid", "copyrightId", "musicId", "strMediaMid", "mediaMid",
  "albumAudioId", "albumId", "albumMid", "songid", "songId", "albumName", "lrcUrl",
];
function flattenSongInfo(songInfo) {
  if (!songInfo || typeof songInfo !== "object") return songInfo;
  const meta = songInfo.meta;
  if (!meta || typeof meta !== "object") return songInfo;
  let out = null;
  for (const k of SONG_META_PASSTHROUGH_KEYS) {
    const v = meta[k];
    if (v === undefined || v === null || v === "") continue;
    const cur = songInfo[k];
    if (cur !== undefined && cur !== null && cur !== "") continue;
    if (!out) out = Object.assign({}, songInfo);
    out[k] = v;
  }
  return out || songInfo;
}

function getHashOrMid(songInfo) {
  return songInfo?.hash ?? songInfo?.songmid ?? songInfo?.id ?? null;
}

function normalizeKeyword(keyword) {
  if (!keyword) return "";
  return String(keyword)
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, "")
    .replace(/[^\w\u4e00-\u9fa5]/g, "")
    .trim()
    .toLowerCase();
}

function titleMatch(a, b) {
  const na = normalizeKeyword(a);
  const nb = normalizeKeyword(b);
  if (!na || !nb) return true;
  return na.includes(nb) || nb.includes(na);
}

function durationMatch(dur1, dur2, threshold = 5) {
  if (!dur1 || !dur2) return true;
  return Math.abs(Number(dur1) - Number(dur2)) <= threshold;
}

function identityNormalize(v) {
  if (v === undefined || v === null) return "";
  return String(v)
    .replace(/\([^)]*\)/g, " ")
    .replace(/（[^）]*）/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/【[^】]*】/g, " ")
    .replace(/[^0-9A-Za-z\u00C0-\u024F\u3040-\u30FF\u3400-\u9FFF\uF900-\uFAFF]/g, "")
    .trim()
    .toLowerCase();
}

function identityTokens(v) {
  return String(v || "")
    .split(/\s*[\/、,&;|]\s*|\s+feat\.?\s*|\s+ft\.?\s*/i)
    .map(identityNormalize)
    .filter(t => t.length >= 2);
}

function artistMatch(target, candidate) {
  const t = identityNormalize(target);
  const c = identityNormalize(candidate);
  if (!t) return true;
  if (!c) return false;
  if (t === c || t.includes(c) || c.includes(t)) return true;
  const tt = identityTokens(target);
  const ct = identityTokens(candidate);
  return tt.some(x => ct.includes(x) || ct.some(y => y.includes(x)));
}

const FRAGMENT_RE = /(15\s*秒|0\.?\s*8x|片段|试听|demo|preview|teaser)/i;

const PREVIEW_URL_RE = /(preview|test|sample|试听|片段|demo|teaser|clip|\/RS\d)/i;

function isPreviewFragmentUrl(url) {
  if (!url || typeof url !== "string") return false;
  return PREVIEW_URL_RE.test(url);
}

function normalizeDurationSec(d) {
  // v8.11.2（D-37，V32b/c 实测暴露）：源返回的时长常见 mm:ss / hh:mm:ss（如「4:29」），
  // 旧实现只做 Number(d) → NaN → 0 → songInfoMatch 的「时长差>5s 拒绝」整段失效，
  // 片段版（时长明显更短）会被当成完整版交付。先按冒号格式解析。
  if (typeof d === "string" && d.indexOf(":") >= 0) {
    const parts = d.split(":").map((x) => Number(String(x).trim()));
    if (parts.some((x) => !Number.isFinite(x) || x < 0)) return 0;
    if (parts.length === 2) return Math.round(parts[0] * 60 + parts[1]);
    if (parts.length === 3) return Math.round(parts[0] * 3600 + parts[1] * 60 + parts[2]);
    return 0;
  }
  const v = Number(d);
  if (!Number.isFinite(v) || v <= 0) return 0;
  return v > 5000 ? Math.floor(v / 1000) : Math.round(v);
}

function songInfoMatch(responseData, songInfo) {
  const song = responseData?.song || responseData?.data?.song || "";
  const singer = responseData?.singer || responseData?.data?.singer || "";
  const album = responseData?.album || responseData?.data?.album || "";
  if (!titleMatch(song, songInfo?.name || "")) return false;
  // v1.0 P0-1 (D1)：目标歌名无片段特征词而返回歌名含 → 拒绝（防《难却》匹配到15秒0.8x片段）
  const targetName = String(songInfo?.name || "");
  if (targetName && song && !FRAGMENT_RE.test(targetName) && FRAGMENT_RE.test(String(song))) return false;
  // v8.12：源侧若没回歌手（不少聚合源只回 url），不能因此判死——保持旧行为按歌名+时长校验；
  // 只有「目标歌手和候选歌手都存在」时才做严格 artistMatch（跨平台候选在 scorer 层另做硬要求）。
  if (songInfo?.singer && singer && !artistMatch(songInfo.singer, singer)) return false;
  if ((songInfo?.albumName || songInfo?.album) && album && !titleMatch(album, songInfo.albumName || songInfo.album)) return false;
  // v1.0 P0-4 (D4)：双方时长已知且差>5s → 拒绝（片段版时长明显短于完整版）
  const tDur = normalizeDurationSec(songInfo?.duration);
  const rDur = normalizeDurationSec(responseData?.duration || responseData?.data?.duration || responseData?.musicInfo?.duration);
  if (tDur && rDur && !durationMatch(tDur, rDur, 5)) return false;
  return true;
}

module.exports = {
  songInfoMatch,
  titleMatch,
  artistMatch,
  durationMatch,
  identityNormalize,
  identityTokens,
  normalizeKeyword,
  FRAGMENT_RE,
  isPreviewFragmentUrl,
  PREVIEW_URL_RE,
  normalizeDurationSec,
  durationHintByKey,
  durationHintKey,
  qualityRank,
  QUALITY_RANK,
  QUALITY_TO_X,
  QUALITY_PRIORITY,
  PLATFORM_QUALITIES,
  codeRank,
  strongestEvidence,
  EVIDENCE_ORDER,
  getQualityCeiling,
  getQualityCeilingBySource,
  qualityCeilingReasonForCodes,
  QUALITY_CEILING_TTL_BY_REASON,
  QUALITY_CEILING_TTL_MS,
  classifyQualityFailureCode,
  getHashOrMid,
  qualityCeilingMap,
  qualityCeilingBySourceMap,
  Q,
  flattenSongInfo,
};
