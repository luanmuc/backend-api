#!/usr/bin/env node
/**
 * v8.17 每日出链抽样
 *
 * 定位：probe.js 只回答“端点活着没”，source-audit.js 回答“能不能真出链”但要全量跑。
 * 本脚本是两者的中间层——每天对**启用中的源**各抽 1 首固定样例（128k），
 * 把“端点活着 ≠ 能出链”这条缺口补上，成本约 10 个请求。
 *
 * 产物：docs/chain-sample.jsonl（按 date+src 去重、30 天滚动）
 * 用法：node scripts/chain-sample.js [--strict]
 *   --strict：任一启用源取链失败则 exit 1（默认只告警，不阻断每日巡检）
 */
const { execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const { todayCN } = require('./cn-date.js')

const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'docs', 'chain-sample.jsonl')
const KEEP_DAYS = 30
const STRICT = process.argv.includes('--strict')

function loadRows() {
  try {
    return execFileSync(process.execPath, [path.join(__dirname, 'source-audit.js'), '--quick', '--json'], {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 180000,
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 8 * 1024 * 1024,
    })
  } catch (e) {
    // source-audit --quick 默认 exit 0；非 0 说明脚本自身坏了，必须显式失败
    throw new Error(`source-audit --quick 失败：${(e.stdout || e.message || '').slice(0, 300)}`)
  }
}

function main() {
  const raw = loadRows()
  const parsed = JSON.parse(raw)
  const date = todayCN()
  const rows = (parsed.rows || []).map(r => ({
    date,
    src: r.src,
    plat: r.plat,
    ok: !!r.ok,
    code: r.code || (r.ok ? 'OK' : 'ERR'),
    playable: r.playable || '',
    ms: Number(r.ms) || 0,
  }))
  if (!rows.length) throw new Error('出链抽样 0 行——source-audit --quick 没有返回任何源')

  // 读旧记录：按日期滚动清理 + 同日同源覆盖（避免同日多次运行累积重复）
  let old = []
  if (fs.existsSync(OUT)) {
    old = fs.readFileSync(OUT, 'utf8').split('\n').filter(l => l.trim()).map(l => {
      try { return JSON.parse(l) } catch { return null }
    }).filter(Boolean)
  }
  const cutoff = new Date(Date.now() - KEEP_DAYS * 864e5).toISOString().slice(0, 10)
  const keep = old.filter(r => r.date >= cutoff && !(r.date === date && rows.some(n => n.src === r.src)))
  const merged = keep.concat(rows).sort((a, b) => (a.date + a.src).localeCompare(b.date + b.src))
  fs.writeFileSync(OUT, merged.map(r => JSON.stringify(r)).join('\n') + '\n')

  const okN = rows.filter(r => r.ok).length
  console.log(`✅ [chain-sample] ${date} 启用源 ${rows.length}，出链成功 ${okN}/${rows.length}`)
  const failed = rows.filter(r => !r.ok)
  for (const r of failed) console.log(`   ❌ ${r.src}（${r.plat}）${r.code}${r.playable ? ' ' + r.playable : ''}`)
  if (STRICT && failed.length) process.exit(1)
}

if (require.main === module) main()

module.exports = { loadRows, main }
