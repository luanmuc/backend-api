#!/usr/bin/env node
/**
 * R77：R76 全量通读缺陷的修复回归（v9.1.7）。
 *
 * 双层取证：
 *  - src 层（08-media 标签解析 / 09-match 身份匹配）：真实字节夹具直驱纯函数；
 *  - 产物层（lx-source.js）：G12 往返等价 / G14 快照纯度 / P2-06 档位复位 / G9 缓存 key /
 *    契约复核新鲜度，全部驱动**已构建产物**的导出面（发布口径）。
 *  - 源码静态断言（C 组）：补「改回旧形态必红」的防回退锚点。
 *
 * 红绿验证方式：把对应修复点改回 R76 定案的旧实现 → 本脚本对应断言红（见维护记录）。
 */
'use strict'

const path = require('path')
const fs = require('fs')
const assert = require('assert')
const ROOT = path.resolve(__dirname, '..', '..')

globalThis.lx = {
  EVENT_NAMES: { inited: 'inited', request: 'request', updateAlert: 'updateAlert' },
  version: '2.0.0',
  env: 'mobile',
  utils: { buffer: { from: (d, e) => Buffer.from(d, e), bufToString: (b, e) => b.toString(e) } },
  request: () => { throw new Error('stub: 本用例不应发网络请求') },
  on: () => {},
  send: () => {},
}

const media = require(path.join(ROOT, 'src', 'core', '08-media.js'))
const match = require(path.join(ROOT, 'src', 'core', '09-match.js'))
const bundle = require(path.join(ROOT, 'lx-source.js'))
const D = bundle.__debug

let checks = 0
let failures = 0
const run = (id, name, fn) => {
  try {
    fn()
    checks++
    console.log(`  ✓ [${id}] ${name}`)
  } catch (e) {
    failures++
    console.error(`  ✗ [${id}] ${name}\n     ${e.message}`)
  }
}

const le32 = (n) => Buffer.from([n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >> 24) & 255])
const be32 = (n) => Buffer.from([(n >> 24) & 255, (n >> 16) & 255, (n >> 8) & 255, n & 255])

