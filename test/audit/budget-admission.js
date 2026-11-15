#!/usr/bin/env node
/**
 * 预算耗尽归因：本地预算不是上游超时。
 * A2-1 预算错误码独立；A2-2 预算耗尽不产生 resolveDead；A2-3 源码不再把预算写成 NETWORK_TIMEOUT。
 */
'use strict'
const fs = require('fs')
const path = require('path')
const SRC = path.join(__dirname, '../../lx-source.js')
globalThis.lx = {
  EVENT_NAMES: { inited: 'inited', request: 'request', updateAlert: 'updateAlert' },
  version: '2.0.0', env: 'mobile',
  utils: { buffer: { from: (d, e) => Buffer.from(d, e), bufToString: (b, e) => b.toString(e) } },
  request(url, opts, cb) { setTimeout(() => cb(null, { statusCode: 200, headers: {}, body: '', url: String(url) }), 1) },
  on() {}, send() {},
}
const m = require(SRC)
const d = m.__debug
let fail = 0
const rec = (id, name, ok, detail) => {
  if (!ok) fail++
  console.log(`${ok ? '✓' : '✗'} [${id}] ${name}${detail ? ' — ' + detail : ''}`)
}
const code = 'BUDGET_EXHAUSTED'
rec('A2-1', '预算耗尽使用独立错误码', d.ADMISSION_POLICY.BUDGET && d.ADMISSION_POLICY.BUDGET.deliverable === false, JSON.stringify(d.ADMISSION_POLICY.BUDGET))
const adm = d.admissionLedger('BUDGET', code, 'strong')
rec('A2-2', '预算耗尽不 bump resolveDead / playDead', adm.resolveDead === false && adm.playDead === false, JSON.stringify(adm))
const ledger = d.admissionLedger('BUDGET', code, 'strong')
rec('A2-3', '预算耗尽是业务失败，不是 hardFail', ledger.health === 'businessFail', ledger.health)
const legacy = fs.readFileSync(path.join(__dirname, '../../src/legacy.js'), 'utf8')
const bad = /ERROR_CODES\.NETWORK_TIMEOUT.*(?:竞速预算耗尽|单源超出预算)/.test(legacy)
rec('A2-4', '源码预算路径不再写成 NETWORK_TIMEOUT', !bad)
const b = d.resolveBudgetBounds(15000, 15000)
rec('A2-5', '总预算+末档保底硬顶 16s', b.totalMs === 15000 && b.floorMs === 1000 && b.totalMs + b.floorMs <= 16000, JSON.stringify(b))
rec('A2-6', '冷启动超时不得超过总预算', d.resolveColdStartTimeout(30000, 12000) === 12000, String(d.resolveColdStartTimeout(30000, 12000)))
rec('A2-7', '单链预算到期不再给 1s 宽限', /const budgetLeft = Math\.max\([^\n]+, 0\);/.test(legacy) && !/const budgetLeft = Math\.max\([^\n]+, 1000\);/.test(legacy))
console.log(`\n${fail ? 'FAIL' : 'PASS'} (${fail} failures)`)
process.exit(fail ? 1 : 0)
