#!/usr/bin/env node
/**
 * docs-audit.js — 文档一致性巡检（L4 定时兜底）
 *
 * 目的：Hook 管"当下提交"，本脚本管"历史欠账"——每日检查文档中
 * 与真实状态漂移的「确定性低风险项」（数字/版本串/URL），自动对齐；
 * 语义类项（章节内容）只报告不修改。
 *
 * 用法：
 *   node scripts/docs-audit.js            # 自动修复低风险项
 *   node scripts/docs-audit.js --dry-run  # 只报告，不修改
 *
 * 修复前打印 before → after，全部为从真实文件提取的值（可复核）。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DRY = process.argv.includes('--dry-run');
const report = [];
let fixed = 0;

function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }
function write(p, s) { fs.writeFileSync(path.join(ROOT, p), s); }

function fix(p, oldStr, newStr, note) {
  const s = read(p);
  if (s.includes(newStr)) return; // 已对齐
  if (!s.includes(oldStr)) {
    report.push(`⚠️ [${p}] 期望 ${JSON.stringify(oldStr)} 未找到，跳过`);
    return;
  }
  if (DRY) {
    report.push(`🟡 [${p}] ${note}\n    ${JSON.stringify(oldStr)} → ${JSON.stringify(newStr)}`);
  } else {
    write(p, s.replace(oldStr, newStr));
    fixed++;
    report.push(`✅ [${p}] ${note}\n    ${JSON.stringify(oldStr)} → ${JSON.stringify(newStr)}`);
  }
}

// ── 规则 1：冒烟用例数 ↔ AGENTS.md ─────────────────────────────────────
function ruleSmokeCount() {
  const test = read('test/lx-source-smoke-test.js');
  const count = (test.match(/console\.log\('\[T\d+\]/g) || []).length;
  const agents = read('docs/AGENTS.md');
  const m = agents.match(/(\d+) 组用例/);
  if (m && Number(m[1]) !== count) {
    fix('docs/AGENTS.md', `${m[1]} 组用例`, `${count} 组用例`, `冒烟用例数 ${m[1]}→${count}`);
  }
}

// ── 规则 2：lx-source.js @version ↔ README 当前版本行 ───────────────────
function ruleVersion() {
  const src = read('lx-source.js');
  const m = src.match(/@version\s+([\d.]+)/);
  if (!m) { report.push('⚠️ lx-source.js 未找到 @version'); return; }
  const v = m[1];
  const readme = read('README.md');
  // 注意：README「当前版本」行是工具层版本（v8.1），lx-source.js @version 是音源层大版本（8.0），
  // 两条独立版本链——只对齐 README 行内「lx-source.js 内 @version X」子串标注。
  const m2 = readme.match(/lx-source\.js\u201d 内 \u201c?@version ([\d.]+)/) || readme.match(/@version ([\d.]+)\u201d/);
  if (m2 && m2[1] !== v) {
    fix('README.md', `@version ${m2[1]}`, `@version ${v}`, `README 内 @version 子串标注 ${m2[1]}→${v}`);
  }
}

// ── 规则 3：pdone 对照仓库名（防 URL 漂移回旧名）──────────────────────
function rulePdoneUrl() {
  const agents = read('docs/AGENTS.md');
  if (agents.includes('github.com/pdone/backend-api')) {
    fix('docs/AGENTS.md',
      'https://github.com/pdone/backend-api',
      'https://github.com/pdone/lx-music-source',
      'pdone 仓库 URL 回退旧名');
  }
}

// ── 规则 4：健康表更新时间戳新鲜度（报告项）────────────────────────────
function ruleHealthFresh() {
  const h = read('README_HEALTH.md');
  const m = h.match(/更新于 ([\dT:.\-]+Z)/);
  if (m) {
    const ageH = (Date.now() - new Date(m[1]).getTime()) / 3600000;
    if (ageH > 28) report.push(`🔴 README_HEALTH 已 ${ageH.toFixed(0)}h 未更新（probe 未跑？）`);
    else report.push(`🟢 README_HEALTH 最近更新 ${ageH.toFixed(0)}h 前`);
  }
}

// ── 规则 5：candidate-status 是否今日生成（报告项）─────────────────────
function ruleCandidateFresh() {
  try {
    const c = read('docs/candidate-status.md');
    const m = c.match(/自动生成 · ([\dT:.\-]+Z)/);
    if (m) {
      const ageH = (Date.now() - new Date(m[1]).getTime()) / 3600000;
      if (ageH > 28) report.push(`🔴 candidate-status 已 ${ageH.toFixed(0)}h 未更新（recheck 未跑？）`);
      else report.push(`🟢 candidate-status 最近更新 ${ageH.toFixed(0)}h 前`);
    }
  } catch (_) {
    report.push('🔴 docs/candidate-status.md 不存在（recheck-candidates 未跑过）');
  }
}

// ── 通用对齐器：正则定位 → 与真值比对 → 不一致则精确替换（一致也报绿）──
function align(p, re, build, label) {
  const s = read(p);
  const m = s.match(re);
  if (!m) { report.push(`⚠️ [${p}] ${label} 未命中`); return; }
  const want = build(m);
  if (m[0] === want) { report.push(`🟢 [${p}] ${label}：${m[0].slice(0, 72)}`); return; }
  fix(p, m[0], want, `${label} ${m[0]}→${want}`);
}

function srcBlock() {
  const src = read('lx-source.js');
  return src.split('const SOURCE_TOGGLES = {')[1].split('};')[0];
}

function handlerBlock() {
  const src = read('lx-source.js');
  return src.split('const SOURCE_HANDLERS = {')[1].split('\n};')[0];
}

// ── 规则 6：冒烟用例数 ↔ 全部含该断言的文档（原本只扫 AGENTS 一处）──────
function ruleSmokeWide() {
  const t = read('test/lx-source-smoke-test.js');
  const n = (t.match(/console\.log\('\[T\d+\]/g) || []).length;
  align('docs/AGENTS.md', /(\d+) 组用例/, () => `${n} 组用例`, '冒烟组数');
  align('docs/AGENTS.md', /L1 冒烟 (\d+) 组/, () => `L1 冒烟 ${n} 组`, 'L1 冒烟组数');
  align('docs/DEV_GUIDE.md', /（(\d+) 组：加载防御/, () => `（${n} 组：加载防御`, '测试清单组数');
  align('README.md', /共 (\d+) 组/, () => `共 ${n} 组`, 'README 冒烟组数');
  // v8.10.5：T13 —— ci.yml 此前完全不在校验范围，L1 step 名里的「59 组用例」实际早已 60 组。
  // CI 是执行方，它写的组数与真实用例数不一致时，人看 CI 绿灯会以为旧数是对的。
  align('.github/workflows/ci.yml', /(\d+) 组用例/, () => `${n} 组用例`, 'CI 冒烟组数');
  if (!read('.github/workflows/ci.yml').includes('test/lx-source-smoke-test.js')) {
    report.push('❌ [.github/workflows/ci.yml] ci.yml 没有调用冒烟测试，L1 等于没跑');
  }
}

// ── 规则 7：lx-source.js 总行数 + 行段表末段边界（EOF 段）──────────────
function ruleLinesAndSegments() {
  try {
    const n = execSync('wc -l < lx-source.js', { encoding: 'utf8', cwd: ROOT }).trim();
    const start = execSync('grep -n "const sourceConfig" lx-source.js | head -1 | cut -d: -f1', { encoding: 'utf8', cwd: ROOT }).trim();
    align('docs/DEV_GUIDE.md', /共 (\d+) 行/, () => `共 ${n} 行`, '音源总行数');
    if (start) align('docs/DEV_GUIDE.md', /(\d+)~(\d+)（EOF）/, () => `${start}~${n}（EOF）`, '行段表末段边界');
  } catch (e) { report.push(`⚠️ 规则7 异常：${e.message}`); }
}

// ── 规则 8：setTimeout 实际使用处数 ↔ AGENTS ───────────────────────────
function ruleHostApi() {
  const n = (read('lx-source.js').match(/setTimeout\(/g) || []).length;
  align('docs/AGENTS.md', /已用 (\d+) 处/, () => `已用 ${n} 处`, 'setTimeout 处数');
}

// ── 规则 9：登记源数 ↔ 行段表与 README ─────────────────────────────────
function ruleSourceCount() {
  const n = (handlerBlock().match(/^\s+\w+: \{/gm) || []).length;
  align('docs/DEV_GUIDE.md', /(\d+) 个子源/, () => `${n} 个子源`, '子源数');
}

// ── 规则 10：并联源开关默认值 ↔ README「已知失效/关闭源」表 ────────────
function ruleToggleTruth() {
  const blk = srcBlock();
  for (const id of ['ikun', 'huibq']) {
    const m = blk.match(new RegExp(id + ':\\s*(true|false)'));
    if (!m) { report.push(`⚠️ 规则10：SOURCE_TOGGLES 未找到 ${id}`); continue; }
    const on = m[1] === 'true';
    align('README.md', new RegExp('^\\| ' + id + ' \\| \\*\\*(开启|关闭)\\*\\*', 'mi'),
      (m) => m[0].replace(/开启|关闭/, on ? '开启' : '关闭'), `${id} 默认状态`);
  }
}

// ── 规则 11：持续增长量不得写死（写死必然下次就过期）───────────────────
function ruleHardcodedGrowing() {
  const g = read('docs/DEV_GUIDE.md');
  if (/共 \d+ 个 Release tag/.test(g)) report.push('🟡 DEV_GUIDE 写死了 Release tag 数——持续增长量应改为命令引用（`git tag | wc -l`）');
  else report.push('🟢 DEV_GUIDE 未写死 tag 数');
  if (/已积累 \d+ 行/.test(g)) report.push('🟡 DEV_GUIDE 写死了 probe-history 行数——应改为（`wc -l docs/probe-history.jsonl`）');
  else report.push('🟢 DEV_GUIDE 未写死 probe-history 行数');
}

// ── 规则 12：跨仓 · 本仓 @version ↔ App 仓 MUSIC_SOURCE_GUIDE（反向校验）──
function ruleCrossRepoAppDoc() {
  const sib = path.resolve(ROOT, '..', 'lx-music-mobile', 'docs', 'MUSIC_SOURCE_GUIDE.md');
  if (!fs.existsSync(sib)) { report.push('⚪ 规则12 跳过：本地无 ../lx-music-mobile（CI 请先 clone App 仓）'); return; }
  const m = read('lx-source.js').match(/@version[: \t]+([\d.]+)/);
  if (!m) { report.push('⚠️ 规则12：本仓 @version 未找到'); return; }
  const doc = fs.readFileSync(sib, 'utf8');
  const dv = doc.match(/豆包定制 v([\d.]+)/);
  if (!dv) { report.push('🔴 跨仓：App 的 MUSIC_SOURCE_GUIDE 未找到「豆包定制 vX」标注'); return; }
  if (dv[1] !== m[1]) report.push(`🔴 跨仓不一致：App MUSIC_SOURCE_GUIDE 写 v${dv[1]}，本仓 @version ${m[1]}——需在 App 仓更新该文档`);
  else report.push(`🟢 跨仓一致：App MUSIC_SOURCE_GUIDE 与本仓 @version 均 v${m[1]}`);
}

// ── 规则 13：ITERATION_ROADMAP 的「当前最新版本 vX」↔ @version ──────────
function ruleRoadmapVersion() {
  const m = read('lx-source.js').match(/@version[: \t]+([\d.]+)/);
  if (!m) { report.push('⚠️ 规则13：本仓 @version 未找到'); return; }
  align('docs/ITERATION_ROADMAP.md', /当前最新版本 v([\d.]+)/, () => `当前最新版本 v${m[1]}`, 'ROADMAP 当前版本');
}

// ── 规则 14：SOURCE_AUDIT 的「N 个登记源」「N 个 verified 源」↔ 真值 ────
function ruleSourceAuditFacts() {
  const blk = handlerBlock();
  const n = (blk.match(/^\s+\w+: \{/gm) || []).length;
  align('docs/SOURCE_AUDIT.md', /(\d+) 个登记源/, () => `${n} 个登记源`, 'SOURCE_AUDIT 登记源数');
  const ve = (blk.match(/verified/g) || []).length;
  align('docs/SOURCE_AUDIT.md', /(\d+) 个 `verified` 源/, () => `${ve} 个 \`verified\` 源`, 'SOURCE_AUDIT verified 源数');
}

// ── 共用：全仓 tracked 文件 → 行数映射（矩阵/台账/索引类文档的真值来源）──
function trackedLines() {
  const list = execSync('git -c core.quotepath=false ls-files', { encoding: 'utf8', cwd: ROOT })
    .trim().split('\n').filter(Boolean);
  const map = new Map();
  for (const f of list) {
    map.set(f, Number(execSync(`wc -l < ${JSON.stringify(f)}`, { encoding: 'utf8', cwd: ROOT }).trim()));
  }
  return map;
}

// 表格类文档的行数同步器：把「| `path` | 数字 |」里的数字对齐到实测值
function syncRowLines(p, map, label) {
  const s = read(p);
  let out = s;
  let n2 = 0;
  out = out.split('\n').map((line) => {
    const m = line.match(/^\| `([^`]+)` \| (\d+) \|/);
    if (!m) return line;
    if (!map.has(m[1])) return line;
    const real = map.get(m[1]);
    if (Number(m[2]) === real) return line;
    n2++;
    return line.replace(`| \`${m[1]}\` | ${m[2]} |`, `| \`${m[1]}\` | ${real} |`);
  }).join('\n');
  if (n2 && !DRY) { write(p, out); fixed++; report.push(`✅ [${p}] ${label}：同步 ${n2} 行行数`); }
  else if (n2) report.push(`🟡 [${p}] ${label}：待同步 ${n2} 行行数`);
  else report.push(`🟢 [${p}] ${label}：行数已与实测一致`);
}

// ── 规则 15：README「当前版本」行 ↔ @version（工具层与音源层已统一版本链）──
function ruleReadmeCurrentVersion() {
  const m = read('lx-source.js').match(/@version[: \t]+([\d.]+)/);
  if (!m) { report.push('⚠️ 规则15：@version 未找到'); return; }
  align('README.md', /\| 当前版本 \| \*\*v([\d.]+)\*\*/, () => `| 当前版本 | **v${m[1]}**`, 'README 当前版本行');
  align('README.md', /内 `@version ([\d.]+)`/, () => `内 \`@version ${m[1]}\``, 'README 内 @version 标注');
}

