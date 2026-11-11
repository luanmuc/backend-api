#!/usr/bin/env node
/**
 * 跨平台兜底审计（U 组，v8.12.1）
 *
 * 验收目标：
 *   U1  kw 只有同名翻唱 → 拒绝翻唱，自动转 tx 并交付 Michita 原版
 *   U2  目标平台候选必须按 歌名+歌手+时长 严格匹配；remix/DJ/节奏版/翻唱全部拒绝
 *   U3  主平台成功时不发起任何跨平台搜索
 *   U4  跨平台成功结果带 sourcePlatform=tx / subSource=juheTx
 *   U5  成功缓存二次请求保留实际平台，且不再重复搜索
 *   U6  全平台无匹配 → NOT_FOUND（不是 NETWORK_TIMEOUT）
 *   U7  healthEvents 留下 cross_platform 事件
 *   U8  传给 tx 源的是 QQ songmid，不携带 kw rid
 *   U9  慢主平台最终成功时不被跨平台抢跑误杀
 *   U10 关闭目标源后，其跨平台缓存与成功缓存均失效
 *
 * 运行：/usr/local/bin/node20 test/audit/u-cross-platform.js
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
  globalThis.__lxSourceConfig = Object.assign({}, extraCfg);
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

const KW_COVER = {
  abslist: [{
    MP3RID: 'MP3_497813050',
    NAME: 'Cry For Me (feat. Ami)',
    ARTIST: 'ほんま　めいこ',
    DURATION: '302',
    FORMATS: 'MP3128,AAC48,OGG96,WMA',
  }],
};
const QQ_LIST = [
  { songmid: '004Drt082CV5gf', songname: 'Cry For Me (为我哭泣) (feat. Ami)', singer: [{ name: 'Michita (ミチタ)' }], albumname: 'Pureness', interval: 302 },
  { songmid: '004ENCl816uT5Y', songname: 'Cry For Me (feat. Ami)', singer: [{ name: 'insyufeng' }, { name: 'Michita (ミチタ)' }], albumname: 'Cry For Me', interval: 303 },
  { songmid: '000WrE0J4ea4uQ', songname: 'Cry For Me (Remix电音版)', singer: [{ name: 'Michita (ミチタ)' }, { name: '电音联盟' }], albumname: 'Cry For Me', interval: 103 },
  { songmid: '000PoGM23Svdfp', songname: 'Cry For Me (feat. Ami) (DJ极速版)', singer: [{ name: 'Michita' }], albumname: 'Cry For Me', interval: 194 },
  { songmid: '003iNd774A34l0', songname: 'Cry For Me (节奏氛围版)', singer: [{ name: 'Vnriet' }, { name: 'Michita' }], albumname: 'Cry For Me', interval: 318 },
  { songmid: '004HFrsF4LlZvF', songname: 'Cry For Me (feat.Ami)', singer: [{ name: 'Maggie_麦吉' }], albumname: 'Cry For Me', interval: 226 },
];

function baseScene({ kwCover = true, kwExact = false, qqList = QQ_LIST, wyList = [] } = {}) {
  return (u, opts) => {
    if (u.includes('search.kuwo.cn')) {
      return json({ abslist: kwExact
        ? [{ MP3RID: 'MP3_228908', NAME: 'Cry For Me (feat. Ami)', ARTIST: 'Michita (ミチタ)', DURATION: '302' }]
        : (kwCover ? KW_COVER.abslist : []) });
    }
    if (u.includes('antiserver.kuwo.cn')) {
      return { statusCode: 200, headers: { 'content-type': 'text/plain' }, body: 'https://kw-er.kuwo.cn/resource/30106/trackmedia/long/M500001GEZeb0vJKqv.mp3' };
    }
    if (u.includes('c.y.qq.com/soso')) {
      return json({ code: 0, data: { song: { list: qqList } } });
    }
    if (u.includes('music.163.com/api/search/get/web')) {
      return json({ result: { songs: wyList } });
    }
    if (u.includes('api.music.lerd.dpdns.org/tx')) {
      try {
        const body = JSON.parse(String(opts && opts.body || '{}'));
        seenBodies.push(body);
      } catch (e) { seenBodies.push({}); }
      return json({
        code: 303,
        data: {
          request: { url: 'https://api.vkeys.cn/v2/music/tencent/geturl?mid=004Drt082CV5gf&quality=6', options: { method: 'GET', headers: {} } },
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

(async () => {
  // U1/U2/U4/U7/U8 —— kw 只有翻唱，必须转 tx 原版
  console.log('\n[U1] kw 同名翻唱 → 拒绝 → tx 原版');
  fresh(['kuwoOfficial', 'juheTx']);
  scene = baseScene({ kwCover: true });
  try {
    const r = await call('musicUrl', {
      type: '128k', traceId: 'u_cross_1',
      musicInfo: { name: 'Cry For Me (feat. Ami)', singer: 'Michita (ミチタ)', duration: 302 },
    }, 'kw');
    rec('U1', '返回 tx 原版', r && r.sourcePlatform === 'tx' && r.subSource === 'juheTx' && /qqmusic\.qq\.com/.test(r.url || ''), JSON.stringify(r));
    rec('U4', 'subSource=juheTx', r && r.subSource === 'juheTx', r && r.subSource);
    const body = seenBodies[seenBodies.length - 1] || {};
    rec('U8', 'tx 源收到 songmid、无 kw rid', body.musicInfo && body.musicInfo.songmid === '004Drt082CV5gf' && body.musicInfo.rid === undefined, JSON.stringify(body.musicInfo || {}));
  } catch (e) {
    rec('U1', '返回 tx 原版', false, `${e.code || '?'}: ${e.message}`);
  }
  const events = await ev('u_cross_1');
  rec('U7', '留下 cross_platform 事件', Array.isArray(events.events) && events.events.some(x => x.event === 'cross_platform' && x.platform === 'tx'), JSON.stringify(events.events || []).slice(0, 300));

  // U2 —— QQ 候选必须选 302 秒原版，不能选 remix/DJ/翻唱
  console.log('\n[U2] 目标候选严格匹配');
  const matched = seenBodies[seenBodies.length - 1] && seenBodies[seenBodies.length - 1].musicInfo;
  rec('U2', '选中 302s Michita 原版', matched && matched.songmid === '004Drt082CV5gf', JSON.stringify(matched || {}));

  // U3 —— 主平台成功不触发跨平台搜索
  console.log('\n[U3] 主平台成功零跨平台请求');
  fresh(['kuwoOfficial', 'juheTx']);
  scene = baseScene({ kwExact: true });
  const qqBefore = calls.filter(u => u.includes('c.y.qq.com/soso')).length;
  try {
    const r = await call('musicUrl', {
      type: '128k', traceId: 'u_cross_3',
      musicInfo: { name: 'Cry For Me (feat. Ami)', singer: 'Michita (ミチタ)', duration: 302 },
    }, 'kw');
    const qqAfter = calls.filter(u => u.includes('c.y.qq.com/soso')).length;
    rec('U3', 'kw 成功且未搜 QQ', r && r.sourcePlatform === 'kw' && qqAfter === qqBefore, JSON.stringify({ r, qqBefore, qqAfter }));
  } catch (e) {
    rec('U3', 'kw 成功且未搜 QQ', false, `${e.code || '?'}: ${e.message}`);
  }

  // U5 —— 二次请求命中缓存，保留 tx 平台且不再重复搜索
  console.log('\n[U5] 缓存保留实际平台');
  fresh(['kuwoOfficial', 'juheTx']);
  scene = baseScene({ kwCover: true });
  try {
    const first = await call('musicUrl', {
      type: '128k', traceId: 'u_cross_5a',
      musicInfo: { name: 'Cry For Me (feat. Ami)', singer: 'Michita (ミチタ)', duration: 302 },
    }, 'kw');
    const qqBefore = calls.filter(u => u.includes('c.y.qq.com/soso')).length;
    const second = await call('musicUrl', {
      type: '128k', traceId: 'u_cross_5b',
      musicInfo: { name: 'Cry For Me (feat. Ami)', singer: 'Michita (ミチタ)', duration: 302 },
    }, 'kw');
    const qqAfter = calls.filter(u => u.includes('c.y.qq.com/soso')).length;
    rec('U5', '二次命中缓存、平台仍 tx、无新搜索', first && second && second.sourcePlatform === 'tx' && second.subSource === 'juheTx' && qqAfter === qqBefore, JSON.stringify({ first, second, qqBefore, qqAfter }));
  } catch (e) {
    rec('U5', '二次命中缓存、平台仍 tx、无新搜索', false, `${e.code || '?'}: ${e.message}`);
  }

  // U10 —— 关闭目标源后，跨平台 10min 缓存必须失效，不能继续交付旧源
  console.log('\n[U10] 关闭目标源后跨平台缓存失效');
  fresh(['kuwoOfficial', 'juheTx']);
  scene = baseScene({ kwCover: true });
  try {
    const first = await call('musicUrl', {
      type: '128k', traceId: 'u_cross_10a',
      musicInfo: { name: 'Cry For Me (feat. Ami)', singer: 'Michita (ミチタ)', duration: 302 },
    }, 'kw');
    const qqBefore = calls.filter(u => u.includes('c.y.qq.com/soso')).length;
    const toggled = current.__debug.toggleSource('juheTx', false);
    let second = null;
    let err = null;
    try {
      second = await call('musicUrl', {
        type: '128k', traceId: 'u_cross_10b',
        musicInfo: { name: 'Cry For Me (feat. Ami)', singer: 'Michita (ミチタ)', duration: 302 },
      }, 'kw');
    } catch (e) { err = e; }
    const qqAfter = calls.filter(u => u.includes('c.y.qq.com/soso')).length;
    rec('U10', '关闭 juheTx 后不得再交付其缓存', !!first && first.subSource === 'juheTx'
      && !(second && second.subSource === 'juheTx')
      && qqAfter > qqBefore,
      JSON.stringify({ first, second, err: err && `${err.code}: ${err.message}`, qqBefore, qqAfter, toggled }));
  } catch (e) {
    rec('U10', '关闭 juheTx 后不得再交付其缓存', false, `${e.code || '?'}: ${e.message}`);
  }

  // U6 —— 全平台无匹配：NOT_FOUND，而不是 NETWORK_TIMEOUT
  console.log('\n[U6] 全平台无匹配语义');
  fresh(['kuwoOfficial', 'juheTx']);
  scene = baseScene({ kwCover: true, qqList: [QQ_LIST[5]], wyList: [] });
  try {
    await call('musicUrl', {
      type: '128k', traceId: 'u_cross_6',
      musicInfo: { name: 'Cry For Me (feat. Ami)', singer: 'Michita (ミチタ)', duration: 302 },
    }, 'kw');
    rec('U6', '应抛出 NOT_FOUND', false, '没有抛错');
  } catch (e) {
    rec('U6', '应抛出 NOT_FOUND', e && e.code === 'NOT_FOUND', `${e && e.code}: ${e && e.message}`);
  }

  // U9 —— 主平台慢但最终成功：跨平台抢跑失败后不得提前判死主平台
  console.log('\n[U9] 慢主平台最终成功不被跨平台抢跑误杀');
  fresh(['kuwoOfficial', 'juheTx'], { crossPlatformGraceMs: 1, crossPlatformSearchTimeoutMs: 1 });
  {
    const base = baseScene({ kwExact: true, qqList: [], wyList: [] });
    scene = (u, opts) => {
      const r = base(u, opts);
      if (String(u).includes('antiserver.kuwo.cn')) r.delay = 300;
      return r;
    };
    try {
      const r = await call('musicUrl', {
        type: '128k', traceId: 'u_cross_9',
        musicInfo: { name: 'Cry For Me (feat. Ami)', singer: 'Michita (ミチタ)', duration: 302 },
      }, 'kw');
      rec('U9', '慢主平台最终交付 kw，而不是被跨平台失败提前判死', r && r.sourcePlatform === 'kw', JSON.stringify(r));
    } catch (e) {
      rec('U9', '慢主平台最终交付 kw，而不是被跨平台失败提前判死', false, `${e.code || '?'}: ${e.message}`);
    }
  }

  // 汇总
  const fail = res.filter(x => !x.ok);
  console.log(`\n结果：${res.length - fail.length}/${res.length} 通过`);
  if (fail.length) {
    console.log('失败项：' + fail.map(x => `${x.id}:${x.name} (${x.detail})`).join(' | '));
    process.exit(1);
  }
  process.exit(0);
})();
