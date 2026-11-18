// ============================================================
// v9.0 业务层 · 19-dispatch（裁决/竞速/闸门（竞速、半开回退、节流、熔断计数））
// 反向闭包裁剪簇；对遗留 legacy 符号走 dep(name) 依赖注入
// ============================================================
const { verifyDelivery } = require("./15-verify.js");
const { deliveryConfidenceMap } = require("./16-chain-misc.js");
const { qualityRank, classifyQualityFailureCode, getHashOrMid } = require("./09-match.js");
const { HTTP_URL_REGEX } = require("./07-net.js");
const { CODE_HINT, CODE_RANK, extractErrorCode } = require("./05-verdict.js");
const { createCancelToken, throwIfCanceled, raceWithCancel } = require("./04-cancel.js");
const { recordHealthEvent, healthTraceOf } = require("./03-events.js");
const { ERROR_CODES } = require("./02-error-codes.js");
const { cfg } = require("./02-config.js");
const { logInfo, logWarn, logDebug } = require("./01-log.js");
const { dep } = require("./06-binding.js");

async function fallbackRace(chain, platform, songInfo, quality, deadline) {
  // v8.8：预算耗尽快速失败（跨音质档共享）
  if (deadline && Date.now() >= deadline) {
    const budgetErr = new Error(`${ERROR_CODES.BUDGET_EXHAUSTED}: 竞速预算耗尽（本档已到期），跳过本档`);
    budgetErr.code = ERROR_CODES.BUDGET_EXHAUSTED;
    budgetErr.detail = [{ source: "budget", quality, code: ERROR_CODES.BUDGET_EXHAUSTED, reason: "预算耗尽" }];
    throw budgetErr;
  }
  // v3.0：失败原因结构化——detail 数组每项 {source, quality, code, reason}，供 App 端展示/统计
  const collectDetails = [];
  if (chain.length === 1) {
    // v7.0：单链请求打点（可观测：只走一个候选源时的开始）
    logDebug(`[竞速] 单链请求: ${platform} ${quality} 源=${chain[0].id}`);
    // v8.11.1（审计修复）：单链分支此前直接 await wrapExecute，完全绕过 raceFirst，
    // 也就绕过了所有 deadline —— 实测单源 8s 无响应时，flac 档跑 20.4s、末档 floor 再跑 20.4s，
    // 单次点歌 40.8s 远超 15s 预算。此处补上单源硬上限，到点即判超时（在飞请求自然结束，不影响后续档）。
    const budgetLeft = Math.max((Number(deadline) || (Date.now() + cfg('raceBudgetMs', 12000))) - Date.now(), 0);
    if (budgetLeft <= 0) throw Object.assign(new Error(`${ERROR_CODES.BUDGET_EXHAUSTED}: 单源超出预算(0ms)`), { code: ERROR_CODES.BUDGET_EXHAUSTED });
    let singleTimer = null;
    const singleToken = createCancelToken();
    try {
      const url = await Promise.race([
        wrapExecute(chain[0], platform, songInfo, quality, singleToken),
        new Promise((_, reject) => {
          singleTimer = setTimeout(() => {
            singleToken.cancel("single_budget");
            reject(Object.assign(new Error(`${ERROR_CODES.BUDGET_EXHAUSTED}: 单源超出预算(${Math.round(budgetLeft)}ms)`), { code: ERROR_CODES.BUDGET_EXHAUSTED }));
          }, budgetLeft);
        }),
      ]);
      return { url, source: chain[0].id };
    } catch (e) {
      const code = extractErrorCode(e);
      const aggErr = new Error(`${chain[0].name}: ${e.message}`);
      aggErr.code = code;
      collectDetails.push({ source: chain[0].id, quality, code, reason: String((e && e.message) || "") });
      aggErr.detail = collectDetails;
      throw aggErr;
    } finally {
      if (singleTimer) clearTimeout(singleTimer);
      singleToken.cancel("single_settled");
    }
  }
  // v8.8：全链分批并发（不再"竞速3 + 串行 rest"）；batch 标签>1 的源（gdWy 配额源）排后批
  const primary = chain.filter(h => (h.batch || 1) === 1);
  const secondary = chain.filter(h => (h.batch || 1) > 1);
  const launchers = [...primary, ...secondary].map(h => ({
    handler: h,
    run: (cancelToken) => wrapExecute(h, platform, songInfo, quality, cancelToken).then(url => ({ url, source: h.id })),
  }));
  const batchSize = Math.min(cfg('raceBatchSize', 3), Math.max(primary.length, 1));
  const errors = [];
  const details = collectDetails;
  // v8.11.5：跨源聚合收口到 admit({stage:'fallback'})——按 CODE_RANK（交付类 3 > 业务类 2 > 网络类 1）
  // 取代旧 mergeCode「业务码一旦出现即固定」，避免 NOT_AUDIO 被 NOT_FOUND 吞成 1h 歌级锁。
  const attempts = [];
  const recordFail = (handlerId, q, err) => {
    const code = extractErrorCode(err);
    const evidence = (err && err.evidence) || "strong";
    attempts.push({ code, evidence, reason: String((err && err.message) || "") });
    details.push({ source: handlerId, quality: q, code, evidence, reason: String((err && err.message) || "") });
    errors.push(err.message);
  };
  try {
    const winner = await raceFirst(launchers, { batchSize, deadline });
    logDebug(`[竞速] ${platform} ${quality} 首胜: 源=${(winner && winner.source) || "unknown"}`);
    return winner;
  } catch (e) {
    if (e && e.allFailed && Array.isArray(e.errors)) {
      for (const err of e.errors) { recordFail(err.sourceId || "race", quality, err); }
    } else {
      recordFail("race", quality, e);
    }
  }
  const finalAdm = dep('admit')({ stage: "fallback", platform, quality, songInfo, attempts });
  const aggErr = new Error(errors.join("; "));
  aggErr.code = finalAdm.code || ERROR_CODES.NETWORK_ERROR; // 唯一代表码出口
  aggErr.detail = details; // v3.0：结构化失败明细
  aggErr.admission = finalAdm;
  throw aggErr;
}

