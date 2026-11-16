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
  // R28：原先先 `call('exportHealthState')` 再断言返回 Promise，但那个 Promise 从未 await/使用，
  // 只是残留的探索代码（还会留一个悬空 Promise）。直接驱动模块导出函数即可。
  const state = m.exportHealthState()
  assert(state.v === 2, `v 应为 2，实际 ${state.v}`)
  assert(state.controls && state.controls.suyinQQ, 'v2 必须带独立 controls')
  const PKG_VER = require(path.join(__dirname, '..', '..', 'package.json')).version
  assert(state.sourceVersion === PKG_VER, `sourceVersion 应与 package.json 一致(${PKG_VER})，实际 ${state.sourceVersion}`)
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
  // R28：原来只比 before[key] 与 after[key]——快照字段被改名/删掉时两边都是 undefined，
  // JSON.stringify 相等 → 这条断言恒过。先要求字段真实存在，再比一致性。
  for (const key of ['reqCount', 'probeCount', 'successRate', 'avgTime', 'state', 'healthScore', 'lastQuality']) {
    assert(before[key] !== undefined, `快照缺少字段 ${key}（判据会退化成 undefined===undefined）`)
    assert(after[key] !== undefined, `恢复后快照缺少字段 ${key}`)
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
  // HC：旧版本快照（8.12.0 < 当前 8.16.0）结构合法时应恢复，不得整包拒绝
  const olderVer = JSON.parse(JSON.stringify(good))
  olderVer.sourceVersion = '8.12.0'
  const r1o = m.restoreHealthState(olderVer)
  assert(r1o.ok === true, `旧版本应恢复，实际 ${r1o.ok} / ${r1o.reason}`)
  // HC：未来版本快照（9.9.9 > 当前）仍必须拒绝
  const badVer = JSON.parse(JSON.stringify(good))
  badVer.sourceVersion = '9.9.9'
  const r1 = m.restoreHealthState(badVer)
  assert(r1.ok === false, '未来版本应拒绝')
  assert(/sourceVersion/i.test(r1.reason || ''), `拒绝原因应是 sourceVersion 不符，实际 ${r1.reason}`)
  const old = JSON.parse(JSON.stringify(good))
  old.savedAt = Date.now() - 8 * 24 * 3600 * 1000
  const r2 = m.restoreHealthState(old)
  assert(r2.ok === false, '8 天前应拒绝')
  assert(/TTL/i.test(r2.reason || ''), `拒绝原因应是超出 TTL，实际 ${r2.reason}`)
  const huge = JSON.parse(JSON.stringify(good))
  huge.sources.suyinKuwo.breaker.note = 'x'.repeat(300000)
  const r3 = m.restoreHealthState(huge)
  assert(r3.ok === false, '超 256KB 应拒绝')
  assert(/256KB/i.test(r3.reason || ''), `拒绝原因应是超 256KB，实际 ${r3.reason}`)
})

// A5 恢复不污染 success/fail cache
check('A5 restore 不写入 successCache/failCache', () => {
  // R28：原来恢复前缓存本来就是空的，只能抓"凭空写入"；改为先种一条真缓存再恢复，
  // 要求既不被清空也不被覆盖——这才是"持久化不碰缓存"的完整语义。
  const m = fresh()
  const d = m.__debug
  assert(d && d.successCache && d.failCache, '缺少缓存测试钩子')
  d.successCache.set('seed:ok', { url: 'https://seed.test/a.mp3', quality: '128k', source: 'suyinKuwo', platform: 'kw', ts: Date.now() })
  d.failCache.set('seed:fail', { ts: Date.now(), code: 'SERVER_ERROR' })
  const state = m.exportHealthState()
  state.sources.suyinKuwo.breaker.totalRequests = 2
  const res = m.restoreHealthState(state)
  assert(res.ok === true, 'restore 应成功')
  assert(d.successCache.size() === 1, `successCache 应保持 1 条（不被清空/覆盖），实际 ${d.successCache.size()}`)
  assert(d.failCache.size() === 1, `failCache 应保持 1 条，实际 ${d.failCache.size()}`)
  const kept = d.successCache.get('seed:ok')
  assert(kept && kept.url === 'https://seed.test/a.mp3', `种下的缓存被恢复流程改写：${JSON.stringify(kept)}`)
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

// A8 单一路径：v1 必须拒绝
check('A8 v1 状态必须拒绝', () => {
  const m = fresh()
  const v1 = m.exportHealthState()
  v1.v = 1
  const m2 = fresh()
  assert(m2.restoreHealthState(v1).ok === false, 'v1 必须拒绝')
})

// A9 controls-only：sourceVersion 不匹配只丢健康元数据，不丢用户意图
check('A9 controls-only 不受 sourceVersion 影响', () => {
  const m = fresh()
  call('toggle', { id: 'suyinQQ', enabled: false })
  const controls = m.exportHealthState().controls
  const m2 = fresh()
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

// A10 无 v1 回滚开关，始终导出 v2
check('A10 无回滚开关，始终导出 v2', () => {
  const m = fresh({ healthV2Enabled: false })
  const state = m.exportHealthState()
  assert(state.v === 2, `应始终为 v2，实际 ${state.v}`)
  assert(state.controls && state.controls.suyinQQ, 'v2 应带 controls')
  // R28：`healthV2Enabled` 这个键在产物里根本不存在，传进配置等于没传——所以要直接对源码取证：
  // "无回滚开关" 的判据是源码里没有这个开关读取点，而不是在空配置上断言 v===2。
  const srcText = require('fs').readFileSync(SRC, 'utf8')
  const hits = srcText.split('\n').filter(l => l.includes('healthV2Enabled') && !l.trim().startsWith('//')).length
  assert(hits === 0, `源码里仍存在 healthV2Enabled 开关读取点（${hits} 处）`)
})

console.log(`\n${passed} passed, ${failures.length} failed`)
if (failures.length) {
  for (const f of failures) console.log(`- ${f}`)
  if (require.main === module) process.exit(1)
}
if (require.main === module) process.exit(process.exitCode || 0)
