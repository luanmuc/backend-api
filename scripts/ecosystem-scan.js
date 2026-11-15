#!/usr/bin/env node
/**
 * scripts/ecosystem-scan.js —— v7.0 生态扫描脚本化
 *
 * 例行生态扫描（原手动）：抓取 pdone/lx-music-source 每日 CI 健康表（health-status 分支 health-state.json），
 * 与本仓库 SOURCE_HANDLERS 交叉对比，自动产出：
 *   1) 共有源状态交叉（pdone 探测 vs 本仓库实测——IP 维度不同，分歧仅作参考）
 *   2) 新候选（pdone 可用、本仓库未接入 → 待逐个真实取链/Range 实测，按用户规则"可用才接入"）
 *   3) 已失效源（pdone 连续失效，不投入）
 *
 * 用法：
 *   node scripts/ecosystem-scan.js            # 控制台报告
 *   node scripts/ecosystem-scan.js --json     # 仅输出 JSON（供 CI/其他脚本消费）
 *
 * 无第三方依赖（仅 Node 内置 https）；抓取失败明确报错退出（不静默产出空报告）。
 */
'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');

const PDONE_HEALTH_URL =
  'https://raw.githubusercontent.com/pdone/lx-music-source/health-status/health-state.json';

// pdone 源名 → 本仓库 SOURCE_HANDLERS id 映射（按源族对应；无映射 = 本仓库未接入）
// v8.15.1（R17）：juhe 族在本仓只剩 `juheTx`（`juheKw/Wy/Kg/Mg` 已于 v8.13 退役），
// 旧映射仍指 `juheKw`，会让交叉项恒显「本仓没有」并掩盖 juheTx 的真实状态；
// yuningxi 对应源 `nianxinVip` 已退役（同质冗余，2026-11-12），改入判否/退役留档。
const PDONE_TO_LOCAL = {
  changqing: 'changqingVip',
  huibq: 'huibq',
  ikun: 'ikun',
  juhe: 'juheTx',
  xinghai: 'xinghaiBackend',
  helloworld: 'helloworldKw', // 2026-11-05 审计修复：已接入源误报为候选（映射缺失）
  // fish/flower/grass/huanyin/hyw/jiexiang/lx/qdy/yuningxi → 无对应（见 DECIDED_CANDIDATES 判否/退役名单）
};

// v7.0 (S5)：本仓库源列表改为从 lx-source.js 动态提取——旧实现手工维护此表且 self-check 不校验，
// 源增删会漂移导致报告交叉项失真。
// v8.15.1（R16）：旧实现用正则从**产物**里抠 `const SOURCE_HANDLERS = {`——单文件构建后产物是
// `var SOURCE_HANDLERS = {` 且缩进/换行与源码不同，该正则恒不命中，脚本自 v8.13 起一启动就抛
// 「未找到 SOURCE_HANDLERS 定义块」（生态扫描这道"制度化"门禁实际从未跑通，CI 里也没有它）。
// 改为最小宿主加载产物、直接读导出面：结构怎么变都不会再因正则失配而静默失效。
const SRC_PATH = path.join(__dirname, '..', 'lx-source.js');
const LOCAL_SOURCES = (() => {
  if (!globalThis.lx) {
    globalThis.lx = {
      EVENT_NAMES: { inited: 'inited', request: 'request', updateAlert: 'updateAlert' },
      version: '1.2.0', env: {},
      utils: { buffer: { from: (d, e) => Buffer.from(d, e), bufToString: (b, e) => b.toString(e) } },
      request: (u, o, cb) => setTimeout(() => cb(new Error('mock-no-network'), null), 1),
      on: () => {}, send: () => {},
    };
  }
  const savedLog = console.log;
  console.log = () => {};
  try {
    const mod = require(SRC_PATH);
    const ids = Object.keys((mod && mod.SOURCE_HANDLERS) || {});
    if (!ids.length) throw new Error('lx-source.js 产物未导出 SOURCE_HANDLERS，请检查导出面');
    return ids;
  } finally { console.log = savedLog; }
})();

