#!/usr/bin/env node
/**
 * 交付身份取证（K31 证据链）
 *
 * 为什么要独立实现一套解码：`src/core/08-media.js` 的 `parseAudioTags` 在产物
 * `lx-source.js` 模板字符串里，直接 require 需要 `globalThis.lx` 桩；而取证要在
 * 源仓之外、对着真实 CDN 打，所以这里按**同一判据**独立实现一份。两边判据必须一致：
 * ID3v2 的 `TIT2`/`TPE1`/`TALB` + FLAC 的 VORBIS_COMMENT `TITLE`/`ARTIST`/`ALBUM`。
 *
 * 用法：
 *   node scripts/probe-identity.js                          # 跑内置三条样本（999999999 / 1 / 228908）
 *   node scripts/probe-identity.js --mid 228908,1           # 指定 mid（逗号分隔）
 *   node scripts/probe-identity.js --search 平凡之路 朴树    # 酷我搜索取首条 mid 再取证
 *   node scripts/probe-identity.js --mid 182061798 --quality flac --expect 平凡之路
 *
 * 判定（与 `15-verify.js` 的 `checkDeliveryIdentity` 三段一致）：
 *   OK        有标签且歌名/歌手与 --expect 归一化后相等或互相包含 → 放行
 *   MISMATCH  有标签但对不上 → 任何源都该拒
 *   NO-TAG    无任何标签 → **不等于错歌**（真实现场版实测无标签），需人工判是否片段
 *   FAIL      无 url / 非 2xx / 非音频
 *
 * 实测基线（2026-11-21，星海 kwplay 302 落地后 Range 0-32767）：
 *   999999999 → 181,521 bytes  首帧 fffb90c4  无标签   ← 不存在的歌也会给音频
 *   1         → 1,047,532 bytes 首帧 ffb9064…  无标签
 *   182061798 → 真实的「平凡之路-2018南昌…现场片段」 无标签  ← 所以 NO-TAG 不能当错罪证
 *   228908    → 4,317,292 bytes 首帧 49443303  TIT2=晴天 / TPE1=周杰伦
 */
const https = require('https')
const http = require('http')

const RANGE_BYTES = 32767
const DEFAULT_MIDS = ['999999999', '1', '228908']
const XH_API = 'https://yy.zddyr.top/lx/api/'

function get(url, headers) {
  return new Promise((resolve, reject) => {
    const lib = String(url).startsWith('http:') ? http : https
    lib.get(url, { headers: headers || {}, timeout: 15000 }, (res) => {
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }))
    }).on('error', reject)
  })
}

function follow(url, headers) {
  let current = url
  let hop = 0
  const step = () => get(current, headers).then((r) => {
    if (r.status >= 300 && r.status < 400 && r.headers.location) {
      if (++hop > 8) throw new Error('too many redirects')
      current = new URL(r.headers.location, current).toString()
      return step()
    }
    return { status: r.status, headers: r.headers, body: r.body, finalUrl: current, hops: hop }
  })
  return step()
}

