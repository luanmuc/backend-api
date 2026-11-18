// ============================================================
// v9.0 公共层 · 00-host
// 职责：宿主环境绑定（globalThis.lx 的唯一访问点）
// 依赖：宿主注入的 globalThis.lx（必须在源加载前就已存在）
// 来源：由 legacy.js 原样迁出（v9.0 第三刀）
// 说明：这是全仓唯一一处读 globalThis.lx 的地方，拆包后成为唯一入口
// ============================================================
const lx = globalThis.lx;
const { EVENT_NAMES, request, on, send, utils, env, version } = lx;

module.exports = { lx, EVENT_NAMES, request, on, send, utils, env, version };
