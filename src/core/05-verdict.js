// ============================================================
// v9.0 业务层 · 05-verdict（错误码裁决 / 码表 / 兜底策略）
// 职责：错误码→提示/缓存TTL/排序、交付性与记账裁决、跨平台兜底判据
// 依赖：02-error-codes（ERROR_CODES）
// 来源：由 legacy.js 原样迁出（v9.0 第四刀 · 引用闭包地图选批）
// 说明：applyAdmission 未随本批迁移（依赖健康账本 getBreaker/recordSuccess/recordFailure）
// ============================================================
const { ERROR_CODES } = require("./02-error-codes.js");

function normalizeErrCode(err, fallback) {
  if (!err || err.code) return err;
  const msg = String(err.message || "");
  // D-30：throw 处写的是「值」（`SONG_MISMATCH`），键名却是 `MISMATCH`（12 码里唯一键≠值）。
  // 只按键名匹配会让它回落成 NETWORK_ERROR，连带三处一起错：
  //   ① 用户/日志看到「网络错误」而真相是「搜索到的不是这首歌」；
  //   ② FAIL_CACHE_TTL_BY_CODE[MISMATCH]=1h 永不生效，同一首错歌被反复重查重外呼；
  //   ③ 熔断把业务失败当网络失败计数，用户点几首匹配不上的歌就能把健康源打进冷却。
  const hitKey = Object.keys(ERROR_CODES).find(k => msg.startsWith(k + ":") || msg.startsWith(ERROR_CODES[k] + ":"));
  // 赋「值」而不是键名：全仓比较一律是 `=== ERROR_CODES.X`（即值），
  // 而 MISMATCH 的键名 `MISMATCH` ≠ 值 `SONG_MISMATCH`，只按键名匹配会双双落空。
  err.code = hitKey ? ERROR_CODES[hitKey] : (fallback || ERROR_CODES.NETWORK_ERROR);
  return err;
}

const CODE_HINT = {
  [ERROR_CODES.PREVIEW_FRAGMENT]: "该曲目只提供试听片段（已尽量给出可用片段）",
  [ERROR_CODES.NOT_AUDIO]: "接口返回的不是有效音频内容",
  [ERROR_CODES.STREAM_PLAYLIST]: "接口返回的是流播放列表，播放器不支持",
  [ERROR_CODES.TRUNCATED_MEDIA]: "桥媒体信封分片缺失或被截断",
  [ERROR_CODES.BAD_ENVELOPE]: "桥媒体信封结构或长度不符",
  [ERROR_CODES.BUDGET_EXHAUSTED]: "本地取链预算耗尽（不是上游超时）",
  [ERROR_CODES.PLAYBACK_FAILED]: "该音源正在摘除期或半开名额已被占用（本地拦截，未请求上游）",
};

const FAIL_CACHE_TTL_BY_CODE = {
  [ERROR_CODES.NOT_FOUND]: 60 * 60 * 1000,        // 404/无版权/搜索无结果 → 1小时
  [ERROR_CODES.MISMATCH]: 60 * 60 * 1000,          // 歌信息不匹配(近1h内重查意义低) → 1小时
  [ERROR_CODES.LINK_EXPIRED]: 60 * 1000,           // 410 签名死链 → 1分钟
  [ERROR_CODES.PARAM_ERROR]: 60 * 1000,            // v8.11.2：上游返回非法URL(非http/https) → 1分钟（脏数据会很快恢复）
  // v8.11：交付真实性类——只缓存很短时间，且片段按音质档分键，避免 flac 失败连坐 128k
  [ERROR_CODES.PREVIEW_FRAGMENT]: 30 * 1000,       // 试听片段 → 30秒
  [ERROR_CODES.NOT_AUDIO]: 60 * 1000,              // 非音频内容 → 1分钟
  [ERROR_CODES.STREAM_PLAYLIST]: 60 * 1000,        // 流播放列表 → 1分钟
  [ERROR_CODES.TRUNCATED_MEDIA]: 0,               // 传输截断 → 不缓存(重传可恢复)
  [ERROR_CODES.BAD_ENVELOPE]: 0,                  // 信封结构错误 → 不缓存
  [ERROR_CODES.RATE_LIMIT]: 0,                     // 限流 → 不缓存(会恢复)
  [ERROR_CODES.NETWORK_TIMEOUT]: 0,                // 超时 → 不缓存(瞬时)
  [ERROR_CODES.BUDGET_EXHAUSTED]: 0,               // 本地预算耗尽 → 不缓存
  [ERROR_CODES.NETWORK_ERROR]: 0,                  // 网络错误 → 不缓存(瞬时)
  [ERROR_CODES.SERVER_ERROR]: 0,                   // 5xx → 不缓存(服务端会恢复)
  [ERROR_CODES.PLAYBACK_FAILED]: 0,                // v8.16.3：本地拦截，请求没发出去 → 不缓存
};

