// ============================================================
// v9.0 业务层 · 16-chain-misc（链路杂项（健康间隔/音质档/交付置信/模板VIP））
// 对 legacy 的引用一律走依赖注入 dep(name)，不打反向引用环
// ============================================================
const { ERROR_CODES } = require("./02-error-codes.js");
const { httpRequestWithRetry, getMobileUserAgent, TIMEOUT_CONFIG, HTTP_URL_REGEX, upgradeToHttps } = require("./07-net.js");
const { QUALITY_PRIORITY, getHashOrMid } = require("./09-match.js");
const { cfg } = require("./02-config.js");
const { dep } = require("./06-binding.js");

const HEALTH_CHECK_INTERVAL_MS = 10 * 60 * 1000; // 每10分钟一轮

function nextHealthCheckDelay(intervalMs, rand) {
  const iv = Math.max(1000, Number(intervalMs) || HEALTH_CHECK_INTERVAL_MS);
  const ratio = Math.max(0, Math.min(0.5, Number(cfg("healthCheckJitterRatio", 0.1) ?? 0.1)));
  const r = typeof rand === 'function' ? rand() : Math.random();
  return Math.max(1000, Math.round(iv * (1 - ratio + 2 * ratio * r)));
}

const QUALITY_FIRST = true; // 音质优先模式：解析从请求音质(默认flac)开始逐级降级

function buildQualityChain(requested) {
  const req = String(requested || "flac").toLowerCase();
  if (QUALITY_FIRST) {
    const chain = [req];
    const idx = QUALITY_PRIORITY.indexOf(req);
    if (idx >= 0) {
      // v8.11：末档强制 128k。旧实现用 `chain.length < 3` 截断，使 flac24bit 起只得到
      // [flac24bit, flac, 320k]，128k 永远走不到；而实测《八千里路明月照》恰恰只有 128k 档
      // 能拿到完整版（另两档同给同一个 5 秒片段）。同时 flac24bit 无任何源支持，第一档必空。
      const rest = QUALITY_PRIORITY.slice(idx + 1);
      // v8.11.2（N3 实测）：旧实现只拿 rest[0] 再补 128k，把中间档整段跳过——
      // flac24bit 起跑时链是 [flac24bit, flac, 128k]，320k 永远没被尝试过。
      // 现在按优先级逐档下降（末档天然是 128k，128k 保底仍在）。
      for (const q of rest) chain.push(q);
    } else {
      // 未知档位：只降到 128k 保底，避免无意义的多档尝试
      chain.push("128k");
    }
    return chain.filter((q, i) => chain.indexOf(q) === i);
  }
  const req2 = String(requested || "128k").toLowerCase();
  const idx2 = QUALITY_PRIORITY.indexOf(req2);
  const start = idx2 >= 0 ? idx2 : QUALITY_PRIORITY.length - 1;
  const chain = [];
  for (let i = start; i < QUALITY_PRIORITY.length; i++) {
    chain.push(QUALITY_PRIORITY[i]);
  }
  if (!chain.includes(req2)) chain.unshift(req2);
  return chain;
}

const deliveryConfidenceMap = new Map(); // 同上 key → exact/estimated/unknown（不把估算档宣称为精确档）

function getDeliveryConfidence(handlerId, platform, songInfo, quality) {
  const key = `${handlerId}|${platform}|${getHashOrMid(songInfo)}|${String(quality || "").toLowerCase()}`;
  return deliveryConfidenceMap.get(key) || "";
}

function createTemplateVipSource(templateUrl, rejectRe, sourceName) {
  return async function templateVipGetUrl(platform, songId, quality, songInfo, cancelToken = null) {
    if (platform !== "kw") throw new Error(`${ERROR_CODES.PARAM_ERROR}: ${sourceName}今日仅kw恢复(其余平台仍403/401/404)`);
    const id = getPlatformSongId(platform, songInfo);
    if (!id) throw new Error(`${ERROR_CODES.PARAM_ERROR}: ${sourceName}缺少kw rid`);
    // 仅128k测通，固定standard级别，忽略请求音质
    const target = templateUrl.replace("{id}", encodeURIComponent(String(id))).replace("{level}", encodeURIComponent("standard"));
    // v1.0：跟随302取car-er.kuwo.cn新鲜mp3直链（Range轻量校验，不下载全曲）
    const res = await httpRequestWithRetry(target, {
      method: "GET",
      headers: { "User-Agent": getMobileUserAgent(), "Range": "bytes=0-1023" },
      timeout: TIMEOUT_CONFIG.parse,
      follow_max: 5,
      cancelToken
    });
    const finalUrl = res.url || target;
    if (!HTTP_URL_REGEX.test(finalUrl) || rejectRe.test(finalUrl)) {
      throw new Error(`${ERROR_CODES.NOT_FOUND}: ${sourceName}未跟随到音频直链`);
    }
    // v1.0 P0-3 (D2)：http→https 升级
    return upgradeToHttps(finalUrl);
  };
}

function getPlatformSongId(platform, songInfo) {
  if (platform === "kg") return songInfo?.hash || songInfo?.songmid || songInfo?.id || songInfo?.rid || songInfo?.mid || null;
  if (platform === "tx") {
    const qqId = dep('getQQSongId')(songInfo);
    if (qqId?.value) return qqId.value;
  }
  return songInfo?.songmid || songInfo?.id || songInfo?.songId || songInfo?.rid || songInfo?.hash || null;
}

module.exports = {
  HEALTH_CHECK_INTERVAL_MS,
  nextHealthCheckDelay,
  QUALITY_FIRST,
  buildQualityChain,
  deliveryConfidenceMap,
  getDeliveryConfidence,
  createTemplateVipSource,
  getPlatformSongId,
};
