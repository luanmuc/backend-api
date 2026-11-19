#!/usr/bin/env node
/**
 * recheck-candidates.js — 判否候选恢复探测（触发式待办自动监控）
 *
 * 探测已判否候选的关键通道，若恢复则提示可重评（触发式待办 → 主动发现）：
 *   - hyw    ：后端 `103.79.184.97` 曾 nginx 502（2026-10-30 判否）；2026-11-16 复核：首页 200 但业务
 *              `/api/music/url` 返回 401「需要卡密」+ `cardKeyRequired:true` → 付费门，维持判否
 *   - huanyin：music-dl.sayqz.com DNS 曾不可解析 + api.xcvts.cn 咪咕业务 502（2026-11-05 判否）
 *
 * 输出：终端报告 + 自动更新 docs/candidate-status.md（CI 提交回 master，
 * 恢复时状态文件变化即通知各账号可重评）。
 *
 * 用法：node scripts/recheck-candidates.js
 * 兼容 Node 18+（无第三方依赖，仅内置 dns/https/fetch）。
 */
'use strict';

const dns = require('dns').promises;
const fs = require('fs');
const path = require('path');

// ── 候选探测表 ───────────────────────────────────────────────────────────
const CANDIDATES = [
  {
    name: 'hyw（HYWmusic v1.2.0）',
    judge: '2026-10-30 判否：后端 103.79.184.97 全端点 http/https 均 nginx 502（脚本本身协议规范、未混淆、10 平台上报）；2026-11-16 复核：后端已恢复但业务接口要求卡密（401 cardKeyRequired），付费门不可接入',
    checks: [
      // 首页 200 只说明站点活着，不等于「业务通道可用」——2026-11-16 实测首页 200 但业务 401 卡密门
      { label: '首页 https 103.79.184.97', type: 'page', url: 'https://103.79.184.97/' },
      // 判定恢复的唯一硬口径：业务接口能出链（未带 key 时若返回 401 卡密门 → 付费门，不接入）
      { label: '业务 /api/music/url（不带 key）', type: 'biz', url: 'https://103.79.184.97/api/music/url?platform=tx&songmid=0039MnYb0qxYhV&quality=320k' },
    ],
  },
  {
    name: 'huanyin（幻音 v3）',
    judge: '2026-11-05 判否：music-dl.sayqz.com DNS 不可解析（域名失效）+ api.xcvts.cn 咪咕 502（IP 被限），双通道失效',
    // 2026-11-19 人工核查结案：备用通道 api.xcvts.cn 的咪咕线路已由 suyinMigu 接入（同一线路，无新增平台/音质），
    // 主域名仍 DNS 失效 → 本候选不产生增量，属「不可接入」，不再每次探测都挂回「需人工核查」。
    // 探测仍照跑（证据照记），只是不再覆盖人工结论。
    manualVerdict: { st: 'void', why: 'api.xcvts.cn 咪咕线路已由 suyinMigu 接入，无新增量；主域名仍 DNS 失效' },
    checks: [
      { label: 'DNS music-dl.sayqz.com', type: 'dns', host: 'music-dl.sayqz.com' },
      { label: '业务 api.xcvts.cn 咪咕', type: 'http', url: 'https://api.xcvts.cn/api/music/migu?keyword=test&page=1&pageSize=1' },
    ],
  },
];

// ── 探测实现 ────────────────────────────────────────────────────────────
const TIMEOUT_MS = 10000;

async function checkHttp(url) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const resp = await fetch(url, { signal: ctrl.signal, headers: { 'user-agent': 'lx-source-recheck/1.0' } });
    clearTimeout(timer);
    const text = await resp.text().catch(() => '');
    let bizCode = null;
    let gate = false;
    let cardKeyRequired = false;
    try {
      const j = JSON.parse(text);
      bizCode = j && typeof j === 'object' && 'code' in j ? j.code : null;
      // 付费/卡密门：401/403 且响应自述「需卡密」——视为不可接入，不是「已恢复」
      cardKeyRequired = !!(j && (j.cardKeyRequired === true || (j.received && j.received.cardKeyRequired === true)));
      gate = (resp.status === 401 || resp.status === 403 || bizCode === 401 || bizCode === 403)
        && (cardKeyRequired || /卡密|cardKey|激活码/i.test(String(j && j.message || '')));
    } catch (_) { /* 非 JSON（如 HTML/纯文本 502 页） */ }
    return { ok: true, status: resp.status, bizCode, gate, cardKeyRequired, sample: text.slice(0, 80).replace(/\n/g, ' ') };
  } catch (e) {
    return { ok: false, error: e.name === 'AbortError' ? '超时' : (e.cause?.code || e.message || String(e)) };
  }
}

