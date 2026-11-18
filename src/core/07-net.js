// ============================================================
// v9.0 业务层 · 07-net（网络基建 / 缓存）
// 来源：由 legacy.js 整块迁出（v9.0 第六刀 · 种子闭包新增 0）
// ============================================================
const { FAIL_CACHE_TTL_BY_CODE } = require("./05-verdict.js");
const { canceledError, raceWithCancel, throwIfCanceled } = require("./04-cancel.js");
const { request, utils } = require("./00-host.js");
const { logInfo, logWarn, logDebug } = require("./01-log.js");
const { cfg } = require("./02-config.js");
const { ERROR_CODES } = require("./02-error-codes.js");

const CACHE_TTL_MS = 21600000;          // 6小时 成功缓存

const FAIL_CACHE_TTL_MS = 300000;       // 5分钟 失败缓存（v1.0 起按失败类型差异化：见 getFailCachedEntry）

const CACHE_MAX_SIZE = 500;

const FAIL_CACHE_MAX_SIZE = 300;

const HTTP_URL_REGEX = /^https?:\/\//i;

const RETRY_TIMES = 1;                  // 网络错误重试次数(v1.0:2→1，避免重试放大)

const TIMEOUT_CONFIG = { search: 3000, parse: 5000, default: 5000 }; // v1.0: parse 8000→5000

function createLRUCache(maxSize, ttl) {
  const map = new Map();
  // v8.16.2（R-12⑥）：ttl 支持函数——旧实现构造时就把 ttl 值捕获成常量，`config` 热更新
  // 调大 cacheTtlMs 在进程内永远不生效（只能靠 clear 让调小生效，调大无解）。
  const ttlNow = () => (typeof ttl === "function" ? Number(ttl()) || 0 : Number(ttl) || 0);
  return {
    get(key) {
      const entry = map.get(key);
      if (!entry) return null;
      // v8.11.2（D-32）：过期只报 null、不删除——否则下层 hasExpired() 永远查不到，
      // 「全部源失败 → 过期缓存兜底」成死代码（V22 实测）。
      if (Date.now() - entry.timestamp >= ttlNow()) { return null; }
      map.delete(key);
      map.set(key, entry);
      return entry.value;
    },
    // v8.10.1：补 delete——分级 TTL 过期时 getCachedUrl 需要主动删除条目（旧无此方法，高音质缓存超 30min 重播必 TypeError）
    delete(key) { map.delete(key); },
    set(key, value) {
      if (map.has(key)) map.delete(key);
      map.set(key, { value, timestamp: Date.now() });
      if (map.size > maxSize) {
        const firstKey = map.keys().next().value;
        if (firstKey !== undefined) map.delete(firstKey);
      }
    },
    hasExpired(key) {
      const entry = map.get(key);
      if (!entry) return false;
      return Date.now() - entry.timestamp >= ttlNow();
    },
    getExpired(key) {
      const entry = map.get(key);
      return entry ? entry.value : null;
    },
    // v30.1：清空所有缓存（配置热更新时调用，让新 TTL 立即生效）
    clear() {
      map.clear();
    },
    // 五轮 MEM：暴露条目数供健康快照观测（此前只有写入/读取，无任何容量可观测口径）
    size() { return map.size; },
    // v8.11.3（D-01）：键迭代——toggle 开启源时要按平台前缀精确失效失败缓存（全清会误伤其他平台）
    keys() { return map.keys(); }
  };
}

const successCache = createLRUCache(CACHE_MAX_SIZE, () => cfg('cacheTtlMs', CACHE_TTL_MS));

const failCache = createLRUCache(FAIL_CACHE_MAX_SIZE, Number.MAX_SAFE_INTEGER);