async function wrapExecute(handler, platform, songInfo, quality, cancelToken) {
  throwIfCanceled(cancelToken);
  const traceId = healthTraceOf(songInfo);
  // v8.14（F64）：建链到真正发请求之间可能发生用户关源/自动关闭/休眠/播放摘除。
  // 在发请求前重取一次结构资格，避免拿旧链继续打已失效源；运行期 breaker/限流仍由下面 canExecute 复核。
  // 合成 handler（测试哨兵/外部临时源）不在注册表里，不参与本仓的资格门禁。
  const preGate = dep('SOURCE_HANDLERS')[handler.id]
    ? dep('computeEligibility')(handler.id, platform, quality, { runtime: false, consumePlayDeadTrial: false })
    : { eligible: true, code: 'ELIGIBLE', reason: null };
  if (!preGate.eligible) {
    recordHealthEvent({ event: "source_skip", traceId, sourceId: handler.id, platform, quality, reason: preGate.reason || "eligibility" });
    // v8.16.2（R-07）：gateErr 必须在 throw 前带齐 code/sourceId——旧实现 code 为空、sourceId 只在
    // 外层 catch 里补，而这三处 skip 抛在 try 之前，catch 根本到不了，失败明细就落成 "race"/"chain"。
    const gateErr = new Error(`${preGate.code || ERROR_CODES.RATE_LIMIT}: 音源[${handler.name}]发请求前资格失效（${preGate.reason || "eligibility"}）`);
    gateErr.code = preGate.code || ERROR_CODES.RATE_LIMIT;
    gateErr.sourceId = handler.id;
    gateErr.isThrottleSkip = true;
    throw gateErr;
  }
  // v8.11：源级限流冷却……（同上）
  const previewCoolUntil = dep('previewCooldownMap').get(handler.id);
  const is128k = String(quality || "").toLowerCase() === "128k";
  if (previewCoolUntil && previewCoolUntil > Date.now() && !is128k) {
    recordHealthEvent({ event: "source_skip", traceId, sourceId: handler.id, platform, quality, reason: "preview_cooldown" });
    const coolErr = new Error(`${ERROR_CODES.RATE_LIMIT}: 音源[${handler.name}]判定为源级限流，冷却中（128k 保底档除外）`);
    coolErr.code = ERROR_CODES.RATE_LIMIT;
    coolErr.sourceId = handler.id;
    coolErr.isThrottleSkip = true;
    throw coolErr;
  }
  if (!dep('canExecute')(handler.id, quality)) {
    recordHealthEvent({ event: "source_skip", traceId, sourceId: handler.id, platform, quality, reason: "breaker" });
    logDebug(`[断路器] ${handler.id} ${quality || "128k"} 处于${(dep('getBreaker')(handler.id).byQuality[String(quality || "default")] || {}).breaker?.state || dep('getBreaker')(handler.id).state}状态，跳过`);
    // v6.0：熔断跳过打 isThrottleSkip 标记——catch 短路抛出，不再误记 recordRateLimit
    //（旧实现熔断期每轮跳过都虚增 rateLimitCount，App 面板限流计数被污染）
    revertHalfOpenOnSkip(handler.id, quality); // D-34：half-open 恒 false，必须退回 open 否则永久卡死
    const breakerSkip = new Error(`${ERROR_CODES.RATE_LIMIT}: 音源[${handler.name}]已熔断`);
    breakerSkip.code = ERROR_CODES.RATE_LIMIT;
    breakerSkip.sourceId = handler.id;
    breakerSkip.isThrottleSkip = true;
    throw breakerSkip;
  }
  if (!throttleCheck(handler.id)) {
    recordHealthEvent({ event: "source_skip", traceId, sourceId: handler.id, platform, quality, reason: "local_throttle" });
    // v6.0：本地并发/限速保护跳过——标记 isThrottleSkip：非上游429，不记限流统计、不污染成功率、
    // 不触发 30s 退避（旧实现误记 recordRateLimit，流量高峰会把源冤枉成"被限"）
    revertHalfOpenOnSkip(handler.id, quality); // D-34：同上，节流也在 try 之外抛
    const skipErr = new Error(`${ERROR_CODES.RATE_LIMIT}: 音源[${handler.name}]触发并发/限速保护，本轮跳过`);
    skipErr.code = ERROR_CODES.RATE_LIMIT;
    skipErr.sourceId = handler.id;
    skipErr.isThrottleSkip = true;
    throw skipErr;
  }
  // v8.16.2（R-06）：半开名额只在这里消费——preGate / canExecute / throttleCheck 任一拦截都不会
  // 提前吃掉它（旧实现 preGate 用 consumePlayDeadTrial:true，放行后被后面任一门拦下，名额就白烧了，
  // 请求没发出、60s 内该源再也放不出半开试探）。此处是「确定要打上游」的最后一步，独占消费。
  if (dep('SOURCE_HANDLERS')[handler.id]) {
    const deadReason = dep('isResolveDead')(handler.id, quality, true) ? "resolve-dead"
      : (dep('isPlayDead')(handler.id, quality, true) ? "play-dead" : null);
    if (deadReason) {
      recordHealthEvent({ event: "source_skip", traceId, sourceId: handler.id, platform, quality, reason: deadReason });
      const deadErr = new Error(`${ERROR_CODES.PLAYBACK_FAILED}: 音源[${handler.name}]半开名额已被占用（${deadReason}），本轮跳过`);
      deadErr.code = ERROR_CODES.PLAYBACK_FAILED; // v8.16.3：本地拦截已是一等码，不再裸写字面量
      deadErr.sourceId = handler.id;
      deadErr.isThrottleSkip = true;
      throw deadErr;
    }
  }
  inflightCount.set(handler.id, (inflightCount.get(handler.id) || 0) + 1);
  // v8.0：防御性初始化——不依赖 throttleCheck 先调用，直接确保数组存在
  if (!reqTimestamps.has(handler.id)) reqTimestamps.set(handler.id, []);
  reqTimestamps.get(handler.id).push(Date.now());
  // v6.0：真实播放请求（成败均记）——健康面板'使用中'判定依据；探测不经过此路径
  lastUsedAt.set(handler.id, Date.now());
  const startTime = Date.now();
  recordHealthEvent({ event: "source_attempt", traceId, sourceId: handler.id, platform, quality });
  try {
    const mid = getHashOrMid(songInfo);
    throwIfCanceled(cancelToken);
    // v8.13：编排层真取消——源函数本身不感知令牌，但取消后立刻停止等待它，
    // 不再进入交付验真/健康记账；底层回调即使后续返回也不会改变结果。
    const url = cancelToken
      ? await raceWithCancel(Promise.resolve().then(() => handler.fn(platform, mid, quality, songInfo, cancelToken)), cancelToken)
      : await handler.fn(platform, mid, quality, songInfo, cancelToken);
    throwIfCanceled(cancelToken);
    // v8.10.2：先验后记——validateUrl 抛错时不再"既记成功又记业务失败"（旧顺序同一请求双记账，
    // 成功率分子分母各被记一次，健康分失真；也掩盖了真失败）
    const finalUrl = validateUrl(url, handler.name);
    // v8.11：交付前真实性闸门——一次 Range(1KB) 拿真实字节判定「是不是音频 / 是不是只有试听片段」
    const verdict = await verifyDelivery(finalUrl, { platform, handlerId: handler.id, quality, songInfo }, cancelToken);
    if (verdict && verdict.ok === false) {
      const vErr = new Error(`${verdict.code}: ${CODE_HINT[verdict.code] || "交付校验未通过"}（${verdict.reason}）`);
      vErr.code = verdict.code;
      vErr.deliveryCheck = true;
      vErr.evidence = verdict.evidence || "strong";
      // v8.11：把片段 URL 带出去——全链都只有片段时要按 B 方案兜底返回它（标注「试听版」），
      // 否则用户点歌直接"没声"，比听到 5 秒更糟
      if (verdict.code === ERROR_CODES.PREVIEW_FRAGMENT) {
        vErr.fragmentUrl = finalUrl;
        if (verdict.quality) vErr.fragmentQuality = verdict.quality;
      }
      throw vErr;
    }
    const adm = dep('admit')({ probe: verdict, songInfo, quality });
    const realQuality = adm.quality || (verdict && verdict.quality) || "";
    const realConfidence = adm.qualityConfidence || (verdict && verdict.qualityConfidence) || "exact";
    if (realQuality) {
      const reqQ = String(quality || "").toLowerCase();
      if (realQuality !== reqQ) {
        // 旁路记录实交付音质，供 getUrlWithFallback 把标签改成真话（请求 flac 实得 128k 时界面不能写 FLAC）
        dep('boundedMapSet')(dep('deliveryQualityMap'), `${handler.id}|${platform}|${mid}|${reqQ}`, realQuality);
        dep('boundedMapSet')(deliveryConfidenceMap, `${handler.id}|${platform}|${mid}|${reqQ}`, realConfidence);
        logInfo(`[${handler.name}] 实交付音质与请求档不符: 请求[${quality || "128k"}] → 实得[${realQuality}]（置信${realConfidence}）`);
      } else {
        dep('boundedMapSet')(dep('deliveryQualityMap'), `${handler.id}|${platform}|${mid}|${reqQ}`, realQuality);
        dep('boundedMapSet')(deliveryConfidenceMap, `${handler.id}|${platform}|${mid}|${reqQ}`, realConfidence);
      }
    }
    // v8.16.2（R-02）：按真实交付音质入账。旧实现用请求档 quality 记账——请求 flac 实得 128k 时
    // byQuality 只增 flac.success，128k 档永远没有样本，isQualityHopeless(flac) 因 success>0 恒为 false，
    // 「质量档短路」在最该生效的降级场景 100% 失效。改为：成功记在实交付档，
    // 同时给请求档记一条「交付不出该档」的确定性样本（不占请求分母）。
    const deliveredQuality = realQuality || String(quality || "128k").toLowerCase();
    recordSuccess(handler.id, Date.now() - startTime, deliveredQuality);
    const reqQuality = String(quality || "128k").toLowerCase();
    if (deliveredQuality !== reqQuality && qualityRank(deliveredQuality) < qualityRank(reqQuality)) {
      noteQualityDowngrade(handler.id, reqQuality, deliveredQuality);
    }
    recordHealthEvent({ event: "source_result", traceId, sourceId: handler.id, platform, quality, ok: true, code: "", latencyMs: Date.now() - startTime });
    logInfo(`[${handler.name}] 解析成功: ${songInfo?.name || ""} 音质[${quality || "128k"}]`);
    return finalUrl;
  } catch (e) {
    // v8.13：取消不是源失败——不写 source_result、不进 admit/健康账本，只释放并发计数。
    if (e && (e.canceled === true || e.code === ERROR_CODES.CANCELED)) throw e;
    // v6.0：本地节流跳过——不记账直接抛出（finally 仍释放并发计数）
    if (e && e.isThrottleSkip) {
      // v8.10.2：半开收口——canExecute 放行一次后若被本地节流/熔断拦下，试探并未真正发生，
      // 状态不能停在 half-open（那里恒返回 false，该源会永久不被调用）；退回 open 重新等冷却
      revertHalfOpenOnSkip(handler.id, quality); // D-34：抽函数统一，三处收口行为一致
      throw e;
    }
    recordHealthEvent({ event: "source_result", traceId, sourceId: handler.id, platform, quality, ok: false, code: extractErrorCode(e), latencyMs: Date.now() - startTime });
    // v6.0：删除 catch 里的 inflightCount 递减——finally 已统一释放；
    // 旧实现 catch+finally 双递减会把并发中其他请求的计数也归零，单源并发保护(2)失效
    // v3.0：失败原因结构化透出——给错误附加源 id，供聚合 detail 关联具体子源
    if (e && typeof e === "object" && !e.sourceId) e.sourceId = handler.id;
    // v1.0：决策日志——区分熔断类错误(网络类)与业务失败(不熔断)
    logDebug(`[${handler.name}] 失败 code=${e.code || "?"} msg=${e.message}; 熔断类=${e.code === ERROR_CODES.NETWORK_TIMEOUT || e.code === ERROR_CODES.NETWORK_ERROR || e.code === ERROR_CODES.SERVER_ERROR || e.code === ERROR_CODES.RATE_LIMIT}`);
    // v1.0：仅网络类错误(超时/5xx/429)计入熔断——业务失败(NOT_FOUND/MISMATCH等)说明源已正常响应，
    // 不应因"歌不存在/无版权"累积连续失败而误熔断健康源。
    // L4：判据与记账分离——admit 出裁决，applyAdmission 按 ledger 落账（不再在此处 if(code) 分叉）。
    const adm = dep('admit')({
      stage: "candidate", platform, quality, songInfo, source: handler.id,
      error: { code: extractErrorCode(e), reason: String((e && e.message) || ""), evidence: (e && e.evidence) || "strong" },
    });
    applyAdmission(adm, { source: handler.id, quality, platform, songInfo, error: e, name: handler.name });
    throw e;
  } finally {
    inflightCount.set(handler.id, Math.max((inflightCount.get(handler.id) || 0) - 1, 0));
  }
}

