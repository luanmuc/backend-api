/**
 * P 组：通读发现「该测没测」的零覆盖点补测（T-4 / T-6 / T-7）
 *
 * 这三处此前跑了全部 10 个入口仍是零执行，等于「代码在，但没人验证过它在什么情况下会走哪条路」：
 *   T-4 `isPreviewFragmentUrl` 预筛（默认关闭，所以从来没被打开过）
 *   T-6 `parseFlacDuration` 的「多 metadata 块遍历」（实测样本都是单块，循环体从未进入第二轮）
 *   T-7 `sniffAudioBytes` 的「无 Xing 头 → 按首帧码率回填时长」分支
 *
 * 每条的判据都是「行为差值」而不是「函数被调用过」：同一条路径，条件开/关各跑一次，结果必须不同。
 */
const path = require('path');
const SRC = path.join(__dirname, '..', '..', 'lx-source.js');
const BASE = 'https://audio.test/x.mp3';

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
const okAudio = () => ({ statusCode: 206, headers: { 'content-type': 'audio/flac' }, body: flacSingle(269.7) });

// FLAC：单块（last=1）或双块（PADDING 在前、STREAMINFO 在后，last=1）
function flacSingle(sec, sr = 44100) {
  const b = Buffer.alloc(64);
  b.write('fLaC', 0, 'ascii');
  b[4] = 0x80; b[7] = 34;                 // last=1, type=0(STREAMINFO), len=34
  const t = Math.round(sec * sr);
  b[18] = (sr >> 12) & 0xFF; b[19] = (sr >> 4) & 0xFF; b[20] = (sr & 0x0F) << 4;
  b[21] = Math.floor(t / 4294967296) & 0x0F; b[22] = Math.floor(t / 16777216) & 0xFF;
  b[23] = Math.floor(t / 65536) & 0xFF; b[24] = Math.floor(t / 256) & 0xFF; b[25] = t & 0xFF;
  return b;
}
function flacMultiBlock(sec, sr = 44100) {
  const padLen = 100;
  const b = Buffer.alloc(4 + 4 + padLen + 4 + 34);
  b.write('fLaC', 0, 'ascii');
  b[4] = 0x01; b[5] = 0; b[6] = 0; b[7] = padLen;        // type=1(PADDING), last=0
  let p = 4 + 4 + padLen;
  b[p] = 0x80;                                            // last=1, type=0(STREAMINFO)
  b[p + 1] = 0; b[p + 2] = 0; b[p + 3] = 34;
  const t = Math.round(sec * sr);
  const q = p + 4 + 10;
  // STREAMINFO 布局：q..q+2 = 20bit 采样率，q+3..q+7 = 36bit 总样本数（高位在 q+3 低半字节）
  b[q] = (sr >> 12) & 0xFF; b[q + 1] = (sr >> 4) & 0xFF; b[q + 2] = (sr & 0x0F) << 4;
  b[q + 3] = Math.floor(t / 4294967296) & 0x0F; b[q + 4] = Math.floor(t / 16777216) & 0xFF;
  b[q + 5] = Math.floor(t / 65536) & 0xFF; b[q + 6] = Math.floor(t / 256) & 0xFF; b[q + 7] = t & 0xFF;
  return b;
}
// MP3：MPEG1 LayerIII / 128kbps / 44.1k 的合法帧头，无 Xing
function mp3NoXing() {
  const b = Buffer.alloc(64, 0);
  b[0] = 0xFF; b[1] = 0xFB; b[2] = 0x90; b[3] = 0x00;
  return b;
}

const load = (toggles, extra) => {
  setLx();
  globalThis.__lxSourceConfig = Object.assign({}, globalThis.__lxSourceConfig || {}, {
    rateWindowMax: 1e6, maxConcurrency: 1e6, rateWindowMs: 3600000,
    healthCheckIntervalMs: 3600000, breakerThreshold: 999,
    qualityShortCircuit: false, fragmentFallback: false, verifyDelivery: true, raceBudgetMs: 12000
  }, extra || {});
  delete require.cache[require.resolve(SRC)];
  const m = require(SRC);
  for (const k of Object.keys(m.runtimeToggles)) m.runtimeToggles[k] = toggles.includes(k);
  return m;
};
const call = (platform, type, info) => handler({ action: 'musicUrl', source: platform, info: { type, musicInfo: info } });

