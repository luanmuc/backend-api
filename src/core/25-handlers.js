// ============================================================
// v9.0 业务层 · 25-handlers（平台处理器表（SOURCE_HANDLERS 与各平台取链/搜索入口））
// 反向闭包裁剪簇；对遗留 legacy 符号走 dep(name) 依赖注入
// ============================================================
const PROVIDER_QUALITY_ORDER = ["128k", "320k", "flac", "flac24bit"];

const HELLOWORLD_HTW_API = "https://musicserver.haitangw.cc/v1/music/resolve-url";

const CHANGQING_KW_URL_TEMPLATE = "https://musicapi.haitangw.net/music/kw.php?type=mp3&id={id}&level={level}";

const HUIBQ_REQUEST_KEY = "share-v3";

const QINGLIANG_TX_TIMEOUT_MS = 8000;

const WY_OUTER_API = "https://music.163.com/song/media/outer/url?id={id}.mp3";

const HELLOWORLD_KW_BR = { "128k": "128kmp3", "320k": "320kmp3", flac: "2000kflac", flac24bit: "4000kflac" };
const { wrapExecute } = require("./19-dispatch.js");
const { getUrlWithFallback } = require("./22-chain.js");
const { ERROR_CODES } = require("./02-error-codes.js");
const { HTTP_URL_REGEX, TIMEOUT_CONFIG, getMobileUserAgent, httpRequest, httpRequestWithRetry, upgradeToHttps } = require("./07-net.js");
const { getHashOrMid, isPreviewFragmentUrl } = require("./09-match.js");
const { HELLOWORLD_KW_CONVERT_API, IKUN_API, JUHE_API, XINGHAI_BACKEND_API } = require("./10-vendors.js");
const { USER_CONFIG, cfg } = require("./02-config.js");
const { createTemplateVipSource } = require("./16-chain-misc.js");
const { suyinGetUrl, suyinKuwoGetUrl } = require("./13-chain-helpers.js");
const { kuwoOfficialGetUrl } = require("./24-kuwo-official.js");
const { PROVIDER_AUTH, PROVIDER_LIFECYCLE } = require("./11-provider-meta.js");
const { dep } = require("./06-binding.js");



function provider(id, name, fn, maxQuality, opts = {}) {
  const platforms = opts.platforms || ["kw", "wy", "tx", "mg", "kg"];
  const lifecycle = opts.lifecycle || PROVIDER_LIFECYCLE.ACTIVE;
  return {
    id,
    name,
    fn,
    maxQuality,
    qualitys: providerQualitys(maxQuality),
    platforms,
    anchors: opts.anchors || ["songmid", "id"],
    chain: lifecycle === PROVIDER_LIFECYCLE.ACTIVE ? Object.freeze(Object.assign({}, opts.chain || {})) : Object.freeze({}),
    upstreamGroup: opts.upstreamGroup || id,
    auth: opts.auth || PROVIDER_AUTH.NONE,
    lifecycle,
    reviewAt: opts.reviewAt || null,
    batch: opts.batch || 1,
    verified: !!opts.verified,
    coldStart: !!opts.coldStart,
    minQuality: opts.minQuality || null,
    note: opts.note || "",
  };
}

async function wyOuterGetUrl(platform, songId, quality, songInfo, cancelToken = null) {
  if (platform !== "wy") throw new Error(`${ERROR_CODES.PARAM_ERROR}: 网易云官方仅支持wy平台`);
  const id = songId ?? songInfo?.id ?? songInfo?.songmid;
  if (!id) throw new Error(`${ERROR_CODES.PARAM_ERROR}: 网易云官方缺少歌曲ID`);
  const url = WY_OUTER_API.replace("{id}", encodeURIComponent(String(id)));
  const res = await httpRequestWithRetry(url, {
    method: "GET",
    headers: { "User-Agent": getMobileUserAgent() },
    timeout: TIMEOUT_CONFIG.parse,
    follow_max: 5,
    cancelToken
  });
  const ct = String(res.headers?.["content-type"] || "");
  if (res.statusCode !== 200 || !/audio|octet|mpeg/i.test(ct)) {
    throw new Error(`${ERROR_CODES.NOT_FOUND}: 网易云该歌曲不可试听(可能需VIP)，跳过`);
  }
  return res.url || url;
}

