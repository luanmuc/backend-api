// ============================================================
// v9.0 业务层 · 17-health-check（健康巡检（调度/探活/结果应用/历史））
// 反向闭包裁剪出的自足簇；对遗留 legacy 符号走 dep(name) 依赖注入
// ============================================================
const { PROVIDER_LIFECYCLE } = require("./11-provider-meta.js");
const { HEALTH_CHECK_INTERVAL_MS, nextHealthCheckDelay } = require("./16-chain-misc.js");
const { sortChainByHealth } = require("./13-chain-helpers.js");
const { PLATFORM_QUALITIES } = require("./09-match.js");
const { httpRequest, getMobileUserAgent, upgradeToHttps, successCache, failCache } = require("./07-net.js");
const { ERROR_CODES } = require("./02-error-codes.js");
const { USER_CONFIG } = require("./02-config.js");
const { logInfo, logDebug } = require("./01-log.js");
const { qualityCeilingMap } = require("./09-match.js");
const { cfg } = require("./02-config.js");
const { recordHealthEvent } = require("./03-events.js");
const { logWarn } = require("./01-log.js");
const { extractErrorCode } = require("./05-verdict.js");
const { dep } = require("./06-binding.js");

function startHealthCheck() {
  const schedule = (delay) => {
    // F35：先记下次探测时间，快照/UI 才能给 ETA；真正触发时清空为 0。
    probeSchedule.nextAt = Date.now() + delay;
    return setTimeout(async () => {
    probeSchedule.nextAt = 0;
    probeSchedule.lastStartedAt = Date.now();
    if (hasActiveWork()) {
      const retry = Math.max(1000, Number(cfg('healthCheckPauseRetryMs', 60000)) || 60000);
      logDebug(`[健康探测] 检测到播放/取链流量，暂停本轮，${Math.round(retry / 1000)}s 后重试`);
      schedule(retry);
      return;
    }
    try { await runHealthCheck(); } catch (e) { logWarn(`健康探测异常: ${e.message}`); }
    schedule(nextHealthCheckDelay(cfg('healthCheckIntervalMs', HEALTH_CHECK_INTERVAL_MS)));
    }, delay);
  };
  schedule(HEALTH_CHECK_INITIAL_DELAY_MS);
}

const probeSchedule = { lastStartedAt: 0, nextAt: 0 };

function hasActiveWork() {
  let active = inflightUrl.size;
  for (const n of dep('inflightCount').values()) active += Number(n) || 0;
  return active > 0;
}

async function runHealthCheck(saveHistory = true) {
  if (dep('probeState').running) return;
  dep('probeState').running = true;
  try {  // v6.0：try/finally——构建配置等任何异常都不会把 running 锁死（否则探测链永久停摆）
  // v1.0：轮次先递增再构建配置，确保探测歌曲池轮换从首轮生效
  const round = (globalThis.__probeRound = (globalThis.__probeRound || 0) + 1);
  const probeConfig = buildProbeConfig();
  // v3.0：分级探测——核心源每轮，次要源每 PROBE_TIER_SECONDARY_INTERVAL 轮一探
  const ids = Object.keys(probeConfig).filter(id => tierShouldProbe(round, probeConfig[id].tier || "core", id));
  logInfo(`健康探测: 开始第${round}轮，共${ids.length}个源(核心每轮/次要${PROBE_TIER_SECONDARY_INTERVAL}轮一探)`);
  // v8.14：探测限并发，避免一轮把上游打出 429 再被判失败（探测 traffic 不得扰动被测系统）。
  const concurrency = Math.max(1, Math.min(8, Number(cfg('probeConcurrency', 3)) || 3));
  const queue = ids.slice();
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length) {
      const id = queue.shift();
      if (!id) break;
      const result = await probeSingleSource(id, probeConfig[id]);
      applyProbeResult(id, result.usable, result);
    }
  });
  await Promise.all(workers);
  const active = Object.keys(dep('userEnabled')).filter(dep('effectiveEnabled'));
  logInfo(`健康探测: 本轮完成，当前自动启用: ${active.join(", ")}`);
  // v8.0：记录历史快照（用于趋势图）——v30.1：手动探测不存历史，避免污染趋势
  if (saveHistory) {
    const snap = getHealthSnapshot();
    const historyEntry = {
      timestamp: Date.now(),
      sources: {}
    };
    for (const [id, item] of Object.entries(snap)) {
      if (id.startsWith('_')) continue; // 跳过平台聚合等特殊字段
      // v30.1：只存趋势图需要的字段（score + successRate），去掉多余的 name/enabled
      historyEntry.sources[id] = {
        score: item.healthScore,
        successRate: item.successRate
      };
    }
    healthHistory.push(historyEntry);
    if (healthHistory.length > HEALTH_HISTORY_MAX) healthHistory.shift();
  }
  } catch (e) {
    logWarn(`健康探测异常: ${e && e.message ? e.message : String(e)}`);
  } finally {
    dep('probeState').running = false; // v6.0：异常也释放探测锁
  }
}

const HEALTH_CHECK_INITIAL_DELAY_MS = 60 * 1000; // 加载后1分钟开始第一轮

const inflightUrl = new Map();

