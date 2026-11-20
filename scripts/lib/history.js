'use strict';

/**
 * 巡检历史（docs/probe-history.jsonl）的**单一读写口**。
 *
 * 【为什么要独立成模块】
 * v9.1.4 前的口径断裂：probe.js 写历史时把 `ok` 写成"这一次 HTTP 探测成不成"，
 * 而 payload 二次校验的结果只落在 `payload` 字段。health-daily.js 判定时只看 `ok`
 * → 取链型端点（suyin163 / juheTx / suyinKuwo …）"端点 200 但真实取链失败"这条
 * 最关键的信号，在判定层被完全丢掉。
 *
 * 实测证据（2026-11-20）：同一次巡检，README_HEALTH 记 `suyin163 → PAYLOAD_NO_URL 失败`，
 * 同日 health-daily 日报却写 `suyin163 94.3% 正常`。历史文件里有 90 条
 * `{"ok":true,"payload":false}` 的矛盾记录，全部来自这个缺陷。
 *
 * 【新 schema 语义】
 *   ok        端点级**最终结论** = httpOk && (无 payload 校验 || payload 通过)
 *   httpOk    裸探测结果（HTTP 层）
 *   payload   undefined=该端点不做取链校验 / true=校验通过 / false=校验失败
 *   status    这次 attempt 的 HTTP 状态码（payload 失败时也保留，便于诊断）
 *   reason    端点级原因（payload 失败时是 PAYLOAD_*）
 *   httpReason 裸探测原因（HTTP 层原始原因）
 *
 * 【旧 schema 兼容】
 * 旧记录没有 httpOk / httpReason；`payload:false` 却 `ok:true` 的记录按新语义压成 ok:false。
 * 归一化在**读取时**做，不重写历史文件——历史文件是证据，改它等于篡改。
 *
 * 【口径统一】
 *   successRateByAttempt —— 探测级（每次 attempt 算一次）→ README_HEALTH 与日报**唯一权威口径**
 *   successRateByDay     —— 天级（每天算一次，当天全失败才算失败天）→ 只用于"连续失败天数"
 * 二者都提供，但任何展示给"健康度"的数字一律用探测级，天级只用于连续性判定。
 */
const fs = require('fs');
const path = require('path');

const HIST_DIR = path.join(__dirname, '..', '..', 'docs');
const HIST_FILE = path.join(HIST_DIR, 'probe-history.jsonl');
const RETENTION_DAYS = 30; // 与 probe.js 的历史保留期一致

/** 单条记录归一化；非法记录返回 null（不静默保留脏数据） */
function normalize(raw) {
  if (!raw || typeof raw.url !== 'string' || typeof raw.date !== 'string') return null;
  const e = { ...raw };
  // v9.1.4：没有 httpOk 字段 = 旧口径记录（那时只写裸 HTTP 结果，payload 失败也记 ok:true）。
  // 这批样本的 ok/reason **不可信**：留作证据可以，但不能参与成功率与连续性判定，
  // 否则新口径上线后要背着几天历史包袱（实测 suyin163 今天 payload 已通过，却被 32 条
  // legacy 记录把 7 日成功率拉到 13.5%，直接判「需处理」）。
  if (typeof raw.httpOk !== 'boolean') e.legacy = true;
  if (typeof e.httpOk !== 'boolean') e.httpOk = e.ok === true;
  if (typeof e.httpReason !== 'string') e.httpReason = e.httpOk ? 'OK' : String(e.reason || '');
  // 旧 schema 的硬伤：payload 失败时 ok 仍是 true。按新语义压平。
  if (e.payload === false && e.ok === true) {
    e.ok = false;
    if (!e.reason || e.reason === 'OK') e.reason = 'PAYLOAD_FAILED';
  }
  return e;
}