function raceFirst(launchers, opts = {}) {
  const batchSize = Math.max(1, Number(opts.batchSize || cfg('raceBatchSize', 3)));
  const staggerMs = Math.max(0, Number(opts.staggerMs !== undefined ? opts.staggerMs : cfg('raceBatchStaggerMs', 300)));
  const matchWaitMs = Math.max(0, Number(opts.matchWaitMs !== undefined ? opts.matchWaitMs : cfg('raceMatchWaitMs', 600)));
  const deadline = Number(opts.deadline || (Date.now() + cfg('raceBudgetMs', 12000)));
  if (!launchers || launchers.length === 0) {
    return Promise.reject(new Error(`${ERROR_CODES.NOT_FOUND}: 无可竞速的音源`));
  }
  return new Promise((resolve, reject) => {
    const enteredAt = Date.now();
    const budgetMs = Math.max(0, Math.round(deadline - enteredAt));
    let settled = false;
    const cancelTokens = launchers.map(() => createCancelToken());
    const cancelAll = (why) => { for (const t of cancelTokens) t.cancel(why); };
    let started = 0;
    let pending = 0;
    let verifiedPending = 0;
    let candidate = null;
    let waiter = null;
    let budgetTimer = null;
    const errs = [];
    const total = launchers.length;
    const settle = (val) => {
      if (settled) return;
      settled = true;
      cancelAll("race_winner");
      if (waiter) { clearTimeout(waiter); waiter = null; }
      if (budgetTimer) { clearTimeout(budgetTimer); budgetTimer = null; }
      resolve(val);
    };
    const fail = (err) => {
      if (settled) return;
      settled = true;
      cancelAll("race_failed");
      if (waiter) { clearTimeout(waiter); waiter = null; }
      if (budgetTimer) { clearTimeout(budgetTimer); budgetTimer = null; }
      reject(err);
    };
    const startOne = (i) => {
      const item = launchers[i];
      const h = (item && item.handler) || null;
      const run = typeof item === "function" ? item : (item && item.run);
      const isVerified = !!(h && h.verified);
      started += 1;
      pending += 1;
      if (isVerified) verifiedPending += 1;
      Promise.resolve().then(() => run(cancelTokens[i])).then(
        (res) => {
          pending -= 1;
          if (isVerified) verifiedPending -= 1;
          if (settled) return;
          const url = (res && typeof res === "object" && res.url) ? res.url : res;
          const source = (res && typeof res === "object" && res.source) ? res.source : ((h && h.id) || "");
          logDebug(`[竞速] 候选成功: 源=${source || "未知"} verified=${isVerified}`);
          if (isVerified) return settle({ url, source: source || "" });
          if (!candidate) {
            candidate = { url, source: source || "" };
            if (verifiedPending > 0 && matchWaitMs > 0) {
              waiter = setTimeout(() => { waiter = null; if (!settled && candidate) settle(candidate); }, matchWaitMs);
            } else {
              settle(candidate);
            }
          }
        },
        (e) => {
          pending -= 1;
          if (isVerified) verifiedPending -= 1;
          errs.push(e);
          if (settled) return;
          if (candidate && verifiedPending === 0) return settle(candidate);
          if (pending === 0 && started >= total) {
            logDebug(`[竞速] 候选全败: ${errs.length} 个: ${errs.map(x => String((x && x.message) || "")).join(" | ")}`);
            return fail({ allFailed: true, errors: errs });
          }
        }
      );
    };
    const launchBatch = () => {
      if (settled) return;
      const endIdx = Math.min(started + batchSize, total);
      while (started < endIdx) startOne(started);
      if (started < total) setTimeout(launchBatch, staggerMs);
    };
    launchBatch();
    budgetTimer = setTimeout(() => {
      budgetTimer = null;
      if (settled) return;
      if (candidate) return settle(candidate);
      fail(new Error(`${ERROR_CODES.BUDGET_EXHAUSTED}: 竞速预算耗尽(${budgetMs}ms)`));
    }, Math.max(deadline - Date.now(), 0));
  });
}

