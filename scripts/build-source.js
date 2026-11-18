#!/usr/bin/env node
/**
 * v8.13 单文件构建
 * src/00-header.js + esbuild(bundle/iife/es2017) + src/80-entry.js -> lx-source.js
 *
 * IIFE 负责隔离作用域；末尾再补 CommonJS 桥，宿主仍能读取 module.exports。
 *
 * 关键约束：洛雪宿主按 CommonJS 读取 `module.exports`，因此构建后必须验证导出面；
 * 若 IIFE 包装丢失导出，构建脚本直接失败，不允许产出坏文件。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HEADER = require(path.join(ROOT, 'src', '00-header.js'));
const ENTRY = path.join(ROOT, 'src', '80-entry.js');
const DIST = path.join(ROOT, 'dist', 'lx-source.js');
const TARGET = path.join(ROOT, 'lx-source.js');
const VERSION = require(path.join(ROOT, 'package.json')).version;

function build() {
  // esbuild 惰性加载：顶层 require 会让「被 require 的模块」依赖本机开发依赖——
  // CI 用 npm ci --ignore-scripts 装不到 esbuild 二进制，M9b（require 安全）就会红。
  // eslint-disable-next-line global-require
  const esbuild = require('esbuild');
  esbuild.buildSync({
    entryPoints: [ENTRY],
    bundle: true,
    format: 'iife',         // 单文件 IIFE；隔离作用域，由末尾 CJS 桥接出 module.exports
    globalName: '__lxSourceBundle',
    platform: 'neutral',
    target: 'es2017',
    outfile: DIST,
    legalComments: 'none',
    banner: { js: HEADER },
    define: { __LX_SOURCE_VERSION__: JSON.stringify(VERSION) },   // v9.2：版本唯一真相源 = package.json
    logLevel: 'warning',
  });
}

function main() {
  build();
  const code = fs.readFileSync(DIST, 'utf8');
  if (!/var __lxSourceBundle = \(\(\) => \{/.test(code)) throw new Error('构建产物不是 IIFE 包装');
  if (!code.includes(`@version ${VERSION}`)) throw new Error(`构建产物缺少 ${VERSION} 版本头`);
  // 宿主按 CommonJS 读取导出面；IIFE 产物末尾补桥，不能为了格式丢导出。
  fs.appendFileSync(DIST, '\nif (typeof module !== "undefined" && module.exports) module.exports = __lxSourceBundle;\n');
  if (!/module\.exports\s*=\s*__lxSourceBundle/.test(fs.readFileSync(DIST, 'utf8'))) throw new Error('IIFE 产物缺少 CommonJS 导出桥');
  fs.copyFileSync(DIST, TARGET);
  const size = fs.statSync(TARGET).size;
  console.log(`built ${path.relative(ROOT, TARGET)} (${size} bytes)`);
}

// 只有直接 `node scripts/build-source.js` 才构建；被 require（如 require-safety 门禁）时不得写文件。
if (require.main === module) main();
module.exports = { build, main };
