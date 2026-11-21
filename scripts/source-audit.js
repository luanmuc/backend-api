#!/usr/bin/env node
/**
 * 全源全接口深度巡检（v8.5 沉淀自 2026-11-06 v8.4 巡检）
 *
 * 与 scripts/probe.js 的区别：
 * - probe.js：端点连通/结构巡检（CI 每日跑，写 README_HEALTH）——只回答"端点活着没"
 * - 本脚本：源级取链巡检——真实调用每个源的 fn(platform, id, quality, songInfo)，
 *   拿到直链后做 Range 可播校验，回答"这个源现在能不能真的出可播链接"
 *
 * 用法：
 *   node scripts/source-audit.js            # 表格输出
 *   node scripts/source-audit.js --json     # JSON 输出（供机器消费/对比基线）
 *   node scripts/source-audit.js --only=kw  # 只测某平台
 *
 * 基线：docs/SOURCE_AUDIT.md（每次巡检后对照并更新）
 */
const http = require('http');
const https = require('https');
const path = require('path');

const SRC = path.resolve(__dirname, '..', 'lx-source.js');
const ONLY = (process.argv.find(a => a.startsWith('--only=')) || '').split('=')[1] || '';
const JSON_OUT = process.argv.includes('--json');
const INCLUDE_PROBATION = process.argv.includes('--include-probation');
// v8.17：--quick = 只测「启用中的源」各 1 首固定样例，供每日巡检抽样用（不做全量）
const QUICK = process.argv.includes('--quick');
const TIMEOUT = 9000;
const FOLLOW_MAX = 5;

// ---- mock 宿主：真实网络转发（支持 302 跟随，避免 wyOuter 类源被误判）----
let requestHandler = null;
function realRequest(url, opts, cb) {
  const visit = (u, depth) => {
    const lib = String(u).startsWith('https') ? https : http;
    const req = lib.request(u, {
      method: (opts && opts.method) || 'GET',
      headers: (opts && opts.headers) || {},
      timeout: TIMEOUT,
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && depth < FOLLOW_MAX) {
        res.resume();
        return visit(new URL(res.headers.location, u).toString(), depth + 1);
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => cb(null, {
        statusCode: res.statusCode,
        headers: res.headers,
        body: Buffer.concat(chunks).toString('utf-8'),
        url: u,
      }));
    });
    req.on('timeout', () => { req.destroy(); cb(new Error('timeout'), null); });
    req.on('error', e => cb(e, null));
    if (opts && opts.body) req.write(opts.body);
    req.end();
  };
  try { visit(String(url), 0); } catch (e) { cb(e, null); }
}

globalThis.lx = {
  EVENT_NAMES: { inited: 'inited', request: 'request', updateAlert: 'updateAlert' },
  version: '2.6.0', env: 'mobile',
  utils: { buffer: { from: (d, e) => Buffer.from(d, e), bufToString: (b, e) => b.toString(e) } },
  request: realRequest,
  on(name, handler) { if (name === 'request') requestHandler = handler; },
  send() {},
};

const realLog = console.log;
console.log = () => {};
const mod = require(SRC);
console.log = realLog;

// 全开开关：默认关闭的源也要纳入巡检（结论用于判断"开启值不值"）
// --quick 例外：每日抽样只测真实启用的源，否则等于给用户不用的源发请求。
if (!QUICK) for (const k of Object.keys(mod.runtimeToggles)) mod.runtimeToggles[k] = true;

// v9.1.4：探测歌收敛到 scripts/lib/probe-songs.js（与 probe 的 payload 校验共用一份）。
// 此前两处各写一份《晴天》id —— wy 的 id 就出现过 186016（VIP 无 url）与 2652820720 两种写法，
// 两个巡检用不同的歌，结论无法互相对照。
const { songOf, idOf } = require('./lib/probe-songs.js');

// v9.1.6：删掉 `isKwPlayDirect`。它原本用来把 ".php / kwplay 直链" 排除在 Range 验真之外，
// 但两次收紧（先整串搜 `kwplay`、后只看 origin+path）都只是在猜"这类链不能验"，
// 实测星海 `lx/api/kwplay.php` 带 Range 直接 206 + audio/mpeg，可播却常年被标 skipped。
// 现在的口径是：出链一律验真，rangeCheck 回出状态码 + content-type，假绿天然暴露。

