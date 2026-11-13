#!/usr/bin/env node
/**
 * v8.14 统一资格入口审计（V 组）
 *
 * 验收：USER_OFF / DEFAULT_OFF / PLAYBACK_FAILED / ELIGIBLE 的 code 与原因稳定；
 * 关闭原因优先级不被运行期状态覆盖。
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
  const m = load()
  return m
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
check('V1', '默认关闭源为 DEFAULT_OFF，不是 USER_OFF', () => {
  const e = d.computeEligibility('suyinQQ', 'tx', '128k', { runtime: false })
  assert(e.eligible === false, '应不可用')
  assert(e.code === 'DEFAULT_OFF', `code=${e.code}`)
})

check('V2', '手动开启后 ELIGIBLE', () => {
  d.toggleSource('suyinQQ', true)
  const e = d.computeEligibility('suyinQQ', 'tx', '128k', { runtime: false })
  assert(e.eligible === true, '应可用')
  assert(e.code === 'ELIGIBLE', `code=${e.code}`)
})

check('V3', '手动关闭优先于其他状态', () => {
  d.toggleSource('suyinQQ', false)
  const e = d.computeEligibility('suyinQQ', 'tx', '128k', { runtime: true })
  assert(e.eligible === false, '应不可用')
  assert(e.code === 'USER_OFF', `code=${e.code}`)
  assert(e.reason === 'user-off', `reason=${e.reason}`)
})

check('V4', '真实播放失败累计后为 PLAYBACK_FAILED', () => {
  for (let i = 0; i < 3; i++) m.recordFailure('suyinKuwo', 'flac', { playDead: true })
  const e = d.computeEligibility('suyinKuwo', 'kw', 'flac', { runtime: false })
  assert(e.eligible === false, '应不可用')
  assert(e.code === 'PLAYBACK_FAILED', `code=${e.code}`)
  assert(e.reason === 'play-dead', `reason=${e.reason}`)
})

check('V5', '取链失败不累计摘除（playDead=false）', () => {
  for (let i = 0; i < 3; i++) m.recordFailure('suyinKuwo', 'flac', { playDead: false })
  const e = d.computeEligibility('suyinKuwo', 'kw', 'flac', { runtime: false })
  assert(e.code === 'PLAYBACK_FAILED', '前置摘除仍应保留')
})

check('V6', '诊断调用不消费半开 trial', () => {
  const before = d.trialMarkOf('suyinKuwo')
  d.computeEligibility('suyinKuwo', 'kw', 'flac', { runtime: true, consumePlayDeadTrial: false })
  d.computeEligibility('suyinKuwo', 'kw', 'flac', { runtime: true, consumePlayDeadTrial: false })
  assert(d.trialMarkOf('suyinKuwo') === before, '诊断不得改 trial 标记')
})

check('V7', '质量档短路走统一资格入口，链构建不再二次过滤', () => {
  d.toggleSource('helloworldKw', true)
  for (let i = 0; i < 3; i++) m.recordFailure('helloworldKw', 'flac', { playDead: false })
  const e = d.computeEligibility('helloworldKw', 'kw', 'flac', { runtime: false, qualityShortCircuit: true })
  assert(e.eligible === false, '应不可用')
  assert(e.code === 'QUALITY_SHORT_CIRCUIT', `code=${e.code}`)
  const chain = d.buildSourceChain('kw', 'flac')
  assert(!chain.some(h => h.id === 'helloworldKw'), '短路源不应出现在 flac 链')
})

console.log(`\n${passed} passed, ${failures.length} failed`)
if (failures.length) {
  for (const f of failures) console.log(`- ${f}`)
  process.exit(1)
}
if (require.main === module) process.exit(0)
