// ============================================================
// v9.0 业务层 · 22-chain（取链主路径（跨平台兜底、预算边界、冷启预热、实际交付平台））
// 反向闭包裁剪簇；对遗留 legacy 符号走 dep(name) 依赖注入
// ============================================================
const { PROVIDER_AUTH, PROVIDER_LIFECYCLE } = require("./11-provider-meta.js");
const { wrapExecute, recordFailure } = require("./19-dispatch.js");
const { throwIfCanceled } = require("./04-cancel.js");
const { PLATFORM_QUALITIES, QUALITY_CEILING_TTL_BY_REASON, QUALITY_CEILING_TTL_MS, QUALITY_PRIORITY, codeRank, getHashOrMid, getQualityCeiling, qualityCeilingMap, qualityCeilingReasonForCodes, qualityRank, strongestEvidence } = require("./09-match.js");
const { ERROR_CODES } = require("./02-error-codes.js");
const { resolveCrossPlatformCandidate } = require("./21-cross-search.js");
const { LOG_DEBUG, logDebug, logInfo, logWarn } = require("./01-log.js");
const { ADMISSION_POLICY, extractErrorCode, verdictOfCode } = require("./05-verdict.js");
const { CROSS_PLATFORM_NAMES } = require("./10-vendors.js");
const { FAIL_CACHE_TTL_MS, buildCacheKey, getCachedUrl, getFailCachedEntry, setCachedUrl, setFailCached, successCache } = require("./07-net.js");
const { cfg } = require("./02-config.js");
const { headerEvidence, isFragmentInfo, originalDurationSec, qualityConfidenceOf, qualityFromDelivery, verifyDelivery } = require("./15-verify.js");
const { QUALITY_FIRST, buildQualityChain, getDeliveryConfidence } = require("./16-chain-misc.js");
const { sortChainByHealth } = require("./13-chain-helpers.js");
const { fallbackRace } = require("./19-dispatch.js");
const { kindOf, mediaEnvelopeErrorCode, sniffAudioBytes, toBytes, totalBytesOf } = require("./08-media.js");
const { dep } = require("./06-binding.js");

async function tryCrossPlatformFallback(primaryPlatform, songInfo, quality, primaryErr, traceId, cancelToken = null) {
  throwIfCanceled(cancelToken);
  const targets = CROSS_PLATFORM_ORDER.filter(p => p !== primaryPlatform && PLATFORM_QUALITIES[p]);
  if (!targets.length) throw primaryErr || new Error(`${ERROR_CODES.NOT_FOUND}: 无跨平台目标`);
  let lastErr = null;
  let noCandidateCount = 0;
  let hadUncertain = false;
  for (const target of targets) {
    throwIfCanceled(cancelToken);
    let candidate = null;
    try {
      candidate = await resolveCrossPlatformCandidate(target, songInfo);
    } catch (e) {
      lastErr = e;
      if (!isDefinitiveNoMatch(e)) hadUncertain = true;
      logDebug(`[跨平台] ${primaryPlatform}→${target} 搜索失败: ${e.code || "?"} ${e.message}`);
      continue;
    }
    if (!candidate) {
      noCandidateCount++;
      logDebug(`[跨平台] ${primaryPlatform}→${target} 无严格匹配候选`);
      continue;
    }
    const targetInfo = buildCrossTargetInfo(candidate, songInfo, target);
    logInfo(`[跨平台] ${primaryPlatform}→${target} 命中: ${candidate.name} / ${candidate.singer} / ${candidate.duration || "?"}s (${candidate.id})`);
    try {
      const r = await getUrlWithFallback(target, targetInfo, quality, cancelToken);
      return {
        ...r,
        sourcePlatform: r.sourcePlatform || target,
        fallback: { from: primaryPlatform, reason: extractErrorCode(primaryErr) || "FAILED", matched: candidate.id },
      };
    } catch (e) {
      lastErr = e;
      if (!isDefinitiveNoMatch(e)) hadUncertain = true;
      logDebug(`[跨平台] ${primaryPlatform}→${target} 目标链失败: ${e.code || "?"} ${e.message}`);
    }
  }
  const primaryCode = extractErrorCode(primaryErr);
  const primaryUncertain = primaryCode === ERROR_CODES.NETWORK_TIMEOUT ||
    primaryCode === ERROR_CODES.NETWORK_ERROR;
  const primaryCatalogMiss = primaryCode === ERROR_CODES.NOT_FOUND || primaryCode === ERROR_CODES.MISMATCH;
  // 只有主平台「曲库没有/同名错歌」才把跨平台无匹配写成 NOT_FOUND；
  // NOT_AUDIO/片段/限流/网络类必须保留原码，否则 App 的失败分类会被改写（实测 Q7 红）。
  if (primaryCatalogMiss && !primaryUncertain && noCandidateCount === targets.length && !hadUncertain) {
    const e = new Error(`${ERROR_CODES.NOT_FOUND}: 主平台${primaryCode || "失败"}，跨平台均无严格匹配（${targets.map(p => CROSS_PLATFORM_NAMES[p] || p).join("/")}）`);
    e.code = ERROR_CODES.NOT_FOUND;
    e.detail = [{ source: "cross-platform", code: ERROR_CODES.NOT_FOUND, reason: "无歌名+歌手+时长严格匹配" }];
    throw e;
  }
  throw primaryErr || lastErr || new Error(`${ERROR_CODES.NOT_FOUND}: 跨平台均失败`);
}

const CROSS_PLATFORM_ORDER = ["tx", "wy", "kw"];

function isDefinitiveNoMatch(err) {
  const code = extractErrorCode(err);
  return code === ERROR_CODES.NOT_FOUND || code === ERROR_CODES.MISMATCH || code === ERROR_CODES.PARAM_ERROR;
}

function buildCrossTargetInfo(candidate, original, targetPlatform) {
  const info = {
    name: candidate.name || original.name,
    singer: candidate.singer || original.singer,
    albumName: candidate.album || original.albumName || original.album || "",
    duration: candidate.duration || original.duration,
    source: targetPlatform,
    // 只带目标平台自己的 ID；绝不把主平台 rid/hash 带过去（否则目标源必失败）
    meta: { crossPlatformFrom: original.source },
  };
  if (targetPlatform === "tx") info.songmid = candidate.songmid || candidate.id;
  if (targetPlatform === "wy") { info.id = candidate.id; info.songmid = candidate.songmid || candidate.id; }
  if (targetPlatform === "kw") { info.id = candidate.rid || candidate.id; info.rid = candidate.rid || candidate.id; }
  return info;
}

