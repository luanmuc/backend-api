#!/usr/bin/env node
/**
 * 口径门禁（源仓侧）· tg-truth
 * 接进 npm test 后，每次跑测试都会核对"仓库里各个数字和现实是否一致"。
 * 只读仓库内文件，无网络、无 SDK，单次 < 1s。
 */
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..', '..')
const LEGACY_SESSION = '38450522296' + '699906' // 拼出以规避本文件自指
const rd = (p) => fs.readFileSync(path.join(root, p), 'utf8')

let red = 0
const P = (id, msg) => console.log('  ✅ ' + '[' + id + '] ' + msg)
const F = (id, msg) => { red++; console.log('  ❌ ' + '[' + id + '] ' + msg) }
const S = (id, msg) => { red++; console.log('  ❌  ' + '[' + id + '] ' + msg + '（读不到=判据失效，按红处理）') }

// G1 源数：provider 定义数 vs run.js 断言值
try {
  const allSrc = fs.readdirSync(path.join(root, 'src/core')).filter((f) => f.endsWith('.js'))
    .map((f) => rd('src/core/' + f)).join('\n') + '\n' + rd('src/legacy.js')
  const provs = [...allSrc.matchAll(/\n\s+([A-Za-z0-9_]+):\s+provider\(/g)].map(m => m[1])
  const m = rd('tools/live/run.js').match(/real\.length === (\d+)/)
  if (!m) F('G1 run.js 找不到 real.length 断言')
  else if (Number(m[1]) === provs.length) P('G1', `源数 ${m[1]} = 实际 provider ${provs.length}`)
  else F('G1', `run.js 断言 ${m[1]} ≠ 实际 provider ${provs.length}（${provs.join(',')}）`)
} catch (e) { S('G1', '跳过：' + e.message) }

// G2/G3 测试入口数与 npm test 脚本数
try {
  const doc = rd('docs/TESTING.md')
  const all = []
  const walk = (d) => { for (const f of fs.readdirSync(path.join(root, d))) {
    const rel = path.join(d, f); const st = fs.statSync(path.join(root, rel))
    if (st.isDirectory()) walk(rel); else if (f.endsWith('.js')) all.push(rel)
  } }
  walk('test')
  const ent = doc.match(/\*\*(\d+) 个入口\*\*/)
  if (!ent) S('G2', 'TESTING.md 无"N 个入口"')
  else if (Number(ent[1]) === all.length) P('G2', `入口 ${ent[1]} = 实际 ${all.length}`)
  else F('G2', `入口声明 ${ent[1]} ≠ 实际 ${all.length} 个 test/**/*.js`)
  const scr = doc.match(/`npm test` 的 \*\*(\d+) 个脚本\*\*/)
  const cmds = (JSON.parse(rd('package.json')).scripts.test.match(/(?:^|&&)\s*node\s/g) || []).length
  if (!scr) S('G3', 'TESTING.md 无"M 个脚本"')
  else if (Number(scr[1]) === cmds) P('G3', `脚本 ${scr[1]} = 实际 ${cmds}`)
  else F('G3', `脚本声明 ${scr[1]} ≠ 实际 ${cmds}`)
} catch (e) { S('G2/G3', '跳过：' + e.message) }

// G4 旧会话绝对路径必须为 0
try {
  const skip = new Set(['node_modules', '.git', 'dist'])
  const hits = []
  const walk = (d) => {
    for (const f of fs.readdirSync(path.join(root, d))) {
      if (skip.has(f)) continue
      const rel = path.join(d, f); const st = fs.statSync(path.join(root, rel))
      if (st.isDirectory()) walk(rel)
      else if (st.size < 2_000_000 && /\.(js|json|md|ts|tsx|yml|yaml|gradle|java|txt)$/.test(f)) {
        try { if (path.basename(f) !== 'tg-truth.js' && rd(rel).includes(LEGACY_SESSION)) hits.push(rel) } catch (_) {}
      }
    }
  }
  walk('.')
  if (!hits.length) P('G4', '硬编码旧会话路径 0 处')
  else F('G4', `硬编码旧会话路径 ${hits.length} 处：${hits.join(', ')}`)
} catch (e) { S('G4', '跳过：' + e.message) }

// G9 版本串一致：lx-source.js 的 @version vs package.json version
try {
  const av = (rd('lx-source.js').match(/@version\s+([0-9a-z.\-]+)/) || [])[1]
  const pv = JSON.parse(rd('package.json')).version
  if (!av) S('G9', 'lx-source.js 找不到 @version')
  else if (av === pv) P('G9', `版本串 ${av} = package.json ${pv}`)
  else F('G9', `lx-source.js @version ${av} ≠ package.json ${pv}`)
} catch (e) { S('G9', '跳过：' + e.message) }


// G13 CI paths 必须覆盖 src/**（改源实现不触发 CI 是真实事故源）
try {
  const lines = rd('.github/workflows/ci.yml').split(/\n/)
  const at = lines.findIndex(l => /^\s{2}push:\s*$/.test(l))
  let pushLines = []
  if (at >= 0) {
    for (let i = at + 1; i < lines.length; i++) {
      if (/^\s{2}[a-z_]+:\s*$/.test(lines[i])) break
      pushLines.push(lines[i])
    }
  }
  const covered = pushLines.some(l => /-\s*'?"?\s*src\/\*\*/.test(l))
  if (covered) P('G13', 'ci.yml 的 push.paths 覆盖 src/**')
  else F('G13', 'ci.yml 的 push.paths 未覆盖 src/**（改 src/ 不会触发 CI）')
} catch (e) { S('G13', '跳过：' + e.message) }

// G14 活跃计划唯一：一个仓库只允许一份审计计划 + 一份压测计划
// 由来：2026-11-16 用户要求「这两个计划每个仓库都得保持唯一」。实际盘点发现压测计划藏在
// docs/audit-plans/stress-round5.md（目录名还叫 audit-plans），而 archive 里还躺着 v9 与
// round1~5 共 7 份历史计划。计划分叉后，「审什么」和「怎么压」会各改各的，缺口永远对不上。
// 归档已合并成 docs/archive/AUDIT_HISTORY.md 一份，所以这里只锁活跃面：docs/ 根目录各 1 份。
try {
  const docs = fs.readdirSync(path.join(root, 'docs'))
  const plans = docs.filter(f => /^AUDIT_PLAN.*\.md$/.test(f))
  const stress = docs.filter(f => /^STRESS_PLAN.*\.md$/.test(f))
  const strayDirs = fs.existsSync(path.join(root, 'docs', 'audit-plans'))
  if (plans.length === 1 && stress.length === 1 && !strayDirs) P('G14', `活跃计划唯一：${plans[0]} / ${stress[0]}`)
  else F('G14', `活跃计划不唯一：审计 [${plans.join(', ') || '无'}] 压力 [${stress.join(', ') || '无'}]${strayDirs ? '；docs/audit-plans/ 目录仍在' : ''}`)
} catch (e) { S('G14', '无法枚举 docs/：' + e.message) }

// G15 巡检统计双口径：健康日报必须同时输出 rateRaw 与 wilsonLow（只留一个 = 历史对比断档/无置信下限）
try {
  const hd = rd('scripts/health-daily.js')
  const hasBoth = /rateRaw/.test(hd) && /wilsonLow/.test(hd)
  const bucketUses = /wilsonLow < WILSON_OK_MIN/.test(hd)
  if (hasBoth && bucketUses) P('G15', '健康日报同时保留 rateRaw/wilsonLow，且分级使用置信下限')
  else F('G15', `双口径缺失（rateRaw=${/rateRaw/.test(hd)} wilsonLow=${/wilsonLow/.test(hd)} 分级=${bucketUses}）`)
} catch (e) { S('G15', '跳过：' + e.message) }

// G17 空跑守卫：probe 必须支持 --assert-samples，且 CI 的 probe step 真的带上它
try {
  const probe = rd('scripts/probe.js')
  const ci = rd('.github/workflows/ci.yml')
  if (/--assert-samples/.test(probe) && /probe\.js --reps=3 --assert-samples/.test(ci)) P('G17', '空跑守卫已接入 CI（--assert-samples）')
  else F('G17', `空跑守卫未接入（probe=${/--assert-samples/.test(probe)} ci=${/--assert-samples/.test(ci)}）`)
} catch (e) { S('G17', '跳过：' + e.message) }

// G18 真机摘要链路：拉取脚本 + CI 步骤必须同时存在（只留脚本等于没人跑）
try {
  const pull = rd('scripts/pull-device-digests.js')
  const ci = rd('.github/workflows/ci.yml')
  if (/device-digests\.jsonl/.test(pull) && /pull-device-digests\.js/.test(ci)) P('G18', '真机摘要拉取已接入 CI（docs/device-digests.jsonl）')
  else F('G18', `真机链路缺失（脚本=${/device-digests/.test(pull)} ci=${/pull-device-digests/.test(ci)}）`)
} catch (e) { S('G18', '跳过：' + e.message) }

console.log(red ? `\n❌ tg-truth：${red} 条口径不一致` : '\n✅ tg-truth：口径全部一致')

if (require.main === module) process.exit(red ? 1 : 0)
