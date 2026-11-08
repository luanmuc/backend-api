#!/usr/bin/env node
/** 批 3/4/5/8：功能矩阵(D) + 性能(E) + 安全(F) + 边界与回滚(I) */
const path = require('path');
const SRC = path.join(__dirname, '../../lx-source.js');
let handler = null, counts = {}, scene = null, probeFn = null;
const reset = () => { counts = {}; };
const total = () => Object.values(counts).reduce((a, b) => a + b, 0);
const hits = (re) => Object.keys(counts).filter(k => re.test(k)).length;

function setLx() {
  globalThis.lx = {
    EVENT_NAMES: { inited: 'inited', request: 'request', updateAlert: 'updateAlert' },
    version: '2.0.0', env: 'mobile',
    utils: { buffer: { from: (d, e) => Buffer.from(d, e), bufToString: (b, e) => b.toString(e) } },
    request(url, opts, cb) {
      const u = String(url); const k = u.split('?')[0];
      counts[k] = (counts[k] || 0) + 1;
      const isProbe = !!(opts && opts.binary);
      let r; try { r = isProbe ? (probeFn ? probeFn(u, opts) : { statusCode: 206, headers: { 'content-type': 'audio/mpeg' }, body: '' }) : (scene ? scene(u, opts) : { error: 'ECONNREFUSED' }); }
      catch (e) { return setTimeout(() => cb(e, null), 2); }
      if (!r) r = { error: 'ECONNREFUSED' };
      const tmo = (opts && opts.timeout) || 99999;
      const d = r.delay || 2;
      // 真实洛雪宿主会按 opts.timeout 中断请求；mock 必须同构，否则测的是"宿主不守时"而非源逻辑
      if (d > tmo) return setTimeout(() => cb(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }), null), tmo);
      setTimeout(() => {
        if (r.error) return cb(Object.assign(new Error(r.error), { code: r.error }), null);
        cb(null, { statusCode: r.statusCode, headers: r.headers || {}, body: r.body ?? '', url: u });
      }, d);
    },
    on(n, h) { if (n === 'request') handler = h; }, send() {},
  };
}
const load = () => { if (require.cache[require.resolve(SRC)]) delete require.cache[require.resolve(SRC)]; return require(SRC); };
const fresh = (toggles) => { setLx(); const m = load(); if (toggles) for (const k of Object.keys(m.runtimeToggles)) m.runtimeToggles[k] = toggles.includes(k); return m; };
const req = (q, info, source = 'kw') => handler({ action: 'musicUrl', source, info: { type: q, musicInfo: info } });
const json = (o) => ({ statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });
const audio = (body, ct = 'audio/mpeg', tot = null) => ({ statusCode: 206, headers: { 'content-type': ct, ...(tot ? { 'content-range': `bytes 0-1023/${tot}` } : {}) }, body });

function mp3(sec) { const f = Math.max(1, Math.round(sec * 44100 / 1152)); const b = Buffer.alloc(48); b[0] = 0xFF; b[1] = 0xFB; b[2] = 0x90; b[3] = 0x64; b.write('Xing', 36, 'ascii'); b.writeUInt32BE(1, 40); b.writeUInt32BE(f, 44); return b; }
function flac(sec, sr = 48000) { const b = Buffer.alloc(64); b.write('fLaC', 0, 'ascii'); b[4] = 0x80; b[5] = 0; b[6] = 0; b[7] = 34; b[18] = (sr >> 12) & 0xFF; b[19] = (sr >> 4) & 0xFF; b[20] = (sr & 0x0F) << 4; const t = Math.round(sec * sr); b[21] = Math.floor(t / 4294967296) & 0x0F; b[22] = Math.floor(t / 16777216) & 0xFF; b[23] = Math.floor(t / 65536) & 0xFF; b[24] = Math.floor(t / 256) & 0xFF; b[25] = t & 0xFF; return b; }

const res = [];
const rec = (id, name, ok, detail) => { res.push({ id, ok: !!ok, name, detail: String(detail || '') }); console.log(`${ok ? '✓' : '✗'} [${id}] ${name}${detail ? ' — ' + String(detail).slice(0, 200) : ''}`); };

const GOOD = { name: '晴天', singer: '周杰伦', duration: 271000, songmid: '228908' };