async function xinghaiBackendGetUrl(platform, songId, quality, songInfo, cancelToken = null) {
  if (platform !== "kw") {
    throw new Error(`${ERROR_CODES.PARAM_ERROR}: 星海后端主域仅接入kw(wy签名URL本机403疑绑定后端出口IP，需家庭宽带自验后再开)`);
  }
  // v1.0 (E10)：后端实测支持 128k/320k/flac 三档（flac24bit 亦返回 flac 同链，故 maxQuality 记为 flac），不再限制 128k
  const selectedQuality = String(quality || "128k").toLowerCase();
  // v8.11.4（F-01，云端真测暴露）：旧实现 `?? "1"` 在没有 id 时兜底成 1 号歌，
  // 而该源只按 mid 出链、name/singer 不参与校验 → 必交付别人的音频（片段兜底还会把它
  // 标成「试听版」，用户点一首不存在的歌会听到别人的 5 秒）。缺 id 必须明确报错，不得猜。
  const id = songId ?? getHashOrMid(songInfo) ?? null;
  if (!id) {
    const idErr = new Error(`${ERROR_CODES.PARAM_ERROR}: 星海后端缺少 songmid/id，无法定位歌曲`);
    idErr.code = ERROR_CODES.PARAM_ERROR;
    throw idErr;
  }
  const params = {
    source: "kw",
    name: songInfo?.name || '',
    singer: songInfo?.singer || '',
    songmid: id,
    interval: songInfo?.interval || songInfo?.duration || '',
    albumName: songInfo?.albumName || songInfo?.album || '',
    quality: selectedQuality
  };
  const query = Object.keys(params).map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`).join('&');
  const res = await httpRequestWithRetry(`${XINGHAI_BACKEND_API}?${query}`, {
    method: "GET",
    // v8.4 修复：上游 token 校验升级——自定义 X-Token 被判"无效/过期，请使用官方版本"返回 403；
    // 实测不带 X-Token 的第三方调用放行(200，受总 QPS 限，notice 要求标注来源)。故不再发送自定义 token。
    headers: {
      "X-Client": "lx-aggregate/12.0",
      "User-Agent": "LX-Music-Mobile"
    },
    timeout: TIMEOUT_CONFIG.parse,
    cancelToken
  });
  const body = res.body;
  if (!body || typeof body !== "object") throw new Error(`${ERROR_CODES.SERVER_ERROR}: 星海后端返回无效`);
  if (Number(body.code) !== 200 || !body.url) throw new Error(body.msg ? `${ERROR_CODES.NOT_FOUND}: ${body.msg}` : `${ERROR_CODES.NOT_FOUND}: 星海后端无可用链接`);
  // v1.0 (D2 模式)：实测 https 同路径 206 可播，http→https 升级，避免明文播放受限
  return String(body.url).replace(/^http:\/\//i, "https://");
}

async function helloworldKwGetUrl(platform, songId, quality, songInfo, cancelToken = null) {
  if (platform !== "kw") throw new Error(`${ERROR_CODES.PARAM_ERROR}: helloworld仅支持kw平台`);
  const id = songInfo?.rid || songInfo?.songmid || songInfo?.id || songId;
  if (!id) throw new Error(`${ERROR_CODES.PARAM_ERROR}: helloworld缺少kw rid`);
  // v8.11：移除源内部缓存。旧实现在这里 6 小时直接返回裸 URL 且完全不校验——
  // 实测该源是酷我 VIP 歌「5 秒试听」的主要来源，内层缓存会把片段锁死 6 小时，
  // 即便外层判据已修好，重试也拿不到新链接。统一由 getUrlWithFallback 的单层缓存 + 命中校验管理。
  const q = String(quality || "128k").toLowerCase();
  const br = HELLOWORLD_KW_BR[q] || "2000kflac";
  // 通道①：酷我官方 convert_url_with_sign（rid 签名直链）
  const convertUrl = `${HELLOWORLD_KW_CONVERT_API}?f=web&user=0&source=kwplayerhd_ar_1.1.4.5_tianbao_T1A_qirui.apk&type=convert_url_with_sign&rid=${encodeURIComponent(String(id))}&br=${br}`;
  let lastError = null;
  try {
    const res = await httpRequestWithRetry(convertUrl, {
      method: "GET",
      headers: { "User-Agent": getMobileUserAgent() },
      timeout: TIMEOUT_CONFIG.parse,
      cancelToken
    });
    const data = res?.body;
    // v7.0：校验结构——code=200 + data.url 为直链（实测响应 {code:200, data:{url,format,...}}）
    if (data && typeof data === "object" && Number(data.code) === 200 && data.data && typeof data.data.url === "string" && data.data.url.length > 0) {
      const rawUrl = data.data.url;
      if (HTTP_URL_REGEX.test(rawUrl)) {
        // v6.0 同款：CDN 410 签名死链防御——Range 轻量校验可播才返回（不缓存、不计成功）
        const httpsUrl = assertDeliverableUrl(upgradeToHttps(rawUrl), "helloworld");
        if (!await isAudioPlayable(httpsUrl, 2500, cancelToken)) {
          const helloworldErr = new Error(`${ERROR_CODES.LINK_EXPIRED}: helloworld签名URL不可播(CDN 410)`);
          helloworldErr.code = ERROR_CODES.LINK_EXPIRED; // v8.10.4：必须设 code——竞速按 e.code 分类，只写在 message 里会被当成业务失败
          throw helloworldErr;
        }
        // v8.11：这里只做「URL 关键词式快速预筛」——实测对酷我试听直链（形如 car-bj.kuwo.cn/.../lx/resource/n2/53/24/1530828245.mp3）
        // 一个字都不沾，因此它从 v8.0 起就是死代码。真正的判据是 wrapExecute 里的 1KB 字节校验。
        if (cfg("previewUrlPreFilter", false) && isPreviewFragmentUrl(httpsUrl)) {
          throw new Error(`${ERROR_CODES.NOT_FOUND}: helloworld返回试听片段(非完整版)，跳过`);
        }
        return httpsUrl;
      }
    }
    lastError = new Error(`${ERROR_CODES.NOT_FOUND}: helloworld convert_url未返回有效链接`);
  } catch (e) { lastError = e; }
  // 通道②：haitangw v1 resolve-url 备用（通道①网络失败/结构异常时兜底）
  try {
    const res2 = await httpRequestWithRetry(HELLOWORLD_HTW_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": getMobileUserAgent() },
      body: JSON.stringify({
        source: "kw",
        songmid: String(id),
        quality: q === "128k" ? "standard" : (q === "320k" ? "high" : "lossless")
      }),
      timeout: TIMEOUT_CONFIG.parse,
      cancelToken
    });
    const d2 = res2?.body;
    if (d2 && typeof d2 === "object" && (Number(d2.code) === 0 || Number(d2.code) === 200) && typeof d2.url === "string" && d2.url.length > 0 && HTTP_URL_REGEX.test(d2.url)) {
      const httpsUrl2 = assertDeliverableUrl(upgradeToHttps(d2.url), "helloworld htw");
      if (!await isAudioPlayable(httpsUrl2, 2500, cancelToken)) {
        const helloworldHtwErr = new Error(`${ERROR_CODES.LINK_EXPIRED}: helloworld htw签名URL不可播(CDN 410)`);
        helloworldHtwErr.code = ERROR_CODES.LINK_EXPIRED; // v8.10.4：同上，必须设 code
        throw helloworldHtwErr;
      }
      // v8.11：通道②同款预筛（默认关闭，理由同通道①：主判据在 wrapExecute 的字节校验）
      if (cfg("previewUrlPreFilter", false) && isPreviewFragmentUrl(httpsUrl2)) {
        throw new Error(`${ERROR_CODES.NOT_FOUND}: helloworld htw返回试听片段(非完整版)，跳过`);
      }
      return httpsUrl2;
    }
    if (!lastError) lastError = new Error(`${ERROR_CODES.NOT_FOUND}: helloworld htw未返回有效链接`);
  } catch (e) { if (!lastError) lastError = e; }
  throw lastError || new Error(`${ERROR_CODES.NOT_FOUND}: helloworld失败`);
}

const changqingGetUrl = createTemplateVipSource(CHANGQING_KW_URL_TEMPLATE, /kw\.php/, "长青");

async function huibqGetUrl(platform, songId, quality, songInfo, cancelToken = null) {
  if (!HUIBQ_API || !HUIBQ_REQUEST_KEY) throw new Error(`${ERROR_CODES.CONFIG_ERROR}: Huibq未配置`);
  const songIdVal = songInfo?.hash ?? songInfo?.songmid ?? songId;
  if (!songIdVal) throw new Error(`${ERROR_CODES.PARAM_ERROR}: Huibq缺少ID`);
  const selectedQuality = String(quality || "128k").toLowerCase(); // v1.0 (D10)：链级已过滤，直接音质
  const url = `${HUIBQ_API}/url/${platform}/${encodeURIComponent(songIdVal)}/${encodeURIComponent(selectedQuality)}`;
  const res = await httpRequestWithRetry(url, {
    method: "GET",
    headers: { "Content-Type": "application/json", "User-Agent": getMobileUserAgent(), "X-Request-Key": HUIBQ_REQUEST_KEY },
    timeout: resolveColdStartTimeout(cfg('coldStartTimeoutMs', 5000), cfg('raceBudgetMs', 12000)), // v8.14.1：冷启动超时不得超过总预算
    cancelToken
  });
  const body = res.body;
  if (!body || typeof body !== "object" || Number.isNaN(Number(body.code))) throw new Error(`${ERROR_CODES.SERVER_ERROR}: Huibq返回无效`);
  if (Number(body.code) !== 0 || !body.url) throw new Error(body.msg || `${ERROR_CODES.NOT_FOUND}: Huibq未返回URL`);
  // v8.7：上游"未取到"时假成功治理——实测 tx/mg 请求拿不到时仍返回 code=0 + 一条可播但不属于该平台的兜底链
  //（msg「无法获取播放链接！」+ 酷我 panspace 链 206 可播 = 错歌）。必须按 msg 失败词判失败，避免静默交付错歌。
  if (isHuibqFailMsg(body.msg)) {
    throw new Error(`${ERROR_CODES.NOT_FOUND}: Huibq未取到该平台链接(${String(body.msg || "").slice(0, 40)})`);
  }
  return body.url;
}

async function juheGetUrl(platform, songId, quality, songInfo, cancelToken = null) {
  const juheQ = String(quality || "128k").toLowerCase();
  const mid = songInfo?.songmid || songInfo?.id || songId || "";
  // v4.0：各平台标识字段——kw/tx/mg 用 songmid，wy 用 id，kg 用 hash（酷狗哈希）
  // 实测（2026-10-28）：tx 全链路通(POST→303→vkeys 中转→qqmusic 直链)；wy/kg/mg 服务端
  // 当前受限(网易云上游 1027 风控/取链失败/超时)，注册为尽力型源，恢复即自动可用
  const idFields = platform === "kg"
    ? { hash: songInfo?.hash || mid, songmid: mid, id: mid }
    : platform === "wy"
      ? { id: mid, songmid: mid }
      : { songmid: mid, id: mid };
  // v6.0：完整字段透传（借鉴 HYWmusic 模式）——tx 高音质解析依赖 strMediaMid/mediaMid、
  // kg 依赖 hash、mg 依赖 copyrightId/rid/albumAudioId 等原始 ID；meta.* 层兜底，
  // 服务端拿到完整字段才能解析高音质直链
  const extraFields = {};
  for (const f of ['strMediaMid', 'mediaMid', 'hash', 'rid', 'copyrightId', 'musicId', 'albumAudioId', 'albumId', 'albumMid', 'songid', 'songId']) {
    const v = songInfo?.[f];
    if (v !== undefined && v !== null && v !== '') extraFields[f] = v;
  }
  for (const f of ['strMediaMid', 'mediaMid', 'hash', 'rid', 'copyrightId', 'name', 'singer', 'album']) {
    const v = songInfo?.meta?.[f];
    if (v !== undefined && v !== null && v !== '' && extraFields[f] === undefined) extraFields[f] = v;
  }
  const info = {
    type: juheQ,
    musicInfo: {
      ...extraFields,
      name: songInfo?.name || "",
      singer: songInfo?.singer || "",
      album: songInfo?.album || "",
      duration: songInfo?.duration || 0,
      interval: Math.round((songInfo?.duration || 0) / 1000),
      source: platform === "kw" ? "kw" : String(platform || "kw"),
      ...idFields,
      quality: juheQ
    }
  };
  const res = await httpRequestWithRetry(`${JUHE_API}/${platform}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": getMobileUserAgent() },
    body: JSON.stringify(info),
    timeout: 15000,
    cancelToken
  }, 1);
  const d = res.body;
  // v8.11.2（N1 实测）：上游 code 时而 "200"(字符串) 时而 200(数字)，旧实现严格比数字，
  // 字符串形态一律落到"响应异常"——该源在这种响应下 100% 失败。统一 String 归一后再比。
  const dCode = d && d.code !== undefined && d.code !== null ? String(d.code) : "";
  if (dCode === "200" && typeof d.data?.url === "string") return upgradeToHttps(d.data.url);
  if (dCode === "303" && d.data?.request) {
    const r = d.data.request;
    const resp = await httpRequest(r.url, {
      method: String(r.options?.method || "GET").toUpperCase(),
      headers: r.options?.headers || {},
      timeout: 10000,
      cancelToken
    });
    // 校验作用于整个响应对象（body 已由 httpRequest 解析为对象）：
    // check.key ['body','code'] → resp.body.code；url ['body','data','url'] → resp.body.data.url
    const check = d.data.response?.check;
    if (check && check.key?.length) {
      const got = check.key.reduce((acc, k) => (acc && typeof acc === "object" ? acc[k] : undefined), resp);
      // v8.11.2（N2 实测）：check.value 是 200(数字)、响应体是 "200"(字符串) 时旧实现严格比类型判失败。
      if (got === undefined || got === null || String(got) !== String(check.value)) throw new Error(`${ERROR_CODES.NOT_FOUND}: Juhe重定向校验失败`);
    }
    const u = (d.data.response?.url || []).reduce((acc, k) => (acc && typeof acc === "object" ? acc[k] : undefined), resp);
    if (typeof u === "string" && /^https?:/.test(u)) return upgradeToHttps(u);
    throw new Error(`${ERROR_CODES.NOT_FOUND}: Juhe重定向未取到直链`);
  }
  throw new Error(`${ERROR_CODES.NOT_FOUND}: Juhe响应异常(${d?.msg || "未知"})`);
}

