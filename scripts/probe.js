#!/usr/bin/env node
/**
 * lx-source.js 端点巡检（v4.0：多日成功率统计）
 * 用法：
 *   node scripts/probe.js              # 探测全部端点，输出 README 可用性表（健康表）
 *   node scripts/probe.js --json       # 输出机器可读 JSON（供 CI 写回/告警）
 *   node scripts/probe.js --quick      # 快速模式：只测 HEAD/状态码，不做 Range 可播校验
 *
 * 判定规则（与音源内部一致）：
 *   - HTTP 2xx/3xx + 音频 content-type 或 Range 206 → 可用
 *   - 连续两次失败才判失效（CI 每日跑，单次探测失败仅记录）
 * 输出：README_HEALTH.md 覆盖写（含近7日成功率）/ 历史记录 docs/probe-history.jsonl 追加 / stdout JSON
 * v4.0：每次巡检结果追加到 docs/probe-history.jsonl，按 URL 聚合近 7 日成功率写入健康表
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
// v8.10.5：端点清单单一真相（原本 probe 用正则抽、health-daily 另写手写映射表，已两次漂移）
const {
  urls: registryUrls, byUrl: registryByUrl,
  ENDPOINTS: registryEndpoints, // v8.10.9：fail-closed 断言要用 kind 字段
  WINDOW_DAYS, CONSECUTIVE_FAIL_DAYS, EXCLUDE_DOMAINS, // v8.10.5：常量单一来源
} = require('./endpoint-registry.js');
const { todayCN } = require('./cn-date.js'); // v8.10.6：北京日期单一真相（原为 probe 本地实现，health-daily 各算一份导致分叉）
const { parseToggles } = require('./source-toggles.js'); // v8.10.5：死源建议只对启用源
// v9.1.4：探测歌与取链实现各收敛到一份共享库
// —— 此前 probe 与 source-audit 各写一份探测歌、PAYLOAD_CHECKS 各写一份取链逻辑，
//    与 lx-source.js 的 provider 形成第三、第四份实现，suyin163 修复后巡检仍报坏即由此而来。
const { songOf, idOf, EXPECT_SEC } = require('./lib/probe-songs.js');
const { loadSource, resolveUrl } = require('./lib/source-host.js');

const SRC = path.join(__dirname, '..', 'lx-source.js');
const OUT = path.join(__dirname, '..', 'README_HEALTH.md');
// v9.1.4：巡检历史的读写 / 归一化 / 聚合全部收敛到 scripts/lib/history.js（单一真相）。
// 旧实现里本文件自己解析 JSONL、自己算天级成功率，health-daily 又算探测级成功率，
// 同一个端点同一天出现两个"成功率"。这里不再保留第二份实现。
const history = require('./lib/history.js');
const { HIST_FILE, HIST_DIR } = history;
const HISTORY_DAYS = WINDOW_DAYS; // v8.10.5：不再本文件硬编码，取 endpoint-registry 的单一值
const CONCURRENCY = 5; // v8.0：并发池——同时最多 5 个请求，避免被风控封 IP
const DEAD_STREAK_THRESHOLD = CONSECUTIVE_FAIL_DAYS; // v8.10.5：同上，单一来源

// v8.2/v8.10.5：永不探测的域名已收敛到 endpoint-registry.js 的 EXCLUDE_DOMAINS（单一真相）

const UA_POOL = [ // v8.0：UA 池轮换，降低被风控概率
  'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'lx-source-probe/1.0',
];

// v8.0：平台映射表——用于自动生成 README.md 的"音源可用性"表格
// 每个平台关联一组端点关键词（匹配 URL 子串），自动汇总状态
// v9.1.4：删掉已退役的 gdstudio.xyz —— v8.13 退役后它仍留在这里，
// 导致每次巡检都打一条「PLATFORM_MAP 有 1 个关键词在登记表里找不到端点」的告警（噪声化）。
// mainSources 改为中性描述，不再写"溯音QQ 关闭"这类随开关一变就过时的状态字面量。
const PLATFORM_MAP = [
  {
    name: '网易云 wy',
    qualities: '128k / 320k / flac',
    mainSources: '溯音163 / wyOuter',
    endpointKeys: ['oiapi.net/api/Music_163', 'music.163.com/api/song/lyric', 'music.163.com/api/song/detail'],
  },
  {
    name: '酷我 kw',
    qualities: '128k / 320k / flac',
    mainSources: '溯音酷我 + 星海后端（双源）',
    endpointKeys: ['oiapi.net/api/Kuwo', 'zddyr.top', 'search.kuwo.cn', 'antiserver.kuwo.cn', 'nmobi.kuwo.cn'],
  },
  {
    name: 'QQ tx',
    qualities: '128k（走溯音酷我兜底）',
    mainSources: '溯音QQ（观察态）/ 聚合 tx',
    endpointKeys: ['oiapi.net/api/QQ_Music'],
  },
  {
    name: '酷狗 kg',
    qualities: '128k（走溯音酷我兜底）',
    mainSources: '—',
    endpointKeys: [], // 无独立源，走 kw 兜底
  },
  {
    name: '咪咕 mg',
    qualities: '128k（走溯音酷我兜底）',
    mainSources: '溯音咪咕（观察态）',
    endpointKeys: ['api.xcvts.cn/api/music/migu'],
  },
];

/** v8.10.5：统一用**北京日期**（CI cron 0 20 UTC 触发时 UTC 日期比北京早一天，V7）
 *  旧实现用 toISOString() 写历史，而日报用 TZ=Asia/Shanghai 读 → 日报"当天"恒缺数据 */
// v8.10.6：todayCN 已收敛到 scripts/cn-date.js（与 health-daily 同源），此处不再本地定义

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const quick = args.includes('--quick');
// v8.17：每次巡检对每个端点跑 REPS 次（默认 3），每次结果都进历史——
// 单日 2 次探测撑不起"70%/80% 正常"的结论，样本必须够。
const REPS = Math.max(1, Math.min(10, Number((args.find(a => a.startsWith('--reps=')) || '').split('=')[1]) || 3));
// v8.17：空跑守卫——当天写入历史的行数 < 2×端点数 说明脚本本身没跑起来，判红。
const ASSERT_SAMPLES = args.includes('--assert-samples');

