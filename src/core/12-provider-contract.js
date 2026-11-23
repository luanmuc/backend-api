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

// R77（R76 治理项）：复核日期必须新鲜。过期超过宽限天数未复核 → 契约失败，
// 逼人工复核或显式顺延（顺延本身同样受窗口约束，不会无限拖）。
const REVIEW_GRACE_DAYS = 14;
// R78（R77 顺延留下的洞）：reviewAt 语义是「上一次真实复核的日期」，写未来日期等于用
// 日历绕过上面那道过期判定（nowMs - ts 变负永远不超窗）。这里反向卡死：晚于当前超过
// FUTURE_TOLERANCE 判非法。容差 1 天是因为 reviewAt 只到日历日精度、按 UTC 零点解析，
// 北京凌晨（00:00~08:00）时 UTC 仍是前一日，今天的日期会算成 +4~8h。
const REVIEW_FUTURE_TOLERANCE_MS = 24 * 3600 * 1e3;
// R81 真机 P0：真机 QuickJS 2024（wrapper-android 2.4.0）把 Date 包成 Proxy，宿主
// user-api-preload.js 的 freezeObjectProperty(globalThis) 又把 Date.parse 冻结成
// non-configurable/non-writable，读 Date.parse 会抛 "proxy: inconsistent get"（栈
// checkFresh → validateProviderContracts → legacy.js）。V8/Node/旧版 QuickJS 都不校验
// 这个 invariant，所以本地门禁全绿、真机初始化直接失败。这里改用纯算术解析 YYYY-MM-DD，
// 不碰 Date 的任何静态方法（Date.now 已证真机可用，保留不动）。
function parseYmdToMs(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s));
  if (!m) return NaN;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  if (!(mo >= 1 && mo <= 12) || !(d >= 1 && d <= 31)) return NaN;
  // 日历年 → 距 1970-01-01 的天数（Howard Hinnant days_from_civil）
  const yy = mo <= 2 ? y - 1 : y;
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;
  const doy = Math.floor((153 * (mo + (mo > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  const days = era * 146097 + doe - 719468;
  const ms = days * 86400000;
  return Number.isFinite(ms) ? ms : NaN;
}
function validateProviderContracts(nowMs = Date.now()) {
  const checkFresh = (owner, reviewAt) => {
    if (!reviewAt) return;
    const ts = parseYmdToMs(reviewAt);
    if (!Number.isFinite(ts)) { errors.push(`${owner}: reviewAt 非法 ${reviewAt}`); return; }
    if (ts - nowMs > REVIEW_FUTURE_TOLERANCE_MS) {
      errors.push(`${owner}: reviewAt ${reviewAt} 是未来日期，必须填真实复核日（不得用未来日期绕过宽限）`);
      return;
    }
    if (nowMs - ts > REVIEW_GRACE_DAYS * 24 * 3600 * 1e3) {
      errors.push(`${owner}: reviewAt ${reviewAt} 过期超 ${REVIEW_GRACE_DAYS} 天，需复核或显式顺延`);
    }
  };
  const errors = [];
  const ids = Object.keys(SOURCE_HANDLERS);
  const toggleIds = Object.keys(dep('SOURCE_TOGGLES'));
  const registered = ids.length;
  const active = ids.filter(id => SOURCE_HANDLERS[id].lifecycle === PROVIDER_LIFECYCLE.ACTIVE);
  const probation = ids.filter(id => SOURCE_HANDLERS[id].lifecycle === PROVIDER_LIFECYCLE.PROBATION);

  if (registered !== 15) errors.push(`登记源必须为 15，实际 ${registered}`);
  if (active.length !== 13) errors.push(`上链源必须为 13，实际 ${active.length}`);
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
      else checkFresh(`${id} 复核日`, h.reviewAt);
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
    checkFresh(`覆盖缺口 ${gap.platform}`, gap.reviewAt);
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
  // R78（2026-11-23 真实复核，把 R77 顺延到未来的日期改回真实复核日；顺延不等于复核已做）：
  // 本轮实测结论 —— oiapi 的 Kuwo_Music / QQ_Music / 163_Music 三接口均 `404 code -13001
  // 接口不存在或已下线`；Migu_Music 仍活（`200 code=1` 能出直链）；juhe 全域 `429`（根路径也
  // 429，CF 层限流/挂维护页）；qingliangTx `200 code=1` 能出直链。故 mg/kg 的「单源」已变成
  // 「零可用源」，tx 的「三源」实际只剩 qingliangTx 单点，风险档与文案随之改写。
  // R79（2026-11-23 实测纠正）：R78 写的「suyinMigu 200 code=1 可出链」已被推翻 ——
  // 2026-11-21 与 R79 复测均为 `code 502「咪咕搜索接口均不可用（服务器 IP 可能被咪咕限制）」`；
  // 且 R79 实测 `xinghaiBackend` 的 mg 分支对任意 mid 恒定返回同一首音频（`name` 传「晴天」「演员」
  // 返回完全相同的 URL，3.9MB ID3v2.3），无法证明身份 → 不能接。mg 仍是零可用源。
  Object.freeze({ platform: "mg", reason: "suyinKuwo 接口已下线（R78 404 -13001）；观察源 suyinMigu 复测为 code 502（上游 IP 被咪咕限）；R79 实测 xinghaiBackend mg 分支对任意 mid 恒定返回同一首（不可证身份）→ 当前无可用 mg 源", risk: "high", reviewAt: "2026-11-23" }),
  Object.freeze({ platform: "kg", reason: "suyinKuwo 接口已下线（R78 404 -13001），当前零上链源，无第二源", risk: "high", reviewAt: "2026-11-23" }),
  // v9.1.2（B04-001）：原写「suyinKuwo + juheTx 双源」漏记了链位次更靠前的 qingliangTx，
  // 且 reviewAt 与 docs/SOURCE_REGISTRY.md 的「覆盖缺口」表（2026-11-18）不一致。
  // 现按登记表对齐为三源 + 同日期，两处口径必须同步改。
  // R78：三源里 juheTx 全域 429、suyinKuwo 与 suyinQQ 已下线，实际只剩 qingliangTx 一个点。
  // R79：接入 luoyueTx 后实测可用 2 源（qingliangTx + 落月），单点故障已消除，风险档由 high 下调 medium。
  Object.freeze({ platform: "tx", reason: "登记四源，R79 实测可用 2 源（qingliangTx 200 code=1 出 aqqmusic 直链；luoyueTx v3 128k/320k/flac 三档真音频，flac 55.39MB fLaC）；juheTx 全域 429、suyinKuwo 接口下线", risk: "medium", reviewAt: "2026-11-23" }),
]);

module.exports = {
  validateProviderContracts,
  KNOWN_COVERAGE_GAPS,
};
