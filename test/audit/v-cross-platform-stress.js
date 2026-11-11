#!/usr/bin/env node
/**
 * 跨平台兜底压力测试（V 组，v8.12.1）
 *
 * 验收目标：
 *   V1  20 并发同歌（kw 无原版、tx 有）→ 20/20 交付且全部 sourcePlatform=tx
 *   V2  20 并发同歌的 QQ 搜索次数不放大（≤20）
 *   V3  50 次顺序同歌 → 10min 缓存生效，QQ 搜索只发生 1 次
 *   V4  201 首不同歌 → 跨平台缓存超上限清空后仍全部可交付，不串歌
 *   V5  crossPlatformEnabled=false → 10/10 失败且零 QQ 搜索
 *   V6  关闭目标源后不得交付其缓存；重开后新歌可恢复 tx
 *   V7  只有 remix/DJ/翻唱候选 → 30/30 拒绝，0 错歌
 *   V8  主平台命中/跨平台命中交替 40 次 → 标签平台不串
 *   V9  目标平台搜索 5xx + 主平台 NOT_FOUND → 保留主平台 NOT_FOUND，不假成功
 *   V10 10 并发慢主平台（300ms）+ grace=1ms → 10/10 交付 kw
 *   V11 5 次跨平台成功 → healthEvents 至少 5 条 cross_platform，且无歌名/URL
 *   V12 100 首主平台全部命中 → 零跨平台搜索
 *
 * 运行：/usr/local/bin/node20 test/audit/v-cross-platform-stress.js
 */
'use strict';

const path = require('path');
const SRC = path.join(__dirname, '../../lx-source.js');

let handler = null;
let current = null;
let scene = null;
const calls = [];
const seenBodies = [];

const setLx = () => {
  handler = null;
  globalThis.lx = {
    EVENT_NAMES: { inited: 'inited', request: 'request', updateAlert: 'updateAlert' },
    version: '2.0.0',
    env: 'mobile',
    utils: { buffer: { from: (d, e) => Buffer.from(d, e), bufToString: (b, e) => b.toString(e) } },
    request(url, opts, cb) {
      const u = String(url);
      calls.push(u);
      let r;
      try { r = scene ? scene(u, opts) : { error: 'ECONNREFUSED' }; } catch (e) { return setTimeout(() => cb(e, null), 2); }
      if (!r) r = { error: 'ECONNREFUSED' };
      setTimeout(() => {
        if (r.error) return cb(Object.assign(new Error(r.error), { code: r.error }), null);
        cb(null, { statusCode: r.statusCode, headers: r.headers || {}, body: r.body ?? '', url: u });
      }, r.delay || 2);
    },
    on(n, h) { if (n === 'request') handler = h; },
    send() {},
  };
};

const load = () => {
  const p = require.resolve(SRC);
  if (require.cache[p]) delete require.cache[p];
  return require(SRC);
};

const fresh = (toggles, extraCfg = {}) => {
  setLx();
  calls.length = 0;
  seenBodies.length = 0;
  // 压测前置（TESTING.md §3）：不关掉熔断/限速/并发保护，第 5 首就会被本地保护拦掉，
  // 测到的是保护态而不是跨平台路径。
  globalThis.__lxSourceConfig = Object.assign({
    breakerThreshold: 999,
    rateWindowMax: 100000,
    rateWindowMs: 3600000,
    maxConcurrency: 100000,
    qualityShortCircuit: false,
  }, extraCfg);
  const m = load();
  current = m;
  for (const k of Object.keys(m.runtimeToggles)) m.runtimeToggles[k] = false;
  for (const k of toggles) m.runtimeToggles[k] = true;
  return m;
};

const call = (action, info, source = 'kw') => handler({ action, source, info });
const json = (o) => ({ statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });
const audio = (body, ct = 'audio/mpeg', tot = 4847322) => ({
  statusCode: 206,
  headers: { 'content-type': ct, 'content-range': `bytes 0-63/${tot}` },
  body,
});
function mp3(sec) {
  const f = Math.max(0, Math.round(sec * 44100 / 1152));
  const b = Buffer.alloc(64);
  b[0] = 0xFF; b[1] = 0xFB; b[2] = 0x90; b[3] = 0x64;
  b.write('Xing', 36, 'ascii');
  b.writeUInt32BE(1, 40);
  b.writeUInt32BE(f, 44);
  return b;
}

