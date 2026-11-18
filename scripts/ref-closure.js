#!/usr/bin/env node
/**
 * v9.0 拆包辅助：引用闭包地图
 *
 * 目的：legacy.js 有 384 个顶层定义，凭名字猜模块边界会漏（关键词聚类只覆盖 144 个）。
 * 本脚本静态抽出每个顶层定义的「块范围 + 出边（它引用了谁）+ 入边（谁引用了它）」，
 * 输出可决策的地图：
 *   - 枢纽（入度最高）：不能随便挪，挪一个牵一片
 *   - 叶子（出度为 0 或只依赖已拆公共层）：适合作为下一批迁移对象
 *   - 强连通块：应整块一起迁，不许切开
 *
 * 用法：
 *   node scripts/ref-closure.js                 # 打印摘要
 *   node scripts/ref-closure.js --json           # 输出 JSON
 *   node scripts/ref-closure.js --write          # 写 docs/V9_MODULE_MAP.md + test/fixtures/v9-ref-map.json
 *
 * 口径声明：这是**词频级**引用（剥离注释后按标识符出现判断），不是类型级分析；
 * 虚报方向是「多算引用」（同名字符串字面量），漏报方向是「动态字符串访问」。
 * 用它排批次足够，不能当唯一依据。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src', 'legacy.js');
const CORE_DIR = path.join(ROOT, 'src', 'core');

/** 剥离注释，避免注释里提到名字造成虚假引用 */
function stripComments(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length));
}

/** 配平一对括号，返回闭合位置 */
function matchBracket(code, i, open, close) {
  let depth = 0;
  for (; i < code.length; i++) {
    if (code[i] === open) depth++;
    else if (code[i] === close) { depth--; if (depth === 0) return i; }
  }
  return code.length - 1;
}

/** 从 e 到行末 */
function endOfLine(code, e) {
  let j = e + 1;
  while (j < code.length && code[j] !== '\n') j++;
  return j;
}

/**
 * 定块结束：function 找函数体 {；const 从 = 后看首个 { [ ( 决定块形状。
 * 分 [] / {} / 箭头表达式三类，避免「多行数组只搬了首行、数组体残留原地」。
 */
function blockEnd(code, start) {
  const nl = code.indexOf('\n', start);
  const lineEnd = nl < 0 ? code.length : nl;
  let i = start;
  const eq = code.indexOf('=', start);
  if (eq >= 0 && eq <= lineEnd) i = eq + 1;
  while (i < code.length && /\s/.test(code[i])) i++;
  const c = code[i];
  if (c === '{') return endOfLine(code, matchBracket(code, i, '{', '}'));
  if (c === '[') return endOfLine(code, matchBracket(code, i, '[', ']'));
  if (c === '(') {
    const e = matchBracket(code, i, '(', ')');
    let j = e + 1;
    while (j < code.length && /\s/.test(code[j])) j++;
    if (code[j] === '=' && code[j + 1] === '>') {
      j += 2;
      while (j < code.length && /\s/.test(code[j])) j++;
      if (code[j] === '{') return endOfLine(code, matchBracket(code, j, '{', '}'));
      return endOfLine(code, e);
    }
    if (code[j] === '{') return endOfLine(code, matchBracket(code, j, '{', '}'));
    return endOfLine(code, e);
  }
  // function 声明（没有 =）：取行内花括号作为函数体
  const brace = code.indexOf('{', start);
  if (brace >= 0 && brace <= lineEnd) return endOfLine(code, matchBracket(code, brace, '{', '}'));
  return lineEnd;
}

/** 抽顶层定义（行首 col0） */
function topDefs(clean) {
  const defs = [];
  const re = /^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)|^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/gm;
  let m;
  while ((m = re.exec(clean)) !== null) {
    const name = m[1] || m[2];
    const start = m.index;
    const end = blockEnd(clean, start);
    defs.push({ name, start, end, lines: clean.slice(start, end).split('\n').length });
  }
  return defs;
}

