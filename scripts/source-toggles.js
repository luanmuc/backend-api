#!/usr/bin/env node
/**
 * v8.10.5 启用开关解析器（SOURCE_TOGGLES 的单一读取口）
 *
 * 为什么独立成模块：health-daily（判哪些源参与判定）与 probe（README_HEALTH 只对启用源出死源建议）
 * 都需要「当前哪些源是开着的」。此前只有 health-daily 有解析逻辑，probe 拿不到 → 两份输出口径分叉
 * （已关闭的 suyinQQ / suyinMigu 仍被 probe 建议摘除）。
 *
 * v8.10.5 修两处缺陷（V1/V4⑤ 与 V4④）：
 *   ① 配平必须在**剥注释之后**做：块注释里一个未闭合 `{` 会让旧实现直接抛「花括号未闭合」，
 *      而 CI 里 health-daily 是 `|| true` → 当天没有日报但 CI 全绿（静默失败）。
 *   ② 只取**第一层**的键：旧实现用逐行正则，嵌套对象的内层键会被当成源开关（`tNested:{inner:true}` → 多出 `inner`）。
 *
 * 实现要点：单遍字符扫描，同时识别行注释、块注释、三种引号，因此注释与字符串里的花括号都不参与配平。
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'lx-source.js');
const MARK = 'const SOURCE_TOGGLES = {';

/** 从 openIdx（指向 `{`）开始向后扫描，跳过注释与字符串，返回匹配的 `}` 下标 */
function matchBrace(src, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i];
    const nx = src[i + 1];
    if (c === '/' && nx === '/') { // 行注释：跳到行尾（不剥 URL 里的 // 以外的场景，因为这里是完整源码扫描）
      const nl = src.indexOf('\n', i);
      i = nl < 0 ? src.length : nl;
      continue;
    }
    if (c === '/' && nx === '*') { // 块注释
      const cl = src.indexOf('*/', i + 2);
      if (cl < 0) throw new Error('SOURCE_TOGGLES 块注释未闭合（注释里多了 /* 少了 */）');
      i = cl + 1;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') { // 字符串：整段跳过，避免值里的 {} 干扰
      i++;
      while (i < src.length && src[i] !== c) {
        if (src[i] === '\\') i++;
        i++;
      }
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (!depth) return i; }
  }
  return -1;
}

/** 剥掉一段文本的行尾注释（引号感知，且不会把 URL 里的 // 吃光） */
function stripLineComment(raw) {
  let quote = null;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (quote) {
      if (c === '\\') { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue; }
    // 只有「前面不是冒号」的 // 才算注释，否则可能是 http:// 这类协议串
    if (c === '/' && raw[i + 1] === '/' && raw[i - 1] !== ':') return raw.slice(0, i);
  }
  return raw;
}

/**
 * 解析 lx-source.js 的 SOURCE_TOGGLES。
 * @returns {{toggles: Record<string,boolean>, lineNo: Record<string,number>}}
 */
function parseToggles(srcPath = SRC) {
  const src = fs.readFileSync(srcPath, 'utf8');
  const start = src.indexOf(MARK);
  if (start < 0) throw new Error('lx-source.js 中未找到 SOURCE_TOGGLES，无法判定启用状态');
  const open = src.indexOf('{', start);
  const end = matchBrace(src, open);
  if (end < 0) throw new Error('SOURCE_TOGGLES 花括号未闭合');

  const blockStartLine = src.slice(0, open + 1).split('\n').length;
  const toggles = {};
  const lineNo = {};

  let depth = 1; // 已在块内：顶层键所在深度即 1
  for (const [i, raw] of src.slice(open + 1, end).split('\n').entries()) {
    const line = stripLineComment(raw).trim();
    if (!line) continue;
    // 先按当前行起始深度决定是否取键（嵌套对象内层 = depth >= 2，跳过）
    // 收集本行所有**第一层**的 key: bool —— 同一行可以写多个键（如 juhe 五兄弟写在一行）
    const re = /([A-Za-z_$][\w$]*)\s*:\s*(true|false)\b/g;
    let m;
    while ((m = re.exec(line))) {
      // 该键之前的行内括号净变化：只有落在深度 1 的键才是源开关（嵌套对象的内层键跳过）
      let d = depth;
      let q = null;
      for (const c of line.slice(0, m.index)) {
        if (q) { if (c === q) q = null; continue; }
        if (c === "'" || c === '"' || c === '`') { q = c; continue; }
        if (c === '{') d++;
        else if (c === '}' && d > 1) d--;
      }
      if (d === 1) {
        toggles[m[1]] = m[2] === 'true';
        lineNo[m[1]] = blockStartLine + i;
      }
    }
    // 再更新本行的深度变化（按字符计，已剥注释，故只需处理引号外的括号）
    let quote = null;
    for (const c of raw) {
      if (quote) { if (c === quote) quote = null; continue; }
      if (c === "'" || c === '"' || c === '`') { quote = c; continue; }
      if (c === '{') depth++;
      else if (c === '}' && depth > 0) depth--;
    }
  }

  const count = Object.keys(toggles).length;
  if (count < 15) throw new Error(`SOURCE_TOGGLES 只解析出 ${count} 个开关，疑似解析失败`);
  return { toggles, lineNo };
}

module.exports = { parseToggles, stripLineComment, matchBrace };
