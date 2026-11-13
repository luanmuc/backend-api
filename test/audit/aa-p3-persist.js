#!/usr/bin/env node
/**
 * P3 健康元数据持久化审计（A1~A6）
 *
 * 用法：node test/audit/aa-p3-persist.js
 * 验收：export/restore 白名单、无 URL、版本/过期/容量、缓存不污染、档位短路恢复。
 */
'use strict'

const path = require('path')
const SRC = path.join(__dirname, '../../lx-source.js')

let handler = null
let current = null

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

const fresh = (extraCfg = {}) => {
  setLx()
  globalThis.__lxSourceConfig = Object.assign({}, extraCfg)
  const m = load()
  current = m
  return m
}

const call = (action, info = {}, source = 'kw') => handler({ action, source, info })

let passed = 0
const failures = []
const check = (name, fn) => {
  try {
    fn()
    passed++
    console.log(`✓ ${name}`)
  } catch (e) {
    failures.push(`${name} — ${e && e.message}`)
    console.log(`✗ ${name} — ${e && e.message}`)
  }
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg) }

const snapshotOf = (m, id) => {
  const s = m.getHealthSnapshot()
  return s && s[id]
}

// A1 导出结构：action 可用，且无 URL/歌名/歌手/缓存
check('A1 exportHealthState 结构合法且无敏感字段', () => {
  const m = fresh()
  m.recordSuccess('suyinKuwo', 300, '128k')
  const res = call('exportHealthState')
  assert(res && typeof res.then === 'function', 'export 必须返回 Promise')
  // 同步读取：handler 返回 Promise，测试用 then 不方便；改为直接驱动模块导出函数
  const state = m.exportHealthState()
  assert(state.v === 2, `v 应为 2，实际 ${state.v}`)
  assert(state.controls && state.controls.suyinQQ, 'v2 必须带独立 controls')
  assert(state.sourceVersion === '8.13.0', `sourceVersion 应为 8.13.0，实际 ${state.sourceVersion}`)
  assert(state.savedAt > 0, 'savedAt 必须为正')
  assert(state.sources && state.sources.suyinKuwo, '缺少 suyinKuwo')
  const text = JSON.stringify(state)
  for (const bad of ['http://', 'https://', 'successUrl', 'songInfo', 'singer', 'failCache']) {
    assert(!text.includes(bad), `导出含禁止字段 ${bad}`)
  }
})

// A2 恢复有效状态：统计/熔断/健康分一致
check('A2 restore 有效状态后快照一致', () => {
  let m = fresh()
  m.recordSuccess('suyinKuwo', 300, '128k')
  m.recordFailure('suyinKuwo', 'flac')
  m.recordFailure('suyinKuwo', 'flac')
  const before = snapshotOf(m, 'suyinKuwo')
  const state = m.exportHealthState()
  m = fresh()
  const res = m.restoreHealthState(state)
  assert(res.ok === true, `restore 应成功，实际 ${JSON.stringify(res)}`)
  const after = snapshotOf(m, 'suyinKuwo')
  for (const key of ['reqCount', 'probeCount', 'successRate', 'avgTime', 'state', 'healthScore', 'lastQuality']) {
    assert(JSON.stringify(before[key]) === JSON.stringify(after[key]), `${key} 不一致: ${before[key]} vs ${after[key]}`)
  }
})

// A3 禁止 URL：注入 successUrl 必须整包拒绝，状态不变
check('A3 含 successUrl 的 payload 必须拒绝', () => {
  const m = fresh()
  const state = m.exportHealthState()
  state.sources.suyinKuwo.successUrl = 'https://example.com/a.mp3'
  const res = m.restoreHealthState(state)
  assert(res.ok === false, '含 successUrl 应拒绝')
  assert(/url|forbid|禁止/i.test(res.reason || ''), `reason 应说明禁止字段，实际 ${res.reason}`)
  assert(snapshotOf(m, 'suyinKuwo').reqCount === 0, '拒绝后不得写入统计')
})

// A4 版本/过期/容量
check('A4 版本不符/过期/超容量全部拒绝', () => {
  const m = fresh()
  const good = m.exportHealthState()
  const badVer = JSON.parse(JSON.stringify(good))
  badVer.sourceVersion = '8.12.0'
  assert(m.restoreHealthState(badVer).ok === false, '版本不符应拒绝')
  const old = JSON.parse(JSON.stringify(good))
  old.savedAt = Date.now() - 8 * 24 * 3600 * 1000
  assert(m.restoreHealthState(old).ok === false, '8 天前应拒绝')
  const huge = JSON.parse(JSON.stringify(good))
  huge.sources.suyinKuwo.breaker.note = 'x'.repeat(300000)
  assert(m.restoreHealthState(huge).ok === false, '超 256KB 应拒绝')
})