function revertHalfOpenOnSkip(sourceId, quality) {
  const b = dep('getBreaker')(sourceId);
  const q = quality ? dep('qualityLedger')(b, quality) : null;
  if (q && q.breaker.state === 'half-open') {
    q.breaker.state = 'open';
    q.breaker.trialInFlight = false;
    q.breaker.lastFailureTime = Date.now();
    logWarn(`断路器[${sourceId}] ${quality} 半开试探被本地拦截，退回熔断等待下次冷却`);
  }
  if (b.state === "half-open") {
    b.state = "open";
    b.lastFailureTime = Date.now();
    logWarn(`断路器[${sourceId}] 半开试探被本地拦截，退回熔断等待下次冷却`);
  }
  if (q) syncSourceBreaker(b);
}

function throttleCheck(sourceId) {
  const inflight = inflightCount.get(sourceId) || 0;
  const maxConc = cfg('maxConcurrency', SOURCE_MAX_CONCURRENCY);
  if (inflight >= maxConc) {
    logDebug(`[限速] ${sourceId} 并发${inflight}≥${maxConc}，本轮跳过`);
    return false;
  }
  const now = Date.now();
  const winMs = cfg('rateWindowMs', RATE_WINDOW_MS);
  const winMax = cfg('rateWindowMax', RATE_WINDOW_MAX);
  const ts = (reqTimestamps.get(sourceId) || []).filter(t => now - t < winMs);
  reqTimestamps.set(sourceId, ts);
  if (ts.length >= winMax) {
    logDebug(`[限速] ${sourceId} ${winMs / 1000}s内${ts.length}次≥${winMax}，本轮跳过`);
    return false;
  }
  return true;
}

