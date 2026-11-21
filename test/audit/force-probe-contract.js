#!/usr/bin/env node
/**
 * R71：forceQualityProbe action 契约门禁（10 条）。
 *
 * 【为什么需要】
 * K07 的强制探路原本对未知源 `reject(PARAM_ERROR: unknown source id)`。
 * R71 改成 resolve `{ok:false}`：业务否定不该用 reject 表达；而且只有走到 resolve 分支，
 * `34-breaker-state` 里那道 `if (!SOURCE_HANDLERS[id]) return false` 守卫才被执行到
 * （reject 在调用之前就返回了，守卫是死代码）。
 * R71d 再补显式 code=UNSUPPORTED_ACTION：此前语义靠「返回值里没有 error 字段」承载，
 * 任何人给这里补个 error 就会让上层归因翻转。现在由码值明说，App 侧白名单识别。
 *
 * 【判据】
 * FP1  已知源 resolve `{ok:true, id, quality}`
 * FP2  写入的 qualitySkipProbeAt 值 = 调用时刻（立即到期语义，不是 now+probeMs）
 * FP3  不动 breakerMap（强制探路只解除短路，不碰熔断）
 * FP4  未知源 resolve `{ok:false, code:UNSUPPORTED_ACTION, reason:UNKNOWN_SOURCE}`
 * FP5  未知源不 reject（否则 breaker-state 守卫不会被执行，且业务否定被当成协议错误）
 * FP6  未知源不写 qualitySkipProbeAt
 * FP7  缺 id reject `PARAM_ERROR: missing source id`
 * FP8  缺 id 不写状态
 * FP9  无 quality 默认 flac
 * FP10 `FLAC` 归一化为 flac
 *
 * 全程 mock 宿主，不联网；只读 `lx-source.js` 产物，不重建。
 */
const path = require('path');

const SRC = path.resolve(__dirname, '..', '..', 'lx-source.js');
let handler = null;

// M9：process.exit 只出现在这个 helper 体内（被静态检查豁免），调用点用 __exit。
function __exit(code) {
  process.exit(code);
}

function installHost() {
  handler = null;
  globalThis.lx = {
    EVENT_NAMES: { request: 'request' },
    version: '2.0.0',
    env: 'mobile',
    utils: { buffer: { from: (d, e) => Buffer.from(d, e), bufToString: (b, e) => b.toString(e) } },
    request(url, opts, cb) {
      setTimeout(() => cb(Object.assign(new Error('ECONNREFUSED'), { code: 'ECONNREFUSED' }), null), 2);
      return () => {};
    },
    on(n, h) { if (n === 'request') handler = h }, send() {},
  };
  globalThis.__lxSourceConfig = { healthCheckIntervalMs: 3600000, coldStartWarmEnabled: false };
}

async function run() {
  installHost();
  const p = require.resolve(SRC);
  if (require.cache[p]) delete require.cache[p];
  const m = require(SRC);
  const d = m.__debug;
  const call = info => handler({ source: 'kw', action: 'forceQualityProbe', info });
  const keyOf = q => [...d.qualitySkipProbeAt.keys()].find(k => k.includes('suyinKuwo') && k.includes(q));

  let pass = 0;
  const fails = [];
  const ok = (id, name, fn) => {
    try { fn(); pass++; console.log('[' + id + '] ' + name); } catch (e) { fails.push(id + ' ' + name + ' — ' + (e && e.message)); }
  };
  const eq = (a, b, what) => { if (a !== b) throw new Error(what + ' 期望 ' + JSON.stringify(b) + ' 实际 ' + JSON.stringify(a)); };

  const breaker0 = d.breakerMap.size;
  const t0 = Date.now();
  const a1 = await call({ id: 'suyinKuwo', quality: 'flac' });

  ok('FP1', '已知源 resolve {ok:true, id, quality}', () => {
    eq(a1.ok, true, 'ok'); eq(a1.id, 'suyinKuwo', 'id'); eq(a1.quality, 'flac', 'quality');
  });
  ok('FP2', 'qualitySkipProbeAt 写入调用时刻（立即到期，不是 now+probeMs）', () => {
    const key = keyOf('flac');
    if (!key) throw new Error('未找到 suyinKuwo/flac 键，现有 ' + JSON.stringify([...d.qualitySkipProbeAt.keys()]));
    const at = d.qualitySkipProbeAt.get(key);
    if (typeof at !== 'number') throw new Error('值非数字 ' + at);
    if (at < t0) throw new Error('写入值不得早于采集时刻 ' + at + ' < ' + t0);
    if (at - t0 > 5000) throw new Error('写入值偏离调用时刻过大 ' + (at - t0) + 'ms');
  });
  ok('FP3', '不动 breakerMap', () => { eq(d.breakerMap.size, breaker0, 'breakerMap.size'); });

  const sizeBefore = d.qualitySkipProbeAt.size;
  const a2 = await call({ id: '__nope__', quality: 'flac' }).then(v => ({ resolved: v }), e => ({ rejected: e.message }));
  ok('FP4', '未知源 resolve {ok:false, code:UNSUPPORTED_ACTION, reason:UNKNOWN_SOURCE}', () => {
    if (a2.rejected) throw new Error('不应 reject，实际 reject：' + a2.rejected);
    eq(a2.resolved.ok, false, 'ok');
    eq(a2.resolved.code, 'UNSUPPORTED_ACTION', 'code');
    eq(a2.resolved.reason, 'UNKNOWN_SOURCE', 'reason');
  });
  ok('FP5', '未知源不 reject（breaker-state 守卫可达，且业务否定不被当协议错误）', () => {
    if (!a2.resolved) throw new Error('实际走了 reject 分支');
  });
  ok('FP6', '未知源不写 qualitySkipProbeAt', () => { eq(d.qualitySkipProbeAt.size, sizeBefore, 'size'); });

  const sizeAfterA2 = d.qualitySkipProbeAt.size;
  const a3 = await call({}).then(v => ({ resolved: v }), e => ({ rejected: e.message }));
  ok('FP7', '缺 id reject PARAM_ERROR: missing source id', () => {
    eq(a3.rejected, 'PARAM_ERROR: missing source id', 'reject message');
  });
  ok('FP8', '缺 id 不写状态', () => { eq(d.qualitySkipProbeAt.size, sizeAfterA2, 'size'); });

  const a4 = await call({ id: 'suyinKuwo' });
  ok('FP9', '无 quality 默认 flac', () => { eq(a4.ok, true, 'ok'); eq(a4.quality, 'flac', 'quality'); });

  const a5 = await call({ id: 'suyinKuwo', quality: 'FLAC' });
  ok('FP10', '大写 FLAC 归一化为 flac', () => { eq(a5.ok, true, 'ok'); eq(a5.quality, 'flac', 'quality'); });

  console.log('[FP] forceQualityProbe 契约：' + pass + ' 通过 / ' + fails.length + ' 失败（共 10 条）');
  fails.forEach(f => console.log('[FP] ✗ ' + f));
  return fails.length ? 1 : 0;
}

module.exports = { run };

// M9：被别的脚本 require 时不得直接退出进程，只有直接运行才设置退出码
if (require.main === module) {
  // 源仓加载后会启动健康探测定时器，只设 exitCode 进程不会退；这里必须显式结束，
  // 且该调用被 require.main 守卫包住（M9 合规）。
  run().then(code => { __exit(code) }).catch(e => {
    console.log('[FP] ✗ 脚本异常：' + String(e && e.message).slice(0, 100));
    __exit(1);
  });
}
