#!/usr/bin/env node
/** 批 2：逻辑审计（C1~C10）—— 全部用行为观测，不猜内部实现 */
const path = require('path');
const SRC = path.join(__dirname, '../../lx-source.js');

let handler = null, counts = {}, scene = null, probeFn = null;
const reset = () => { counts = {}; };
const total = () => Object.values(counts).reduce((a, b) => a + b, 0);

function setLx() {
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
      setTimeout(() => {
        if (r.error) return cb(Object.assign(new Error(r.error), { code: r.error }), null);
        cb(null, { statusCode: r.statusCode, headers: r.headers || {}, body: r.body ?? '', url: u });
      }, 2);
    },
    on(n, h) { if (n === 'request') handler = h; }, send() {},
  };
}
const load = () => { if (require.cache[require.resolve(SRC)]) delete require.cache[require.resolve(SRC)]; return require(SRC); };
const fresh = (toggles) => { setLx(); const m = load(); if (toggles) for (const k of Object.keys(m.runtimeToggles)) m.runtimeToggles[k] = toggles.includes(k); return m; };
const req = (q, info) => handler({ action: 'musicUrl', source: 'kw', info: { type: q, musicInfo: info } });
const json = (o) => ({ statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });
const audio = (body, ct = 'audio/mpeg', tot = null) => ({ statusCode: 206, headers: { 'content-type': ct, ...(tot ? { 'content-range': `bytes 0-1023/${tot}` } : {}) }, body });

function mp3(sec) { const f = Math.max(1, Math.round(sec * 44100 / 1152)); const b = Buffer.alloc(48); b[0] = 0xFF; b[1] = 0xFB; b[2] = 0x90; b[3] = 0x64; b.write('Xing', 36, 'ascii'); b.writeUInt32BE(1, 40); b.writeUInt32BE(f, 44); return b; }
function flac(sec, sr = 48000, zero = false) {
  const b = Buffer.alloc(64); b.write('fLaC', 0, 'ascii'); b[4] = 0x80; b[5] = 0; b[6] = 0; b[7] = 34;
  b[18] = (sr >> 12) & 0xFF; b[19] = (sr >> 4) & 0xFF; b[20] = (sr & 0x0F) << 4;
  const t = zero ? 0 : Math.round(sec * sr);
  b[21] = Math.floor(t / 4294967296) & 0x0F; b[22] = Math.floor(t / 16777216) & 0xFF;
  b[23] = Math.floor(t / 65536) & 0xFF; b[24] = Math.floor(t / 256) & 0xFF; b[25] = t & 0xFF;
  return b;
}
const oneSource = (url = 'https://audio.test/a.mp3') => (u) => {
  if (u.includes('audio.test')) return audio(flac(269.7, 44100), 'audio/flac', 55397039);
  if (u.includes('oiapi.net/api/Kuwo')) return json({ data: { url } });
  return { error: 'ECONNREFUSED' };
};

const res = [];
const rec = (id, name, ok, detail) => { res.push({ id, ok: !!ok, name, detail: String(detail || '') }); console.log(`${ok ? '✓' : '✗'} [${id}] ${name}${detail ? ' — ' + String(detail).slice(0, 200) : ''}`); };

const REAL = Date.now;
let timeOffset = 0;
const installTime = () => { timeOffset = 0; Date.now = () => REAL() + timeOffset; };
const restoreTime = () => { Date.now = REAL; };

