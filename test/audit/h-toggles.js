/**
 * H 组：默认关闭 / 测试从未开启的源「开启后最小可用性」
 *
 * 动机（第四轮 O 组覆盖率实测）：全部 10 个测试入口只开过 suyinKuwo 等少数源，
 * 12 源收敛后仍需要手动验证的源（helloworldKw / xinghaiBackend / kuwoOfficial / juheTx / changqingVip / 两个观察源）
 * 的取链函数有 15~35 行从未执行——一旦用户手动打开某个源，那条链路是零验证的。
 *
 * 本组每条：只开目标源 → mock 按该源真实响应形状返回 → 断言「拿到 https 直链 + 子源透出正确」。
 * 不测失败路径（已有 e-extra/压测覆盖），只回答一个问题：**打开这个源，它到底能不能出链接**。
 */
const path = require('path');
const SRC = path.join(__dirname, '..', '..', 'lx-source.js');
const BASE = 'https://audio.test/x.mp3';
const PIC = 'https://pic.test/a.jpg';

const GOOD = { name: '晴天', singer: '周杰伦', duration: 271000, songmid: '228908', hash: 'abcdef', id: 228908 };
const res = [];
const rec = (id, name, ok, detail) => res.push({ id, name, ok, detail });

let handler = null, scene = null;
const reset = () => {};
const setLx = () => {
  globalThis.lx = {
    EVENT_NAMES: { inited: 'inited', request: 'request', updateAlert: 'updateAlert' },
    version: '2.0.0',
    env: 'mobile',
    utils: { buffer: { from: (d, e) => Buffer.from(d, e), bufToString: (b, e) => b.toString(e) } },
    request(url, opts, cb) {
      // 模拟 follow_max：3xx + location 继续跟随，最终把 last url 回给源
      let hops = 0;
      const go = (u) => {
        const r = scene(String(u), opts || {});
        if (r.statusCode >= 300 && r.statusCode < 400 && r.headers && r.headers.location && hops < 5) {
          hops++; return go(r.headers.location);
        }
        return { r, finalUrl: String(u) };
      };
      const { r, finalUrl } = go(url);
      setTimeout(() => {
        if (r.error) return cb(Object.assign(new Error(r.error), { code: r.error }), null);
        cb(null, { statusCode: r.statusCode || 200, headers: r.headers || {}, body: r.body ?? '', url: finalUrl });
      }, 2);
    },
    on(n, h) { if (n === 'request') handler = h; },
    send() {},
  };
};

const json = (o) => ({ statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });
const text = (s) => ({ statusCode: 200, headers: { 'content-type': 'text/plain' }, body: String(s) });
// FLAC 头 + STREAMINFO 时长，供验真/探针识别为完整音频
const flac = (sec, sr = 44100) => {
  const b = Buffer.alloc(64); b.write('fLaC', 0, 'ascii'); b[4] = 0x80; b[7] = 34;
  b[18] = (sr >> 12) & 0xFF; b[19] = (sr >> 4) & 0xFF; b[20] = (sr & 0x0F) << 4;
  const t = Math.round(sec * sr);
  b[21] = Math.floor(t / 4294967296) & 0x0F; b[22] = Math.floor(t / 16777216) & 0xFF;
  b[23] = Math.floor(t / 65536) & 0xFF; b[24] = Math.floor(t / 256) & 0xFF; b[25] = t & 0xFF;
  return b;
};
const okAudio = () => ({ statusCode: 206, headers: { 'content-type': 'audio/flac' }, body: flac(269.7, 44100) });

