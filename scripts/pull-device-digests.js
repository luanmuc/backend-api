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
const KEEP_DAYS = 60

function cstDate(iso) {
  return new Date(Date.parse(iso) + 8 * 3600 * 1000).toISOString().slice(0, 10)
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
  console.log(`✅ [device-digests] ${uniq.length} 条（${files.length} 个日文件，保留 ${KEEP_DAYS} 天窗口）`)
}

if (require.main === module) main().catch(e => { console.error('❌ ' + e.message); process.exit(1) })

module.exports = { cstDate, OUT }
