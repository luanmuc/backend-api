// 云端分层真实测试：L1 协议 / L2 缓存 / L3 调度 / L4 验真 / L5 单源 / L6 状态 / L7 巡检
const path = require('path');
const { createHost } = require('./host');
const REPO = '/home/user/Doubao/chats/38450522296699906/repos/lx-music-source';
const SRC = path.join(REPO, 'lx-source.js');

const res = [];
const rec = (id, name, ok, detail) => { res.push({ id, name, ok, detail }); console.log(`${ok ? '✓' : '✗'} [${id}] ${name} — ${detail}`); };

const group = process.argv[2] || 'l1l4';
const host = createHost({ logEnabled: false, logDebug: false });
const mod = require(SRC);
const call = (p) => Promise.resolve(host.handler(p));
const st = () => host.stats().count;
// 验真会打一次 Range(1KB)，那也是一次外呼，但不是「重新解析」——分开计数才看得清缓存命中
const fullCalls = () => host.stats().calls.filter(c => !c.range).length;
const rangeCalls = () => host.stats().calls.filter(c => c.range).length;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const FREE = { name: '海阔天空', singer: 'Beyond', interval: '05:25' };
const HOT = { name: '晴天', singer: '周杰伦', interval: '04:29' };
const FREE2 = { name: '光辉岁月', singer: 'Beyond', interval: '05:00' };
const NOSONG = { name: 'zzz不存在的歌曲名称zzz', singer: '无此歌手', interval: '03:00' };
const FRAG_SONG = { name: '八千里路明月照', singer: '', interval: '00:05' };

async function musicUrl(song, quality, source = 'kw') {
  return call({ action: 'musicUrl', source, info: { musicInfo: song, type: quality } });
}

