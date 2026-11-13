#!/usr/bin/env node
/**
 * F33 状态迁移事件审计（U1~U7）
 *
 * 覆盖：transition 字段完整、状态枚举、500 环内优先保留 transition、
 * probe 可压缩、重复通过不刷 transition、事件无敏感字段。
 *
 * 用法：node test/audit/health-transition-events.js
 */
'use strict'

const path = require('path')
const SRC = path.join(__dirname, '../../lx-source.js')
let handler = null

const setLx = () => {
  handler = null
  globalThis.lx = {
    EVENT_NAMES: { inited: 'inited', request: 'request', updateAlert: 'updateAlert' },
    version: '2.0.0',
    env: 'mobile',
    utils: { buffer: { from: (d, e) => Buffer.from(d, e), bufToString: (b, e) => b.toString(e) } },
    request(url, opts, cb) { setTimeout(() => cb(Object.assign(new Error('ECONNREFUSED'), { code: 'ECONNREFUSED' }), null), 2); return () => {} },
    on(n, h) { if (n === 'request') handler = h },
    send() {},
  }
}
const fresh = (cfg = {}) => {
  setLx()
  globalThis.__lxSourceConfig = Object.assign({}, cfg)
  const p = require.resolve(SRC)
  if (require.cache[p]) delete require.cache[p]
  return require(SRC)
}

let passed = 0
const failures = []
const check = (name, fn) => {
  const id = (String(name).match(/^[A-Za-z]+\d+[a-z]?/) || [String(name)])[0]
  try { fn(); passed++; console.log(`✓ [${id}] ${name}`) } catch (e) { failures.push(`${name} — ${e.message}`); console.log(`✗ [${id}] ${name} — ${e.message}`) }
}
const assert = (c, m) => { if (!c) throw new Error(m) }
const eventsOf = m => m.__debug.getHealthEvents({}).events

check('U1 transition 必带 sourceId/from/to/reason', () => {
  const m = fresh()
  m.applyProbeResult('suyinKuwo', false, { outcome: 'FAIL' })
  m.applyProbeResult('suyinKuwo', false, { outcome: 'FAIL' })
  const ev = eventsOf(m).find(e => e.event === 'health_transition')
  assert(ev, '连续两次 FAIL 应产生 transition')
  for (const k of ['sourceId', 'from', 'to', 'reason']) assert(ev[k], `transition 缺字段 ${k}`)
})

check('U2 transition 状态只使用已知枚举', () => {
  const m = fresh()
  m.applyProbeResult('suyinKuwo', false, { outcome: 'FAIL' })
  m.applyProbeResult('suyinKuwo', false, { outcome: 'FAIL' })
  m.applyProbeResult('suyinKuwo', false, { outcome: 'FAIL' })
  const known = new Set(['ELIGIBLE', 'AUTO_OFF', 'SLEEPING', 'PLAY_DEAD'])
  for (const ev of eventsOf(m).filter(e => e.event === 'health_transition')) {
    assert(known.has(ev.from) && known.has(ev.to), `未知状态 ${ev.from}->${ev.to}`)
  }
})

check('U3 500 条环内 transition 不被 probe 洪水挤掉', () => {
  const m = fresh()
  m.applyProbeResult('suyinKuwo', false, { outcome: 'FAIL' })
  m.applyProbeResult('suyinKuwo', false, { outcome: 'FAIL' })
  assert(eventsOf(m).some(e => e.event === 'health_transition'), '构造 transition 失败')
  for (let i = 0; i < 600; i++) m.__debug.recordHealthEvent({ event: 'probe_result', sourceId: 'suyinKuwo', quality: '128k', ok: false, code: 'PROBE_FAIL', latencyMs: i })
  assert(eventsOf(m).some(e => e.event === 'health_transition'), 'transition 被 probe 洪水挤掉')
  assert(eventsOf(m).length === 500, `环容量应为 500，实际 ${eventsOf(m).length}`)
})

check('U4 溢出时 dropped 递增且只压 probe', () => {
  const m = fresh()
  m.__debug.recordHealthEvent({ event: 'health_transition', sourceId: 'suyinKuwo', from: 'ELIGIBLE', to: 'AUTO_OFF', reason: 'auto_off_probe' })
  for (let i = 0; i < 600; i++) m.__debug.recordHealthEvent({ event: 'probe_result', sourceId: 'suyinKuwo', ok: true, code: '' })
  const res = m.__debug.getHealthEvents({})
  assert(res.dropped >= 100, `dropped 应递增，实际 ${res.dropped}`)
  assert(res.events.filter(e => e.event === 'health_transition').length >= 1, 'transition 不应被压掉')
})

check('U5 连续 PASS 只在恢复时发一次 auto_on', () => {
  const m = fresh()
  m.applyProbeResult('suyinKuwo', false, { outcome: 'FAIL' })
  m.applyProbeResult('suyinKuwo', false, { outcome: 'FAIL' })
  for (let i = 0; i < 5; i++) m.applyProbeResult('suyinKuwo', true, { outcome: 'PASS' })
  const on = eventsOf(m).filter(e => e.event === 'health_transition' && e.reason === 'auto_on_probe')
  assert(on.length === 1, `auto_on 应只发一次，实际 ${on.length}`)
})

check('U6 transition 不携带 URL/歌名/账号', () => {
  const m = fresh()
  m.applyProbeResult('suyinKuwo', false, { outcome: 'FAIL', url: 'https://cdn.test/a.mp3', songName: '晴天', account: 'u1' })
  m.applyProbeResult('suyinKuwo', false, { outcome: 'FAIL', url: 'https://cdn.test/a.mp3', songName: '晴天', account: 'u1' })
  const text = JSON.stringify(eventsOf(m).filter(e => e.event === 'health_transition'))
  for (const bad of ['cdn.test', '晴天', 'u1', 'url', 'songName', 'account']) assert(!text.includes(bad), `transition 含敏感字段 ${bad}`)
})

check('U7 事件环容量恒为 500，不因优先级突破上限', () => {
  const m = fresh()
  for (let i = 0; i < 501; i++) m.__debug.recordHealthEvent({ event: i % 2 ? 'health_transition' : 'probe_result', sourceId: 'suyinKuwo', from: 'ELIGIBLE', to: 'AUTO_OFF', reason: 'bulk' })
  assert(eventsOf(m).length === 500, `事件环应封顶 500，实际 ${eventsOf(m).length}`)
})

console.log(`\n${passed} passed, ${failures.length} failed`)
if (failures.length) {
  for (const f of failures) console.log(`- ${f}`)
  process.exit(1)
}
if (require.main === module) process.exit(0)
