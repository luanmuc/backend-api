#!/usr/bin/env node
/**
 * 数据保留巡检（只读，不删任何数据）
 *
 * 背景：`docs/probe-history.jsonl` 与 `docs/health-daily/` 只增不删——
 * 前者自 2026-10-28 起每日追加（DEV_GUIDE v28 已记「行数持续增长」），
 * 后者每日一份日报。两者都被排除在 docs-audit 的登记口径之外，
 * 因此体积增长不会触发任何门禁，只能靠人记得。
 *
 * 本脚本把「该不该归档」变成可核验的读数：
 *   1) probe-history.jsonl：按 date 字段统计覆盖天数，超 KEEP_DAYS 则列出可归档区间
 *   2) health-daily/*.md   ：文件数超 KEEP_FILES 则列出最老的可归档日期
 *
 * 用法：
 *   node scripts/check-data-retention.js            # 只报告，恒 exit 0
 *   node scripts/check-data-retention.js --strict   # 有超限项时 exit 1（给 CI 用）
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const HISTORY = path.join(ROOT, "docs", "probe-history.jsonl");
const HEALTH_DIR = path.join(ROOT, "docs", "health-daily");

const KEEP_DAYS = 30;   // probe-history 保留窗口（天）
const KEEP_FILES = 14;  // health-daily 保留份数（每日一份 ≈ 14 天）

const strict = process.argv.includes("--strict");
let over = 0;

// ── 1. probe-history.jsonl ────────────────────────────────────────────────
function checkHistory() {
  if (!fs.existsSync(HISTORY)) {
    console.log("⚪ probe-history.jsonl 不存在，跳过");
    return;
  }
  const raw = fs.readFileSync(HISTORY, "utf8").split("\n").filter(Boolean);
  const dates = new Set();
  let bad = 0;
  for (const line of raw) {
    try {
      const rec = JSON.parse(line);
      if (typeof rec.date === "string") dates.add(rec.date);
    } catch { bad++; }
  }
  const sorted = [...dates].sort();
  const first = sorted[0] || "(空)";
  const last = sorted[sorted.length - 1] || "(空)";
  const days = sorted.length;

  console.log(`probe-history.jsonl：${raw.length} 行 / ${days} 天 / ${first} ~ ${last} / 解析失败 ${bad} 行`);

  if (bad > 0) {
    console.log(`  🔴 有 ${bad} 行不是合法 JSON —— 坏行会污染历史统计，应先修`);
    over++;
  }
  if (days > KEEP_DAYS) {
    const excess = days - KEEP_DAYS;
    const cutoff = sorted[excess - 1]; // 保留窗口之外的最后一天
    console.log(`  🟡 覆盖 ${days} 天 > KEEP_DAYS(${KEEP_DAYS})：建议把 <= ${cutoff} 的记录剪到 docs/archive/probe-history-${first}_${cutoff}.jsonl（本脚本不执行删除）`);
    over++;
  } else {
    console.log(`  🟢 覆盖 ${days} 天 <= KEEP_DAYS(${KEEP_DAYS})，无需归档`);
  }
}

// ── 2. health-daily/ ─────────────────────────────────────────────────────
function checkHealthDaily() {
  if (!fs.existsSync(HEALTH_DIR)) {
    console.log("⚪ health-daily/ 不存在，跳过");
    return;
  }
  const files = fs.readdirSync(HEALTH_DIR).filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f)).sort();
  console.log(`health-daily/：${files.length} 份日报（${files[0] || "-"} ~ ${files[files.length - 1] || "-"}）`);
  if (files.length > KEEP_FILES) {
    const excess = files.length - KEEP_FILES;
    const oldestKept = files[excess];
    console.log(`  🟡 ${files.length} 份 > KEEP_FILES(${KEEP_FILES})：可归档 ${files[0]} ~ ${files[excess - 1]}（${excess} 份）到 docs/archive/health-daily/，保留 ${oldestKept} 起（本脚本不执行移动）`);
    over++;
  } else {
    console.log(`  🟢 ${files.length} 份 <= KEEP_FILES(${KEEP_FILES})，无需归档`);
  }
}

checkHistory();
checkHealthDaily();

console.log(over === 0 ? "\n汇总：无超限项" : `\n汇总：${over} 项超限（本脚本只报告，不删数据）`);
process.exit(strict && over > 0 ? 1 : 0);
