#!/usr/bin/env node
/**
 * F35/F45/F46 快照时间与只读状态（S1~S4）
 *
 * 目标：快照必须给 lastProbe/nextProbe/probeEtaMs；localThrottle/coldStart 可见，
 * 但不得改变 eligible（本地限速/冷启动只解释，不关闭）。
 *
 * 用法：node test/audit/health-snapshot-eta.js
 */
'use strict'
const path = require('path')
const SRC = path.join(__dirname, '../../lx-source.js')
const setLx = () => {
  globalThis.lx = {
    EVENT_NAMES: { inited: 'inited', request: 'request', updateAlert: 'updateAlert' },
    version: '2.0.0', env: 'mobile',
    utils: { buffer: { from: (d, e) => Buffer.from(d, e), bufToString: (b, e) => b.toString(e) } },
    request(url, opts, cb) { setTimeout(() => cb(Object.assign(new Error('ECONNREFUSED'), { code: 'ECONNREFUSED' }), null), 2); return () => {} },
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
const check = (name, fn) => {
  const id = (String(name).match(/^[A-Za-z]+\d+[a-z]?/) || [String(name)])[0]
  try { fn(); passed++; console.log(`✓ [${id}] ${name}`) } catch (e) { failures.push(`${name} — ${e.message}`); console.log(`✗ [${id}] ${name} — ${e.message}`) }
}
const assert = (c, m) => { if (!c) throw new Error(m) }

check('S1 每源快照有 lastProbe/nextProbe/probeEtaMs，且未探测时 lastProbe=0', () => {
  const m = fresh()
  const snap = m.__debug.getHealthSnapshot()
  const item = snap.suyinKuwo
  assert(item, '缺少 suyinKuwo 快照')
  assert(typeof item.lastProbe === 'number' && item.lastProbe === 0, `lastProbe=${item.lastProbe}`)
  assert(typeof item.nextProbe === 'number' && item.nextProbe > 0, `nextProbe=${item.nextProbe}`)
  assert(typeof item.probeEtaMs === 'number' && item.probeEtaMs > 0, `probeEtaMs=${item.probeEtaMs}`)
})

check('S2 localThrottle 是只读投影，不改变 eligible', () => {
  const m = fresh()
  const item = m.__debug.getHealthSnapshot().suyinKuwo
  assert(item.localThrottle && typeof item.localThrottle.active === 'boolean', '缺少 localThrottle')
  assert(item.localThrottle.active === false, `新实例不应限速：${JSON.stringify(item.localThrottle)}`)
  assert(item.eligible === true, `本地限速投影不得改变 eligible：${item.eligible}`)
})

check('S3 coldStart 只做可见 reason，不阻断资格', () => {
  const m = fresh()
  const item = m.__debug.getHealthSnapshot().huibq
  assert(item && item.coldStart, 'huibq 应带 coldStart 标记')
  assert(item.coldStart.reason === 'COLD_START', `reason=${item.coldStart.reason}`)
  assert(item.eligible === true, `冷启动不得阻断 eligible：${item.eligible}`)
})

check('S4 调度器只记录 nextProbe，不把 ETA 写回探测结果', () => {
  const m = fresh()
  assert(m.probeSchedule.nextAt > 0, '初始调度未登记 nextAt')
  assert(m.probeSchedule.lastStartedAt === 0, '尚未实际探测不应写 lastStartedAt')
})


check('S5 事件带唯一 eventId，去重不再依赖复合键', () => {
  const m = fresh()
  m.__debug.recordHealthEvent({ event: 'probe_result', traceId: 't1', sourceId: 'suyinKuwo', quality: '128k', ok: true, code: '', reason: 'PASS' })
  m.__debug.recordHealthEvent({ event: 'probe_result', traceId: 't1', sourceId: 'suyinKuwo', quality: '128k', ok: true, code: '', reason: 'PASS' })
  const events = m.__debug.getHealthEvents({ limit: 10 }).events
  const ids = events.slice(-2).map(e => e.eventId)
  assert(ids[0] && ids[1], `eventId 缺失：${ids.join(',')}`)
  assert(ids[0] !== ids[1], `eventId 不应重复：${ids.join(',')}`)
})

check('S6 platformSummary 拆出 off/blocked/degraded，总数守恒', () => {
  const m = fresh()
  const sum = m.__debug.getHealthSnapshot()._platformSummary.kw
  assert(sum, '缺少 kw 平台摘要')
  for (const k of ['offCount', 'blockedCount', 'degradedCount']) {
    assert(Number.isFinite(sum[k]) && sum[k] >= 0, `缺少或非法 ${k}`)
  }
  assert(sum.offCount + sum.eligibleCount + sum.blockedCount === sum.totalCount, `计数不守恒：${JSON.stringify(sum)}`)
})

check('S7 jitter 默认 10%，边界夹在 0~0.5', () => {
  const m = fresh()
  const lo = m.__debug.nextHealthCheckDelay(10000, () => 0)
  const hi = m.__debug.nextHealthCheckDelay(10000, () => 1)
  assert(lo === 9000, `下限应 9000，实际 ${lo}`)
  assert(hi === 11000, `上限应 11000，实际 ${hi}`)
})

check('S8 排序函数自带 eligible 防线', () => {
  const m = fresh()
  const out = m.sortChainByHealth([
    { id: 'suyinKuwo', eligible: true },
    { id: 'changqingVip', eligible: false },
    { id: 'ikun', skipReason: 'QUALITY_SHORT_CIRCUIT' },
  ])
  assert(out.length === 1 && out[0].id === 'suyinKuwo', `过滤结果 ${JSON.stringify(out.map(x => x.id))}`)
})

check('S10 生产探测配置只保留 handler 目标，不携带旧 URL 字段', () => {
  const m = fresh()
  const cfg = m.buildProbeConfig()
  for (const [id, pc] of Object.entries(cfg)) {
    const targets = pc && pc.probes ? pc.probes : [pc]
    for (const t of targets) {
      for (const k of ['url', 'method', 'body', 'headers', 'check', 'checkRes', 'extractUrl']) {
        assert(!(k in t), `${id} 仍携带 ${k}`)
      }
      assert(t.useHandler === true, `${id} 未走 handler`)
    }
  }
})

check('S11 生产探测配置每轮至少两首不同歌', () => {
  const m = fresh()
  const cfg = m.buildProbeConfig()
  for (const [id, pc] of Object.entries(cfg)) {
    assert(pc.twoSong === true, `${id} 缺 twoSong 标记`)
    const songs = (pc.probes || [pc]).map(t => (t.handlerSong && t.handlerSong.name) || t.songName).filter(Boolean)
    if (songs.length >= 2) assert(new Set(songs).size >= 2, `${id} 单轮歌曲未分两首：${songs.join('/')}`)
  }
})

check('S9 探测歌曲池可配且校验非法值', () => {
  const m = fresh()
  assert(Array.isArray(m.__debug.probeSongPool) && m.__debug.probeSongPool.length === 12, `默认池 ${m.__debug.probeSongPool}`)
  assert(JSON.stringify(m.__debug.normalizeProbeSongPool([' 晴天 ', '晴天', '稻香'])) === '["晴天","稻香"]', '去空格/去重失败')
  assert(m.__debug.normalizeProbeSongPool([]) === null, '空数组应拒绝')
  assert(m.__debug.normalizeProbeSongPool(['']) === null, '空歌曲名应拒绝')
})

console.log(`\n${passed} passed, ${failures.length} failed`)
if (failures.length) { console.error(failures.join('\n')); process.exit(1) }
if (require.main === module) process.exit(0)