const res = [];
const rec = (id, name, ok, detail) => {
  res.push({ id, ok: !!ok, name, detail: String(detail || '') });
  console.log(`${ok ? '✓' : '✗'} [${id}] ${name}${detail ? ' — ' + String(detail).slice(0, 240) : ''}`);
};
const ev = async(traceId) => {
  try { return await call('healthEvents', traceId ? { traceId } : {}, 'kw'); } catch (e) { return { events: [], error: e.message }; }
};
const queryOf = (u, keys) => {
  for (const k of keys) {
    const m = u.match(new RegExp(`[?&]${k}=([^&]+)`));
    if (m) return decodeURIComponent(m[1]);
  }
  return '';
};
const midFor = (name) => '004' + Buffer.from(String(name)).toString('hex').slice(0, 9).toUpperCase();
const musicInfo = (name, singer = 'Michita (ミチタ)', duration = 302) => ({ name, singer, duration });

function sceneFor({ kw = 'auto', qq = 'match', wy = 'empty', searchStatus = 200, slowKw = false } = {}) {
  return (u, opts) => {
    if (u.includes('search.kuwo.cn')) {
      const q = queryOf(u, ['all']);
      if (kw === 'all-missing' || /^Miss /.test(q)) return json({ abslist: [] });
      if (kw === 'exact-all' || /^Exact /.test(q)) {
        return json({
          abslist: [{
            MP3RID: 'MP3_' + Buffer.from(q).toString('hex').slice(0, 10),
            NAME: q,
            ARTIST: 'Michita (ミチタ)',
            DURATION: '302',
          }],
        });
      }
      return json({ abslist: [] });
    }
    if (u.includes('antiserver.kuwo.cn')) {
      // 与 u-cross-platform 一致：antiserver 返回的是「音频 URL 文本」，不是音频字节；
      // 直接回二进制会让交付验真判成 NOT_AUDIO。
      return {
        statusCode: 200,
        headers: { 'content-type': 'text/plain' },
        body: 'https://kw-er.kuwo.cn/resource/30106/trackmedia/long/M500001GEZeb0vJKqv.mp3',
        delay: slowKw ? 300 : 2,
      };
    }
    if (u.includes('c.y.qq.com/soso')) {
      if (searchStatus !== 200) {
        return { statusCode: searchStatus, headers: { 'content-type': 'text/html' }, body: 'upstream error', delay: 2 };
      }
      const q = queryOf(u, ['w']);
      if (qq === 'empty') return json({ code: 0, data: { song: { list: [] } } });
      if (qq === 'remix') {
        return json({
          code: 0,
          data: {
            song: {
              list: [{
                songmid: '000REMIX' + Buffer.from(q).toString('hex').slice(0, 5),
                songname: q + ' (Remix电音版)',
                singer: [{ name: 'Michita' }, { name: '电音联盟' }],
                albumname: 'Cry For Me',
                interval: 103,
              }],
            },
          },
        });
      }
      return json({
        code: 0,
        data: {
          song: {
            list: [{
              songmid: midFor(q),
              songname: q,
              singer: [{ name: 'Michita (ミチタ)' }],
              albumname: 'Pureness',
              interval: 302,
            }],
          },
        },
      });
    }
    if (u.includes('music.163.com/api/search/get/web')) {
      if (wy === 'empty') return json({ result: { songs: [] } });
      return json({ result: { songs: [] } });
    }
    if (u.includes('api.music.lerd.dpdns.org/tx')) {
      try {
        const body = JSON.parse(String(opts && opts.body || '{}'));
        seenBodies.push(body);
      } catch (e) { seenBodies.push({}); }
      return json({
        code: 303,
        data: {
          request: { url: 'https://api.vkeys.cn/v2/music/tencent/geturl?mid=' + (seenBodies[seenBodies.length - 1]?.musicInfo?.songmid || 'x') + '&quality=6', options: { method: 'GET', headers: {} } },
          response: { check: { key: ['body', 'code'], value: 200 }, url: ['body', 'data', 'url'] },
        },
        msg: 'success',
      });
    }
    if (u.includes('api.vkeys.cn/v2/music/tencent/geturl')) {
      return json({ code: 200, data: { url: 'http://ws.stream.qqmusic.qq.com/M50000145zmG37Aqx4.mp3?guid=api.vkeys.cn&vkey=test' } });
    }
    if (u.includes('ws.stream.qqmusic.qq.com') || u.includes('kw-er.kuwo.cn')) {
      return audio(mp3(302));
    }
    return json({});
  };
}

const qqSearchCount = () => calls.filter(u => u.includes('c.y.qq.com/soso')).length;
const isTx = (r) => r && r.sourcePlatform === 'tx' && /qqmusic\.qq\.com/.test(r.url || '');
const isKw = (r) => r && r.sourcePlatform === 'kw';