async function getUrlWithFallback(platform, songInfo, quality, cancelToken = null) {
  if (!platform || typeof platform !== "string" || !PLATFORM_QUALITIES[platform]) {
    throw new Error(`${ERROR_CODES.PARAM_ERROR}: 无效的平台参数`);
  }
  throwIfCanceled(cancelToken);
  if (!songInfo || typeof songInfo !== "object") {
    throw new Error(`${ERROR_CODES.PARAM_ERROR}: 无效的歌曲信息`);
  }

  let cacheKey = buildCacheKey(platform, songInfo, quality);

  // 1. 成功缓存命中（缓存值带实际音质）
  // v8.11.2（D-36，V30b 实测暴露）：缓存槽按**实交付音质**写（D-20 起），却按**请求音质**查——
  // 请求 128k 实给 flac 时，条目在 flac 槽、查询走 128k 槽，同一请求永不命中，每次都重新外呼
  // （全片段曲目更糟：每次都重跑三档再判失败）。与 D-32 兜底同理，按 QUALITY_PRIORITY
  // 找「不低于请求档」的条目；请求档槽本身优先级最高，先查它。
  let cached = getCachedUrl(cacheKey);
  if (!cached) {
    const reqQ36 = String(quality || "128k").toLowerCase();
    for (const eq of QUALITY_PRIORITY) {
      if (eq === reqQ36 || qualityRank(eq) < qualityRank(reqQ36)) continue;
      const k36 = buildCacheKey(platform, songInfo, eq);
      const c36 = getCachedUrl(k36);
      if (c36 && c36.url) {
        cached = c36;
        cacheKey = k36;
        logDebug(`[缓存跨档] ${songInfo?.name || ""} 请求[${reqQ36}]命中[${eq}]槽`);
        break;
      }
    }
  }
  const cachedSourceDisabled = !!(cached && cached.url && cached.source &&
    (!dep('effectiveEnabled')(cached.source) || dep('manualOff')[cached.source]));
  if (cachedSourceDisabled) {
    logInfo(`[缓存失效] ${songInfo?.name || ""} 缓存来自已关闭源 ${cached.source}，丢弃并重新解析`);
    successCache.delete(cacheKey);
  }
  if (cached && cached.url && !cachedSourceDisabled) {
    // v8.11：缓存命中必须同样验真——旧实现直接返回，导致 6 小时缓存里若存着 5 秒片段，
    // 即便判据修好了，用户照样听 5 秒。#4 期最容易被漏掉的一环
    let cacheOk = true;
    let realQ = "";   // T33：缓存命中同样要拿到真实档位，否则脏条目会一直把 128k 标成 flac
    if (cfg("verifyOnCacheHit", true)) {
      try {
        const v = await verifyDelivery(cached.url, { platform, handlerId: cached.source || "", quality, songInfo });
        if (v && v.ok === false) {
          cacheOk = false;
          logWarn(`[缓存校验] 内容不合格(${v.code})，清除该条并重新解析: ${songInfo?.name || ""} 音质[${quality || "128k"}]`);
        } else if (v && v.quality) {
          realQ = String(v.quality).toLowerCase();
        }
      } catch (e) {
        cacheOk = false;
        logDebug(`[缓存校验] 校验异常(${e.code || "?"})，清除该条: ${e.message}`);
      }
    }
    if (cacheOk) {
      // T33：验真已算出真实档位，就把它回填进标签与缓存——旧实现只信 cached.quality，
      // 历史脏条目（修复前按请求档写槽：请求 flac 实给 128k → 128k 存进 flac 槽）会
      // 一直显示 FLAC 直到 6h TTL 到期，属于"能纠正却不纠正"。
      const tagQ = realQ || cached.quality || "128k";
      const slotQ = String(cached.quality || "").toLowerCase();
      // 注意：这里**不写缓存**（M14：缓存写入只允许唯一入口、且必须在验真之后）。
      // 脏条目的槽位留给下一次正常写入修正；命中时每次都用验真结果纠正标签即可。
      if (realQ && slotQ && realQ !== slotQ) {
        logInfo(`[缓存回填] ${songInfo?.name || ""} 槽位[${cached.quality}]→实交付[${realQ}]，标签按真实档显示`);
      }
      return { url: cached.url, type: tagQ, subSource: cached.source || "", subSourceName: dep('SOURCE_HANDLERS')[cached.source]?.name || "", sourcePlatform: actualDeliveryPlatform(cached.source, cached.platform || platform) };
    }
    successCache.delete(cacheKey);
  }

  // 2. 失败缓存命中（v1.0：差异化 TTL——404→1h / 410→1min / 网络错误不缓存）
  const failKey = buildCacheKey(`fail_${platform}`, songInfo, quality);
  const failEntry = getFailCachedEntry(failKey);
  if (failEntry) {
    logDebug(`失败缓存命中[${platform}] ${songInfo?.name || ""} 音质${quality || "128k"}，跳过重复请求`);
    // v8.10.3：命中路径补 code —— 旧实现只抛文案，err.code 为 undefined，App 无法区分
    // "网络全挂的 30s 短缓存"与"真的没版权"；这里按缓存里的代表性失败码还原
    const cachedCode = failEntry.code || ERROR_CODES.NOT_FOUND;
    // v8.16.2（R-10/R-11）：失败缓存命中改用结构化标记表达（旧实现由上层正则匹配中文文案，
    // 文案一改判断即失效）；另：ttl=0 的条目根本进不了这里（getFailCachedEntry 直接返回 null），
    // 「不缓存」是死分支，统一显示「缓存中」。
    const hitErr = new Error(`${cachedCode}: 该请求已知失败(缓存中)，跳过重复请求`);
    hitErr.code = cachedCode;
    hitErr.fromFailCache = true;
    hitErr.failCode = cachedCode;
    throw hitErr;
  }

  if (cfg('coldStartWarmEnabled', true)) warmUpColdStartSources(platform); // v8.8：冷启动源后台预热

  const errors = [];
  const details = []; // v3.0：结构化失败明细（跨音质级汇总，供 App 端展示）
  // v1.0：代表性失败码——业务码(NOT_FOUND/MISMATCH/LINK_EXPIRED)一旦出现即固定(稳定结论)，
  // 网络类码仅在没有业务码时记录；防止低音质级(128k)的网络错误覆盖高音质级的"歌不存在"
  // L4：改为收集 attempts，最后一次 admit 定代表码与 TTL——
  // 优先级「确定性业务码 < 交付类码 < 网络类码」，NOT_AUDIO 不再被 NOT_FOUND 吞掉。
  let lastFailCode = ERROR_CODES.NETWORK_ERROR;
  let localProtect = false;
  const attempts = [];
  const noteAttempt = (code, evidence) => {
    if (code) attempts.push({ code, evidence: evidence || "strong" });
  };

  // 3. 音质降级链（请求音质首位→向下降级；链内按源能力过滤，末级必有源）
  // v8.11：能力备档——该歌上次实际最高只拿到 128k 时，本轮直接从该档起，
  // 避免「用户设 flac 但某首只能 128k，每次都白跑 flac→320k 两档链」
  let effectiveQuality = quality || (QUALITY_FIRST ? "flac" : "128k");
  if (cfg("truthfulQuality", true)) {
    const ceiling = getQualityCeiling(platform, songInfo);
    if (ceiling && qualityRank(ceiling) < qualityRank(effectiveQuality)) {
      logDebug(`[${platform}] 能力备档命中: ${songInfo?.name || ""} 历史最高[${ceiling}]，本轮从该档起`);
      effectiveQuality = ceiling;
    }
  }
  const qualityChain = buildQualityChain(effectiveQuality);
  // v8.15（P0）：记录本轮真正进入过请求链的档；高质档被短路/熔断跳过时不得记成能力上限。
  const attemptedQualities = new Set();
  // v8.8：单次请求总预算（跨音质档共享）；v8.10：分档预算 + 最后一档保底（防高音质吃满总预算饿死低档）
  const { totalMs: totalBudgetMs, floorMs: budgetFloorMs } = resolveBudgetBounds(cfg('raceBudgetMs', 12000), cfg('raceBudgetFloorMs', 3000));
  const totalDeadline = Date.now() + totalBudgetMs;
  const perQBudget = cfg('raceBudgetPerQuality', { flac: 6000, "320k": 5000, "128k": 5000, flac24bit: 6000 });
  // v8.14.1：单档重试受 raceDeadline 的 cancelToken 约束，预算到点后第二次尝试不会越过本档；
  // perQ 保持 5/6s 是“单档最多等一次超时”，不把重试预算叠进总预算。
  for (let qi = 0; qi < qualityChain.length; qi++) {
    const q = qualityChain[qi];
    const isLast = qi === qualityChain.length - 1;
    const selectedQuality = q; // v1.0 (D10)：buildQualityChain 已产出具体音质，无需再选
    // v8.14：档位短路已收口到 computeEligibility，链构建返回的就是最终可用链；
    // 这里不再二次过滤，避免短路配置被两处各判一次。
    const chainAll = sortChainByHealth(buildSourceChain(platform, selectedQuality));
    let chain = chainAll;
    // v8.11：降档时跳过「已判定只给试听片段」的源，别在同一首歌上重复白等；
    // 128k 档例外——它是最后保底机会，永远保留（实测有歌只有 128k 能给完整版）
    if (cfg('qualityFloor', true) && selectedQuality !== "128k" && chain.length > 1) {
      const frag = getFragmentSources(platform, songInfo);
      if (frag.size) {
        const filtered = chain.filter(h => !frag.has(h.id));
        if (filtered.length && filtered.length !== chain.length) {
          logDebug(`[${platform}][${q}] 跳过已判片段源: ${chain.filter(h => frag.has(h.id)).map(h => h.id).join(",")}`);
          chain = filtered;
        }
      }
    }
    if (chainAll.length && !chain.length) {
      // 整条链该档历史 0 成功 → 档位短路，直接降档（省一次必败尝试）
      logDebug(`[${platform}][${q}] 档位短路：全部源该档历史 0 成功，直接降档`);
      errors.push(`[${q}] 档位短路(全部源该档历史0成功)`);
      details.push({ source: "quality-short-circuit", quality: q, code: ERROR_CODES.NETWORK_ERROR, reason: "全部源该档历史0成功，已短路降档" });
      noteAttempt(ERROR_CODES.NETWORK_ERROR, "weak");
      continue;
    }
    if (!chain.length) {
      // 链空不等于“网络全挂”：这里必须把真正的结构/运行期跳过原因带回最终裁决。
      // 旧实现只 push 一句“无可用音源”，attempts 为空，admit() 只能兜底成 NETWORK_ERROR；
      // 被限流退避的源于是被 App 显示成“网络错误”，限流计数/退避也看起来没生效（FAULT8）。
      // 用 peekRuntime 只读资格，绝不调用 canExecute，避免在建链阶段消费半开 trial。
      const skipped = Object.keys(dep('SOURCE_HANDLERS'))
        .map(id => dep('SOURCE_HANDLERS')[id])
        .filter(h => h && h.lifecycle === PROVIDER_LIFECYCLE.ACTIVE)
        .filter(h => h.platforms.includes(platform) && h.chain[platform] != null)
        .filter(h => qualityRank(h.maxQuality) >= qualityRank(q))
        .map(h => {
          const e = computeEligibility(h.id, platform, q, { runtime: true, peekRuntime: true, qualityShortCircuit: true, consumePlayDeadTrial: false });
          return e.eligible ? null : { id: h.id, reason: e.reason, code: e.code, untilMs: e.untilMs };
        })
        .filter(Boolean);
      const chosen = skipped.find(s => s.code === ERROR_CODES.RATE_LIMIT || s.code === "RATE_LIMITED") || skipped[0];
      if (chosen) {
        const untilText = chosen.untilMs ? `，至 ${chosen.untilMs}` : "";
        // 限流是唯一需要把失败码升级成 RATE_LIMIT 的跳过原因；其余本地保护态
        // （熔断/摘除/冷却/档位短路）沿用 NETWORK_ERROR 代表码，避免改变既有调用方契约。
        const isRateLimited = chosen.code === ERROR_CODES.RATE_LIMIT || chosen.code === "RATE_LIMITED";
        const code = isRateLimited ? ERROR_CODES.RATE_LIMIT : ERROR_CODES.NETWORK_ERROR;
        if (["rate-limited", "open", "half-open", "resolve-dead", "play-dead", "preview_cooldown", "quality-short-circuit"].includes(chosen.reason)) {
          localProtect = true;
        }
        errors.push(`[${q}] 无可用音源（${chosen.id}: ${chosen.reason}${untilText}）`);
        details.push({ source: chosen.id, quality: q, code, reason: `无可用音源：${chosen.reason}` });
        noteAttempt(code, "weak");
      } else {
        errors.push(`[${q}] 无可用音源`);
      }
      continue;
    }
    // v8.10.3：分档 deadline —— 单档 = min(该档预算, 剩余总预算)；
    // 末档保底 floor 允许突破总预算（否则前两档吃满预算时末档 0ms 必败 → 点歌无声），
    // 但上界显式钳在 "总预算 + 保底"，即默认 12s + 3s = 15s（与 PARAM_LIMITS 上限一致）
    const remaining = Math.max(totalDeadline - Date.now(), 0);
    const perQ = perQBudget[q] || totalBudgetMs;
    const floorMs = budgetFloorMs;
    const qBudget = Math.min(perQ, remaining);
    const budget = isLast
      ? Math.min(Math.max(qBudget, floorMs), totalBudgetMs + floorMs)
      : qBudget;
    if (chain.length) attemptedQualities.add(q);
    const raceDeadline = Date.now() + budget;
    logDebug(`[${platform}][${q}] 音源链: ${chain.map(h => h.id).join(">")} (按健康排序)，预算 ${Math.round(raceDeadline - Date.now())}ms${isLast ? '（末档保底，可溢出总预算至' + Math.round((totalBudgetMs + floorMs) / 1000) + 's）' : ''}`);
    try {
      const { url, source } = await fallbackRace(chain, platform, songInfo, selectedQuality, raceDeadline);
      // v8.10.3：缓存槽必须与"实交付音质"一致——旧实现用请求音质的 key 写实交付音质的值，
      // 导致请求 flac 实给 128k 时，这条 128k 被存进 flac 槽并按 128k 的 6h TTL 生效，
      // 6 小时内再点 flac 直接吃 128k、永不再试高音质
      const reqQ = String(quality || (QUALITY_FIRST ? "flac" : "128k")).toLowerCase();
      const deliverQ = String(selectedQuality || "128k").toLowerCase();
      // v8.11：标签回填真实音质——窗口里显示的必须是真话
      //（实测：请求 flac，溯音实给 3.19MB/199.4s = 128kbps mp3，旧实现仍标 FLAC）
      const truthQ = (cfg("truthfulQuality", true) && getDeliveryQuality(source, platform, songInfo, selectedQuality)) || deliverQ;
      const truthConfidence = (cfg("truthfulQuality", true) && getDeliveryConfidence(source, platform, songInfo, selectedQuality)) || "exact";
      const writeKey = truthQ === reqQ ? cacheKey : buildCacheKey(platform, songInfo, truthQ);
      setCachedUrl(writeKey, url, truthQ, source, actualDeliveryPlatform(source, platform)); // v1.0：记录实际音质；v6.0：同存实际子源；v8.12：同存实际平台
      // v6.0：音质协商链降档日志（请求flac实际320k/128k时明示，配合 App 真实音质显示）
      if (truthQ !== reqQ) {
        logInfo(`[${platform}] ${songInfo?.name || ""} 音质协商降档: ${reqQ}→${truthQ}（按实交付档入缓存槽）`);
      }
      // v8.15（P0）：能力备档只记“请求档真正进入过请求链”的降级。
      // 若本轮从 ceiling 低档起跑（ceilingApplied），低质交付不得刷新上限；
      // 若高质档被短路/熔断跳过（attemptedQualities 无 reqQ），也不得把这首判成“没有高质”。
      const ceilingApplied = qualityRank(effectiveQuality) < qualityRank(reqQ);
      if (cfg("truthfulQuality", true) && !ceilingApplied && attemptedQualities.has(reqQ) && qualityRank(truthQ) < qualityRank(reqQ)) {
        const reqFailCodes = details.filter(d => String(d.quality || "").toLowerCase() === reqQ).map(d => d.code);
        noteQualityCeiling(platform, songInfo, truthQ, qualityCeilingReasonForCodes(reqFailCodes));
      }
      return { url, type: truthQ, subSource: source || "", subSourceName: dep('SOURCE_HANDLERS')[source]?.name || "", sourcePlatform: actualDeliveryPlatform(source, platform), qualityConfidence: truthConfidence, qualityCeilingApplied: ceilingApplied };
    } catch (e) {
      noteAttempt(extractErrorCode(e), (e && e.evidence) || "strong"); // L4：收集 attempt，末尾统一裁决
      errors.push(`[${q}] ${e.message}`);
      // v3.0：透出结构化失败明细（fallbackRace 已结构化；旧路径兜底单条）
      if (e && Array.isArray(e.detail) && e.detail.length) {
        for (const d of e.detail) { details.push({ ...d }); noteAttempt(d.code, d.evidence); }
      } else {
        const c = extractErrorCode(e);
        details.push({ source: "chain", quality: q, code: c, reason: String((e && e.message) || "") });
        noteAttempt(c, (e && e.evidence) || "strong");
      }
    }
  }

  // 3.5 v8.11 全档片段兜底（用户拍板 B 方案）：所有源都只给试听片段时，宁可交付片段并明确标注
  // 「试听版」，也不要点歌没声——「没声」比「听到 5 秒并知道这是试听」更糟。该条不进 6h 成功缓存。
  // v8.11.1（二轮压测 S9 实测）：源级限流冷却期间该源直接被跳过（details 里没有 PREVIEW_FRAGMENT），
  // 旧条件会导致「连续片段歌触发冷却后，连片段都拿不到」，与「整站只有片段时给片段」的决策冲突。
  // 补一个零上游请求的通道：若该歌该档已记录过片段 URL，冷却期照样按 B 方案交付。
  // v8.11.4（F-01，云端真测暴露）：片段兜底只判「是不是 5 秒音频」，不判「是不是这首歌」。
  // 无 id/hash 时（歌名模糊检索、外部调用、脏数据）上游可能返回别人的片段，兜底会把它
  // 标成「试听版」交付 → 用户听到别人的 5 秒且无提示。片段兜底必须以「有 id 锚点」为前提，
  // 没有锚点就宁可报 NOT_FOUND，也不猜歌。
  const fragAnchor = getHashOrMid(songInfo);
  const hasFragDetail = !!fragAnchor && details.some(d => d.code === ERROR_CODES.PREVIEW_FRAGMENT);
  const hasFragCache = qualityChain.some(q =>
    fragmentUrlMap.has(`${platform}|${getHashOrMid(songInfo)}|${String(q || "").toLowerCase()}`));
  if (cfg("fragmentFallback", true) && fragAnchor && (hasFragDetail || hasFragCache)) {
    const frags = [];
    for (const q of qualityChain) {
      const k = `${platform}|${getHashOrMid(songInfo)}|${String(q || "").toLowerCase()}`;
      const f = fragmentUrlMap.get(k);
      if (f && Date.now() - (f.ts || 0) <= FRAGMENT_URL_TTL_MS) frags.push(f);
      else if (f) fragmentUrlMap.delete(k); // 过期签名直链不得兜底（否则用户听到死链）
    }
    const best = frags.sort((a, b) => qualityRank(b.quality) - qualityRank(a.quality))[0];
    if (best) {
      logWarn(`[全档片段] ${songInfo?.name || ""} 所有源都只给试听片段 → 按 B 方案交付片段并标注「试听版」（不设 6h 缓存）`);
      return {
        url: best.url,
        type: best.quality,
        subSource: best.source,
        subSourceName: `${best.name} · 试听版`,
        sourcePlatform: actualDeliveryPlatform(best.source, platform),
        fragment: true,
        qualityConfidence: "unknown",
      };
    }
  }

  // 4. 过期缓存兜底：仅当过期记录的实际音质不低于请求音质时才返回（防128k冒充flac）
  // v8.11.2（D-32）：原实现只查「请求档」槽，但槽位按**实交付音质**写（D-20），
  // 请求 128k 实给 flac 时条目在 flac 槽 → 兜底永远查不到。改为跨档查找、取不低于请求档的最优条目。
  let expired = null;
  if (successCache.hasExpired(cacheKey)) expired = successCache.getExpired(cacheKey);
  if (!expired) {
    for (const eq of QUALITY_PRIORITY) {
      if (qualityRank(eq) < qualityRank(quality)) continue;
      const ek = buildCacheKey(platform, songInfo, eq);
      if (!successCache.hasExpired(ek)) continue;
      const e = successCache.getExpired(ek);
      if (e && e.url) { expired = e; break; }
    }
  }
  if (expired) {
    if (expired && expired.url) {
      if (qualityRank(expired.quality || "128k") >= qualityRank(quality)) {
        logWarn(`全部音源失败，返回过期缓存兜底(缓存音质${expired.quality}, 请求${quality})`);
        return { url: expired.url, type: expired.quality || "128k", subSource: expired.source || "", subSourceName: dep('SOURCE_HANDLERS')[expired.source]?.name || "", sourcePlatform: actualDeliveryPlatform(expired.source, platform) };
      }
      logWarn(`过期缓存音质(${expired.quality})低于请求(${quality})，不兜底`);
    }
  }

  // 5. 记录失败缓存（v1.0：按代表性失败码差异化 TTL；网络错误不缓存，下次立即重试）
  // v6.0 (A3)：整链全失败且为网络类（上游整体不可用/超时/5xx）→ 写 30s 短失败缓存，
  // 避免同一首歌每次重播都在降级链里白跑 ≈18s；30s 后自动过期恢复重试（上游可能恢复）。
  // 业务类(NOT_FOUND等)维持原差异化 TTL。熔断不受影响——缓存过期后的重试仍会计入源失败。
  // L4：全链失败 → 唯一裁决。代表码按优先级（交付类码不被 NOT_FOUND 覆盖），TTL 由策略表给。
  const finalAdm = admit({ stage: "fallback", attempts });
  if (finalAdm.code) lastFailCode = finalAdm.code;
  const failTtl = finalAdm.ledger.ttlMs === 0 ? cfg('allFailShortTtlMs', 30000) : (finalAdm.ledger.ttlMs || FAIL_CACHE_TTL_MS);
  setFailCached(failKey, lastFailCode, failTtl);
  logDebug(`失败缓存写入[${platform}] code=${lastFailCode} ttl=${failTtl / 1000}s（evidence=${finalAdm.evidence}·${finalAdm.verdict}）`);
  // v7.0：失败逐源明细 logInfo——一次失败一屏看懂"哪些源、为什么失败"（供 App「音源日志」自查）
  if (details.length) {
    logInfo(`[失败明细] 平台=${platform} 歌=${songInfo?.name || ""} 音质=${quality || "128k"} 代表码=${lastFailCode}: ${details.map(d => `${d.source}=${d.code}(${String(d.reason || "").slice(0, 50)})`).join(" | ")}`);
  }
  // v8.10.3：文案前缀改用"代表性失败码"——旧实现固定写 NOT_FOUND，导致 code=NETWORK_TIMEOUT
  // 的错误读起来也像"这首歌不存在"（App 若按文案判类型会误判）
  const finalErr = new Error(`${lastFailCode}: 所有源均失败 [${errors.join(" | ")}]`);
  finalErr.code = lastFailCode; // v1.0：代表性失败码
  // 链空但原因是本地保护态时，必须把保护标记带出去：跨平台兜底不能绕过熔断/摘除/
  // 限流退避（旧实现只按错误码/文案判断，RATE_LIMIT 会被误判成“平台没歌”而去搜别的平台）。
  if (localProtect) finalErr.isThrottleSkip = true;
  finalErr.detail = details; // v3.0：结构化失败明细（{source, quality, code, reason} 数组）
  throw finalErr;
}