const inflightCount = new Map();

const reqTimestamps = new Map();

const lastUsedAt = new Map();

function validateUrl(url, sourceName) {
  if (!url || typeof url !== "string" || !url.trim()) throw new Error(`${ERROR_CODES.NOT_FOUND}: ${sourceName}返回空URL`);
  if (!HTTP_URL_REGEX.test(url.trim())) throw new Error(`${ERROR_CODES.PARAM_ERROR}: ${sourceName}非法URL格式`);
  // v8.10.3：校验用 trim 后的串，返回也必须 trim——旧实现返回原串，带首尾空白/换行的 URL 会直达播放器
  return url.trim();
}

function recordSuccess(sourceId, duration, quality, opts = {}) {
  const b = dep('getBreaker')(sourceId);
  // v8.16.2（R-03）：真实播放回传不是取链请求。旧实现无条件 totalRequests++/totalSuccess++/
  // byQuality req++/success++，一次「取链失败 + 播放成功」会被算成 reqCount=2、成功率 50%——
  // App 面板的 24h 取链数字与 byQuality 全被播放事件污染。播放成功只做熔断复位与摘除解除。
  const playback = opts.playback === true;
  if (!playback) {
    b.totalRequests++;
    b.totalSuccess++;
    b.totalTime += duration;
    const q = dep('qualityLedger')(b, quality);
    q.req++; q.success++; q.time += duration;
  }
  b.lastQuality = String(quality || "128k"); // v6.0：记录实际交付音质
  const q = dep('qualityLedger')(b, quality);
  // F40：半开试探成功只关闭命中的档位；源级聚合再看其他档是否仍不可达。
  if (q.breaker.state === 'half-open' || q.breaker.state === 'open') {
    q.breaker.state = 'closed';
    q.breaker.failureCount = 0;
    q.breaker.trialInFlight = false;
    logWarn(`断路器[${sourceId}] ${quality || "128k"} 半开试探成功，恢复`);
  }
  if (b.state === 'half-open') { b.state = 'closed'; b.failureCount = 0; }
  b.failureCount = 0;
  syncSourceBreaker(b);
  // v8.14：真实成功同时解除 autoOff（比探测更硬的恢复证据）。
  if (dep('autoOff')[sourceId] && dep('isUserEnabled')(sourceId)) {
    delete dep('autoOff')[sourceId]; delete dep('autoOffReason')[sourceId]; delete dep('autoOffAt')[sourceId];
    recordHealthEvent({ event: "health_transition", sourceId, from: "AUTO_OFF", to: "ELIGIBLE", reason: "real_success" });
  }
  // F42：取链成功只能解除 resolveDead；playDead 必须等 App 真实播放成功（opts.playback）。
  dep('clearResolveDead')(sourceId);
  if (opts.playback === true && (dep('playDeadStreak').get(sourceId) || 0) > 0) {
    dep('playDeadStreak').set(sourceId, 0);
    dep('playDeadDeadline').delete(sourceId);
    dep('playDeadQuality').delete(sourceId);
    dep('clearPlayDeadTrials')(sourceId);
    logWarn(`播放摘除: [${sourceId}] 真实播放成功，解除摘除`);
  }
}

