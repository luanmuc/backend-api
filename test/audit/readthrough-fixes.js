#!/usr/bin/env node
/**
 * 通读缺陷修复回归（v8.16.2，R-01 ~ R-12）
 *
 * RF1  档位熔断跨重启保留（R-01）
 * RF2  真实交付音质入账 + 降级样本（R-02）
 * RF3  播放事件不混入取链统计（R-03）
 * RF4  快照 eligible 反映运行时（R-04）
 * RF5  试探键清理必须命中（R-05）
 * RF6  preGate 不提前消耗半开名额（R-06）
 * RF7  gateErr 带 code 与 sourceId（R-07）
 * RF8  跨平台 fallback 可取消（R-09）
 * RF9  跨平台控制流结构化（R-10，静态）
 * RF10 删除 ttl=0 死分支（R-11，静态）
 * RF11 取链摘除持久化（R-12⑤）
 * RF12 平台不支持码语义（R-12③）
 * RF13 多平台源逐平台资格可见（R-12④）
 * RF14 kwoff 死读清除（R-12①，静态）
 * RF15 provider 不写调用方对象（R-12②，静态）
 * RF16 206 也校验 content-type（R-12⑦）
 * RF17 cacheTtlMs 热更新生效（R-12⑥，静态）
 * RF18 版本/口径一致（R-08，静态）
 *
 * 用法：node test/audit/readthrough-fixes.js
 */
'use strict'
const fs = require('fs')
const path = require('path')

const SRC = path.join(__dirname, '../../lx-source.js')
const ROOT = path.join(__dirname, '../..')
const CODE = fs.readFileSync(SRC, 'utf8')
/* esbuild 会把非 ASCII 字符转成 \u 加四位十六进制的转义，静态文案断言必须先解码，否则永远匹配不到 */
const TEXT = CODE.replace(/\\u([0-9A-Fa-f]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))

const audioBody = () => {
  const b = Buffer.alloc(64)
  b.write('ftyp', 4)
  return b
}
const setLx = (reqImpl) => {
  globalThis.lx = {
    EVENT_NAMES: { inited: 'inited', request: 'request', updateAlert: 'updateAlert' },
    version: '2.0.0',
    env: 'mobile',
    utils: { buffer: { from: (d, e) => Buffer.from(d, e), bufToString: (b, e) => b.toString(e) } },
    request: reqImpl || function (url, opts, cb) {
      setTimeout(() => cb(Object.assign(new Error('ECONNREFUSED'), { code: 'ECONNREFUSED' }), null), 2)
      return () => {}
    },
    on() {}, send() {},
  }
}
const fresh = (config, reqImpl) => {
  setLx(reqImpl)
  globalThis.__lxSourceConfig = Object.assign({ logEnabled: false, logDebug: false }, config || {})
  const p = require.resolve(SRC)
  if (require.cache[p]) delete require.cache[p]
  return require(SRC)
}

let passed = 0
const failures = []
const assert = (c, m) => { if (!c) throw new Error(m) }

const check = async (name, fn) => {
  const id = (String(name).match(/^RF\d+/) || [String(name)])[0]
  try {
    await fn()
    passed++
    console.log(`\u2713 [${id}] ${name}`)
  } catch (e) {
    failures.push(`${name} \u2014 ${e.message}`)
    console.log(`\u2717 [${id}] ${name} \u2014 ${e.message}`)
  }
}

const ID = 'suyinKuwo'
const ID2 = 'suyin163'
const SONG = () => ({ name: '通读测试歌', singer: '测试', duration: 200000, hash: 'rt-hash-1' })
const fakeHandler = (m, id) => Object.assign({}, m.SOURCE_HANDLERS[id], { fn: async () => 'https://example.com/a.m4a' })
const killPlayDead = (m) => {
  for (let i = 0; i < 3; i++) m.recordFailure(ID, '128k', { code: 'NETWORK_TIMEOUT' })
  m.__debug.playDeadDeadline.set(ID, Date.now() - 2000)
}