async function qingliangTxGetUrl(platform, songId, quality, songInfo, cancelToken = null) {
  if (platform !== "tx") throw new Error(`${ERROR_CODES.PARAM_ERROR}: 晴亮只注册了 tx`);
  const qqId = dep('getQQSongId')(songInfo);
  const mid = (qqId && qqId.type === "mid" ? qqId.value : null) || songInfo?.songmid || songInfo?.id || songId || "";
  // 该线路只按 mid 出链，歌名不参与校验——缺 mid 必须报错，绝不兜底成"1 号歌"（v8.11.4 F-01 同型坑）
  if (!mid || typeof mid !== "string" || !mid.trim()) {
    throw new Error(`${ERROR_CODES.PARAM_ERROR}: 晴亮tx缺 songmid`);
  }
  const res = await httpRequestWithRetry(QINGLIANG_TX_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Referer": "https://music.lzmhhh.com/",
      "User-Agent": getMobileUserAgent()
    },
    body: `id=${encodeURIComponent(mid.trim())}&type=qq`,
    timeout: QINGLIANG_TX_TIMEOUT_MS,
    cancelToken
  }, 1);
  const d = res && res.body;
  const code = d && d.code !== undefined && d.code !== null ? String(d.code) : "";
  const data = d && d.data;
  const url = typeof data === "string" ? data : (data && typeof data.url === "string" ? data.url : "");
  if (code === "1" && typeof url === "string" && /^https?:/.test(url)) {
    const u = upgradeToHttps(url);
    // v8.16（借 xinglan 的 freeTrialInfo/RS0 思路）：接口层已给结构化试听标记，或链是 QQ 试听前缀，
    // 就直接判片段——省一次 Range，也不让 60s 片段被当全曲交付；fragmentUrl 带出去供 B 方案兜底。
    if (trialMarkOf(d) || isPreviewFragmentUrl(u)) {
      const err = new Error(`${ERROR_CODES.PREVIEW_FRAGMENT}: 晴亮tx只给试听片段`);
      err.code = ERROR_CODES.PREVIEW_FRAGMENT;
      err.evidence = "medium";
      err.fragmentUrl = u;
      err.fragmentQuality = "128k";
      throw err;
    }
    return u;
  }
  throw new Error(`${ERROR_CODES.NOT_FOUND}: 晴亮tx响应异常(${(d && d.msg) || code || "未知"})`);
}

