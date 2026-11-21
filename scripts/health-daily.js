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
const { ENDPOINTS, WINDOW_DAYS, CONSECUTIVE_FAIL_DAYS } = require('./endpoint-registry.js');
// v8.10.5：开关解析抽成独立模块（probe 也要用：README_HEALTH 只对启用源出死源建议）
const { parseToggles } = require('./source-toggles.js');
const { todayCN } = require('./cn-date.js'); // v8.10.6：默认日期改北京（原 toISOString 是 UTC，本地 0~8 点会拿到昨天）
const history = require('./lib/history.js'); // v9.1.4：历史读取/归一化/窗口统计的单一真相

const SRC = path.join(__dirname, '..', 'lx-source.js');
const OUT_DIR = path.join(__dirname, '..', 'docs', 'health-daily');

const MAX_FAIL_RATE = 50; // 故障率上限(%)：超过即需处理（v8.10.5 改名，原名 FAIL_RATE_THRESHOLD 语义反向，易被误改成 <50）
const OBSERVE_MAX_RATE = 80; // 50%~80% 归入「观察」
// v8.10.10：403/429 多半是巡检**出口 IP**（GitHub Actions 海外）被地区/风控拦截，不代表用户不可用
// → 先降级「观察」；但设自动升级阈值，防止真挂了的 403 被永久降级而漏报
const GEO_BLOCK_ESCALATE_DAYS = 5; // 403 类连续失败满 5 天 → 回升「需处理」
const GEO_BLOCK_MIN_RATE = 20;     // 成功率 < 20%（样本 ≥ SMALL_SAMPLE）→ 回升「需处理」
const isGeoBlocked = st => st.lastStatus === 403 || st.lastStatus === 429;
const SMALL_SAMPLE = 20; // 样本 <20 时成功率仅作趋势参考
// v8.17：Wilson 95% 下限——点估计在 n≈10 时没有判别力（70% 的区间约 40%~90%）。
// 「正常」必须由下限支撑：下限 <60% 只能算观察，不能算正常。
const WILSON_OK_MIN = 60;
const CHANGE_PP_THRESHOLD = 30; // 窗口成功率变化超过 30 个百分点算突变

// ---------- 启用状态：统一由 scripts/source-toggles.js 解析（v8.10.5） ----------

// ---------- 历史聚合：v9.1.4 起全部委托 scripts/lib/history.js ----------
// 旧实现本文件里另有一份 loadHistory/wilsonLower/windowStats/prevDataDate，
// 与 probe.js 的 aggregateHistory 口径不同（探测级 vs 天级），
// 同一个端点同一天会出现两个不同的"成功率"。
// 这里只保留薄封装维持原有调用签名；实现、归一化、Wilson 计算都只有一份。
const loadHistory = () => history.load();
const windowStats = (entries, url, baseDate) => history.windowStats(entries, url, baseDate, WINDOW_DAYS);
const prevDataDate = history.prevDataDate;

function labelOf(ep) {
  return ep.sources && ep.sources.length ? ep.sources.join('/') : (ep.label || ep.url.slice(0, 40));
}

/** v8.10.5：来自网络的 reason/url 可能含换行与竖线，直接拼进 Markdown 会破结构（V4/V25） */
function clean(s) {
  return String(s == null ? '' : s).replace(/[\r\n]+/g, ' ').replace(/\|/g, '\\|');
}