(async () => {
  const orig = console.log.bind(console);

  // ---------- T-4：previewUrlPreFilter 开/关的结果差 ----------
  const helloworldRun = async (prefilter) => {
    load(['helloworldKw'], { previewUrlPreFilter: prefilter });
    // 通道①直接返回带 preview 关键词的直链；该 https 地址在 mock 里是 206 可播
    scene = (u) => {
      if (/audio\.test/.test(u)) return okAudio();
      if (/nmobi\.kuwo\.cn/.test(u)) return json({ code: 200, data: { url: 'https://audio.test/preview-1530828245.mp3' } });
      return { error: 'ECONNREFUSED' };
    };
    console.log = () => {};
    try { return { ok: true, r: await call('kw', '128k', GOOD) }; }
    catch (e) { return { ok: false, msg: String(e.message) }; }
    finally { console.log = orig; }
  };

  const off = await helloworldRun(false);
  const on = await helloworldRun(true);
  rec('P1', 'T-4 previewUrlPreFilter 开启才拦「试听直链」', !!off.r && off.r.url && !on.ok && /试听片段/.test(on.msg),
    `关=${off.ok ? '交付 ' + off.r.url : '失败 ' + off.msg} ｜ 开=${on.ok ? '交付 ' + on.r.url : '拦截 ' + on.msg}`);

  // ---------- T-6：FLAC 多 metadata 块遍历 ----------
  const m6 = load([]);
  const sniff = m6.__debug.sniffAudioBytes;
  const one = sniff(flacSingle(269.7), {}, 24 * 1024 * 1024);
  const many = sniff(flacMultiBlock(269.7), {}, 24 * 1024 * 1024);
  rec('P2', 'T-6 FLAC 跳过前置块仍能算出时长', one.format === 'flac' && many.format === 'flac'
    && Math.abs((many.durationSec || 0) - 269.7) < 0.2,
    `单块=${one.format}/${one.durationSec} 多块=${many.format}/${many.durationSec}`);

  // ---------- T-7：无 Xing → 按首帧码率回填时长 ----------
  const m7 = load([]);
  const total = 3 * 1024 * 1024; // 3MB @128kbps ≈ 187.5s
  const info = m7.__debug.sniffAudioBytes(mp3NoXing(), { 'content-type': 'audio/mpeg' }, total);
  const expect = +((total * 8) / 128000).toFixed(1);
  rec('P3', 'T-7 MP3 无 Xing 时按码率回填时长', info.format === 'mp3' && info.bitrateKbps === 128
    && Math.abs((info.durationSec || 0) - expect) < 1,
    `format=${info.format} bitrate=${info.bitrateKbps} duration=${info.durationSec}（期望≈${expect}）`);

  // ---------- T-5：健康巡检「连续 N 次通过 → 自动启用」闭环 ----------
  const probeRounds = async (rounds) => {
    const m = load(['xinghaiBackend']);
    m.runtimeToggles.xinghaiBackend = false;      // 模拟「被探测失败自动关掉」的源
    globalThis.__lxSourceConfig = globalThis.__lxSourceConfig;
    scene = (u) => (/audio\.test/.test(u) ? okAudio() : { statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: 200, url: 'https://audio.test/x.mp3', data: { url: 'https://audio.test/x.mp3' } }) });
    console.log = () => {};
    try {
      // 逐轮推进：__probeRound 决定探测素材轮换与降频判断
      let onAfter = null;
      for (let i = 0; i < rounds; i++) {
        globalThis.__probeRound = i;
        await m.__debug.runHealthCheck();
        if (onAfter === null) onAfter = [];
        onAfter.push(m.runtimeToggles.xinghaiBackend);
      }
      return onAfter;
    } finally { console.log = orig; }
  };
  const oneRound = await probeRounds(1);
  const twoRounds = await probeRounds(2);
  rec('P4', 'T-5 探测连续 2 次通过才自动启用（1 次不够）',
    oneRound[0] === false && twoRounds[0] === false && twoRounds[1] === true,
    `1轮=${oneRound.join(',')} ｜ 2轮=${twoRounds.join(',')}（需连续 ${2} 次）`);

  let pass = 0, fail = 0;
  for (const it of res) {
    const id = it.id;
    orig(`${it.ok ? '✓' : '✗'} [${id}] ${it.name}  ${it.detail}`);
    it.ok ? pass++ : fail++;
  }
  orig(`\nP 组（零覆盖补测）汇总：${pass} 通过 / ${fail} 失败`);
  process.exit(fail ? 1 : 0);
})();
