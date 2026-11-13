#!/usr/bin/env node
/**
 * v8.13 单文件产物校验（B1~B8）
 * 用最小宿主加载 dist/lx-source.js，验证导出面、契约、版本与规格一致性。
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist', 'lx-source.js');
const HOST = {
  EVENT_NAMES: { inited: 'inited', request: 'request', updateAlert: 'updateAlert' },
  version: '1.2.0', env: {},
  utils: { buffer: { from: (d, e) => Buffer.from(d, e), bufToString: (b, e) => b.toString(e) } },
  request: (u, o, cb) => setTimeout(() => cb(new Error('mock-no-network'), null), 1),
  on: () => {}, send: () => {},
};

let pass = 0, fail = 0;
function rec(id, name, fn) {
  try { fn(); console.log(`✅ ${id} ${name}`); pass++; }
  catch (e) { console.log(`❌ ${id} ${name}\n   ${e.message}`); fail++; }
}

globalThis.lx = HOST;
globalThis.__lxSourceConfig = { healthCheckIntervalMs: 3600000 };
const mod = require(DIST);

rec('B1', '单文件产物存在、为 IIFE 包装且带 8.13.0 版本头', () => {
  assert.ok(fs.existsSync(DIST));
  const code = fs.readFileSync(DIST, 'utf8');
  assert.match(code, /@version 8\.13\.0/);
  assert.match(code, /var __lxSourceBundle = \(\(\) => \{/);
  assert.match(code, /module\.exports\s*=\s*__lxSourceBundle/);
});
rec('B2', '导出面包含运行必需 API', () => {
  for (const k of ['buildSourceChain', 'getUrlWithFallback', 'getHealthSnapshot', 'SOURCE_HANDLERS', 'PROVIDER_CONTRACT', 'validateProviderContracts', 'ERROR_CODES']) {
    assert.ok(k in mod, `缺少导出 ${k}`);
  }
});
rec('B3', '契约 12/10/2', () => {
  const ids = Object.keys(mod.SOURCE_HANDLERS);
  assert.strictEqual(ids.length, 12);
  assert.strictEqual(ids.filter(id => mod.SOURCE_HANDLERS[id].lifecycle === 'active').length, 10);
  assert.strictEqual(ids.filter(id => mod.SOURCE_HANDLERS[id].lifecycle === 'probation').length, 2);
  assert.strictEqual(mod.PROVIDER_CONTRACT.registered, 12);
});
rec('B4', 'PROVIDER_SPECS 与运行时契约逐源一致', () => {
  const all = mod.PROVIDER_SPECS.all;
  assert.strictEqual(all.length, 12);
  for (const s of all) {
    const h = mod.SOURCE_HANDLERS[s.id];
    assert.ok(h, `规格源未登记: ${s.id}`);
    assert.strictEqual(h.lifecycle, s.lifecycle);
    assert.strictEqual(h.upstreamGroup, s.upstreamGroup);
    assert.strictEqual(h.auth, s.auth);
    assert.strictEqual(h.maxQuality, s.maxQuality);
    assert.deepStrictEqual(h.qualitys, s.qualitys);
    assert.deepStrictEqual(h.platforms, s.platforms);
    assert.deepStrictEqual(h.chain, s.chain);
  }
});
rec('B5', '五平台链可从产物重建', () => {
  for (const p of ['kw', 'wy', 'tx', 'mg', 'kg']) {
    const chain = mod.buildSourceChain(p, '128k');
    assert.ok(chain.length > 0, `${p} 链为空`);
  }
});
rec('B6', '取消 API 在产物中可用', () => {
  for (const k of ['createCancelToken', 'canceledError', 'raceWithCancel', 'httpRequest', 'raceFirst', 'wrapExecute']) {
    assert.strictEqual(typeof mod.__debug[k], 'function', `__debug 缺少 ${k}`);
  }
});
rec('B7', '退役 8 源不在产物契约中', () => {
  const retired = ['xinghaiBackup', 'lingchuan', 'gdWy', 'juheKw', 'juheWy', 'juheKg', 'juheMg', 'nianxinVip'];
  for (const id of retired) assert.ok(!(id in mod.SOURCE_HANDLERS), `产物仍含退役源 ${id}`);
});
rec('B8', '产物体积与行数可审计', () => {
  const size = fs.statSync(DIST).size;
  const lines = fs.readFileSync(DIST, 'utf8').split('\n').length;
  assert.ok(size > 100000, `产物过小 ${size}`);
  assert.ok(lines > 1000, `产物行数异常 ${lines}`);
});

console.log(`\nBundle verify: ${pass} passed, ${fail} failed`);
if (require.main === module) process.exit(fail ? 1 : 0);
