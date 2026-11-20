#!/usr/bin/env node
/**
 * v8.17 阶段 4：拉取真机摘要（公开仓 lx-telemetry），供日报做「CI 探测 vs 真机」对照。
 *
 * 只读公开 raw/API，不需要任何 secret。写入 docs/device-digests.jsonl（60 天滚动）。
 * 网络失败不阻断每日巡检：返回 0 行 + 显式 warning，由日报标注「今日无真机数据」。
 */
const fs = require('fs')
const path = require('path')

const REPO = process.env.TELEMETRY_REPO || 'luanmuc/lx-telemetry'
const API = `https://api.github.com/repos/${REPO}/contents/digests`
const RAW = `https://raw.githubusercontent.com/${REPO}/main/digests`
const OUT = path.join(__dirname, '..', 'docs', 'device-digests.jsonl')

// v9.1.4：原实现有一个从未参与过滤的 `KEEP_DAYS = 60`，日志却照它打印
// 「保留 60 天窗口」，而真实 cutoff 由 `--days`（默认 14）决定 —— 日志与行为不符。
// 删除该死常量，日志改用真实 days。
//
// cstDate：把任意时间戳换算成**北京日期**。
// 无时区后缀的串按 UTC 解释（CI runner 是 UTC；显式补 Z，避免本地 +08 环境对同一串
// 得到与 CI 不同的日期）。Date.parse 归一化到 UTC 毫秒后统一 +8h —— 带不带偏移都对。
function cstDate(iso) {
  if (!iso) return ''
  const s = /[zZ]|[+-]\d{2}:\d{2}$/.test(iso) ? iso : iso + 'Z'
  const ms = Date.parse(s)
  if (!Number.isFinite(ms)) return ''
  return new Date(ms + 8 * 3600 * 1000).toISOString().slice(0, 10)
}

async function fetchJson(url) {
  const headers = { 'User-Agent': 'lx-music-source-health' }
  if (process.env.GITHUB_TOKEN) headers.Authorization = 'Bearer ' + process.env.GITHUB_TOKEN
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`)
  return res.json()
}

async function fetchLines(file) {
  const res = await fetch(`${RAW}/${file}`, { headers: { 'User-Agent': 'lx-music-source-health' } })
  if (!res.ok) throw new Error(`${file} → HTTP ${res.status}`)
  return (await res.text()).split('\n').filter(l => l.trim())
}

async function main() {
  const days = Number((process.argv.find(a => a.startsWith('--days=')) || '--days=14').split('=')[1]) || 14
  const cutoff = cstDate(new Date(Date.now() - days * 864e5).toISOString())
  let files = []
  try {
    const list = await fetchJson(API)
    if (!Array.isArray(list)) throw new Error('digests 目录返回非数组（仓可能还没有数据）')
    files = list.filter(f => f.name.endsWith('.jsonl')).map(f => f.name).sort().slice(-days)
  } catch (e) {
    console.warn(`::warning::真机摘要目录读取失败（${e.message}）—— 日报将标注无真机数据`)
  }

  const rows = []
  for (const f of files) {
    try {
      for (const line of await fetchLines(f)) {
        const row = JSON.parse(line)
        if (!row.digest || !row.digest.device || !row.digest.generated_at) continue
        const date = cstDate(row.digest.generated_at)
        if (date < cutoff) continue
        rows.push({ date, device: row.digest.device.id, app: (row.digest.app || {}).version || '', digest: row.digest, ingested_at: row.ingested_at || null })
      }
    } catch (e) {
      console.warn(`::warning::${f} 读取失败（${e.message}）`)
    }
  }

  // 去重：同设备同时间点只留一条（服务端已去重，这里防历史脏数据）
  const seen = new Set()
  const uniq = rows.filter(r => {
    const k = r.device + '|' + r.digest.generated_at
    if (seen.has(k)) return false
    seen.add(k); return true
  }).sort((a, b) => a.date.localeCompare(b.date) || a.device.localeCompare(b.device))

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, uniq.map(r => JSON.stringify(r)).join('\n') + (uniq.length ? '\n' : ''))
  console.log(`✅ [device-digests] ${uniq.length} 条（${files.length} 个日文件，保留 ${days} 天窗口）`)
}

if (require.main === module) main().catch(e => { console.error('❌ ' + e.message); process.exit(1) })

module.exports = { cstDate, OUT }
