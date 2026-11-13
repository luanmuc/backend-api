#!/usr/bin/env node
/**
 * Batch 3 统一 Eligibility 接入主框架（C1~C9）
 *
 * 验收：open/限流/半开在飞源不进 eligible 链；建链只读不推进 half-open；
 * skipReason 与链使用同一 reducer；preview/qualityShortCircuit 可见；
 * 正常源仍可入链。
 *
 * 用法：node test/audit/health-eligibility-batch3.js
 */
'use strict'
const path = require('path')
const SRC = path.join(__dirname, '../../lx-source.js')
const setLx = () => {
  globalThis.lx = {
    EVENT_NAMES: { inited: 'inited', request: 'request', updateAlert: 'updateAlert' },
    version: '2.0.0', env: 'mobile',
    utils: { buffer: { from: (d, e) => Buffer.from(d, e), bufToString: (b, e) => b.toString(e) } },
    request(url, opts, cb) { setTimeout(() => cb(Object.assign(new Error('x'), { code: 'ECONNREFUSED' }), null), 2); return () => {} },
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
const ID = 'suyinKuwo'
const slot = (over = {}) => ({
  req: 0, success: 0, time: 0, fail: 0, businessFail: 0,
  rateLimitCount: 0, rateLimitUntil: 0, rateLimited: false,
  breaker: { state: 'closed', failureCount: 0, lastFailureTime: 0, trialInFlight: false },
  ...over,
})
const setQ = (m, quality, over = {}) => {
  const br = m.__debug.breakerMap.get(ID) || { byQuality: {} }
  if (!br.byQuality) br.byQuality = {}
  br.byQuality[quality] = slot(over.breaker ? { ...over, breaker: { ...slot().breaker, ...over.breaker } } : over)
  m.__debug.breakerMap.set(ID, br)
  return br.byQuality[quality]
}
const chainIds = m => m.__debug.buildSourceChain('kw', '128k').map(h => h.id)

check('C1 open 档不进 eligible 链', () => {
  const m = fresh()
  setQ(m, '128k', { breaker: { state: 'open', lastFailureTime: Date.now(), failureCount: 3 } })
  assert(!chainIds(m).includes(ID), 'open 源仍在链中')
})

check('C2 限流档不进 eligible 链', () => {
  const m = fresh()
  setQ(m, '128k', { rateLimitUntil: Date.now() + 60 * 1000, rateLimited: true })
  assert(!chainIds(m).includes(ID), '限流源仍在链中')
})

check('C3 半开 trial 在飞不进链，未在飞可入链', () => {
  const m = fresh()
  setQ(m, '128k', { breaker: { state: 'half-open', trialInFlight: true } })
  assert(!chainIds(m).includes(ID), '半开在飞仍入链')
  setQ(m, '128k', { breaker: { state: 'half-open', trialInFlight: false } })
  assert(chainIds(m).includes(ID), '半开未飞应入链')
})

check('C4 建链只读：open/半开状态与 trial 不被推进', () => {
  const m = fresh()
  setQ(m, '128k', { breaker: { state: 'open', lastFailureTime: 0, trialInFlight: false } }) // 冷却已到期
  const q = m.__debug.breakerMap.get(ID).byQuality['128k']
  m.__debug.buildSourceChain('kw', '128k')
  assert(q.breaker.state === 'open', `建链把 open 推进成 ${q.breaker.state}`)
  assert(q.breaker.trialInFlight === false, '建链消费了 trial')
})

check('C5 skipReason 与链使用同一 reducer：open/限流原因一致', () => {
  const m = fresh()
  setQ(m, '128k', { breaker: { state: 'open', lastFailureTime: Date.now() } })
  const open = m.__debug.skipReason(ID, { platform: 'kw', quality: '128k' })
  assert(open && open.code === 'QUALITY_OPEN', `open skipReason=${JSON.stringify(open)}`)
  setQ(m, '128k', { rateLimitUntil: Date.now() + 60 * 1000 })
  const limited = m.__debug.skipReason(ID, { platform: 'kw', quality: '128k' })
  assert(limited && limited.code === 'RATE_LIMITED', `限流 skipReason=${JSON.stringify(limited)}`)
})

check('C6 preview 冷却不进链且原因独立', () => {
  const m = fresh()
  const srcMap = m.__debug.previewCooldownMap || m.previewCooldownMap
  assert(srcMap && typeof srcMap.set === 'function', 'previewCooldownMap 未导出，无法审计')
  srcMap.set(ID, Date.now() + 60 * 1000)
  assert(!chainIds(m).includes(ID), 'preview 冷却源仍在链中')
  const skip = m.__debug.skipReason(ID, { platform: 'kw', quality: '128k' })
  assert(skip && skip.code === 'PREVIEW_COOLDOWN', `preview skipReason=${JSON.stringify(skip)}`)
})

check('C7 qualityShortCircuit 仍可见且不入链', () => {
  const m = fresh()
  setQ(m, 'flac', { fail: 3, success: 0 })
  m.__debug.qualitySkipProbeAt.set(`${ID}:flac`, Date.now() + 3600 * 1000)
  assert(!m.__debug.buildSourceChain('kw', 'flac').map(h => h.id).includes(ID), '短路档仍在链中')
  const skip = m.__debug.skipReason(ID, { platform: 'kw', quality: 'flac' })
  assert(skip && skip.code === 'QUALITY_SHORT_CIRCUIT', `短路 skipReason=${JSON.stringify(skip)}`)
})

check('C8 正常源仍在链中并带 eligibility', () => {
  const m = fresh()
  const chain = m.__debug.buildSourceChain('kw', '128k')
  const item = chain.find(h => h.id === ID)
  assert(item && item.eligibility && item.eligibility.eligible === true, '正常源未入链或缺 eligibility')
})

check('C9 建链多次调用结果稳定，不触发事件', () => {
  const m = fresh()
  const before = JSON.stringify(m.__debug.getHealthEvents().events)
  const a = chainIds(m)
  const b = chainIds(m)
  assert(JSON.stringify(a) === JSON.stringify(b), '两次建链结果不同')
  assert(JSON.stringify(m.__debug.getHealthEvents().events) === before, '建链写了健康事件')
})

console.log(`\n${passed} passed, ${failures.length} failed`)
if (failures.length) { console.log(failures.join('\n')); process.exit(1) }
process.exit(0)
