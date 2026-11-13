#!/usr/bin/env node
/**
 * v5.0 发布前自检门（L2）：
 *   1. @version 与 logInfo「豆包定制聚合音源 vX.Y」同步（App 内置升级正则依赖，b38 教训）
 *   2. sourceConfig 各平台 actions 声明齐全（health/toggle/probe 全平台，lyric/pic 按平台）
 *   3. README 版本历史存在当前版本条目
 *   4. ROADMAP 当前版本迭代已标 [x]（防止提交未完成版本；挂起项标注外部依赖可存在）
 * 任一失败 → 进程退出码 1 → CI 阻断发布
 */
const fs = require('fs');
const path = require('path');

let failed = false;
const fail = (msg) => { failed = true; console.error('[自检失败] ' + msg); };

const srcPath = path.join(__dirname, '..', 'src', 'legacy.js'); // 静态实现源；发布产物由 build-source.js 生成
const readmePath = path.join(__dirname, '..', 'README.md');
const roadmapPath = path.join(__dirname, '..', 'docs', 'ITERATION_ROADMAP.md');
const src = fs.readFileSync(srcPath, 'utf-8');

// 1) 版本串同步
const verHeaderMatch = src.match(/@version\s+(\S+)/);
const verLogMatch = src.match(/豆包定制聚合音源\s+v(\S+)/);
const verHeader = verHeaderMatch ? verHeaderMatch[1] : null;
const verLog = verLogMatch ? verLogMatch[1] : null;
// v6.0：@description 首行 = @version（三处铁律补全——旧自检漏检 @description，漏改不会被拦）
const descMatch = src.match(/@description\s+([^\n]*)/);
const descFirst = descMatch ? descMatch[1].trim().split(/\s+/)[0] : null;
if (!verHeader) fail('lx-source.js 缺少 @version');
if (!verLog) fail('lx-source.js logInfo 缺少「豆包定制聚合音源 vX.Y」串');
else if (verHeader && verLog !== verHeader) fail('版本串不同步：@version=' + verHeader + ' vs logInfo=' + verLog);
if (verHeader && descFirst && descFirst !== 'v' + verHeader) fail('@description 首行(' + descFirst + ') 与 @version(' + verHeader + ') 不同步');

// 2) actions 声明齐全
const cfgIdx = src.indexOf('const sourceConfig');
// v6.0：sourceConfig actions 构建块动态定位（旧实现 slice(cfgIdx, cfgIdx+1500) 固定窗口——块增长超窗口会静默漏检）
const actionAnchor = src.indexOf('const actions = ["musicUrl"]', cfgIdx);
const actionBlock = src.slice(actionAnchor === -1 ? cfgIdx : actionAnchor, (actionAnchor === -1 ? cfgIdx : actionAnchor) + 500);
if (cfgIdx === -1) fail('sourceConfig 定义缺失');
if (!src.includes('const PLATFORM_QUALITIES')) fail('PLATFORM_QUALITIES 定义缺失');
const reportIdx = src.indexOf('const REPORT_QUALITIES');
const reportBlock = src.slice(reportIdx, reportIdx + 500);
for (const plat of ['wy', 'tx', 'kw', 'kg', 'mg']) {
  if (!reportBlock.includes(plat + ':')) fail('REPORT_QUALITIES 缺少平台 ' + plat);
}
for (const act of ['health', 'toggle', 'probe']) {
  if (!actionBlock.includes(act)) fail('sourceConfig 构建块缺少 ' + act);
}
// v8.0：补 config / trend action 检查（v8.0/v8.0 新增，旧自检漏检）
for (const act of ['config', 'trend']) {
  if (!actionBlock.includes(act)) fail('sourceConfig 构建块缺少 ' + act);
}
if (!actionBlock.includes('lyric')) fail('wy 歌词 action 声明缺失');
if (!actionBlock.includes('"musicUrl"')) fail('musicUrl 基础 action 缺失');

// 3) README 版本历史
if (fs.existsSync(readmePath)) {
  const readme = fs.readFileSync(readmePath, 'utf-8');
  if (verHeader && !readme.includes('v' + verHeader)) fail('README 版本历史缺少 v' + verHeader + ' 条目');
} else fail('README.md 不存在');

// 4) ROADMAP 当前版本已交付
if (fs.existsSync(roadmapPath)) {
  const roadmap = fs.readFileSync(roadmapPath, 'utf-8');
  if (verHeader) {
    const esc = verHeader.replace(/\./g, '\\.');
    const re = new RegExp('\\| \\*\\*v' + esc + '\\*\\*[^\\n]*');
    const curLine = roadmap.match(re);
    if (curLine && curLine[0].indexOf('[x]') === -1) fail('ROADMAP 当前版本 v' + verHeader + ' 未标记 [x] 已交付');
  }
} else fail('docs/ITERATION_ROADMAP.md 不存在');

// 5) v8.10.5：巡检自动写回的文件必须都在 CI 的 git add 清单里
//    背景（V14/V15）：probe 每天整段重写 README.md 的「音源可用性」表格，但 CI 的 git add 清单里没有 README.md，
//    于是那段表格永远提交不上去 —— 本地看着是新的，仓库里停在 2026-11-06。同类漏项不能再靠人眼。
{
  const wfPath = path.join(__dirname, '..', '.github', 'workflows', 'ci.yml');
  if (!fs.existsSync(wfPath)) fail('.github/workflows/ci.yml 不存在');
  else {
    const wf = fs.readFileSync(wfPath, 'utf-8');
    const addLine = (wf.match(/^\s*git add .*$/m) || [''])[0];
    if (!addLine) fail('ci.yml 找不到 `git add` 行');
    else {
      for (const f of ['README_HEALTH.md', 'README.md', 'docs/probe-history.jsonl', 'docs/health-daily/', 'docs/candidate-status.md']) {
        if (addLine.indexOf(f) === -1) fail('CI 写回清单缺少 ' + f + '（该文件会被巡检产出/改写，但永远不会被提交）');
      }
    }
  }
}

// 6) v8.10.12：探测素材不得回退到已知无效的 VIP 歌
//    背景：gdWy 的探测 id 曾写死网易云 186016（周杰伦 VIP「无 url」），仓库自己早已把它从探测池排除，
//    却仍在 buildProbeConfig 里用它 → 端点无论好坏都取不到链接、被恒定判死（2026-11-08 用户手机实测暴露）。
//    只在注释里写挡不住下次改回，这里直接扫函数体。
{
  const i = src.indexOf('function buildProbeConfig');
  const j = i === -1 ? -1 : src.indexOf('\nfunction ', i + 10);
  const body = i === -1 ? '' : src.slice(i, j === -1 ? src.length : j);
  if (!body) fail('lx-source.js 找不到 buildProbeConfig');
  else if (/id=186016|"\{id\}"\s*,\s*"186016"/.test(body))
    fail('buildProbeConfig 又用回 VIP 无效歌 186016（该歌无 url，会让端点恒定判死）');
}

if (failed) {
  console.error('发布前自检未通过，阻断发布。');
  process.exit(1);
}
console.log('自检通过：@version=' + verHeader + '，actions 齐全，README/ROADMAP 同步。');
if (require.main === module) process.exit(0);