function fetchJson(url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'backend-api-ecosystem-scan' } }, (res) => {
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode} 抓取失败: ${url}`)); }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(new Error(`JSON 解析失败: ${e.message}`)); }
      });
    });
    req.on('error', (e) => reject(e));
    req.setTimeout(timeoutMs, () => { req.destroy(new Error(`抓取超时(${timeoutMs}ms): ${url}`)); });
  });
}

async function main() {
  const asJson = process.argv.includes('--json');
  const health = await fetchJson(PDONE_HEALTH_URL);
  if (!health || !health.sources) throw new Error('pdone 健康表结构异常：缺少 sources 字段');
  const pdoneSources = health.sources;

  const cross = [];      // 共有源交叉
  const newCandidates = []; // pdone 可用、本仓库未接入（且未判否）
  const decided = [];       // 已判否/留档候选（不再当新候选提示接入）
  const deadUpstream = [];  // pdone 失效/异常

  // 2026-11-05 审计修复：ecosystem-scan 不知道本仓库判否历史，把已判否源反复当新候选提示接入。
  // 判否结论来自 DEV_GUIDE「已判否的候选」（2026-10-29~30 三层实证），此处固化防误报。
  const DECIDED_CANDIDATES = {
    fish: '❌ 判否（2026-10-29：协议脱节/-462风控/音质校验失败）',
    hyw: '❌ 判否（2026-11-08 重评：后端已恢复但需卡密，非免费公益源）',
    jiexiang: '⚠️ 零增量留档（2026-10-30：成功通道走星海已接入，无新增量）',
    lx: '❌ 判否（2026-10-30：防搬运 403 不可复用）',
    qdy: '❌ 判否（2026-10-30：410 死链）',
    huanyin: '❌ 判否（2026-11-08 重评：主域名 DNS 失效，业务接口 api.xcvts.cn 已接入 suyinMigu）',
    yuningxi: '⛔ 已退役（`nianxinVip` 同质冗余，2026-11-12 清退，见 SOURCE_RETIREMENT）',
  };

  for (const [pdoneName, status] of Object.entries(pdoneSources)) {
    const localId = PDONE_TO_LOCAL[pdoneName];
    if (localId) {
      cross.push({ pdoneName, localId, pdoneStatus: status, localHas: LOCAL_SOURCES.includes(localId) });
    } else if (DECIDED_CANDIDATES[pdoneName]) {
      decided.push({ pdoneName, status, verdict: DECIDED_CANDIDATES[pdoneName] });
    } else if (status === '可用') {
      newCandidates.push({ pdoneName, status, note: 'pdone 每日 CI 可用，本仓库未接入 → 先用 candidate-audit.js 生成实证草案，再真实取链/Range 实测' });
    } else {
      deadUpstream.push({ pdoneName, status });
    }
  }

  const result = {
    scannedAt: new Date().toISOString(),
    pdoneUpdatedAt: health.updated_at || null,
    cross,
    newCandidates,
    decided,
    deadUpstream,
  };

  if (asJson) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return;
  }

  console.log('===== 生态扫描报告 =====');
  console.log(`pdone 健康表更新时间: ${result.pdoneUpdatedAt || '未知'} | 扫描时间: ${new Date().toLocaleString('zh-CN', { hour12: false })}`);
  console.log('');
  console.log(`① 共有源交叉（${cross.length}）——pdone 为 CI 服务器 IP、本仓库为本地 IP，分歧仅作参考：`);
  for (const c of cross) {
    console.log(`   - ${c.pdoneName} → 本仓库 ${c.localId}：pdone=${c.pdoneStatus}`);
  }
  console.log('');
  console.log(`② 新候选（pdone 可用、本仓库未接入，${newCandidates.length}）——按规则逐个真实验证后才接入：`);
  if (!newCandidates.length) console.log('   （无）');
  for (const c of newCandidates) {
    console.log(`   - ${c.pdoneName}（${c.status}）：${c.note}`);
  }
  console.log('');
  console.log(`③ pdone 已失效/异常（${deadUpstream.length}，不投入）：`);
  if (!deadUpstream.length) console.log('   （无）');
  for (const c of deadUpstream) {
    console.log(`   - ${c.pdoneName}（${c.status}）`);
  }
  console.log('');
  console.log(`候选接入下一步：对 ② 中每个候选抓取 latest.js 分析上游 → 真实取链 → CDN Range 206 + 魔数/码率校验 → 通过才接入 kw 链。`);
  console.log('');
  console.log(`💡 v8.1 已支持自动生成实证草案：node scripts/candidate-audit.js <脚本URL>`);
}

// 只有直接运行才联网抓 pdone；被 require 时保持沉默（模块加载只读导出面）。
if (require.main === module) {
  main().catch((e) => {
    process.stderr.write(`生态扫描失败: ${e && e.message ? e.message : String(e)}\n`);
    process.exit(1);
  });
}
module.exports = { LOCAL_SOURCES, PDONE_TO_LOCAL, fetchJson, main };
