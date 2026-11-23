// ============================================================
// R81 · 真机 QuickJS Proxy 兼容守卫
//
// 背景（真机实测，2026-11-23）：
//   wrapper-android 2.4.0 内嵌 QuickJS 2024-02-14（so 里版本串 2024-02-14，且 so 内含
//   "proxy: inconsistent get" 消息）。该版本把 Date 包成 Proxy；宿主
//   android/app/src/main/assets/script/user-api-preload.js 的 freezeObjectProperty(globalThis)
//   又把 Date.parse 改成 non-configurable/non-writable。于是任何一次 Date.parse 读取都会
//   触发 Proxy invariant 检查并按 "proxy: inconsistent get" 抛错（真机栈：
//   checkFresh(6066) → validateProviderContracts(6111) → src/legacy.js → <eval>），
//   整个音源初始化直接失败。
//   V8 / Node / 旧版 QuickJS 都不校验这一条，所以本地门禁全绿也发现不了。
//
// 本用例守住：
//   P1 产物可执行代码（去注释）里不得出现 Date.parse
//   P2 产物必须带纯算术 parseYmdToMs
//   P3 产物可执行代码（去注释）里不得出现 new Proxy
//   P4 源码调用面 Date.parse( 计数为 0
//   P5 源码可定位 parseYmdToMs 实现
//   P6 parseYmdToMs 与 Date.parse 对闰年 / 跨纪元 / 非法输入逐例等价（引擎无关的算法校验）
// ============================================================
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..', '..')
const DIST = path.join(ROOT, 'dist', 'lx-source.js')
const CONTRACT = path.join(ROOT, 'src', 'core', '12-provider-contract.js')

let failed = 0
const rec = (id, name, cond, extra) => {
  if (cond) console.log(`✅ [${id}] ${name}`)
  else { failed++; console.log(`❌ [${id}] ${name}${extra ? ' — ' + extra : ''}`) }
}

// 去掉块注释与整行行注释：只保留会被引擎执行的代码
const stripComments = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .filter((line) => !line.trimStart().startsWith('//'))
  .join('\n')

const distCode = stripComments(fs.readFileSync(DIST, 'utf8'))
const srcCode = stripComments(fs.readFileSync(CONTRACT, 'utf8'))

rec('P1', '产物可执行代码不含 Date.parse', (distCode.match(/Date\.parse/g) || []).length === 0,
  'still ' + (distCode.match(/Date\.parse/g) || []).length)
rec('P2', '产物含纯算术 parseYmdToMs', /parseYmdToMs/.test(distCode))
rec('P3', '产物可执行代码不含 new Proxy', (distCode.match(/\bnew Proxy\b/g) || []).length === 0,
  'still ' + (distCode.match(/\bnew Proxy\b/g) || []).length)
rec('P4', '源码 Date.parse( 调用为 0', (srcCode.match(/Date\.parse\s*\(/g) || []).length === 0,
  'still ' + (srcCode.match(/Date\.parse\s*\(/g) || []).length)

// P5/P6：从源码取出 parseYmdToMs 原文，独立执行并与 Date.parse 对照
const m = srcCode.match(/function parseYmdToMs[\s\S]*?\n}/)
rec('P5', '源码可定位 parseYmdToMs 实现', !!m)
if (m) {
  const fn = new Function(`${m[0]}\nreturn parseYmdToMs`)()
  const cases = ['2026-11-23', '2024-02-29', '1970-01-01', '1969-12-31', '2026-01-01',
    '2026-12-31', '2000-03-01', '1999-12-31', '2025-06-15', 'bad', '2026-13-01', '2026-11-32']
  let diff = 0
  for (const s of cases) {
    const a = fn(s)
    const b = Date.parse(`${s}T00:00:00Z`)
    if (!((Number.isNaN(a) && Number.isNaN(b)) || a === b)) {
      diff++
      console.log(`   ${s}: parseYmdToMs=${a} Date.parse=${b}`)
    }
  }
  rec('P6', `parseYmdToMs 与 Date.parse 等价（${cases.length} 例）`, diff === 0, `diff=${diff}`)
}

console.log('')
console.log(failed === 0 ? 'R81 Proxy 兼容: all passed' : `R81 Proxy 兼容: ${failed} failed`)
if (require.main === module) process.exit(failed === 0 ? 0 : 1)
