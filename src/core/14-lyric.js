// ============================================================
// v9.0 业务层 · 14-lyric（歌词 / 封面 / HTTP 头探测）
// 来源：legacy 碎片；对 legacy 的引用已改为依赖注入 dep(name)（打断反向引用环）
// ============================================================
const { ERROR_CODES } = require("./02-error-codes.js");
const { RETRY_TIMES, buildQueryString, TIMEOUT_CONFIG, httpRequestWithRetry, getMobileUserAgent } = require("./07-net.js");
const { KUWO_SEARCH_API } = require("./10-vendors.js");
const { dep } = require("./06-binding.js");

const WY_LYRIC_API = "https://music.163.com/api/song/lyric";

async function getLyricForPlatform(platform, songInfo) {
  if (!songInfo || typeof songInfo !== "object") throw new Error(`${ERROR_CODES.PARAM_ERROR}: 无效的歌曲信息`);
  if (platform !== "wy") throw new Error(`${ERROR_CODES.NOT_FOUND}: ${platform} 平台暂无稳定歌词接口`);
  const id = songInfo?.songmid || songInfo?.id;
  if (!id) throw new Error(`${ERROR_CODES.PARAM_ERROR}: 网易云歌词缺少歌曲ID`);
  const res = await httpGet(WY_LYRIC_API, { id: String(id), lv: 1, kv: 1, tv: -1 }, 'parse', null, 0); // 二轮审计：歌词可降级，不重试（否则 5s→10s 拖慢切歌）
  const lyric = res?.lrc?.lyric;
  if (typeof lyric !== "string" || !lyric.length) throw new Error(`${ERROR_CODES.NOT_FOUND}: 网易云歌词不存在或需VIP`);
  return {
    lyric,
    tlyric: (typeof res?.tlyric?.lyric === "string" && res.tlyric.lyric.length) ? res.tlyric.lyric : null,
    rlyric: null
  };
}

async function httpGet(url, params = {}, timeoutType = 'default', headers = null, retries = RETRY_TIMES, cancelToken = null) {
  const fullUrl = url + buildQueryString(params);
  const opts = { method: "GET", timeout: TIMEOUT_CONFIG[timeoutType] || TIMEOUT_CONFIG.default, cancelToken };
  // v7.0 (S4)：可选请求头——部分上游对无 UA 请求差异化响应，调用方可显式传移动 UA 提高稳定性
  if (headers && typeof headers === "object" && Object.keys(headers).length) opts.headers = headers;
  const res = await httpRequestWithRetry(fullUrl, opts, retries);
  return res.body;
}

async function getPicForPlatform(platform, songInfo) {
  if (!songInfo || typeof songInfo !== "object") throw new Error(`${ERROR_CODES.PARAM_ERROR}: 无效的歌曲信息`);
  if (platform === "wy") {
    const id = songInfo?.songmid || songInfo?.id;
    if (!id) throw new Error(`${ERROR_CODES.PARAM_ERROR}: 网易云封面缺少歌曲ID`);
    // v7.0 (S4)：网易 detail 接口实测(2026-10-30 双曲对照)带 ids 参数时返回结构顶层 picUrl 恒为 null，
    // 封面稳定存在于 songs[0].album.picUrl / blurPicUrl——必须回退取 album 字段，否则封面永远 NOT_FOUND。
    // 同时补移动 UA 头：网易对无 UA 请求存在差异化/不稳定响应(实测同参有时 200 完整有时 200 空响应)。
    const res = await httpGet(WY_DETAIL_API, { id: String(id), ids: `[${String(id)}]` }, 'parse', { "User-Agent": getMobileUserAgent() });
    const song = res?.songs?.[0];
    const picUrl = song?.picUrl || song?.album?.picUrl || song?.album?.blurPicUrl;
    if (typeof picUrl !== "string" || !/^https?:/.test(picUrl)) throw new Error(`${ERROR_CODES.NOT_FOUND}: 网易云封面获取失败`);
    return picUrl;
  }
  if (platform === "kw") {
    const keyword = songInfo?.name ? `${songInfo.name} ${songInfo?.singer || ""}`.trim() : "";
    if (!keyword) throw new Error(`${ERROR_CODES.PARAM_ERROR}: 酷我封面缺少歌曲名`);
    return kuwoPicSearch(keyword);
  }
  throw new Error(`${ERROR_CODES.NOT_FOUND}: ${platform} 平台暂无稳定封面接口`);
}

async function kuwoPicSearch(keyword) {
  const url = `${KUWO_SEARCH_API}?client=kt&all=${encodeURIComponent(keyword)}&pn=0&rn=1&ft=music&rformat=json&encoding=utf8`;
  const res = await httpRequestWithRetry(url, {
    method: "GET",
    headers: { "User-Agent": getMobileUserAgent() },
    timeout: TIMEOUT_CONFIG.search
  });
  const raw = typeof res.body === "string" ? res.body : String(res.body || "");
  // R77（R76-P2-05 同族）：先按原串解析，失败再退 '→" 清洗版（含撇号歌名不会被洗坏）。
  let parsed = null;
  try { parsed = JSON.parse(raw); } catch (e) { /* 继续 */ }
  if (!parsed) {
    const cleaned = raw.replace(/'/g, '"');
    try { parsed = JSON.parse(cleaned); } catch (e) { /* 继续 */ }
  }
  try {
    const item = parsed?.abslist?.[0];
    if (item) {
      // hts_MVPIC 为完整 https 封面；MVPIC 为短路径需拼 img2.kuwo.cn 前缀
      const pic = item.hts_MVPIC || (item.MVPIC ? `https://img2.kuwo.cn/${item.MVPIC}` : null);
      if (typeof pic === "string" && /^https?:/.test(pic)) return pic;
    }
  } catch (e) { /* 解析失败走 NOT_FOUND */ }
  throw new Error(`${ERROR_CODES.NOT_FOUND}: 酷我封面获取失败`);
}

const WY_DETAIL_API = "https://music.163.com/api/song/detail";

module.exports = {
  WY_LYRIC_API,
  getLyricForPlatform,
  httpGet,
  getPicForPlatform,
  kuwoPicSearch,
  WY_DETAIL_API,
};