/* ---- A 组：src 层真实字节夹具 ---- */
console.log('A 组：标签解析（FLAC 小端 / ID3v2.2 / 2.3 / 2.4）')
function makeFlac(comments) {
  const vendor = Buffer.from('reference')
  const cbuf = comments.map((c) => Buffer.from(c, 'utf8'))
  let payload = Buffer.concat([le32(vendor.length), vendor, le32(cbuf.length)])
  for (const c of cbuf) payload = Buffer.concat([payload, le32(c.length), c])
  const len = payload.length
  return Buffer.concat([Buffer.from('fLaC'), Buffer.from([0x84, (len >> 16) & 255, (len >> 8) & 255, len & 255]), payload])
}
run('A01', 'FLAC VORBIS_COMMENT（小端长度）解析 TITLE/ARTIST', () => {
  const t = media.parseFlacTags(makeFlac(['TITLE=晴天', 'ARTIST=周杰伦']))
  assert.strictEqual(t.title, '晴天')
  assert.strictEqual(t.artist, '周杰伦')
})
run('A02', 'FLAC 缺评论时返回空标签而非假标签', () => {
  const t = media.parseFlacTags(makeFlac([]))
  assert.strictEqual(t.title, '')
  assert.strictEqual(t.artist, '')
})
run('A03', 'FLAC 长度字段损坏时不越界（vendorLen 超过块尾）', () => {
  const bad = makeFlac(['TITLE=晴天'])
  bad[8 + 4 + 0] = 0x7f // vendorLen 首位字节改大
  const t = media.parseFlacTags(bad)
  assert.ok(t && typeof t.title === 'string')
})
function makeId3(ver, frames) {
  // frames: [{id, text, enc}]；v2 无编码字节（固定 latin1）；v3/v4 帧体 = 1 编码字节 + 数据
  const payloads = frames.map((f) => {
    const idB = Buffer.from(f.id, 'ascii')
    let body
    if (ver === 2) body = Buffer.from(f.text, 'latin1')
    else if (f.enc === 1) body = Buffer.concat([Buffer.from([1]), Buffer.from('\xff\xfe', 'latin1'), Buffer.from(f.text, 'utf16le')])
    else if (f.enc === 3) body = Buffer.concat([Buffer.from([3]), Buffer.from(f.text, 'utf8')])
    else body = Buffer.concat([Buffer.from([0]), Buffer.from(f.text, 'latin1')])
    const sz = ver === 2 ? Buffer.from([(body.length >> 16) & 255, (body.length >> 8) & 255, body.length & 255]) : be32(body.length)
    const head = ver === 2 ? Buffer.concat([idB, sz]) : Buffer.concat([idB, sz, Buffer.from([0, 0])])
    return Buffer.concat([head, body])
  })
  const bodyAll = Buffer.concat(payloads)
  const size = ((bodyAll.length >> 21) & 0x7f) * 0x200000 + ((bodyAll.length >> 14) & 0x7f) * 0x4000 + ((bodyAll.length >> 7) & 0x7f) * 0x80 + (bodyAll.length & 0x7f)
  return Buffer.concat([Buffer.from('ID3'), Buffer.from([ver, 0, 0]), Buffer.from([(size >> 21) & 0x7f, (size >> 14) & 0x7f, (size >> 7) & 0x7f, size & 0x7f]), bodyAll])
}
run('A04', 'ID3v2.2（TT2/TP1，latin1）解析', () => {
  const t = media.parseId3Tags(makeId3(2, [{ id: 'TT2', text: 'Sunny' }, { id: 'TP1', text: 'Jay' }]))
  assert.strictEqual(t.title, 'Sunny')
  assert.strictEqual(t.artist, 'Jay')
})
run('A05', 'ID3v2.3（TIT2/TPE1，utf8）解析', () => {
  const t = media.parseId3Tags(makeId3(3, [{ id: 'TIT2', text: '晴天', enc: 3 }, { id: 'TPE1', text: '周杰伦', enc: 3 }]))
  assert.strictEqual(t.title, '晴天')
  assert.strictEqual(t.artist, '周杰伦')
})
run('A06', 'ID3v2.4（synchsafe 尺寸）解析', () => {
  const t = media.parseId3Tags(makeId3(4, [{ id: 'TIT2', text: '晴天', enc: 3 }, { id: 'TPE1', text: '周杰伦', enc: 3 }]))
  assert.strictEqual(t.title, '晴天')
  assert.strictEqual(t.artist, '周杰伦')
})

/* ---- A 组续：songInfoMatch interval 回退（P2-02a） ---- */
run('A07', '只带 interval 的 musicInfo 时长闸门生效（差 >5s 拒）', () => {
  const si = { name: '晴天', singer: '周杰伦', interval: '04:31' }
  const okSame = match.songInfoMatch({ song: '晴天', singer: '周杰伦', duration: 271 }, si)
  assert.strictEqual(okSame, true, '271s 应通过')
  const reject = match.songInfoMatch({ song: '晴天', singer: '周杰伦', duration: 320 }, si)
  assert.strictEqual(reject, false, '320s vs 271s 应被时长闸门拒')
})
run('A08', '不带 interval/duration 时行为不变（闸门跳过）', () => {
  const si = { name: '晴天', singer: '周杰伦' }
  assert.strictEqual(match.songInfoMatch({ song: '晴天', singer: '周杰伦', duration: 320 }, si), true)
})

