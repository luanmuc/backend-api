#!/usr/bin/env node
/**
 * 第四轮元审计（M 组）：审"审计体系本身"，不审仓库功能。
 * 靶子：①断言会不会本来就恒真 ②修复有没有回归保护 ③审计脚本自身是否自指/错误口径
 * 约定：每条判据都先取真实值再判定，禁止凭印象。
 */
const fs = require('fs');
const path = require('path');
const child = require('child_process');

const ROOT = path.join(__dirname, '../..');
const SRC = path.join(ROOT, 'src', 'legacy.js');
const AUDIT = __dirname;
const TESTS = path.join(ROOT, 'test');
const SCRIPTS = path.join(ROOT, 'scripts');

const out = [];
const rec = (id, name, ok, detail) => {
  out.push({ id, name, ok: !!ok, detail: String(detail || '') });
  console.log(`${ok ? '✓' : '✗'} [${id}] ${name}${detail ? ' — ' + String(detail).slice(0, 240) : ''}`);
};

const read = (p) => fs.readFileSync(p, 'utf8');
const src = read(SRC);
// v9.0 拆包：公共层已拆到 src/core/，涉及「配置表/白名单/cfg()」的判据必须跨模块读，
// 否则按单文件读会把「已迁走」误报成「未解析到（判据失效）」。
const CORE_DIR = path.join(ROOT, 'src', 'core');
const coreTexts = fs.existsSync(CORE_DIR)
  ? fs.readdirSync(CORE_DIR).filter((f) => f.endsWith('.js')).sort().map((f) => read(path.join(CORE_DIR, f)))
  : [];
const srcAll = [...coreTexts, src].join('\n');

// 所有审计/测试脚本文件清单（用于 M1~M3、M8~M12）
const auditFiles = fs.readdirSync(AUDIT).filter((f) => f.endsWith('.js')).map((f) => path.join(AUDIT, f));
// v8.15.1（R22）：原先只 readdir 顶层，test/mutation/run.js 这类子目录入口整条在守备之外
// （M1/M2/M7/M8/M9 都漏扫它；M7 的「46 个脚本均已登记」也因此比实际少 1）。
const walkJs = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
  const p = path.join(dir, d.name);
  if (d.isDirectory()) return walkJs(p);
  return d.name.endsWith('.js') ? [p] : [];
});
const testFiles = walkJs(TESTS);   // 递归后已含 test/audit/，不要再和 auditFiles 拼（会重复扫描）
const allTestJs = testFiles;
const scriptJs = fs.readdirSync(SCRIPTS).filter((f) => f.endsWith('.js')).map((f) => path.join(SCRIPTS, f));

