#!/usr/bin/env node
/**
 * Batch 2 探测与质量档（B1~B9）
 *
 * 验收：逐 target 三值、事件每 target 一条、flac 失败/128k 成功只降级不关源、
 * 本地断网 UNKNOWN 不关源、半开单 trial（由 Q 组覆盖）、探针不清 playDead、
 * 单源只读/全局显式 apply、suyinKuwo 三档齐全、探针目标全部走 handler。
 *
 * 用法：node test/audit/health-probe-batch2.js
 */
'use strict'
const path = require('path')
const SRC = path.join(__dirname, '../../lx-source.js')
let routes = {}
const setLx = () => {
  globalThis.lx = {
    EVENT_NAMES: { inited: 'inited', request: 'request', updateAlert: 'updateAlert' },
    version: '2.0.0', env: 'mobile',
    utils: { buffer: { from: (d, e) => Buffer.from(d, e), bufToString: (b, e) => b.toString(e) } },
    request(url, opts, cb) {
      const r = routes[url] || routes['*'] || { err: Object.assign(new Error('ECONNREFUSED'), { code: 'ECONNREFUSED' }) }
      setTimeout(() => cb(r.err || null, r.err ? null : r.res), 2)
      return () => {}
    },
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
const check = async (name, fn) => {
  try { await fn(); passed++; console.log(`✓ ${name}`) } catch (e) { failures.push(`${name} — ${e.message}`); console.log(`✗ ${name} — ${e.message}`) }
}
const assert = (c, m) => { if (!c) throw new Error(m) }
const ok = body => ({ res: { statusCode: 200, headers: { 'content-type': 'application/json' }, body } })
const ID = 'suyinKuwo'
const probe = (m, probes) => m.__debug.probeSingleSource(ID, { probes })

const main = async () => {
await check('B1 suyinKuwo 三档探针齐全，目标全部走 handler', async () => {
  const m = fresh()
  const pc = m.buildProbeConfig()[ID]
  assert(pc && pc.probes.length === 3, `探针数 ${pc && pc.probes.length}`)
  assert(pc.probes.map(p => p.quality).join(',') === 'flac,320k,128k', '音质档顺序/数量不符')
  assert(pc.probes.every(p => p.useHandler === true), '存在未走 handler 的探针目标')
})

await check('B2 每个 target 一条 probe_result，字段无 URL/歌名', async () => {
  routes = { 'https://api.test/a': ok('{"ok":true}'), 'https://api.test/b': ok('{"ok":false}') }
  const m = fresh()
  const r = await probe(m, [
    { quality: 'flac', url: 'https://api.test/a', check: b => JSON.stringify(b).includes('true') },
    { quality: '128k', url: 'https://api.test/b', check: b => JSON.stringify(b).includes('true') },
  ])
  const events = m.__debug.getHealthEvents().events.filter(e => e.event === 'probe_result' && e.sourceId === ID)
  assert(events.length === 2, `事件数 ${events.length}`)
  assert(events[0].traceId === events[1].traceId && !!events[0].traceId, '同轮 traceId 应一致')
  for (const e of events) assert(!/url|song|name/i.test(JSON.stringify(e)), `事件含敏感字段：${JSON.stringify(e)}`)
})

await check('B3 flac FAIL + 128k PASS → 源 PASS，记录逐档结果且不关源', async () => {
  routes = { 'https://api.test/flac': ok('{"ok":false}'), 'https://api.test/128k': ok('{"ok":true}') }
  const m = fresh()
  const r = await probe(m, [
    { quality: 'flac', url: 'https://api.test/flac', check: b => JSON.stringify(b).includes('true') },
    { quality: '128k', url: 'https://api.test/128k', check: b => JSON.stringify(b).includes('true') },
  ])
  assert(r.outcome === 'PASS' && r.usable === true, `源级应 PASS，实际 ${r.outcome}`)
  const byQ = Object.fromEntries(r.targets.map(t => [t.quality, t.outcome]))
  assert(byQ.flac === 'FAIL' && byQ['128k'] === 'PASS', JSON.stringify(byQ))
  m.applyProbeResult(ID, r.usable, r)
  const s = m.__debug.getHealthSnapshot()[ID]
  assert(s.autoOff === false && s.enabled === true, `不应关源：${JSON.stringify({ autoOff: s.autoOff, enabled: s.enabled })}`)
  assert(s.probeTargets.length === 2, '快照应保留逐档探测结果')
})

await check('B4 本地断网 UNKNOWN：不关源、不计 FAIL', async () => {
  routes = { '*': { err: Object.assign(new Error('timeout'), { code: 'NETWORK_TIMEOUT' }) } }
  const m = fresh()
  const r = await probe(m, [{ quality: '128k', url: 'https://api.test/t', check: () => true }])
  assert(r.outcome === 'UNKNOWN' && r.unknownCount === 1 && r.failCount === 0, JSON.stringify({ outcome: r.outcome, fail: r.failCount, unknown: r.unknownCount }))
  for (let i = 0; i < 3; i++) m.applyProbeResult(ID, r.usable, { outcome: r.outcome })
  const s = m.__debug.getHealthSnapshot()[ID]
  assert(s.enabled === true && s.autoOff === false, 'UNKNOWN 不应自动关源')
})

await check('B5 全档 FAIL 连续两轮才关源，userEnabled 不变', async () => {
  routes = { '*': ok('{"ok":false}') }
  const m = fresh()
  const r = await probe(m, [
    { quality: 'flac', url: 'https://api.test/f', check: b => JSON.stringify(b).includes('true') },
    { quality: '128k', url: 'https://api.test/1', check: b => JSON.stringify(b).includes('true') },
  ])
  assert(r.outcome === 'FAIL', `应 FAIL，实际 ${r.outcome}`)
  m.applyProbeResult(ID, r.usable, r)
  assert(m.__debug.getHealthSnapshot()[ID].autoOff === false, '单轮 FAIL 不应关源')
  m.applyProbeResult(ID, r.usable, r)
  const s = m.__debug.getHealthSnapshot()[ID]
  assert(s.autoOff === true && s.userEnabled === true && s.offReason === 'AUTO_OFF_PROBE', JSON.stringify({ autoOff: s.autoOff, userEnabled: s.userEnabled, offReason: s.offReason }))
})

await check('B6 探测 PASS 不清 playDead/不影响真实播放状态', async () => {
  routes = { 'https://api.test/ok': ok('{"ok":true}') }
  const m = fresh()
  m.__debug.playDeadStreak.set(ID, 3)
  m.__debug.playDeadDeadline.set(ID, Date.now())
  await probe(m, [{ quality: '128k', url: 'https://api.test/ok', check: b => JSON.stringify(b).includes('true') }])
  m.applyProbeResult(ID, true, { outcome: 'PASS' })
  const s = m.__debug.getHealthSnapshot()[ID]
  assert(s.playDead === true || s.offReason === 'PLAY_DEAD', `探测不应清 playDead：${JSON.stringify({ playDead: s.playDead, offReason: s.offReason })}`)
})

await check('B7 单源探测默认只读，显式 apply 才改状态', async () => {
  const src = require('fs').readFileSync(path.join(__dirname, '../../src/legacy.js'), 'utf-8')
  const body = src.slice(src.indexOf('if (action === "probeSource")'), src.indexOf('if (action === "probe")', src.indexOf('if (action === "probeSource")')))
  assert(/info\.apply === true/.test(body), 'probeSource 缺显式 apply 守卫')
  assert(body.includes('applied: !!(info && info.apply === true)'), 'probeSource 未回传 applied')
  const globalBody = src.slice(src.indexOf('if (action === "probe")', src.indexOf('if (action === "probeSource")')))
  assert(/applyProbeResult/.test(globalBody), '全局 probe 应显式应用结果')
})

await check('B8 快照按档结果只读、无 URL/歌名/账号', async () => {
  routes = { 'https://api.test/a': ok('{"ok":true}') }
  const m = fresh()
  const r = await probe(m, [{ quality: '128k', url: 'https://api.test/a', check: b => JSON.stringify(b).includes('true') }])
  m.applyProbeResult(ID, r.usable, r)
  const s = m.__debug.getHealthSnapshot()[ID]
  assert(s.probeTargets.length === 1, '快照应给 probeTargets')
  const dumped = JSON.stringify(s.probeTargets)
  assert(!/https?:|token|cookie|account|songName/i.test(dumped), `probeTargets 含敏感字段：${dumped}`)
})

await check('B9 探测事件环保留 transition 优先（Batch 2 边界）', async () => {
  const m = fresh()
  m.__debug.recordHealthEvent({ event: 'health_transition', sourceId: ID, from: 'ELIGIBLE', to: 'AUTO_OFF', reason: 'auto_off_probe' })
  for (let i = 0; i < 600; i++) m.__debug.recordHealthEvent({ event: 'probe_result', sourceId: ID, ok: false, code: 'FAIL' })
  const events = m.__debug.getHealthEvents().events
  assert(events.some(e => e.event === 'health_transition'), 'transition 被 probe 挤掉')
})

console.log(`\n${passed} passed, ${failures.length} failed`)
if (failures.length) { console.log(failures.join('\n')); process.exit(1) }
process.exit(0)
}
main()
