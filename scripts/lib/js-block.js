/**
 * v9.0 拆包工具库：JS 块边界扫描
 *
 * 为什么单独抽出来：拆包需要「从单文件里精确切走一个顶层定义」，切不准就会留下语法断层。
 * 实战踩过的三个坑，全部在这里兜住：
 *   1. `function f(a, opts = {}) {` —— 默认参数里的 `{` 不是函数体；
 *   2. `const X = new Set([...])` —— `=` 后是标识符 new，块体在 `(`/`[` 里，不是单值；
 *   3. `/^a\/b$/` 正则字面量 —— 里面的 `/` 不是注释起点，按注释切割会让后续扫描整体偏移。
 *
 * 口径：这是**结构扫描**，不是完整 JS parser。它负责找块边界；边界对不对由调用方的
 * esbuild 自检兜底（`assertParseable`）。宁可中止，不要写坏文件。
 */
const esbuild = require('esbuild');

const PAIRS = { '{': '}', '[': ']', '(': ')' };
const REGEX_PREV = new Set(['=', '(', ',', '[', '{', ':', '!', '&', '|', '?', '+', '-', '*', '%', '~', '^', '<', '>', ';']);

/** 从 i（开括号）扫到配平闭合位置；跳过字符串/模板/注释/正则 */
function scanToClose(text, i) {
  const stack = [];
  while (i < text.length) {
    const c = text[i];
    if (c === '"' || c === "'") {
      const q = c;
      i++;
      while (i < text.length) {
        if (text[i] === '\\') { i += 2; continue; }
        if (text[i] === q) { i++; break; }
        i++;
      }
      continue;
    }
    if (c === '`') {
      i++;
      while (i < text.length) {
        if (text[i] === '\\') { i += 2; continue; }
        if (text[i] === '`') { i++; break; }
        i++;
      }
      continue;
    }
    if (c === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && text[i + 1] === '*') {
      const j = text.indexOf('*/', i + 2);
      i = j >= 0 ? j + 2 : text.length;
      continue;
    }
    if (c === '/') {
      // 正则字面量判定：看前一非空白字符
      let k = i - 1;
      while (k >= 0 && /\s/.test(text[k])) k--;
      const pv = k >= 0 ? text[k] : '';
      const kw = text.slice(Math.max(0, k - 8), k + 1);
      if (REGEX_PREV.has(pv) || /(return|typeof|case)$/.test(kw)) {
        i++;
        let inClass = false;
        while (i < text.length) {
          if (text[i] === '\\') { i += 2; continue; }
          if (text[i] === '[') inClass = true;
          else if (text[i] === ']') inClass = false;
          else if (text[i] === '/' && !inClass) { i++; break; }
          else if (text[i] === '\n') break;
          i++;
        }
        continue;
      }
    }
    if (PAIRS[c]) { stack.push(PAIRS[c]); i++; continue; }
    if (stack.length && c === stack[stack.length - 1]) {
      stack.pop();
      if (!stack.length) return i;
      i++;
      continue;
    }
    i++;
  }
  return text.length - 1;
}

function endOfLine(text, e) {
  let j = e + 1;
  while (j < text.length && text[j] !== '\n') j++;
  return j;
}

/**
 * 顶层定义块结束位置。
 * function 声明：签名 `(...)` 配平后取函数体 `{...}`；
 * const/let/var：`=` 之后若首字符是括号直接配平，否则（如 new Set( / Object.assign(）向后找首个括号配平，都没有就到行尾。
 */
function blockEnd(text, start) {
  if (/^(?:async\s+)?function\s/.test(text.slice(start, start + 200))) {
    const p = text.indexOf('(', start);
    const e = scanToClose(text, p);
    const b = text.indexOf('{', e);
    if (b < 0) return endOfLine(text, e);
    return endOfLine(text, scanToClose(text, b));
  }
  const nl = text.indexOf('\n', start);
  const lineEnd = nl < 0 ? text.length : nl;
  const eq = text.indexOf('=', start);
  let i = eq >= 0 && eq <= lineEnd ? eq + 1 : start;
  while (i < text.length && /\s/.test(text[i])) i++;
  const ch = text[i] || '';
  if (PAIRS[ch]) {
    const e = scanToClose(text, i);
    if (ch === '(') {
      let j = e + 1;
      while (j < text.length && /\s/.test(text[j])) j++;
      if (text[j] === '=' && text[j + 1] === '>') {
        j += 2;
        while (j < text.length && /\s/.test(text[j])) j++;
        if (text[j] === '{') return endOfLine(text, scanToClose(text, j));
      }
      if (text[j] === '{') return endOfLine(text, scanToClose(text, j));
    }
    return endOfLine(text, e);
  }
  // new Set([...]) / foo({...}) 这类：向后找表达式内首个括号
  let j = i;
  while (j < text.length && text[j] !== ';' && text[j] !== '\n') {
    if (PAIRS[text[j]]) return endOfLine(text, scanToClose(text, j));
    j++;
  }
  return lineEnd;
}

const DEF_RE = /^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)|^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/gm;

/** 找单个顶层定义：{name, start, end, lines} 或 null */
function findDef(text, name) {
  const re = new RegExp(
    '^(?:async\\s+)?function\\s+' + name.replace(/\$/g, '\\$') + '\\b|^(?:const|let|var)\\s+' + name.replace(/\$/g, '\\$') + '\\s*=',
    'm'
  );
  const m = re.exec(text);
  if (!m) return null;
  const start = m.index;
  const end = blockEnd(text, start);
  return { name, start, end, lines: text.slice(start, end).split('\n').length };
}

/** 列全部顶层定义 */
function topDefs(text) {
  const out = [];
  DEF_RE.lastIndex = 0;
  let m;
  while ((m = DEF_RE.exec(text)) !== null) {
    const name = m[1] || m[2];
    const start = m.index;
    out.push({ name, start, end: blockEnd(text, start) });
    DEF_RE.lastIndex = Math.max(DEF_RE.lastIndex, start + 1);
  }
  return out;
}

/** 解析 module.exports = { ... } 的导出名（支持 key: value 写法与行内注释） */
function parseExports(text) {
  const m = /module\.exports\s*=\s*\{/.exec(text);
  if (!m) return [];
  const ob = text.indexOf('{', m.index);
  const cb = scanToClose(text, ob);
  const names = [];
  for (let seg of text.slice(ob + 1, cb).split(',')) {
    seg = seg.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '').trim();
    const nm = /^([A-Za-z_$][\w$]*)\s*(?::|$)/.exec(seg);
    if (nm) names.push(nm[1]);
  }
  return names;
}

/**
 * 自检：切出来的块必须能被 esbuild 单独 parse。
 * 这是拆包的安全带——宁可抛错中止，也不要写出语法断层的文件。
 */
async function assertParseable(blocks, label) {
  for (const b of blocks) {
    try {
      await esbuild.transform(b.code, { loader: 'js', target: 'es2017' });
    } catch (e) {
      const first = String(e.message || e).split('\n')[0];
      throw new Error(`[js-block] 块不可解析：${label || ''} ${b.name} — ${first}`);
    }
  }
}

module.exports = { scanToClose, blockEnd, findDef, topDefs, parseExports, assertParseable };