function buildProbeConfig() {
  const probePool = USER_CONFIG.probeSongPool;
  const probeSong = probePool[(globalThis.__probeRound || 0) % probePool.length];
  const probe163Id = PROBE_163_IDS[(globalThis.__probeRound || 0) % PROBE_163_IDS.length];
  const cfg = {
    // ---- 上链源：11 个 ----
    suyinKuwo: {
      tier: "core",
      probes: [
        {
          quality: "flac",
          useHandler: true,
          songName: probeSong,
        },
        {
          quality: "320k",
          useHandler: true,
          songName: probeSong,
        },
        {
          quality: "128k",
          useHandler: true,
          songName: probeSong,
        }
      ]
    },
    xinghaiBackend: {
      tier: "core",
      quality: "128k",
      useHandler: true,
      handlerPlatform: "kw",
      handlerSong: { name: "晴天", singer: "周杰伦", songmid: "228908", id: "228908", duration: 271000 },
    },
    suyin163: {
      tier: "core",
      quality: "128k",
      useHandler: true,
      // v9.1.1（探针误报）：此源注册的是 5 参包装 (platform, songId, quality, songInfo, cancelToken)，
      // 旧配置标了「songInfo 风格」→ 走两参调用 → hSong 被塞进 platform、songId=null，
      // 内层 suyin163GetUrl(songInfo=undefined) 必抛「缺少songmid/id」→ 探测 100% 假失败。
      handlerPlatform: "wy",
      handlerSong: { id: probe163Id, songmid: probe163Id, name: "晴天", singer: "周杰伦", duration: 271000 },
    },
    wyOuter: {
      tier: "core",
      quality: "128k",
      useHandler: true,
      handlerPlatform: "wy",
      handlerSong: { id: "2652820720", songmid: "2652820720", name: "晴天", singer: "周杰伦", duration: 271000 },
    },
    kuwoOfficial: {
      tier: "secondary",
      quality: "128k",
      useHandler: true,
      handlerPlatform: "kw",
      handlerSong: { name: "晴天", singer: "周杰伦", duration: 271000 },
    },
    helloworldKw: {
      tier: "secondary",
      quality: "flac",
      useHandler: true,
      handlerPlatform: "kw",
      handlerSong: { rid: "228908", name: "晴天", duration: 0 },
    },
    changqingVip: {
      tier: "secondary",
      quality: "128k",
      useHandler: true,
      handlerPlatform: "kw",
      handlerSong: { rid: "228908", songmid: "228908", id: "228908", name: "晴天", singer: "周杰伦", duration: 271000 },
    },
    juheTx: juheProbeCfg("tx", { songmid: "228908", id: "228908", quality: "128k" }),
    qingliangTx: {
      tier: "secondary",
      quality: "128k",
      useHandler: true,
      handlerPlatform: "tx",
      handlerSong: { songmid: "0039MnYb0qxYhV", name: "晴天", singer: "周杰伦", duration: 269000 },
    },
    ikun: {
      tier: "secondary",
      quality: "128k",
      useHandler: true,
      handlerPlatform: "kw",
      handlerSong: { name: "晴天", singer: "周杰伦", songmid: "228908", id: "228908", duration: 271000 },
    },
    huibq: {
      tier: "secondary",
      quality: "128k",
      useHandler: true,
      handlerPlatform: "kw",
      handlerSong: { name: "晴天", singer: "周杰伦", songmid: "228908", id: "228908", duration: 271000 },
    },
    // ---- 观察源：2 个（只探测，不进链） ----
    suyinQQ: {
      tier: "secondary",
      probes: [
        {
          quality: "128k",
          useHandler: true,
          handlerPlatform: "tx",
          handlerSong: { songmid: "0039MnYb0qxYpD", name: "晴天", duration: 0 },
        },
        {
          quality: "320k",
          useHandler: true,
          handlerPlatform: "tx",
          handlerSong: { songmid: "0039MnYb0qxYpD", name: "晴天", duration: 0 },
        }
      ]
    },
    suyinMigu: {
      tier: "secondary",
      quality: "128k",
      useHandler: true,
      // v9.1.1：与 suyin163 同一类错配——注册是 5 参包装，旧配置却走两参调用。
      handlerPlatform: "mg",
      handlerSong: { name: "晴天", singer: "周杰伦", duration: 271000 },
    }
  };
  // 单一路径：生产探测只走 handler；URL/check/headers 等旧探针字段一律不进入运行时配置。
  const handlerOnly = (p) => {
    if (!p || !p.useHandler) return p;
    for (const k of ["url", "method", "body", "headers", "check", "checkRes", "extractUrl"]) delete p[k];
    return p;
  };
  for (const id of Object.keys(cfg)) {
    if (Array.isArray(cfg[id].probes)) cfg[id].probes = cfg[id].probes.map(handlerOnly);
    else cfg[id] = handlerOnly(cfg[id]);
  }
  // 休眠源过滤——连续 PROBE_SLEEP_AFTER_DEAD 轮失败后不再每轮空打；
  // 每 PROBE_WAKE_EVERY_ROUND 轮做一次复活试探（上游恢复/新端点时自动回归）
  const round = globalThis.__probeRound || 0;
  for (const id of Object.keys(cfg)) {
    if (!dep('SOURCE_HANDLERS')[id]) { delete cfg[id]; continue; }
    // v8.14：只有用户关闭才排除探测；autoOff 源必须继续探测才能自动恢复。
    if (dep('manualOff')[id]) { delete cfg[id]; continue; }
    // 默认关闭的观察源（probation）仍要探测以观察上游；默认关闭的非观察源不探测。
    const probation = dep('SOURCE_HANDLERS')[id].lifecycle === "probation";
    if (!probation && !dep('isUserEnabled')(id)) { delete cfg[id]; continue; }
    if (dep('probeState').sleeping[id]) {
      const since = dep('probeState').sleepRound[id] || 0;
      if (round - since < PROBE_WAKE_EVERY_ROUND) {
        delete cfg[id];
      } else {
        logWarn(`健康探测: [${id}] 到达复活试探轮，重探`);
        recordHealthEvent({ event: "health_transition", sourceId: id, from: "SLEEPING", to: "PROBING", reason: "probe_wake" });
      }
    }
  }
  // F24：生产配置标记每轮至少两首不同歌；单目标源由 probeSingleSource 补第二首。
  const pool = USER_CONFIG.probeSongPool;
  const roundNo = globalThis.__probeRound || 0;
  for (const pc of Object.values(cfg)) {
    if (!pc || typeof pc !== "object") continue;
    pc.twoSong = true;
    const targets = pc.probes || [pc];
    targets.forEach((t, i) => {
      const song = pool[(roundNo + i) % pool.length];
      if (t.handlerSong) t.handlerSong = Object.assign({}, t.handlerSong, { name: song });
      else t.songName = song;
    });
  }
  return cfg;
}

function tierShouldProbe(round, tier, sourceId) {
  const interval = tier === "secondary" ? cfg("probeTierSecondaryInterval", PROBE_TIER_SECONDARY_INTERVAL) : cfg("probeTierCoreInterval", PROBE_TIER_CORE_INTERVAL);
  if (round % interval !== 0) return false;
  // v4.0/v6.0：探测频率自适应——连续通过≥5轮的源降频为每2轮一探（健康源无需高频验证，省上游外呼）
  // v6.0 修复：改用 passStreak（连续通过轮数）判定——旧实现用 passCount，但 passCount 到 2 即清零，降频从未生效
  if (sourceId && (dep('probeState').passStreak[sourceId] || 0) >= 5 && round % 2 !== 0) return false;
  return true;
}

