#!/usr/bin/env node
/**
 * G7 真实验证：先走平台搜索拿 songmid/id，再请求源侧 musicUrl。
 * 目的：区分“只传歌名时被兜底/缺 ID”与“带真实平台 ID 的原生交付”。
 * 用法：node scripts/verify-real-platform-chains.js [--include-suyin]
 * 默认关闭 suyinKuwo，避免酷我兜底掩盖 tx/wy 原生结果。
 */
'use strict'
const path = require('path')
const SOURCE = path.join(__dirname, '..', 'lx-source.js')
let handler = null

const fetchJson = async (url, headers = {}) => {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), 12000)
  try {
    const res = await fetch(url, { headers: Object.assign({ 'User-Agent': 'Mozilla/5.0' }, headers), signal: ac.signal })
    const text = await res.text()
    return JSON.parse(text)
  } finally { clearTimeout(timer) }
}

globalThis.lx = {
  EVENT_NAMES: { inited: 'inited', request: 'request', updateAlert: 'updateAlert' },
  version: '2.0.0', env: 'mobile',
  utils: { buffer: { from: (d, e) => Buffer.from(d, e), bufToString: (b, e) => b.toString(e) } },
  request(url, opts, cb) {
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), (opts && opts.timeout) || 12000)
    const init = { method: (opts && opts.method) || 'GET', headers: (opts && opts.headers) || {}, signal: ac.signal }
    if (opts && opts.body != null) init.body = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body)
    fetch(url, init).then(async res => {
      clearTimeout(timer)
      const ct = res.headers.get('content-type') || ''
      const buf = Buffer.from(await res.arrayBuffer())
      cb(null, { statusCode: res.status, headers: Object.fromEntries(res.headers.entries()), body: /json|text|javascript|xml/i.test(ct) ? buf.toString('utf8') : buf, url: res.url })
    }).catch(e => { clearTimeout(timer); cb(e, null) })
    return () => ac.abort()
  },
  on(n, h) { if (n === 'request') handler = h },
  send() {},
}

globalThis.__lxSourceConfig = { rateWindowMax: 1e6, maxConcurrency: 1e6, raceBudgetMs: 12000, verifyTimeoutMs: 5000, crossPlatformEnabled: false }
const mod = require(SOURCE)
const INCLUDE_SUYIN = process.argv.includes('--include-suyin')
for (const id of Object.keys(mod.runtimeToggles || {})) mod.runtimeToggles[id] = INCLUDE_SUYIN ? true : id !== 'suyinKuwo'

const getWy = async () => {
  const urls = [
    'https://music.163.com/api/search/get/web?csrf_token=&s=' + encodeURIComponent('晴天') + '&type=1&offset=0&limit=3',
    'https://music.163.com/api/search/get?s=' + encodeURIComponent('晴天') + '&type=1&limit=3',
  ]
  let last = ''
  for (const url of urls) {
    for (let i = 0; i < 3; i++) {
      try {
        const d = await fetchJson(url, { Referer: 'https://music.163.com/' })
        const songs = (d && d.result && d.result.songs) || []
        const s = songs.find(x => (x.artists || []).some(a => String(a.name || '').includes('周杰伦'))) || songs[0]
        if (s) return { id: String(s.id), songmid: String(s.id), interval: Math.round((s.duration || 0) / 1000) || 269 }
        last = '搜索无 songs: ' + JSON.stringify(d).slice(0, 120)
      } catch (e) { last = String(e.message || e) }
      await new Promise(r => setTimeout(r, 300))
    }
  }
  throw new Error('网易云搜索无结果: ' + last)
}
const getTx = async () => {
  const d = await fetchJson('https://c.y.qq.com/soso/fcgi-bin/client_search_cp?format=json&p=1&n=1&w=' + encodeURIComponent('晴天'), { Referer: 'https://y.qq.com/' })
  const s = d && d.data && d.data.song && d.data.song.list && d.data.song.list[0]
  if (!s) throw new Error('QQ 音乐搜索无结果')
  return { songmid: String(s.songmid), interval: Number(s.interval) || 269 }
}
const hostOf = u => { try { return new URL(u).hostname } catch (e) { return 'invalid' } }
const isolate = id => {
  for (const x of Object.keys(mod.runtimeToggles || {})) mod.runtimeToggles[x] = x === id
}
const run = async (platform, ids, only) => {
  isolate(only)
  const info = Object.assign({ name: '晴天', singer: '周杰伦', duration: 269 }, ids)
  const t0 = Date.now()
  try {
    const r = await handler({ action: 'musicUrl', source: platform, info: { type: '128k', traceId: `g7_${platform}`, musicInfo: info } })
    return { platform, ok: true, mode: 'isolated', only, inputId: ids.songmid || ids.id, ms: Date.now() - t0, sourcePlatform: r && r.sourcePlatform, subSource: r && r.subSource, subSourceName: r && r.subSourceName, trial: !!(r && r.subSourceName && /试听版/.test(r.subSourceName)), type: r && r.type, host: hostOf(r && r.url), urlHead: String((r && r.url) || '').slice(0, 48) }
  } catch (e) {
    return { platform, ok: false, ms: Date.now() - t0, code: e && e.code, message: String((e && e.message) || e).slice(0, 200) }
  }
}

;(async () => {
  const results = []
  try {
    const wy = await getWy()
    results.push(await run('wy', wy, 'wyOuter'))
  } catch (e) { results.push({ platform: 'wy', ok: false, stage: 'search', message: String(e.message || e) }) }
  try {
    const tx = await getTx()
    results.push(await run('tx', tx, 'juheTx'))
  } catch (e) { results.push({ platform: 'tx', ok: false, stage: 'search', message: String(e.message || e) }) }
  for (const r of results) console.log(JSON.stringify(r))
  process.exit(0)
})().catch(e => { console.error(e); process.exit(1) })
