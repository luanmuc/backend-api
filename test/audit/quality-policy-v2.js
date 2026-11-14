#!/usr/bin/env node
/**
 * 音质策略 P0/P1 审计（QP1~QP8）
 *
 * 覆盖：能力备档同档不续期、reason TTL、到期探路；档位短路只统计确定性失败；
 * 429/超时不进短路；成功路径保留原有恢复语义。
 *
 * 用法：node test/audit/quality-policy-v2.js
 */
'use strict'

const path = require('path')
const SRC = path.join(__dirname, '../../lx-source.js')
let handler = null
const setLx = () => {
  handler = null
  globalThis.lx = {
    EVENT_NAMES: { inited: 'inited', request: 'request', updateAlert: 'updateAlert' },
    version: '2.0.0', env: 'mobile',
    utils: { buffer: { from: (d, e) => Buffer.from(d, e), bufToString: (b, e) => b.toString(e) } },
    request(url, opts, cb) { setTimeout(() => cb(Object.assign(new Error('ECONNREFUSED'), { code: 'ECONNREFUSED' }), null), 2); return () => {} },
    on(n, h) { if (n === 'request') handler = h }, send() {},
  }
}
const fresh = (cfg = {}) => {
  setLx()
  globalThis.__lxSourceConfig = Object.assign({ healthCheckIntervalMs: 3600000, coldStartWarmEnabled: false }, cfg)
  const p = require.resolve(SRC)
  if (require.cache[p]) delete require.cache[p]
  return require(SRC)
}
let passed = 0
const failures = []
const check = (name, fn) => {
  const id = (String(name).match(/^[A-Za-z]+\d+[a-z]?/) || [String(name)])[0]
  try { fn(); passed++; console.log(`✓ [${id}] ${name}`) } catch (e) { failures.push(`${name} — ${e && e.message}`); console.log(`✗ [${id}] ${name} — ${e && e.message}`) }
}
const assert = (c, m) => { if (!c) throw new Error(m) }
const H = 3600000
const T = 600000

check('QP1 能力备档同档重复交付不刷新 recordedAt/nextProbeAt', () => {
  const m = fresh()
  const d = m.__debug
  const song = { songmid: 'qp1' }
  d.noteQualityCeiling('kw', song, '128k', 'definitive')
  const e1 = d.qualityCeilingMap.get('kw|qp1')
  const ts1 = e1.ts, probe1 = e1.nextProbeAt
  d.noteQualityCeiling('kw', song, '128k', 'definitive')
  const e2 = d.qualityCeilingMap.get('kw|qp1')
  assert(e2.ts === ts1, `ts 不得刷新: ${ts1}→${e2.ts}`)
  assert(e2.nextProbeAt === probe1, `nextProbeAt 不得后移: ${probe1}→${e2.nextProbeAt}`)
  assert(e2.reason === 'definitive' && e2.ttlMs === 6 * H, `definitive TTL 应为 6h`)
})

check('QP2 临时失败走短 TTL，429 不记上限', () => {
  const m = fresh()
  const d = m.__debug
  d.noteQualityCeiling('kw', { songmid: 'qp2' }, '128k', 'transient')
  const e = d.qualityCeilingMap.get('kw|qp2')
  assert(e.ttlMs === T, `transient TTL=${e.ttlMs}`)
  d.noteQualityCeiling('kw', { songmid: 'qp3' }, '128k', 'rate_limit')
  assert(!d.qualityCeilingMap.has('kw|qp3'), '429 不应写能力备档')
})

check('QP3 到期删除上限，允许重新试高质', () => {
  const m = fresh()
  const d = m.__debug
  const song = { songmid: 'qp4' }
  d.noteQualityCeiling('kw', song, '128k', 'transient')
  const e = d.qualityCeilingMap.get('kw|qp4')
  e.nextProbeAt = Date.now() - 1
  assert(d.getQualityCeiling('kw', song) === '', '到期应返回空，允许试高质')
  assert(!d.qualityCeilingMap.has('kw|qp4'), '到期应删除条目')
})

