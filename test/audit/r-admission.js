#!/usr/bin/env node
/**
 * R 组：L4 裁决层（Admission）行为断言 A1~A7
 *
 * 背景：真机日志「全源 NOT_AUDIO → 代表码被判 NOT_FOUND → 1h 歌级锁 → 该请求已知失败(缓存中)」。
 * 根因是 App 原生桥把音频字节序列化成 `{type:'Buffer',data:[...]}`，判据把「拿不到字节」当成
 * 「不是音频」。本组断言锁死新契约：形态归一 → 证据分级 → 单一裁决 → 记账指令。
 *
 * 断言方式：不走端到端外呼，直接驱动 __debug 的纯函数（toBytes/kindOf/admit/skipReason/
 * clearSourceLedger），避免冷却、失败缓存、竞速预算多层叠加干扰（与 q-dfix 同思路）。
 *
 * 反向验证（实现后逐条注入回退，必须重新变红）：
 *   A1 删 toBytes 的 `{type:'Buffer'}` 分支 → 归一失败
 *   A2 把 evidence 降级逻辑去掉（无字节直接 NOT_AUDIO）→ A2 红
 *   A4 把 NOT_AUDIO 从代表码优先级里拿掉 → A4 红
 *   A6 clearSourceLedger 不清 playDeadStreak → A6 红
 */

const path = require('path');
const SRC = path.resolve(__dirname, '../../lx-source.js');

// 宿主最小桩（lx-source.js 顶层解构 globalThis.lx，缺一项就 TypeError）
let requestCalls = 0;
globalThis.lx = {
  EVENT_NAMES: { inited: 'inited', request: 'request', updateAlert: 'updateAlert' },
  version: '2.0.0',
  env: 'mobile',
  utils: { buffer: { from: (d, e) => Buffer.from(d, e), bufToString: (b, e) => b.toString(e) } },
  request(url, opts, cb) {
    requestCalls++;
    const stub = globalThis.__probeStub;
    const res = stub ? stub(String(url), opts) : { statusCode: 206, headers: { 'content-type': 'audio/mpeg' }, body: Buffer.alloc(0), url: String(url) };
    if (res && res.__error) setTimeout(() => cb(res.__error, null), 1);
    else setTimeout(() => cb(null, Object.assign({ url: String(url) }, res)), 1);
  },
  on(n, h) { if (n === 'request') globalThis.__lxHandler = h; },
  send() {},
};

const src = require(SRC);
const dbg = src.__debug;
const EC = src.ERROR_CODES;

let fail = 0;
let pass = 0;
const rec = (id, name, ok, detail) => {
  if (ok) pass++; else fail++;
  console.log(`${ok ? '✓' : '✗'} [${id}] ${name}${detail ? ' — ' + detail : ''}`);
};
const need = (id, name, fn) => {
  // 功能缺失时给出「实现不存在」的可读失败，而不是 TypeError 崩栈
  try { fn(); } catch (e) { rec(id, name, false, `异常: ${e.message}`); }
};

// FLAC 头 + STREAMINFO（44.1kHz，可控时长）——与冒烟 REAL_FLAC_BODY 同构
function makeFlac(durationSec) {
  const b = Buffer.alloc(64);
  b.write('fLaC', 0, 'ascii');
  b[4] = 0x80; b[7] = 34;
  b[18] = 0x0A; b[19] = 0xC4; b[20] = 0x40;
  const total = Math.round(durationSec * 44100);
  b[21] = Math.floor(total / 4294967296) & 0x0F;
  b[22] = Math.floor(total / 16777216) & 0xFF;
  b[23] = Math.floor(total / 65536) & 0xFF;
  b[24] = Math.floor(total / 256) & 0xFF;
  b[25] = total & 0xFF;
  return b;
}

const songInfo = { name: '红尘误此生', singer: '宋晓峰', duration: 280, songmid: 'kw_651031866' };

if (!dbg) {
  console.log('✗ [A0] __debug 钩子缺失');
  if (require.main === module) process.exit(1);
  throw new Error('A0: __debug 钩子缺失');
}

// ── A1：桥往返产物必须能被归一回来（strong） ─────────────────────────
need('A1', '桥序列化体 {type:"Buffer",data:[…]} 归一为字节且判为 audio', () => {
  const flac = makeFlac(200);
  const bridged = JSON.parse(JSON.stringify(flac));   // 真机桥的真实形态
  const bytes = dbg.toBytes ? dbg.toBytes(bridged) : null;
  const kind = bytes && dbg.kindOf ? dbg.kindOf(bytes) : null;
  rec('A1', '桥序列化体归一为字节且判为 audio',
    !!bytes && bytes.length === flac.length && kind === 'audio',
    `bytes=${bytes ? bytes.length : 'null'} kind=${kind}`);
});