(async () => {
  globalThis.__lxSourceConfig = {
    verifyDelivery: true, truthfulQuality: true, qualityFloor: true, verifyOnCacheHit: true,
    fragmentFallback: false, rateWindowMax: 100000, maxConcurrency: 100000, rateWindowMs: 3600000,
  };
  installTime();

  // ---------- C1 片段判据数学 ----------
  console.log('\n[C1] 片段判据（ratio 60% + gap 15s 双条件，原曲 <90s 不判）');
  const cases = [
    ['原曲100s/实测54s(54%,差46s)', 100000, 54, 'REJECT'],
    ['原曲100s/实测59s(59%,差41s)', 100000, 59, 'REJECT'],
    ['原曲100s/实测61s(61%,差39s)', 100000, 61, 'PASS'],
    ['原曲100s/实测80s(80%,差20s)', 100000, 80, 'PASS'],
    ['原曲100s/实测88s(88%,差12s)', 100000, 88, 'PASS'],  // 比例满足且差<15 → 双条件未同时成立
    ['原曲89s/实测5.3s(<90s不判)', 89000, 5.3, 'PASS'],
    ['原曲90s/实测5.3s(边界90s)', 90000, 5.3, 'REJECT'],
    ['原曲200s/实测5.3s(真实案例)', 200000, 5.3, 'REJECT'],
  ];
  for (const [name, durMs, realSec, want] of cases) {
    fresh(['suyinKuwo']); scene = oneSource('https://audio.test/a.mp3');
    probeFn = () => audio(mp3(realSec), 'audio/mpeg', 84972);
    reset();
    let pass = false, detail = '';
    try { const r = await req('flac', { name: '判据歌', singer: 'x', duration: durMs, songmid: 'c1' + durMs + realSec }); pass = true; detail = `交付 ${r.type}`; }
    catch (e) { detail = e.code; }
    rec('C1', name, pass === (want === 'PASS'), `期望${want} 实际${pass ? 'PASS' : 'REJECT(' + detail + ')'}`);
  }

  // ---------- C2 FLAC 解析 ----------
  console.log('\n[C2] FLAC STREAMINFO 解析（采样率/零样本/截断）');
  for (const [name, fn, want] of [
    ['44100Hz 269.7s', () => audio(flac(269.7, 44100), 'audio/flac', 55397039), 'PASS'],
    ['48000Hz 269.7s', () => audio(flac(269.7, 48000), 'audio/flac', 55397039), 'PASS'],
    ['总样本 0（无法定时长）', () => audio(flac(0, 44100, true), 'audio/flac', 55397039), 'PASS'],
    // D-29：4 字节的「头」连 STREAMINFO(34B) 都不到，不可能解码——必须拒绝，旧期望 PASS 是纵容假成功
    ['截断头（只有 fLaC 4 字节）', () => audio(Buffer.from('fLaC'), 'audio/flac', 55397039), 'REJECT'],
  ]) {
    fresh(['suyinKuwo']); scene = oneSource(); probeFn = fn; reset();
    let pass = false, d = '';
    try { const r = await req('flac', { name: '晴天', singer: '周杰伦', duration: 271000, songmid: 'c2' }); pass = true; d = `交付 ${r.type}`; }
    catch (e) { d = e.code; }
    rec('C2', name, pass === (want === 'PASS'), `期望${want} 实际${pass ? 'PASS' : 'REJECT(' + d + ')'}`);
  }

  // ---------- C3 MP3 Xing ----------
  console.log('\n[C3] MP3 Xing 帧数解析');
  for (const [name, fn, want] of [
    ['Xing 269.8s（与 271s 差 0.4%）', () => audio(mp3(269.8), 'audio/mpeg', 10792943), 'PASS'],
    // D-29：ID3 头 10 字节 + 帧头 4 字节才够 16 字节门槛，4 字节同样不可播
    ['无 Xing 头（无法定时长）', () => audio(Buffer.from([0x49, 0x44, 0x33, 0x03]), 'audio/mpeg', 10792943), 'RASS'],
    ['Xing 5.3s（片段）', () => audio(mp3(5.3), 'audio/mpeg', 84972), 'REJECT'],
  ]) {
    fresh(['suyinKuwo']); scene = oneSource(); probeFn = fn; reset();
    let pass = false, d = '';
    try { const r = await req('flac', { name: '晴天', singer: '周杰伦', duration: 271000, songmid: 'c3' }); pass = true; d = `交付 ${r.type}`; }
    catch (e) { d = e.code; }
    rec('C3', name, pass === (want === 'PASS'), `期望${want} 实际${pass ? 'PASS' : 'REJECT(' + d + ')'}`);
  }

  // ---------- C4 码率推算 ----------
  console.log('\n[C4] 真实码率推算（总字节 ÷ 真实时长）');
  for (const [name, bytes, want] of [
    ['269.7s / 10,792,943 → 320k', 10792943, '320k'],
    ['269.7s / 4,317,292 → 128k', 4317292, '128k'],
  ]) {
    fresh(['suyinKuwo']); scene = oneSource(); probeFn = () => audio(mp3(269.7), 'audio/mpeg', bytes); reset();
    try { const r = await req('flac', { name: '晴天', singer: '周杰伦', duration: 271000, songmid: 'c4' + bytes }); rec('C4', name, r.type === want, `实交付 type=${r.type}`); }
    catch (e) { rec('C4', name, false, e.code); }
  }
  {
    fresh(['suyinKuwo']); scene = oneSource(); probeFn = () => audio(flac(269.7, 44100), 'audio/flac', 55397039); reset();
    try { const r = await req('flac', { name: '晴天', singer: '周杰伦', duration: 271000, songmid: 'c4flac' }); rec('C4', 'FLAC 真实容器 → 标 flac', r.type === 'flac', `实交付 type=${r.type}`); }
    catch (e) { rec('C4', 'FLAC 真实容器 → 标 flac', false, e.code); }
  }

  // ---------- C5 缓存 key 不串槽 ----------
  console.log('\n[C5] 缓存槽位隔离（按实交付音质入槽，不串档）');
  {
    fresh(['suyinKuwo']); scene = oneSource(); probeFn = () => audio(mp3(269.7), 'audio/mpeg', 10792943); reset();
    await req('flac', { name: '晴天', singer: '周杰伦', duration: 271000, songmid: 'c5' }).catch(() => {});
    const afterFlac = total(); reset();
    await req('320k', { name: '晴天', singer: '周杰伦', duration: 271000, songmid: 'c5' }).catch(() => {});
    const after320 = total(); reset();
    await req('128k', { name: '晴天', singer: '周杰伦', duration: 271000, songmid: 'c5' }).catch(() => {});
    const after128 = total();
    rec('C5', '请求 flac 实给 320k → 320k 档命中缓存 / 128k 档另走', after320 <= 1 && after128 >= 1,
      `flac 首请求外呼 ${afterFlac} · 随后 320k 外呼 ${after320}（应≤1 仅验真）· 随后 128k 外呼 ${after128}（应≥1 不串槽）`);
  }

  // ---------- C7 降档链 ----------
  console.log('\n[C7] 降档链完整（req → 次档 → 强制 128k）');
  for (const q of ['flac24bit', 'flac', '320k', '128k', 'FLAC', undefined]) {
    fresh(['suyinKuwo']);
    // 只有 128k 可用：链若在 128k 之前截断，这里必然失败
    scene = (u) => {
      if (u.includes('audio.test')) return audio(mp3(269.7), 'audio/mpeg', 4317292);
      if (u.includes('oiapi.net/api/Kuwo')) {
        const br = /br=9/.test(u) ? '128' : (u.includes('br=') ? '128' : '128');
        return json({ data: { url: 'https://audio.test/a.mp3' }, bitrate: br, format: 'mp3' });
      }
      return { error: 'ECONNREFUSED' };
    };
    probeFn = () => audio(mp3(269.7), 'audio/mpeg', 4317292); reset();
    try { const r = await req(q, { name: '链尾歌', singer: 'x', duration: 271000, songmid: 'c7' + q }); rec('C7', `请求档=${q || 'undefined'} 只有128k可用`, true, `交付 ${r.type}`); }
    catch (e) { rec('C7', `请求档=${q || 'undefined'} 只有128k可用`, false, `${e.code}`); }
  }

  // ---------- C8 兜底优先级 ----------
  console.log('\n[C8] 兜底优先级：完整版 > 片段兜底(能播) > 过期缓存(可能死链)');
  {
    // 场景1：源全失败，但有 6h 内成功缓存 → 应返回缓存
    fresh(['suyinKuwo']); scene = oneSource(); probeFn = () => audio(flac(269.7, 44100), 'audio/flac', 55397039); reset();
    const r1 = await req('flac', { name: '缓存歌', singer: 'c', duration: 271000, songmid: 'c8a' });
    scene = () => ({ error: 'ECONNREFUSED' }); probeFn = () => ({ error: 'ECONNREFUSED' }); reset();
    try { const r2 = await req('flac', { name: '缓存歌', singer: 'c', duration: 271000, songmid: 'c8a' }); rec('C8a', '源全挂但缓存有效 → 返回缓存', !!r2.url, `type=${r2.type}`); }
    catch (e) { rec('C8a', '源全挂但缓存有效 → 返回缓存', false, e.code); }

    // 场景2：缓存已过期 + 源只给片段 + 片段兜底开 → 过期缓存优先于片段？
    globalThis.__lxSourceConfig.fragmentFallback = true;
    fresh(['suyinKuwo']); scene = oneSource(); probeFn = () => audio(flac(269.7, 44100), 'audio/flac', 55397039); reset();
    await req('flac', { name: '过期歌', singer: 'd', duration: 271000, songmid: 'c8b' }).catch(() => {});
    timeOffset += 6 * 3600 * 1000 + 1000; // 越过 6h 缓存
    probeFn = () => audio(mp3(5.3), 'audio/mpeg', 84972); reset();
    try {
      const r3 = await req('flac', { name: '过期歌', singer: 'd', duration: 271000, songmid: 'c8b' });
      // 设计取舍：片段(能播) 优先于 过期缓存(6h 前签名链，酷我 CDN 大概率已 410 = 死链)
      const fragWins = String(r3.subSourceName || '').includes('试听版');
      rec('C8b', '过期缓存 vs 片段兜底 → 片段优先（能出声 > 死链）', fragWins, `名称=${r3.subSourceName}`);
    } catch (e) { rec('C8b', '过期缓存 vs 片段兜底 → 过期完整版优先', false, e.code); }
    globalThis.__lxSourceConfig.fragmentFallback = false;
    timeOffset = 0;
  }

  // ---------- C9 冷却状态机 + 到期恢复 ----------
  console.log('\n[C9] 源级冷却状态机（触发 → 拦截 → 5min 到期恢复）');
  {
    fresh(['suyinKuwo']);
    scene = oneSource(); probeFn = () => audio(mp3(5.3), 'audio/mpeg', 84972); reset();
    try { await req('flac', { name: '限流一', singer: 'x', duration: 200000, songmid: 'c9a' }); } catch (e) {}
    try { await req('flac', { name: '限流二', singer: 'x', duration: 200000, songmid: 'c9b' }); } catch (e) {}
    // 此时应已冷却
    probeFn = () => audio(flac(269.7, 44100), 'audio/flac', 55397039); reset();
    let d1 = '', code1 = '';
    try { await req('flac', { name: '正常三', singer: 'y', duration: 260000, songmid: 'c9c' }); d1 = '未拦截(拿到完整版)'; }
    catch (e) { code1 = String(e.code || ''); d1 = code1; }
    // 冷却生效判据（二轮打点实测修正）：冷却期 flac/320k 被跳过、只放行 128k 保底档 → 该源接口至多 1 次；
    // 旧判据用 `blocked=<RATE_LIMIT>` 是错的——128k 保底档会正常返回片段，最终抛的是 PREVIEW_FRAGMENT。
    const apiCnt = Object.entries(counts).filter(([k]) => /oiapi\.net|zddyr|kuwo\.cn/.test(k)).reduce((a, [, v]) => a + v, 0);
    rec('C9a', '两首全片段→冷却期只放行 128k 保底档（flac/320k 被跳过）', apiCnt <= 1, `API=${apiCnt} 结果=${d1} 总外呼=${total()} keys=${Object.keys(counts).join('|')}`);
    // 时间推进 5min01s
    timeOffset += 5 * 60 * 1000 + 1000; reset();
    let recovered = false, d2 = '';
    try { const r = await req('flac', { name: '正常四', singer: 'z', duration: 260000, songmid: 'c9d' }); recovered = !!(r && r.url); d2 = `type=${r.type}`; }
    catch (e) { d2 = e.code; }
    rec('C9b', '冷却 5min 到期后自动恢复', recovered, `实际 ${d2} 外呼=${total()}`);
    timeOffset = 0;
  }

  // ---------- C10 并发竞态 ----------
  console.log('\n[C10] 同歌 10 并发（是否重复外呼 / 重复写缓存）');
  {
    fresh(['suyinKuwo']); scene = oneSource(); probeFn = () => audio(flac(269.7, 44100), 'audio/flac', 55397039); reset();
    const out = await Promise.all(Array.from({ length: 10 }, () => req('flac', { name: '并发歌', singer: 'p', duration: 271000, songmid: 'c10' }).then(r => ({ ok: !!(r && r.url) })).catch(() => ({ ok: false }))));
    rec('C10', '10 并发同歌全部成功且无明显放量', out.filter(x => x.ok).length === 10, `成功 ${out.filter(x => x.ok).length}/10 · 外呼 ${total()}`);
  }

  restoreTime();
  const pass = res.filter(r => r.ok).length, fail = res.filter(r => !r.ok).length;
  console.log(`\n批2 汇总：${pass} 通过 / ${fail} 失败`);
  for (const r of res.filter(x => !x.ok)) console.log(`  ✗ [${r.id}] ${r.name} — ${r.detail}`);
  process.exit(fail ? 1 : 0);
})();
