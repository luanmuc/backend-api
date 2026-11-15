#!/usr/bin/env node
/**
 * Q 组：D 系列高危缺陷的行为断言（N 组清单里"无 ID 锚点但必须用行为守"的靶子）
 *
 * 背景：2026-11-10 N 组静态配对发现 39 条修复里 23 条没有断言 ID 锚点。
 * 其中 D-04（半开态遇 429 永久卡死）风险最高——旧实现只修了「业务失败/本地节流」两条出口，
 * 429 这条漏了，而 canExecute 对 half-open 恒返回 false → 该源再也不会被调用，只能重启救回。
 *
 * 断言方式：不走 mock 管线（那需要构造 15 层链路），直接驱动真实函数 + 真实断路器状态：
 *   1) 把断路器置为 half-open（等价于冷却结束、下一次试探已放行的时刻）
 *   2) 记录一次 429
 *   3) 状态必须是 open，且 lastFailureTime 被刷新（否则下次冷却判断会用旧时间）
 * 反向验证：删掉 recordRateLimit 里那段 `if (b.state === "half-open")` → Q1 立刻红。
 */

const path = require('path');
const SRC = path.resolve(__dirname, '../../lx-source.js');

// 宿主环境最小桩：lx-source.js 顶层要解构 globalThis.lx，缺一个就 TypeError
globalThis.lx = {
  EVENT_NAMES: { inited: 'inited', request: 'request', updateAlert: 'updateAlert' },
  version: '2.0.0',
  env: 'mobile',
  utils: { buffer: { from: (d, e) => Buffer.from(d, e), bufToString: (b, e) => b.toString(e) } },
  request(url, opts, cb) { setTimeout(() => cb(null, { statusCode: 200, headers: {}, body: '', url: String(url) }), 1); },
  on(n, h) { if (n === 'request') globalThis.__lxHandler = h; },
  send() {},
};

const src = require(SRC);
const dbg = src.__debug;

let fail = 0;
const rec = (id, name, ok, detail) => {
  if (!ok) fail++;
  console.log(`${ok ? '✓' : '✗'} [${id}] ${name}${detail ? ' — ' + detail : ''}`);
};

if (!dbg || !dbg.breakerMap || typeof dbg.recordRateLimit !== 'function') {
  console.log('✗ [Q0] __debug 钩子缺失（breakerMap / recordRateLimit）');
  // R30：裸 exit(1) 会把 require 本文件的调用方一起杀掉；独立运行仍直接红，被 require 改成抛出。
  if (require.main === module) process.exit(1);
  throw new Error('__debug 钩子缺失（breakerMap / recordRateLimit）');
}

// ── Q1：D-04 半开态 + 429 → 必须收口回 open，不能停在 half-open ──
{
  // R35：原注释写「任一已注册源即可，这里取默认开启的 gd Kw」——但 gdKw/gdKg 是 v8.13 之前的旧源 id，
  // 当前 12 源登记里没有它们；用一个不存在的 id 会让 breakerMap 里多出一条幽灵条目。
  // 换成真实的在册源（两个不同源，避免 Q1/Q2 互相干扰）。
  const id = 'suyinKuwo'
  dbg.recordRateLimit(id, '128k'); // breakerMap 是懒建：先调一次把条目建出来
  const b = dbg.breakerMap.get(id);
  const before = { state: b.state, lastFailureTime: b.lastFailureTime };
  b.state = 'half-open';
  b.lastFailureTime = Date.now() - 10 * 60 * 1000; // 冷却早已结束，模拟"正在试探"
  const t429 = Date.now();
  dbg.recordRateLimit(id, 'flac');
  const after = { state: b.state, lastFailureTime: b.lastFailureTime };
  rec('Q1', 'D-04：half-open 遇 429 收口为 open（不永久卡死）',
    after.state === 'open' && after.lastFailureTime > 0 && after.lastFailureTime >= t429,
    `state ${before.state}→${after.state}，lastFailureTime 已刷新=${after.lastFailureTime >= t429}`);
  // 还原，避免影响同进程后续用例
  b.state = before.state;
  b.lastFailureTime = before.lastFailureTime;
  b.rateLimitCount = 0;
  b.rateLimitUntil = 0;
  b.rateLimited = false;
}

