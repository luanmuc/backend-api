// ============================================================
// v9.0 业务层 · 18-health-persist（健康状态持久化（校验/序列化/版本/上限））
// 反向闭包裁剪出的自足簇；对遗留 legacy 符号走 dep(name) 依赖注入
// ============================================================
const { version } = require("./00-host.js");
const { dep } = require("./06-binding.js");

function restoreHealthState(state) {
  try {
    if (!isHealthPlainObject(state)) return { ok: false, reason: "state 必须是对象" };
    if (!HEALTH_STATE_ACCEPTED_VERSIONS.includes(state.v)) return { ok: false, reason: "schema version 不符" };
    if (!healthNumber(state.savedAt, true)) return { ok: false, reason: "savedAt 非法" };
    const controlsRaw = state.controls === undefined ? {} : state.controls;
    if (!isHealthPlainObject(controlsRaw)) return { ok: false, reason: "controls 非法" };
    const controlsOnly = (!isHealthPlainObject(state.sources) || Object.keys(state.sources).length === 0) && Object.keys(controlsRaw).length > 0;
    const age = Date.now() - state.savedAt;
    if (age < -HEALTH_STATE_FUTURE_TOLERANCE_MS) return { ok: false, reason: "savedAt 在未来" };
    // L0 控制态是永久用户意图，只受未来时间容差约束；完整健康态仍按 7 天 TTL。
    if (!controlsOnly && age > HEALTH_STATE_TTL_MS) return { ok: false, reason: "savedAt 超出 TTL" };
    if (JSON.stringify(state).length > HEALTH_STATE_MAX_BYTES) return { ok: false, reason: "state 超过 256KB" };
    const forbidden = checkHealthForbiddenKeys(state, "state");
    if (forbidden) return { ok: false, reason: `禁止字段 ${forbidden}` };
    if (!controlsOnly && !isAcceptedSourceVersion(state.sourceVersion)) return { ok: false, reason: "sourceVersion 不符" };
    if (!isHealthPlainObject(state.sources)) {
      if (!controlsOnly) return { ok: false, reason: "sources 必须是对象" };
    }
    const ids = isHealthPlainObject(state.sources) ? Object.keys(state.sources) : [];
    if (!controlsOnly && !ids.length) return { ok: false, reason: "sources 为空" };
    const sanitized = {};
    for (const id of ids) {
      if (!dep('SOURCE_HANDLERS')[id]) return { ok: false, reason: `未知源 ${id}` };
      const item = state.sources[id];
      if (!isHealthPlainObject(item) || !isHealthPlainObject(item.breaker)) return { ok: false, reason: `${id}.breaker 非法` };
      const b = item.breaker;
      if (!dep('HEALTH_STATES').includes(b.state)) return { ok: false, reason: `${id}.state 非法` };
      for (const field of HEALTH_BREAKER_NUMBER_FIELDS) {
        if (!healthNumber(b[field], true)) return { ok: false, reason: `${id}.${field} 非法` };
      }
      for (const field of HEALTH_BREAKER_BOOL_FIELDS) {
        if (typeof b[field] !== "boolean") return { ok: false, reason: `${id}.${field} 非法` };
      }
      if (b.lastQuality !== null && !dep('HEALTH_QUALITIES').includes(String(b.lastQuality).toLowerCase())) {
        return { ok: false, reason: `${id}.lastQuality 非法` };
      }
      if (!isHealthPlainObject(item.byQuality)) return { ok: false, reason: `${id}.byQuality 非法` };
      const byQuality = {};
      for (const [quality, q] of Object.entries(item.byQuality)) {
        if (!dep('HEALTH_QUALITIES').includes(quality)) return { ok: false, reason: `${id}.byQuality.${quality} 非法` };
        if (!isHealthPlainObject(q)) return { ok: false, reason: `${id}.byQuality.${quality} 非法` };
        byQuality[quality] = {};
        for (const field of dep('HEALTH_QUALITY_NUMBER_FIELDS')) {
          // 旧 v2 快照没有 definitiveFail：沿用旧 fail 口径，避免恢复后突然不再短路。
          const raw = q[field] === undefined ? (field === "definitiveFail" ? (q.fail || 0) : 0) : q[field];
          if (!healthNumber(raw, true)) return { ok: false, reason: `${id}.${quality}.${field} 非法` };
          byQuality[quality][field] = raw;
        }
        // v8.16.2（R-01）：恢复档位熔断器；旧快照没有该字段时按 closed 补齐（向后兼容）。
        const qbRaw = q.breaker === undefined ? null : q.breaker;
        if (qbRaw !== null) {
          if (!isHealthPlainObject(qbRaw)) return { ok: false, reason: `${id}.${quality}.breaker 非法` };
          if (!dep('HEALTH_STATES').includes(qbRaw.state)) return { ok: false, reason: `${id}.${quality}.breaker.state 非法` };
          for (const field of ["failureCount", "lastFailureTime"]) {
            if (!healthNumber(qbRaw[field], true)) return { ok: false, reason: `${id}.${quality}.breaker.${field} 非法` };
          }
          if (qbRaw.trialInFlight !== undefined && typeof qbRaw.trialInFlight !== "boolean") {
            return { ok: false, reason: `${id}.${quality}.breaker.trialInFlight 非法` };
          }
        }
        // 半开在飞态不能跨进程复活：新进程没有那个请求，恢复成 half-open 只会让该档永久拒绝，
        // 因此统一收敛为 open（重新走冷却→半开），保留熔断事实但不带 in-flight 幽灵。
        byQuality[quality].breaker = qbRaw === null
          ? { state: "closed", failureCount: 0, lastFailureTime: 0, trialInFlight: false }
          : {
            state: qbRaw.state === "half-open" ? "open" : qbRaw.state,
            failureCount: Number(qbRaw.failureCount || 0),
            lastFailureTime: Number(qbRaw.lastFailureTime || 0),
            trialInFlight: false
          };
      }
      const pd = item.playDead || {};
      if (!isHealthPlainObject(pd)) return { ok: false, reason: `${id}.playDead 非法` };
      if (!healthNumber(pd.streak || 0, true) || !healthNumber(pd.deadline || 0, true)) return { ok: false, reason: `${id}.playDead 非法` };
      // R77（R76-P1-01）：v8.16.4 疑-31 修复只做了一半——导出侧带 playDead.quality，
      // sanitized 却不携带，恢复时读恒 undefined → 跨档豁免重启后退化源级。
      // 这里把 quality 带进 sanitized（白名单：档位枚举或 "*" 多档归因），恢复侧才能原样回填。
      const pdQuality = (pd.quality === undefined || pd.quality === null || pd.quality === '') ? null : String(pd.quality).toLowerCase();
      if (pdQuality !== null && pdQuality !== "*" && !dep('HEALTH_QUALITIES').includes(pdQuality)) {
        return { ok: false, reason: `${id}.playDead.quality 非法` };
      }
      // v8.16.2（R-12⑤）：resolveDead 与 playDead 同校验；旧快照没有该字段时按 0 兼容。
      const rd = item.resolveDead || { streak: 0, deadline: 0 };
      if (!isHealthPlainObject(rd)) return { ok: false, reason: `${id}.resolveDead 非法` };
      if (!healthNumber(rd.streak || 0, true) || !healthNumber(rd.deadline || 0, true)) return { ok: false, reason: `${id}.resolveDead 非法` };
      sanitized[id] = {
        breaker: {
          state: b.state,
          failureCount: b.failureCount,
          lastFailureTime: b.lastFailureTime,
          totalRequests: b.totalRequests,
          totalSuccess: b.totalSuccess,
          totalTime: b.totalTime,
          probeRequests: b.probeRequests,
          probeSuccess: b.probeSuccess,
          probeTime: b.probeTime,
          copyrightFail: b.copyrightFail,
          rateLimitCount: b.rateLimitCount,
          rateLimitUntil: b.rateLimitUntil,
          rateLimited: b.rateLimited,
          lastQuality: b.lastQuality === null ? null : String(b.lastQuality).toLowerCase()
        },
        byQuality,
        playDead: { streak: Number(pd.streak || 0), deadline: Number(pd.deadline || 0), quality: pdQuality },
        resolveDead: { streak: Number(rd.streak || 0), deadline: Number(rd.deadline || 0) }
      };
    }
    const qsc = state.qualityShortCircuit === undefined ? {} : state.qualityShortCircuit;
    if (!isHealthPlainObject(qsc)) return { ok: false, reason: "qualityShortCircuit 非法" };
    const qualityShortCircuit = {};
    for (const [key, at] of Object.entries(qsc)) {
      const [id, quality] = String(key).split(":");
      if (!dep('SOURCE_HANDLERS')[id] || !dep('HEALTH_QUALITIES').includes(quality)) return { ok: false, reason: `qualityShortCircuit.${key} 非法` };
      if (!healthNumber(at, false)) return { ok: false, reason: `qualityShortCircuit.${key} 非法` };
      qualityShortCircuit[`${id}:${quality}`] = at;
    }

    // v8.14：恢复用户意图（永久）与 autoOff（短期临时态）。旧状态没有 controls 时保持默认。
    // 源集合会随版本变化：未知 control ID 跳过，不能让一个已删除的源 ID 拒绝整包开关。
    const controls = {};
    for (const [id, c] of Object.entries(controlsRaw)) {
      if (!dep('SOURCE_HANDLERS')[id]) continue;
      if (!isHealthPlainObject(c)) return { ok: false, reason: `controls.${id} 非法` };
      if (typeof c.enabled !== "boolean") return { ok: false, reason: `controls.${id}.enabled 非法` };
      if (c.manualOff !== undefined && typeof c.manualOff !== "boolean") return { ok: false, reason: `controls.${id}.manualOff 非法` };
      if (c.manualOffAt !== undefined && !healthNumber(c.manualOffAt, true)) return { ok: false, reason: `controls.${id}.manualOffAt 非法` };
      if (c.autoOff !== undefined && typeof c.autoOff !== "boolean") return { ok: false, reason: `controls.${id}.autoOff 非法` };
      if (c.autoOffAt !== undefined && !healthNumber(c.autoOffAt, true)) return { ok: false, reason: `controls.${id}.autoOffAt 非法` };
      controls[id] = {
        enabled: c.enabled,
        manualOff: !!c.manualOff,
        manualOffAt: Number(c.manualOffAt || 0),
        autoOff: !!c.autoOff,
        autoOffAt: Number(c.autoOffAt || 0),
        autoOffReason: typeof c.autoOffReason === "string" ? c.autoOffReason.slice(0, 40) : null
      };
    }

    let restored = 0;
    for (const [id, item] of Object.entries(sanitized)) {
      const b = dep('getBreaker')(id);
      Object.assign(b, item.breaker);
      b.byQuality = item.byQuality;
      if (item.playDead.streak > 0) dep('playDeadStreak').set(id, item.playDead.streak);
      else dep('playDeadStreak').delete(id);
      if (item.playDead.deadline > 0) dep('playDeadDeadline').set(id, item.playDead.deadline);
      else dep('playDeadDeadline').delete(id);
      const dq = String(item.playDead.quality || "").toLowerCase();
      if (dq) dep('playDeadQuality').set(id, dq);
      else dep('playDeadQuality').delete(id);
      // v8.16.2（R-12⑤）：取链摘除同步恢复
      if (item.resolveDead.streak > 0) dep('resolveDeadStreak').set(id, item.resolveDead.streak);
      else dep('resolveDeadStreak').delete(id);
      if (item.resolveDead.deadline > 0) dep('resolveDeadDeadline').set(id, item.resolveDead.deadline);
      else dep('resolveDeadDeadline').delete(id);
      restored++;
    }
    applyHealthControls(controls);
    // controls-only 只恢复用户意图，绝不能触碰任何健康元数据。
    // 启动时 App 会先恢复 control、再恢复完整健康态；若这里先清空质量短路表，
    // 单独恢复控制态或健康态尚未回写的窗口内，会误清正在生效的探路短路。
    if (controlsOnly) return { ok: true, restored: 0, controlsRestored: Object.keys(controls).length };
    dep('qualitySkipProbeAt').clear();
    for (const [key, at] of Object.entries(qualityShortCircuit)) dep('qualitySkipProbeAt').set(key, at);
    return { ok: true, restored, controlsRestored: Object.keys(controls).length };
  } catch (e) {
    return { ok: false, reason: e && e.message ? e.message : String(e) };
  }
}

function isHealthPlainObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

const HEALTH_STATE_ACCEPTED_VERSIONS = [2];

function healthNumber(value, allowZero) {
  return typeof value === "number" && Number.isFinite(value) && (allowZero ? value >= 0 : value > 0);
}

const HEALTH_STATE_FUTURE_TOLERANCE_MS = 3600 * 1000;

const HEALTH_STATE_TTL_MS = 7 * 24 * 3600 * 1000;

const HEALTH_STATE_MAX_BYTES = 256 * 1024;

function checkHealthForbiddenKeys(value, path) {
  if (!isHealthPlainObject(value)) return null;
  for (const key of Object.keys(value)) {
    if (HEALTH_FORBIDDEN_KEYS.test(key)) return `${path}.${key}`;
    const nested = checkHealthForbiddenKeys(value[key], `${path}.${key}`);
    if (nested) return nested;
  }
  return null;
}

// v9.2 版本区间语义：stateVersion <= 当前版本（旧账本一律可恢复，未来版本拒绝）。不再维护白名单数组——升版无需手改。
function isAcceptedSourceVersion(stateVersion) {
  if (typeof stateVersion !== "string" || !stateVersion) return false;
  const a = parseHealthSourceVersion(stateVersion);
  const max = parseHealthSourceVersion(dep('HEALTH_STATE_SOURCE_VERSION'));
  if (!a || !max) return false;
  for (let i = 0; i < 3; i++) {
    if (a[i] !== max[i]) return a[i] < max[i];   // 只拒「比当前新」的未来账本；旧账本一律可恢复（A4 契约）
  }
  return true;
}