// v4.0：追加本次巡检结果到历史记录（CI 每日跑，历史随 commit 保留）
// v9.1.4：写盘与清理交给 scripts/lib/history.js；本函数只负责**构造记录**。
// 关键语义修复（P0）：历史里的 `ok` 从"这一次 HTTP 成不成"改为"端点级最终结论"
//   = httpOk && (无 payload 校验 || payload 通过)。
// 旧 schema 把 payload 失败只记在 `payload:false`，`ok` 仍是 true，
// 而 health-daily 只看 `ok` → 取链失败在判定层被完全丢失
// （实测：同日同一次巡检，README_HEALTH 说 suyin163 PAYLOAD_NO_URL 失败，日报说 94.3% 正常）。
function writeHistory(results) {
  const date = todayCN(); // v8.10.5：北京日期，与 health-daily 的 --date 同源
  const records = [];
  for (const r of results) {
    const attempts = Array.isArray(r.attempts) && r.attempts.length
      ? r.attempts
      : [{ ok: r.ok, status: r.status, time: r.time, reason: r.reason }];
    const payloadFail = r.payload === false;
    for (const a of attempts) {
      records.push({
        date,
        url: r.url,
        ok: payloadFail ? false : a.ok, // 端点级最终结论
        httpOk: a.ok,                    // 裸探测结果（保留原始信号，便于区分"HTTP 挂了"与"取链挂了"）
        status: a.status,
        time: a.time,
        reason: payloadFail ? r.reason : a.reason,
        httpReason: a.reason,
        ...(r.payload === undefined ? {} : { payload: r.payload }),
        // 仅试听：端点可用但交付会被验真拦截（见 runPayloadCheck 注释），单独留痕供日报单列
        ...(r.fragment ? { fragment: true, dur: r.dur, expect: r.expect } : {}),
        // v9.2：高档位降档留痕（声明 flac 却拿到 audio/mpeg），供日报单列
        ...(r.qualityMismatch && r.qualityMismatch.length ? { qualityMismatch: r.qualityMismatch } : {}),
      });
    }
  }
  const { dropped } = history.append(records);
  if (dropped > 0) console.log(`历史清理：删除 ${dropped} 行 ${history.RETENTION_DAYS} 天前旧数据`);
  return date;
}

// v4.0：按 URL 聚合近 HISTORY_DAYS 日成功率
// v9.1.4：读取时归一化（旧记录里 payload:false + ok:true 会被压成 ok:false），
// 天级聚合只作为辅助视图，健康度主口径统一用探测级（见 README_HEALTH 表头）。
function readHistory() {
  return history.load();
}

// v4.0：死源建议阈值——连续失败天数 ≥ 该值即建议关闭（写回健康表留档，供迭代时摘除）
// v9.1.4：连续失败天数改为**全历史**统计（旧实现从 7 天窗口里数，最大只能数到 7，
// 与"连续 7 天未恢复"的告警阈值刚好卡死，无法区分"刚好 7 天"和"已经挂了 20 天"）。
function collectDeadSources(results, entries) {
  const dead = [];
  const today = todayCN();
  for (const r of results) {
    const streak = history.consecutiveFailDays(entries, r.url, today);
    if (streak < DEAD_STREAK_THRESHOLD) continue;
    const st = history.windowStats(entries, r.url, today, HISTORY_DAYS);
    dead.push({
      url: r.url,
      streak,
      rate: st ? st.rate : 0,
      dayOk: st ? st.dayOk : 0,
      dayTotal: st ? st.dayTotal : 0,
      currentOk: r.ok,
      reason: r.reason,
    });
  }
  return dead.sort((a, b) => b.streak - a.streak);
}

