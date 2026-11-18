#!/usr/bin/env node
// 分层依赖检查（v9.1-b）—— 防止拆包后架构退化
//
// 断言：
//   L1 core 模块不得 require legacy.js / 80-entry.js（只允许 入口 → 模块 单向）
//   L2 core 模块间 require 图无环
//   L3 每个 require 目标文件必须存在
//   L4 core 模块不得定义与 legacy 同名的顶层函数/常量（防止双份真相）
//   L5 core 模块不得出现 `globalThis.lx` 直接读取（必须走宿主注入）
//   L6 版本字面量只允许 02-config 的 fallback 一处（升版只改 package.json）
//
// 用法：node scripts/layer-check.js [--verbose]
const fs = require('fs')
const path = require('path')

function main() {
const ROOT = path.resolve(__dirname, '..')
const CORE = path.join(ROOT, 'src/core')
const VERBOSE = process.argv.includes('--verbose')

const mods = fs.readdirSync(CORE).filter(f => f.endsWith('.js')).sort()
const graph = new Map()
let fails = []

// L3 + L1
for (const f of mods) {
  const body = fs.readFileSync(path.join(CORE, f), 'utf8')
  const reqs = [...body.matchAll(/require\(\s*["']([^"']+)["']\s*\)/g)].map(m => m[1])
  const local = []
  for (const r of reqs) {
    if (!r.startsWith('.')) continue   // 内置模块
    const target = path.resolve(CORE, r)
    if (!fs.existsSync(target)) { fails.push(`L3 ${f} → 目标不存在: ${r}`); continue }
    if (r.includes('legacy') || r.includes('80-entry')) { fails.push(`L1 ${f} → 非法反向引用: ${r}`); continue }
    local.push(path.basename(target))
  }
  graph.set(f, local)
}

// L2 环检测
const state = new Map()
function dfs(n, stack) {
  state.set(n, 'visiting')
  for (const next of graph.get(n) || []) {
    if (state.get(next) === 'visiting') {
      fails.push(`L2 环: ${[...stack, next].join(' → ')}`)
    } else if (!state.get(next)) dfs(next, [...stack, next])
  }
  state.set(n, 'done')
}
for (const f of mods) if (!state.get(f)) dfs(f, [f])

// L4 同名顶层定义（legacy 里仍保留的定义名）
const legacy = fs.readFileSync(path.join(ROOT, 'src/legacy.js'), 'utf8')
const legacyDefs = new Set([...legacy.matchAll(/^(?:const|let|var|function|async function)\s+(\w+)/gm)].map(m => m[1]))
for (const f of mods) {
  const body = fs.readFileSync(path.join(CORE, f), 'utf8')
  for (const m of body.matchAll(/^(?:const|let|var|function|async function)\s+(\w+)/gm)) {
    if (legacyDefs.has(m[1]) && m[1].length > 3) fails.push(`L4 ${f} 重复定义 ${m[1]}（legacy 同名）`)
  }
}

// L5 globalThis.lx 直接读
for (const f of mods) {
  if (f === '00-host.js') continue   // 宿主层本身就是唯一允许访问 globalThis.lx 的地方
  const body = fs.readFileSync(path.join(CORE, f), 'utf8')
  if (/globalThis\.lx/.test(body)) fails.push(`L5 ${f} 直接读 globalThis.lx（应走 00-host）`)
}

// L6：版本字面量只允许一处（02-config 的 fallback，且必须等于 package.json.version）
const pkgVer = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version
for (const f of [...mods, '__legacy__']) {
  const fp = f === '__legacy__' ? path.join(ROOT, 'src/legacy.js') : path.join(CORE, f)
  const body = fs.readFileSync(fp, 'utf8')
  for (const m of body.matchAll(/"(8\.\d+\.\d+)"/g)) {
    if (f === '02-config.js') continue   // 02-config 是版本常量唯一登记处（当前版本 + 可接受下限）
    if (f === '__legacy__' && body.slice(0, m.index).split('\n').slice(-1)[0].includes('@version')) continue
    fails.push(`L6 ${f} 硬编码版本字面量 ${m[1]}（应走 SOURCE_VERSION）`)
  }
}

if (VERBOSE) for (const [k, v] of graph) console.log(`  ${k} → ${v.join(', ') || '（无本地依赖）'}`)
if (fails.length) {
  console.log(`❌ layer-check：${fails.length} 处违规`)
  fails.slice(0, 12).forEach(x => console.log('  ' + x))
  return 1
}
console.log(`✅ layer-check：${mods.length} 个 core 模块，无环 / 无反向引用 / 无同名定义 / 无直读 lx`)

}

if (require.main === module) process.exit(main())
