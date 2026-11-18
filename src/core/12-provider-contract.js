// ============================================================
// v9.0 业务层 · 12-provider-contract（供应商契约校验（PROVIDER_CONTRACT / validateProviderContracts / 覆盖缺口））
// 反向闭包裁剪簇；对遗留 legacy 符号走 dep(name) 依赖注入
// ============================================================
const { provider } = require("./25-handlers.js");
const { SOURCE_HANDLERS } = require("./25-handlers.js");
const { PROVIDER_AUTH, PROVIDER_LIFECYCLE } = require("./11-provider-meta.js");
const { PLATFORM_QUALITIES } = require("./09-match.js");
const { ERROR_CODES } = require("./02-error-codes.js");
const { dep } = require("./06-binding.js");

function validateProviderContracts() {
  const errors = [];
  const ids = Object.keys(SOURCE_HANDLERS);
  const toggleIds = Object.keys(dep('SOURCE_TOGGLES'));
  const registered = ids.length;
  const active = ids.filter(id => SOURCE_HANDLERS[id].lifecycle === PROVIDER_LIFECYCLE.ACTIVE);
  const probation = ids.filter(id => SOURCE_HANDLERS[id].lifecycle === PROVIDER_LIFECYCLE.PROBATION);

  if (registered !== 13) errors.push(`登记源必须为 13，实际 ${registered}`);
  if (active.length !== 11) errors.push(`上链源必须为 11，实际 ${active.length}`);
  if (probation.length !== 2) errors.push(`观察源必须为 2，实际 ${probation.length}`);
  if (toggleIds.length !== registered) errors.push(`dep('SOURCE_TOGGLES') 必须与 SOURCE_HANDLERS 等量，toggles=${toggleIds.length}, handlers=${registered}`);
  for (const id of toggleIds) if (!SOURCE_HANDLERS[id]) errors.push(`dep('SOURCE_TOGGLES') 存在未登记源 ${id}`);

  const upstreamGroups = new Set();
  for (const id of ids) {
    const h = SOURCE_HANDLERS[id];
    if (!h || h.id !== id) { errors.push(`${id}: id 与键不一致`); continue; }
    if (!h.name || typeof h.name !== "string") errors.push(`${id}: 缺少 name`);
    if (typeof h.fn !== "function") errors.push(`${id}: 缺少 fn`);
    if (!h.qualitys.includes("128k")) errors.push(`${id}: qualitys 必须包含 128k`);
    if (!h.qualitys.includes(h.maxQuality)) errors.push(`${id}: qualitys 未包含 maxQuality=${h.maxQuality}`);
    if (!Array.isArray(h.platforms) || !h.platforms.length) errors.push(`${id}: platforms 为空`);
    if (!h.upstreamGroup) errors.push(`${id}: upstreamGroup 为空`);
    if (upstreamGroups.has(h.upstreamGroup)) errors.push(`${id}: upstreamGroup 重复 ${h.upstreamGroup}`);
    upstreamGroups.add(h.upstreamGroup);
    if (!Object.values(PROVIDER_AUTH).includes(h.auth)) errors.push(`${id}: auth 非法 ${h.auth}`);
    if (!Object.values(PROVIDER_LIFECYCLE).includes(h.lifecycle)) errors.push(`${id}: lifecycle 非法 ${h.lifecycle}`);
    if (h.lifecycle === PROVIDER_LIFECYCLE.PROBATION) {
      if (Object.keys(h.chain).length) errors.push(`${id}: probation 源不得有链位次`);
      if (dep('SOURCE_TOGGLES')[id] !== false) errors.push(`${id}: probation 源默认必须关闭`);
      if (!h.reviewAt) errors.push(`${id}: probation 源必须有 reviewAt`);
    } else if (!Object.keys(h.chain).length) {
      errors.push(`${id}: active 源必须有链位次`);
    }
  }

  for (const platform of Object.keys(PLATFORM_QUALITIES)) {
    const chain = active.filter(id => SOURCE_HANDLERS[id].platforms.includes(platform) && SOURCE_HANDLERS[id].chain[platform] != null);
    if (!chain.length) errors.push(`${platform}: 没有任何上链源`);
    const ranks = chain.map(id => SOURCE_HANDLERS[id].chain[platform]);
    if (new Set(ranks).size !== ranks.length) errors.push(`${platform}: 链位次重复`);
  }
  for (const gap of KNOWN_COVERAGE_GAPS) {
    const count = active.filter(id => SOURCE_HANDLERS[id].platforms.includes(gap.platform) && SOURCE_HANDLERS[id].chain[gap.platform] != null).length;
    if (gap.platform === "mg" || gap.platform === "kg") {
      if (count !== 1) errors.push(`${gap.platform}: 覆盖缺口登记为单源，实际 ${count} 源`);
    }
  }

  if (errors.length) {
    const err = new Error(`${ERROR_CODES.CONTRACT_ERROR}: Provider Contract 校验失败 -> ${errors.join(" | ")}`);
    err.code = ERROR_CODES.CONTRACT_ERROR;
    err.contractErrors = errors;
    throw err;
  }
  return { ok: true, registered, active: active.length, probation: probation.length, platforms: Object.keys(PLATFORM_QUALITIES) };
}

const KNOWN_COVERAGE_GAPS = Object.freeze([
  Object.freeze({ platform: "mg", reason: "仅 suyinKuwo 单源；suyinMigu 处于 probation 不进链", risk: "high", reviewAt: "2026-11-26" }),
  Object.freeze({ platform: "kg", reason: "仅 suyinKuwo 单源；无第二源", risk: "high", reviewAt: "2026-11-19" }),
  // v9.1.2（B04-001）：原写「suyinKuwo + juheTx 双源」漏记了链位次更靠前的 qingliangTx，
  // 且 reviewAt 与 docs/SOURCE_REGISTRY.md 的「覆盖缺口」表（2026-11-18）不一致。
  // 现按登记表对齐为三源 + 同日期，两处口径必须同步改。
  Object.freeze({ platform: "tx", reason: "suyinKuwo + qingliangTx + juheTx 三源；qingliangTx 第三方单点、juheTx 受基础设施限流", risk: "medium", reviewAt: "2026-11-18" }),
]);

module.exports = {
  validateProviderContracts,
  KNOWN_COVERAGE_GAPS,
};