async function probeSingleSource(id, pc) {
  dep('probeState').lastProbeAt[id] = Date.now();
  // v8.10.3：形参从 cfg 改名 pc —— 旧名遮蔽了全局配置读取函数 cfg(key, def)，
  // 而下面冷启动分支要调 cfg('coldStartProbeTimeoutMs')，直接 TypeError 被 catch 吞成"探测失败"。
  // 全仓唯一 coldStart 源是 huibq。注意「探针 100% 失败」的说法已被证伪：
  // probe-history 显示 11-04~11-15 连续 12 天 200（正常响应、score 正常）；
  // 真正 100% 失败的是 11-16 之后——那是 owner 暂停服务（503 Service Suspended），不是冷启动。
  // v8.14：逐目标三值探测。每个质量档单独给 PASS/FAIL/UNKNOWN，源级只做聚合：
  //   任一目标 PASS = 源可达（但不能证明所有档可交付）；全部 FAIL = 源失败；否则 UNKNOWN。
  let probes = pc.probes || [{
    quality: pc.quality,
    useHandler: pc.useHandler,
    songName: pc.songName,
    handlerSong: pc.handlerSong,
    handlerPlatform: pc.handlerPlatform,
    handlerStyle: pc.handlerStyle,
    url: pc.url,
    // v8.2 修复：method/body 漏透传——juheProbeCfg(juhe 五源)与 ikun 探针都是 POST 协议型源，
    // 旧实现只透传 url/headers/check，实际发出 GET → 上游 404/405 误判失败（juhe 探测长期"失败"的隐藏原因之一）
    method: pc.method,
    body: pc.body,
    headers: pc.headers,
    check: pc.check,
    checkRes: pc.checkRes,
    extractUrl: pc.extractUrl
  }];
  // F24：每轮至少两首不同歌；多目标按目标轮换，单目标补第二首（不改变生产配置形状）。
  if (pc.twoSong) {
    const pool = USER_CONFIG.probeSongPool;
    const round = globalThis.__probeRound || 0;
    const songAt = (i) => pool[(round + i) % pool.length];
    if (probes.length < 2) {
      const second = songAt(1);
      probes = [Object.assign({}, probes[0], { songName: second, handlerSong: probes[0].handlerSong ? Object.assign({}, probes[0].handlerSong, { name: second }) : probes[0].handlerSong })];
      probes.unshift(Object.assign({}, probes[0], { songName: songAt(0), handlerSong: probes[0].handlerSong ? Object.assign({}, probes[0].handlerSong, { name: songAt(0) }) : probes[0].handlerSong }));
    } else {
      probes = probes.map((p, i) => {
        const song = songAt(i);
        return Object.assign({}, p, { songName: song, handlerSong: p.handlerSong ? Object.assign({}, p.handlerSong, { name: song }) : p.handlerSong });
      });
    }
  }
  const traceId = `probe:${globalThis.__probeRound || 0}:${id}`;
  try {
    const results = await Promise.all(probes.map(async p => {
      const startProbe = Date.now();
      const quality = p.quality || pc.quality || null;
      try {
        // v8.10：冷启动源探针超时放宽（onrender 冷态 30s，6s 必误判）
        const h = dep('SOURCE_HANDLERS')[id];
        const probeTimeout = (h && h.coldStart) ? cfg('coldStartProbeTimeoutMs', 30000) : HEALTH_CHECK_TIMEOUT;
        if (p.useHandler) {
          // v8.14：优先复用真实 handler 的取链路径，避免探针维护第二套 URL/解析规则；
          // handler 抛错时直接按三值失败（UNKNOWN/FAIL）返回，不回退旧 URL 探针——
          // 生产配置已无 URL 字段，回退旧探针既无输入可用，也会重新引入双路径。
          try {
            const h = dep('SOURCE_HANDLERS')[id];
            if (h && typeof h.fn === "function") {
              const hSong = p.handlerSong || { name: p.songName, duration: 0 };
              // 少数源的签名是 (songInfo, cancelToken)，用显式风格标记适配，不硬套五参。
              const url = p.handlerStyle === "songInfo"
                ? await h.fn(hSong, null)
                // v9.1.1（探针误报）：第二个参数是 songId，旧实现写死空串 ""。
                // 而各 handler 取 id 都是 `songId ?? songInfo?.id` —— `??` 只对 null/undefined 生效，
                // 空串会被当成"有值"选中，随后 `if (!id)` 抛 PARAM_ERROR（0~1ms，一个字节都没发出去），
                // 于是 wyOuter / xinghaiBackend / suyin163 的探测 100% 假失败、健康分被白扣。
                // 传 null 让 handler 自己的 songInfo 兜底生效（不写死某个字段，保留各源的多字段兜底）。
                : await h.fn(p.handlerPlatform || "kw", null, quality, hSong, null);
              const playable = typeof url === "string" && await dep('isAudioPlayable')(upgradeToHttps(url), probeTimeout);
              const duration = Date.now() - startProbe;
              recordHealthEvent({ event: "probe_result", traceId, sourceId: id, quality, ok: playable, code: playable ? "" : "PROBE_FAIL", latencyMs: duration, reason: playable ? "PASS" : "FAIL" });
              return { usable: playable, outcome: playable ? "PASS" : "FAIL", code: playable ? "" : "PROBE_FAIL", quality, duration, viaHandler: true };
            }
          } catch (e) {
            if (typeof logDebug === "function") logDebug(`[探测] ${id} handler 探针失败：${extractErrorCode(e)}`);
            throw e;
          }
        }
        // 低层显式 url 仅用于审计夹具；生产 buildProbeConfig 不再输出任何 URL 字段。
        const res = await httpRequest(p.url || "", {
          method: p.method || "GET",
          headers: { "User-Agent": getMobileUserAgent(), ...(p.headers || {}) },
          body: p.body,
          timeout: probeTimeout,
          follow_max: 5   // v1.0 P0：统一跟随302，修复wyOuter(outer 302→mp3)被误判失败
        });
        let usable = p.checkRes ? p.checkRes(res) : (p.check ? p.check(res.body) : true);
        // v1.0 P0：结构/状态通过后，对解析出的音频URL做Range可播性二次校验，
        // 识破"网关200、结构完整、但CDN签名已过期410死链"的假存活(如溯音酷我)
        if (usable && typeof p.extractUrl === "function") {
          const audioUrl = p.extractUrl(res.body);
          usable = audioUrl ? await dep('isAudioPlayable')(audioUrl, probeTimeout) : false; // v8.10：冷启动源可播校验同放宽
        }
        const outcome = usable ? "PASS" : "FAIL";
        const duration = Date.now() - startProbe;
        recordHealthEvent({ event: "probe_result", traceId, sourceId: id, quality, ok: usable, code: usable ? "" : "PROBE_FAIL", latencyMs: duration, reason: outcome });
        return { usable, outcome, code: usable ? "" : "PROBE_FAIL", quality, duration };
      } catch (e) {
        const duration = Date.now() - startProbe;
        const classified = probeErrorOutcome(e);
        recordHealthEvent({ event: "probe_result", traceId, sourceId: id, quality, ok: false, code: classified.code, latencyMs: duration, reason: classified.outcome });
        return { usable: false, outcome: classified.outcome, code: classified.code, quality, duration };
      }
    }));
    for (const r of results) if (r.quality) {
      const at = dep('probeState').lastProbeAt[id] || Date.now();
      qualityLastProbeAt.set(`${id}|${r.quality}`, at);
      const slot = dep('qualityLedger')(dep('getBreaker')(id), r.quality);
      slot.lastProbeAt = at;
    }
    const passCount = results.filter(r => r.outcome === "PASS").length;
    const failCount = results.filter(r => r.outcome === "FAIL").length;
    const unknownCount = results.filter(r => r.outcome === "UNKNOWN").length;
    const outcome = passCount > 0 ? "PASS" : failCount > 0 ? "FAIL" : "UNKNOWN";
    const usable = outcome === "PASS";
    const code = passCount > 0 ? "" : (results.find(r => r.code) || {}).code || (outcome === "UNKNOWN" ? "PROBE_UNKNOWN" : "PROBE_FAIL");
    // v1.0：探测结果并入竞速统计（成功率/均时供 sortChainByHealth 排序复用；
    // 只更新统计、不触发熔断——熔断仅由真实播放请求触发，避免探测与熔断双机制打架）
    recordProbeResult(id, usable, results.reduce((s, r) => s + r.duration, 0) / Math.max(results.length, 1));
    return {
      usable,
      outcome,
      code,
      results,
      targets: results.map(r => ({ quality: r.quality, outcome: r.outcome, code: r.code || null, latencyMs: r.duration, viaHandler: !!r.viaHandler })),
      passCount,
      failCount,
      unknownCount,
      viaHandler: results.some(r => r.viaHandler === true),
      raw: null
    };
  } catch (e) {
    const classified = probeErrorOutcome(e);
    recordHealthEvent({ event: "probe_result", traceId, sourceId: id, ok: false, code: classified.code, latencyMs: 0, reason: classified.outcome });
    recordProbeResult(id, false, 0);
    return { usable: false, outcome: classified.outcome, code: classified.code, results: [], targets: [], passCount: 0, failCount: 0, unknownCount: 0, raw: null };
  }
}