const QUALITY_BUSINESS_CODES = new Set([
  ERROR_CODES.NOT_FOUND,
  ERROR_CODES.MISMATCH,
  ERROR_CODES.PREVIEW_FRAGMENT
]);

const QUALITY_DELIVERY_CODES = new Set([
  ERROR_CODES.NOT_AUDIO,
  ERROR_CODES.STREAM_PLAYLIST,
  ERROR_CODES.BAD_ENVELOPE,
  ERROR_CODES.TRUNCATED_MEDIA
]);

const QUALITY_TRANSIENT_CODES = new Set([
  ERROR_CODES.BUDGET_EXHAUSTED,
  ERROR_CODES.LINK_EXPIRED,
  ERROR_CODES.NETWORK_TIMEOUT,
  ERROR_CODES.NETWORK_ERROR,
  ERROR_CODES.SERVER_ERROR,
  ERROR_CODES.PARAM_ERROR,
  ERROR_CODES.CONFIG_ERROR
]);

const ADMISSION_POLICY = {
  // verdict    是否可交付  歌×档 TTL   健康分类        是否计入摘除   源级冷却
  PASS:         { deliverable: true,  ttlMs: 0,       health: "success",      playDead: false, resolveDead: false, sourceCooldownMs: 0 },
  FRAGMENT:     { deliverable: true,  ttlMs: 30000,   health: "businessFail", playDead: false, resolveDead: false, sourceCooldownMs: 0 },
  NOT_AUDIO:    { deliverable: false, ttlMs: 60000,   health: "businessFail", playDead: false, resolveDead: false, sourceCooldownMs: 0 },
  RATE_LIMITED: { deliverable: false, ttlMs: 0,       health: "businessFail", playDead: false, resolveDead: false, sourceCooldownMs: 0 },
  BUSINESS:     { deliverable: false, ttlMs: 3600000, health: "businessFail", playDead: false, resolveDead: false, sourceCooldownMs: 0 },
  TRANSIENT:    { deliverable: false, ttlMs: 0,       health: "hardFail",     playDead: false, resolveDead: true,  sourceCooldownMs: 0 },
  BROKEN:       { deliverable: false, ttlMs: 60000,   health: "businessFail", playDead: false, resolveDead: false, sourceCooldownMs: 0 },
  // 本地预算耗尽：不交付，但绝不能当“网络失败”摘除源；TTL 0 由全失败短缓存收口。
  BUDGET:       { deliverable: false, ttlMs: 0,       health: "businessFail", playDead: false, resolveDead: false, sourceCooldownMs: 0 },
  // v8.16.3（R-13）：本地拦截（摘除期/半开名额占用）——不交付、不记任何账、不写失败缓存。
  PLAYBACK_DEAD:{ deliverable: false, ttlMs: 0,       health: "skip",         playDead: false, resolveDead: false, sourceCooldownMs: 0 },
};

const CODE_RANK = {
  [ERROR_CODES.NOT_AUDIO]: 3,
  [ERROR_CODES.PREVIEW_FRAGMENT]: 3,
  [ERROR_CODES.STREAM_PLAYLIST]: 3,
  [ERROR_CODES.NOT_FOUND]: 2,
  [ERROR_CODES.MISMATCH]: 2,
  [ERROR_CODES.LINK_EXPIRED]: 2,
  [ERROR_CODES.PARAM_ERROR]: 2,
  [ERROR_CODES.CONFIG_ERROR]: 2,
  [ERROR_CODES.RATE_LIMIT]: 1,
  // 本地预算耗尽是编排保护，不是“平台没这首歌”，但优先级要高于网络类，避免聚合后被 NETWORK_TIMEOUT 吞掉。
  [ERROR_CODES.BUDGET_EXHAUSTED]: 2,
  [ERROR_CODES.NETWORK_TIMEOUT]: 1,
  [ERROR_CODES.NETWORK_ERROR]: 1,
  [ERROR_CODES.SERVER_ERROR]: 1,
  // v8.16.3：本地拦截与网络类同档——它不代表「平台没这首歌」，不能被聚合抬成业务/交付类。
  [ERROR_CODES.PLAYBACK_FAILED]: 1,
};

