// ============================================================
// v9.0 业务层 · 28-health-export（健康状态导出（exportHealthState 与常量））
// 反向闭包裁剪簇；对遗留 legacy 符号走 dep(name) 依赖注入
// ============================================================
const HEALTH_STATE_VERSION = 2; // 单一路径：只导出/恢复 v2

const { SOURCE_VERSION } = require("./02-config.js");
const HEALTH_STATE_SOURCE_VERSION = SOURCE_VERSION;   // v9.2：不再硬编码，跟随构建期版本

const HEALTH_STATES = ["closed", "open", "half-open"];

const HEALTH_QUALITY_NUMBER_FIELDS = ["req", "success", "time", "fail", "businessFail", "definitiveFail", "linkExpired"];

const HEALTH_QUALITIES = ["128k", "320k", "flac", "flac24bit"];
const { canExecute, qualityLedger } = require("./22-chain.js");
const { PROVIDER_AUTH, PROVIDER_LIFECYCLE } = require("./11-provider-meta.js");
const { dep } = require("./06-binding.js");

function exportHealthState() {
  const sources = {};
  for (const id of Object.keys(dep('SOURCE_HANDLERS'))) {
    const b = dep('getBreaker')(id);
    const byQuality = {};
    for (const [quality, q] of Object.entries(b.byQuality || {})) {
      if (!HEALTH_QUALITIES.includes(quality)) continue;
      byQuality[quality] = {};
      for (const field of HEALTH_QUALITY_NUMBER_FIELDS) byQuality[quality][field] = Number(q[field] || 0);
      // v8.16.2（R-01）：档位熔断器必须随档位一起落盘。旧实现只写 7 个数字字段，
      // 恢复后 byQuality 条目没有 breaker，qualityLedger 会补一个默认 closed，
      // canExecute 于是直接放行——熔断在 App 每次冷启动 restore 后 100% 失效。
      const qbOld = q.breaker || {};
      byQuality[quality].breaker = {
        state: HEALTH_STATES.includes(qbOld.state) ? qbOld.state : "closed",
        failureCount: Number(qbOld.failureCount || 0),
        lastFailureTime: Number(qbOld.lastFailureTime || 0),
        trialInFlight: qbOld.trialInFlight === true
      };
    }
    sources[id] = {
      breaker: {
        state: HEALTH_STATES.includes(b.state) ? b.state : "closed",
        failureCount: Number(b.failureCount || 0),
        lastFailureTime: Number(b.lastFailureTime || 0),
        totalRequests: Number(b.totalRequests || 0),
        totalSuccess: Number(b.totalSuccess || 0),
        totalTime: Number(b.totalTime || 0),
        probeRequests: Number(b.probeRequests || 0),
        probeSuccess: Number(b.probeSuccess || 0),
        probeTime: Number(b.probeTime || 0),
        copyrightFail: Number(b.copyrightFail || 0),
        rateLimitCount: Number(b.rateLimitCount || 0),
        rateLimitUntil: Number(b.rateLimitUntil || 0),
        rateLimited: !!b.rateLimited,
        lastQuality: HEALTH_QUALITIES.includes(String(b.lastQuality || "").toLowerCase()) ? String(b.lastQuality).toLowerCase() : null
      },
      byQuality,
      playDead: {
        streak: Number(dep('playDeadStreak').get(id) || 0),
        deadline: Number(dep('playDeadDeadline').get(id) || 0),
        // v8.16.4（疑-31）：触发档随快照走——不持久化的话重启后豁免面直接回退成「源级」，
        // 表现为「重启后高档失败又把整源摘掉」。
        quality: dep('playDeadQuality').get(id) || null
      },
      // v8.16.2（R-12⑤）：取链摘除必须与播放摘除对称持久化——旧实现只导 playDead，
      // 重启后「取链摘除」立即复活，而「播放摘除」保留，两种摘除的保护强度不一致。
      resolveDead: {
        streak: Number(dep('resolveDeadStreak').get(id) || 0),
        deadline: Number(dep('resolveDeadDeadline').get(id) || 0)
      }
    };
  }
  const qualityShortCircuit = {};
  for (const [key, at] of dep('qualitySkipProbeAt')) {
    const [id, quality] = String(key).split(":");
    if (!dep('SOURCE_HANDLERS')[id] || !HEALTH_QUALITIES.includes(quality)) continue;
    const n = Number(at);
    if (Number.isFinite(n) && n > 0) qualityShortCircuit[`${id}:${quality}`] = n;
  }
  // v8.14：用户意图永久持久化；autoOff 只做短期临时态，也一并导出供启动复验。
  const controls = collectHealthControls();
  return { v: HEALTH_STATE_VERSION, sourceVersion: HEALTH_STATE_SOURCE_VERSION, savedAt: Date.now(), sources, qualityShortCircuit, controls };
}







function collectHealthControls() {
  const controls = {};
  for (const id of Object.keys(dep('SOURCE_HANDLERS'))) {
    controls[id] = {
      enabled: dep('isUserEnabled')(id),
      manualOff: !!dep('manualOff')[id],
      manualOffAt: Number(dep('manualOffAt')[id] || 0),
      autoOff: !!dep('autoOff')[id],
      autoOffAt: Number(dep('autoOffAt')[id] || 0),
      autoOffReason: dep('autoOffReason')[id] || null
    };
  }
  return controls;
}





module.exports = {
  exportHealthState,
  HEALTH_QUALITIES,
  HEALTH_QUALITY_NUMBER_FIELDS,
  HEALTH_STATES,
  collectHealthControls,
  HEALTH_STATE_VERSION,
  HEALTH_STATE_SOURCE_VERSION,
};
