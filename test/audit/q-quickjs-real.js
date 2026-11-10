#!/usr/bin/env node
/**
 * QuickJS 真引擎测试（可选依赖）
 *
 * 为什么单独一个入口：Node 里 `Buffer`/`setTimeout` 全都在，跑绿不代表 App 里能跑。
 * App 的音源脚本跑在 QuickJS，宿主只注入 `lx`（`android/app/src/main/assets/script/user-api-preload.js`），
 * **没有全局 Buffer**。本轮 D-28 就是靠这里抓出来的：交付闸门裸用 `Buffer.isBuffer`，
 * 真机上抛 ReferenceError → 被归一成 NETWORK_ERROR → 落进「网络错误拿不准放行」→ 假链接交付。
 *
 * 依赖：`npm i quickjs-emscripten`（或 `NODE_PATH=<装了它的 node_modules> node 本文件`）
 * 没装就 SKIP（不算失败），装了就必须过。
 *
 * 退出码：0 = 通过；1 = 断言失败；3 = 依赖缺失（跳过 = 未验证，不算通过）。
 */
const path = require('path');
const fs = require('fs');
const SRC = path.join(__dirname, '../../lx-source.js');

// 依赖查找顺序——`/tmp` 会被系统清理（已踩过两次），仓库内 node_modules 会被 git clean 抹掉，
// 所以主路径放在**工作区持久目录** vendor/quickjs/node_modules，最后再尝试自动安装兜底。
const WS = path.resolve(__dirname, '../../../..');   // repos/lx-music-source/test/audit → 工作区根
const CAND = [
  path.join(__dirname, '../../node_modules'),          // 仓库内（git clean 会删）
  path.join(WS, 'vendor/quickjs/node_modules'),        // 工作区持久 ← 主路径
  process.env.QUICKJS_EMSCRIPTEN || '',                // 显式指定优先于以上？
].filter(Boolean);
let getQuickJS = null;
for (const dir of CAND) {
  const target = dir.includes('quickjs-emscripten') ? dir : path.join(dir, 'quickjs-emscripten');
  try { getQuickJS = require(target).getQuickJS; break; } catch (e) { /* 继续试 */ }
}
if (!getQuickJS) {
  // 兜底：自动装到工作区持久目录（网络不可用就放弃，仍按 exit 3 处理）
  try {
    const { spawnSync } = require('child_process');
    const vend = path.join(WS, 'vendor/quickjs');
    fs.mkdirSync(vend, { recursive: true });
    const pj = path.join(vend, 'package.json');
    if (!fs.existsSync(pj)) fs.writeFileSync(pj, '{"name":"lx-quickjs-vendor","private":true}');
    console.log('⏳ [QR] 未找到 quickjs-emscripten，尝试自动安装到工作区 vendor/quickjs …');
    spawnSync('npm', ['i', '--silent', 'quickjs-emscripten'], { cwd: vend, timeout: 180000, stdio: 'ignore' });
    getQuickJS = require(path.join(vend, 'node_modules', 'quickjs-emscripten')).getQuickJS;
  } catch (e) { /* 落到下面的 exit 3 */ }
}
if (!getQuickJS) {
  console.log('⚠ [QR] 未验证：拿不到 quickjs-emscripten（网络不可用或安装失败）。');
  console.log('   手动修复：cd vendor/quickjs && npm i quickjs-emscripten');
  console.log('   跳过不等于通过 —— 退出码 3，请勿把本次结果计入断言通过数。');
  process.exit(3);
}

const src = fs.readFileSync(SRC, 'utf8');
let pass = 0, fail = 0;
const rec = (id, ok, detail) => {
  if (ok) { pass++; console.log(`  ✓ [${id}] ${detail || ''}`); }
  else { fail++; console.log(`  ✗ [${id}] ${detail || ''}`); }
};