function coreExports() {
  if (!fs.existsSync(CORE_DIR)) return { names: new Set(), files: [] };
  const files = fs.readdirSync(CORE_DIR).filter((f) => f.endsWith('.js')).sort();
  const names = new Set();
  for (const f of files) {
    const t = fs.readFileSync(path.join(CORE_DIR, f), 'utf8');
    const mm = t.match(/module\.exports\s*=\s*\{([\s\S]*?)\n\};/);
    if (!mm) continue;
    for (const seg of mm[1].split(',')) {
      const nm = (seg.trim().match(/^([A-Za-z_$][\w$]*)/) || [])[1];
      if (nm) names.add(nm);
    }
  }
  return { names, files };
}

function analyze() {
  const raw = fs.readFileSync(SRC, 'utf8');
  const clean = stripComments(raw);
  const defs = topDefs(clean);
  const core = coreExports();

  const names = defs.map((d) => d.name);
  const byName = new Map(defs.map((d) => [d.name, d]));

  for (const d of defs) {
    const body = clean.slice(d.start, d.end);
    const others = names.filter((n) => n !== d.name);
    d.outRefs = others.filter((n) => new RegExp('\\b' + n.replace(/\$/g, '\\$') + '\\b').test(body));
    d.inRefs = [];
    d.usesCore = [...core.names].filter((n) => new RegExp('\\b' + n.replace(/\$/g, '\\$') + '\\b').test(body));
  }
  for (const d of defs) for (const r of d.outRefs) byName.get(r).inRefs.push(d.name);

  return { defs, core, totalLines: raw.split('\n').length };
}

function summarize(res) {
  const { defs, core } = res;
  const hub = [...defs].sort((a, b) => b.inRefs.length - a.inRefs.length).slice(0, 15);
  const leaf = defs.filter((d) => d.outRefs.length === 0).sort((a, b) => b.lines - a.lines);
  const nearLeaf = defs
    .filter((d) => d.outRefs.length > 0 && d.outRefs.length <= 2)
    .sort((a, b) => b.lines - a.lines);

  const lines = [];
  lines.push(`顶层定义 ${defs.length} 个 / legacy ${res.totalLines} 行 / 已拆公共层 ${core.files.length} 个模块`);
  lines.push('');
  lines.push('## 枢纽（入度最高，迁移风险最大）');
  lines.push('| 定义 | 行数 | 被引用 | 引用别人 | 用公共层 |');
  lines.push('|---|---|---|---|---|');
  for (const d of hub) lines.push(`| \`${d.name}\` | ${d.lines} | ${d.inRefs.length} | ${d.outRefs.length} | ${d.usesCore.join('/') || '-'} |`);
  lines.push('');
  lines.push(`## 叶子（出度 0，共 ${leaf.length} 个，迁移零连带）`);
  for (const d of leaf.slice(0, 20)) lines.push(`- \`${d.name}\`（${d.lines} 行，被引用 ${d.inRefs.length}）`);
  lines.push('');
  lines.push(`## 近叶子（出度 ≤2，共 ${nearLeaf.length} 个，候选批次主体）`);
  for (const d of nearLeaf.slice(0, 25)) lines.push(`- \`${d.name}\`（${d.lines} 行，引用 ${d.outRefs.join('+')}）`);
  return lines.join('\n');
}

function main() {
  const res = analyze();
  if (process.argv.includes('--json')) {
    const out = res.defs.map((d) => ({
      name: d.name, lines: d.lines, outRefs: d.outRefs, inRefs: d.inRefs, usesCore: d.usesCore,
    }));
    console.log(JSON.stringify({ total: out.length, defs: out }, null, 1));
    return 0;
  }
  const text = summarize(res);
  console.log(text);
  if (process.argv.includes('--write')) {
    fs.mkdirSync(path.join(ROOT, 'docs'), { recursive: true });
    fs.writeFileSync(
      path.join(ROOT, 'docs', 'V9_MODULE_MAP.md'),
      `# v9.0 模块迁移地图（引用闭包静态分析）\n\n> 由 \`node scripts/ref-closure.js --write\` 生成，随代码变动需重跑。\n> 口径：剥离注释后的**词频级**引用，虚报方向是多算、漏报方向是动态字符串访问。\n\n` + text + '\n'
    );
    console.log('\n已写入 docs/V9_MODULE_MAP.md');
  }
  return 0;
}

if (require.main === module) process.exit(main());
module.exports = { analyze, summarize };
