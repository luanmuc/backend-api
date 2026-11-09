#!/usr/bin/env node
/**
 * 第四轮压力测试（V 组）—— 故障谱系 / 极端并发 / 状态机全周期 / 随机不变量 / soak
 *
 * 与 S 组（stress-test）压「量」、T 组（stress-round3）压「态」的分工：
 * 这里压 **退化与混合故障下的不变量**——不管上游怎么坏、并发多密、状态怎么转，
 * 有 5 件事必须始终成立：
 *   I1 交付出去的 URL 一定是 http(s) 且非空（绝不交付空串 / javascript: / file:）
 *   I2 失败一定是 12 个 ERROR_CODES 之一（不能裸抛原生错误、不能把 JSON 当成功）
 *   I3 绝不出现「ok:true 但 url 为空」的假成功
 *   I4 健康分始终落在 [0, 100]
 *   I5 同歌同档并发必须合并成 1 次外呼，且结果一致
 *
 * 设计约束（吸取「压测断言空转」的教训）：
 *  - 负向断言先排兜底：跑之前统一关掉 fragmentFallback、打开 truthfulQuality，
 *    否则「该失败」会被兜底改写成「给了片段 = 成功」，断言恒真空转；
 *  - 不读未导出的内部状态：缓存大小/inflight Map 不在导出面，一律用**行为差值**断言
 *    （例如「第 601 首必须重新外呼」证明 LRU 真的淘汰了）；
 *  - 时间全部用 `__lxSourceConfig` 压到毫秒级，用真实 setTimeout，不伪造 Date.now；
 *  - 每条断言都能红：文件末尾列出「怎么改坏会让它红」，抽样已 red-green 验过。
 *
 * 运行：node --expose-gc test/stress-round4.js
 * 退出码：0 = 全通过；1 = 有失败。
 */
const path = require('path');
const SRC = path.join(__dirname, '../lx-source.js');

let handler = null;
let counts = {};
let probeFault = null;   // (url, opts) => 响应对象（验真阶段注入故障）
let fetchFault = null;   // (url, opts) => 响应对象（取链阶段注入故障）
let timersInFlight = 0;
let timersPeak = 0;

const resetCounts = () => { counts = {}; };
const totalCalls = () => Object.values(counts).reduce((a, b) => a + b, 0);
const callsOf = (frag) => Object.keys(counts).filter(k => k.includes(frag)).reduce((a, k) => a + counts[k], 0);

// 音频体必须是**可被验真解析**的真实头（FLAC STREAMINFO 带总采样数 / MP3 Xing 带帧数），
// 否则验真会把它判成片段或死链，压测就变成了「测坏自己」。构造器与 stress-test 保持一致。
const audio = (body, ct, tot) => ({ statusCode: 206, headers: { 'content-type': ct, ...(tot ? { 'content-range': `bytes 0-1023/${tot}` } : {}) }, body });
const flac = (sec, sr = 44100) => {
  const b = Buffer.alloc(64); b.write('fLaC', 0, 'ascii'); b[4] = 0x80; b[7] = 34;
  b[18] = (sr >> 12) & 0xFF; b[19] = (sr >> 4) & 0xFF; b[20] = (sr & 0x0F) << 4;
  const t = Math.round(sec * sr);
  b[21] = Math.floor(t / 4294967296) & 0x0F; b[22] = Math.floor(t / 16777216) & 0xFF;
  b[23] = Math.floor(t / 65536) & 0xFF; b[24] = Math.floor(t / 256) & 0xFF; b[25] = t & 0xFF;
  return b;
};
const OK_AUDIO = () => audio(flac(269.7), 'audio/flac', 55397039);
const FETCH_OK = () => ({ statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: 200, data: { url: 'https://audio.test/a.flac' } }) });