async function ikunGetUrl(platform, songId, quality, songInfo, cancelToken = null) {
  if (platform !== "kw" && platform !== "wy") throw new Error(`${ERROR_CODES.PARAM_ERROR}: ikun仅支持kw/wy平台`);
  const id = songInfo?.hash ?? songInfo?.songmid ?? songId;
  if (!id) throw new Error(`${ERROR_CODES.PARAM_ERROR}: ikun缺少歌曲ID`);
  const res = await httpRequestWithRetry(`${IKUN_API}/music/url`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": getMobileUserAgent(), "X-Api-Key": USER_CONFIG.ikunApiKey || "" },
    body: JSON.stringify({ source: platform, musicId: String(id), quality: quality || "128k" }),
    timeout: TIMEOUT_CONFIG.parse,
    follow_max: 5,
    cancelToken
  });
  const body = res.body;
  if (!body || typeof body !== "object" || Number.isNaN(Number(body.code))) throw new Error(`${ERROR_CODES.SERVER_ERROR}: ikun返回无效`);
  const code = Number(body.code);
  if (code === 200 && body.url) return upgradeToHttps(body.url);
  if (code === 403) throw new Error(`${ERROR_CODES.CONFIG_ERROR}: ikun卡密失效/鉴权失败（公益版留空卡密即可）`);
  if (code === 429) throw new Error(`${ERROR_CODES.RATE_LIMIT}: ikun请求过频`);
  throw new Error(`${ERROR_CODES.NOT_FOUND}: ikun ${body.message || "获取URL失败"}`);
}

