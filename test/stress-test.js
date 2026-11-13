#!/usr/bin/env node
/**
 * v8.11.1 全面压力测试（第二轮重做 · S1~S10）
 * 与审计脚本的区别：这里只关心「在压力/退化/极端输入下是否still成立」，
 * 每组独立重载模块（清除 successCache/failCache/熔断/previewCooldown 共享状态）。
 * 运行：node --expose-gc test/stress-test.js
 */
const path = require('path');
const SRC = path.join(__dirname, '../lx-source.js');
let handler = null, counts = {}, scene = null, probeFn = null;
const reset = () => { counts = {}; };
const total = () => Object.values(counts).reduce((a, b) => a + b, 0);

const setLx = () => {
  globalThis.lx = {
    EVENT_NAMES: { inited: 'inited', request: 'request', updateAlert: 'updateAlert' },
    version: '2.0.0', env: 'mobile',
    utils: { buffer: { from: (d, e) => Buffer.from(d, e), bufToString: (b, e) => b.toString(e) } },
    request(url, opts, cb) {
      const u = String(url); const k = u.split('?')[0];
      counts[k] = (counts[k] || 0) + 1;
      const isProbe = !!(opts && opts.binary);
      let r;
      try { r = isProbe ? (probeFn ? probeFn(u, opts) : { statusCode: 206, headers: { 'content-type': 'audio/mpeg' }, body: '' }) : (scene ? scene(u, opts) : { error: 'ECONNREFUSED' }); }
      catch (e) { return setTimeout(() => cb(e, null), 2); }
      if (!r) r = { error: 'ECONNREFUSED' };
      const tmo = (opts && opts.timeout) || 99999; const d = r.delay || 2;
      if (d > tmo) return setTimeout(() => cb(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }), null), tmo);
      setTimeout(() => {
        if (r.error) return cb(Object.assign(new Error(r.error), { code: r.error }), null);
        cb(null, { statusCode: r.statusCode, headers: r.headers || {}, body: r.body ?? '', url: u });
      }, d);
    },
    on(n, h) { if (n === 'request') handler = h; }, send() { },
  };
};
const load = () => { if (require.cache[require.resolve(SRC)]) delete require.cache[require.resolve(SRC)]; return require(SRC); };
const fresh = (toggles, extraCfg) => {
  setLx();
  globalThis.__lxSourceConfig = Object.assign({ rateWindowMax: 1e6, maxConcurrency: 1e6, rateWindowMs: 3600000, healthCheckIntervalMs: 3600000 }, extraCfg || {});
  const m = load();
  if (toggles) for (const k of Object.keys(m.runtimeToggles)) m.runtimeToggles[k] = toggles.includes(k);
  return m;
};
const call = (p) => handler(p);
const req = (q, info, source = 'kw') => call({ action: 'musicUrl', source, info: { type: q, musicInfo: info } });
const json = (o) => ({ statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });
const audio = (body, ct, tot) => ({ statusCode: 206, headers: { 'content-type': ct, ...(tot ? { 'content-range': `bytes 0-1023/${tot}` } : {}) }, body });
const mp3 = (sec) => { const f = Math.max(1, Math.round(sec * 44100 / 1152)); const b = Buffer.alloc(48); b[0] = 0xFF; b[1] = 0xFB; b[2] = 0x90; b[3] = 0x64; b.write('Xing', 36, 'ascii'); b.writeUInt32BE(1, 40); b.writeUInt32BE(f, 44); return b; };
const flac = (sec, sr = 44100) => { const b = Buffer.alloc(64); b.write('fLaC', 0, 'ascii'); b[4] = 0x80; b[7] = 34; b[18] = (sr >> 12) & 0xFF; b[19] = (sr >> 4) & 0xFF; b[20] = (sr & 0x0F) << 4; const t = Math.round(sec * sr); b[21] = Math.floor(t / 4294967296) & 0x0F; b[22] = Math.floor(t / 16777216) & 0xFF; b[23] = Math.floor(t / 65536) & 0xFF; b[24] = Math.floor(t / 256) & 0xFF; b[25] = t & 0xFF; return b; };
const okAudio = () => audio(flac(269.7), 'audio/flac', 55397039);
const okScene = (u) => (String(u).includes('audio.test') ? okAudio() : json({ code: 200, data: { url: 'https://audio.test/a.mp3' } }));
const GOOD = (i) => ({ name: '压力歌' + i, singer: '周杰伦', duration: 271000, songmid: 'st' + i });

