// ============================================================
// v9.0 业务层 · 29-search（聚合搜索入口（suyin 搜索与消息歌解析））
// 反向闭包裁剪簇；对遗留 legacy 符号走 dep(name) 依赖注入
// ============================================================
const { normalizeDurationSec } = require("./09-match.js");
const { originalDurationSec, verifyDelivery } = require("./15-verify.js");
const { httpGet } = require("./14-lyric.js");
const { RETRY_TIMES } = require("./07-net.js");
const { durationHintByKey, durationHintKey, songInfoMatch } = require("./09-match.js");
const { ERROR_CODES } = require("./02-error-codes.js");
const { durationHintNameKey, durationHints } = require("./15-verify.js");
const { cfg } = require("./02-config.js");
const { dep } = require("./06-binding.js");

async function suyinKuwoSearch(keyword, br, songInfo = null, cancelToken = null) {
  const res = await httpGet(SUYIN_KUWO_API, { msg: keyword, n: 1, br }, 'parse', null, RETRY_TIMES, cancelToken);
  if (res?.data?.url) {
    if (songInfo && !songInfoMatch(res, songInfo)) throw new Error(`${ERROR_CODES.MISMATCH}: 溯音酷我歌曲信息不匹配`);
    return res.data.url;
  }
  if (res?.message) {
    const match = String(res.message).match(/音乐链接[：:](\S+)/);
    if (match && match[1]) {
      if (songInfo) {
        const parsed = parseMessageSongInfo(res.message);
        if (parsed && !songInfoMatch(parsed, songInfo)) throw new Error(`${ERROR_CODES.MISMATCH}: 溯音酷我歌曲信息不匹配`);
        // D-39：message 里的时长必须回填。旧实现只拿 parsed 做歌名校验，duration 就地丢弃，
        // 而外层 verifyDelivery 的 originalDurationSec 只读 ctx.songInfo —— 调用方没传 duration 时，
        // 整条时长校验静默失效（实测：声称 1:05:00、实际给 60 秒，直接放行且标 flac24bit）。
        // v8.16.2（R-12②）：改用 setDurationHint 旁路回填，不再写调用方对象（跨桥副作用）。
        if (parsed && parsed.duration) setDurationHint(songInfo, parsed.duration);
      }
      return match[1];
    }
  }
  throw new Error(`${ERROR_CODES.NOT_FOUND}: 溯音酷我未找到链接`);
}

const SUYIN_KUWO_API = "https://oiapi.net/api/Kuwo";

function parseMessageSongInfo(message) {
  if (!message) return null;
  const result = {};
  const lines = String(message).split("\n");
  for (const line of lines) {
    if (line.startsWith("歌名：")) result.song = line.replace("歌名：", "").trim();
    if (line.startsWith("歌手：")) result.singer = line.replace("歌手：", "").trim();
    if (line.startsWith("专辑：")) result.album = line.replace("专辑：", "").trim();
    // v1.0 P0-4 (D4)：消息路径带时长时一并解析，供时长校验使用
    // D-37：保留原始文本（可能是 mm:ss），交由 normalizeDurationSec 统一解析——旧实现这里就 Number() 掉了
    if (line.startsWith("时长：")) result.duration = line.replace("时长：", "").trim();
  }
  return result.song ? result : null;
}

function setDurationHint(songInfo, sec) {
  if (!songInfo || typeof songInfo !== "object") return;
  // 源解析出的时长可能是 "1:05:00" / "3:20" 文本（parseMessageSongInfo 原样给出），
  // 旧实现把这个字符串写回 songInfo.duration 再由 originalDurationSec 的冒号分支解析；
  // 旁路必须同口径，否则字符串一律 Number()=NaN 被丢，时长校验静默失效。
  let n = Number(sec);
  if (typeof sec === "string" && sec.includes(":")) {
    const parts = sec.split(":").map(x => parseInt(x, 10)).filter(x => Number.isFinite(x));
    if (parts.length === 2) n = parts[0] * 60 + parts[1];
    else if (parts.length === 3) n = parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (!Number.isFinite(n) || n <= 0) return;
  const v = Math.round(n);
  boundedMapSet(durationHints, songInfo, v);
  const k = durationHintKey(songInfo);
  if (k) boundedMapSet(durationHintByKey, k, v);
  const nk = durationHintNameKey(songInfo);
  if (nk) boundedMapSet(durationHintByKey, nk, v);
}

function boundedMapSet(map, key, value) {
  if (map.has(key)) map.delete(key);
  map.set(key, value);
  const max = Math.max(1, Number(cfg('memoryMapMax', MEMORY_MAP_MAX)) || MEMORY_MAP_MAX);
  if (map.size > max) {
    const oldest = map.keys().next().value;
    if (oldest !== undefined) map.delete(oldest);
  }
}

const MEMORY_MAP_MAX = 2000;              // 按歌曲累积表上限（约 500 首 × 4 档）

module.exports = {
  suyinKuwoSearch,
  SUYIN_KUWO_API,
  parseMessageSongInfo,
  setDurationHint,
  boundedMapSet,
  MEMORY_MAP_MAX,
};