;(async () => {
  await check('RF1 档位熔断跨重启保留（R-01）', () => {
    const m = fresh()
    for (let i = 0; i < 3; i++) m.recordFailure(ID, 'flac', { code: 'NOT_AUDIO' })
    assert(m.__debug.canExecute(ID, 'flac') === false, '前置：flac 应已熔断')
    const state = m.exportHealthState()
    assert(state.sources[ID].byQuality.flac, '导出缺少 flac 档')
    assert(state.sources[ID].byQuality.flac.breaker, '导出缺少 flac 档熔断器')
    assert(state.sources[ID].byQuality.flac.breaker.state === 'open', `导出熔断态=${JSON.stringify(state.sources[ID].byQuality.flac.breaker)}`)

    const m2 = fresh()
    const r = m2.restoreHealthState(JSON.parse(JSON.stringify(state)))
    assert(r && r.ok === true, `恢复失败: ${r && r.reason}`)
    assert(m2.__debug.canExecute(ID, 'flac') === false, '恢复后 flac 熔断丢失（canExecute=true）')

    /* 恢复后其他档正常失败，不得把已熔断档的熔断事实抹掉 */
    m2.recordFailure(ID, '128k', { code: 'NETWORK_TIMEOUT' })
    assert(m2.getBreaker(ID).byQuality.flac.breaker.state === 'open',
      `128k 失败后 flac 熔断被改写: ${JSON.stringify(m2.getBreaker(ID).byQuality.flac.breaker)}`)
    assert(m2.__debug.canExecute(ID, 'flac') === false, '128k 失败后 flac 被放行')

    /* 全档 open 时源级聚合仍必须为 open（聚合语义不能被持久化修复破坏） */
    const m3 = fresh()
    for (const q of ['128k', '320k', 'flac', 'flac24bit']) {
      for (let i = 0; i < 3; i++) m3.recordFailure(ID, q, { code: 'NETWORK_TIMEOUT' })
    }
    assert(m3.getBreaker(ID).state === 'open', `全档熔断时源级 state=${m3.getBreaker(ID).state}`)
    const m4 = fresh()
    m4.restoreHealthState(JSON.parse(JSON.stringify(m3.exportHealthState())))
    assert(m4.getBreaker(ID).state === 'open', `恢复后源级聚合 state=${m4.getBreaker(ID).state}`)
  })

  await check('RF2 真实交付音质入账 + 降级样本（R-02）', () => {
    const m = fresh()
    const b = m.getBreaker(ID)
    for (let i = 0; i < 3; i++) m.__debug.noteQualityDowngrade(ID, 'flac', '128k')
    assert((b.byQuality.flac.definitiveFail || 0) === 3, `降级样本=${b.byQuality.flac.definitiveFail}`)
    assert((b.byQuality.flac.req || 0) === 0, '降级样本不能进请求分母（req）')
    assert((b.byQuality.flac.success || 0) === 0, '降级样本不能记成功')
    assert(m.__debug.isQualityHopeless(ID, 'flac') === true, '3 次降级后 flac 仍未短路')
    /* 实交付档必须走真实音质记账（不能把请求档写进账本） */
    assert(/recordSuccess\(handler\.id[^\n]*deliveredQuality/.test(CODE), 'wrapExecute 仍按请求音质入账')
    assert(/noteQualityDowngrade\(handler\.id[^\n]*reqQuality/.test(CODE), '降级样本未接在 wrapExecute 上')
  })

  await check('RF3 播放事件不混入取链统计（R-03）', () => {
    const m = fresh()
    m.recordFailure(ID, '128k', { code: 'NOT_AUDIO' })
    const before = m.getHealthSnapshot()[ID]
    assert(before.reqCount === 1, `前置 reqCount=${before.reqCount}`)
    m.recordSuccess(ID, 120, '128k', { playback: true })
    const after = m.getHealthSnapshot()[ID]
    assert(after.reqCount === 1, `播放成功被算成取链请求：reqCount=${after.reqCount}`)
    assert(after.successRate === 0, `播放成功污染成功率：successRate=${after.successRate}`)
    assert(after.byQuality['128k'].req === 1 && after.byQuality['128k'].success === 0,
      `档位账被污染: ${JSON.stringify(after.byQuality['128k'])}`)

    const m2 = fresh()
    m2.recordSuccess(ID, 120, '128k', { playback: true })
    m2.recordFailure(ID, '128k', { code: 'NETWORK_ERROR', playDead: true, playbackOnly: true })
    const snap = m2.getHealthSnapshot()[ID]
    assert(snap.reqCount === 0, `播放失败被算成取链请求：reqCount=${snap.reqCount}`)
    assert(snap.byQuality['128k'] === undefined || snap.byQuality['128k'].req === 0,
      `播放失败污染档位账: ${JSON.stringify(snap.byQuality['128k'])}`)
    assert(snap.playDead === true || m2.__debug.playDeadStreak.get(ID) === 1, '播放失败必须仍累计 playDead')
  })

  await check('RF4 快照 eligible 反映运行时（R-04）', () => {
    const m = fresh()
    // 只造「档位熔断」：显式关掉 playDead/resolveDead，避免摘除态抢先命中判据
    for (let i = 0; i < 3; i++) m.recordFailure(ID, '128k', { code: 'NETWORK_TIMEOUT', playDead: false, resolveDead: false })
    assert(m.__debug.canExecute(ID, '128k') === false, '前置：128k 应已熔断')
    const s = m.getHealthSnapshot()[ID]
    assert(s.state === 'open', `快照 state=${s.state}`)
    assert(s.eligible === false, `快照 eligible=${s.eligible}（运行时已不可用）`)
    assert(s.eligibilityReason === 'open', `快照 reason=${s.eligibilityReason}`)
  })

  await check('RF5 试探键清理必须命中（R-05）', () => {
    const m = fresh({ playDeadReviveMs: 1000 })
    const d = m.__debug
    killPlayDead(m)
    assert(d.isPlayDead(ID, '128k', true) === false, '冷却到期应放行唯一试探')
    m.recordSuccess(ID, 100, '128k', { playback: true })
    killPlayDead(m)
    assert(d.isPlayDead(ID, '128k', true) === false, '新一轮摘除后 60s 内仍不放行（试探键未清理）')
  })

  await check('RF6 preGate 不提前消耗半开名额（R-06）', async () => {
    const m = fresh({ playDeadReviveMs: 1000 })
    killPlayDead(m)
    const fake = fakeHandler(m, ID)
    const e1 = await m.__debug.wrapExecute(fake, 'kw', SONG(), '128k', null).then(() => null, e => e)
    const e2 = await m.__debug.wrapExecute(fake, 'kw', SONG(), '128k', null).then(() => null, e => e)
    assert(e1 && /已熔断/.test(e1.message), `第 1 次应停在熔断门：${e1 && e1.message}`)
    assert(e2 && /已熔断/.test(e2.message), `第 2 次名额已被 preGate 吃掉：${e2 && e2.message}`)
  })

  await check('RF7 gateErr 带 code 与 sourceId（R-07）', async () => {
    const m = fresh()
    m.__debug.toggleSource(ID2, false)
    const e = await m.__debug.wrapExecute(fakeHandler(m, ID2), 'kw', SONG(), '128k', null).then(() => null, err => err)
    assert(e, '关源后必须失败')
    assert(!!e.code, 'gateErr 缺少 code')
    assert(e.sourceId === ID2, `gateErr.sourceId=${e.sourceId}`)
  })

  await check('RF8 跨平台 fallback 可取消（R-09）', async () => {
    const m = fresh()
    const token = m.__debug.createCancelToken()
    token.cancel('primary_settled')
    const e = await m.__debug.tryCrossPlatformFallback('kw', SONG(), '128k', Object.assign(new Error('NETWORK_TIMEOUT: x'), { code: 'NETWORK_TIMEOUT' }), 't1', token)
      .then(() => null, err => err)
    assert(e && e.code === m.ERROR_CODES.CANCELED, `预取消令牌下仍外呼：${e && e.code}`)
    /* settleOk 必须给 fallback 一个取消通道 */
    assert(/startFallback\s*=\s*\(reason\)[\s\S]{0,600}cancelToken\.cancel/.test(CODE) ||
      /const crossToken = createCancelToken\(\)/.test(CODE), 'settleOk 未取消跨平台令牌')
  })

  await check('RF9 跨平台控制流结构化（R-10，静态）', () => {
    const seg = CODE.slice(CODE.indexOf('async function getUrlWithCrossPlatformFallback'),
      CODE.indexOf('async function getUrlWithCrossPlatformFallback') + 6000)
    assert(!/\/该请求已知失败\/\.test/.test(seg), '仍用中文文案判定失败缓存')
    assert(!/\/预算耗尽\|超出预算\/\.test/.test(seg), '仍用中文文案判定预算')
    assert(!/\/源级限流\|冷却中\|已熔断\|并发\/限速保护\/\.test/.test(seg), '仍用中文文案判定本地保护')
    assert(/fromFailCache/.test(CODE), '失败缓存命中未打结构化标记')
    assert(/crossFallbackPolicy|CROSS_SETTLE/i.test(seg), '缺少统一跨平台裁决函数')
  })

  await check('RF10 删除 ttl=0 死分支（R-11，静态）', () => {
    assert(!/failEntry\.ttl === 0/.test(CODE), 'ttl===0 死分支仍在')
    assert(/该请求已知失败\(缓存中\)/.test(TEXT), '失败缓存文案丢失')
    assert(/fromFailCache/.test(CODE), '失败缓存命中未打结构化标记（R-10 同步项）')
  })

  await check('RF11 取链摘除持久化（R-12⑤）', () => {
    const m = fresh()
    for (let i = 0; i < 3; i++) m.__debug.bumpResolveDead(ID)
    assert(m.__debug.isResolveDead(ID) === true, '前置：应已取链摘除')
    const state = m.exportHealthState()
    assert(state.sources[ID].resolveDead, '导出缺少 resolveDead')
    const m2 = fresh()
    const r = m2.restoreHealthState(JSON.parse(JSON.stringify(state)))
    assert(r && r.ok === true, `恢复失败: ${r && r.reason}`)
    assert(m2.__debug.isResolveDead(ID) === true, '重启后取链摘除丢失')
  })

  await check('RF12 平台不支持码语义（R-12③）', () => {
    const m = fresh()
    const e = m.__debug.computeEligibility(ID2, 'kw', '128k', {})
    assert(e.eligible === false, '平台不支持却判可用')
    assert(e.code === 'PLATFORM_UNSUPPORTED', `code=${e.code}`)
  })

  await check('RF13 多平台源逐平台资格可见（R-12④）', () => {
    const m = fresh()
    const s = m.getHealthSnapshot()[ID]
    assert(s.platformEligibility && typeof s.platformEligibility === 'object', '快照缺少 platformEligibility')
    const chainPlatforms = (m.SOURCE_HANDLERS[ID].platforms || []).filter(p => m.SOURCE_HANDLERS[ID].chain[p] != null)
    assert(Object.keys(s.platformEligibility).length === chainPlatforms.length,
      `逐平台覆盖=${Object.keys(s.platformEligibility).length}/${chainPlatforms.length}`)
    /* 档位短路与 gatePlatform 同源，不再固定 platforms[0] */
    assert(!/isQualityHopeless\(id, q, \(SOURCE_HANDLERS\[id\]\.platforms \|\| \[\]\)\[0\]/.test(CODE), 'qualityShortCircuit 仍固定首平台')
  })

  await check('RF14 kwoff 死读清除（R-12①，静态）', () => {
    assert(!/buildCacheKey\('kwoff'/.test(CODE) && !/buildCacheKey\("kwoff"/.test(CODE), 'kwoff 只读不写的死缓存仍在')
  })

  await check('RF15 provider 不写调用方对象（R-12②，静态）', () => {
    assert(!/songInfo\.duration = parsed\.duration/.test(CODE), 'suyinKuwoSearch 仍回写调用方对象')
    assert(/setDurationHint\(songInfo, parsed\.duration\)/.test(CODE), '时长提示未改走内部旁路')
  })

  await check('RF16 206 也校验 content-type（R-12⑦）', async () => {
    const m = fresh({}, (url, opts, cb) => {
      setImmediate(() => cb(null, {
        statusCode: 206,
        headers: { 'content-type': 'text/html', 'content-length': '64' },
        body: audioBody(),
      }))
      return () => {}
    })
    // 206 + text/html 必须判「内容不是音频」：带 NOT_AUDIO 码抛出（不能 return false —— 调用方会把
    // false 翻译成 LINK_EXPIRED/410 死链，语义与账本都错，stress-round4 V1e/V28e 已复现）
    let code = ''
    try { await m.__debug.isAudioPlayable('https://example.com/not-audio.html') } catch (e) { code = e && e.code }
    assert(code === 'NOT_AUDIO', `206 + text/html 未被判 NOT_AUDIO（code=${code || '无=放行'})`)

    const m2 = fresh({}, (url, opts, cb) => {
      setImmediate(() => cb(null, {
        statusCode: 206,
        headers: { 'content-type': 'audio/mpeg', 'content-length': '64' },
        body: audioBody(),
      }))
      return () => {}
    })
    assert(await m2.__debug.isAudioPlayable('https://example.com/a.m4a') === true, '206 + audio/mpeg 应可播')
  })

  await check('RF17 cacheTtlMs 热更新生效（R-12⑥，静态）', () => {
    assert(/createLRUCache\(CACHE_MAX_SIZE,\s*\(\)\s*=>\s*cfg\(["']cacheTtlMs/.test(CODE), 'successCache 仍在构造时捕获 ttl')
    assert(/const ttlNow = \(\) =>/ .test(CODE), 'LRU 仍未支持动态 ttl')
  })

  await check('RF18 版本/口径一致（R-08，静态）', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
    assert(pkg.version === '8.16.4', `package.json version=${pkg.version}`)
    assert(/13 登记源 \/ 11 上链 \/ 2 观察/.test(pkg.description), `package description 口径陈旧: ${pkg.description}`)
    const header = fs.readFileSync(path.join(ROOT, 'src/00-header.js'), 'utf8')
    assert(/@version 8\.16\.4/.test(header), '头模板版本未升')
    assert(/13 登记源 \/ 11 上链 \/ 2 观察/.test(header), '头模板口径陈旧')
    assert(CODE.includes('@version 8.16.4'), '产物版本头未升')
    assert(!/12 登记源 \/ 10 上链/.test(CODE), '产物仍写旧口径 12/10')
  })

  await check('RF19 skipReason 只读：不得消费档位半开名额（R-13）', () => {
    const m = fresh({}, (url, opts, cb) => setImmediate(() => cb(new Error('mock-no-network'), null)))
    const cooldown = 18 * 60 * 1000
    const slot = m.getBreaker('suyinKuwo').byQuality.flac
      || (m.getBreaker('suyinKuwo').byQuality.flac = { req: 3, success: 0, time: 0, fail: 3, businessFail: 0, definitiveFail: 0 })
    slot.breaker = { state: 'open', failureCount: 3, lastFailureTime: Date.now() - cooldown - 1000, trialInFlight: false }
    const before = JSON.stringify(slot.breaker)
    // 冷却已满的 open 档：peek 语义应为「资格通过」，且绝不推进 open→half-open
    const r = m.__debug.skipReason('suyinKuwo', { platform: 'kw', quality: 'flac' })
    assert(r === null, `只读查询应判可用，实际返回 ${JSON.stringify(r)}`)
    assert(slot.breaker.state === 'open', `只读查询把档位推进成了 ${slot.breaker.state}`)
    assert(slot.breaker.trialInFlight === false, '只读查询占用了 trialInFlight')
    assert(JSON.stringify(slot.breaker) === before, '只读查询改写了档位熔断状态')
    // 名额没被烧：真正可取链时第一发必须能放行
    assert(m.__debug.canExecute('suyinKuwo', 'flac') === true, '半开名额已被只读查询烧掉')
  })

  await check('RF20 PLAYBACK_FAILED 必须是一等错误码（R-13 配套）', () => {
    const m = fresh({}, (url, opts, cb) => setImmediate(() => cb(new Error('mock-no-network'), null)))
    assert(m.ERROR_CODES.PLAYBACK_FAILED === 'PLAYBACK_FAILED',
      `ERROR_CODES 缺 PLAYBACK_FAILED（实际 ${String(m.ERROR_CODES.PLAYBACK_FAILED)}）`)
    const adm = m.__debug.admit({ error: { code: 'PLAYBACK_FAILED' } })
    assert(adm.verdict === 'PLAYBACK_DEAD', `admit 判成 ${adm.verdict}，本地拦截会被误当上游失败`)
    assert(adm.ledger && adm.ledger.ttlMs === 0, `PLAYBACK_DEAD 不得写失败缓存，ttl=${adm.ledger && adm.ledger.ttlMs}`)
    assert(adm.ledger && adm.ledger.health === 'skip', `PLAYBACK_DEAD 不得记任何账，health=${adm.ledger && adm.ledger.health}`)
    // 静态：资格判定不得再裸写字符串码
    assert(!TEXT.includes('code: "PLAYBACK_FAILED"'), 'computeEligibility 仍裸写字面量码')
  })

  await check('RF21 播放摘除按档位归因：一档播放死不得连坐其他档（疑-31）', () => {
    const m = fresh({}, (url, opts, cb) => setImmediate(() => cb(new Error('mock-no-network'), null)))
    const br = m.getBreaker('suyinKuwo')
    br.byQuality['128k'] = { req: 5, success: 5, time: 0, fail: 0, businessFail: 0, definitiveFail: 0,
      breaker: { state: 'closed', failureCount: 0, lastFailureTime: 0, trialInFlight: false } }
    m.__debug.playDeadStreak.set('suyinKuwo', 3)
    m.__debug.playDeadDeadline.set('suyinKuwo', Date.now())
    m.__debug.playDeadQuality.set('suyinKuwo', 'flac24bit')
    // 触发档仍必须拦
    assert(m.__debug.isPlayDead('suyinKuwo', 'flac24bit', false) === true, '触发档竟被放行')
    // 其他档有真实成功史 → 不连坐（高档解码失败不该把能播的保底档一起摘掉）
    assert(m.__debug.isPlayDead('suyinKuwo', '128k', false) === false, '高档播放死连坐了 128k 保底档')
    // 无成功史的档不豁免（保守：证据不足就照旧拦）
    br.byQuality['320k'] = { req: 2, success: 0, time: 0, fail: 2, businessFail: 0, definitiveFail: 0,
      breaker: { state: 'closed', failureCount: 0, lastFailureTime: 0, trialInFlight: false } }
    assert(m.__debug.isPlayDead('suyinKuwo', '320k', false) === true, '无成功史的档被误豁免')
    // 跨档连续失败 = 源级问题，不豁免
    m.__debug.bumpPlayDead('suyinKuwo', 'flac24bit')
    m.__debug.bumpPlayDead('suyinKuwo', '320k')
    m.__debug.bumpPlayDead('suyinKuwo', 'flac')
    assert(m.__debug.isPlayDead('suyinKuwo', '128k', false) === true, '跨档失败被当成档位问题放行了')
    // 持久化：触发档必须随快照带走，否则重启后豁免面回退成「源级」
    const st = m.exportHealthState()
    const item = st && st.sources && st.sources.suyinKuwo
    assert(item && typeof item.playDead === 'object', '快照缺 playDead')
    assert('quality' in item.playDead, '快照 playDead 未带触发档 quality')
  })

  console.log(`\n${passed} passed, ${failures.length} failed`)
  if (failures.length) {
    for (const f of failures) console.log(`  - ${f}`)
    __exit(1)
  }
  __exit(0)
})().catch(e => { console.error(e); __exit(1) })

// M9：被 require 时只设退出码，绝不 process.exit 杀掉调用方（独立运行时行为不变）
function __exit(code) {
  if (require.main === module) process.exit(code);
  else process.exitCode = Number(code) || 0;
}