function rangeCheck(url) {
  return new Promise((resolve) => {
    if (!url || !/^https?:\/\//.test(String(url))) return resolve('NO_URL');
    const lib = String(url).startsWith('https') ? https : http;
    let done = false;
    const fin = (v) => { if (!done) { done = true; resolve(v); } };
    try {
      const req = lib.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 13) Mobile', Range: 'bytes=0-1023' },
        timeout: 6000,
      }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          const nxt = new URL(res.headers.location, url).toString();
          const lib2 = nxt.startsWith('https') ? https : http;
          const r2 = lib2.get(nxt, { headers: { Range: 'bytes=0-1023', 'User-Agent': 'Mozilla/5.0 (Linux; Android 13) Mobile' }, timeout: 6000 }, (rr) => {
            fin(`${rr.statusCode} ${rr.headers['content-type'] || ''}`);
            rr.resume();
          });
          r2.on('error', () => fin('ERR'));
          return;
        }
        fin(`${res.statusCode} ${res.headers['content-type'] || ''}`);
        res.resume();
      });
      req.on('timeout', () => { req.destroy(); fin('TIMEOUT'); });
      req.on('error', () => fin('ERR'));
    } catch (e) { fin('ERR'); }
  });
}

// 只有直接运行才巡检；被 require 时不得打网络、不得 exit。
if (require.main === module) (async () => {
  const rows = [];
  // v8.17 quick 模式：每个启用源 1 首，不做全量、不测未启用源
  if (QUICK) {
    for (const h of Object.values(mod.SOURCE_HANDLERS || {})) {
      if (h.lifecycle === 'probation') continue;
      if (mod.runtimeToggles[h.id] !== true) continue;
      if (ONLY && !(h.platforms || []).includes(ONLY)) continue;
      // v9.2：多平台源必须逐平台各测一条。旧实现只取 platforms[0]，
      // 而 suyinKuwo 声明 kw/wy/tx/mg/kg、在 tx:1/mg:1/kg:1 都是链首位，
      // 这三个平台的首选源此前从未被巡检覆盖（实测 2026-11-21）。
      for (const plat of (ONLY ? [ONLY] : (h.platforms || []))) {
        const song = songOf(plat);
        const idVal = idOf(plat);
        if (!song || !idVal) continue;
        const t0 = Date.now();
        try {
          const url = await h.fn(plat, idVal, '128k', song);
          const host = (String(url).match(/^(https?:\/\/[^/]+)/) || [, ''])[1];
          let playable = '';
          // B03-012：早期把 .php / kwplay 直链整体跳过 Range 校验，理由是"签名直链可能不稳"。
          // v9.1.6 实测推翻了这个前提：星海 `lx/api/kwplay.php` 带 Range 直接 206 + audio/mpeg
          // （bytes 0-1023/4317292，1 跳），本来可播却被标成 skipped → 「可播」列长期是空的，
          // 等于这个源的可播性从未被验证。改为全部验真；rangeCheck 会回出状态码与 content-type，
          // 若真是「200 + text/html」的假绿也照样能看出来。
          if (/^https?:\/\//.test(String(url))) playable = await rangeCheck(String(url));
          rows.push({ src: h.id, plat, ok: true, code: 'OK', host, playable, ms: Date.now() - t0 });
        } catch (e) {
          const msg = String((e && e.message) || e);
          const code = (msg.match(/^([A-Z_]+):/) || [, 'ERR'])[1];
          rows.push({ src: h.id, plat, ok: false, code, msg: msg.slice(0, 100), ms: Date.now() - t0 });
        }
      }
    }
    if (JSON_OUT) realLog(JSON.stringify({ checkedAt: new Date().toISOString(), total: rows.length, ok: rows.filter(r => r.ok).length, rows }, null, 2));
    else {
      realLog('\n=== 每日出链抽样（每启用源 1 首 128k）===');
      for (const r of rows) realLog(`${r.src.padEnd(16)} | ${r.plat} | ${r.ok ? '✅' : '❌'} | ${String(r.code).padEnd(14)} | ${(r.ok ? (r.host || '') : r.msg).slice(0, 48)} | ${r.ms}ms`);
      realLog(`\n统计：${rows.filter(r => r.ok).length}/${rows.length} 可用`);
    }
    const strict = process.argv.includes('--strict');
    process.exit(strict && rows.some(r => !r.ok) ? 1 : 0);
    return;
  }
  const platforms = ONLY ? [ONLY] : ['kw', 'wy', 'tx', 'mg', 'kg'];
  for (const plat of platforms) {
    const chain = mod.buildSourceChain(plat, '128k');
    for (const h of chain) {
      const song = songOf(plat);
      const idVal = idOf(plat);
      if (!song || !idVal) continue; // v9.1.4：探测歌缺失时跳过该源，不拿空 id 硬打上游
      const t0 = Date.now();
      try {
        const url = await h.fn(plat, idVal, '128k', song);
        const host = (String(url).match(/^(https?:\/\/[^/]+)/) || [, ''])[1];
        let playable = '';
        // 二次可播校验（识破"接口 200 但 CDN 死链"）。同上：不再按 .php / kwplay 跳过。
        if (/^https?:\/\//.test(String(url))) {
          playable = await rangeCheck(String(url));
        }
        rows.push({ src: h.id, plat, ok: true, code: 'OK', host, playable, ms: Date.now() - t0 });
      } catch (e) {
        const msg = String((e && e.message) || e);
        const code = (msg.match(/^([A-Z_]+):/) || [, 'ERR'])[1];
        rows.push({ src: h.id, plat, ok: false, code, msg: msg.slice(0, 100), ms: Date.now() - t0 });
      }
    }
  }

  if (INCLUDE_PROBATION) {
    for (const h of Object.values(mod.SOURCE_HANDLERS)) {
      if (h.lifecycle !== 'probation') continue;
      if (ONLY && !h.platforms.includes(ONLY)) continue;
      const plat = ONLY || h.platforms[0];
      const song = songOf(plat);
      const idVal = idOf(plat);
      if (!song || !idVal) continue; // v9.1.4：探测歌缺失时跳过该源，不拿空 id 硬打上游
      const t0 = Date.now();
      try {
        const url = await h.fn(plat, idVal, '128k', song);
        rows.push({ src: h.id, plat, probation: true, ok: true, code: 'OK', host: (String(url).match(/^(https?:\/\/[^/]+)/) || [, ''])[1], playable: '', ms: Date.now() - t0 });
      } catch (e) {
        const msg = String((e && e.message) || e);
        const code = (msg.match(/^([A-Z_]+):/) || [, 'ERR'])[1];
        rows.push({ src: h.id, plat, probation: true, ok: false, code, msg: msg.slice(0, 100), ms: Date.now() - t0 });
      }
    }
  }

  if (JSON_OUT) {
    realLog(JSON.stringify({ checkedAt: new Date().toISOString(), total: rows.length, ok: rows.filter(r => r.ok).length, rows }, null, 2));
    process.exit(0);
  }
  realLog('\n=== 全源深度巡检（128k 固定歌 晴天）===');
  realLog('源 | 平台 | 结果 | 码 | 域名/原因 | 可播 | 耗时');
  for (const r of rows) {
    realLog(`${r.src.padEnd(16)} | ${r.plat} | ${r.ok ? '✅' : '❌'} | ${String(r.code).padEnd(14)} | ${(r.ok ? (r.host || '') : r.msg).slice(0, 48).padEnd(48)} | ${String(r.playable || '').slice(0, 22)} | ${r.ms}ms`);
  }
  realLog(`\n统计：${rows.filter(r => r.ok).length}/${rows.length} 可用`);
  // v8.9：巡检完成后强制退出——HTTP keep-alive agent 会挂住事件循环，不加 exit 进程常驻。
  // 退出码：默认 0（巡检是信息性输出，死源属常态）；`--strict` 时有任一源不可用则返回 1（供 CI 门禁用）
  const strict = process.argv.includes('--strict');
  process.exit(strict && rows.some(r => !r.ok) ? 1 : 0);
})();