function providerQualitys(maxQuality) {
  const rank = PROVIDER_QUALITY_ORDER.indexOf(String(maxQuality || "128k").toLowerCase());
  const cap = rank < 0 ? 0 : rank;
  return PROVIDER_QUALITY_ORDER.slice(0, cap + 1);
}





function assertDeliverableUrl(url, sourceName) {
  const u = typeof url === "string" ? url.trim() : "";
  if (!HTTP_URL_REGEX.test(u)) {
    const err = new Error(`${ERROR_CODES.PARAM_ERROR}: ${sourceName}返回非法URL(非http/https)`);
    err.code = ERROR_CODES.PARAM_ERROR;
    throw err;
  }
  return u;
}

async function isAudioPlayable(audioUrl, timeoutMs = 3000, cancelToken = null) {
  if (!audioUrl || typeof audioUrl !== "string" || !HTTP_URL_REGEX.test(audioUrl)) return false;
  try {
    const res = await httpRequest(audioUrl, {
      method: "GET",
      headers: { "User-Agent": getMobileUserAgent(), "Range": "bytes=0-1023" },
      timeout: timeoutMs,
      follow_max: 5,
      cancelToken
    });
    const ct = String(res.headers?.["content-type"] || "");
    // v8.16.2（R-12⑦）：旧实现 206 一律放行——Range 请求几乎都是 206，于是 content-type
    // 是 text/html / application/json 的「假音频」也被判可播。这里 206/200 同口径：
    // 有 content-type 就必须像音频；缺失时仍放行（不少 CDN 不返回该头，保持原宽容度）。
    const looksAudio = /audio|octet|mpeg|mp3|flac|ogg|aac|mp4|m4a/i.test(ct);
    const looksText = /text\/|json|html/i.test(ct);
    // v9.1：200 与 206 口径对齐。此前两处不对称会**误杀**正常源（不是漏判，是错判）：
    //   ① 206 缺 content-type 放行，200 缺头却判死 —— 忽略 Range 头、直接回 200 的 CDN 被封成死链；
    //   ② 200 分支的音频正则不含 mp4|m4a —— `audio/mp4` 的 m4a 直链被判死。
    // 误杀的代价：上层把 false 翻成 LINK_EXPIRED 进 byQuality.linkExpired，累计 3 次压制该源该档 6 小时。
    // 主判据仍是 08-media.js 的 sniffAudioBytes（读真实字节判魔数），这里只是预筛，口径必须一致。
    if (res.statusCode === 206) {
      if (!ct) return true;                    // 缺头仍放行（部分 CDN 不给 content-type）
      if (looksAudio) return true;
      throw notAudioError(ct);                 // 206 + text/html / json：内容不是音频，不是死链
    }
    if (res.statusCode === 200) {
      if (!ct) return true;                    // ① 与 206 统一：缺头不再判死
      if (looksAudio) return true;             // ② 放行 audio/mp4 / video/mp4 等 m4a 常见类型
      if (looksText) throw notAudioError(ct);  // 200 + 文本类：内容不是音频
      return false;                            // 其余未知类型：保守判不可播（与旧 200 行为一致）
    }
    return false;
  } catch (e) {
    // v8.10.4：网络类异常 ≠ 死链。旧实现一律 return false，调用方据此抛 LINK_EXPIRED，
    // 该码不进 failureCount 但会计入 byQuality.linkExpired，命中档位短路判据
    // (fail+linkExpired)>=3 后把该源该音质档压制 6 小时——而按网络类处理只需 180s 冷却 + 半开探针自愈。
    // 故此处改为抛出原错误码（NETWORK_TIMEOUT / NETWORK_ERROR / SERVER_ERROR / RATE_LIMIT），
    // 仅当确实是 LINK_EXPIRED（410）时才仍返回 false 交给调用方判死链。
    const code = (e && e.code) ? e.code : ERROR_CODES.NETWORK_ERROR;
    if (code === ERROR_CODES.LINK_EXPIRED) return false;
    const err = new Error(`${code}: 可播性校验未完成(${(e && e.message) || "unknown"})`);
    err.code = code;
    throw err;
  }
}