// ---------- 渲染 ----------
function render({ rows, changes, targetDate, prevDateLabel, lineNo, dataThrough, gapDays, chainSample, deviceDigest }) {
  const L = [];
  L.push(`# 健康日报 ${targetDate}`);
  L.push('');
  L.push('> **能回答什么**：端点还活不活着、成功率有没有突变、哪个源刚变坏（有连续日序列）。');
  L.push('> **不能回答什么**：这源现在能不能出链接——那归 `node scripts/source-audit.js`（逐源真实取链，按需跑）。');
  L.push('> **判定口径**：仅**启用中**的源参与判定；`param` 类端点（真实调用带参、裸探测恒 4xx）不参与；`payload` 类已做真实取链 + Range 校验。');
  L.push(`> **样本警示**：样本 <${SMALL_SAMPLE} 时成功率只作趋势参考；样本不足且未连续 ${CONSECUTIVE_FAIL_DAYS} 天全失败的，**一律不进「需处理」**。`);
  L.push('> **巡检出口**：探测跑在 GitHub Actions（海外 IP）。`403`/`429` 多见于地区或风控拦截，**不等同于用户手机不可用**，故先归「观察」。');
  L.push(`> **今日未探测**：当天没有任何探测样本的端点不参与判定（\`--date\` 对应日无数据时不拿窗口旧数据顶替）。`);
  // v9.1.4：旧口径样本被整体剔除后样本数会突然变小，不解释就是"巡检退化"的假象。
  const legacyTotal = rows.reduce((s, r) => s + (r.legacyCount || 0), 0);
  if (legacyTotal) {
    L.push(`> **历史口径断层**：本窗口另有 ${legacyTotal} 条 2026-11-20 前由旧版探针写入的记录——它们只记裸 HTTP 结果，payload 失败也记为成功，已整体标记 \`legacy\` 且**不参与**成功率与连续性统计。有效样本因此暂时偏小，属于口径切换的正常过渡：每天新增约 ${ENDPOINTS.length} 条新口径记录，7 天后自然恢复。`);
  }
  L.push('');
  if (gapDays > 0) {
    L.push(`> ⚠️ **数据断档**：${targetDate} 无探测数据，最近一次数据是 **${dataThrough}**（已 ${gapDays} 天未探测）。下面所有判定基于窗口内历史，**不代表今日状态**。`);
    L.push('');
  }
  L.push(`> 对比基准：${prevDateLabel || '无（历史不足）'} → ${targetDate}`);
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
  // 工具端点（无 sources）不进「需处理」表——它没有 SOURCE_TOGGLES 可关，动作列无从下笔
  const handle = rows.filter(r => r.bucket === 'handle' && r.sources && r.sources.length);
  L.push('## 需处理（启用源）');
  L.push('');
  if (!handle.length) {
    L.push('无。启用中的源没有达到告警阈值。');
  } else {
    L.push('| 源 | 端点 | 样本 | 成功率 | 95%下限 | 连续失败 | 最近原因 | 动作 |');
    L.push('|---|---|---|---|---|---|---|---|');
    for (const r of handle) {
      const ids = r.sources.join('/');
      const act = r.kind === 'payload'
        ? `先跑 \`node scripts/source-audit.js\` 确认取链，再决定 \`SOURCE_TOGGLES.${r.sources[0]}: true → false\`（lx-source.js:${lineNo[r.sources[0]] || '?'}）`
        : `改 \`SOURCE_TOGGLES.${r.sources[0]}: true → false\`（lx-source.js:${lineNo[r.sources[0]] || '?'}）`;
      L.push(`| ${clean(ids)} | \`${clean(r.url).slice(0, 46)}\` | ${r.total} | ${r.rate}% | ${r.wilsonLow}% | ${r.consecutiveFail} 天 | ${clean(r.lastReason) || '-'} | ${act} |`);
    }
  }
  L.push('');

  // 观察（v9.1.4：与「正常」同规则，只列**源**端点，工具端点统一走表后脚注）
  const watchAll = rows.filter(r => r.bucket === 'watch');
  const watch = watchAll.filter(r => r.sources && r.sources.length);
  const watchTools = watchAll.filter(r => !r.sources || !r.sources.length);
  L.push('## 观察（启用源，暂不动作）');
  L.push('');
  if (!watch.length) {
    L.push('无。');
  } else {
    L.push('| 源 | 端点 | 样本 | 成功率 | 95%下限 | 连续失败 | 备注 |');
    L.push('|---|---|---|---|---|---|---|');
    for (const r of watch) {
      const note = r.lastStatus === 403 || r.lastStatus === 429
        ? `疑似出口 IP/风控拦截（${r.lastStatus}），非必然用户不可用；连续失败满 ${GEO_BLOCK_ESCALATE_DAYS} 天或成功率 <${GEO_BLOCK_MIN_RATE}% 会自动升级`
        : (r.total < SMALL_SAMPLE ? '样本偏小，需继续累计' : '未达告警阈值');
      L.push(`| ${clean(r.label)} | \`${clean(r.url).slice(0, 46)}\` | ${r.total} | ${r.rate}% | ${r.wilsonLow}% | ${r.consecutiveFail} 天 | ${note} |`);
    }
  }
  if (watchTools.length) {
    L.push('');
    L.push(`> 另有 ${watchTools.length} 个工具类端点（非音源，仅提供搜索/歌词等能力）处于观察：${watchTools.map(r => `\`${clean(r.url).slice(0, 34)}\`（${r.rate}%，${r.total} 样本）`).join('、')}。`);
  }
  L.push('');

  // 仅试听（能力受限）——v9.1.4：片段由音源本体验真拦截，用户听不到，故不算故障
  const limited = rows.filter(r => r.bucket === 'limited');
  L.push('## 仅试听（能力受限，不影响用户）');
  L.push('');
  if (!limited.length) {
    L.push('无。');
  } else {
    L.push('> 这些源对探测歌只返回试听片段。音源本体的交付验真（`src/core/15-verify.js` 的 `PREVIEW_FRAGMENT` + 3KB/s 体积下界）会**拦截该结果并继续换源**，用户不会听到片段；本段只记录能力边界，不参与「需处理」告警。');
    L.push('');
    L.push('| 源 | 端点 | 样本 | 成功率 | 95%下限 | 最近原因 |');
    L.push('|---|---|---|---|---|---|');
    for (const r of limited) {
      const durCell = r.lastDur ? `仅试听 ${r.lastDur}s` : '仅试听片段';
      L.push(`| ${clean((r.sources || []).join('/') || r.label)} | \`${clean(r.url).slice(0, 46)}\` | ${r.total} | ${r.rate}% | ${r.wilsonLow}% | ${durCell} |`);
    }
  }
  L.push('');

  // 正常（v9.1.4：只列**源**端点）
  // 旧实现把 wyLyric / wyDetail / kuwoSearch 三个工具端点也算进"正常"，
  // 读者会以为"有 8 个源健康"，实际其中 3 个根本不是音源，与播放可用性无关。
  const okRows = rows.filter(r => r.bucket === 'ok');
  const okSources = okRows.filter(r => r.sources && r.sources.length);
  const okTools = okRows.filter(r => !r.sources || !r.sources.length);
  L.push('## 正常');
  L.push('');
  L.push(okSources.length
    ? okSources.map(r => `\`${clean(r.url).slice(0, 42)}\`（${clean(r.label)} ${r.rate}%，下限 ${r.wilsonLow}%，${r.total} 样本）`).join('、')
    : '无。');
  if (okTools.length) {
    L.push('');
    L.push(`> 另有 ${okTools.length} 个工具类端点（非音源，仅提供搜索/歌词等能力）存活：${okTools.map(r => `\`${clean(r.url).slice(0, 36)}\``).join('、')}。`);
  }
  L.push('');

  // v8.17：出链抽样（真实取链）——补「端点活着 ≠ 能出链」的缺口
  L.push('## 出链抽样（真实取链，启用源各 1 首）');
  L.push('');
  if (!chainSample) {
    L.push('今日无抽样记录（`node scripts/chain-sample.js` 未运行或失败）。');
  } else {
    L.push(`> ${chainSample.date}：${chainSample.ok}/${chainSample.total} 个启用源能出链。失败项先跑 \`node scripts/source-audit.js --only=<平台>\` 复核。`);
    L.push('');
    L.push('| 源 | 平台 | 结果 | 码 | 可播校验 | 耗时 |');
    L.push('|---|---|---|---|---|---|');
    for (const r of chainSample.rows) {
      L.push(`| ${clean(r.src)} | ${clean(r.plat)} | ${r.ok ? '✅' : '❌'} | ${clean(r.code)} | ${clean(r.playable || '-')} | ${r.ms}ms |`);
    }
  }
  L.push('');

  // v8.17 阶段 4：真机上报 vs CI 探测对照（两端口径不同，只做差值提示，不做判定）
  L.push('## 真机对照（设备上报）');
  L.push('');
  if (!deviceDigest) {
    L.push('今日无真机摘要（App 未上报或拉取失败）。');
  } else {
    L.push(`> ${deviceDigest.devices} 台设备上报；探测 ${deviceDigest.probe.ok}/${deviceDigest.probe.total}，播放 ${deviceDigest.play.ok}/${deviceDigest.play.total}。`);
    L.push('');
    const diffs = [];
    for (const r of rows) {
      if (!r.sources || !r.sources.length) continue;
      const src = r.sources[0];
      const dv = deviceDigest.bySource[src];
      if (!dv || !dv.total) continue;
      const diff = Math.round((dv.rate - r.rate) * 10) / 10;
      if (Math.abs(diff) >= 10) diffs.push(`| ${clean(src)} | ${r.rate}% | ${dv.rate}% | ${diff > 0 ? '+' : ''}${diff} |`);
    }
    if (diffs.length) {
      L.push('| 源 | CI 7 日 | 真机 24h | 差 |');
      L.push('|---|---|---|---|');
      L.push(...diffs);
    } else {
      L.push('CI 与真机成功率差均在 ±10 个百分点内（或无可对齐的源）。');
    }
  }
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
        L.push(`- \`${clean(r.url).slice(0, 50)}\`（${clean(r.label)}）：真实调用需带参，裸探测 404 属正常，不参与判定`);
      } else if (r.skipReason === 'no-today') {
        L.push(`- \`${clean(r.url).slice(0, 50)}\`（${clean(r.label)}）：**今日未探测**（窗口内最近数据 ${r.lastDate || '—'}），不作今日判定`);
      } else {
        L.push(`- \`${clean(r.url).slice(0, 50)}\`（${clean(r.label)}）：源已关闭（\`SOURCE_TOGGLES=false\`），静默不告警`);
      }
    }
  }
  L.push('');
  L.push('---');
  L.push('');
  const noToday = rows.filter(r => r.skipReason === 'no-today').length;
  L.push(`参与判定 ${rows.filter(r => r.bucket !== 'skip').length} 个端点 / 登记 ${ENDPOINTS.length} 个；今日未探测 ${noToday} 个；需处理 ${handle.length} 条；今日变化 ${changes.length} 条。`);
  if (noToday) L.push('');
  if (noToday) L.push(`> ${noToday} 个端点当天没有探测样本（probe 未跑到或当天未运行），它们的真实状态**未知**，不是"正常"。`);
  L.push('');
  return L.join('\n');
}