/** ID3v2.2~2.4 的 TIT2/TPE1/TALB，纯字节解码（宿主无 Buffer 也要能跑） */
function parseId3(buf) {
  if (buf.slice(0, 3).toString('latin1') !== 'ID3') return null
  const ver = buf[3]
  const size = ((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) | ((buf[8] & 0x7f) << 7) | (buf[9] & 0x7f)
  const out = {}
  let p = 10
  while (p + 10 <= Math.min(buf.length, 10 + size)) {
    const id = buf.slice(p, p + 4).toString('latin1')
    if (!/^[A-Z0-9]{4}$/.test(id)) break
    const fs = ver >= 4
      ? ((buf[p + 4] & 0x7f) << 21) | ((buf[p + 5] & 0x7f) << 14) | ((buf[p + 6] & 0x7f) << 7) | (buf[p + 7] & 0x7f)
      : buf.readUInt32BE(p + 4)
    const enc = buf[p + 10]
    const raw = buf.slice(p + 11, p + 10 + fs)
    let text = ''
    try {
      text = (enc === 1 || enc === 2) ? raw.toString('utf16le') : raw.toString('utf8')
    } catch (e) { text = '' }
    out[id] = String(text).replace(/\u0000/g, '').trim()
    p += 10 + fs
  }
  return out
}

/** FLAC VORBIS_COMMENT 块（type=4）的 TITLE/ARTIST/ALBUM */
function parseFlac(buf) {
  if (buf.slice(0, 4).toString('latin1') !== 'fLaC') return null
  let p = 4
  for (let guard = 0; guard < 10 && p + 4 <= buf.length; guard++) {
    const isLast = (buf[p] & 0x80) !== 0
    const type = buf[p] & 0x7f
    const len = (buf[p + 1] << 16) | (buf[p + 2] << 8) | buf[p + 3]
    if (type === 4) {
      const end = Math.min(p + 4 + len, buf.length)
      let q = p + 8
      const vendorLen = buf.readUInt32LE(p + 4)
      q = p + 8 + vendorLen
      if (q + 4 > end) return {}
      const count = buf.readUInt32LE(q)
      q += 4
      const out = {}
      for (let i = 0; i < count && q + 4 <= end; i++) {
        const cl = buf.readUInt32LE(q)
        q += 4
        if (cl <= 0 || q + cl > end) break
        const kv = buf.slice(q, q + cl).toString('utf8')
        q += cl
        const eq = kv.indexOf('=')
        if (eq > 0) out[kv.slice(0, eq).toUpperCase()] = kv.slice(eq + 1)
      }
      return out
    }
    p += 4 + len
    if (isLast) break
  }
  return {}
}

function norm(s) {
  return String(s || '').toLowerCase().replace(/[\s\u3000·\-_（）()\[\]「」《》]/g, '')
}

function verdictOf(tagTitle, expect) {
  if (!tagTitle) return 'NO-TAG'
  if (!expect) return 'OK'
  const a = norm(tagTitle)
  const b = norm(expect)
  if (!a || !b) return 'OK'
  return (a.includes(b) || b.includes(a)) ? 'OK' : 'MISMATCH'
}

async function kwSearchMid(keyword) {
  const url = 'https://search.kuwo.cn/r.s?all=' + encodeURIComponent(keyword) +
    '&ft=music&itemset=web_2013&client=kt&pn=0&rn=5&rformat=json&encoding=utf8'
  const r = await get(url, { 'User-Agent': 'Mozilla/5.0', Referer: 'https://www.kuwo.cn/' })
  const text = r.body.toString('utf-8').replace(/'/g, '"')
  let parsed = {}
  try { parsed = JSON.parse(text) } catch (e) { parsed = {} }
  const first = parsed.abslist && parsed.abslist[0]
  if (!first) return null
  return { mid: String(first.DC_TARGETID), name: first.NAME, artist: first.ARTIST }
}

async function probeOne(mid, opts) {
  const api = XH_API + '?source=kw&name=' + encodeURIComponent(opts.name || 'x') +
    '&singer=' + encodeURIComponent(opts.singer || 'y') +
    '&songmid=' + encodeURIComponent(mid) +
    '&interval=' + (opts.interval || 271) +
    '&quality=' + (opts.quality || '128k')
  let meta
  try {
    const r = await get(api)
    meta = JSON.parse(r.body.toString('utf-8'))
  } catch (e) {
    return { mid, verdict: 'FAIL', reason: 'API 请求/解析失败：' + e.message }
  }
  if (!meta || !meta.url) return { mid, verdict: 'FAIL', reason: 'API 未返回 url' }
  let landed
  try {
    landed = await follow(meta.url, {
      Range: 'bytes=0-' + RANGE_BYTES,
      'User-Agent': 'Mozilla/5.0 (Linux; Android 13) Mobile'
    })
  } catch (e) {
    return { mid, verdict: 'FAIL', reason: '落地请求失败：' + e.message }
  }
  if (!(landed.status >= 200 && landed.status < 300) && landed.status !== 206) {
    return { mid, verdict: 'FAIL', reason: 'HTTP ' + landed.status }
  }
  const head = landed.body.slice(0, 4).toString('hex')
  const id3 = parseId3(landed.body)
  const flac = parseFlac(landed.body)
  const tagTitle = (id3 && (id3.TIT2 || id3.TT2)) || (flac && (flac.TITLE || flac.TRACKTITLE)) || ''
  const tagArtist = (id3 && (id3.TPE1 || id3.TP1)) || (flac && (flac.ARTIST)) || ''
  return {
    mid,
    bytes: landed.body.length,
    head,
    contentType: landed.headers['content-type'] || '',
    contentRange: landed.headers['content-range'] || '',
    hops: landed.hops,
    tagTitle,
    tagArtist,
    tagAlbum: (id3 && (id3.TALB || id3.TT2 && id3.TALB)) || (flac && flac.ALBUM) || '',
    verdict: verdictOf(tagTitle, opts.expect)
  }
}

function report(index, r) {
  const id = '[PD' + index + ']'
  if (r.verdict === 'FAIL') {
    console.log(id + ' mid=' + r.mid + ' verdict=FAIL ' + r.reason)
    return
  }
  // content-range 形如 `bytes 0-32767/4317292`，尾巴是整曲总字节——历史基线记的就是它
  const total = (r.contentRange.match(/\/(\d+)$/) || [])[1] || '-'
  const tag = r.tagTitle
    ? 'title="' + r.tagTitle + '" artist="' + r.tagArtist + '"' + (r.tagAlbum ? ' album="' + r.tagAlbum + '"' : '')
    : 'title=- artist=-'
  console.log(
    id + ' mid=' + r.mid +
    ' totalBytes=' + total +
    ' readBytes=' + r.bytes +
    ' head=' + r.head +
    ' ct=' + (r.contentType || '-') +
    ' range=' + (r.contentRange ? 'yes' : 'no') +
    ' hops=' + r.hops +
    ' ' + tag +
    ' verdict=' + r.verdict
  )
  if (r.verdict === 'NO-TAG') {
    console.log(id + ' 提示：无标签不等于错歌——真实现场版同样无标签（mid 182061798）。仅在 identityStrict 源且被判片段时才该拒。')
  }
}

function parseArgs(argv) {
  const opts = { mids: [], search: '', quality: '128k', expect: '', name: '', singer: '', interval: 0 }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--mid') opts.mids = String(argv[++i] || '').split(',').map((s) => s.trim()).filter(Boolean)
    else if (a === '--search') { opts.search = String(argv[++i] || ''); opts.singer = String(argv[++i] || '') }
    else if (a === '--quality') opts.quality = String(argv[++i] || '128k')
    else if (a === '--expect') opts.expect = String(argv[++i] || '')
    else if (a === '--name') opts.name = String(argv[++i] || '')
    else if (a === '--interval') opts.interval = Number(argv[++i]) || 0
  }
  return opts
}

async function main() {
  const opts = parseArgs(process.argv)
  let mids = opts.mids.slice()
  if (opts.search) {
    const hit = await kwSearchMid(opts.search + (opts.singer ? ' ' + opts.singer : ''))
    if (!hit) {
      console.log('[PD0] 酷我搜索无结果：' + opts.search)
      return 1
    }
    console.log('[PD0] 酷我搜索命中 mid=' + hit.mid + ' name="' + hit.name + '" artist="' + hit.artist + '"')
    mids.push(hit.mid)
    if (!opts.name) opts.name = hit.name
    if (!opts.singer) opts.singer = hit.artist
    if (!opts.expect) opts.expect = hit.name
  }
  if (!mids.length) mids = DEFAULT_MIDS.slice()
  let index = 1
  for (const mid of mids) {
    // 逐条串行：并发打同一 CDN 会让 302 落地点抖动，取证要稳不要快
    const r = await probeOne(mid, opts)
    report(index++, r)
  }
  return 0
}

function __exit(code) {
  process.exit(code)
}

if (require.main === module) {
  main().then((code) => __exit(code)).catch((e) => {
    console.log('[PD99] 未捕获错误：' + (e && e.message ? e.message : e))
    __exit(1)
  })
}

module.exports = { parseId3, parseFlac, verdictOf, probeOne, kwSearchMid, follow }
