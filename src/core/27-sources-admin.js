// ============================================================
// v9.0 业务层 · 27-sources-admin（源开关与账本清理（toggleSource / clear 系列））
// 反向闭包裁剪簇；对遗留 legacy 符号走 dep(name) 依赖注入
// ============================================================
const { PROBE_PASS_REQUIRED } = require("./17-health-check.js");
const { ERROR_CODES } = require("./02-error-codes.js");
const { logInfo } = require("./01-log.js");
const { recordHealthEvent } = require("./03-events.js");
const { failCache } = require("./07-net.js");
const { dep } = require("./06-binding.js");

function toggleSource(target, enabled) {
  if (!target || !dep('SOURCE_HANDLERS')[target]) throw new Error(`${ERROR_CODES.PARAM_ERROR}: unknown source id`);
  const next = enabled !== false;
  dep('userEnabled')[target] = next;
  if (next) {
    delete dep('manualOff')[target];
    delete dep('manualOffAt')[target];
    delete dep('autoOff')[target];
    delete dep('autoOffReason')[target];
    delete dep('autoOffAt')[target];
  } else {
    dep('manualOff')[target] = true;
    dep('manualOffAt')[target] = Date.now();
  }
  clearSourceLedger(target, { scope: 'authority' });
  clearCrossFallbackCache();
  logInfo(`[源开关] ${target} ${next ? "开启" : "关闭"}，已清用户账（失败缓存/摘除/熔断限流/探测态），保留质量历史`);
  recordHealthEvent({ event: "config_change", sourceId: target, reason: next ? "toggle_on" : "toggle_off" });
  return { id: target, enabled: next, userEnabled: next, autoOff: false };
}

function clearSourceLedger(source, opts = {}) {
  const scope = opts.scope || 'all';
  const handler = dep('SOURCE_HANDLERS')[source];
  if (!handler) return false;
  const prefixes = (handler.platforms || []).map(p => `fail_${p}`);
  for (const k of Array.from(failCache.keys())) {
    if (!prefixes.length || prefixes.some(pre => k.includes(pre))) failCache.delete(k);
  }
  dep('playDeadStreak').delete(source);
  dep('playDeadDeadline').delete(source);
  dep('playDeadQuality').delete(source);
  clearResolveDead(source);
  clearPlayDeadTrials(source);
  delete probeState.sleeping[source];
  delete probeState.deadCount[source];
  delete probeState.sleepRound[source];
  delete probeState.sleepAt[source];
  probeState.failCount[source] = 0;
  const br = dep('getBreaker')(source);
  br.state = "closed"; br.failureCount = 0; br.lastFailureTime = 0;
  br.rateLimitUntil = 0; br.rateLimited = false;
  if (br.byQuality) for (const q of Object.keys(br.byQuality)) {
    const s = br.byQuality[q];
    if (!s || typeof s !== "object") continue;
    if (s.breaker && typeof s.breaker === "object") {
      s.breaker.state = "closed"; s.breaker.failureCount = 0; s.breaker.lastFailureTime = 0; s.breaker.trialInFlight = false;
    }
    s.rateLimitCount = 0; s.rateLimitUntil = 0; s.rateLimited = false;
    if (scope !== 'authority') { s.fail = 0; s.success = 0; s.linkExpired = 0; s.definitiveFail = 0; s.businessFail = 0; s.req = 0; s.time = 0; }
  }
  return true;
}

function clearCrossFallbackCache() {
  dep('crossFallbackCache').clear();
}

function clearResolveDead(sourceId) {
  dep('resolveDeadStreak').delete(sourceId);
  dep('resolveDeadDeadline').delete(sourceId);
  clearResolveDeadTrials(sourceId);
}

function clearPlayDeadTrials(sourceId) {
  clearTrialKeys(playDeadTrialAt, sourceId);
}

const probeState = {
  passCount: {},
  // v6.0：连续通过轮数（不清零的长期连胜，用于探测降频；passCount 到 PROBE_PASS_REQUIRED 会清零，无法承载降频判断）
  passStreak: {},
  failCount: {},
  // v3.0：失效休眠状态——deadCount 连续失败累计；sleeping=true 进入休眠；sleepRound 记录休眠起点轮
  deadCount: {},
  sleeping: {},
  sleepRound: {},
  sleepAt: {}, // v8.14：进入休眠时间，供快照 offAt；醒来/清账时删除
  // v8.14：最近一次逐质量档探测结果，供健康页 matrix / 诊断使用（只存枚举和延迟，不存 URL）
  lastTargets: {},
  // F35：每源最近一次探测开始时间；调度器另存全局下次探测时间
  lastProbeAt: {},
  running: false
};

function clearResolveDeadTrials(sourceId) {
  clearTrialKeys(resolveDeadTrialAt, sourceId);
}

function clearTrialKeys(map, sourceId) {
  map.delete(sourceId);
  for (const k of map.keys()) if (String(k).startsWith(sourceId + "|")) map.delete(k);
}

const playDeadTrialAt = new Map(); // 半开试探：sourceId → 已放行试探的时间（半开只放一个请求/源）

const resolveDeadTrialAt = new Map();

module.exports = {
  toggleSource,
  clearSourceLedger,
  clearCrossFallbackCache,
  clearResolveDead,
  clearPlayDeadTrials,
  probeState,
  clearResolveDeadTrials,
  clearTrialKeys,
  playDeadTrialAt,
  resolveDeadTrialAt,
};
