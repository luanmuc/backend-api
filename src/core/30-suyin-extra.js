// ============================================================
// v9.0 业务层 · 30-suyin-extra（溯音补充线路（咪咕/QQ 取链与搜索词构造））
// 反向闭包裁剪簇；对遗留 legacy 符号走 dep(name) 依赖注入
// ============================================================
const { validateUrl } = require("./19-dispatch.js");
const { ERROR_CODES } = require("./02-error-codes.js");
const { HTTP_URL_REGEX, RETRY_TIMES, buildCacheKey, getCachedUrl } = require("./07-net.js");
const { httpGet } = require("./14-lyric.js");
const { normalizeKeyword, songInfoMatch } = require("./09-match.js");
const { dep } = require("./06-binding.js");

async function suyinMiguGetUrl(songInfo, cancelToken = null) {
  if (!songInfo?.name) throw new Error(`${ERROR_CODES.PARAM_ERROR}: 溯音咪咕需要歌曲名`);
  const cacheKey = buildCacheKey("mg", songInfo);
  const cached = getCachedUrl(cacheKey);
  // v7.0 (S1)：内部缓存命中返回裸 URL 字符串（validateUrl 只接受字符串；子源透出由外层统一组装）
  if (cached && cached.url) return cached.url;
  const keywords = buildSearchKeywords(songInfo);
  let lastError = null;
  for (const item of keywords) {
    try {
      const res = await httpGet(SUYIN_MIGU_API, { gm: item.keyword, n: 1, num: 1, type: "json" }, 'parse', null, RETRY_TIMES, cancelToken);
      if (res?.code === 200 && res?.musicInfo) {
        // v1.0 P0-2：兜底档也做歌名校验+时长校验（与溯音酷我一致，轻量：歌手/专辑可放宽）
        if (!songInfoMatch(res, item.strict ? songInfo : { name: songInfo.name, duration: songInfo.duration })) throw new Error(`${ERROR_CODES.MISMATCH}: 溯音咪咕歌曲信息不匹配`);
        // v6.0：修复缓存/返回缺陷——musicInfo 为对象不能当直链缓存与返回（validateUrl 必拦、缓存永不命中）。
        // 上游 502 实测无法确认字段结构，统一按字符串 URL 提取，失败抛明确错误（不把对象伪装成直链）
        const miguUrl = typeof res.musicInfo === "string"
          ? res.musicInfo
          : (typeof res.musicInfo?.url === "string" ? res.musicInfo.url : null);
        if (!miguUrl || !HTTP_URL_REGEX.test(miguUrl)) throw new Error(`${ERROR_CODES.SERVER_ERROR}: 溯音咪咕未返回可用的音频直链(字段结构待上游恢复后验证)`);
        // v8.12（D-20）：同上，未验真不入缓存
        return miguUrl;
      }
    } catch (e) { lastError = e; }
  }
  throw lastError || new Error(`${ERROR_CODES.NOT_FOUND}: 溯音咪咕失败`);
}

function buildSearchKeywords(songInfo) {
  const keywords = [];
  const name = songInfo?.name || "";
  const album = songInfo?.albumName || songInfo?.album || "";
  const singer = songInfo?.singer || "";
  if (name && album) {
    const kw = normalizeKeyword(name + album);
    if (kw) keywords.push({ keyword: kw, strict: true });
  }
  if (name && singer) {
    const kw = normalizeKeyword(name + singer);
    if (kw) keywords.push({ keyword: kw, strict: true });
  }
  if (name) {
    const kw = normalizeKeyword(name);
    if (kw) keywords.push({ keyword: kw, strict: false });
  }
  return keywords;
}

const SUYIN_MIGU_API = "https://api.xcvts.cn/api/music/migu";

module.exports = {
  suyinMiguGetUrl,
  buildSearchKeywords,
  SUYIN_MIGU_API,
};
