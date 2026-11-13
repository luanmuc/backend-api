#!/usr/bin/env node
/**
 * v8.14 健康联动不变量审计（I1 / I12 / F61 / F64）
 *
 * 验收：
 * 1. 链项必须携带本次裁决的 eligibility，且链内项均为 eligible；
 * 2. 链构建与 skipReason 对同一源的结论一致；
 * 3. 建链后用户关源，旧链项在 wrapExecute 发请求前必须被重新拦截。
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
  globalThis.__lxSourceConfig = {}
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
const checkAsync = async (id, name, fn) => {
  try {
    await fn()
    passed++
    console.log(`✓ ${id} ${name}`)
  } catch (e) {
    failures.push(`[${id}] ${name} — ${e.message}`)
    console.log(`✗ ${id} ${name} — ${e.message}`)
  }
}

const main = async () => {
  const m = fresh()
  const d = m.__debug

  check('L1', '每个链项都带 eligibility，且链内项均为 eligible', () => {
    for (const platform of ['kw', 'wy', 'tx', 'mg', 'kg']) {
      const chain = d.buildSourceChain(platform, '128k')
      assert(chain.length > 0, `${platform} 链为空`)
      for (const item of chain) {
        assert(item.eligibility && typeof item.eligibility === 'object', `${platform}/${item.id} 缺 eligibility`)
        assert(item.eligibility.eligible === true, `${platform}/${item.id} 链项 eligibility 非 eligible`)
        assert(item.eligibility.code === 'ELIGIBLE', `${platform}/${item.id} code=${item.eligibility.code}`)
      }
    }
  })

  check('L2', '链项与 skipReason 结论一致', () => {
    for (const platform of ['kw', 'wy', 'tx', 'mg', 'kg']) {
      const chain = d.buildSourceChain(platform, '128k')
      const ids = new Set(chain.map(x => x.id))
      for (const id of Object.keys(m.SOURCE_HANDLERS)) {
        const h = m.SOURCE_HANDLERS[id]
        if (!h || h.lifecycle !== m.PROVIDER_LIFECYCLE.ACTIVE) continue
        const skip = d.skipReason(id, { platform, quality: '128k' })
        if (skip) assert(!ids.has(id), `${id} 在 ${platform} 链中但 skipReason=${skip.code}`)
      }
    }
  })

  check('L3', '手动关闭后链立即排除该源', () => {
    d.toggleSource('helloworldKw', true)
    assert(d.buildSourceChain('kw', 'flac').some(x => x.id === 'helloworldKw'), '开启后应进链')
    d.toggleSource('helloworldKw', false)
    assert(!d.buildSourceChain('kw', 'flac').some(x => x.id === 'helloworldKw'), '关闭后不应进链')
    const skip = d.skipReason('helloworldKw', { platform: 'kw', quality: 'flac' })
    assert(skip && skip.code === 'USER_OFF', `skip=${skip && skip.code}`)
  })

  await checkAsync('L4', '建链后关源，旧链项在发请求前被重新拦截', async () => {
    d.toggleSource('helloworldKw', true)
    const chain = d.buildSourceChain('kw', 'flac')
    const item = chain.find(x => x.id === 'helloworldKw')
    assert(item && item.eligibility, '缺少旧链项')
    d.toggleSource('helloworldKw', false)
    let called = false
    const wrapped = Object.assign({}, item, { fn: () => { called = true; return Promise.resolve('http://example.com/a.mp3') } })
    let err = null
    try {
      await d.wrapExecute(wrapped, 'kw', { name: '晴天', singer: '周杰伦', songmid: '1' }, 'flac', d.createCancelToken())
    } catch (e) {
      err = e
    }
    assert(err, '应抛出门禁错误')
    assert(err.isThrottleSkip === true, `isThrottleSkip=${err.isThrottleSkip}`)
    assert(/USER_OFF/.test(String(err.code) + String(err.message)), `错误未体现 USER_OFF: ${err.code} ${err.message}`)
    assert(called === false, '资格失效后不得调用源函数')
  })

  check('L5', 'platformSummary 只按 eligible 聚合，playDead 源不计 active（F17/F68）', () => {
    for (let i = 0; i < 3; i++) m.recordFailure('suyinKuwo', '128k', { playDead: true })
    const snap = d.getHealthSnapshot()
    const eligibleIds = new Set()
    for (const q of ['128k', '320k', 'flac', 'flac24bit']) {
      for (const h of d.buildSourceChain('kw', q)) eligibleIds.add(h.id)
    }
    const sum = snap._platformSummary && snap._platformSummary.kw
    assert(sum, '缺少 kw platformSummary')
    assert(sum.activeCount === eligibleIds.size, `activeCount=${sum.activeCount}，eligible=${eligibleIds.size}`)
    assert(sum.deadCount >= 1, `playDead 源应计入 deadCount，实际 ${sum.deadCount}`)
    assert(!eligibleIds.has('suyinKuwo'), 'playDead 源不应在 eligible 集合')
  })

  console.log(`\n${passed} passed, ${failures.length} failed`)
  if (failures.length) {
    for (const f of failures) console.log(`- ${f}`)
    process.exit(1)
  }
  process.exit(0)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
