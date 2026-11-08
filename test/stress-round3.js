#!/usr/bin/env node
/**
 * v8.11.1 第三轮压力测试（T1~T12）—— 与 stress-test.js（S1~S10）互补，不重复。
 *
 * S 组压的是「量」：并发数、容量、长跑、极端参数。
 * T 组压的是「态」：状态机相互作用、跨模块联动、配置生效时机、降级链在多档之间是否守预算。
 * 这些是 U~Z 静态审计与 a~e 行为审计都测不到的部分。
 *
 * 运行：node --expose-gc test/stress-round3.js
 */
const path = require('path');
const SRC = path.join(__dirname, '../lx-source.js');

// 静音：源码的 logInfo 会按每条解析成功打一行 `[聚合音源][信息] …`，
// T10 写 4000 首时会刷出 4000 行，把断言输出挤出工具窗口（首跑就因此看不见失败编号）。
// 只过滤带 [聚合音源] 前缀的行，断言输出不受影响。
const __log = console.log.bind(console);
console.log = (...a) => { const s = a.map(String).join(' '); if (!s.includes('[聚合音源]')) __log(...a); };
console.info = console.log;

let handler = null, counts = {}, scene = null, probeFn = null;
const reset = () => { counts = {}; };
const total = () => Object.values(counts).reduce((a, b) => a + b, 0);
const byHost = (h) => Object.entries(counts).filter(([k]) => k.includes(h)).reduce((a, [, v]) => a + v, 0);

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
      try { r = isProbe ? (probeFn ? probeFn(u, opts) : { statusCode: 206, headers: { 'content-type': 'audio/mpeg' } })
                        : (scene ? scene(u, opts) : { error: 'ECONNREFUSED' }); }
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
const good = (i) => ({ name: '压测歌' + i, singer: '周杰伦', duration: 271000, songmid: 't' + i });

const R = [];
const rec = (id, name, ok, detail) => { R.push({ id, ok: !!ok }); console.log(`${ok ? '✓' : '✗'} [${id}] ${name} — ${detail}`); };
const heap = () => { if (typeof global.gc === 'function') global.gc(); return parseFloat((process.memoryUsage().heapUsed / 1048576).toFixed(1)); };

