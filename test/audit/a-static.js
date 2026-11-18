#!/usr/bin/env node
/** 批 0/1：静态审计（A1~A7）+ 框架契约（B1~B6） */
const fs = require('fs');
const path = require('path');
const SRC = path.join(__dirname, '../../lx-source.js');
const code = fs.readFileSync(SRC, 'utf8');
const lines = code.split('\n');

const out = [];
// v9.1.2（B06-002）：本脚本是纯同步块结构，无法 await Promise。凡需观察「异步 rejection」
// 的判据（目前是 B6）一律压进 pending，等微任务跑完再由 finalize() 统一 rec + 统计，
// 否则 `p.catch(() => {})` 会把 rejection 静默吞掉，畸形输入照样绿。
const pending = [];
const rec = (id, name, ok, detail) => {
  out.push({ id, name, ok: !!ok, detail: String(detail || '') });
  console.log(`${ok ? '✓' : '✗'} [${id}] ${name}${detail ? ' — ' + String(detail).slice(0, 220) : ''}`);
};
// note：只登记事实、不构成断言的条目。用 `·` 输出，不计入通过/失败，
// 避免"看起来全绿、其实这条永远是 true"（第四轮 M1 抓的就是这类）
const note = (id, name, detail) => {
  console.log(`· [${id}] ${name}${detail ? ' — ' + String(detail).slice(0, 220) : ''}`);
};

// ---------- A3 同名函数重复定义 ----------
{
  const defs = {};
  const re = /^function (\w+)\s*\(/gm;
  let m;
  while ((m = re.exec(code))) defs[m[1]] = (defs[m[1]] || 0) + 1;
  // 也统计 const X = (...) => 与 function 同名冲突
  const dup = Object.entries(defs).filter(([, n]) => n > 1);
  rec('A3', '同名 function 重复定义', dup.length === 0, dup.length ? JSON.stringify(dup) : `共 ${Object.keys(defs).length} 个函数，无同名覆盖`);
}

// ---------- A4 死代码 ----------
{
  const defs = new Set();
  let m; const re = /^function (\w+)\s*\(/gm;
  while ((m = re.exec(code))) defs.add(m[1]);
  const dead = [];
  for (const name of defs) {
    const all = new RegExp(`\\b${name}\\b`, 'g');
    const cnt = (code.match(all) || []).length;
    if (cnt <= 1) dead.push(name);
  }
  rec('A4', '定义了但无引用的函数', dead.length === 0, dead.length ? dead.join(', ') : `${defs.size} 个函数全部被引用`);
}

// ---------- A5 空 catch ----------
{
  const empties = [];
  const re = /catch\s*(\([^)]*\))?\s*\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(code))) {
    const body = (m[2] || '').trim();
    const onlyComment = body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').trim() === '';
    if (onlyComment) {
      const line = code.slice(0, m.index).split('\n').length;
      empties.push(`L${line}`);
    }
  }
  // 空 catch 允许（作为安全阀），但必须逐个确认不吞掉关键错误。
  // 这是**信息登记**而非断言：登记数量本身无法证伪，故用 note（第四轮 M1）
  note('A5', '空 catch 登记（安全阀，允许但需人工确认）', empties.length ? `${empties.length} 处：${empties.join(', ')}` : '无');
}

