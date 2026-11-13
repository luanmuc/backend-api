#!/usr/bin/env node
/**
 * v8.13 真取消审计（Z1~Z10）
 * 覆盖：取消原语、HTTP 取消、竞速落败取消、10 个上链 handler 的编排层取消。
 */
const assert = require('assert');
const path = require('path');

const SRC = path.join(__dirname, '..', '..', 'lx-source.js');
let requestCalls = 0;
let hostCancels = 0;
globalThis.lx = {
  EVENT_NAMES: { inited: 'inited', request: 'request', updateAlert: 'updateAlert' },
  version: '1.2.0', env: {},
  utils: { buffer: { from: (d, e) => Buffer.from(d, e), bufToString: (b, e) => b.toString(e) } },
  request(url, opts, cb) {
    requestCalls++;
    // 永不回调：用于验证取消后不再等待底层；返回宿主取消句柄
    return () => { hostCancels++; };
  },
  on: () => {}, send: () => {},
};
const mod = require(SRC);
const dbg = mod.__debug;

let pass = 0, fail = 0;
async function rec(id, name, fn) {
  try { await fn(); console.log(`✅ ${id} ${name}`); pass++; }
  catch (e) { console.log(`❌ ${id} ${name}\n   ${e.message}`); fail++; }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const isCanceled = e => !!e && (e.canceled === true || e.code === mod.ERROR_CODES.CANCELED);
const baseSong = { name: '晴天', singer: '周杰伦', duration: 269, songmid: '0039MnYb0qxYpD', rid: 228908, id: '228908', source: 'kw' };

(async () => {
  await rec('Z1', 'createCancelToken/canceledError 语义', () => {
    const t = dbg.createCancelToken();
    assert.strictEqual(t.canceled, false);
    t.cancel('test');
    assert.strictEqual(t.canceled, true);
    assert.strictEqual(t.reason, 'test');
    const e = dbg.canceledError(t.reason);
    assert.strictEqual(e.code, mod.ERROR_CODES.CANCELED);
    assert.strictEqual(e.canceled, true);
  });
  await rec('Z2', 'throwIfCanceled 已取消立即抛 CANCELED', () => {
    const t = dbg.createCancelToken();
    t.cancel('pre');
    assert.throws(() => dbg.throwIfCanceled(t), e => isCanceled(e));
    dbg.throwIfCanceled(dbg.createCancelToken()); // 未取消不抛
  });
  await rec('Z3', 'raceWithCancel 取消后立刻拒绝，不等底层', async () => {
    const t = dbg.createCancelToken();
    let resolved = false;
    const slow = new Promise(r => setTimeout(() => { resolved = true; r('late'); }, 80));
    const p = dbg.raceWithCancel(slow, t);
    setTimeout(() => t.cancel('user'), 5);
    const start = Date.now();
    await assert.rejects(p, e => isCanceled(e));
    assert.ok(Date.now() - start < 60, '取消等待过久');
    await sleep(100);
    assert.strictEqual(resolved, true, '底层 promise 不应被强行中断，但结果必须被丢弃');
  });
  await rec('Z4', 'httpRequest 预取消不发请求', async () => {
    const before = requestCalls;
    const t = dbg.createCancelToken();
    t.cancel('pre');
    await assert.rejects(dbg.httpRequest('https://example.com/a.mp3', { cancelToken: t }), e => isCanceled(e));
    assert.strictEqual(requestCalls, before, '预取消仍发出了请求');
  });
  await rec('Z5', 'httpRequest 请求中取消立刻拒绝并调用宿主取消句柄', async () => {
    const t = dbg.createCancelToken();
    const p = dbg.httpRequest('https://example.com/slow.mp3', { cancelToken: t });
    setTimeout(() => t.cancel('user'), 5);
    const start = Date.now();
    await assert.rejects(p, e => isCanceled(e));
    assert.ok(Date.now() - start < 60, 'HTTP 取消等待过久');
    assert.ok(hostCancels >= 1, '未调用宿主 lx.request 返回的取消句柄');
  });
  await rec('Z6', 'raceFirst 胜者触发落败 token 取消', async () => {
    let loserCanceled = false;
    const launchers = [
      { handler: { id: 'fakeA', verified: true }, run: () => Promise.resolve({ url: 'https://example.com/a.mp3', source: 'fakeA' }) },
      { handler: { id: 'fakeB', verified: false }, run: (token) => new Promise((resolve, reject) => {
        token.onCancel(() => { loserCanceled = true; reject(dbg.canceledError('race_winner')); });
      }) },
    ];
    const res = await dbg.raceFirst(launchers, { batchSize: 2, matchWaitMs: 0, deadline: Date.now() + 1000 });
    assert.ok(res.url.includes('a.mp3'));
    await sleep(20);
    assert.strictEqual(loserCanceled, true, '落败 launcher 未收到取消');
  });
  await rec('Z7', 'raceFirst 预算失败取消全部已启动 launcher', async () => {
    let canceled = 0;
    const mk = (id) => ({ handler: { id, verified: false }, run: (token) => new Promise((resolve, reject) => {
      token.onCancel(() => { canceled++; reject(dbg.canceledError('race_failed')); });
    }) });
    await assert.rejects(dbg.raceFirst([mk('x'), mk('y')], { batchSize: 2, deadline: Date.now() + 40 }), e => { assert.ok(e, '预算失败必须 reject'); return true; });
    await sleep(20);
    assert.strictEqual(canceled, 2, `应取消 2 个，实际 ${canceled}`);
  });
  await rec('Z8', '10 个上链 handler 预取消均不调用 fn', async () => {
    const active = mod.PROVIDER_CONTRACT && Object.keys(mod.SOURCE_HANDLERS).filter(id => mod.SOURCE_HANDLERS[id].lifecycle === 'active');
    assert.strictEqual(active.length, 10);
    let invoked = 0;
    for (const id of active) {
      const real = mod.SOURCE_HANDLERS[id];
      const t = dbg.createCancelToken();
      t.cancel(`pre:${id}`);
      const fake = Object.assign({}, real, { fn: () => { invoked++; return Promise.resolve('https://example.com/x.mp3'); } });
      await assert.rejects(dbg.wrapExecute(fake, 'kw', baseSong, '128k', t), e => isCanceled(e));
    }
    assert.strictEqual(invoked, 0, '取消后仍调用了源函数');
  });
  await rec('Z9', '取消后 handler 迟到返回不记账、不验真', async () => {
    let fnResolved = false;
    const id = 'cancel-sentinel';
    const handler = { id, name: '取消哨兵', maxQuality: '128k', qualitys: ['128k'], platforms: ['kw'], upstreamGroup: id, auth: 'none', lifecycle: 'active', chain: { kw: 1 }, fn: async () => {
      await sleep(60);
      fnResolved = true;
      return 'https://example.com/late.flac';
    } };
    const t = dbg.createCancelToken();
    const p = dbg.wrapExecute(handler, 'kw', baseSong, '128k', t);
    setTimeout(() => t.cancel('user'), 10);
    await assert.rejects(p, e => isCanceled(e));
    await sleep(90);
    assert.strictEqual(fnResolved, true, '底层 handler 未自然结束');
    const b = mod.getBreaker(id);
    assert.strictEqual(b.realSuccess || 0, 0, '取消后被记成功');
    assert.strictEqual(b.failureCount || 0, 0, '取消后被记失败');
  });
  await rec('Z11', '真实上链 handler 请求中取消会调用宿主取消句柄', async () => {
    const before = hostCancels;
    const t = dbg.createCancelToken();
    const p = dbg.wrapExecute(mod.SOURCE_HANDLERS.suyinKuwo, 'kw', baseSong, '128k', t);
    setTimeout(() => t.cancel('user'), 10);
    await assert.rejects(p, e => isCanceled(e));
    await sleep(20);
    assert.ok(hostCancels > before, 'handler 链未把取消令牌传到 httpRequest 的宿主取消句柄');
  });
  await rec('Z10', '取消不污染真实上链源熔断/失败计数', async () => {
    const id = 'suyinKuwo';
    const b0 = mod.getBreaker(id);
    const before = { failureCount: b0.failureCount || 0, realReq: b0.realReq || 0 };
    const t = dbg.createCancelToken();
    t.cancel('pre');
    await assert.rejects(dbg.wrapExecute(mod.SOURCE_HANDLERS[id], 'kw', baseSong, '128k', t), e => isCanceled(e));
    const b1 = mod.getBreaker(id);
    assert.strictEqual(b1.failureCount || 0, before.failureCount, '取消污染 failureCount');
    assert.strictEqual(b1.realReq || 0, before.realReq, '取消污染 realReq');
  });

  console.log(`\nCancel: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
