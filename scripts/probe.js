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

const SRC = path.join(__dirname, '..', 'lx-source.js');
const OUT = path.join(__dirname, '..', 'README_HEALTH.md');
const HIST_DIR = path.join(__dirname, '..', 'docs');
const HIST_FILE = path.join(HIST_DIR, 'probe-history.jsonl');
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
const PLATFORM_MAP = [
  {
    name: '网易云 wy',
    qualities: '128k / 320k / flac',
    mainSources: '溯音163 / wyOuter / gdWy',
    endpointKeys: ['oiapi.net/api/Music_163', 'music.163.com/api/song/lyric', 'music.163.com/api/song/detail', 'gdstudio.xyz'],
  },
  {
    name: '酷我 kw',
    qualities: '128k / 320k / flac',
    mainSources: '溯音酷我 + 星海后端（双源 v1.0）',
    endpointKeys: ['oiapi.net/api/Kuwo', 'zddyr.top', 'search.kuwo.cn', 'antiserver.kuwo.cn', 'nmobi.kuwo.cn'],
  },
  {
    name: 'QQ tx',
    qualities: '128k（走溯音酷我兜底）',
    mainSources: '溯音QQ 关闭',
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
    mainSources: '溯音咪咕关闭',
    endpointKeys: ['api.xcvts.cn/api/music/migu'],
  },
];

/** v8.10.5：统一用**北京日期**（CI cron 0 20 UTC 触发时 UTC 日期比北京早一天，V7）
 *  旧实现用 toISOString() 写历史，而日报用 TZ=Asia/Shanghai 读 → 日报"当天"恒缺数据 */
// v8.10.6：todayCN 已收敛到 scripts/cn-date.js（与 health-daily 同源），此处不再本地定义

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const quick = args.includes('--quick');

// v4.0：追加本次巡检结果到历史记录（CI 每日跑，历史随 commit 保留）
// v8.0：30 天滚动清理——只保留近 30 天数据，防止文件无限增长
const HISTORY_RETENTION_DAYS = 30;
function appendHistory(results) {
  const date = todayCN(); // v8.10.5：北京日期，与 health-daily 的 --date 同源
  // v8.10.8：把 payload 校验结果一并写进历史（有则写、无则略）。
  // 否则「这个端点这次是真带参取链校验过，还是只看了状态码」在历史里无法区分——
  // 将来若某个 payload 校验被改回去，没人能立刻从数据里看出来（T2 的可追溯性补口）。
  const lines = results.map(r => JSON.stringify({
    date, url: r.url, ok: r.ok, status: r.status, time: r.time, reason: r.reason,
    ...(r.payload === undefined ? {} : { payload: r.payload }),
  }));
  if (!fs.existsSync(HIST_DIR)) fs.mkdirSync(HIST_DIR, { recursive: true });
  // v8.10.5：改为**原子写**——先合并+清理，写临时文件再 rename。
  // 旧实现是「append 到正式文件 → 再全量重写」，两步之间崩溃会留下半截文件（V29）。
  const allLines = fs.existsSync(HIST_FILE)
    ? fs.readFileSync(HIST_FILE, 'utf8').split('\n').filter(l => l.trim())
    : [];
  const merged = allLines.concat(lines);
  const cutoff = new Date(Date.now() - HISTORY_RETENTION_DAYS * 864e5).toISOString().slice(0, 10);
  const kept = [];
  for (const line of merged) {
    try {
      const r = JSON.parse(line);
      if (r.date >= cutoff) kept.push(line);
    } catch (e) { kept.push(line); } // 解析失败的行保留（防丢数据）
  }
  const tmp = HIST_FILE + '.tmp';
  fs.writeFileSync(tmp, kept.join('\n') + '\n');
  fs.renameSync(tmp, HIST_FILE);
  if (kept.length < merged.length) {
    console.log(`历史清理：${merged.length} 行 → ${kept.length} 行（删除 ${merged.length - kept.length} 行 ${HISTORY_RETENTION_DAYS} 天前旧数据）`);
  }
  return date;
}

