// ============================================================
// v9.0 公共层 · 11-provider-meta（供应商元数据常量）
// 纯常量层：不依赖任何模块，供 22-chain / 25-handlers 顶层直接引用
// ============================================================
const PROVIDER_LIFECYCLE = Object.freeze({ ACTIVE: "active", PROBATION: "probation" });
const PROVIDER_AUTH = Object.freeze({ NONE: "none", OPTIONAL: "optional" });

module.exports = { PROVIDER_LIFECYCLE, PROVIDER_AUTH };