function applyProbeResult(id, usable, detail = {}) {
  const outcome = detail.outcome || (usable ? "PASS" : "FAIL");
  if (Array.isArray(detail.targets) && detail.targets.length) dep('probeState').lastTargets[id] = detail.targets.map(t => ({ quality: t.quality || null, outcome: t.outcome || outcome, code: t.code || null, latencyMs: Number(t.latencyMs || 0) }));
  // v8.14：三值探测。本地网络/DNS/超时不能当“源已死”证据，只记录不累计失败。
  if (outcome === "UNKNOWN") {
    dep('probeState').passCount[id] = 0;
    dep('probeState').passStreak[id] = 0;
    logInfo(`健康探测: [${id}] 结果 UNKNOWN（本地网络/超时/未取证），不关闭、不累计失败`);
    recordHealthEvent({ event: "health_transition", sourceId: id, reason: "probe_unknown" });
    return { outcome, enabled: dep('effectiveEnabled')(id), autoOff: !!dep('autoOff')[id] };
  }
  if (usable) {
    // v8.10.3：探测通过 → 复位断路器与限流退避（仅“可达性”证据，不等价于真实播放成功）
    const br = dep('getBreaker')(id);
    if (br.state !== "closed" || br.failureCount > 0 || br.rateLimited) {
      br.state = "closed"; br.failureCount = 0; br.lastFailureTime = 0;
      br.rateLimitUntil = 0; br.rateLimited = false; br.rateLimitCount = 0;
      logInfo(`健康探测: [${id}] 探测通过，断路器与限流退避已复位`);
    }
    dep('probeState').failCount[id] = 0;
    dep('probeState').passCount[id] = (dep('probeState').passCount[id] || 0) + 1;
    dep('probeState').passStreak[id] = (dep('probeState').passStreak[id] || 0) + 1;
    // v8.14：探测通过不再清 playDead/resolveDead。播放失败只能由真实取链/播放成功解除；
    // 探针只证明“源可达”，不能证明“真实歌曲可交付”，否则会制造假阳性复活。
    // v3.0：探测通过即清休眠（休眠是探测态，不是播放态）。
    delete dep('probeState').deadCount[id];
    delete dep('probeState').sleeping[id];
    delete dep('probeState').sleepRound[id];
    delete dep('probeState').sleepAt[id];
    if (dep('probeState').passCount[id] >= PROBE_PASS_REQUIRED) {
      const h = dep('SOURCE_HANDLERS')[id];
      const canAutoOn = dep('isUserEnabled')(id) && !dep('manualOff')[id];
      if (h && h.lifecycle === PROVIDER_LIFECYCLE.PROBATION) {
        logInfo(`健康探测: [${id}] 观察源探测通过（保持不进链，复核日 ${h.reviewAt || "未定"}）`);
      } else if (canAutoOn && dep('autoOff')[id]) {
        const from = "AUTO_OFF";
        delete dep('autoOff')[id];
        delete dep('autoOffReason')[id];
        delete dep('autoOffAt')[id];
        logInfo(`健康探测: [${id}] 连续${PROBE_PASS_REQUIRED}次探测通过，自动关闭已解除（AUTO_ON_PROBE）`);
        recordHealthEvent({ event: "health_transition", sourceId: id, from, to: "ELIGIBLE", reason: "auto_on_probe" });
      }
      dep('probeState').passCount[id] = 0;
    }
  } else {
    dep('probeState').passCount[id] = 0;
    dep('probeState').passStreak[id] = 0;
    dep('probeState').failCount[id] = (dep('probeState').failCount[id] || 0) + 1;
    if (dep('probeState').failCount[id] >= PROBE_FAIL_REQUIRED) {
      const h = dep('SOURCE_HANDLERS')[id];
      const isColdStart = h && h.coldStart;
      const shouldAutoOff = dep('isUserEnabled')(id) && !dep('manualOff')[id] && !isColdStart && !dep('autoOff')[id];
      if (shouldAutoOff) {
        dep('autoOff')[id] = true;
        dep('autoOffReason')[id] = "AUTO_OFF_PROBE";
        dep('autoOffAt')[id] = Date.now();
        logWarn(`健康探测: [${id}] 连续${PROBE_FAIL_REQUIRED}次探测失败，已自动关闭（AUTO_OFF_PROBE，恢复后自动探测开启）`);
        recordHealthEvent({ event: "health_transition", sourceId: id, from: "ELIGIBLE", to: "AUTO_OFF", reason: "auto_off_probe" });
      } else if (isColdStart) {
        logWarn(`健康探测: [${id}] 连续${PROBE_FAIL_REQUIRED}次探测失败，冷启动豁免自动关闭（冷态可能未唤醒，保留启用）`);
      }
      dep('probeState').failCount[id] = 0;
    }
    // v3.0：连续失败累计 → 休眠（不再每轮空打无效请求）
    dep('probeState').deadCount[id] = (dep('probeState').deadCount[id] || 0) + 1;
    if (dep('probeState').deadCount[id] >= PROBE_SLEEP_AFTER_DEAD) {
      if (!dep('probeState').sleeping[id]) {
        dep('probeState').sleeping[id] = true;
        dep('probeState').sleepRound[id] = globalThis.__probeRound || 0;
        dep('probeState').sleepAt[id] = Date.now();
        logWarn(`健康探测: [${id}] 连续${PROBE_SLEEP_AFTER_DEAD}轮失败，进入休眠(每${PROBE_WAKE_EVERY_ROUND}轮复活试探一次)`);
        recordHealthEvent({ event: "health_transition", sourceId: id, from: dep('autoOff')[id] ? "AUTO_OFF" : "ELIGIBLE", to: "SLEEPING", reason: "probe_sleep" });
      } else {
        dep('probeState').sleepRound[id] = globalThis.__probeRound || 0;
      }
    }
  }
  return { outcome, enabled: dep('effectiveEnabled')(id), autoOff: !!dep('autoOff')[id], reason: dep('autoOffReason')[id] || null };
}