/* ---- B 组：产物层 ---- */
console.log('B 组：产物行为（G12/G14/P2-06/G9/契约新鲜度）')
run('B01', 'G12：playDead.quality 导出→恢复往返等价', () => {
  D.playDeadQuality.clear(); D.playDeadStreak.clear(); D.playDeadDeadline.clear()
  D.bumpPlayDead('xinghaiBackend', 'flac')
  const exp = bundle.exportHealthState()
  assert.strictEqual(exp.sources.xinghaiBackend.playDead.quality, 'flac')
  D.playDeadQuality.clear(); D.playDeadStreak.clear(); D.playDeadDeadline.clear()
  const rr = bundle.restoreHealthState(JSON.parse(JSON.stringify(exp)))
  assert.strictEqual(rr.ok, true, JSON.stringify(rr))
  assert.strictEqual(D.playDeadQuality.get('xinghaiBackend'), 'flac')
  assert.strictEqual(D.playDeadStreak.get('xinghaiBackend'), 1)
})
run('B02', 'G12：多档归因 "*" 往返保留', () => {
  D.playDeadQuality.clear(); D.playDeadStreak.clear()
  D.bumpPlayDead('xinghaiBackend', 'flac')
  D.bumpPlayDead('xinghaiBackend', '320k')
  const exp = bundle.exportHealthState()
  assert.strictEqual(exp.sources.xinghaiBackend.playDead.quality, '*')
  D.playDeadQuality.clear(); D.playDeadStreak.clear()
  const rr = bundle.restoreHealthState(JSON.parse(JSON.stringify(exp)))
  assert.strictEqual(rr.ok, true, JSON.stringify(rr))
  assert.strictEqual(D.playDeadQuality.get('xinghaiBackend'), '*')
})
run('B03', 'G12：非法 quality 拒绝整包（不静默吞）', () => {
  const exp = bundle.exportHealthState()
  exp.sources.xinghaiBackend.playDead.quality = '384k'
  const rr = bundle.restoreHealthState(JSON.parse(JSON.stringify(exp)))
  assert.strictEqual(rr.ok, false)
  assert.ok(String(rr.reason).includes('quality'), String(rr.reason))
})
run('B04', 'G14：getHealthSnapshot 不写 qualitySkipProbeAt', () => {
  const b = bundle.getBreaker('helloworldKw')
  b.byQuality.flac = { req: 3, success: 0, time: 0, fail: 3, businessFail: 0, definitiveFail: 3, linkExpired: 0, rateLimitCount: 0, rateLimitUntil: 0, rateLimited: false, breaker: { state: 'closed', failureCount: 0, lastFailureTime: 0, trialInFlight: false } }
  D.qualitySkipProbeAt.clear()
  const before = D.qualitySkipProbeAt.size
  bundle.getHealthSnapshot()
  const after = D.qualitySkipProbeAt.size
  assert.strictEqual(after, before, `快照写入了 ${after - before} 条短路布防`)
  assert.ok(!D.qualitySkipProbeAt.has('helloworldKw:flac'), '快照为 helloworldKw:flac 布防')
})
run('B05', 'P2-06：探测 PASS 复位档位熔断器（展示与资格同口径）', () => {
  const b = bundle.getBreaker('helloworldKw')
  b.byQuality.flac = { req: 3, success: 0, time: 0, fail: 3, businessFail: 0, definitiveFail: 0, linkExpired: 0, rateLimitCount: 2, rateLimitUntil: Date.now() + 60000, rateLimited: true, breaker: { state: 'open', failureCount: 3, lastFailureTime: Date.now(), trialInFlight: false } }
  bundle.applyProbeResult('helloworldKw', true, { outcome: 'PASS' })
  const qs = bundle.getBreaker('helloworldKw').byQuality.flac
  assert.strictEqual(qs.breaker.state, 'closed')
  assert.strictEqual(qs.breaker.failureCount, 0)
  assert.strictEqual(qs.rateLimited, false)
  assert.strictEqual(qs.rateLimitUntil, 0)
})
run('B06', 'G9：不带时长的缓存 key 与旧结构完全一致（存量槽位不扰动）', () => {
  const si = { songmid: 'Q3SONG', name: '晴天', singer: '周杰伦' }
  assert.strictEqual(D.buildCacheKey('kw', si, '128k'), 'kw_Q3SONG_晴天_周杰伦__128k')
})
run('B07', 'G9：同 id 不同时长分槽，不再互相覆盖', () => {
  const a = D.buildCacheKey('kw', { songmid: 'X1', name: '晴天', duration: 271000 }, 'flac')
  const b2 = D.buildCacheKey('kw', { songmid: 'X1', name: '晴天', duration: 245000 }, 'flac')
  assert.notStrictEqual(a, b2)
})
run('B08', '契约：复核日过期超 14 天 → CONTRACT_ERROR（时间可注入）', () => {
  let threw = null
  try { bundle.validateProviderContracts(Date.parse('2027-01-15T00:00:00Z')) } catch (e) { threw = e }
  assert.ok(threw, '应抛契约错误')
  assert.ok(String(threw.message).includes('过期'), threw && threw.message)
})
run('B09', '契约：当前时间复核日全部新鲜 → 通过', () => {
  const r = bundle.validateProviderContracts(Date.now())
  assert.strictEqual(r.ok, true)
  assert.strictEqual(r.registered, 14)
})
run('B10', '契约：reviewAt 写未来日期（用日历绕过宽限）→ CONTRACT_ERROR', () => {
  // R78：R77 期间把复核日顺延到 11-30 是未来日期，checkFresh 的 nowMs-ts 变负永远不超窗，
  // 等于用未来日历把 14 天宽限彻底绕开。这里把时间往回拨到 2026-10-01（任一 reviewAt 都在
  // 未来 20 天以上）复现该绕过，必须报「未来日期」而不是静默通过。
  let threw = null
  try { bundle.validateProviderContracts(Date.parse('2026-10-01T00:00:00Z')) } catch (e) { threw = e }
  assert.ok(threw, '未来日期应抛契约错误')
  assert.ok(String(threw.message).includes('未来日期'), threw && threw.message)
  // 反向：把同一时刻的 reviewAt 全改成当天真实复核日 → 不再报未来日期（只可能报过期）
  const codes = threw && threw.contractErrors || []
  const futureErrs = codes.filter(x => String(x).includes('未来日期'))
  assert.ok(futureErrs.length >= 1, '应至少报一条未来日期')
})