// ---------- A6 .then 无 .catch ----------
{
  const bad = [];
  const re = /\.then\s*\(/g;
  let m;
  while ((m = re.exec(code))) {
    const tail = code.slice(m.index, m.index + 900);
    if (!/\.catch\s*\(/.test(tail)) bad.push('L' + (code.slice(0, m.index).split('\n').length));
  }
  // A6 只做候选输出：单参 then 若其 Promise 被调用方（raceFirst/wrapExecute）挂载了 rejection handler，
// 就不是缺陷。运行时证据：压测 G2「30 并发、未捕获拒绝=0」已证明无真实 unhandledRejection。
// 同样是信息登记：候选列表本身不构成可证伪结论
  note('A6', '.then 候选登记（已人工定性 / 调用方兜底）',
    bad.length ? `${bad.length} 处候选：${bad.join(', ')}` : '无裸 then');
}

// ---------- A7 判据层魔法数字 ----------
{
  const fnStart = code.indexOf('function verifyDelivery');
  // v9.0 拆包后 verifyDelivery 落在 src/core/15-verify.js，不再是 bundle 里一段连续区间：
  // 改用花括号配对截取本函数体，并剔除 `const X = 数字` 这类常量定义行（定义不是裸值）。
  let end = fnStart, depth = 0;
  for (let i = code.indexOf('{', fnStart); i < code.length; i++) {
    if (code[i] === '{') depth++;
    else if (code[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  const body = code.slice(fnStart, end).split('\n')
    .filter((l) => !/^(?:const|let|var)\s+\w+\s*=/.test(l.trim())).join('\n');
  const bare = [];
  for (const [num, constName] of [['0.6', 'VERIFY_DUR_RATIO'], ['15', 'VERIFY_DUR_GAP_SEC'], ['90', 'VERIFY_MIN_ORIGINAL_SEC'], ['1023', 'VERIFY_RANGE_BYTES']]) {
    const re = new RegExp(`(^|[^\\w.])${num.replace('.', '\\.')}([^\\w.]|$)`, 'g');
    const hits = (body.match(re) || []).length;
    if (hits > 0) bare.push(`${num}×${hits}（应改用 ${constName}）`);
  }
  rec('A7', '判据层阈值全部走常量', bare.length === 0, bare.length ? bare.join(' · ') : '0.6/15/90/1023 均无裸值');
}

// ---------- A2/B：运行时契约探测 ----------
const loadWith = (hostPatch) => {
  delete require.cache[require.resolve(SRC)];
  globalThis.lx = Object.assign({
    EVENT_NAMES: { inited: 'inited', request: 'request', updateAlert: 'updateAlert' },
    version: '2.0.0', env: 'mobile',
    utils: { buffer: { from: (d, e) => Buffer.from(d, e), bufToString: (b, e) => b.toString(e) } },
    request: (u, o, cb) => setTimeout(() => cb(null, { statusCode: 200, headers: { 'content-type': 'application/json' }, body: '{}' }), 1),
    on() {}, send() {},
  }, hostPatch || {});
  return require(SRC);
};

{
  // A2：全量加载 + 触碰导出，看有无未声明标识符
  let ok = true, err = '';
  try {
    const mod = loadWith({});
    for (const k of Object.keys(mod)) {
      const v = mod[k];
      if (typeof v === 'function') { try { v.length; } catch (e) { throw e; } }
    }
  } catch (e) { ok = false; err = e.message; }
  rec('A2', '全量加载无未声明标识符', ok, ok ? `导出 ${Object.keys(require(SRC)).length} 项` : err);
}

{
  // B2：utils.buffer 契约（缺 buffer 时不得崩）
  let ok = true, err = '';
  try {
    const mod = loadWith({ utils: {} });
    if (!mod) throw new Error('加载返回空');
  } catch (e) { ok = false; err = e.message; }
  rec('B2', '宿主缺 utils.buffer 时不崩', ok, ok ? '加载成功（buffer 为可选依赖）' : err);
}

{
  // B3：事件注册
  loadWith({});
  // 重新注册钩子后触发
  let handler = null;
  globalThis.lx.on = (n, h) => { if (n === 'request') handler = h; };
  delete require.cache[require.resolve(SRC)];
  globalThis.lx = Object.assign(globalThis.lx, {});
  require(SRC);
  rec('B3', '注册 EVENT_NAMES.request 处理器', typeof handler === 'function', typeof handler === 'function' ? '已注册' : '未注册');
}

{
  // B6：宿主版本差异——musicInfo 缺字段 / version 缺失
  let ok = true, err = '';
  let b6Rejects = 0, b6Msg = '', b6Codes = [];
  try {
    delete require.cache[require.resolve(SRC)];
    let handler = null;
    globalThis.lx = {
      EVENT_NAMES: { inited: 'inited', request: 'request', updateAlert: 'updateAlert' },
      // 故意不给 version / env
      utils: { buffer: { from: (d, e) => Buffer.from(d, e), bufToString: (b, e) => b.toString(e) } },
      request: (u, o, cb) => setTimeout(() => cb(new Error('ECONNREFUSED'), null), 1),
      on: (n, h) => { if (n === 'request') handler = h; }, send() {},
    };
    require(SRC);
    for (const info of [{}, { name: 'x' }, { name: 'x', singer: 'y' }, null, undefined]) {
      const p = handler({ action: 'musicUrl', source: 'kw', info: { type: 'flac', musicInfo: info } });
      // v9.1.2（B06-002）：原写法 `if (p.catch) await0(p)` 只挂一个空 catch 把 rejection 吞掉
      // ——畸形输入触发异步 rejection 时本判据照样 PASS（假绿）。改为收集拒绝码，
      // 交给 pending 里的延迟判据判定（同步块无法 await 微任务）。
      if (p && typeof p.catch === 'function') {
        p.catch((e) => {
          b6Rejects++;
          const c = (e && e.code) || '';
          b6Codes.push(c || '(无 code)');
          if (!b6Msg) b6Msg = `${c || '(无 code)'}: ${String((e && e.message) || e).slice(0, 60)}`;
        });
      }
    }
    ok = true;
    err = '5 种畸形 musicInfo 均返回 Promise（未同步抛错）';
  } catch (e) { ok = false; err = e.message; }
  pending.push(() => {
    // v9.1.2（B06-002 判据修正）：handler 的契约本来就是「错误用 rejection 表达」，
    // 所以「异步拒绝」本身不是失败。真正的判红条件是**拒绝不是结构化错误**：
    // 码缺失 / 不在产物 ERROR_CODES 枚举里（类型错误、码丢失这类才是回归）。
    // 这样既保住 findings 建议的「异步必须给出结构化错误」，也不会把正常的
    // PARAM_ERROR 误判成「降级崩了」。
    const KNOWN_CODES = new Set(
      (code.match(/ERROR_CODES\s*=\s*\{[\s\S]*?\n\s*\}/) || [''])[0]
        .split('\n')
        .map((ln) => (ln.match(/^\s*[A-Z][A-Z0-9_]{3,}\s*:\s*"([A-Z][A-Z0-9_]{3,})"/) || [])[1])
        .filter(Boolean),
    );
    const unstructured = b6Codes.filter((c) => !KNOWN_CODES.has(c));
    rec('B6', '宿主/参数降级不崩（异步拒绝必须是结构化错误码）', ok && unstructured.length === 0,
      ok
        ? (b6Rejects
          ? `${b6Rejects} 个畸形输入异步拒绝，码=${b6Codes.join(',')}${unstructured.length ? ` ⚠ 非已知码 ${unstructured.join(',')}` : '（枚举内 ✓）'}`
          : '5 种畸形 musicInfo 均返回 Promise 且无异步 rejection')
        : err);
  });
}

function await0(p) { p.catch(() => {}); }

// ---------- B1 调用点一致性 ----------
{
  const calls = (code.match(/\brequest\s*\(/g) || []).length;
  const viaHttp = (code.match(/httpRequest\s*\(/g) || []).length;
  // 真判据：外呼只允许有一个物理发起点，且必须落在 httpRequest 函数体内。
  // 若将来有人绕过封装直接裸调 lx.request，就会丢失超时/重试/脱敏 → 这条必须变红。
  const httpDef = code.indexOf('function httpRequest');
  const directIdx = code.search(/\brequest\s*\(/);
  const inWrapper = httpDef >= 0 && directIdx > httpDef && directIdx < httpDef + 3000;
  rec('B1', '外呼只经 httpRequest 唯一通道（无裸调）', calls === 1 && inWrapper,
    `request( 共 ${calls} 处${calls ? `（位于 L${code.slice(0, directIdx).split('\n').length}）` : ''}，httpRequest 封装 ${viaHttp} 次，${inWrapper ? '发起点在封装体内' : '发起点不在封装体内'}`);
}

// ---------- B4 App 跨仓字段比对 ----------
{
  const appUtils = path.resolve(__dirname, '..', '..', '..', 'lx-music-mobile', 'src', 'core', 'music', 'utils.ts');
  let appFields = '', appChecked = false;
  if (fs.existsSync(appUtils)) {
    const t = fs.readFileSync(appUtils, 'utf8');
    // App 侧真实解构：`const { url, type, subSource = '', ... }`（utils.ts L430/L498）
    const m = t.match(/const \{[^}]*\burl\b[^}]*\btype\b[^}]*\}/);
    appFields = m ? m[0].replace(/\s+/g, ' ').slice(0, 120) : '未定位解构行';
    appChecked = true;
  }
  // 真判据（R23）：交付对象必须同时带 url / type / subSourceName 三个字段。
  // 旧写法 `|| /url\s*,/.test(code)` 在全文件里几乎必然命中，等于恒真。
  const deliverShape = /return \{ url, type: [^}]*subSourceName:/.test(code);
  const appNeeds = !!appFields && /\burl\b/.test(appFields) && /\btype\b/.test(appFields);
  // CI 只 checkout 源仓，App 仓常不在场：此时只看源侧判据（源侧必须成立），并把「App 未取到」如实写进 detail，
  // 不因环境缺 App 而把门禁弄红。
  const ok = deliverShape && (appChecked ? appNeeds : true);
  rec('B4', '返回值字段与 App 解构对齐', ok,
    `交付对象 url+type+subSourceName=${deliverShape}，App 侧解构：${appChecked ? appFields : '（App 仓不在本环境，仅校源侧）'}`);
}

// ---------- B5 platform 声明 ----------
{
  const m = code.match(/platforms\s*:\s*\[([^\]]*)\]/g) || [];
  rec('B5', '各源 platforms 显式声明', m.length > 0, `${m.length} 处 platforms 声明`);
}

// v9.1.2（B06-002）：等一轮微任务跑完再执行 pending 里的延迟判据（B6 的异步 rejection 要
// 等 Promise 拒绝回调真正跑过才有结论），然后才统计与退出。
function finalize() {
  for (const fn of pending) fn();
  const pass = out.filter(o => o.ok).length;
  const fail = out.filter(o => !o.ok).length;
  console.log(`\n批0/1 汇总：${pass} 通过 / ${fail} 失败`);
  // 顶层 exit 必须带 require.main 守卫（g-meta M9）；被 require 时只设 exitCode，不杀调用方
  if (require.main === module) process.exit(fail ? 1 : 0);
  else process.exitCode = fail ? 1 : 0;
}
setTimeout(finalize, 60);