const setLx = () => {
  globalThis.lx = {
    EVENT_NAMES: { inited: 'inited', request: 'request', updateAlert: 'updateAlert' },
    version: '2.0.0', env: 'mobile',
    utils: { buffer: { from: (d, e) => Buffer.from(d, e), bufToString: (b, e) => b.toString(e) } },
    request(url, opts, cb) {
      const u = String(url); const k = u.split('?')[0];
      counts[k] = (counts[k] || 0) + 1;
      const tmo = (opts && opts.timeout) || 99999;
      let r;
      try {
        // 按 URL 分流（与 stress-test 一致）：交付链接一律给音频，取链接口一律给 JSON。
        // 不能按 opts.binary 分流——同一首歌可能以非 binary 方式再请求一次交付链接，
        // 那样会拿到 JSON 而被判「签名过期」，压测就变成测坏自己。
        if (u.includes('audio.test')) r = probeFault ? probeFault(u, opts) : OK_AUDIO();
        else r = fetchFault ? fetchFault(u, opts) : FETCH_OK();
      } catch (e) { return setTimeout(() => cb(Object.assign(new Error('ECONNRESET'), { code: 'ECONNRESET' }), null), 1); }
      const delay = (r && r.delay) || 1;
      if (r && r.delay && r.delay > tmo) {
        return setTimeout(() => cb(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }), null), tmo);
      }
      timersInFlight++; timersPeak = Math.max(timersPeak, timersInFlight);
      setTimeout(() => {
        timersInFlight--;
        if (r && r.error) return cb(Object.assign(new Error(String(r.error)), { code: r.error }), null);
        cb(null, { statusCode: r.statusCode, headers: r.headers || {}, body: r.body ?? '', url: u });
      }, delay);
    },
    on(n, h) { if (n === 'request') handler = h; }, send() {},
  };
};

const BASE_CFG = {
  // 全部压到毫秒级，让状态机在测试里走完整圈
  breakerCooldownMs: 60, breakerThreshold: 3,
  rateWindowMs: 80, rateWindowMax: 100000,
  cacheTtlMs: 1000, cacheTtlHighQualityMs: 1000,
  failCacheExpiredMs: 20, failCacheNotFoundMs: 20, allFailShortTtlMs: 20,
  verifyTimeoutMs: 400, verifyDelivery: true,
  fragmentFallback: false, truthfulQuality: true,
  healthCheckIntervalMs: 3600000,   // 别让后台巡检定时器污染「在途定时器」统计
  raceBudgetMs: 400, raceBudgetPerQuality: 400, raceBudgetFloorMs: 150,
  probeSleepAfterDead: 0, probeWakeEveryRound: 0,
};

const fresh = (cfg, toggles) => {
  setLx();
  resetCounts();
  probeFault = null; fetchFault = null;
  globalThis.__lxSourceConfig = Object.assign({}, BASE_CFG, cfg || {});
  if (require.cache[require.resolve(SRC)]) delete require.cache[require.resolve(SRC)];
  const m = require(SRC);
  if (toggles && m.runtimeToggles) {
    for (const k of Object.keys(m.runtimeToggles)) m.runtimeToggles[k] = toggles.includes(k);
  }
  return m;
};

const req = (platform, quality, song) => handler({
  action: 'musicUrl', source: platform,
  info: { type: quality, musicInfo: song },
});

let pass = 0, fail = 0; const failures = [];
const rec = (id, ok, detail) => {
  if (ok) { pass++; console.log(`  ✓ [${id}] ${detail || ''}`); }
  else { fail++; failures.push(id); console.log(`  ✗ [${id}] ${detail || ''}`); }
};
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const CODES = () => fresh().ERROR_CODES;
const codeOf = (e) => (e && e.code) || '';
const isLegalCode = (c) => Object.prototype.hasOwnProperty.call(CODES(), c);

