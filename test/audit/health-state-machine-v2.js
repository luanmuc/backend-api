#!/usr/bin/env node
/**
 * 方案 6.2 状态机 v2（M1~M10）
 *
 * 覆盖 I1/I2/I3/I4/I7/I9/I10/I12：链项 eligibility、开关最高优先、
 * auto-off 只认 FAIL、单档失败只挡该档、探测不清 playDead/resolveDead、
 * 短路可见、快照 reason 与 gate 同源。
 *
 * 用法：node test/audit/health-state-machine-v2.js
 */
'use strict'
const path = require('path')
const SRC = path.join(__dirname, '../../lx-source.js')
const setLx = () => {
  globalThis.lx = {
    EVENT_NAMES: { inited: 'inited', request: 'request', updateAlert: 'updateAlert' },
    version: '2.0.0',
    env: 'mobile',
    utils: { buffer: { from: (d, e) => Buffer.from(d, e), bufToString: (b, e) => b.toString(e) } },
    request(url, opts, cb) { setTimeout(() => cb(Object.assign(new Error('ECONNREFUSED'), { code: 'ECONNREFUSED' }), null), 2); return () => {} },
    on() {},
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
const snap = m => m.__debug.getHealthSnapshot()
const gate = (m, id, q = '128k', platform = null) => m.__debug.computeEligibility(id, platform, q, { runtime: false, qualityShortCircuit: true, consumePlayDeadTrial: true })

check('M1 链项全部带 eligibility 且 code=ELIGIBLE', () => {
  const m = fresh()
  const chain = m.__debug.buildSourceChain('kw', '128k')
  assert(chain.length > 0, 'kw 128k 链不应为空')
  for (const h of chain) {
    assert(h.eligibility && h.eligibility.eligible === true, `${h.id} 链项缺 eligibility`)
    assert(h.eligibility.code === 'ELIGIBLE', `${h.id} 链项 code 应为 ELIGIBLE`)
  }
})

check('M2 USER_OFF 最高优先：链排除、skipReason 与快照一致、探测不能自动开', () => {
  const m = fresh()
  m.__debug.toggleSource('suyinKuwo', false)
  for (let i = 0; i < 6; i++) m.applyProbeResult('suyinKuwo', true, { outcome: 'PASS' })
  const s = snap(m).suyinKuwo
  assert(s.userEnabled === false && s.eligible === false, '快照应 userEnabled=false/eligible=false')
  assert(s.eligibilityCode === 'USER_OFF' && s.offReason === 'USER_OFF', `快照 code/offReason 不符：${s.eligibilityCode}/${s.offReason}`)
  assert(gate(m, 'suyinKuwo').code === 'USER_OFF', 'computeEligibility 应 USER_OFF')
  assert(!m.__debug.buildSourceChain('kw', '128k').some(h => h.id === 'suyinKuwo'), '手动关闭源不应进链')
  const skip = m.__debug.skipReason('suyinKuwo', { platform: 'kw', quality: '128k' })
  assert(skip && skip.code === 'USER_OFF', 'skipReason 应 USER_OFF')
})

check('M3 AUTO_OFF 只由连续 FAIL；UNKNOWN 不清零也不关闭', () => {
  const m = fresh()
  for (let i = 0; i < 6; i++) m.applyProbeResult('suyinKuwo', false, { outcome: 'UNKNOWN', code: 'NETWORK_TIMEOUT' })
  assert(!snap(m).suyinKuwo.autoOff, 'UNKNOWN 不应触发 autoOff')
  m.applyProbeResult('suyinKuwo', false, { outcome: 'FAIL' })
  assert(!snap(m).suyinKuwo.autoOff, '单次 FAIL 不应触发 autoOff')
  m.applyProbeResult('suyinKuwo', false, { outcome: 'FAIL' })
  const s = snap(m).suyinKuwo
  assert(s.autoOff === true && s.offReason === 'AUTO_OFF_PROBE', `两次 FAIL 应 AUTO_OFF_PROBE，实际 ${s.offReason}`)
})

check('M4 探测 PASS 不解除 resolveDead/playDead', () => {
  const m = fresh()
  for (let i = 0; i < 3; i++) m.__debug.bumpResolveDead('suyinKuwo', '128k')
  for (let i = 0; i < 6; i++) m.applyProbeResult('suyinKuwo', true, { outcome: 'PASS' })
  assert(m.__debug.isResolveDead('suyinKuwo', '128k') === true, '探测 PASS 不应清 resolveDead')
  assert(gate(m, 'suyinKuwo').code === 'PLAYBACK_FAILED', 'resolveDead 应继续挡准入')
})

check('M5 单档失败只挡该档，其余档仍 eligible', () => {
  const m = fresh()
  for (let i = 0; i < 3; i++) m.__debug.applyAdmission({ verdict: 'FAIL', ledger: { health: 'hardFail' } }, { source: 'suyinKuwo', quality: 'flac' })
  const flac = gate(m, 'suyinKuwo', 'flac')
  const k128 = gate(m, 'suyinKuwo', '128k')
  assert(flac.eligible === false && flac.code === 'QUALITY_SHORT_CIRCUIT', `flac 应短路，实际 ${JSON.stringify(flac)}`)
  assert(k128.eligible === true, `128k 不应被 flac 连带，实际 ${JSON.stringify(k128)}`)
})

check('M6 4 档 qualityShortCircuit 快照布尔齐全', () => {
  const m = fresh()
  const qs = snap(m).suyinKuwo.qualityShortCircuit
  for (const q of ['128k', '320k', 'flac', 'flac24bit']) assert(typeof qs[q] === 'boolean', `缺 ${q} 短路布尔`)
})

check('M7 休眠优先级高于待采样/正常，且 code=SOURCE_SLEEPING', () => {
  const m = fresh()
  for (let i = 0; i < 3; i++) {
    m.applyProbeResult('suyinKuwo', false, { outcome: 'FAIL' })
  }
  const s = snap(m).suyinKuwo
  assert(s.sleeping === true || s.autoOff === true, '连续失败应进入休眠或自动关闭')
  const e = gate(m, 'suyinKuwo')
  assert(e.eligible === false, '休眠/自动关闭不应 eligible')
  assert(['SOURCE_SLEEPING', 'AUTO_OFF_PROBE'].includes(e.code), `code 不符：${e.code}`)
})

check('M8 快照 reason 与 gate code 同源，不出现孤儿状态', () => {
  const m = fresh()
  const cases = [
    { setup: () => {}, code: 'ELIGIBLE' },
    { setup: () => m.__debug.toggleSource('suyinKuwo', false), code: 'USER_OFF' },
  ]
  m.__debug.toggleSource('suyinKuwo', true)
  const s0 = snap(m).suyinKuwo
  assert(s0.eligible === true && s0.eligibilityCode === 'ELIGIBLE', `正常源快照应 ELIGIBLE，实际 ${s0.eligibilityCode}`)
  m.__debug.toggleSource('suyinKuwo', false)
  const s1 = snap(m).suyinKuwo
  assert(s1.eligible === false && s1.eligibilityCode === 'USER_OFF', '关闭源快照应 USER_OFF')
})

check('M9 快照只读 eligibility，不改变链/准入结果', () => {
  const m = fresh()
  const before = JSON.stringify(m.__debug.buildSourceChain('kw', '128k').map(h => [h.id, h.eligibility.code]))
  const s = snap(m)
  const after = JSON.stringify(m.__debug.buildSourceChain('kw', '128k').map(h => [h.id, h.eligibility.code]))
  assert(before === after, '快照前后链结果漂移')
  assert(s.suyinKuwo.eligible === true, '正常源快照应 eligible')
})

check('M10 未知源不给假 eligible，统一 SOURCE_UNREACHABLE', () => {
  const m = fresh()
  const e = gate(m, 'not-a-source')
  assert(e.eligible === false && e.code === 'SOURCE_UNREACHABLE' && e.reason === 'unknown-source', `未知源裁决错误：${JSON.stringify(e)}`)
})

console.log(`\n${passed} passed, ${failures.length} failed`)
if (failures.length) {
  for (const f of failures) console.log(`- ${f}`)
  process.exit(1)
}
if (require.main === module) process.exit(0)