function getHealthSnapshot() {
  const snapshot = {};
  for (const id of Object.keys(dep('SOURCE_HANDLERS'))) {
    const h = dep('SOURCE_HANDLERS')[id];
    const stats = getSourceStats(id);
    const score = computeHealthScore(id);
    // 方案 6.2 I1：快照必须给只读裁决，链/跳过/执行门/面板不再各自解释状态。
    // v8.16.2（R-04）：快照必须与链同源——旧实现用 runtime:false，computeEligibility 直接提前
    // return eligible=true，把熔断/限流/半开/预览冷却/档位短路全部跳过；同一份快照里
    // _platformSummary 却由 buildSourceChain(runtime:true) 算出，两口径互相打脸（App 面板显示
    // 「可用」而实际一次都不发请求）。改为 runtime:true + peekRuntime:true：只读运行态，不推进
    // open→half-open、不消费半开 trial。
    const gatePlatforms = (h.platforms || []).filter(p => h.chain && h.chain[p] != null);
    const gatePlatform = gatePlatforms[0] || (h.platforms || [])[0] || null;
    const gate = dep('computeEligibility')(id, gatePlatform, "128k", { runtime: true, peekRuntime: true, consumePlayDeadTrial: false });
    // R-12④：多平台源只测首个有链平台 → 逐平台只读资格另发一份，面板不再把「kw 可用」当成全平台可用。
    const platformEligibility = {};
    for (const p of gatePlatforms) {
      const pe = p === gatePlatform ? gate : dep('computeEligibility')(id, p, "128k", { runtime: true, peekRuntime: true, consumePlayDeadTrial: false });
      platformEligibility[p] = { eligible: pe.eligible, reason: pe.reason, code: pe.code };
    }
    const offState = getHealthOffState(id, h);
    snapshot[id] = {
      name: h.name,
      maxQuality: h.maxQuality,
      lifecycle: h.lifecycle,
      upstreamGroup: h.upstreamGroup,
      auth: h.auth,
      reviewAt: h.reviewAt,
      platforms: h.platforms,
      enabled: dep('effectiveEnabled')(id),
      // v8.14：开关权威拆分。App 必须能区分“用户关闭 / 系统自动关闭 / 休眠 / 默认关闭”，
      // 不能再只拿 enabled=false 猜原因。
      userEnabled: dep('isUserEnabled')(id),
      autoOff: !!dep('autoOff')[id],
      offReason: offState.offReason,
      offAt: offState.offAt,
      // 方案 6.2 I1：allowed/reason/code/until 与 computeEligibility 同源，只读不写状态。
      eligible: gate.eligible,
      eligibilityReason: gate.reason,
      eligibilityCode: gate.code,
      eligibilityUntilMs: gate.untilMs,
      // R-12④：多平台源的逐平台只读资格（键=该源真正有链的平台）
      platformEligibility,
      autoOffReason: dep('autoOffReason')[id] || null,
      autoOffAt: dep('autoOffAt')[id] || 0,
      probeTargets: ((dep('probeState').lastTargets && dep('probeState').lastTargets[id]) || []).map(t => ({ ...t, at: Number(dep('probeState').lastProbeAt[id] || 0) })),
      // F35：最近一次探测、下次探测时间与 ETA；没有调度时均为 0，UI 不编造时间。
      lastProbe: Number((dep('probeState').lastProbeAt && dep('probeState').lastProbeAt[id]) || 0),
      nextProbe: Number(probeSchedule.nextAt || 0),
      probeEtaMs: probeSchedule.nextAt ? Math.max(0, probeSchedule.nextAt - Date.now()) : 0,
      // F45/F46：本地限速/冷启动只读可见，不参与 eligible，更不触发自动关闭。
      localThrottle: peekThrottle(id),
      coldStart: h.coldStart ? (() => {
        const warmAt = Number(dep('coldStartWarmAt').get(id) || 0);
        const warmUntil = warmAt ? warmAt + cfg("coldStartWarmTtlMs", 300000) : 0;
        return { active: warmAt > 0 && Date.now() < warmUntil, reason: "COLD_START", warmUntil };
      })() : null,
      successRate: stats.successRate,
      avgTime: stats.avgTime,
      state: stats.state,
      // v6.0：真实播放请求最后使用时间戳（App 五级分区'使用中'判定；0=从未用过）
      lastUsedAt: dep('lastUsedAt').get(id) || 0,
      // v4.0：样本计数（App 显示采样数；无样本的 successRate/avgTime 为 null → 显示"-"）
      reqCount: stats.reqCount,
      probeCount: stats.probeCount,
      // v4.0：休眠状态（连续失败轮休眠，每 PROBE_WAKE_EVERY_ROUND 轮复活试探；App 显示"休眠中"）
      sleeping: !!dep('probeState').sleeping[id],
      wakeEtaMs: (() => {
        if (!dep('probeState').sleeping[id]) return 0;
        const since = dep('probeState').sleepRound[id] || 0;
        const round = globalThis.__probeRound || 0;
        const remain = Math.max(0, PROBE_WAKE_EVERY_ROUND - (round - since));
        return remain * cfg("healthCheckIntervalMs", 600000);
      })(),
      // v4.0：版权/业务失败计数（无版权歌等；App 面板可在后续版本展示）
      copyrightFail: stats.copyrightFail,
      // v4.0：按音质分档统计（面板后续版本可消费）
      byQuality: Object.fromEntries(Object.entries(stats.byQuality || {}).map(([q, v]) => [q, Object.assign({}, v, { lastProbeAt: Number(qualityLastProbeAt.get(`${id}|${q}`) || 0) })])),
      // v8.14（F43）：质量档短路必须可见，不再只存在于链构建内部判断
      // R-12④：用与 gate 同一平台（旧实现固定 platforms[0]，多平台源测的平台与 gate 不是同一个）
      qualityShortCircuit: Object.fromEntries(["128k", "320k", "flac", "flac24bit"].map(q => [q, dep('isQualityHopeless')(id, q, gatePlatform, { setProbe: false })])),
      // v7.0：播放实时摘除状态（连续播放失败被摘除；App 可显示"已摘除"）
      playDead: dep('isPlayDead')(id),
      resolveDead: dep('isResolveDead')(id),
      // v4.0：限流状态（被限=连续429，App 显示"被限"而非"熔断"）
      rateLimited: !!dep('getBreaker')(id).rateLimited,
      rateLimitCount: dep('getBreaker')(id).rateLimitCount || 0,
      // 第五轮审计：面板"限流中"必须能亮。rateLimited（连续 3 次被上游真拒）在串行使用中不可达——
      // 第一次 429 就把 rateLimitUntil 推后 30s，后续请求被 canExecute 本地拦下、不构成新证据。
      // 所以另给"当前是否处于退避期"的派生值供面板用，与"已被风控"这个强标记分开：
      // rateLimitActive=true 表示"现在这个源不参与竞速"，rateLimited=true 表示"历史上被拒多次"。
      rateLimitUntil: dep('getBreaker')(id).rateLimitUntil || 0,
      rateLimitActive: (dep('getBreaker')(id).rateLimitUntil || 0) > Date.now(),
      // v6.0：最近成功交付音质（音质协商链降档后诊断用）
      lastQuality: dep('getBreaker')(id).lastQuality || null,
      // v7.0：健康分输出改 10 分制（0~10，一位小数）——内部评分仍为 0~1（排序/熔断逻辑不变），
      // 仅快照输出 ×10 换算，配合 App 健康面板直观显示；负分保留（异常源 App 标红）
      healthScore: Number((score.score * 10).toFixed(1))
    };
  }
  // v8.0：平台级降级聚合（按平台分组子源，判断某平台全部启用子源是否失效）
  // v8.10.3：平台分组不再手写——旧实现漏了"链构建会对所有非 kw 平台追加 suyinKuwo"这一事实
  // （wy/tx/mg/kg 的分组清单都没列它），导致这些平台只剩 suyinKuwo 活着时被判"无活跃源/全挂"。
  // 现改为按各音质把 buildSourceChain 的结果取并集：分组与竞速链永远一致，不会再漂移。
  const PLATFORM_GROUPS = {};
  const eligibleByPlatform = {};
  for (const p of Object.keys(PLATFORM_QUALITIES)) {
    const all = new Set();
    const eligible = new Set();
    for (const q of ["128k", "320k", "flac", "flac24bit"]) {
      for (const h of dep('buildSourceChain')(p, q)) eligible.add(h.id);
    }
    for (const id of Object.keys(dep('SOURCE_HANDLERS'))) if (dep('SOURCE_HANDLERS')[id] && (dep('SOURCE_HANDLERS')[id].platforms || []).includes(p)) all.add(id);
    PLATFORM_GROUPS[p] = [...all];
    eligibleByPlatform[p] = eligible;
  }
  const platformSummary = {};
  const healthyPlatforms = [];
  for (const [platform, sourceIds] of Object.entries(PLATFORM_GROUPS)) {
    // F17/F68：先看用户启用，再按 eligibility 聚合；open/half/playDead/sleeping/短路源不得算 active。
    const enabledSources = sourceIds.filter(id => snapshot[id] && snapshot[id].enabled);
    if (!enabledSources.length) {
      platformSummary[platform] = { degraded: false, reason: "no_active_sources", activeCount: 0, eligibleCount: 0, deadCount: 0, offCount: sourceIds.length, blockedCount: 0, degradedCount: 0 };
      continue;
    }
    const eligible = eligibleByPlatform[platform] || new Set();
    const eligibleSources = enabledSources.filter(id => eligible.has(id));
    const blockedCount = enabledSources.length - eligibleSources.length;
    const offCount = sourceIds.length - enabledSources.length;
    // F17：degraded 只算“仍 eligible 但分数 <3”的源；blocked 是已被资格门拦下的源，二者不再混为 dead。
    const degradedCount = eligibleSources.filter(id => (snapshot[id].healthScore || 0) < 3).length;
    const deadCount = blockedCount;
    const allDead = eligibleSources.length === 0;
    const avgScore = eligibleSources.length
      ? eligibleSources.reduce((sum, id) => sum + (snapshot[id].healthScore || 0), 0) / eligibleSources.length
      : 0;
    platformSummary[platform] = {
      degraded: allDead,
      reason: allDead ? "no_eligible_sources" : null,
      activeCount: eligibleSources.length,
      eligibleCount: eligibleSources.length,
      deadCount,
      offCount,
      blockedCount,
      degradedCount,
      totalCount: sourceIds.length,
      avgScore: Math.round(avgScore * 10) / 10,
    };
    if (!allDead) healthyPlatforms.push({ platform, avgScore });
  }
  // v8.13：单源平台风险必须随健康快照显式下发；面板不得把 mg/kg 单源显示成“健康”。
  snapshot._coverageGaps = dep('KNOWN_COVERAGE_GAPS').map(g => Object.assign({}, g));
  snapshot._platformRisk = {};
  for (const g of dep('KNOWN_COVERAGE_GAPS')) {
    snapshot._platformRisk[g.platform] = { risk: g.risk, reason: g.reason, reviewAt: g.reviewAt || null };
  }
  snapshot._platformSummary = platformSummary;
  // v30.1：兜底平台选健康分最高的（不再是第一个）
  healthyPlatforms.sort((a, b) => b.avgScore - a.avgScore);
  snapshot._fallbackPlatform = healthyPlatforms[0]?.platform || null;
  // 五轮 MEM：缓存/记忆表的条目数（长跑内存占用的唯一可观测口径，供巡检与断言读取）
  snapshot._memory = {
    successCache: successCache.size(),
    failCache: failCache.size(),
    deliveryQuality: dep('deliveryQualityMap').size,
    fragmentSource: dep('fragmentSourceMap').size,
    qualityCeiling: qualityCeilingMap.size,
    fragmentUrl: dep('fragmentUrlMap').size,
    handlerSongs: [...dep('fragmentHandlerSongsMap').values()].reduce((n, e) => n + (e && e.mids ? e.mids.size : 0), 0),
    limit: Math.max(1, Number(cfg('memoryMapMax', dep('MEMORY_MAP_MAX'))) || dep('MEMORY_MAP_MAX'))
  };
  return snapshot;
}