function noteQualityDowngrade(sourceId, requestedQuality, deliveredQuality) {
  const reqQ = String(requestedQuality || "").toLowerCase();
  const realQ = String(deliveredQuality || "").toLowerCase();
  if (!reqQ || !realQ || reqQ === realQ) return false;
  if (qualityRank(realQ) >= qualityRank(reqQ)) return false;
  const b = dep('getBreaker')(sourceId);
  const q = dep('qualityLedger')(b, reqQ);
  q.definitiveFail = (q.definitiveFail || 0) + 1;
  logInfo(`[${sourceId}] 音质降级样本: 请求[${reqQ}] 实交付[${realQ}]，该档确定性降级第 ${q.definitiveFail} 次`);
  return true;
}

function applyAdmission(adm, ctx) {
  const id = ctx && ctx.source;
  if (!adm || !id) return adm;
  const q = ctx.quality;
  const L = adm.ledger || {};
  if (adm.verdict === "PASS") {
    recordSuccess(id, Number(ctx.elapsed) || 0, q);
    return adm;
  }
  if (adm.verdict === "RATE_LIMITED") recordRateLimit(id, q, L.sourceCooldownMs);
  else if (L.health === "skip") return adm;   // v8.16.3（R-13）：本地拦截不记任何账（请求未发出）
  else if (L.health === "hardFail") recordFailure(id, q, { playDead: L.playDead === true, resolveDead: L.resolveDead === true, code: adm.code });
  else recordBusinessFail(id, q, { code: adm.code });
  const err = ctx.error || {};
  if (adm.code === ERROR_CODES.PREVIEW_FRAGMENT) {
    rememberFragmentSource(ctx.platform, ctx.songInfo, id, q);
    if (err.fragmentUrl) {
      dep('boundedMapSet')(dep('fragmentUrlMap'), `${ctx.platform}|${getHashOrMid(ctx.songInfo)}|${String(q || "").toLowerCase()}`,
        { url: err.fragmentUrl, quality: err.fragmentQuality || String(q || "128k").toLowerCase(), source: id, name: ctx.name, ts: Date.now() });
    }
  }
  if (adm.code === ERROR_CODES.LINK_EXPIRED) {
    const qStat = dep('getBreaker')(id).byQuality[String(q)];
    if (qStat) qStat.linkExpired = (qStat.linkExpired || 0) + 1;
  }
  return adm;
}

function syncSourceBreaker(b) {
  const ledgers = Object.values(b.byQuality || {}).filter(q => q && q.breaker)
  if (!ledgers.length) return
  const allOpen = ledgers.every(q => q.breaker.state === 'open')
  const anyHalf = ledgers.some(q => q.breaker.state === 'half-open')
  if (allOpen) {
    b.state = 'open'
    b.lastFailureTime = Math.max(...ledgers.map(q => q.breaker.lastFailureTime || 0))
  } else if (anyHalf) {
    b.state = 'half-open'
  } else {
    b.state = 'closed'
  }
}

const SOURCE_MAX_CONCURRENCY = 2;    // v4.0：单源最大并发数（超限本轮跳过，防上游过载/风控）

const RATE_WINDOW_MS = 3000;         // v4.0：滑动窗口限速窗口(3s)

const RATE_WINDOW_MAX = 5;           // v4.0：窗口内最大请求数（超限本轮跳过）     // 熔断冷却 3分钟

function recordRateLimit(sourceId, quality, cooldownMs) {
  const b = dep('getBreaker')(sourceId);
  const wasSourceHalfOpen = b.state === 'half-open';
  const wasSourceOpen = b.state === 'open';
  const q = dep('qualityLedger')(b, quality);
  // v8.10.3：429 不再计入请求/失败分子分母——限流是"源没坏、只是过载"，旧实现记进
  // byQuality.fail/totalRequests 后会被 isQualityHopeless(fail+linkExpired>=3) 当成
  // "该档 3 次全失败"直接短路 1 小时，同时把面板成功率拉低。
  const backoff = Number(cooldownMs) > 0 ? cooldownMs : cfg('rateLimitBackoffMs', RATE_LIMIT_BACKOFF_MS);
  b.rateLimitCount = (b.rateLimitCount || 0) + 1;
  b.rateLimitUntil = Date.now() + backoff;
  if (b.rateLimitCount >= RATE_LIMIT_TRIP) b.rateLimited = true;
  // F41：真正拦执行的是档位槽；源级字段只是聚合/旧 UI 兼容。
  q.rateLimitCount++;
  q.rateLimitUntil = Date.now() + backoff;
  if (q.rateLimitCount >= RATE_LIMIT_TRIP) q.rateLimited = true;
  // v8.10.3：半开试探遇 429 必须收口——canExecute 在 half-open 恒返回 false，
  // 不收口则 state 永久停在 half-open，该源再也不会被调用（只修了业务失败/本地节流两条出口）。
  if (q.breaker.state === 'half-open' || b.state === 'half-open') {
    q.breaker.state = 'open';
    q.breaker.trialInFlight = false;
    q.breaker.lastFailureTime = Date.now();
    logWarn(`断路器[${sourceId}] 半开试探失败(${quality || "128k"} 限流429)，重新熔断`);
  }
  syncSourceBreaker(b);
  // 旧源级半开语义：试探已发生且失败，源级必须收口回 open，不能停在 half-open。
  if (wasSourceHalfOpen || wasSourceOpen) {
    b.state = 'open';
    b.lastFailureTime = Date.now();
  }
  logDebug(`[${sourceId}] 429限流第${b.rateLimitCount}次，退避${backoff / 1000}s${b.rateLimited ? '（已标记被限）' : ''}`);
}