const HEALTH_BREAKER_NUMBER_FIELDS = ["failureCount", "lastFailureTime", "totalRequests", "totalSuccess", "totalTime",
  "probeRequests", "probeSuccess", "probeTime", "copyrightFail", "rateLimitCount", "rateLimitUntil"];

const HEALTH_BREAKER_BOOL_FIELDS = ["rateLimited"];

function applyHealthControls(controls) {
  for (const [id, c] of Object.entries(controls)) {
    dep('userEnabled')[id] = c.enabled;
    if (c.manualOff) {
      dep('manualOff')[id] = true;
      dep('manualOffAt')[id] = Number(c.manualOffAt || 0) || Date.now();
    } else {
      delete dep('manualOff')[id];
      delete dep('manualOffAt')[id];
    }
    const autoAge = Date.now() - (c.autoOffAt || 0);
    if (c.autoOff && (!c.autoOffAt || autoAge <= 6 * 60 * 60 * 1000)) {
      dep('autoOff')[id] = true;
      dep('autoOffAt')[id] = c.autoOffAt || Date.now();
      dep('autoOffReason')[id] = c.autoOffReason || "AUTO_OFF_PROBE";
    } else {
      delete dep('autoOff')[id];
      delete dep('autoOffAt')[id];
      delete dep('autoOffReason')[id];
    }
  }
}

const HEALTH_FORBIDDEN_KEYS = /^(url|successurl|failcache|successcache|cache|songinfo|musicinfo|name|singer|account|cookie|token|headers|body)$/i;


function parseHealthSourceVersion(v) {
  const parts = String(v || "").trim().split(".");
  if (parts.length !== 3) return null;
  const nums = parts.map(n => Number(n));
  if (nums.some(n => !Number.isInteger(n) || n < 0)) return null;
  return nums;
}

module.exports = {
  restoreHealthState,
  isHealthPlainObject,
  HEALTH_STATE_ACCEPTED_VERSIONS,
  healthNumber,
  HEALTH_STATE_FUTURE_TOLERANCE_MS,
  HEALTH_STATE_TTL_MS,
  HEALTH_STATE_MAX_BYTES,
  checkHealthForbiddenKeys,
  isAcceptedSourceVersion,
  HEALTH_BREAKER_NUMBER_FIELDS,
  HEALTH_BREAKER_BOOL_FIELDS,
  applyHealthControls,
  HEALTH_FORBIDDEN_KEYS,
  parseHealthSourceVersion,
};
