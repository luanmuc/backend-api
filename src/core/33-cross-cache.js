// ============================================================
// v9.0 业务层 · 33-cross-cache（跨平台兜底缓存：容量/过期/键构造/读写）
// ============================================================

const { buildCacheKey } = require("./07-net.js");

const CROSS_FALLBACK_CACHE_MAX = 200;

const CROSS_FALLBACK_CACHE_TTL_MS = 10 * 60 * 1000;

const crossFallbackCache = new Map();

function crossCacheKey(platform, songInfo, quality) {
  return buildCacheKey(`cross_${platform}`, songInfo, quality);
}

function getCrossFallbackCached(platform, songInfo, quality) {
  const key = crossCacheKey(platform, songInfo, quality);
  const e = crossFallbackCache.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > CROSS_FALLBACK_CACHE_TTL_MS) { crossFallbackCache.delete(key); return null; }
  return e;
}

function setCrossFallbackCached(platform, songInfo, quality, result) {
  if (crossFallbackCache.size > CROSS_FALLBACK_CACHE_MAX) crossFallbackCache.clear();
  crossFallbackCache.set(crossCacheKey(platform, songInfo, quality), {
    ts: Date.now(),
    result,
  });
}

module.exports = {
  CROSS_FALLBACK_CACHE_MAX,
  CROSS_FALLBACK_CACHE_TTL_MS,
  crossFallbackCache,
  crossCacheKey,
  getCrossFallbackCached,
  setCrossFallbackCached,
};