function recordFailure(sourceId, quality, opts = {}) {  const b = dep('getBreaker')(sourceId);
  // v8.16.2（R-03）：真实播放失败只累计 playDead，不再进取链账本（req/fail/definitiveFail/成功率）。
  // 播放失败是「这次播放环境/CDN 出问题」的证据，不是「该源该档取链不可用」的证据；
  // 旧实现把它记进 byQuality 后，一次播放失败就能把 qualityShortCircuit 推高一格。
  if (opts.playbackOnly === true) {
    // v8.16.4（疑-31）：播放失败必须带档位归因——旧实现只按 sourceId 累计，
    // 一档播不了（如高档解码失败）三次就把整源连 128k 保底一起摘掉。
    bumpPlayDead(sourceId, quality);
    return;
  }
  const wasSourceHalfOpen = b.state === 'half-open';
  b.totalRequests++;
  b.failureCount++;
  b.lastFailureTime = Date.now();
  const q = dep('qualityLedger')(b, quality);
  q.req++; q.fail++;
  // v8.15（P1）：档位短路只看“确定性失败”。网络超时/5xx 仍计入 breaker，但不再进短路样本。
  // 兼容旧调用：未传 code 时按旧语义计入 definitiveFail；生产路径必须传 code。
  const failureClass = classifyQualityFailureCode(opts.code);
  if (!opts.code || (failureClass !== "transient" && failureClass !== "rate_limit")) q.definitiveFail = (q.definitiveFail || 0) + 1;
  q.breaker.failureCount++;
  q.breaker.lastFailureTime = Date.now();
  // F42：取链/准入失败只累计 resolveDead；playDead 只由 reportPlayback 的真实播放失败累计。
  if (opts.resolveDead === true) bumpResolveDead(sourceId);
  if (opts.playDead !== false) bumpPlayDead(sourceId, quality);
  const thr = cfg('breakerThreshold', BREAKER_THRESHOLD);
  if (q.breaker.state === 'half-open' || b.state === 'half-open') {
    q.breaker.state = 'open';
    q.breaker.trialInFlight = false;
    logWarn(`断路器[${sourceId}] ${quality || "128k"} 半开试探失败，重新熔断`);
  } else if (q.breaker.state === 'closed' && q.breaker.failureCount >= thr) {
    q.breaker.state = 'open';
    logWarn(`断路器[${sourceId}] ${quality || "128k"} 连续失败${thr}次，熔断${cfg('breakerCooldownMs', dep('BREAKER_COOLDOWN_MS')) / 1000}秒`);
  }
  syncSourceBreaker(b);
  if (wasSourceHalfOpen) b.state = 'open';
}

function recordBusinessFail(sourceId, quality, opts = {}) {
  const b = dep('getBreaker')(sourceId);
  const wasSourceHalfOpen = b.state === 'half-open';
  b.totalRequests++;
  b.copyrightFail = (b.copyrightFail || 0) + 1;
  const q = dep('qualityLedger')(b, quality);
  q.req++; q.businessFail++;
  // v8.15（P1）：只有“交付内容确定性坏掉”的码进入档位短路；NOT_FOUND/MISMATCH 是歌曲级结论，
  // 不能因为某源没有某首歌的版权就把该源该档对全部歌曲短路。
  if (opts.code && classifyQualityFailureCode(opts.code) === "delivery") q.definitiveFail = (q.definitiveFail || 0) + 1;
  // v8.10.2：半开试探失败收口——业务失败（404/错歌/410/空URL）同样说明这次试探没成功，
  // 不能让 state 停在 half-open（canExecute 在 half-open 恒返回 false，源会永久不被调用）。
  // 必须同时刷新 lastFailureTime，否则冷却判定用旧时间戳，会立刻再次放行。
  if (q.breaker.state === "half-open" || b.state === "half-open") {
    q.breaker.state = "open";
    q.breaker.trialInFlight = false;
    q.breaker.lastFailureTime = Date.now();
    syncSourceBreaker(b);
    if (wasSourceHalfOpen) b.state = 'open';
    logWarn(`断路器[${sourceId}] 半开试探失败(${quality || "128k"} 业务失败)，重新熔断`);
  }
}