function verdictOfCode(code) {
  switch (code) {
    case ERROR_CODES.RATE_LIMIT: return "RATE_LIMITED";
    case ERROR_CODES.NOT_FOUND:
    case ERROR_CODES.MISMATCH:
    case ERROR_CODES.LINK_EXPIRED: return "BUSINESS";
    case ERROR_CODES.NOT_AUDIO:
    case ERROR_CODES.STREAM_PLAYLIST: return "NOT_AUDIO";
    case ERROR_CODES.PREVIEW_FRAGMENT: return "FRAGMENT";
    case ERROR_CODES.PARAM_ERROR:
    case ERROR_CODES.CONFIG_ERROR: return "BROKEN";
    case ERROR_CODES.BUDGET_EXHAUSTED: return "BUDGET";
    // v8.16.3（R-13）：本地拦截必须走独立 verdict——落到 TRANSIENT 会 bumpResolveDead，
    // 等于「因为源在摘除期而惩罚源」，自伤闭环。
    case ERROR_CODES.PLAYBACK_FAILED: return "PLAYBACK_DEAD";
    default: return "TRANSIENT";
  }
}

function extractErrorCode(e) {
  if (e && e.code) return e.code;
  const m = String((e && e.message) || "").match(/^([A-Z_]+):/);
  if (!m) return ERROR_CODES.NETWORK_ERROR;
  const prefix = m[1];
  // 前缀可能写成键名（PARAM_ERROR）也可能写成值（SONG_MISMATCH）——两种都要认，
  // 且一律返回「值」，与全仓 `=== ERROR_CODES.X` 的比较口径对齐（D-30）。
  if (ERROR_CODES[prefix]) return ERROR_CODES[prefix];
  const byValue = Object.keys(ERROR_CODES).find(k => ERROR_CODES[k] === prefix);
  return byValue ? ERROR_CODES[byValue] : ERROR_CODES.NETWORK_ERROR;
}

const CROSS_NO_FALLBACK_CODES = new Set([
  ERROR_CODES.NETWORK_ERROR,
  ERROR_CODES.NETWORK_TIMEOUT,
  ERROR_CODES.BUDGET_EXHAUSTED,
  ERROR_CODES.PARAM_ERROR,
  ERROR_CODES.CONFIG_ERROR,
  ERROR_CODES.CANCELED,
]);

function crossFallbackPolicy(err) {
  if (!err) return { fallback: true, reason: "UNKNOWN" };
  const code = String(extractErrorCode(err) || "");
  if (err.canceled === true || code === ERROR_CODES.CANCELED) return { fallback: false, reason: "canceled" };
  // 1) 失败缓存命中：内容类结论意味着「上一次跨平台也没兜住」（兜住时该条会被删除），
  //    重搜只会重复外呼；但本地限流（RATE_LIMIT）不是内容结论，允许换平台兜底。
  if (err.fromFailCache === true) {
    const failCode = String(err.failCode || code);
    if (failCode === ERROR_CODES.RATE_LIMIT) return { fallback: true, reason: "fail-cache-rate-limit" };
    return { fallback: false, reason: `fail-cache:${failCode}` };
  }
  // 2) 本地保护态（熔断/摘除/冷却/并发保护/半开名额）：跨平台不得绕过（C9a/L1 实测）
  if (err.isThrottleSkip === true || err.localProtect === true) return { fallback: false, reason: "local-protect" };
  // 3) 网络类/预算类：上游整体不可用或内部性能保护，再搜只会突破预算（E4 14s→22s、I3 1.5s→6.4s）。
  //    NETWORK_ERROR 与 NETWORK_TIMEOUT 同类同待遇（旧实现一个兜一个不兜）。
  //    慢主平台仍有 grace 定时器先行兜底，超时场景不会丢救援。
  if (CROSS_NO_FALLBACK_CODES.has(code)) return { fallback: false, reason: code || "budget" };
  return { fallback: true, reason: code || "FAILED" };
}

module.exports = {
  CODE_HINT, FAIL_CACHE_TTL_BY_CODE, CODE_RANK, ADMISSION_POLICY, verdictOfCode, normalizeErrCode, extractErrorCode, crossFallbackPolicy, QUALITY_DELIVERY_CODES, QUALITY_TRANSIENT_CODES, QUALITY_BUSINESS_CODES, CROSS_NO_FALLBACK_CODES,
};