// A5 恢复不污染 success/fail cache
check('A5 restore 不写入 successCache/failCache', () => {
  const m = fresh()
  const state = m.exportHealthState()
  state.sources.suyinKuwo.breaker.totalRequests = 2
  const res = m.restoreHealthState(state)
  assert(res.ok === true, 'restore 应成功')
  const d = m.__debug
  assert(d && d.successCache && d.failCache, '缺少缓存测试钩子')
  assert(d.successCache.size() === 0, `successCache 应空，实际 ${d.successCache.size()}`)
  assert(d.failCache.size() === 0, `failCache 应空，实际 ${d.failCache.size()}`)
})

// A6 档位短路恢复
check('A6 qualityShortCircuit 恢复后仍短路/到期放行', () => {
  let m = fresh()
  for (let i = 0; i < 3; i++) m.recordFailure('suyinKuwo', 'flac')
  assert(m.__debug.isQualityHopeless('suyinKuwo', 'flac') === true, '前置：应短路')
  const state = m.exportHealthState()
  assert(state.qualityShortCircuit['suyinKuwo:flac'] > 0, '导出应含短路时间戳')
  m = fresh()
  assert(m.restoreHealthState(state).ok === true, 'restore 应成功')
  assert(m.__debug.isQualityHopeless('suyinKuwo', 'flac') === true, '恢复后应立即短路')
  m.__debug.qualitySkipProbeAt.set('suyinKuwo:flac', Date.now() - 1)
  assert(m.__debug.isQualityHopeless('suyinKuwo', 'flac') === false, '到期后应放行探路')
})


// A7 开关权威恢复：默认关闭不得被写成 manualOff；用户手动关闭必须保留
check('A7 controls 恢复：default-off 不冒充用户关闭，manual-off 保留', () => {
  const m = fresh()
  const init = m.exportHealthState()
  assert(init.controls.suyinQQ && init.controls.suyinQQ.enabled === false, 'suyinQQ 默认关闭')
  assert(init.controls.suyinQQ.manualOff === false, '默认关闭不得带 manualOff')
  assert(m.getHealthSnapshot().suyinQQ.offReason === 'DEFAULT_OFF', '默认关闭 reason 应为 DEFAULT_OFF')
  call('toggle', { id: 'suyinQQ', enabled: false })
  const state = m.exportHealthState()
  assert(state.controls.suyinQQ.manualOff === true, '手动关闭应持久化 manualOff')
  const m2 = fresh()
  assert(m2.restoreHealthState(state).ok === true, 'restore 应成功')
  assert(m2.getHealthSnapshot().suyinQQ.offReason === 'USER_OFF', '恢复后应为 USER_OFF')
})

// A8 v1 兼容
check('A8 v1 状态仍可恢复', () => {
  const m = fresh()
  const v1 = m.exportHealthState()
  v1.v = 1
  const m2 = fresh()
  assert(m2.restoreHealthState(v1).ok === true, 'v1 应兼容')
})

// A9 controls-only：sourceVersion 不匹配只丢健康元数据，不丢用户意图
check('A9 controls-only 不受 sourceVersion 影响', () => {
  const m = fresh()
  call('toggle', { id: 'suyinQQ', enabled: false })
  const controls = m.exportHealthState().controls
  const m2 = fresh({ healthV2Enabled: false })
  const controlState = {
    v: 2,
    sourceVersion: '0.0.0',
    savedAt: Date.now(),
    sources: {},
    controls,
  }
  const res = m2.restoreHealthState(controlState)
  assert(res.ok === true && res.controlsRestored > 0, `controls-only 应成功：${JSON.stringify(res)}`)
  assert(m2.getHealthSnapshot().suyinQQ.offReason === 'USER_OFF', '用户关闭必须保留')
})

// A10 healthV2Enabled=false 回旧 v1 导出
check('A10 healthV2Enabled=false 导出 v1 回滚态', () => {
  const m = fresh({ healthV2Enabled: false })
  const state = m.exportHealthState()
  assert(state.v === 1, `回滚态应为 v1，实际 ${state.v}`)
  assert(state.controls && state.controls.suyinQQ, '回滚态仍需双写 controls')
})

console.log(`\n${passed} passed, ${failures.length} failed`)
if (failures.length) {
  for (const f of failures) console.log(`- ${f}`)
  if (require.main === module) process.exit(1)
}
if (require.main === module) process.exit(0)
