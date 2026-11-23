#!/usr/bin/env node
/**
 * R83 治理回归（E1~E2 引擎能力自检 / R1~R5 复核日滚动窗口）
 *
 * 背景：
 *   - R81 证明「本地 Node 绿 ≠ 真机可用」：真机 QuickJS 把 Date 包成 Proxy，读 Date.parse 直接抛
 *     proxy: inconsistent get。wrapper 升级后可能出现新的 invariant，所以启动必须能量一次引擎假设。
 *   - K43 证明「同一日期 = 集体过期」：15 个登记项 reviewAt 全是 2026-11-23 + 统一 14 天宽限
 *     → 2026-12-07 全体变红。改为每项声明 reviewEveryDays 后，到期日被摊到 12-23 / 01-22 / 02-21。
 *
 * 本用例守住：
 *   E1 真实环境探测：dateNow/newDate/freeze 可用，且探测本身不抛
 *   E2 模拟宿主 Proxy invariant（读 parse 抛错）：必须被捕获，不冒泡
 *   R1 所有带 reviewAt 的登记项都必须声明 reviewEveryDays（不许回落到统一 14 天）
 *   R2 reviewEveryDays 必须是 7~365 的整数
 *   R3 到期日至少 3 个不同日期（证明不再集体过期）
 *   R4 「不得写未来日期」规则原样有效（时间回拨到 1970 必须整体拒绝）
 *   R5 关键证明：2026-12-08（旧的集体过期日之后一天）必须通过；2027-01-02（30 天窗口到期后）必须失败
 */
const assert = require('assert');
const path = require('path');

// 最小宿主：契约模块在加载期只解构 lx，不会外呼
globalThis.lx = {
  EVENT_NAMES: { inited: 'inited', request: 'request', updateAlert: 'updateAlert' },
  version: '1.2.0',
  env: {},
  utils: { buffer: { from: (d, e) => Buffer.from(d, e), bufToString: (b, e) => b.toString(e) } },
  request: (url, opts, cb) => setTimeout(() => cb(new Error('mock-no-network'), null), 1),
  on: () => {},
  send: () => {},
};

const SRC = path.join(__dirname, '..', '..', 'lx-source.js');
const contract = require(path.join(__dirname, '..', '..', 'src', 'core', '12-provider-contract.js'));
const mod = require(SRC);

let pass = 0, fail = 0;
function rec(id, name, fn) {
  try { fn(); console.log(`✅ ${id} ${name}`); pass++; }
  catch (e) { console.log(`❌ ${id} ${name}\n   ${e.message}`); fail++; }
}

// ── 引擎能力自检 ──────────────────────────────────────────
rec('E1', '真实环境探测返回且不抛（Node：parse 可读）', () => {
  const caps = contract.probeEngineCapabilities();
  assert.strictEqual(caps.dateNow, true);
  assert.strictEqual(caps.newDate, true);
  assert.strictEqual(caps.freeze, true);
  assert.strictEqual(caps.dateParseReadable, true);
  assert.strictEqual(caps.dateParseError, null);
});

rec('E2', '模拟宿主 Proxy invariant：读 parse 抛错被捕获', () => {
  const D = function FakeDate() {};
  Object.defineProperty(D, 'parse', {
    get() { throw new Error('proxy: inconsistent get'); },
    configurable: false,
  });
  const caps = contract.probeEngineCapabilities({ Date: D });
  assert.strictEqual(caps.dateParseReadable, false);
  assert.match(String(caps.dateParseError), /proxy: inconsistent get/);
  // 不得因为探测把初始化打断：函数必须正常返回
  assert.strictEqual(caps.freeze, true);
});

// ── 复核日滚动窗口 ────────────────────────────────────────
const H = mod.SOURCE_HANDLERS;
const withReviewAt = Object.keys(H).filter(id => H[id].reviewAt);

rec('R1', '所有带 reviewAt 的登记项都声明 reviewEveryDays', () => {
  assert.ok(withReviewAt.length >= 6, `带 reviewAt 的登记项过少：${withReviewAt.length}`);
  for (const id of withReviewAt) {
    assert.ok(H[id].reviewEveryDays != null, `${id}: reviewAt=${H[id].reviewAt} 但未声明 reviewEveryDays`);
  }
});

rec('R2', 'reviewEveryDays 均为 7~365 整数', () => {
  for (const id of withReviewAt) {
    const d = H[id].reviewEveryDays;
    assert.ok(Number.isInteger(d) && d >= 7 && d <= 365, `${id}: reviewEveryDays 非法 ${d}`);
  }
});

rec('R3', '到期日至少 3 个不同日期', () => {
  const due = new Set();
  for (const id of withReviewAt) due.add(`${H[id].reviewAt}+${H[id].reviewEveryDays}`);
  assert.ok(due.size >= 3, `到期日仍集中：${[...due].join(' / ')}`);
});

rec('R4', '未来日期仍被拒绝（时间回拨到 1970）', () => {
  assert.throws(() => mod.validateProviderContracts(0), (e) => {
    assert.strictEqual(e.code, 'CONTRACT_ERROR');
    assert.match(e.message, /未来日期/);
    return true;
  });
});

rec('R5', '2026-12-08 已不再集体过期；2027-01-02 起 30 天窗口先红', () => {
  // 旧的统一 14 天宽限下，2026-12-08 会让所有项同时报「过期超 14 天」
  const passedAtOldCollectiveDate = mod.validateProviderContracts(Date.parse('2026-12-08T00:00:00Z'));
  assert.strictEqual(passedAtOldCollectiveDate.ok, true);
  // 30 天窗口（audius / mg / kg）在 2027-01-02 已过期；60/90 天窗口仍应存活
  assert.throws(() => mod.validateProviderContracts(Date.parse('2027-01-02T00:00:00Z')), (e) => {
    assert.strictEqual(e.code, 'CONTRACT_ERROR');
    assert.match(e.message, /已超复核窗口 30 天/);
    return true;
  });
});

console.log(`\nR83 治理回归: ${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
if (require.main === module) process.exit(fail ? 1 : 0);