// ---- 静态提取端点（与 lx-source.js 常量区一致的正则）----
function extractEndpoints(src) {
  const urls = new Set();
  const re = /https?:\/\/[^\s"'`\\)\]]+/g;
  let m;
  while ((m = re.exec(src))) {
    const u = m[0].replace(/[;:,]$/, '');
    if (u.includes('{id}') || u.includes('{level}')) continue; // 模板 URL 跳过（无真实参数无法探测）
    // v9.1.4：纯域名根（path 为空或 "/"）不是端点——源码里的站点链接/拼接基址
    // 此前每天被算进"未登记端点"告警（music.163.com/、music.lzmhhh.com/），把真漏检埋掉。
    try { const pathname = new URL(u).pathname; if (!pathname || pathname === '/') continue; } catch { continue; }
    urls.add(u);
  }
  // 过滤明显非 API 的示例/文档 URL（v7.0 S5：旧正则末尾悬空 `|` 空分支使正则恒真、过滤形同虚设，已修正；
  // 加 `kuwo` 关键词——正则白名单化后 nmobi.kuwo.cn/mobi.s(helloworldKw 主通道 convert_url_with_sign)
  // 不含 api/music/search 等关键词会被误过滤，导致新源主通道脱离端点巡检）
  // v8.1：白名单补 `wwwweb`——ikun 源复活后主端点为 c.wwwweb.top（不含 api/music 等关键词会被误过滤，
  // 与 nmobi.kuwo.cn 同类漏检问题）
  return [...urls].filter(u => /api|music|search|antiserver|outer|kuwo|wwwweb|\.js$|\.php/i.test(u) && !u.includes('${')
    && !EXCLUDE_DOMAINS.some(d => u.includes(d)));
}

// v8.0：并发池——限制同时最多 N 个请求，避免被上游风控
async function poolRun(tasks, concurrency) {
  const results = new Array(tasks.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, async () => {
    while (i < tasks.length) {
      const idx = i++;
      results[idx] = await tasks[idx]();
    }
  });
  await Promise.all(workers);
  return results;
}

// ---- v8.5：取链型端点二次校验（端点 200 ≠ 源可用）----
// 2026-11-06 实锤假阳性：oiapi.net/api/Kuwo 端点连续 7 天 100% 可用，但源实际返回 CDN 410 死链；
// yy.zddyr.top/lx/api/ 端点 200，但真实取链曾因无效 token 403。端点探活只能证明"服务活着"。
// 故对"取链型"端点增加真实调用 + 直链 Range 可播校验，失败标记 PAYLOAD_DEAD。
function payloadFetch(url, opt = {}) {
  return new Promise(resolve => {
    const visit = (u, depth) => {
      let lib;
      try { lib = new URL(u).protocol === 'https:' ? https : http; } catch (e) { return resolve({ statusCode: 0, body: '', headers: {} }); }
      const req = lib.request(u, {
        method: opt.method || 'GET',
        headers: { 'User-Agent': UA_POOL[0], ...(opt.headers || {}) },
        timeout: 5000,
      }, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && depth < 4) {
          res.resume();
          let nxt;
          try { nxt = new URL(res.headers.location, u).toString(); } catch (e) { return resolve({ statusCode: res.statusCode, body: '', headers: res.headers }); }
          return visit(nxt, depth + 1);
        }
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks);
          // v8.11：保留原始字节——音频头结构必须按精确偏移解析，先转 utf-8 会把 0xFF 等字节毁掉
          resolve({ statusCode: res.statusCode, headers: res.headers, body: raw.toString('utf-8'), rawBuf: raw });
        });
      });
      req.on('timeout', () => { req.destroy(); resolve({ statusCode: 0, body: '', headers: {} }); });
      req.on('error', () => resolve({ statusCode: 0, body: '', headers: {} }));
      if (opt.body) req.write(opt.body);
      req.end();
    };
    try { visit(url, 0); } catch (e) { resolve({ statusCode: 0, body: '', headers: {} }); }
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// v8.11：交付真实性判据（与 lx-source.js verifyDelivery 同源）
// 实测：片段伪装成"能播"是 206 + audio/mpeg 全绿，只判状态码必然假绿；
// 而 FLAC STREAMINFO / MP3 Xing 都在文件头，Range 0-1023 就够算真实时长
function parseDurationFromHead(rawBuf) {
  const b = Buffer.isBuffer(rawBuf) ? rawBuf : Buffer.from(String(rawBuf || ''), 'binary');
  if (!b || b.length < 8) return null;
  if (b.toString('ascii', 0, 4) === 'fLaC') {
    let p = 4, guard = 0;
    while (p + 4 <= b.length && guard++ < 8) {
      const last = (b[p] & 0x80) !== 0, type = b[p] & 0x7F;
      const len = (b[p + 1] << 16) | (b[p + 2] << 8) | b[p + 3];
      if (type === 0) {
        const q = p + 4 + 10;
        if (q + 8 > b.length) return null;
        const sr = (b[q] << 12) | (b[q + 1] << 4) | (b[q + 2] >> 4);
        const tot = ((b[q + 3] & 0x0F) * 4294967296) + b[q + 4] * 16777216 + b[q + 5] * 65536 + b[q + 6] * 256 + b[q + 7];
        return (sr > 0 && tot > 0) ? +(tot / sr).toFixed(1) : null;
      }
      p += 4 + len;
      if (last) break;
    }
    return null;
  }
  let off = 0;
  if (b.length >= 10 && b.toString('ascii', 0, 3) === 'ID3') {
    off = 10 + ((b[6] << 21) | (b[7] << 14) | (b[8] << 7) | b[9]);
  }
  for (let i = Math.max(off, 0); i < Math.min(b.length - 4, off + 4096); i++) {
    if (b[i] !== 0xFF || (b[i + 1] & 0xE0) !== 0xE0) continue;
    const ver = (b[i + 1] >> 3) & 0x03, layer = (b[i + 1] >> 1) & 0x03;
    if (ver === 1 || layer === 0) continue;
    const spir = ver === 3 ? 1152 : 576;
    const xing = i + 4 + (ver === 3 ? 32 : 17);
    if (xing + 12 <= b.length && (b.toString('ascii', xing, xing + 4) === 'Xing' || b.toString('ascii', xing, xing + 4) === 'Info')) {
      const flags = b.readUInt32BE(xing + 4);
      if (flags & 1) {
        const frames = b.readUInt32BE(xing + 8);
        const srIdx = (b[i + 2] >> 2) & 0x03;
        const sr = (ver === 3 ? [44100, 48000, 32000] : [22050, 24000, 16000])[srIdx];
        if (frames > 0 && sr) return +((frames * spir) / sr).toFixed(1);
      }
    }
    break;
  }
  return null;
}