const healthHistory = [];

const HEALTH_HISTORY_MAX = 1008; // F07：历史快照上限 1008（10min/条 ≈ 7d，144≈24h 已不够 7d 趋势）

const PROBE_163_IDS = ["2652820720", "347230"];

function juheProbeCfg(platform, ids) {
  return {
    tier: "secondary",  // 每3轮一探（免费 worker，减少对限流中上游的打扰）
    useHandler: true,
    handlerPlatform: platform,
    handlerSong: { name: "晴天", singer: "周杰伦", duration: 271000, ...ids },
  };
}

const PROBE_WAKE_EVERY_ROUND = 10;

const PROBE_TIER_SECONDARY_INTERVAL = 3;

const PROBE_TIER_CORE_INTERVAL = 1;

const HEALTH_CHECK_TIMEOUT = 6000;                // 单次探测超时(v1.0:4000→6000，减少误摘)

function probeErrorOutcome(e) {
  const code = extractErrorCode(e);
  const msg = String((e && e.message) || "");
  // 只有“本地没拿到可信响应”的超时/连接错误才是 UNKNOWN；HTTP 4xx/5xx 是上游明确失败。
  if (code === ERROR_CODES.NETWORK_TIMEOUT) return { outcome: "UNKNOWN", code };
  if (code === ERROR_CODES.NETWORK_ERROR && !/^NETWORK_ERROR:\s*HTTP\s+\d+/i.test(msg)) return { outcome: "UNKNOWN", code };
  return { outcome: "FAIL", code };
}