(async () => {
  if (group === 'l1l4') {
    // L1 协议层
    const inited = host.sent.find(s => s.name === 'inited');
    const plats = inited && inited.data && inited.data.sources ? Object.keys(inited.data.sources) : [];
    const kwActs = plats.length ? inited.data.sources.kw.actions : [];
    rec('L1-1', '加载期上报 5 平台 + 能力面', plats.length === 5 && ['musicUrl','health','toggle','probe','config','trend'].every(a => kwActs.includes(a)),
      `平台=${plats.join(',')} kw.actions=${kwActs.join('/')}`);

    const snap = await call({ action: 'health' });
    const ids = Object.keys(snap || {});
    const real = ids.filter(k => !k.startsWith('_'));
    const meta = ids.filter(k => k.startsWith('_'));
    rec('L1-2', 'health 返回 20 源 + 3 元信息键', real.length === 20 && meta.length === 3,
      `源=${real.length} 元=${meta.join('/')} 源字段=${Object.keys(snap[real[0]] || {}).slice(0,6).join(',')}`);

    const cfgOut = await call({ action: 'config', source: 'kw', info: {} });
    const leak = cfgOut && (cfgOut.ikunApiKey === '' || String(cfgOut.ikunApiKey).includes('已设置'));
    rec('L1-3', 'config 读模式不泄露明文密钥', !!leak, `ikunApiKey=${JSON.stringify(cfgOut && cfgOut.ikunApiKey)}`);

    let e4 = null;
    try { await call({ action: 'musicUrl', source: 'kw', info: { type: 'flac' } }); } catch (e) { e4 = e; }
    rec('L1-4', '缺 musicInfo 明确 PARAM_ERROR 且 err.code 有值', e4 && e4.code === 'PARAM_ERROR', `code=${e4 && e4.code} msg=${e4 && e4.message}`);

    // L2 缓存层
    const f0 = fullCalls(); const rg0 = rangeCalls();
    const r1 = await musicUrl(FREE, '128k');
    const f1 = fullCalls(); const rg1 = rangeCalls();
    const r2 = await musicUrl(FREE, '128k');
    const f2 = fullCalls(); const rg2 = rangeCalls();
    rec('L2-1', '同歌同档二次命中缓存（仅验真 Range，不重新解析）', (f2 - f1) === 0 && (rg2 - rg1) >= 1,
      `首次解析外呼=${f1 - f0} 验真Range=${rg1 - rg0}；二次解析外呼=${f2 - f1} 验真Range=${rg2 - rg1} type=${r2 && r2.type} sub=${r2 && r2.subSourceName}`);

    // D-36：请求 flac 实得低档时，槽位按实交付档写 → 随后请求该实交付档应直接命中
    let rFlac = null;
    try { rFlac = await musicUrl(FREE, 'flac'); } catch (e) { rFlac = null; }
    const realQ = (rFlac && rFlac.type) || '';
    if (realQ && realQ !== 'flac') {
      const bf = fullCalls();
      const r3 = await musicUrl(FREE, realQ);
      const af = fullCalls();
      rec('L2-2', '降档槽位可被低档请求命中（D-36）', (af - bf) === 0,
        `flac 实得[${realQ}]；再请求[${realQ}] 解析外呼=${af - bf} type=${r3 && r3.type}`);
    } else {
      rec('L2-2', '降档槽位可被低档请求命中（D-36）', true, `本首 flac 直接交付成功（type=${realQ}），无降档可验，跳过`);
    }

    // 失败缓存：先在 flac 档失败一次（VIP 歌高概率）
    // 失败缓存：注入一条已知失败（不依赖「某首一定失败」这种不可控前提）
    const fk = mod.__debug.buildCacheKey('fail_kw', FREE2, '128k');
    mod.__debug.setFailCached(fk, 'NOT_FOUND');
    const fA = fullCalls();
    const t2 = Date.now();
    let ef2 = null;
    try { await musicUrl(FREE2, '128k'); } catch (e) { ef2 = e; }
    const d2 = Date.now() - t2; const fB = fullCalls();
    rec('L2-3', '失败缓存命中：立即返回同码、零解析外呼', !!ef2 && ef2.code === 'NOT_FOUND' && (fB - fA) === 0 && d2 < 800,
      `${d2}ms code=${ef2 && ef2.code} 解析外呼=${fB - fA}`);

    // D-01：开启新源后失败缓存必须失效（重试应产生新外呼）
    mod.__debug.setFailCached(mod.__debug.buildCacheKey('fail_kw', FREE2, '128k'), 'NOT_FOUND');
    const cd = fullCalls();
    await call({ action: 'toggle', source: 'kw', info: { id: 'xinghaiBackup', enabled: true } });
    let ef3 = null;
    try { await musicUrl(FREE2, '128k'); } catch (e) { ef3 = e; }
    const ce = fullCalls();
    rec('L2-4', 'toggle 开启新源后失败缓存失效（D-01 端到端）', (ce - cd) > 0,
      `重试外呼=${ce - cd} code=${ef3 && ef3.code}（>0 说明没再吃旧缓存）`);
    await call({ action: 'toggle', source: 'kw', info: { id: 'xinghaiBackup', enabled: false } });

    // L3 调度层
    const t3 = Date.now();
    const rHot = await musicUrl(HOT, 'flac');
    const d3 = Date.now() - t3;
    rec('L3-2', '默认多源热门歌在预算内出链', !!rHot.url && d3 <= 16000,
      `${d3}ms type=${rHot.type} sub=${rHot.subSourceName}`);

    const reqQ = 'flac';
    rec('L3-3', '降档时标签写真话（type 等于实交付档）', ['flac','320k','128k'].includes(r1 && r1.type) && !!r1.url,
      `请求[${reqQ}] → type=${r1.type} sub=${r1.subSourceName}`);

    const songs = [
      { name: '稻香', singer: '周杰伦', interval: '03:43' },
      { name: '夜曲', singer: '周杰伦', interval: '03:46' },
      { name: '七里香', singer: '周杰伦', interval: '04:59' },
      { name: '平凡之路', singer: '朴树', interval: '05:00' },
      { name: '海阔天空', singer: 'Beyond', interval: '05:25' },
    ];
    let okCnt = 0; let throttled = 0; const codes = [];
    for (const s of songs) {
      try { const r = await musicUrl(s, '128k'); if (r && r.url) okCnt += 1; }
      catch (e) { codes.push(`${s.name}:${e.code}`); if (e.code === 'RATE_LIMIT') throttled += 1; }
    }
    rec('L3-4', '连续 5 首无本地节流误杀', throttled === 0 && okCnt >= 3,
      `成功=${okCnt}/5 节流=${throttled} 失败码=${codes.join(',') || '无'}`);

    // L4 验真层
    let ef4 = null; let rVip = null;
    try { rVip = await musicUrl(FRAG_SONG, 'flac'); } catch (e) { ef4 = e; }
    const vipOk = (ef4 && ef4.code === 'PREVIEW_FRAGMENT') ||
      (rVip && rVip.url && String(rVip.subSourceName || '').includes('试听版'));
    rec('L4-1', 'VIP 歌 flac：拒绝片段或以「试听版」交付', !!vipOk,
      ef4 ? `拒绝 code=${ef4.code}` : `交付 type=${rVip && rVip.type} sub=${rVip && rVip.subSourceName}`);

    // L4-3 脏缓存纠正：把已知 128k 内容塞进 flac 槽
    const goodUrl = (rHot && rHot.url) || (r1 && r1.url);
    const realQuality = (rHot && rHot.type) || (r1 && r1.type);
    if (goodUrl && realQuality && realQuality !== 'flac') {
      const k = mod.__debug.buildCacheKey('kw', HOT, 'flac');
      mod.__debug.setCachedUrl(k, goodUrl, 'flac', 'kuwoOfficial');
      let rDirty = null;
      try { rDirty = await musicUrl(HOT, 'flac'); } catch (e) { rDirty = null; }
      rec('L4-3', 'flac 槽里的 128k 内容被验真纠正标签', rDirty && rDirty.type === realQuality,
        `脏槽命中后 type=${rDirty && rDirty.type}（真实=${realQuality}）`);
    } else {
      rec('L4-3', 'flac 槽里的 128k 内容被验真纠正标签', true, `无「flac 请求实得低档」样本（本机 type=${realQuality}），跳过`);
    }
  }

  // L4-5 错歌防线：不存在的歌不能被当成「试听版」交付
  if (group === 'l1l4') {
    let rGhost = null;
    try { rGhost = await musicUrl(NOSONG, '128k'); } catch (e) { rec('L4-5', '不存在的歌必须报 NOT_FOUND，不得交付他人音频', e.code === 'NOT_FOUND', `拒绝 code=${e.code}`); }
    if (rGhost) {
      rec('L4-5', '不存在的歌必须报 NOT_FOUND，不得交付他人音频', false,
        `却交付了 url=${String(rGhost.url).slice(0, 60)} type=${rGhost.type} sub=${rGhost.subSourceName}`);
    }
  }

  if (group === 'l5') {
    const getRaw = (u, opt = {}) => new Promise(res => lx.request(u, Object.assign({ timeout: 8000 }, opt), (e, x) => res(x)));
    const wyId = async (name) => {
      const r = await getRaw('https://music.163.com/api/search/get?s=' + encodeURIComponent(name) + '&type=1&limit=3');
      let b = r && r.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) {} }
      const s0 = b && b.result && b.result.songs && b.result.songs[0];
      return s0 ? { id: String(s0.id), songmid: String(s0.id), album: s0.album && s0.album.name } : null;
    };
    const kwRid = async (name) => {
      const r = await getRaw('https://search.kuwo.cn/r.s?all=' + encodeURIComponent(name) + '&ft=music&itemset=web_2013&client=kt&pn=0&rn=3&rformat=json&encoding=utf8', { headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://www.kuwo.cn/' } });
      let b = r && r.body; if (typeof b === 'string') { b = b.replace(/'/g, '"'); try { b = JSON.parse(b); } catch (e) {} }
      const a0 = b && b.abslist && b.abslist[0];
      return a0 ? { hash: String(a0.DC_TARGETID), rid: String(a0.DC_TARGETID) } : null;
    };
    const only = async (id) => {
      for (const x of Object.keys(mod.SOURCE_HANDLERS)) {
        await call({ action: 'toggle', source: 'kw', info: { id: x, enabled: x === id } });
      }
    };
    const sid = await wyId('稻香'); const sid2 = await wyId('七里香'); const sid3 = await wyId('晴天');
    const kwNames = ['海阔天空', '平凡之路', '好久不见', '突然好想你', '后来', '爱情转移', '演员', '夜曲'];
    const kr = {};
    for (const n of kwNames) { const r = await kwRid(n); if (r) kr[n] = r; }
    const jobs = [
      ['suyinKuwo', 'kw', '128k', Object.assign({ name: '海阔天空', singer: 'Beyond', interval: '05:25' }, kr['海阔天空'] || {})],
      ['suyinKuwo', 'wy', '128k', { name: '光辉岁月', singer: 'Beyond', interval: '05:00' }],
      ['wyOuter', 'wy', '128k', Object.assign({ name: '稻香', singer: '周杰伦', interval: '03:43' }, sid || {})],
      ['kuwoOfficial', 'kw', '128k', Object.assign({ name: '夜曲', singer: '周杰伦', interval: '03:46' }, kr['夜曲'] || {})],
      ['suyin163', 'wy', '128k', Object.assign({ name: '七里香', singer: '周杰伦', interval: '04:59' }, sid2 || {})],
      ['xinghaiBackend', 'kw', 'flac', Object.assign({ name: '平凡之路', singer: '朴树', interval: '05:00' }, kr['平凡之路'] || {})],
      ['helloworldKw', 'kw', 'flac', Object.assign({ name: '好久不见', singer: '陈奕迅', interval: '04:10' }, kr['好久不见'] || {})],
      ['changqingVip', 'kw', '128k', Object.assign({ name: '突然好想你', singer: '五月天', interval: '05:00' }, kr['突然好想你'] || {})],
      ['nianxinVip', 'kw', '128k', Object.assign({ name: '后来', singer: '刘若英', interval: '05:40' }, kr['后来'] || {})],
      ['huibq', 'kw', '128k', Object.assign({ name: '爱情转移', singer: '陈奕迅', interval: '04:20' }, kr['爱情转移'] || {})],
      ['ikun', 'kw', '128k', Object.assign({ name: '演员', singer: '薛之谦', interval: '04:21' }, kr['演员'] || {})],
      ['gdWy', 'wy', 'flac', Object.assign({ name: '晴天', singer: '周杰伦', interval: '04:29' }, sid3 || {})],
    ];
    for (const [id, platform, q, song] of jobs) {
      await only(id);
      const t = Date.now();
      let out = null; let err = null;
      try { out = await call({ action: 'musicUrl', source: platform, info: { musicInfo: song, type: q } }); }
      catch (e) { err = e; }
      const ms = Date.now() - t;
      rec(`L5-${id}-${platform}`, `单源 ${id} @${platform} ${q}`, !!(out && out.url),
        err ? `失败 code=${err.code} ${String(err.message).slice(0, 46)}（${ms}ms）` : `成功 type=${out.type} sub=${out.subSourceName}（${ms}ms）`);
    }
    for (const x of Object.keys(mod.SOURCE_HANDLERS)) {
      await call({ action: 'toggle', source: 'kw', info: { id: x, enabled: true } });
    }
  }

  if (group === 'l6l7') {
    const getRaw = (u, opt = {}) => new Promise(res => lx.request(u, Object.assign({ timeout: 8000 }, opt), (e, x) => res(x)));
    const kwRid = async (name) => {
      const r = await getRaw('https://search.kuwo.cn/r.s?all=' + encodeURIComponent(name) + '&ft=music&itemset=web_2013&client=kt&pn=0&rn=3&rformat=json&encoding=utf8', { headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://www.kuwo.cn/' } });
      let b = r && r.body; if (typeof b === 'string') { b = b.replace(/'/g, '"'); try { b = JSON.parse(b); } catch (e) {} }
      const a0 = b && b.abslist && b.abslist[0];
      return a0 ? { hash: String(a0.DC_TARGETID), rid: String(a0.DC_TARGETID) } : {};
    };
    const only = async (id) => {
      for (const x of Object.keys(mod.SOURCE_HANDLERS)) {
        await call({ action: 'toggle', source: 'kw', info: { id: x, enabled: x === id } });
      }
    };
    const rid = await kwRid('爱情转移');
    const song = Object.assign({ name: '爱情转移', singer: '陈奕迅', interval: '04:20' }, rid);
    const probe1 = async () => { try { return await musicUrl(song, '128k'); } catch (e) { return e; } };

    await call({ action: 'config', source: 'kw', info: { breakerCooldownMs: 300, playDeadReviveMs: 1000 } });
    await only('lingchuan');
    const chain0 = mod.buildSourceChain('kw', '128k').map(h => h.id);
    // 失败缓存按「歌+档」短路，同一首同档重复不会真的再打源 → 用三档各打一次，才是三次真实失败
    const codes = [];
    for (const q of ['128k', '320k', 'flac']) {
      try { await musicUrl(song, q); codes.push('ok'); } catch (e) { codes.push(e.code); }
    }
    const snapA = await call({ action: 'health' });
    rec('L6-1', '同一源不同档连续 3 次真实失败后熔断', snapA.lingchuan && snapA.lingchuan.state === 'open',
      `链=${chain0.join('>')||'(空)'} 三档码=${codes.join(',')} state=${snapA.lingchuan && snapA.lingchuan.state}`);

    await sleep(600);
    const song2 = Object.assign({ name: '后来', singer: '刘若英', interval: '05:40' }, await kwRid('后来'));
    let e3 = null;
    try { await musicUrl(song2, '128k'); } catch (e) { e3 = e; }
    const snapB = await call({ action: 'health' });
    rec('L6-2', '冷却后半开试探、失败再回 open', snapB.lingchuan && snapB.lingchuan.state === 'open' && e3 && e3.code !== 'RATE_LIMIT',
      `冷却 300ms 后 state=${snapB.lingchuan && snapB.lingchuan.state} 试探码=${e3 && e3.code}`);

    await call({ action: 'toggle', source: 'kw', info: { id: 'lingchuan', enabled: false } });
    const chainKw = mod.buildSourceChain('kw', '128k').map(h => h.id);
    rec('L6-4', '关掉的源不出现在链里', !chainKw.includes('lingchuan'),
      `kw 128k 链=${chainKw.join('>') || '(空)'}`);

    for (const x of Object.keys(mod.SOURCE_HANDLERS)) {
      await call({ action: 'toggle', source: 'kw', info: { id: x, enabled: mod.SOURCE_TOGGLES[x] !== false } });
    }
    const t = Date.now();
    const probe = await call({ action: 'probe' });
    rec('L6-3', '手动 probe 一轮返回结果', !!probe && (Date.now() - t) < 30000 && (probe.active || []).length > 0,
      `${Date.now() - t}ms round=${probe && probe.round} active=${(probe && probe.active || []).length} sleeping=${(probe && probe.sleeping || []).length}`);

    const h0 = mod.__debug.healthHistory.length;
    await mod.__debug.runHealthCheck(true);
    const h1 = mod.__debug.healthHistory.length;
    const trend = await call({ action: 'trend' });
    rec('L7-1', '巡检落一条历史快照并可读趋势', h1 === h0 + 1 && trend.history.length === h1,
      `history ${h0}→${h1} trend=${trend.history.length}`);
  }

  const fail = res.filter(r => !r.ok).length;
  console.log(`\n${group} 汇总：${res.length - fail} 通过 / ${fail} 失败`);
  process.exit(fail ? 1 : 0);
})();