async function checkDns(host) {
  try {
    const addrs = await dns.resolve4(host);
    return { ok: true, addresses: addrs };
  } catch (e) {
    return { ok: false, error: e.code || String(e) };
  }
}

async function runCheck(c) {
  const r = await (c.type === 'dns' ? checkDns(c.host) : checkHttp(c.url));
  return { ...c, result: r };
}

// 判定单候选状态：'recovered'（可重评）| 'review'（需人工核查）| 'paid'（付费/卡密门）| 'dead'（仍失效）
// 优先级刻意写成「付费门 > 域名 > 业务出链 > 参数疑变 > 仅页面活 > 死」：
// 首页 200 曾经把「需要卡密的付费门」误报成「已恢复-可重评」，2026-11-16 实测纠偏。
function candidateState(checks, manualVerdict) {
  // 人工结论最优先：已结案的候选不再被单次探测结果反复拉回「需人工核查」
  if (manualVerdict && manualVerdict.st) return manualVerdict.st
  // 付费/卡密门最优先：业务接口自述需卡密，首页再怎么 200 也不是可接入的公益源
  if (checks.some(c => c.result && c.result.ok && c.result.gate)) return 'paid';
  // 域名恢复（huanyin）：DNS 可解析 → 重评信号
  if (checks.some(c => c.type === 'dns' && c.result.ok)) return 'recovered';
  // 业务通道：出链成功（code 0/200）才算恢复
  for (const c of checks) {
    if (c.result.ok && (c.result.bizCode === 0 || c.result.bizCode === 200)) return 'recovered';
  }
  // 400 → 疑似协议/参数变更，需人工核查
  if (checks.some(c => c.result.ok && c.result.bizCode === 400)) return 'review';
  // 只有首页活着、无任何业务证据 → 只能算「需人工核查」，不得判恢复
  if (checks.some(c => c.result.ok && typeof c.result.status === 'number' && c.result.status !== 502)) return 'review';
  return 'dead';
}

// ── 自检（判定口径回归，2026-11-16 由 hyw 误报事故倒逼） ──────────────────
// 事故：首页 HTTP 200 → 旧判据直接判「已恢复-可重评」，而业务接口实际是 401 卡密门，
// 导致触发式待办被反复误唤醒。这四条断言守住「首页活着 ≠ 通道可用」。
function selfTest() {
  const cases = [
    ['RC1', '业务 401 + cardKeyRequired → 付费门', 'paid', [
      { type: 'page', label: 'p', result: { ok: true, status: 200, bizCode: null, gate: false } },
      { type: 'biz', label: 'b', result: { ok: true, status: 401, bizCode: 401, gate: true, cardKeyRequired: true } },
    ]],
    ['RC2', '仅首页 200、无业务证据 → 不得判恢复', 'review', [
      { type: 'page', label: 'p', result: { ok: true, status: 200, bizCode: null, gate: false } },
      { type: 'biz', label: 'b', result: { ok: false, error: 'ECONNREFUSED' } },
    ]],
    ['RC3', '业务出链 code 200 → 恢复', 'recovered', [
      { type: 'biz', label: 'b', result: { ok: true, status: 200, bizCode: 200, gate: false } },
    ]],
    ['RC4', '业务 502 → 仍失效', 'dead', [
      { type: 'page', label: 'p', result: { ok: true, status: 502, bizCode: null, gate: false } },
      { type: 'biz', label: 'b', result: { ok: true, status: 502, bizCode: 502, gate: false } },
    ]],
  ];
  // RC5：人工结案优先于任何探测结果（huanyin 场景：业务 400 本会判 review，人工结论应压成 void）
  cases.push(['RC5', '人工结论优先于探测结果 → 仍判 void', 'void', [
    { type: 'http', label: 'b', result: { ok: true, status: 200, bizCode: 400, gate: false } },
  ], { st: 'void', why: '无新增量' }])
  let fail = 0;
  for (const [id, name, expect, checks, manual] of cases) {
    const got = candidateState(checks, manual);
    const ok = got === expect;
    if (!ok) fail += 1;
    console.log(`${ok ? '✓' : '✗'} [${id}] ${name} — 期望 ${expect} 实得 ${got}`);
  }
  console.log(`自检 ${cases.length - fail}/${cases.length} 通过\n`);
  return fail;
}

