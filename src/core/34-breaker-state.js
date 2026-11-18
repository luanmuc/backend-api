// ============================================================
// v9.0 业务层 · 34-breaker-state（熔断计数 / 播放摘除 / 解析摘除 / 音质短路）
// 注意：本模块被 health 与链调度在运行期高频读写，状态对象必须保持同一引用
// ============================================================
const { dep } = require("./06-binding.js");
const { SOURCE_HANDLERS } = require("./25-handlers.js");

const breakerMap = new Map();

const playDeadStreak = new Map();

const playDeadQuality = new Map();

const playDeadDeadline = new Map(); // 摘除计时起点（半开试探冷却）

const resolveDeadStreak = new Map();

const resolveDeadDeadline = new Map();

const qualitySkipProbeAt = new Map();

const qualityShortCircuitKey = (id, quality) => `${id}:${String(quality || "").toLowerCase()}`;

function getBreaker(sourceId) {
  if (!breakerMap.has(sourceId)) {
    breakerMap.set(sourceId, { state: 'closed', failureCount: 0, lastFailureTime: 0, totalRequests: 0, totalSuccess: 0, totalTime: 0,
      // v3.0：探测样本单独计数（与真实请求分级加权，避免探测污染真实成功率）
      probeRequests: 0, probeSuccess: 0, probeTime: 0,
      // v4.0：失败归因分离——版权/业务失败（无版权404、歌不存在、错歌）单独计数，
      // 不惩罚健康分、不计入成功率分母（避免热门版权歌冤枉健康源）
      copyrightFail: 0,
      // v4.0：按音质分档统计 { quality: {req, success, time, fail, businessFail} }
      byQuality: {},
      // v4.0：限流退避——429 不触发熔断，短退避后恢复；连续限流标记"被限"
      rateLimitCount: 0, rateLimitUntil: 0, rateLimited: false,
      // v6.0：最近一次成功交付音质（音质协商链降档后可诊断"UI显示FLAC实际128k"问题）
      lastQuality: null });
  }
  return breakerMap.get(sourceId);
}

function forceQualityProbe(sourceId, quality) {
  if (!SOURCE_HANDLERS[sourceId]) return false;
  const q = String(quality || "flac").toLowerCase();
  qualitySkipProbeAt.set(qualityShortCircuitKey(sourceId, q), Date.now());
  return true;
}

module.exports = {
  breakerMap,
  playDeadStreak,
  playDeadQuality,
  playDeadDeadline,
  resolveDeadStreak,
  resolveDeadDeadline,
  qualitySkipProbeAt,
  qualityShortCircuitKey,
  getBreaker,
  forceQualityProbe,
};
