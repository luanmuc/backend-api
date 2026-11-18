#!/usr/bin/env node
// probe / telemetry 同 schema 校验（v9.2）—— 两类事实（源仓探测 vs 真机上报）共用一套语义名
//
// 契约（改任一侧字段名，这里必须同步改，否则报红）：
//   probe.total  ↔ 源仓 probeRequests      ↔ App DigestSourceCount.total
//   probe.ok     ↔ 源仓 probeSuccess       ↔ App DigestSourceCount.ok
//   play.total   ↔ 源仓 totalRequests      ↔ App 同上 total
//   play.ok      ↔ 源仓 totalSuccess       ↔ App 同上 ok
//
// 另断言：App 的 schema 版本串存在（健康上报必须带 schema 标识，便于将来演进）
const fs = require('fs')
const path = require('path')

function main() {
  const ROOT = path.resolve(__dirname, '..')
  const APP = path.resolve(ROOT, '../lx-music-mobile')
  const fails = []

  const persist = fs.readFileSync(path.join(ROOT, 'src/core/18-health-persist.js'), 'utf8')
  const digestTs = path.join(APP, 'src/core/healthDigest.ts')
  if (!fs.existsSync(digestTs)) {
    console.log(`⏭ schema-parity：App 未检出（${digestTs}）`)
    return 0
  }
  const digest = fs.readFileSync(digestTs, 'utf8')

  const SRC_FIELDS = ['probeRequests', 'probeSuccess', 'totalRequests', 'totalSuccess']
  for (const f of SRC_FIELDS) {
    if (!new RegExp(`\\b${f}\\b`).test(persist)) fails.push(`源仓 18-health-persist 缺少计数字段 ${f}`)
  }
  if (!/interface DigestSourceCount[\s\S]{0,80}total[\s\S]{0,40}ok/.test(digest)) {
    fails.push('App DigestSourceCount 不再是 { total, ok } 形状')
  }
  for (const k of ['probe:', 'play:', 'chain:', 'schema:']) {
    if (!digest.includes(k)) fails.push(`App HealthDigest 缺少顶层键 ${k}`)
  }

  if (fails.length) {
    console.log(`❌ schema-parity：${fails.length} 处`)
    fails.forEach(x => console.log('  ' + x))
    return 1
  }
  console.log('✅ schema-parity：4 组计数语义对齐（probe/play ↔ by_source），顶层 probe/play/chain/schema 齐备')
  return 0
}

if (require.main === module) process.exit(main())
