#!/usr/bin/env node
/**
 * F20/F22 探测三值语义审计（O1~O9）
 *
 * 覆盖：逐档 PASS/FAIL/UNKNOWN、源级聚合、UNKNOWN 不累计失败、
 * 探测通过不解除 playDead/resolveDead、事件不含 URL。
 *
 * 用法：node test/audit/health-probe-outcome.js
 */
'use strict'

const path = require('path')
const SRC = path.join(__dirname, '../../lx-source.js')
let handler = null
let reqMode = 'pass'

const setLx = () => {
  handler = null
  globalThis.lx = {
    EVENT_NAMES: { inited: 'inited', request: 'request', updateAlert: 'updateAlert' },
    version: '2.0.0',
    env: 'mobile',
    utils: { buffer: { from: (d, e) => Buffer.from(d, e), bufToString: (b, e) => b.toString(e) } },
    request(url, opts, cb) {
      setTimeout(() => {
        if (reqMode === 'timeout' || url.includes('/timeout/')) return cb(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }), null)
        if (reqMode === 'fail' || url.includes('/fail/')) return cb(null, { statusCode: 404, body: '{}', headers: {} })
        if (reqMode === 'server') return cb(null, { statusCode: 500, body: '{}', headers: {} })
        return cb(null, { statusCode: 200, body: JSON.stringify({ ok: true }), headers: {} })
      }, 1)
      return () => {}
    },
    on(n, h) { if (n === 'request') handler = h },
    send() {},
  }
}

const fresh = (cfg = {}) => {
  setLx()
  reqMode = 'pass'
  globalThis.__lxSourceConfig = Object.assign({}, cfg)
  const p = require.resolve(SRC)
  if (require.cache[p]) delete require.cache[p]
  return require(SRC)
}

let passed = 0
const failures = []
const check = async(name, fn) => {
  const id = (String(name).match(/^[A-Za-z]+\d+[a-z]?/) || [String(name)])[0]
  try { await fn(); passed++; console.log(`✓ [${id}] ${name}`) } catch (e) { failures.push(`${name} — ${e.message}`); console.log(`✗ [${id}] ${name} — ${e.message}`) }
}
const assert = (c, m) => { if (!c) throw new Error(m) }
const pc = (quality, mode = 'pass') => ({ quality, url: `https://probe.test/${mode}/${quality}`, checkRes: () => true })
const probe = m => m.__debug.probeSingleSource('suyinKuwo', { probes: [pc('128k')] })

;(async() => {
  await check('O1 单档成功 = PASS，targets 保留档位', async() => {
    const m = fresh()
    const r = await probe(m)
    assert(r.outcome === 'PASS' && r.usable === true, `应为 PASS：${r.outcome}`)
    assert(r.targets.length === 1 && r.targets[0].quality === '128k', 'targets 档位丢失')
    assert(r.targets[0].outcome === 'PASS' && r.targets[0].code === null, 'targets 结果异常')
  })

  await check('O2 HTTP 404 = FAIL，不是 UNKNOWN', async() => {
    const m = fresh()
    reqMode = 'fail'
    const r = await probe(m)
    assert(r.outcome === 'FAIL' && r.code === 'NOT_FOUND', `404 应为 FAIL/NOT_FOUND：${r.outcome}/${r.code}`)
  })

  await check('O3 本地超时 = UNKNOWN，不当作源死亡', async() => {
    const m = fresh()
    reqMode = 'timeout'
    const r = await probe(m)
    assert(r.outcome === 'UNKNOWN' && r.code === 'NETWORK_TIMEOUT', `超时应为 UNKNOWN：${r.outcome}/${r.code}`)
    assert(r.failCount === 0 && r.unknownCount === 1, 'UNKNOWN 不得计入 fail')
  })

  await check('O4 任一档 PASS，源级聚合为 PASS；逐档保留 FAIL', async() => {
    const m = fresh()
    const pcs = [pc('128k', 'pass'), pc('flac', 'fail')]
    const r = await m.__debug.probeSingleSource('suyinKuwo', { probes: pcs })
    assert(r.outcome === 'PASS' && r.passCount === 1 && r.failCount === 1, '源级聚合错误')
    assert(r.targets.find(t => t.quality === 'flac').outcome === 'FAIL', 'flac 应保留 FAIL')
  })

  await check('O5 全部档 FAIL，源级聚合为 FAIL', async() => {
    const m = fresh()
    reqMode = 'fail'
    const r = await m.__debug.probeSingleSource('suyinKuwo', { probes: [pc('128k'), pc('320k')] })
    assert(r.outcome === 'FAIL' && r.usable === false && r.failCount === 2, '全 FAIL 聚合错误')
  })

  await check('O6 全部档 UNKNOWN，源级聚合为 UNKNOWN', async() => {
    const m = fresh()
    reqMode = 'timeout'
    const r = await m.__debug.probeSingleSource('suyinKuwo', { probes: [pc('128k'), pc('320k')] })
    assert(r.outcome === 'UNKNOWN' && r.unknownCount === 2, '全 UNKNOWN 聚合错误')
  })

  await check('O7 applyProbeResult(UNKNOWN) 不累计失败、不关闭源', async() => {
    const m = fresh()
    m.applyProbeResult('suyinKuwo', false, { outcome: 'UNKNOWN', targets: [{ quality: '128k', outcome: 'UNKNOWN', code: 'NETWORK_TIMEOUT' }] })
    assert((m.probeState.failCount.suyinKuwo || 0) === 0, 'UNKNOWN 不应写 failCount')
    assert(m.runtimeToggles.suyinKuwo !== false, 'UNKNOWN 不应关闭源')
    const ev = m.__debug.getHealthEvents({}).events.find(e => e.event === 'health_transition' && e.reason === 'probe_unknown')
    assert(ev && ev.sourceId === 'suyinKuwo', '缺少 probe_unknown transition 事件')
  })

  await check('O8 探测 PASS 不复位 playDead/resolveDead', async() => {
    const m = fresh()
    for (let i = 0; i < 3; i++) m.__debug.bumpResolveDead('suyinKuwo')
    assert(m.__debug.isResolveDead('suyinKuwo', '128k', false) === true, '构造 resolveDead 失败')
    m.applyProbeResult('suyinKuwo', true, { outcome: 'PASS', targets: [{ quality: '128k', outcome: 'PASS' }] })
    assert(m.__debug.isResolveDead('suyinKuwo', '128k', false) === true, '探测 PASS 不得清 resolveDead')
    assert(m.getHealthSnapshot().suyinKuwo.resolveDead === true, '快照应仍显示 resolveDead')
  })

  await check('O9 probe_result 事件只留枚举/延迟，不含 URL', async() => {
    const m = fresh()
    await probe(m)
    const ev = m.__debug.getHealthEvents({}).events.find(e => e.event === 'probe_result')
    assert(ev && ev.reason === 'PASS' && ev.quality === '128k', 'probe_result 缺少三值/档位')
    const text = JSON.stringify(ev)
    assert(!text.includes('probe.test') && !text.includes('https://'), '事件不得带探测 URL')
  })

  console.log(`\n${passed} passed, ${failures.length} failed`)
  if (failures.length) {
    for (const f of failures) console.log(`- ${f}`)
    process.exit(1)
  }
  process.exit(0)
})()