const HUIBQ_API = "https://lxmusicapi.onrender.com";



function resolveColdStartTimeout(coldRaw, totalRaw) {
  const totalMs = Math.min(Math.max(Number(totalRaw) || 12000, 1000), 15000);
  return Math.min(Math.max(Number(coldRaw) || 5000, 1000), totalMs);
}

function isHuibqFailMsg(msg) { return HUIBQ_FAIL_MSG_REGEX.test(String(msg || "")); }

const QINGLIANG_TX_URL = "https://music.lzmhhh.com/api/music/url";



function trialMarkOf(payload) {
  if (!payload || typeof payload !== "object") return false;
  for (const key of ["freeTrialInfo", "freeTrialPrivilege", "trialInfo", "freeTrial", "privilege"]) {
    const v = payload[key];
    if (v === true) return true;
    if (Array.isArray(v) && v.length > 0) return true;
    if (v && typeof v === "object") {
      if (v.freeTrial === true || v.trial === true || v.flag === 1 || v.status === 1) return true;
    }
  }
  const rs0 = payload.RS0 !== undefined ? payload.RS0 : payload.rs0;
  if (rs0 === 1 || rs0 === "1") return true;
  return false;
}



function notAudioError(ct) {
  const err = new Error(`${ERROR_CODES.NOT_AUDIO}: 交付内容不是音频(content-type=${String(ct).slice(0, 64)})`);
  err.code = ERROR_CODES.NOT_AUDIO;
  return err;
}