// ── Q2：closed / open 态遇 429 不应被误改成 open（避免"限流当熔断"扩大打击）──
{
  const id = 'suyin163'
  dbg.recordRateLimit(id, '128k');
  const b = dbg.breakerMap.get(id);
  const saved = { state: b.state, lastFailureTime: b.lastFailureTime };
  b.state = 'closed';
  dbg.recordRateLimit(id, '320k');
  rec('Q2', 'D-04 反向：closed 态遇 429 保持 closed（只退避不熔断）', b.state === 'closed', `state=${b.state}`);
  b.state = saved.state;
  b.lastFailureTime = saved.lastFailureTime;
  b.rateLimitCount = 0;
  b.rateLimitUntil = 0;
  b.rateLimited = false;
}

// ── Q3：D-01 toggle 开启某源 → 该平台失败缓存必须失效（否则重开源仍命中"歌不存在 1h"）──
{
  const h = globalThis.__lxHandler;
  const dbg2 = src.__debug;
  const key = dbg2.buildCacheKey('fail_kw', { songmid: 'Q3SONG', hash: 'h', id: 1 }, '128k');
  dbg2.setFailCached(key, 'NOT_FOUND');            // 造一条 1h 的"歌不存在"
  const before = dbg2.getFailCachedEntry(key);
  (async () => {
    if (!h) {
      rec('Q3', 'D-01：toggle 开启清失败缓存', false, 'request handler 未注册');
      rec('Q4', 'D-08：单链硬超时', false, 'request handler 未注册');
    } else {
      try {
        await h({ action: 'toggle', source: 'kw', info: { id: 'huibq', enabled: true } });
        const after = dbg2.getFailCachedEntry(key);
        rec('Q3', 'D-01：开启源后 kw 失败缓存必须失效',
          before !== null && after === null,
          `开启前缓存=${before ? before.code : 'none'}，开启后=${after ? after.code : 'none'}`);
      } catch (e) {
        rec('Q3', 'D-01：toggle 开启清失败缓存', false, `toggle 抛错 ${e.message}`);
      }
      // Q4：D-08 单链分支必须受 deadline 硬约束（只有 1 个源也不能绕过超时）
      const t0 = Date.now();
      const hanging = { id: 'q4hang', name: 'Q4悬挂源', maxQuality: '128k', fn: () => new Promise(() => {}) };
      try {
        await dbg2.fallbackRace([hanging], 'kw', { songmid: 'Q4' }, '128k', Date.now() + 2000);
        rec('Q4', 'D-08：单链悬挂源必须在预算内被判超时', false, '悬挂源竟然返回了结果');
      } catch (e) {
        const ms = Date.now() - t0;
        rec('Q4', 'D-08：单链悬挂源必须在预算内被判超时',
          e.code === 'BUDGET_EXHAUSTED' && ms < 3000, `code=${e.code} 耗时=${ms}ms（预算 2000ms）`);
      }
    }

    // Q5（F-01）：星海后端缺 songmid 时不得兜底成 1 号歌——必须 PARAM_ERROR
    {
      const fn = src.SOURCE_HANDLERS && src.SOURCE_HANDLERS.xinghaiBackend && src.SOURCE_HANDLERS.xinghaiBackend.fn;
      if (typeof fn !== 'function') {
        rec('Q5', 'F-01：星海后端缺 id 必须报 PARAM_ERROR', false, 'xinghaiBackend 未注册');
      } else {
        let code = null;
        try { await fn('kw', null, '128k', { name: 'zzz不存在zzz', singer: '无' }); } catch (e) { code = e && e.code; }
        rec('Q5', 'F-01：星海后端缺 id 必须报 PARAM_ERROR（不得兜底 1 号歌）',
          code === 'PARAM_ERROR', `code=${code}`);
      }
    }
    console.log(`\nD 系列行为断言（Q1~Q5）汇总：${5 - fail} 通过 / ${fail} 失败`);
    // R35：原来只有 `if (require.main) process.exit(...)`——被 require 时失败既不退出也不置退出码。
    if (fail) process.exitCode = 1;
    if (require.main === module) process.exit(fail ? 1 : 0);
  })();
}

// R35：原来导出的是 `{ results: { fail } }`——对象里存的是**模块求值时刻**的 0 快照，
// 后面 Q1~Q5 全部跑完 fail 变成 1 也不会更新，读这个字段的人永远看到 0。改成取值函数。
module.exports = { results: () => ({ fail }) };