check('QP4 3 次超时不触发档位短路', () => {
  const m = fresh({ qualityShortCircuit: true, qualityShortCircuitSamples: 3 })
  const d = m.__debug
  d.toggleSource('helloworldKw', true)
  for (let i = 0; i < 3; i++) m.recordFailure('helloworldKw', 'flac', { playDead: false, code: m.ERROR_CODES.NETWORK_TIMEOUT })
  assert(d.isQualityHopeless('helloworldKw', 'flac') === false, '3 次超时不得短路')
  const e = d.computeEligibility('helloworldKw', 'kw', 'flac', { runtime: false, qualityShortCircuit: true })
  assert(e.eligible === true, `3 次超时后应可探路: ${e.code}`)
})

check('QP5 3 次确定性失败触发档位短路', () => {
  const m = fresh({ qualityShortCircuit: true, qualityShortCircuitSamples: 3 })
  const d = m.__debug
  d.toggleSource('helloworldKw', true)
  for (let i = 0; i < 3; i++) m.recordFailure('helloworldKw', 'flac', { playDead: false, code: m.ERROR_CODES.NOT_AUDIO })
  assert(d.isQualityHopeless('helloworldKw', 'flac') === true, '3 次 NOT_AUDIO 应短路')
  const e = d.computeEligibility('helloworldKw', 'kw', 'flac', { runtime: false, qualityShortCircuit: true })
  assert(e.eligible === false && e.code === 'QUALITY_SHORT_CIRCUIT', `code=${e.code}`)
})

check('QP6 3 次 429 只退避，不触发档位短路', () => {
  const m = fresh({ qualityShortCircuit: true, qualityShortCircuitSamples: 3 })
  const d = m.__debug
  d.toggleSource('suyinKuwo', true)
  for (let i = 0; i < 3; i++) m.recordRateLimit('suyinKuwo', 'flac')
  assert(d.isQualityHopeless('suyinKuwo', 'flac') === false, '429 不得短路')
  const e = d.computeEligibility('suyinKuwo', 'kw', 'flac', { runtime: true, qualityShortCircuit: true })
  assert(e.code === 'RATE_LIMITED', `应返回 RATE_LIMITED，实际 ${e.code}`)
})

check('QP7 失败分类：网络/交付/业务/429 分桶', () => {
  const m = fresh()
  const d = m.__debug
  assert(d.classifyQualityFailureCode(m.ERROR_CODES.NETWORK_TIMEOUT) === 'transient')
  assert(d.classifyQualityFailureCode(m.ERROR_CODES.NOT_AUDIO) === 'delivery')
  assert(d.classifyQualityFailureCode(m.ERROR_CODES.NOT_FOUND) === 'business')
  assert(d.classifyQualityFailureCode(m.ERROR_CODES.RATE_LIMIT) === 'rate_limit')
  assert(d.classifyQualityFailureCode('UNKNOWN_X') === 'unknown')
})

check('QP8 旧 v2 快照缺 definitiveFail 时按 0 恢复', () => {
  const m = fresh()
  const st = m.exportHealthState()
  const id = 'suyinKuwo'
  st.sources[id].byQuality.flac = { req: 3, success: 0, time: 0, fail: 3, businessFail: 0, linkExpired: 0 }
  const m2 = fresh()
  const res = m2.restoreHealthState(st)
  assert(res.ok === true, `旧字段应可恢复: ${JSON.stringify(res)}`)
  assert(m2.getBreaker(id).byQuality.flac.definitiveFail === 3, '旧快照缺字段应沿用 fail 口径')
})