function httpRequest(url, options = { method: "GET" }) {
  const timeout = options.timeout || TIMEOUT_CONFIG.default;
  const cancelToken = options.cancelToken || null;
  const requestOptions = Object.assign({}, options);
  delete requestOptions.cancelToken;
  // 预取消必须在创建 Promise 之前返回，否则同步 reject 的 rawPromise 会先成为
  // unhandled rejection，再被 raceWithCancel 接管（Node 会在下一 tick 直接崩）。
  if (cancelToken && cancelToken.canceled) return Promise.reject(canceledError(cancelToken.reason));
  // 宿主 lx.request 会返回取消函数；把它接到协作式令牌，竞速落败时真正断掉上游请求，
  // 而不是只丢弃 Promise 结果。QuickJS 宿主无 AbortController，这是唯一的真取消通道。
  let hostCancel = null;
  const offCancel = cancelToken ? cancelToken.onCancel(() => {
    if (typeof hostCancel === "function") {
      try { hostCancel(); } catch (e) { /* 宿主取消失败不得反向打断编排 */ }
    }
  }) : null;
  const rawPromise = new Promise((resolve, reject) => {
    const startTime = Date.now();
    const ret = request(url, { timeout, ...requestOptions }, (err, res) => {
      const duration = Date.now() - startTime;
      if (err) {
        const code = String(err.message || "").includes("timeout") ? ERROR_CODES.NETWORK_TIMEOUT : ERROR_CODES.NETWORK_ERROR;
        const error = new Error(`${code}: ${err.message}`);
        error.code = code;
        reject(error);
        return;
      }
      let body = res?.body;
      if (typeof body === "string") {
        const trimmed = body.trim();
        if (trimmed.startsWith("{") || trimmed.startsWith("[") || trimmed.startsWith('"')) {
          try { body = JSON.parse(trimmed); } catch (e) { /* 保持原始 */ }
        }
      }
      const result = { statusCode: res?.statusCode ?? 0, headers: res?.headers || {}, body, duration, url: res?.url || url };
      if (result.statusCode >= 500) {
        const error = new Error(`${ERROR_CODES.SERVER_ERROR}: HTTP ${result.statusCode}`);
        error.code = ERROR_CODES.SERVER_ERROR;
        reject(error);
      } else if (result.statusCode === 429) {
        const error = new Error(`${ERROR_CODES.RATE_LIMIT}: 被限流`);
        error.code = ERROR_CODES.RATE_LIMIT;
        reject(error);
      } else if (result.statusCode === 410) {
        // v1.0：410 Gone = 签名/直链过期（死链），单独映射，供失败缓存差异化(1min)与诊断
        const error = new Error(`${ERROR_CODES.LINK_EXPIRED}: 链接已过期(HTTP 410)`);
        error.code = ERROR_CODES.LINK_EXPIRED;
        reject(error);
      } else if (result.statusCode === 404) {
        // v1.0：404 = 歌曲/资源不存在，单独映射，供失败缓存差异化(1h)与诊断
        const error = new Error(`${ERROR_CODES.NOT_FOUND}: 资源不存在(HTTP 404)`);
        error.code = ERROR_CODES.NOT_FOUND;
        reject(error);
      } else if (result.statusCode >= 400) {
        const error = new Error(`${ERROR_CODES.NETWORK_ERROR}: HTTP ${result.statusCode}`);
        error.code = ERROR_CODES.NETWORK_ERROR;
        reject(error);
      } else {
        resolve(result);
      }
    });
    if (typeof ret === "function") {
      hostCancel = ret;
      if (cancelToken && cancelToken.canceled) {
        try { hostCancel(); } catch (e) { /* 同上 */ }
      }
    }
  });
  const clearHostCancel = () => { if (offCancel) offCancel(); };
  return raceWithCancel(rawPromise, cancelToken).then(
    (v) => { clearHostCancel(); return v; },
    (e) => { clearHostCancel(); throw e; }
  );
}

