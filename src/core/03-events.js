// ============================================================
// v9.0 公共层 · 03-events
// 职责：健康事件环形缓冲 + 字段白名单校验 + trace 挂载
// 依赖：01-log（logInfo/logWarn）、02-config（cfg）、02-error-codes（ERROR_CODES）
// 来源：由 legacy.js 原样迁出（v9.0 第三刀）
// 注意：assertEventFieldPolicy() 的「加载即守」调用**留在 legacy 原地**，保证加载顺序不变
// ============================================================
const { logInfo, logWarn } = require("./01-log.js");
const { cfg } = require("./02-config.js");
const { ERROR_CODES } = require("./02-error-codes.js");

const HEALTH_EVENT_MAX = 500;
const HEALTH_EVENT_FIELDS = ["traceId", "eventId", "event", "sourceId", "platform", "quality", "ok", "code", "latencyMs", "reason", "from", "to"];
// v8.16：事件白名单的**源码侧对偶**——测试侧（s-health-events S5）只验「文本里没有隐私字段名」，
// 一旦有人把 name/url/songmid 加进白名单，行为层抽样未必覆盖得到。这里让口径自己守自己：
// 加载即校验，含隐私字段或重复项直接抛 CONTRACT_ERROR（与 Provider Contract 同一条「宁可起不来」策略）。
const HEALTH_EVENT_PRIVACY_RE = /^(name|songName|songNameRaw|singer|artist|album|url|uri|hash|songmid|mid|rid|lyric|account|phone|imei|device|token|cookie|openid|secret)$/i;
const healthEventFieldAudit = { unknown: new Map(), privacyDropped: 0, unknownTotal: 0, warned: new Set() };
function assertEventFieldPolicy() {
  const bad = HEALTH_EVENT_FIELDS.filter((f) => HEALTH_EVENT_PRIVACY_RE.test(String(f)));
  const dup = HEALTH_EVENT_FIELDS.filter((f, i) => HEALTH_EVENT_FIELDS.indexOf(f) !== i);
  const errors = [];
  if (bad.length) errors.push(`隐私字段 ${bad.join(",")}`);
  if (dup.length) errors.push(`重复字段 ${[...new Set(dup)].join(",")}`);
  if (errors.length) {
    const err = new Error(`${ERROR_CODES.CONTRACT_ERROR}: 事件字段白名单非法 -> ${errors.join(" | ")}`);
    err.code = ERROR_CODES.CONTRACT_ERROR;
    throw err;
  }
  return HEALTH_EVENT_FIELDS.length;
}
assertEventFieldPolicy();   // 加载即守：白名单漂移不必等测试跑
const healthEventRing = [];
let healthEventSeq = 0;
let healthEventDropped = 0;
const HEALTH_TRACE_KEY = Symbol("lxHealthTrace");

const clipText = (v, max) => String(v == null ? "" : v).slice(0, max);
function recordHealthEvent(entry) {
  if (!entry || typeof entry !== "object") return;
  const e = {
    seq: ++healthEventSeq,
    eventId: `evt-${healthEventSeq}`,
    ts: Date.now(),
    traceId: clipText(entry.traceId, 64),
    event: clipText(entry.event || "unknown", 32),
  };
  // v8.16：白名单外的键不再静默丢弃——隐私类键单独计数（这是 S5 行为层抽样的运行时兜底），
  // 其余未知键也计数并按首次出现告警一次（有上限，避免脏调用把日志刷爆）。
  for (const k of Object.keys(entry)) {
    if (k === "seq" || k === "eventId" || k === "ts") continue;
    if (HEALTH_EVENT_FIELDS.indexOf(k) >= 0) continue;
    if (HEALTH_EVENT_PRIVACY_RE.test(k)) healthEventFieldAudit.privacyDropped++;
    else {
      healthEventFieldAudit.unknownTotal++;
      const c = (healthEventFieldAudit.unknown.get(k) || 0) + 1;
      healthEventFieldAudit.unknown.set(k, c);
      if (c === 1 && healthEventFieldAudit.warned.size < 20) {
        healthEventFieldAudit.warned.add(k);
        logWarn(`健康事件出现未登记字段 "${k}"（已丢弃）——如需记录请先加进 HEALTH_EVENT_FIELDS`);
      }
    }
  }
  for (const k of HEALTH_EVENT_FIELDS) {
    if (k === "traceId" || k === "event" || entry[k] === undefined) continue;
    if (k === "ok") {
      if (typeof entry.ok === "boolean") e.ok = entry.ok;
    } else if (k === "latencyMs") {
      const n = Number(entry.latencyMs);
      if (Number.isFinite(n) && n >= 0) e.latencyMs = Math.round(n);
    } else {
      e[k] = clipText(entry[k], k === "reason" ? 40 : 48);
    }
  }
  healthEventRing.push(e);
  while (healthEventRing.length > HEALTH_EVENT_MAX) {
    // F33：transition 是状态机证据，不能被 probe 洪水挤掉；溢出优先压最早的
    // 非 transition 事件，只有整环都是 transition 时才丢最旧 transition。
    const dropAt = healthEventRing.findIndex(x => x.event !== "health_transition");
    healthEventRing.splice(dropAt >= 0 ? dropAt : 0, 1);
    healthEventDropped++;
  }
}
function getHealthEventFieldAudit() {
  const unknownCounts = {};
  for (const [k, v] of healthEventFieldAudit.unknown) unknownCounts[k] = v;
  return {
    unknown: [...healthEventFieldAudit.unknown.keys()].sort(),
    unknownCounts,
    unknownTotal: healthEventFieldAudit.unknownTotal,
    privacyDropped: healthEventFieldAudit.privacyDropped,
  };
}
function getHealthEvents(params) {
  const cap = Math.min(Math.max(Number(params && params.limit) || HEALTH_EVENT_MAX, 1), HEALTH_EVENT_MAX);
  const traceId = clipText(params && params.traceId, 64);
  const filtered = traceId ? healthEventRing.filter(e => e.traceId === traceId) : healthEventRing;
  return {
    schema: 1,
    capacity: HEALTH_EVENT_MAX,
    dropped: healthEventDropped,
    events: filtered.slice(-cap).map(e => ({ ...e })),
  };
}
function attachHealthTrace(songInfo, traceId) {
  if (!songInfo || typeof songInfo !== "object") return;
  try {
    Object.defineProperty(songInfo, HEALTH_TRACE_KEY, {
      value: clipText(traceId, 64),
      configurable: true,
      enumerable: false,
    });
  } catch (e) { /* 冻结对象不阻断播放 */ }
}
function healthTraceOf(songInfo) {
  return (songInfo && typeof songInfo === "object" && songInfo[HEALTH_TRACE_KEY]) || "";
}

module.exports = {
  HEALTH_EVENT_MAX, HEALTH_EVENT_FIELDS, HEALTH_EVENT_PRIVACY_RE, healthEventFieldAudit,
  assertEventFieldPolicy, healthEventRing, HEALTH_TRACE_KEY, clipText, recordHealthEvent,
  getHealthEventFieldAudit, getHealthEvents, attachHealthTrace, healthTraceOf,
  getHealthEventSeq: () => healthEventSeq, getHealthEventDropped: () => healthEventDropped,
};
