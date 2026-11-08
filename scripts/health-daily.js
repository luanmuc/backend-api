#!/usr/bin/env node
/**
 * v8.10.5 健康日报（重写）
 *
 * 从「每天全量重列 + 对所有端点出摘除建议」改为「变化检测 + 分级 + 动作出口」：
 *   1. 端点清单与源归属读 scripts/endpoint-registry.js（单一真相，不再手写第二份映射表）
 *   2. 启用状态从 lx-source.js 的 SOURCE_TOGGLES 解析（不另存一份开关清单）
 *   3. 只对**启用中**的源出「需处理」；已关闭源静默归档
 *   4. param 类端点（裸探测缺参恒 4xx）不参与判定，避免 helloworld 这类假警报
 *   5. 与前一有数据日对比，只有发生翻转/突变才进「今日变化」
 *   6. 每条结论给出可执行动作（改哪个文件的哪个开关）
 *
 * 用法：node scripts/health-daily.js [--date YYYY-MM-DD] [--out PATH]
 */
const fs = require('fs');
const path = require('path');
const { ENDPOINTS } = require('./endpoint-registry.js');

const SRC = path.join(__dirname, '..', 'lx-source.js');
const HISTORY_PATH = path.join(__dirname, '..', 'docs', 'probe-history.jsonl');
const OUT_DIR = path.join(__dirname, '..', 'docs', 'health-daily');

const WINDOW_DAYS = 7;
const FAIL_RATE_THRESHOLD = 50; // 真故障率 > 50% 视为需处理
const CONSECUTIVE_FAIL_DAYS = 3; // 连续 3 天全失败
const OBSERVE_MAX_RATE = 80; // 50%~80% 归入「观察」
const SMALL_SAMPLE = 20; // 样本 <20 时成功率仅作趋势参考
const CHANGE_PP_THRESHOLD = 30; // 窗口成功率变化超过 30 个百分点算突变

// ---------- 从 lx-source.js 解析启用状态（生产真相） ----------
function parseToggles() {
  const src = fs.readFileSync(SRC, 'utf8');
  const start = src.indexOf('const SOURCE_TOGGLES = {');
  if (start < 0) throw new Error('lx-source.js 中未找到 SOURCE_TOGGLES，无法判定启用状态');
  const open = src.indexOf('{', start);
  let depth = 0;
  let end = -1;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (!depth) { end = i; break; }
    }
  }
  if (end < 0) throw new Error('SOURCE_TOGGLES 花括号未闭合');

  const blockStartLine = src.slice(0, open + 1).split('\n').length;
  const toggles = {};
  const lineNo = {};
  src.slice(open + 1, end).split('\n').forEach((raw, i) => {
    const clean = raw.replace(/\/\/.*$/, '');
    const re = /([A-Za-z_$][\w$]*)\s*:\s*(true|false)/g;
    let m;
    while ((m = re.exec(clean))) {
      toggles[m[1]] = m[2] === 'true';
      lineNo[m[1]] = blockStartLine + i;
    }
  });
  const count = Object.keys(toggles).length;
  if (count < 15) throw new Error(`SOURCE_TOGGLES 只解析出 ${count} 个开关，疑似解析失败`);
  return { toggles, lineNo };
}

// ---------- 历史聚合 ----------
function loadHistory() {
  if (!fs.existsSync(HISTORY_PATH)) return [];
  return fs.readFileSync(HISTORY_PATH, 'utf8')
    .split('\n').filter(Boolean)
    .map(l => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean);
}

/** 取某端点在某日为基准、往前 WINDOW_DAYS 天的窗口统计；无数据返回 null */
function windowStats(entries, url, baseDate) {
  const dates = [...new Set(entries.map(e => e.date))].filter(d => d <= baseDate).sort();
  const window = dates.slice(-WINDOW_DAYS);
  const recs = entries.filter(e => e.url === url && window.includes(e.date));
  if (!recs.length) return null;

  const total = recs.length;
  const success = recs.filter(r => r.ok).length;
  const rate = Math.round((success / total) * 1000) / 10;

  const byDate = {};
  for (const r of recs) {
    if (!byDate[r.date]) byDate[r.date] = { ok: 0, fail: 0 };
    if (r.ok) byDate[r.date].ok++; else byDate[r.date].fail++;
  }
  const sorted = Object.keys(byDate).sort();
  let consecutiveFail = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (byDate[sorted[i]].ok === 0) consecutiveFail++;
    else break;
  }

  const latest = entries.filter(e => e.url === url && e.date === baseDate).sort((a, b) => a.date.localeCompare(b.date));
  return {
    total, success, rate, consecutiveFail,
    avgTime: Math.round(recs.reduce((s, r) => s + (r.time || 0), 0) / total),
    lastOk: latest.length ? latest[latest.length - 1].ok : null,
    lastStatus: latest.length ? latest[latest.length - 1].status : 0,
    lastReason: latest.length ? latest[latest.length - 1].reason : '',
    reasons: [...new Set(recs.filter(r => !r.ok).map(r => r.reason))],
  };
}