// ── A2：归一失败（不可恢复对象）但有音频响应头 → medium PASS ──────────
need('A2', '无字节+头为 audio+尺寸正常 → PASS(medium)，不得 NOT_AUDIO', () => {
  const out = dbg.admit ? dbg.admit({
    stage: 'candidate', platform: 'kw', quality: 'flac', songInfo, source: 'helloworldKw',
    delivery: {
      statusCode: 206,
      headers: { 'content-type': 'audio/mpeg', 'content-range': 'bytes 0-1023/5198360' },
      body: { opaque: true },       // 桥的坏形态：toBytes 认不出
    },
  }) : null;
  rec('A2', '无字节+头为 audio+尺寸正常 → PASS(medium)，不得 NOT_AUDIO',
    !!out && out.verdict === 'PASS' && out.evidence === 'medium' && out.deliverable === true,
    out ? `verdict=${out.verdict} evidence=${out.evidence} code=${out.code || '-'}` : 'admit 不存在');
});

// ── A2b：无字节+头是 json/html → 确定 NOT_AUDIO（不放行） ─────────────
need('A2b', '无字节+头为 application/json → NOT_AUDIO', () => {
  const out = dbg.admit ? dbg.admit({
    stage: 'candidate', platform: 'kw', quality: 'flac', songInfo, source: 'helloworldKw',
    delivery: { statusCode: 200, headers: { 'content-type': 'application/json' }, body: { opaque: 1 } },
  }) : null;
  rec('A2b', '无字节+头为 application/json → NOT_AUDIO',
    !!out && out.verdict === 'NOT_AUDIO' && out.deliverable === false,
    out ? `verdict=${out.verdict} evidence=${out.evidence}` : 'admit 不存在');
});

// ── A3：字节可定 + 只有 5 秒（原曲 280s）→ FRAGMENT + 30s ─────────────
need('A3', '5 秒片段 → FRAGMENT 且 ledger.ttlMs=30000', () => {
  const out = dbg.admit ? dbg.admit({
    stage: 'candidate', platform: 'kw', quality: 'flac', songInfo, source: 'suyinKuwo',
    delivery: {
      statusCode: 206,
      headers: { 'content-type': 'audio/flac', 'content-range': 'bytes 0-1023/81920' },
      body: makeFlac(5),
    },
  }) : null;
  rec('A3', '5 秒片段 → FRAGMENT 且 ledger.ttlMs=30000',
    !!out && out.verdict === 'FRAGMENT' && out.deliverable === true && out.ledger && out.ledger.ttlMs === 30000,
    out ? `verdict=${out.verdict} ttl=${out.ledger && out.ledger.ttlMs}` : 'admit 不存在');
});

// ── A3b：API 层已标试听 → 直接 FRAGMENT，且一次探针都不发 ──────────────
need('A3b', 'trialMark 命中 → FRAGMENT 且不外呼探针', () => {
  const before = requestCalls;
  const out = dbg.admit ? dbg.admit({
    stage: 'candidate', platform: 'kw', quality: 'flac', songInfo, source: 'kuwoOfficial',
    trialMark: true, delivery: null,
  }) : null;
  rec('A3b', 'trialMark 命中 → FRAGMENT 且不外呼探针',
    !!out && out.verdict === 'FRAGMENT' && requestCalls === before,
    out ? `verdict=${out.verdict} 外呼增量=${requestCalls - before}` : 'admit 不存在');
  // K9：标记识别本身也要有断言（只认结构化字段，认不出不猜）
  const tm = dbg.trialMarkOf;
  const tmPos = !!(tm && tm({ freeTrialInfo: [{ start: 0, end: 5 }] }) === true);
  const tmNeg = !!(tm && tm({ code: 200, data: { url: 'https://a/b.mp3' } }) === false);
  rec('A3c', 'trialMarkOf 只认结构化试听字段，正常响应不误判',
    tmPos && tmNeg, `freeTrialInfo→${tmPos} 正常响应→${tmNeg}`);
});

// ── A4：代表码优先级——交付类码不被 NOT_FOUND 覆盖 ─────────────────────
need('A4', 'strong NOT_AUDIO 与 NOT_FOUND 同档 → 代表码取 NOT_AUDIO 且 TTL≤60s', () => {
  const out = dbg.admit ? dbg.admit({
    stage: 'fallback', platform: 'kw', quality: 'flac', songInfo,
    attempts: [
      { code: EC.NOT_FOUND, evidence: 'strong', reason: '歌不存在' },
      { code: EC.NOT_AUDIO, evidence: 'strong', reason: '交付内容是 JSON 对象而不是音频' },
    ],
  }) : null;
  rec('A4', 'strong NOT_AUDIO 与 NOT_FOUND 同档 → 代表码取 NOT_AUDIO 且 TTL≤60s',
    !!out && out.code === EC.NOT_AUDIO && out.ledger && out.ledger.ttlMs <= 60000,
    out ? `code=${out.code} ttl=${out.ledger && out.ledger.ttlMs}` : 'admit 不存在');
});

