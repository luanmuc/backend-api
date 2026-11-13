#!/usr/bin/env node
/**
 * F36/F57 持久化 v2 审计（P1~P8）
 *
 * 覆盖：v2 结构、v1 拒绝、controls-only 不受 sourceVersion 影响、
 * autoOff 6h 复验、无回滚开关、容量/版本拒绝、敏感字段不落盘。
 *
 * 用法：node test/audit/health-persistence-v2.js
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
    request(url, opts, cb) {
      setTimeout(() => cb(Object.assign(new Error('ECONNREFUSED'), { code: 'ECONNREFUSED' }), null), 2)
      return () => {}
    },
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
  try { fn(); passed++; console.log(`✓ [${id}] ${name}`) } catch (e) { failures.push(`${name} — ${e && e.message}`); console.log(`✗ [${id}] ${name} — ${e && e.message}`) }
}
const assert = (c, m) => { if (!c) throw new Error(m) }
const call = (action, info = {}, source = 'kw') => handler({ action, source, info })

check('P1 v2 导出：controls 与健康元数据同包但字段独立', () => {
  const m = fresh()
  const st = m.exportHealthState()
  assert(st.v === 2, `v 应为 2，实际 ${st.v}`)
  assert(st.controls && st.controls.suyinQQ, '缺少 controls')
  assert(st.sources && st.sources.suyinKuwo, '缺少 health sources')
  assert(typeof st.controls.suyinQQ.enabled === 'boolean', 'control.enabled 非法')
  assert(st.controls.suyinQQ.successUrl === undefined, 'controls 不得带 URL')
})

check('P2 v1 完整态必须拒绝', () => {
  const m = fresh()
  const state = m.exportHealthState()
  state.v = 1
  const m2 = fresh()
  const res = m2.restoreHealthState(state)
  assert(res.ok === false, `v1 必须拒绝：${JSON.stringify(res)}`)
})

check('P3 controls-only：sourceVersion 不匹配仍恢复用户意图', () => {
  const m = fresh()
  call('toggle', { id: 'suyinQQ', enabled: false })
  const controls = m.exportHealthState().controls
  const m2 = fresh()
  const controlState = { v: 2, sourceVersion: '0.0.0', savedAt: Date.now(), sources: {}, qualityShortCircuit: {}, controls }
  const res = m2.restoreHealthState(controlState)
  assert(res.ok === true, `controls-only 应成功：${JSON.stringify(res)}`)
  assert(res.controlsRestored > 0, '应返回 controlsRestored')
  assert(m2.getHealthSnapshot().suyinQQ.offReason === 'USER_OFF', '手动关闭必须保留')
})

check('P4 controls-only 不会误恢复健康元数据', () => {
  const m = fresh()
  m.recordFailure('suyinKuwo', 'flac')
  m.recordFailure('suyinKuwo', 'flac')
  const full = m.exportHealthState()
  const m2 = fresh()
  const res = m2.restoreHealthState({ v: 2, sourceVersion: '0.0.0', savedAt: Date.now(), sources: {}, qualityShortCircuit: {}, controls: full.controls })
  assert(res.ok === true && res.restored === 0, 'controls-only 不应恢复 sources')
  assert(m2.__debug.isQualityHopeless('suyinKuwo', 'flac') === false, 'controls-only 不应恢复档位短路')
})

check('P5 autoOff 超过 6h 不复活，保留原因字段', () => {
  const m = fresh()
  const oldAt = Date.now() - 7 * 3600 * 1000
  const res = m.restoreHealthState({ v: 2, sourceVersion: '8.13.1', savedAt: Date.now(), sources: {}, qualityShortCircuit: {}, controls: { suyinQQ: { enabled: true, autoOff: true, autoOffAt: oldAt, autoOffReason: 'AUTO_OFF_PROBE' } } })
  assert(res.ok === true, '旧 autoOff 应可校验通过')
  const snap = m.getHealthSnapshot().suyinQQ
  assert(snap.autoOff !== true, '超过 6h 的 autoOff 不得恢复')
  assert(snap.offReason !== 'AUTO_OFF_PROBE', '过期 autoOff 不应留原因')
})

check('P6 无 v1 回滚开关，始终导出 v2', () => {
  const m = fresh({ healthV2Enabled: false })
  const st = m.exportHealthState()
  assert(st.v === 2, `应始终导出 v2，实际 ${st.v}`)
  assert(st.controls && st.controls.suyinQQ, 'v2 应带 controls')
})

check('P7 版本/未知源/超容量/禁止字段全部拒绝', () => {
  const m = fresh()
  const base = { v: 2, sourceVersion: '8.13.1', savedAt: Date.now(), sources: {}, qualityShortCircuit: {}, controls: { suyinQQ: { enabled: true } } }
  assert(m.restoreHealthState(Object.assign({}, base, { v: 3 })).ok === false, 'v3 应拒绝')
  assert(m.restoreHealthState(Object.assign({}, base, { controls: { notASource: { enabled: true } } })).ok === false, '未知源应拒绝')
  assert(m.restoreHealthState(Object.assign({}, base, { controls: { suyinQQ: { enabled: true, successUrl: 'https://x' } } })).ok === false, '禁止字段应拒绝')
  const big = Object.assign({}, base, { controls: { suyinQQ: { enabled: true, note: 'x'.repeat(300000) } } })
  assert(m.restoreHealthState(big).ok === false, '超容量应拒绝')
})

check('P8 导出不含 URL/歌名/缓存键', () => {
  const m = fresh()
  m.recordSuccess('suyinKuwo', 300, '128k')
  const text = JSON.stringify(m.exportHealthState())
  for (const bad of ['http://', 'https://', 'successUrl', 'songInfo', 'singer', 'failCache', 'name']) {
    assert(!text.includes(bad), `导出含禁止字段 ${bad}`)
  }
})

console.log(`\n${passed} passed, ${failures.length} failed`)
if (failures.length) {
  for (const f of failures) console.log(`- ${f}`)
  process.exit(1)
}
if (require.main === module) process.exit(0)