/* ---- C 组：源码防回退静态锚点 ---- */
console.log('C 组：源码静态锚点')
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8')
run('C01', 'juhe interval 已走 normalizeDurationSec（P2-02b）', () => {
  const s = read('src/core/25-handlers.js')
  assert.ok(s.includes('interval: normalizeDurationSec(songInfo?.duration ?? songInfo?.interval)'), '未找到修复形态')
})
run('C02', '字节保底启发式吃 verifyDurRatio 配置（P2-04）', () => {
  const s = read('src/core/15-verify.js')
  assert.ok(s.includes("cfg('verifyDurRatio', VERIFY_DUR_RATIO)"), 'minFull 未吃 cfg')
})
run('C03', 'kuwo 解析先原串后清洗（P2-05）', () => {
  const s = read('src/core/24-kuwo-official.js')
  const iRaw = s.indexOf('JSON.parse(raw)')
  const iClean = s.indexOf("raw.replace(/'/g, '\"')")
  assert.ok(iRaw > -1 && iClean > -1 && iRaw < iClean, '解析顺序不对')
})
run('C04', '封面搜索同族修复（14-lyric）', () => {
  const s = read('src/core/14-lyric.js')
  const iRaw = s.indexOf('JSON.parse(raw)')
  const iClean = s.indexOf("raw.replace(/'/g, '\"')")
  assert.ok(iRaw > -1 && iClean > -1 && iRaw < iClean, '解析顺序不对')
})
run('C05', '冷启动预热锚点按平台分表（治理项）', () => {
  const s = read('src/core/22-chain.js')
  assert.ok(s.includes('COLD_START_ANCHORS'), '缺分表')
  assert.ok(s.includes('anchorPlatform = h.platforms.includes(platform)'), '未按平台选锚点')
})
run('C07', 'G14：快照三处调用均传 setProbe:false（防回退布防）', () => {
  const h = read('src/core/17-health-check.js')
  assert.ok((h.match(/setProbe: false/g) || []).length >= 4, '快照 setProbe:false 少于 4 处')
  assert.ok(h.includes('consumePlayDeadTrial: false, setProbe: false });'), 'gate 调用丢失 setProbe:false')
})
run('C08', '探针元数据：轮换覆盖歌名时同步清 singer/duration（治理项）', () => {
  const h = read('src/core/17-health-check.js')
  assert.ok(h.includes('function withProbeSong(handlerSong, song)'), '缺 withProbeSong helper')
  assert.ok(h.includes('delete hs.singer;') && h.includes('delete hs.duration;'), 'helper 未清 singer/duration')
  assert.ok((h.match(/withProbeSong\(/g) || []).length >= 5, '调用点少于 4 处')
  assert.ok(!h.includes('Object.assign({}, t.handlerSong, { name: song })'), '存在旧覆盖形态')
})
run('C09', 'chainOpts 透传只在 buildSourceChain 内（getUrlWithFallback 不得引用）', () => {
  const c = read('src/core/22-chain.js')
  const gStart = c.indexOf('async function getUrlWithFallback')
  const gEnd = c.indexOf('\nfunction ', gStart)
  const body = c.slice(gStart, gEnd)
  assert.ok(!body.includes('...chainOpts'), 'getUrlWithFallback 内不得出现 ...chainOpts（未定义变量 → ReferenceError → 被吞成 NETWORK_ERROR）')
  const bStart = c.indexOf('function buildSourceChain')
  const bEnd = c.indexOf('\nfunction ', bStart + 1)
  const bBody = c.slice(bStart, bEnd)
  assert.ok(bBody.includes('...chainOpts') && bBody.includes('const chainOpts = opts || {}'), 'buildSourceChain 透传缺失')
})
run('C06', '复核日已改为真实复核日 + 未来日期门禁存在（治理项）', () => {
  const c = read('src/core/12-provider-contract.js')
  assert.ok(c.includes('REVIEW_GRACE_DAYS'), '缺宽限常量')
  assert.ok(c.includes('REVIEW_FUTURE_TOLERANCE_MS'), '缺未来日期容差常量')
  assert.ok(!/reviewAt: "2026-11-1[89]"/.test(c), '缺口表仍有过期日期')
  const prov = ['src/providers/juheTx.js', 'src/providers/qingliangTx.js', 'src/providers/55-probation.js'].map(read).join('')
  assert.ok(!/"reviewAt": "2026-11-1[89]"/.test(prov), 'provider 仍有过期日期')
  const spec = read('src/core/25-handlers.js')
  // R78：不得再出现把复核日推到未来的写法（R77 的 11-26/11-30 就是这种「用日历绕过宽限」）。
  // 提取式判定而不是写死正则：reviewAt 只到日历日精度、按 UTC 零点解析，容差 1 天。
  const all = c + prov + spec
  const dates = [...all.matchAll(/reviewAt"?\s*:\s*"(\d{4}-\d{2}-\d{2})"/g)].map(m => m[1])
  assert.ok(dates.length >= 6, `reviewAt 提取数量异常: ${dates.length}`)
  const now = Date.now()
  for (const d of dates) {
    const ts = Date.parse(`${d}T00:00:00Z`)
    assert.ok(ts - now <= 24 * 3600 * 1e3, `reviewAt ${d} 是未来日期（必须写真实复核日）`)
  }
})

console.log(`\n===== R77 修复回归：${checks} 通过 / ${failures} 失败 =====`)
// R36：只有 if (require.main) process.exit(...)——被 require 时失败既不退出也不置退出码。
if (failures) process.exitCode = 1;
if (require.main === module) process.exit(failures ? 1 : 0)