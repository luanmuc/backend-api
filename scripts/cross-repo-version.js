#!/usr/bin/env node
// 跨仓版本闸门（v9.1-b / C3）—— 用 App 侧真实解析器验证源仓产物
//
// 断言：
//   X1 App 的 builtinSource.ts 存在且能提取出 @version 解析正则（契约存在）
//   X2 用 App 的正则解析源仓 lx-source.js，必须能解析出版本
//   X3 该版本必须等于 src/legacy.js 头部的 @version（同一产物同一版本）
//   X4 版本必须是 App 期望的形态（三段数字，可含 -bNN 后缀但主版本为数字）
//   X5 App assets/builtin_source.js 若已存在，其版本不得高于源仓（防止用旧源做出包）
//
// 用法：node scripts/cross-repo-version.js [--verbose]
const fs = require('fs')
const path = require('path')

function main() {
const ROOT = path.resolve(__dirname, '..')
const APP = path.resolve(ROOT, '../lx-music-mobile')
const VERBOSE = process.argv.includes('--verbose')
const fails = []

const tsPath = path.join(APP, 'src/core/init/userApi/builtinSource.ts')
if (!fs.existsSync(tsPath)) {
  console.log(`⏭ cross-repo-version：App 未检出（${tsPath}）`)
  return 0
}
const ts = fs.readFileSync(tsPath, 'utf8')
const m = ts.match(/HEADER_VERSION_LINE_REGEX\s*=\s*\/(.+)\/m/)
if (!m) fails.push('X1 App 侧找不到 HEADER_VERSION_LINE_REGEX（契约变更？）')
const re = m ? new RegExp(m[1], 'm') : null

const parse = (txt) => { const r = re.exec(txt); return r ? r[1] : '' }

const built = parse(fs.readFileSync(path.join(ROOT, 'lx-source.js'), 'utf8'))
const src = (fs.readFileSync(path.join(ROOT, 'src/legacy.js'), 'utf8').match(/@version[: \t]+([\d.]+)/) || [])[1] || ''
if (!built) fails.push('X2 产物无法被 App 解析器解出版本')
if (built && src && built !== src) fails.push(`X3 产物版本 ${built} ≠ legacy 版本 ${src}`)
if (built && !/^\d+\.\d+\.\d+(?:-b\d+)?$/.test(built)) fails.push(`X4 版本形态异常：${built}`)

const appAsset = path.join(APP, 'android/app/src/main/assets/builtin_source.js')
let assetVer = '（未生成，构建期拉取）'
if (fs.existsSync(appAsset)) {
  assetVer = parse(fs.readFileSync(appAsset, 'utf8')) || '（解析失败）'
  const cmp = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if ((x[i]||0) !== (y[i]||0)) return (x[i]||0) - (y[i]||0); return 0 }
  if (assetVer !== '（解析失败）' && assetVer !== built && cmp(assetVer, built) > 0) fails.push(`X5 App 内置源 ${assetVer} 高于源仓 ${built}（会用旧源出包）`)
}

if (VERBOSE) console.log(`  产物 ${built} / legacy ${src} / App assets ${assetVer}`)
if (fails.length) { console.log(`❌ cross-repo-version：${fails.length} 处`); fails.forEach(x => console.log('  ' + x)); return 1 }
console.log(`✅ cross-repo-version：产物 ${built} = legacy ${src}，App 解析器兼容`)

}

if (require.main === module) process.exit(main())