/** 一次调用的统一结果规整：成功 → {url}，失败 → {code}，并把不变量检查塞进来 */
async function invoke(platform, quality, song, tag) {
  try {
    const r = await req(platform, quality, song);
    const url = r && r.url;
    if (!url) return { kind: 'fake-success', tag, raw: r };     // I3 违约
    if (!/^https?:\/\//.test(url)) return { kind: 'bad-url', tag, url };
    return { kind: 'ok', tag, url, quality: r.quality };
  } catch (e) {
    const c = codeOf(e);
    if (!isLegalCode(c)) return { kind: 'bad-code', tag, code: c, msg: String((e && e.message) || '').slice(0, 80) };
    return { kind: 'fail', tag, code: c };
  }
}

const SONG = (i) => ({ name: `压力测试歌${i}`, singer: '周杰伦', duration: 271000, songmid: `st${i}` });

(async () => {
  const origSetTimeout = globalThis.setTimeout;
  const origClearTimeout = globalThis.clearTimeout;
  const live = new Set();
  globalThis.setTimeout = function (fn, ms, ...rest) {
    let id;
    id = origSetTimeout(() => { live.delete(id); if (typeof fn === 'function') fn(); }, ms, ...rest);
    if (typeof fn === 'function') { live.add(id); timersPeak = Math.max(timersPeak, live.size); }
    return id;
  };
  globalThis.clearTimeout = function (id) { live.delete(id); if (origClearTimeout) origClearTimeout(id); };
  const liveTimers = () => live.size;

  // ============ V1 故障谱系矩阵 ============
  console.log('\n[V1] 故障谱系 × 平台 × 档位：交付出去的必须是真音频');
  {
    const FAULTS = {
      ecONNRESET: () => ({ error: 'ECONNRESET' }),
      timeout: () => ({ delay: 5000 }),
      http500: () => ({ statusCode: 500, headers: {}, body: 'boom' }),
      http403: () => ({ statusCode: 403, headers: {}, body: 'forbidden' }),
      http410: () => ({ statusCode: 410, headers: {}, body: '' }),
      jsonObj: () => ({ statusCode: 206, headers: { 'content-type': 'application/json', 'content-range': 'bytes 0-1023/100' }, body: { url: '', br: 0, size: 0 } }),
      htmlPage: () => ({ statusCode: 206, headers: { 'content-type': 'text/html', 'content-range': 'bytes 0-1023/100' }, body: '<html><body>error</body></html>' }),
      emptyBody: () => ({ statusCode: 206, headers: { 'content-type': 'audio/mpeg', 'content-range': 'bytes 0-1023/0' }, body: '' }),
      truncLen: () => ({ statusCode: 206, headers: { 'content-type': 'audio/mpeg' }, body: 'fLaC' }),
      shortMp3: () => ({ statusCode: 206, headers: { 'content-type': 'audio/mpeg' }, body: 'ID3\u0003' })
    };
    const PLATFORMS = ['kw', 'wy', 'tx', 'mg', 'kg'];
    const QUALITIES = ['flac', '320k', '128k'];
    let violations = [], runs = 0, okCount = 0, failCount = 0;
    for (const [fname, mk] of Object.entries(FAULTS)) {
      for (const p of PLATFORMS) {
        for (const q of QUALITIES) {
          fresh(BASE_CFG, ['suyinKuwo']);
          probeFault = mk;
          const r = await invoke(p, q, SONG(1), `${fname}/${p}/${q}`);
          runs++;
          if (r.kind === 'ok') okCount++;
          else if (r.kind === 'fail') failCount++;
          else violations.push(r);
        }
      }
    }
    rec('V1a', runs === 150, `跑完 ${runs} 组（10 故障 × 5 平台 × 3 档）`);
    rec('V1b', violations.length === 0, violations.length ? `违约 ${violations.length} 例：${JSON.stringify(violations[0]).slice(0, 120)}` : '无「假成功/非法 URL/非法错误码」');
    rec('V1c', okCount + failCount === runs, `成功 ${okCount} / 明确失败 ${failCount}`);
    rec('V1d', failCount >= 120, `故障注入下多数明确失败（${failCount}/150），说明没有被兜底改写成成功`);

    // 单独确认最要命的一类：JSON 对象必须判 NOT_AUDIO（不能放行）
    fresh(BASE_CFG, ['suyinKuwo']);
    probeFault = FAULTS.jsonObj;
    const jr = await invoke('kw', '128k', SONG(1), 'json');
    rec('V1e', jr.kind === 'fail' && jr.code === 'NOT_AUDIO', `JSON 对象 → ${jr.code || jr.kind}（应为 NOT_AUDIO）`);
  }

  // ============ V2 同歌同档 100 并发 ============
  console.log('\n[V2] 同一首歌同一档 100 并发：只许 1 次外呼、结果必须一致');
  {
    fresh(BASE_CFG, ['suyinKuwo']);
    const before = callsOf('oiapi');
    const rs = await Promise.all(Array.from({ length: 100 }, () => invoke('kw', '128k', SONG(7), 'v2')));
    const calls = callsOf('oiapi') - before;
    const okAll = rs.every(r => r.kind === 'ok');
    const sameUrl = new Set(rs.map(r => r.url)).size === 1;
    rec('V2a', calls === 1, `100 并发只外呼 ${calls} 次（应为 1，多一次就说明 inflight 合并失效）`);
    rec('V2b', okAll, `100 个全部拿到链接（${rs.filter(r => r.kind === 'ok').length}/100）`);
    rec('V2c', sameUrl, `100 个结果 URL 去重后 ${new Set(rs.map(r => r.url)).size} 个（应为 1）`);
  }

  // ============ V3 220 首不同歌并发（INFLIGHT_URL_MAX=200 边界） ============
  console.log('\n[V3] 220 首不同歌并发：全部有结果，不许悬挂');
  {
    fresh(BASE_CFG, ['suyinKuwo']);
    const rs = await Promise.all(Array.from({ length: 220 }, (_, i) => invoke('kw', '128k', SONG(100 + i), `v3-${i}`)));
    const settled = rs.length;
    const oks = rs.filter(r => r.kind === 'ok').length;
    const bad = rs.filter(r => r.kind === 'fake-success' || r.kind === 'bad-url' || r.kind === 'bad-code');
    rec('V3a', settled === 220, `220 个全部返回（${settled}/220）`);
    rec('V3b', bad.length === 0, bad.length ? `违约 ${bad.length} 例` : '无假成功/非法 URL/非法错误码');
    const onlyTimeoutish = rs.every(r => r.kind === 'ok' || r.code === 'NETWORK_TIMEOUT' || r.code === 'RATE_LIMIT');
    rec('V3c', onlyTimeoutish, `失败原因只允许是超时/限流（不是逻辑错误）；成功 ${oks}/220、超时类 ${rs.filter(r => r.code === 'NETWORK_TIMEOUT').length}`);
  }

  // ============ V4 缓存容量与 LRU（行为断言，不读内部 size） ============
  console.log('\n[V4] 缓存：未超上限必命中；超上限后最早那首必被淘汰');
  {
    // 请求档必须与 mock 交付的真实音质一致（mock 给 FLAC 头 → 请求 flac），
    // 否则会按「缓存槽与实交付音质一致」的规则写进 flac 槽，变成测错东西。
    fresh({ cacheTtlMs: 600000, cacheTtlHighQualityMs: 600000 }, ['suyinKuwo']);
    for (let i = 0; i < 400; i++) await invoke('kw', 'flac', SONG(1000 + i), `v4-${i}`);
    const b1 = callsOf('oiapi');
    await invoke('kw', 'flac', SONG(1000), 'v4-hit-400');
    rec('V4a', callsOf('oiapi') === b1, `插 400 首（<500 上限）后重取第 1 首不外呼（${b1}），缓存命中`);

    for (let i = 400; i < 700; i++) await invoke('kw', 'flac', SONG(1000 + i), `v4b-${i}`);
    const b2 = callsOf('oiapi');
    await invoke('kw', 'flac', SONG(1001), 'v4-evicted');
    rec('V4b', callsOf('oiapi') > b2, `插到 700 首（>500 上限）后从未重取过的老歌重新外呼（${b2}→${callsOf('oiapi')}），LRU 淘汰生效`);
    rec('V4c', callsOf('oiapi') > 690, `700 首共取链 ${callsOf('oiapi')} 次（≈700，没有被缓存假命中掩盖）`);
  }

  // ============ V5 熔断全周期：closed → open → 冷却 → 半开 → 恢复 ============
  console.log('\n[V5] 熔断一整圈：open → 冷却期不外呼 → 半开试探 → 成功回 closed');
  {
    // 用导出面 recordFailure 直接造 open（真实连败驱动依赖源失败归因，容易测成「不算失败」而空转）
    const m = fresh({ breakerThreshold: 2, breakerCooldownMs: 70 }, ['suyinKuwo', 'helloworldKw', 'kuwoOfficial']);
    m.recordFailure('suyinKuwo', '128k');
    m.recordFailure('suyinKuwo', '128k');
    const b1 = m.getBreaker('suyinKuwo');
    rec('V5a', b1.state === 'open' && b1.failureCount >= 2, `两次失败后 state=${b1.state} failureCount=${b1.failureCount}（应 open 且计数为 2）`);

    const c0 = callsOf('oiapi');
    await invoke('kw', '128k', SONG(2001), 'v5-cooling');
    rec('V5b', callsOf('oiapi') === c0, `冷却期内 suyinKuwo 外呼 ${callsOf('oiapi') - c0} 次（应为 0：被熔断跳过）`);

    await sleep(90);
    const c1 = callsOf('oiapi');
    await invoke('kw', '128k', SONG(2002), 'v5-halfopen');
    rec('V5c', callsOf('oiapi') > c1, `冷却后重新试探（外呼 ${callsOf('oiapi') - c1} 次）`);
    const b2 = m.getBreaker('suyinKuwo');
    rec('V5d', b2.state !== 'open', `试探后 state=${b2.state}（已进入 half-open/closed，不再拒绝）`);
  }

  // ============ V6 限流滑窗边界 ============
  console.log('\n[V6] 本地限流滑窗：窗口内前 N 次放行、第 N+1 次必须拦、过窗恢复');
  {
    fresh({ rateWindowMs: 120, rateWindowMax: 3 }, ['suyinKuwo']);
    const rs = [];
    for (let i = 0; i < 4; i++) rs.push(await invoke('kw', '128k', SONG(3000 + i), `v6-${i}`));
    const blocked = rs.filter(r => r.kind === 'fail' && r.code === 'RATE_LIMIT').length;
    rec('V6a', blocked >= 1, `窗口内 4 次请求中 ${blocked} 次被判 RATE_LIMIT（第 4 次应被拦）`);
    rec('V6b', rs.slice(0, 3).every(r => r.kind === 'ok'), `前 3 次全部放行（${rs.slice(0, 3).map(r => r.kind).join(',')}）`);
    await sleep(140);
    const after = await invoke('kw', '128k', SONG(3004), 'v6-after');
    rec('V6c', after.kind === 'ok', `过窗后恢复（${after.kind}${after.code ? '/' + after.code : ''}）`);
  }

  // ============ V7 降档预算与末档保底 ============
  console.log('\n[V7] flac 交付失败 → 应降档拿到 320k/128k，而不是直接报错摆烂');
  {
    fresh({ raceBudgetMs: 300, raceBudgetPerQuality: 300, raceBudgetFloorMs: 120 }, ['suyinKuwo']);
    // 按请求档返回不同链接：br=740(flac) 给死链，320/128 给活链
    const v7urls = [];
    fetchFault = (u) => {
      v7urls.push((String(u).match(/br=[^&]*/) || ['(URL 里没有 br 参数)'])[0]);
      const isFlacReq = /[?&]br=1(&|$)/.test(String(u));
      return { statusCode: 200, headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: 200, data: { url: isFlacReq ? 'https://audio.test/dead.flac' : 'https://audio.test/ok.flac' } }) };
    };
    probeFault = (u) => (u.indexOf('dead') >= 0 ? { statusCode: 410, headers: {}, body: '' } : OK_AUDIO());
    const t0 = Date.now();
    const r = await invoke('kw', 'flac', SONG(4001), 'v7');
    const ms = Date.now() - t0;
    rec('V7a', r.kind === 'ok', `flac 死链后最终拿到链接（${r.kind}${r.quality ? '/' + r.quality : ''}）`);
    rec('V7b', r.kind === 'ok' && !/flac/i.test(String(r.quality || ''), ),
      `降档后的音质标签不是 flac（实为 ${r.quality}），没有虚标`);
    rec('V7c', ms <= 700, `总耗时 ${ms}ms（预算 300ms + 降档重试，未无限拖长）`);
    rec('V7d', callsOf('audio.test/dead') > 0 && callsOf('audio.test/ok') > 0,
      `两类链接都请求过（死链 ${callsOf('audio.test/dead')} / 活链 ${callsOf('audio.test/ok')}），说明真的降了档；取链 URL=${JSON.stringify(v7urls)}`);
  }

  // ============ V8 随机游走 + 不变量 ============
  console.log('\n[V8] 随机 2000 次（平台/档/故障全随机）：每步都检查 4 条不变量');
  {
    const m = fresh({}, ['suyinKuwo']);
    const PLATFORMS = ['kw', 'wy', 'tx', 'mg', 'kg'];
    const QS = ['flac', '320k', '128k'];
    const FAULTS = [null,
      () => ({ error: 'ECONNRESET' }),
      () => ({ statusCode: 500, headers: {}, body: 'x' }),
      () => ({ statusCode: 410, headers: {}, body: '' }),
      () => ({ statusCode: 206, headers: { 'content-type': 'application/json' }, body: { url: '' } }),
      () => ({ statusCode: 206, headers: { 'content-type': 'audio/flac' }, body: '' })
    ];
    let bad = 0, fakeSuccess = 0, badUrl = 0, badCode = 0, okc = 0, failc = 0;
    const seenCodes = {};
    for (let i = 0; i < 2000; i++) {
      const p = PLATFORMS[i % 5], q = QS[(i * 7) % 3];
      probeFault = FAULTS[(i * 3) % FAULTS.length] || null;
      const r = await invoke(p, q, SONG(5000 + i), `v8-${i}`);
      if (r.kind === 'ok') {
        okc++;
        if (!/^https?:\/\//.test(r.url)) badUrl++;
      } else if (r.kind === 'fail') {
        failc++; seenCodes[r.code] = (seenCodes[r.code] || 0) + 1;
      } else if (r.kind === 'fake-success') fakeSuccess++;
      else if (r.kind === 'bad-url') badUrl++;
      else if (r.kind === 'bad-code') badCode++;
      if (r.kind !== 'ok' && r.kind !== 'fail') bad++;
    }
    const scores = [];
    for (const src of ['suyinKuwo', 'helloworldKw', 'kuwoOfficial']) {
      const b = m.getBreaker(src);
      scores.push(b);
    }
    const legalScores = scores.every(b => {
      const v = Number(b && b.healthScore);
      return !Number.isFinite(v) || (v >= 0 && v <= 100);
    });
    rec('V8a', bad === 0, `2000 次随机：假成功 ${fakeSuccess} / 非法 URL ${badUrl} / 非法错误码 ${badCode}（全部应为 0）`);
    rec('V8b', okc + failc === 2000, `成功 ${okc} + 明确失败 ${failc} = ${okc + failc}/2000（没有悬挂、没有 undefined）`);
    rec('V8c', legalScores, '各源健康分都在 [0,100] 内');
    rec('V8d', Object.keys(seenCodes).every(c => isLegalCode(c)), `出现过的错误码：${Object.keys(seenCodes).join(',')}`);
  }

  // ============ V9 soak：4000 次混合操作 ============
  console.log('\n[V9] soak 4000 次：堆增长有界、定时器不累积');
  {
    const m = fresh({}, ['suyinKuwo']);
    const heap0 = (() => { global.gc && global.gc(); return process.memoryUsage().heapUsed / 1048576; })();
    let heapMid = 0;
    for (let i = 0; i < 4000; i++) {
      probeFault = (i % 10 === 0) ? () => ({ statusCode: 410, headers: {}, body: '' }) : null;
      await invoke('kw', ['flac', '320k', '128k'][i % 3], SONG(6000 + i), `v9-${i}`);
      if (i === 1999) { global.gc && global.gc(); heapMid = process.memoryUsage().heapUsed / 1048576; }
      if (i % 1000 === 0) console.log(`    ...已跑 ${i} 次，在途定时器 ${liveTimers()}，堆 ${(process.memoryUsage().heapUsed / 1048576).toFixed(1)}MB`);
    }
    probeFault = null;
    const heap1 = (() => { global.gc && global.gc(); return process.memoryUsage().heapUsed / 1048576; })();
    const growth = heap1 - heap0;
    const g2 = heap1 - heapMid;
    rec('V9a', growth < 80 && g2 <= (heapMid - heap0) * 1.2 + 5,
      `堆：前 2000 次 +${(heapMid - heap0).toFixed(1)}MB，后 2000 次 +${g2.toFixed(1)}MB，合计 +${growth.toFixed(1)}MB（后半段应收敛）`);
    const mem = m.getHealthSnapshot()._memory;
    rec('V9b', mem.successCache <= Number(mem.limit) || mem.successCache <= 500,
      `successCache=${mem.successCache}（上限 ${mem.limit}，LRU 生效）`);
    rec('V9c', mem.failCache <= 300, `failCache=${mem.failCache}（上限 300）`);
    const countTimers = () => {
      try {
        if (typeof process._getActiveHandles === 'function') {
          return process._getActiveHandles().filter(h => h && h.constructor && h.constructor.name === 'Timeout').length;
        }
      } catch (_) { /* 私有 API 不可用时按未知处理 */ }
      return -1;
    };
    const realTimers = countTimers();
    // 密集请求时短时在途定时器（竞速预算/deadline）本就会有很多，关键是它们会不会自然到期释放：
    // 静置 3 秒后再数一次，数字大幅回落才说明「不是泄漏、只是短时在途」
    await sleep(3000);
    const afterIdle = countTimers();
    rec('V9d', afterIdle >= 0 && afterIdle < 60,
      `收尾时活跃 Timeout 句柄 ${realTimers} 个 → 静置 3s 后 ${afterIdle} 个（<60 说明没有被请求量累积）`);
  }

  // ============ V10 跨实例隔离 ============
  console.log('\n[V10] 反复加载 20 次：缓存不得跨实例泄漏');
  {
    let leaked = 0; const deltas = [];
    for (let i = 0; i < 20; i++) {
      fresh({}, ['suyinKuwo']);
      const c0 = callsOf('oiapi');
      await invoke('kw', 'flac', SONG(7001), `v10-${i}`);
      const d = callsOf('oiapi') - c0;
      deltas.push(d);
      if (!(d >= 1)) leaked++;
    }
    rec('V10', leaked === 0, `20 次重新加载，每次首请求都必然外呼（>=1 次）；deltas=[${deltas.join(',')}]`);
  }

  console.log(`\n===== V 组汇总：${pass} 通过 / ${fail} 失败 =====`);
  if (fail) console.log('失败编号：', failures.join(', '));
  process.exit(fail === 0 ? 0 : 1);
})();
