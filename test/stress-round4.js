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
let countsByTimeout = {}; // URL + NUL + timeout：同一 URL 的预热与健康探针靠超时口径区分
let probeFault = null;   // (url, opts) => 响应对象（验真阶段注入故障）
let fetchFault = null;   // (url, opts) => 响应对象（取链阶段注入故障）
let timersInFlight = 0;
let timersPeak = 0;

const resetCounts = () => { counts = {}; countsByTimeout = {}; };
const totalCalls = () => Object.values(counts).reduce((a, b) => a + b, 0);
const callsOf = (frag) => Object.keys(counts).filter(k => k.includes(frag)).reduce((a, k) => a + counts[k], 0);
// V18 专用：健康探针与预热打同一个 /url/kw/228908/128k，只按 URL 计数会把探针算成预热（CI 假红根因）。
// 预热固定用冷启动超时（V18 注入唯一值），探针用 coldStartProbeTimeoutMs，双键可精确隔离。
const callsOfTimeout = (frag, timeout) => Object.keys(countsByTimeout)
  .filter(k => {
    const parts = k.split('\u0000');
    return parts[0].includes(frag) && Number(parts[1]) === timeout;
  })
  .reduce((a, k) => a + countsByTimeout[k], 0);

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
      const u = String(url); const k = u;   // 保留 query：砍掉后无法按参数断言（如 suyinKuwo 的 br=1 档）
      const tmo = (opts && opts.timeout) || 99999;
      counts[k] = (counts[k] || 0) + 1;
      countsByTimeout[`${k}\u0000${tmo}`] = (countsByTimeout[`${k}\u0000${tmo}`] || 0) + 1;
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

