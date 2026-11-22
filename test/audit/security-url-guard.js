#!/usr/bin/env node
/**
 * G6 / R75：非法 URL 防线。
 *
 * 原缺口写法是「安全面只有静态 grep」——静态只能证明字符串出现过，
 * 证明不了 `javascript:` / `file://` / 超长入参真的被拒。本脚本把三条运行时校验
 * 逐个喂越界输入：
 *   · `19-dispatch.js:398` validateUrl（源返回的取链结果）
 *   · `15-verify.js:195` probeAudioDelivery（验真探针入口）
 *   · `07-net.js` upgradeToHttps（http→https 升级，不得把非法串升成合法）
 *
 * 判据是「拒绝的码要对」：空/缺 → NOT_FOUND（没给东西），格式非法 → PARAM_ERROR（给了错东西）。
 * 两个码混用会让上层把「源坏了」和「源给错」记成一类，重试策略就错了。
 */
'use strict'

const path = require('path')
const ROOT = path.resolve(__dirname, '..', '..')

// 三条入口都是纯函数（URL 形态判定），不触 dep()/网络；不绑定依赖，
// 让「加载期就偷偷取依赖」这类改动在这里直接炸出来。
// 仍需最小宿主桩：core 模块加载期会解构 globalThis.lx（00-host.js:9）。
globalThis.lx = {
  EVENT_NAMES: { inited: 'inited', request: 'request', updateAlert: 'updateAlert' },
  version: '2.0.0',
  env: 'mobile',
  utils: { buffer: { from: (d, e) => Buffer.from(d, e), bufToString: (b, e) => b.toString(e) } },
  request: () => { throw new Error('stub: 本用例不应发网络请求') },
  on: () => {},
  send: () => {},
}
const net = require(path.join(ROOT, 'src', 'core', '07-net.js'))
const verify = require(path.join(ROOT, 'src', 'core', '15-verify.js'))
const dispatch = require(path.join(ROOT, 'src', 'core', '19-dispatch.js'))
const { ERROR_CODES } = require(path.join(ROOT, 'src', 'core', '02-error-codes.js'))

const assert = require('assert')
let checks = 0
let failures = 0
const run = (id, name, fn) => {
  try {
    fn()
    checks++
    console.log(`  ✓ [${id}] ${name}`)
  } catch (e) {
    failures++
    console.error(`  ✗ [${id}] ${name}`)
    console.error(`    ${e && e.message ? e.message : e}`)
  }
}
const codeOf = err => {
  const m = String(err && err.message || '').match(/^([A-Z_]+):/)
  return m ? m[1] : (err && err.code) || 'NO_CODE'
}

console.log('\n[G6 url guard]')

run('G6-01', 'javascript: 伪协议被拒（PARAM_ERROR）',() => {
  assert.throws(() => dispatch.validateUrl('javascript:alert(1)', 'test'), e => codeOf(e) === ERROR_CODES.PARAM_ERROR, '未按 PARAM_ERROR 拒绝')
})

run('G6-02', 'file:// 本地路径被拒（PARAM_ERROR）',() => {
  assert.throws(() => dispatch.validateUrl('file:///etc/passwd', 'test'), e => codeOf(e) === ERROR_CODES.PARAM_ERROR, '未按 PARAM_ERROR 拒绝')
})

run('G6-03', 'data: 内联载荷被拒（PARAM_ERROR）',() => {
  assert.throws(() => dispatch.validateUrl('data:audio/mpeg;base64,AAAA', 'test'), e => codeOf(e) === ERROR_CODES.PARAM_ERROR, '未按 PARAM_ERROR 拒绝')
})

run('G6-04', '协议相对 //evil.com 被拒（PARAM_ERROR）',() => {
  assert.throws(() => dispatch.validateUrl('//evil.com/a.mp3', 'test'), e => codeOf(e) === ERROR_CODES.PARAM_ERROR, '未按 PARAM_ERROR 拒绝')
})

run('G6-05', '空串 / null 归 NOT_FOUND（不是 PARAM_ERROR）',() => {
  for (const v of ['', '   ', null, undefined]) {
    assert.throws(() => dispatch.validateUrl(v, 'test'), e => codeOf(e) === ERROR_CODES.NOT_FOUND, `${String(v)} 的码不对`)
  }
})

run('G6-06', '通过时返回 trim 后结果（首尾空白不进播放器）',() => {
  const out = dispatch.validateUrl('  https://a.test/x.mp3\n', 'test')
  assert.strictEqual(out, 'https://a.test/x.mp3', `返回 ${JSON.stringify(out)}`)
  assert(!/\s/.test(out), '仍含空白')
})

run('G6-07', '大写 HTTPS 通过（不因大小写误杀）',() => {
  const out = dispatch.validateUrl('HTTPS://A.TEST/X.MP3', 'test')
  assert.strictEqual(out, 'HTTPS://A.TEST/X.MP3')
})

run('G6-08', '超长 URL（100KB）不崩、按格式拒绝',() => {
  const huge = 'javascript:' + 'a'.repeat(100 * 1024)
  assert.throws(() => dispatch.validateUrl(huge, 'test'), e => codeOf(e) === ERROR_CODES.PARAM_ERROR, '超长伪协议未被拒')
  const hugeHttp = 'https://a.test/' + 'b'.repeat(100 * 1024) + '.mp3'
  assert.strictEqual(dispatch.validateUrl(hugeHttp, 'test').length, hugeHttp.length, '超长合法 URL 被误杀')
})

run('G6-09', 'probeAudioDelivery 对 javascript: 返回 PARAM_ERROR',async () => {
  const r = await verify.probeAudioDelivery('javascript:alert(1)')
  assert.strictEqual(r.ok, false, `ok=${r.ok}`)
  assert.strictEqual(r.code, ERROR_CODES.PARAM_ERROR, `code=${r.code}`)
})

run('G6-10', 'probeAudioDelivery 对 file:// 返回 PARAM_ERROR',async () => {
  const r = await verify.probeAudioDelivery('file:///etc/passwd')
  assert.strictEqual(r.ok, false, `ok=${r.ok}`)
  assert.strictEqual(r.code, ERROR_CODES.PARAM_ERROR, `code=${r.code}`)
})

run('G6-11', 'upgradeToHttps 只升 http，不改 https 与其他',() => {
  assert.strictEqual(net.upgradeToHttps('http://a.test/x.mp3'), 'https://a.test/x.mp3')
  assert.strictEqual(net.upgradeToHttps('https://a.test/x.mp3'), 'https://a.test/x.mp3')
  // 非法串原样返回——升级函数不是校验闸门，不能因为「升不了」就把 javascript: 变成 https://javascript:
  assert.strictEqual(net.upgradeToHttps('javascript:alert(1)'), 'javascript:alert(1)')
})

run('G6-12', 'HTTP_URL_REGEX 只认 http/https（单一真相）',() => {
  for (const ok of ['http://a', 'https://a', 'HTTP://a', 'HTTPS://a']) assert(ERROR_CODES && net.HTTP_URL_REGEX.test(ok), `${ok} 应通过`)
  for (const bad of ['javascript:', 'file:', 'data:', '//a', 'ftp://a', 'ws://a']) assert(!net.HTTP_URL_REGEX.test(bad), `${bad} 应拒绝`)
})

if (require.main === module) {
  setTimeout(() => {
    console.log(`\n===== G6 非法 URL 防线：${checks} 通过 / ${failures} 失败 =====`)
    process.exit(failures ? 1 : 0)
  }, 0)
}
module.exports = { run }
