/**
 * N 组：通读发现的推断缺陷（F10~F13）的红绿回归
 *
 * 动机：2026-11-10 全仓通读只读代码时推断出 4 处缺陷，当时**没有实测证据**。
 * 本组把每条推断变成一条可跑断言，先确认它真的会红，再修实现——
 * 避免"按读代码的印象改生产逻辑"。
 *
 * N1  F13-a Juhe 返回 code 为字符串 "200" 时应照常交付（旧实现 `d.code === 200` 严格比数字 → 恒失败）
 * N2  F13-b Juhe 303 重定向校验：check.value 是数字 200、响应体 code 是字符串 "200" 时应视为通过
 * N3  F12   buildQualityChain("flac24bit") 必须包含 320k 档（旧实现 push rest[0] 后直接 push 128k → 跳过 320k）
 * N4  F10   未登记 TTL 的失败码（CONFIG_ERROR）应按注释的 5 分钟过期，而不是永不超时
 */
const path = require('path');
const SRC = path.join(__dirname, '..', '..', 'lx-source.js');
const BASE = 'https://audio.test/x.mp3';
const REDIR = 'https://redir.test/r';

const GOOD = { name: '晴天', singer: '周杰伦', duration: 271000, songmid: '228908', hash: 'abcdef', id: 228908 };
const res = [];
const rec = (id, name, ok, detail) => res.push({ id, name, ok, detail });

let handler = null;
let scene = null;

const setLx = () => {
  globalThis.lx = {
    EVENT_NAMES: { inited: 'inited', request: 'request', updateAlert: 'updateAlert' },
    version: '2.0.0',
    env: 'mobile',
    utils: { buffer: { from: (d, e) => Buffer.from(d, e), bufToString: (b, e) => b.toString(e) } },
    request(url, opts, cb) {
      const r = scene(String(url), opts || {});
      setTimeout(() => {
        if (r.error) return cb(Object.assign(new Error(r.error), { code: r.error }), null);
        cb(null, { statusCode: r.statusCode || 200, headers: r.headers || {}, body: r.body ?? '', url: String(url) });
      }, 2);
    },
    on(n, h) { if (n === 'request') handler = h; },
    send() {},
  };
};

const json = (o) => ({ statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });
const okAudio = () => {
  const b = Buffer.alloc(64);
  b.write('fLaC', 0, 'ascii'); b[4] = 0x80; b[7] = 34;
  b[18] = (44100 >> 12) & 0xFF; b[19] = (44100 >> 4) & 0xFF; b[20] = (44100 & 0x0F) << 4;
  const t = Math.round(269.7 * 44100);
  b[21] = Math.floor(t / 4294967296) & 0x0F; b[22] = Math.floor(t / 16777216) & 0xFF;
  b[23] = Math.floor(t / 65536) & 0xFF; b[24] = Math.floor(t / 256) & 0xFF; b[25] = t & 0xFF;
  return { statusCode: 206, headers: { 'content-type': 'audio/flac' }, body: b };
};

const load = (toggles) => {
  setLx();
  globalThis.__lxSourceConfig = Object.assign({}, globalThis.__lxSourceConfig || {}, {
    rateWindowMax: 1e6, maxConcurrency: 1e6, rateWindowMs: 3600000,
    healthCheckIntervalMs: 3600000, breakerThreshold: 999,
    qualityShortCircuit: false, fragmentFallback: false, verifyDelivery: true, raceBudgetMs: 12000
  });
  delete require.cache[require.resolve(SRC)];
  const m = require(SRC);
  for (const k of Object.keys(m.runtimeToggles)) m.runtimeToggles[k] = toggles.includes(k);
  return m;
};
const call = (platform, type, info) => handler({ action: 'musicUrl', source: platform, info: { type, musicInfo: info } });

