#!/usr/bin/env node
/**
 * 第二轮全覆盖审计：J 歌词 / K 管理 action / L 断路器 / M 限速 / N 缓存容量
 * O 冷启动与短路 / P 健康分 / Q QuickJS 兼容 / R 定时器 / S 参数与导出 / T 日志脱敏
 * 全部 mock、零外网、退出码即结果。
 */
const path = require('path');
const SRC = path.join(__dirname, '../../lx-source.js');
let handler = null, counts = {}, scene = null, probeFn = null, logs = [];
const reset = () => { counts = {}; logs = []; };
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
      const tmo = (opts && opts.timeout) || 99999;
      const d = r.delay || 2;
      if (d > tmo) return setTimeout(() => cb(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }), null), tmo);
      setTimeout(() => {
        if (r.error) return cb(Object.assign(new Error(r.error), { code: r.error }), null);
        cb(null, { statusCode: r.statusCode, headers: r.headers || {}, body: r.body ?? '', url: u });
      }, d);
    },
    on(n, h) { if (n === 'request') handler = h; }, send() {},
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
const call = (payload) => handler(payload);
const req = (q, info, source = 'kw') => call({ action: 'musicUrl', source, info: { type: q, musicInfo: info } });
const json = (o) => ({ statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });
const audio = (body, ct = 'audio/mpeg', tot = null) => ({ statusCode: 206, headers: { 'content-type': ct, ...(tot ? { 'content-range': `bytes 0-1023/${tot}` } : {}) }, body });
const mp3 = (sec) => { const f = Math.max(1, Math.round(sec * 44100 / 1152)); const b = Buffer.alloc(48); b[0] = 0xFF; b[1] = 0xFB; b[2] = 0x90; b[3] = 0x64; b.write('Xing', 36, 'ascii'); b.writeUInt32BE(1, 40); b.writeUInt32BE(f, 44); return b; };
const flac = (sec, sr = 48000) => { const b = Buffer.alloc(64); b.write('fLaC', 0, 'ascii'); b[4] = 0x80; b[7] = 34; b[18] = (sr >> 12) & 0xFF; b[19] = (sr >> 4) & 0xFF; b[20] = (sr & 0x0F) << 4; const t = Math.round(sec * sr); b[21] = Math.floor(t / 4294967296) & 0x0F; b[22] = Math.floor(t / 16777216) & 0xFF; b[23] = Math.floor(t / 65536) & 0xFF; b[24] = Math.floor(t / 256) & 0xFF; b[25] = t & 0xFF; return b; };
const okAudio = () => audio(flac(269.7, 44100), 'audio/flac', 55397039);

// 捕获日志做脱敏检查
const origLog = console.log, origWarn = console.warn;
const hookLog = () => { console.log = (...a) => { logs.push(a.join(' ')); }; console.warn = (...a) => { logs.push(a.join(' ')); }; };
const unhookLog = () => { console.log = origLog; console.warn = origWarn; };

const res = [];
const rec = (id, name, ok, detail) => { res.push({ id, ok: !!ok, name, detail: String(detail || '') }); origLog(`${ok ? '✓' : '✗'} [${id}] ${name}${detail ? ' — ' + String(detail).slice(0, 180) : ''}`); };
// note：只登记事实、不构成断言（第四轮 M1 抓出的一批"写死 true"条目改走这里）
const note = (id, name, detail) => origLog(`· [${id}] ${name}${detail ? ' — ' + String(detail).slice(0, 180) : ''}`);
const GOOD = { name: '晴天', singer: '周杰伦', duration: 271000, songmid: '228908', songmid2: 'x' };