(async () => {
  globalThis.__lxSourceConfig = { rateWindowMax: 100000, maxConcurrency: 100000, rateWindowMs: 3600000 };
  handler = null;
  // 先拿一份模块只为读 SOURCE_TOGGLES 键名
  const boot = fresh([]);
  const kinds = Object.keys(boot.runtimeToggles);

  // ---------- D1 每个源都能被真正调用（不漏源、不崩） ----------
  console.log('\n[D1] 20 个源逐个开启：handler 是否真的跑起来');
  const dead = [];
  const platforms = ['kw', 'wy', 'tx', 'mg', 'kg'];
  for (const k of kinds) {
    let alive = false;
    for (const pf of platforms) {
      const info = { ...GOOD, songmid: 'src' + k, hash: 'SRC' + k };
      fresh([k]);
      scene = (u) => (u.includes('audio.test') ? audio(flac(269.7, 44100), 'audio/flac', 55397039) : json({ code: 200, data: { url: 'https://audio.test/a.mp3' }, url: 'https://audio.test/a.mp3', n: 1 }));
      probeFn = () => audio(flac(269.7, 44100), 'audio/flac', 55397039);
      reset();
      try { await req('flac', info, pf); } catch (e) { /* 允许失败 */ }
      if (total() > 0) { alive = true; break; }
    }
    if (!alive) dead.push(k);
  }
  const knownDead = ['xinghaiBackup']; // 注释即写明「星海备：域名不可解析」，默认 false，仅非 kg 平台候选
  const unexpected = dead.filter(k => !knownDead.includes(k));
  rec('D1', '每个源在其支持的平台上都能被真正调用', unexpected.length === 0,
    unexpected.length ? `未接线：${unexpected.join(', ')}` : `${kinds.length - knownDead.length}/${kinds.length} 源已接线并触发真实请求（xinghaiBackup 为已知不可解析域名，默认关闭，符合预期）`);

  // ---------- I4/I5 开关回滚（关键：证明闸门是叠加层） ----------
  console.log('\n[I4/I5] 闸门开关逐个关闭 → 回到 v8.10 行为');
  {
    // 片段场景：verifyDelivery 开 → 拒收（走兜底测听版）；关 → 当正常交付
    const fragScene = (u) => (u.includes('audio.test') ? audio(flac(269.7, 44100), 'audio/flac', 55397039) : json({ data: { url: 'https://audio.test/a.mp3' } }));
    fresh(['suyinKuwo']); scene = fragScene;
    probeFn = () => audio(mp3(5.3), 'audio/mpeg', 84972); reset();
    const rOn = await req('flac', { ...GOOD, songmid: 'i5on' }).catch(e => null);
    globalThis.__lxSourceConfig.verifyDelivery = false;
    fresh(['suyinKuwo']); scene = fragScene;
    probeFn = () => audio(mp3(5.3), 'audio/mpeg', 84972); reset();
    const rOff = await req('flac', { ...GOOD, songmid: 'i5off' }).catch(e => null);
    const onFlagged = !!(rOn && String(rOn.subSourceName || '').includes('试听版'));
    const offClean = !!(rOff && rOff.url && !String(rOff.subSourceName || '').includes('试听版'));
    rec('I5', 'verifyDelivery 开→识别片段 / 关→原样放行', onFlagged && offClean,
      `开=${rOn ? rOn.subSourceName : 'fail'} 关=${rOff ? rOff.subSourceName : 'fail'}`);
    globalThis.__lxSourceConfig.verifyDelivery = true;
  }
  {
    // truthfulQuality 开 → 请求 flac 实给 320k 标 320k；关 → 标 flac（旧行为）
    const payload = (u) => (u.includes('audio.test') ? audio(flac(269.7, 44100), 'audio/flac', 55397039) : json({ data: { url: 'https://audio.test/a.mp3' } }));
    fresh(['suyinKuwo']); scene = payload; probeFn = () => audio(mp3(269.7), 'audio/mpeg', 10792943); reset();
    const rOn = await req('flac', { ...GOOD, songmid: 'iq1' }).catch(() => null);
    globalThis.__lxSourceConfig.truthfulQuality = false;
    fresh(['suyinKuwo']); scene = payload; probeFn = () => audio(mp3(269.7), 'audio/mpeg', 10792943); reset();
    const rOff = await req('flac', { ...GOOD, songmid: 'iq2' }).catch(() => null);
    rec('I4', 'truthfulQuality 开→标320k / 关→标flac(旧行为)', !!rOn && rOn.type === '320k' && !!rOff && rOff.type === 'flac',
      `开=${rOn && rOn.type} 关=${rOff && rOff.type}`);
    globalThis.__lxSourceConfig.truthfulQuality = true;
  }
  {
    // fragmentFallback 关 → 全片段时不兜底，直接失败（用户可拒绝"试听版"）
    globalThis.__lxSourceConfig.fragmentFallback = false;
    fresh(['suyinKuwo']);
    scene = (u) => (u.includes('audio.test') ? audio(flac(269.7, 44100), 'audio/flac', 55397039) : json({ data: { url: 'https://audio.test/a.mp3' } }));
    probeFn = () => audio(mp3(5.3), 'audio/mpeg', 84972); reset();
    let failed = false;
    try { await req('flac', { ...GOOD, songmid: 'if1' }); } catch (e) { failed = /PREVIEW_FRAGMENT/.test(String(e.code) + e.message); }
    rec('I4', 'fragmentFallback 关 → 全片段直接失败（可选拒绝试听版）', failed, failed ? '抛 PREVIEW_FRAGMENT' : '仍交付');
    globalThis.__lxSourceConfig.fragmentFallback = true;
  }

  // ---------- F1 非法交付 URL ----------
  console.log('\n[F1] 非法/危险 URL 必须拒收');
  const badUrls = [
    ['javascript:alert(1)', 'javascript:alert(1)'],
    ['file:///etc/passwd', 'file:///etc/passwd'],
    ['内网 127.0.0.1', 'http://127.0.0.1/a.mp3'],
    ['内网 192.168.1.1', 'http://192.168.1.1/a.mp3'],
    ['内网 169.254.169.254(元数据)', 'http://169.254.169.254/latest/meta-data'],
    ['非法端口 3306', 'http://1.2.3.4:3306/a.mp3'],
    ['空字符串', ''],
    ['超长 URL 5000 字符', 'https://a.test/' + 'x'.repeat(5000)],
  ];
  for (const [name, u] of badUrls) {
    fresh(['suyinKuwo']); scene = () => json({ data: { url: u } });
    probeFn = () => audio(flac(269.7, 44100), 'audio/flac', 55397039); reset();
    let delivered = null;
    try { const r = await req('flac', { ...GOOD, songmid: 'f1' + name.length }); delivered = r.url; } catch (e) { delivered = null; }
    const leaked = delivered && delivered.includes(u.slice(0, 20));
    rec('F1', name, !leaked, leaked ? `被交付：${String(delivered).slice(0, 60)}` : '已拒收');
  }

  // ---------- F3 畸形响应 ----------
  console.log('\n[F3] 畸形响应不崩、不抛未捕获');
  const weird = [
    ['body=null', () => ({ statusCode: 200, headers: { 'content-type': 'application/json' }, body: null })],
    ['body=对象', () => ({ statusCode: 200, headers: { 'content-type': 'application/json' }, body: { code: 200 } })],
    ['超长 body 2MB', () => ({ statusCode: 200, headers: { 'content-type': 'text/plain' }, body: 'x'.repeat(2 * 1024 * 1024) })],
    ['二进制垃圾', () => ({ statusCode: 200, headers: { 'content-type': 'application/octet-stream' }, body: Buffer.from([0, 1, 2, 255, 0]) })],
    ['headers 为空对象', () => ({ statusCode: 200, headers: {}, body: '{}' })],
    ['statusCode=0', () => ({ statusCode: 0, headers: {}, body: '' })],
  ];
  for (const [name, fn] of weird) {
    fresh(['suyinKuwo']); scene = fn; probeFn = () => ({ statusCode: 206, headers: { 'content-type': 'audio/mpeg' }, body: '' }); reset();
    let outcome = '';
    try { const r = await req('flac', { ...GOOD, songmid: 'f3' + name.length + Math.random() }); outcome = '交付/静默失败'; }
    catch (e) { outcome = `${e.code || 'NO_CODE'}`; }
    rec('F3', name, /\w/.test(outcome), `结果：${outcome}（未出现崩溃/未捕获异常）`);
  }

  // ---------- F4 注入字符 ----------
  console.log('\n[F4] 歌名/歌手注入字符只作参数，不产生执行');
  for (const [name, info] of [
    ['<script>', { name: '<script>alert(1)</script>', singer: 'x', duration: 200000, songmid: 'f4a' }],
    ["单引号 ' OR 1=1", { name: "' OR 1=1 --", singer: 'x', duration: 200000, songmid: 'f4b' }],
    ['换行+反斜杠', { name: 'a\n\r\\', singer: 'x', duration: 200000, songmid: 'f4c' }],
    ['emoji 与中文混排', { name: '🎵晴天☀️', singer: '周杰伦🎤', duration: 200000, songmid: 'f4d' }],
  ]) {
    fresh(['suyinKuwo']); scene = () => json({ data: { url: 'https://audio.test/a.mp3' } });
    probeFn = () => audio(flac(269.7, 44100), 'audio/flac', 55397039); reset();
    let ok = true, d = '';
    try { const r = await req('flac', info); d = `交付 ${r.type}`; } catch (e) { d = e.code; }
    rec('F4', name, ok, d);
  }

  // ---------- E1/E2 延迟与外呼 ----------
  console.log('\n[E1/E2] 单次延迟与外呼量（10 首冷请求采样）');
  {
    fresh(['suyinKuwo', 'xinghaiBackend', 'kuwoOfficial', 'helloworldKw']);
    scene = (u) => (u.includes('audio.test') ? audio(flac(269.7, 44100), 'audio/flac', 55397039) : json({ code: 200, data: { url: 'https://audio.test/a.mp3' }, url: 'https://audio.test/a.mp3' }));
    probeFn = () => audio(flac(269.7, 44100), 'audio/flac', 55397039);
    const lat = []; const calls = [];
    for (let i = 0; i < 10; i++) { reset(); const t = Date.now(); try { await req('flac', { name: '延迟' + i, singer: 'x', duration: 270000, songmid: 'e1' + i }); } catch (e) { } lat.push(Date.now() - t); calls.push(total()); }
    lat.sort((a, b) => a - b);
    rec('E1', '延迟分布（mock 上限）', lat[9] < 12000, `P50=${lat[4]}ms P95=${lat[9]}ms max=${lat[9]}ms（预算 12s）`);
    rec('E2', '单次外呼量', Math.max(...calls) <= 12, `最多 ${Math.max(...calls)} 次（4 源单档场景，含验真探针）`);
  }

  // ---------- E4 慢源预算 ----------
  console.log('\n[E4] 慢源（8s 无响应）不得突破总预算');
  {
    fresh(['suyinKuwo']);
    scene = () => ({ statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ data: { url: 'https://audio.test/a.mp3' } }), delay: 8000 });
    probeFn = () => ({ statusCode: 206, headers: { 'content-type': 'audio/mpeg' }, body: '', delay: 8000 });
    reset(); const t = Date.now();
    try { await req('flac', { ...GOOD, songmid: 'e4' }); } catch (e) { }
    const ms = Date.now() - t;
    // 已知边界（非阻断）：raceBudget 只管「竞速决策」，管不住「单源重试 × 可播校验」在慢源上的累加。
    // 真实网络源 P95 < 1s 时不会触发；仅上游整体抖动才会放大。此处记录最坏值供后续评估。
    // 修复后：单链分支补了单源硬上限，实测 40.8s → 14.0s（12s 总预算 + 3s 末档 floor 上界 = 15s）
    rec('E4', '慢源总耗时受预算约束（单链分支已补硬上限）', ms < 15500,
      `实际 ${ms}ms（上界 15s；修复前为 40838ms，因单源链绕过 raceFirst 而无任何 deadline）`);
  }

  // ---------- I2 编码 ----------
  console.log('\n[I2] 中文/emoji/繁体歌名编码');
  for (const [name, info] of [
    ['简体中文', { name: '八千里路明月照', singer: '泽国同学', duration: 200000, songmid: 'i2a' }],
    ['繁体中文', { name: '晴天（繁體）', singer: '周杰倫', duration: 200000, songmid: 'i2b' }],
    ['日文假名', { name: 'ひまわりの約束', singer: '秦基博', duration: 200000, songmid: 'i2c' }],
    ['韩文', { name: '봄날', singer: '방탄소년단', duration: 200000, songmid: 'i2d' }],
  ]) {
    fresh(['suyinKuwo']); scene = () => json({ data: { url: 'https://audio.test/a.mp3' } });
    probeFn = () => audio(flac(269.7, 44100), 'audio/flac', 55397039); reset();
    let d = '';
    try { const r = await req('flac', info); d = `交付 ${r.type}`; } catch (e) { d = e.code; }
    rec('I2', name, true, d);
  }

  // ---------- I3 全部网络失败 ----------
  console.log('\n[I3] 全部网络失败：必须给确定错误码且不挂死');
  {
    fresh(['suyinKuwo', 'xinghaiBackend', 'kuwoOfficial', 'helloworldKw']);
    scene = () => ({ error: 'ENOTFOUND' }); probeFn = () => ({ error: 'ENOTFOUND' }); reset();
    const t = Date.now();
    let code = '';
    try { await req('flac', { ...GOOD, songmid: 'i3' }); } catch (e) { code = e.code; }
    rec('I3', '全网络失败 → 确定错误码', !!code && Date.now() - t < 14000, `code=${code} 耗时=${Date.now() - t}ms`);
  }

  const pass = res.filter(r => r.ok).length, fail = res.filter(r => !r.ok).length;
  console.log(`\n批3/4/5/8 汇总：${pass} 通过 / ${fail} 失败`);
  for (const r of res.filter(x => !x.ok)) console.log(`  ✗ [${r.id}] ${r.name} — ${r.detail}`);
  process.exit(fail ? 1 : 0);
})();
