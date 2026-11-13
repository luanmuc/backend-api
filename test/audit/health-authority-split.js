#!/usr/bin/env node
/**
 * Batch 1 开关权威拆分（A1~A9）
 *
 * 目标：userEnabled / manualOff / autoOff / effectiveEnabled 分层；
 * 生产态只有 userEnabled/autoOff 权威；runtimeToggles 仅测试夹具；toggle 只写用户，probe 只写 auto；
 * 快照必须给 offReason/offAt；重启保留手动关闭；UNKNOWN 不自动关源。
 *
 * 用法：node test/audit/health-authority-split.js
 */
'use strict'
const path = require('path')
const SRC = path.join(__dirname, '../../lx-source.js')
const setLx = () => {
  globalThis.lx = {
    EVENT_NAMES: { inited: 'inited', request: 'request', updateAlert: 'updateAlert' },
    version: '2.0.0', env: 'mobile',
    utils: { buffer: { from: (d, e) => Buffer.from(d, e), bufToString: (b, e) => b.toString(e) } },
    request(url, opts, cb) { setTimeout(() => cb(Object.assign(new Error('ECONNREFUSED'), { code: 'ECONNREFUSED' }), null), 2); return () => {} },
    on() {}, send() {},
  }
}
const fresh = () => {
  setLx(); globalThis.__lxSourceConfig = {}
  const p = require.resolve(SRC)
  if (require.cache[p]) delete require.cache[p]
  return require(SRC)
}
let passed = 0
const failures = []
const check = (name, fn) => {
  try { fn(); passed++; console.log(`✓ ${name}`) } catch (e) { failures.push(`${name} — ${e.message}`); console.log(`✗ ${name} — ${e.message}`) }
}
const assert = (c, m) => { if (!c) throw new Error(m) }
const snap = (m, id) => m.__debug.getHealthSnapshot()[id]
const ID = 'suyinKuwo'

check('A1 手动关闭：只写 userEnabled/manualOff，快照 USER_OFF', () => {
  const m = fresh()
  m.__debug.toggleSource(ID, false)
  const s = snap(m, ID)
  assert(s.enabled === false && s.userEnabled === false, `开关未落：${s.enabled}/${s.userEnabled}`)
  assert(s.offReason === 'USER_OFF', `offReason=${s.offReason}`)
  assert(s.autoOff === false, '手动关闭不得写成 autoOff')
})

check('A2 用户关闭后探测通过不能自动开', () => {
  const m = fresh()
  m.__debug.toggleSource(ID, false)
  for (let i = 0; i < 4; i++) m.applyProbeResult(ID, true, { outcome: 'PASS' })
  const s = snap(m, ID)
  assert(s.enabled === false && s.userEnabled === false && s.offReason === 'USER_OFF', JSON.stringify({ enabled: s.enabled, userEnabled: s.userEnabled, offReason: s.offReason }))
})

check('A3 连续 FAIL 自动关源：userEnabled 不变，autoOff/offReason 同源', () => {
  const m = fresh()
  for (let i = 0; i < 2; i++) m.applyProbeResult(ID, false, { outcome: 'FAIL' })
  const s = snap(m, ID)
  assert(s.userEnabled === true && s.autoOff === true && s.enabled === false, JSON.stringify({ userEnabled: s.userEnabled, autoOff: s.autoOff, enabled: s.enabled }))
  assert(s.offReason === 'AUTO_OFF_PROBE', `offReason=${s.offReason}`)
})

check('A4 自动关闭后连续 PASS 自动恢复，userEnabled 仍为真', () => {
  const m = fresh()
  for (let i = 0; i < 2; i++) m.applyProbeResult(ID, false, { outcome: 'FAIL' })
  for (let i = 0; i < 2; i++) m.applyProbeResult(ID, true, { outcome: 'PASS' })
  const s = snap(m, ID)
  assert(s.enabled === true && s.userEnabled === true && s.autoOff === false, JSON.stringify({ enabled: s.enabled, userEnabled: s.userEnabled, autoOff: s.autoOff }))
  assert(s.offReason === null, `恢复后 offReason=${s.offReason}`)
})

check('A5 UNKNOWN 不自动关源、不计失败', () => {
  const m = fresh()
  for (let i = 0; i < 3; i++) m.applyProbeResult(ID, false, { outcome: 'UNKNOWN' })
  const s = snap(m, ID)
  assert(s.enabled === true && s.autoOff === false, JSON.stringify({ enabled: s.enabled, autoOff: s.autoOff }))
})

check('A6 手动关闭随 controls 导出/恢复保留', () => {
  const m = fresh()
  m.__debug.toggleSource(ID, false)
  const exported = m.exportHealthState()
  assert(exported.controls[ID].enabled === false && exported.controls[ID].manualOff === true, JSON.stringify(exported.controls[ID]))
  m.__debug.toggleSource(ID, true)
  assert(snap(m, ID).offReason === null, '恢复前应已开启')
  const r = m.restoreHealthState(exported)
  assert(r.ok === true, `restore 失败：${r.reason}`)
  const s = snap(m, ID)
  assert(s.userEnabled === false && s.offReason === 'USER_OFF', JSON.stringify({ userEnabled: s.userEnabled, offReason: s.offReason }))
  assert(s.offAt > 0, `恢复后手动关闭 offAt=${s.offAt}`)
})

check('A7 默认关闭与休眠 offReason 可区分', () => {
  const m = fresh()
  const def = snap(m, 'suyinQQ')
  assert(def.offReason === 'DEFAULT_OFF', `默认关闭 offReason=${def.offReason}`)
  m.probeState.sleeping[ID] = true
  const sl = snap(m, ID)
  assert(sl.offReason === 'SLEEPING', `休眠 offReason=${sl.offReason}`)
})

check('A8 offAt 与 offReason 同源：手动/自动/默认', () => {
  const m = fresh()
  m.__debug.toggleSource(ID, false)
  const manual = snap(m, ID)
  assert(manual.offAt > 0, `手动关闭 offAt=${manual.offAt}`)
  const m2 = fresh()
  for (let i = 0; i < 2; i++) m2.applyProbeResult(ID, false, { outcome: 'FAIL' })
  const auto = snap(m2, ID)
  assert(auto.offAt > 0 && auto.offAt === auto.autoOffAt, `自动关闭 offAt=${auto.offAt}/${auto.autoOffAt}`)
  const m3 = fresh()
  assert(snap(m3, 'suyinQQ').offAt === 0, '默认关闭不应伪造 offAt')
})

check('A9 runtimeToggles 只是测试夹具，不构成生产第二套开关', () => {
  const m = fresh()
  m.runtimeToggles[ID] = false
  const s = snap(m, ID)
  assert(s.userEnabled === false, '夹具关闭应写回唯一权威 userEnabled')
  assert(s.offReason === 'DEFAULT_OFF', `夹具关闭应解释为默认关闭，实际 ${s.offReason}`)
})

console.log(`\n${passed} passed, ${failures.length} failed`)
if (failures.length) { console.log(failures.join('\n')); process.exit(1) }
process.exit(0)