// 错误码快照只取一次：原写法 `fresh().ERROR_CODES` 会在每次 isLegalCode 时重新加载模块，
// 把 counts / 熔断 / 短路等全部状态清零——断言因此看不到真实累积，还出现过负数计数。
let ERROR_CODES_SNAPSHOT = null;
const CODES = () => (ERROR_CODES_SNAPSHOT || (ERROR_CODES_SNAPSHOT = fresh().ERROR_CODES));
const codeOf = (e) => (e && e.code) || '';
// 合法码按「值」判定：生产里 err.code 一律是 ERROR_CODES.X 的值，
// 而 MISMATCH 的键名 `MISMATCH` ≠ 值 `SONG_MISMATCH`，按键名判会把合法码误判成非法（D-30 同源）。
const isLegalCode = (c) => Object.values(CODES()).includes(c);

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
  ERROR_CODES_SNAPSHOT = fresh().ERROR_CODES;   // 测试开始前取一次，之后不再重载
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

  // ============ V11 MISMATCH 闸门：strict 档不许把同名错歌交付出去 ============
  // 设计要点：suyinKuwo 的关键词有 strict（歌名+歌手）与兜底（歌名）两种，
  // 兜底档按设计「放宽歌手/专辑、只校歌名与时长」。所以不能只看最终结果，
  // 而是用「第一轮故意给错歌、之后给正确歌」的口径：
  //   闸门生效 → 错歌被拒、重试拿到正确链接；闸门失效 → 第一轮就直接把错歌交付。
  console.log('\n[V11] MISMATCH：同名不同版本（翻唱/别的歌手）必须被拒，不许把错歌交出去');
  {
    const T = { name: '七里香', singer: '周杰伦', duration: 271000, songmid: 'mis1' };
    const mk = (song, singer, durSec, url) => () => ({
      statusCode: 200, headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: 1, data: { song, singer, duration: durSec, url } }),
    });
    const right = mk('七里香', '周杰伦', 271, 'https://audio.test/right.flac');
    const runFirstWrong = async (wrong, song, tag) => {
      fresh(BASE_CFG, ['suyinKuwo']);
      let n = 0;
      fetchFault = () => (++n === 1 ? wrong() : right());
      return invoke('kw', 'flac', song || T, tag);
    };

    const a = await runFirstWrong(mk('七里香', '费玉清', 271, 'https://audio.test/wrong1.flac'), T, 'v11a');
    rec('V11a', a.kind === 'ok' && String(a.url || '').includes('right'),
      `首轮给「同名不同歌手」→ 最终交付 ${a.url || a.code}（应是被拒后重试拿到的 right，而不是 wrong1）`);

    const b = await runFirstWrong(mk('七里香', '周杰伦', 200, 'https://audio.test/wrong2.flac'), T, 'v11b');
    rec('V11b', b.kind === 'ok' && String(b.url || '').includes('right'),
      `首轮给「同名同歌手但时长差 71s」→ 最终交付 ${b.url || b.code}（应拒绝并重试拿到 right，而不是 wrong2）`);

    const c = await runFirstWrong(right, T, 'v11c');
    rec('V11c', c.kind === 'ok' && /^https?:\/\//.test(c.url || ''),
      `首轮就给正确歌 → ${c.kind} ${c.url || ''}（正例必须成功，否则 a/b 可能是恒红）`);

    const leaked = [a, b].some(x => String(x.url || '').includes('wrong'));
    rec('V11d', !leaked, `错歌没有被交付出去（a=${a.url || a.code}, b=${b.url || b.code}）`);
  }

  // ============ V12 片段识别三阈值：只用默认值 + 边界样本（不覆盖 config） ============
  // 判据源码：ratio < verifyDurRatio(0.6) **且** gap > verifyDurGapSec(15) 才判片段；
  // 原曲 < verifyMinOriginalSec(90) 时整条判据不套用。三条件缺一都不该误判。
  console.log('\n[V12] 片段识别三阈值：比率/绝对差/短原曲免判，逐条卡边界');
  {
    const totalOf = (sec) => Math.round(55397039 * sec / 269.7);
    const flacAt = (sec) => audio(flac(sec), 'audio/flac', totalOf(sec));
    const full = { name: '阈值边界歌', singer: '周杰伦', duration: 271000, songmid: 'dur1' };
    const probeWith = async (sec, song, tag) => {
      fresh(BASE_CFG, ['suyinKuwo']);
      probeFault = () => flacAt(sec);
      return invoke('kw', 'flac', song || full, tag);
    };
    const isFrag = (r) => r.kind === 'fail' && r.code === 'PREVIEW_FRAGMENT';

    const r160 = await probeWith(160, full, 'v12a');
    rec('V12a', isFrag(r160), `交付 160s / 原曲 271s（ratio 0.590，差 111s）→ ${r160.code || r160.kind}（应 PREVIEW_FRAGMENT）`);

    const r170 = await probeWith(170, full, 'v12b');
    rec('V12b', !isFrag(r170), `交付 170s（ratio 0.627 > 0.6，差 101s）→ ${r170.code || r170.kind}（比率够就不判：两条件是 AND）`);

    const r258 = await probeWith(258, full, 'v12c');
    rec('V12c', !isFrag(r258), `交付 258s（ratio 0.952，差 13s < 15s）→ ${r258.code || r258.kind}（差距不够就不判）`);

    const shortSong = { name: '短原曲', singer: '周杰伦', duration: 80000, songmid: 'dur2' };
    const rShort = await probeWith(40, shortSong, 'v12d');
    rec('V12d', !isFrag(rShort), `原曲仅 80s（<90s 门槛）、交付 40s → ${rShort.code || rShort.kind}（短原曲不套用比率判据）`);

    const r162 = await probeWith(162, full, 'v12e');
    rec('V12e', isFrag(r162), `交付 162s（ratio 0.598 刚过 0.6 线，差 109s）→ ${r162.code || r162.kind}（证明比率侧真卡在 0.6）`);
  }

  // ============ V13 CONFIG_ERROR：配置/鉴权类失败必须报配置码，不能被归一吞成网络错误 ============
  // 注：另外两处 `if (!HUIBQ_API)` / `if (!LINGCHUAN_API)` 是恒假死分支（常量硬编码、非配置项），
  // 不可达故无法测；已记入 AUDIT_RESULTS §16 作为观察项，不在此假装覆盖。
  console.log('\n[V13] CONFIG_ERROR：卡密失效要报配置类错误，而不是网络错误');
  {
    fresh(BASE_CFG, ['ikun']);
    fetchFault = (u) => (/wwwweb|ikun/i.test(u)
      ? { statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: 403, message: 'invalid api key' }) }
      : { statusCode: 404, headers: {}, body: '' });
    const r = await invoke('kw', '128k', SONG(8001), 'v13a');
    rec('V13a', r.kind === 'fail' && r.code === CODES().CONFIG_ERROR,
      `ikun 返回 code:403 → ${r.code || r.kind}（应为 CONFIG_ERROR，不能被归一吞成 NETWORK_ERROR）`);
  }

  // ============ V14 配置读接口脱敏 + 写白名单 ============
  // 卡密/设备ID 绝不能明文透出给前端；config 写模式只允许白名单键，防止被改成任意值。
  console.log('\n[V14] 配置接口：敏感字段必须脱敏，且不能通过写接口篡改');
  {
    const SECRETS = { ikunApiKey: 'k-secret-abc', lingchuanApiKey: 'lc-secret', xinghaiDeviceId: 'dev-secret-xyz' };
    fresh(Object.assign({}, BASE_CFG, SECRETS), ['suyinKuwo']);
    const r = await handler({ action: 'config', source: 'kw', info: {} });
    const dump = JSON.stringify(r || {});
    rec('V14a', !dump.includes('k-secret-abc') && !dump.includes('lc-secret') && !dump.includes('dev-secret-xyz'),
      `配置读接口不透出明文（dump 长度 ${dump.length}）`);
    rec('V14b', r && r.ikunApiKey === '***已设置***' && r.xinghaiDeviceId === '***已设置***',
      `已设置的敏感项返回「***已设置***」（ikunApiKey=${r && r.ikunApiKey}）`);

    const w = await handler({ action: 'config', source: 'kw', info: { ikunApiKey: 'hacked-key' } });
    const after = await handler({ action: 'config', source: 'kw', info: {} });
    rec('V14c', !JSON.stringify(after || {}).includes('hacked-key'),
      `写接口不许篡改卡密（写入结果 ${JSON.stringify(w || {}).slice(0, 60)}）`);
  }

  // ============ V15 logEnabled：关掉就必须真的不说话 ============
  console.log('\n[V15] logEnabled：关日志要真静音，开日志要真有输出');
  {
    const logs = [];
    const origLog = console.log;
    console.log = function (...a) {
      const line = a.map(String).join(' ');
      if (line.includes('[聚合音源]')) logs.push(line);
      origLog.apply(console, a);
    };
    try {
      fresh(Object.assign({}, BASE_CFG, { logEnabled: false }), ['suyinKuwo']);
      logs.length = 0;  // 「已加载」横幅是注册期一次性输出，不受 logEnabled 管，只统计运行期日志
      fetchFault = () => audio(271);
      await invoke('kw', '128k', SONG(9001), 'v15a');
      // 「已加载」横幅是注册期一次性输出（logEnabled 不管它），只统计运行期日志
      const runtime = logs.filter(l => !l.includes('已加载'));
      const off = runtime.length;
      const firstOff = (runtime[0] || '').slice(0, 80);
      logs.length = 0;
      fresh(Object.assign({}, BASE_CFG, { logEnabled: true }), ['suyinKuwo']);
      logs.length = 0;
      fetchFault = () => audio(271);
      await invoke('kw', '128k', SONG(9002), 'v15b');
      const on = logs.filter(l => !l.includes('已加载')).length;
      rec('V15a', off === 0, `logEnabled=false → 聚合音源日志 ${off} 条（必须为 0）${off ? '｜首条=' + firstOff : ''}`);
      rec('V15b', on > 0, `logEnabled=true → 聚合音源日志 ${on} 条（必须 >0，否则 V15a 恒真）`);
    } finally {
      console.log = origLog;
    }
  }

  // ============ V16 raceBatchSize：批大小必须真改变并发节奏 ============
  // 判据不看"外呼总数"（两种批大小都会把所有源试一遍），而是看**取链请求的时间间隔**：
  // batchSize=1 → 下一个源必须等前一个 settle 才发出（间隔大）；batchSize>=3 → 几乎同时发出（间隔≈0）。
  console.log('\n[V16] raceBatchSize：1 = 串行，3 = 并发');
  {
    const runBatch = async (bs, tag) => {
      fresh(Object.assign({}, BASE_CFG, {
        raceBatchSize: bs, raceBatchStaggerMs: 0, raceMatchWaitMs: 0,
        raceBudgetMs: 1500, raceBudgetPerQuality: 1500, breakerThreshold: 100,
      }), ['suyinKuwo', 'helloworldKw', 'kuwoOfficial']);
      const stamps = [];
      let n = 0;
      fetchFault = (u) => {
        if (!/audio\.test/.test(u)) stamps.push(Date.now());   // 只统计取链阶段，排除验真阶段
        n++;
        if (n === 1) return { statusCode: 500, headers: {}, body: 'boom' };  // 首个源失败，逼出下一个
        return audio(271);
      };
      await invoke('kw', '128k', SONG(9100 + bs), tag);
      return stamps;
    };
    const s1 = await runBatch(1, 'v16a');
    const s3 = await runBatch(3, 'v16b');
    const gap = (arr) => (arr.length >= 2 ? arr[1] - arr[0] : -1);
    rec('V16a', s1.length >= 2 && gap(s1) >= 8, `batchSize=1 → 前两次取链间隔 ${gap(s1)}ms（应 >=8，串行）`); // 阈值 20→8：调度抖动会让 20ms 边界偶发假红
    rec('V16b', s3.length >= 2 && gap(s3) < 20, `batchSize=3 → 前两次取链间隔 ${gap(s3)}ms（应 <20，并发）`);
  }

  // ============ V17 qualityShortCircuitProbeMs：短路判据的三条语义 ============
  // 端到端测不通：外呼层叠了「播放摘除(PLAY_DEAD_STREAK=3 硬编码)」「源级冷却」「失败缓存」三层，
  // 而且 500 属业务失败不计入短路统计 —— 七轮尝试里 V17a/V17b 的所有"红/绿"都与短路无关（详见 AUDIT_RESULTS §21）。
  // 因此改用只读钩子 __debug 直接验证判据本身，这也是本仓第一个测试钩子。
  console.log('\n[V17] qualityShortCircuitProbeMs：达标短路 / 到期放行 / 放行后重新短路');
  {
    const m = fresh(Object.assign({}, BASE_CFG, {
      qualityShortCircuitSamples: 3, qualityShortCircuitProbeMs: 60,
    }), ['suyinKuwo']);
    const dbg = m.__debug;
    // 造出「该源该档 3 次失败、0 次成功」的达标状态
    const br = m.getBreaker('suyinKuwo');
    br.byQuality = { flac: { fail: 3, success: 0 } };
    const KEY = dbg.qualityShortCircuitKey('suyinKuwo', 'flac');

    rec('V17a', dbg.isQualityHopeless('suyinKuwo', 'flac') === true,
      'fail=3/success=0 首次达标 → 判定短路（true）');
    dbg.qualitySkipProbeAt.set(KEY, Date.now() - 1);           // 强制到期
    rec('V17b', dbg.isQualityHopeless('suyinKuwo', 'flac') === false,
      'probeMs 到期 → 放行一次（false，不再跳过该档）');
    rec('V17c', dbg.isQualityHopeless('suyinKuwo', 'flac') === true,
      '放行时已重置计时 → 下一次立刻重新短路（true）');
40    // 未达标不短路（防止把"只失败 2 次"的源误摘）
    br.byQuality = { flac: { fail: 2, success: 0 } };
    dbg.qualitySkipProbeAt.delete(KEY);
    rec('V17d', dbg.isQualityHopeless('suyinKuwo', 'flac') === false,
      'fail=2 < samples=3 → 不短路（false）');
  }

  // ============ V18 冷启动预热三键 ============
  // huibq 是唯一的 coldStart 源（onrender 免费实例冷态 30s+），首次进链时后台预热。
  // 预热请求的 URL 固定带 /url/kw/228908/（预热素材歌号），可与主请求精确区分后计数。
  console.log('\n[V18] 冷启动预热：开关要真生效，TTL 要真决定是否重预热');
  {
    const WARM = '/url/kw/228908';
    const WARM_TIMEOUT = 4321; // 唯一冷启动超时，用来把预热外呼与同 URL 的健康探针分开计数
    const mk = (over) => Object.assign({}, BASE_CFG, {
      failCacheNotFoundMs: 1, failCacheExpiredMs: 1, allFailShortTtlMs: 1, breakerThreshold: 100,
      coldStartTimeoutMs: WARM_TIMEOUT,
    }, over);
    const setup = (over) => {
      const m = fresh(mk(over), ['huibq']);
      fetchFault = (u) => (/onrender/.test(u)
        ? { statusCode: 500, headers: {}, body: 'cold' }   // 预热目标恒冷（onrender 冷态失败）
        : audio(271));
      return m;
    };
    // 预热是后台异步：固定 sleep 在负载下必然偶发（V18c 曾多次假红）。
    // 改为「等到调用计数连续 3 次采样不变」再取值。
    const warmCalls = () => callsOfTimeout(WARM, WARM_TIMEOUT);
    const settle = async (getter, budget = 2500) => {
      let last = getter(), same = 0;
      const t0 = Date.now();
      while (Date.now() - t0 < budget) {
        await sleep(25);
        const cur = getter();
        if (cur === last) { if (++same >= 3) return cur; } else { last = cur; same = 0; }
      }
      return getter();
    };

    setup({ coldStartWarmEnabled: false });
    await invoke('kw', '128k', SONG(9301), 'v18a');
    const w0 = await settle(warmCalls);

    const mB = setup({ coldStartWarmEnabled: true, coldStartWarmTtlMs: 600000 });
    await invoke('kw', '128k', SONG(9302), 'v18b');
    const w1 = await settle(warmCalls);
    // 回归：健康探针打的是同一个 /url/kw/228908/128k（与预热同 URL），必须不能算进预热次数。
    // 这里主动插一次探针，复现 CI 上「巡检首轮 60s 延迟刚好落进 V18 窗口」的污染。
    await mB.__debug.probeSingleSource('huibq', mB.buildProbeConfig().huibq);
    await invoke('kw', '128k', SONG(9303), 'v18c1');   // TTL 内再请求
    const w2 = await settle(warmCalls);

    setup({ coldStartWarmEnabled: true, coldStartWarmTtlMs: 5 });
    await invoke('kw', '128k', SONG(9304), 'v18d1');
    const w3 = await settle(warmCalls);
    await invoke('kw', '128k', SONG(9305), 'v18d2');   // TTL 已过期
    const w4 = await settle(warmCalls);

    rec('V18a', w0 === 0, `coldStartWarmEnabled=false → 预热外呼 ${w0} 次（应 0）`);
    rec('V18b', w1 >= 1, `coldStartWarmEnabled=true → 预热外呼 ${w1} 次（应 >=1，否则 V18a 恒真）`);
    rec('V18c', w2 === w1, `coldStartWarmTtlMs=600s 内再请求 → 预热仍 ${w2} 次（应不重复预热）`);
    rec('V18d', w4 > w3, `coldStartWarmTtlMs=5ms 过期后再请求 → 预热 ${w3}→${w4}（应重预热）`);
  }

  // ============ V19 coldStartProbeTimeoutMs：冷启动源的探针超时要真放宽 ============
  // 该键只在 probeSingleSource 里生效（h.coldStart 分支），点歌链路拿不到入口；
  // 用同一个只读钩子直接调单源探针，用「请求挂起 1s」量出实际放弃耗时。
  console.log('\n[V19] coldStartProbeTimeoutMs：冷启动源的探针超时必须按该键放宽');
  {
    const measure = async (timeoutCfg) => {
      const m = fresh(Object.assign({}, BASE_CFG, { coldStartProbeTimeoutMs: timeoutCfg }), ['huibq']);
      fetchFault = () => ({ delay: 1000 });   // 请求挂起 1s（超过任何合理超时）
      const t0 = Date.now();
      await m.__debug.probeSingleSource('huibq', { url: 'https://probe.test/x', check: () => true });
      return Date.now() - t0;
    };
    const tFast = await measure(50);
    const tSlow = await measure(800);
    rec('V19a', tFast < 300, `coldStartProbeTimeoutMs=50 → 探针 ${tFast}ms 放弃（应 <300，证明确实读了该键）`);
    // 用相对比较：若该键被写死成固定值，两条耗时会趋同（实测固定 6000 时都是 1000ms），V19b 必红
    rec('V19b', tSlow > tFast * 3 && tSlow > 600, `coldStartProbeTimeoutMs=800 → 探针 ${tSlow}ms 才放弃（应远大于 ${tFast}ms，证明该键真的可配）`);
  }

  // ============ V20 缓存命中的音质标签必须回填真实档（T33） ============
  // 历史脏条目：修复前按"请求档"写缓存槽，请求 flac 实给 128k 时这条 128k 被存进 flac 槽。
  // 旧实现命中后直接信 cached.quality，于是把 128k 标成 FLAC，直到 6h TTL 到期。
  console.log('\n[V20] 缓存命中回填真实音质：脏缓存不能继续说谎');
  {
    const mp3128 = (sec) => {
      const b = Buffer.alloc(64);
      b[0] = 0xFF; b[1] = 0xFB; b[2] = 0x90; b[3] = 0x64;
      b.write('Xing', 36, 'ascii'); b.writeUInt32BE(1, 40);
      b.writeUInt32BE(Math.round((sec * 44100) / 1152), 44);
      return b;
    };
    const m = fresh(Object.assign({}, BASE_CFG, { verifyOnCacheHit: true }), ['kuwoOfficial']);
    const S = SONG(9431);
    const dirtyUrl = 'https://cdn.test/audio.test/dirty-128.mp3';
    // 脏条目：flac 槽里存 128k 的内容，quality 却记成 flac
    m.__debug.setCachedUrl(m.__debug.buildCacheKey('kw', S, 'flac'), dirtyUrl, 'flac', 'kuwoOfficial');
    probeFault = () => audio(mp3128(269.7), 'audio/mpeg', 4315200);
    fetchFault = () => { throw new Error('脏缓存命中后不应再外呼'); };
    const r = await m.getUrlWithFallback('kw', S, 'flac');
    rec('V20a', !!(r && r.url === dirtyUrl), `命中脏缓存（不走外呼），实得 url=${r && r.url ? 'ok' : '空'}`);
    rec('V20b', !!(r && r.type === '128k'), `槽位=flac 但内容=128k → type 必须回填成 128k，实得 ${r && r.type}`);
  }

  // ============ V21 D-31：兜底档丢 singer 的实际后果（先把证据跑出来，再决定改不改） ============
  // buildSearchKeywords 产三级关键词，末级 strict=false 只用歌名搜；suyinKuwoGetUrl 到该级时
  // 传给 songInfoMatch 的是 { name, duration } —— songInfo.singer 为空，L1491 的歌手校验整条跳过。
  console.log('\n[V21] 兜底档丢 singer：同名同时长不同歌手会不会被放行');
  {
    const m = fresh(Object.assign({}, BASE_CFG), ['suyinKuwo']);
    const dbg = m.__debug;
    const GOOD21 = { name: '晴天', singer: '周杰伦', duration: 271000 };
    // 搜索接口返回：同名、同时长、但歌手是别人
    const wrongReply = {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: '音乐链接：https://cdn.test/audio.test/w21.mp3\n歌名：晴天\n歌手：李四\n时长：271' }),
    };
    fetchFault = () => wrongReply;

    let strictThrew = null;
    try { await dbg.suyinKuwoSearch('晴天周杰伦', 1, GOOD21); } catch (e) { strictThrew = e; }
    rec('V21a', !!(strictThrew && String(strictThrew.message).includes(CODES().MISMATCH)),
      `严格档（带歌手）遇错歌手 → 抛 MISMATCH，实得 ${strictThrew ? strictThrew.message.slice(0, 30) : '未抛'}`);

    let looseUrl = null, looseErr = null;
    try { looseUrl = await dbg.suyinKuwoSearch('晴天', 1, { name: GOOD21.name, duration: GOOD21.duration }); }
    catch (e) { looseErr = e; }
    rec('V21b', !!looseUrl,
      `兜底档（只带 name+duration）遇同一错歌手 → ${looseUrl ? '放行并交付该链接（会播出错歌）' : '拒绝(' + String(looseErr && looseErr.message).slice(0, 24) + ')'}`);

    // V21c：放行可以，但必须留下可定位的痕迹——运行期断言「日志真的落到了 stdout」。
    // 注意：safeConsole.log 是加载期 console.log.bind(console)，patch console.log 抓不到（已踩坑）；
    // 但 bind 的原函数仍写 stdout，故改为捕获 process.stdout.write。
    // 用全新歌名 + 动态回显，确保走真实解析而不是缓存命中。
    const NM = '晴天晚风';
    fetchFault2 = () => ({
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: `音乐链接：https://cdn.test/audio.test/w21c.mp3\n歌名：${NM}\n歌手：李四\n时长：271` }),
    });
    fetchFault = fetchFault2;
    const chunks = [];
    const origWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk, ...rest) => { chunks.push(String(chunk)); return origWrite(chunk, ...rest); };
    let gotUrl = null;
    try { gotUrl = await dbg.suyinKuwoGetUrl({ name: NM, singer: '周杰伦', duration: 271000 }, '128k'); }
    catch (e) { /* 交付失败不影响本断言 */ }
    process.stdout.write = origWrite;
    const hitLog = chunks.filter((x) => x.includes('歌手未校验')).length;
    rec('V21c', gotUrl && hitLog > 0,
      `兜底档放行必须真落「歌手未校验」日志到 stdout，实得 ${gotUrl ? '已交付' : '未交付'} / 日志 ${hitLog} 条`);
  }

  // ============ V22 全部源失败 → 过期缓存兜底（D-32） ============
  console.log('\n[V22] 过期缓存兜底：全部失败时是否真能返回过期缓存');
  {
    const m = fresh(Object.assign({}, BASE_CFG, { cacheTtlMs: 120, cacheTtlHighQualityMs: 120, verifyOnCacheHit: false }), ['suyinKuwo']);
    const S22 = { name: '晴天', singer: '周杰伦', duration: 269700 };
    fetchFault = () => ({ statusCode: 200, headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: `音乐链接：https://cdn.test/audio.test/v22.mp3\n歌名：晴天\n歌手：周杰伦\n时长：269.7` }) });
    const r1 = await m.getUrlWithFallback('kw', S22, '128k');
    const q1 = String(r1.type || '').toLowerCase();
    await new Promise((res) => setTimeout(res, 400));
    fetchFault = () => ({ error: 'ECONNRESET' });
    let r2 = null, err2 = null;
    try { r2 = await m.getUrlWithFallback('kw', S22, '128k'); } catch (e) { err2 = e; }
    rec('V22a', !!(r1 && r1.url), `首次交付成功(${q1} = ${(r1 && r1.url || '').slice(-10)})`);
    rec('V22b', !!(r2 && r2.url === r1.url),
      `全部失败应返回过期缓存(${q1})，实得 ${r2 ? '返回 ' + String(r2.type) : '抛错 ' + String(err2 && err2.code)}`);
  }

  // ============ V23 isPreviewFragmentUrl 预过滤（L1473/L1811，默认关闭→整函数从未执行） ============
  console.log('\n[V23] previewUrlPreFilter 差分：同一构造、只切开关');
  {
    const S23 = { name: '晴天', singer: '周杰伦', duration: 269700, rid: '228908' };
    const mk = async (preFilter) => {
      const m = fresh(Object.assign({}, BASE_CFG, { previewUrlPreFilter: preFilter }), ['helloworldKw']);
      fetchFault = (u) => u.includes('mobi.s')
        ? { statusCode: 200, headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ code: 200, data: { url: 'https://cdn.test/audio.test/preview-30s.mp3', format: 'mp3' } }) }
        : { statusCode: 200, headers: { 'content-type': 'application/json' }, body: '{}' };
      probeFault = () => audio(flac(269.7), 'audio/flac', 55397039);
      try { return { r: await m.getUrlWithFallback('kw', S23, '128k') }; }
      catch (e) { return { err: e }; }
    };
    const a = await mk(false);   // 默认关闭：放行
    const b = await mk(true);    // 打开：拦下
    rec('V23a', !!(a.r && String(a.r.url).includes('preview-30s')),
      `previewUrlPreFilter=false 应放行试听URL，实得 ${a.r ? '放行' : '拦下 ' + String(a.err && a.err.code)}`);
    rec('V23b', !(b.r && String(b.r.url).includes('preview-30s')),
      `previewUrlPreFilter=true 应拦下试听URL，实得 ${b.r ? '仍放行(预过滤失效)' : '拦下 ' + String(b.err && b.err.code)}`);
  }

  // ============ V24 健康巡检（applyProbeResult L508-566 + runHealthCheck L572-626） ============
  console.log('\n[V24] 健康巡检：自动关闭/自动启用/冷启动豁免/熔断复位/休眠/历史快照');
  {
    const m = fresh({}, null);
    const T = m.runtimeToggles, P = m.probeState, idA = 'suyinKuwo';

    T[idA] = true; P.failCount[idA] = 0;
    m.applyProbeResult(idA, false);
    rec('V24a', T[idA] === true, `失败1次不应关闭(实测 ${T[idA]})`);
    m.applyProbeResult(idA, false);
    rec('V24b', T[idA] === false, `连续失败2次应自动关闭(实测 ${T[idA]})`);

    P.passCount[idA] = 0;
    m.applyProbeResult(idA, true);
    rec('V24c', T[idA] === false, `仅通过1次不应启用(实测 ${T[idA]})`);
    m.applyProbeResult(idA, true);
    rec('V24d', T[idA] === true, `连续通过2次应自动启用(实测 ${T[idA]})`);

    const idC = 'huibq';
    T[idC] = true; P.failCount[idC] = 0;
    m.applyProbeResult(idC, false); m.applyProbeResult(idC, false);
    rec('V24e', T[idC] === true, `冷启动源失败2次应保留启用(实测 ${T[idC]})`);

    for (let i = 0; i < 3; i++) m.recordFailure(idA, '128k');
    const st1 = m.getBreaker(idA).state;
    m.applyProbeResult(idA, true);
    const st2 = m.getBreaker(idA).state;
    rec('V24f', st1 === 'open' && st2 === 'closed', `探测通过应复位熔断(实测 ${st1}→${st2})`);

    P.deadCount[idA] = 0; P.sleeping[idA] = false;
    for (let i = 0; i < 3; i++) m.applyProbeResult(idA, false);
    rec('V24g', P.sleeping[idA] === true, `连续3轮失败应进入休眠(实测 ${P.sleeping[idA]})`);

    const h0 = m.__debug.healthHistory.length;
    await m.__debug.runHealthCheck();
    rec('V24h', m.__debug.healthHistory.length === h0 + 1, `巡检应写1条历史快照(${h0}→${m.__debug.healthHistory.length})`);
    rec('V24i', P.running === false, `巡检结束应释放 running 锁(实测 ${P.running})`);

    const h1 = m.__debug.healthHistory.length;
    await m.__debug.runHealthCheck(false);
    rec('V24j', m.__debug.healthHistory.length === h1, `saveHistory=false 不应写历史(${h1}→${m.__debug.healthHistory.length})`);
  }

  // ============ V25 半开试探被本地节流拦下 → 退回熔断（L2605-2616） ============
  console.log('\n[V25] 半开试探被本地节流拦下应退回 open（不得卡在 half-open）');
  {
    const m = fresh(Object.assign({}, BASE_CFG, { rateWindowMax: 1, rateWindowMs: 3000, breakerCooldownMs: 1 }), ['suyinKuwo']);
    const S25 = { name: '晴天', singer: '周杰伦', duration: 269700 };
    // 第 1 次正常请求：占满 rateWindowMax=1 的窗口
    const ok1 = await m.getUrlWithFallback('kw', S25, '128k');
    rec('V25a', !!(ok1 && ok1.url), '首请求成功（占满限流窗口）');
    // 造半开且冷却已过 → canExecute 会放行一次试探
    const b = m.getBreaker('suyinKuwo');
    b.state = 'half-open'; b.lastFailureTime = Date.now() - 1000;
    // 第 2 次：被本地节流拦下 → 应退回 open
    // D-36 后同歌同档会命中缓存、绕过 throttleCheck；用不同歌曲确保真的走到节流分支
    const S25b = { name: '七里香', singer: '周杰伦', duration: 299000 };
    try { await m.getUrlWithFallback('kw', S25b, '128k'); } catch (e) { /* 期望失败 */ }
    rec('V25b', b.state === 'open', `半开被节流拦下应退回 open，实测 ${b.state}`);

    // V25c：覆盖「节流处」的托底（V25b 直接把 state 设成 half-open，
    // canExecute 对 half-open 恒 false → 实际只走到熔断处；这里从 open 出发让 canExecute 自己置 half-open）
    const b2 = m.getBreaker('suyinKuwo');
    b2.state = 'open';
    b2.lastFailureTime = Date.now() - 500;   // 冷却已过（breakerCooldownMs=1）
    const S25c = { name: '夜曲', singer: '周杰伦', duration: 227000 };
    try { await m.getUrlWithFallback('kw', S25c, '128k'); } catch (e) { /* 期望失败 */ }
    rec('V25c', b2.state === 'open', `open→放行试探→节流拦下，应退回 open，实测 ${b2.state}`);
  }

  // ============ R5-A1 配置键真生效：验真族（verifyDelivery/truthfulQuality/阈值） ============
  console.log('\n[V26] 配置键真生效：验真族');
  {
    const S26 = { name: '晴天', singer: '周杰伦', duration: 269700 };
    const fragAudio = () => audio(flac(5), 'audio/flac', 55397039);   // 5 秒 = 片段
    const okJSON = () => ({ statusCode: 200, headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: `音乐链接：https://cdn.test/audio.test/v26.mp3\n歌名：晴天\n歌手：周杰伦\n时长：269.7` }) });
    const run26 = async (cfg) => {
      const m = fresh(Object.assign({}, BASE_CFG, cfg), ['suyinKuwo']);
      fetchFault = okJSON; probeFault = fragAudio;
      try { return { r: await m.getUrlWithFallback('kw', S26, '128k') }; } catch (e) { return { err: e }; }
    };

    // verifyDelivery：开 → 拒片段；关 → 不验真直接放行
    const on = await run26({ verifyDelivery: true });
    rec('V26a', !!(on.err && String(on.err.code) === 'PREVIEW_FRAGMENT'),
      `verifyDelivery=true 应拒 5 秒片段，实测 ${on.r ? '放行(失效)' : String(on.err && on.err.code)}`);
    const off = await run26({ verifyDelivery: false });
    rec('V26b', !!(off.r && off.r.url),
      `verifyDelivery=false 应不验真直接放行，实测 ${off.r ? '放行' : '仍拒绝 ' + String(off.err && off.err.code)}`);

    // truthfulQuality：真 → 标真实档；假 → 标请求档
    const trueQ = await run26({ truthfulQuality: true, verifyDelivery: true, verifyMinOriginalSec: 1, verifyDurRatio: 0, verifyDurGapSec: 0 });
    const fakeQ = await run26({ truthfulQuality: false, verifyDelivery: true, verifyMinOriginalSec: 1, verifyDurRatio: 0, verifyDurGapSec: 0 });
    rec('V26c', !!(trueQ.r && String(trueQ.r.type).toLowerCase() !== '128k'),
      `truthfulQuality=true 应回填真实音质(非请求档128k)，实测 ${trueQ.r ? trueQ.r.type : '失败'}`);
    rec('V26d', !!(fakeQ.r && String(fakeQ.r.type).toLowerCase() === '128k'),
      `truthfulQuality=false 应标请求档 128k，实测 ${fakeQ.r ? fakeQ.r.type : '失败'}`);

    // verifyMinOriginalSec / verifyDurGapSec：阈值放宽后同一片段应被放行
    const strict = await run26({ verifyDelivery: true, verifyMinOriginalSec: 90, verifyDurRatio: 0.6, verifyDurGapSec: 15 });
    // L1315 是 AND：`ratio < verifyDurRatio && gap > verifyDurGapSec` 同时成立才判片段。
    // 因此 verifyDurGapSec=0 的语义是「任何绝对差都拒」（最严），不是「不设限」；
    // 想放宽必须把 gap 放到比实际差值更大（这里差 264s，取 300）。
    // 用 ratio=0.6（比例判据成立）+ gap=300（差异判据不成立）→ 只由 gap 决定放行，该键才被单独钉住。
    // （若 gap 用 0，MU18 退回 || 时 V26f 仍绿 —— 这正是全量变异跑出 MU18 存活的原因。）
    const loose = await run26({ verifyDelivery: true, verifyMinOriginalSec: 1, verifyDurRatio: 0.6, verifyDurGapSec: 300 });
    rec('V26e', !!(strict.err && String(strict.err.code) === 'PREVIEW_FRAGMENT'), `阈值收紧应拒片段，实测 ${strict.r ? '放行(失效)' : String(strict.err && strict.err.code)}`);
    rec('V26f', !!(loose.r && loose.r.url), `阈值放宽应放行同一片段，实测 ${loose.r ? '放行' : '仍拒绝 ' + String(loose.err && loose.err.code)}`);
  }

  // ============ R5-B 源专属错误分支与参数校验 ============
  console.log('\n[V27] 源专属错误码：410/片段/搜索无结果/平台与ID校验');
  {
    const S27 = { name: '晴天', singer: '周杰伦', duration: 269700, hash: 'H27ABC' };

    // 410 → LINK_EXPIRED（helloworld 通道①签名直链失效）
    const m1 = fresh(Object.assign({}, BASE_CFG), ['helloworldKw']);
    fetchFault = (u) => u.includes('mobi.s')
      ? { statusCode: 410, headers: {}, body: 'gone' }
      : { statusCode: 200, headers: {}, body: '{}' };
    try { await m1.getUrlWithFallback('kw', S27, '128k'); } catch (e) { var e1 = e; }
    rec('V27a', !!(e1 && String(e1.code) === 'LINK_EXPIRED'), `410 应归为 LINK_EXPIRED，实测 ${e1 && e1.code}`);

    // 搜索无结果 → NOT_FOUND
    const m2 = fresh(Object.assign({}, BASE_CFG), ['kuwoOfficial']);
    fetchFault = () => ({ statusCode: 200, headers: {}, body: JSON.stringify({ code: 200, data: { total: '0', list: [] } }) });
    try { await m2.getUrlWithFallback('kw', { name: '不存在的歌XZ', singer: '查无此人', duration: 1 }, '128k'); } catch (e) { var e2 = e; }
    rec('V27b', !!(e2 && String(e2.code) === 'NOT_FOUND'), `搜索无结果应归为 NOT_FOUND，实测 ${e2 && e2.code}`);

    // 说明：ikun 内的「非 kw/wy → PARAM_ERROR」对外不可达（它只注册在 kw/wy，平台不匹配时整源不进链），
    // 故不写该断言——避免空转断言。

    // 缺 ID：wy 官方无 id
    const m4 = fresh(Object.assign({}, BASE_CFG), ['wyOuter']);
    try { const r4 = await m4.getUrlWithFallback('wy', { name: '晴天', singer: '周杰伦', duration: 269700 }, '128k'); var r4ok = r4; } catch (e) { var e4 = e; }
    rec('V27d', !!(e4 && String(e4.code) === 'PARAM_ERROR'), `wy 官方缺 ID 应 PARAM_ERROR，实测 ${e4 ? e4.code : '未报错(返回' + (r4ok && r4ok.url) + ')'}`);
  }

  // ============ R5-C 音频格式嗅探（ogg/m4a/wav/播放列表/html/空体） ============
  console.log('\n[V28] 格式嗅探：非 mp3 三格式 + 文本类判死');
  {
    const S28 = { name: '晴天', singer: '周杰伦', duration: 269700 };
    const okJSON28 = () => ({ statusCode: 200, headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: `音乐链接：https://cdn.test/audio.test/v28.bin\n歌名：晴天\n歌手：周杰伦\n时长：269.7` }) });
    const run28 = async (audioResp) => {
      const m = fresh(Object.assign({}, BASE_CFG, { verifyDelivery: true }), ['suyinKuwo']);
      fetchFault = okJSON28; probeFault = audioResp;
      try { return { r: await m.getUrlWithFallback('kw', S28, '128k') }; } catch (e) { return { err: e }; }
    };
    const oggB = () => { const b = Buffer.alloc(64); b.write('OggS', 0, 'ascii'); return b; };
    const m4aB = () => { const b = Buffer.alloc(64); b.write('ftyp', 4, 'ascii'); return b; };
    const wavB = () => { const b = Buffer.alloc(64); b.write('RIFF', 0, 'ascii'); return b; };
    const m3uB = () => { const b = Buffer.from('#EXTM3U\n#EXTINF:10,\nhttp://x/a.mp3\n'); return b; };
    const htmlB = () => Buffer.from('<html><body>404</body></html>');
    const emptyB = () => Buffer.from('');

    const rA = await run28(() => audio(oggB(), 'audio/ogg', 55397039));
    rec('V28a', !!(rA.r && rA.r.url), `OggS 应识别为音频可交付，实测 ${rA.r ? '通过' : String(rA.err && rA.err.code)}`);
    const rB = await run28(() => audio(m4aB(), 'audio/mp4', 55397039));
    rec('V28b', !!(rB.r && rB.r.url), `ftyp(m4a) 应识别为音频可交付，实测 ${rB.r ? '通过' : String(rB.err && rB.err.code)}`);
    const rC = await run28(() => audio(wavB(), 'audio/wav', 55397039));
    rec('V28c', !!(rC.r && rC.r.url), `RIFF(wav) 应识别为音频可交付，实测 ${rC.r ? '通过' : String(rC.err && rC.err.code)}`);
    const rD = await run28(() => audio(m3uB(), 'audio/mpegurl', 64));
    rec('V28d', !!(rD.err && String(rD.err.code) === 'STREAM_PLAYLIST'), `#EXTM3U 应判 STREAM_PLAYLIST，实测 ${rD.r ? '放行(失效)' : String(rD.err && rD.err.code)}`);
    const rE = await run28(() => audio(htmlB(), 'text/html', 64));
    rec('V28e', !!(rE.err && String(rE.err.code) === 'NOT_AUDIO'), `<html> 应判 NOT_AUDIO，实测 ${rE.r ? '放行(失效)' : String(rE.err && rE.err.code)}`);
    const rF = await run28(() => ({ statusCode: 206, headers: { 'content-range': 'bytes 0-0/0', 'content-type': 'audio/mpeg' }, body: emptyB() }));
    rec('V28f', !!(rF.err && String(rF.err.code) === 'NOT_AUDIO'), `0 字节空体应判 NOT_AUDIO(不可播)，实测 ${rF.r ? '放行(失效)' : String(rF.err && rF.err.code)}`);

    // MP3 无 Xing 头（VBR 缺 Xing/Info）→ 应回退用帧头码率估算，不能因缺 Xing 判成非音频
    const mp3NoXing = () => {
      const b = Buffer.alloc(64);
      b[0] = 0xFF; b[1] = 0xFB; b[2] = 0x90; b[3] = 0x64;   // 128k 帧头，故意不写 Xing
      return b;
    };
    const rG = await run28(() => audio(mp3NoXing(), 'audio/mpeg', 4315200));
    rec('V28g', !!(rG.r && rG.r.url), `MP3 无 Xing 头应回退帧头估算仍可交付，实测 ${rG.r ? '通过' : String(rG.err && rG.err.code)}`);

    // 时长 mm:ss 解析：4:29 与 269 应等效（都判 5 秒音频为片段），证明 mm:ss 被正确解析
    const run28t = async (durText) => {
      const m = fresh(Object.assign({}, BASE_CFG, { verifyDelivery: true }), ['suyinKuwo']);
      fetchFault = () => ({ statusCode: 200, headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: `音乐链接：https://cdn.test/audio.test/v28t.mp3\n歌名：晴天\n歌手：周杰伦\n时长：${durText}` }) });
      probeFault = () => audio(flac(5), 'audio/flac', 55397039);
      try { return { r: await m.getUrlWithFallback('kw', S28, '128k') }; } catch (e) { return { err: e }; }
    };
    const bySec = await run28t('269');
    const byMMSS = await run28t('4:29');
    rec('V28h', !!(bySec.err && String(bySec.err.code) === 'PREVIEW_FRAGMENT'), `秒数 269 应判片段，实测 ${bySec.r ? '放行' : String(bySec.err && bySec.err.code)}`);
    rec('V28i', !!(byMMSS.err && String(byMMSS.err.code) === 'PREVIEW_FRAGMENT'), `mm:ss 4:29 应等效判片段（证明时长解析生效），实测 ${byMMSS.r ? '放行(解析失败)' : String(byMMSS.err && byMMSS.err.code)}`);
  }

  // ============ R5-D 缓存命中复验（verifyOnCacheHit 开/关差分） ============
  console.log('\n[V29] 缓存命中的入参校验：脏缓存该不该被复验');
  {
    const S29 = { name: '晴天', singer: '周杰伦', duration: 269700 };
    const okJSON29 = () => ({ statusCode: 200, headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: `音乐链接：https://cdn.test/audio.test/v29.mp3\n歌名：晴天\n歌手：周杰伦\n时长：269.7` }) });

    // 用 128k 真实交付（实交付档=请求档），确保命中写回的槽位就是 128k
    // 注意：mp3128 是别处的局部 helper，此处自建同名构造，避免 ReferenceError 被包装成网络错误
    const mp3_128 = (sec) => {
      const b = Buffer.alloc(64);
      b[0] = 0xFF; b[1] = 0xFB; b[2] = 0x90; b[3] = 0x64;
      b.write('Xing', 36, 'ascii');
      b.writeUInt32BE(1, 40);
      b.writeUInt32BE(Math.round(sec * 44100 / 1152), 44);
      return b;
    };
    const ok128 = () => audio(mp3_128(269.7), 'audio/mpeg', 4315200);
    // verifyOnCacheHit=false：命中不复验 → 脏缓存照样交付
    const mA = fresh(Object.assign({}, BASE_CFG, { verifyOnCacheHit: false, cacheTtlMs: 600000, cacheTtlHighQualityMs: 600000 }), ['suyinKuwo']);
    fetchFault = okJSON29; probeFault = ok128;
    await mA.getUrlWithFallback('kw', S29, '128k');
    probeFault = () => audio(mp3_128(5), 'audio/mpeg', 4315200);   // 缓存变"脏"（现在是片段）
    let hitA = null;
    try { hitA = await mA.getUrlWithFallback('kw', S29, '128k'); } catch (e) { hitA = null; }
    rec('V29a', !!(hitA && hitA.url), `verifyOnCacheHit=false 命中应直接交付(不复验)，实测 ${hitA && hitA.url ? '交付' : '被拒'}`);

    // verifyOnCacheHit=true：命中复验 → 片段脏缓存应被拒
    const mB = fresh(Object.assign({}, BASE_CFG, { verifyOnCacheHit: true, cacheTtlMs: 600000, cacheTtlHighQualityMs: 600000 }), ['suyinKuwo']);
    fetchFault = okJSON29; probeFault = ok128;
    await mB.getUrlWithFallback('kw', S29, '128k');
    probeFault = () => audio(mp3_128(5), 'audio/mpeg', 4315200);
    let eB = null;
    try { await mB.getUrlWithFallback('kw', S29, '128k'); } catch (e) { eB = e; }
    rec('V29b', !!(eB && String(eB.code) === 'PREVIEW_FRAGMENT'), `verifyOnCacheHit=true 命中复验应拒片段脏缓存，实测 ${eB ? String(eB.code) : '仍交付(复验失效)'}`);
  }

  // ============ R5-D2 缓存跨档命中（请求档 ≠ 实交付档） ============
  console.log('\n[V30] 缓存命中：请求 128k 实给 flac 时第二次是否命中');
  {
    const S30 = { name: '晴天', singer: '周杰伦', duration: 269700 };
    const okJSON30 = () => ({ statusCode: 200, headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: `音乐链接：https://cdn.test/audio.test/v30.mp3\n歌名：晴天\n歌手：周杰伦\n时长：269.7` }) });
    const totalCalls = () => Object.values(counts).reduce((a, b) => a + b, 0);
    const m = fresh(Object.assign({}, BASE_CFG, { cacheTtlMs: 600000, cacheTtlHighQualityMs: 600000, verifyOnCacheHit: false }), ['suyinKuwo']);
    fetchFault = okJSON30; probeFault = () => audio(flac(269.7), 'audio/flac', 55397039);  // 实交付 flac
    const r1 = await m.getUrlWithFallback('kw', S30, '128k');
    rec('V30a', !!(r1 && r1.url), '首次请求成功（实交付 flac，写入 flac 槽）');
    const n1 = totalCalls();
    const r2 = await m.getUrlWithFallback('kw', S30, '128k');   // 同一请求档再取
    const n2 = totalCalls();
    rec('V30b', n2 === n1, `第二次应命中缓存不再外呼（调用数 ${n1}→${n2}，差 ${n2 - n1}）`);
    rec('V30c', !!(r2 && r2.url), '第二次应成功返回（命中返回缓存 URL）');
  }

  // ============ R5-B2 429 退避链路 ============
  console.log('\n[V31] 429 限流：退避标记 + 退避期内跳过');
  {
    const S31 = { name: '晴天', singer: '周杰伦', duration: 269700, hash: 'H31XYZ' };
    const m = fresh(Object.assign({}, BASE_CFG, { rateLimitBackoffMs: 50 }), ['suyinKuwo']);
    fetchFault = () => ({ statusCode: 429, headers: {}, body: JSON.stringify({ code: 429, msg: 'too many' }) });
    probeFault = () => ({ statusCode: 429, headers: {}, body: 'too many' });
    let e31 = null;
    try { await m.getUrlWithFallback('kw', S31, '128k'); } catch (e) { e31 = e; }
    rec('V31a', !!(e31 && String(e31.code) === 'RATE_LIMIT'), `429 应归 RATE_LIMIT，实测 ${e31 && e31.code}`);
    const b31 = m.getBreaker('suyinKuwo');
    rec('V31b', !!(b31.rateLimited === true || b31.rateLimitUntil > Date.now()),
      `429 应写入退避标记(rateLimited=${b31.rateLimited}, until=${b31.rateLimitUntil > Date.now()})`);
    // 退避期内再请求应被 canExecute 直接跳过（不产生新的上游调用）
    const n1 = Object.values(counts).reduce((a, b) => a + b, 0);
    let e31b = null;
    const S31b = { name: '七里香', singer: '周杰伦', duration: 299000, hash: 'H31QQQ' };
    try { await m.getUrlWithFallback('kw', S31b, '128k'); } catch (e) { e31b = e; }
    const n2 = Object.values(counts).reduce((a, b) => a + b, 0);
    rec('V31c', n2 === n1, `退避期内应直接跳过不再外呼（调用数 ${n1}→${n2}）`);
    rec('V31d', !!(e31b), `退避期内请求应失败（无可用源），实测 ${e31b ? String(e31b.code) : '意外成功'}`);
  }

  // ============ R5-C2 时长格式：mm:ss / hh:mm:ss 是否真的被解析 ============
  console.log('\n[V32] 时长格式解析：响应用 mm:ss 时片段版应照样被拒');
  {
    const S32 = { name: '晴天', singer: '周杰伦', duration: 269700 };   // 269.7 秒
    const run32 = async (durText) => {
      const m = fresh(Object.assign({}, BASE_CFG, { verifyDelivery: false }), ['suyinKuwo']);  // 只测 songInfoMatch，不掺验真
      fetchFault = () => ({ statusCode: 200, headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: `音乐链接：https://cdn.test/audio.test/v32.mp3\n歌名：晴天\n歌手：周杰伦\n时长：${durText}` }) });
      probeFault = () => audio(flac(269.7), 'audio/flac', 55397039);
      try { return { r: await m.getUrlWithFallback('kw', S32, '128k') }; } catch (e) { return { err: e }; }
    };
    // 对照：数字时长 5（秒）→ 与 269.7 差 264s → 应拒绝
    const num = await run32('5');
    rec('V32a', !!(num.err), `数字时长 5 与 269.7 差 264s 应被拒（对照基准），实测 ${num.r ? '放行' : String(num.err.code)}`);
    // mm:ss 时长 0:05（5 秒）→ 应与数字路径等效被拒
    const mmss = await run32('0:05');
    rec('V32b', !!(mmss.err), `mm:ss 0:05 应等效被拒（解析生效），实测 ${mmss.r ? '放行(m:m 未被解析)' : String(mmss.err.code)}`);
    // hh:mm:ss 0:00:05
    const hms = await run32('0:00:05');
    rec('V32c', !!(hms.err), `hh:mm:ss 0:00:05 应等效被拒，实测 ${hms.r ? '放行(未被解析)' : String(hms.err.code)}`);
    // 正例：mm:ss 4:29 与 269.7 差 0.7s → 应放行
    const okMM = await run32('4:29');
    rec('V32d', !!(okMM.r && okMM.r.url), `mm:ss 4:29 与 269.7 相符应放行，实测 ${okMM.r ? '放行' : '误拒 ' + String(okMM.err && okMM.err.code)}`);
  }

  // ============ R5-C3 FLAC 多 STREAMINFO（STREAMINFO 不在首个元数据块） ============
  console.log('\n[V33] FLAC 解析：前置 PADDING 块时仍应找到 STREAMINFO');
  {
    const flacPadded = (sec, sr = 44100) => {
      const b = Buffer.alloc(128);
      b.write('fLaC', 0, 'ascii');
      b[4] = 0x01; b.writeUIntBE(20, 5, 3);          // 块1：PADDING，len=20（非 STREAMINFO）
      const p = 28;                                   // 块2 起点
      b[p] = 0x80; b.writeUIntBE(34, p + 1, 3);       // 块2：STREAMINFO(untyped=0, last=1)，len=34
      const q = p + 4 + 10;
      b[q] = (sr >> 12) & 0xFF;
      b[q + 1] = (sr >> 4) & 0xFF;
      b[q + 2] = ((sr & 0x0F) << 4);
      const total = Math.round(sec * sr);
      b[q + 3] = 0x00;
      b[q + 4] = (total >>> 24) & 0xFF;
      b[q + 5] = (total >>> 16) & 0xFF;
      b[q + 6] = (total >>> 8) & 0xFF;
      b[q + 7] = total & 0xFF;
      return b;
    };
    const S33 = { name: '晴天', singer: '周杰伦', duration: 269700 };
    const run33 = async (audioResp) => {
      const m = fresh(Object.assign({}, BASE_CFG, { verifyDelivery: true }), ['suyinKuwo']);
      fetchFault = () => ({ statusCode: 200, headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: `音乐链接：https://cdn.test/audio.test/v33.flac\n歌名：晴天\n歌手：周杰伦\n时长：269.7` }) });
      probeFault = audioResp;
      try { return { r: await m.getUrlWithFallback('kw', S33, '128k') }; } catch (e) { return { err: e }; }
    };
    const full = await run33(() => audio(flacPadded(269.7), 'audio/flac', 55397039));
    rec('V33a', !!(full.r && full.r.url), `前置 PADDING 的 FLAC(269.7s) 应可交付，实测 ${full.r ? '通过' : String(full.err && full.err.code)}`);
    const frag = await run33(() => audio(flacPadded(5), 'audio/flac', 55397039));
    rec('V33b', !!(frag.err && String(frag.err.code) === 'PREVIEW_FRAGMENT'), `前置 PADDING 的 FLAC(5s) 仍应判片段（证明时长真被解析），实测 ${frag.r ? '放行(解析失败)' : String(frag.err && frag.err.code)}`);
  }

  // ============ R5-A2 短路/失败缓存类配置键 ============
  console.log('\n[V34] allFailShortTtlMs：全失败短缓存期内是否真的不再外呼');
  {
    const S34 = { name: '晴天', singer: '周杰伦', duration: 269700 };
    const m = fresh(Object.assign({}, BASE_CFG, { allFailShortTtlMs: 60000, failCacheExpiredMs: 20, failCacheNotFoundMs: 20 }), ['suyinKuwo']);
    fetchFault = () => ({ error: 'ECONNRESET' });   // 网络类失败 → 全失败
    probeFault = () => ({ error: 'ECONNRESET' });
    let e1 = null;
    try { await m.getUrlWithFallback('kw', S34, '128k'); } catch (e) { e1 = e; }
    rec('V34a', !!(e1), `首次全失败应抛错，实测 ${e1 ? String(e1.code) : '意外成功'}`);
    const n1 = Object.values(counts).reduce((a, b) => a + b, 0);
    let e2 = null;
    try { await m.getUrlWithFallback('kw', S34, '128k'); } catch (e) { e2 = e; }
    const n2 = Object.values(counts).reduce((a, b) => a + b, 0);
    rec('V34b', n2 === n1, `allFailShortTtlMs=60s 内再请求应直接命中失败缓存不再外呼（${n1}→${n2}）`);
    rec('V34c', !!(e2), `短缓存期内仍应失败，实测 ${e2 ? String(e2.code) : '意外成功'}`);

    // 对照：TTL 置 0（不缓存）→ 每次都要重新外呼
    const m2 = fresh(Object.assign({}, BASE_CFG, { allFailShortTtlMs: 0, failCacheExpiredMs: 20, failCacheNotFoundMs: 20 }), ['suyinKuwo']);
    fetchFault = () => ({ error: 'ECONNRESET' });
    probeFault = () => ({ error: 'ECONNRESET' });
    try { await m2.getUrlWithFallback('kw', S34, '128k'); } catch (e) { /* 期望失败 */ }
    const n3 = Object.values(counts).reduce((a, b) => a + b, 0);
    try { await m2.getUrlWithFallback('kw', S34, '128k'); } catch (e) { /* 期望失败 */ }
    const n4 = Object.values(counts).reduce((a, b) => a + b, 0);
    rec('V34d', n4 > n3, `allFailShortTtlMs=0 应不缓存、每次重新外呼（${n3}→${n4}）`);
  }

  // ============ R5-A3 内部键：maxConcurrency / qualityShortCircuitSamples / raceBudgetMs ============
  console.log('\n[V35] 内部键真生效：并发上限、短路样本数、竞速预算');
  {
    const S35 = { name: '晴天', singer: '周杰伦', duration: 269700, hash: 'H35AAA' };
    const ok35 = () => ({ statusCode: 200, headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: `音乐链接：https://cdn.test/audio.test/v35.mp3\n歌名：晴天\n歌手：周杰伦\n时长：269.7` }) });

    // --- maxConcurrency：上限 1 时，第二个并发请求应被本地并发保护拦下 ---
    const slowAudio = () => ({ delay: 400, resp: audio(flac(269.7), 'audio/flac', 55397039) });
    const m1 = fresh(Object.assign({}, BASE_CFG, { maxConcurrency: 1, rateWindowMax: 100000 }), ['suyinKuwo']);
    fetchFault = ok35;
    probeFault = () => ({ delay: 400, statusCode: 206, headers: { 'content-range': 'bytes 0-1023/55397039', 'content-type': 'audio/flac' }, body: flac(269.7) });
    const S35b = { name: '晴天', singer: '周杰伦', duration: 269700, hash: 'H35BBB' };   // 同歌不同 hash：过歌信校验、避开同一缓存槽
    const pA = m1.getUrlWithFallback('kw', S35, '128k').then((r) => ({ ok: true, r })).catch((e) => ({ ok: false, e }));
    await sleep(30);
    const pB = m1.getUrlWithFallback('kw', S35b, '128k').then((r) => ({ ok: true, r })).catch((e) => ({ ok: false, e }));
    const [rA, rB] = await Promise.all([pA, pB]);
    rec('V35a', rA.ok === true, `maxConcurrency=1 时首个请求应成功，实测 ${rA.ok ? '成功' : String(rA.e && rA.e.code)}`);
    rec('V35b', rB.ok === false && String(rB.e && rB.e.code) === 'RATE_LIMIT',
      `并发超限的第二个应被 RATE_LIMIT 拦下，实测 ${rB.ok ? '放行(上限失效)' : String(rB.e && rB.e.code)}`);

    // 对照：上限放到 5 时，同样两个并发请求都应放行 —— 否则说明是「恒拦」而不是该键在起作用
    const m1b = fresh(Object.assign({}, BASE_CFG, { maxConcurrency: 5, rateWindowMax: 100000 }), ['suyinKuwo']);
    fetchFault = ok35;
    probeFault = () => ({ delay: 400, statusCode: 206, headers: { 'content-range': 'bytes 0-1023/55397039', 'content-type': 'audio/flac' }, body: flac(269.7) });
    const pC = m1b.getUrlWithFallback('kw', S35, '128k').then((r) => ({ ok: true })).catch((e) => ({ ok: false, e }));
    await sleep(30);
    const pD = m1b.getUrlWithFallback('kw', S35b, '128k').then((r) => ({ ok: true })).catch((e) => ({ ok: false, e }));
    const [rC, rD] = await Promise.all([pC, pD]);
    rec('V35f', rC.ok === true && rD.ok === true,
      `maxConcurrency=5 时两个并发请求都应放行，实测 ${rC.ok ? 'OK' : String(rC.e && rC.e.code)} / ${rD.ok ? 'OK' : String(rD.e && rD.e.code)}`);

    // --- qualityShortCircuitSamples：样本数决定「几次失败才算该档不可救」 ---
    const m2 = fresh(Object.assign({}, BASE_CFG, { qualityShortCircuit: true, qualityShortCircuitSamples: 2 }), ['suyinKuwo']);
    m2.recordFailure('suyinKuwo', '128k'); m2.recordFailure('suyinKuwo', '128k');
    const hop2 = m2.__debug.isQualityHopeless('suyinKuwo', '128k');   // 签名是 (sourceId, quality)
    const m3 = fresh(Object.assign({}, BASE_CFG, { qualityShortCircuit: true, qualityShortCircuitSamples: 5 }), ['suyinKuwo']);
    m3.recordFailure('suyinKuwo', '128k'); m3.recordFailure('suyinKuwo', '128k');
    const hop5 = m3.__debug.isQualityHopeless('suyinKuwo', '128k');
    rec('V35c', hop2 === true, `samples=2，2 次失败后应判该档不可救，实测 ${hop2}`);
    rec('V35d', hop5 === false, `samples=5，2 次失败后不应判不可救（证明该键生效），实测 ${hop5}`);

    // --- raceBudgetMs：预算大小必须真的决定放弃耗时（相对比较，不用绝对阈值） ---
    const hangAudio = () => ({ delay: 1500, statusCode: 206, headers: { 'content-range': 'bytes 0-1023/55397039', 'content-type': 'audio/flac' }, body: flac(269.7) });
    const timed = async (budget) => {
      const m = fresh(Object.assign({}, BASE_CFG, { raceBudgetMs: budget, raceBudgetFloorMs: 100 }), ['suyinKuwo']);
      fetchFault = ok35;
      probeFault = hangAudio;
      const t0 = Date.now();
      try { await m.getUrlWithFallback('kw', S35, '128k'); } catch (e) { /* 预算耗尽应失败 */ }
      return Date.now() - t0;
    };
    const fast = await timed(300);
    const slowB = await timed(3000);
    rec('V35e', slowB > fast + 200, `预算 300ms 放弃 ${fast}ms，预算 3000ms 放弃 ${slowB}ms（应后者明显更久）`);
  }

  // R5-A4 raceBatchStaggerMs：实测不可观测（三源全失败时总耗时被 matchWaitMs 等固定等待
  // 完全支配，stagger=0 与 300 实测同为 803ms）。该键没有能隔离出来的行为差，
  // 硬留断言只会得到恒真空转 —— 按「不做凑数」处理，已记录在 docs/PROGRESS_round5.md。

  // ============ V37 缓存复验拒绝后，必须重新解析并交付（用注入钩子构造脏条目） ============
  // 不能用「关 verifyDelivery 写脏缓存再开复验」：USER_CONFIG 是加载期固化的常量，
  // 改配置必须重新加载模块，而缓存也是模块级的 —— 重新加载会把缓存一起清空。
  // 改用 __debug.setCachedUrl 直接注入脏条目，绕开这个死锁。
  console.log('\n[V37] 脏缓存被复验拒绝后应重新外呼并交付完整版');
  {
    const S37 = { name: '晴天', singer: '周杰伦', duration: 269700, hash: 'H37AAA' };
    const okJSON37 = () => ({ statusCode: 200, headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: `音乐链接：https://cdn.test/audio.test/v37.mp3\n歌名：晴天\n歌手：周杰伦\n时长：269.7` }) });
    const m = fresh(Object.assign({}, BASE_CFG, { verifyOnCacheHit: true, verifyDelivery: true, cacheTtlMs: 600000 }), ['suyinKuwo']);
    // 注入一条「URL 指向片段、但标着 flac」的历史脏条目
    const dirtyKey = m.__debug.buildCacheKey('kw', S37, 'flac');
    m.__debug.setCachedUrl(dirtyKey, 'https://cdn.test/audio.test/dirty-frag.flac', 'flac', 'suyinKuwo');
    rec('V37a', true, `脏条目已注入 flac 槽（构造前提）`);

    fetchFault = okJSON37;
    // 关键：按 URL 分流——脏条目本身仍是 5 秒片段（复验应拒），新解析出来的 URL 才是完整版。
    // 若一刀切成完整版，复验会直接通过，等于什么都没测（V37c 首轮就是这么假红的）。
    probeFault = (u) => (String(u).includes('dirty-frag')
      ? audio(flac(5), 'audio/flac', 55397039)
      : audio(flac(269.7), 'audio/flac', 55397039));
    const n0 = Object.values(counts).reduce((a, b) => a + b, 0);
    const r37 = await m.getUrlWithFallback('kw', S37, 'flac');
    const n1 = Object.values(counts).reduce((a, b) => a + b, 0);
    rec('V37b', n1 > n0, `脏缓存被复验拒绝后应重新外呼（${n0}→${n1}），否则等于只拒绝不恢复`);
    rec('V37c', !!(r37 && r37.url && !String(r37.url).includes('dirty-frag')),
      `应交付新解析结果而非脏条目，实测 ${r37 ? String(r37.url).slice(-24) : '失败'}`);
  }

  // ============ V38 网易云 VIP / 无版权歌曲：不该报网络错误，该报 NOT_FOUND ============
  // L1641 那条「该歌曲不可试听(可能需VIP)，跳过」此前从未执行过：用户看到的现象是
  // "某首歌怎么点都没声"，而如果它被归一成 NETWORK_ERROR，App 会当成网络抖动去重试。
  console.log('\n[V38] 网易云 VIP 不可试听应判 NOT_FOUND（双边）');
  {
    const S38 = { name: '以父之名', singer: '周杰伦', duration: 200000, id: 'W38AAA' };
    const isWy = (u) => String(u).includes('music.163.com/song/media/outer');
    // ① 非 200 / 非音频 content-type → 必须判 NOT_FOUND，不能滑进网络错误
    const m1 = fresh(Object.assign({}, BASE_CFG, { fragmentFallback: false }), ['wyOuter']);
    fetchFault = (u) => (isWy(u)
      ? { statusCode: 404, headers: { 'content-type': 'application/json' }, body: '' }
      : { error: 'ECONNRESET' });
    let code38 = '';
    try { await m1.getUrlWithFallback('wy', S38, '128k'); } catch (e) { code38 = e.code || ''; }
    rec('V38a', code38 === CODES().NOT_FOUND, `VIP/无版权应判 NOT_FOUND，实测 code=${code38 || '(未抛)'}`);

    // ② 对照：真的给音频时必须能拿到链接（否则"永远 NOT_FOUND"也能让 ① 变绿）
    const m2 = fresh(Object.assign({}, BASE_CFG), ['wyOuter']);
    fetchFault = (u) => (isWy(u)
      ? { statusCode: 200, headers: { 'content-type': 'audio/mpeg', 'content-range': 'bytes 0-1023/55397039' },
          body: flac(200), url: 'https://cdn.test/audio.test/w38.mp3' }
      : { error: 'ECONNRESET' });
    probeFault = () => audio(flac(200), 'audio/flac', 4315200);
    const r38 = await m2.getUrlWithFallback('wy', S38, '128k');
    rec('V38b', !!(r38 && r38.url), `给音频时应能交付（对照），实测 ${r38 ? '交付' : '失败'}`);
  }

  // ============ V39 hh:mm:ss 三段时长：解析失败会让超长曲的片段校验整体失效 ============
  // V32 只覆盖了 mm:ss 两段。三段是 live/古典现场常见格式，若解析成 0，
  // songInfoMatch 的 `if (tDur && rDur && ...)` 直接短路 —— 一段 1 小时的音频只给 60 秒也放行。
  console.log('\n[V39] hh:mm:ss 三段时长应被解析（否则超长曲校验失效）');
  {
    // 关键：**不给 songInfo.duration**，否则走的是数字路径（3900000→3900），
    // hh:mm:ss 的冒号分支根本没执行，断言绿了也是空转。只靠 message 里的「时长：1:05:00」驱动。
    const S39 = { name: '交响曲现场', singer: '某乐团', hash: 'H39AAA' };
    const okJSON39 = () => ({ statusCode: 200, headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: `音乐链接：https://cdn.test/audio.test/v39.mp3\n歌名：交响曲现场\n歌手：某乐团\n时长：1:05:00` }) });
    const m = fresh(Object.assign({}, BASE_CFG, { fragmentFallback: false, verifyMinOriginalSec: 1 }), ['suyinKuwo']);
    fetchFault = okJSON39;
    // 源声称 1 小时，实际只给 60 秒 → 必须判片段
    probeFault = () => audio(flac(60), 'audio/flac', 55397039);
    let code39 = '', out39 = null;
    try { out39 = await m.getUrlWithFallback('kw', S39, 'flac'); } catch (e) { code39 = e.code || ''; }
    // 必须真的拒（或明确降级为试听版）；「放行」不算通过，否则 hh:mm:ss 解析失败也能变绿
    rec('V39a', code39 === CODES().PREVIEW_FRAGMENT || !!(out39 && String(out39.type).includes('试听')),
      `1小时声称 vs 60秒实际必须判片段/标试听版，实测 code=${code39 || '(未抛=放行)'} type=${out39 ? out39.type : '-'}`);

    // 对照：真的给 1 小时 → 必须正常交付（证明上面的拒绝不是因为"永远拒"）
    const m2 = fresh(Object.assign({}, BASE_CFG, { fragmentFallback: false, verifyMinOriginalSec: 1 }), ['suyinKuwo']);
    fetchFault = okJSON39;
    probeFault = () => audio(flac(3900), 'audio/flac', 55397039);
    let code39b = '', out39b = null;
    try { out39b = await m2.getUrlWithFallback('kw', S39, 'flac'); } catch (e) { code39b = e.code || ''; }
    rec('V39b', !!(out39b && out39b.url), `真给 1 小时应交付（对照），实测 code=${code39b || '(正常)'}`);
  }

  console.log(`\n===== V 组汇总：${pass} 通过 / ${fail} 失败 =====`);
  if (fail) console.log('失败编号：', failures.join(', '));
  process.exit(fail === 0 ? 0 : 1);
})();
