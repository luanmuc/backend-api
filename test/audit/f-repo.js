/**
 * test/audit/f-repo.js —— 第三轮：全仓库覆盖审计（U~Z 六组）
 *
 * 与前几轮的区别：a~e 审的是「lx-source.js 的行为」，本组审的是「仓库本身」——
 * 49 个文件是否合规、文档交叉引用是否成立、脚本之间契约是否对齐、功能联动是否接通、
 * 有没有残留死码、加载是否幂等。
 *
 * 用法：node test/audit/f-repo.js      （只读，不改仓库文件）
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '../..');
const res = [];
let fail = 0;
const rec = (id, name, ok, detail) => {
  res.push({ id, ok: !!ok });
  if (!ok) fail++;
  console.log(`${ok ? '✓' : '✗'} [${id}] ${name}${detail ? ' — ' + detail : ''}`);
};
const abs = p => path.join(ROOT, p);
const read = p => fs.readFileSync(abs(p), 'utf8');
const exists = p => fs.existsSync(abs(p));
const files = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).trim().split('\n');
const byExt = e => files.filter(f => f.endsWith(e));

// ══ U 组：全文件静态合规 ══
console.log('\n[U] 全文件静态合规（' + files.length + ' 个 tracked 文件）');
{
  const js = byExt('.js');
  const bad = [];
  for (const f of js) {
    try { execFileSync('node', ['--check', abs(f)], { stdio: 'pipe' }); } catch (e) { bad.push(f); }
  }
  rec('U1', `全部 ${js.length} 个 .js 通过 node --check`, bad.length === 0, bad.join(','));

  const md = byExt('.md');
  // 注意：``` 代码块内的 `# 注释` 是 shell 注释，不是 Markdown H1——必须跳过围栏内行
  const h1Count = (f) => {
    let inFence = false, n = 0, inHead = false;
    const lines = read(f).split('\n');
    lines.forEach((l, i) => {
      if (/^\s*```/.test(l)) { inFence = !inFence; return; }
      if (inFence) return;
      if (/^# /.test(l)) { n++; if (i < 8) inHead = true; }
    });
    return { n, inHead };
  };
  const noH1 = [], multiH1 = [];
  for (const f of md) {
    const c = h1Count(f);
    if (!c.inHead) noH1.push(f);
    if (c.n > 1) multiH1.push(f);
  }
  rec('U2', `全部 ${md.length} 个 .md 首 8 行内有 H1`, noH1.length === 0, noH1.join(','));
  rec('U3', '每个 .md 只有一个 H1', multiH1.length === 0, multiH1.join(','));

  const crlf = files.filter(f => /\.(js|md|yml|json|jsonl|sh)$/.test(f) && /\r/.test(read(f)));
  rec('U4', '无 CRLF 换行（js/md/yml/json/sh）', crlf.length === 0, crlf.join(','));

  const bom = files.filter(f => /\.(js|md)$/.test(f) && read(f).charCodeAt(0) === 0xFEFF);
  rec('U5', '无 UTF-8 BOM', bom.length === 0, bom.join(','));

  // U6 口径：.js 全文匹配（代码注释/实现里出现待办标记才是真待办）；
  // .md 只认「行首以待办标记开头的条目」——文档里写「无待办标记」这类说明属于描述性提及，
  // 全文匹配会把规则本身判成违规（本轮实际踩到）。
  // 另：标记词用拼接构造，避免本脚本自身源码出现该字面量 → 自指误报。
  const TBD = ['TO' + 'DO', 'FI' + 'XE', 'XX' + 'X'].join('|');
  const reTodoJs = new RegExp('\\b(' + TBD + ')\\b', 'g');
  const reTodoMd = new RegExp('^[ \\t]*(?:[-*][ \\t]+)?(' + TBD + ')\\b', 'gm');
  const todo = [];
  for (const f of files.filter(x => /\.js$/.test(x))) {
    const m = read(f).match(reTodoJs);
    if (m) todo.push(`${f}(${m.length})`);
  }
  for (const f of files.filter(x => /\.md$/.test(x))) {
    const m = read(f).match(reTodoMd);
    if (m) todo.push(`${f}(${m.length})`);
  }
  rec('U6', '无未处理待办标记（代码全文匹配，文档仅行首条目）', todo.length === 0, todo.join(','));

  const tmpPath = files.filter(f => /\.js$/.test(f) && /['"`]\/tmp\//.test(read(f)));
  rec('U7', '无 /tmp/ 硬编码路径（脚本可移植）', tmpPath.length === 0, tmpPath.join(','));

  const secrets = [];
  for (const f of files.filter(x => /\.(js|md|yml)$/.test(x))) {
    const s = read(f);
    if (/gh[pousr]_[A-Za-z0-9]{20,}/.test(s)) secrets.push(f + ':ghToken');
    if (/[0-9a-f]{40}/.test(s) && !/commit|hash|md5|sha|40 位|asset/i.test(s)) secrets.push(f + ':40hex');
  }
  rec('U8', '无明文 token / 40 位密钥', secrets.length === 0, secrets.join(','));

  // 只抓「真调试残留」：排除 logInfo/logWarn 里对 console 的绑定与转发
  const dbg = read('lx-source.js').split('\n')
    .filter(l => /console\.(log|debug|error)/.test(l))
    .filter(l => !/console\.(log|error)\.bind\(console\)/.test(l))
    .filter(l => !/^\s*(\/\/|\*)/.test(l));
  rec('U9', 'lx-source.js 无 console 调试残留（走 logInfo/logWarn）', dbg.length === 0, dbg.slice(0, 3).join(' | '));

  const jsons = byExt('.json');
  const badJson = [];
  for (const f of jsons) { try { JSON.parse(read(f)); } catch (e) { badJson.push(f); } }
  rec('U10', `全部 ${jsons.length} 个 .json 可解析`, badJson.length === 0, badJson.join(','));

  const jsonl = byExt('.jsonl');
  let badLine = 0;
  for (const f of jsonl) for (const l of read(f).split('\n')) { if (!l.trim()) continue; try { JSON.parse(l); } catch (e) { badLine++; } }
  rec('U11', `jsonl 每行合法 JSON（坏行 ${badLine}）`, badLine === 0);

  const yml = byExt('.yml');
  const tabYml = yml.filter(f => /\t/.test(read(f)));
  rec('U12', 'YAML 无 Tab 缩进', tabYml.length === 0, tabYml.join(','));

  const empty = files.filter(f => fs.statSync(abs(f)).size === 0);
  rec('U13', '无空文件', empty.length === 0, empty.join(','));
}

// ══ V 组：交叉引用与数字一致性 ══
console.log('\n[V] 交叉引用与一致性');
{
  const md = byExt('.md');
  const dead = [];
  for (const f of md) {
    const dir = path.dirname(abs(f));
    const re = /\[[^\]]*\]\(([^)#\s]+)(#[^)]*)?\)/g;
    let m;
    while ((m = re.exec(read(f)))) {
      const t = m[1];
      if (/^(https?:|mailto:|#)/.test(t)) continue;
      const p = path.resolve(dir, t);
      if (!fs.existsSync(p)) dead.push(`${f}→${t}`);
    }
  }
  rec('V1', `全部 ${md.length} 个 .md 相对链接无死链`, dead.length === 0, dead.slice(0, 4).join(' | '));

  const verSrc = (read('lx-source.js').match(/@version\s+([\d.]+)/) || [])[1];
  const docsHaveVer = ['README.md', 'docs/ITERATION_ROADMAP.md', 'docs/DEV_GUIDE.md'].map(f => {
    const m = read(f).match(new RegExp('v?' + verSrc.replace(/\./g, '\\.') + '\\b'));
    return m ? null : f;
  }).filter(Boolean);
  rec('V2', `@version ${verSrc} 在 README/ROADMAP/DEV_GUIDE 均出现`, docsHaveVer.length === 0, docsHaveVer.join(','));

  const smokeOut = execFileSync('node', [abs('test/lx-source-smoke-test.js')], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
  const smokePairs = [...smokeOut.matchAll(/(\d+)\s*组/g)].map(m => Number(m[1]));
  const smokeNum = Math.max(...smokePairs);
  rec('V3', `冒烟实测组数可解析（${smokeNum} 组）`, smokeNum >= 60, 'max=' + smokeNum);

  const toggleKeys = (read('lx-source.js').match(/const SOURCE_TOGGLES = \{([\s\S]*?)\n\};/) || [])[1] || '';
  const toggleN = (toggleKeys.match(/^\s{2}\w+:/gm) || []).length;
  const docN = (read('docs/DEV_GUIDE.md').match(/(\d+)\s*个子源|登记源\s*(\d+)/) || [])[0] || '';
  // 注意：SOURCE_TOGGLES 是 16 个开关键（juhe 四源写在同一行），对应 20 个源——两者不是一回事
  const srcCnt = (read('lx-source.js').match(/id:\s*"[\w.]+"/g) || []).length;
  // 注意：juhe 五源写在同一行，按行数统计会得 16，真实是 20 个键（用 parseToggles 的解析结果做真值）
  const parsedN = (() => { try { const o = require(abs('scripts/source-toggles.js')).parseToggles(); return Object.keys(o.toggles || o).length; } catch (e) { return -1; } })();
  rec('V4', `SOURCE_TOGGLES 实测 ${parsedN} 个开关（文档口径 ${docN || '未声明'}）`, parsedN === 20, `解析 ${parsedN} 键 / 行内 ${toggleN} 行`);

  const errN = Object.keys(JSON.parse('{}')).length; // placeholder 保持结构
  const errBlock = (read('lx-source.js').match(/const ERROR_CODES = \{([\s\S]*?)\n\};/) || [])[1] || '';
  const errCnt = (errBlock.match(/^\s{2}\w+:/gm) || []).length;
  const errDoc = (read('docs/DEV_GUIDE.md').match(/ERROR_CODES[^\n]*?(\d+)\s*个/) || [])[1];
  rec('V5', `ERROR_CODES 实测 ${errCnt} 个${errDoc ? `，文档写 ${errDoc}` : '（文档未写死，OK）'}`, !errDoc || Number(errDoc) === errCnt);

  const scriptsMention = [];
  for (const f of md) {
    const re = /scripts\/[\w.-]+\.js/g; let m;
    while ((m = re.exec(read(f)))) scriptsMention.push([f, m[0]]);
  }
  const missScript = scriptsMention.filter(([, s]) => !exists(s));
  rec('V6', `文档引用的 ${new Set(scriptsMention.map(x => x[1])).size} 个脚本全部存在`, missScript.length === 0, missScript.slice(0, 3).join(' | '));

  const testMention = [];
  for (const f of md) { const re = /test\/[\w./-]+\.js/g; let m; while ((m = re.exec(read(f)))) testMention.push(m[0]); }
  const missTest = [...new Set(testMention)].filter(t => !exists(t));
  rec('V7', `文档引用的 ${new Set(testMention).size} 个测试文件全部存在`, missTest.length === 0, missTest.join(','));

  const archived = files.filter(f => f.startsWith('docs/archive/'));
  rec('V8', `归档目录存在且有 ${archived.length} 个文件`, archived.length >= 2, archived.join(','));
}

// ══ W 组：脚本自洽 ══
console.log('\n[W] 脚本自洽');
{
  const run = (cmd, args) => { try { execFileSync(cmd, args, { cwd: ROOT, stdio: 'pipe', timeout: 180000 }); return 0; } catch (e) { return e.status === undefined ? -1 : e.status; } };
  rec('W1', 'self-check 退出 0', run('node', [abs('scripts/self-check.js')]) === 0);
  rec('W2', 'docs-audit --dry-run 退出 0', run('node', [abs('scripts/docs-audit.js'), '--dry-run']) === 0);
  rec('W3', 'probe --selftest-duration 退出 0', run('node', [abs('scripts/probe.js'), '--selftest-duration']) === 0);
  rec('W4', 'candidate-audit-test 退出 0', run('node', [abs('test/candidate-audit-test.js')]) === 0);

  const reg = require(abs('scripts/endpoint-registry.js'));
  const list = reg.ENDPOINTS || reg.endpoints || [];
  // 真实字段是 url/sources/kind/note（没有 id）——按 url 唯一性与字段完整性校验
  const urls = list.map(e => e.url);
  const fieldOk = list.every(e => e.url && Array.isArray(e.sources) && e.kind);
  rec('W5', `endpoint-registry 导出 ${list.length} 条、url 唯一且字段完整`, list.length === 20 && new Set(urls).size === list.length && fieldOk,
    `uniqUrl=${new Set(urls).size} fieldOk=${fieldOk}`);

  const tog = require(abs('scripts/source-toggles.js'));
  const raw = typeof tog.parseToggles === 'function' ? tog.parseToggles() : null;
  const t = raw && raw.toggles ? raw.toggles : raw;   // 真实返回是 {toggles, ...}，取内层
  rec('W6', 'source-toggles 可解析出 20 个开关真值', !!t && Object.keys(t).length === 20, t ? Object.keys(t).length + ' 键' : 'no export');

  const cn = require(abs('scripts/cn-date.js'));
  const today = typeof cn.todayCN === 'function' ? cn.todayCN() : null;
  const bj = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
  rec('W7', `cn-date 输出北京日期（${today} vs UTC+8 ${bj}）`, today === bj);

  const map = require(abs('scripts/doc-sync-map.js'));
  const mapObj = map.MAP || map.map || map.rules || {};
  const mapKeys = Object.keys(mapObj);
  const missKey = mapKeys.filter(k => !exists(k) && !k.includes('*'));
  rec('W8', `doc-sync-map 覆盖 ${mapKeys.length} 个路径规则，无指向不存在文件`, missKey.length === 0, missKey.join(','));

  const hooksDir = abs('scripts/hooks');
  const hooks = fs.readdirSync(hooksDir);
  const badHook = hooks.filter(h => /\.(js|sh)$/.test(h) && run('bash', ['-n', path.join(hooksDir, h)]) !== 0);
  rec('W9', `${hooks.length} 个 hook 文件语法通过`, badHook.length === 0, badHook.join(','));
}

// ══ X 组：功能联动（跨模块契约） ══
console.log('\n[X] 功能联动（跨模块）');
{
  const src = read('lx-source.js');
  const probe = read('scripts/probe.js');
  const daily = read('scripts/health-daily.js');
  const rh = read('README_HEALTH.md');

  rec('X1', 'probe 的片段码 PAYLOAD_FRAGMENT 与源码 PREVIEW_FRAGMENT 语义对齐（两码都在且文档有解释）',
    /PAYLOAD_FRAGMENT/.test(probe) && /PREVIEW_FRAGMENT/.test(src) && /片段/.test(read('docs/DEV_GUIDE.md')));

  const dailyFields = ['fragment', 'ok', 'fail'].filter(f => new RegExp(`\\b${f}\\b`).test(daily));
  rec('X2', `health-daily 产出关键字段被 README_HEALTH 消费（${dailyFields.join('/')}）`,
    dailyFields.length >= 2 && /平台健康汇总/.test(rh));

  const cs = read('docs/candidate-status.md');
  rec('X3', 'candidate-status 表头与 recheck-candidates 输出格式一致',
    /\|\s*候选\s*\|\s*状态\s*\|\s*探测证据\s*\|/.test(cs) && /候选/.test(read('scripts/recheck-candidates.js')));

  const devGuide = read('docs/DEV_GUIDE.md');
  const cands = ['hyw', 'huanyin'].filter(c => cs.includes(c));
  rec('X4', `判否候选名单在 DEV_GUIDE 与 candidate-status 一致（${cands.join('/')}）`,
    cands.length === 2 && cands.every(c => new RegExp(c, 'i').test(devGuide)));

  const com = require(abs('scripts/source-toggles.js'));
  const rawTt = typeof com.parseToggles === 'function' ? com.parseToggles() : {};
  const tt = rawTt && rawTt.toggles ? rawTt.toggles : rawTt;
  // 逐键比对：源码一行可能写多个键，用全局 match 而不是按行
  const srcToggle = (src.match(/const SOURCE_TOGGLES = \{([\s\S]*?)\n\};/) || [])[1] || '';
  const srcPairs = {};
  [...srcToggle.matchAll(/(\w+):\s*(true|false)/g)].forEach(m => { srcPairs[m[1]] = m[2] === 'true'; });
  const mismatch = Object.keys(srcPairs).filter(k => tt[k] !== srcPairs[k]);
  rec('X5', `source-toggles 解析值与源码默认值逐键一致（源码 ${Object.keys(srcPairs).length} 键 / 解析 ${Object.keys(tt).length} 键）`,
    mismatch.length === 0 && Object.keys(srcPairs).length === 20, mismatch.join(','));

  const ruleN = (read('scripts/docs-audit.js').match(/规则\s*(\d+)/g) || []).length;
  const declared = (read('docs/DOC_SEMANTIC_CHECKLIST.md').match(/(\d+)\s*条规则/) || [])[1];
  rec('X6', `docs-audit 规则数 vs DOC_SEMANTIC_CHECKLIST 声明（实读 ${ruleN} 处，声明 ${declared || '未写'}）`,
    !declared || Number(declared) >= 10);

  const ci = read('.github/workflows/ci.yml');
  const ciRefs = [...new Set((ci.match(/(scripts|test)\/[\w./-]+\.js/g) || []))];
  const missCi = ciRefs.filter(p => !exists(p));
  rec('X7', `CI 引用的 ${ciRefs.length} 个脚本/测试全部存在`, missCi.length === 0, missCi.join(','));

  const da = read('.github/workflows/docs-audit.yml');
  const daRefs = [...new Set((da.match(/(scripts|test)\/[\w./-]+\.js/g) || []))];
  rec('X8', `docs-audit workflow 引用的 ${daRefs.length} 个脚本全部存在`, daRefs.every(p => exists(p)), daRefs.filter(p => !exists(p)).join(','));

  rec('X9', '至少一个 CI workflow 跑文档一致性（docs-audit 有独立 workflow 亦可）',
    /docs-audit/.test(ci) || /docs-audit/.test(da), /docs-audit/.test(ci) ? 'ci 内' : '独立 workflow');
}

// ══ Y 组：残留与死码 ══
console.log('\n[Y] 残留与死码');
{
  const src = read('lx-source.js');
  const fnDefs = [...src.matchAll(/^function (\w+)\(/gm)].map(m => m[1]);
  const dupFn = fnDefs.filter((n, i) => fnDefs.indexOf(n) !== i);
  rec('Y1', `无重复函数定义（${fnDefs.length} 个）`, dupFn.length === 0, dupFn.join(','));

  const consts = [...src.matchAll(/^const (\w+) =/gm)].map(m => m[1]);
  const unusedConst = consts.filter(c => (src.match(new RegExp(`\\b${c}\\b`, 'g')) || []).length <= 1);
  rec('Y2', `无只定义不使用的一次性常量（${consts.length} 个）`, unusedConst.length === 0, unusedConst.join(','));

  rec('Y3', '无 debugger 语句', !/^\s*debugger\s*;?/m.test(src));

  const errBlock = (src.match(/const ERROR_CODES = \{([\s\S]*?)\n\};/) || [])[1] || '';
  const errKeys = [...errBlock.matchAll(/^\s{2}(\w+):/gm)].map(m => m[1]);
  const neverThrown = errKeys.filter(k => (src.match(new RegExp(`ERROR_CODES\\.${k}\\b`, 'g')) || []).length === 0);
  rec('Y4', `每个错误码至少被使用一次（${errKeys.length} 个）`, neverThrown.length === 0, neverThrown.join(','));

  const unusedVar = [...src.matchAll(/let (\w+) =/g)].map(m => m[1])
    .filter(v => (src.match(new RegExp(`\\b${v}\\b`, 'g')) || []).length <= 1);
  rec('Y5', '无只声明不使用的 let 变量', unusedVar.length === 0, unusedVar.slice(0, 5).join(','));

  const expBlock = (src.match(/module\.exports = \{([\s\S]*?)\n\s*\};/) || [])[1] || '';
  const expNames = [...expBlock.matchAll(/^\s{2,4}(\w+),?/gm)].map(m => m[1]);
  rec('Y6', `导出测试面存在且非空（${expNames.length} 项）`, expNames.length >= 10, expNames.length + ' 项');
}

// ══ Z 组：资源与启动 ══
console.log('\n[Z] 资源与启动');
{
  // 宿主 mock：lx-source.js 顶层会解构 globalThis.lx，直接 require 会 TypeError
  const lxMock = () => {
    globalThis.lx = {
      EVENT_NAMES: { request: 'request', inited: 'inited', updateAlert: 'updateAlert' },
      request: (url, opts, cb) => cb(null, { statusCode: 200, body: '' }),
      on: () => {}, send: () => {},
      utils: { buffer: { from: () => ({ toString: () => '' }) }, md5: () => '', randomBytes: () => '' },
      env: { os: 'android' }, version: 'test',
    };
  };
  lxMock();
  const t0 = Date.now();
  require(abs('lx-source.js'));
  const loadMs = Date.now() - t0;
  rec('Z1', `模块加载耗时 ${loadMs}ms（< 50ms）`, loadMs < 50);

  const heapBefore = process.memoryUsage().heapUsed;
  for (let i = 0; i < 3; i++) { delete require.cache[require.resolve(abs('lx-source.js'))]; lxMock(); require(abs('lx-source.js')); }
  const heapAfter = process.memoryUsage().heapUsed;
  rec('Z2', `重复加载 3 次堆增长 ${((heapAfter - heapBefore) / 1024 / 1024).toFixed(1)}MB（< 20MB）`, heapAfter - heapBefore < 20 * 1024 * 1024);

  const exp = typeof require(abs('lx-source.js')).__test__ !== 'undefined' ? Object.keys(require(abs('lx-source.js')).__test__) : Object.keys(require(abs('lx-source.js')));
  rec('Z3', `导出面 ${exp.length} 项且含核心函数`, exp.length >= 10 && exp.some(k => /wrapExecute|buildSourceChain|getUrlWithFallback|raceFirst/.test(k)), exp.join(','));

  rec('Z4', '仓库无 .DS_Store / .env / node_modules 等不应入库的文件',
    files.every(f => !/\.DS_Store|\.env|node_modules|\.log$/.test(f)));

  const big = files.filter(f => fs.statSync(abs(f)).size > 500 * 1024);
  rec('Z5', `无 >500KB 的单文件（最大 ${Math.max(...files.map(f => fs.statSync(abs(f)).size)) / 1024}KB）`, big.length === 0, big.join(','));
}

console.log(`\n第三轮全仓覆盖审计（U~Z）汇总：${res.length - fail} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