// v4.0：按 URL 聚合近 HISTORY_DAYS 日成功率（每天取最后一次结果）
function aggregateHistory() {
  if (!fs.existsSync(HIST_FILE)) return {};
  const cutoffMs = Date.now() - HISTORY_DAYS * 864e5;
  const byUrl = {}; // url -> { date: ok }
  for (const line of fs.readFileSync(HIST_FILE, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let r;
    try { r = JSON.parse(line); } catch (e) { continue; }
    const t = Date.parse(r.date + 'T00:00:00Z');
    if (!t || t < cutoffMs) continue;
    const u = r.url;
    byUrl[u] = byUrl[u] || {};
    byUrl[u][r.date] = !!r.ok; // 同日多次取最后一次
  }
  const stats = {};
  for (const [url, days] of Object.entries(byUrl)) {
    const dates = Object.keys(days).sort();
    let ok = 0, fail = 0;
    for (const d of dates) { if (days[d]) ok++; else fail++; }
    // 连续失败天数：从最新一天往前数连续失败
    let streak = 0;
    for (let i = dates.length - 1; i >= 0; i--) {
      if (days[dates[i]]) break;
      streak++;
    }
    stats[url] = { days: dates.length, ok, fail, streak, rate: dates.length ? (ok / dates.length) : 1 };
  }
  return stats;
}

// v4.0：死源建议阈值——连续失败天数 ≥ 该值即建议关闭（写回健康表留档，供迭代时摘除）
function collectDeadSources(hist, results) {
  const dead = [];
  const urlByResult = new Map(results.map(r => [r.url, r]));
  for (const [url, h] of Object.entries(hist)) {
    if (h.streak >= DEAD_STREAK_THRESHOLD) {
      const cur = urlByResult.get(url);
      dead.push({ url, streak: h.streak, rate: h.rate, currentOk: cur ? cur.ok : false, reason: cur ? cur.reason : '历史连续失败' });
    }
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
        res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf-8') }));
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

async function rangeOk(audioUrl) {
  if (!audioUrl || !/^https?:\/\//.test(String(audioUrl))) return 'NO_URL';
  const probe = async () => {
    const r = await payloadFetch(String(audioUrl).replace(/^http:/, 'https:'), { headers: { Range: 'bytes=0-1023' } });
    const ct = String((r.headers || {})['content-type'] || '');
    const playable = r.statusCode === 206 || (r.statusCode === 200 && /audio|octet|mpeg|flac/i.test(ct));
    return { playable, status: r.statusCode };
  };
  let r = await probe();
  // v8.5：429/503 是上游 QPS 限流（尤其星海后端 kwplay 链），退避后重试一次；不算死链
  if (!r.playable && (r.status === 429 || r.status === 503)) {
    await sleep(1500);
    r = await probe();
    if (!r.playable && (r.status === 429 || r.status === 503)) return 'THROTTLED';
  }
  return r.playable ? 'PLAYABLE' : 'DEAD';
}

// 每个取链型端点的真实调用（返回直链，交由 rangeOk 判定可播）
const PAYLOAD_CHECKS = [
  {
    // v8.10.7（T2）：anti.s 对**任何**请求都回 206（缺参正文是 6 字节 "failed"），
    // 只判状态码必然永远假绿。改为带参 convert_url 取链：返回体是纯文本 URL（非 JSON），
    // 用两个不同资源 id 兜底 —— 单个 rid 失效不该被判成"服务死亡"。
    key: 'antiserver.kuwo.cn/anti.s',
    getUrl: async () => {
      for (const rid of ['MUSIC_228908', 'MUSIC_186016']) {
        const r = await payloadFetch(`http://antiserver.kuwo.cn/anti.s?type=convert_url&rid=${rid}&format=mp3&response=url`);
        const t = String(r.body || '').trim();
        if (/^https?:\/\//.test(t)) return t;
      }
      return '';
    },
  },
  {
    key: 'oiapi.net/api/Kuwo',
    getUrl: async () => {
      const r = await payloadFetch('https://oiapi.net/api/Kuwo?msg=' + encodeURIComponent('晴天 周杰伦') + '&n=1&br=9');
      try { const j = JSON.parse(r.body); if (j && j.data && j.data.url) return j.data.url; } catch (e) {}
      const m = String(r.body).match(/音乐链接[：:]\s*(\S+)/);
      return m ? m[1] : '';
    },
  },
  {
    key: 'oiapi.net/api/Music_163',
    getUrl: async () => {
      const r = await payloadFetch('https://oiapi.net/api/Music_163?id=347230');
      try { const j = JSON.parse(r.body); const u = j && j.data && j.data[0] && j.data[0].url; if (u) return u; } catch (e) {}
      const m = String(r.body).match(/音乐链接[：:]\s*(\S+)/);
      return m ? m[1] : '';
    },
  },
  {
    key: 'c.wwwweb.top',
    getUrl: async () => {
      const r = await payloadFetch('https://c.wwwweb.top/music/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'kw', musicId: '228908', quality: '128k' }),
      });
      try { const j = JSON.parse(r.body); if (j && Number(j.code) === 200 && j.url) return j.url; } catch (e) {}
      return '';
    },
  },
  {
    key: 'yy.zddyr.top/lx/api',
    getUrl: async () => {
      const r = await payloadFetch('https://yy.zddyr.top/lx/api/?source=kw&name=' + encodeURIComponent('晴天') + '&singer=' + encodeURIComponent('周杰伦') + '&songmid=228908&quality=128k', { headers: { 'X-Client': 'lx-aggregate/12.0', 'User-Agent': 'LX-Music-Mobile' } });
      try { const j = JSON.parse(r.body); if (j && Number(j.code) === 200 && typeof j.url === 'string') return j.url; } catch (e) {}
      return '';
    },
  },
  {
    key: 'api.xcvts.cn/api/music/migu',
    getUrl: async () => {
      const r = await payloadFetch('https://api.xcvts.cn/api/music/migu?gm=' + encodeURIComponent('晴天') + '&n=1&num=1&type=json');
      try {
        const j = JSON.parse(r.body);
        if (j && j.musicInfo) return typeof j.musicInfo === 'string' ? j.musicInfo : (j.musicInfo.url || '');
      } catch (e) {}
      return '';
    },
  },
  {
    // v8.10.9：huibq 裸 GET 返回 200 + 文档 JSON（"MusicFree 音源script2"）→ 假绿；
    // 真实调用是 /url/{platform}/{id}/{quality}，且需 X-Request-Key（lx-source.js 里硬编码 share-v3）
    key: 'lxmusicapi.onrender.com',
    getUrl: async () => {
      const r = await payloadFetch('https://lxmusicapi.onrender.com/url/kw/228908/128k', { headers: { 'X-Request-Key': 'share-v3' } });
      try { const j = JSON.parse(r.body); if (j && typeof j.url === 'string' && /^https?:\/\//.test(j.url)) return j.url; } catch (e) {}
      return '';
    },
  },
  {
    // v8.10.9：suyinQQ 裸 GET 恒 403（"该Api暂时无法访问"），裸探测与真实调用同结果；
    // 带 key 才是真实调用形式，服务恢复后可真验证（key 与 lx-source.js 的 SUYIN_QQ_KEY 一致）
    key: 'oiapi.net/api/QQ_Music',
    getUrl: async () => {
      const r = await payloadFetch('https://oiapi.net/api/QQ_Music?key=oiapi-ef6133b7-ac2f-dc7d-878c-d3e207a82575&type=json&br=128&n=1&songid=102065756');
      try { const j = JSON.parse(r.body); if (j && typeof j.music === 'string' && /^https?:/.test(j.music)) return j.music; if (j && typeof j.url === 'string') return j.url; } catch (e) {}
      return '';
    },
  },
  {
    // v8.10.9：gdWy 裸 GET 只拿到网页首页/503，真实调用需 types=url&source=&id=&br=
    key: 'music-api.gdstudio.xyz',
    getUrl: async () => {
      // v8.10.11：探测 id 不能用手写死的 VIP 歌。仓库自己早就写明
      //「186016 周杰伦 VIP 无 url 已排除」（lx-source.js 的 PROBE_163_IDS 注释），
      // 但 buildProbeConfig 里 gdWy 仍写死 id=186016 —— 用它做校验会让端点无论好坏都判死。
      // 改用已验证能出真实 mp3 的免费歌 id（同源网易云 id），并做双 id 兜底。
      for (const id of ['2652820720', '347230']) {
        const r = await payloadFetch(`https://music-api.gdstudio.xyz/api.php?use_xbridge3=true&loader_name=forest&need_sec_link=1&sec_link_scene=im&theme=light&types=url&source=netease&id=${id}&br=320`);
        const m = String(r.body || '').match(/"url"\s*:\s*"(https?:[^"]+)"/);
        if (m) return m[1];
        const m2 = String(r.body || '').match(/https?:\/\/[^"'\s]+\.(?:mp3|flac|m4a)/i);
        if (m2) return m2[0];
      }
      return '';
    },
  },
  {
    // v8.10.9：juhe 裸 GET 返回 "200 OK" 空壳 HTML（假绿）；真实调用是 POST /{platform} 带 JSON body
    key: 'api.music.lerd.dpdns.org',
    getUrl: async () => {
      const r = await payloadFetch('https://api.music.lerd.dpdns.org/kw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ songId: '228908', quality: '128k', source: 'kw', interval: 200 }),
      });
      try { const j = JSON.parse(r.body); if (j && j.code === 200 && typeof j.data?.url === 'string') return j.data.url; } catch (e) {}
      return '';
    },
  },
];

async function runPayloadCheck(endpointUrl) {
  const c = PAYLOAD_CHECKS.find(x => endpointUrl.includes(x.key));
  if (!c) return null;
  try {
    const url = await c.getUrl();
    if (!url) return { ok: false, reason: 'PAYLOAD_NO_URL' };
    const state = await rangeOk(url);
    if (state === 'PLAYABLE') return { ok: true, reason: 'OK' };
    if (state === 'THROTTLED') return { ok: true, reason: 'PAYLOAD_THROTTLED' }; // 限流非死链，不误判
    return { ok: false, reason: 'PAYLOAD_DEAD' };
  } catch (e) { return { ok: false, reason: 'PAYLOAD_ERR' }; }
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

(async () => {
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

  // v8.0：用并发池替代 Promise.all——限制同时最多 CONCURRENCY 个请求
  // v8.5：端点探活 + 取链型端点二次校验（真实取链 + Range 可播）
  const results = await poolRun(endpoints.map(u => async () => {
    const base = await probeUrl(u);
    if (!base.ok) return base;
    const p = await runPayloadCheck(u);
    if (!p) return base;
    if (!p.ok) return { ...base, ok: false, reason: p.reason, payload: false };
    return { ...base, payload: true };
  }), CONCURRENCY);
  const okCount = results.filter(r => r.ok).length;

  if (asJson) {
    console.log(JSON.stringify({ checkedAt: new Date().toISOString(), total: results.length, ok: okCount, results }, null, 2));
    process.exit(okCount === results.length ? 0 : 2);
  }

  // 健康表写回 README_HEALTH.md（CI 每日刷新；v2.0 写回目标，README 引用它）
  // v4.0：追加本次结果到历史 + 近7日成功率列
  const today = appendHistory(results);
  const hist = aggregateHistory();
  let toggles = {};
  try { toggles = parseToggles().toggles; }
  catch (e) { console.warn(`⚠️ 开关解析失败（${e.message}），死源建议不做启用过滤`); }
  const dead = collectDeadSources(hist, results)
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
      const hits = p.endpointKeys.map(k => results.find(r => r.url.includes(k))).filter(Boolean);
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
  lines.push('> ⚠️ **口径**：本表是"端点级"健康（服务是否活着）。v8.5 起对取链型端点（oiapi Kuwo/163、ikun、星海后端、溯音咪咕）增加真实取链 + 直链 Range 可播二次校验，失败标 `PAYLOAD_*`；但"端点可用 ≠ 音源可用"的残余风险仍存在——源级最终判据以 **App 健康面板（源内探针，带 Range 校验）** 为准。');
  lines.push('');
  lines.push(`共提取 ${results.length} 个端点，可用 ${okCount} 个；近 ${HISTORY_DAYS} 日成功率基于 \`docs/probe-history.jsonl\` 历史（${today} 追加）。`);
  lines.push('');
  lines.push(platformSummary());
  lines.push('');
  lines.push('| 端点 | 状态 | HTTP | 耗时(ms) | 近7日成功率 | 说明 |');
  lines.push('|---|---|---|---|---|---|');
  for (const r of results) {
    // v8.0：恢复标记——历史有失败但当前恢复了，加 🟡 "已恢复观察中"
    const h = hist[r.url];
    let tag = r.ok ? '✅ 可用' : '❌ 失败';
    if (r.ok && h && h.streak > 0) tag = '🟡 已恢复观察中';
    // v8.10.5：param 类端点（真实调用带参、裸探测恒 4xx）不判失败，避免健康表长期挂红误导
    const reg = registryByUrl().get(r.url);
    if (reg && reg.kind === 'param' && !r.ok) tag = '⚪ 不适用（需带参）';
    const reason = r.reason.length > 40 ? r.reason.slice(0, 40) + '…' : r.reason;
    const rateCell = h ? `${Math.round(h.rate * 100)}% (${h.ok}/${h.days}天)` : '—';
    lines.push(`| \`${r.url.slice(0, 70)}${r.url.length > 70 ? '…' : ''}\` | ${tag} | ${r.status || '-'} | ${r.time} | ${rateCell} | ${reason} |`);
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
      for (const d of urgent) lines.push(`- \`${d.url}\`：连续 ${d.streak} 天失败（近7日成功率 ${Math.round(d.rate * 100)}%），当前${d.currentOk ? '恢复可用' : '仍失败'}${d.reason ? ` · ${d.reason}` : ''}`);
      lines.push('');
    }
    if (minor.length) {
      lines.push('### 🟡 次要（备用/边缘端点连续失败）');
      lines.push('');
      for (const d of minor) lines.push(`- \`${d.url}\`：连续 ${d.streak} 天失败（近7日成功率 ${Math.round(d.rate * 100)}%），当前${d.currentOk ? '恢复可用' : '仍失败'}${d.reason ? ` · ${d.reason}` : ''}`);
    }
  }
  fs.writeFileSync(OUT, lines.join('\n') + '\n');
  console.log(`已写回 ${OUT}：${okCount}/${results.length} 可用，历史 ${today} 已追加`);

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

  if (updatedReadme !== readmeContent) {
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
  if (okCount < results.length) {
    console.log(`⚠️ 有 ${results.length - okCount} 个端点失败（非全挂，不阻断 CI）`);
  }
})();