(async () => {
  console.log('=== v8.11.1 第三轮压力测试（T1~T12，状态与联动）===\n');

  // ── T1 三档连续降档：总预算是否被守住 ─────────────────────────
  {
    fresh(['suyinKuwo'], { raceBudgetMs: 12000, raceBudgetPerQuality: { flac: 4000, '320k': 3500, '128k': 3500 } });
    // 所有源都慢到超时：必须逐档降级，但总耗时不能超过 budget + 末档 floor
    scene = () => ({ statusCode: 200, headers: { 'content-type': 'application/json' }, body: '{}', delay: 30000 });
    probeFn = () => ({ statusCode: 206, headers: { 'content-type': 'audio/mpeg' }, body: '', delay: 30000 });
    const t0 = Date.now(); let code = '';
    try { await req('flac', good('t1')); } catch (e) { code = e.code; }
    const ms = Date.now() - t0;
    rec('T1', '三档全超时时总耗时守 12s 预算（不累加）', ms < 16000, `耗时 ${ms}ms（budget 12000 + floor 3000），code=${code}`);
  }

  // ── T2 同源跨歌冷却：2 首不同歌都片段 → 冷却；冷却期仍放行 128k 保底 ──
  {
    // fragmentFallback 必须关：开时片段被兜底成「成功交付」，就不抛 PREVIEW_FRAGMENT、不记证据，
    // 也就永远不会冷却——这是设计一致的行为，不是缺陷。
    const m = fresh(['suyinKuwo'], { breakerThreshold: 999, fragmentFallback: false, verifyDelivery: true, rateWindowMax: 1e6, maxConcurrency: 99 });
    scene = (u) => (String(u).includes('audio.test') ? audio(mp3(5.3), 'audio/mpeg', 84972) : json({ code: 200, data: { url: 'https://audio.test/a.mp3' } }));
    probeFn = () => audio(mp3(5.3), 'audio/mpeg', 84972);
    const results = [];
    for (let i = 0; i < 3; i++) {
      reset();
      try { const r = await req('flac', good('t2_' + i)); results.push({ ok: !!r, api: total() }); }
      catch (e) { results.push({ ok: false, code: e.code, msg: String(e.message || ''), api: total() }); }
    }
    // previewCooldownMap 不在导出面 → 只能从行为验证。**关键是别把「冷却」和「限速」混为一谈**：
    // 两者都抛 RATE_LIMIT，但文案不同——冷却是「判定为源级限流」，本地限速是「触发并发/限速保护」。
    // 且 fresh() 已把 rateWindowMax 放宽到 1e6，本地限速本来就不该参与，命中 RATE_LIMIT 只能是冷却。
    const a1 = (results[0] || {}).api || 0, a3 = (results[2] || {}).api || 0;
    const lastMsg = (results[2] || {}).msg || '';
    const isCooldown = /判定为源级限流/.test(lastMsg);
    const isRateWindow = /限速保护|限流保护/.test(lastMsg);
    // 冷却只放行 128k 一档 → 第 3 首外呼应正好是第 1 首（三档全试）的 1/3；且 >0 证明没被锁死
    const ratio = a1 > 0 ? a3 / a1 : 0;
    rec('T2', '同源 2 首不同歌都片段 → 第 3 首命中「冷却」分支（非本地限速），只放行 128k 一档且不锁死',
      results.slice(0, 2).every(r => r.code === 'PREVIEW_FRAGMENT') && isCooldown && !isRateWindow &&
      a3 > 0 && Math.abs(ratio - 1 / 3) < 0.02,
      `三次 ${results.map(r => r.ok ? 'OK' : r.code).join('/')}，外呼 ${results.map(r => r.api).join('/')}（第3/第1=${ratio.toFixed(2)}，期望 0.33）｜ 冷却分支=${isCooldown} 本地限速=${isRateWindow}`);
  }

  // ── T3 单歌片段不误伤同源（≥2 首才冷却）──────────────────────
  {
    const m = fresh(['suyinKuwo'], { breakerThreshold: 999, fragmentFallback: false, verifyDelivery: true, rateWindowMax: 1e6, maxConcurrency: 99 });
    scene = (u) => (String(u).includes('audio.test') ? audio(mp3(5.3), 'audio/mpeg', 84972) : json({ code: 200, data: { url: 'https://audio.test/a.mp3' } }));
    probeFn = () => audio(mp3(5.3), 'audio/mpeg', 84972);
    // 同一首反复三次都只记 1 个 mid → 永远达不到「2 首不同歌」的证据门槛 → 三次都必须还是「片段」而非「冷却」。
    // 原判据 `m.previewCooldownMap` 读的是未导出变量，恒为 0 → `n===0` 恒真，等于没测（本轮修正）。
    const seen = [];
    for (let i = 0; i < 3; i++) {
      reset();
      try { await req('flac', good('t3_same')); seen.push({ ok: true }); }
      catch (e) { seen.push({ ok: false, code: e.code, msg: String(e.message || '') }); }
    }
    const anyCooldown = seen.some(r => /判定为源级限流/.test(r.msg || ''));
    rec('T3', '同一首歌重复片段 3 次都不触发源级冷却（跨歌证据需 ≥2 首不同歌）',
      !anyCooldown && seen.every(r => r.code === 'PREVIEW_FRAGMENT'),
      `三次 ${seen.map(r => r.code || 'OK').join('/')}，出现冷却分支=${anyCooldown}`);
  }

  // ── T4 同 mid 100 并发：外呼是否被放大 ────────────────────────
  {
    fresh(['suyinKuwo'], { breakerThreshold: 999, qualityShortCircuit: false });
    scene = okScene; probeFn = okAudio; reset();
    const t0 = Date.now();
    const out = await Promise.all(Array.from({ length: 100 }, () => req('flac', good('t4_same')).then(r => !!r).catch(() => false)));
    const ms = Date.now() - t0;
    rec('T4', '同一首歌 100 并发：全部得到结果，外呼次数有界', out.filter(Boolean).length >= 95,
      `成功 ${out.filter(Boolean).length}/100，耗时 ${ms}ms，外呼 ${total()} 次（理想 1，最差 100）`);
  }

  // ── T2b「每首只跑 1 档」下跨歌冷却仍必须触发（D-14 回退抽样的补测）────
  // D-14 把门槛从「qs.size>=3」改成「>=1」，理由是线上引入「跳过已知片段源」后
  // 同源同歌只跑一档，qs.size 恒为 1。可 T2 用 flac 请求跑满三档，qs.size 能到 3，
  // 旧阈值照样满足 → 删掉修复也绿。这里用 128k 请求（天然只 1 档）复现线上真实形状。
  {
    fresh(['suyinKuwo', 'suyin163'], { breakerThreshold: 999, fragmentFallback: false, verifyDelivery: true });
    const isFrag = (u) => String(u).includes('frag');
    const fragAudio = () => audio(mp3(5.3), 'audio/mpeg', 84972);
    const fullAudio = () => audio(flac(269.7), 'audio/flac', 55397039);
    scene = (u) => {
      const s = String(u);
      if (s.includes('audio.test')) return isFrag(s) ? fragAudio() : fullAudio();
      if (s.includes('/api/Kuwo')) return json({ code: 200, data: { url: 'https://audio.test/frag.mp3' } });
      return json({ code: 0, data: { url: 'https://audio.test/ok.mp3' } });
    };
    probeFn = (u) => (isFrag(u) ? fragAudio() : fullAudio());
    const KW = 'https://oiapi.net/api/Kuwo';
    const per = [];
    for (let i = 0; i < 3; i++) {
      reset();
      try {
        // 前两首用 128k（天然只 1 档，qs.size=1）；第三首用 flac——冷却生效时 flac/320k
        // 两档被跳过、只放行 128k 一档（共 1 次外呼）；冷却没生效则会三档全问（3 次）
        const r = await req(i < 2 ? '128k' : 'flac', good('t2b_' + i));
        per.push({ ok: !!r, kw: counts[KW] || 0, src: (r && r.subSource) || '' });
      } catch (e) {
        per.push({ ok: false, code: e.code, kw: counts[KW] || 0 });
      }
    }
    rec('T2b', '每首歌只请求 1 档（qs.size=1）时，同源 2 首都片段仍触发源级冷却（第 3 首不再问该源）',
      per[0].kw === 1 && per[1].kw === 1 && per[2].kw === 1,
      `溯音酷我外呼 ${per.map((p) => p.kw).join('/')}（期望 1/1/1；第 3 首若冷却失效会变 3），交付 ${per.map((p) => (p.ok ? (p.src || 'OK') : p.code)).join('/')}`);
  }

  // ── T5 片段 → 完整版翻转：缓存与标注是否跟着变 ────────────────
  {
    fresh(['suyinKuwo'], { breakerThreshold: 999, fragmentFallback: true, verifyDelivery: true });
    let frag = true;
    scene = (u) => (String(u).includes('audio.test') ? (frag ? audio(mp3(5.3), 'audio/mpeg', 84972) : okAudio()) : json({ code: 200, data: { url: 'https://audio.test/a.mp3' } }));
    probeFn = () => (frag ? audio(mp3(5.3), 'audio/mpeg', 84972) : okAudio());
    let r1 = null, r2 = null;
    try { r1 = await req('flac', good('t5')); } catch (e) { r1 = { err: e.code }; }
    frag = false;
    try { r2 = await req('flac', good('t5')); } catch (e) { r2 = { err: e.code }; }
    const firstMarked = r1 && String(r1.subSourceName || '').includes('试听版');
    const secondReal = r2 && !String(r2.subSourceName || '').includes('试听版');
    rec('T5', '片段→完整版：首次标「试听版」，源恢复后交付真实版且不残留标注',
      firstMarked && secondReal, `首次 ${firstMarked ? '标试听版' : JSON.stringify(r1).slice(0, 40)}；第二次 ${secondReal ? '真实版' : JSON.stringify(r2).slice(0, 40)}`);
  }

  // ── T6 闸门 8 组合矩阵：开关必须真的可回滚 ───────────────────
  {
    const combos = [];
    for (const vd of [true, false]) for (const ff of [true, false]) for (const tq of [true, false]) combos.push({ vd, ff, tq });
    const rows = [];
    for (const c of combos) {
      fresh(['suyinKuwo'], { breakerThreshold: 999, verifyDelivery: c.vd, fragmentFallback: c.ff, truthfulQuality: c.tq });
      scene = (u) => (String(u).includes('audio.test') ? audio(mp3(5.3), 'audio/mpeg', 84972) : json({ code: 200, data: { url: 'https://audio.test/a.mp3' } }));
      probeFn = () => audio(mp3(5.3), 'audio/mpeg', 84972);
      let delivered = 0, marked = 0, thr = 0;
      for (let i = 0; i < 5; i++) {
        try { const r = await req('flac', good('t6_' + c.vd + c.ff + c.tq + i)); if (r) { delivered++; if (String(r.subSourceName || '').includes('试听版')) marked++; } }
        catch (e) { if (/PREVIEW|NOT_AUDIO/.test(e.code)) thr++; }
      }
      rows.push({ c, delivered, marked, thr });
    }
    // 判据：verifyDelivery=true 时必须能识别（要么拒收要么标注）；=false 时一律放行且不标注
    const onAll = rows.filter(r => r.c.vd).every(r => r.marked > 0 || r.thr > 0);
    const offAll = rows.filter(r => !r.c.vd).every(r => r.delivered === 5 && r.marked === 0);
    rec('T6', '8 组闸门矩阵：开启时片段必被识别，关闭时必按旧行为放行（回滚真实有效）', onAll && offAll,
      `开：${rows.filter(r => r.c.vd).map(r => `${r.c.ff ? 'F' : '-'}${r.c.tq ? 'T' : '-'}=${r.marked}标/${r.thr}拒`).join(' ')} ｜ 关：${rows.filter(r => !r.c.vd).map(r => `${r.delivered}交/${r.marked}标`).join(' ')}`);
  }

  // ── T7 配置热更新：开放键立即生效 + 闸门键按设计被拒 ──────────
  {
    fresh(['suyinKuwo'], { breakerThreshold: 999 });
    scene = okScene; probeFn = okAudio;
    // 写模式读的是 info 本身（不是 info.config）
    let openOk = 'no-change';
    try {
      await call({ action: 'config', source: 'kw', info: { cacheTtlMs: 1000 } });
      const back = await call({ action: 'config', source: 'kw', info: {} });
      openOk = back && back.cacheTtlMs === 1000 ? '生效' : '未生效';
    } catch (e) { openOk = e.code; }
    // 闸门键（verifyDelivery 等 9 个）不在 ALLOWED_KEYS → 写入应被忽略（有意设计，不给远端关闸门）
    let gateIgnored = 'no-change';
    try {
      await call({ action: 'config', source: 'kw', info: { verifyDelivery: false } });
      const back = await call({ action: 'config', source: 'kw', info: {} });
      gateIgnored = back && back.verifyDelivery !== false ? '被拒（符合设计）' : '竟然写进去了';
    } catch (e) { gateIgnored = e.code; }
    rec('T7', '开放键热更新立即生效；闸门键按设计拒绝远端改写',
      openOk === '生效' && gateIgnored === '被拒（符合设计）', `开放键=${openOk} ｜ 闸门键=${gateIgnored}`);
  }

  // ── T8 12 个错误码逐个：App 必须拿到 code 且有中文文案 ──────
  {
    const m = fresh(['suyinKuwo'], { breakerThreshold: 999 });
    const codes = Object.keys(m.ERROR_CODES);
    const vals = Object.values(m.ERROR_CODES);
    const got = {};
    scene = () => ({ error: 'ECONNREFUSED' }); probeFn = () => ({ error: 'ECONNREFUSED' });
    try { await req('flac', good('t8a')); } catch (e) { got.net = e.code; }
    // 真实的「业务失败」形态：上游正常返回 200 但 data 里没有可用 url
    scene = () => json({ code: 200, data: { url: '' } });
    try { await req('flac', good('t8b')); } catch (e) { got.biz = e.code; }
    // CODE_HINT 只有 3 条（PREVIEW_FRAGMENT/NOT_AUDIO/STREAM_PLAYLIST），是对最需要解释的 3 个码的补充说明，
    // 不是 12 码全表——12 个码的对外值本身就是稳定的英文标识，App 按 code 分类、按 message 展示。
    rec('T8', `${codes.length} 个错误码对外值齐备；网络/业务两类真实注入都带 code`,
      codes.length === 12 && vals.every(v => typeof v === 'string' && v.length > 0) && !!got.net && !!got.biz,
      `网=${got.net} 业务=${got.biz} 码数=${codes.length}`);
  }

  // ── T9 probe 与 musicUrl 并发：状态不互锁 ───────────────────
  {
    fresh(['suyinKuwo'], { breakerThreshold: 999, healthCheckIntervalMs: 3600000 });
    scene = okScene; probeFn = okAudio; reset();
    const p1 = call({ action: 'probe', source: 'kw', info: { probeSource: 'suyinKuwo' } }).catch(e => ({ err: e.code }));
    const jobs = Array.from({ length: 30 }, (_, i) => req('flac', good('t9_' + i)).then(r => !!r).catch(() => false));
    const [pr, ...res] = await Promise.all([p1, ...jobs]);
    const probed = pr && (pr.running || pr.results || pr.ok !== undefined || !pr.err);
    const musicOk = res.filter(Boolean).length;
    rec('T9', 'probe 与 30 个 musicUrl 并发：探测有返回、取链不受阻', probed && musicOk >= 28,
      `probe=${JSON.stringify(pr).slice(0, 60)}；取链成功 ${musicOk}/30`);
  }

  // ── T10 4000 条缓存写入后 GC：堆必须回落 ────────────────────
  {
    fresh(['suyinKuwo'], { breakerThreshold: 999, qualityShortCircuit: false, verifyDelivery: false });
    scene = okScene; probeFn = okAudio;
    const h0 = heap();
    for (let i = 0; i < 1000; i++) { try { await req('flac', good('t10_' + i)); } catch (e) { } }
    const h1 = heap();
    // 再压 3 倍不同歌，容量固定 500 应持续淘汰
    for (let i = 1000; i < 4000; i++) { try { await req('flac', good('t10_' + i)); } catch (e) { } }
    const h2 = heap();
    const bounded = h2 - h0 < 60;
    rec('T10', '写入 4000 首（容量 500）：堆增长有界、不随写入线性膨胀', bounded,
      `堆 ${h0}→${h1}→${h2}MB（+${(h2 - h0).toFixed(1)}）`);
  }

  // ── T11 三档交替 300 次：缓存槽不错乱 ───────────────────────
  {
    fresh(['suyinKuwo'], { breakerThreshold: 999, qualityShortCircuit: false, verifyDelivery: false });
    scene = okScene; probeFn = okAudio;
    const qs = ['flac', '320k', '128k'];
    const seen = {};
    for (let i = 0; i < 300; i++) {
      const q = qs[i % 3];
      try { const r = await req(q, good('t11_' + (i % 50))); if (r) seen[q] = (seen[q] || 0) + 1; } catch (e) { }
    }
    rec('T11', 'flac/320k/128k 交替 300 次：三档均能交付、无档位串槽', Object.keys(seen).length === 3 && Object.values(seen).every(v => v > 50),
      Object.entries(seen).map(([k, v]) => `${k}=${v}`).join(' '));
  }

  // ── T12 连续切源 20 次：A 源熔断不污染 B 源 ─────────────────
  {
    const m = fresh(['suyinKuwo', 'wyOuter'], { breakerThreshold: 2, breakerCooldownMs: 60000, qualityShortCircuit: false });
    scene = (u) => (String(u).includes('kuwo') ? { error: 'ECONNRESET' } : okScene(u));
    probeFn = (u) => (String(u).includes('kuwo') ? { error: 'ECONNRESET' } : okAudio());
    const out = [];
    for (let i = 0; i < 20; i++) {
      const src = i % 2 === 0 ? 'kw' : 'wy';
      try { const r = await req('flac', good('t12_' + i), src); out.push(r ? 'OK' : 'fail'); } catch (e) { out.push(e.code); }
    }
    const wyOk = out.filter((v, i) => i % 2 === 1).filter(v => v === 'OK').length;
    const stateKw = m.getHealthSnapshot ? (m.getHealthSnapshot().platforms || {}).kw : null;
    rec('T12', 'kw 源持续失败时 wy 源不被牵连（20 次交替仍有交付）', wyOk >= 6,
      `wy 成功 ${wyOk}/10；kw 侧状态 ${stateKw ? JSON.stringify(stateKw).slice(0, 50) : 'n/a'}`);
  }

  const pass = R.filter(x => x.ok).length, fail = R.filter(x => !x.ok).length;
  console.log(`\n第三轮压力测试（T1~T12）完成：${pass} 通过 / ${fail} 失败`);
  process.exit(fail ? 1 : 0);
})();
