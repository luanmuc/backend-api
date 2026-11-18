// ============================================================
// v9.0 业务层 · 13-chain（链路辅助：试听/跳过/跨平台兜底）
// 来源：legacy 碎片；对 legacy 的引用已改为依赖注入 dep(name)（打断反向引用环）
// ============================================================
const { songInfoMatch } = require("./09-match.js");
const { extractErrorCode, crossFallbackPolicy } = require("./05-verdict.js");
const { recordHealthEvent, clipText } = require("./03-events.js");
const { createCancelToken } = require("./04-cancel.js");
const { cfg } = require("./02-config.js");
const { logInfo, logDebug } = require("./01-log.js");
const { ERROR_CODES } = require("./02-error-codes.js");
const { QUALITY_TO_X } = require("./09-match.js");
const { buildCacheKey, getCachedUrl, upgradeToHttps, failCache } = require("./07-net.js");
const { dep } = require("./06-binding.js");

async function suyinKuwoGetUrl(songInfo, quality, cancelToken = null) {
  if (!songInfo?.name) throw new Error(`${ERROR_CODES.PARAM_ERROR}: 溯音酷我需要歌曲名`);
  const cacheKey = buildCacheKey("kw", songInfo, quality);
  const cached = getCachedUrl(cacheKey);
  // v7.0 (S1)：内部缓存命中返回裸 URL 字符串（dep('validateUrl') 只接受字符串；子源透出由外层统一组装）
  if (cached && cached.url) return cached.url;
  // v1.0 (D10)：链级已按 maxQuality 过滤，此处直接用请求音质，不再二次降级
  const br = QUALITY_TO_X.kuwo[String(quality || "128k").toLowerCase()] || 1;
  const keywords = dep('buildSearchKeywords')(songInfo);
  let lastError = null;
  for (const item of keywords) {
    try {
      // v1.0 P0-2：兜底档(strict=false)也做歌名校验+时长校验（轻量：歌手/专辑可放宽，但歌名与时长必须一致）
      const url = await dep('suyinKuwoSearch')(item.keyword, br, item.strict ? songInfo : { name: songInfo.name, duration: songInfo.duration }, cancelToken);
      if (url) {
        // v1.0 P0：解析出的酷我CDN链接必须Range可播，否则视为签名过期死链(410)，不缓存、不计成功，继续下一源
        // v1.0 P0-3 (D2)：先升级 https 再校验，确保返回的 https 直链真实可播
        const httpsUrl = dep('assertDeliverableUrl')(upgradeToHttps(url), "溯音酷我");
        if (!await dep('isAudioPlayable')(httpsUrl, 2500, cancelToken)) {
          // v6.0：CDN 410 签名死链改用 LINK_EXPIRED 码——失败缓存走 1min 差异化 TTL（旧用 NOT_FOUND 缓存 1h，恢复要等近1小时才重试该歌）
          const suyinExpiredErr = new Error(`${ERROR_CODES.LINK_EXPIRED}: 溯音酷我签名URL已过期(CDN 410)，不可播`);
          suyinExpiredErr.code = ERROR_CODES.LINK_EXPIRED; // v8.10.4：同上，必须设 code
          throw suyinExpiredErr;
        }
        // v8.12（D-20）：删除内层写缓存——dep('isAudioPlayable') 只验「能播」，不验时长/完整度，
        // 片段 URL 会因此进入 30min/6h 成功缓存，绕过外层验真闸门。统一由外层验真后写。
        // D-31：兜底档(strict=false)丢 singer 后只剩歌名+时长校验，可能放行同名同时长的错歌手。
        // 行为按既有取舍保留（有总比没有好），但必须留下可定位的痕迹，避免"悄悄放错歌"。
        if (!item.strict) {
          logInfo(`[兜底档] 歌手未校验（仅歌名+时长）: ${songInfo?.name || ""} ← 关键词「${item.keyword}」`);
        }
        return httpsUrl;
      }
    } catch (e) { lastError = e; }
  }
  throw lastError || new Error(`${ERROR_CODES.NOT_FOUND}: 溯音酷我失败`);
}