function rememberFragmentSource(platform, songInfo, handlerId, quality) {
  const key = `${platform}|${getHashOrMid(songInfo)}`;
  const ts = Date.now();
  let entry = dep('fragmentSourceMap').get(key);
  if (!entry || ts - entry.ts > dep('FRAGMENT_SOURCE_TTL_MS')) {
    entry = { sources: new Set(), bySource: new Map(), ts };
    dep('boundedMapSet')(dep('fragmentSourceMap'), key, entry);
  }
  entry.ts = ts;
  entry.sources.add(handlerId);
  const qs = entry.bySource.get(handlerId) || new Set();
  qs.add(String(quality || "128k").toLowerCase());
  entry.bySource.set(handlerId, qs);
  // v8.11.1（压测 G7 实测）：单曲三档全片段只能证明「这首歌该源给不出完整版」，
  // 不足以判定源被风控——冷却是全源级的，误判会让同源其他本可播放的歌一起被跳过（实测误伤）。
  // 改为跨歌证据：同一源在窗口内对 ≥2 首不同歌都三档全片段，才判源级限流。
  const midKey = `${platform}|${getHashOrMid(songInfo)}`;
  let hEntry = fragmentHandlerSongsMap.get(handlerId);
  if (!hEntry || ts - hEntry.ts > dep('FRAGMENT_SOURCE_TTL_MS')) {
    hEntry = { mids: new Set(), ts };
    dep('boundedMapSet')(fragmentHandlerSongsMap, handlerId, hEntry);
  }
  hEntry.ts = ts;
  // v8.11.1（二轮审计 C9a 打点实测修正）：v8.11.1 引入「跳过已知片段源」后，同源同歌首档判定片段即跳过
  // 其余档，qs.size 恒为 1，旧 `>= 3` 永远达不到 → 源级冷却事实上永不触发（实测 mapKeys 恒为空）。
  // 改为「该源对该歌出现过任一档片段即计入跨歌证据」；单歌仍不足以判源级限流，下面仍要求 ≥2 首不同歌。
  if (qs.size >= 1) hEntry.mids.add(midKey);
  // v8.11.2（F11 通读核实）：此处原有 `if (qs.size > HANDLER_MIDS_MAX)` 守卫，比较的是「每源音质集合」
  // （最多 4 个元素，HANDLER_MIDS_MAX=200），条件恒假、从未删过任何东西。跨歌证据的裁剪在
  // hEntry.mids 达到 2 首时即清空并写冷却，容器本身由 boundedMapSet 兜底，故直接删除该死守卫。
  if (hEntry.mids.size >= 2) {
    const songCount = hEntry.mids.size;
    hEntry.mids.clear();
    dep('previewCooldownMap').set(handlerId, ts + PREVIEW_COOLDOWN_MS);
    logWarn(`[${handlerId}] 连续 ${songCount} 首不同歌均只给试听片段 → 判定源级限流，冷却 ${Math.round(PREVIEW_COOLDOWN_MS / 60000)} 分钟并转跨平台`);
  }
}

const RATE_LIMIT_BACKOFF_MS = 30000;   // v4.0：429 限流短退避(30s)，不触发熔断

const RATE_LIMIT_TRIP = 3;            // v4.0：连续限流≥3 次标记"被限"状态

function bumpPlayDead(sourceId, quality) {
  // v8.16.4（疑-31）：记录触发档；跨档即清空归因（视为源级问题，不豁免任何档）。
  const q = String(quality || "").toLowerCase();
  const first = dep('playDeadQuality').get(sourceId);
  if (!first) { if (q) dep('playDeadQuality').set(sourceId, q); }
  else if (q && first !== q) dep('playDeadQuality').set(sourceId, "*"); // "*" = 已跨档 → 源级，永久不豁免（直到成功清零）
  dep('playDeadStreak').set(sourceId, (dep('playDeadStreak').get(sourceId) || 0) + 1);
  if (dep('playDeadStreak').get(sourceId) >= dep('PLAY_DEAD_STREAK')) {
    dep('playDeadDeadline').set(sourceId, Date.now()); // 摘除/续计时（半开试探冷却）
    dep('clearPlayDeadTrials')(sourceId);             // 旧试探已失败，新周期重新只放一个
  }
  if (dep('isPlayDead')(sourceId)) logWarn(`播放摘除: [${sourceId}] 连续${dep('PLAY_DEAD_STREAK')}次播放失败，已从竞速链摘除(${Math.round(cfg('playDeadReviveMs', 5 * 60 * 1000) / 60000)}分钟后半开试探自动复活)`);
}

function bumpResolveDead(sourceId) {
  dep('resolveDeadStreak').set(sourceId, (dep('resolveDeadStreak').get(sourceId) || 0) + 1);
  if (dep('resolveDeadStreak').get(sourceId) >= dep('PLAY_DEAD_STREAK')) {
    dep('resolveDeadDeadline').set(sourceId, Date.now());
    dep('clearResolveDeadTrials')(sourceId);
  }
  if (dep('isResolveDead')(sourceId)) logWarn(`取链摘除: [${sourceId}] 连续${dep('PLAY_DEAD_STREAK')}次取链/准入失败，已从竞速链摘除(${Math.round(cfg('playDeadReviveMs', 5 * 60 * 1000) / 60000)}分钟后半开试探自动复活)`);
}

const BREAKER_THRESHOLD = 3;            // 连续失败熔断阈值

const fragmentHandlerSongsMap = new Map(); // handlerId → { mids:Set, ts }（源级限流的跨歌证据）

const PREVIEW_COOLDOWN_MS = 300000;     // 源级限流冷却 5 分钟（三段全片段视为源被限流）

module.exports = {
  fallbackRace,
  wrapExecute,
  raceFirst,
  revertHalfOpenOnSkip,
  throttleCheck,
  inflightCount,
  reqTimestamps,
  lastUsedAt,
  validateUrl,
  recordSuccess,
  noteQualityDowngrade,
  applyAdmission,
  syncSourceBreaker,
  SOURCE_MAX_CONCURRENCY,
  RATE_WINDOW_MS,
  RATE_WINDOW_MAX,
  recordRateLimit,
  recordFailure,
  recordBusinessFail,
  rememberFragmentSource,
  RATE_LIMIT_BACKOFF_MS,
  RATE_LIMIT_TRIP,
  bumpPlayDead,
  bumpResolveDead,
  BREAKER_THRESHOLD,
  fragmentHandlerSongsMap,
  PREVIEW_COOLDOWN_MS,
};