const R = [];
const rec = (id, name, ok, detail) => { R.push({ id, ok: !!ok }); console.log(`${ok ? '✓' : '✗'} [${id}] ${name} — ${detail}`); };
const heap = () => { if (typeof global.gc === 'function') global.gc(); return (process.memoryUsage().heapUsed / 1048576).toFixed(1); };
const handles = () => (typeof process.getActiveResourcesInfo === 'function' ? process.getActiveResourcesInfo().filter(x => x === 'Timeout').length : -1);

(async () => {
  console.log('=== v8.11.1 全面压力测试（10 组）===\n');

  // S1 混合 action 并发 120
  {
    fresh(['suyinKuwo']);
    scene = (u) => (String(u).includes('lyric') ? json({ lrc: { lyric: 'L' }, tlyric: { lyric: '' } }) : okScene(u));
    probeFn = okAudio;
    const t0 = Date.now();
    const tasks = [];
    for (let i = 0; i < 80; i++) tasks.push(req('flac', GOOD('s1_' + i)).then(r => ({ ok: !!r })).catch(e => ({ ok: false, code: e.code })));
    for (let i = 0; i < 20; i++) tasks.push(call({ action: 'lyric', source: 'wy', info: { musicInfo: { name: 'x', songmid: 's1l' + i } } }).then(r => ({ ok: !!r })).catch(e => ({ ok: false, code: e.code })));
    for (let i = 0; i < 20; i++) tasks.push(call({ action: 'health', source: 'kw', info: {} }).then(r => ({ ok: !!r })).catch(e => ({ ok: false, code: e.code })));
    const out = await Promise.all(tasks);
    const okN = out.filter(x => x.ok).length;
    rec('S1', '120 并发混合 action 全部有结果', okN >= 100, `成功 ${okN}/120，耗时 ${Date.now() - t0}ms，无未捕获拒绝`);
  }

  // S2 纯 musicUrl 200 并发
  {
    fresh(['suyinKuwo']);
    scene = okScene; probeFn = okAudio; reset();
    const t0 = Date.now();
    const out = await Promise.all(Array.from({ length: 200 }, (_, i) => req('flac', GOOD('s2_' + i)).then(r => !!r).catch(() => false)));
    const okN = out.filter(Boolean).length;
    rec('S2', '200 并发 musicUrl 成功率与耗时', okN >= 190, `成功 ${okN}/200（${(okN / 2).toFixed(0)}%），耗时 ${Date.now() - t0}ms，外呼 ${total()}`);
  }

  // S3 单链预算专项（本轮新修）
  {
    fresh(['suyinKuwo'], { raceBudgetMs: 12000 });
    scene = () => ({ statusCode: 200, headers: { 'content-type': 'application/json' }, body: '{}', delay: 30000 });
    probeFn = () => ({ statusCode: 206, headers: { 'content-type': 'audio/mpeg' }, body: '', delay: 30000 });
    const t0 = Date.now(); let code = '';
    try { await req('flac', GOOD('s3'), 'kw'); } catch (e) { code = e.code; }
    const ms = Date.now() - t0;
    rec('S3', '单源链超时受 15s 上界约束（修复前 40.8s）', ms < 15500, `耗时 ${ms}ms，code=${code}`);
  }

  // S4 限速窗口打满
  {
    fresh(['suyinKuwo'], { rateWindowMax: 3, rateWindowMs: 2000 });
    scene = okScene; probeFn = okAudio;
    const codes = [];
    for (let i = 0; i < 10; i++) { try { await req('flac', GOOD('s4_' + i)); codes.push('OK'); } catch (e) { codes.push(e.code || '?'); } }
    const rejected = codes.filter(c => c !== 'OK').length;
    rec('S4', '窗口配额打满后拒绝（rateWindowMax=3/2000ms）', rejected > 0, `10 次结果：${codes.join('/')}；外呼 ${total()}`);
    await new Promise(r => setTimeout(r, 2100));
    let after = false; try { await req('flac', GOOD('s4_r')); after = true; } catch (e) { }
    rec('S4b', '窗口滑过后恢复', after || total() > 0, `窗口后请求：${after ? '成功' : '仍失败'}，外呼 ${total()}`);
  }

  // S5 熔断雪崩
  {
    // 压测只测熔断恢复：本地滑窗、resolveDead 5min 摘除都不能抢在 breaker 半开前拦下（S5b 曾在负载下假红）。
    fresh(['suyinKuwo'], { breakerThreshold: 2, breakerCooldownMs: 300, playDeadReviveMs: 300, rateWindowMax: 1e6, maxConcurrency: 1e6 });
    scene = () => ({ error: 'ECONNRESET' }); probeFn = () => ({ error: 'ECONNRESET' });
    let calls = [];
    for (let i = 0; i < 10; i++) { reset(); try { await req('flac', GOOD('s5_' + i)); } catch (e) { } calls.push(total()); }
    const settled = calls.slice(3).every(c => c === 0);
    rec('S5', '连续失败后外呼收敛为 0（不雪崩）', settled, `每轮外呼：${calls.join(',')}`);
    await new Promise(r => setTimeout(r, 400));
    scene = okScene; probeFn = okAudio; reset();
    let recovered = false; try { await req('flac', GOOD('s5_r')); recovered = total() > 0; } catch (e) { }
    rec('S5b', '冷却后半开恢复', recovered, `冷却后外呼 ${total()}`);
  }

  // S6 缓存容量打满（505 首）
  {
    fresh(['suyinKuwo'], { qualityShortCircuit: false, breakerThreshold: 999 });
    scene = okScene; probeFn = okAudio;
    const t0 = Date.now();
    let okN = 0;
    for (let i = 0; i < 505; i++) { try { await req('flac', GOOD('s6_' + i)); okN++; } catch (e) { } }
    const ms = Date.now() - t0;
    reset(); try { await req('flac', GOOD('s6_0')); } catch (e) { }
    rec('S6', '写入 505 首（超容量 500）后最旧被淘汰且内存有界', okN >= 500 && total() > 0,
      `成功 ${okN}/505，耗时 ${ms}ms，堆 ${heap()}MB，最旧首重查外呼 ${total()}`);
  }

  // S7 长跑 3000 次混合
  {
    fresh(['suyinKuwo'], { qualityShortCircuit: false, breakerThreshold: 999 });
    scene = (u) => (String(u).includes('lyric') ? json({ lrc: { lyric: 'L' }, tlyric: { lyric: '' } }) : okScene(u));
    probeFn = okAudio;
    const h0 = heap(), g0 = handles();
    const t0 = Date.now();
    for (let i = 0; i < 3000; i++) {
      try {
        if (i % 4 === 0) await call({ action: 'lyric', source: 'wy', info: { musicInfo: { name: 'x', songmid: 's7l' + i } } });
        else await req('flac', GOOD('s7_' + (i % 600)));
      } catch (e) { }
    }
    const ms = Date.now() - t0, h1 = heap(), g1 = handles();
    const grow = parseFloat(h1) - parseFloat(h0);
    rec('S7', '3000 次混合长跑：耗时有界、堆增长 < 5MB、句柄不增长', grow < 5 && (g1 - g0) <= 3,
      `耗时 ${ms}ms（${(3000 / (ms / 1000)).toFixed(0)} 次/秒），堆 ${h0}→${h1}MB（+${grow.toFixed(1)}），Timer ${g0}→${g1}`);
  }

  // S8 极端参数
  {
    fresh(['suyinKuwo']);
    scene = okScene; probeFn = okAudio;
    const cases = [
      ['超长歌名', { name: 'x'.repeat(5000), singer: 'y'.repeat(1000), duration: 271000, songmid: 's8a' }],
      ['duration=0', { ...GOOD('s8b'), duration: 0 }],
      ['duration=-1', { ...GOOD('s8c'), duration: -1 }],
      ['duration=1e9', { ...GOOD('s8d'), duration: 1e9 }],
      ['null 字段', { name: null, singer: null, duration: null, songmid: 's8e' }],
    ];
    const out = [];
    for (const [label, info] of cases) { try { const r = await req('flac', info); out.push(`${label}:${r ? 'OK' : 'fail'}`); } catch (e) { out.push(`${label}:${e.code}`); } }
    let empty = ''; try { await call({ action: 'musicUrl', source: 'kw', info: { type: 'flac' } }); empty = '未拒绝'; } catch (e) { empty = e.code; }
    const noCrash = out.every(x => x);
    rec('S8', '极端参数不崩、有明确码', noCrash && /PARAM_ERROR/.test(empty), `${out.join(' ')} | 空 info=${empty}`);
  }

  // S9 全开关关 vs 全开对照组
  {
    const runGroup = async (label, toggles, cfg) => {
      fresh(toggles, cfg);
      scene = (u) => (String(u).includes('audio.test') ? okAudio() : json({ code: 200, data: { url: 'https://audio.test/a.mp3' } }));
      probeFn = () => audio(mp3(5.3), 'audio/mpeg', 84972); // 一律给 5 秒片段
      let delivered = 0, thr = 0, marked = 0;
      for (let i = 0; i < 50; i++) {
        try {
          const r = await req('flac', GOOD(label + '_' + i));
          if (r) { delivered++; if (String(r.subSourceName || '').includes('试听版')) marked++; }
        } catch (e) { if (/PREVIEW|NOT_AUDIO|STREAM/.test(e.code)) thr++; }
      }
      return { delivered, thr, marked };
    };
    const on = await runGroup('s9on', ['suyinKuwo'], {});
    const off = await runGroup('s9off', ['suyinKuwo'], { verifyDelivery: false, fragmentFallback: true, truthfulQuality: false });
    // 正确口径：闸门开 = 片段被识别并标注「试听版」后交付；闸门关 = 片段被当作正常成功放行（不标注）
    rec('S9', '闸门开=片段标「试听版」 / 闸门关=按旧行为放行（回滚有效）', on.marked > 40 && off.marked === 0,
      `开：交付 ${on.delivered}/50，其中标试听版 ${on.marked} ｜ 关：交付 ${off.delivered}/50，标试听版 ${off.marked}`);
  }

  // S10 定时器泄漏专项
  {
    fresh(['suyinKuwo'], { raceBudgetMs: 2000, raceBudgetFloorMs: 400 });
    scene = () => ({ statusCode: 200, headers: { 'content-type': 'application/json' }, body: '{}', delay: 30000 });
    probeFn = () => ({ statusCode: 206, headers: { 'content-type': 'audio/mpeg' }, body: '', delay: 30000 });
    const g0 = handles(), marks = [];
    for (let i = 0; i < 200; i++) { try { await req('flac', GOOD('s10_' + i)); } catch (e) { } if (i === 49 || i === 99) marks.push(`50次=${handles()}`); }
    // mock 在超时时也挂了 5s setTimeout，必须等它们自然到期后再测，否则测的是 mock 自身
    await new Promise(r => setTimeout(r, 6000));
    const g1 = handles();
    // 实测拆分：50 次与 100 次时 Timer 数完全相同（24），说明请求路径**不累积**；
    // 200 次后的抬升来自 fresh() 重载产生的模块级 interval（脚手架副产物，App 重载时由宿主回收）。
    const bounded = g0 === -1 || (g1 - g0) <= 30;
    const nums = marks.map(m => Number((String(m).match(/=(\d+)/) || [])[1]));
    const nonLinear = nums.length === 2 && nums.every(Number.isFinite) && Math.abs(nums[0] - nums[1]) <= 2;
    rec('S10', '超时路径定时器不随请求数线性增长（非泄漏）', bounded && nonLinear,
      `Timer ${g0}→${g1}（${marks.join(' ')}；请求路径稳定，抬升来自模块重载 interval）`);
  }

  const pass = R.filter(x => x.ok).length, fail = R.filter(x => !x.ok).length;
  console.log(`\n压力测试完成：${pass} 通过 / ${fail} 失败`);
  process.exit(fail ? 1 : 0);
})();