check('QP9 唯一高质源走 10 分钟探路，不再压 1 小时', () => {
  const m = fresh({ qualityShortCircuit: true, qualityShortCircuitSamples: 3, qualityShortCircuitUniqueProbeMs: 600000 })
  const d = m.__debug
  d.toggleSource('suyinKuwo', true)
  for (let i = 0; i < 3; i++) m.recordFailure('suyinKuwo', 'flac', { playDead: false, code: m.ERROR_CODES.NOT_AUDIO })
  const e = d.computeEligibility('suyinKuwo', 'kg', 'flac', { runtime: false, qualityShortCircuit: true })
  assert(e.eligible === false && e.code === 'QUALITY_SHORT_CIRCUIT', `应短路，实际 ${e.code}`)
  const left = e.untilMs - Date.now()
  assert(left > 0 && left <= 11 * 60 * 1000, `唯一源探路应约 10min，实际 ${Math.round(left / 1000)}s`)
})

check('QP10 非唯一高质源仍走 1 小时探路', () => {
  const m = fresh({ qualityShortCircuit: true, qualityShortCircuitSamples: 3 })
  const d = m.__debug
  d.toggleSource('suyinKuwo', true)
  for (let i = 0; i < 3; i++) m.recordFailure('suyinKuwo', 'flac', { playDead: false, code: m.ERROR_CODES.NOT_AUDIO })
  const e = d.computeEligibility('suyinKuwo', 'tx', 'flac', { runtime: false, qualityShortCircuit: true })
  assert(e.eligible === false && e.code === 'QUALITY_SHORT_CIRCUIT', `应短路，实际 ${e.code}`)
  const left = e.untilMs - Date.now()
  assert(left >= 59 * 60 * 1000, `非唯一源应约 1h，实际 ${Math.round(left / 1000)}s`)
})

check('QP11 强制探路只放行一次，随后恢复短路', () => {
  const m = fresh({ qualityShortCircuit: true, qualityShortCircuitSamples: 3 })
  const d = m.__debug
  d.toggleSource('suyinKuwo', true)
  for (let i = 0; i < 3; i++) m.recordFailure('suyinKuwo', 'flac', { playDead: false, code: m.ERROR_CODES.NOT_AUDIO })
  assert(d.computeEligibility('suyinKuwo', 'tx', 'flac', { runtime: false, qualityShortCircuit: true }).eligible === false, '前置：应短路')
  const forced = d.forceQualityProbe && d.forceQualityProbe('suyinKuwo', 'flac')
  assert(forced === true, '强制探路应成功且返回 true')
  const one = d.computeEligibility('suyinKuwo', 'tx', 'flac', { runtime: false, qualityShortCircuit: true })
  assert(one.eligible === true, `强制后本次应放行，实际 ${one.code}`)
  const next = d.computeEligibility('suyinKuwo', 'tx', 'flac', { runtime: false, qualityShortCircuit: true })
  assert(next.eligible === false && next.code === 'QUALITY_SHORT_CIRCUIT', `强制探路不得永久解除，实际 ${next.code}`)
})

check('QP12 健康快照只读判断不写入 1h 探路', () => {
  const m = fresh({ qualityShortCircuit: true, qualityShortCircuitSamples: 3 })
  const d = m.__debug
  d.toggleSource('suyinKuwo', true)
  for (let i = 0; i < 3; i++) m.recordFailure('suyinKuwo', 'flac', { playDead: false, code: m.ERROR_CODES.NOT_AUDIO })
  const snap = d.getHealthSnapshot()
  const suyin = snap.suyinKuwo
  assert(suyin && suyin.qualityShortCircuit && suyin.qualityShortCircuit.flac === true, '快照应显示 flac 短路')
  const e = d.computeEligibility('suyinKuwo', 'kg', 'flac', { runtime: false, qualityShortCircuit: true })
  const left = e.untilMs - Date.now()
  assert(left > 0 && left <= 11 * 60 * 1000, `快照不得抢先写 1h，实际 ${Math.round(left / 1000)}s`)
})

console.log(`\n${passed} passed, ${failures.length} failed`)
if (failures.length) { console.error(failures.join('\n')); if (require.main === module) process.exit(1) }
if (require.main === module) process.exit(0)