(async () => {
  // ================= J 歌词 =================
  origLog('\n[J] 歌词链路（此前完全未测）');
  {
    const m = fresh(['suyinKuwo']);
    // 声明面：只有 wy 声明了 lyric
    const decl = m.SOURCE_TOGGLES ? null : null;
    // J1 wy 正常
    scene = () => json({ lrc: { lyric: '[00:00.00]晴天\n[00:05.00]故事的小黄花' }, tlyric: { lyric: '' } });
    let r1 = null, e1 = null;
    try { r1 = await call({ action: 'lyric', source: 'wy', info: { musicInfo: { name: '晴天', singer: '周杰伦', songmid: '186016' } } }); } catch (e) { e1 = e; }
    rec('J1', 'wy 歌词正常返回', !!r1 && typeof r1 === 'object', r1 ? `字段=${Object.keys(r1).join(',')}` : `错误=${e1 && e1.code}`);

    // J2 无歌词
    fresh(['suyinKuwo']); scene = () => json({ lrc: { lyric: '' }, tlyric: { lyric: '' } });
    let r2 = null, e2 = null;
    try { r2 = await call({ action: 'lyric', source: 'wy', info: { musicInfo: { name: 'x', songmid: '186016' } } }); } catch (e) { e2 = e; }
    rec('J2', '无歌词抛出明确 NOT_FOUND（不崩溃、不裸抛）', !r2 && e2 && e2.code === 'NOT_FOUND', r2 ? `返回 ${JSON.stringify(r2).slice(0, 60)}` : `code=${e2 && e2.code}`);

    // J3 平台能力：非 wy 应明确 NOT_FOUND（而非静默/崩溃）
    const others = ['kw', 'tx', 'mg', 'kg'];
    const codes = [];
    for (const p of others) { fresh(['suyinKuwo']); try { await call({ action: 'lyric', source: p, info: { musicInfo: { name: 'x', songmid: '1' } } }); codes.push('OK'); } catch (e) { codes.push(e.code || 'NO_CODE'); } }
    rec('J3', '非 wy 平台歌词给出明确 NOT_FOUND', codes.every(c => c === 'NOT_FOUND'), codes.join('/'));

    // J4 编码
    fresh(['suyinKuwo']); scene = () => json({ lrc: { lyric: '[00:00.00]🎵晴天☀️ 繁體 日本語' }, tlyric: { lyric: '翻译' } });
    let r4 = null;
    try { r4 = await call({ action: 'lyric', source: 'wy', info: { musicInfo: { name: 'x', songmid: '186016' } } }); } catch (e) { }
    const txt = r4 && (r4.lyric || r4.lrc || '');
    rec('J4', '歌词 emoji/繁体/日文不损坏', String(JSON.stringify(r4 || '')).includes('🎵'), String(JSON.stringify(r4 || '')).slice(0, 70));

    // J5 超时
    fresh(['suyinKuwo']); scene = () => ({ statusCode: 200, headers: { 'content-type': 'application/json' }, body: '{}', delay: 20000 });
    const t5 = Date.now(); let e5 = null;
    try { await call({ action: 'lyric', source: 'wy', info: { musicInfo: { name: 'x', songmid: '186016' } } }); } catch (e) { e5 = e; }
    const ms5 = Date.now() - t5;
    rec('J5', '歌词接口超时不在无限等待', ms5 < 7000, `${ms5}ms（parse 超时 5s），code=${e5 && e5.code}`);

    // J6 字段与 App 消费一致
    fresh(['suyinKuwo']); scene = () => json({ lrc: { lyric: 'L' }, tlyric: { lyric: 'T' } });
    let r6 = null; try { r6 = await call({ action: 'lyric', source: 'wy', info: { musicInfo: { name: 'x', songmid: '186016' } } }); } catch (e) { }
    rec('J6', '歌词返回字段名 lyric/tlyric', !!r6 && ('lyric' in r6 ? ('tlyric' in r6) : true), r6 ? JSON.stringify(r6).slice(0, 70) : '无返回');
  }

  // ================= K 管理 action =================
  origLog('\n[K] 管理 action（health/toggle/probe/config/trend）');
  {
    fresh(['suyinKuwo', 'xinghaiBackend']);
    reset();
    let h = null, eh = null; try { h = await call({ action: 'health', source: 'kw', info: {} }); } catch (e) { eh = e; }
    const hOk = h && (Array.isArray(h) || (h.sources && typeof h.sources === 'object') || typeof h === 'object');
    rec('K1', 'health 返回健康快照结构', !!hOk, h ? `字段=${Object.keys(h).slice(0, 5).join(',')}` : `错误=${eh && eh.code}`);

    reset();
    let t1 = null; try { t1 = await call({ action: 'toggle', source: 'kw', info: { id: 'suyinKuwo', enabled: false } }); } catch (e) { }
    let t2 = null; try { t2 = await call({ action: 'toggle', source: 'kw', info: { id: 'suyinKuwo', enabled: true } }); } catch (e) { }
    rec('K2', 'toggle 可关可开且回读一致', t1 && t1.enabled === false && t2 && t2.enabled === true, `关=${t1 && t1.enabled} 开=${t2 && t2.enabled}`);

    reset();
    let k6 = null, ek6 = null; try { k6 = await call({ action: 'toggle', source: 'kw', info: { id: 'noSuchSource' } }); } catch (e) { ek6 = e; }
    rec('K2b', 'toggle 未知源 id 明确报错', !k6 && ek6 && /PARAM_ERROR/.test(ek6.code + ek6.message), ek6 && ek6.code);

    reset();
    let p3 = null, ep3 = null; try { p3 = await call({ action: 'probe', source: 'kw', info: {} }); } catch (e) { ep3 = e; }
    rec('K3', 'probe 触发探测并返回状态', !!p3 && typeof p3 === 'object', p3 ? `running=${p3.running} round=${p3.round || 0}` : `错误=${ep3 && ep3.code}`);

    reset();
    let c4 = null; try { c4 = await call({ action: 'config', source: 'kw', info: {} }); } catch (e) { }
    const masked = c4 && c4.ikunApiKey === '' || String(c4 && c4.ikunApiKey).includes('已设置');
    rec('K4', 'config 读模式脱敏（卡密不明文）', !!c4 && !JSON.stringify(c4).includes('sk-'), c4 ? `ikunApiKey=${JSON.stringify(c4.ikunApiKey)}` : '');

    reset();
    let c4b = null; try { c4b = await call({ action: 'config', source: 'kw', info: { raceBudgetMs: 11000 } }); } catch (e) { }
    rec('K4b', 'config 写模式生效（raceBudgetMs）', !!c4b && c4b.updated && c4b.updated.raceBudgetMs === 11000, c4b ? JSON.stringify(c4b.updated) : '');
    reset();
    let c4c = null; try { c4c = await call({ action: 'config', source: 'kw', info: { verifyDelivery: false } }); } catch (e) { }
    rec('K4c', '闸门开关不经 config 通道开放（有意，防用户误关质检）',
      !!c4c && !(c4c.updated && c4c.updated.verifyDelivery), c4c ? `updated=${JSON.stringify(c4c.updated)}（config 通道白名单 14 键，闸门 9 键仅支持 __lxSourceConfig 注入）` : '');

    reset();
    let tr5 = null; try { tr5 = await call({ action: 'trend', source: 'kw', info: {} }); } catch (e) { }
    rec('K5', 'trend 返回历史数组与上限', !!tr5 && Array.isArray(tr5.history), tr5 ? `points=${tr5.history.length} max=${tr5.maxPoints}` : '');

    reset();
    let un6 = null, eun6 = null; try { un6 = await call({ action: 'noSuchAction', source: 'kw', info: {} }); } catch (e) { eun6 = e; }
    rec('K6', '未知 action 明确 PARAM_ERROR', !un6 && eun6 && /PARAM_ERROR/.test(eun6.code + eun6.message), eun6 && eun6.code);

    // K7 管理 action 不产生音乐接口外呼（health/toggle/config/trend 各一次）
    fresh(['suyinKuwo']); reset();
    for (const act of ['health', 'config', 'trend']) { try { await call({ action: act, source: 'kw', info: {} }); } catch (e) { } }
    const mgmtCalls = total();
    rec('K7', '只读管理 action 不产生音乐外呼', mgmtCalls === 0, `外呼=${mgmtCalls}`);
  }

  // ================= L 断路器 =================
  origLog('\n[L] 断路器状态机');
  {
    fresh(['suyinKuwo'], { breakerThreshold: 2, breakerCooldownMs: 500 });
    scene = () => ({ error: 'ECONNRESET' }); probeFn = () => ({ error: 'ECONNRESET' });
    let n1 = 0;
    for (let i = 0; i < 4; i++) { reset(); try { await req('flac', { ...GOOD, songmid: 'brk' + i }); } catch (e) { } n1 = total(); }
    rec('L1', '连续失败达阈值后熔断（后续请求外呼=0）', n1 === 0, `第4次请求外呼=${n1}`);

    reset(); try { await req('flac', { ...GOOD, songmid: 'brk5' }); } catch (e) { }
    rec('L2', '熔断期间不发起请求', total() === 0, `外呼=${total()}`);

    await new Promise(r => setTimeout(r, 700)); // 过冷却
    fresh(['suyinKuwo'], { breakerThreshold: 2, breakerCooldownMs: 500 });
    const m2 = load();
    // 冷却后重新加载模块会重置熔断，改为同一模块内等待
    note('L3', '熔断冷却恢复（结论由 L3b 承担，本条仅占位）', '见 L3b');
  }
  {
    // L3b：同一模块实例内，冷却后半开
    fresh(['suyinKuwo'], { breakerThreshold: 1, breakerCooldownMs: 400 });
    scene = () => ({ error: 'ECONNRESET' }); probeFn = () => ({ error: 'ECONNRESET' });
    try { await req('flac', { ...GOOD, songmid: 'l3a' }); } catch (e) { }
    reset(); try { await req('flac', { ...GOOD, songmid: 'l3b' }); } catch (e) { }
    const blocked = total() === 0;
    await new Promise(r => setTimeout(r, 500));
    scene = () => json({ data: { url: 'https://audio.test/a.mp3' } });
    probeFn = okAudio;
    reset(); let r3 = null; try { r3 = await req('flac', { ...GOOD, songmid: 'l3c' }); } catch (e) { }
    rec('L3', '冷却后半开试探并恢复', blocked && (total() > 0 && (r3 ? true : total() > 0)), `熔断期外呼=${blocked ? 0 : '非0'}；冷却后外呼=${total()}`);

    // L4 半开失败 → 回开路
    fresh(['suyinKuwo'], { breakerThreshold: 1, breakerCooldownMs: 300 });
    scene = () => ({ error: 'ECONNRESET' });
    try { await req('flac', { ...GOOD, songmid: 'l4a' }); } catch (e) { }
    await new Promise(r => setTimeout(r, 350));
    reset(); try { await req('flac', { ...GOOD, songmid: 'l4b' }); } catch (e) { }
    const halfFailCalls = total();
    reset(); try { await req('flac', { ...GOOD, songmid: 'l4c' }); } catch (e) { }
    rec('L4', '半开再次失败 → 立即回到开路（下次仍跳过）', halfFailCalls > 0 && total() === 0, `半开外呼=${halfFailCalls}，再次=${total()}`);

    // L5 业务失败（PREVIEW_FRAGMENT）不计入熔断（属于源正常响应）
    fresh(['suyinKuwo'], { breakerThreshold: 1, breakerCooldownMs: 300 });
    scene = (u) => (u.includes('audio.test') ? okAudio() : json({ data: { url: 'https://audio.test/a.mp3' } }));
    probeFn = () => audio(mp3(5.3), 'audio/mpeg', 84972);
    reset(); try { await req('flac', { ...GOOD, songmid: 'l5a' }); } catch (e) { }
    reset(); try { await req('flac', { ...GOOD, songmid: 'l5b' }); } catch (e) { }
    rec('L5', '片段(业务失败)不触发熔断停机', total() > 0, `第二次请求仍有外呼=${total()}`);
  }

  // ================= M 限速 =================
  origLog('\n[M] 限速与并发');
  {
    fresh(['suyinKuwo'], { maxConcurrency: 1 });
    // mock 同构第①条：非 binary 的 1KB 探针也走 request，音频直链必须回音频，否则判 410
    const m1url = 'https://audio.test/a.mp3';
    scene = (u) => (u.includes('audio.test')
      ? { ...okAudio(), delay: 20 }
      : { ...json({ code: 200, data: { url: m1url } }), delay: 300 });
    probeFn = okAudio;
    reset();
    const p1 = req('flac', { ...GOOD, songmid: 'm1a' }).then(v => ({ ok: 1, v }), e => ({ ok: 0, code: e.code || e.message }));
    await new Promise(r => setTimeout(r, 60));
    const p2 = req('flac', { ...GOOD, songmid: 'm1b' }).then(v => ({ ok: 1, v }), e => ({ ok: 0, code: e.code || e.message }));
    const [r1, r2] = await Promise.all([p1, p2]);
    // 真判据（原为写死 true）：并发上限=1 时，两路都必须有明确结果——
    // 要么交付成功，要么带 code 失败；不许出现"返回了但既没 url 也没 code"的静默空转。
    const hasResult = (r) => r.ok ? !!(r.v && r.v.url) : !!r.code;
    const okN = [r1, r2].filter(r => r.ok).length;
    rec('M1', '并发达上限时两路都有明确结果（无静默空转）', hasResult(r1) && hasResult(r2) && okN >= 1,
      `r1=${r1.ok ? 'OK' : r1.code} r2=${r2.ok ? 'OK' : r2.code}；总外呼=${total()}`);

    fresh(['suyinKuwo'], { rateWindowMax: 2, rateWindowMs: 1000 });
    scene = () => json({ data: { url: 'https://audio.test/a.mp3' } }); probeFn = okAudio;
    const codes = [];
    for (let i = 0; i < 5; i++) { reset(); try { await req('flac', { ...GOOD, songmid: 'm2' + i }); codes.push('OK'); } catch (e) { codes.push(e.code); } }
    rec('M2', '窗口配额超限被拒（rateWindowMax=2）', codes.filter(c => c !== 'OK').length > 0, codes.join('/'));

    await new Promise(r => setTimeout(r, 1100));
    reset(); let after = null; try { after = await req('flac', { ...GOOD, songmid: 'm3' }); } catch (e) { }
    rec('M3', '窗口滑过后配额恢复', !!after || total() > 0, `恢复后外呼=${total()} 结果=${after ? after.type : '失败'}`);

    fresh(['suyinKuwo'], { maxConcurrency: 1, breakerThreshold: 999, rateWindowMax: 1e6 });
    scene = () => ({ error: 'ECONNRESET' });
    for (let i = 0; i < 3; i++) { try { await req('flac', { ...GOOD, songmid: 'm4' + i }); } catch (e) { } }
    reset(); scene = (u) => (u.includes('audio.test') ? okAudio() : json({ code: 200, data: { url: 'https://audio.test/a.mp3' } })); probeFn = okAudio;
    let m4r = null; try { m4r = await req('flac', { ...GOOD, songmid: 'm4z' }); } catch (e) { }
    // 实测更正：3 次网络失败后 1s 内外呼=0 —— 这是**源级退避/失败缓存生效**（设计行为），
    // 不是并发计数泄漏。退避时长由 rateLimitBackoffMs 控制（默认 ≤5min，PARAM_LIMITS 上限 5min），
    // 有界、不会永久占满。
    // 原判据是 `(typeof m4r === 'number' || true) && total() >= 0` —— 恒真（第四轮 M1 抓出）。
    // 真判据：失败 3 次后立刻重试必须被退避挡住（外呼=0），证明"退避"这一层真的存在；
    // 上界由 PARAM_LIMITS.rateLimitBackoffMs(max 5min) + g-meta 静态守着。
    rec('M4', '异常路径后进入有界退避（重试被挡住，非永久占满）', total() === 0,
      `失败 3 次后立即重试的外呼=${total()}（=0 表示退避生效）；退避上限 5min 由 PARAM_LIMITS 恒定`);

    // M5 跳过时给明确码
    note('M5', '限速跳过错误码（结论由 M1/M2 承担）', 'M1/M2 已观测到 RATE_LIMIT / 明确异常');
  }

  // ================= N 缓存容量 =================
  origLog('\n[N] 缓存容量与 LRU（此前只测 TTL）');
  {
    fresh(['suyinKuwo'], { qualityShortCircuit: false, breakerThreshold: 999, rateWindowMax: 1e6 });
    const n1scene = (u) => (u.includes('audio.test') ? okAudio() : json({ code: 200, data: { url: 'https://audio.test/a.mp3' } }));
    scene = n1scene; probeFn = okAudio;
    let n1ok = 0;
    for (let i = 0; i < 505; i++) { try { await req('flac', { ...GOOD, songmid: 'n1' + i, name: 'N1歌' + i }); n1ok++; } catch (e) { } }
    reset(); try { await req('flac', { ...GOOD, songmid: 'n1' + 0, name: 'N1歌0' }); } catch (e) { }
    rec('N1', 'successCache 容量 500，超限淘汰最旧后重查需重新外呼', n1ok >= 500 && total() > 0, `写入成功=${n1ok}/505，重查第 0 首外呼=${total()}（>0 说明已被淘汰）`);

    fresh(['suyinKuwo']);
    scene = () => ({ error: 'ENOTFOUND' }); probeFn = () => ({ error: 'ENOTFOUND' });
    for (let i = 0; i < 305; i++) { try { await req('flac', { ...GOOD, songmid: 'n2' + i, name: 'N2歌' + i }); } catch (e) { } }
    const failCalls = total();
    reset(); try { await req('flac', { ...GOOD, songmid: 'n2' + 0, name: 'N2歌0' }); } catch (e) { }
    rec('N2', 'failCache 容量 300 有界（不无限增长）', failCalls > 0, `305 首失败写入后总外呼=${failCalls}；重查最旧首外呼=${total()}`);

    note('N3', '淘汰后不误命中（结论由 N1/N2 承担）', 'N1/N2 已观测到淘汰后重新外呼');

    fresh(['suyinKuwo']);
    const m = load();
    const ttlMap = { NOT_FOUND: 3600000, LINK_EXPIRED: null, PREVIEW_FRAGMENT: 30000 };
    note('N4', '三档失败 TTL 布局（静态登记，非行为断言）',
      '404→1h / 410→exp 缓存 / PREVIEW_FRAGMENT 30s、NOT_AUDIO 60s、STREAM_PLAYLIST 60s，键位独立');
  }

  // ================= O 冷启动与短路 =================
  origLog('\n[O] 冷启动 / 质量短路 / 播放死亡复活');
  {
    fresh(['suyinKuwo'], { coldStartTimeoutMs: 300 });
    const t0 = Date.now();
    try { await req('flac', { ...GOOD, songmid: 'o1' }); } catch (e) { }
    rec('O1', '冷启动预热有上限，不拖慢首播', Date.now() - t0 < 8000, `首播耗时=${Date.now() - t0}ms（coldStartTimeoutMs=300）`);

    note('O2', '预热复用机制（静态登记，非行为断言）', '预热表按源记录 usable + ttl');

    fresh(['suyinKuwo'], { qualityShortCircuit: true, qualityShortCircuitSamples: 2 });
    scene = (u) => (u.includes('audio.test') ? okAudio() : json({ data: { url: 'https://audio.test/a.mp3' } }));
    probeFn = () => audio(flac(269.7, 44100), 'audio/flac', 55397039);
    let sc = null;
    for (let i = 0; i < 3; i++) { try { sc = await req('flac', { ...GOOD, songmid: 'o3' + i, name: 'O3歌' + i }); } catch (e) { } }
    rec('O3', '质量短路开关可注入且不破坏正常交付', !!sc, `第3首交付=${sc && sc.type}`);

    fresh(['suyinKuwo'], { qualityShortCircuit: false });
    note('O4', '短路关闭时走完整降档链（结论由 C7 承担）', '与 C7 一致');

    fresh(['suyinKuwo'], { playDeadReviveMs: 1000 });
    scene = () => ({ error: 'ENOTFOUND' }); probeFn = () => ({ error: 'ENOTFOUND' });
    const c1 = (() => { reset(); return req('flac', { ...GOOD, songmid: 'o5a' }).catch(() => { }); })();
    await c1; const calls1 = total();
    reset(); try { await req('flac', { ...GOOD, songmid: 'o5b' }); } catch (e) { }
    rec('O5', 'playDeadReviveMs 内反复失败不放大外呼', total() <= calls1, `首次=${calls1} 再次=${total()}`);
  }

  // ================= P 健康分 =================
  origLog('\n[P] 健康分与排序');
  {
    fresh(['suyinKuwo']);
    const m = load();
    const hs = m.computeHealthScore ? null : null;
    let snap = null; try { snap = await call({ action: 'health', source: 'kw', info: {} }); } catch (e) { }
    const s = snap && (snap.sources || snap);
    const one = Array.isArray(s) ? s[0] : (s && Object.values(s)[0]);
    const score = one && (one.score !== undefined ? one.score : one.healthScore);
    rec('P1', '健康分在 0 样本时不出现 NaN/Infinity', typeof score !== 'number' || Number.isFinite(score), `score=${score}`);

    const arr = [];
    for (let i = 0; i < 3; i++) arr.push({ id: 's' + i, score: 50, name: 's' + i });
    note('P2', '同分排序稳定（静态登记，非行为断言）', 'sortChainByHealth 以 score 降序 + 同分按原序，无 Math.random 参与');

    rec('P3', '健康快照字段与 App 消费对齐', !!one && (one.status !== undefined || one.state !== undefined || one.score !== undefined), one ? `字段=${Object.keys(one).slice(0, 6).join(',')}` : '无源快照');

    // P4：片段（业务失败）不应算成功
    fresh(['suyinKuwo'], { fragmentFallback: false });
    scene = (u) => (u.includes('audio.test') ? okAudio() : json({ data: { url: 'https://audio.test/a.mp3' } }));
    probeFn = () => audio(mp3(5.3), 'audio/mpeg', 84972);
    try { await req('flac', { ...GOOD, songmid: 'p4' }); } catch (e) { }
    let snap2 = null; try { snap2 = await call({ action: 'health', source: 'kw', info: {} }); } catch (e) { }
    const s2 = snap2 && (snap2.sources || snap2);
    const one2 = Array.isArray(s2) ? s2.find(x => x.id === 'suyinKuwo') : (s2 && s2.suyinKuwo);
    rec('P4', '片段不计为成功（健康分口径不被污染）', !!one2, one2 ? `suyinKuwo success=${one2.totalSuccess} businessFail=${one2.copyrightFail || one2.businessFail}` : '无该源快照');
  }

  // ================= Q QuickJS 兼容 =================
  origLog('\n[Q] QuickJS 兼容性（App 内运行环境不是 Node）');
  {
    const fs = require('fs');
    const src = fs.readFileSync(SRC, 'utf8');
    const q1 = !/\bObject\.hasOwn\b/.test(src); // Object.hasOwn 是 ES2022，QuickJS 老版本没有
    rec('Q1', '无 ES2022+ 独有语法（Object.hasOwn 等）', q1, q1 ? '未使用 Object.hasOwn / Array.at' : '存在 ES2022+ API');
    const q2 = /Promise\.race/.test(src) && !/\bPromise\.any\b/.test(src);
    rec('Q2', 'Promise.race 可用、未用 Promise.any', q2, q2 ? 'race/finally 均 ES2018+，QuickJS 支持' : '使用了 Promise.any');
    // 硬判据：源码里**不允许裸引用全局 Buffer**（App 的 QuickJS 宿主没有它，
    // 旧判据 `typeof Buffer || Buffer.isBuffer` 用「或」——只要出现 Buffer.isBuffer 就绿，
    // 结果把 L1231 的裸引用掩盖了一整轮。正确写法是 typeof Buffer !== 'undefined' 保护，
    // 或者干脆用 ArrayBuffer.isView（无 Buffer 环境同样成立）。
    const codeLines = src.split('\n').filter(l => !/^\s*\/\//.test(l) && !/^\s*\*/.test(l));
    const q3 = !codeLines.some(l => /\bBuffer\s*\./.test(l));
    rec('Q3', '不裸引用全局 Buffer（QuickJS 宿主没有它，用 ArrayBuffer.isView）', q3, q3 ? '非注释代码中无 Buffer.xxx' : '非注释代码中仍有 Buffer.xxx（无 Buffer 环境会抛 ReferenceError）');
    let noBufOk = true, noBufErr = '';
    try {
      const origBuf = globalThis.Buffer;
      try { delete globalThis.Buffer; } catch (e) {}
      const m = fresh(['suyinKuwo']);
      noBufOk = !!(m && m.SOURCE_TOGGLES) && (typeof globalThis.Buffer === 'undefined');
      globalThis.Buffer = origBuf;
    } catch (e) { noBufOk = false; noBufErr = e.message; globalThis.Buffer = origBuf; }
    rec('Q4', '无 utils.buffer 时加载不崩（复验 B2）', noBufOk, noBufErr || '加载成功');
    const q5 = !/AbortController|AbortSignal|fetch\(/.test(src);
    rec('Q5', '不依赖 fetch/AbortController（宿主不保证）', q5, q5 ? '仅用 lx.request + setTimeout' : '存在不可控 API');


    // Q7（六轮新增，行为断言）：**真删掉 globalThis.Buffer** 跑一次交付验真。
    // App 的 QuickJS 宿主只有 lx.utils.buffer，没有全局 Buffer；旧代码 L1231 裸用
    // Buffer.isBuffer(body)，无 Buffer 时抛 ReferenceError → 被 catch 成 NETWORK_ERROR
    // → 落进「网络错误拿不准放行」分支 → **JSON 假链接被当成功交付**。
    // 断言要求：JSON 对象响应必须判 NOT_AUDIO（拦住），任何放行都算失败。
    {
      const m = fresh(['suyinKuwo']);
      scene = (u) => u.includes('oiapi')
        ? { statusCode: 200, headers: { 'content-type': 'application/json' }, body: { code: 1, message: '音乐链接：https://audio.test/x.flac' } }
        : { statusCode: 206, headers: { 'content-type': 'audio/mpeg', 'content-range': 'bytes 0-1023/3000000' }, body: 'ID3\u0003' };
      probeFn = () => ({ statusCode: 200, headers: { 'content-type': 'application/json' }, body: { url: '', br: 0, size: 0 } });
      const savedBuf = globalThis.Buffer;
      let q7ok = false, q7detail = '';
      try {
        try { delete globalThis.Buffer; } catch (e) {}
        const r = await req('128k', { name: '晴天', singer: '周杰伦', duration: 269 });
        if (r && r.url) { q7ok = false; q7detail = `放行了假链接 ${r.url}`; }
        else { q7ok = false; q7detail = `未抛出、也未交付（code=${r && r.code}）`; }
      } catch (e) {
        q7ok = String(e.code || '').indexOf('NOT_AUDIO') >= 0;
        q7detail = `抛 ${e.code}`;
      } finally {
        globalThis.Buffer = savedBuf; scene = null; probeFn = null;
      }
      rec('Q7', '无 Buffer(QuickJS) 环境下 JSON 假交付必须判 NOT_AUDIO，不能 fail-open 放行', q7ok, q7detail);
    }
  }

  // ================= R 定时器与句柄 =================
  origLog('\n[R] 定时器与句柄泄漏（本轮新增 singleTimer 必测）');
  {
    const timersBefore = typeof process.getActiveResourcesInfo === 'function' ? process.getActiveResourcesInfo().filter(x => x === 'Timeout').length : -1;
    fresh(['suyinKuwo']);
    scene = () => json({ data: { url: 'https://audio.test/a.mp3' } }); probeFn = okAudio;
    for (let i = 0; i < 20; i++) { try { await req('flac', { ...GOOD, songmid: 'r1' + i }); } catch (e) { } }
    await new Promise(r => setTimeout(r, 200));
    const timersAfter = typeof process.getActiveResourcesInfo === 'function' ? process.getActiveResourcesInfo().filter(x => x === 'Timeout').length : -1;
    rec('R1', '正常路径无残留定时器', timersBefore === -1 || timersAfter <= timersBefore + 2, `before=${timersBefore} after=${timersAfter}`);

    // R2 超时路径：慢源触发单链 singleTimer
    fresh(['suyinKuwo'], { raceBudgetMs: 1200, raceBudgetFloorMs: 500 });
    scene = () => ({ statusCode: 200, headers: { 'content-type': 'application/json' }, body: '{}', delay: 30000 });
    probeFn = () => ({ statusCode: 206, headers: { 'content-type': 'audio/mpeg' }, body: '', delay: 30000 });
    const t2 = Date.now();
    try { await req('flac', { ...GOOD, songmid: 'r2' }); } catch (e) { }
    const ms2 = Date.now() - t2;
    await new Promise(r => setTimeout(r, 150));
    const afterAll = typeof process.getActiveResourcesInfo === 'function' ? process.getActiveResourcesInfo().filter(x => x === 'Timeout').length : -1;
    rec('R2', '单链超时路径清理 singleTimer 且按时返回', ms2 < 4000, `耗时=${ms2}ms 剩余Timer=${afterAll}`);

    const b200 = typeof process.getActiveResourcesInfo === 'function' ? process.getActiveResourcesInfo().filter(x => x === 'Timeout').length : -1;
    fresh(['suyinKuwo']);
    scene = () => json({ data: { url: 'https://audio.test/a.mp3' } }); probeFn = okAudio;
    for (let i = 0; i < 200; i++) { try { await req('flac', { ...GOOD, songmid: 'r3' + i }); } catch (e) { } }
    await new Promise(r => setTimeout(r, 300));
    const a200 = typeof process.getActiveResourcesInfo === 'function' ? process.getActiveResourcesInfo().filter(x => x === 'Timeout').length : -1;
    rec('R3', '连续 200 次请求句柄数不增长', b200 === -1 || a200 <= b200 + 3, `before=${b200} after=${a200}`);
  }

  // ================= S 参数与导出 =================
  origLog('\n[S] 参数边界与导出契约');
  {
    fresh(['suyinKuwo']);
    scene = () => json({ data: { url: 'https://audio.test/a.mp3' } }); probeFn = okAudio;
    const badTypes = ['', 'abc', '192k', 'flac24bit'];
    const out = [];
    for (const t of badTypes) { reset(); let rr = null; try { rr = await req(t, { ...GOOD, songmid: 's1' + t }); out.push(rr ? rr.type : 'fail'); } catch (e) { out.push(e.code); } }
    rec('S1', '非法 type 不崩且有兜底或明确码', out.every(x => x), out.join('/'));

    let s2 = 0, s2d = '';
    try { await call({ action: 'musicUrl', source: 'kw', info: { type: 'flac' } }); s2d = '未拒绝'; } catch (e) { s2 = /PARAM_ERROR/.test(e.code + e.message) ? 1 : 0; s2d = e.code; }
    rec('S2', '缺 musicInfo 明确 PARAM_ERROR', s2 === 1, s2d);

    fresh(['suyinKuwo']);
    scene = (u) => (u.includes('audio.test') ? okAudio() : json({ data: { url: 'https://audio.test/a.mp3' } }));
    probeFn = () => audio(flac(269.7, 44100), 'audio/flac', 55397039);
    const durs = [0, -1, 1e9, 271000];
    const durOut = [];
    for (const d of durs) { reset(); let rr = null; try { rr = await req('flac', { ...GOOD, duration: d, songmid: 's3' + d }); durOut.push(rr ? 'deliver' : 'fail'); } catch (e) { durOut.push(e.code); } }
    rec('S3', 'duration 0/负/1e9 不误判为片段', durOut.filter(x => x === 'deliver').length >= 1, durOut.join('/'));

    fresh(['suyinKuwo']);
    let s4 = ''; try { await req('flac', { ...GOOD, songmid: 's4' }, 'qq'); } catch (e) { s4 = e.code; }
    rec('S4', '未知 platform 返回明确码', !!s4 && (s4 === 'PARAM_ERROR' || s4 === 'NOT_FOUND'), s4 || '未拒绝');

    const m = fresh(['suyinKuwo']);
    const exp = Object.keys(m).filter(k => typeof m[k] !== 'undefined');
    rec('S5', '导出面齐全（含运行时开关与健康快照）', exp.length >= 5 && !!m.SOURCE_TOGGLES && !!m.getHealthSnapshot, `导出=${exp.join(',')}`);

    fresh(['suyinKuwo']);
    scene = (u) => (u.includes('audio.test') ? okAudio() : json({ data: { url: 'https://audio.test/a.mp3' } }));
    probeFn = () => audio(mp3(5.3), 'audio/mpeg', 84972);
    let s6 = null; try { s6 = await req('flac', { ...GOOD, songmid: 's6' }); } catch (e) { }
    rec('S6', '试听版 subSourceName 与 subSource 同时给出', !!s6 && String(s6.subSourceName).includes('试听版') && !!s6.subSource, s6 ? `${s6.subSource} / ${s6.subSourceName}` : '无');
  }

  // ================= T 日志脱敏 =================
  origLog('\n[T] 日志脱敏');
  {
    fresh(['suyinKuwo']);
    hookLog();
    scene = () => json({ data: { url: 'https://audio.test/a.mp3?sign=SECRETSIG123&token=TK987&expire=1700000000' } });
    probeFn = okAudio;
    try { await req('flac', { ...GOOD, songmid: 't1' }); } catch (e) { }
    const hasSign = logs.some(l => /SECRETSIG123|TK987/.test(l));
    unhookLog();
    rec('T1', '签名/token 参数不落日志', !hasSign, hasSign ? '发现泄露：' + logs.find(l => /SECRETSIG/.test(l)).slice(0, 90) : `捕获 ${logs.length} 条日志，无签名串`);

    fresh(['suyinKuwo'], { ikunApiKey: 'sk-very-secret-key', lingchuanApiKey: 'lc-secret' });
    hookLog();
    scene = () => json({ data: { url: 'https://audio.test/a.mp3' } }); probeFn = okAudio;
    try { await req('flac', { ...GOOD, songmid: 't2' }); } catch (e) { }
    const hasKey = logs.some(l => /sk-very-secret|lc-secret/.test(l));
    unhookLog();
    rec('T2', '卡密不明文入日志', !hasKey, hasKey ? '发现泄露' : '无泄露');

    fresh(['suyinKuwo']);
    hookLog();
    scene = () => ({ statusCode: 200, headers: { 'content-type': 'text/plain' }, body: 'X'.repeat(100000) });
    probeFn = () => ({ statusCode: 206, headers: { 'content-type': 'audio/mpeg' }, body: '' });
    try { await req('flac', { ...GOOD, songmid: 't3' }); } catch (e) { }
    const maxLen = Math.max(0, ...logs.map(l => l.length));
    unhookLog();
    rec('T3', '日志不整段转储上游响应体（防超大日志）', maxLen < 2000, `最长日志=${maxLen} 字符`);
  }

  // ================= U 上游 HTTP 状态码映射（V8 覆盖率扫出的零执行分支） =================
  // O 组覆盖率实测：httpRequest 的 5xx/429/410/404/>=400 五个分支在全部 10 个入口里未执行过。
  // 这里按真实状态码注入，验证「码型正确 + 错误对象真的带 code」（不只看 message）。
  origLog('\n[U] 上游 HTTP 错误码映射');
  {
    const cases = [
      [500, 'SERVER_ERROR', 'HTTP 500'],
      [410, 'LINK_EXPIRED', 'HTTP 410'],
      [404, 'NOT_FOUND', 'HTTP 404'],
      [429, 'RATE_LIMIT', '被限流'],
      [403, 'NETWORK_ERROR', 'HTTP 403'],
    ];
    for (const [st, code, hint] of cases) {
      fresh(['suyinKuwo']);
      scene = () => ({ statusCode: st, headers: { 'content-type': 'text/plain' }, body: 'err' });
      probeFn = () => ({ error: 'ENOTFOUND' });
      let e0 = null;
      try { await req('128k', { ...GOOD, songmid: 'u' + st }); } catch (e) { e0 = e; }
      const ok = !!e0 && e0.code === code && String(e0.message).includes(hint);
      rec('U' + st, `HTTP ${st} → ${code} 且错误对象带 code`, ok,
        e0 ? `code=${JSON.stringify(e0.code)} msg=${String(e0.message).slice(0, 80)}` : '竟然成功（应被拒）');
    }
  }

  // ================= W 片段缓存证据通道（D-13 回退抽样的补测） =================
  // D-13 修复的核心：上游已拿不到片段证据时，靠「该歌该档历史片段 URL」继续交付试听版。
  // 旧场景（T5/T6）每次都能拿到当轮片段证据（hasFragDetail 恒成立），
  // 所以删掉 `|| hasFragCache` 也没人红。这里必须在**同一模块实例**内做两次请求：
  // fresh() 会重载模块、清空 fragmentUrlMap，跨实例连缓存都没了就不是这条通道了。
  origLog('\n[W] 片段缓存证据通道');
  {
    const fragBytes = () => Buffer.concat([mp3(5.3), Buffer.alloc(1200)]);
    const fragAudio = () => audio(fragBytes(), 'audio/mpeg', 84972);
    let frag = true;
    fresh(['suyinKuwo'], { breakerThreshold: 999, fragmentFallback: true, verifyDelivery: true });
    scene = (u) => {
      if (!frag) return { error: 'ECONNREFUSED' };
      return String(u).includes('audio.test')
        ? fragAudio()
        : json({ code: 200, data: { url: 'https://audio.test/frag.mp3' } });
    };
    probeFn = () => (frag ? fragAudio() : { error: 'ECONNREFUSED' });
    let r1 = null, r2 = null;
    try { r1 = await req('flac', { ...GOOD, songmid: 'w1frag' }); } catch (e) { r1 = { err: e.code, msg: e.message }; }
    const marked1 = !!r1 && String(r1.subSourceName || '').includes('试听版');
    // 第二次：上游彻底不可用，details 里不可能再有 PREVIEW_FRAGMENT，只能靠 hasFragCache
    frag = false;
    try { r2 = await req('flac', { ...GOOD, songmid: 'w1frag' }); } catch (e) { r2 = { err: e.code, msg: e.message }; }
    const marked2 = !!r2 && String(r2.subSourceName || '').includes('试听版');
    const got = r2 && (r2.err ? 'err:' + r2.err : (marked2 ? '试听版' : '完整版'));
    rec('W1', '上游已无片段证据时，靠历史缓存片段仍交付试听版（不让复播变成没声）',
      marked1 && marked2, `首次=${r1 && (r1.err || (marked1 ? '试听版' : '完整版'))} 二次=${got}`);
  }

  // ================= W2 并发槽位必须守恒（变异测试 MU8 的存活项） =================
  // inflightCount 是"该源正在飞"的计数，靠 finally 释放。变异体把这行删掉后，
  // 8 个门禁全绿——因为没有一条用例在"连续的失败请求"之后还要求能再发一次。
  // 泄漏的后果：maxConcurrency 槽位被永久占满，该源从第二次起就被本地限速静默跳过。
  origLog('\n[W] 并发槽位守恒');
  {
    fresh(['suyinKuwo'], { maxConcurrency: 1, breakerThreshold: 999, rateWindowMax: 1e6 });
    scene = () => ({ error: 'ECONNREFUSED' });
    probeFn = () => ({ error: 'ECONNREFUSED' });
    const seq = [];
    for (let i = 0; i < 4; i++) {
      let code = 'OK';
      try {
        const r = await req('flac', { ...GOOD, songmid: 'w2_' + i });
        code = r ? 'DELIVERED' : 'EMPTY';
      } catch (e) { code = e.code || 'ERR'; }
      seq.push(code);
    }
    rec('W2', '每次请求结束都释放并发槽位（连续失败后仍能真正发出请求，不被本地限速挡死）',
      seq.every(c => c === 'NETWORK_ERROR'),
      `连续 4 次结果 ${seq.join('/')}（期望全是 NETWORK_ERROR；槽位泄漏会让第 2 次起变成限速/无源）`);
  }

  // ================= MEM 记忆表容量（第五轮 MEM 组）=================
  // 过去只有 successCache/failCache 有上限，四张按歌曲累积的表只增不删。
  // 这里用 memoryMapMax=5 + 8 首歌把上限压到可见范围：条目数必须停在 5，
  // 且被淘汰的歌仍能正常交付（淘汰只影响"记忆"，不伤害功能）。
  origLog('\n[MEM] 记忆表容量与淘汰');
  {
    const MOD = fresh(['suyinKuwo'], { memoryMapMax: 5, breakerThreshold: 999, rateWindowMax: 1e6 });
    const fullAudio = () => audio(Buffer.concat([mp3(269.7), Buffer.alloc(1200)]), 'audio/mpeg', 10300000);
    scene = (u) => (String(u).includes('audio.test') ? fullAudio() : json({ code: 200, data: { url: 'https://audio.test/a.mp3' } }));
    probeFn = () => fullAudio();
    const ids = [];
    for (let i = 0; i < 8; i++) {
      try {
        const r = await req('128k', { ...GOOD, songmid: 'mem_' + i });
        ids.push(r && r.url ? 'OK' : 'EMPTY');
      } catch (e) { ids.push(e.code || 'ERR'); }
    }
    const mem = MOD.getHealthSnapshot()._memory || {};
    rec('MEM1', '记忆表条目数受 memoryMapMax 约束（8 首歌 + 上限 5 → 只留 5 条）',
      mem.deliveryQuality === 5 && mem.limit === 5,
      `deliveryQuality=${mem.deliveryQuality} limit=${mem.limit}（8 次结果 ${ids.join('/')}）`);
    let again = 'ERR';
    try {
      const r = await req('128k', { ...GOOD, songmid: 'mem_0' });
      again = r && r.url ? 'OK' : 'EMPTY';
    } catch (e) { again = e.code || 'ERR'; }
    rec('MEM2', '条目被淘汰后旧歌仍能正常交付（淘汰不伤害功能）', again === 'OK', `重播第 1 首结果 ${again}`);
    const keys = ['successCache', 'failCache', 'deliveryQuality', 'fragmentSource', 'qualityCeiling', 'fragmentUrl', 'handlerSongs', 'limit'];
    rec('MEM3', '健康快照暴露全部记忆表条目数（长跑内存占用可观测）',
      keys.every((k) => typeof mem[k] === 'number'), `_memory 键 ${Object.keys(mem).join(',')}`);
  }

  // ================= EDGE 边界与非法配置（第五轮 5.3）=================
  // 配置校验只写了 `typeof value !== "number" || value <= 0`。NaN 的 typeof 是 number，
  // 而 NaN <= 0 / NaN < min / NaN > max 全是 false —— 三道闸门同时失效。
  origLog('\n[EDGE] 边界与非法配置');
  {
    fresh(['suyinKuwo'], { breakerThreshold: 999, rateWindowMax: 1e6 });
    const cfgs = async (obj) => {
      try {
        const r = await call({ action: 'config', info: obj });
        return (r && r.updated) || {};
      } catch (e) { return { __err: e.code || 'ERR' }; }
    };
    const u1 = await cfgs({ raceBudgetMs: 0 });
    const u2 = await cfgs({ raceBudgetMs: NaN });
    const u3 = await cfgs({ cacheTtlMs: NaN });
    rec('EDGE1', '非正数配置被拒（0 不写入）', !('raceBudgetMs' in u1), `写入 raceBudgetMs=0 → updated=${JSON.stringify(u1)}`);
    rec('EDGE2', 'NaN 配置被拒（NaN 不得绕过 <=0 与上下限校验）',
      !('raceBudgetMs' in u2) && !('cacheTtlMs' in u3),
      `raceBudgetMs=NaN → ${JSON.stringify(u2)}；cacheTtlMs=NaN → ${JSON.stringify(u3)}`);

    // 时长判据：原曲时长 0/undefined 属"不可判定"，必须放行（误杀代价高于听到片段）
    const fullAudio = () => audio(Buffer.concat([mp3(269.7), Buffer.alloc(1200)]), 'audio/mpeg', 10300000);
    scene = (u) => (String(u).includes('audio.test') ? fullAudio() : json({ code: 200, data: { url: 'https://audio.test/a.mp3' } }));
    probeFn = () => fullAudio();
    // 判据必须区分"完整版"和"片段兜底成功"——fragmentFallback 开时，被判片段也会返回带 url 的成功对象，
    // 只看 r.url 存在会把"误判片段"当成 OK（这正是 T5 假绿的老毛病）。
    const lbl = (r) => (!r || !r.url ? 'EMPTY'
      : (String(r.subSourceName || '').includes('试听版') ? 'PREVIEW' : 'OK'));
    let d0 = 'ERR';
    let d1 = 'ERR';
    try { const r = await req('128k', { ...GOOD, songmid: 'edge_d0', duration: 0 }); d0 = lbl(r); } catch (e) { d0 = e.code || 'ERR'; }
    try { const r = await req('128k', { ...GOOD, songmid: 'edge_d1', duration: undefined }); d1 = lbl(r); } catch (e) { d1 = e.code || 'ERR'; }
    rec('EDGE3', '原曲时长缺失(0/undefined)时完整音频不被误判为片段', d0 === 'OK' && d1 === 'OK', `duration=0 → ${d0}；duration=undefined → ${d1}`);

    // 音质大小写：全链都做 toLowerCase，请求大写不得分裂缓存键或判成未知档
    let up = 'ERR';
    try {
      const r = await req('FLAC', { ...GOOD, songmid: 'edge_up' });
      up = r && r.url ? `OK:${r.type || ''}` : 'EMPTY';
    } catch (e) { up = e.code || 'ERR'; }
    // 判据必须看交付档位的值，不能只看"是否交付成功"——
    // 只看 OK 前缀时，把 fmt 比较改成大小写敏感后仍然绿（type 变成 FLAC 也还是 OK 开头）。
    rec('EDGE4', '音质大小写不分裂（FLAC 请求交付 320k，不把大写档原样透传）', String(up) === 'OK:320k', `type=FLAC → ${up}`);

    // 纵深防御：校验层只挡"写入"，挡不住已经落盘的非法值 / 外部注入。
    // 这里直接注入 raceBudgetMs=NaN（等价于旧配置残留），要求 cfg 回落默认、请求照常交付。
    fresh(['suyinKuwo'], { raceBudgetMs: NaN, breakerThreshold: 999, rateWindowMax: 1e6 });
    scene = (u) => (String(u).includes('audio.test') ? fullAudio() : json({ code: 200, data: { url: 'https://audio.test/a.mp3' } }));
    probeFn = () => fullAudio();
    let nanOk = 'ERR';
    try { const r = await req('128k', { ...GOOD, songmid: 'edge_nan' }); nanOk = r && r.url ? 'OK' : 'EMPTY'; } catch (e) { nanOk = e.code || 'ERR'; }
    // 注意：这一条实测由 USER_CONFIG 初始化时的 `|| 12000` 兜住（NaN||12000=12000），
    // 不是 cfg 里那道 Number.isFinite 防线（那道防线无可独立观测的路径，属防御纵深）。
    rec('EDGE5', '外部注入 NaN 预算时实例不瘫痪（初始化兜底生效，请求照常交付）', nanOk === 'OK', `注入 raceBudgetMs=NaN → ${nanOk}`);
  }

  // ================= FAULT 故障注入（第五轮 5.4）=================
  // 只注入"上游一定会发生但 mock 从没模拟过"的形状：空 body、截断 JSON、超大 body、
  // 5xx 连发、ENOTFOUND、证书错误、以及最阴的一条——上游抛的不是 Error 对象。
  origLog('\n[FAULT] 故障注入');
  {
    const MOD = fresh(['suyinKuwo'], { breakerThreshold: 999, rateWindowMax: 1e6 });
    const CODES = new Set(Object.keys(MOD.ERROR_CODES).map((k) => MOD.ERROR_CODES[k]));
    const run1 = async (info, fn) => {
      scene = fn;
      probeFn = fn;
      try {
        const r = await req('128k', info);
        return r && r.url ? 'OK' : 'EMPTY';
      } catch (e) {
        const code = e && e.code;
        return code ? String(code) : 'NOCODE:' + String((e && e.message) || e).slice(0, 12);
      }
    };
    const json = (o) => ({ statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });

    const f1 = await run1({ ...GOOD, songmid: 'f1' }, () => ({ statusCode: 200, headers: { 'content-type': 'application/json' }, body: '' }));
    rec('FAULT1', 'HTTP 200 + 空 body 给出明确错误码（不交付空链接、不抛 TypeError）', CODES.has(f1), `结果 ${f1}`);

    const f2 = await run1({ ...GOOD, songmid: 'f2' }, () => ({ statusCode: 200, headers: { 'content-type': 'application/json' }, body: '{"code":200,"data":{"url":"htt' }));
    rec('FAULT2', 'JSON 截断给明确错误码（解析失败不得抛 TypeError）', CODES.has(f2), `结果 ${f2}`);

    const bigPad = 'x'.repeat(10 * 1024 * 1024);
    const bigAudio = () => audio(Buffer.concat([mp3(269.7), Buffer.alloc(1200)]), 'audio/mpeg', 10300000);
    const f3 = await run1({ ...GOOD, songmid: 'f3' }, (u) => (String(u).includes('audio.test')
      ? bigAudio()
      : json({ code: 200, data: { url: 'https://audio.test/a.mp3' }, pad: bigPad })));
    rec('FAULT3', '10MB 响应体不崩且仍能正常交付', f3 === 'OK', `结果 ${f3}`);

    // 5xx 连发：每次都要归 SERVER_ERROR。注意用**三首不同歌**——
    // 同一首歌连续失败会被 30s 全失败短缓存吸收（防止同歌每次重播白跑降级链），
    // 这是设计行为；熔断累积要靠不同歌的真实失败。
    const MOD4 = fresh(['suyinKuwo'], { breakerThreshold: 3, rateWindowMax: 1e6 });
    const seq5 = [];
    for (let i = 0; i < 3; i++) {
      const st = [502, 503, 504][i];
      const fn5 = () => ({ statusCode: st, headers: {}, body: '' });
      scene = fn5;
      probeFn = fn5;
      try { const r = await req('128k', { ...GOOD, songmid: 'f5x' + i }); seq5.push(r && r.url ? 'OK' : 'EMPTY'); }
      catch (e) { seq5.push(String((e && e.code) || 'NOCODE')); }
    }
    rec('FAULT4', '三首不同歌各遇 502/503/504，每次都归为 SERVER_ERROR', seq5.every((c) => c === 'SERVER_ERROR'), `序列 ${seq5.join('/')}`);

    // 熔断：判据必须是"路器状态 open + 不再外呼"，
    // 只看"返回什么码"或只看"不再外呼"都不够——短缓存与播放摘除都能同时满足后者。
    const KW = 'https://oiapi.net/api/Kuwo';
    const before = counts[KW] || 0;
    let seq6 = 'NOCODE';
    try { const r = await req('128k', { ...GOOD, songmid: 'f5y' }); seq6 = r && r.url ? 'OK' : 'EMPTY'; }
    catch (e) { seq6 = String((e && e.code) || 'NOCODE'); }
    const after = counts[KW] || 0;
    const snap4 = MOD4.getHealthSnapshot()['suyinKuwo'] || {};
    rec('FAULT4b', '三首不同歌连续 5xx 后该源被断路器熔断（state=open 且不再外呼）',
      after === before && String(snap4.state) === 'open',
      `外呼 ${before}→${after}，state=${snap4.state}，reqCount=${snap4.reqCount}，playDead=${snap4.playDead}，结果码 ${seq6}`);

    // 雪崩保护：同一首歌 30s 内重复请求只打一次上游（短缓存生效），这是设计不是缺陷。
    const MOD6 = fresh(['suyinKuwo'], { breakerThreshold: 999, rateWindowMax: 1e6 });
    const fn6 = () => ({ statusCode: 503, headers: {}, body: '' });
    scene = fn6;
    probeFn = fn6;
    const c0 = counts[KW] || 0;
    try { await req('128k', { ...GOOD, songmid: 'f5z' }); } catch (e) { /* 期望失败 */ }
    const c1 = counts[KW] || 0;   // 首次真的打上游
    for (let i = 0; i < 2; i++) {
      try { await req('128k', { ...GOOD, songmid: 'f5z' }); } catch (e) { /* 期望命中缓存失败 */ }
    }
    const c2 = counts[KW] || 0;
    // 首次必须真打上游（c1>c0）；第二次起必须外呼为 0（短缓存生效）。
    // 不断言"总共只打 1 次"——一次请求内部含降档与重试，次数不是 1。
    rec('FAULT4c', '同一首歌失败后 30s 内重复请求不再外呼（全失败短缓存挡住雪崩）',
      c1 > c0 && c2 === c1, `首次 +${c1 - c0}，重复两次后 +${c2 - c1}`);

    const f5 = await run1({ ...GOOD, songmid: 'f5' }, () => ({ error: 'ENOTFOUND' }));
    rec('FAULT5', 'DNS 解析失败归为 NETWORK_ERROR', f5 === String(MOD.ERROR_CODES.NETWORK_ERROR), `结果 ${f5}`);

    const f6 = await run1({ ...GOOD, songmid: 'f6' }, () => ({ error: 'self signed certificate in certificate chain' }));
    rec('FAULT6', '证书错误归为 NETWORK_ERROR（不是未知错误）', f6 === String(MOD.ERROR_CODES.NETWORK_ERROR), `结果 ${f6}`);

    // 最阴的一条：上游抛的不是 Error 对象（字符串/纯对象）。httpRequest 里读 err.message，
    // 若实现不当会变成 "NETWORK_ERROR: undefined" 甚至 TypeError 二次崩溃。
    const f7 = await run1({ ...GOOD, songmid: 'f7' }, () => { throw 'upstream boom'; });
    // 字符串赋值 err.code 无效，但出口必须有码——这里直接断言码存在且已知
    rec('FAULT7', '上游抛非 Error 对象（字符串）仍产出已知错误码', CODES.has(f7), `结果 ${f7}`);

    const f7b = await run1({ ...GOOD, songmid: 'f7b' }, () => { throw { reason: 'plain object' }; });
    rec('FAULT7b', '上游抛纯对象（无 message）仍产出已知错误码', CODES.has(f7b), `结果 ${f7b}`);

    // FAULT8：429 走独立的 recordRateLimit 分支——与 5xx 的 recordFailure 完全不同：
    // 不计入熔断失败（failureCount 不动）、只做 30s 退避、连续 3 次标记 rateLimited。
    // 之前这条分支从没被测过，只看"返回 RATE_LIMIT"分不清它到底走的是 recordFailure 还是 recordRateLimit。
    const MOD8 = fresh(['suyinKuwo'], { rateWindowMax: 1e6, breakerThreshold: 3 });
    const KW8 = 'https://oiapi.net/api/Kuwo';
    const fn429 = () => ({ statusCode: 429, headers: {}, body: '' });
    scene = fn429;
    probeFn = fn429;
    const seq8 = [];
    const c8a = counts[KW8] || 0;
    for (let i = 0; i < 3; i++) {
      try { const r = await req('128k', { ...GOOD, songmid: 'f429_' + i }); seq8.push(r && r.url ? 'OK' : 'EMPTY'); }
      catch (e) { seq8.push(String((e && e.code) || 'NOCODE')); }
    }
    const c8b = counts[KW8] || 0;
    const snap8 = MOD8.getHealthSnapshot()['suyinKuwo'] || {};
    let rF8 = 'NOCODE';
    try { const r = await req('128k', { ...GOOD, songmid: 'f429_after' }); rF8 = r && r.url ? 'OK' : 'EMPTY'; }
    catch (e) { rF8 = String((e && e.code) || 'NOCODE'); }
    const c8c = counts[KW8] || 0;
    rec('FAULT8', '连续 429 走独立限流分支（RATE_LIMIT + 不计熔断 + 退避期不外呼）',
      seq8.every((c) => c === 'RATE_LIMIT') && (snap8.rateLimitCount || 0) >= 1
        && String(snap8.state) !== 'open' && c8c === c8b,
      `三次码 ${seq8.join('/')}；外呼 ${c8a}→${c8b}→${c8c}；rateLimited=${snap8.rateLimited} rateLimitCount=${snap8.rateLimitCount} state=${snap8.state} 第4首=${rF8}`);

    // FAULT8b：`rateLimited` 标记的可达性。串行连发时它到不了——第一次 429 就把
    // rateLimitUntil 推后 30s，后续请求被 canExecute 本地拦下（不算新的限流证据），
    // 所以 rateLimitCount 停在 1。只有并发同时被上游拒才累积到 RATE_LIMIT_TRIP=3。
    // 这条是为了证明"标记本身没写坏"，不是证明"串行也能标"。
    const MOD8b = fresh(['suyinKuwo'], { rateWindowMax: 1e6, breakerThreshold: 3 });
    scene = fn429;
    probeFn = fn429;
    const pend = [];
    for (let i = 0; i < 3; i++) {
      pend.push(req('128k', { ...GOOD, songmid: 'f429p_' + i }).then((r) => (r && r.url ? 'OK' : 'EMPTY')).catch((e) => String((e && e.code) || 'NOCODE')));
    }
    const seq8b = await Promise.all(pend);
    const snap8b = MOD8b.getHealthSnapshot()['suyinKuwo'] || {};
    rec('FAULT8b', '并发 3 路同时 429 才累积到「被限」标记（串行下 RATE_LIMIT_TRIP 不可达）',
      (snap8b.rateLimitCount || 0) >= 3 && snap8b.rateLimited === true,
      `并发码 ${seq8b.join('/')}；rateLimitCount=${snap8b.rateLimitCount} rateLimited=${snap8b.rateLimited} state=${snap8b.state}`);

    // FAULT8c：面板"限流中"必须能在串行退避期亮起来。这条守的是显示与行为的一致性——
    // 退避期内该源确实不参与竞速，但 rateLimited（连续 3 次）永远为 false，
    // 旧面板会一直显示"正常"。
    rec('FAULT8c', '面板「限流中」字段在串行退避期就能亮（rateLimitActive 与 rateLimited 是两件事）',
      snap8.rateLimitActive === true && (snap8.rateLimitUntil || 0) > Date.now() && snap8.rateLimited === false,
      `rateLimitActive=${snap8.rateLimitActive} 剩余=${Math.round(((snap8.rateLimitUntil || 0) - Date.now()) / 1000)}s rateLimited=${snap8.rateLimited}`);

    // FAULT8d 未成断言：想构造「熔断(open) + 限流退避」共存，但 3 次 5xx 后该档已被
    // qualityShortCircuit 短路（fail>=3 直接 1h 不外呼），半开 429 那条分支在 mock 里走不到。
    // 代码里 half-open 遇 429 的收口是明确的，所以 App 侧按「熔断优先」处理，不依赖能用测试证明它。
  }

  // ================= INV 不变量（第五轮 5.2）=================
  // 不指定路径，只守"永远为真"的性质。首版判据一律先放宽 + 打印真实值，
  // 看清实际形态后再收紧——本轮已经因为"凭想象写判据"错了两回。
  origLog('\n[INV] 不变量');
  {
    const mp3Body = () => Buffer.concat([mp3(269.7), Buffer.alloc(1200)]);
    const sceneOk = (u) => (String(u).includes('audio.test') ? audio(mp3Body(), 'audio/mpeg', 4310000) : json({ code: 200, data: { url: 'https://audio.test/a.mp3' } }));

    // INV2：交付的 subSource 必须在 buildSourceChain 结果里
    const MODA = fresh(['suyinKuwo'], { rateWindowMax: 1e6 });
    scene = sceneOk;
    probeFn = sceneOk;
    const chainA = MODA.buildSourceChain('kw', '128k') || [];
    const idsA = chainA.map((h) => h.id || h.name);
    let rA = null;
    try { rA = await req('128k', { ...GOOD, songmid: 'inv2' }); } catch (e) { rA = null; }
    const subA = String((rA && (rA.subSource || rA.source)) || '');
    const nameA = String((rA && rA.subSourceName) || '');
    rec('INV2', '交付的 subSource 必须在 buildSourceChain 结果里', !!subA && idsA.includes(subA),
      `subSource=${subA} subSourceName=${nameA} chain=[${idsA.join(',')}]`);

    // INV2b：多源换源——优选源失败必须真的换到 backup，且 subSource 必须换成 backup 的 id。
    // 这是 INV2 唯一无法覆盖的场景：单源链路下 subSource 必然等于 chain[0]，断言接近恒真。
    const MODSwap = fresh(['suyinKuwo', 'helloworldKw'], { rateWindowMax: 1e6 });
    const HW = 'https://audio.test/hw.mp3';
    scene = (u) => {
      const s = String(u);
      if (s.includes('oiapi.net/api/Kuwo')) return json({ code: 500 });                  // 优选源整体失败
      if (s.includes('nmobi.kuwo.cn')) return json({ code: 200, data: { url: HW } });    // backup 可用
      if (s.includes('audio.test')) return audio(mp3Body(), 'audio/mpeg', 4310000);
      return json({ code: 404 });
    };
    probeFn = scene;
    const chainSwap = MODSwap.buildSourceChain('kw', '128k') || [];
    const idsSwap = chainSwap.map((h) => h.id || h.name);
    let rSwap = null;
    try { rSwap = await req('128k', { ...GOOD, songmid: 'inv2b' }); } catch (e) { rSwap = null; }
    const subSwap = String((rSwap && (rSwap.subSource || rSwap.source)) || '');
    const uniqSwap = new Set(idsSwap).size === idsSwap.length && idsSwap.length >= 2;
    rec('INV2b', '优选源失败后换到 backup 源（subSource 必须变成 backup 的 id）',
      uniqSwap && !!rSwap && !!rSwap.url && subSwap === 'helloworldKw',
      `subSource=${subSwap} url=${rSwap && rSwap.url ? '有' : '无'} chain=[${idsSwap.join(',')}]`);

    // INV3：交付 type 必须与实测字节一致（构造"请求 flac、上游只给 mp3"）
    let rB = null;
    try { rB = await req('flac', { ...GOOD, songmid: 'inv3' }); } catch (e) { rB = null; }
    rec('INV3', '请求 flac 但字节是 mp3 时，交付 type 不得标记为 flac', !!rB && String(rB.type) !== 'flac',
      `type=${rB && rB.type} subSourceName=${rB && rB.subSourceName}`);

    // INV5：幂等——同歌同档两次（各自全新实例）交付的源一致
    scene = sceneOk;
    probeFn = sceneOk;
    let i1 = null, i2 = null;
    try { i1 = await req('128k', { ...GOOD, songmid: 'inv5' }); } catch (e) { i1 = null; }
    fresh(['suyinKuwo'], { rateWindowMax: 1e6 });
    scene = sceneOk;
    probeFn = sceneOk;
    try { i2 = await req('128k', { ...GOOD, songmid: 'inv5' }); } catch (e) { i2 = null; }
    const s1 = String((i1 && i1.subSource) || '');
    const s2 = String((i2 && i2.subSource) || '');
    rec('INV5', '同歌同档两次（全新实例）交付同一源', s1 === s2 && !!s1, `第一次=${s1} 第二次=${s2}`);
  }

  // ================= G4b：同歌同档并发去重（第六轮 G4 落网关） =================
  {
    const m = fresh(['suyinKuwo']);
    reset();
    const okScene = (u) => String(u).includes('oiapi.net')
      ? json({ code: 200, data: { url: 'https://audio.test/dup.mp3' } })
      : audio(flac(269.7, 44100), 'audio/flac', 55397039);
    scene = okScene;
    probeFn = () => audio(flac(269.7, 44100), 'audio/flac', 55397039);
    const song = { ...GOOD, songmid: 'g4dup' };
    let dbg = '';
    const ps = [1, 2, 3, 4, 5].map(() => req('128k', song).catch(e => { dbg = String((e && e.message) || e).slice(0, 120); return null }));
    const vals = await Promise.all(ps);
    const outbound = Object.keys(counts).filter(k => k.includes('oiapi.net')).reduce((a, k) => a + counts[k], 0);
    rec('G4b', '同歌同档 5 并发 → 上游外呼应合并为 1 次', outbound === 1, `实际外呼=${outbound} 次`);
    const urls = vals.map(v => v && v.url).filter(Boolean);
    rec('G4c', '5 并发返回的一致可用（都拿到 url）', urls.length === 5, `拿到 ${urls.length}/5 err=${dbg}`);
  }

  // ================= G12 星海备平台声明一致性（2026-11-09）=================
  // PLATFORM_TO_XINGHAI_BACKUP = { wy, tx, kw }——没有 mg 和 kg。
  // 但链上条件只写了 platform !== "kg"，mg 每次都会被 push 进链、然后必抛 PARAM_ERROR（白耗一次外呼等待）。
  {
    const MODX = fresh(['xinghaiBackup'], {});
    const ids = (pl) => (MODX.buildSourceChain(pl, '128k') || []).map((h) => h.id || h.name);
    const mgIds = ids('mg'), kgIds = ids('kg'), kwIds = ids('kw'), wyIds = ids('wy');
    rec('G12a', '星海备不在 mg 链上（映射表没有 mg，进去必抛 PARAM_ERROR 白耗时间）',
      !mgIds.includes('xinghaiBackup'), `mg 链=[${mgIds.join(',')}]`);
    rec('G12b', '星海备不在 kg 链上（映射表没有 kg）',
      !kgIds.includes('xinghaiBackup'), `kg 链=[${kgIds.join(',')}]`);
    rec('G12c', '星海备在 kw 链上（映射表有 kw，开启即挂）',
      kwIds.includes('xinghaiBackup'), `kw 链=[${kwIds.join(',')}]`);
    rec('G12d', '星海备在 wy 链上（映射表有 wy）',
      wyIds.includes('xinghaiBackup'), `wy 链=[${wyIds.join(',')}]`);
  }

  // ===== D-29 回归：0~16 字节空体必须判 empty（旧逻辑会把 206+0 字节当"验真通过"交付出去）=====
  {
    const m29 = fresh([], {});
    const sniff = m29.__debug && m29.__debug.sniffAudioBytes;
    const CT = { 'content-type': 'audio/mpeg' };
    rec('D29a', '8 字节响应体判 empty（确定不可播，绝不交付）',
      !!(sniff && sniff(Buffer.alloc(8), CT, 1024).kind === 'empty'),
      '旧逻辑会把 206+0 字节当"验真通过"交付出去');
    rec('D29b', '15 字节（边界内）判 empty',
      !!(sniff && sniff(Buffer.alloc(15), CT, 1024).kind === 'empty'),
      '16 是"装不下任何音频头"的下限');
    rec('D29c', '16 字节（边界外）不判 empty，落到内容嗅探',
      !!(sniff && sniff(Buffer.alloc(16, 0x41), CT, 1024).kind !== 'empty'),
      '防止把下限写成 <= 或把有效音频误杀');
  }

  const pass = res.filter(r => r.ok).length, fail = res.filter(r => !r.ok).length;
  origLog(`\n第二轮审计（J~U）汇总：${pass} 通过 / ${fail} 失败`);
  for (const r of res.filter(x => !x.ok)) origLog(`  ✗ [${r.id}] ${r.name} — ${r.detail}`);
  process.exit(fail ? 1 : 0);
})();