async function rangeOk(audioUrl, expectSec, expectQuality) {
  if (!audioUrl || !/^https?:\/\//.test(String(audioUrl))) return { state: 'NO_URL' };
  const probe = async () => {
    const r = await payloadFetch(String(audioUrl).replace(/^http:/, 'https:'), { headers: { Range: 'bytes=0-1023' } });
    const ct = String((r.headers || {})['content-type'] || '');
    const playable = r.statusCode === 206 || (r.statusCode === 200 && /audio|octet|mpeg|flac/i.test(ct));
    // v9.2：206 也要看内容类型。旧实现只认状态码，flac 请求收到 audio/mpeg 照样判 PLAYABLE ——
    // 实测 juheTx(tx) 与 ikun(wy) 的 flac 档都返回 audio/mpeg，巡检此前完全看不到这类降档。
    // 只对 flac 档判，因为 128k/320k 同为 audio/mpeg 无法从 content-type 区分，强判会制造误报。
    const downgraded = expectQuality === 'flac' && /audio\/mpeg|audio\/mp3|audio\/aac/i.test(ct);
    // v8.11：同一份字节顺手算真实时长（零额外流量）
    return { playable, status: r.statusCode, ct, downgraded, dur: parseDurationFromHead(r.rawBuf) };
  };
  let r = await probe();
  // v8.5：429/503 是上游 QPS 限流（尤其星海后端 kwplay 链），退避后重试一次；不算死链
  if (!r.playable && (r.status === 429 || r.status === 503)) {
    await sleep(1500);
    r = await probe();
    if (!r.playable && (r.status === 429 || r.status === 503)) return { state: 'THROTTLED' };
  }
  if (!r.playable) return { state: 'DEAD', ct: r.ct };
  if (r.downgraded) return { state: 'QUALITY_MISMATCH', dur: r.dur, ct: r.ct };
  // v8.11：能播 + 只有几秒 = 试听片段（实测酷我 VIP 歌统一 84972 字节 / 5.3 秒，206 全绿骗过状态码判定）
  if (r.dur && expectSec && expectSec >= 90 && r.dur / expectSec < 0.6 && expectSec - r.dur > 15) {
    return { state: 'FRAGMENT', dur: r.dur, ct: r.ct };
  }
  return { state: 'PLAYABLE', dur: r.dur, ct: r.ct };
}

// 每个取链型端点的真实调用 —— v9.1.4 起**直接调用源自己的 provider**。
// 旧实现每条手写一份 getUrl，等于在巡检里维护第四份源实现：
// suyin163 的 legacy 已修成兼容 data[] / data.items[] / data{url} 三形态，
// 而 PAYLOAD_CHECKS 仍只认 data[0].url —— 2026-11-20 实测：源已修好，巡检还报 PAYLOAD_NO_URL。
// 现在取链只有一份（源自己那份），巡检只负责：喂探测歌 → 拿直链 → Range 判可播。
const PAYLOAD_CHECKS = [
  { key: 'antiserver.kuwo.cn/anti.s', src: 'kuwoOfficial', plat: 'kw', expectSec: 269 }, // 实测交付 269.7s
  { key: 'oiapi.net/api/Kuwo', src: 'suyinKuwo', plat: 'kw' },
  { key: 'oiapi.net/api/Music_163', src: 'suyin163', plat: 'wy' },
  { key: 'c.wwwweb.top', src: 'ikun', plat: 'kw' },
  { key: 'yy.zddyr.top/lx/api', src: 'xinghaiBackend', plat: 'kw' },
  { key: 'api.xcvts.cn/api/music/migu', src: 'suyinMigu', plat: 'mg' },
  { key: 'lxmusicapi.onrender.com', src: 'huibq', plat: 'kw' },
  { key: 'oiapi.net/api/QQ_Music', src: 'suyinQQ', plat: 'tx' },
  { key: 'api.music.lerd.dpdns.org', src: 'juheTx', plat: 'tx' },
];

async function runPayloadCheck(endpointUrl, liveMod) {
  const c = PAYLOAD_CHECKS.find(x => endpointUrl.includes(x.key));
  if (!c) return null;
  const song = songOf(c.plat);
  const id = idOf(c.plat);
  if (!song || !id) return { ok: false, reason: 'PAYLOAD_NO_SONG' };
  // v9.2：逐档抽测。旧实现把 quality 写死 '128k'，声明了 320k/flac 的源高档位从未被验证 ——
  // 实测 juheTx(tx) 与 ikun(wy) 的 flac 档交付 audio/mpeg，巡检此前恒绿。
  // 主结论仍以 128k 为准（用户最终听到的保底档），高档只补充 qualityMismatch 标记。
  const maxQ = (liveMod.SOURCE_HANDLERS && liveMod.SOURCE_HANDLERS[c.src] && liveMod.SOURCE_HANDLERS[c.src].maxQuality) || '128k';
  const qualities = maxQ !== '128k' ? ['128k', maxQ] : ['128k'];
  const probes = [];
  for (const q of qualities) {
    try {
      // 取链走源自己的 provider（与 App 内置音源同一份实现）
      const url = await resolveUrl(liveMod, { src: c.src, plat: c.plat, quality: q, id, song });
      const expect = c.expectSec || EXPECT_SEC;
      const { state, dur, ct } = await rangeOk(url, expect, q);
      probes.push({ q, state, dur, ct });
    } catch (e) {
      // 源自己的失败码（NOT_FOUND / SERVER_ERROR / NETWORK_ERROR / …）直接透传，
      // 比笼统的 PAYLOAD_ERR 有诊断价值：一眼能看出是源不认这首歌，还是网络/上游挂了。
      const msg = String((e && e.message) || e);
      const code = (msg.match(/^([A-Z_]+)[:：]/) || [])[1];
      probes.push({ q, state: 'ERR', code });
    }
  }
  const base = probes.find(p => p.q === '128k') || { state: 'ERR' };
  const qualityMismatch = probes.filter(p => p.q !== '128k' && p.state === 'QUALITY_MISMATCH').map(p => ({ q: p.q, ct: p.ct }));
  const extra = { probes, qualityMismatch };
  if (base.state === 'PLAYABLE') return { ok: true, reason: 'OK', dur: base.dur, ...extra };
  // v9.1.4（2026-11-20 用户口径）：只出试听片段**不是故障**。音源本体的交付验真
  // （src/core/15-verify.js 的 PREVIEW_FRAGMENT + 3KB/s 体积下界）会拦下片段并继续换源，
  // 用户根本听不到；巡检再把它记成"失败"只会每天刷一条假告警（实测 juheTx 对 VIP《晴天》
  // 稳定返回 60.1s / 960887B，而它上游对 10 首免费歌全部 NOT_FOUND —— 换歌只会更糟）。
  // 判"可用但受限"，单独标注实际时长，交给日报的「仅试听」段。
  if (base.state === 'FRAGMENT') return { ok: true, fragment: true, reason: 'PAYLOAD_FRAGMENT', dur: base.dur, expect: c.expectSec || EXPECT_SEC, ...extra };
  if (base.state === 'THROTTLED') return { ok: true, reason: 'PAYLOAD_THROTTLED', ...extra }; // 限流非死链，不误判
  if (base.state === 'ERR') return { ok: false, reason: base.code ? `PAYLOAD_${base.code}` : 'PAYLOAD_ERR', ...extra };
  return { ok: false, reason: 'PAYLOAD_DEAD', ...extra };
}

// ---- 单端点探测（GET + Range 0-1023，4s 超时，失败重试 1 次）----
function probeUrl(url, timeoutMs = 4000, retry = true) {
  return new Promise(resolve => {
    let lib;
    try { lib = new URL(url).protocol === 'https:' ? https : http; }
    catch (e) { return resolve({ url, ok: false, status: 0, time: 0, reason: 'INVALID_URL' }); }
    const start = Date.now();
    const ua = UA_POOL[Math.floor(Math.random() * UA_POOL.length)];
    const req = lib.get(url, { headers: { 'User-Agent': ua, 'Range': 'bytes=0-1023' }, timeout: timeoutMs }, res => {
      const status = res.statusCode || 0;
      res.resume();
      // v8.0：403/429 不算可用——被封/限流等于不能用
      const ok = quick
        ? (status >= 200 && status < 400) // quick 模式：2xx/3xx 可用，4xx/5xx 不可用
        : (status === 206 || (status >= 200 && status < 400));
      resolve({ url, ok, status, time: Date.now() - start, reason: ok ? 'OK' : `HTTP ${status}` });
    });
    req.on('timeout', () => {
      req.destroy();
      // v8.0：超时重试 1 次（减少网络抖动误判）
      if (retry) return resolve(probeUrl(url, timeoutMs, false));
      resolve({ url, ok: false, status: 0, time: Date.now() - start, reason: 'TIMEOUT' });
    });
    req.on('error', e => {
      // v8.0：网络错误重试 1 次
      if (retry && (e.code === 'ECONNRESET' || e.code === 'ETIMEDOUT' || e.code === 'ENOTFOUND')) {
        return resolve(probeUrl(url, timeoutMs, false));
      }
      resolve({ url, ok: false, status: 0, time: Date.now() - start, reason: e.code || 'ERR' });
    });
  });
}

// v8.11：时长解析自检（不发网络，CI 必跑）——用构造的真实字节锁住解析器，
// 防止以后有人"顺手简化"成只判状态码，让片段重新伪装成健康
if (process.argv.includes('--selftest-duration') && require.main === module) {
  const mp3 = (sec) => {
    const frames = Math.max(1, Math.round((sec * 44100) / 1152));
    const b = Buffer.alloc(48);
    b[0] = 0xFF; b[1] = 0xFB; b[2] = 0x90; b[3] = 0x64;
    b.write('Xing', 36, 'ascii'); b.writeUInt32BE(1, 40); b.writeUInt32BE(frames, 44);
    return b;
  };
  const flac = (sec) => {
    const b = Buffer.alloc(64);
    b.write('fLaC', 0, 'ascii');
    b[4] = 0x80; b[5] = 0; b[6] = 0; b[7] = 34;
    b[18] = 0x0A; b[19] = 0xC4; b[20] = 0x40;
    const tot = Math.round(sec * 44100);
    b[21] = Math.floor(tot / 4294967296) & 0x0F;
    b[22] = Math.floor(tot / 16777216) & 0xFF;
    b[23] = Math.floor(tot / 65536) & 0xFF;
    b[24] = Math.floor(tot / 256) & 0xFF;
    b[25] = tot & 0xFF;
    return b;
  };
  const cases = [[mp3(269.8), 269.8, 'mp3 完整版'], [mp3(5.3), 5.3, 'mp3 片段'], [flac(269.7), 269.7, 'flac 完整版'], [flac(5.3), 5.3, 'flac 片段']];
  let pass = 0;
  for (const [buf, want, name] of cases) {
    const got = parseDurationFromHead(buf);
    if (got && Math.abs(got - want) <= 0.5) pass++;
    else console.log(`  ❌ ${name}: want ${want}, got ${got}`);
  }
  console.log(pass === cases.length ? `时长解析自检通过：${pass}/${cases.length}（mp3/flac × 完整/片段）` : `时长解析自检失败：${pass}/${cases.length}`);
  process.exit(pass === cases.length ? 0 : 1);
}

// 只有直接运行才巡检并写回 README/README_HEALTH；被 require 时不得打网络、不得改文件。
if (require.main === module) (async () => {
  const src = fs.readFileSync(SRC, 'utf8');
  // v8.10.5：端点清单改由 scripts/endpoint-registry.js 单一维护；
  // 源码正则抽取降级为"漂移校验"——源码里有、登记表没有的 URL 打印告警，
  // 避免新源主通道悄悄脱离巡检（历史上已两次因白名单漏关键词导致漏检）
  const endpoints = registryUrls();
  if (!endpoints.length) { console.error('端点登记表为空（scripts/endpoint-registry.js）'); process.exit(1); }
  // v8.10.5：平台清单（PLATFORM_MAP.endpointKeys）是第三份手写清单，加漂移自检（V12）
  for (const p of PLATFORM_MAP) {
    const miss = p.endpointKeys.filter(k => !endpoints.some(u => u.includes(k)));
    if (miss.length) console.warn(`⚠️ PLATFORM_MAP「${p.name}」有 ${miss.length} 个关键词在登记表里找不到端点：${miss.join(', ')}`);
  }
  const unregistered = extractEndpoints(src).filter(u => !registryByUrl().has(u));
  if (unregistered.length) {
    console.warn(`⚠️ 发现 ${unregistered.length} 个源码中未登记的端点（请补进 scripts/endpoint-registry.js）：`);
    for (const u of unregistered) console.warn(`   ${u.slice(0, 100)}`);
  }

  // v8.10.9：payload 类端点必须真的配了取链校验实现，否则 **fail-closed**。
  // 起因（实测）：T2 修好后如果有人删掉 PAYLOAD_CHECKS 里 anti.s 的条目（=校验被撤销），
  // 该端点会静默退化回「只看状态码」——206 + 6 字节 "failed" 再次被算作可用
  // （耗时从 545ms 掉回 80ms），而当时 self-check / 冒烟 / docs-audit **全绿**，没有任何机制报错。
  // 契约：registry 声明 kind=payload ⇒ 必须存在对应校验实现；缺失即视为配置错误，直接阻断。
  const payloadKeys = PAYLOAD_CHECKS.map(c => c.key);
  const missingCheck = registryEndpoints
    .filter(e => e.kind === 'payload')
    .filter(e => !payloadKeys.some(k => e.url.includes(k)));
  if (missingCheck.length) {
    console.error(`::error::payload 类端点缺少取链校验实现（会静默退化回假绿）：${missingCheck.map(e => e.url).join(', ')}`);
    process.exit(1);
  }
  const orphanChecks = payloadKeys.filter(k => !registryEndpoints.some(e => e.kind === 'payload' && e.url.includes(k)));
  if (orphanChecks.length) {
    console.warn(`::warning::存在孤儿 payload 校验（registry 未声明为 payload，校验可能不再生效）：${orphanChecks.join(', ')}`);
  }

  // v9.1.4：payload 校验改为直接调用源自己的 provider，因此必须加载 lx-source.js 产物。
  // 加载失败**不允许降级**成"只看状态码"—— 那会把取链失败重新变回假绿，等于撤销 v8.5 的修复（fail-closed）。
  let liveMod = null;
  if (registryEndpoints.some(e => e.kind === 'payload')) {
    try { liveMod = loadSource({ timeout: 9000, followMax: 5 }).mod; }
    catch (e) {
      console.error(`::error::无法加载 lx-source.js 执行真实取链校验：${e.message}`);
      process.exit(1);
    }
    if (!liveMod || !liveMod.SOURCE_HANDLERS) {
      console.error('::error::lx-source.js 未导出 SOURCE_HANDLERS，无法执行真实取链校验');
      process.exit(1);
    }
  }

  // v9.1.4：开关在探测**之前**解析——payload 真实取链要花请求，
  // 已关闭的源（huibq 已死、suyinQQ/suyinMigu 观察态）不该每天再被真打一次。
  let toggles = {};
  try { toggles = parseToggles().toggles; }
  catch (e) { console.warn(`⚠️ 开关解析失败（${e.message}），死源建议不做启用过滤`); }

  // v8.0：用并发池替代 Promise.all——限制同时最多 CONCURRENCY 个请求
  // v8.5：端点探活 + 取链型端点二次校验（真实取链 + Range 可播）
  const results = await poolRun(endpoints.map(u => async () => {
    const attempts = [];
    for (let i = 0; i < REPS; i++) attempts.push(await probeUrl(u));
    const okN = attempts.filter(a => a.ok).length;
    const rep = { ...(attempts.find(a => a.ok) || attempts[attempts.length - 1]) };
    rep.attempts = attempts;
    rep.okAttempts = okN;
    // 端点级结论取多数：3 次里 ≥2 次成功算端点可用（避免单次抖动直接判死）
    rep.ok = okN >= Math.ceil(REPS / 2);
    if (!rep.ok) return rep;
    // v9.1.4：关闭的源跳过真实取链，只保留端点存活探测。
    // 工具类端点（sources 为空 / toggleable:false）没有开关，照常校验。
    const ep = registryByUrl().get(u);
    const disabled = ep && ep.toggleable !== false && ep.sources.length
      && !ep.sources.some(s => toggles[s] === true);
    if (disabled) return { ...rep, payloadSkipped: 'disabled' };
    const p = await runPayloadCheck(u, liveMod);
    if (!p) return rep;
    if (!p.ok) return { ...rep, ok: false, reason: p.reason, payload: false };
    return {
      ...rep, payload: true,
      ...(p.fragment ? { fragment: true, dur: p.dur, expect: p.expect } : {}),
      ...(p.qualityMismatch && p.qualityMismatch.length ? { qualityMismatch: p.qualityMismatch } : {}),
    };
  }), CONCURRENCY);
  // v9.1.4：param 类端点（真实调用必须带参）的裸探测 2xx **不代表**真实可用——
  // 带 {id}/{level} 模板的 URL 会被服务器当普通请求返回 200/302（实测两例），
  // 旧实现把它们算进"可用"。这里从可用统计里剔除，只留端点级真实结论。
  const paramUrls = new Set(results
    .filter(r => { const reg = registryByUrl().get(r.url); return reg && reg.kind === 'param'; })
    .map(r => r.url));
  const judgedTotal = results.length - paramUrls.size;
  const okCount = results.filter(r => r.ok && !paramUrls.has(r.url)).length;

  if (asJson) {
    console.log(JSON.stringify({ checkedAt: new Date().toISOString(), total: results.length, judged: judgedTotal, ok: okCount, results }, null, 2));
    process.exit(okCount === judgedTotal ? 0 : 2);
  }

  // 健康表写回 README_HEALTH.md（CI 每日刷新；v2.0 写回目标，README 引用它）
  // v4.0：追加本次结果到历史 + 近7日成功率列
  const today = writeHistory(results);
  const entries = readHistory();
  const dead = collectDeadSources(results, entries)
    // v8.10.5：param 类端点裸探测必 4xx，不是"死源"，不进摘除建议
    .filter(d => { const reg = registryByUrl().get(d.url); return !reg || reg.kind !== 'param'; })
    // v8.10.5：只对**启用中**的源出摘除建议（V16）——旧实现在这里不分开关，
    // 已关闭的 suyinQQ / suyinMigu 一直被建议"摘除"，与日报口径矛盾。
    .filter(d => {
      const reg = registryByUrl().get(d.url);
      if (!reg || reg.toggleable === false || !reg.sources.length) return true; // 工具类端点照常
      return reg.sources.some(s => toggles[s] === true);
    });

  // v8.0：平台级健康汇总——按 PLATFORM_MAP 分组统计
  function platformSummary() {
    const lines = [];
    lines.push('### 平台健康汇总');
    lines.push('');
    for (const p of PLATFORM_MAP) {
      if (!p.endpointKeys.length) {
        lines.push(`- **${p.name}**：无独立源，走 kw 兜底`);
        continue;
      }
      const hits = p.endpointKeys.map(k => results.find(r => r.url.includes(k))).filter(Boolean)
        // param 端点裸探测恒为假绿，混进平台汇总只会把「4/5 可用」变成噪声
        .filter(r => { const reg = registryByUrl().get(r.url); return !reg || reg.kind !== 'param'; });
      if (!hits.length) { lines.push(`- **${p.name}**：无独立源，走 kw 兜底`); continue; }
      const okHits = hits.filter(r => r.ok);
      const emoji = okHits.length === hits.length ? '🟢' : okHits.length > 0 ? '🟡' : '🔴';
      lines.push(`- ${emoji} **${p.name}**：${okHits.length}/${hits.length} 端点可用`);
    }
    return lines.join('\n');
  }

  const lines = [];
  lines.push('# 端点健康表（自动巡检）');
  lines.push('');
  lines.push(`> 由 \`scripts/probe.js\` 自动生成 · 更新于 ${new Date().toISOString()} · 判定规则：2xx/3xx 或 Range 206 为可用（4xx/5xx/超时/域名不可解析为失败）`);
  lines.push('>');
  lines.push('> ⚠️ **口径（v9.1.4 起）**：`状态` = **端点级最终结论**（HTTP 可达 **且** 取链校验通过）。v9.1.4 前 payload 失败只落在历史 `payload` 字段、`状态` 仍显示可用，导致本表与健康日报结论相反（实测 suyin163：本表 `PAYLOAD_NO_URL` 失败、同日日报写 94.3% 正常）。`探测成功率` 按**探测次数**统计，与 `docs/health-daily/` 日报同源同算；`可用天` 是天级辅助视图。`param` 类（真实调用必须带参）一律不计入可用；**仅试听**（表里 `🟡 可用（仅试听 …）`）计入可用——片段由音源本体的交付验真（`src/core/15-verify.js` 的 `PREVIEW_FRAGMENT`）拦截并换源，用户听不到，这里只记录能力边界。');
  lines.push('');
  lines.push(`共提取 ${results.length} 个端点（其中 ${paramUrls.size} 个 param 类不参与可用判定），可用 ${okCount}/${judgedTotal} 个；近 ${HISTORY_DAYS} 日探测成功率基于 \`docs/probe-history.jsonl\` 历史（${today} 追加）。`);
  lines.push('');
  lines.push(platformSummary());
  lines.push('');
  lines.push('| 端点 | 状态 | HTTP | 耗时(ms) | 近7日探测成功率 | 可用天 | 说明 |');
  lines.push('|---|---|---|---|---|---|---|');
  for (const r of results) {
    // v9.1.4：口径统一为**探测级**（每次 attempt 一次），与 health-daily 同源同算，
    // 不再出现"README_HEALTH 说 86%、日报说 94%"的双口径。
    const st = history.windowStats(entries, r.url, today, HISTORY_DAYS);
    // v8.0：恢复标记——历史有失败但当前恢复了，加 🟡 "已恢复观察中"
    let tag = r.ok ? '✅ 可用' : '❌ 失败';
    if (r.ok && st && st.consecutiveFail > 0) tag = '🟡 已恢复观察中';
    // v9.1.4（P0）：param 类端点**一律不判可用**，无论裸探测返回什么。
    // 旧实现只在 !r.ok 时标"不适用"——但带 {id}/{level} 模板的 URL 被服务器当普通请求
    // 返回 200/302（实测 musicapi.haitangw.net、music.163.com/song/media/outer），
    // 于是 param 端点被算成 ✅ 可用。那是假绿：模板 URL 探测成功 ≠ 真实带参调用能出链。
    const reg = registryByUrl().get(r.url);
    if (reg && reg.kind === 'param') tag = '⚪ 不适用（需带参）';
    else if (r.fragment) tag = `🟡 可用（仅试听 ${r.dur || '?'}s / ${r.expect || EXPECT_SEC}s）`;
    // v9.2：高档位降档但仍可播（实测 juheTx(tx)/ikun(wy) flac 档交付 audio/mpeg）。
    // 不判失败，也不给绿——低档用户完全无感，高档用户听到的不是他要的档位。
    else if (r.qualityMismatch && r.qualityMismatch.length) tag = `🟡 可用（${r.qualityMismatch.map(m => m.q).join('/')} 档实返非无损）`;
    // 仅试听不写 PAYLOAD_FRAGMENT 这种内部码，写人话并点明由谁兜底
    const mismatchNote = r.qualityMismatch && r.qualityMismatch.length
      ? `${r.qualityMismatch.map(m => `${m.q} 档实返 ${m.ct || '非无损'}`).join('；')}；交付验真会按实际 format 回填档位`
      : '';
    const reason = r.fragment
      ? `仅试听 ${r.dur || '?'}s（应 ${r.expect || EXPECT_SEC}s）；交付验真会拦截并换源${mismatchNote ? '；' + mismatchNote : ''}`
      : (mismatchNote || (r.reason.length > 40 ? r.reason.slice(0, 40) + '…' : r.reason));
    // param 端点不参与可用判定，成功率/可用天也不再展示——否则 `music.163.com/song/media/outer`
    // 会以「100%（36/36 次）」出现在表里，与它同一行的「⚪ 不适用」直接矛盾，读者只会记住那个 100%。
    const isParamRow = !!(reg && reg.kind === 'param');
    const rateCell = isParamRow ? '—' : (st ? `${st.rate}% (${st.success}/${st.total} 次)` : '—');
    const dayCell = isParamRow ? '—' : (st ? `${st.dayOk}/${st.dayTotal} 天` : '—');
    lines.push(`| \`${r.url.slice(0, 70)}${r.url.length > 70 ? '…' : ''}\` | ${tag} | ${r.status || '-'} | ${r.time} | ${rateCell} | ${dayCell} | ${reason} |`);
  }
  // v4.0：死源建议——连续 DEAD_STREAK_THRESHOLD 天以上失败的端点，建议关闭留档
  if (dead.length) {
    lines.push('');
    lines.push(`## ⚠️ 死源建议（连续 ${DEAD_STREAK_THRESHOLD} 天以上失败，供迭代时摘除/留档）`);
    lines.push('');
    // v8.0：按平台分组——紧急（主路全挂）vs 次要（备用源挂）
    const urgent = [];
    const minor = [];
    for (const d of dead) {
      const platform = PLATFORM_MAP.find(p => p.endpointKeys.some(k => d.url.includes(k)));
      if (platform) {
        // 主路端点（第一个 key）失败算紧急，其他算次要
        if (d.url.includes(platform.endpointKeys[0])) urgent.push(d);
        else minor.push(d);
      } else {
        minor.push(d);
      }
    }
    if (urgent.length) {
      lines.push('### 🔴 紧急（主路端点连续失败）');
      lines.push('');
      for (const d of urgent) lines.push(`- \`${d.url}\`：连续 ${d.streak} 天失败（近7日探测成功率 ${d.rate}%，可用 ${d.dayOk}/${d.dayTotal} 天），当前${d.currentOk ? '恢复可用' : '仍失败'}${d.reason ? ` · ${d.reason}` : ''}`);
      lines.push('');
    }
    if (minor.length) {
      lines.push('### 🟡 次要（备用/边缘端点连续失败）');
      lines.push('');
      for (const d of minor) lines.push(`- \`${d.url}\`：连续 ${d.streak} 天失败（近7日探测成功率 ${d.rate}%，可用 ${d.dayOk}/${d.dayTotal} 天），当前${d.currentOk ? '恢复可用' : '仍失败'}${d.reason ? ` · ${d.reason}` : ''}`);
    }
  }
  fs.writeFileSync(OUT, lines.join('\n') + '\n');
  console.log(`已写回 ${OUT}：${okCount}/${judgedTotal} 可用（另 ${paramUrls.size} 个 param 端点不参与判定），历史 ${today} 已追加`);

  // v8.0：自动更新 README.md 里的"音源可用性"表格（日期 + 状态 + 原因标注）
  const README = path.join(__dirname, '..', 'README.md');
  const readmeContent = fs.readFileSync(README, 'utf8');
  const todayStr = todayCN(); // v8.10.5：北京日期（V8）

  // v8.0：原因标注——把 HTTP 状态码翻译成可读的原因
  function reasonLabel(status, reason) {
    if (status === 403) return '403 被封';
    if (status === 429) return '429 限流';
    if (reason === 'ENOTFOUND') return '域名失效';
    if (reason === 'TIMEOUT') return '超时不稳定';
    if (reason === 'OK') return '正常';
    return reason || '-';
  }

  // 根据巡检结果生成各平台的交叉验证列内容（按域名去重 + 原因标注）
  function buildCrossValidation(keys) {
    if (!keys.length) return '—（无独立源，走 kw 兜底）';
    const seen = new Set();
    const parts = [];
    for (const key of keys) {
      const hit = results.find(r => r.url.includes(key));
      if (hit) {
        const domain = new URL(hit.url).hostname;
        if (seen.has(domain)) continue; // 同一域名只显示一次
        seen.add(domain);
        const label = hit.ok ? '✅' : `❌ ${reasonLabel(hit.status, hit.reason)}`;
        parts.push(`${domain} ${label}`);
      }
    }
    return parts.join('；') || '—';
  }

  // 生成表格行
  const tableRows = PLATFORM_MAP.map(p =>
    `| ${p.name} | ${p.qualities} | ${p.mainSources} | ${buildCrossValidation(p.endpointKeys)} |`
  ).join('\n');

  // 替换 README.md 里的整段"音源可用性"表格（从标题到下一个 ## 之前）
  // ⚠️ 模板内文案必须与 README 现状一致且不绑具体版本号——整段重写会覆盖该段内任何人工更新
  //（v8.1 实测：模板旧文案「后续规划 v7.0 系列…」会把人工更新的「当前状态 v8.1 已交付」回退）
  const updatedReadme = readmeContent.replace(
    /## 音源可用性（\d{4}-\d{2}-\d{2} 核验）[\s\S]*?(?=\n## )/,
    `## 音源可用性（${todayStr} 核验）

> 本表 = 本仓库实测基线 + 生态交叉验证；端点级实时健康状态见 [README_HEALTH.md](./README_HEALTH.md)（\`scripts/probe.js\` 每日自动刷新）。
> 口径：pdone 探测来自 CI 服务器 IP，与本仓库 IP 维度不同，分歧 ≠ 某一方错误（典型：溯音咪咕上游域名可用但本机 IP 被封）。

| 平台 | 可用音质 | 主路子源 | 交叉验证 |
|---|---|---|---|
${tableRows}

> 详细对照表、缺陷与**各版本当前状态（以 docs/ITERATION_ROADMAP.md 与 DEV_GUIDE 为准）**见 [DEV_GUIDE.md](./docs/DEV_GUIDE.md)。`
  );

  // v9.1.4：锚点缺失时**显式报红**。旧实现 replace 不匹配 → updatedReadme === readmeContent
  // → 静默跳过，没有任何信号；README 的可用性表格会一直停在旧日期而无人发现。
  if (!/^## 音源可用性（\d{4}-\d{2}-\d{2} 核验）/m.test(readmeContent)) {
    console.error('::error::README.md 未找到「## 音源可用性（YYYY-MM-DD 核验）」锚点，可用性表格未更新');
    process.exitCode = 1;
  } else if (updatedReadme !== readmeContent) {
    fs.writeFileSync(README, updatedReadme);
    console.log(`已自动更新 README.md 音源可用性表格（日期 ${todayStr}）`);
  }

  // v8.0 退出码语义（v8.10.5 更正注释：此前写"某平台主路全挂"，与下面的 every 不符）
  //   exit 2 = **所有**平台主路同时全挂（真紧急）；exit 1 = 脚本/登记表异常；exit 0 = 其余
  // 任单平台全挂、或零散端点失败都**不**退出，避免每天 CI 红灯导致麻木——
  // 单平台问题由健康日报的「需处理」表与告警 Issue 覆盖。
  const allPlatformsDown = PLATFORM_MAP.every(p => {
    if (!p.endpointKeys.length) return false; // 没有独立源的平台跳过
    return p.endpointKeys.every(key => {
      const hit = results.find(r => r.url.includes(key));
      return hit && !hit.ok;
    });
  });
  if (allPlatformsDown) {
    console.log('❌ 所有平台主路都不可用——紧急！');
    process.exit(2);
  }
  if (okCount < judgedTotal) {
    console.log(`⚠️ 参与判定的 ${judgedTotal} 个端点中有 ${judgedTotal - okCount} 个失败（非全挂，不阻断 CI）`);
  }

  // v8.17：空跑守卫——历史当天行数不足说明巡检没真正执行（脚本坏了/端点表空了），
  // 不能以 exit 0 静默通过。阈值取 endpoints×2，低于它直接红。
  if (ASSERT_SAMPLES) {
    const today = todayCN();
    let todayRows = 0;
    if (fs.existsSync(HIST_FILE)) {
      for (const line of fs.readFileSync(HIST_FILE, 'utf8').split('\n')) {
        if (!line.trim()) continue;
        try { if (JSON.parse(line).date === today) todayRows++; } catch {}
      }
    }
    // v9.1.4：阈值与 REPS 对齐。旧实现硬编码 `× 2`，而默认 REPS=3 ——
    // `--reps=1` 时必然误红（1 < 2），`--reps=3` 时只跑 2 次却能过（守卫偏松）。
    const need = results.length * REPS;
    if (todayRows < need) {
      console.error(`❌ [samples] 当日样本 ${todayRows} < 期望 ${need}（端点 ${results.length} × REPS ${REPS}）——巡检未真正执行`);
      process.exit(3);
    }
    console.log(`✅ [samples] 当日样本 ${todayRows}（端点 ${results.length}，每次 ${REPS} 次探测）`);
  }

  // v9.1.4：Node 的 undici 在 keep-alive 连接上会保持事件循环存活。实测 `--reps=1`
  // 写完全部产物后进程仍驻留 11 分钟不退出（CI 里会一路等到 job 超时，把整条流水线拖死）。
  // 但裸调 process.exit 会把还堵在管道里的 console.log 一起截断（实测日志只剩一行 EXIT=0），
  // 所以先等 stdout 排空再退，并留 1.5s 兜底。
  // 必须留在 IIFE 内部：放到顶层会在第一个 await 让出后立刻触发，把整个巡检掐断（实测 0.14s 退出、零产物）。
  const exitAfterFlush = code => {
    if (process.stdout.writableLength === 0) return process.exit(code);
    process.stdout.once('drain', () => process.exit(code));
    setTimeout(() => process.exit(code), 1500).unref();
  };
  setImmediate(() => exitAfterFlush(process.exitCode ?? 0));
})();
