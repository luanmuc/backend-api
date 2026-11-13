#!/usr/bin/env node
/**
 * 2.4 方案 · 音源健康事件压力测试（T 组）
 *
 * 覆盖：
 *   T1 10000 条事件后容量 500、dropped=9500、seq 单调
 *   T2 1000 个 traceId 交错后按 trace 过滤正确
 *   T3 limit 边界 0/-1/1/500/1000/NaN/字符串
 *   T4 返回副本不可回写
 *   T5 非法参数不抛
 *   T6 字段白名单（不含歌名/URL）
 *   T7 隐私字段注入被丢弃
 *   T8 不存在的 trace 返回空
 *   T9 1000 次读取吞吐上限
 *
 * 运行：/usr/local/bin/node20 test/audit/t-health-events-stress.js
 */
'use strict';

const path = require('path');
const SRC = path.join(__dirname, '../../lx-source.js');

let current = null;
const setLx = () => {
  globalThis.lx = {
    EVENT_NAMES: { inited: 'inited', request: 'request', updateAlert: 'updateAlert' },
    version: '2.0.0',
    env: 'mobile',
    utils: { buffer: { from: (d, e) => Buffer.from(d, e), bufToString: (b, e) => b.toString(e) } },
    request(url, opts, cb) { setTimeout(() => cb(Object.assign(new Error('ECONNREFUSED'), { code: 'ECONNREFUSED' }), null), 0); },
    on() {},
    send() {},
  };
};
const load = () => {
  if (require.cache[require.resolve(SRC)]) delete require.cache[require.resolve(SRC)];
  return require(SRC);
};
const fresh = () => { setLx(); current = load(); return current; };

const res = [];
const rec = (id, name, ok, detail) => {
  res.push({ id, ok: !!ok, name, detail: String(detail || '') });
  console.log(`${ok ? '✓' : '✗'} [${id}] ${name}${detail ? ' — ' + String(detail).slice(0, 200) : ''}`);
};
const allowedKeys = ['seq', 'eventId', 'ts', 'traceId', 'event', 'sourceId', 'platform', 'quality', 'ok', 'code', 'latencyMs', 'reason'];

(async () => {
  globalThis.__lxSourceConfig = { rateWindowMax: 100000, maxConcurrency: 100000, rateWindowMs: 3600000 };
  fresh();
  const dbg = current.__debug;
  if (!dbg || typeof dbg.recordHealthEvent !== 'function' || typeof dbg.getHealthEvents !== 'function') {
    console.log('✗ [T0] __debug 未暴露 recordHealthEvent/getHealthEvents');
    process.exit(1);
  }

  const t0 = Date.now();
  for (let i = 0; i < 10000; i++) {
    dbg.recordHealthEvent({
      traceId: `trace-${i % 1000}`,
      event: i % 3 === 0 ? 'source_attempt' : 'source_result',
      sourceId: `s-${i % 5}`,
      platform: ['kw', 'wy', 'tx', 'kg', 'mg'][i % 5],
      quality: ['128k', '320k', 'flac'][i % 3],
      ok: i % 2 === 0,
      code: i % 2 === 0 ? '' : 'SERVER_ERROR',
      latencyMs: i % 300,
      name: 'SECRET_SONG',
      url: 'https://secret.example/a.mp3',
      account: 'SECRET_USER',
    });
  }
  const writeMs = Date.now() - t0;

  const all = dbg.getHealthEvents({});
  rec('T1', '容量为 500', all.capacity === 500 && all.events.length === 500, `cap=${all.capacity} len=${all.events.length}`);
  rec('T1', 'dropped=9500', all.dropped === 9500, `dropped=${all.dropped}`);
  rec('T1', 'seq 单调且最大=10000', all.events[all.events.length - 1].seq === 10000 && all.events.every((e, i, a) => i === 0 || e.seq > a[i - 1].seq), `first=${all.events[0].seq} last=${all.events[all.events.length - 1].seq}`);
  rec('T1', '10000 次写入 ≤ 3000ms', writeMs <= 3000, `${writeMs}ms`);

  for (const ev of ['play_start', 'source_attempt', 'source_result']) {
    dbg.recordHealthEvent({ traceId: 'chain-x', event: ev, sourceId: 's-0', platform: 'kw', quality: '128k', ok: ev === 'source_result', code: ev === 'source_result' ? '' : undefined, latencyMs: 12 });
  }
  const chain = dbg.getHealthEvents({ traceId: 'chain-x' });
  rec('T2', '同 traceId 串起 play_start→attempt→result', chain.events.length === 3 && chain.events.map(e => e.event).join('>') === 'play_start>source_attempt>source_result', `len=${chain.events.length} chain=${chain.events.map(e => e.event).join('>')}`);

  const limits = [0, -1, 1, 500, 1000, NaN, 'abc'];
  const expected = [500, 1, 1, 500, 500, 500, 500];
  let okLimit = true;
  const got = [];
  for (const [i, n] of limits.entries()) {
    let r;
    try { r = dbg.getHealthEvents({ limit: n }); } catch (e) { okLimit = false; got.push('throw'); continue; }
    got.push(r.events.length);
    if (r.events.length !== expected[i]) okLimit = false;
  }
  rec('T3', 'limit 边界全部钳到 1..500', okLimit, got.join(','));

  const a = dbg.getHealthEvents({});
  const original = a.events[0].event;
  a.events[0].event = 'MUTATED';
  const b = dbg.getHealthEvents({});
  rec('T4', '外部改动不回写', b.events[0].event === original, `${original} → ${b.events[0].event}`);

  let noThrow = true;
  for (const bad of [null, undefined, 0, 'x', [], { limit: {} }]) {
    try { dbg.getHealthEvents(bad); } catch (e) { noThrow = false; }
  }
  rec('T5', '非法参数不抛', noThrow, 'null/undefined/0/string/array/object');

  const keySet = new Set(Object.keys(all.events[0]));
  const extra = [...keySet].filter(k => !allowedKeys.includes(k));
  rec('T6', '事件字段仅白名单 11 键', extra.length === 0, `keys=${[...keySet].join(',')}`);

  const leaked = all.events.some(e => JSON.stringify(e).includes('SECRET_SONG') || JSON.stringify(e).includes('secret.example') || JSON.stringify(e).includes('SECRET_USER'));
  rec('T7', '歌名/URL/账号被丢弃', !leaked, `leaked=${leaked}`);

  const none = dbg.getHealthEvents({ traceId: 'trace-not-exist' });
  rec('T8', '不存在 trace 返回空', none.events.length === 0, `len=${none.events.length}`);

  const t1 = Date.now();
  for (let i = 0; i < 1000; i++) dbg.getHealthEvents({ limit: 500 });
  const readMs = Date.now() - t1;
  rec('T9', '1000 次读取 ≤ 1000ms', readMs <= 1000, `${readMs}ms`);

  const failed = res.filter(x => !x.ok);
  console.log(`\n===== T 组压力汇总：${res.length - failed.length} 通过 / ${failed.length} 失败 =====`);
  if (failed.length) {
    console.log('失败项：');
    for (const f of failed) console.log(`  - [${f.id}] ${f.name} — ${f.detail}`);
    process.exit(1);
  }
  process.exit(0);
})().catch(e => {
  console.error('压力脚本自身异常：', e);
  process.exit(1);
});
