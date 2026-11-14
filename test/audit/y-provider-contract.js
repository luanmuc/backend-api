#!/usr/bin/env node
/**
 * v8.13 Provider Contract 审计（Y1~Y15）
 * 目标：12 登记 / 10 上链 / 2 观察，契约非法时拒绝加载。
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const SRC = path.join(__dirname, '..', '..', 'lx-source.js');
// 最小宿主：契约审计不发起真实外呼，只要有 lx 壳即可完成加载。
globalThis.lx = {
  EVENT_NAMES: { inited: 'inited', request: 'request', updateAlert: 'updateAlert' },
  version: '1.2.0',
  env: {},
  utils: { buffer: { from: (d, e) => Buffer.from(d, e), bufToString: (b, e) => b.toString(e) } },
  request: (url, opts, cb) => setTimeout(() => cb(new Error('mock-no-network'), null), 1),
  on: () => {},
  send: () => {},
};
const mod = require(SRC);

let pass = 0, fail = 0;
function rec(id, name, fn) {
  try { fn(); console.log(`✅ ${id} ${name}`); pass++; }
  catch (e) { console.log(`❌ ${id} ${name}\n   ${e.message}`); fail++; }
}

const H = mod.SOURCE_HANDLERS;
const ids = Object.keys(H);
const activeIds = ids.filter(id => H[id].lifecycle === 'active');
const probationIds = ids.filter(id => H[id].lifecycle === 'probation');

rec('Y1', '登记/上链/观察预算 = 12/10/2', () => {
  assert.strictEqual(ids.length, 12);
  assert.strictEqual(activeIds.length, 10);
  assert.strictEqual(probationIds.length, 2);
});
rec('Y2', '10 个上链源名单固定', () => {
  assert.deepStrictEqual(activeIds.sort(), ['suyinKuwo', 'wyOuter', 'kuwoOfficial', 'helloworldKw', 'ikun', 'xinghaiBackend', 'huibq', 'suyin163', 'juheTx', 'changqingVip'].sort());
});
rec('Y3', '2 个观察源 = suyinQQ/suyinMigu 且默认关闭', () => {
  assert.deepStrictEqual(probationIds.sort(), ['suyinQQ', 'suyinMigu'].sort());
  assert.strictEqual(mod.SOURCE_TOGGLES.suyinQQ, false);
  assert.strictEqual(mod.SOURCE_TOGGLES.suyinMigu, false);
});
rec('Y4', '上游族唯一（同族不得多源）', () => {
  const groups = {};
  for (const id of ids) {
    const g = H[id].upstreamGroup || id;
    assert.ok(!groups[g], `上游族重复: ${g} → ${groups[g]} + ${id}`);
    groups[g] = id;
  }
});
rec('Y5', 'qualitys 必须由 maxQuality 截断且有序', () => {
  const ORDER = ['128k', '320k', 'flac', 'flac24bit'];
  for (const id of ids) {
    const q = H[id].qualitys;
    assert.ok(Array.isArray(q) && q.length > 0, `${id}: qualitys 为空`);
    const expect = ORDER.slice(0, ORDER.indexOf(H[id].maxQuality) + 1);
    assert.deepStrictEqual(q, expect, `${id}: qualitys 与 maxQuality 不一致`);
  }
});
rec('Y6', 'auth 只能是 none/optional/card/paid', () => {
  for (const id of ids) assert.ok(['none', 'optional', 'card', 'paid'].includes(H[id].auth), `${id}: auth=${H[id].auth}`);
  assert.strictEqual(H.ikun.auth, 'optional', 'ikun 应为免卡密 optional');
});
rec('Y7', 'active 必须有链位次，且平台位次唯一', () => {
  for (const id of activeIds) {
    assert.ok(H[id].chain && Object.keys(H[id].chain).length > 0, `${id}: active 无链位次`);
    for (const [p, rank] of Object.entries(H[id].chain)) {
      assert.ok(Number.isInteger(rank) && rank >= 1, `${id}: ${p} rank 非法`);
    }
  }
  for (const p of ['kw', 'wy', 'tx', 'mg', 'kg']) {
    const ranks = activeIds.filter(id => H[id].chain[p]).map(id => H[id].chain[p]);
    assert.strictEqual(new Set(ranks).size, ranks.length, `${p} 链位次重复: ${ranks.join(',')}`);
  }
});
rec('Y8', 'probation 无链位次 / 默认关闭 / 有 reviewAt', () => {
  for (const id of probationIds) {
    assert.ok(!H[id].chain || Object.keys(H[id].chain).length === 0, `${id}: 观察源不得有链位次`);
    assert.strictEqual(mod.SOURCE_TOGGLES[id], false, `${id}: 观察源默认必须关闭`);
    assert.match(String(H[id].reviewAt), /^\d{4}-\d{2}-\d{2}$/, `${id}: reviewAt 缺失`);
  }
  assert.strictEqual(H.suyinQQ.reviewAt, '2026-11-19');
  assert.strictEqual(H.suyinMigu.reviewAt, '2026-11-26');
});
rec('Y9', 'chain-golden.json 10 源 5×4 逐项一致，且不含观察源', () => {
  const golden = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'chain-golden.json'), 'utf8'));
  assert.strictEqual(golden.version, '8.14.0');
  for (const p of ['kw', 'wy', 'tx', 'mg', 'kg']) {
    for (const q of ['128k', '320k', 'flac', 'flac24bit']) {
      const chain = mod.buildSourceChain(p, q);
      assert.ok(!chain.some(h => h.lifecycle === 'probation'), `${p}/${q} 链混入观察源`);
      assert.deepStrictEqual(chain.map(h => h.id), golden.platforms[p][q], `${p}/${q} 链序漂移`);
    }
  }
});
rec('Y10', '覆盖缺口显式登记（mg/kg 单源、tx 双源）', () => {
  const gaps = mod.KNOWN_COVERAGE_GAPS;
  assert.ok(gaps.some(g => g.platform === 'mg' && g.risk === 'high'));
  assert.ok(gaps.some(g => g.platform === 'kg' && g.risk === 'high'));
  assert.ok(gaps.some(g => g.platform === 'tx' && g.risk === 'medium'));
  const snap = mod.getHealthSnapshot();
  assert.ok(snap._coverageGaps.length >= 3, '健康快照缺 _coverageGaps');
  assert.strictEqual(snap._platformRisk.mg.risk, 'high');
  assert.strictEqual(snap._platformRisk.kg.risk, 'high');
  assert.strictEqual(snap._platformRisk.tx.risk, 'medium');
});
rec('Y11', 'validateProviderContracts 正常返回预算', () => {
  const c = mod.validateProviderContracts();
  assert.strictEqual(c.registered, 12);
  assert.strictEqual(c.active, 10);
  assert.strictEqual(c.probation, 2);
});
rec('Y12', '契约非法：观察源带链位次必须拒绝', () => {
  const backup = H.suyinQQ.chain;
  H.suyinQQ.chain = { tx: 9 };
  try { assert.throws(() => mod.validateProviderContracts(), /probation|链位次/); }
  finally { H.suyinQQ.chain = backup; }
});
rec('Y13', '契约非法：上链源无链位次必须拒绝', () => {
  const backup = H.huibq.chain;
  H.huibq.chain = {};
  try { assert.throws(() => mod.validateProviderContracts(), /链位次|active/); }
  finally { H.huibq.chain = backup; }
});
rec('Y14', '契约非法：上游族重复必须拒绝', () => {
  const backup = H.ikun.upstreamGroup;
  H.ikun.upstreamGroup = H.suyinKuwo.upstreamGroup;
  try { assert.throws(() => mod.validateProviderContracts(), /upstreamGroup|重复/); }
  finally { H.ikun.upstreamGroup = backup; }
});
rec('Y15', '契约非法：qualitys 与 maxQuality 不一致必须拒绝', () => {
  const backup = H.huibq.qualitys;
  H.huibq.qualitys = ['320k', 'flac'];
  try { assert.throws(() => mod.validateProviderContracts(), /qualitys|128k/); }
  finally { H.huibq.qualitys = backup; }
});

console.log(`\nProvider Contract: ${pass} passed, ${fail} failed`);
if (require.main === module) process.exit(fail ? 1 : 0);
