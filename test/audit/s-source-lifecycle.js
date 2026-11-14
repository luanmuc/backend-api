#!/usr/bin/env node
/**
 * v8.13 源生命周期治理审计（S1~S14）
 * 预算 12/10/2、增源准入、减源退出、退役源清零、文档与库表对齐。
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const SRC = path.join(ROOT, 'lx-source.js');
globalThis.lx = {
  EVENT_NAMES: { inited: 'inited', request: 'request', updateAlert: 'updateAlert' },
  version: '1.2.0', env: {},
  utils: { buffer: { from: (d, e) => Buffer.from(d, e), bufToString: (b, e) => b.toString(e) } },
  request: (u, o, cb) => setTimeout(() => cb(new Error('mock-no-network'), null), 1),
  on: () => {}, send: () => {},
};
const mod = require(SRC);

let pass = 0, fail = 0;
function rec(id, name, fn) {
  try { fn(); console.log(`✅ ${id} ${name}`); pass++; }
  catch (e) { console.log(`❌ ${id} ${name}\n   ${e.message}`); fail++; }
}
const H = mod.SOURCE_HANDLERS;
const ids = Object.keys(H);

rec('S1', '预算：12 登记 / 10 上链 / 2 观察', () => {
  assert.strictEqual(ids.length, 12);
  assert.strictEqual(ids.filter(id => H[id].lifecycle === 'active').length, 10);
  assert.strictEqual(ids.filter(id => H[id].lifecycle === 'probation').length, 2);
});
rec('S2', '退役 8 源完全不在册、不探测', () => {
  const retired = ['xinghaiBackup', 'lingchuan', 'gdWy', 'juheKw', 'juheWy', 'juheKg', 'juheMg', 'nianxinVip'];
  for (const id of retired) {
    assert.ok(!ids.includes(id), `退役源仍在册: ${id}`);
    assert.ok(!(id in mod.buildProbeConfig()), `退役源仍在探测: ${id}`);
  }
});
rec('S3', '生命周期只允许 active/probation', () => {
  for (const id of ids) assert.ok(['active', 'probation'].includes(H[id].lifecycle), `${id}: ${H[id].lifecycle}`);
});
rec('S4', '观察源默认关闭且只探测不进链', () => {
  for (const id of ids.filter(x => H[x].lifecycle === 'probation')) {
    assert.strictEqual(mod.SOURCE_TOGGLES[id], false);
    assert.ok(!H[id].chain || !Object.keys(H[id].chain).length);
    assert.ok(id in mod.buildProbeConfig(), `观察源必须持续探测: ${id}`);
  }
});
rec('S5', '观察源 reviewAt 到期可追踪', () => {
  assert.strictEqual(H.suyinQQ.reviewAt, '2026-11-19');
  assert.strictEqual(H.suyinMigu.reviewAt, '2026-11-26');
  assert.strictEqual(H.juheTx.reviewAt, '2026-11-19');
});
rec('S6', '上游族唯一，禁止同族多开', () => {
  const seen = new Set();
  for (const id of ids) {
    const g = H[id].upstreamGroup;
    assert.ok(!seen.has(g), `上游族重复: ${g}`);
    seen.add(g);
  }
});
rec('S7', '卡密/付费源不得直接 active（ikun 为 optional 公益）', () => {
  for (const id of ids) {
    if (H[id].auth === 'card' || H[id].auth === 'paid') {
      assert.strictEqual(H[id].lifecycle, 'probation', `${id}: 卡密/付费源只能 probation`);
    }
  }
});
rec('S8', '五平台均有上链源，mg/kg 单源风险已登记', () => {
  for (const p of ['kw', 'wy', 'tx', 'mg', 'kg']) assert.ok(mod.buildSourceChain(p, '128k').length > 0, `${p} 无链`);
  const gaps = mod.KNOWN_COVERAGE_GAPS;
  assert.ok(gaps.some(g => g.platform === 'mg' && g.risk === 'high'));
  assert.ok(gaps.some(g => g.platform === 'kg' && g.risk === 'high'));
});
rec('S9', 'source-inventory --check 可执行且通过', () => {
  const out = execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'source-inventory.js'), '--check'], { encoding: 'utf8' });
  assert.match(out, /12 登记 \/ 10 上链 \/ 2 观察/);
});
rec('S10', 'SOURCE_REGISTRY.md 存在且登记 12 源', () => {
  const f = path.join(ROOT, 'docs', 'SOURCE_REGISTRY.md');
  assert.ok(fs.existsSync(f), '缺少 docs/SOURCE_REGISTRY.md');
  const t = fs.readFileSync(f, 'utf8');
  for (const id of ids) assert.ok(t.includes(id), `登记表缺少 ${id}`);
});
rec('S11', 'SOURCE_LIFECYCLE.md 含七步准入与预算', () => {
  const t = fs.readFileSync(path.join(ROOT, 'docs', 'SOURCE_LIFECYCLE.md'), 'utf8');
  assert.match(t, /12/);
  assert.match(t, /七步|7 步/);
  assert.match(t, /probation/);
});
rec('S12', 'SOURCE_RETIREMENT.md 含五条退出线', () => {
  const t = fs.readFileSync(path.join(ROOT, 'docs', 'SOURCE_RETIREMENT.md'), 'utf8');
  assert.match(t, /五条|5 条|退出线/);
  assert.match(t, /一进一出/);
});
rec('S13', '端点登记表与 12 源对齐（无退役端点）', () => {
  const reg = require(path.join(ROOT, 'scripts', 'endpoint-registry.js'));
  const text = JSON.stringify(reg.ENDPOINTS || reg);
  for (const id of ['xinghaiBackup', 'lingchuan', 'gdWy', 'juheKw', 'juheWy', 'juheKg', 'juheMg', 'nianxinVip']) {
    assert.ok(!text.includes(id), `端点表仍含退役源 ${id}`);
  }
  assert.ok(fs.readFileSync(path.join(ROOT, 'scripts', 'source-inventory.js'), 'utf8').includes('12'));
});
rec('S14', '版本号已升 8.14.0', () => {
  const src = fs.readFileSync(SRC, 'utf8');
  assert.match(src, /@version 8\.14\.0/);
  assert.match(src, /v8\.14\.0/);
});

console.log(`\nSource lifecycle: ${pass} passed, ${fail} failed`);
if (require.main === module) process.exit(fail ? 1 : 0);
