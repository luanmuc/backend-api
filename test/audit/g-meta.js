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
const SRC = path.join(ROOT, 'lx-source.js');
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

// 所有审计/测试脚本文件清单（用于 M1~M3、M8~M12）
const auditFiles = fs.readdirSync(AUDIT).filter((f) => f.endsWith('.js')).map((f) => path.join(AUDIT, f));
const testFiles = fs.readdirSync(TESTS).filter((f) => f.endsWith('.js')).map((f) => path.join(TESTS, f));
const allTestJs = [...auditFiles, ...testFiles];
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
  for (const f of auditFiles) {
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
  // 自检：导出面解析为 0 项说明判据本身失效（假绿），必须直接判失败
  const hits = [];
  if (exported.size === 0) hits.push('判据失效：未能解析出任何导出项');
  for (const f of allTestJs) {
    const t = read(f);
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
  const blockOf = (re) => { const m = src.match(re); return m ? m[0] : ''; };
  const positions = [
    ['USER_CONFIG', blockOf(/const USER_CONFIG\s*=\s*\{[\s\S]*?\n\};/)],
    ['ALLOWED_KEYS', blockOf(/ALLOWED_KEYS\s*=\s*\[[\s\S]{0,3000}?\]/)],
    ['cfg()调用', (src.match(/cfg\(\s*['"][\w]+['"]/g) || []).join('\n')],
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
  const testJs = fs.readdirSync(TESTS).filter((f) => f.endsWith('.js'));
  const auditJs = fs.readdirSync(AUDIT).filter((f) => f.endsWith('.js'));
  const missing = [];
  for (const f of testJs) if (!testing.includes(f)) missing.push('test/' + f);
  for (const f of auditJs) if (!testing.includes(f)) missing.push('test/audit/' + f);
  rec('M7', 'TESTING 入口表列出全部测试脚本', missing.length === 0,
    missing.length ? '缺: ' + missing.join(', ') : `${testJs.length + auditJs.length} 个脚本均已登记`);
}

// ---------- M8 每个审计脚本都有显式退出码 ----------
{
  const noExit = [];
  for (const f of auditFiles.concat(testFiles)) {
    const t = read(f);
    if (!/process\.exit\s*\(/.test(t)) noExit.push(path.basename(f));
  }
  rec('M8', '审计/测试脚本均有显式退出码（失败可被 CI 捕获）', noExit.length === 0,
    noExit.length ? '缺退出码: ' + noExit.join(', ') : `${auditFiles.length + testFiles.length} 个脚本均有`);
}

// ---------- M9 顶层 process.exit 必须有 require.main 守卫 ----------
{
  const bad = [];
  for (const f of scriptJs.concat(auditFiles)) {
    const t = read(f);
    // 顶层（行首无缩进）出现 process.exit 且没有 require.main 条件
    const topExit = /\nprocess\.exit\s*\(/.test(t);
    if (topExit && !/require\.main\s*===?\s*module/.test(t)) bad.push(path.basename(f));
  }
  rec('M9', '顶层 process.exit 均有 require.main 守卫（防静默杀调用方）', bad.length === 0,
    bad.length ? bad.join(', ') : `${scriptJs.length + auditFiles.length} 个脚本全部安全`);
}

// ---------- M10 开关计数口径统一走 parseToggles ----------
{
  const fRepo = read(path.join(AUDIT, 'f-repo.js'));
  const byLine = /split\('\\n'\)[\s\S]{0,80}SOURCE_TOGGLES/.test(fRepo) ||
                 /SOURCE_TOGGLES[\s\S]{0,80}filter\([\s\S]{0,40}\w+:\s*/.test(fRepo);
  const usesParse = /parseToggles/.test(fRepo);
  rec('M10', '开关数口径只认 parseToggles 解析出的 20 键', usesParse && !byLine,
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
    // 断言输出函数里必须出现 [${id}] 或 [id]
    const hasId = /\[\$\{id\}\]|\[id\]|\[\$\{id\}|'\[' \+ id/.test(t);
    if (!hasId) bad.push(path.basename(f));
  }
  rec('M12', '断言输出带 ID，失败可定位', bad.length === 0,
    bad.length ? '无 ID 输出: ' + bad.join(', ') : '全部脚本输出含 [ID]');
}

// ---------- 汇总 ----------
const fail = out.filter((o) => !o.ok);
console.log(`\n元审计（M1~M12）汇总：${out.length - fail.length} 通过 / ${fail.length} 失败`);
if (fail.length) console.log('失败项：' + fail.map((f) => f.id).join(', '));
// require.main 守卫：被 require 时不得杀调用方
if (require.main === module) process.exit(fail.length ? 1 : 0);
module.exports = { results: out };