async function suyinGetUrl(platform, songId, quality, songInfo, cancelToken = null) {
  switch (platform) {
    case "tx": return dep('suyinQQGetUrl')(songInfo, quality, cancelToken);
    case "wy": return dep('suyin163GetUrl')(songInfo, cancelToken);
    case "kw": return suyinKuwoGetUrl(songInfo, quality, cancelToken);
    case "mg": return dep('suyinMiguGetUrl')(songInfo, cancelToken);
    default: throw new Error(`${ERROR_CODES.PARAM_ERROR}: 溯音不支持该平台`);
  }
}

function skipReason(source, ctx) {
  // v8.16.3（R-13）：这是只读查询入口，必须走 peek 分支——
  // 旧实现未传 peekRuntime，会落到 dep('canExecute') 的可写分支，把冷却已满的 open 档推进成
  // half-open 并置 trialInFlight，等于「问一句跳过原因就把该档唯一的半开名额烧掉」，之后 60s 全拒。
  const e = dep('computeEligibility')(source, ctx && ctx.platform, ctx && ctx.quality, { runtime: true, peekRuntime: true, consumePlayDeadTrial: false });
  if (e.eligible) return null;
  return { reason: e.reason, code: e.code, untilMs: e.untilMs };
}

function structuralSkipReason(source, quality, consumePlayDeadTrial) {
  const e = dep('computeEligibility')(source, null, quality, { runtime: false, consumePlayDeadTrial: consumePlayDeadTrial === true });
  if (e.eligible) return null;
  return { reason: e.reason, code: e.code, untilMs: e.untilMs };
}

function sortChainByHealth(chain) {
  // F62：排序函数自带 eligible 防线；dep('buildSourceChain') 仍是唯一过滤入口，这里只防复用退化。
  return chain.slice().filter(x => x && x.eligible !== false && !x.skipReason).sort((a, b) => {
    // v4.0：verified 源(内部 songInfoMatch 校验)附加优先权重——健康分相近时已校验源靠前（串行兜底顺序）；
    // 竞速层 dep('raceFirst') 已有 verified 优先返回机制，此权重仅优化 rest 兜底顺序
    const av = a.verified ? 0.15 : 0;
    const bv = b.verified ? 0.15 : 0;
    const ha = dep('computeHealthScore')(a.id).score + av;
    const hb = dep('computeHealthScore')(b.id).score + bv;
    if (Math.abs(hb - ha) > 0.05) return hb - ha;
    return dep('computeHealthScore')(a.id).avgTime - dep('computeHealthScore')(b.id).avgTime;
  });
}