const qualityLastProbeAt = new Map();

function recordProbeResult(id, usable, avgDuration) {
  const b = dep('getBreaker')(id);
  b.probeRequests = (b.probeRequests || 0) + 1;
  if (usable) {
    b.probeSuccess = (b.probeSuccess || 0) + 1;
    b.probeTime = (b.probeTime || 0) + (avgDuration || 0);
  }
}

const PROBE_PASS_REQUIRED = 2;                    // 连续通过2次才判定可用（防抖动）

const PROBE_FAIL_REQUIRED = 2;                    // 连续失败2次才判定失效（防抖动）

const PROBE_SLEEP_AFTER_DEAD = 3;

function getSourceStats(sourceId) {
  const b = dep('getBreaker')(sourceId);
  // v4.0：无样本时返回 null（App 显示"-"），不再用 1/9999 误导；同时暴露样本计数
  const reqCount = b.totalRequests || 0;
  const probeCount = b.probeRequests || 0;
  // v4.0：有效请求 = 总请求 - 版权/业务失败（无版权歌不惩罚源）；全部都是版权失败 → 无有效样本
  const validCount = Math.max(reqCount - (b.copyrightFail || 0), 0);
  return {
    successRate: validCount === 0 ? null : b.totalSuccess / validCount,
    avgTime: b.totalSuccess === 0 ? null : b.totalTime / b.totalSuccess,
    state: b.state,
    reqCount,
    probeCount,
    copyrightFail: b.copyrightFail || 0,
    // v4.0：按音质分档 { quality: {rate, avgTime, req, success, businessFail} }——flac 坏但 128k 好的源可精确呈现
    byQuality: Object.fromEntries(Object.entries(b.byQuality || {}).map(([quality, q]) => {
      const valid = Math.max(q.req - q.businessFail, 0);
      return [quality, {
        rate: valid === 0 ? null : q.success / valid,
        avgTime: q.success === 0 ? null : q.time / q.success,
        req: q.req, success: q.success, fail: q.fail, businessFail: q.businessFail,
        // F39/F41：按档熔断/限流状态必须能被快照/诊断读到，不再只看源级 state。
        state: q.breaker ? q.breaker.state : 'closed',
        rateLimited: !!q.rateLimited,
        rateLimitUntil: Number(q.rateLimitUntil || 0)
      }];
    }))
  };
}