function actualDeliveryPlatform(sourceId, requestedPlatform) {
  return DELIVERY_PLATFORM_OVERRIDE[sourceId] || requestedPlatform;
}

function warmUpColdStartSources(platform) {
  for (const h of Object.values(dep('SOURCE_HANDLERS'))) {
    if (!h || !h.coldStart || !dep('effectiveEnabled')(h.id)) continue;
    if (Date.now() - (coldStartWarmAt.get(h.id) || 0) < cfg('coldStartWarmTtlMs', 300000)) continue;
    if (!buildSourceChain(platform, "128k").some(x => x.id === h.id)) continue;
    coldStartWarmAt.set(h.id, Date.now());
    logDebug(`[预热] ${h.id} 冷启动预热已发出`);
    Promise.resolve()
      .then(() => h.fn("kw", "228908", "128k", { name: "晴天", singer: "周杰伦", duration: 269000, songmid: "228908" }))
      .catch(() => {});
  }
}

function resolveBudgetBounds(totalRaw, floorRaw) {
  const totalMs = Math.min(Math.max(Number(totalRaw) || 12000, 1000), 15000);
  // floor=0 是合法“关闭末档保底”，不能被 || 吞成默认 3000（T43 依赖此语义）。
  const floorNum = Number(floorRaw);
  const floorBase = Number.isFinite(floorNum) ? Math.max(floorNum, 0) : 3000;
  const floorMs = Math.min(floorBase, Math.max(0, BUDGET_TOTAL_HARD_LIMIT_MS - totalMs));
  return { totalMs, floorMs };
}

