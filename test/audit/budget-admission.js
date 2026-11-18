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
// R38：原来 A2-2 / A2-3 用完全相同的入参各调一次 admissionLedger——纯重复调用，合并成一次。
const adm = d.admissionLedger('BUDGET', code, 'strong')
rec('A2-2', '预算耗尽不 bump resolveDead / playDead', adm.resolveDead === false && adm.playDead === false, JSON.stringify(adm))
rec('A2-3', '预算耗尽是业务失败，不是 hardFail', adm.health === 'businessFail', adm.health)
const SRC_DIR = path.join(__dirname, '../../src')
const coreFiles = fs.readdirSync(path.join(SRC_DIR, 'core')).filter((f) => f.endsWith('.js')).sort()
const legacy = [
  fs.readFileSync(path.join(SRC_DIR, '00-header.js'), 'utf8'),
  ...coreFiles.map((f) => fs.readFileSync(path.join(SRC_DIR, 'core', f), 'utf8')),
  fs.readFileSync(path.join(SRC_DIR, 'legacy.js'), 'utf8'),
].join('\n')
// R38：原正则的 `.*` 不跨行——一旦写法变成「先赋 NETWORK_TIMEOUT、下一行再拼文案」就漏检。
// 改成允许 120 字符的跨行窗口（预算错误码与预算文案不得同时出现在同一段里）。
const bad = /ERROR_CODES\.NETWORK_TIMEOUT[\s\S]{0,120}(?:竞速预算耗尽|单源超出预算)/.test(legacy)
rec('A2-4', '源码预算路径不再写成 NETWORK_TIMEOUT', !bad)
const b = d.resolveBudgetBounds(15000, 15000)
rec('A2-5', '总预算+末档保底硬顶 16s', b.totalMs === 15000 && b.floorMs === 1000 && b.totalMs + b.floorMs <= 16000, JSON.stringify(b))
rec('A2-6', '冷启动超时不得超过总预算', d.resolveColdStartTimeout(30000, 12000) === 12000, String(d.resolveColdStartTimeout(30000, 12000)))
rec('A2-7', '单链预算到期不再给 1s 宽限', /const budgetLeft = Math\.max\([^\n]+, 0\);/.test(legacy) && !/const budgetLeft = Math\.max\([^\n]+, 1000\);/.test(legacy))
console.log(`\n${fail ? 'FAIL' : 'PASS'} (${fail} failures)`)
// R38：只有 `if (require.main) process.exit(...)`——被 require 时失败既不退出也不置退出码。
if (fail) process.exitCode = 1
if (require.main === module) process.exit(fail ? 1 : 0)
