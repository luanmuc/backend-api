#!/usr/bin/env node
/**
 * 真实上游验证：用真实 HTTP 宿主加载 lx-source.js，逐平台请求 musicUrl。
 * 输出：平台、URL 域名、sourcePlatform、subSource、type。
 * 用途：验证 MG/KG 是否真的交付自有平台，还是实际复用酷我 CDN。
 */
'use strict'
const path = require('path')

const SOURCE = path.join(__dirname, '..', 'lx-source.js')
let handler = null

globalThis.lx = {
  EVENT_NAMES: { inited: 'inited', request: 'request', updateAlert: 'updateAlert' },
  version: '2.0.0',
  env: 'mobile',
  utils: { buffer: { from: (d, e) => Buffer.from(d, e), bufToString: (b, e) => b.toString(e) } },
  request(url, opts, cb) {
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), (opts && opts.timeout) || 12000)
    const headers = Object.assign({}, (opts && opts.headers) || {})
    const init = { method: (opts && opts.method) || 'GET', headers, signal: ac.signal }
    if (opts && opts.body != null) init.body = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body)
    fetch(url, init).then(async res => {
      clearTimeout(timer)
      const ct = res.headers.get('content-type') || ''
      const buf = Buffer.from(await res.arrayBuffer())
      const textLike = /json|text|javascript|xml/i.test(ct)
      cb(null, {
        statusCode: res.status,
        headers: Object.fromEntries(res.headers.entries()),
        body: textLike ? buf.toString('utf8') : buf,
        url: res.url,
      })
    }).catch(e => { clearTimeout(timer); cb(e, null) })
    return () => ac.abort()
  },
  on(n, h) { if (n === 'request') handler = h },
  send() {},
}

globalThis.__lxSourceConfig = { rateWindowMax: 1e6, maxConcurrency: 1e6, raceBudgetMs: 8000, verifyTimeoutMs: 4000 }
const mod = require(SOURCE)
const ALL = process.argv.includes('--all')
const WITHOUT_SUYIN = process.argv.includes('--without-suyin')
for (const id of Object.keys(mod.runtimeToggles || {})) {
  mod.runtimeToggles[id] = WITHOUT_SUYIN ? id !== 'suyinKuwo' : (ALL ? true : id === 'suyinKuwo')
}

const host = u => { try { return new URL(u).hostname } catch (e) { return 'invalid' } }
const run = async platform => {
  const info = { type: '128k', traceId: `real_${platform}`, musicInfo: { name: '晴天', singer: '周杰伦', duration: 269 } }
  const t0 = Date.now()
  try {
    const r = await handler({ action: 'musicUrl', source: platform, info })
    return {
      platform,
      ok: true,
      ms: Date.now() - t0,
      sourcePlatform: r && r.sourcePlatform,
      subSource: r && r.subSource,
      type: r && r.type,
      host: host(r && r.url),
      urlHead: String((r && r.url) || '').slice(0, 48),
    }
  } catch (e) {
    return { platform, ok: false, ms: Date.now() - t0, code: e && e.code, message: String((e && e.message) || e).slice(0, 160) }
  }
}

;(async () => {
  for (const p of ['kw', 'wy', 'tx', 'mg', 'kg']) {
    console.log(JSON.stringify(await run(p)))
  }
  process.exit(0)
})().catch(e => { console.error(e); process.exit(1) })