function buildSourceChain(platform, quality) {
  const q = String(quality || "128k").toLowerCase();
  const handlers = Object.keys(dep('SOURCE_HANDLERS'))
    .map(id => dep('SOURCE_HANDLERS')[id])
    .filter(h => h && h.lifecycle === PROVIDER_LIFECYCLE.ACTIVE)
    .filter(h => h.platforms.includes(platform))
    .filter(h => h.chain[platform] != null)
    .filter(h => qualityRank(h.maxQuality) >= qualityRank(q))
    .map(h => {
      const e = computeEligibility(h.id, platform, q, { runtime: true, peekRuntime: true, qualityShortCircuit: true, consumePlayDeadTrial: false });
      if (!e.eligible) {
        if (LOG_DEBUG) logDebug(`[链] ${h.id} 跳过（${e.reason}${e.untilMs ? `，至 ${e.untilMs}` : ""}）`);
        return null;
      }
      // v8.14（F61）：链项必须带本次裁决的 eligibility，后续竞速/执行门/诊断不再各自猜原因。
      // 用浅拷贝而不是改 SOURCE_HANDLERS：全局 handler 是注册表事实源，不能被链构建污染。
      return Object.assign({}, h, { eligibility: e });
    })
    .filter(Boolean)
    .sort((a, b) => (a.chain[platform] || 999) - (b.chain[platform] || 999));
  if (LOG_DEBUG) logDebug(`[链] ${platform} ${q}: ${handlers.map(h => h.id).join(" → ")}`);
  return handlers;
}