// ── 主流程 ──────────────────────────────────────────────────────────────
async function main() {
  const selftestFail = selfTest();
  const lines = [];
  const stamp = new Date().toISOString().replace('T', ' ').slice(0, 19) + 'Z';
  console.log(`候选恢复探测（${stamp}）\n`);

  for (const cand of CANDIDATES) {
    console.log(`◆ ${cand.name}`);
    console.log(`  判否依据：${cand.judge}`);
    const results = [];
    for (const c of cand.checks) {
      const r = await runCheck(c);
      const rStr = r.type === 'dns'
        ? (r.result.ok ? `✅ 可解析 ${r.result.addresses.join(',')}` : `❌ ${r.result.error}`)
        : (r.result.ok ? `HTTP ${r.result.status}` + (r.result.bizCode !== null ? ` · 业务码 ${r.result.bizCode}` : '') : `❌ ${r.result.error}`);
      console.log(`  - ${r.label}: ${rStr}`);
      results.push(r);
    }
    const st = candidateState(results, cand.manualVerdict);
    const verdict = st === 'recovered' ? '🟢 已恢复 —— 可启动重评（候选实证流程）'
      : st === 'paid' ? '⚪ 付费/卡密门 —— 不可接入（维持判否，不再提示重评）'
      : st === 'void' ? `⚪ 无新增量 —— 不可接入（人工核查：${cand.manualVerdict?.why || ''}）`
      : st === 'review' ? '🟡 需人工核查 —— 接口有响应但通道未证实/参数疑变更，建议重评'
      : '🔴 仍失效 —— 继续等待';
    console.log(`  ➜ ${verdict}\n`);
    const stLabel = st === 'recovered' ? '🟢 已恢复-可重评' : st === 'paid' ? '⚪ 付费门-维持判否'
      : st === 'void' ? '⚪ 无新增量-维持判否（人工结案）'
      : st === 'review' ? '🟡 需人工核查' : '🔴 仍失效';
    lines.push(`| ${cand.name} | ${stLabel} | ${cand.checks.map(c => {
      const r = results.find(x => x.label === c.label);
      return r.type === 'dns'
        ? (r.result.ok ? `${c.label}=可解析` : `${c.label}=${r.result.error}`)
        : `${c.label}=${r.result.ok ? 'HTTP ' + r.result.status + (r.result.bizCode !== null ? '/' + r.result.bizCode : '') : r.result.error}`;
    }).join('；')} |`);
  }

  // 写状态文件
  const out = path.join(__dirname, '..', 'docs', 'candidate-status.md');
  const md = [
    '# 判否候选恢复状态（自动探测）',
    '',
    `> 由 \`scripts/recheck-candidates.js\` 自动生成 · ${stamp} · 探测到「已恢复」即提示启动候选实证重评流程（判否记录见 DEV_GUIDE）。`,
    '',
    '| 候选 | 状态 | 探测证据 |',
    '|---|---|---|',
    ...lines,
    '',
  ].join('\n');
  fs.writeFileSync(out, md);
  console.log(`\n状态已写入 docs/candidate-status.md`);
  if (selftestFail) process.exit(1);
}

// 只有直接运行才探测并覆写 candidate-status；被 require 时保持沉默。
if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
module.exports = { candidateState, selfTest, CANDIDATES };
