#!/usr/bin/env node
/**
 * v8.14 按档熔断/限流/半开单 trial 审计（Q 组、F39/F40/F41）
 *
 * 验收：
 * 1. 同一源 flac 连续失败只熔断 flac，128k 仍可执行；
 * 2. 源级 state 只在该源所有已建账档位都不可达时才 open；
 * 3. open 冷却到期只放一次 half-open trial，第二次同档必须拒绝；失败回 open，成功 close；
 * 4. 429 只退避命中的档位，不污染同源其他档，也不计入业务失败/fail 计数。
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

const load = () => {
  const p = require.resolve(SRC)
  if (require.cache[p]) delete require.cache[p]
  return require(SRC)
}

const fresh = () => {
  setLx()
  globalThis.__lxSourceConfig = { rateLimitBackoffMs: 600000 }
  return load()
}

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

const m = fresh()
const d = m.__debug
const id = 'suyinKuwo'
d.toggleSource(id, true)

const reset = () => {
  const b = m.getBreaker(id)
  b.state = 'closed'
  b.failureCount = 0
  b.lastFailureTime = 0
  b.byQuality = {}
  b.rateLimitCount = 0
  b.rateLimitUntil = 0
  b.rateLimited = false
  return b
}

check('Q1', 'flac 连续失败只熔断 flac，128k 仍 ELIGIBLE（F39）', () => {
  const b = reset()
  for (let i = 0; i < 3; i++) m.recordFailure(id, 'flac', { playDead: false })
  assert(b.byQuality.flac.breaker.state === 'open', `flac breaker=${b.byQuality.flac.breaker.state}`)
  const flac = d.computeEligibility(id, null, 'flac', { runtime: true })
  assert(flac.eligible === false && flac.code === 'QUALITY_OPEN', `flac code=${flac.code}`)
  const k128 = d.computeEligibility(id, null, '128k', { runtime: true })
  assert(k128.eligible === true, `128k 应可用，实际 ${k128.code}`)
})

check('Q2', '源级 state 只在已建账档位全不可达时 open（F39）', () => {
  const b = reset()
  for (let i = 0; i < 3; i++) m.recordFailure(id, 'flac', { playDead: false })
  assert(b.state === 'open', '仅 flac 有账时应 open')
  m.recordSuccess(id, 100, '128k')
  assert(b.state === 'closed', `128k 成功后源级应变 closed，实际 ${b.state}`)
  const k128 = d.computeEligibility(id, null, '128k', { runtime: true })
  assert(k128.eligible === true, `128k 应可用，实际 ${k128.code}`)
})

check('Q3', 'half-open 只放一次 trial，失败回 open（F40）', () => {
  const b = reset()
  for (let i = 0; i < 3; i++) m.recordFailure(id, 'flac', { playDead: false })
  const qb = b.byQuality.flac.breaker
  qb.lastFailureTime = Date.now() - 200000
  const first = d.computeEligibility(id, null, 'flac', { runtime: true })
  assert(first.eligible === true, `首次半开应放行，实际 ${first.code}`)
  const second = d.computeEligibility(id, null, 'flac', { runtime: true })
  assert(second.eligible === false && second.code === 'QUALITY_OPEN', `第二次应拒绝，实际 ${second.code}`)
  m.recordFailure(id, 'flac', { playDead: false })
  assert(qb.state === 'open', `试探失败应回 open，实际 ${qb.state}`)
})

check('Q4', 'half-open 试探成功 close（F40）', () => {
  const b = reset()
  for (let i = 0; i < 3; i++) m.recordFailure(id, 'flac', { playDead: false })
  const qb = b.byQuality.flac.breaker
  qb.lastFailureTime = Date.now() - 200000
  assert(d.computeEligibility(id, null, 'flac', { runtime: true }).eligible === true, '首次半开应放行')
  m.recordSuccess(id, 100, 'flac')
  assert(qb.state === 'closed', `试探成功应 close，实际 ${qb.state}`)
  assert(d.computeEligibility(id, null, 'flac', { runtime: true }).eligible === true, '成功后应可用')
})

check('Q5', '429 只退避命中档位，不污染其他档（F41）', () => {
  const b = reset()
  for (let i = 0; i < 3; i++) m.recordRateLimit(id, 'flac')
  assert(b.byQuality.flac.rateLimitUntil > Date.now(), `flac 应进入退避，until=${b.byQuality.flac.rateLimitUntil} now=${Date.now()}`)
  assert((b.byQuality.flac.fail || 0) === 0, '429 不能记成 fail')
  assert(d.canExecute(id, 'flac') === false, `canExecute 应拒绝 flac；until=${b.byQuality.flac.rateLimitUntil} now=${Date.now()}`)
  const flac = d.computeEligibility(id, null, 'flac', { runtime: true })
  assert(flac.eligible === false && flac.code === 'RATE_LIMITED', `flac code=${flac.code}`)
  const k128 = d.computeEligibility(id, null, '128k', { runtime: true })
  assert(k128.eligible === true, `128k 不应被 flac 的 429 连带，实际 ${k128.code}`)
})

console.log(`\n===== Q 组汇总：${passed} 通过 / ${failures.length} 失败 =====`)
if (failures.length) {
  for (const f of failures) console.error(f)
  process.exit(1)
}
process.exit(0)
