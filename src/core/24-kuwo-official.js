// ============================================================
// v9.0 业务层 · 24-kuwo-official（酷我官方线路（取链、搜索、音质转换））
// 反向闭包裁剪簇；对遗留 legacy 符号走 dep(name) 依赖注入
// ============================================================
const { httpRequest, HTTP_URL_REGEX, setCachedUrl, buildCacheKey } = require("./07-net.js");
const { KUWO_CONVERT_API } = require("./10-vendors.js");
const { kuwoUnescape } = require("./10-vendors.js");
const { ERROR_CODES } = require("./02-error-codes.js");
const { artistMatch, normalizeKeyword, titleMatch } = require("./09-match.js");
const { KUWO_SEARCH_API } = require("./10-vendors.js");
const { TIMEOUT_CONFIG, getMobileUserAgent, httpRequestWithRetry } = require("./07-net.js");
const { request } = require("./00-host.js");
const { dep } = require("./06-binding.js");

async function kuwoOfficialGetUrl(platform, songId, quality, songInfo, cancelToken = null) {
  if (platform !== "kw") throw new Error(`${ERROR_CODES.PARAM_ERROR}: 酷我官方仅支持kw平台`);
  if (!songInfo?.name) throw new Error(`${ERROR_CODES.PARAM_ERROR}: 酷我官方需要歌曲名`);
  // v8.16.2（R-12①）：这里原本读 `buildCacheKey("kwoff", …)`，但全仓 setCachedUrl 只有一个写入口
  // 且写的是 `buildCacheKey(platform, …)`（platform="kw"），kwoff 键**从来没有被写过**——永远 miss 的死读。
  // 外层 getUrlWithFallback 的成功缓存已覆盖同语义，故直接删除，避免"看起来有缓存其实没有"的误导。
  const targetName = normalizeKeyword(songInfo.name);
  const items = await kuwoOfficialSearch(`${songInfo.name} ${songInfo.singer || ""}`.trim(), 10, cancelToken);
  if (!items.length) throw new Error(`${ERROR_CODES.NOT_FOUND}: 酷我官方搜索无结果`);
  // 匹配优先级：歌名精确 → 歌名包含 → 第一首；歌手/时长辅助校验
  let match = null;
  for (const item of items) {
    if (normalizeKeyword(item.name) === targetName) { match = item; break; }
  }
  if (!match) {
    for (const item of items) {
      const n = normalizeKeyword(item.name);
      if (n && n.includes(targetName)) { match = item; break; }
    }
  }
  if (!match) match = items[0];
  // v6.0：匹配结果加歌手/时长轻量校验——搜索接口同名歌多（翻唱/不同版本），
  // 旧实现"精确→包含→第一首"可能取到同名错歌；校验不通过明确失败走下一源，比播放错歌可诊断
  if (!titleMatch(match.name, songInfo.name) || (songInfo.singer && !artistMatch(songInfo.singer, match.singer))) {
    throw new Error(`${ERROR_CODES.MISMATCH}: 酷我官方匹配结果与目标歌曲不符`);
  }
  const url = await kuwoOfficialConvert(match.rid, cancelToken);
  // v8.12（D-20）：删除内层写缓存——此处 URL 未经验真，片段会被当完整音频缓存，
  // 且缓存命中处的验真在上游异常时 fail-open，用户复播直接吃 5 秒片段。缓存统一由外层（验真后）写。
  return url;
}

async function kuwoOfficialSearch(keyword, rn = 10, cancelToken = null) {
  const url = `${KUWO_SEARCH_API}?client=kt&all=${encodeURIComponent(keyword)}&pn=0&rn=${rn}&ft=music&rformat=json&encoding=utf8`;
  const res = await httpRequestWithRetry(url, {
    method: "GET",
    headers: { "User-Agent": getMobileUserAgent() },
    timeout: TIMEOUT_CONFIG.search,
    cancelToken
  });
  const raw = typeof res.body === "string" ? res.body : String(res.body || "");
  // v8.12：宿主的 httpRequest 已会把“合法 JSON 字符串”自动 parse 成对象；
  // 旧实现只按字符串处理，拿到对象后 String() 成 [object Object]，搜索恒空。
  // 兼容三种形态：已经是对象 / Python repr 单引号串 / 合法 JSON 串。
  let parsed = (res.body && typeof res.body === "object") ? res.body : null;
  if (!parsed) {
    // R77（R76-P2-05）：先按原串解析——含撇号歌名（如 Don't Stop）被 '→" 清洗会破坏 JSON；
    // 原串失败再退清洗版，避免把合法条目判 MISMATCH。
    try { parsed = JSON.parse(raw); } catch (e) { /* 继续 */ }
    if (!parsed) {
      const cleaned = raw.replace(/'/g, '"');
      try { parsed = JSON.parse(cleaned); } catch (e) { /* 解析失败走正则兜底 */ }
    }
  }
  if (parsed && Array.isArray(parsed.abslist)) {
    return parsed.abslist.map(item => ({
      rid: String(item.MP3RID || "").replace("MP3_", ""),
      name: kuwoUnescape(item.NAME),
      singer: kuwoUnescape(item.ARTIST),
      duration: Number(item.DURATION) || 0
    })).filter(i => i.rid);
  }
  // 正则兜底
  const items = [];
  const blockRe = /\{'MP3RID':'MP3_(\d+)'/g;
  let m;
  while ((m = blockRe.exec(raw))) {
    items.push({ rid: m[1], name: "", singer: "", duration: 0 });
  }
  return items;
}

async function kuwoOfficialConvert(rid, cancelToken = null) {
  if (!rid) throw new Error(`${ERROR_CODES.PARAM_ERROR}: 酷我官方缺少rid`);
  const url = `${KUWO_CONVERT_API}?type=convert_url&rid=${encodeURIComponent(rid)}&format=mp3&response=url`;  const res = await httpRequestWithRetry(url, {
    method: "GET",
    headers: { "User-Agent": getMobileUserAgent() },
    timeout: TIMEOUT_CONFIG.parse,
    cancelToken
  });
  const text = typeof res.body === "string" ? res.body.trim() : String(res.body || "").trim();
  if (!text || text === "refuse request!" || !HTTP_URL_REGEX.test(text)) {
    throw new Error(`${ERROR_CODES.NOT_FOUND}: 酷我官方convert_url未返回链接`);
  }
  return text;
}

module.exports = {
  kuwoOfficialGetUrl,
  kuwoOfficialSearch,
  kuwoOfficialConvert,
};
