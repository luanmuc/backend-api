#!/usr/bin/env node
/**
 * F21 探测调度审计（N 组）
 *
 * N1 jitter 边界：±10%，可注入 rand 做确定断言；
 * N2 播放/取链流量在途时必须暂停自动探测。
 */
'use strict'

const path = require('path')
const SRC = path.join(__dirname, '../../lx-source.js')
globalThis.lx = {
  EVENT_NAMES: { inited: 'inited', request: 'request', updateAlert: 'updateAlert' },
  version: '2.0.0',
  env: 'mobile',
  utils: { buffer: { from: (d, e) => Buffer.from(d, e), bufToString: (b, e) => b.toString(e) } },
  request(url, opts, cb) { setTimeout(() => cb(new Error('ECONNREFUSED'), null), 2); return () => {} },
  on() {},
  send() {},
}
globalThis.__lxSourceConfig = { logDebug: false }
const m = require(SRC)
const d = m.__debug
const IV = 600000

const assert = (cond, msg) => { if (!cond) throw new Error(msg) }
let passed = 0
const failures = []
const check = (id, name, fn) => {
  try { fn(); passed++; console.log(`✓ ${id} ${name}`) } catch (e) { failures.push(`[${id}] ${name} — ${e.message}`); console.log(`✗ ${id} ${name} — ${e.message}`) }
}

check('N1', '健康探测间隔带 ±10% jitter，且不会低于 1s（F21）', () => {
  assert(d.nextHealthCheckDelay(IV, () => 0) === 540000, `rand=0 应 540000，实际 ${d.nextHealthCheckDelay(IV, () => 0)}`)
  assert(d.nextHealthCheckDelay(IV, () => 0.5) === 600000, `rand=0.5 应 600000`)
  assert(d.nextHealthCheckDelay(IV, () => 0.999999) === 660000, `rand≈1 应 660000，实际 ${d.nextHealthCheckDelay(IV, () => 0.999999)}`)
  for (let i = 0; i < 200; i++) {
    const v = d.nextHealthCheckDelay(IV)
    assert(v >= 540000 && v <= 660000, `jitter 越界: ${v}`)
  }
})

check('N2', '有播放/取链流量在途时判定为忙，探测应暂停（F21）', () => {
  d.inflightCount.clear()
  d.inflightUrl.clear()
  assert(d.hasActiveWork() === false, '空闲时不应为忙')
  d.inflightCount.set('suyinKuwo', 1)
  assert(d.hasActiveWork() === true, '取链在途时应为忙')
  d.inflightCount.clear()
  d.inflightUrl.set('kw|1|128k', { task: true })
  assert(d.hasActiveWork() === true, '同歌合并任务在途时应为忙')
  d.inflightUrl.clear()
  assert(d.hasActiveWork() === false, '清空后应恢复空闲')
})

console.log(`\n===== N 组汇总：${passed} 通过 / ${failures.length} 失败 =====`)
if (failures.length) { for (const f of failures) console.error(f); process.exit(1) }
process.exit(0)