/** 读全部历史（归一化后）。文件不存在返回空数组。 */
function load() {
  if (!fs.existsSync(HIST_FILE)) return [];
  const out = [];
  let bad = 0;
  for (const line of fs.readFileSync(HIST_FILE, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let raw;
    try { raw = JSON.parse(line); } catch { bad++; continue; }
    const e = normalize(raw);
    if (e) out.push(e); else bad++;
  }
  if (bad) console.warn(`⚠️ 历史文件有 ${bad} 行无法解析，已跳过`);
  return out;
}

/**
 * 原子追加 + 保留期清理。
 * records: 对象数组（已是新 schema 的字段形态）。
 * 返回 { kept, dropped }，供调用方打印。
 */
function append(records) {
  const merged = fs.existsSync(HIST_FILE)
    ? fs.readFileSync(HIST_FILE, 'utf8').split('\n').filter(l => l.trim())
    : [];
  const lines = records.map(r => JSON.stringify(r));
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 864e5).toISOString().slice(0, 10);
  const kept = [];
  for (const line of merged.concat(lines)) {
    try {
      const r = JSON.parse(line);
      if (r && r.date >= cutoff) kept.push(line);
    } catch { kept.push(line); } // 解析失败的行保留（宁可留脏也不丢证据）
  }
  fs.mkdirSync(HIST_DIR, { recursive: true });
  const tmp = HIST_FILE + '.tmp';
  fs.writeFileSync(tmp, kept.join('\n') + '\n');
  fs.renameSync(tmp, HIST_FILE);
  return { kept: kept.length, dropped: merged.length + lines.length - kept.length };
}

