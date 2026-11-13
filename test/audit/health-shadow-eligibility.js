#!/usr/bin/env node
/**
 * Batch 0 影子裁决（S1~S10）
 *
 * 旧裁决只认 structuralSkipReason（manual/playDead）+ 旧 canExecute
 * （rateLimit/open/half-open）；新裁决走 computeEligibility，额外区分
 * autoOff/sleeping/resolveDead/qualityShortCircuit。影子函数必须只读，
 * 逐步解释每条 diff，且建链/快照/事件零变化。
 *
 * 用法：node test/audit/health-shadow-eligibility.js
 */
'use strict'
const path = require('path')
const SRC = path.join(__dirname, '../../lx-source.js')
const setLx = () => {
  globalThis.lx = {
    EVENT_NAMES: { inited: 'inited', request: 'request', updateAlert: 'updateAlert' },
    version: '2.0.0',
    env: 'mobile',
    utils: { buffer: { from: (d, e) => Buffer.from(d, e), bufToString: (b, e) => b.toString(e) } },
    request(url, opts, cb) { setTimeout(() => cb(Object.assign(new Error('ECONNREFUSED'), { code: 'ECONNREFUSED' }), null), 2); return () => {} },
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
const check = (name, fn) => {
  try { fn(); passed++; console.log(`✓ ${name}`) } catch (e) { failures.push(`${name} — ${e.message}`); console.log(`✗ ${name} — ${e.message}`) }
}
const assert = (c, m) => { if (!c) throw new Error(m) }
const shape = r => ({ eligible: r.eligible, reason: r.reason, code: r.code })

const diffReason = (legacy, modern) => {
  const pair = `${legacy.code}->${modern.code}`
  const map = {
    'USER_OFF->AUTO_OFF_PROBE': 'AUTO_OFF_OLD_COLLAPSED_TO_USER_OFF',
    'ELIGIBLE->SOURCE_SLEEPING': 'SLEEPING_OLD_NOT_IN_STRUCTURAL_GATE',
    'ELIGIBLE->PLAYBACK_FAILED': 'RESOLVE_DEAD_NEW_GATE',
    'PLAY_DEAD->PLAYBACK_FAILED': 'PLAY_DEAD_OLD_CODE_COLLAPSED',
    'ELIGIBLE->QUALITY_SHORT_CIRCUIT': 'QUALITY_SHORT_CIRCUIT_NEW_GATE',
    'QUALITY_OPEN->QUALITY_SHORT_CIRCUIT': 'SHORT_CIRCUIT_TAXONOMY_REPLACES_SOURCE_OPEN',
    'ELIGIBLE->RATE_LIMITED': 'RATE_LIMIT_OLD_ONLY_IN_CAN_EXECUTE',
    'ELIGIBLE->QUALITY_HALF_OPEN': 'HALF_OPEN_OLD_ONLY_IN_CAN_EXECUTE',
    'ELIGIBLE->QUALITY_OPEN': 'OPEN_OLD_ONLY_IN_CAN_EXECUTE',
  }
  return { pair, explanation: map[pair] || null }
}

const scenarios = [
  {
    name: 'normal', setup() {},
  },
  {
    name: 'manual-off', setup(m) { m.__debug.toggleSource('suyinKuwo', false) },
  },
  {
    name: 'auto-off', setup(m) {
      for (let i = 0; i < 2; i++) m.applyProbeResult('suyinKuwo', false, { outcome: 'FAIL' })
    },
    expect: 'AUTO_OFF_OLD_COLLAPSED_TO_USER_OFF',
  },
  {
    name: 'sleeping', setup(m) { m.probeState.sleeping.suyinKuwo = true },
    expect: 'SLEEPING_OLD_NOT_IN_STRUCTURAL_GATE',
  },
  {
    name: 'resolve-dead', setup(m) {
      for (let i = 0; i < 3; i++) m.__debug.bumpResolveDead('suyinKuwo', '128k')
    },
    expect: 'RESOLVE_DEAD_NEW_GATE',
  },
  {
    name: 'quality-short-circuit', setup(m) {
      for (let i = 0; i < 3; i++) m.__debug.applyAdmission({ verdict: 'FAIL', ledger: { health: 'hardFail' } }, { source: 'suyinKuwo', quality: 'flac' })
    },
    quality: 'flac',
    expect: 'QUALITY_SHORT_CIRCUIT_NEW_GATE',
  },
  {
    name: 'play-dead', setup(m) {
      m.__debug.playDeadStreak.set('suyinKuwo', 3)
      m.__debug.playDeadDeadline.set('suyinKuwo', Date.now())
    },
    expect: 'PLAY_DEAD_OLD_CODE_COLLAPSED',
  },
  {
    name: 'rate-limit', setup(m) {
      const br = m.__debug.breakerMap.get('suyinKuwo') || {}
      br.rateLimitUntil = Date.now() + 30000
      br.rateLimited = true
    },
  },
  {
    name: 'half-open', setup(m) {
      const br = m.__debug.breakerMap.get('suyinKuwo') || {}
      br.state = 'half-open'
      br.lastFailureTime = Date.now()
    },
  },
  {
    name: 'breaker-open', setup(m) {
      const br = m.__debug.breakerMap.get('suyinKuwo') || {}
      br.state = 'open'
      br.lastFailureTime = Date.now()
    },
  },
]

check('S1 正常源新旧一致，无 diff', () => {
  const m = fresh()
  const legacy = shape(m.__debug.shadowLegacyEligibility('suyinKuwo', 'kw', '128k'))
  const modern = shape(m.__debug.computeEligibility('suyinKuwo', 'kw', '128k', { runtime: false, qualityShortCircuit: true }))
  assert(legacy.code === 'ELIGIBLE' && modern.code === 'ELIGIBLE', `正常源应 ELIGIBLE：${legacy.code}/${modern.code}`)
  assert(legacy.eligible === modern.eligible, 'eligible 应一致')
})

check('S2 手动关闭新旧同码 but 旧 reason 粗粒度有解释', () => {
  const m = fresh()
  m.__debug.toggleSource('suyinKuwo', false)
  const legacy = shape(m.__debug.shadowLegacyEligibility('suyinKuwo', 'kw', '128k'))
  const modern = shape(m.__debug.computeEligibility('suyinKuwo', 'kw', '128k', { runtime: false, qualityShortCircuit: true }))
  assert(legacy.code === 'USER_OFF' && modern.code === 'USER_OFF', `手动关闭应同码：${legacy.code}/${modern.code}`)
  assert(legacy.reason === 'manual-off', '旧 reason 应 manual-off')
})

check('S3 自动关闭：旧折叠成 USER_OFF，新区分 AUTO_OFF_PROBE', () => {
  const m = fresh()
  for (let i = 0; i < 2; i++) m.applyProbeResult('suyinKuwo', false, { outcome: 'FAIL' })
  const legacy = shape(m.__debug.shadowLegacyEligibility('suyinKuwo', 'kw', '128k'))
  const modern = shape(m.__debug.computeEligibility('suyinKuwo', 'kw', '128k', { runtime: false, qualityShortCircuit: true }))
  assert(legacy.code === 'USER_OFF' && modern.code === 'AUTO_OFF_PROBE', `auto-off diff 不符：${legacy.code}/${modern.code}`)
  assert(diffReason(legacy, modern).explanation === 'AUTO_OFF_OLD_COLLAPSED_TO_USER_OFF', 'auto-off diff 未解释')
})

check('S4 休眠：旧结构门完全看不到，新 SOURCE_SLEEPING', () => {
  const m = fresh()
  m.probeState.sleeping.suyinKuwo = true
  const legacy = shape(m.__debug.shadowLegacyEligibility('suyinKuwo', 'kw', '128k'))
  const modern = shape(m.__debug.computeEligibility('suyinKuwo', 'kw', '128k', { runtime: false, qualityShortCircuit: true }))
  assert(legacy.code === 'ELIGIBLE' && modern.code === 'SOURCE_SLEEPING', `sleeping diff 不符：${legacy.code}/${modern.code}`)
  assert(diffReason(legacy, modern).explanation === 'SLEEPING_OLD_NOT_IN_STRUCTURAL_GATE', 'sleeping diff 未解释')
})

check('S5 resolveDead：旧可进链，新 PLAYBACK_FAILED', () => {
  const m = fresh()
  for (let i = 0; i < 3; i++) m.__debug.bumpResolveDead('suyinKuwo', '128k')
  const legacy = shape(m.__debug.shadowLegacyEligibility('suyinKuwo', 'kw', '128k'))
  const modern = shape(m.__debug.computeEligibility('suyinKuwo', 'kw', '128k', { runtime: false, qualityShortCircuit: true }))
  assert(legacy.code === 'ELIGIBLE' && modern.code === 'PLAYBACK_FAILED', `resolveDead diff 不符：${legacy.code}/${modern.code}`)
  assert(diffReason(legacy, modern).explanation === 'RESOLVE_DEAD_NEW_GATE', 'resolveDead diff 未解释')
})

check('S6 单档短路：旧结构门看不到，新 QUALITY_SHORT_CIRCUIT', () => {
  const m = fresh()
  for (let i = 0; i < 3; i++) m.__debug.applyAdmission({ verdict: 'FAIL', ledger: { health: 'hardFail' } }, { source: 'suyinKuwo', quality: 'flac' })
  const legacy = shape(m.__debug.shadowLegacyEligibility('suyinKuwo', 'kw', 'flac'))
  const modern = shape(m.__debug.computeEligibility('suyinKuwo', 'kw', 'flac', { runtime: false, qualityShortCircuit: true }))
  assert(legacy.code === 'ELIGIBLE' && modern.code === 'QUALITY_SHORT_CIRCUIT', `short diff 不符：${legacy.code}/${modern.code}`)
  assert(diffReason(legacy, modern).explanation === 'QUALITY_SHORT_CIRCUIT_NEW_GATE', 'short diff 未解释')
})

check('S6b playDead：旧 reason 保留但 code 折叠，新 PLAYBACK_FAILED', () => {
  const m = fresh()
  m.__debug.playDeadStreak.set('suyinKuwo', 3)
  m.__debug.playDeadDeadline.set('suyinKuwo', Date.now())
  const legacy = shape(m.__debug.shadowLegacyEligibility('suyinKuwo', 'kw', '128k'))
  const modern = shape(m.__debug.computeEligibility('suyinKuwo', 'kw', '128k', { runtime: false, qualityShortCircuit: true }))
  assert(legacy.code === 'PLAY_DEAD' && modern.code === 'PLAYBACK_FAILED', `playDead diff 不符：${legacy.code}/${modern.code}`)
  assert(diffReason(legacy, modern).explanation === 'PLAY_DEAD_OLD_CODE_COLLAPSED', 'playDead diff 未解释')
})

check('S7 rateLimit/open/half-open 不进旧结构门，链层新旧同 ELIGIBLE', () => {
  for (const name of ['rateLimit', 'open', 'half-open']) {
    const m = fresh()
    let br = m.__debug.breakerMap.get('suyinKuwo')
    if (!br) { br = { byQuality: {} }; m.__debug.breakerMap.set('suyinKuwo', br) }
    if (name === 'rateLimit') { br.rateLimitUntil = Date.now() + 30000; br.rateLimited = true }
    if (name === 'open') { br.state = 'open'; br.lastFailureTime = Date.now() }
    if (name === 'half-open') { br.state = 'half-open'; br.lastFailureTime = Date.now() }
    const legacy = shape(m.__debug.shadowLegacyEligibility('suyinKuwo', 'kw', '128k'))
    const modern = shape(m.__debug.computeEligibility('suyinKuwo', 'kw', '128k', { runtime: false, qualityShortCircuit: true }))
    assert(legacy.code === 'ELIGIBLE' && modern.code === 'ELIGIBLE', `${name} 链层应同 ELIGIBLE：${legacy.code}/${modern.code}`)
  }
})

check('S8 场景矩阵每条 diff 都有解释，无未解释项', () => {
  const diffs = []
  for (const sc of scenarios) {
    const m = fresh()
    sc.setup(m)
    const q = sc.quality || '128k'
    const legacy = shape(m.__debug.shadowLegacyEligibility('suyinKuwo', 'kw', q))
    const modern = shape(m.__debug.computeEligibility('suyinKuwo', 'kw', q, { runtime: false, qualityShortCircuit: true }))
    if (legacy.code !== modern.code) {
      const d = diffReason(legacy, modern)
      assert(d.explanation, `${sc.name} diff 未解释：${d.pair}`)
      diffs.push(`${sc.name}: ${d.pair} => ${d.explanation}`)
    }
  }
  console.log('\n影子 diff 清单：')
  if (!diffs.length) console.log('  （无）')
  for (const d of diffs) console.log(`  - ${d}`)
})

check('S9 影子只读：建链/快照/事件前后零变化', () => {
  const m = fresh()
  for (const sc of scenarios) sc.setup(m)
  const chainBefore = JSON.stringify(m.__debug.buildSourceChain('kw', '128k').map(h => [h.id, h.eligibility && h.eligibility.code]))
  const snapBefore = JSON.stringify(m.__debug.getHealthSnapshot())
  const evBefore = m.__debug.getHealthEvents({}).events.length
  for (const sc of scenarios) {
    m.__debug.shadowLegacyEligibility('suyinKuwo', 'kw', sc.quality || '128k')
  }
  const chainAfter = JSON.stringify(m.__debug.buildSourceChain('kw', '128k').map(h => [h.id, h.eligibility && h.eligibility.code]))
  const snapAfter = JSON.stringify(m.__debug.getHealthSnapshot())
  const evAfter = m.__debug.getHealthEvents({}).events.length
  assert(chainBefore === chainAfter, '影子调用改变了建链结果')
  assert(snapBefore === snapAfter, '影子调用改变了快照')
  assert(evBefore === evAfter, '影子调用写入了事件')
})

check('S12 eligibilityShadow=true 时建链结果仍不变', () => {
  const off = fresh()
  const chainOff = JSON.stringify(off.__debug.buildSourceChain('kw', '128k').map(h => [h.id, h.eligibility.code]))
  const on = fresh({ eligibilityShadow: true })
  const chainOn = JSON.stringify(on.__debug.buildSourceChain('kw', '128k').map(h => [h.id, h.eligibility.code]))
  assert(chainOff === chainOn, '影子日志开关改变了建链结果')
})

check('S10 未知源旧裁决也拒绝，不伪造 eligible', () => {
  const m = fresh()
  const legacy = shape(m.__debug.shadowLegacyEligibility('not-a-source', 'kw', '128k'))
  assert(legacy.eligible === false && legacy.code === 'SOURCE_UNREACHABLE' && legacy.reason === 'unknown-source', `未知源旧裁决错误：${JSON.stringify(legacy)}`)
})

console.log(`\n${passed} passed, ${failures.length} failed`)
if (failures.length) {
  for (const f of failures) console.log(`- ${f}`)
  process.exit(1)
}
process.exit(0)