// ---------- 主流程 ----------
// v8.17：读取当日出链抽样（chain-sample.js 产物）
function loadChainSample(date) {
  const p = path.join(__dirname, '..', 'docs', 'chain-sample.jsonl');
  if (!fs.existsSync(p)) return null;
  const rows = [];
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try { const r = JSON.parse(line); if (r.date === date) rows.push(r); } catch {}
  }
  if (!rows.length) return null;
  return { date, total: rows.length, ok: rows.filter(r => r.ok).length, rows };
}

// v8.17：读取真机摘要（pull-device-digests.js 产物），按目标日聚合
function loadDeviceDigests(date) {
  const p = path.join(__dirname, '..', 'docs', 'device-digests.jsonl');
  if (!fs.existsSync(p)) return null;
  const byDevice = [];
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const r = JSON.parse(line);
      if (r.date === date) byDevice.push(r);
    } catch {}
  }
  if (!byDevice.length) return null;
  const agg = {}, aggPlay = {}, aggQ = {};
  const versions = new Set();
  let probeTotal = 0, probeOk = 0, playTotal = 0, playOk = 0;
  for (const r of byDevice) {
    const d = r.digest || {};
    probeTotal += (d.probe && d.probe.total) || 0;
    probeOk += (d.probe && d.probe.ok) || 0;
    playTotal += (d.play && d.play.total) || 0;
    playOk += (d.play && d.play.ok) || 0;
    for (const [src, v] of Object.entries((d.probe && d.probe.by_source) || {})) {
      agg[src] = agg[src] || { total: 0, ok: 0 };
      agg[src].total += v.total || 0;
      agg[src].ok += v.ok || 0;
    }
    // 播放侧源维度此前从未被汇总（只加了 probe），导致「放不出来」时看不出是哪个源
    for (const [src, v] of Object.entries((d.play && d.play.by_source) || {})) {
      aggPlay[src] = aggPlay[src] || { total: 0, ok: 0 };
      aggPlay[src].total += v.total || 0;
      aggPlay[src].ok += v.ok || 0;
    }
    // 旧包（b195 之前）没有 by_quality：只跳过、不补零，避免把「无音质信息」算成失败
    for (const [q, v] of Object.entries((d.probe && d.probe.by_quality) || {})) {
      aggQ[q] = aggQ[q] || { total: 0, ok: 0 };
      aggQ[q].total += v.total || 0;
      aggQ[q].ok += v.ok || 0;
    }
    if (d.source && d.source.version) versions.add(String(d.source.version));
  }
  const withRate = obj => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, {
    total: v.total,
    ok: v.ok,
    rate: v.total ? Math.round((v.ok / v.total) * 1000) / 10 : 0,
  }]));
  return {
    date,
    devices: [...new Set(byDevice.map(r => r.device))].length,
    probe: { total: probeTotal, ok: probeOk },
    play: { total: playTotal, ok: playOk, bySource: withRate(aggPlay) },
    bySource: withRate(agg),
    byQuality: withRate(aggQ),
    sourceVersions: [...versions].sort(),
  };
}