function getFragmentSources(platform, songInfo) {
  const key = `${platform}|${getHashOrMid(songInfo)}`;
  const entry = fragmentSourceMap.get(key);
  if (!entry) return new Set();
  if (Date.now() - entry.ts > FRAGMENT_SOURCE_TTL_MS) {
    fragmentSourceMap.delete(key);
    return new Set();
  }
  return entry.sources;
}

function computeEligibility(source, platform, quality, opts) {
  const id = source;
  const o = opts || {};
  const q = String(quality || "128k").toLowerCase();
  if (!dep('SOURCE_HANDLERS')[id]) return { eligible: false, reason: "unknown-source", code: "SOURCE_UNREACHABLE", untilMs: null };
  const h = dep('SOURCE_HANDLERS')[id];
  if (dep('manualOff')[id]) return { eligible: false, reason: "user-off", code: "USER_OFF", untilMs: null };
  if (!dep('isUserEnabled')(id)) return { eligible: false, reason: "default-off", code: "DEFAULT_OFF", untilMs: null };
  if (dep('autoOff')[id]) return { eligible: false, reason: "auto-off", code: "AUTO_OFF_PROBE", untilMs: dep('autoOffAt')[id] ? dep('autoOffAt')[id] + cfg("playDeadReviveMs", 5 * 60 * 1000) : null };
  if (dep('probeState').sleeping[id]) return { eligible: false, reason: "sleeping", code: "SOURCE_SLEEPING", untilMs: null };
  // v8.16.2（R-12③）：平台不支持 ≠ 质量档未开放。旧实现复用了 QUALITY_OPEN，诊断消费者
  // 会把「该源根本不支持这个平台」误读成「这一档还能恢复」，故改为专用码。
  if (platform && h.platforms && !h.platforms.includes(platform)) return { eligible: false, reason: "platform-unsupported", code: "PLATFORM_UNSUPPORTED", untilMs: null };
  if (isResolveDead(id, q, o.consumePlayDeadTrial === true)) return { eligible: false, reason: "resolve-dead", code: ERROR_CODES.PLAYBACK_FAILED, untilMs: dep('resolveDeadDeadline').get(id) || null };
  if (isPlayDead(id, q, o.consumePlayDeadTrial === true)) return { eligible: false, reason: "play-dead", code: ERROR_CODES.PLAYBACK_FAILED, untilMs: dep('playDeadDeadline').get(id) || null };
  // Batch 3：链/快照的“运行期预览”只读，不推进 open→half-open、不消费 trial。
  if (o.runtime && o.peekRuntime) {
    const br = dep('getBreaker')(id);
    const qSlot = br.byQuality[q];
    const qb = qSlot && qSlot.breaker;
    const now = Date.now();
    if (qSlot && qSlot.rateLimitUntil > now) return { eligible: false, reason: "rate-limited", code: "RATE_LIMITED", untilMs: qSlot.rateLimitUntil };
    if (qb && qb.state === "open" && now - (qb.lastFailureTime || 0) < cfg("breakerCooldownMs", BREAKER_COOLDOWN_MS)) {
      return { eligible: false, reason: "open", code: "QUALITY_OPEN", untilMs: (qb.lastFailureTime || 0) + cfg("breakerCooldownMs", BREAKER_COOLDOWN_MS) };
    }
    if (qb && qb.state === "half-open" && qb.trialInFlight) return { eligible: false, reason: "half-open", code: "QUALITY_OPEN", untilMs: null };
  } else if (o.runtime && typeof canExecute === "function" && !canExecute(id, q)) {
    const br = dep('getBreaker')(id);
    const qSlot = br.byQuality[q];
    const qb = qSlot && qSlot.breaker;
    const reason = (qb && qb.state) || br.state || "breaker";
    const until = qSlot ? qSlot.rateLimitUntil : br.rateLimitUntil;
    const code = (until || 0) > Date.now() ? "RATE_LIMITED" : "QUALITY_OPEN";
    return { eligible: false, reason, code, untilMs: until || null };
  }
  const brNow = dep('getBreaker')(id);
  const qbNow = brNow.byQuality[q] && brNow.byQuality[q].breaker;
  // F40：breaker 已进入 half-open 且本次已消费唯一 trial 时，不能再被质量档短路二次拦掉；
  // 否则 Q3 的首次半开永远拿不到请求，失败也无法把 state 收回 open。
  // F40+：冷却到期的 open 也是“唯一试探已就绪”，qualityShortCircuit 不能把它再拦掉；
  // 否则 buildSourceChain 的 peek 不推进 open→half-open，短路会抢在 canExecute 前把链剪断，
  // 半开恢复永远拿不到请求（S5b 实测“冷却后外呼 0”）。
  const breakerTrialReady = !!(o.runtime && qbNow && (
    qbNow.state === 'half-open' ||
    (qbNow.state === 'open' && Date.now() - (qbNow.lastFailureTime || 0) >= cfg('breakerCooldownMs', BREAKER_COOLDOWN_MS))
  ));
  if (!breakerTrialReady && (o.runtime || o.qualityShortCircuit) && cfg('qualityShortCircuit', true) && isQualityHopeless(id, q, platform)) {
    return { eligible: false, reason: "quality-short-circuit", code: "QUALITY_SHORT_CIRCUIT", untilMs: dep('qualitySkipProbeAt').get(dep('qualityShortCircuitKey')(id, q)) || null };
  }
  if (!o.runtime) return { eligible: true, reason: null, code: "ELIGIBLE", untilMs: null };
  // 128k 是冷却期的保底档：wrapExecute 已明确放行 128k，资格层必须同源，
  // 否则 buildSourceChain 会先把整个源过滤掉，保底档永远走不到（T2/T2b/T2c 实测）。
  const pv = previewCooldownMap.get(id);
  if (pv && pv > Date.now() && String(q || "").toLowerCase() !== "128k") {
    return { eligible: false, reason: "preview_cooldown", code: "PREVIEW_COOLDOWN", untilMs: pv };
  }
  return { eligible: true, reason: null, code: "ELIGIBLE", untilMs: null };
}

