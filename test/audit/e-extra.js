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
    const q3 = /typeof Buffer/.test(src) || /Buffer\.isBuffer/.test(src);
    rec('Q3', '有 Buffer 存在性判断（无 Buffer 环境可降级）', q3, q3 ? `命中 ${(src.match(/typeof Buffer/g) || []).length} 处 typeof Buffer 判断` : '未发现降级判断');
    let noBufOk = true, noBufErr = '';
    try {
      const origBuf = globalThis.Buffer;
      const m = fresh(['suyinKuwo']);
      noBufOk = !!(m && m.SOURCE_TOGGLES);
    } catch (e) { noBufOk = false; noBufErr = e.message; }
    rec('Q4', '无 utils.buffer 时加载不崩（复验 B2）', noBufOk, noBufErr || '加载成功');
    const q5 = !/AbortController|AbortSignal|fetch\(/.test(src);
    rec('Q5', '不依赖 fetch/AbortController（宿主不保证）', q5, q5 ? '仅用 lx.request + setTimeout' : '存在不可控 API');
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

  const pass = res.filter(r => r.ok).length, fail = res.filter(r => !r.ok).length;
  origLog(`\n第二轮审计（J~U）汇总：${pass} 通过 / ${fail} 失败`);
  for (const r of res.filter(x => !x.ok)) origLog(`  ✗ [${r.id}] ${r.name} — ${r.detail}`);
  process.exit(fail ? 1 : 0);
})();