// ── A5：weak/none 证据永不超过 60s，且不得 bump playDead ───────────────
need('A5', 'weak 证据 TTL 上限 60s、playDead=false', () => {
  const cases = [
    { stage: 'candidate', platform: 'kw', quality: 'flac', songInfo, source: 'x', delivery: null },
    { stage: 'cache-hit', platform: 'kw', quality: 'flac', songInfo, source: 'x', delivery: { statusCode: 403, headers: {}, body: null } },
  ];
  const outs = dbg.admit ? cases.map(c => dbg.admit(c)) : [];
  const ok = outs.length === 2 && outs.every(o => o.evidence !== 'strong' && o.ledger.ttlMs <= 60000 && o.ledger.playDead === false);
  rec('A5', 'weak 证据 TTL 上限 60s、playDead=false',
    ok, outs.map(o => `${o.verdict}/${o.evidence}/${o.ledger && o.ledger.ttlMs}/${o.ledger && o.ledger.playDead}`).join(' , '));
});

// ── A6：关→开清三本账（失败缓存 / 摘除 / 熔断限流） ───────────────────
need('A6', 'clearSourceLedger 清 fail_<平台> + playDeadStreak + 限流退避', () => {
  const fk = 'fail_kw|kw_651031866|flac';
  dbg.setFailCached(fk, EC.NOT_FOUND, 3600000);
  dbg.playDeadStreak.set('suyinKuwo', 3);
  dbg.playDeadDeadline.set('suyinKuwo', Date.now());
  const br = dbg.breakerMap.get('suyinKuwo') || {};
  br.byQuality = br.byQuality || {};
  br.state = 'open'; br.rateLimited = true; br.rateLimitUntil = Date.now() + 60000;
  dbg.breakerMap.set('suyinKuwo', br);

  if (dbg.clearSourceLedger) dbg.clearSourceLedger('suyinKuwo');

  const failLeft = Array.from(dbg.failCache.keys()).filter(k => k.includes('fail_kw'));
  const deadLeft = dbg.playDeadStreak.get('suyinKuwo');
  const deadDl = dbg.playDeadDeadline.get('suyinKuwo');
  const brAfter = dbg.breakerMap.get('suyinKuwo') || {};
  rec('A6', 'clearSourceLedger 清 fail_<平台> + playDeadStreak + 限流退避',
    !!dbg.clearSourceLedger && failLeft.length === 0 && deadLeft === undefined && deadDl === undefined && !brAfter.rateLimited && brAfter.state === 'closed',
    `clearSourceLedger=${!!dbg.clearSourceLedger} failLeft=${failLeft.length} deadLeft=${deadLeft} deadline=${deadDl} state=${brAfter.state} rateLimited=${brAfter.rateLimited}`);
});

// ── A7：admit 幂等且不写状态 ─────────────────────────────────────────
need('A7', '同一 input 调两次：ledger 一致、健康快照不变', () => {
  const input = {
    stage: 'candidate', platform: 'kw', quality: 'flac', songInfo, source: 'helloworldKw',
    delivery: { statusCode: 206, headers: { 'content-type': 'audio/mpeg' }, body: makeFlac(5) },
  };
  // getHealthSnapshot 的 nextProbe/probeEtaMs/wakeEtaMs 是随当前时间变化的只读投影，
  // 不能用来证明 admit 写状态；比较时剔除时间派生字段，其余快照必须逐字节一致。
  const snap = () => JSON.stringify(src.getHealthSnapshot(), (k, v) => (
    ['nextProbe', 'probeEtaMs', 'wakeEtaMs'].includes(k) ? undefined : v
  ));
  const before = snap();
  const a = dbg.admit ? dbg.admit(input) : null;
  const b = dbg.admit ? dbg.admit(input) : null;
  const after = snap();
  rec('A7', '同一 input 调两次：ledger 一致、健康快照不变',
    !!a && !!b && JSON.stringify(a.ledger) === JSON.stringify(b.ledger) && before === after,
    a ? `ledgerSame=${JSON.stringify(a.ledger) === JSON.stringify(b.ledger)} snapshotSame=${before === after}` : 'admit 不存在');
});