// ── 规则 16：ci.yml 变异体数 ↔ MUTANTS 实读，且必须带 --strict ─────────
function ruleMutationGate() {
  const r = read('test/mutation/run.js');
  const a = r.indexOf('const MUTANTS = [');
  let n = 0;
  if (a < 0) { report.push('⚠️ 规则16：MUTANTS 未找到'); }
  else {
    const b = r.indexOf('\n];', a);
    try { n = eval(r.slice(a + 16, b + 2)).length; } catch (e) { report.push(`⚠️ 规则16 解析 MUTANTS 失败：${e.message}`); }
  }
  if (n) align('.github/workflows/ci.yml', /(\d+) 变异体/, () => `${n} 变异体`, 'CI 变异体数');
  const ci = read('.github/workflows/ci.yml');
  const line = (ci.match(/node test\/mutation\/run\.js[^\n]*/) || [''])[0];
  if (!line) report.push('❌ [ci.yml] 没有调用变异测试，变异门禁不存在');
  else if (!line.includes('--strict')) report.push(`❌ [ci.yml] 变异测试未带 --strict（${line.trim()}）→ 有存活变异体也 exit 0，门禁 fail-open`);
  else report.push('🟢 [ci.yml] 变异测试带 --strict');
}

// ── 规则 17：AUDIT_MATRIX 行数 ↔ 实测，且不允许漏登 tracked 文件 ────────
function ruleMatrixCoverage() {
  const map = trackedLines();
  syncRowLines('docs/AUDIT_MATRIX.md', map, '矩阵行数');
  const s = read('docs/AUDIT_MATRIX.md');
  const listed = new Set([...s.matchAll(/^\| `([^`]+)` \| \d+ \|/gm)].map((m) => m[1]));
  const miss = [...map.keys()].filter((f) => !listed.has(f));
  if (miss.length) report.push(`❌ [docs/AUDIT_MATRIX.md] ${miss.length} 个 tracked 文件未进矩阵：${miss.join(', ')}`);
  else report.push(`🟢 [docs/AUDIT_MATRIX.md] 矩阵覆盖全仓 ${map.size} 个文件`);
  align('docs/AUDIT_MATRIX.md', /文件总数：\*\*(\d+)\*\*/g, () => `文件总数：**${map.size}**`, '矩阵文件总数');
  const total = [...map.values()].reduce((x, y) => x + y, 0);
  align('docs/AUDIT_MATRIX.md', /总行数：\*\*(\d+)\*\*/g, () => `总行数：**${total}**`, '矩阵总行数');
}

// ── 规则 18：READTHROUGH 台账 ↔ 实测（文件数/总行数/逐行行数/版本）────
function ruleReadThroughLedger() {
  const map = trackedLines();
  syncRowLines('docs/READTHROUGH.md', map, '台账行数');
  const total = [...map.values()].reduce((x, y) => x + y, 0);
  align('docs/READTHROUGH.md', /文件数：\*\*(\d+)\*\*/, () => `文件数：**${map.size}**`, '台账文件数');
  align('docs/READTHROUGH.md', /总行数：\*\*(\d+)\*\*/, () => `总行数：**${total}**`, '台账总行数');
  const v = read('lx-source.js').match(/@version[: \t]+([\d.]+)/);
  if (v) align('docs/READTHROUGH.md', /HEAD `[0-9a-f]{7,}`（v([\d.]+)）/, () => `HEAD \`${execSync('git rev-parse --short HEAD', { encoding: 'utf8', cwd: ROOT }).trim()}\`（v${v[1]}）`, '台账 HEAD 与版本');
  const listed = new Set([...read('docs/READTHROUGH.md').matchAll(/^\| `([^`]+)` \| \d+ \|/gm)].map((m) => m[1]));
  const miss = [...map.keys()].filter((f) => !listed.has(f));
  if (miss.length) report.push(`❌ [docs/READTHROUGH.md] ${miss.length} 个 tracked 文件未进台账：${miss.join(', ')}`);
}

// ── 规则 19：docs 下每个文件都必须在 DOC_INDEX 登记（新文档不得漏登）──
function ruleDocIndex() {
  const idx = read('docs/DOC_INDEX.md');
  const docs = execSync('git -c core.quotepath=false ls-files docs', { encoding: 'utf8', cwd: ROOT })
    .trim().split('\n').filter(Boolean);
  const miss = docs.filter((f) => !idx.includes('`' + f + '`'));
  if (miss.length) report.push(`❌ [docs/DOC_INDEX.md] ${miss.length} 个 docs 文件未登记：${miss.join(', ')}`);
  else report.push(`🟢 [docs/DOC_INDEX.md] docs 下 ${docs.length} 个文件全部登记`);
  const stale = [...idx.matchAll(/^\| `(docs\/[^`]+)` \|/gm)].map((m) => m[1]).filter((f) => !docs.includes(f));
  if (stale.length) report.push(`❌ [docs/DOC_INDEX.md] 登记了不存在的文件：${stale.join(', ')}`);
}

// ── 规则 20：测试入口数 ↔ test 下实际入口脚本数 ───────────────────────
function ruleTestEntryCount() {
  const n = execSync("git ls-files 'test/**/*.js' 'test/*.js'", { encoding: 'utf8', cwd: ROOT })
    .trim().split('\n').filter((f) => f.endsWith('.js')).length;
  align('docs/README.md', /(\d+) 个测试入口/, () => `${n} 个测试入口`, '文档地图测试入口数');
  align('docs/TESTING.md', /\*\*(\d+) 个入口\*\*/, () => `**${n} 个入口**`, 'TESTING 入口数');
}

// ── 规则 21：缺陷编号上界 ↔ AUDIT_RESULTS 实有最大 D-xx ───────────────
function ruleDefectIdCeiling() {
  const res = read('docs/AUDIT_RESULTS.md');
  const max = Math.max(...[...res.matchAll(/D-(\d{2})/g)].map((m) => Number(m[1])));
  if (!Number.isFinite(max)) { report.push('⚠️ 规则21：AUDIT_RESULTS 未找到 D-xx'); return; }
  align('docs/README.md', /\*\*D-01~D-(\d+)\*\*/, () => `**D-01~D-${String(max).padStart(2, '0')}**`, '文档地图缺陷编号上界');
  align('docs/AUDIT_PLAN_v10.md', /缺陷总账已补齐 D-01~D-(\d+)/, () => `缺陷总账已补齐 D-01~D-${String(max).padStart(2, '0')}`, 'v10 缺陷编号上界');
}

// ── 执行 ────────────────────────────────────────────────────────────────
ruleSmokeCount();
ruleVersion();
rulePdoneUrl();
ruleHealthFresh();
ruleCandidateFresh();
ruleSmokeWide();
ruleLinesAndSegments();
ruleHostApi();
ruleSourceCount();
ruleToggleTruth();
ruleHardcodedGrowing();
ruleCrossRepoAppDoc();
ruleRoadmapVersion();
ruleSourceAuditFacts();
ruleReadmeCurrentVersion();
ruleMutationGate();
ruleMatrixCoverage();
ruleReadThroughLedger();
ruleDocIndex();
ruleTestEntryCount();
ruleDefectIdCeiling();

console.log(`\n[L4 文档巡检] ${DRY ? 'DRY-RUN（不修改）' : '自动修复'} — ${new Date().toISOString().slice(0, 10)}\n`);
for (const r of report) console.log(r);
console.log(`\n汇总：${DRY ? '待处理' : '已修复'} ${fixed} 项 · 报告 ${report.length - fixed} 项\n`);
if (require.main === module) process.exit(0);
// 恒成功：修复/报告已落盘，workflow 以 git diff 判断是否有提交