function computeHealthScore(sourceId) {
  const b = dep('getBreaker')(sourceId);
  // v6.0：有效真实请求 = 真实请求 - 版权/业务失败（无版权歌不惩罚健康分）
  // 修复：probe* 为独立计数(recordProbeResult 单独记账)，totalRequests/totalSuccess 不含探测——
  // 旧实现做减法会把真实样本削掉(探测多时 realReq 归零、成功率退回 0.5)，健康分系统性偏低且与面板成功率口径不一致
  const realReq = Math.max(b.totalRequests - (b.copyrightFail || 0), 0);
  const realSuccess = b.totalSuccess;
  // 真实样本成功率（置信度收缩）
  const rateReal = realReq === 0 ? 0.5 : (realSuccess + HEALTH_PRIOR_K * 0.5) / (realReq + HEALTH_PRIOR_K);
  // 探测样本参考（纯探测期：无真实样本时用探测成功率收缩）
  const probeReq = b.probeRequests || 0;
  const probeSuccess = b.probeSuccess || 0;
  const rateProbe = probeReq === 0 ? 0.5 : (probeSuccess + HEALTH_PRIOR_K * 0.5) / (probeReq + HEALTH_PRIOR_K);
  const rate = realReq > 0 ? rateReal : rateProbe; // 真实样本存在时主导，否则退回探测参考
  // 均时惩罚：真实样本均时优先，纯探测用探测均时；无样本按 9999 最劣
  const avgTime = realSuccess > 0
    ? b.totalTime / realSuccess   // v6.0：totalTime 只计真实成功耗时，不再减 probeTime（同 S1 口径修复）
    : (probeSuccess > 0 ? (b.probeTime || 0) / probeSuccess : 9999);
  const timePenalty = Math.min(avgTime / 5000, 1) * HEALTH_TIME_PENALTY;
  // 连续失败惩罚（熔断阈值内递增；已熔断由 canExecute 挡链，此处仅影响参考分）
  const streakPenalty = Math.min(b.failureCount * HEALTH_STREAK_STEP, HEALTH_STREAK_CAP);
  const score = rate - timePenalty - streakPenalty;
  return { score, rate, avgTime, state: b.state };
}

function getHealthOffState(id, h) {
  if (dep('manualOff')[id]) return { offReason: "USER_OFF", offAt: Number(dep('manualOffAt')[id] || 0) };
  if (!dep('isUserEnabled')(id)) return { offReason: "DEFAULT_OFF", offAt: 0 };
  if (dep('autoOff')[id]) return { offReason: "AUTO_OFF_PROBE", offAt: Number(dep('autoOffAt')[id] || 0) };
  if (dep('probeState').sleeping[id]) return { offReason: "SLEEPING", offAt: Number(dep('probeState').sleepAt[id] || 0) };
  if (dep('isPlayDead')(id)) return { offReason: "PLAY_DEAD", offAt: 0 };
  return { offReason: null, offAt: 0 };
}

function peekThrottle(sourceId) {
  const now = Date.now();
  const inflight = dep('inflightCount').get(sourceId) || 0;
  const maxConc = cfg('maxConcurrency', dep('SOURCE_MAX_CONCURRENCY'));
  const winMs = cfg('rateWindowMs', dep('RATE_WINDOW_MS'));
  const winMax = cfg('rateWindowMax', dep('RATE_WINDOW_MAX'));
  const original = dep('reqTimestamps').get(sourceId) || [];
  const ts = original.filter(t => now - t < winMs);
  const concurrent = inflight >= maxConc;
  const windowFull = ts.length >= winMax;
  return {
    active: concurrent || windowFull,
    reason: concurrent ? 'LOCAL_THROTTLE_CONCURRENCY' : (windowFull ? 'LOCAL_THROTTLE_WINDOW' : null),
    inflight,
    maxConcurrency: maxConc,
    windowCount: ts.length,
    windowMax: winMax,
    untilMs: windowFull ? Number(ts[0] || now) + winMs : 0,
  };
}

const HEALTH_PRIOR_K = 4;      // 置信度收缩伪计数（样本少时成功率向 0.5 收缩，防止"1 次成功=满分"）

const HEALTH_TIME_PENALTY = 0.5; // 均时惩罚系数（归一化到 5000ms）

const HEALTH_STREAK_STEP = 0.08; // 每 1 次连续失败扣分

const HEALTH_STREAK_CAP = 0.5;   // 连续失败惩罚上限

module.exports = {
  startHealthCheck,
  probeSchedule,
  hasActiveWork,
  runHealthCheck,
  HEALTH_CHECK_INITIAL_DELAY_MS,
  inflightUrl,
  buildProbeConfig,
  tierShouldProbe,
  probeSingleSource,
  applyProbeResult,
  getHealthSnapshot,
  healthHistory,
  HEALTH_HISTORY_MAX,
  PROBE_163_IDS,
  juheProbeCfg,
  PROBE_WAKE_EVERY_ROUND,
  PROBE_TIER_SECONDARY_INTERVAL,
  PROBE_TIER_CORE_INTERVAL,
  HEALTH_CHECK_TIMEOUT,
  probeErrorOutcome,
  qualityLastProbeAt,
  recordProbeResult,
  PROBE_PASS_REQUIRED,
  PROBE_FAIL_REQUIRED,
  PROBE_SLEEP_AFTER_DEAD,
  getSourceStats,
  computeHealthScore,
  getHealthOffState,
  peekThrottle,
  HEALTH_PRIOR_K,
  HEALTH_TIME_PENALTY,
  HEALTH_STREAK_STEP,
  HEALTH_STREAK_CAP,
};