function getDeliveryQuality(handlerId, platform, songInfo, quality) {
  const key = `${handlerId}|${platform}|${getHashOrMid(songInfo)}|${String(quality || "").toLowerCase()}`;
  return deliveryQualityMap.get(key) || "";
}

function noteQualityCeiling(platform, songInfo, achievedQuality, reason) {
  const key = `${platform}|${getHashOrMid(songInfo)}`;
  const now = Date.now();
  const normalizedReason = QUALITY_CEILING_TTL_BY_REASON[reason] !== undefined ? reason : "unknown";
  const ttlMs = QUALITY_CEILING_TTL_BY_REASON[normalizedReason];
  if (!ttlMs) { qualityCeilingMap.delete(key); return; }
  const existing = qualityCeilingMap.get(key);
  if (existing && qualityRank(existing.quality) >= qualityRank(achievedQuality)) {
    const deadline = Number(existing.nextProbeAt || (Number(existing.ts || 0) + Number(existing.ttlMs || QUALITY_CEILING_TTL_MS)));
    if (now < deadline) return;
  }
  dep('boundedMapSet')(qualityCeilingMap, key, {
    quality: achievedQuality,
    ts: now,
    recordedAt: now,
    nextProbeAt: now + ttlMs,
    reason: normalizedReason,
    ttlMs
  });
}

const fragmentUrlMap = new Map();       // `${platform}|${mid}|${quality}` → {url,quality,source,name}（全档片段兜底用）

const FRAGMENT_URL_TTL_MS = 600000;      // 片段直链是临时签名，10 分钟后不得再拿来兜底