async function httpRequestWithRetry(url, options = {}, retries = RETRY_TIMES) {
  let lastError = null;
  const cancelToken = options && options.cancelToken;
  for (let i = 0; i <= retries; i++) {
    throwIfCanceled(cancelToken);
    try {
      return await httpRequest(url, options);
    } catch (e) {
      lastError = e;
      if (e && (e.canceled || e.code === ERROR_CODES.CANCELED)) throw e;
      // 网络错误/超时/5xx临时错误重试；4xx(403/404)与429限流不重试
      if (e.code !== ERROR_CODES.NETWORK_TIMEOUT && e.code !== ERROR_CODES.NETWORK_ERROR && e.code !== ERROR_CODES.SERVER_ERROR) break;
      if (i < retries) {
        const delay = Math.pow(2, i) * 200;
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

function buildQueryString(params = {}) {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  return parts.length ? "?" + parts.join("&") : "";
}

const MOBILE_UA_POOL = [
  "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 12; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0 Mobile Safari/537.36"
];

let __uaCounter = 0;

function getMobileUserAgent() {
  return MOBILE_UA_POOL[(__uaCounter++ + Math.floor(Date.now() / 60000)) % MOBILE_UA_POOL.length];
}

function upgradeToHttps(url) {
  if (!url || typeof url !== "string") return url;
  return url.replace(/^http:\/\//i, "https://");
}

function buildCacheKey(prefix, songInfo, quality = "") {
  const id = songInfo?.id || songInfo?.songmid || songInfo?.hash || songInfo?.rid || "";
  const name = songInfo?.name || "";
  const singer = songInfo?.singer || "";
  const album = songInfo?.albumName || songInfo?.album || "";
  return `${prefix}_${id}_${name}_${singer}_${album}_${quality}`;
}

function getCachedUrl(cacheKey) {
  const entry = successCache.get(cacheKey);
  if (!entry) return null;
  // v8.10：按音质判断是否过期（LRU 总 TTL 仍由 cacheTtlMs 兜底，但高音质提前判 miss）
  const q = String(entry.quality || "128k").toLowerCase();
  const isHighQuality = q === "flac" || q === "320k" || q === "flac24bit" || q === "hires";
  const ttl = isHighQuality ? cfg('cacheTtlHighQualityMs', 1800000) : cfg('cacheTtlMs', 21600000);
  if (entry.ts && (Date.now() - entry.ts) > ttl) {
    // v8.11.2（D-32）：不删除，仅视为 miss（删除会让过期兜底查不到）
    return null;
  }
  return entry;
}

function setCachedUrl(cacheKey, url, quality, source, platform) {
  successCache.set(cacheKey, { url, quality: quality || "128k", source, platform: platform || "", ts: Date.now() }); // v8.10：存 ts 用于分级 TTL 判断；v8.12：存实际平台
}

function setFailCached(failKey, code, ttl) { failCache.set(failKey, { code: code || ERROR_CODES.NETWORK_ERROR, ts: Date.now(), ttl }); } // v6.0(A3)：支持自定义 TTL（网络类全链失败 30s 短缓存）

function getFailCachedEntry(failKey) {
  const entry = failCache.get(failKey);
  if (!entry) return null;
  // v5.0：差异化 TTL 可配置（404→1h / 410→1min / 网络错误不缓存）
  const ttl = entry.ttl !== undefined ? entry.ttl   // v6.0(A3)：自定义短缓存 TTL 优先
    : entry.code === ERROR_CODES.NOT_FOUND
      ? cfg('failCacheNotFoundMs', 3600000)
      : entry.code === ERROR_CODES.LINK_EXPIRED
        ? cfg('failCacheExpiredMs', 60000)
        : FAIL_CACHE_TTL_BY_CODE[entry.code];
  // v8.11.2（N4 实测）：CONFIG_ERROR 等未登记 TTL 的码原来直接 return entry——注释写 5min，
  // 实际永不超时（ikun 403 / huibq 未配置 / lingchuan 未配置三处都抛此码，配好也救不回来）。
  const effTtl = ttl === undefined ? FAIL_CACHE_TTL_MS : ttl;
  if (effTtl === undefined) return entry;
  if (effTtl === 0) return null;        // 网络错误/限流 → 不缓存
  return (Date.now() - entry.ts) < effTtl ? entry : null;
}

module.exports = {
  httpRequest,
  httpRequestWithRetry,
  TIMEOUT_CONFIG,
  RETRY_TIMES,
  getMobileUserAgent,
  MOBILE_UA_POOL,
  __uaCounter,
  upgradeToHttps,
  HTTP_URL_REGEX,
  buildQueryString,
  successCache,
  getCachedUrl,
  setCachedUrl,
  getFailCachedEntry,
  setFailCached,
  buildCacheKey,
  CACHE_MAX_SIZE,
  CACHE_TTL_MS,
  createLRUCache,
  failCache,
  FAIL_CACHE_MAX_SIZE,
  FAIL_CACHE_TTL_MS,
};