const HUIBQ_FAIL_MSG_REGEX = /无法获取|获取失败|失败|错误|不存在|无效|error/i;

const SOURCE_HANDLERS = {
  // ---- 上链源：11 个 ----
  suyinKuwo: provider("suyinKuwo", "溯音酷我", (platform, songId, quality, songInfo, cancelToken) => suyinKuwoGetUrl(songInfo, quality, cancelToken), "flac", {
    platforms: ["kw", "wy", "tx", "mg", "kg"],
    anchors: ["rid", "songmid", "id"],
    chain: { kw: 1, wy: 6, tx: 1, mg: 1, kg: 1 },
    upstreamGroup: "oiapi-kuwo",
    verified: true,
    note: "五平台兜底；128k 使用 br=9（实测唯一可播）",
  }),
  wyOuter: provider("wyOuter", "网易云官方", wyOuterGetUrl, "128k", {
    platforms: ["wy"], anchors: ["songmid", "id"], chain: { wy: 4 }, upstreamGroup: "wy-official",
    note: "官方 outer 直连，默认只做 128k",
  }),
  kuwoOfficial: provider("kuwoOfficial", "酷我官方直连", kuwoOfficialGetUrl, "128k", {
    platforms: ["kw"], anchors: ["rid", "songmid", "id"], chain: { kw: 5 }, upstreamGroup: "kuwo-official",
  }),
  suyin163: provider("suyin163", "溯音163", (platform, songId, quality, songInfo, cancelToken) => suyinGetUrl("wy", songId, quality, songInfo, cancelToken), "128k", {
    platforms: ["wy"], anchors: ["songmid", "id"], chain: { wy: 3 }, upstreamGroup: "oiapi-163",
  }),
  xinghaiBackend: provider("xinghaiBackend", "星海后端", xinghaiBackendGetUrl, "flac", {
    platforms: ["kw"], anchors: ["songmid", "id"], chain: { kw: 2 }, upstreamGroup: "xinghai-backend",
  }),
  helloworldKw: provider("helloworldKw", "helloworld(kw)", helloworldKwGetUrl, "flac", {
    platforms: ["kw"], anchors: ["rid", "songmid", "id"], chain: { kw: 4 }, upstreamGroup: "kuwo-convert",
    note: "kw 128k/320k/flac；部分 VIP 歌可能只给片段，验真闸门兜底",
  }),
  changqingVip: provider("changqingVip", "长青kw", changqingGetUrl, "128k", {
    platforms: ["kw"], anchors: ["rid", "songmid", "id"], chain: { kw: 6 }, upstreamGroup: "changqing-kw",
  }),
  huibq: provider("huibq", "Huibq", huibqGetUrl, "320k", {
    platforms: ["kw", "wy"], anchors: ["rid", "songmid", "id"], chain: { kw: 8, wy: 8 }, upstreamGroup: "huibq",
    coldStart: true, note: "onrender 冷启动；仅 kw/wy 实测可用",
  }),
  juheTx: provider("juheTx", "Juhe聚合(tx)", juheGetUrl, "flac", {
    platforms: ["tx"], anchors: ["songmid", "musicId", "id"], chain: { tx: 3 }, upstreamGroup: "juhe",
    reviewAt: "2026-11-19", note: "2026-11-11 恢复；7 天复核，降为 tx 第三源（本轮 0% 成功率）",
  }),
  qingliangTx: provider("qingliangTx", "晴亮(tx)", qingliangTxGetUrl, "320k", {
    platforms: ["tx"], anchors: ["songmid", "musicId", "id"], chain: { tx: 2 }, upstreamGroup: "qingliang-tx",
    reviewAt: "2026-11-18", note: "2026-11-15 实测 5/5 全曲 320k；第三方单点，3 天复核",
  }),
  ikun: provider("ikun", "ikun", ikunGetUrl, "flac", {
    platforms: ["kw", "wy"], anchors: ["rid", "songmid", "id"], chain: { kw: 7, wy: 5 }, upstreamGroup: "ikun",
    auth: PROVIDER_AUTH.OPTIONAL, note: "公益版免卡密；卡密可选",
  }),
  // ---- 观察源：2 个（probation，只探测、不进链） ----
  suyinQQ: provider("suyinQQ", "溯音QQ", (platform, songId, quality, songInfo, cancelToken) => suyinGetUrl("tx", songId, quality, songInfo, cancelToken), "flac", {
    platforms: ["tx"], anchors: ["songmid", "musicId", "id"], lifecycle: PROVIDER_LIFECYCLE.PROBATION,
    upstreamGroup: "oiapi-qq", reviewAt: "2026-11-19", note: "2026-11-11 实测 HTTP 403；观察至 2026-11-19",
  }),
  suyinMigu: provider("suyinMigu", "溯音咪咕", (platform, songId, quality, songInfo, cancelToken) => suyinGetUrl("mg", songId, quality, songInfo, cancelToken), "flac", {
    platforms: ["mg"], anchors: ["copyrightId", "id"], lifecycle: PROVIDER_LIFECYCLE.PROBATION,
    upstreamGroup: "xcvts-migu", reviewAt: "2026-11-26", note: "2026-11-11 实测上游 502；观察至 2026-11-26",
    verified: true,
  }),
};

module.exports = {
  SOURCE_HANDLERS,
  provider,
  wyOuterGetUrl,
  xinghaiBackendGetUrl,
  helloworldKwGetUrl,
  changqingGetUrl,
  huibqGetUrl,
  juheGetUrl,
  qingliangTxGetUrl,
  ikunGetUrl,
  providerQualitys,
  WY_OUTER_API,
  HELLOWORLD_KW_BR,
  assertDeliverableUrl,
  isAudioPlayable,
  HELLOWORLD_HTW_API,
  CHANGQING_KW_URL_TEMPLATE,
  HUIBQ_API,
  HUIBQ_REQUEST_KEY,
  resolveColdStartTimeout,
  isHuibqFailMsg,
  QINGLIANG_TX_URL,
  QINGLIANG_TX_TIMEOUT_MS,
  trialMarkOf,
  PROVIDER_QUALITY_ORDER,
  notAudioError,
  HUIBQ_FAIL_MSG_REGEX,
};
