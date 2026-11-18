#!/usr/bin/env node
/**
 * v9-preflight：行为等价性快照（拆包前的行为指纹基线）
 *
 * 目的：把「固定输入 → 固定 mock 上游 → 输出 URL/错误码」录成指纹。
 * v9.0 拆包（legacy.js 6272 行 → 多模块、单产物）时，用它证明「行为没变」，
 * 而不是只看 md5（md5 只可能变，不能当验收依据）。
 *
 * 用法：
 *   node scripts/equiv-snapshot.js --write   # 生成/覆盖基线 test/fixtures/equiv-baseline.json
 *   node scripts/equiv-snapshot.js           # 与基线比对，不一致则退出码 1
 *
 * 设计约束（决定它是否可靠）：
 *   - 输入完全确定性：歌单由序号派生（不含随机、不含时间）
 *   - mock 上游完全确定性：不发真实网络，固定音频 206 / 固定 JSON 200
 *   - 每组 (platform, quality, song) 都从 fresh 实例开始，避免健康态/缓存互相污染
 *   - 记录 url 与 code 两项：url 抓「档位选择/降档链」变化，code 抓「失败面」变化
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'lx-source.js');
const BASELINE = path.join(ROOT, 'test', 'fixtures', 'equiv-baseline.json');

const QUALITIES = ['flac24bit', 'flac', '320k', '128k'];
const SONG_COUNT = 60;

// 确定性歌单：名字/歌手/hash/时长都由序号派生，不依赖真实曲库
const songs = Array.from({ length: SONG_COUNT }, (_, i) => ({
  songmid: `eq${String(i).padStart(3, '0')}`,
  hash: `eqhash${String(i).padStart(3, '0')}`,
  name: `等价样例${i}`,
  singer: `样例歌手${i % 7}`,
  albumName: `样例专辑${i % 5}`,
  interval: `02:${String(i % 60).padStart(2, '0')}`,
  _types: {},
}));

const audioBody = Buffer.alloc(64);
audioBody[0] = 0xff; audioBody[1] = 0xfb; audioBody[2] = 0x90; audioBody[3] = 0x64;

// 确定性上游：音频类 URL 给 206 音频；其余给 200 JSON（含固定可播 URL）
// 第三维「故障面」：按歌序号确定性地注入三档上游行为（正常 / 空 url / 500），
// 否则基线只覆盖成功面，拆包后「失败码变化」这种回归抓不到。
const FAST = process.argv.includes('--fast');
// --sample N：只跑前 N 首（默认全量 60 首 = 1200 例）。日常拆包校验用 3~5 首即可覆盖
// 「平台 × 档位 × 故障维度」的组合面，全量留给段末里程碑。
const SAMPLE_IDX = process.argv.indexOf('--sample');
const SAMPLE = SAMPLE_IDX > -1 ? Math.max(1, Number(process.argv[SAMPLE_IDX + 1]) || 60) : 60; // 只跑成功面（~4s），用于日常快速校验；全量用于拆包里程碑
const faultOf = (songmid) => {
  if (FAST) return '';
  const n = Number(String(songmid).replace(/[^0-9]/g, '')) || 0;
  return n % 3 === 0 ? 'empty' : n % 3 === 1 ? 'http500' : '';
};

const reqImpl = (url, opts, cb) => {
  const u = String(url);
  const fault = globalThis.__eqFault || '';
  if (fault === 'http500') {
    setTimeout(() => cb(null, { statusCode: 500, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: 500, msg: 'eq-fault-500' }) }), 0);
    return () => {};
  }
  if (fault === 'empty') {
    setTimeout(() => cb(null, { statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: 200, data: { url: '' } }) }), 0);
    return () => {};
  }
  setTimeout(() => {
    if (/\.(mp3|flac|m4a|aac|ogg|wav)(\?|$)/i.test(u) || /audio/.test(u)) {
      cb(null, {
        statusCode: 206,
        headers: { 'content-type': 'audio/mpeg', 'content-range': `bytes 0-63/${64 + 4000000}` },
        body: audioBody,
      });
    } else {
      cb(null, {
        statusCode: 200,
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ code: 200, data: { url: `https://eq.test/${crypto.createHash('md5').update(u).digest('hex').slice(0, 10)}.mp3` }, url: `https://eq.test/fixed.mp3` }),
      });
    }
  }, 0);
  return () => {};
};

const setLx = () => {
  globalThis.lx = {
    EVENT_NAMES: { inited: 'inited', request: 'request', updateAlert: 'updateAlert' },
    version: '2.0.0',
    env: 'mobile',
    utils: { buffer: { from: (d, e) => Buffer.from(d, e), bufToString: (b, e) => b.toString(e) } },
    request: reqImpl,
    on(n, h) { if (n === 'request') globalThis.__eqHandler = h; }, send() {},
  };
};

const fresh = () => {
  setLx();
  globalThis.__lxSourceConfig = Object.assign({ logEnabled: false, logDebug: false }, {});
  const p = require.resolve(SRC);
  if (require.cache[p]) delete require.cache[p];
  return require(SRC);
};

// 入口不是导出函数：音源加载时用 lx.on('request', fn) 注册，必须在 setLx 里捕获
// 签名必须是 {action, source, info:{type, musicInfo}}——顶层 quality 会被判 PARAM_ERROR
const call = (payload) => {
  fresh();
  if (typeof globalThis.__eqHandler !== 'function') throw new Error('handler 未注册');
  return globalThis.__eqHandler({ action: 'musicUrl', ...payload });
};

async function main() {
  const boot = fresh();
  const handlers = boot.SOURCE_HANDLERS || {};
  const platforms = [...new Set(Object.values(handlers).flatMap((h) => h.platforms || []))].sort();
  const srcIds = Object.keys(handlers).sort();

  const rows = [];
  const t0 = Date.now();
  for (const platform of platforms) {
    for (const quality of QUALITIES) {
      // FAST 模式无故障注入，只能与基线中「正常面」的歌比对（n%3===2），否则 f 维度不匹配
      for (const song of songs.filter((x) => !FAST || ((Number(String(x.songmid).replace(/[^0-9]/g, '')) || 0) % 3 === 2)).slice(0, SAMPLE)) {
        const tSong = Date.now();
        let url = '';
        let code = '';
        let src = '';
        globalThis.__eqFault = faultOf(song.songmid);
        try {
          const r = await call({ source: platform, info: { type: quality, musicInfo: song } });
          url = (r && r.url) || '';
          src = (r && r.sourceId) || '';
        } catch (e) {
          code = e && e.code ? e.code : ('ERR:' + (e && e.message ? String(e.message).slice(0, 40) : 'unknown'));
        }
        // 只记「输出的指纹」，不记全过程日志：固定 mock 下 url 应稳定
        if (process.argv.includes('--trace')) console.log(`  ${platform}|${quality}|${song.songmid} ${Date.now() - tSong}ms code=${code || '-'}`);
        rows.push({ p: platform, q: quality, s: song.songmid, f: globalThis.__eqFault, url, code, src });
      }
    }
  }

  const shape = rows.map((r) => `${r.p}|${r.q}|${r.s}|${r.f}|${r.url}|${r.code}|${r.src}`);
  const digest = crypto.createHash('md5').update(shape.join('\n')).digest('hex');

  const summary = {
    version: (String(fs.readFileSync(SRC, 'utf8')).match(/@version ([0-9.]+)/) || [])[1] || 'unknown',
    platforms,
    sourceHandlers: srcIds.length,
    qualities: QUALITIES,
    songs: SONG_COUNT,
    cases: rows.length,
    produced: rows.filter((r) => r.url).length,
    failed: rows.filter((r) => !r.url).length,
    codeHistogram: rows.filter((r) => r.code).reduce((a, r) => (a[r.code] = (a[r.code] || 0) + 1, a), {}),
    digest,
    elapsedMs: Date.now() - t0,
  };

  if (process.argv.includes('--write')) {
    fs.mkdirSync(path.dirname(BASELINE), { recursive: true });
    fs.writeFileSync(BASELINE, JSON.stringify({ summary, rows }, null, 1));
    console.log('已写入基线：' + path.relative(ROOT, BASELINE));
    console.log(JSON.stringify(summary, null, 1));
    try { console.log('@version: ' + String(fs.readFileSync(SRC, 'utf8').match(/@version ([0-9.]+)/)[1])); } catch (e) {}
    return;
  }

  if (!fs.existsSync(BASELINE)) {
    console.error('缺少基线：先跑 --write');
    process.exitCode = 1;
    return;
  }
  const base = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
  const diffs = [];
  const sampleMode = base.rows.length !== rows.length;
  const keyOf = (r) => `${r.p}|${r.q}|${r.s}|${r.f}`;
  if (sampleMode) {
    // --sample 抽样：按 p|q|s|f 从基线定位对应例（不再靠索引顺序）
    const map = new Map(base.rows.map((r) => [keyOf(r), r]));
    for (const r of rows) {
      const a = map.get(keyOf(r));
      if (!a) { diffs.push(`${keyOf(r)}：基线无该例`); continue; }
      if (a.url !== r.url || a.code !== r.code) diffs.push(`${keyOf(r)}：基线=${a.url || a.code} 现=${r.url || r.code}`);
    }
  } else {
    const n = Math.max(base.rows.length, rows.length);
    for (let i = 0; i < n; i++) {
      const a = base.rows[i] || {};
      const b = rows[i] || {};
      if (a.url !== b.url || a.code !== b.code) {
        diffs.push(`${a.p || b.p}|${a.q || b.q}|${a.s || b.s}|f=${a.f || b.f}：基线=${a.url || a.code} 现=${b.url || b.code}`);
      }
    }
  }
  console.log(`基线 ${base.summary.cases} 例 / 现 ${rows.length} 例；差异 ${diffs.length}`);
  if (diffs.length) {
    diffs.slice(0, 20).forEach((d) => console.log('  ✗ ' + d));
    bestEffortExit(1);
  } else if (sampleMode) {
    console.log(`  ✓ 行为等价（抽样 ${rows.length} 例，全部对齐基线）`);
  } else if (base.summary.digest !== digest) {
    console.log('  ✗ 全量 digest 不一致（明细未见差异，可能是顺序/字段变化）');
    bestEffortExit(1);
  } else {
    console.log('  ✓ 行为等价：digest 一致 ' + digest);
    process.exit(0);
  }
  process.exit(process.exitCode || 0);
}

if (require.main === module) main();

function bestEffortExit(code) { process.exit(code); }