const fresh = (toggles) => {
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
const call = (platform, type, info, action) => handler({ action: action || 'musicUrl', source: platform, info: { type, musicInfo: info } });

(async () => {
  const orig = console.log.bind(console);

  // ---- 音频直链：任何请求到 audio.test 一律返回完整 FLAC（验真/探针共用）----
  const withAudio = (routes) => (u) => {
    if (/audio\.test|pic\.test/.test(u)) return okAudio();
    for (const r of routes) if (u.includes(r.k)) return r.v(u);
    return { error: 'ECONNREFUSED' };
  };

  const CHECKS = [
    {
      id: 'H1', toggle: 'helloworldKw', platform: 'kw', quality: '128k', expect: 'helloworldKw',
      name: 'helloworld(kw) 开启后能出 flac 直链',
      scene: withAudio([{ k: 'nmobi.kuwo.cn', v: () => text(JSON.stringify({ code: 200, data: { url: BASE } })) }]),
    },
    {
      id: 'H2', toggle: 'xinghaiBackend', platform: 'kw', quality: 'flac', expect: 'xinghaiBackend',
      name: '星海后端 开启后能出直链',
      scene: withAudio([{ k: 'yy.zddyr.top', v: () => text(JSON.stringify({ code: 200, url: BASE, msg: '' })) }]),
    },
    {
      id: 'H3', toggle: 'kuwoOfficial', platform: 'kw', quality: '128k', expect: 'kuwoOfficial',
      name: '酷我官方直连 开启后 搜索→convert 两跳都能出链',
      scene: withAudio([
        { k: 'convert_url', v: () => text(BASE) },
        { k: 'search.kuwo.cn', v: () => text(`{'abslist':[{'MP3RID':'MP3_228908','NAME':'晴天','ARTIST':'周杰伦','DURATION':'271'}]}`) },
      ]),
    },
    {
      id: 'H5', toggle: 'juheTx', platform: 'tx', quality: '128k', expect: 'juheTx',
      name: 'Juhe(tx) 开启后能出直链',
      scene: withAudio([{ k: '/tx', v: () => json({ code: 200, data: { url: BASE } }) }]),
    },
    {
      id: 'H11', toggle: 'suyinQQ', probation: true, platform: 'tx', quality: '128k', expect: 'suyinQQ',
      name: '溯音QQ 观察源：即使手动开启也不进链，但探测清单可见',
      scene: withAudio([{ k: 'QQ_Music', v: () => json({ music: BASE }) }]),
    },
    {
      id: 'H12', toggle: 'suyinMigu', probation: true, platform: 'mg', quality: '128k', expect: 'suyinMigu',
      name: '溯音咪咕 观察源：即使手动开启也不进链，但探测清单可见',
      scene: withAudio([{ k: 'xcvts.cn', v: () => json({ code: 200, musicInfo: BASE, song: '晴天', singer: '周杰伦', duration: 271 }) }]),
    },
    {
      id: 'H13', toggle: 'changqingVip', platform: 'kw', quality: '128k', expect: 'changqingVip',
      name: '长青kw 开启后能出 128k 直链',
      scene: withAudio([{ k: 'musicapi.haitangw.net', v: () => ({ statusCode: 302, headers: { location: BASE, 'content-type': 'audio/mpeg' }, body: '' }) }]),
    },
  ];;

  orig('\n[H] 未测源开启后最小可用性');
  for (const c of CHECKS) {
    reset();
    const m = fresh([c.toggle]);
    scene = c.scene;
    if (c.probation) {
      // v8.13：观察源只探测、不进链——即使 runtimeToggles 被手动打开，buildSourceChain 也必须为空。
      const chain = m.buildSourceChain(c.platform, c.quality);
      const pcfg = m.buildProbeConfig();
      const ok = !chain.some(h => h.id === c.expect) && !!pcfg[c.expect];
      rec(c.id, c.name, ok,
        ok ? `链=[${chain.map(h => h.id).join(',')}]，探测清单含 ${c.expect}` : `链=${chain.map(h => h.id).join(',')}，探测=${!!pcfg[c.expect]}`);
      continue;
    }
    let r = null, e0 = null;
    try { r = await call(c.platform, c.quality, { ...GOOD }); } catch (e) { e0 = e; }
    const ok = !!r && r.subSource === c.expect && /^https:/.test(String(r.url));
    rec(c.id, c.name, ok,
      ok ? `${r.subSource} → ${String(r.url).slice(0, 42)}`
        : (e0 ? `失败 code=${JSON.stringify(e0.code)} msg=${String(e0.message).slice(0, 90)}` : `返回 subSource=${r && r.subSource}`));
  }

  // H13：酷我封面（pic action）——独立于取链，验证默认关闭源之外的"从没测过的透出能力"
  {
    reset();
    fresh(['kuwoOfficial']);
    scene = withAudio([{ k: 'search.kuwo.cn', v: () => text(`{'abslist':[{'MP3RID':'MP3_1','NAME':'晴天','hts_MVPIC':'${PIC}'}]}`) }]);
    let p = null, e0 = null;
    try { p = await call('kw', '128k', { name: '晴天', singer: '周杰伦' }, 'pic'); } catch (e) { e0 = e; }
    const ok = typeof p === 'string' && /^https:/.test(p);
    rec('H13', '酷我封面（pic action）能取到 hts_MVPIC', ok, ok ? String(p) : (e0 ? `code=${JSON.stringify(e0.code)}` : `返回 ${JSON.stringify(p)}`));
  }



  const pass = res.filter(r => r.ok).length, fail = res.filter(r => !r.ok).length;
  orig(`\nH 组（未测源开启）汇总：${pass} 通过 / ${fail} 失败`);
  for (const r of res.filter(x => !x.ok)) { const id = r.id; orig(`  ✗ [${id}] ${r.name} — ${r.detail}`); }
  orig(`  明细：`);
  for (const r of res) { const id = r.id; orig(`  ${r.ok ? '✓' : '✗'} [${id}] ${r.name} — ${r.detail}`); }
  if (require.main === module) process.exit(fail ? 1 : 0);
})();

module.exports = { results: res };