/** 展示名：有源用源 id，工具类端点用 label */
function labelOf(ep) {
  return ep.sources && ep.sources.length ? ep.sources.join('/') : (ep.label || ep.url.slice(0, 40));
}

// ---------- 渲染 ----------
function render({ rows, changes, targetDate, prevDate, toggles, lineNo }) {
  const L = [];
  L.push(`# 健康日报 ${targetDate}`);
  L.push('');
  L.push('> **能回答什么**：端点还活不活着、成功率有没有突变、哪个源刚变坏（有连续日序列）。');
  L.push('> **不能回答什么**：这源现在能不能出链接——那归 `node scripts/source-audit.js`（逐源真实取链，按需跑）。');
  L.push('> **判定口径**：仅**启用中**的源参与判定；`param` 类端点（真实调用带参、裸探测恒 4xx）不参与；`payload` 类已做真实取链 + Range 校验。');
  L.push(`> **样本警示**：样本 <${SMALL_SAMPLE} 时成功率只作趋势参考，不能当精确值。`);
  L.push('');
  L.push(`> 对比基准：${prevDate || '无（历史不足）'} → ${targetDate}`);
  L.push('');

  // 今日变化
  L.push('## 今日变化');
  L.push('');
  if (!changes.length) {
    L.push('无异常变化，全部端点状态与前一有数据日一致。');
  } else {
    for (const c of changes) L.push(`- ${c.text}`);
  }
  L.push('');

  // 需处理
  const handle = rows.filter(r => r.bucket === 'handle');
  L.push('## 需处理（启用源）');
  L.push('');
  if (!handle.length) {
    L.push('无。启用中的源没有达到告警阈值。');
  } else {
    L.push('| 源 | 端点 | 样本 | 成功率 | 连续失败 | 最近原因 | 动作 |');
    L.push('|---|---|---|---|---|---|---|');
    for (const r of handle) {
      const ids = r.sources.join('/');
      const act = r.kind === 'payload'
        ? `先跑 \`node scripts/source-audit.js\` 确认取链，再决定 \`SOURCE_TOGGLES.${r.sources[0]}: true → false\`（lx-source.js:${lineNo[r.sources[0]] || '?'}）`
        : `改 \`SOURCE_TOGGLES.${r.sources[0]}: true → false\`（lx-source.js:${lineNo[r.sources[0]] || '?'}）`;
      L.push(`| ${ids} | \`${r.url.slice(0, 46)}\` | ${r.total} | ${r.rate}% | ${r.consecutiveFail} 天 | ${r.lastReason || '-'} | ${act} |`);
    }
  }
  L.push('');

  // 观察
  const watch = rows.filter(r => r.bucket === 'watch');
  L.push('## 观察（启用源，暂不动作）');
  L.push('');
  if (!watch.length) {
    L.push('无。');
  } else {
    L.push('| 源 | 端点 | 样本 | 成功率 | 连续失败 | 备注 |');
    L.push('|---|---|---|---|---|---|');
    for (const r of watch) {
      const note = r.total < SMALL_SAMPLE ? '样本偏小，需继续累计' : '未达告警阈值';
      L.push(`| ${r.label} | \`${r.url.slice(0, 46)}\` | ${r.total} | ${r.rate}% | ${r.consecutiveFail} 天 | ${note} |`);
    }
  }
  L.push('');

  // 正常
  const okRows = rows.filter(r => r.bucket === 'ok');
  L.push('## 正常');
  L.push('');
  L.push(okRows.length
    ? okRows.map(r => `\`${r.url.slice(0, 42)}\`（${r.label} ${r.rate}%，${r.total} 样本）`).join('、')
    : '无。');
  L.push('');

  // 未参与判定
  const skipped = rows.filter(r => r.bucket === 'skip');
  L.push('## 未参与判定');
  L.push('');
  if (!skipped.length) {
    L.push('无。');
  } else {
    for (const r of skipped) {
      if (r.skipReason === 'param') {
        L.push(`- \`${r.url.slice(0, 50)}\`（${r.label}）：真实调用需带参，裸探测 404 属正常，不参与判定`);
      } else {
        L.push(`- \`${r.url.slice(0, 50)}\`（${r.label}）：源已关闭（\`SOURCE_TOGGLES=false\`），静默不告警`);
      }
    }
  }
  L.push('');
  L.push('---');
  L.push('');
  L.push(`参与判定 ${rows.filter(r => r.bucket !== 'skip').length} 个端点 / 登记 ${ENDPOINTS.length} 个；需处理 ${handle.length} 条；今日变化 ${changes.length} 条。`);
  L.push('');
  return L.join('\n');
}

