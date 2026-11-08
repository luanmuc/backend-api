#!/usr/bin/env node
/**
 * v8.10.5 巡检告警正文生成器。
 *
 * 读 health-daily 输出的机器可读汇总（<date>.json），生成 GitHub Issue 正文。
 * 「需处理」为空时输出空内容并退出 0 —— CI 侧据此判断是否要开 Issue，避免无意义刷屏。
 *
 * 用法：node scripts/health-alert.js docs/health-daily/2026-11-08.json
 */
const fs = require('fs');

const p = process.argv[2];
// v8.10.5：缺参数/文件不存在**不是"无需告警"**，而是异常（当日日报没生成）。
// 旧实现 exit 0 静默，叠加 CI 的 `|| true` 会让"日报没生成"整条链路无任何信号（V5/V23）。
function clean(s) { return String(s == null ? '' : s).replace(/[\r\n]+/g, ' ').replace(/\|/g, '\\|'); }
if (!p) { console.error('用法: node scripts/health-alert.js <health-daily/YYYY-MM-DD.json>'); process.exit(1); }
if (!fs.existsSync(p)) {
  console.error(`汇总文件不存在: ${p} —— 当日 health-daily 很可能没跑成功（这是异常，不是"无需告警"）`);
  process.exit(1);
}

let d;
try {
  d = JSON.parse(fs.readFileSync(p, 'utf8'));
} catch (e) {
  console.error(`汇总文件解析失败: ${e.message}`);
  process.exit(1);
}
// 结构校验：handle 必须是数组；否则是生成器出问题，不能照常发告警（旧实现会输出一堆 undefined 并建垃圾 Issue）
if (!Array.isArray(d.handle)) {
  console.error(`汇总结构异常：handle 不是数组（实际 ${typeof d.handle}），拒绝生成告警`);
  process.exit(1);
}
if (!d.handle.length) process.exit(0);

const L = [];
L.push(`# 巡检告警 ${clean(d.date) || '(日期缺失)'}`);
L.push('');
L.push('> 由每日端点巡检自动生成。只对**启用中**的源告警；已关闭源与 `param` 类端点不参与判定。');
L.push('> 本告警回答"端点还活不活着"，能不能真出链需 `node scripts/source-audit.js` 复核。');
L.push('');
L.push(`## 需处理 ${d.handle.length} 条`);
L.push('');
for (const h of d.handle) {
  const id = h.sources && h.sources.length ? h.sources[0] : h.label;
  L.push(`- **${clean(h.label)}**：成功率 ${h.rate}%（${h.total} 样本），连续失败 ${h.consecutiveFail} 天`);
  L.push(`  - 端点：\`${clean(h.url).slice(0, 90)}\``);
  L.push(`  - 最近原因：${clean(h.reason) || '-'}`);
  if (h.kind === 'payload') {
    L.push(`  - 动作：先跑 \`node scripts/source-audit.js\` 确认取链，再决定 \`SOURCE_TOGGLES.${id}: true → false\``);
  } else {
    L.push(`  - 动作：改 \`SOURCE_TOGGLES.${id}: true → false\``);
  }
}
L.push('');
L.push('## 今日变化');
L.push('');
if (d.changes && d.changes.length) {
  for (const c of d.changes) L.push(`- ${c}`);
} else {
  L.push('无');
}
L.push('');
L.push(`完整日报：\`docs/health-daily/${d.date}.md\``);
L.push('');
console.log(L.join('\n'));