/** 目标日往前 windowDays 天的日历日序列（含目标日） */
function dateWindow(baseDate, windowDays) {
  const out = [];
  for (let i = windowDays - 1; i >= 0; i--) {
    const d = new Date(baseDate + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function wilsonLower(k, n, z = 1.96) {
  if (!n) return 0;
  const p = k / n;
  const denom = 1 + (z * z) / n;
  const centre = p + (z * z) / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return Math.max(0, (centre - margin) / denom);
}

/** 某端点自己上一次有数据的日期（严格早于 targetDate）；无则 null */
function prevDataDate(entries, url, targetDate) {
  let best = null;
  for (const e of entries) {
    if (e.url !== url || e.date >= targetDate) continue;
    if (best === null || e.date > best) best = e.date;
  }
  return best;
}

/**
 * 全历史**连续失败天数**（不受统计窗口限制）。
 * 旧实现从 7 天窗口里数，最大只能数到 7 —— 与"连续 7 天未恢复"告警阈值刚好卡死，
 * 无法区分"刚好 7 天"和"已经挂了 20 天"。
 * 失败天定义：当天该端点至少 1 条记录、且全部 ok=false。
 */
function consecutiveFailDays(entries, url, targetDate) {
  const byDate = new Map();
  for (const e of entries) {
    if (e.url !== url || e.date > targetDate) continue;
    if (e.legacy) continue; // 旧口径的 ok 不可信，见 normalize 注释
    if (!byDate.has(e.date)) byDate.set(e.date, { total: 0, ok: 0 });
    const d = byDate.get(e.date);
    d.total++;
    if (e.ok) d.ok++;
  }
  if (!byDate.size) return 0;
  const dates = [...byDate.keys()].sort();
  let streak = 0;
  for (let i = dates.length - 1; i >= 0; i--) {
    const d = byDate.get(dates[i]);
    if (d.total > 0 && d.ok === 0) streak++;
    else break;
    // 允许窗口内最后一天就是 targetDate 之前的空档？不——空档不等同失败，
    // 循环遇到有数据但非全失败的天即停，语义与旧实现一致（只看连续有数据的天）。
  }
  return streak;
}

/**
 * 某端点在 baseDate 往前 windowDays 天的统计（单一真相版本）。
 * 复刻 v8.10.7（T6）之后的日历日窗口语义，并在此集中实现，probe 与 health-daily 共用。
 */
function windowStats(entries, url, baseDate, windowDays) {
  const win = dateWindow(baseDate, windowDays);
  const recs = entries.filter(e => e.url === url && win.includes(e.date));
  if (!recs.length) return null;

  // v9.1.4：legacy（旧口径）记录只留作证据，不进任何统计。它们的 ok 记录的是"裸 HTTP 成不成"，
  // payload 失败也写 ok:true，混进来算成功率只会得到自相矛盾的结论。
  const legacyRecs = recs.filter(r => r.legacy);
  const trusted = recs.filter(r => !r.legacy);
  if (!trusted.length) return null; // 窗口内只有旧口径样本 = 对新口径而言没有有效样本

  const total = trusted.length;
  const success = trusted.filter(r => r.ok).length;
  const rate = Math.round((success / total) * 1000) / 10;
  const wilsonLow = Math.round(wilsonLower(success, total) * 1000) / 10;

  // 天级视图（只用于连续性）
  const byDate = {};
  for (const r of trusted) {
    if (!byDate[r.date]) byDate[r.date] = { total: 0, ok: 0, fail: 0 };
    byDate[r.date].total++;
    if (r.ok) byDate[r.date].ok++; else byDate[r.date].fail++;
  }
  const sorted = Object.keys(byDate).sort();
  let consecutiveFail = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (byDate[sorted[i]].ok === 0) consecutiveFail++;
    else break;
  }

  const latest = trusted.filter(e => e.date === baseDate);
  const winDates = [...new Set(trusted.map(r => r.date))].sort();
  const last = latest.length ? latest[latest.length - 1] : null;
  return {
    total, success, rate, rateRaw: rate, // rateRaw = 点估计（历史对比用），判定看 wilsonLow
    wilsonLow, consecutiveFail,
    todayCount: latest.length,
    lastDate: winDates.length ? winDates[winDates.length - 1] : null,
    avgTime: Math.round(trusted.reduce((s, r) => s + (r.time || 0), 0) / total),
    lastOk: last ? last.ok : null,
    lastStatus: last ? last.status : 0,
    lastReason: last ? last.reason : '',
    lastHttpOk: last ? last.httpOk : null,
    // 最新一条是否"仅试听"——fragment 是独立字段（reason 仍可能是裸探测的 OK），不能靠 reason 猜
    lastFragment: !!(last && last.fragment),
    lastDur: last ? (last.dur ?? null) : null,
    // 窗口内 payload 失败次数 —— 让日报能区分"HTTP 挂了"与"取链挂了"
    payloadFail: trusted.filter(r => r.payload === false).length,
    reasons: [...new Set(trusted.filter(r => !r.ok).map(r => r.reason))],
    // 天级：可用天 / 有数据天（给"连续失败"配套展示，不作为健康度主口径）
    dayTotal: sorted.length,
    dayOk: sorted.filter(d => byDate[d].ok > 0).length,
    // 被排除的旧口径样本数——展示层要注明，不能静默丢
    legacyCount: legacyRecs.length,
  };
}

/** 天级聚合（历史总览用；健康度主口径请用 windowStats 的探测级 rate） */
function dailyAggregate(entries, days) {
  const cutoff = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
  const byUrl = {};
  for (const e of entries) {
    if (e.date < cutoff) continue;
    byUrl[e.url] = byUrl[e.url] || {};
    byUrl[e.url][e.date] = byUrl[e.url][e.date] || { total: 0, ok: 0 };
    byUrl[e.url][e.date].total++;
    if (e.ok) byUrl[e.url][e.date].ok++;
  }
  const stats = {};
  for (const [url, daysMap] of Object.entries(byUrl)) {
    const dates = Object.keys(daysMap).sort();
    let okDay = 0;
    for (const d of dates) if (daysMap[d].ok > 0) okDay++;
    stats[url] = { days: dates.length, okDay, rate: dates.length ? okDay / dates.length : 1 };
  }
  return stats;
}

module.exports = {
  HIST_FILE, HIST_DIR, RETENTION_DAYS,
  normalize, load, append,
  dateWindow, wilsonLower,
  prevDataDate, consecutiveFailDays, windowStats, dailyAggregate,
};
