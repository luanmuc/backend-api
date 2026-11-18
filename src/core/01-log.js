// ============================================================
// v9.0 公共层 · 01-log
// 职责：console 宿主防御 + 三档日志（info / warn / debug）
// 依赖：仅 globalThis.__lxSourceConfig（不依赖宿主 lx、不依赖任何业务状态）
// 来源：由 legacy.js L1105-1116 原样迁出（v9.0 拆包第一刀，语义零变化）
// ============================================================
// v1.0 D11：console 宿主防御 — 官方移动版「可用宿主环境 API」仅 setTimeout/clearTimeout（无 console 保证）
// 依据：lxmusic.toside.cn/mobile/custom-source 宿主 API 清单 + fork user-api-preload.js 未注入 console + vm 无 console 沙箱复现（修复前加载即抛 TypeError）
const safeConsole = {
  log: (typeof console !== "undefined" && typeof console.log === "function") ? console.log.bind(console) : () => {},
  warn: (typeof console !== "undefined" && typeof console.warn === "function") ? console.warn.bind(console) : () => {},
};
const LOG_ENABLED = (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.logEnabled !== undefined) ? !!globalThis.__lxSourceConfig.logEnabled : true;
// v1.0：debug 级源级决策日志（默认关；排查时改 LOG_DEBUG=true 或宿主注入 __lxSourceConfig.logDebug=true）
const LOG_DEBUG = (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.logDebug) || false;
function logInfo(...args) { if (LOG_ENABLED) safeConsole.log("[聚合音源][信息]", ...args); }
function logWarn(...args) { if (LOG_ENABLED) safeConsole.warn("[聚合音源][警告]", ...args); }
function logDebug(...args) { if (LOG_ENABLED && LOG_DEBUG) safeConsole.log("[聚合音源][决策]", ...args); }

module.exports = { safeConsole, LOG_ENABLED, LOG_DEBUG, logInfo, logWarn, logDebug };