async function getUrlWithCrossPlatformFallback(platform, songInfo, quality, traceId) {
  if (!cfg("crossPlatformEnabled", true) || !songInfo?.name) {
    return dep('getUrlWithFallback')(platform, songInfo, quality);
  }
  const crossCached = dep('getCrossFallbackCached')(platform, songInfo, quality);
  if (crossCached) {
    logDebug(`[跨平台缓存] ${platform} ${songInfo?.name || ""} 命中 ${crossCached.result.sourcePlatform}，${dep('CROSS_FALLBACK_CACHE_TTL_MS') / 60000}min 内不再搜`);
    return { ...crossCached.result };
  }
  return new Promise((resolve, reject) => {
    let settled = false;
    let fallbackStarted = false;
    let fallbackDone = false;
    let fallbackErr = null;
    let primaryErr = null;
    let timer = null;
    /* v8.16.2（R-09）：兜底必须有可取消句柄——旧实现 settleOk 只 clearTimeout + resolve，
     * 已发出的 fallback 继续打上游并记账，主平台晚于 grace 成功时等于白打一轮 + 污染健康账本。 */
    const crossToken = createCancelToken();
    const failKey = buildCacheKey(`fail_${platform}`, songInfo, quality);

    const settleOk = (r) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      crossToken.cancel("primary_settled");
      resolve(r);
    };
    const settleErr = (e) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      crossToken.cancel("primary_failed");
      reject(e);
    };
    const startFallback = (reason) => {
      if (settled || fallbackStarted) return;
      fallbackStarted = true;
      recordHealthEvent({
        event: "cross_platform", traceId, platform: "multi", quality,
        ok: false, code: "START", reason: clipText(reason || "FAILED", 40),
      });
      dep('tryCrossPlatformFallback')(platform, songInfo, quality, primaryErr, traceId, crossToken).then(r => {
        if (settled) return;
        // 主平台失败缓存立刻清掉：跨平台已经证明这首歌可交付，不能让 1h/30s 的
        // 「已知失败」把下一次播放继续挡在主平台失败分支里。
        failCache.delete(failKey);
        dep('setCrossFallbackCached')(platform, songInfo, quality, r);
        recordHealthEvent({
          event: "cross_platform", traceId, platform: r.sourcePlatform, sourceId: r.subSource,
          quality, ok: true, code: "", reason: clipText(`${platform}->${r.sourcePlatform}`, 40), latencyMs: 0,
        });
        logInfo(`[跨平台] ${platform} 失败(${extractErrorCode(primaryErr) || "?"}) → ${r.sourcePlatform} 交付 ${r.subSource || ""}，已清主平台失败缓存`);
        settleOk(r);
      }).catch(e => {
        if (settled) return;
        fallbackDone = true;
        fallbackErr = e;
        recordHealthEvent({
          event: "cross_platform", traceId, platform: "multi", quality,
          ok: false, code: extractErrorCode(e) || ERROR_CODES.NOT_FOUND,
          reason: clipText(`${platform}->all`, 40),
        });
        // 主平台还没返回时，跨平台先失败不能替主平台判死：
        // 主平台可能只是慢（例如取链 6s+ 但最终成功）。等 primaryTask 自己收口。
        if (primaryErr) settleErr(e);
      });
    };

    const primaryTask = dep('getUrlWithFallback')(platform, songInfo, quality);
    primaryTask.then(r => {
      if (settled) return;
      settleOk({ ...r, sourcePlatform: r.sourcePlatform || dep('actualDeliveryPlatform')(r.subSource, platform) });
    }).catch(e => {
      primaryErr = e;
      // v8.16.2（R-10）：兜底判据全部走 crossFallbackPolicy（err.code / 布尔标记），文案只做展示。
      // 旧实现四条中文正则 → 文案改动即静默改变兜底行为；且 NETWORK_ERROR 兜底、NETWORK_TIMEOUT
      // 不兜底，同类失败两种待遇（现已统一）。
      const policy = crossFallbackPolicy(e);
      if (!policy.fallback) {
        logDebug(`[跨平台] 不兜底: ${policy.reason}（code=${extractErrorCode(e) || "?"}）`);
        settleErr(e);
        return;
      }
      // 只有「超时/主链尚未返回」才等 grace；其余确定性结论立即跨平台。
      // 尤其 NOT_AUDIO / 片段：上游已明确给出不可用内容，再等 6s 只会白等
      // （实测 V1e/V12a 会因等待期间跨平台抢跑而把原错误码改写成 NOT_FOUND）。
      startFallback(policy.reason);
      // 跨平台已经先失败、现在主平台也失败 → 此时才允许整体失败。
      if (fallbackDone && fallbackErr) settleErr(fallbackErr);
    });
    const graceMs = Math.max(0, Number(cfg("crossPlatformGraceMs", 3000)) || 0);
    timer = setTimeout(() => {
      if (!settled) startFallback(primaryErr ? extractErrorCode(primaryErr) : "PRIMARY_SLOW");
    }, graceMs);
  });
}

module.exports = {
  suyinKuwoGetUrl,
  suyinGetUrl,
  skipReason,
  structuralSkipReason,
  sortChainByHealth,
  getUrlWithCrossPlatformFallback,
};