(async () => {
  // V1/V2 —— 20 并发同歌
  console.log('\n[V1/V2] 20 并发同歌');
  fresh(['kuwoOfficial', 'juheTx']);
  scene = sceneFor();
  {
    const info = musicInfo('Cry For Me (feat. Ami)');
    const rs = await Promise.all(Array.from({ length: 20 }, (_, i) => call('musicUrl', {
      type: '128k', traceId: 'v1_' + i, musicInfo: info,
    }, 'kw').then(r => ({ ok: true, r })).catch(e => ({ ok: false, e }))));
    const ok = rs.filter(x => x.ok);
    rec('V1', '20/20 交付且全部 tx', ok.length === 20 && ok.every(x => isTx(x.r)), `ok=${ok.length} platforms=${ok.map(x => x.r && x.r.sourcePlatform).join(',')}`);
    rec('V2', 'QQ 搜索次数不放大（≤20）', qqSearchCount() <= 20, `qqSearch=${qqSearchCount()}`);
  }

  // V3 —— 50 次顺序同歌，缓存只搜一次
  console.log('\n[V3] 50 次顺序同歌');
  fresh(['kuwoOfficial', 'juheTx']);
  scene = sceneFor();
  {
    const info = musicInfo('Cry For Me (feat. Ami)');
    let ok = 0;
    for (let i = 0; i < 50; i++) {
      try {
        const r = await call('musicUrl', { type: '128k', traceId: 'v3_' + i, musicInfo: info }, 'kw');
        if (isTx(r)) ok++;
      } catch (e) { /* ignore */ }
    }
    rec('V3', '50/50 tx 且 QQ 搜索=1', ok === 50 && qqSearchCount() === 1, `ok=${ok} qqSearch=${qqSearchCount()}`);
  }

  // V4 —— 201 首不同歌，缓存上限清空后仍可交付
  console.log('\n[V4] 201 首不同歌');
  fresh(['kuwoOfficial', 'juheTx']);
  scene = sceneFor();
  {
    let ok = 0;
    for (let i = 0; i < 201; i++) {
      try {
        const r = await call('musicUrl', { type: '128k', traceId: 'v4_' + i, musicInfo: musicInfo('Miss Song ' + i) }, 'kw');
        if (isTx(r)) ok++;
      } catch (e) { /* ignore */ }
    }
    rec('V4', '201/201 仍可交付 tx', ok === 201, `ok=${ok}`);
  }

  // V5 —— 总开关关闭，零跨平台搜索
  console.log('\n[V5] crossPlatformEnabled=false');
  fresh(['kuwoOfficial', 'juheTx'], { crossPlatformEnabled: false });
  scene = sceneFor();
  {
    let failed = 0;
    for (let i = 0; i < 10; i++) {
      try {
        await call('musicUrl', { type: '128k', traceId: 'v5_' + i, musicInfo: musicInfo('Miss Off ' + i) }, 'kw');
      } catch (e) { failed++; }
    }
    rec('V5', '10/10 失败且 QQ 搜索=0', failed === 10 && qqSearchCount() === 0, `failed=${failed} qqSearch=${qqSearchCount()}`);
  }

  // V6 —— 关源后不得交付缓存，重开新歌恢复
  console.log('\n[V6] 关源 / 重开');
  fresh(['kuwoOfficial', 'juheTx']);
  scene = sceneFor();
  {
    const info = musicInfo('Cry For Me (feat. Ami)');
    const first = await call('musicUrl', { type: '128k', traceId: 'v6_a', musicInfo: info }, 'kw');
    const toggledOff = current.__debug.toggleSource('juheTx', false);
    let second = null;
    let secondErr = null;
    try {
      second = await call('musicUrl', { type: '128k', traceId: 'v6_b', musicInfo: info }, 'kw');
    } catch (e) { secondErr = e; }
    const toggledOn = current.__debug.toggleSource('juheTx', true);
    let third = null;
    try {
      third = await call('musicUrl', { type: '128k', traceId: 'v6_c', musicInfo: musicInfo('Miss Reopen') }, 'kw');
    } catch (e) { third = e; }
    rec('V6', '关后不交付 tx、重开新歌恢复 tx',
      isTx(first) && !(second && second.subSource === 'juheTx') && isTx(third),
      JSON.stringify({ toggledOff, second: second && second.sourcePlatform, secondErr: secondErr && secondErr.code, toggledOn, third: third && (third.sourcePlatform || third.code) }));
  }

  // V7 —— 只有 remix 候选，全部拒绝
  console.log('\n[V7] remix-only 候选');
  fresh(['kuwoOfficial', 'juheTx']);
  scene = sceneFor({ qq: 'remix' });
  {
    let rejected = 0;
    for (let i = 0; i < 30; i++) {
      try {
        const r = await call('musicUrl', { type: '128k', traceId: 'v7_' + i, musicInfo: musicInfo('Miss Remix ' + i) }, 'kw');
        if (!r || !r.url) rejected++;
      } catch (e) { rejected++; }
    }
    rec('V7', '30/30 拒绝 remix', rejected === 30, `rejected=${rejected}`);
  }

  // V8 —— 主命中/跨命中交替
  console.log('\n[V8] 主/跨交替 40 次');
  fresh(['kuwoOfficial', 'juheTx']);
  scene = sceneFor();
  {
    let good = 0;
    for (let i = 0; i < 20; i++) {
      try {
        const a = await call('musicUrl', { type: '128k', traceId: 'v8a_' + i, musicInfo: musicInfo('Exact Song ' + i) }, 'kw');
        if (isKw(a)) good++;
        const b = await call('musicUrl', { type: '128k', traceId: 'v8b_' + i, musicInfo: musicInfo('Miss Song ' + i) }, 'kw');
        if (isTx(b)) good++;
      } catch (e) { /* ignore */ }
    }
    rec('V8', '40/40 平台标签不串', good === 40, `good=${good}`);
  }

  // V9 —— 目标 5xx + 主 NOT_FOUND
  console.log('\n[V9] 全目标 5xx');
  fresh(['kuwoOfficial', 'juheTx']);
  scene = sceneFor({ searchStatus: 500 });
  {
    let code = null;
    let delivered = false;
    try {
      const r = await call('musicUrl', { type: '128k', traceId: 'v9', musicInfo: musicInfo('Miss 5xx') }, 'kw');
      delivered = !!(r && r.url);
    } catch (e) { code = e && e.code; }
    rec('V9', '保留主平台 NOT_FOUND 且不假成功', !delivered && code === 'NOT_FOUND', `code=${code} delivered=${delivered}`);
  }

  // V10 —— 10 并发慢主平台
  console.log('\n[V10] 10 并发慢主平台');
  fresh(['kuwoOfficial', 'juheTx'], { crossPlatformGraceMs: 1, crossPlatformSearchTimeoutMs: 1 });
  scene = sceneFor({ qq: 'empty', slowKw: true });
  {
    const rs = await Promise.all(Array.from({ length: 10 }, (_, i) => call('musicUrl', {
      type: '128k', traceId: 'v10_' + i, musicInfo: musicInfo('Exact Slow ' + i),
    }, 'kw').then(r => ({ ok: true, r })).catch(e => ({ ok: false, e }))));
    const ok = rs.filter(x => x.ok && isKw(x.r));
    rec('V10', '10/10 慢主平台交付 kw', ok.length === 10, `ok=${ok.length} errs=${rs.filter(x => !x.ok).map(x => x.e && x.e.code).join(',')}`);
  }

  // V11 —— 跨平台健康事件隐私
  console.log('\n[V11] cross_platform 事件');
  fresh(['kuwoOfficial', 'juheTx']);
  scene = sceneFor();
  {
    for (let i = 0; i < 5; i++) {
      await call('musicUrl', { type: '128k', traceId: 'v11_' + i, musicInfo: musicInfo('Miss Event ' + i) }, 'kw');
    }
    const events = await ev();
    const cross = (events.events || []).filter(x => x.event === 'cross_platform' && x.platform === 'tx');
    const text = JSON.stringify(events.events || []);
    rec('V11', '≥5 条 tx 事件且无歌名/URL', cross.length >= 5 && !/Miss Event|https?:/.test(text), `count=${cross.length} privacy=${!/Miss Event|https?:/.test(text)}`);
  }

  // V12 —— 100 首主平台命中，零跨平台
  console.log('\n[V12] 100 首主平台全部命中');
  fresh(['kuwoOfficial', 'juheTx']);
  scene = sceneFor({ kw: 'exact-all' });
  {
    let ok = 0;
    for (let i = 0; i < 100; i++) {
      try {
        const r = await call('musicUrl', { type: '128k', traceId: 'v12_' + i, musicInfo: musicInfo('Exact Song ' + i) }, 'kw');
        if (isKw(r)) ok++;
      } catch (e) { /* ignore */ }
    }
    rec('V12', '100/100 kw 且 QQ 搜索=0', ok === 100 && qqSearchCount() === 0, `ok=${ok} qqSearch=${qqSearchCount()}`);
  }

  const fail = res.filter(x => !x.ok);
  console.log(`\n结果：${res.length - fail.length}/${res.length} 通过`);
  if (fail.length) {
    console.log('失败项：' + fail.map(x => `${x.id}:${x.name} (${x.detail})`).join(' | '));
    process.exit(1);
  }
  process.exit(0);
})();