function main() {
  const args = process.argv.slice(2);
  const dateIdx = args.indexOf('--date');
  const outIdx = args.indexOf('--out');
  // v8.10.6（F01 残留）：默认日期取**北京日期**。原 toISOString().slice(0,10) 是 UTC，
  // 本地直接跑时北京 0~8 点会拿到"昨天"（CI 显式传 --date 才没暴露）
  const targetDate = dateIdx >= 0 ? args[dateIdx + 1] : todayCN();
  const outPath = outIdx >= 0 ? args[outIdx + 1] : path.join(OUT_DIR, `${targetDate}.md`);

  const entries = loadHistory();
  if (!entries.length) { console.error('probe-history.jsonl 无数据'); process.exit(1); }

  const { toggles, lineNo } = parseToggles();

  // v8.10.6（T7）：变化检测基准改为**按端点各取**自己上一有数据日（原为全局倒数第二天）
  // allDates / dataThrough / gapDays 仍用全局——它们描述的是"整体探测有没有断档"，与单端点无关
  const allDates = [...new Set(entries.map(e => e.date))].filter(d => d <= targetDate).sort();
  const prevDates = new Map();
  for (const ep of ENDPOINTS) prevDates.set(ep.url, prevDataDate(entries, ep.url, targetDate));
  const prevSet = [...new Set([...prevDates.values()].filter(Boolean))].sort();
  const prevDateLabel = prevSet.length === 0 ? null
    : prevSet.length === 1 ? prevSet[0]
    : `各端点各自基准（最早 ${prevSet[0]} ~ 最晚 ${prevSet[prevSet.length - 1]}）`;
  // v8.10.5：断档显式化——目标日与最近有数据日差几天，报告首屏必须说明（V28）
  const dataThrough = allDates.length ? allDates[allDates.length - 1] : null;
  const gapDays = dataThrough
    ? Math.round((new Date(targetDate + 'T00:00:00Z') - new Date(dataThrough + 'T00:00:00Z')) / 864e5)
    : 0;

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
    const pDate = prevDates.get(ep.url); // v8.10.6：用该端点自己的上一有数据日作基准
    if (pDate && enabled) {
      const prev = windowStats(entries, ep.url, pDate);
      if (prev) {
        const flip = prev.lastOk === true && cur.lastOk === false;
        const recover = prev.lastOk === false && cur.lastOk === true;
        const delta = Math.round((cur.rate - prev.rate) * 10) / 10;
        if (flip) {
          changes.push({ text: `🔴 **${clean(labelOf(ep))}**：${pDate} 可用 → ${targetDate} **失败**（${clean(cur.lastReason) || '-'}）` });
        } else if (recover) {
          changes.push({ text: `🟢 **${clean(labelOf(ep))}**：${pDate} 失败 → ${targetDate} **恢复**` });
        } else if (Math.abs(delta) >= CHANGE_PP_THRESHOLD) {
          changes.push({ text: `${delta < 0 ? '🟡' : '🟢'} **${clean(labelOf(ep))}**：窗口成功率 ${prev.rate}% → ${cur.rate}%（${delta > 0 ? '+' : ''}${delta}pp，基准 ${pDate}）` });
        }
      }
    }

    // 分级
    const label = labelOf(ep);
    let bucket;
    let skipReason;
    if (ep.kind === 'param') { bucket = 'skip'; skipReason = 'param'; }
    else if (!enabled) { bucket = 'skip'; skipReason = 'disabled'; }
    // ① 今日无样本 → 不得用窗口旧数据冒充"今日判定"（V2）
    else if (cur.todayCount === 0) { bucket = 'skip'; skipReason = 'no-today'; }
    // ②.1 仅试听 = 能力受限，不是故障（v9.1.4，2026-11-20 用户口径）。
    // 音源本体的交付验真（src/core/15-verify.js 的 PREVIEW_FRAGMENT + 3KB/s 体积下界）
    // 会拦下片段并继续换源，用户根本听不到；这里单列「仅试听」，不进「需处理」。
    else if (cur.lastFragment && cur.lastOk === true) { bucket = 'limited'; }
    // ② 小样本不得进 handle，除非已连续 3 天全失败（那说明真坏，不是抖动）（V18）
    else if (cur.total < SMALL_SAMPLE && cur.consecutiveFail < CONSECUTIVE_FAIL_DAYS)
      bucket = (cur.rate < OBSERVE_MAX_RATE || cur.wilsonLow < WILSON_OK_MIN) ? 'watch' : 'ok';
    // ②.5 403/429 先归「观察」——可能是巡检出口被拦，不是用户手机不可用（v8.10.10）。
    // 但连续失败满 GEO_BLOCK_ESCALATE_DAYS 天、或成功率低于 GEO_BLOCK_MIN_RATE（样本充足），仍回升「需处理」。
    else if (isGeoBlocked(cur)
      && cur.consecutiveFail < GEO_BLOCK_ESCALATE_DAYS
      && !(cur.total >= SMALL_SAMPLE && cur.rate < GEO_BLOCK_MIN_RATE))
      bucket = 'watch';
    // ③ 正式阈值：连续 3 天全失败，或故障率超上限
    else if (cur.consecutiveFail >= CONSECUTIVE_FAIL_DAYS || cur.rate < (100 - MAX_FAIL_RATE)) bucket = 'handle';
    // v8.17：点估计达标但置信下限不足 → 只能算观察（n≈10 时 80% 的下限约 49%）
    else if (cur.rate < OBSERVE_MAX_RATE || cur.wilsonLow < WILSON_OK_MIN) bucket = 'watch';
    else bucket = 'ok';

    // v9.1.4：连续失败天数同时给「窗口内」（判定用）与「全历史」（告警升级用）。
    // 窗口只有 7 天，cur.consecutiveFail 最大只能是 7 —— 与 CI 的 escalated 阈值 7 刚好卡死，
    // 永远无法表达"已经连续挂了 20 天"。全历史值单独给一个字段。
    const consecutiveFailAll = history.consecutiveFailDays(entries, ep.url, targetDate);
    rows.push({ url: ep.url, sources: ep.sources, kind: ep.kind, label, bucket, skipReason, consecutiveFailAll, ...cur });
  }

  const chainSample = loadChainSample(targetDate);
  const deviceDigest = loadDeviceDigests(targetDate);
  const report = render({ rows, changes, targetDate, prevDateLabel, lineNo, dataThrough, gapDays, chainSample, deviceDigest });

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(outPath, report);

  // v8.10.5：同时写机器可读汇总（CI 告警步骤读它，避免用正则解析 Markdown —— 那是脆弱的）
  const summaryPath = outPath.replace(/\.md$/i, '') + '.json';
  const summary = {
    date: targetDate,
    chainSample, // v8.17：真实取链抽样（null = 今日未跑）
    deviceDigest, // v8.17：真机摘要聚合（null = 今日无）
    // v8.10.6（T7）：基准日按端点各算；全局字段保留兼容（各端点一致时给该日期，否则 null）
    prevDate: prevSet.length === 1 ? prevSet[0] : null,
    prevDateMode: prevSet.length <= 1 ? 'uniform' : 'per-endpoint',
    prevDates: Object.fromEntries(prevDates),
    registered: ENDPOINTS.length,
    judged: rows.filter(r => r.bucket !== 'skip').length,
    handle: rows.filter(r => r.bucket === 'handle' && r.sources && r.sources.length).map(r => ({
      label: r.label, sources: r.sources, url: r.url, kind: r.kind,
      // rate 与 rateRaw 同值：前者是展示口径，后者是历史对比口径（G15 双口径守卫要求两者都在）
      rate: r.rate, rateRaw: r.rateRaw, total: r.total, consecutiveFail: r.consecutiveFail,
      // v9.1.4：全历史连续失败天数（不受 7 天窗口限制），CI 的 escalated 判据读这个
      consecutiveFailAll: r.consecutiveFailAll,
      reason: r.lastReason,
    })),
    watch: rows.filter(r => r.bucket === 'watch' && r.sources && r.sources.length).map(r => ({ label: r.label, url: r.url, rate: r.rate, total: r.total })),
    // v9.1.4：仅试听单列（能力受限，不是故障）
    limited: rows.filter(r => r.bucket === 'limited').map(r => ({ label: r.label, url: r.url, sources: r.sources, rate: r.rate, total: r.total })),
    // v8.11：交付片段（能播但只有几秒）单独暴露——它不会被"可用率"暴露，
    // 因为片段在端点层是 100% 绿色的 206；不单列就等于巡检对用户真实听感失明
    fragment: rows.filter(r => String(r.lastReason || '').includes('PAYLOAD_FRAGMENT')).map(r => ({ label: r.label, url: r.url, sources: r.sources })),
    changes: changes.map(c => c.text),
  };
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2) + '\n');
  const handle = rows.filter(r => r.bucket === 'handle' && r.sources && r.sources.length).length;
  console.log(`✅ 日报已生成: ${outPath}`);
  console.log(`   登记 ${ENDPOINTS.length} 端点 / 参与判定 ${rows.filter(r => r.bucket !== 'skip').length}；需处理 ${handle} 条；今日变化 ${changes.length} 条`);

  // 90 天滚动清理
  const RETENTION_DAYS = 90;
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 864e5);
  const keepBase = path.basename(outPath).replace(/\.md$/, '');
  const oldFiles = fs.readdirSync(OUT_DIR)
    .filter(f => /\.(md|json)$/.test(f))
    .filter(f => f.replace(/\.(md|json)$/, '') !== keepBase)
    .filter(f => {
      const d = new Date(f.replace(/\.(md|json)$/, ''));
      return !isNaN(d) && d < cutoff;
    });
  for (const f of oldFiles) fs.unlinkSync(path.join(OUT_DIR, f));
  if (oldFiles.length) console.log(`   清理 ${oldFiles.length} 个 ${RETENTION_DAYS} 天前旧日报`);
}

// 只有直接运行才生成日报；被 require 时不得写文件、不得 exit（否则会静默杀掉调用方）。
if (require.main === module) main();
module.exports = { main, windowStats, prevDataDate, render };
