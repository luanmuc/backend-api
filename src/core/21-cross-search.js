// ============================================================
// v9.0 业务层 · 21-cross-search（跨平台搜索候选（搜索、候选归一、跨平台择优））
// 反向闭包裁剪簇；对遗留 legacy 符号走 dep(name) 依赖注入
// ============================================================
const { QQ_SEARCH_API, WY_SEARCH_API } = require("./10-vendors.js");
const { identityNormalize, normalizeDurationSec } = require("./09-match.js");
const { httpRequestWithRetry, getMobileUserAgent } = require("./07-net.js");
const { cfg } = require("./02-config.js");
const { dep } = require("./06-binding.js");

async function resolveCrossPlatformCandidate(platform, songInfo) {
  const list = await crossSearchPlatform(platform, songInfo);
  return pickCrossCandidate(list, songInfo);
}

async function crossSearchPlatform(platform, songInfo) {
  const query = buildCrossSearchQuery(songInfo);
  if (!query) return [];
  const timeout = cfg("crossPlatformSearchTimeoutMs", 3000);
  if (platform === "tx") {
    const url = `${QQ_SEARCH_API}?w=${encodeURIComponent(query)}&format=json&n=10&p=1`;
    const res = await httpRequestWithRetry(url, {
      method: "GET",
      headers: { "Referer": "https://y.qq.com/", "User-Agent": getMobileUserAgent() },
      timeout,
    });
    const body = parseJsonBody(res.body);
    const list = body?.data?.song?.list || [];
    return list.map(normalizeQQCandidate).filter(Boolean);
  }
  if (platform === "wy") {
    const url = `${WY_SEARCH_API}?s=${encodeURIComponent(query)}&type=1&limit=10&offset=0`;
    const res = await httpRequestWithRetry(url, {
      method: "GET",
      headers: { "Referer": "https://music.163.com/", "User-Agent": getMobileUserAgent() },
      timeout,
    });
    const body = parseJsonBody(res.body);
    const list = body?.result?.songs || body?.songs || [];
    return list.map(normalizeWYCandidate).filter(Boolean);
  }
  if (platform === "kw") {
    const list = await dep('kuwoOfficialSearch')(query, 10);
    return list.map(normalizeKWCandidate).filter(Boolean);
  }
  // v8.13 平台化：mg/kg 没有独立搜索端点，不再作为跨平台目标。
  // 它们的直连入口仍保留（仅 suyinKuwo 兜底），但交付标签回填实际平台 kw。
  return [];
}

function pickCrossCandidate(list, target) {
  if (!Array.isArray(list) || !list.length) return null;
  let best = null;
  let bestScore = -1;
  for (const cand of list) {
    const s = scoreCrossCandidate(cand, target);
    if (s > bestScore) { best = cand; bestScore = s; }
  }
  return bestScore >= 0 ? best : null;
}

function buildCrossSearchQuery(songInfo) {
  const rawName = String(songInfo?.name || "").replace(/\([^)]*\)/g, " ").replace(/（[^）]*）/g, " ").trim() || String(songInfo?.name || "");
  const rawSinger = String(songInfo?.singer || "").replace(/\([^)]*\)/g, " ").replace(/（[^）]*）/g, " ").trim();
  const firstSinger = rawSinger.split(/\s*[\/、,&;|]\s*/)[0] || rawSinger;
  return `${rawName} ${firstSinger}`.trim();
}

function parseJsonBody(body) {
  if (body && typeof body === "object") return body;
  if (typeof body !== "string") return {};
  try { return JSON.parse(body); } catch (e) { return {}; }
}

function normalizeQQCandidate(item) {
  if (!item) return null;
  const singer = Array.isArray(item.singer) ? item.singer.map(x => x?.name || "").filter(Boolean).join(" & ") : (item.singer || "");
  const mid = item.songmid || item.mid || "";
  if (!mid) return null;
  return {
    platform: "tx",
    id: mid,
    songmid: mid,
    name: item.songname || item.name || "",
    singer,
    album: item.albumname || item.album?.name || "",
    duration: normalizeDurationSec(item.interval || item.duration),
  };
}

function normalizeWYCandidate(item) {
  if (!item) return null;
  const id = item.id || item.songId || "";
  if (!id) return null;
  const singer = Array.isArray(item.artists) ? item.artists.map(x => x?.name || "").filter(Boolean).join(" & ") : (item.singer || item.artist || "");
  const album = item.album?.name || item.albumName || item.album || "";
  return {
    platform: "wy",
    id,
    songmid: id,
    name: item.name || item.songName || "",
    singer,
    album,
    duration: normalizeDurationSec(item.duration),
  };
}

function normalizeKWCandidate(item) {
  if (!item || !item.rid) return null;
  return {
    platform: "kw",
    id: item.rid,
    rid: item.rid,
    name: item.name || "",
    singer: item.singer || "",
    album: item.album || "",
    duration: normalizeDurationSec(item.duration),
  };
}

function scoreCrossCandidate(cand, target) {
  const tn = identityNormalize(target?.name);
  const cn = identityNormalize(cand?.name);
  if (!tn || !cn) return -1;
  let score = 0;
  if (tn === cn) score += 6;
  else if (strictTitleMatch(target?.name, cand?.name)) score += 4;
  else return -1;
  const ta = identityNormalize(target?.singer);
  const ca = identityNormalize(cand?.singer);
  if (ta && !ca) return -1;
  if (ta && ca) score += (ta === ca ? 4 : 2);
  const td = normalizeDurationSec(target?.duration);
  const cd = normalizeDurationSec(cand?.duration);
  if (td && cd) {
    const diff = Math.abs(td - cd);
    if (diff > 5) return -1;
    score += diff === 0 ? 3 : (diff <= 2 ? 2 : 1);
  }
  if (!crossVariantCompatible(target?.name, cand?.name)) return -1;
  const talb = identityNormalize(target?.albumName || target?.album);
  const calb = identityNormalize(cand?.album);
  if (talb && calb && talb === calb) score += 1;
  return score;
}

function strictTitleMatch(target, candidate) {
  const t = identityNormalize(target);
  const c = identityNormalize(candidate);
  if (!t || !c) return false;
  if (t === c) return true;
  return (t.includes(c) || c.includes(t)) && Math.min(t.length, c.length) >= 4;
}

function crossVariantCompatible(targetName, candidateName) {
  const targetWords = crossVariantWords(targetName);
  return crossVariantWords(candidateName).every(w => targetWords.indexOf(w) >= 0);
}

function crossVariantWords(name) {
  const m = String(name || "").match(new RegExp(CROSS_VARIANT_RE.source, "gi"));
  return m ? m.map(x => x.toLowerCase()) : [];
}

const CROSS_VARIANT_RE = /(remix|dj|伴奏|翻唱|cover|live|现场|instrumental|纯音乐|节奏|加速|慢速|片段|试听|demo|preview|teaser|版)/i;

module.exports = {
  resolveCrossPlatformCandidate,
  crossSearchPlatform,
  pickCrossCandidate,
  buildCrossSearchQuery,
  parseJsonBody,
  normalizeQQCandidate,
  normalizeWYCandidate,
  normalizeKWCandidate,
  scoreCrossCandidate,
  strictTitleMatch,
  crossVariantCompatible,
  crossVariantWords,
  CROSS_VARIANT_RE,
};
