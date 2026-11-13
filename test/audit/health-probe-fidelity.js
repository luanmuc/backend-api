#!/usr/bin/env node
/**
 * F20/F22 探测保真审计（F1~F10）
 *
 * 断言探针只证明“探测目标可达”，不冒充真实播放成功：
 * 逐目标三值、POST 透传、check/extractUrl 生效、单源隔离、
 * 不写质量账、不清播放摘除、事件无 URL。
 *
 * 用法：node test/audit/health-probe-fidelity.js
 */
'use strict'
const path = require('path')
const SRC = path.join(__dirname, '../../lx-source.js')
let routes = {}
let calls = []
const setLx = () => {
  calls = []
  globalThis.lx = {
    EVENT_NAMES: { inited: 'inited', request: 'request', updateAlert: 'updateAlert' },
    version: '2.0.0',
    env: 'mobile',
    utils: { buffer: { from: (d, e) => Buffer.from(d, e), bufToString: (b, e) => b.toString(e) } },
    request(url, opts, cb) {
      calls.push({ url, opts })
      const r = routes[url] || routes['*'] || { err: Object.assign(new Error('ECONNREFUSED'), { code: 'ECONNREFUSED' }) }
      setTimeout(() => cb(r.err || null, r.err ? null : r.res), 2)
      return () => {}
    },
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
const check = async (name, fn) => {
  try { await fn(); passed++; console.log(`✓ ${name}`) } catch (e) { failures.push(`${name} — ${e.message}`); console.log(`✗ ${name} — ${e.message}`) }
}
const assert = (c, m) => { if (!c) throw new Error(m) }
const ok = body => ({ res: { statusCode: 200, headers: { 'content-type': 'application/json' }, body } })
const audio = () => ({ res: { statusCode: 206, headers: { 'content-type': 'audio/mpeg' }, body: Buffer.alloc(10) } })
const probe = (m, probes) => m.__debug.probeSingleSource('suyinKuwo', { probes })

const main = async () => {
await check('F1 逐目标三值：128k PASS + 320k FAIL → 源 PASS，目标各自保留', async () => {
  routes = {
    'https://api.test/128k': ok('{"ok":true}'),
    'https://api.test/320k': ok('{"ok":false}'),
  }
  const m = fresh()
  const r = await probe(m, [
    { quality: '128k', url: 'https://api.test/128k', check: b => (typeof b === 'string' ? b : JSON.stringify(b)).includes('true') },
    { quality: '320k', url: 'https://api.test/320k', check: b => (typeof b === 'string' ? b : JSON.stringify(b)).includes('true') },
  ])
  assert(r.outcome === 'PASS' && r.usable === true, `源级应为 PASS，实际 ${r.outcome}`)
  assert(r.targets.length === 2, '目标数应为 2')
  assert(r.targets.find(t => t.quality === '128k').outcome === 'PASS', '128k 应 PASS')
  assert(r.targets.find(t => t.quality === '320k').outcome === 'FAIL', '320k 应 FAIL')
})

await check('F2 全 FAIL → 源 FAIL；单档失败不冒充源可用', async () => {
  routes = { '*': ok('{"ok":false}') }
  const m = fresh()
  const r = await probe(m, [
    { quality: '128k', url: 'https://api.test/a', check: b => (typeof b === 'string' ? b : JSON.stringify(b)).includes('true') },
    { quality: 'flac', url: 'https://api.test/b', check: b => (typeof b === 'string' ? b : JSON.stringify(b)).includes('true') },
  ])
  assert(r.outcome === 'FAIL' && r.usable === false, `全 FAIL 应为 FAIL，实际 ${r.outcome}`)
  assert(r.passCount === 0 && r.failCount === 2, `计数错误 ${r.passCount}/${r.failCount}`)
})

await check('F3 超时/网络异常 → UNKNOWN，不冒充 FAIL', async () => {
  routes = { '*': { err: Object.assign(new Error('timeout'), { code: 'NETWORK_TIMEOUT' }) } }
  const m = fresh()
  const r = await probe(m, [{ quality: '128k', url: 'https://api.test/t', check: () => true }])
  assert(r.outcome === 'UNKNOWN' && r.usable === false, `超时应 UNKNOWN，实际 ${r.outcome}`)
  assert(r.failCount === 0 && r.unknownCount === 1, `UNKNOWN 不应计 FAIL：${r.failCount}/${r.unknownCount}`)
})

await check('F4 method/body/headers 原样透传（POST 协议型源）', async () => {
  routes = { 'https://api.test/post': ok('{"code":200}') }
  const m = fresh()
  await probe(m, [{ quality: '128k', url: 'https://api.test/post', method: 'POST', body: '{"x":1}', headers: { 'X-Test': '1' }, check: b => (typeof b === 'string' ? b : JSON.stringify(b)).includes('200') }])
  const c = calls[0]
  assert(c.opts.method === 'POST', `method 丢失：${c.opts.method}`)
  assert(c.opts.body === '{"x":1}', `body 丢失：${c.opts.body}`)
  assert(c.opts.headers && c.opts.headers['X-Test'] === '1', '自定义 header 丢失')
})

await check('F5 check 返回 false 时 HTTP 200 也不能 PASS', async () => {
  routes = { 'https://api.test/check': ok('{"code":500}') }
  const m = fresh()
  const r = await probe(m, [{ quality: '128k', url: 'https://api.test/check', check: b => (typeof b === 'string' ? b : JSON.stringify(b)).includes('200') }])
  assert(r.outcome === 'FAIL', 'check 失败应 FAIL')
})

await check('F6 extractUrl + 可播校验：文本响应判 FAIL，音频 206 判 PASS', async () => {
  routes = {
    'https://api.test/json': ok('{"url":"https://cdn.test/a.mp3"}'),
    'https://api.test/text': ok('{"url":"https://cdn.test/b.txt"}'),
    'https://cdn.test/a.mp3': audio(),
    'https://cdn.test/b.txt': { res: { statusCode: 200, headers: { 'content-type': 'text/plain' }, body: 'not audio' } },
  }
  const m = fresh()
  const good = await probe(m, [{ quality: '128k', url: 'https://api.test/json', check: () => true, extractUrl: b => (typeof b === 'string' ? JSON.parse(b) : b).url }])
  assert(good.outcome === 'PASS', '真音频应 PASS')
  const bad = await probe(m, [{ quality: '320k', url: 'https://api.test/text', check: () => true, extractUrl: b => (typeof b === 'string' ? JSON.parse(b) : b).url }])
  assert(bad.outcome === 'FAIL', '文本响应应 FAIL')
})

await check('F7 单源探测只影响该源', async () => {
  routes = { '*': ok('{"ok":true}') }
  const m = fresh()
  const before = JSON.stringify(m.__debug.getHealthSnapshot().changqingVip)
  await probe(m, [{ quality: '128k', url: 'https://api.test/ok', check: () => true }])
  const after = JSON.stringify(m.__debug.getHealthSnapshot().changqingVip)
  assert(before === after, '探测 suyinKuwo 不应改 changqingVip')
})

await check('F8 探测不计入 byQuality 真实 req/fail 账', async () => {
  routes = { '*': ok('{"ok":true}') }
  const m = fresh()
  await probe(m, [{ quality: '128k', url: 'https://api.test/ok', check: () => true }])
  const q = m.__debug.getHealthSnapshot().suyinKuwo.byQuality['128k'] || {}
  assert((q.req || 0) === 0, `探测不应写 req，实际 ${q.req}`)
  assert((q.fail || 0) === 0, `探测不应写 fail，实际 ${q.fail}`)
  const br = m.__debug.breakerMap.get('suyinKuwo')
  assert(br.probeRequests >= 1 && (br.failureCount || 0) === 0, '探测只应写 probe 计数，不应动熔断失败数')
})

await check('F9 探测 PASS 不清 playDead/resolveDead', async () => {
  routes = { '*': ok('{"ok":true}') }
  const m = fresh()
  for (let i = 0; i < 3; i++) m.__debug.bumpResolveDead('suyinKuwo', '128k')
  for (let i = 0; i < 5; i++) m.applyProbeResult('suyinKuwo', true, { outcome: 'PASS' })
  assert(m.__debug.isResolveDead('suyinKuwo', '128k') === true, '探测 PASS 不应清 resolveDead')
})

await check('F10 probe_result 无 URL/歌名，目标数与 probes 一致', async () => {
  routes = { '*': ok('{"ok":true}') }
  const m = fresh()
  await probe(m, [
    { quality: '128k', url: 'https://api.test/a?q=晴天', check: () => true },
    { quality: 'flac', url: 'https://api.test/b', check: () => true },
  ])
  const events = m.__debug.getHealthEvents({}).events.filter(e => e.event === 'probe_result')
  assert(events.length === 2, `应有 2 条 probe_result，实际 ${events.length}`)
  const text = JSON.stringify(events)
  for (const bad of ['api.test', '晴天', 'url', 'songName']) assert(!text.includes(bad), `事件含敏感字段 ${bad}`)
})

}

main().then(() => {
console.log(`\n${passed} passed, ${failures.length} failed`)
if (failures.length) {
  for (const f of failures) console.log(`- ${f}`)
  process.exit(1)
}
process.exit(0)

})