(async () => {
  const orig = console.log.bind(console);
  const quiet = () => { console.log = () => {}; };

  // ---------- N1 / N2：Juhe code 类型宽松 ----------
  const juheCase = async (code, redirectBody) => {
    load(['juheKw']);
    scene = (u) => {
      if (/audio\.test/.test(u)) return okAudio();
      if (/redir\.test/.test(u)) return json(redirectBody);
      if (/\/kw/.test(u)) {
        return json(code === 'direct'
          ? { code: '200', data: { url: BASE } }
          : {
            code: 303,
            data: {
              request: { url: REDIR, options: { method: 'GET' } },
              response: { check: { key: ['body', 'code'], value: 200 }, url: ['body', 'data', 'url'] }
            }
          });
      }
      return { error: 'ECONNREFUSED' };
    };
    quiet();
    try { return await call('kw', '128k', GOOD); } finally { console.log = orig; }
  };

  try {
    const r1 = await juheCase('direct');
    rec('N1', 'F13-a Juhe code="200"(字符串) 仍交付', !!r1 && r1.url === BASE, JSON.stringify(r1 || {}).slice(0, 120));
  } catch (e) {
    rec('N1', 'F13-a Juhe code="200"(字符串) 仍交付', false, String(e.message).slice(0, 120));
  }

  try {
    const r2 = await juheCase(303, { code: '200', data: { url: BASE } });
    rec('N2', 'F13-b Juhe 303 校验值类型不一致仍通过', !!r2 && r2.url === BASE, JSON.stringify(r2 || {}).slice(0, 120));
  } catch (e) {
    rec('N2', 'F13-b Juhe 303 校验值类型不一致仍通过', false, String(e.message).slice(0, 120));
  }

  // ---------- N3：降档链不得跳过 320k ----------
  const m3 = load([]);
  const dbg = m3.__debug || {};
  if (typeof dbg.buildQualityChain !== 'function') {
    rec('N3', 'F12 flac24bit 起跑保留 320k 档', false, '__debug.buildQualityChain 未导出');
  } else {
    const c1 = dbg.buildQualityChain('flac24bit');
    const c2 = dbg.buildQualityChain('flac');
    const c3 = dbg.buildQualityChain('320k');
    const okc = Array.isArray(c1) && c1.includes('320k') && c1.includes('128k')
      && c2.join(',') === 'flac,320k,128k' && c3.join(',') === '320k,128k';
    rec('N3', 'F12 flac24bit 起跑保留 320k 档', okc, `flac24bit=${c1} flac=${c2} 320k=${c3}`);
  }

  // ---------- N4：未登记 TTL 的失败码按 5 分钟过期 ----------
  const m4 = load([]);
  const d4 = m4.__debug || {};
  if (typeof d4.setFailCached !== 'function' || typeof d4.getFailCachedEntry !== 'function' || !d4.failCache) {
    rec('N4', 'F10 CONFIG_ERROR 失败缓存 5 分钟过期', false, '失败缓存未导出');
  } else {
    d4.setFailCached('nf10', 'CONFIG_ERROR');
    const fresh = d4.getFailCachedEntry('nf10');
    const e = d4.failCache.get('nf10');
    const MIN = 60 * 1000;
    e.ts = Date.now() - 6 * MIN;
    const expired = d4.getFailCachedEntry('nf10');
    e.ts = Date.now() - 2 * MIN;
    const within = d4.getFailCachedEntry('nf10');
    rec('N4', 'F10 CONFIG_ERROR 失败缓存 5 分钟过期',
      !!fresh && expired === null && !!within,
      `fresh=${!!fresh} 6min=${expired === null ? 'null' : 'hit'} 2min=${!!within}`);
  }

  let pass = 0, fail = 0;
  for (const it of res) {
    const id = it.id;
    orig(`${it.ok ? '✓' : '✗'} [${id}] ${it.name}  ${it.detail}`);
    it.ok ? pass++ : fail++;
  }
  orig(`\nN 组（推断缺陷红绿回归）汇总：${pass} 通过 / ${fail} 失败`);
  process.exit(fail ? 1 : 0);
})();