function admit(input) {
  const ctx = input || {};
  const stage = ctx.stage || "candidate";
  const delivery = ctx.delivery || null;
  let verdict = "TRANSIENT";
  let code = ERROR_CODES.NETWORK_ERROR;
  let evidence = "none";
  let reason = "";
  let quality = "";
  let qualityConfidence = "";
  let deliverable = false;

  if (ctx.trialMark === true) {
    // API 层已明确告知是试听 → 免探针直接判片段（省一次 Range，也不受桥影响）
    verdict = "FRAGMENT";
    code = ERROR_CODES.PREVIEW_FRAGMENT;
    evidence = "medium";
    deliverable = true;
    reason = "接口层已标记试听";
  } else if (ctx.probe && ctx.probe.ok === true) {
    // 已验证过的探针结论（verifyDelivery 产出）——不再重复走形态判定
    verdict = "PASS";
    code = null;
    evidence = ctx.probe.evidence || "strong";
    deliverable = true;
    quality = ctx.probe.quality || "";
    qualityConfidence = ctx.probe.qualityConfidence || "";
    reason = "探针已判可交付";
  } else if (stage === "fallback" && Array.isArray(ctx.attempts) && ctx.attempts.length) {
    let best = null, bestRank = -1;
    for (const a of ctx.attempts) {
      if (!a || !a.code) continue;
      const r = codeRank(a.code);
      if (r > bestRank) { best = a; bestRank = r; }
    }
    code = (best && best.code) || ERROR_CODES.NETWORK_ERROR;
    verdict = verdictOfCode(code);
    evidence = strongestEvidence(ctx.attempts.map(a => a && a.evidence));
    deliverable = verdict === "FRAGMENT";
    reason = (best && best.reason) || "";
  } else if (delivery) {
    const status = Number(delivery.statusCode) || 0;
    if (status === 429) {
      verdict = "RATE_LIMITED"; code = ERROR_CODES.RATE_LIMIT; evidence = "strong"; reason = "HTTP 429";
    } else if (status && status !== 200 && status !== 206) {
      const dead = status === 404 || status === 410;
      verdict = dead ? "BUSINESS" : "TRANSIENT";
      code = dead ? ERROR_CODES.LINK_EXPIRED : ERROR_CODES.NETWORK_ERROR;
      evidence = dead ? "strong" : "weak";
      reason = `HTTP ${status}`;
    } else {
      const bytes = toBytes(delivery.body);
      const mediaErr = bytes ? null : mediaEnvelopeErrorCode(delivery.body);
      const shape = kindOf(bytes || delivery.body);
      const totalBytes = totalBytesOf(delivery);
      if (bytes) {
        const fullBody = status === 200 && !String(((delivery.headers || {})["content-range"]) || "");
        const info = sniffAudioBytes(bytes, delivery.headers || {}, totalBytes, fullBody);
        const kind = (info && info.kind) || "unknown";
        if (kind === "audio") {
          evidence = "strong";
          if (isFragmentInfo(info, ctx.songInfo)) {
            verdict = "FRAGMENT"; code = ERROR_CODES.PREVIEW_FRAGMENT; deliverable = true;
          } else {
            verdict = "PASS"; code = null; deliverable = true;
          }
          quality = qualityFromDelivery(info, ctx.quality, originalDurationSec(ctx.songInfo));
          qualityConfidence = qualityConfidenceOf(info, originalDurationSec(ctx.songInfo));
          reason = `字节可定(${info.format || "audio"}${info.durationSec ? "/" + info.durationSec + "s" : ""})`;
        } else if (kind === "playlist") {
          verdict = "NOT_AUDIO"; code = ERROR_CODES.STREAM_PLAYLIST; evidence = "strong"; reason = "交付内容是流播放列表";
        } else if (kind === "json" || kind === "html" || kind === "empty") {
          verdict = "NOT_AUDIO"; code = ERROR_CODES.NOT_AUDIO; evidence = "strong";
          reason = kind === "empty" ? "交付内容为空" : `交付内容不是音频(${kind})`;
        } else {
          // 同 probe：认不出形态且头不是音频（头是音频时 sniff 已判 audio）→ 弱证据判非音频
          verdict = "NOT_AUDIO"; code = ERROR_CODES.NOT_AUDIO; evidence = "weak"; reason = "交付内容无法识别为音频";
        }
      } else if (mediaErr) {
        verdict = "TRANSIENT"; code = mediaErr; evidence = "strong"; reason = `桥媒体信封损坏(${mediaErr})`;
      } else {
        // 没有可识别字节：文本形态的 playlist/json/html 与空体一律判死，只有「头是音频」
        // 且形态不明时才 medium 放行（与 probe 的分支顺序保持一致，避免 m3u8/登录页被交付）。
        if (shape === "playlist") {
          verdict = "NOT_AUDIO"; code = ERROR_CODES.STREAM_PLAYLIST; evidence = "strong"; reason = "交付内容是流播放列表";
        } else if (shape === "json" || shape === "html" || shape === "empty") {
          verdict = "NOT_AUDIO"; code = ERROR_CODES.NOT_AUDIO; evidence = "strong";
          reason = shape === "empty" ? "交付内容为空" : `交付内容不是音频(${shape})`;
        } else {
          const hv = headerEvidence(delivery.headers || {}, totalBytes);
          if (hv.ok === true) {
            verdict = "PASS"; code = null; evidence = "medium"; deliverable = true;
            quality = qualityFromDelivery(hv.info, ctx.quality, originalDurationSec(ctx.songInfo));
            qualityConfidence = qualityConfidenceOf(hv.info, originalDurationSec(ctx.songInfo));
            reason = hv.reason;
          } else if (hv.ok === false) {
            verdict = "NOT_AUDIO"; code = hv.code; evidence = "strong"; reason = hv.reason;
          } else {
            verdict = "TRANSIENT"; code = ERROR_CODES.NETWORK_ERROR; evidence = "weak"; reason = hv.reason;
          }
        }
      }
    }
  } else if (ctx.error && ctx.error.code) {
    code = ctx.error.code;
    verdict = verdictOfCode(code);
    evidence = ctx.error.evidence || "strong";
    deliverable = verdict === "FRAGMENT";
    reason = ctx.error.reason || "";
  }

  const ledger = admissionLedger(verdict, code, evidence);
  return { verdict, code: code || null, evidence, deliverable, quality, qualityConfidence, reason, ledger };
}

const DELIVERY_PLATFORM_OVERRIDE = Object.freeze({ suyinKuwo: "kw" });

const coldStartWarmAt = new Map();

const BUDGET_TOTAL_HARD_LIMIT_MS = 16000;

const fragmentSourceMap = new Map();    // `${platform}|${mid}` → { sources:Set<handlerId>, ts }（片段源记忆，降档时跳过，128k 例外）

const FRAGMENT_SOURCE_TTL_MS = 300000;  // 5 分钟（实测停 80 秒即恢复，5 分钟足够且不长期误伤）

function isResolveDead(sourceId, quality, consume) {
  const streak = dep('resolveDeadStreak').get(sourceId) || 0;
  if (streak < PLAY_DEAD_STREAK) return false;
  const reviveMs = cfg('playDeadReviveMs', 5 * 60 * 1000);
  const age = Date.now() - (dep('resolveDeadDeadline').get(sourceId) || 0);
  if (age < reviveMs) return true;
  const trialKey = sourceId;
  const lastTrial = dep('resolveDeadTrialAt').get(trialKey) || 0;
  if (Date.now() - lastTrial < RESOLVE_DEAD_TRIAL_TTL_MS) return true;
  // 结构读（链构建/快照）只判“是否仍被摘除”：冷却到期就不再拦链；
  // 真正的唯一试探在发请求前的 preGate 消费，避免链构建先吃掉 trial 后 wrapExecute 又拦一次。
  if (!consume) return false;
  dep('resolveDeadTrialAt').set(trialKey, Date.now());
  logDebug(`[取链摘除] ${sourceId} 半开试探放行 quality=${quality || "default"} age=${age}ms revive=${reviveMs}ms`);
  return false;
}

function isPlayDead(sourceId, quality, consume) {
  const streak = dep('playDeadStreak').get(sourceId) || 0;
  if (streak < PLAY_DEAD_STREAK) return false;
  // v8.16.4（疑-31）：档位归因豁免——摘除由某一档触发、且请求的是另一档、且该档有真实成功史时放行。
  // 判据要求「该档至少成功交付并播放过 1 次」（success>0），证据不足一律照旧拦。
  // 这里只放行、不消费 trial：半开唯一试探仍归触发档，避免整条链同时涌入。
  const deadQ = dep('playDeadQuality').get(sourceId);
  const reqQ = String(quality || "").toLowerCase();
  if (deadQ && deadQ !== "*" && reqQ && reqQ !== deadQ) {
    const slot = dep('getBreaker')(sourceId).byQuality[reqQ];
    if (slot && Number(slot.success || 0) > 0) return false;
  }
  const reviveMs = cfg('playDeadReviveMs', 5 * 60 * 1000);
  const age = Date.now() - (dep('playDeadDeadline').get(sourceId) || 0);
  if (age < reviveMs) return true;
  // 冷却期满 → half-open：每个 源×音质档 只放一个试探请求，成功才真正复活，
  // 失败由 recordFailure 重新计时；绝不放整条链同时涌入。
  const trialKey = sourceId; // 半开只允许一个请求/源，不按档各放一个
  const lastTrial = dep('playDeadTrialAt').get(trialKey) || 0;
  if (Date.now() - lastTrial < PLAY_DEAD_TRIAL_TTL_MS) return true;
  // 结构读不消费 trial；冷却到期即放链，唯一试探由 wrapExecute preGate 消费。
  if (!consume) return false;
  dep('playDeadTrialAt').set(trialKey, Date.now());
  logDebug(`[摘除判定] ${sourceId} 半开试探放行 quality=${quality || "default"} age=${age}ms revive=${reviveMs}ms`);
  return false;
}

const BREAKER_COOLDOWN_MS = 180000;

