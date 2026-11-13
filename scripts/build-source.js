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
const esbuild = require('esbuild');

const ROOT = path.join(__dirname, '..');
const HEADER = require(path.join(ROOT, 'src', '00-header.js'));
const ENTRY = path.join(ROOT, 'src', '80-entry.js');
const DIST = path.join(ROOT, 'dist', 'lx-source.js');
const TARGET = path.join(ROOT, 'lx-source.js');

function build() {
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
    logLevel: 'warning',
  });
}

function main() {
  build();
  const code = fs.readFileSync(DIST, 'utf8');
  if (!/var __lxSourceBundle = \(\(\) => \{/.test(code)) throw new Error('构建产物不是 IIFE 包装');
  if (!code.includes('@version 8.13.1')) throw new Error('构建产物缺少 8.13.1 版本头');
  // 宿主按 CommonJS 读取导出面；IIFE 产物末尾补桥，不能为了格式丢导出。
  fs.appendFileSync(DIST, '\nif (typeof module !== "undefined" && module.exports) module.exports = __lxSourceBundle;\n');
  if (!/module\.exports\s*=\s*__lxSourceBundle/.test(fs.readFileSync(DIST, 'utf8'))) throw new Error('IIFE 产物缺少 CommonJS 导出桥');
  fs.copyFileSync(DIST, TARGET);
  const size = fs.statSync(TARGET).size;
  console.log(`built ${path.relative(ROOT, TARGET)} (${size} bytes)`);
}

main();