(async () => {
  const QuickJS = await getQuickJS();
  const runtime = QuickJS.newRuntime();
  const vm = runtime.newContext();

  const prelude = `
    globalThis.__timers = []; globalThis.__now = 0; globalThis.__seq = 0;
    globalThis.setTimeout = function (fn, ms) { __timers.push({ fn: fn, at: __now + (ms || 0), seq: ++__seq }); return __seq; };
    globalThis.clearTimeout = function (id) { var o = []; for (var i = 0; i < __timers.length; i++) if (__timers[i].seq !== id) o.push(__timers[i]); __timers = o; };
    globalThis.__tick = function () {
      if (!__timers.length) return false;
      __timers.sort(function (a, b) { return a.at - b.at || a.seq - b.seq; });
      var t = __timers.shift(); __now = Math.max(__now, t.at);
      try { t.fn(); } catch (e) {}
      return true;
    };
    globalThis.lx = {
      EVENT_NAMES: { inited: 'inited', request: 'request', updateAlert: 'updateAlert' },
      version: '2.0.0', env: 'mobile', utils: {},
      request(url, opts, cb) {
        var u = String(url), isProbe = !!(opts && opts.binary), r;
        if (u.indexOf('oiapi') >= 0) r = { statusCode: 200, headers: { 'content-type': 'application/json' },
          body: { code: 1, message: '音乐链接：https://audio.test/x.flac' } };
        else if (isProbe) r = { statusCode: 200, headers: { 'content-type': 'application/json' },
          body: { url: '', br: 0, size: 0 } };            // 交付体是 JSON 对象（假交付）
        else r = { statusCode: 206, headers: { 'content-type': 'audio/mpeg', 'content-range': 'bytes 0-1023/3000000' }, body: 'ID3\\u0003' };
        __timers.push({ fn: function () { cb(null, r); }, at: __now + 1, seq: ++__seq });
      },
      on(n, h) { if (n === 'request') globalThis.__handler = h; },
      send() {},
    };
    globalThis.__lxSourceConfig = { rateWindowMax: 1e6, maxConcurrency: 1e6, rateWindowMs: 3600000 };
    var module = { exports: {} }, exports = module.exports;
  `;
  const e0 = vm.evalCode(prelude);
  if (e0.error) { console.log('✗ [QR0] prelude 失败：', vm.dump(e0.error)); process.exit(1); }
  e0.value.dispose();

  // QR1：真 QuickJS 里能加载（不带 module）
  const e1 = vm.evalCode(src + '\nglobalThis.__mod = module.exports;');
  if (e1.error) { rec('QR1', false, '加载失败：' + vm.dump(e1.error).message); process.exit(1); }
  e1.value.dispose();
  rec('QR1', true, 'lx-source.js 在真 QuickJS 中加载成功');

  // QR2：确认宿主没有 Buffer（这正是 D-28 的前提）
  const tbuf = vm.evalCode('typeof Buffer').value.consume(v => vm.dump(v));
  rec('QR2', tbuf === 'undefined', `typeof Buffer = ${tbuf}`);

  // QR3：无 Buffer 环境下，JSON 假交付必须判 NOT_AUDIO（不得 fail-open 放行）
  vm.evalCode(`
    globalThis.__out = 'pending';
    __handler({ action: 'musicUrl', source: 'kw', info: { type: '128k', musicInfo: { name: '晴天', singer: '周杰伦', duration: 269 } } })
      .then(function (r) { __out = 'DELIVERED ' + (r && r.url); })
      .catch(function (e) { __out = 'CODE=' + (e && e.code) + ' msg=' + String(e && e.message).slice(0, 300); });
  `);
  let out = 'pending';
  for (let i = 0; i < 3000; i++) {
    runtime.executePendingJobs();
    vm.evalCode('__tick()');
    runtime.executePendingJobs();
    out = vm.evalCode('__out').value.consume(v => vm.dump(v));
    if (out !== 'pending' && out !== 'undefined') break;
  }
  const blocked = out.indexOf('NOT_AUDIO') >= 0 && out.indexOf('DELIVERED') < 0;
  rec('QR3', blocked, out.indexOf('DELIVERED') >= 0 ? '放行了假链接：' + out : out.slice(0, 120));

  console.log(`\nQuickJS 真引擎汇总：${pass} 通过 / ${fail} 失败`);
  process.exit(fail === 0 ? 0 : 1);
})();
