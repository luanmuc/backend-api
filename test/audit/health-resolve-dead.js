#!/usr/bin/env node
/**
 * F42 取链摘除 / 播放摘除分层审计（R 组）
 *
 * R1 取链/准入失败只累计 resolveDead，不动 playDead；
 * R2 取链成功只解除 resolveDead，playDead 必须等真实播放成功；
 * R3 真实播放成功同时解除两者；
 * R4 非 strong 证据不产生 resolveDead 建议。
 */
'use strict'

const path = require('path')
const SRC = path.join(__dirname, '../../lx-source.js')
globalThis.lx = {
  EVENT_NAMES: { inited: 'inited', request: 'request', updateAlert: 'updateAlert' },
  version: '2.0.0',
  env: 'mobile',
  utils: { buffer: { from: (d, e) => Buffer.from(d, e), bufToString: (b, e) => b.toString(e) } },
  request(url, opts, cb) {
    setTimeout(() => cb(Object.assign(new Error('ECONNREFUSED'), { code: 'ECONNREFUSED' }), null), 2)
    return () => {}
  },
  on() {},
  send() {},
}
globalThis.__lxSourceConfig = { logDebug: false, playDeadReviveMs: 600000, resolveDeadReviveMs: 600000 }
const m = require(SRC)
const d = m.__debug
const ID = 'suyinKuwo'
const Q = '128k'

const assert = (cond, msg) => { if (!cond) throw new Error(msg) }
let passed = 0
const failures = []
const check = (id, name, fn) => {
  try {
    fn()
    passed++
    console.log(`✓ ${id} ${name}`)
  } catch (e) {
    failures.push(`[${id}] ${name} — ${e.message}`)
    console.log(`✗ ${id} ${name} — ${e.message}`)
  }
}

const snap = () => d.getHealthSnapshot()[ID]
const reset = () => d.clearSourceLedger(ID)
const resolveAdmission = (evidence = 'strong') => d.applyAdmission({
  verdict: 'TRANSIENT',
  code: 'NETWORK_ERROR',
  evidence,
  ledger: d.admissionLedger('TRANSIENT', 'NETWORK_ERROR', evidence),
}, { source: ID, quality: Q, error: { code: 'NETWORK_ERROR' } })

check('R1', '取链失败只累计 resolveDead，playDead 保持 0（F42）', () => {
  reset()
  for (let i = 0; i < 3; i++) resolveAdmission()
  const s = snap()
  assert(s.resolveDead === true, `resolveDead 应为 true，实际 ${s.resolveDead}`)
  assert(s.playDead === false, `playDead 不应被取链失败置位，实际 ${s.playDead}`)
  const e = d.computeEligibility(ID, 'kw', Q, { runtime: false })
  assert(e.eligible === false && e.code === 'PLAYBACK_FAILED', `应不可用 PLAYBACK_FAILED，实际 ${e.code}`)
  assert(e.reason === 'resolve-dead', `reason 应为 resolve-dead，实际 ${e.reason}`)
})

check('R2', '取链成功只解除 resolveDead，不清 playDead（F42）', () => {
  reset()
  for (let i = 0; i < 3; i++) m.recordFailure(ID, Q, { playDead: true })
  assert(snap().playDead === true, '前置 playDead 应为 true')
  m.recordSuccess(ID, 100, Q) // 链成功，不是真实播放成功
  assert(snap().playDead === true, '链成功不得解除 playDead')
  assert(snap().resolveDead === false, '链成功应解除 resolveDead')
  m.recordSuccess(ID, 100, Q, { playback: true }) // App 真实播放成功
  assert(snap().playDead === false, '真实播放成功应解除 playDead')
})

check('R3', '真实播放成功同时解除 resolveDead/playDead（F42）', () => {
  reset()
  for (let i = 0; i < 3; i++) resolveAdmission()
  for (let i = 0; i < 3; i++) m.recordFailure(ID, Q, { playDead: true })
  assert(snap().resolveDead === true && snap().playDead === true, '前置两者都应为 true')
  m.recordSuccess(ID, 100, Q, { playback: true })
  assert(snap().resolveDead === false && snap().playDead === false, '真实播放成功应同时解除两者')
})

check('R4', '非 strong 证据不产生 resolveDead 建议（F42/F47）', () => {
  const none = d.admissionLedger('TRANSIENT', 'NETWORK_ERROR', 'none')
  const weak = d.admissionLedger('TRANSIENT', 'NETWORK_ERROR', 'weak')
  const medium = d.admissionLedger('TRANSIENT', 'NETWORK_ERROR', 'medium')
  assert(none.resolveDead === false && weak.resolveDead === false && medium.resolveDead === false,
    `弱证据不得建议摘除，实际 ${none.resolveDead}/${weak.resolveDead}/${medium.resolveDead}`)
  const strong = d.admissionLedger('TRANSIENT', 'NETWORK_ERROR', 'strong')
  assert(strong.resolveDead === true, 'strong 的 TRANSIENT 才建议 resolveDead')
})

console.log(`\n===== R 组汇总：${passed} 通过 / ${failures.length} 失败 =====`)
if (failures.length) {
  for (const f of failures) console.error(f)
  process.exit(1)
}
process.exit(0)