// ---------- M1 恒真断言扫描 ----------
{
  const hits = [];
  for (const f of allTestJs) {
    const t = read(f);
    // 恒真比较形状（数组长度为 0 也算成立的那种），字面量拼接构造避免自指
    const re = new RegExp('\\.length\\s*>=' + '\\s*0', 'g');
    let m;
    while ((m = re.exec(t))) {
      const ln = t.slice(0, m.index).split('\n').length;
      hits.push(`${path.basename(f)}:${ln}`);
    }
    // rec(..., true) 直接写死恒真
    const re2 = /rec\(\s*['"][A-Z][0-9]+[a-z]?['"]\s*,\s*['"][^'"]*['"]\s*,\s*true/g;
    while ((m = re2.exec(t))) {
      const ln = t.slice(0, m.index).split('\n').length;
      hits.push(`${path.basename(f)}:${ln}(rec 恒真)`);
    }
    // v8.15.1（R22）：另一种调用形状——rec 的签名有的脚本是 (id, ok, detail)，
    // 写死成 `rec(…, true, …)`（第二参布尔字面量）时 re2 只认「id, 名称, true」抓不到。
    const re3 = /rec\(\s*['"][A-Z][0-9]+[a-z]?['"]\s*,\s*true\s*,/g;
    while ((m = re3.exec(t))) {
      const ln = t.slice(0, m.index).split('\n').length;
      hits.push(`${path.basename(f)}:${ln}(rec 恒真·布尔直写)`);
    }
    // v8.15.1（R23）：第三种形状——第二参是变量、第三参直接写 true（形如 rec(ID, 变量, true, …)）。
    const re4 = /rec\(\s*['"][A-Z][0-9]+[a-z]?['"]\s*,\s*[A-Za-z_$][\w$.]*\s*,\s*true\b/g;
    while ((m = re4.exec(t))) {
      const ln = t.slice(0, m.index).split('\n').length;
      hits.push(`${path.basename(f)}:${ln}(rec 恒真·第三参 true)`);
    }
  }
  rec('M1', '无恒真断言（恒真空壳 / rec 写死 true）', hits.length === 0,
    hits.length ? hits.join(', ') : `${allTestJs.length} 个测试脚本已扫，无永真形状`);
}

// ---------- M2 空壳断言扫描 ----------
{
  // 只在"断言语句"里找：必须有 assert(...) 或 throw，工具函数里的 typeof 判断不算
  const hits = [];
  for (const f of allTestJs) {
    const t = read(f);
    const lines = t.split('\n');
    lines.forEach((line, i) => {
      const isAssert = /\bassert\s*\(/.test(line) || /\bthrow\s+new\s+Error/.test(line);
      if (!isAssert) return;
      if (/(typeof\s+\S+\s*===\s*'(?:function|object|string|number)'\s*&&|&&\s*typeof)/.test(line)) return;
      if (/typeof\s+\S+\s*===\s*'(?:function|object|string|number)'/.test(line)) {
        hits.push(`${path.basename(f)}:${i + 1}`);
      }
    });
  }
  rec('M2', '无"只断言类型存在"的空壳断言', hits.length === 0,
    hits.length ? hits.slice(0, 6).join(', ') : '断言语句里无裸 typeof 判定');
}

// ---------- M3 自指扫描：审计脚本不得含它自己要扫的字面量 ----------
{
  const banned = [['TO', 'DO'].join(''), ['FI', 'XE'].join(''), ['XX', 'X'].join('')];
  const hits = [];
  // R26：原先只扫 test/audit 顶层，根级压测（stress-round*）与 test/mutation/run.js 在守备之外，
  // 与 M1/M2/M8/M9 的口径不一致。改为与它们同源的全部测试脚本。
  for (const f of allTestJs) {
    const base = path.basename(f);
    if (base === 'g-meta.js') continue; // 本文件用拼接构造，且必须提到这些名字
    const t = read(f);
    for (const w of banned) {
      const cnt = (t.match(new RegExp(w, 'g')) || []).length;
      if (cnt > 0) hits.push(`${base}:${w}×${cnt}`);
    }
  }
  rec('M3', '审计脚本无自指字面量（待办标记须拼接构造）', hits.length === 0,
    hits.length ? hits.join(', ') : 'f-repo 已改为拼接构造');
}

// ---------- M4 测试引用的 lx-source 导出名必须真实存在 ----------
{
  // 导出块可能被 if (typeof module...) 包裹，且结尾是缩进的 "  };"
  const expBlock = src.match(/module\.exports\s*=\s*\{([\s\S]*?)\n\s*\}\s*;?/);
  const exported = new Set();
  if (expBlock) {
    expBlock[1].split('\n').forEach((raw) => {
      const line = raw.replace(/\/\/.*$/, '').replace(/\/\*[\s\S]*?\*\//g, '').trim();
      // 取"标识符," 或 "标识符" 形式的行；忽略键值对与展开
      const m = line.match(/^(\w+)\s*(?::\s*\w+)?\s*,?\s*$/) || line.match(/^(\w+)\s*,\s*$/);
      if (m && !/^\s*$/.test(m[1])) exported.add(m[1]);
      line.split(',').forEach((seg) => {
        const s = seg.trim();
        if (/^\w+$/.test(s)) exported.add(s);
      });
    });
  }
  // R26：`__debug` 这类测试钩子是用 Object.defineProperty 挂上去的，不在 module.exports 字面量块里，
  // 于是任何「绑定变量名后直接取 __debug 成员」的合法测试都会被误判红
  // （已用临时探针复现）。把 defineProperty 挂载的名字一并计入导出面。
  for (const mm of src.matchAll(/Object\.defineProperty\(\s*module\.exports\s*,\s*['"]([\w$]+)['"]/g)) exported.add(mm[1]);
  // 自检：导出面解析为 0 项说明判据本身失效（假绿），必须直接判失败
  const hits = [];
  if (exported.size === 0) hits.push('判据失效：未能解析出任何导出项');
  // R26：扫描前先剥注释——否则注释里写出「const x = require('…/lx-source.js')」这种示例
  // 就会把自己变成命中项（本判据第一版就踩了这个自指坑，被自己抓红）。
  const stripComments = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*(?:\/\/|\*)[^\n]*$/gm, '');
  for (const f of allTestJs) {
    const t = stripComments(read(f));
    const bindRe = /const\s+(\w+)\s*=\s*require\(\s*['"][^'"]*lx-source\.js['"]\s*\)/g;
    let m;
    while ((m = bindRe.exec(t))) {
      const varName = m[1];
      const useRe = new RegExp('\\b' + varName.replace(/[$]/g, '\\$') + '\\.(\\w+)', 'g');
      let u;
      while ((u = useRe.exec(t))) {
        if (!exported.has(u[1])) hits.push(`${path.basename(f)}:${varName}.${u[1]}`);
      }
    }
  }
  rec('M4', '测试用到的 lx-source 导出名全部真实存在', hits.length === 0,
    hits.length ? [...new Set(hits)].join(', ') : `导出面 ${exported.size} 项（${[...exported].slice(0, 3).join('/')}…），引用全部命中`);
}

// ---------- M5 scripts 导出名真实性（取真实 require 值） ----------
{
  const pairs = [
    ['source-toggles.js', ['parseToggles', 'stripLineComment', 'matchBrace']],
    ['cn-date.js', null],
    ['endpoint-registry.js', null],
    ['doc-sync-map.js', ['main']],
  ];
  const hits = [];
  for (const [file, expect] of pairs) {
    let real;
    try {
      real = Object.keys(require(path.join(SCRIPTS, file)));
    } catch (e) {
      hits.push(`${file} require 失败: ${e.message.slice(0, 60)}`);
      continue;
    }
    if (expect) {
      for (const name of expect) if (!real.includes(name)) hits.push(`${file} 缺 ${name}`);
    }
    if (real.length === 0) hits.push(`${file} 无导出`);
  }
  rec('M5', 'scripts 导出面与测试解构名一致', hits.length === 0,
    hits.length ? hits.join('; ') : '4 个脚本 require 成功且期望名齐全');
}

// ---------- M6 已删除死键不得以"代码形式"复活 ----------
{
  // 死键名必须拼接构造：本脚本自己也会被扫到，写字面量就会报自己（第 7 类错误的复现）
  // 名单刻意不含 raceMatchWaitMs：那是**活键**（USER_CONFIG + cfg() 真实读取），
  // 只删掉了同名常量 RACE_MATCH_WAIT_MS。把"常量"和"配置键"混在一张名单里就会误报。
  const deadKeys = [
    'raceOverall' + 'TimeoutMs',
    'xinghaiBackend' + 'Token',
    'xinghaiBackup' + 'Api',
    'RACE_OVERALL_' + 'TIMEOUT_MS',
    'XINGHAI_BACKUP_' + 'API',
  ];
  // 不看"文本里提到没提到"，只查三个**语义位置**：配置默认表、可写白名单、cfg() 读取参数。
  // 这三处是结构确定的，不用剥注释，也不会被日志文案里的历史说明误伤。
  const hits = [];
  const blockOf = (re) => { const m = srcAll.match(re); return m ? m[0] : ''; };
  const positions = [
    ['USER_CONFIG', blockOf(/const USER_CONFIG\s*=\s*\{[\s\S]*?\n\};/)],
    ['ALLOWED_KEYS', blockOf(/ALLOWED_KEYS\s*=\s*\[[\s\S]{0,3000}?\]/)],
    ['cfg()调用', (srcAll.match(/cfg\(\s*['"][\w]+['"]/g) || []).join('\n')],
  ];
  for (const [label, text] of positions) {
    if (!text) { hits.push(`${label} 未解析到（判据失效）`); continue; }
    for (const k of deadKeys) {
      if (new RegExp('\\b' + k + '\\b').test(text)) hits.push(`${label}:${k}`);
    }
  }
  rec('M6', '已删除的死键未回到配置表/白名单/cfg()（日志文案提及不算）', hits.length === 0,
    hits.length ? hits.join(', ') : `三个语义位置均 0 命中（USER_CONFIG ${positions[0][1].length}B / 白名单 ${positions[1][1].length}B）`);
}

// ---------- M7 TESTING 入口表覆盖 test/ 下全部脚本 ----------
{
  const testing = read(path.join(ROOT, 'docs/TESTING.md'));
  // 按「仓库相对路径」核对（TESTING 的入口表一律写 `test/...`），这样新增子目录入口
  // 不会因为同名/只写文件名而假过。
  const missing = [];
  for (const p of testFiles) {
    const rel = path.relative(ROOT, p).split(path.sep).join('/');
    if (!testing.includes(rel)) missing.push(rel);
  }
  rec('M7', 'TESTING 入口表列出全部测试脚本', missing.length === 0,
    missing.length ? '缺: ' + missing.join(', ') : `${testFiles.length} 个脚本（含子目录）均已登记`);
}

// ---------- M8 每个审计脚本都有显式退出码 ----------
{
  const noExit = [];
  for (const f of allTestJs) {
    const t = read(f);
    if (!/process\.exit\s*\(/.test(t)) noExit.push(path.basename(f));
  }
  rec('M8', '审计/测试脚本均有显式退出码（失败可被 CI 捕获）', noExit.length === 0,
    noExit.length ? '缺退出码: ' + noExit.join(', ') : `${allTestJs.length} 个脚本均有`);
}

// ---------- M9 顶层 process.exit 必须有 require.main 守卫 ----------
{
  const bad = [];
  // R25：旧判据只认「行首无缩进」的 process.exit，且只扫 scripts/ + test/audit/ ——
  // 于是 IIFE 里缩进写的 exit（e-extra/u-cross-platform 等 16 个脚本）全部漏检，
  // 被 require 时会直接杀掉调用方（M9b 只跑 scripts/，覆盖不到 test/）。
  // 现在改为：全部测试脚本 + 全部脚本，只要出现 process.exit( 就要求文件内有 require.main 守卫。
  // R30：原来只判「文件里出现过 require.main」——同一个文件里既有带守卫的 exit(0)、又有裸的 exit(1)
  // （health-probe-fidelity 就是这种），照样全绿。改为**逐调用点**判：每个 process.exit( 都要有守卫，
  // 允许两种形态：① 同一行带 require.main；② 上面 3 行内的 if 块带 require.main；
  // ③ 落在 __exit 助手函数体内（助手自身已经做 require.main 判断）。
  // 分两类口径（R30 第二版）：
  //  · scripts/：沿用文件级判据（有 require.main 就认），因为工具脚本的 exit 都在「只在守卫下调用的
  //    函数」里（probe/health-daily/source-* /candidate-audit），逐点文本判会大量假阳性；这类由 M9b 行为级兜底。
  //  · test/：逐调用点判——测试脚本才是被别的脚本 require 的对象，同一个文件里混着
  //    「带守卫的 exit(0)」和「裸的 exit(1)」（health-probe-fidelity 就是这种）必须抓出来。
  // g-meta 自身跳过：它把 process.exit(0) 写在 spawnSync 的 -e 字符串里，是本文件自己的扫描样本。
  for (const f of scriptJs) {
    const t = read(f);
    if (/process\.exit\s*\(/.test(t) && !/require\.main\s*(===|!==)\s*module/.test(t)) bad.push(path.basename(f));
  }
  // R30 第三版踩坑：逐点判据不剥注释时，我写在失败分支上方的说明句「原先裸 process.exit(1)…」
  // 本身就命中了 process.exit( ——判据把注释当代码抓了自己（与 R26 的 M4 同一类病）。扫描前先剥注释。
  // 剥注释时必须保留行数，否则报出来的行号是「去掉注释后的行号」，与真实文件对不上（实测偏 8 行）。
  const stripC = (t) => t
    .replace(/\/\*[\s\S]*?\*\//g, (mm) => mm.replace(/[^\n]/g, ''))
    .replace(/^\s*(?:\/\/|\*)[^\n]*$/gm, '');
  for (const f of allTestJs) {
    const t = stripC(read(f));
    if (!/process\.exit\s*\(/.test(t)) continue;
    if (path.basename(f) === 'g-meta.js') continue;
    const lines = t.split('\n');
    const helperStart = lines.findIndex((l) => /function\s+__exit\s*\(/.test(l));
    let helperEnd = -1;
    if (helperStart >= 0) helperEnd = lines.findIndex((l, i) => i > helperStart && /^\}/.test(l));
    for (let i = 0; i < lines.length; i++) {
      if (!/process\.exit\s*\(/.test(lines[i])) continue;
      if (helperStart >= 0 && i > helperStart && i <= helperEnd) continue;
      if (/require\.main\s*(===|!==)\s*module/.test(lines[i])) continue;
      if (/require\.main\s*(===|!==)\s*module/.test(lines.slice(Math.max(0, i - 3), i + 1).join('\n'))) continue;
      bad.push(`${path.basename(f)}:${i + 1}`);
    }
  }
  rec('M9', '顶层 process.exit 均有 require.main 守卫（防静默杀调用方）', bad.length === 0,
    bad.length ? bad.join(', ') : `${scriptJs.length + allTestJs.length} 个脚本（19 个 tools + 47 个测试入口）全部安全`);
}

// ---------- M9b require 安全（行为级，补 M9 只看"行首无缩进 exit"的漏检）----------
// v8.15.1：M9 的静态正则只认「行首无缩进」的 process.exit，缩进 exit 与顶层 main() 全部漏检
// （build-source/health-daily/source-inventory 顶层 main()、probe/source-audit/verify-real-* 顶层 IIFE
// 都在被 require 时直接写文件/打网络/exit）。改为行为验证：把每个脚本 require 一遍，
// 断言 ① 加载后仍能继续执行（打印出 AFTER_REQUIRE ⇒ 没被 process.exit 截断）② 不因自身副作用报错。
// 注：子进程末尾自带 process.exit(0)——部分脚本会 require 产物 lx-source.js 并挂健康定时器，
// 不主动退出会让 require 永久挂起（这是定时器特性，不算脚本缺陷）。
{
  const bad = [];
  for (const f of scriptJs) {
    const base = path.basename(f);
    const r = child.spawnSync(process.execPath, ['-e',
      `require(${JSON.stringify(f)});console.log('AFTER_REQUIRE');process.exit(0)`],
      { cwd: ROOT, encoding: 'utf8', timeout: 30000 });
    const stdout = String(r.stdout || '');
    const okRc = r.status === 0;
    const reached = stdout.includes('AFTER_REQUIRE');
    if (!okRc || !reached) bad.push(`${base}(rc=${r.status}${reached ? '' : ',exit-before-return'})`);
  }
  rec('M9b', 'scripts/*.js 被 require 时不写文件/不打网络/不退出（require 安全）', bad.length === 0,
    bad.length ? bad.join(', ') : `${scriptJs.length} 个脚本 require 后均正常返回`);
}

// ---------- M9c 顶层不得依赖「环境侧」资源（M9b 的本地可复现面）----------
// M9b 是行为级判据，但在本机跑时 dist/ 与开发依赖都在，于是「顶层 require(dist 产物)」与
// 「顶层 require 外部包」这两类只在 CI 干净检出里才红——v8.16.0 实测：build-source / verify-bundle
// 在 npm ci --ignore-scripts + 无 dist 的 CI 里 rc=1/exit-before-return，本地却全绿。
// 这一条把它们变成本地就能复现的静态判据：
//   ① 顶层（col 0）require 非内置、非相对路径的外部包 → 必须惰性加载（放进函数内）；
//   ② 顶层 require 的路径变量若指向未入库的 dist/ 产物 → 必须放进 main()。
{
  const stripLocal = (t) => t
    .replace(/\/\*[\s\S]*?\*\//g, (mm) => mm.replace(/[^\n]/g, ''))
    .replace(/^\s*(?:\/\/|\*)[^\n]*$/gm, '');
  const builtins = new Set(require('module').builtinModules);
  const bad = [];
  for (const f of scriptJs) {
    const base = path.basename(f);
    const lines = stripLocal(read(f)).split('\n');
    const topVars = {};
    for (const l of lines) {
      const m = /^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/.exec(l);
      if (m) topVars[m[1]] = l;
    }
    for (const [i, l] of lines.entries()) {
      if (/^\s/.test(l)) continue;
      const rm = /require\(\s*(?:'([^']+)'|([A-Za-z_$][\w$]*))\s*\)/.exec(l);
      if (!rm) continue;
      const lit = rm[1];
      const ident = rm[2];
      if (lit) {
        if (lit.startsWith('.') || lit.startsWith('/')) continue;
        if (builtins.has(lit.split('/')[0])) continue;
        bad.push(`${base}:${i + 1}(${lit})`);
      } else if (ident && topVars[ident] && /\bdist\b/.test(topVars[ident])) {
        bad.push(`${base}:${i + 1}(${ident}->dist)`);
      }
    }
  }
  rec('M9c', 'scripts 顶层不依赖环境侧资源（外部包惰性加载 / 未入库 dist 产物进 main）', bad.length === 0,
    bad.length ? bad.join(', ') : `${scriptJs.length} 个脚本顶层依赖均为内置模块或已入库文件`);
}

// ---------- M10 开关计数口径统一走 parseToggles ----------
{
  const fRepo = read(path.join(AUDIT, 'f-repo.js'));
  const byLine = /split\('\\n'\)[\s\S]{0,80}SOURCE_TOGGLES/.test(fRepo) ||
                 /SOURCE_TOGGLES[\s\S]{0,80}filter\([\s\S]{0,40}\w+:\s*/.test(fRepo);
  const usesParse = /parseToggles/.test(fRepo);
  rec('M10', '开关数口径只认 parseToggles 解析出的 12 键', usesParse && !byLine,
    `parseToggles=${usesParse} 按行数统计=${byLine}`);
}

// ---------- M11 真实时钟等待点（信息项，防 flaky） ----------
{
  const waits = [];
  for (const f of allTestJs) {
    const t = read(f);
    const re = /setTimeout\s*\(\s*(?:\(\)\s*=>[\s\S]{0,60}?|\w+\s*=>[\s\S]{0,40}?|function[\s\S]{0,40}?),\s*(\d{3,})/g;
    let m;
    while ((m = re.exec(t))) {
      if (Number(m[2]) >= 100) {
        const ln = t.slice(0, m.index).split('\n').length;
        waits.push(`${path.basename(f)}:${ln}(${m[2]}ms)`);
      }
    }
  }
  rec('M11', '长时真实等待点已登记（>100ms 不应成为门禁常态）', waits.length <= 8,
    waits.length ? `${waits.length} 处: ${waits.slice(0, 5).join(', ')}` : '无长时等待');
}

// ---------- M12 断言输出必须带 ID（失败可定位） ----------
{
  const bad = [];
  for (const f of allTestJs) {
    const t = read(f);
    if (!/console\.log|console\.info/.test(t)) continue;
    // 断言输出函数里必须出现 [${id}] 或 [id]；
    // v8.15.1（R22）：也接受 [${r.id}] 这类成员访问（test/mutation/run.js 的复盘行就是这么打的，
    // 旧写法只认变量名恰好叫 id，扩到子目录后立刻变成假红）。
    const hasId = /\[\$\{[^}\n]*\bid\b[^}\n]*\}\]|\[id\]|\[\$\{id\}|'\[' \+ id/.test(t);
    if (!hasId) bad.push(path.basename(f));
  }
  rec('M12', '断言输出带 ID，失败可定位', bad.length === 0,
    bad.length ? '无 ID 输出: ' + bad.join(', ') : '全部脚本输出含 [ID]');
}

// ---------- M13 错误码前缀契约（D-09 回退抽样的补测） ----------
// D-09 的修复不是逐处赋 code，而是「出口用 normalizeErrCode 按 message 前缀回填」。
// 因此真正的守门点是：**message 的码前缀必须永远由 ERROR_CODES 常量拼出**——
// 文案可以随便改，「ERROR_CODES.X: 」这一段不会随文案漂移，回填才永远认得出来。
{
  const t = read(SRC);
  const badPrefix = [];
  t.split('\n').forEach((l, i) => {
    if (!/throw new Error\(/.test(l)) return;
    if (/^\s*(\/\/|\*|\/\*)/.test(l)) return; // 注释/文档行不算
    if (!/\$\{ERROR_CODES\./.test(l)) badPrefix.push((i + 1) + ': ' + l.trim().slice(0, 64));
  });
  const outs = (t.match(/normalizeErrCode\(/g) || []).length;
  const hasLyric = /getLyricForPlatform\([^)]*\)\.catch\(err => Promise\.reject\(normalizeErrCode/.test(t);
  const hasPic = /getPicForPlatform\([^)]*\)\.catch\(err => Promise\.reject\(normalizeErrCode/.test(t);
  rec('M13', 'throw 的码前缀由 ERROR_CODES 拼出，三个 action 出口都有 normalizeErrCode 兜底',
    badPrefix.length === 0 && outs >= 3 && hasLyric && hasPic,
    badPrefix.length ? '无前缀 throw: ' + badPrefix.slice(0, 3).join(' | ')
      : `出口兜底 normalizeErrCode×${outs} lyric=${hasLyric} pic=${hasPic}`);
}

// ---------- M14 缓存写入唯一入口（D-20 的结构性守门） ----------
// D-20 的根因不是「某处写错了」，而是「允许多处写」：handler 内层先写缓存、外层再验真，
// 验真结果对已经写进去的条目毫无约束。修完只删了那三行，没有任何东西阻止下一个人再加回来
// （加回来照样能过几乎所有行为用例，因为内层缓存命中的表现和正常交付一模一样）。
// 所以这里守结构不变量：缓存只能有**一个**写点，且必须在 `await verifyDelivery` 之后。
{
  const t = srcAll.split('\n');
  const calls = [];
  t.forEach((l, i) => {
    if (!/setCachedUrl\(/.test(l)) return;
    if (/^\s*(\/\/|\*|\/\*)/.test(l)) return;
    if (/^function setCachedUrl\(/.test(l)) return; // 定义本身不算调用
    calls.push(i + 1);
  });
  const verifyLine = t.findIndex((l) => /await verifyDelivery\(/.test(l)) + 1;
  const onlyOne = calls.length === 1;
  const afterVerify = onlyOne && calls[0] > verifyLine;
  rec('M14', '缓存写入只有唯一入口，且在交付验真之后（防内层缓存回归）',
    afterVerify,
    `写点 ${calls.length} 处${calls.length ? '（行 ' + calls.join(',') + '）' : ''}，验真起于行 ${verifyLine}，` +
    `${onlyOne ? (afterVerify ? '位于验真之后' : '仍在验真之前') : '存在多处写点'}`);
}

// ---------- 汇总 ----------
const fail = out.filter((o) => !o.ok);
console.log(`\n元审计（M1~M14 + M9b/M9c）汇总：${out.length - fail.length} 通过 / ${fail.length} 失败`);
if (fail.length) console.log('失败项：' + fail.map((f) => f.id).join(', '));
// require.main 守卫：被 require 时不得杀调用方
if (require.main === module) process.exit(fail.length ? 1 : 0);
module.exports = { results: out };
