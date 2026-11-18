// ============================================================
// v9.0 业务层 · 31-suyin-qq（溯音 QQ 线路（取链、songId 解析、音质映射））
// 反向闭包裁剪簇；对遗留 legacy 符号走 dep(name) 依赖注入
// ============================================================
const { ERROR_CODES } = require("./02-error-codes.js");
const { QUALITY_TO_X } = require("./09-match.js");
const { httpGet } = require("./14-lyric.js");
const { RETRY_TIMES } = require("./07-net.js");
const { dep } = require("./06-binding.js");

async function suyinQQGetUrl(songInfo, quality, cancelToken = null) {
  const qqId = getQQSongId(songInfo);
  if (!qqId) throw new Error(`${ERROR_CODES.PARAM_ERROR}: 溯音QQ缺少songmid/id`);
  const normalizedQuality = qualityToSuyinQQ(quality);
  const startBr = QUALITY_TO_X.suyinQQ[normalizedQuality] || QUALITY_TO_X.suyinQQ["128k"];
  const brList = [startBr, 4, 5, 7]
    .filter((val, idx, arr) => arr.indexOf(val) === idx && val >= startBr)
    .sort((a, b) => a - b);
  let lastError = null;
  for (const br of brList) {
    try {
      const reqParams = { key: SUYIN_QQ_KEY, type: "json", br, n: 1 };
      if (qqId.type === "mid") reqParams.mid = qqId.value;
      else reqParams.songid = qqId.value;
      const res = await httpGet(SUYIN_QQ_API, reqParams, 'parse', null, RETRY_TIMES, cancelToken);
      if (res?.music) return res.music;
      if (res?.url) return res.url;
      if (res?.message) {
        const match = String(res.message).match(/音频链接[：:](.+?)(?:\n|$)/);
        if (match && match[1]) return match[1].trim();
      }
      throw new Error(`${ERROR_CODES.NOT_FOUND}: 溯音QQ未找到音频链接`);
    } catch (e) { lastError = e; }
  }
  throw lastError || new Error(`${ERROR_CODES.NOT_FOUND}: 溯音QQ全部音质尝试失败`);
}

function getQQSongId(songInfo) {
  const mid = songInfo?.meta?.qq?.mid || songInfo?.meta?.mid || songInfo?.songmid ||
    (typeof songInfo?.id === "string" && !/^\d+$/.test(songInfo.id) ? songInfo.id : null);
  if (mid) return { type: "mid", value: mid };
  const songid = songInfo?.meta?.qq?.songid || songInfo?.meta?.songid ||
    (typeof songInfo?.id === "number" ? songInfo.id :
      (typeof songInfo?.id === "string" && /^\d+$/.test(songInfo.id) ? Number(songInfo.id) : null));
  if (songid) return { type: "songid", value: songid };
  return null;
}

function qualityToSuyinQQ(quality) {
  const q = String(quality || "128k").toLowerCase();
  if (q === "flac24bit") return "hires";
  if (q === "192k") return "320k";
  return QUALITY_TO_X.suyinQQ[q] ? q : "128k";
}

const SUYIN_QQ_KEY = "oiapi-ef6133b7-ac2f-dc7d-878c-d3e207a82575";

const SUYIN_QQ_API = "https://oiapi.net/api/QQ_Music";

module.exports = {
  suyinQQGetUrl,
  getQQSongId,
  qualityToSuyinQQ,
  SUYIN_QQ_KEY,
  SUYIN_QQ_API,
};