// ── A8：skipReason 单查询（摘除中的源必须给出理由） ────────────────────
need('A8', 'skipReason：健康源 null，被摘除源给出理由', () => {
  dbg.playDeadStreak.delete('suyinKuwo');
  dbg.playDeadDeadline.delete('suyinKuwo');
  const ok1 = dbg.skipReason ? dbg.skipReason('suyinKuwo', { platform: 'kw', quality: 'flac' }) : 'no-fn';
  dbg.playDeadStreak.set('suyinKuwo', 3);
  dbg.playDeadDeadline.set('suyinKuwo', Date.now());
  const r2 = dbg.skipReason ? dbg.skipReason('suyinKuwo', { platform: 'kw', quality: 'flac' }) : 'no-fn';
  dbg.playDeadStreak.delete('suyinKuwo');
  dbg.playDeadDeadline.delete('suyinKuwo');
  rec('A8', 'skipReason：健康源 null，被摘除源给出理由',
    !!dbg.skipReason && ok1 === null && !!r2 && typeof r2.reason === 'string',
    `健康=${JSON.stringify(ok1)} 摘除=${JSON.stringify(r2)}`);
});


// ── A9~A13：K14 覆盖率要求的「新增分支必被执行」（2026-11-10 补） ──────────
(async () => {
  const setStub = (st) => { globalThis.__probeStub = st; };
  const resetStub = () => { globalThis.__probeStub = null; };

  // A9：探针状态码分支——非法URL / 429 / 500 / 404 各自码型与证据档
  need('A9', 'probe 状态码分支：PARAM_ERROR / RATE_LIMIT(strong) / NETWORK_ERROR(weak) / LINK_EXPIRED(strong)', () => {});
  {
    // 4xx/5xx 由 httpRequest 抛出（带 err.code），probe 在 catch 里统一映射
    const cases = [
      ['非法URL', null, null, EC.PARAM_ERROR, undefined, false],
      ['429', { statusCode: 429, headers: {}, body: '' }, null, EC.RATE_LIMIT, 'strong', false],
      ['500', { statusCode: 500, headers: {}, body: '' }, null, EC.SERVER_ERROR, 'weak', null],
      ['404', { statusCode: 404, headers: {}, body: '' }, null, EC.LINK_EXPIRED, 'strong', false],
    ];
    const outs = [];
    for (const [name, res, errRes, wantCode, wantEv, wantOk] of cases) {
      if (name === '非法URL') { outs.push({ name, out: await dbg.probeAudioDelivery('ftp://bad') }); continue; }
      setStub(() => res);
      outs.push({ name, out: await dbg.probeAudioDelivery('https://audio.test/a.mp3') });
    }
    resetStub();
    const ok = outs.every(({ name, out }) => {
      const want = cases.find(c => c[0] === name);
      return out && out.code === want[3] && (want[4] === undefined || out.evidence === want[4]) && (want[5] === undefined || out.ok === want[5]);
    });
    rec('A9', 'probe 状态码分支：PARAM_ERROR / RATE_LIMIT(strong) / NETWORK_ERROR(weak) / LINK_EXPIRED(strong)',
      ok, outs.map(o => `${o.name}=${o.out && o.out.code}/${o.out && o.out.evidence}`).join(' | '));
  }

  // A10：交付体形态分类——playlist / html / json / empty + toBytes 三种非 Buffer 形态
  {
    const bodies = [
      ['playlist', '#EXTM3U\n#EXTINF:5,\nhttps://a/b.mp3', EC.STREAM_PLAYLIST],
      ['html', '<!DOCTYPE html><html><body>login</body></html>', EC.NOT_AUDIO],
      ['json', '{"url":""}', EC.NOT_AUDIO],
      ['empty', Buffer.alloc(0), EC.NOT_AUDIO],
    ];
    const outs = [];
    for (const [name, body, wantCode] of bodies) {
      setStub(() => ({ statusCode: 200, headers: { 'content-type': name === 'json' ? 'application/json' : 'text/html' }, body }));
      outs.push({ name, wantCode, out: await dbg.probeAudioDelivery('https://audio.test/a.mp3') });
    }
    resetStub();
    const okProbe = outs.every(o => o.out && o.out.ok === false && o.out.code === o.wantCode);
    // toBytes：view / base64 串 / 认不出
    const u8 = dbg.toBytes ? dbg.toBytes(new Uint8Array([1, 2, 3])) : null;
    const u16 = dbg.toBytes ? dbg.toBytes(new Uint16Array([1])) : null;   // 非 Uint8 视图 → 走 buffer/byteOffset 分支
    const b64 = dbg.toBytes ? dbg.toBytes(Buffer.from('abcdefghijklmnop').toString('base64')) : null;
    const bad = dbg.toBytes ? dbg.toBytes({ opaque: true }) : 'no-fn';
    const okBytes = !!u8 && u8.length === 3 && !!u16 && u16.length === 2 && !!b64 && Buffer.from(b64).toString() === 'abcdefghijklmnop' && bad === null;
    rec('A10', '交付体分类 playlist/html/json/empty + toBytes 认 view/ArrayBuffer/base64 且认不出返回 null',
      okProbe && okBytes, outs.map(o => `${o.name}=${o.out && o.out.ok}/${o.out && o.out.code}`).join(' | ') + ` | bytes(view=${!!u8} u16=${!!u16} b64=${!!b64} bad=${bad})`);
  }

  // A11：verifyDelivery 的 medium 尺寸比分支（无真实时长，但体积明显小于整曲）
  {
    const fakeMp3 = Buffer.alloc(1200, 0x5A);   // 非音频二进制：认不出形态 → 无真实时长，只能按体积判
    setStub(() => ({ statusCode: 206, headers: { 'content-type': 'audio/mpeg', 'content-range': 'bytes 0-1023/48000' }, body: fakeMp3 }));
    let code = '';
    try {
      const r = await dbg.verifyDelivery('https://audio.test/a.mp3', { quality: 'flac', songInfo });
      code = (r && r.code) || (r && r.ok ? 'OK' : '');
    } catch (e) { code = e && e.code; }
    resetStub();
    rec('A11', '无真实时长但体积 48KB < max(128000, 280s*3000*0.6) → PREVIEW_FRAGMENT(medium)',
      code === EC.PREVIEW_FRAGMENT, `code=${code || '-'}`);
  }

  // A12：admit 的 delivery 分支 + applyAdmission 的 PASS 记账
  {
    const mk = (delivery) => dbg.admit({ stage: 'candidate', platform: 'kw', quality: 'flac', songInfo, source: 'suyinKuwo', delivery });
    const d429 = mk({ statusCode: 429, headers: {}, body: '' });
    const d500 = mk({ statusCode: 500, headers: {}, body: '' });
    const dPlay = mk({ statusCode: 200, headers: { 'content-type': 'audio/mpeg' }, body: '#EXTM3U\n#EXTINF:5,\nhttps://a/b.mp3' });
    const dJson = mk({ statusCode: 200, headers: { 'content-type': 'application/json' }, body: '{"url":""}' });
    const dHdr = mk({ statusCode: 206, headers: { 'content-type': 'audio/mpeg', 'content-range': 'bytes 0-1023/5198360' }, body: { opaque: 1 } });
    const dUnknown = mk({ statusCode: 200, headers: { 'content-type': 'application/octet-stream' }, body: { opaque: 1 } });
    const ok = d429 && d429.verdict === 'RATE_LIMITED' && d429.code === EC.RATE_LIMIT
      && d500 && d500.verdict === 'TRANSIENT' && d500.evidence === 'weak'
      && dPlay && dPlay.code === EC.STREAM_PLAYLIST
      && dJson && dJson.code === EC.NOT_AUDIO
      && dHdr && dHdr.verdict === 'PASS' && dHdr.evidence === 'medium'
      && dUnknown && dUnknown.verdict === 'PASS' && dUnknown.evidence === 'medium';   // octet-stream 头按音频放行
    // applyAdmission 的 success 分支（唯一允许记账的 reducer）
    const br = dbg.breakerMap.get('suyinKuwo') || {};
    br.failureCount = 0;
    dbg.breakerMap.set('suyinKuwo', br);
    const br0 = dbg.breakerMap.get('suyinKuwo') || {};
    br0.byQuality = br0.byQuality || {};
    br0.byQuality.flac = br0.byQuality.flac || { fail: 0, success: 0, linkExpired: 0 };
    dbg.breakerMap.set('suyinKuwo', br0);
    const okApply = !!dbg.applyAdmission && (() => {
      dbg.applyAdmission(dHdr, { source: 'suyinKuwo', platform: 'kw', quality: 'flac', songInfo, handler: { name: '溯音酷我' }, elapsed: 12 });
      const br1 = dbg.breakerMap.get('suyinKuwo') || {};
      return !!(br1.byQuality && br1.byQuality.flac && br1.byQuality.flac.success >= 1);
    })();
    rec('A12', 'admit delivery 分支（429/500/playlist/json/medium PASS/unknown weak）+ applyAdmission PASS 记成功',
      ok && okApply,
      [d429, d500, dPlay, dJson, dHdr, dUnknown].map(o => `${o && o.verdict}/${o && o.evidence}/${o && (o.code || '-')}`).join(' | ') + ` apply=${okApply}`);
  }

  // A13：skipReason 熔断分支 + clearSourceLedger 的 byQuality 归零 + trialMarkOf 嵌套对象
  {
    const id = 'suyinKuwo';

    const br = dbg.breakerMap.get(id) || {};
    br.state = 'open'; br.rateLimitUntil = null; br.rateLimited = false; br.lastFailureTime = Date.now();
    br.byQuality = {
      flac: { fail: 3, success: 0, linkExpired: 2, req: 5, time: 0, businessFail: 0, rateLimitCount: 0, rateLimitUntil: 0, rateLimited: false,
        breaker: { state: 'open', failureCount: 3, lastFailureTime: Date.now(), trialInFlight: false } },
      '128k': { fail: 1, success: 5, linkExpired: 0, req: 6, time: 0, businessFail: 0, rateLimitCount: 0, rateLimitUntil: 0, rateLimited: false,
        breaker: { state: 'closed', failureCount: 0, lastFailureTime: 0, trialInFlight: false } },
    };
    dbg.breakerMap.set(id, br);
    const sr = dbg.skipReason ? dbg.skipReason(id, { platform: 'kw', quality: 'flac' }) : null;
    if (dbg.clearSourceLedger) dbg.clearSourceLedger(id);
    const br2 = dbg.breakerMap.get(id) || {};
    const q2 = br2.byQuality || {};
    const qFlac = q2.flac || {}, q128 = q2['128k'] || {};
    const qZero = qFlac.fail === 0 && qFlac.success === 0 && qFlac.linkExpired === 0 && q128.fail === 0 && q128.success === 0;
    const tm = dbg.trialMarkOf ? dbg.trialMarkOf({ privilege: { freeTrial: true } }) : false;
    rec('A13', 'skipReason 熔断分支 + clearSourceLedger 逐档归零 + trialMarkOf 嵌套对象',
      !!sr && sr.reason === 'open' && qZero && tm === true,
      `skipReason=${JSON.stringify(sr)} qZero=${qZero} trialNested=${tm}`);
  }


  // A14：剩余「新增分支」——probe 未知字节双出口、无字节头信息双出口、admit 字节四形态、toBytes 非对象兜底
  {
    const probes = [];
    setStub(() => ({ statusCode: 200, headers: { 'content-type': 'audio/mpeg' }, body: Buffer.alloc(1200, 0x00) }));   // 认不出 + 头是音频 → medium PASS
    probes.push({ name: 'unknown+audioHdr', res: await dbg.probeAudioDelivery('https://audio.test/a.mp3') });
    setStub(() => ({ statusCode: 200, headers: { 'content-type': 'application/x-unknown' }, body: Buffer.alloc(1200, 0x00) })); // 认不出 + 头不明 → NOT_AUDIO weak
    probes.push({ name: 'unknown+badHdr', res: await dbg.probeAudioDelivery('https://audio.test/a.mp3') });
    setStub(() => ({ statusCode: 200, headers: { 'content-type': 'audio/mpeg' }, body: { opaque: true } }));  // 无字节 + 头是音频 → medium PASS
    probes.push({ name: 'noBytes+audioHdr', res: await dbg.probeAudioDelivery('https://audio.test/a.mp3') });
    setStub(() => ({ statusCode: 200, headers: { 'content-type': 'application/x-unknown' }, body: { opaque: true } })); // 无字节 + 头不明 → ok null weak
    probes.push({ name: 'noBytes+badHdr', res: await dbg.probeAudioDelivery('https://audio.test/a.mp3') });
    resetStub();
    const okProbe = probes[0].res.ok === true && probes[0].res.evidence === 'strong'
      && probes[1].res.ok === false && probes[1].res.evidence === 'weak' && probes[1].res.code === EC.NOT_AUDIO
      && probes[2].res.ok === true && probes[2].res.evidence === 'medium'
      && probes[3].res.ok === null && probes[3].res.evidence === 'weak';

    const mk = (delivery) => dbg.admit({ stage: 'candidate', platform: 'kw', quality: 'flac', songInfo, source: 'suyinKuwo', delivery });
    const fullFlac = makeFlac(280);   // 与 songInfo 同长 → 非片段
    const aFull = mk({ statusCode: 200, headers: { 'content-type': 'audio/flac' }, body: fullFlac });
    const aPlay = mk({ statusCode: 200, headers: {}, body: Buffer.from('#EXTM3U\n#EXTINF:5,\nhttps://a/b.mp3') });
    const aJson = mk({ statusCode: 200, headers: {}, body: Buffer.from('{"url":"","br":0}') });
    const aEmpty = mk({ statusCode: 200, headers: {}, body: Buffer.alloc(0) });
    const aUnk = mk({ statusCode: 200, headers: { 'content-type': 'audio/mpeg' }, body: Buffer.alloc(1200, 0x00) });
    const aUnkBad = mk({ statusCode: 200, headers: { 'content-type': 'application/x-unknown' }, body: Buffer.alloc(1200, 0x00) });
    const aNoHdr = mk({ statusCode: 200, headers: { 'content-type': 'application/x-unknown' }, body: { opaque: true } });   // 无字节 + 头不明 → TRANSIENT weak
    const okAdmit = aFull.verdict === 'PASS' && aFull.deliverable === true
      && aPlay.code === EC.STREAM_PLAYLIST
      && aJson.code === EC.NOT_AUDIO && aEmpty.code === EC.NOT_AUDIO
      && aUnk.verdict === 'PASS'
      && aUnkBad.verdict === 'NOT_AUDIO' && aUnkBad.evidence === 'weak'
      && aNoHdr.verdict === 'TRANSIENT' && aNoHdr.evidence === 'weak';
    const numNull = dbg.toBytes(12345) === null;
    rec('A14', 'probe 未知字节/无字节双出口 + admit 字节四形态 + toBytes 非对象兜底',
      okProbe && okAdmit && numNull,
      probes.map(p => `${p.name}=${p.res.ok}/${p.res.code || '-'}/${p.res.evidence}`).join(' | ')
        + ` | admitFull=${aFull.verdict} play=${aPlay.code} json=${aJson.code} empty=${aEmpty.code} unk=${aUnk.verdict} noHdr=${aNoHdr.verdict} unkBad=${aUnkBad.verdict} numNull=${numNull}`);
  }


  // A15：5xx 必须落 hardFail → recordFailure（变异体 MU11 的靶点，必须能杀掉它）
  {
    const d500 = dbg.admit({ stage: 'candidate', platform: 'kw', quality: 'flac', songInfo, source: 'suyinKuwo',
      delivery: { statusCode: 500, headers: {}, body: '' } });
    const okAdm = d500.verdict === 'TRANSIENT' && d500.ledger && d500.ledger.health === 'hardFail';
    const br = dbg.breakerMap.get('suyinKuwo') || {};
    const before = Number(br.failureCount) || 0;
    dbg.breakerMap.set('suyinKuwo', br);
    dbg.applyAdmission && dbg.applyAdmission(d500, { source: 'suyinKuwo', platform: 'kw', quality: 'flac', songInfo, elapsed: 0, error: { code: EC.SERVER_ERROR, reason: 'HTTP 500', evidence: 'weak' } });
    const after = Number((dbg.breakerMap.get('suyinKuwo') || {}).failureCount) || 0;
    rec('A15', '5xx → TRANSIENT/hardFail，且 applyAdmission 必须记入 recordFailure',
      okAdm && after > before, `health=${d500.ledger && d500.ledger.health} failureCount ${before}→${after}`);
  }


  // A16：buildSourceChain 的过滤必须与 skipReason 同一判据（play-dead 源不进链，恢复后回链）
  {
    const kwChain = () => (dbg.buildSourceChain ? dbg.buildSourceChain('kw', '128k') : []).map(h => h.id);
    const toggleBefore = dbg.runtimeToggles.suyinKuwo;
    dbg.runtimeToggles.suyinKuwo = true;
    dbg.playDeadStreak.set('suyinKuwo', 3);
    dbg.playDeadDeadline.set('suyinKuwo', Date.now());
    const deadChain = kwChain();
    const skipped = dbg.skipReason && dbg.skipReason('suyinKuwo');
    dbg.playDeadStreak.delete('suyinKuwo');
    dbg.playDeadDeadline.delete('suyinKuwo');
    const liveChain = kwChain();
    dbg.runtimeToggles.suyinKuwo = toggleBefore;
    rec('A16', 'buildSourceChain 过滤与 skipReason 同源：play-dead 源不进链，恢复后回链',
      !!dbg.buildSourceChain && !!skipped && skipped.reason === 'play-dead' &&
      deadChain.indexOf('suyinKuwo') < 0 && liveChain.indexOf('suyinKuwo') >= 0,
      `skip=${skipped && skipped.reason} deadHas=${deadChain.indexOf('suyinKuwo')} liveHas=${liveChain.indexOf('suyinKuwo')}`);
  }


  // A17：关源也必须清账（开/关对称）；关闭后立刻可从清空的账本重启
  {
    const fk = 'fail_kw|kw_651031866|flac';
    dbg.setFailCached(fk, EC.NOT_FOUND, 3600000);
    dbg.playDeadStreak.set('suyinKuwo', 3);
    dbg.playDeadDeadline.set('suyinKuwo', Date.now());
    const br = dbg.breakerMap.get('suyinKuwo') || {};
    br.state = 'open'; br.failureCount = 2; br.rateLimited = true; br.rateLimitUntil = Date.now() + 60000;
    dbg.breakerMap.set('suyinKuwo', br);
    const hasToggle = typeof dbg.toggleSource === 'function';
    const offRes = hasToggle ? dbg.toggleSource('suyinKuwo', false) : null;
    const failLeft = Array.from(dbg.failCache.keys()).filter(k => k.includes('fail_kw')).length;
    const streakLeft = dbg.playDeadStreak.get('suyinKuwo');
    const brAfter = dbg.breakerMap.get('suyinKuwo') || {};
    rec('A17', '关源也清账（失败缓存/摘除/熔断归零），开与关对称',
      hasToggle && offRes && offRes.enabled === false && failLeft === 0 && streakLeft === undefined &&
      brAfter.state === 'closed' && !brAfter.rateLimited && Number(brAfter.failureCount) === 0,
      `toggleSource=${hasToggle} enabled=${offRes && offRes.enabled} failLeft=${failLeft} streak=${streakLeft} state=${brAfter.state} rateLimited=${brAfter.rateLimited}`);
    if (hasToggle) dbg.toggleSource('suyinKuwo', true);
  }


  // A18：跨源聚合必须走 admit 的 codeRank——交付类 NOT_AUDIO 不得被业务类 NOT_FOUND 吞掉
  {
    const mkFail = (id, code, ev) => ({
      id, name: id, maxQuality: '128k',
      fn: async () => { const e = new Error(`${id}: ${code}`); e.code = code; e.evidence = ev; throw e; },
    });
    const chainA18 = [
      mkFail('a18notfound', EC.NOT_FOUND, 'strong'),   // 业务类 rank 2，先到
      mkFail('a18notaudio', EC.NOT_AUDIO, 'strong'),   // 交付类 rank 3，必须胜出
    ];
    let got = null;
    try {
      await dbg.fallbackRace(chainA18, 'kw', { songmid: 'A18' }, '128k', Date.now() + 4000);
    } catch (e) { got = e; }
    rec('A18', '跨源聚合按 codeRank 取代表码：NOT_AUDIO 不被 NOT_FOUND 吞',
      !!got && got.code === EC.NOT_AUDIO && Array.isArray(got.detail) && got.detail.length >= 2,
      `code=${got && got.code} detail=${got && got.detail && got.detail.length}`);
  }


  // A19：GET 无字节且头信息不足时，HEAD 补证（1500ms）——补到 audio 头才放行 medium
  {
    setStub((url, opts) => (opts && opts.method === 'HEAD')
      ? { statusCode: 200, headers: { 'content-type': 'audio/mpeg', 'content-length': '1048576' }, body: null }
      : { statusCode: 206, headers: {}, body: null });
    const got = await dbg.probeAudioDelivery('https://audio.test/a19.mp3');
    resetStub();
    rec('A19', 'GET 无字节+头不足 → HEAD 补证放行(medium)，不再直接 ok:null',
      !!dbg.probeByHeaders && got && got.ok === true && got.evidence === 'medium',
      `hasHelper=${!!dbg.probeByHeaders} ok=${got && got.ok} evidence=${got && got.evidence} reason=${got && got.reason}`);
  }


  // A20：I6 硬约束全遍历——任何 verdict × 任何错误码，非 strong 证据 TTL 绝不 >60s、playDead 恒 false
  {
    const codes = Object.values(EC).filter(v => typeof v === 'string' && /^[A-Z_]+$/.test(v));
    const verdicts = Object.keys(dbg.ADMISSION_POLICY);
    let bad = [];
    for (const v of verdicts) {
      for (const c of codes) {
        for (const ev of ['weak', 'medium']) {
          const l = dbg.admissionLedger ? dbg.admissionLedger(v, c, ev) : null;
          if (!l || Number(l.ttlMs || 0) > 60000 || l.playDead !== false) bad.push(`${v}/${c}/${ev}=${l && l.ttlMs}`);
        }
      }
    }
    rec('A20', '非 strong 证据全遍历：TTL 永不 >60s 且 playDead 恒 false',
      !!dbg.admissionLedger && codes.length >= 8 && verdicts.length === 7 && bad.length === 0,
      `has=${!!dbg.admissionLedger} codes=${codes.length} verdicts=${verdicts.length} bad=${bad.slice(0, 3).join(',')}(${bad.length})`);
  }

  console.log(`\n===== R 组（L4 裁决层）汇总：${pass} 通过 / ${fail} 失败 =====`);
  if (require.main === module) process.exit(fail ? 1 : 0);
})();
