#!/usr/bin/env node
/**
 * E0 契约面快照（v9.0 拆包前置）
 *
 * 目的：拆包会重排 384 个顶层定义、改模块边界。行为快照（equiv-snapshot）只能证明
 * 「取链结果没变」，证明不了「导出面 / 事件字段 / 快照格式没变」。本脚本把契约面
 * 静态抽出来做成可 diff 的基线 —— 拆包前后必须逐项一致。
 *
 * 锁定内容：
 *   1. module.exports 顶层导出键（27 个，测试与 App 契约检查消费）
 *   2. __debug 非枚举钩子键（压测/审计直接驱动内部策略）
 *   3. ERROR_CODES 键（对 App 是可见错误码，新增/删改即破坏契约）
 *   4. HEALTH_EVENT_FIELDS（健康事件字段白名单，12 个）
 *   5. 健康快照顶层键（exportHealthState 的返回结构，App 持久化直接存盘）
 *
 * 用法：
 *   node scripts/api-surface.js --write   # 录基线到 test/fixtures/api-surface.json
 *   node scripts/api-surface.js           # 比对基线，有差异退出码 1
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src', 'legacy.js');
// v9.0 起契约面分散在多个模块：公共层在 src/core/，其余仍在 legacy.js。
// 按「core 先、legacy 后」拼接成一个虚拟文本再解析，标记缺失即报错（不许静默通过）。
const CORE_DIR = path.join(ROOT, 'src', 'core');
const coreFiles = fs.existsSync(CORE_DIR) ? fs.readdirSync(CORE_DIR).filter((f) => f.endsWith('.js')).sort().map((f) => path.join(CORE_DIR, f)) : [];
const OUT = path.join(ROOT, 'test', 'fixtures', 'api-surface.json');

/** 从 `{` 起做花括号配平，跳过字符串与注释，返回块内文本（不含首尾括号） */
function braceBlock(text, openIdx) {
  let depth = 0;
  let i = openIdx;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '/' && text[i + 1] === '/') { i = text.indexOf('\n', i); if (i < 0) break; continue; }
    if (ch === '/' && text[i + 1] === '*') { i = text.indexOf('*/', i) + 2; continue; }
    if (ch === '"' || ch === "'" || ch === '`') {
      const q = ch; i++;
      while (i < text.length && text[i] !== q) { if (text[i] === '\\') i++; i++; }
      i++; continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) return text.slice(openIdx + 1, i); }
    i++;
  }
  throw new Error('未闭合的块');
}

/** 从标记串之后找第一个该字符并配平 */
function blockAfter(text, marker, openChar) {
  const at = text.indexOf(marker);
  if (at < 0) throw new Error(`未找到标记: ${marker}`);
  const open = text.indexOf(openChar, at + marker.length);
  if (open < 0) throw new Error(`标记后未找到 ${openChar}: ${marker}`);
  return braceBlock(text, open);
}

/** 块内键名：indent 空格缩进起，支持 `key,` / `key: value` / `get key() {}` */
function keysIn(block, indent) {
  const re = new RegExp(`^ {${indent}}(?:get\\s+)?([A-Za-z_$][\\w$]*)\\s*(?:[,:(=]|\\r?\\n|$)`, 'gm');
  const keys = [];
  for (const m of block.matchAll(re)) keys.push(m[1]);
  return keys;
}

function arrStrings(text, constName) {
  const at = text.indexOf(`const ${constName} = [`);
  if (at < 0) throw new Error(`未找到数组: ${constName}`);
  const open = text.indexOf('[', at);
  let depth = 0; let i = open;
  while (i < text.length) {
    if (text[i] === '[') depth++;
    else if (text[i] === ']') { depth--; if (depth === 0) break; }
    i++;
  }
  const body = text.slice(open + 1, i);
  return [...body.matchAll(/["']([^"']+)["']/g)].map((m) => m[1]);
}