// ---------- 主流程 ----------
function main() {
  const args = process.argv.slice(2);
  const dateIdx = args.indexOf('--date');
  const outIdx = args.indexOf('--out');
  const targetDate = dateIdx >= 0 ? args[dateIdx + 1] : new Date().toISOString().slice(0, 10);
  const outPath = outIdx >= 0 ? args[outIdx + 1] : path.join(OUT_DIR, `${targetDate}.md`);

  const entries = loadHistory();
  if (!entries.length) { console.error('probe-history.jsonl 无数据'); process.exit(1); }

  const { toggles, lineNo } = parseToggles();

  // 前一有数据日（用于变化检测）
  const allDates = [...new Set(entries.map(e => e.date))].filter(d => d <= targetDate).sort();
  const prevDate = allDates.length >= 2 ? allDates[allDates.length - 2] : null;

  const rows = [];
  const changes = [];

  for (const ep of ENDPOINTS) {
    const cur = windowStats(entries, ep.url, targetDate);
    if (!cur) {
      // 端点已登记但窗口内无样本：可能是 probe 未跑到（不静默吞掉，明确标未覆盖）
      rows.push({ url: ep.url, sources: ep.sources, kind: ep.kind, label: labelOf(ep), bucket: 'skip', skipReason: 'no-data' });
      continue;
    }
    const enabled = ep.toggleable === false ? true : ep.sources.some(s => toggles[s] === true);


    // 变化检测：只对启用中的源报（关闭源的状态翻转没有动作价值，只会重新带来噪声）
    if (prevDate && enabled) {
      const prev = windowStats(entries, ep.url, prevDate);
      if (prev && prevDate !== targetDate) {
        const flip = prev.lastOk === true && cur.lastOk === false;
        const recover = prev.lastOk === false && cur.lastOk === true;
        const delta = Math.round((cur.rate - prev.rate) * 10) / 10;
        if (flip) {
          changes.push({ text: `🔴 **${labelOf(ep)}**：${prevDate} 可用 → ${targetDate} **失败**（${cur.lastReason}）` });
        } else if (recover) {
          changes.push({ text: `🟢 **${labelOf(ep)}**：${prevDate} 失败 → ${targetDate} **恢复**` });
        } else if (Math.abs(delta) >= CHANGE_PP_THRESHOLD) {
          changes.push({ text: `${delta < 0 ? '🟡' : '🟢'} **${labelOf(ep)}**：窗口成功率 ${prev.rate}% → ${cur.rate}%（${delta > 0 ? '+' : ''}${delta}pp）` });
        }
      }
    }

    // 分级
    const label = labelOf(ep);
    let bucket;
    let skipReason;
    if (ep.kind === 'param') { bucket = 'skip'; skipReason = 'param'; }
    else if (!enabled) { bucket = 'skip'; skipReason = 'disabled'; }
    else if (cur.consecutiveFail >= CONSECUTIVE_FAIL_DAYS || cur.rate < (100 - FAIL_RATE_THRESHOLD)) bucket = 'handle';
    else if (cur.rate < OBSERVE_MAX_RATE) bucket = 'watch';
    else bucket = 'ok';

    rows.push({ url: ep.url, sources: ep.sources, kind: ep.kind, label, bucket, skipReason, ...cur });
  }

  const report = render({ rows, changes, targetDate, prevDate, toggles, lineNo });

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(outPath, report);

  // v8.10.5：同时写机器可读汇总（CI 告警步骤读它，避免用正则解析 Markdown —— 那是脆弱的）
  const summaryPath = outPath.replace(/\.md$/i, '') + '.json';
  const summary = {
    date: targetDate,
    prevDate,
    registered: ENDPOINTS.length,
    judged: rows.filter(r => r.bucket !== 'skip').length,
    handle: rows.filter(r => r.bucket === 'handle').map(r => ({
      label: r.label, sources: r.sources, url: r.url, kind: r.kind,
      rate: r.rate, total: r.total, consecutiveFail: r.consecutiveFail, reason: r.lastReason,
    })),
    watch: rows.filter(r => r.bucket === 'watch').map(r => ({ label: r.label, url: r.url, rate: r.rate, total: r.total })),
    changes: changes.map(c => c.text),
  };
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2) + '\n');
  const handle = rows.filter(r => r.bucket === 'handle').length;
  console.log(`✅ 日报已生成: ${outPath}`);
  console.log(`   登记 ${ENDPOINTS.length} 端点 / 参与判定 ${rows.filter(r => r.bucket !== 'skip').length}；需处理 ${handle} 条；今日变化 ${changes.length} 条`);

  // 90 天滚动清理
  const RETENTION_DAYS = 90;
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 864e5);
  const oldFiles = fs.readdirSync(OUT_DIR)
    .filter(f => f.endsWith('.md') && f !== path.basename(outPath))
    .filter(f => {
      const d = new Date(f.replace('.md', ''));
      return !isNaN(d) && d < cutoff;
    });
  for (const f of oldFiles) fs.unlinkSync(path.join(OUT_DIR, f));
  if (oldFiles.length) console.log(`   清理 ${oldFiles.length} 个 ${RETENTION_DAYS} 天前旧日报`);
}

main();
