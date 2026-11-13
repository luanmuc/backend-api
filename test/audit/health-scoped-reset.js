#!/usr/bin/env node
/**
 * F38 scoped 清账审计（S 组）
 *
 * S1 authority 只清用户账（摘除/熔断/限流/探测态），保留 byQuality 质量历史；
 * S2 all 仍是完整清账（失败/成功/请求数归零），供面板重置使用。
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
const ID = 'suyinKuwo'
const Q = 'flac'

const assert = (cond, msg) => { if (!cond) throw new Error(msg) }
let passed = 0
const failures = []
const check = (id, name, fn) => {
  try { fn(); passed++; console.log(`✓ ${id} ${name}`) } catch (e) { failures.push(`[${id}] ${name} — ${e.message}`); console.log(`✗ ${id} ${name} — ${e.message}`) }
}

const makeDirty = () => {
  const b = m.getBreaker(ID)
  b.state = 'open';
  b.failureCount = 3
  b.rateLimited = true
  b.rateLimitUntil = Date.now() + 60000
  b.byQuality[Q] = {
    req: 10, success: 7, fail: 3, businessFail: 1, time: 3456,
    breaker: { state: 'open', failureCount: 3, lastFailureTime: Date.now(), trialInFlight: false },
    rateLimitCount: 2, rateLimitUntil: Date.now() + 60000, rateLimited: true,
  }
  d.playDeadStreak.set(ID, 3)
  d.playDeadDeadline.set(ID, Date.now())
}

check('S1', 'authority 清账保留 byQuality 质量历史，只复位执行门（F38）', () => {
  makeDirty()
  assert(d.clearSourceLedger(ID, { scope: 'authority' }) === true, 'clearSourceLedger 应成功')
  const b = m.getBreaker(ID)
  const q = b.byQuality[Q]
  assert(q.req === 10 && q.success === 7 && q.fail === 3 && q.businessFail === 1 && q.time === 3456,
    `质量历史被清：${JSON.stringify(q)}`)
  assert(q.breaker.state === 'closed' && q.breaker.failureCount === 0, `档位 breaker 未复位：${JSON.stringify(q.breaker)}`)
  assert(q.rateLimitUntil === 0 && q.rateLimited === false && q.rateLimitCount === 0, '档位限流未清')
  assert(b.state === 'closed' && b.failureCount === 0, '源级 breaker 未复位')
  assert(b.rateLimitUntil === 0 && b.rateLimited === false, '源级限流未清')
  assert(d.playDeadStreak.get(ID) === undefined, 'playDead 未清')
})

check('S2', 'all 清账仍归零成功/失败/请求数，供面板重置（F38）', () => {
  makeDirty()
  d.clearSourceLedger(ID)
  const q = m.getBreaker(ID).byQuality[Q]
  assert(q.req === 0 && q.success === 0 && q.fail === 0 && q.businessFail === 0 && q.time === 0,
    `all 未归零：${JSON.stringify(q)}`)
  assert(q.breaker.state === 'closed' && q.rateLimitUntil === 0, 'all 未复位 breaker/限流')
})

console.log(`\n===== S 组汇总：${passed} 通过 / ${failures.length} 失败 =====`)
if (failures.length) { for (const f of failures) console.error(f); process.exit(1) }
if (require.main === module) process.exit(0)