function build() {
  const legacy = [
    fs.readFileSync(SRC, 'utf8'),
    ...coreFiles.map((f) => fs.readFileSync(f, 'utf8')),
  ].join('\n');
  const coreTexts = coreFiles.map((f) => ({ file: f, text: fs.readFileSync(f, 'utf8') }));
  // 拆包后契约面分散在多个文件：按标记定位所属文件；找不到即报错（不许静默通过）
  const pick = (marker) => {
    if (legacy.includes(marker)) return { file: SRC, text: legacy };
    for (const c of coreTexts) if (c.text.includes(marker)) return c;
    throw new Error(`未找到标记: ${marker}`);
  };

  const exSrc = pick('module.exports = ');
  const exportsBlock = blockAfter(exSrc.text, 'module.exports = ', '{');
  const dbgSrc = pick('Object.defineProperty(module.exports, "__debug"');
  const debugBlock = blockAfter(dbgSrc.text, 'Object.defineProperty(module.exports, "__debug"', '{');
  const frozenBlock = blockAfter(debugBlock, 'Object.freeze(', '{');
  const ecSrc = pick('const ERROR_CODES = ');
  const errorBlock = blockAfter(ecSrc.text, 'const ERROR_CODES = ', '{');
  const hfSrc = pick('const HEALTH_EVENT_FIELDS = [');

  // 健康快照返回结构：exportHealthState 的 return { ... }
  const expFn = legacy.slice(legacy.indexOf('function exportHealthState()'));
  const retIdx = expFn.indexOf('return {');
  const snapshotBlock = braceBlock(expFn, retIdx + 'return '.length);
  const snapshotKeys = snapshotBlock
    .split(',')
    .map((seg) => (seg.trim().match(/^(?:get\s+)?([A-Za-z_$][\w$]*)/) || [])[1])
    .filter(Boolean);

  const surface = {
    source: [SRC, ...coreFiles].map((f) => path.relative(ROOT, f)).join(','),
    exports: keysIn(exportsBlock, 4).sort(),
    debug: keysIn(frozenBlock, 6).sort(),
    errorCodes: keysIn(errorBlock, 2).sort(),
    healthEventFields: arrStrings(hfSrc.text, 'HEALTH_EVENT_FIELDS'),
    healthSnapshotKeys: snapshotKeys.sort(),
  };
  surface.counts = {
    exports: surface.exports.length,
    debug: surface.debug.length,
    errorCodes: surface.errorCodes.length,
    healthEventFields: surface.healthEventFields.length,
    healthSnapshotKeys: surface.healthSnapshotKeys.length,
  };
  const canonical = JSON.stringify(surface);
  surface.digest = crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 32);
  return surface;
}

/** 键集合级差异：少了的、多出来的 */
function diffKeys(name, a = [], b = []) {
  const out = [];
  const onlyA = a.filter((k) => !b.includes(k));
  const onlyB = b.filter((k) => !a.includes(k));
  if (onlyA.length) out.push(`${name} 少了: ${onlyA.join(', ')}`);
  if (onlyB.length) out.push(`${name} 多了: ${onlyB.join(', ')}`);
  return out;
}

function compare(base, cur) {
  const problems = [];
  for (const k of ['exports', 'debug', 'errorCodes', 'healthEventFields', 'healthSnapshotKeys']) {
    problems.push(...diffKeys(k, base[k] || [], cur[k] || []));
  }
  return problems;
}

function main() {
  const write = process.argv.includes('--write');
  const cur = build();

  if (write) {
    fs.writeFileSync(OUT, JSON.stringify(cur, null, 2) + '\n');
    console.log(`✅ E0 契约面基线已写入 ${path.relative(ROOT, OUT)}`);
    console.log(`   导出 ${cur.counts.exports} / __debug ${cur.counts.debug} / 错误码 ${cur.counts.errorCodes} / 事件字段 ${cur.counts.healthEventFields} / 快照键 ${cur.counts.healthSnapshotKeys}`);
    console.log(`   digest ${cur.digest}`);
  } else {
    if (!fs.existsSync(OUT)) {
      console.error(`❌ 缺少基线 ${path.relative(ROOT, OUT)}，先跑 --write`);
      process.exit(1);
    }
    const base = JSON.parse(fs.readFileSync(OUT, 'utf8'));
    const problems = compare(base, cur);
    if (problems.length === 0) {
      console.log(`✅ E0 契约面一致（导出 ${cur.counts.exports} / __debug ${cur.counts.debug} / 错误码 ${cur.counts.errorCodes} / 事件字段 ${cur.counts.healthEventFields} / 快照键 ${cur.counts.healthSnapshotKeys}）`);
    } else {
      console.error('❌ E0 契约面漂移：');
      for (const p of problems) console.error(`   - ${p}`);
      process.exit(1);
    }
  }
}

if (require.main === module) main();