function canExecute(sourceId, quality) {
  const b = dep('getBreaker')(sourceId);
  // F39/F41：带 quality 时先看该档自己的限流/熔断；源级只作为聚合摘要，不能连坐其他档。
  if (quality) {
    const qSlot = qualityLedger(b, quality);
    const qb = qSlot.breaker;
    if (qSlot.rateLimitUntil > 0) {
      if (Date.now() < qSlot.rateLimitUntil) return false;
      qSlot.rateLimitUntil = 0;
      qSlot.rateLimited = false;
    }
    if (qb.state === 'closed') return true;
    if (qb.state === 'open') {
      if (Date.now() - qb.lastFailureTime >= cfg('breakerCooldownMs', BREAKER_COOLDOWN_MS)) {
        qb.state = 'half-open';
        qb.trialInFlight = true; // F40：冷却到期只放这一枪，后续并发在 trial 结束前全拒绝
        return true;
      }
      return false;
    }
    // half-open：已有 trial 在飞就拒绝；上一枪被本地拦截/未落地时才补放一枪。
    if (!qb.trialInFlight) {
      qb.trialInFlight = true;
      return true;
    }
    return false;
  }
  // 旧入口（诊断/外部直接调用）保留源级行为；源级聚合只在全档 open 时才拦。
  if (b.rateLimitUntil > 0) {
    if (Date.now() < b.rateLimitUntil) return false;
    b.rateLimitUntil = 0; b.rateLimited = false;
  }
  if (b.state === 'closed') return true;
  if (b.state === 'open') {
    if (Date.now() - b.lastFailureTime >= cfg('breakerCooldownMs', BREAKER_COOLDOWN_MS)) {
      b.state = 'half-open';
      b.trialInFlight = true;
      return true;
    }
    return false;
  }
  if (b.state === 'half-open') {
    if (!b.trialInFlight) {
      b.trialInFlight = true;
      return true;
    }
    return false;
  }
  return false;
}

function isQualityHopeless(sourceId, quality, platform, opts) {
  const o = opts || {};
  const b = dep('breakerMap').get(sourceId);
  if (!b || !b.byQuality) return false;
  const q = b.byQuality[String(quality)];
  if (!q) return false;
  if ((q.success || 0) > 0) return false;
  // v8.15（P1）：只统计确定性失败 + linkExpired；超时/5xx 交给 breaker 的短冷却/半开，
  // 避免唯一 flac 源连续临时失败被压 1 小时。
  // 兼容旧持久化/旧注入对象：没有 definitiveFail 字段时，旧 fail 就是当时的“全部失败”，沿用其口径。
  const definitive = q.definitiveFail === undefined ? (q.fail || 0) : q.definitiveFail;
  if ((definitive + (q.linkExpired || 0)) < cfg('qualityShortCircuitSamples', 3)) return false;
  const key = dep('qualityShortCircuitKey')(sourceId, quality);
  // v8.14.1（K08）：平台内只有这一个源能交付该高质档时，1h 窗口会把“唯一希望”压死；
  // 唯一源用更短的 10min 探路，仍然保持短路（不每次点歌都白试）。
  const uniqueQualitySource = !!platform && countActiveQualitySources(platform, quality) <= 1;
  const probeMs = uniqueQualitySource
    ? cfg('qualityShortCircuitUniqueProbeMs', 600000)
    : cfg('qualityShortCircuitProbeMs', 21600000);
  if (!dep('qualitySkipProbeAt').has(key)) {
    if (o.setProbe !== false) dep('qualitySkipProbeAt').set(key, Date.now() + probeMs); // 首次达标即短路
    return true;
  }
  if (Date.now() >= dep('qualitySkipProbeAt').get(key)) { dep('qualitySkipProbeAt').set(key, Date.now() + probeMs); return false; } // 到期放行探路
  return true;
}

const previewCooldownMap = new Map();   // `${handlerId}` → 截止时间戳（源级限流冷却）

const deliveryQualityMap = new Map();   // `${handlerId}|${platform}|${mid}|${请求档}` → 实交付音质（供 getUrlWithFallback 回填标签）

function admissionLedger(verdict, code, evidence) {
  const policy = ADMISSION_POLICY[verdict] || ADMISSION_POLICY.TRANSIENT;
  let ttlMs = policy.ttlMs;
  if (code === ERROR_CODES.LINK_EXPIRED) ttlMs = Math.min(ttlMs || 60000, 60000);
  // I6 硬约束：medium/weak 证据一律 ≤60s，不许写 1h、不许判 NOT_FOUND、不许 bump playDead
  if (evidence !== "strong") ttlMs = Math.min(ttlMs || 0, 60000);
  return {
    ttlMs,
    health: policy.health,
    playDead: evidence === "strong" ? policy.playDead : false,
    resolveDead: evidence === "strong" ? policy.resolveDead : false,
    sourceCooldownMs: policy.sourceCooldownMs,
  };
}

const PLAY_DEAD_STREAK = 3;

const RESOLVE_DEAD_TRIAL_TTL_MS = 60 * 1000;

const PLAY_DEAD_TRIAL_TTL_MS = 60 * 1000;

function qualityLedger(b, quality) {
  const key = String(quality || 'default')
  let q = b.byQuality[key]
  if (!q) q = b.byQuality[key] = { req: 0, success: 0, time: 0, fail: 0, businessFail: 0, definitiveFail: 0 }
  if (!q.breaker) q.breaker = { state: 'closed', failureCount: 0, lastFailureTime: 0, trialInFlight: false }
  if (typeof q.rateLimitCount !== 'number') q.rateLimitCount = 0
  if (typeof q.rateLimitUntil !== 'number') q.rateLimitUntil = 0
  if (typeof q.rateLimited !== 'boolean') q.rateLimited = false
  return q
}

function countActiveQualitySources(platform, quality) {
  if (!platform) return 0;
  const q = String(quality || "128k").toLowerCase();
  return Object.values(dep('SOURCE_HANDLERS')).filter(h => h && h.lifecycle === "active"
    && h.platforms && h.platforms.includes(platform)
    && h.chain && h.chain[platform] != null
    && qualityRank(h.maxQuality) >= qualityRank(q)).length;
}

module.exports = {
  tryCrossPlatformFallback,
  CROSS_PLATFORM_ORDER,
  isDefinitiveNoMatch,
  buildCrossTargetInfo,
  getUrlWithFallback,
  actualDeliveryPlatform,
  warmUpColdStartSources,
  resolveBudgetBounds,
  buildSourceChain,
  getFragmentSources,
  computeEligibility,
  getDeliveryQuality,
  noteQualityCeiling,
  fragmentUrlMap,
  FRAGMENT_URL_TTL_MS,
  admit,
  DELIVERY_PLATFORM_OVERRIDE,
  coldStartWarmAt,
  BUDGET_TOTAL_HARD_LIMIT_MS,
  fragmentSourceMap,
  FRAGMENT_SOURCE_TTL_MS,
  isResolveDead,
  isPlayDead,
  BREAKER_COOLDOWN_MS,
  canExecute,
  isQualityHopeless,
  previewCooldownMap,
  deliveryQualityMap,
  admissionLedger,
  PLAY_DEAD_STREAK,
  RESOLVE_DEAD_TRIAL_TTL_MS,
  PLAY_DEAD_TRIAL_TTL_MS,
  qualityLedger,
  countActiveQualitySources,
};
