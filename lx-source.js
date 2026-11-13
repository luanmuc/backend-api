/*!
 * @name 豆包定制[聚合音源]
 * @description v8.13.0 源完全体（12 登记源 / 10 上链 / 2 观察；Provider Contract；生命周期治理；真取消）
 * @version 8.13.0
 * @author 豆包定制
 */
var __lxSourceBundle = (() => {
  var __defProp = Object.defineProperty;
  var __defProps = Object.defineProperties;
  var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };
  var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
  var __objRest = (source, exclude) => {
    var target = {};
    for (var prop in source)
      if (__hasOwnProp.call(source, prop) && exclude.indexOf(prop) < 0)
        target[prop] = source[prop];
    if (source != null && __getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(source)) {
        if (exclude.indexOf(prop) < 0 && __propIsEnum.call(source, prop))
          target[prop] = source[prop];
      }
    return target;
  };
  var __commonJS = (cb, mod) => function __require() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e) {
      throw mod = 0, e;
    }
  };

  // src/legacy.js
  var require_legacy = __commonJS({
    "src/legacy.js"(exports, module) {
      var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n;
      var USER_CONFIG = {
        ikunApiKey: typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.ikunApiKey || "",
        // 填入 ikun 卡密后开启
        lingchuanApiKey: typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.lingchuanApiKey || "",
        xinghaiDeviceId: typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.xinghaiDeviceId || "",
        // v5.0：运行参数全量可配置（从 __lxSourceConfig 读取，缺省用代码默认值，行为与历史一致）
        // v8.11.1（审计修复）：交付真实性闸门的开关/阈值必须可注入——旧版这几个键不在白名单，
        // cfg() 永远拿到默认值，导致"可关闭、可回滚"是空话（实测 __lxSourceConfig.verifyDelivery=false 完全无效，
        // 片段兜底也无法用配置关掉，只能整版回滚）。布尔开关一律用 ?? ，否则 false 会被默认值吞掉。
        verifyDelivery: (_a = typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.verifyDelivery) != null ? _a : true,
        truthfulQuality: (_b = typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.truthfulQuality) != null ? _b : true,
        qualityFloor: (_c = typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.qualityFloor) != null ? _c : true,
        verifyOnCacheHit: (_d = typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.verifyOnCacheHit) != null ? _d : true,
        // v8.12：跨平台兜底开关与等待窗口。确定性失败立即回退；只有超时类失败先给主平台
        // 一个 grace 窗口，避免主平台马上要成功时白跑一次跨平台搜索。
        crossPlatformEnabled: (_e = typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.crossPlatformEnabled) != null ? _e : true,
        crossPlatformGraceMs: (_f = typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.crossPlatformGraceMs) != null ? _f : 6e3,
        crossPlatformSearchTimeoutMs: typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.crossPlatformSearchTimeoutMs || 4e3,
        // v8.11.2（D-33，V23b 实测暴露）：previewUrlPreFilter 旧不在白名单，cfg() 永远拿到默认 false，
        // 开关等于不存在（helloworld 的试听URL预筛因此从未执行）。补进白名单，布尔用 ?? 防 false 被吞。
        previewUrlPreFilter: (_g = typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.previewUrlPreFilter) != null ? _g : false,
        fragmentFallback: (_h = typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.fragmentFallback) != null ? _h : true,
        // F57：持久化 v2 回滚开关；false 时导出旧 v1，旧宿主忽略 v2。
        healthV2Enabled: (_i = typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.healthV2Enabled) != null ? _i : true,
        // v8.11.2（D-35，V26c/d/f 实测暴露）：验真族阈值用 || 读配置时，传 0 会被吞成默认值（0 比例/0 间隔=不设限 是合法值），统一改 ?? 。
        verifyTimeoutMs: (_j = typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.verifyTimeoutMs) != null ? _j : 3e3,
        verifyMinOriginalSec: (_k = typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.verifyMinOriginalSec) != null ? _k : 90,
        verifyDurRatio: (_l = typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.verifyDurRatio) != null ? _l : 0.6,
        verifyDurGapSec: (_m = typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.verifyDurGapSec) != null ? _m : 15,
        cacheTtlMs: typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.cacheTtlMs || 216e5,
        // 成功缓存 TTL(6h，低音质用)
        cacheTtlHighQualityMs: typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.cacheTtlHighQualityMs || 18e5,
        // v8.10：高音质缓存 TTL(30min，flac/320k/24bit 用)
        failCacheNotFoundMs: typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.failCacheNotFoundMs || 36e5,
        // 失败缓存 404→1h
        failCacheExpiredMs: typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.failCacheExpiredMs || 6e4,
        // 失败缓存 410→1min
        breakerThreshold: typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.breakerThreshold || 3,
        // 熔断阈值
        breakerCooldownMs: typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.breakerCooldownMs || 18e4,
        // 熔断冷却
        rateLimitBackoffMs: typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.rateLimitBackoffMs || 3e4,
        // 429退避
        maxConcurrency: typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.maxConcurrency || 2,
        // 单源并发上限
        rateWindowMs: typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.rateWindowMs || 3e3,
        // 限速窗口
        rateWindowMax: typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.rateWindowMax || 5,
        // 窗口内请求上限
        healthCheckIntervalMs: typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.healthCheckIntervalMs || 6e5,
        // 探测间隔(10min)
        probeConcurrency: typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.probeConcurrency || 3,
        // v8.14：探测并发上限(默认3,最大8)
        raceMatchWaitMs: typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.raceMatchWaitMs || 600,
        // verified 等待窗口
        allFailShortTtlMs: (_n = typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.allFailShortTtlMs) != null ? _n : 3e4,
        // v6.0：全链网络类失败短缓存 TTL(补齐 v6.0 漏配键)
        raceBudgetMs: typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.raceBudgetMs || 12e3,
        // v8.8：单次请求总预算(跨音质档共享)
        raceBudgetPerQuality: typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.raceBudgetPerQuality || { flac: 6e3, "320k": 5e3, "128k": 5e3, flac24bit: 6e3 },
        // v8.10：分档预算（防高音质吃满总预算饿死低档）
        raceBudgetFloorMs: typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.raceBudgetFloorMs != null ? globalThis.__lxSourceConfig.raceBudgetFloorMs : 3e3,
        // v8.10：最后一档保底预算(防整次取链失败)
        raceBatchSize: typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.raceBatchSize || 3,
        // v8.8：每批并发源数
        raceBatchStaggerMs: typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.raceBatchStaggerMs || 300,
        // v8.8：批间错峰
        coldStartTimeoutMs: typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.coldStartTimeoutMs || 8e3,
        // v8.8：冷启动源单源超时
        coldStartProbeTimeoutMs: typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.coldStartProbeTimeoutMs || 3e4,
        // v8.10：冷启动源探针超时（onrender 冷态 30s，8s 必误判）
        coldStartWarmTtlMs: typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.coldStartWarmTtlMs || 3e5,
        // v8.8：冷启动预热间隔
        eligibilityShadow: !!(typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.eligibilityShadow),
        // Batch 0：默认关闭，只写 debug 影子 diff
        qualityShortCircuit: typeof globalThis !== "undefined" && globalThis.__lxSourceConfig ? globalThis.__lxSourceConfig.qualityShortCircuit : void 0,
        // v8.8：档位短路开关(缺省 true)
        coldStartWarmEnabled: typeof globalThis !== "undefined" && globalThis.__lxSourceConfig ? globalThis.__lxSourceConfig.coldStartWarmEnabled : void 0,
        // v8.8：冷启动预热开关(缺省 true)
        qualityShortCircuitSamples: typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.qualityShortCircuitSamples || 3,
        // v8.8：档位短路样本门槛
        qualityShortCircuitProbeMs: typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.qualityShortCircuitProbeMs || 36e5,
        // v8.10：短路放行探路间隔(1h，原 6h 太长)
        playDeadReviveMs: typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.playDeadReviveMs || 3e5,
        // v7.0：播放摘除后半开试探冷却期(5min)
        // 五轮 MEM：记忆表条目上限（与 ALLOWED_KEYS/PARAM_LIMITS 同步登记；漏了这行注入会静默失效）
        memoryMapMax: typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.memoryMapMax || 2e3
      };
      function cfg(key, def) {
        const v = USER_CONFIG[key];
        if (v === void 0 || v === null || v === "") return def;
        if (typeof def === "number" && !Number.isFinite(v)) return def;
        return v;
      }
      var CACHE_TTL_MS = 216e5;
      var VERIFY_MIN_ORIGINAL_SEC = 90;
      var VERIFY_DUR_RATIO = 0.6;
      var VERIFY_DUR_GAP_SEC = 15;
      var VERIFY_RANGE_BYTES = 1023;
      var QUALITY_CEILING_TTL_MS = 216e5;
      var FAIL_CACHE_TTL_MS = 3e5;
      var CACHE_MAX_SIZE = 500;
      var FAIL_CACHE_MAX_SIZE = 300;
      var MEMORY_MAP_MAX = 2e3;
      var HTTP_URL_REGEX = /^https?:\/\//i;
      var BREAKER_THRESHOLD = 3;
      var BREAKER_COOLDOWN_MS = 18e4;
      var RATE_LIMIT_BACKOFF_MS = 3e4;
      var RATE_LIMIT_TRIP = 3;
      var SOURCE_MAX_CONCURRENCY = 2;
      var RATE_WINDOW_MS = 3e3;
      var RATE_WINDOW_MAX = 5;
      var RETRY_TIMES = 1;
      var ERROR_CODES = {
        NETWORK_TIMEOUT: "NETWORK_TIMEOUT",
        NETWORK_ERROR: "NETWORK_ERROR",
        PARAM_ERROR: "PARAM_ERROR",
        RATE_LIMIT: "RATE_LIMIT",
        SERVER_ERROR: "SERVER_ERROR",
        NOT_FOUND: "NOT_FOUND",
        MISMATCH: "SONG_MISMATCH",
        CONFIG_ERROR: "CONFIG_ERROR",
        LINK_EXPIRED: "LINK_EXPIRED",
        // v1.0：HTTP 410 签名/直链过期
        // v8.11：交付真实性闸门（wrapExecute 交付前用真实字节判定，取代靠 URL 关键词的死代码检测）
        PREVIEW_FRAGMENT: "PREVIEW_FRAGMENT",
        // 只拿到试听片段（如酷我 VIP 歌三档同给 5s）
        NOT_AUDIO: "NOT_AUDIO",
        // 返回网页/JSON 等根本不是音频的内容
        STREAM_PLAYLIST: "STREAM_PLAYLIST",
        // m3u8 等流播放列表，播放器不支持
        TRUNCATED_MEDIA: "TRUNCATED_MEDIA",
        // P2：桥信封分片缺失/截断
        BAD_ENVELOPE: "BAD_ENVELOPE",
        // P2：桥信封长度或 base64 结构不符
        CONTRACT_ERROR: "CONTRACT_ERROR",
        // v8.13：Provider Contract 校验失败
        CANCELED: "CANCELED"
        // v8.13：竞速输家/预算耗尽后的协作式取消
      };
      function normalizeErrCode(err, fallback) {
        if (!err || err.code) return err;
        const msg = String(err.message || "");
        const hitKey = Object.keys(ERROR_CODES).find((k) => msg.startsWith(k + ":") || msg.startsWith(ERROR_CODES[k] + ":"));
        err.code = hitKey ? ERROR_CODES[hitKey] : fallback || ERROR_CODES.NETWORK_ERROR;
        return err;
      }
      function createCancelToken() {
        let canceled = false;
        let reason = "";
        const listeners = /* @__PURE__ */ new Set();
        return {
          get canceled() {
            return canceled;
          },
          get reason() {
            return reason;
          },
          cancel(why) {
            if (canceled) return false;
            canceled = true;
            reason = String(why || "canceled");
            for (const fn of listeners) {
              try {
                fn(reason);
              } catch (e) {
              }
            }
            listeners.clear();
            return true;
          },
          onCancel(fn) {
            if (typeof fn !== "function") return () => {
            };
            if (canceled) {
              try {
                fn(reason);
              } catch (e) {
              }
              return () => {
              };
            }
            listeners.add(fn);
            return () => listeners.delete(fn);
          }
        };
      }
      function canceledError(reason) {
        const err = new Error(`${ERROR_CODES.CANCELED}: \u5DF2\u53D6\u6D88(${String(reason || "race_settled")})`);
        err.code = ERROR_CODES.CANCELED;
        err.canceled = true;
        return err;
      }
      function throwIfCanceled(token) {
        if (token && token.canceled) throw canceledError(token.reason);
      }
      function raceWithCancel(promise, token) {
        if (!token) return Promise.resolve(promise);
        if (token.canceled) return Promise.reject(canceledError(token.reason));
        return new Promise((resolve, reject) => {
          let done = false;
          const off = token.onCancel((reason) => {
            if (done) return;
            done = true;
            reject(canceledError(reason));
          });
          Promise.resolve(promise).then(
            (v) => {
              if (done) return;
              done = true;
              off();
              resolve(v);
            },
            (e) => {
              if (done) return;
              done = true;
              off();
              reject(e);
            }
          );
        });
      }
      var CODE_HINT = {
        [ERROR_CODES.PREVIEW_FRAGMENT]: "\u8BE5\u66F2\u76EE\u53EA\u63D0\u4F9B\u8BD5\u542C\u7247\u6BB5\uFF08\u5DF2\u5C3D\u91CF\u7ED9\u51FA\u53EF\u7528\u7247\u6BB5\uFF09",
        [ERROR_CODES.NOT_AUDIO]: "\u63A5\u53E3\u8FD4\u56DE\u7684\u4E0D\u662F\u6709\u6548\u97F3\u9891\u5185\u5BB9",
        [ERROR_CODES.STREAM_PLAYLIST]: "\u63A5\u53E3\u8FD4\u56DE\u7684\u662F\u6D41\u64AD\u653E\u5217\u8868\uFF0C\u64AD\u653E\u5668\u4E0D\u652F\u6301",
        [ERROR_CODES.TRUNCATED_MEDIA]: "\u6865\u5A92\u4F53\u4FE1\u5C01\u5206\u7247\u7F3A\u5931\u6216\u88AB\u622A\u65AD",
        [ERROR_CODES.BAD_ENVELOPE]: "\u6865\u5A92\u4F53\u4FE1\u5C01\u7ED3\u6784\u6216\u957F\u5EA6\u4E0D\u7B26"
      };
      var FAIL_CACHE_TTL_BY_CODE = {
        [ERROR_CODES.NOT_FOUND]: 60 * 60 * 1e3,
        // 404/无版权/搜索无结果 → 1小时
        [ERROR_CODES.MISMATCH]: 60 * 60 * 1e3,
        // 歌信息不匹配(近1h内重查意义低) → 1小时
        [ERROR_CODES.LINK_EXPIRED]: 60 * 1e3,
        // 410 签名死链 → 1分钟
        [ERROR_CODES.PARAM_ERROR]: 60 * 1e3,
        // v8.11.2：上游返回非法URL(非http/https) → 1分钟（脏数据会很快恢复）
        // v8.11：交付真实性类——只缓存很短时间，且片段按音质档分键，避免 flac 失败连坐 128k
        [ERROR_CODES.PREVIEW_FRAGMENT]: 30 * 1e3,
        // 试听片段 → 30秒
        [ERROR_CODES.NOT_AUDIO]: 60 * 1e3,
        // 非音频内容 → 1分钟
        [ERROR_CODES.STREAM_PLAYLIST]: 60 * 1e3,
        // 流播放列表 → 1分钟
        [ERROR_CODES.TRUNCATED_MEDIA]: 0,
        // 传输截断 → 不缓存(重传可恢复)
        [ERROR_CODES.BAD_ENVELOPE]: 0,
        // 信封结构错误 → 不缓存
        [ERROR_CODES.RATE_LIMIT]: 0,
        // 限流 → 不缓存(会恢复)
        [ERROR_CODES.NETWORK_TIMEOUT]: 0,
        // 超时 → 不缓存(瞬时)
        [ERROR_CODES.NETWORK_ERROR]: 0,
        // 网络错误 → 不缓存(瞬时)
        [ERROR_CODES.SERVER_ERROR]: 0
        // 5xx → 不缓存(服务端会恢复)
      };
      var TIMEOUT_CONFIG = { search: 3e3, parse: 5e3, default: 5e3 };
      var SUYIN_QQ_API = "https://oiapi.net/api/QQ_Music";
      var SUYIN_QQ_KEY = "oiapi-ef6133b7-ac2f-dc7d-878c-d3e207a82575";
      var SUYIN_163_API = "https://oiapi.net/api/Music_163";
      var SUYIN_KUWO_API = "https://oiapi.net/api/Kuwo";
      var SUYIN_MIGU_API = "https://api.xcvts.cn/api/music/migu";
      var HUIBQ_API = "https://lxmusicapi.onrender.com";
      var JUHE_API = "https://api.music.lerd.dpdns.org";
      var HUIBQ_REQUEST_KEY = "share-v3";
      var XINGHAI_BACKEND_API = "https://yy.zddyr.top/lx/api/";
      var WY_OUTER_API = "https://music.163.com/song/media/outer/url?id={id}.mp3";
      var WY_LYRIC_API = "https://music.163.com/api/song/lyric";
      var WY_DETAIL_API = "https://music.163.com/api/song/detail";
      var KUWO_SEARCH_API = "http://search.kuwo.cn/r.s";
      var KUWO_CONVERT_API = "http://antiserver.kuwo.cn/anti.s";
      var QQ_SEARCH_API = "https://c.y.qq.com/soso/fcgi-bin/client_search_cp";
      var WY_SEARCH_API = "https://music.163.com/api/search/get/web";
      var CROSS_PLATFORM_ORDER = ["tx", "wy", "kw"];
      var DELIVERY_PLATFORM_OVERRIDE = Object.freeze({ suyinKuwo: "kw" });
      function actualDeliveryPlatform(sourceId, requestedPlatform) {
        return DELIVERY_PLATFORM_OVERRIDE[sourceId] || requestedPlatform;
      }
      var CROSS_PLATFORM_NAMES = { tx: "QQ\u97F3\u4E50", wy: "\u7F51\u6613\u4E91\u97F3\u4E50", kw: "\u9177\u6211\u97F3\u4E50" };
      var IKUN_API = "https://c.wwwweb.top";
      var CHANGQING_URL_TEMPLATES = {
        tx: "http://175.27.166.236/kgqq/qq.php?type=mp3&id={id}&level={level}",
        wy: "http://175.27.166.236/wy/wy.php?type=mp3&id={id}&level={level}",
        kw: "https://musicapi.haitangw.net/music/kw.php?type=mp3&id={id}&level={level}",
        kg: "https://music.haitangw.cc/kgqq/kg.php?type=mp3&id={id}&level={level}",
        mg: "https://music.haitangw.cc/musicapi/mg.php?type=mp3&id={id}&level={level}"
      };
      var HELLOWORLD_KW_CONVERT_API = "http://nmobi.kuwo.cn/mobi.s";
      var HELLOWORLD_HTW_API = "https://musicserver.haitangw.cc/v1/music/resolve-url";
      var SOURCE_TOGGLES = {
        // v8.13：12 个登记源 / 10 个上链源 / 2 个观察源。
        // 观察源（probation）默认关闭，只探测、不进播放链：suyinQQ(tx)、suyinMigu(mg)。
        suyinKuwo: true,
        // 溯音酷我：五平台兜底（kw/wy/tx/mg/kg）
        wyOuter: true,
        // 网易云官方 outer 直连：固定 128k 免费歌直链
        kuwoOfficial: true,
        // 酷我官方直连：固定 128k 真实 mp3
        suyin163: true,
        // 溯音163：免费歌真实 128k 直链
        xinghaiBackend: true,
        // 星海后端主域：kw 高音质双源 + 128k 兜底
        helloworldKw: true,
        // helloworld(kw)：convert_url_with_sign 直链，kw 128k/320k/flac
        changqingVip: true,
        // 长青：kw 128k 兜底
        huibq: true,
        // Huibq：kw/wy 链尾兜底（冷启动源）
        juheTx: true,
        // Juhe 聚合(tx)：tx 第二源，7 天复核
        ikun: true,
        // ikun：kw/wy 链尾兜底（公益版免卡密）
        suyinQQ: false,
        // 观察源：2026-11-11 实测 HTTP 403，只探测，不进链，复核 2026-11-19
        suyinMigu: false
        // 观察源：2026-11-11 实测上游 502，只探测，不进链，复核 2026-11-26
      };
      var runtimeToggles = __spreadValues({}, SOURCE_TOGGLES);
      var userEnabled = __spreadValues({}, SOURCE_TOGGLES);
      var autoOff = {};
      var autoOffReason = {};
      var autoOffAt = {};
      function isUserEnabled(id) {
        return userEnabled[id] !== false;
      }
      function isAutoOff(id) {
        return !!autoOff[id];
      }
      function effectiveEnabled(id) {
        return isUserEnabled(id) && !isAutoOff(id);
      }
      function syncRuntimeToggle(id) {
        runtimeToggles[id] = effectiveEnabled(id);
      }
      var manualOff = {};
      var HEALTH_CHECK_INTERVAL_MS = 10 * 60 * 1e3;
      var HEALTH_CHECK_INITIAL_DELAY_MS = 60 * 1e3;
      var HEALTH_CHECK_TIMEOUT = 6e3;
      var PROBE_PASS_REQUIRED = 2;
      var PROBE_FAIL_REQUIRED = 2;
      var PROBE_TIER_CORE_INTERVAL = 1;
      var PROBE_TIER_SECONDARY_INTERVAL = 3;
      var PROBE_SLEEP_AFTER_DEAD = 3;
      var PROBE_WAKE_EVERY_ROUND = 10;
      var PROBE_SONG_POOL = ["\u6674\u5929", "\u6D77\u9614\u5929\u7A7A", "\u7A3B\u9999", "\u9752\u82B1\u74F7", "\u4E03\u91CC\u9999", "\u591C\u66F2", "\u540E\u6765", "\u5149\u5E74\u4E4B\u5916", "\u6F14\u5458", "\u5E73\u51E1\u4E4B\u8DEF", "\u6210\u90FD", "\u5C0F\u5E78\u8FD0"];
      var PROBE_163_IDS = ["2652820720", "347230"];
      function juheProbeCfg(platform, ids) {
        return {
          tier: "secondary",
          // 每3轮一探（免费 worker，减少对限流中上游的打扰）
          useHandler: true,
          handlerPlatform: platform,
          handlerSong: __spreadValues({ name: "\u6674\u5929", singer: "\u5468\u6770\u4F26", duration: 271e3 }, ids),
          url: `${JUHE_API}/${platform}`,
          method: "POST",
          headers: { "Content-Type": "application/json", "User-Agent": getMobileUserAgent() },
          body: JSON.stringify({
            type: "128k",
            musicInfo: __spreadProps(__spreadValues({ name: "\u6674\u5929", singer: "\u5468\u6770\u4F26", album: "\u53F6\u60E0\u7F8E", duration: 271e3, interval: 271, source: platform }, ids), { quality: "128k" })
          }),
          check: (b) => !!b && typeof b === "object" && (Number(b.code) === 200 || Number(b.code) === 303)
        };
      }
      function buildProbeConfig() {
        const probeSong = PROBE_SONG_POOL[(globalThis.__probeRound || 0) % PROBE_SONG_POOL.length];
        const probe163Id = PROBE_163_IDS[(globalThis.__probeRound || 0) % PROBE_163_IDS.length];
        const cfg2 = {
          // ---- 上链源：10 个 ----
          suyinKuwo: {
            tier: "core",
            probes: [
              {
                quality: "flac",
                useHandler: true,
                songName: probeSong,
                url: `${SUYIN_KUWO_API}?msg=${encodeURIComponent(probeSong)}&n=1&br=1`,
                check: (b) => !!b && typeof b === "object" && (!!(b.data && b.data.url) || /音乐链接/.test(String(b.message || ""))),
                extractUrl: (b) => (b && b.data && b.data.url ? b.data.url : (String(b && b.message || "").match(/音乐链接[：:](\S+)/) || [])[1]) || null
              },
              {
                quality: "320k",
                useHandler: true,
                songName: probeSong,
                url: `${SUYIN_KUWO_API}?msg=${encodeURIComponent(probeSong)}&n=1&br=5`,
                check: (b) => !!b && typeof b === "object" && (!!(b.data && b.data.url) || /音乐链接/.test(String(b.message || ""))),
                extractUrl: (b) => (b && b.data && b.data.url ? b.data.url : (String(b && b.message || "").match(/音乐链接[：:](\S+)/) || [])[1]) || null
              },
              {
                quality: "128k",
                useHandler: true,
                songName: probeSong,
                url: `${SUYIN_KUWO_API}?msg=${encodeURIComponent(probeSong)}&n=1&br=9`,
                check: (b) => !!b && typeof b === "object" && (!!(b.data && b.data.url) || /音乐链接/.test(String(b.message || ""))),
                extractUrl: (b) => (b && b.data && b.data.url ? b.data.url : (String(b && b.message || "").match(/音乐链接[：:](\S+)/) || [])[1]) || null
              }
            ]
          },
          xinghaiBackend: {
            tier: "core",
            quality: "128k",
            useHandler: true,
            handlerPlatform: "kw",
            handlerSong: { name: "\u6674\u5929", singer: "\u5468\u6770\u4F26", songmid: "228908", id: "228908", duration: 271e3 },
            url: `${XINGHAI_BACKEND_API}?source=kw&name=${encodeURIComponent("\u6674\u5929")}&singer=${encodeURIComponent("\u5468\u6770\u4F26")}&songmid=1&interval=&albumName=&quality=128k`,
            headers: { "X-Client": "lx-aggregate/13.0" },
            check: (b) => !!b && typeof b === "object" && Number(b.code) === 200 && typeof b.url === "string" && b.url.length > 0
          },
          suyin163: {
            tier: "core",
            quality: "128k",
            useHandler: true,
            handlerStyle: "songInfo",
            handlerSong: { id: probe163Id, name: "\u6674\u5929", singer: "\u5468\u6770\u4F26", duration: 271e3 },
            url: `${SUYIN_163_API}?id=${probe163Id}`,
            check: (b) => !!b && typeof b === "object" && Array.isArray(b.data) && typeof (b.data[0] || {}).url === "string" && b.data[0].url.length > 0,
            extractUrl: (b) => b && Array.isArray(b.data) && typeof (b.data[0] || {}).url === "string" && b.data[0].url.length > 0 ? b.data[0].url : null
          },
          wyOuter: {
            tier: "core",
            quality: "128k",
            useHandler: true,
            handlerPlatform: "wy",
            handlerSong: { id: "2652820720", songmid: "2652820720", name: "\u6674\u5929", singer: "\u5468\u6770\u4F26", duration: 271e3 },
            url: WY_OUTER_API.replace("{id}", "2652820720"),
            headers: { "User-Agent": getMobileUserAgent() },
            checkRes: (res) => {
              var _a2;
              return res.statusCode === 200 && /audio|octet|mpeg/i.test(String(((_a2 = res.headers) == null ? void 0 : _a2["content-type"]) || ""));
            }
          },
          kuwoOfficial: {
            tier: "secondary",
            quality: "128k",
            useHandler: true,
            handlerPlatform: "kw",
            handlerSong: { name: "\u6674\u5929", singer: "\u5468\u6770\u4F26", duration: 271e3 },
            url: `${KUWO_SEARCH_API}?client=kt&all=${encodeURIComponent("\u6674\u5929 \u5468\u6770\u4F26")}&pn=0&rn=1&ft=music&rformat=json&encoding=utf8`,
            headers: { "User-Agent": getMobileUserAgent() },
            check: (b) => {
              const raw = typeof b === "string" ? b : String(b || "");
              return raw.includes("MP3RID") && raw.includes("abslist");
            }
          },
          helloworldKw: {
            tier: "secondary",
            quality: "flac",
            useHandler: true,
            handlerPlatform: "kw",
            handlerSong: { rid: "228908", name: "\u6674\u5929", duration: 0 },
            url: `${HELLOWORLD_KW_CONVERT_API}?f=web&user=0&source=kwplayerhd_ar_1.1.4.5_tianbao_T1A_qirui.apk&type=convert_url_with_sign&rid=228908&br=2000kflac`,
            headers: { "User-Agent": getMobileUserAgent() },
            check: (b) => !!b && typeof b === "object" && Number(b.code) === 200 && !!b.data && typeof b.data.url === "string" && b.data.url.length > 0
          },
          changqingVip: {
            tier: "secondary",
            quality: "128k",
            useHandler: true,
            handlerPlatform: "kw",
            handlerSong: { rid: "228908", songmid: "228908", id: "228908", name: "\u6674\u5929", singer: "\u5468\u6770\u4F26", duration: 271e3 },
            url: CHANGQING_URL_TEMPLATES.kw.replace("{id}", "228908").replace("{level}", "standard"),
            headers: { "User-Agent": getMobileUserAgent(), "Range": "bytes=0-1023" },
            checkRes: (res) => {
              var _a2;
              return (res.statusCode === 200 || res.statusCode === 206) && /audio|octet|mpeg/i.test(String(((_a2 = res.headers) == null ? void 0 : _a2["content-type"]) || "")) && !/kw\.php/.test(String(res.url || ""));
            }
          },
          juheTx: juheProbeCfg("tx", { songmid: "228908", id: "228908", quality: "128k" }),
          ikun: {
            tier: "secondary",
            quality: "128k",
            useHandler: true,
            handlerPlatform: "kw",
            handlerSong: { name: "\u6674\u5929", singer: "\u5468\u6770\u4F26", songmid: "228908", id: "228908", duration: 271e3 },
            url: `${IKUN_API}/music/url`,
            method: "POST",
            headers: { "Content-Type": "application/json", "User-Agent": getMobileUserAgent(), "X-Api-Key": USER_CONFIG.ikunApiKey || "" },
            body: JSON.stringify({ source: "kw", musicId: "228908", quality: "128k" }),
            check: (b) => !!b && typeof b === "object" && Number(b.code) === 200 && typeof b.url === "string" && b.url.length > 0,
            extractUrl: (b) => b && typeof b === "object" && typeof b.url === "string" && b.url.length > 0 ? upgradeToHttps(b.url) : null
          },
          huibq: {
            tier: "secondary",
            quality: "128k",
            useHandler: true,
            handlerPlatform: "kw",
            handlerSong: { name: "\u6674\u5929", singer: "\u5468\u6770\u4F26", songmid: "228908", id: "228908", duration: 271e3 },
            url: `${HUIBQ_API}/url/kw/228908/128k`,
            headers: { "X-Request-Key": HUIBQ_REQUEST_KEY, "User-Agent": getMobileUserAgent() },
            check: (b) => !!b && typeof b === "object" && Number(b.code) === 0 && typeof b.url === "string" && b.url.length > 0 && !isHuibqFailMsg(b.msg),
            extractUrl: (b) => b && typeof b === "object" && typeof b.url === "string" && b.url.length > 0 ? b.url : null
          },
          // ---- 观察源：2 个（只探测，不进链） ----
          suyinQQ: {
            tier: "secondary",
            probes: [
              {
                quality: "128k",
                useHandler: true,
                handlerPlatform: "tx",
                handlerSong: { songmid: "0039MnYb0qxYpD", name: "\u6674\u5929", duration: 0 },
                url: `${SUYIN_QQ_API}?key=${encodeURIComponent(SUYIN_QQ_KEY)}&type=json&br=7&n=1&mid=0039MnYb0qxYpD`,
                check: (b) => !!b && typeof b === "object" && !!(b.music || b.url || String(b.message || "").match(/音频链接[：:]/)),
                extractUrl: (b) => b && (b.music || b.url) || (String(b && b.message || "").match(/音频链接[：:](\S+)/) || [])[1] || null
              },
              {
                quality: "320k",
                useHandler: true,
                handlerPlatform: "tx",
                handlerSong: { songmid: "0039MnYb0qxYpD", name: "\u6674\u5929", duration: 0 },
                url: `${SUYIN_QQ_API}?key=${encodeURIComponent(SUYIN_QQ_KEY)}&type=json&br=5&n=1&mid=0039MnYb0qxYpD`,
                check: (b) => !!b && typeof b === "object" && !!(b.music || b.url || String(b.message || "").match(/音频链接[：:]/)),
                extractUrl: (b) => b && (b.music || b.url) || (String(b && b.message || "").match(/音频链接[：:](\S+)/) || [])[1] || null
              }
            ]
          },
          suyinMigu: {
            tier: "secondary",
            quality: "128k",
            useHandler: true,
            handlerStyle: "songInfo",
            handlerSong: { name: "\u6674\u5929", singer: "\u5468\u6770\u4F26", duration: 271e3 },
            url: `${SUYIN_MIGU_API}?gm=${encodeURIComponent("\u6674\u5929")}&n=1&num=1&type=json`,
            check: (b) => !!b && typeof b === "object" && Number(b.code) === 200 && !!b.musicInfo,
            extractUrl: (b) => b && typeof b.musicInfo === "string" ? b.musicInfo : b && b.musicInfo && typeof b.musicInfo.url === "string" ? b.musicInfo.url : null
          }
        };
        const round = globalThis.__probeRound || 0;
        for (const id of Object.keys(cfg2)) {
          if (!SOURCE_HANDLERS[id]) {
            delete cfg2[id];
            continue;
          }
          if (manualOff[id]) {
            delete cfg2[id];
            continue;
          }
          const probation = SOURCE_HANDLERS[id].lifecycle === "probation";
          if (!probation && !isUserEnabled(id)) {
            delete cfg2[id];
            continue;
          }
          if (probeState.sleeping[id]) {
            const since = probeState.sleepRound[id] || 0;
            if (round - since < PROBE_WAKE_EVERY_ROUND) {
              delete cfg2[id];
            } else {
              logWarn(`\u5065\u5EB7\u63A2\u6D4B: [${id}] \u5230\u8FBE\u590D\u6D3B\u8BD5\u63A2\u8F6E\uFF0C\u91CD\u63A2`);
            }
          }
        }
        return cfg2;
      }
      function tierShouldProbe(round, tier, sourceId) {
        const interval = tier === "secondary" ? PROBE_TIER_SECONDARY_INTERVAL : PROBE_TIER_CORE_INTERVAL;
        if (round % interval !== 0) return false;
        if (sourceId && (probeState.passStreak[sourceId] || 0) >= 5 && round % 2 !== 0) return false;
        return true;
      }
      var probeState = {
        passCount: {},
        // v6.0：连续通过轮数（不清零的长期连胜，用于探测降频；passCount 到 PROBE_PASS_REQUIRED 会清零，无法承载降频判断）
        passStreak: {},
        failCount: {},
        // v3.0：失效休眠状态——deadCount 连续失败累计；sleeping=true 进入休眠；sleepRound 记录休眠起点轮
        deadCount: {},
        sleeping: {},
        sleepRound: {},
        // v8.14：最近一次逐质量档探测结果，供健康页 matrix / 诊断使用（只存枚举和延迟，不存 URL）
        lastTargets: {},
        running: false
      };
      function probeErrorOutcome(e) {
        const code = extractErrorCode(e);
        const msg = String(e && e.message || "");
        if (code === ERROR_CODES.NETWORK_TIMEOUT) return { outcome: "UNKNOWN", code };
        if (code === ERROR_CODES.NETWORK_ERROR && !/^NETWORK_ERROR:\s*HTTP\s+\d+/i.test(msg)) return { outcome: "UNKNOWN", code };
        return { outcome: "FAIL", code };
      }
      async function probeSingleSource(id, pc) {
        const probes = pc.probes || [{
          quality: pc.quality,
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
        const traceId = `probe:${globalThis.__probeRound || 0}:${id}`;
        try {
          const results = await Promise.all(probes.map(async (p) => {
            const startProbe = Date.now();
            const quality = p.quality || pc.quality || null;
            try {
              const h = SOURCE_HANDLERS[id];
              const probeTimeout = h && h.coldStart ? cfg("coldStartProbeTimeoutMs", 3e4) : HEALTH_CHECK_TIMEOUT;
              if (p.useHandler) {
                try {
                  const h2 = SOURCE_HANDLERS[id];
                  if (h2 && typeof h2.fn === "function") {
                    const hSong = p.handlerSong || { name: p.songName, duration: 0 };
                    const url = p.handlerStyle === "songInfo" ? await h2.fn(hSong, null) : await h2.fn(p.handlerPlatform || "kw", "", quality, hSong, null);
                    const playable = typeof url === "string" && await isAudioPlayable(upgradeToHttps(url), probeTimeout);
                    const duration2 = Date.now() - startProbe;
                    recordHealthEvent({ event: "probe_result", traceId, sourceId: id, quality, ok: playable, code: playable ? "" : "PROBE_FAIL", latencyMs: duration2, reason: playable ? "PASS" : "FAIL" });
                    return { usable: playable, outcome: playable ? "PASS" : "FAIL", code: playable ? "" : "PROBE_FAIL", quality, duration: duration2, viaHandler: true };
                  }
                } catch (e) {
                  if (typeof logDebug === "function") logDebug(`[\u63A2\u6D4B] ${id} handler \u63A2\u9488\u56DE\u9000\uFF1A${extractErrorCode(e)}`);
                }
              }
              const res = await httpRequest(p.url || "", {
                method: p.method || "GET",
                headers: __spreadValues({ "User-Agent": getMobileUserAgent() }, p.headers || {}),
                body: p.body,
                timeout: probeTimeout,
                follow_max: 5
                // v1.0 P0：统一跟随302，修复wyOuter(outer 302→mp3)被误判失败
              });
              let usable2 = p.checkRes ? p.checkRes(res) : p.check ? p.check(res.body) : true;
              if (usable2 && typeof p.extractUrl === "function") {
                const audioUrl = p.extractUrl(res.body);
                usable2 = audioUrl ? await isAudioPlayable(audioUrl, probeTimeout) : false;
              }
              const outcome2 = usable2 ? "PASS" : "FAIL";
              const duration = Date.now() - startProbe;
              recordHealthEvent({ event: "probe_result", traceId, sourceId: id, quality, ok: usable2, code: usable2 ? "" : "PROBE_FAIL", latencyMs: duration, reason: outcome2 });
              return { usable: usable2, outcome: outcome2, code: usable2 ? "" : "PROBE_FAIL", quality, duration };
            } catch (e) {
              const duration = Date.now() - startProbe;
              const classified = probeErrorOutcome(e);
              recordHealthEvent({ event: "probe_result", traceId, sourceId: id, quality, ok: false, code: classified.code, latencyMs: duration, reason: classified.outcome });
              return { usable: false, outcome: classified.outcome, code: classified.code, quality, duration };
            }
          }));
          const passCount = results.filter((r) => r.outcome === "PASS").length;
          const failCount = results.filter((r) => r.outcome === "FAIL").length;
          const unknownCount = results.filter((r) => r.outcome === "UNKNOWN").length;
          const outcome = passCount > 0 ? "PASS" : failCount > 0 ? "FAIL" : "UNKNOWN";
          const usable = outcome === "PASS";
          const code = passCount > 0 ? "" : (results.find((r) => r.code) || {}).code || (outcome === "UNKNOWN" ? "PROBE_UNKNOWN" : "PROBE_FAIL");
          recordProbeResult(id, usable, results.reduce((s, r) => s + r.duration, 0) / Math.max(results.length, 1));
          return {
            usable,
            outcome,
            code,
            results,
            targets: results.map((r) => ({ quality: r.quality, outcome: r.outcome, code: r.code || null, latencyMs: r.duration, viaHandler: !!r.viaHandler })),
            passCount,
            failCount,
            unknownCount,
            viaHandler: results.some((r) => r.viaHandler === true),
            raw: null
          };
        } catch (e) {
          const classified = probeErrorOutcome(e);
          recordHealthEvent({ event: "probe_result", traceId, sourceId: id, ok: false, code: classified.code, latencyMs: 0, reason: classified.outcome });
          recordProbeResult(id, false, 0);
          return { usable: false, outcome: classified.outcome, code: classified.code, results: [], targets: [], passCount: 0, failCount: 0, unknownCount: 0, raw: null };
        }
      }
      function recordProbeResult(id, usable, avgDuration) {
        const b = getBreaker(id);
        b.probeRequests = (b.probeRequests || 0) + 1;
        if (usable) {
          b.probeSuccess = (b.probeSuccess || 0) + 1;
          b.probeTime = (b.probeTime || 0) + (avgDuration || 0);
        }
      }
      function applyProbeResult(id, usable, detail = {}) {
        const outcome = detail.outcome || (usable ? "PASS" : "FAIL");
        if (Array.isArray(detail.targets) && detail.targets.length) probeState.lastTargets[id] = detail.targets.map((t) => ({ quality: t.quality || null, outcome: t.outcome || outcome, code: t.code || null, latencyMs: Number(t.latencyMs || 0) }));
        if (outcome === "UNKNOWN") {
          probeState.passCount[id] = 0;
          probeState.passStreak[id] = 0;
          logInfo(`\u5065\u5EB7\u63A2\u6D4B: [${id}] \u7ED3\u679C UNKNOWN\uFF08\u672C\u5730\u7F51\u7EDC/\u8D85\u65F6/\u672A\u53D6\u8BC1\uFF09\uFF0C\u4E0D\u5173\u95ED\u3001\u4E0D\u7D2F\u8BA1\u5931\u8D25`);
          recordHealthEvent({ event: "health_transition", sourceId: id, reason: "probe_unknown" });
          return { outcome, enabled: runtimeToggles[id] !== false, autoOff: !!autoOff[id] };
        }
        if (usable) {
          const br = getBreaker(id);
          if (br.state !== "closed" || br.failureCount > 0 || br.rateLimited) {
            br.state = "closed";
            br.failureCount = 0;
            br.lastFailureTime = 0;
            br.rateLimitUntil = 0;
            br.rateLimited = false;
            br.rateLimitCount = 0;
            logInfo(`\u5065\u5EB7\u63A2\u6D4B: [${id}] \u63A2\u6D4B\u901A\u8FC7\uFF0C\u65AD\u8DEF\u5668\u4E0E\u9650\u6D41\u9000\u907F\u5DF2\u590D\u4F4D`);
          }
          probeState.failCount[id] = 0;
          probeState.passCount[id] = (probeState.passCount[id] || 0) + 1;
          probeState.passStreak[id] = (probeState.passStreak[id] || 0) + 1;
          delete probeState.deadCount[id];
          delete probeState.sleeping[id];
          delete probeState.sleepRound[id];
          if (probeState.passCount[id] >= PROBE_PASS_REQUIRED) {
            const h = SOURCE_HANDLERS[id];
            const canAutoOn = isUserEnabled(id) && !manualOff[id];
            if (h && h.lifecycle === PROVIDER_LIFECYCLE.PROBATION) {
              logInfo(`\u5065\u5EB7\u63A2\u6D4B: [${id}] \u89C2\u5BDF\u6E90\u63A2\u6D4B\u901A\u8FC7\uFF08\u4FDD\u6301\u4E0D\u8FDB\u94FE\uFF0C\u590D\u6838\u65E5 ${h.reviewAt || "\u672A\u5B9A"}\uFF09`);
            } else if (canAutoOn && autoOff[id]) {
              const from = "AUTO_OFF";
              delete autoOff[id];
              delete autoOffReason[id];
              delete autoOffAt[id];
              syncRuntimeToggle(id);
              logInfo(`\u5065\u5EB7\u63A2\u6D4B: [${id}] \u8FDE\u7EED${PROBE_PASS_REQUIRED}\u6B21\u63A2\u6D4B\u901A\u8FC7\uFF0C\u81EA\u52A8\u5173\u95ED\u5DF2\u89E3\u9664\uFF08AUTO_ON_PROBE\uFF09`);
              recordHealthEvent({ event: "health_transition", sourceId: id, from, to: "ELIGIBLE", reason: "auto_on_probe" });
            } else if (canAutoOn && runtimeToggles[id] === false) {
              autoOff[id] = false;
              syncRuntimeToggle(id);
              logInfo(`\u5065\u5EB7\u63A2\u6D4B: [${id}] \u8FDE\u7EED${PROBE_PASS_REQUIRED}\u6B21\u63A2\u6D4B\u901A\u8FC7\uFF0C\u5DF2\u81EA\u52A8\u542F\u7528`);
            }
            probeState.passCount[id] = 0;
          }
        } else {
          probeState.passCount[id] = 0;
          probeState.passStreak[id] = 0;
          probeState.failCount[id] = (probeState.failCount[id] || 0) + 1;
          if (probeState.failCount[id] >= PROBE_FAIL_REQUIRED) {
            const h = SOURCE_HANDLERS[id];
            const isColdStart = h && h.coldStart;
            const shouldAutoOff = isUserEnabled(id) && !manualOff[id] && !isColdStart && !autoOff[id];
            if (shouldAutoOff) {
              autoOff[id] = true;
              autoOffReason[id] = "AUTO_OFF_PROBE";
              autoOffAt[id] = Date.now();
              syncRuntimeToggle(id);
              logWarn(`\u5065\u5EB7\u63A2\u6D4B: [${id}] \u8FDE\u7EED${PROBE_FAIL_REQUIRED}\u6B21\u63A2\u6D4B\u5931\u8D25\uFF0C\u5DF2\u81EA\u52A8\u5173\u95ED\uFF08AUTO_OFF_PROBE\uFF0C\u6062\u590D\u540E\u81EA\u52A8\u63A2\u6D4B\u5F00\u542F\uFF09`);
              recordHealthEvent({ event: "health_transition", sourceId: id, from: "ELIGIBLE", to: "AUTO_OFF", reason: "auto_off_probe" });
            } else if (isColdStart) {
              logWarn(`\u5065\u5EB7\u63A2\u6D4B: [${id}] \u8FDE\u7EED${PROBE_FAIL_REQUIRED}\u6B21\u63A2\u6D4B\u5931\u8D25\uFF0C\u51B7\u542F\u52A8\u8C41\u514D\u81EA\u52A8\u5173\u95ED\uFF08\u51B7\u6001\u53EF\u80FD\u672A\u5524\u9192\uFF0C\u4FDD\u7559\u542F\u7528\uFF09`);
            }
            probeState.failCount[id] = 0;
          }
          probeState.deadCount[id] = (probeState.deadCount[id] || 0) + 1;
          if (probeState.deadCount[id] >= PROBE_SLEEP_AFTER_DEAD) {
            if (!probeState.sleeping[id]) {
              probeState.sleeping[id] = true;
              probeState.sleepRound[id] = globalThis.__probeRound || 0;
              logWarn(`\u5065\u5EB7\u63A2\u6D4B: [${id}] \u8FDE\u7EED${PROBE_SLEEP_AFTER_DEAD}\u8F6E\u5931\u8D25\uFF0C\u8FDB\u5165\u4F11\u7720(\u6BCF${PROBE_WAKE_EVERY_ROUND}\u8F6E\u590D\u6D3B\u8BD5\u63A2\u4E00\u6B21)`);
              recordHealthEvent({ event: "health_transition", sourceId: id, from: autoOff[id] ? "AUTO_OFF" : "ELIGIBLE", to: "SLEEPING", reason: "probe_sleep" });
            } else {
              probeState.sleepRound[id] = globalThis.__probeRound || 0;
            }
          }
        }
        return { outcome, enabled: runtimeToggles[id] !== false, autoOff: !!autoOff[id], reason: autoOffReason[id] || null };
      }
      var healthHistory = [];
      var HEALTH_HISTORY_MAX = 144;
      var HEALTH_EVENT_MAX = 500;
      var HEALTH_EVENT_FIELDS = ["traceId", "event", "sourceId", "platform", "quality", "ok", "code", "latencyMs", "reason", "from", "to"];
      var healthEventRing = [];
      var healthEventSeq = 0;
      var healthEventDropped = 0;
      var HEALTH_TRACE_KEY = /* @__PURE__ */ Symbol("lxHealthTrace");
      var clipText = (v, max) => String(v == null ? "" : v).slice(0, max);
      function recordHealthEvent(entry) {
        if (!entry || typeof entry !== "object") return;
        const e = {
          seq: ++healthEventSeq,
          ts: Date.now(),
          traceId: clipText(entry.traceId, 64),
          event: clipText(entry.event || "unknown", 32)
        };
        for (const k of HEALTH_EVENT_FIELDS) {
          if (k === "traceId" || k === "event" || entry[k] === void 0) continue;
          if (k === "ok") {
            if (typeof entry.ok === "boolean") e.ok = entry.ok;
          } else if (k === "latencyMs") {
            const n = Number(entry.latencyMs);
            if (Number.isFinite(n) && n >= 0) e.latencyMs = Math.round(n);
          } else {
            e[k] = clipText(entry[k], k === "reason" ? 40 : 48);
          }
        }
        healthEventRing.push(e);
        while (healthEventRing.length > HEALTH_EVENT_MAX) {
          const dropAt = healthEventRing.findIndex((x) => x.event !== "health_transition");
          healthEventRing.splice(dropAt >= 0 ? dropAt : 0, 1);
          healthEventDropped++;
        }
      }
      function getHealthEvents(params) {
        const cap = Math.min(Math.max(Number(params && params.limit) || HEALTH_EVENT_MAX, 1), HEALTH_EVENT_MAX);
        const traceId = clipText(params && params.traceId, 64);
        const filtered = traceId ? healthEventRing.filter((e) => e.traceId === traceId) : healthEventRing;
        return {
          schema: 1,
          capacity: HEALTH_EVENT_MAX,
          dropped: healthEventDropped,
          events: filtered.slice(-cap).map((e) => __spreadValues({}, e))
        };
      }
      function attachHealthTrace(songInfo, traceId) {
        if (!songInfo || typeof songInfo !== "object") return;
        try {
          Object.defineProperty(songInfo, HEALTH_TRACE_KEY, {
            value: clipText(traceId, 64),
            configurable: true,
            enumerable: false
          });
        } catch (e) {
        }
      }
      function healthTraceOf(songInfo) {
        return songInfo && typeof songInfo === "object" && songInfo[HEALTH_TRACE_KEY] || "";
      }
      async function runHealthCheck(saveHistory = true) {
        if (probeState.running) return;
        probeState.running = true;
        try {
          const round = globalThis.__probeRound = (globalThis.__probeRound || 0) + 1;
          const probeConfig = buildProbeConfig();
          const ids = Object.keys(probeConfig).filter((id) => tierShouldProbe(round, probeConfig[id].tier || "core", id));
          logInfo(`\u5065\u5EB7\u63A2\u6D4B: \u5F00\u59CB\u7B2C${round}\u8F6E\uFF0C\u5171${ids.length}\u4E2A\u6E90(\u6838\u5FC3\u6BCF\u8F6E/\u6B21\u8981${PROBE_TIER_SECONDARY_INTERVAL}\u8F6E\u4E00\u63A2)`);
          const concurrency = Math.max(1, Math.min(8, Number(cfg("probeConcurrency", 3)) || 3));
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
          const active = Object.keys(runtimeToggles).filter((k) => runtimeToggles[k]);
          logInfo(`\u5065\u5EB7\u63A2\u6D4B: \u672C\u8F6E\u5B8C\u6210\uFF0C\u5F53\u524D\u81EA\u52A8\u542F\u7528: ${active.join(", ")}`);
          if (saveHistory) {
            const snap = getHealthSnapshot();
            const historyEntry = {
              timestamp: Date.now(),
              sources: {}
            };
            for (const [id, item] of Object.entries(snap)) {
              if (id.startsWith("_")) continue;
              historyEntry.sources[id] = {
                score: item.healthScore,
                successRate: item.successRate
              };
            }
            healthHistory.push(historyEntry);
            if (healthHistory.length > HEALTH_HISTORY_MAX) healthHistory.shift();
          }
        } catch (e) {
          logWarn(`\u5065\u5EB7\u63A2\u6D4B\u5F02\u5E38: ${e && e.message ? e.message : String(e)}`);
        } finally {
          probeState.running = false;
        }
      }
      function nextHealthCheckDelay(intervalMs, rand) {
        var _a2;
        const iv = Math.max(1e3, Number(intervalMs) || HEALTH_CHECK_INTERVAL_MS);
        const ratio = Math.max(0, Math.min(0.5, Number((_a2 = (globalThis.__lxSourceConfig || {}).healthCheckJitterRatio) != null ? _a2 : 0.1)));
        const r = typeof rand === "function" ? rand() : Math.random();
        return Math.max(1e3, Math.round(iv * (1 - ratio + 2 * ratio * r)));
      }
      function hasActiveWork() {
        let active = inflightUrl.size;
        for (const n of inflightCount.values()) active += Number(n) || 0;
        return active > 0;
      }
      function startHealthCheck() {
        const schedule = (delay) => setTimeout(async () => {
          if (hasActiveWork()) {
            const retry = Math.max(1e3, Number(cfg("healthCheckPauseRetryMs", 6e4)) || 6e4);
            logDebug(`[\u5065\u5EB7\u63A2\u6D4B] \u68C0\u6D4B\u5230\u64AD\u653E/\u53D6\u94FE\u6D41\u91CF\uFF0C\u6682\u505C\u672C\u8F6E\uFF0C${Math.round(retry / 1e3)}s \u540E\u91CD\u8BD5`);
            schedule(retry);
            return;
          }
          try {
            await runHealthCheck();
          } catch (e) {
            logWarn(`\u5065\u5EB7\u63A2\u6D4B\u5F02\u5E38: ${e.message}`);
          }
          schedule(nextHealthCheckDelay(cfg("healthCheckIntervalMs", HEALTH_CHECK_INTERVAL_MS)));
        }, delay);
        schedule(HEALTH_CHECK_INITIAL_DELAY_MS);
      }
      var Q = ["128k", "320k", "flac", "flac24bit"];
      var PLATFORM_QUALITIES = { wy: Q, tx: Q, kw: Q, kg: Q, mg: Q };
      var REPORT_QUALITIES = {
        wy: ["128k", "320k", "flac"],
        // outer/suyin163=128k；GD Studio=flac；suyinKuwo=flac兜底
        tx: ["128k", "320k", "flac"],
        // 仅 suyinKuwo 搜索酷我兜底
        kw: ["128k", "320k", "flac"],
        // kuwoOfficial/xinghaiBackend=128k；suyinKuwo=flac
        kg: ["128k", "320k", "flac"],
        // 仅 suyinKuwo 搜索酷我兜底
        mg: ["128k", "320k", "flac"]
        // 仅 suyinKuwo 搜索酷我兜底
      };
      var QUALITY_TO_X = {
        // 通用 br 参考（星海 level 语义 / 长青念心 level）：flac24bit/hires 均 999
        br: { "128k": "128", "192k": "192", "320k": "320", flac: "740", flac24bit: "999", "24bit": "999" },
        // 溯音QQ：br 数值（hires=3/atmos=2/master=1/24bit=1 专用值直传）
        suyinQQ: { "128k": 7, "320k": 5, flac: 4, hires: 3, atmos: 2, master: 1, "24bit": 1 },
        // 酷我系（溯音酷我搜索 br 参数）：flac=1 / 320k=5 / 128k=7
        kuwo: { flac: 1, "320k": 5, "128k": 9, "24bit": 1 },
        // v8.4 修正：128k br=7→9（实测 br=9 唯一可播 mp3，7/5/1 均 CDN410 死链；flac/320k 为 VIP 链 loginUid 空 410）
        // GD Studio：br 字符串（flac/hires 均走 999 真实 flac）
        gd: { "128k": "128", "192k": "320", "320k": "320", flac: "999", flac24bit: "999", hires: "999" }
      };
      var QUALITY_PRIORITY = ["flac24bit", "flac", "320k", "128k"];
      var QUALITY_RANK = { "128k": 1, "192k": 2, "320k": 3, flac: 4, flac24bit: 5, hires: 4, master: 5, atmos: 5, "24bit": 5 };
      function qualityRank(q) {
        return QUALITY_RANK[String(q || "128k").toLowerCase()] || 1;
      }
      var QUALITY_FIRST = true;
      var { EVENT_NAMES, request, on, send, utils, env, version } = globalThis.lx;
      var safeConsole = {
        log: typeof console !== "undefined" && typeof console.log === "function" ? console.log.bind(console) : () => {
        },
        warn: typeof console !== "undefined" && typeof console.warn === "function" ? console.warn.bind(console) : () => {
        }
      };
      var LOG_ENABLED = typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.logEnabled !== void 0 ? !!globalThis.__lxSourceConfig.logEnabled : true;
      var LOG_DEBUG = typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.logDebug || false;
      function logInfo(...args) {
        if (LOG_ENABLED) safeConsole.log("[\u805A\u5408\u97F3\u6E90][\u4FE1\u606F]", ...args);
      }
      function logWarn(...args) {
        if (LOG_ENABLED) safeConsole.warn("[\u805A\u5408\u97F3\u6E90][\u8B66\u544A]", ...args);
      }
      function logDebug(...args) {
        if (LOG_ENABLED && LOG_DEBUG) safeConsole.log("[\u805A\u5408\u97F3\u6E90][\u51B3\u7B56]", ...args);
      }
      function createLRUCache(maxSize, ttl) {
        const map = /* @__PURE__ */ new Map();
        return {
          get(key) {
            const entry = map.get(key);
            if (!entry) return null;
            if (Date.now() - entry.timestamp >= ttl) {
              return null;
            }
            map.delete(key);
            map.set(key, entry);
            return entry.value;
          },
          // v8.10.1：补 delete——分级 TTL 过期时 getCachedUrl 需要主动删除条目（旧无此方法，高音质缓存超 30min 重播必 TypeError）
          delete(key) {
            map.delete(key);
          },
          set(key, value) {
            if (map.has(key)) map.delete(key);
            map.set(key, { value, timestamp: Date.now() });
            if (map.size > maxSize) {
              const firstKey = map.keys().next().value;
              if (firstKey !== void 0) map.delete(firstKey);
            }
          },
          hasExpired(key) {
            const entry = map.get(key);
            if (!entry) return false;
            return Date.now() - entry.timestamp >= ttl;
          },
          getExpired(key) {
            const entry = map.get(key);
            return entry ? entry.value : null;
          },
          // v30.1：清空所有缓存（配置热更新时调用，让新 TTL 立即生效）
          clear() {
            map.clear();
          },
          // 五轮 MEM：暴露条目数供健康快照观测（此前只有写入/读取，无任何容量可观测口径）
          size() {
            return map.size;
          },
          // v8.11.3（D-01）：键迭代——toggle 开启源时要按平台前缀精确失效失败缓存（全清会误伤其他平台）
          keys() {
            return map.keys();
          }
        };
      }
      function boundedMapSet(map, key, value) {
        if (map.has(key)) map.delete(key);
        map.set(key, value);
        const max = Math.max(1, Number(cfg("memoryMapMax", MEMORY_MAP_MAX)) || MEMORY_MAP_MAX);
        if (map.size > max) {
          const oldest = map.keys().next().value;
          if (oldest !== void 0) map.delete(oldest);
        }
      }
      var successCache = createLRUCache(CACHE_MAX_SIZE, cfg("cacheTtlMs", CACHE_TTL_MS));
      var failCache = createLRUCache(FAIL_CACHE_MAX_SIZE, Number.MAX_SAFE_INTEGER);
      var breakerMap = /* @__PURE__ */ new Map();
      var deliveryQualityMap = /* @__PURE__ */ new Map();
      var fragmentSourceMap = /* @__PURE__ */ new Map();
      var qualityCeilingMap = /* @__PURE__ */ new Map();
      var FRAGMENT_SOURCE_TTL_MS = 3e5;
      var PREVIEW_COOLDOWN_MS = 3e5;
      var previewCooldownMap = /* @__PURE__ */ new Map();
      var fragmentUrlMap = /* @__PURE__ */ new Map();
      var fragmentHandlerSongsMap = /* @__PURE__ */ new Map();
      var FRAGMENT_URL_TTL_MS = 6e5;
      var PLAY_DEAD_STREAK = 3;
      var playDeadStreak = /* @__PURE__ */ new Map();
      var playDeadDeadline = /* @__PURE__ */ new Map();
      var playDeadTrialAt = /* @__PURE__ */ new Map();
      var PLAY_DEAD_TRIAL_TTL_MS = 60 * 1e3;
      function clearPlayDeadTrials(sourceId) {
        for (const k of playDeadTrialAt.keys()) if (k.startsWith(sourceId + "|")) playDeadTrialAt.delete(k);
      }
      var resolveDeadStreak = /* @__PURE__ */ new Map();
      var resolveDeadDeadline = /* @__PURE__ */ new Map();
      var resolveDeadTrialAt = /* @__PURE__ */ new Map();
      var RESOLVE_DEAD_TRIAL_TTL_MS = 60 * 1e3;
      function clearResolveDeadTrials(sourceId) {
        for (const k of resolveDeadTrialAt.keys()) if (k.startsWith(sourceId + "|")) resolveDeadTrialAt.delete(k);
      }
      function clearResolveDead(sourceId) {
        resolveDeadStreak.delete(sourceId);
        resolveDeadDeadline.delete(sourceId);
        clearResolveDeadTrials(sourceId);
      }
      function isResolveDead(sourceId, quality, consume) {
        const streak = resolveDeadStreak.get(sourceId) || 0;
        if (streak < PLAY_DEAD_STREAK) return false;
        const reviveMs = cfg("resolveDeadReviveMs", cfg("playDeadReviveMs", 5 * 60 * 1e3));
        const age = Date.now() - (resolveDeadDeadline.get(sourceId) || 0);
        if (age < reviveMs) return true;
        const trialKey = sourceId;
        const lastTrial = resolveDeadTrialAt.get(trialKey) || 0;
        if (Date.now() - lastTrial < RESOLVE_DEAD_TRIAL_TTL_MS) return true;
        if (!consume) return true;
        resolveDeadTrialAt.set(trialKey, Date.now());
        logDebug(`[\u53D6\u94FE\u6458\u9664] ${sourceId} \u534A\u5F00\u8BD5\u63A2\u653E\u884C quality=${quality || "default"} age=${age}ms revive=${reviveMs}ms`);
        return false;
      }
      function bumpResolveDead(sourceId) {
        resolveDeadStreak.set(sourceId, (resolveDeadStreak.get(sourceId) || 0) + 1);
        if (resolveDeadStreak.get(sourceId) >= PLAY_DEAD_STREAK) {
          resolveDeadDeadline.set(sourceId, Date.now());
          clearResolveDeadTrials(sourceId);
        }
        if (isResolveDead(sourceId)) logWarn(`\u53D6\u94FE\u6458\u9664: [${sourceId}] \u8FDE\u7EED${PLAY_DEAD_STREAK}\u6B21\u53D6\u94FE/\u51C6\u5165\u5931\u8D25\uFF0C\u5DF2\u4ECE\u7ADE\u901F\u94FE\u6458\u9664(${Math.round(cfg("resolveDeadReviveMs", cfg("playDeadReviveMs", 5 * 60 * 1e3)) / 6e4)}\u5206\u949F\u540E\u534A\u5F00\u8BD5\u63A2\u81EA\u52A8\u590D\u6D3B)`);
      }
      function isPlayDead(sourceId, quality, consume) {
        const streak = playDeadStreak.get(sourceId) || 0;
        if (streak < PLAY_DEAD_STREAK) return false;
        const reviveMs = cfg("playDeadReviveMs", 5 * 60 * 1e3);
        const age = Date.now() - (playDeadDeadline.get(sourceId) || 0);
        if (age < reviveMs) return true;
        const trialKey = sourceId;
        const lastTrial = playDeadTrialAt.get(trialKey) || 0;
        if (Date.now() - lastTrial < PLAY_DEAD_TRIAL_TTL_MS) return true;
        if (!consume) return true;
        playDeadTrialAt.set(trialKey, Date.now());
        logDebug(`[\u6458\u9664\u5224\u5B9A] ${sourceId} \u534A\u5F00\u8BD5\u63A2\u653E\u884C quality=${quality || "default"} age=${age}ms revive=${reviveMs}ms`);
        return false;
      }
      function getBreaker(sourceId) {
        if (!breakerMap.has(sourceId)) {
          breakerMap.set(sourceId, {
            state: "closed",
            failureCount: 0,
            lastFailureTime: 0,
            totalRequests: 0,
            totalSuccess: 0,
            totalTime: 0,
            // v3.0：探测样本单独计数（与真实请求分级加权，避免探测污染真实成功率）
            probeRequests: 0,
            probeSuccess: 0,
            probeTime: 0,
            // v4.0：失败归因分离——版权/业务失败（无版权404、歌不存在、错歌）单独计数，
            // 不惩罚健康分、不计入成功率分母（避免热门版权歌冤枉健康源）
            copyrightFail: 0,
            // v4.0：按音质分档统计 { quality: {req, success, time, fail, businessFail} }
            byQuality: {},
            // v4.0：限流退避——429 不触发熔断，短退避后恢复；连续限流标记"被限"
            rateLimitCount: 0,
            rateLimitUntil: 0,
            rateLimited: false,
            // v6.0：最近一次成功交付音质（音质协商链降档后可诊断"UI显示FLAC实际128k"问题）
            lastQuality: null
          });
        }
        return breakerMap.get(sourceId);
      }
      function qualityLedger(b, quality) {
        const key = String(quality || "default");
        let q = b.byQuality[key];
        if (!q) q = b.byQuality[key] = { req: 0, success: 0, time: 0, fail: 0, businessFail: 0 };
        if (!q.breaker) q.breaker = { state: "closed", failureCount: 0, lastFailureTime: 0, trialInFlight: false };
        if (typeof q.rateLimitCount !== "number") q.rateLimitCount = 0;
        if (typeof q.rateLimitUntil !== "number") q.rateLimitUntil = 0;
        if (typeof q.rateLimited !== "boolean") q.rateLimited = false;
        return q;
      }
      function syncSourceBreaker(b) {
        const ledgers = Object.values(b.byQuality || {}).filter((q) => q && q.breaker);
        if (!ledgers.length) return;
        const allOpen = ledgers.every((q) => q.breaker.state === "open");
        const anyHalf = ledgers.some((q) => q.breaker.state === "half-open");
        if (allOpen) {
          b.state = "open";
          b.lastFailureTime = Math.max(...ledgers.map((q) => q.breaker.lastFailureTime || 0));
        } else if (anyHalf) {
          b.state = "half-open";
        } else {
          b.state = "closed";
        }
      }
      function recordRateLimit(sourceId, quality) {
        const b = getBreaker(sourceId);
        const wasSourceHalfOpen = b.state === "half-open";
        const wasSourceOpen = b.state === "open";
        const q = qualityLedger(b, quality);
        const backoff = cfg("rateLimitBackoffMs", RATE_LIMIT_BACKOFF_MS);
        b.rateLimitCount = (b.rateLimitCount || 0) + 1;
        b.rateLimitUntil = Date.now() + backoff;
        if (b.rateLimitCount >= RATE_LIMIT_TRIP) b.rateLimited = true;
        q.rateLimitCount++;
        q.rateLimitUntil = Date.now() + backoff;
        if (q.rateLimitCount >= RATE_LIMIT_TRIP) q.rateLimited = true;
        if (q.breaker.state === "half-open" || b.state === "half-open") {
          q.breaker.state = "open";
          q.breaker.trialInFlight = false;
          q.breaker.lastFailureTime = Date.now();
          logWarn(`\u65AD\u8DEF\u5668[${sourceId}] \u534A\u5F00\u8BD5\u63A2\u5931\u8D25(${quality || "128k"} \u9650\u6D41429)\uFF0C\u91CD\u65B0\u7194\u65AD`);
        }
        syncSourceBreaker(b);
        if (wasSourceHalfOpen || wasSourceOpen) {
          b.state = "open";
          b.lastFailureTime = Date.now();
        }
        logDebug(`[${sourceId}] 429\u9650\u6D41\u7B2C${b.rateLimitCount}\u6B21\uFF0C\u9000\u907F${backoff / 1e3}s${b.rateLimited ? "\uFF08\u5DF2\u6807\u8BB0\u88AB\u9650\uFF09" : ""}`);
      }
      function revertHalfOpenOnSkip(sourceId, quality) {
        const b = getBreaker(sourceId);
        const q = quality ? qualityLedger(b, quality) : null;
        if (q && q.breaker.state === "half-open") {
          q.breaker.state = "open";
          q.breaker.trialInFlight = false;
          q.breaker.lastFailureTime = Date.now();
          logWarn(`\u65AD\u8DEF\u5668[${sourceId}] ${quality} \u534A\u5F00\u8BD5\u63A2\u88AB\u672C\u5730\u62E6\u622A\uFF0C\u9000\u56DE\u7194\u65AD\u7B49\u5F85\u4E0B\u6B21\u51B7\u5374`);
        }
        if (b.state === "half-open") {
          b.state = "open";
          b.lastFailureTime = Date.now();
          logWarn(`\u65AD\u8DEF\u5668[${sourceId}] \u534A\u5F00\u8BD5\u63A2\u88AB\u672C\u5730\u62E6\u622A\uFF0C\u9000\u56DE\u7194\u65AD\u7B49\u5F85\u4E0B\u6B21\u51B7\u5374`);
        }
        if (q) syncSourceBreaker(b);
      }
      function canExecute(sourceId, quality) {
        const b = getBreaker(sourceId);
        if (quality) {
          const qSlot = qualityLedger(b, quality);
          const qb = qSlot.breaker;
          if (qSlot.rateLimitUntil > 0) {
            if (Date.now() < qSlot.rateLimitUntil) return false;
            qSlot.rateLimitUntil = 0;
            qSlot.rateLimited = false;
          }
          if (qb.state === "closed") return true;
          if (qb.state === "open") {
            if (Date.now() - qb.lastFailureTime >= cfg("breakerCooldownMs", BREAKER_COOLDOWN_MS)) {
              qb.state = "half-open";
              qb.trialInFlight = true;
              return true;
            }
            return false;
          }
          if (!qb.trialInFlight) {
            qb.trialInFlight = true;
            return true;
          }
          return false;
        }
        if (b.rateLimitUntil > 0) {
          if (Date.now() < b.rateLimitUntil) return false;
          b.rateLimitUntil = 0;
          b.rateLimited = false;
        }
        if (b.state === "closed") return true;
        if (b.state === "open") {
          if (Date.now() - b.lastFailureTime >= cfg("breakerCooldownMs", BREAKER_COOLDOWN_MS)) {
            b.state = "half-open";
            b.trialInFlight = true;
            return true;
          }
          return false;
        }
        if (b.state === "half-open") {
          if (!b.trialInFlight) {
            b.trialInFlight = true;
            return true;
          }
          return false;
        }
        return false;
      }
      function recordSuccess(sourceId, duration, quality, opts = {}) {
        const b = getBreaker(sourceId);
        b.totalRequests++;
        b.totalSuccess++;
        b.totalTime += duration;
        b.lastQuality = String(quality || "128k");
        const q = qualityLedger(b, quality);
        q.req++;
        q.success++;
        q.time += duration;
        if (q.breaker.state === "half-open" || q.breaker.state === "open") {
          q.breaker.state = "closed";
          q.breaker.failureCount = 0;
          q.breaker.trialInFlight = false;
          logWarn(`\u65AD\u8DEF\u5668[${sourceId}] ${quality || "128k"} \u534A\u5F00\u8BD5\u63A2\u6210\u529F\uFF0C\u6062\u590D`);
        }
        if (b.state === "half-open") {
          b.state = "closed";
          b.failureCount = 0;
        }
        b.failureCount = 0;
        syncSourceBreaker(b);
        if (autoOff[sourceId] && isUserEnabled(sourceId)) {
          delete autoOff[sourceId];
          delete autoOffReason[sourceId];
          delete autoOffAt[sourceId];
          syncRuntimeToggle(sourceId);
          recordHealthEvent({ event: "health_transition", sourceId, from: "AUTO_OFF", to: "ELIGIBLE", reason: "real_success" });
        }
        clearResolveDead(sourceId);
        if (opts.playback === true && (playDeadStreak.get(sourceId) || 0) > 0) {
          playDeadStreak.set(sourceId, 0);
          playDeadDeadline.delete(sourceId);
          clearPlayDeadTrials(sourceId);
          logWarn(`\u64AD\u653E\u6458\u9664: [${sourceId}] \u771F\u5B9E\u64AD\u653E\u6210\u529F\uFF0C\u89E3\u9664\u6458\u9664`);
        }
      }
      function bumpPlayDead(sourceId) {
        playDeadStreak.set(sourceId, (playDeadStreak.get(sourceId) || 0) + 1);
        if (playDeadStreak.get(sourceId) >= PLAY_DEAD_STREAK) {
          playDeadDeadline.set(sourceId, Date.now());
          clearPlayDeadTrials(sourceId);
        }
        if (isPlayDead(sourceId)) logWarn(`\u64AD\u653E\u6458\u9664: [${sourceId}] \u8FDE\u7EED${PLAY_DEAD_STREAK}\u6B21\u64AD\u653E\u5931\u8D25\uFF0C\u5DF2\u4ECE\u7ADE\u901F\u94FE\u6458\u9664(${Math.round(cfg("playDeadReviveMs", 5 * 60 * 1e3) / 6e4)}\u5206\u949F\u540E\u534A\u5F00\u8BD5\u63A2\u81EA\u52A8\u590D\u6D3B)`);
      }
      function recordFailure(sourceId, quality, opts = {}) {
        const b = getBreaker(sourceId);
        const wasSourceHalfOpen = b.state === "half-open";
        b.totalRequests++;
        b.failureCount++;
        b.lastFailureTime = Date.now();
        const q = qualityLedger(b, quality);
        q.req++;
        q.fail++;
        q.breaker.failureCount++;
        q.breaker.lastFailureTime = Date.now();
        if (opts.resolveDead === true) bumpResolveDead(sourceId);
        if (opts.playDead !== false) bumpPlayDead(sourceId);
        const thr = cfg("breakerThreshold", BREAKER_THRESHOLD);
        if (q.breaker.state === "half-open" || b.state === "half-open") {
          q.breaker.state = "open";
          q.breaker.trialInFlight = false;
          logWarn(`\u65AD\u8DEF\u5668[${sourceId}] ${quality || "128k"} \u534A\u5F00\u8BD5\u63A2\u5931\u8D25\uFF0C\u91CD\u65B0\u7194\u65AD`);
        } else if (q.breaker.state === "closed" && q.breaker.failureCount >= thr) {
          q.breaker.state = "open";
          logWarn(`\u65AD\u8DEF\u5668[${sourceId}] ${quality || "128k"} \u8FDE\u7EED\u5931\u8D25${thr}\u6B21\uFF0C\u7194\u65AD${cfg("breakerCooldownMs", BREAKER_COOLDOWN_MS) / 1e3}\u79D2`);
        }
        syncSourceBreaker(b);
        if (wasSourceHalfOpen) b.state = "open";
      }
      function recordBusinessFail(sourceId, quality) {
        const b = getBreaker(sourceId);
        const wasSourceHalfOpen = b.state === "half-open";
        b.totalRequests++;
        b.copyrightFail = (b.copyrightFail || 0) + 1;
        const q = qualityLedger(b, quality);
        q.req++;
        q.businessFail++;
        if (q.breaker.state === "half-open" || b.state === "half-open") {
          q.breaker.state = "open";
          q.breaker.trialInFlight = false;
          q.breaker.lastFailureTime = Date.now();
          syncSourceBreaker(b);
          if (wasSourceHalfOpen) b.state = "open";
          logWarn(`\u65AD\u8DEF\u5668[${sourceId}] \u534A\u5F00\u8BD5\u63A2\u5931\u8D25(${quality || "128k"} \u4E1A\u52A1\u5931\u8D25)\uFF0C\u91CD\u65B0\u7194\u65AD`);
        }
      }
      function getSourceStats(sourceId) {
        const b = getBreaker(sourceId);
        const reqCount = b.totalRequests || 0;
        const probeCount = b.probeRequests || 0;
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
              req: q.req,
              success: q.success,
              fail: q.fail,
              businessFail: q.businessFail,
              // F39/F41：按档熔断/限流状态必须能被快照/诊断读到，不再只看源级 state。
              state: q.breaker ? q.breaker.state : "closed",
              rateLimited: !!q.rateLimited,
              rateLimitUntil: Number(q.rateLimitUntil || 0)
            }];
          }))
        };
      }
      var HEALTH_PRIOR_K = 4;
      var HEALTH_TIME_PENALTY = 0.5;
      var HEALTH_STREAK_STEP = 0.08;
      var HEALTH_STREAK_CAP = 0.5;
      function computeHealthScore(sourceId) {
        const b = getBreaker(sourceId);
        const realReq = Math.max(b.totalRequests - (b.copyrightFail || 0), 0);
        const realSuccess = b.totalSuccess;
        const rateReal = realReq === 0 ? 0.5 : (realSuccess + HEALTH_PRIOR_K * 0.5) / (realReq + HEALTH_PRIOR_K);
        const probeReq = b.probeRequests || 0;
        const probeSuccess = b.probeSuccess || 0;
        const rateProbe = probeReq === 0 ? 0.5 : (probeSuccess + HEALTH_PRIOR_K * 0.5) / (probeReq + HEALTH_PRIOR_K);
        const rate = realReq > 0 ? rateReal : rateProbe;
        const avgTime = realSuccess > 0 ? b.totalTime / realSuccess : probeSuccess > 0 ? (b.probeTime || 0) / probeSuccess : 9999;
        const timePenalty = Math.min(avgTime / 5e3, 1) * HEALTH_TIME_PENALTY;
        const streakPenalty = Math.min(b.failureCount * HEALTH_STREAK_STEP, HEALTH_STREAK_CAP);
        const score = rate - timePenalty - streakPenalty;
        return { score, rate, avgTime, state: b.state };
      }
      function httpRequest(url, options = { method: "GET" }) {
        const timeout = options.timeout || TIMEOUT_CONFIG.default;
        const cancelToken = options.cancelToken || null;
        const requestOptions = Object.assign({}, options);
        delete requestOptions.cancelToken;
        if (cancelToken && cancelToken.canceled) return Promise.reject(canceledError(cancelToken.reason));
        let hostCancel = null;
        const offCancel = cancelToken ? cancelToken.onCancel(() => {
          if (typeof hostCancel === "function") {
            try {
              hostCancel();
            } catch (e) {
            }
          }
        }) : null;
        const rawPromise = new Promise((resolve, reject) => {
          const startTime = Date.now();
          const ret = request(url, __spreadValues({ timeout }, requestOptions), (err, res) => {
            var _a2;
            const duration = Date.now() - startTime;
            if (err) {
              const code = String(err.message || "").includes("timeout") ? ERROR_CODES.NETWORK_TIMEOUT : ERROR_CODES.NETWORK_ERROR;
              const error = new Error(`${code}: ${err.message}`);
              error.code = code;
              reject(error);
              return;
            }
            let body = res == null ? void 0 : res.body;
            if (typeof body === "string") {
              const trimmed = body.trim();
              if (trimmed.startsWith("{") || trimmed.startsWith("[") || trimmed.startsWith('"')) {
                try {
                  body = JSON.parse(trimmed);
                } catch (e) {
                }
              }
            }
            const result = { statusCode: (_a2 = res == null ? void 0 : res.statusCode) != null ? _a2 : 0, headers: (res == null ? void 0 : res.headers) || {}, body, duration, url: (res == null ? void 0 : res.url) || url };
            if (result.statusCode >= 500) {
              const error = new Error(`${ERROR_CODES.SERVER_ERROR}: HTTP ${result.statusCode}`);
              error.code = ERROR_CODES.SERVER_ERROR;
              reject(error);
            } else if (result.statusCode === 429) {
              const error = new Error(`${ERROR_CODES.RATE_LIMIT}: \u88AB\u9650\u6D41`);
              error.code = ERROR_CODES.RATE_LIMIT;
              reject(error);
            } else if (result.statusCode === 410) {
              const error = new Error(`${ERROR_CODES.LINK_EXPIRED}: \u94FE\u63A5\u5DF2\u8FC7\u671F(HTTP 410)`);
              error.code = ERROR_CODES.LINK_EXPIRED;
              reject(error);
            } else if (result.statusCode === 404) {
              const error = new Error(`${ERROR_CODES.NOT_FOUND}: \u8D44\u6E90\u4E0D\u5B58\u5728(HTTP 404)`);
              error.code = ERROR_CODES.NOT_FOUND;
              reject(error);
            } else if (result.statusCode >= 400) {
              const error = new Error(`${ERROR_CODES.NETWORK_ERROR}: HTTP ${result.statusCode}`);
              error.code = ERROR_CODES.NETWORK_ERROR;
              reject(error);
            } else {
              resolve(result);
            }
          });
          if (typeof ret === "function") {
            hostCancel = ret;
            if (cancelToken && cancelToken.canceled) {
              try {
                hostCancel();
              } catch (e) {
              }
            }
          }
        });
        const clearHostCancel = () => {
          if (offCancel) offCancel();
        };
        return raceWithCancel(rawPromise, cancelToken).then(
          (v) => {
            clearHostCancel();
            return v;
          },
          (e) => {
            clearHostCancel();
            throw e;
          }
        );
      }
      async function httpRequestWithRetry(url, options = {}, retries = RETRY_TIMES) {
        let lastError = null;
        const cancelToken = options && options.cancelToken;
        for (let i = 0; i <= retries; i++) {
          throwIfCanceled(cancelToken);
          try {
            return await httpRequest(url, options);
          } catch (e) {
            lastError = e;
            if (e && (e.canceled || e.code === ERROR_CODES.CANCELED)) throw e;
            if (e.code !== ERROR_CODES.NETWORK_TIMEOUT && e.code !== ERROR_CODES.NETWORK_ERROR && e.code !== ERROR_CODES.SERVER_ERROR) break;
            if (i < retries) {
              const delay = Math.pow(2, i) * 200;
              await new Promise((r) => setTimeout(r, delay));
            }
          }
        }
        throw lastError;
      }
      function buildQueryString(params = {}) {
        const parts = Object.entries(params).filter(([, v]) => v !== void 0 && v !== null).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
        return parts.length ? "?" + parts.join("&") : "";
      }
      async function httpGet(url, params = {}, timeoutType = "default", headers = null, retries = RETRY_TIMES, cancelToken = null) {
        const fullUrl = url + buildQueryString(params);
        const opts = { method: "GET", timeout: TIMEOUT_CONFIG[timeoutType] || TIMEOUT_CONFIG.default, cancelToken };
        if (headers && typeof headers === "object" && Object.keys(headers).length) opts.headers = headers;
        const res = await httpRequestWithRetry(fullUrl, opts, retries);
        return res.body;
      }
      async function isAudioPlayable(audioUrl, timeoutMs = 3e3, cancelToken = null) {
        var _a2;
        if (!audioUrl || typeof audioUrl !== "string" || !HTTP_URL_REGEX.test(audioUrl)) return false;
        try {
          const res = await httpRequest(audioUrl, {
            method: "GET",
            headers: { "User-Agent": getMobileUserAgent(), "Range": "bytes=0-1023" },
            timeout: timeoutMs,
            follow_max: 5,
            cancelToken
          });
          const ct = String(((_a2 = res.headers) == null ? void 0 : _a2["content-type"]) || "");
          if (res.statusCode === 206) return true;
          if (res.statusCode === 200 && /audio|octet|mpeg|mp3|flac|ogg|aac/i.test(ct)) return true;
          return false;
        } catch (e) {
          const code = e && e.code ? e.code : ERROR_CODES.NETWORK_ERROR;
          if (code === ERROR_CODES.LINK_EXPIRED) return false;
          const err = new Error(`${code}: \u53EF\u64AD\u6027\u6821\u9A8C\u672A\u5B8C\u6210(${e && e.message || "unknown"})`);
          err.code = code;
          throw err;
        }
      }
      var MPEG_BR_V1_L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
      var MPEG_BR_V2_L3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0];
      var MPEG_SR_V1 = [44100, 48e3, 32e3];
      var MPEG_SR_V2 = [22050, 24e3, 16e3];
      var MPEG_SR_V25 = [11025, 12e3, 8e3];
      function bAt(buf, i) {
        if (i < 0) return 0;
        return typeof buf === "string" ? buf.charCodeAt(i) & 255 : buf[i];
      }
      function asciiAt(buf, off, str) {
        for (let i = 0; i < str.length; i++) if (bAt(buf, off + i) !== str.charCodeAt(i)) return false;
        return true;
      }
      function u32At(buf, o) {
        return (bAt(buf, o) << 24 >>> 0) + (bAt(buf, o + 1) << 16) + (bAt(buf, o + 2) << 8) + bAt(buf, o + 3);
      }
      function parseMpegFrameHeader(buf, off) {
        if (off + 4 > (buf.length || 0)) return null;
        const b0 = bAt(buf, off), b1 = bAt(buf, off + 1), b2 = bAt(buf, off + 2);
        if (b0 !== 255 || (b1 & 224) !== 224) return null;
        const verBits = b1 >> 3 & 3;
        const layerBits = b1 >> 1 & 3;
        if (verBits === 1 || layerBits === 0) return null;
        const brIdx = b2 >> 4 & 15;
        const srIdx = b2 >> 2 & 3;
        if (brIdx === 0 || brIdx === 15 || srIdx === 3) return null;
        const bitrateKbps = (verBits === 3 ? MPEG_BR_V1_L3 : MPEG_BR_V2_L3)[brIdx];
        const sampleRate = (verBits === 3 ? MPEG_SR_V1 : verBits === 2 ? MPEG_SR_V2 : MPEG_SR_V25)[srIdx];
        return { bitrateKbps, sampleRate, samplesPerFrame: verBits === 3 ? 1152 : 576, version: verBits };
      }
      function parseFlacDuration(buf) {
        if ((buf.length || 0) < 8 || !asciiAt(buf, 0, "fLaC")) return null;
        let p = 4;
        let guard = 0;
        while (p + 4 <= buf.length && guard++ < 8) {
          const last = (bAt(buf, p) & 128) !== 0;
          const type = bAt(buf, p) & 127;
          const len = bAt(buf, p + 1) << 16 | bAt(buf, p + 2) << 8 | bAt(buf, p + 3);
          if (type === 0) {
            const q = p + 4 + 10;
            if (q + 8 > buf.length) return null;
            const sampleRate = bAt(buf, q) << 12 | bAt(buf, q + 1) << 4 | bAt(buf, q + 2) >> 4;
            const totalSamples = (bAt(buf, q + 3) & 15) * 4294967296 + bAt(buf, q + 4) * 16777216 + bAt(buf, q + 5) * 65536 + bAt(buf, q + 6) * 256 + bAt(buf, q + 7);
            return sampleRate > 0 && totalSamples > 0 ? +(totalSamples / sampleRate).toFixed(1) : null;
          }
          p += 4 + len;
          if (last) break;
        }
        return null;
      }
      function parseMp3Info(buf) {
        let off = 0;
        if ((buf.length || 0) >= 10 && asciiAt(buf, 0, "ID3")) {
          const size = bAt(buf, 6) << 21 | bAt(buf, 7) << 14 | bAt(buf, 8) << 7 | bAt(buf, 9);
          off = 10 + size;
        }
        let h = null, hOff = -1;
        const limit = Math.min(buf.length - 4, off + 4096);
        for (let i = Math.max(off, 0); i < limit; i++) {
          h = parseMpegFrameHeader(buf, i);
          if (h) {
            hOff = i;
            break;
          }
        }
        if (!h) return null;
        const xingOff = hOff + 4 + (h.version === 3 ? 32 : 17);
        let durationSec = null;
        if (xingOff + 12 <= buf.length && (asciiAt(buf, xingOff, "Xing") || asciiAt(buf, xingOff, "Info"))) {
          const flags = u32At(buf, xingOff + 4);
          if (flags & 1) {
            const frames = u32At(buf, xingOff + 8);
            if (frames > 0) durationSec = +(frames * h.samplesPerFrame / h.sampleRate).toFixed(1);
          }
        }
        return { bitrateKbps: h.bitrateKbps, sampleRate: h.sampleRate, durationSec };
      }
      function sniffAudioBytes(body, headers, totalBytes) {
        const ct = String(headers && headers["content-type"] || "").toLowerCase();
        const out = { kind: "unknown", format: null, durationSec: null, bitrateKbps: null };
        if (!body || body.length < 16) {
          out.kind = "empty";
          return out;
        }
        if (asciiAt(body, 0, "#EXTM3U")) {
          out.kind = "playlist";
          out.format = "m3u8";
          return out;
        }
        let s = 0;
        while (s < body.length && s < 64 && (bAt(body, s) === 32 || bAt(body, s) === 10 || bAt(body, s) === 13 || bAt(body, s) === 9 || bAt(body, s) === 239)) s++;
        if (bAt(body, s) === 60) {
          if (asciiAt(body, s, "<html") || asciiAt(body, s, "<!DOCTYPE") || asciiAt(body, s, "<?xml") || asciiAt(body, s, "<HTML")) {
            out.kind = "html";
            return out;
          }
        }
        if (bAt(body, s) === 123 || bAt(body, s) === 91) {
          out.kind = "json";
          return out;
        }
        if (asciiAt(body, 0, "fLaC")) {
          out.kind = "audio";
          out.format = "flac";
          out.durationSec = parseFlacDuration(body);
          out.bitrateKbps = out.durationSec && totalBytes ? Math.round(totalBytes * 8 / out.durationSec / 1e3) : 1e3;
          return out;
        }
        if (asciiAt(body, 0, "OggS")) {
          out.kind = "audio";
          out.format = "ogg";
          return out;
        }
        if (asciiAt(body, 4, "ftyp")) {
          out.kind = "audio";
          out.format = "m4a";
          return out;
        }
        if (asciiAt(body, 0, "RIFF")) {
          out.kind = "audio";
          out.format = "wav";
          return out;
        }
        const mp3 = parseMp3Info(body);
        if (mp3) {
          out.kind = "audio";
          out.format = "mp3";
          out.durationSec = mp3.durationSec;
          if (out.durationSec && totalBytes) {
            out.bitrateKbps = Math.round(totalBytes * 8 / out.durationSec / 1e3);
          } else if (totalBytes && mp3.bitrateKbps) {
            out.durationSec = +(totalBytes * 8 / (mp3.bitrateKbps * 1e3)).toFixed(1);
            out.bitrateKbps = mp3.bitrateKbps;
          } else {
            out.bitrateKbps = mp3.bitrateKbps;
          }
          return out;
        }
        if (/audio|octet|mpeg|mp3|flac|ogg|aac/.test(ct)) {
          out.kind = "audio";
          out.format = ct.includes("flac") ? "flac" : ct.includes("mpeg") || ct.includes("mp3") ? "mp3" : "audio";
          return out;
        }
        return out;
      }
      function qualityFromDelivery(info, requestedQuality) {
        const fmt = info == null ? void 0 : info.format;
        const br = (info == null ? void 0 : info.bitrateKbps) || 0;
        if (fmt === "flac") return br >= 2500 ? "flac24bit" : "flac";
        if (fmt === "mp3" || fmt === "audio") {
          if (br >= 256) return "320k";
          return "128k";
        }
        return requestedQuality || "128k";
      }
      function originalDurationSec(songInfo) {
        var _a2, _b2, _c2;
        const raw = (_c2 = (_b2 = (_a2 = songInfo == null ? void 0 : songInfo.duration) != null ? _a2 : songInfo == null ? void 0 : songInfo.dt) != null ? _b2 : songInfo == null ? void 0 : songInfo.interval) != null ? _c2 : songInfo == null ? void 0 : songInfo.songDuration;
        if (typeof raw === "string" && raw.includes(":")) {
          const parts = raw.split(":").map((x) => parseInt(x, 10)).filter((x) => Number.isFinite(x));
          if (parts.length === 2) return parts[0] * 60 + parts[1];
          if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
          return 0;
        }
        return normalizeDurationSec(raw);
      }
      var B64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
      function decodeBase64Ascii(s) {
        let pad = 0;
        const origLen = s.length;
        while (s.length && s.charAt(s.length - 1) === "=") {
          pad++;
          s = s.slice(0, -1);
        }
        const out = new Uint8Array(Math.floor(origLen / 4) * 3 - pad);
        let o = 0, buf = 0, bits = 0;
        for (let i = 0; i < s.length; i++) {
          const v = B64_CHARS.indexOf(s.charAt(i));
          if (v < 0) return null;
          buf = buf << 6 | v;
          bits += 6;
          if (bits >= 8) {
            bits -= 8;
            out[o++] = buf >> bits & 255;
          }
        }
        return out;
      }
      function decodeMediaEnvelope(x) {
        if (!x || typeof x !== "object") return null;
        if (x.__lxMedia !== 2) return null;
        try {
          if (String(x.encoding || "").toLowerCase() !== "base64") return null;
          if (x.byteLength === 0 && x.body === void 0 && x.chunks === void 0) return new Uint8Array(0);
          let parts = null;
          if (Array.isArray(x.chunks)) {
            if (!x.chunks.length) return null;
            for (let i = 0; i < x.chunks.length; i++) {
              if (typeof x.chunks[i] !== "string") return null;
            }
            parts = x.chunks;
          } else if (typeof x.body === "string") {
            parts = [x.body];
          } else {
            return null;
          }
          let total = 0;
          const decoded = [];
          for (let i = 0; i < parts.length; i++) {
            const s = String(parts[i]).replace(/\s+/g, "");
            if (!s.length) return x.byteLength === 0 ? new Uint8Array(0) : null;
            if (s.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(s)) return null;
            const part = decodeBase64Ascii(s);
            if (!part) return null;
            decoded.push(part);
            total += part.length;
          }
          if (typeof x.byteLength === "number" && Number.isFinite(x.byteLength) && total !== x.byteLength) return null;
          if (decoded.length === 1) return decoded[0];
          const bytes = new Uint8Array(total);
          let offset = 0;
          for (let i = 0; i < decoded.length; i++) {
            bytes.set(decoded[i], offset);
            offset += decoded[i].length;
          }
          return bytes;
        } catch (e) {
          return null;
        }
      }
      function mediaEnvelopeErrorCode(x) {
        if (!x || typeof x !== "object" || x.__lxMedia !== 2) return null;
        if (String(x.encoding || "").toLowerCase() !== "base64") return ERROR_CODES.BAD_ENVELOPE;
        if (x.byteLength === 0 && x.body === void 0 && x.chunks === void 0) return null;
        let parts = null;
        if (Array.isArray(x.chunks)) {
          if (!x.chunks.length) return ERROR_CODES.TRUNCATED_MEDIA;
          for (let i = 0; i < x.chunks.length; i++) {
            if (typeof x.chunks[i] !== "string") return ERROR_CODES.BAD_ENVELOPE;
            if (!String(x.chunks[i]).replace(/\s+/g, "").length) return ERROR_CODES.TRUNCATED_MEDIA;
          }
          const chunkBytes = Number(x.chunkBytes);
          if (Number.isFinite(chunkBytes) && chunkBytes > 0 && Number.isFinite(x.byteLength) && x.chunks.length < Math.ceil(x.byteLength / chunkBytes)) return ERROR_CODES.TRUNCATED_MEDIA;
          parts = x.chunks;
        } else if (typeof x.body === "string") {
          if (!x.body.replace(/\s+/g, "").length) return ERROR_CODES.TRUNCATED_MEDIA;
          parts = [x.body];
        } else {
          return ERROR_CODES.TRUNCATED_MEDIA;
        }
        let total = 0;
        for (let i = 0; i < parts.length; i++) {
          const b = String(parts[i]).replace(/\s+/g, "");
          if (b.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(b)) return ERROR_CODES.BAD_ENVELOPE;
          const part = decodeBase64Ascii(b);
          if (!part) return ERROR_CODES.BAD_ENVELOPE;
          total += part.length;
        }
        if (typeof x.byteLength === "number" && Number.isFinite(x.byteLength) && total !== x.byteLength) return ERROR_CODES.BAD_ENVELOPE;
        return null;
      }
      function toBytes(x) {
        if (x == null) return null;
        try {
          if (typeof ArrayBuffer !== "undefined" && typeof ArrayBuffer.isView === "function" && ArrayBuffer.isView(x)) {
            if (x instanceof Uint8Array) return x;
            return new Uint8Array(x.buffer, x.byteOffset || 0, x.byteLength);
          }
          if (Array.isArray(x)) {
            if (!x.length) return null;
            for (let i = 0; i < x.length; i++) {
              const n = x[i];
              if (typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > 255) return null;
            }
            return Uint8Array.from ? Uint8Array.from(x) : new Uint8Array(x);
          }
          if (typeof x === "object") {
            if (x.__lxMedia === 2) return decodeMediaEnvelope(x);
            const t = String(x.type || "");
            if (/buffer/i.test(t) && Array.isArray(x.data)) return toBytes(x.data);
            if (Array.isArray(x.data)) return toBytes(x.data);
            if (x.data && typeof x.data === "object") return toBytes(x.data);
            return null;
          }
          if (typeof x === "string") {
            const s = x.replace(/\s+/g, "");
            if (s.length < 16 || s.length % 4 !== 0) return null;
            if (!/^[A-Za-z0-9+/]+=*$/.test(s)) return null;
            return decodeBase64Ascii(s);
          }
        } catch (e) {
          return null;
        }
        return null;
      }
      function kindOf(x) {
        if (x == null) return "unknown";
        const bytes = toBytes(x);
        if (bytes) {
          if (!bytes.length || bytes.length < 16) return "empty";
          const info = sniffAudioBytes(bytes, {}, bytes.length);
          if (info && info.kind) return info.kind;
          return "unknown";
        }
        if (typeof x === "string") {
          const s = x.trim();
          if (s.indexOf("#EXTM3U") === 0) return "playlist";
          if (s.indexOf("<") === 0) return "html";
          if (s.indexOf("{") === 0 || s.indexOf("[") === 0) return "json";
          return s.length < 16 ? "empty" : "unknown";
        }
        if (typeof x === "object") {
          if (x.code !== void 0 || x.msg !== void 0 || x.error !== void 0 || x.url !== void 0) return "json";
          return "unknown";
        }
        return "unknown";
      }
      function headerEvidence(headers, totalBytes) {
        const ct = String(headers && headers["content-type"] || "").toLowerCase();
        const info = { kind: "unknown", format: null, durationSec: null, bitrateKbps: null };
        if (/json|html|text\/plain|xml/.test(ct)) {
          return { ok: false, code: ERROR_CODES.NOT_AUDIO, reason: `\u54CD\u5E94\u5934\u58F0\u660E\u975E\u97F3\u9891(${ct.split(";")[0]})`, evidence: "strong", info: { kind: "json", format: null, durationSec: null } };
        }
        if (/audio|octet|mpeg|mp3|flac|ogg|aac/.test(ct)) {
          info.kind = "audio";
          info.format = ct.includes("flac") ? "flac" : ct.includes("mpeg") || ct.includes("mp3") ? "mp3" : "audio";
          if (totalBytes && info.format === "mp3") info.bitrateKbps = 128;
          return { ok: true, info, evidence: "medium", reason: "\u4EC5\u5934\u4FE1\u606F\uFF08\u6865\u672A\u900F\u4F20\u5B57\u8282\uFF09" };
        }
        return { ok: null, code: ERROR_CODES.NETWORK_ERROR, reason: "\u54CD\u5E94\u5934\u4E0D\u8DB3\u4EE5\u5224\u5B9A", evidence: "weak", info };
      }
      function totalBytesOf(delivery) {
        if (!delivery) return 0;
        if (delivery.totalBytes) return Number(delivery.totalBytes) || 0;
        const h = delivery.headers || {};
        const cr = String(h["content-range"] || "");
        const m = cr.match(/\/\s*(\d+)/);
        if (m) return parseInt(m[1], 10) || 0;
        return parseInt(String(h["content-length"] || "0"), 10) || 0;
      }
      async function probeByHeaders(audioUrl, timeoutMs = 1500, cancelToken = null) {
        const tryOnce = async (method, headers) => {
          const res = await httpRequest(audioUrl, {
            method,
            headers: __spreadValues({ "User-Agent": getMobileUserAgent() }, headers),
            timeout: timeoutMs,
            follow_max: 5,
            binary: true,
            cancelToken
          });
          const cr = String(res.headers && res.headers["content-range"] || "");
          const m = cr.match(/\/\s*(\d+)/);
          let totalBytes = m ? parseInt(m[1], 10) || 0 : parseInt(String(res.headers && res.headers["content-length"] || "0"), 10) || 0;
          const hv = headerEvidence(res.headers || {}, totalBytes);
          return { hv, statusCode: res.statusCode, totalBytes, contentType: String(res.headers && res.headers["content-type"] || "") };
        };
        try {
          const head = await tryOnce("HEAD", {});
          if (head.hv && head.hv.ok !== null) {
            return { ok: head.hv.ok, code: head.hv.code, reason: head.hv.reason, info: head.hv.info, evidence: head.hv.evidence, statusCode: head.statusCode, totalBytes: head.totalBytes, via: "HEAD" };
          }
        } catch (e) {
        }
        try {
          const get = await tryOnce("GET", { Range: "bytes=0-0" });
          if (get.hv && get.hv.ok !== null) {
            return { ok: get.hv.ok, code: get.hv.code, reason: get.hv.reason, info: get.hv.info, evidence: get.hv.evidence, statusCode: get.statusCode, totalBytes: get.totalBytes, via: "GET-head" };
          }
          return { ok: null, code: ERROR_CODES.NETWORK_ERROR, reason: "\u53EA\u53D6\u5934\u4E5F\u672A\u53D6\u5F97\u53EF\u7528\u8BC1\u636E", evidence: "weak", via: "GET-head" };
        } catch (e) {
          return { ok: null, code: ERROR_CODES.NETWORK_ERROR, reason: `\u53EA\u53D6\u5934\u5931\u8D25(${e && e.code || "NETWORK_ERROR"})`, evidence: "weak", via: "none" };
        }
      }
      async function probeAudioDelivery(audioUrl, timeoutMs = 3e3, cancelToken = null) {
        if (!audioUrl || typeof audioUrl !== "string" || !HTTP_URL_REGEX.test(audioUrl)) {
          return { ok: false, code: ERROR_CODES.PARAM_ERROR, reason: "\u975E\u6CD5URL" };
        }
        try {
          const res = await httpRequest(audioUrl, {
            method: "GET",
            headers: { "User-Agent": getMobileUserAgent(), "Range": `bytes=0-${VERIFY_RANGE_BYTES}` },
            timeout: timeoutMs,
            follow_max: 5,
            binary: true,
            cancelToken
          });
          const status = res.statusCode;
          let totalBytes = 0;
          const cr = String(res.headers && res.headers["content-range"] || "");
          const m = cr.match(/\/\s*(\d+)/);
          if (m) totalBytes = parseInt(m[1], 10) || 0;
          if (!totalBytes) totalBytes = parseInt(String(res.headers && res.headers["content-length"] || "0"), 10) || 0;
          const body = res.body;
          const bytes = toBytes(body);
          const mediaErr = bytes ? null : mediaEnvelopeErrorCode(body);
          const totalBytesKnown = totalBytes;
          if (bytes) {
            const info = sniffAudioBytes(bytes, res.headers, totalBytesKnown);
            if (info && info.kind === "audio") {
              return {
                ok: true,
                info,
                evidence: "strong",
                statusCode: status,
                contentType: String(res.headers && res.headers["content-type"] || ""),
                totalBytes
              };
            }
            const kind = info && info.kind || "unknown";
            if (kind === "empty") {
              return { ok: false, code: ERROR_CODES.NOT_AUDIO, reason: "\u4EA4\u4ED8\u5185\u5BB9\u4E3A\u7A7A(0~16 \u5B57\u8282\uFF0C\u4E0D\u53EF\u80FD\u53EF\u64AD)", evidence: "strong", info, statusCode: status, totalBytes };
            }
            if (kind === "playlist") {
              return { ok: false, code: ERROR_CODES.STREAM_PLAYLIST, reason: "\u4EA4\u4ED8\u5185\u5BB9\u662F\u6D41\u64AD\u653E\u5217\u8868", evidence: "strong", info, statusCode: status, totalBytes };
            }
            if (kind === "json" || kind === "html") {
              return { ok: false, code: ERROR_CODES.NOT_AUDIO, reason: `\u4EA4\u4ED8\u5185\u5BB9\u4E0D\u662F\u97F3\u9891(${kind})`, evidence: "strong", info, statusCode: status, totalBytes };
            }
            return { ok: false, code: ERROR_CODES.NOT_AUDIO, reason: "\u4EA4\u4ED8\u5185\u5BB9\u65E0\u6CD5\u8BC6\u522B\u4E3A\u97F3\u9891", evidence: "weak", info, statusCode: status, totalBytes };
          }
          if (mediaErr) {
            return { ok: false, code: mediaErr, reason: `\u6865\u5A92\u4F53\u4FE1\u5C01\u635F\u574F(${mediaErr})`, evidence: "strong", statusCode: status, totalBytes };
          }
          if (body !== void 0 && body !== null) {
            const bk = kindOf(body);
            if (bk === "playlist") {
              return { ok: false, code: ERROR_CODES.STREAM_PLAYLIST, reason: "\u4EA4\u4ED8\u5185\u5BB9\u662F\u6D41\u64AD\u653E\u5217\u8868", evidence: "strong", statusCode: status, totalBytes };
            }
            if (bk === "json" || bk === "html") {
              return { ok: false, code: ERROR_CODES.NOT_AUDIO, reason: `\u4EA4\u4ED8\u5185\u5BB9\u4E0D\u662F\u97F3\u9891(${bk})`, evidence: "strong", statusCode: status, totalBytes };
            }
            if (bk === "empty") {
              return { ok: false, code: ERROR_CODES.NOT_AUDIO, reason: "\u4EA4\u4ED8\u5185\u5BB9\u4E3A\u7A7A(\u7A7A\u4F53)", evidence: "strong", statusCode: status, totalBytes };
            }
          }
          const hv = headerEvidence(res.headers, totalBytes);
          if (hv.ok === null) {
            const byHead = await probeByHeaders(audioUrl, Math.min(1500, timeoutMs), cancelToken);
            if (byHead && byHead.ok !== null) {
              return Object.assign({}, byHead, { statusCode: byHead.statusCode || status, totalBytes: byHead.totalBytes || totalBytes });
            }
            return { ok: null, code: ERROR_CODES.NETWORK_ERROR, reason: "\u65E0\u5B57\u8282\u4E14\u5934\u4FE1\u606F\u4E0D\u8DB3", evidence: "weak", statusCode: status };
          }
          return { ok: hv.ok, code: hv.code, reason: hv.reason, info: hv.info, evidence: hv.evidence, statusCode: status, totalBytes };
        } catch (e) {
          const code = e && e.code ? e.code : ERROR_CODES.NETWORK_ERROR;
          if (code === ERROR_CODES.LINK_EXPIRED || code === ERROR_CODES.NOT_FOUND) {
            return { ok: false, code: ERROR_CODES.LINK_EXPIRED, reason: `\u9A8C\u771F\u5931\u8D25(${code})`, evidence: "strong" };
          }
          if (code === ERROR_CODES.RATE_LIMIT) {
            return { ok: false, code: ERROR_CODES.RATE_LIMIT, reason: "HTTP 429", evidence: "strong" };
          }
          return { ok: null, code, reason: `\u9A8C\u771F\u672A\u5B8C\u6210(${code})`, evidence: "weak" };
        }
      }
      async function verifyDelivery(audioUrl, ctx = {}, cancelToken = null) {
        var _a2, _b2;
        if (!cfg("verifyDelivery", true)) return null;
        const probe = await probeAudioDelivery(audioUrl, cfg("verifyTimeoutMs", 3e3), cancelToken);
        if (probe.ok === null) {
          logDebug(`[\u9A8C\u771F] \u653E\u884C: ${probe.reason}`);
          return null;
        }
        if (probe.ok === false && probe.code) {
          const err = new Error(`${probe.code}: ${probe.reason}`);
          err.code = probe.code;
          err.evidence = probe.evidence || "strong";
          err.probeInfo = probe.info || null;
          throw err;
        }
        const realDur = ((_a2 = probe.info) == null ? void 0 : _a2.durationSec) || null;
        const origDur = originalDurationSec(ctx.songInfo);
        if (realDur && origDur && origDur >= cfg("verifyMinOriginalSec", VERIFY_MIN_ORIGINAL_SEC)) {
          const ratio = realDur / origDur;
          const gap = origDur - realDur;
          if (ratio < cfg("verifyDurRatio", VERIFY_DUR_RATIO) && gap > cfg("verifyDurGapSec", VERIFY_DUR_GAP_SEC)) {
            return { ok: false, code: ERROR_CODES.PREVIEW_FRAGMENT, reason: `\u4EC5 ${realDur}s\uFF0C\u539F\u66F2 ${origDur}s`, quality: qualityFromDelivery(probe.info, ctx.quality), evidence: probe.evidence || "strong" };
          }
        }
        if (!realDur && origDur && origDur >= cfg("verifyMinOriginalSec", VERIFY_MIN_ORIGINAL_SEC) && probe.totalBytes) {
          const minFull = Math.max(128e3, origDur * 3e3 * VERIFY_DUR_RATIO);
          if (probe.totalBytes < minFull) {
            return {
              ok: false,
              code: ERROR_CODES.PREVIEW_FRAGMENT,
              reason: `\u4F53\u79EF\u4EC5 ${probe.totalBytes} \u5B57\u8282\uFF08< ${Math.round(minFull)}\uFF09\uFF0C\u660E\u663E\u77ED\u4E8E ${origDur}s \u6574\u66F2`,
              quality: qualityFromDelivery(probe.info, ctx.quality),
              evidence: "medium"
            };
          }
        }
        return {
          ok: true,
          quality: qualityFromDelivery(probe.info, ctx.quality),
          realDurationSec: realDur,
          format: ((_b2 = probe.info) == null ? void 0 : _b2.format) || null,
          totalBytes: probe.totalBytes || 0,
          evidence: probe.evidence || "strong"
        };
      }
      var ADMISSION_POLICY = {
        // verdict    是否可交付  歌×档 TTL   健康分类        是否计入摘除   源级冷却
        PASS: { deliverable: true, ttlMs: 0, health: "success", playDead: false, resolveDead: false, sourceCooldownMs: 0 },
        FRAGMENT: { deliverable: true, ttlMs: 3e4, health: "businessFail", playDead: false, resolveDead: false, sourceCooldownMs: 0 },
        NOT_AUDIO: { deliverable: false, ttlMs: 6e4, health: "businessFail", playDead: false, resolveDead: false, sourceCooldownMs: 0 },
        RATE_LIMITED: { deliverable: false, ttlMs: 0, health: "businessFail", playDead: false, resolveDead: false, sourceCooldownMs: 45e3 },
        BUSINESS: { deliverable: false, ttlMs: 36e5, health: "businessFail", playDead: false, resolveDead: false, sourceCooldownMs: 0 },
        TRANSIENT: { deliverable: false, ttlMs: 0, health: "hardFail", playDead: false, resolveDead: true, sourceCooldownMs: 0 },
        BROKEN: { deliverable: false, ttlMs: 6e4, health: "businessFail", playDead: false, resolveDead: false, sourceCooldownMs: 0 }
      };
      var CODE_RANK = {
        [ERROR_CODES.NOT_AUDIO]: 3,
        [ERROR_CODES.PREVIEW_FRAGMENT]: 3,
        [ERROR_CODES.STREAM_PLAYLIST]: 3,
        [ERROR_CODES.NOT_FOUND]: 2,
        [ERROR_CODES.MISMATCH]: 2,
        [ERROR_CODES.LINK_EXPIRED]: 2,
        [ERROR_CODES.PARAM_ERROR]: 2,
        [ERROR_CODES.CONFIG_ERROR]: 2,
        [ERROR_CODES.RATE_LIMIT]: 1,
        [ERROR_CODES.NETWORK_TIMEOUT]: 1,
        [ERROR_CODES.NETWORK_ERROR]: 1,
        [ERROR_CODES.SERVER_ERROR]: 1
      };
      var codeRank = (c) => CODE_RANK[c] || 1;
      function verdictOfCode(code) {
        switch (code) {
          case ERROR_CODES.RATE_LIMIT:
            return "RATE_LIMITED";
          case ERROR_CODES.NOT_FOUND:
          case ERROR_CODES.MISMATCH:
          case ERROR_CODES.LINK_EXPIRED:
            return "BUSINESS";
          case ERROR_CODES.NOT_AUDIO:
          case ERROR_CODES.STREAM_PLAYLIST:
            return "NOT_AUDIO";
          case ERROR_CODES.PREVIEW_FRAGMENT:
            return "FRAGMENT";
          case ERROR_CODES.PARAM_ERROR:
          case ERROR_CODES.CONFIG_ERROR:
            return "BROKEN";
          default:
            return "TRANSIENT";
        }
      }
      var EVIDENCE_ORDER = { none: 0, weak: 1, medium: 2, strong: 3 };
      function strongestEvidence(list) {
        let best = "none";
        for (const e of list) {
          const v = String(e || "none");
          if ((EVIDENCE_ORDER[v] || 0) > (EVIDENCE_ORDER[best] || 0)) best = v;
        }
        return best;
      }
      function isFragmentInfo(info, songInfo) {
        const realDur = info && info.durationSec;
        const origDur = originalDurationSec(songInfo);
        if (!realDur || !origDur || origDur < cfg("verifyMinOriginalSec", VERIFY_MIN_ORIGINAL_SEC)) return false;
        const ratio = realDur / origDur;
        const gap = origDur - realDur;
        return ratio < cfg("verifyDurRatio", VERIFY_DUR_RATIO) && gap > cfg("verifyDurGapSec", VERIFY_DUR_GAP_SEC);
      }
      function admissionLedger(verdict, code, evidence) {
        const policy = ADMISSION_POLICY[verdict] || ADMISSION_POLICY.TRANSIENT;
        let ttlMs = policy.ttlMs;
        if (code === ERROR_CODES.LINK_EXPIRED) ttlMs = Math.min(ttlMs || 6e4, 6e4);
        if (evidence !== "strong") ttlMs = Math.min(ttlMs || 0, 6e4);
        return {
          ttlMs,
          health: policy.health,
          playDead: evidence === "strong" ? policy.playDead : false,
          resolveDead: evidence === "strong" ? policy.resolveDead : false,
          sourceCooldownMs: policy.sourceCooldownMs
        };
      }
      function trialMarkOf(payload) {
        if (!payload || typeof payload !== "object") return false;
        for (const key of ["freeTrialInfo", "freeTrialPrivilege", "trialInfo", "freeTrial", "privilege"]) {
          const v = payload[key];
          if (v === true) return true;
          if (Array.isArray(v) && v.length > 0) return true;
          if (v && typeof v === "object") {
            if (v.freeTrial === true || v.trial === true || v.flag === 1 || v.status === 1) return true;
          }
        }
        const rs0 = payload.RS0 !== void 0 ? payload.RS0 : payload.rs0;
        if (rs0 === 1 || rs0 === "1") return true;
        return false;
      }
      function admit(input) {
        const ctx = input || {};
        const stage = ctx.stage || "candidate";
        const delivery = ctx.delivery || null;
        let verdict = "TRANSIENT";
        let code = ERROR_CODES.NETWORK_ERROR;
        let evidence = "none";
        let reason = "";
        let quality = "";
        let deliverable = false;
        if (ctx.trialMark === true) {
          verdict = "FRAGMENT";
          code = ERROR_CODES.PREVIEW_FRAGMENT;
          evidence = "medium";
          deliverable = true;
          reason = "\u63A5\u53E3\u5C42\u5DF2\u6807\u8BB0\u8BD5\u542C";
        } else if (ctx.probe && ctx.probe.ok === true) {
          verdict = "PASS";
          code = null;
          evidence = ctx.probe.evidence || "strong";
          deliverable = true;
          quality = ctx.probe.quality || "";
          reason = "\u63A2\u9488\u5DF2\u5224\u53EF\u4EA4\u4ED8";
        } else if (stage === "fallback" && Array.isArray(ctx.attempts) && ctx.attempts.length) {
          let best = null, bestRank = -1;
          for (const a of ctx.attempts) {
            if (!a || !a.code) continue;
            const r = codeRank(a.code);
            if (r > bestRank) {
              best = a;
              bestRank = r;
            }
          }
          code = best && best.code || ERROR_CODES.NETWORK_ERROR;
          verdict = verdictOfCode(code);
          evidence = strongestEvidence(ctx.attempts.map((a) => a && a.evidence));
          deliverable = verdict === "FRAGMENT";
          reason = best && best.reason || "";
        } else if (delivery) {
          const status = Number(delivery.statusCode) || 0;
          if (status === 429) {
            verdict = "RATE_LIMITED";
            code = ERROR_CODES.RATE_LIMIT;
            evidence = "strong";
            reason = "HTTP 429";
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
              const info = sniffAudioBytes(bytes, delivery.headers || {}, totalBytes);
              const kind = info && info.kind || "unknown";
              if (kind === "audio") {
                evidence = "strong";
                if (isFragmentInfo(info, ctx.songInfo)) {
                  verdict = "FRAGMENT";
                  code = ERROR_CODES.PREVIEW_FRAGMENT;
                  deliverable = true;
                } else {
                  verdict = "PASS";
                  code = null;
                  deliverable = true;
                }
                quality = qualityFromDelivery(info, ctx.quality);
                reason = `\u5B57\u8282\u53EF\u5B9A(${info.format || "audio"}${info.durationSec ? "/" + info.durationSec + "s" : ""})`;
              } else if (kind === "playlist") {
                verdict = "NOT_AUDIO";
                code = ERROR_CODES.STREAM_PLAYLIST;
                evidence = "strong";
                reason = "\u4EA4\u4ED8\u5185\u5BB9\u662F\u6D41\u64AD\u653E\u5217\u8868";
              } else if (kind === "json" || kind === "html" || kind === "empty") {
                verdict = "NOT_AUDIO";
                code = ERROR_CODES.NOT_AUDIO;
                evidence = "strong";
                reason = kind === "empty" ? "\u4EA4\u4ED8\u5185\u5BB9\u4E3A\u7A7A" : `\u4EA4\u4ED8\u5185\u5BB9\u4E0D\u662F\u97F3\u9891(${kind})`;
              } else {
                verdict = "NOT_AUDIO";
                code = ERROR_CODES.NOT_AUDIO;
                evidence = "weak";
                reason = "\u4EA4\u4ED8\u5185\u5BB9\u65E0\u6CD5\u8BC6\u522B\u4E3A\u97F3\u9891";
              }
            } else if (mediaErr) {
              verdict = "TRANSIENT";
              code = mediaErr;
              evidence = "strong";
              reason = `\u6865\u5A92\u4F53\u4FE1\u5C01\u635F\u574F(${mediaErr})`;
            } else {
              if (shape === "playlist") {
                verdict = "NOT_AUDIO";
                code = ERROR_CODES.STREAM_PLAYLIST;
                evidence = "strong";
                reason = "\u4EA4\u4ED8\u5185\u5BB9\u662F\u6D41\u64AD\u653E\u5217\u8868";
              } else if (shape === "json" || shape === "html" || shape === "empty") {
                verdict = "NOT_AUDIO";
                code = ERROR_CODES.NOT_AUDIO;
                evidence = "strong";
                reason = shape === "empty" ? "\u4EA4\u4ED8\u5185\u5BB9\u4E3A\u7A7A" : `\u4EA4\u4ED8\u5185\u5BB9\u4E0D\u662F\u97F3\u9891(${shape})`;
              } else {
                const hv = headerEvidence(delivery.headers || {}, totalBytes);
                if (hv.ok === true) {
                  verdict = "PASS";
                  code = null;
                  evidence = "medium";
                  deliverable = true;
                  quality = qualityFromDelivery(hv.info, ctx.quality);
                  reason = hv.reason;
                } else if (hv.ok === false) {
                  verdict = "NOT_AUDIO";
                  code = hv.code;
                  evidence = "strong";
                  reason = hv.reason;
                } else {
                  verdict = "TRANSIENT";
                  code = ERROR_CODES.NETWORK_ERROR;
                  evidence = "weak";
                  reason = hv.reason;
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
        return { verdict, code: code || null, evidence, deliverable, quality, reason, ledger };
      }
      function computeEligibility(source, platform, quality, opts) {
        const id = source;
        const o = opts || {};
        const q = String(quality || "128k").toLowerCase();
        if (!SOURCE_HANDLERS[id]) return { eligible: false, reason: "unknown-source", code: "SOURCE_UNREACHABLE", untilMs: null };
        const h = SOURCE_HANDLERS[id];
        if (manualOff[id]) return { eligible: false, reason: "user-off", code: "USER_OFF", untilMs: null };
        if (!isUserEnabled(id) && h.lifecycle !== "probation") return { eligible: false, reason: "default-off", code: "DEFAULT_OFF", untilMs: null };
        if (autoOff[id]) return { eligible: false, reason: "auto-off", code: "AUTO_OFF_PROBE", untilMs: autoOffAt[id] ? autoOffAt[id] + cfg("playDeadReviveMs", 5 * 60 * 1e3) : null };
        if (runtimeToggles[id] === false) {
          if (h.lifecycle === "probation") return { eligible: false, reason: "default-off", code: "DEFAULT_OFF", untilMs: null };
          return { eligible: false, reason: "auto-off", code: "AUTO_OFF_PROBE", untilMs: null };
        }
        if (probeState.sleeping[id]) return { eligible: false, reason: "sleeping", code: "SOURCE_SLEEPING", untilMs: null };
        if (platform && h.platforms && !h.platforms.includes(platform)) return { eligible: false, reason: "platform-unsupported", code: "QUALITY_OPEN", untilMs: null };
        if (isResolveDead(id, q, o.consumePlayDeadTrial === true)) return { eligible: false, reason: "resolve-dead", code: "PLAYBACK_FAILED", untilMs: resolveDeadDeadline.get(id) || null };
        if (isPlayDead(id, q, o.consumePlayDeadTrial === true)) return { eligible: false, reason: "play-dead", code: "PLAYBACK_FAILED", untilMs: playDeadDeadline.get(id) || null };
        if (o.runtime && typeof canExecute === "function" && !canExecute(id, q)) {
          const br = getBreaker(id);
          const qSlot = br.byQuality[q];
          const qb = qSlot && qSlot.breaker;
          const reason = qb && qb.state || br.state || "breaker";
          const until = qSlot ? qSlot.rateLimitUntil : br.rateLimitUntil;
          const code = (until || 0) > Date.now() ? "RATE_LIMITED" : "QUALITY_OPEN";
          return { eligible: false, reason, code, untilMs: until || null };
        }
        const brNow = getBreaker(id);
        const qbNow = brNow.byQuality[q] && brNow.byQuality[q].breaker;
        const halfOpenTrial = !!(o.runtime && qbNow && qbNow.state === "half-open");
        if (!halfOpenTrial && (o.runtime || o.qualityShortCircuit) && cfg("qualityShortCircuit", true) && isQualityHopeless(id, q)) {
          return { eligible: false, reason: "quality-short-circuit", code: "QUALITY_SHORT_CIRCUIT", untilMs: qualitySkipProbeAt.get(qualityShortCircuitKey(id, q)) || null };
        }
        if (!o.runtime) return { eligible: true, reason: null, code: "ELIGIBLE", untilMs: null };
        const pv = previewCooldownMap.get(id);
        if (pv && pv > Date.now()) return { eligible: false, reason: "preview_cooldown", code: "PREVIEW_COOLDOWN", untilMs: pv };
        return { eligible: true, reason: null, code: "ELIGIBLE", untilMs: null };
      }
      function shadowLegacyEligibility(source, platform, quality) {
        const id = source;
        const q = String(quality || "128k").toLowerCase();
        if (!SOURCE_HANDLERS[id]) return { eligible: false, reason: "unknown-source", code: "SOURCE_UNREACHABLE", untilMs: null };
        if (runtimeToggles[id] === false || manualOff[id]) return { eligible: false, reason: "manual-off", code: "USER_OFF", untilMs: null };
        if (isPlayDead(id)) return { eligible: false, reason: "play-dead", code: "PLAY_DEAD", untilMs: playDeadDeadline.get(id) || null };
        return { eligible: true, reason: null, code: "ELIGIBLE", untilMs: null };
      }
      function skipReason(source, ctx) {
        const e = computeEligibility(source, ctx && ctx.platform, ctx && ctx.quality, { runtime: true, consumePlayDeadTrial: false });
        if (e.eligible) return null;
        return { reason: e.reason, code: e.code, untilMs: e.untilMs };
      }
      function toggleSource(target, enabled) {
        if (!target || !SOURCE_HANDLERS[target]) throw new Error(`${ERROR_CODES.PARAM_ERROR}: unknown source id`);
        const next = enabled !== false;
        userEnabled[target] = next;
        if (next) {
          delete manualOff[target];
          delete autoOff[target];
          delete autoOffReason[target];
          delete autoOffAt[target];
        } else {
          manualOff[target] = true;
        }
        syncRuntimeToggle(target);
        clearSourceLedger(target, { scope: "authority" });
        clearCrossFallbackCache();
        logInfo(`[\u6E90\u5F00\u5173] ${target} ${next ? "\u5F00\u542F" : "\u5173\u95ED"}\uFF0C\u5DF2\u6E05\u7528\u6237\u8D26\uFF08\u5931\u8D25\u7F13\u5B58/\u6458\u9664/\u7194\u65AD\u9650\u6D41/\u63A2\u6D4B\u6001\uFF09\uFF0C\u4FDD\u7559\u8D28\u91CF\u5386\u53F2`);
        recordHealthEvent({ event: "config_change", sourceId: target, reason: next ? "toggle_on" : "toggle_off" });
        return { id: target, enabled: next, userEnabled: next, autoOff: false };
      }
      function clearSourceLedger(source, opts = {}) {
        const scope = opts.scope || "all";
        const handler = SOURCE_HANDLERS[source];
        if (!handler) return false;
        const prefixes = (handler.platforms || []).map((p) => `fail_${p}`);
        for (const k of Array.from(failCache.keys())) {
          if (!prefixes.length || prefixes.some((pre) => k.includes(pre))) failCache.delete(k);
        }
        playDeadStreak.delete(source);
        playDeadDeadline.delete(source);
        clearResolveDead(source);
        clearPlayDeadTrials(source);
        delete probeState.sleeping[source];
        delete probeState.deadCount[source];
        delete probeState.sleepRound[source];
        probeState.failCount[source] = 0;
        const br = getBreaker(source);
        br.state = "closed";
        br.failureCount = 0;
        br.lastFailureTime = 0;
        br.rateLimitUntil = 0;
        br.rateLimited = false;
        if (br.byQuality) for (const q of Object.keys(br.byQuality)) {
          const s = br.byQuality[q];
          if (!s || typeof s !== "object") continue;
          if (s.breaker && typeof s.breaker === "object") {
            s.breaker.state = "closed";
            s.breaker.failureCount = 0;
            s.breaker.lastFailureTime = 0;
            s.breaker.trialInFlight = false;
          }
          s.rateLimitCount = 0;
          s.rateLimitUntil = 0;
          s.rateLimited = false;
          if (scope !== "authority") {
            s.fail = 0;
            s.success = 0;
            s.linkExpired = 0;
            s.businessFail = 0;
            s.req = 0;
            s.time = 0;
          }
        }
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
        if (adm.verdict === "RATE_LIMITED") recordRateLimit(id, q);
        else if (L.health === "hardFail") recordFailure(id, q, { playDead: L.playDead === true, resolveDead: L.resolveDead === true });
        else recordBusinessFail(id, q);
        const err = ctx.error || {};
        if (adm.code === ERROR_CODES.PREVIEW_FRAGMENT) {
          rememberFragmentSource(ctx.platform, ctx.songInfo, id, q);
          if (err.fragmentUrl) {
            boundedMapSet(
              fragmentUrlMap,
              `${ctx.platform}|${getHashOrMid(ctx.songInfo)}|${String(q || "").toLowerCase()}`,
              { url: err.fragmentUrl, quality: err.fragmentQuality || String(q || "128k").toLowerCase(), source: id, name: ctx.name, ts: Date.now() }
            );
          }
        }
        if (adm.code === ERROR_CODES.LINK_EXPIRED) {
          const qStat = getBreaker(id).byQuality[String(q)];
          if (qStat) qStat.linkExpired = (qStat.linkExpired || 0) + 1;
        }
        return adm;
      }
      function rememberFragmentSource(platform, songInfo, handlerId, quality) {
        const key = `${platform}|${getHashOrMid(songInfo)}`;
        const ts = Date.now();
        let entry = fragmentSourceMap.get(key);
        if (!entry || ts - entry.ts > FRAGMENT_SOURCE_TTL_MS) {
          entry = { sources: /* @__PURE__ */ new Set(), bySource: /* @__PURE__ */ new Map(), ts };
          boundedMapSet(fragmentSourceMap, key, entry);
        }
        entry.ts = ts;
        entry.sources.add(handlerId);
        const qs = entry.bySource.get(handlerId) || /* @__PURE__ */ new Set();
        qs.add(String(quality || "128k").toLowerCase());
        entry.bySource.set(handlerId, qs);
        const midKey = `${platform}|${getHashOrMid(songInfo)}`;
        let hEntry = fragmentHandlerSongsMap.get(handlerId);
        if (!hEntry || ts - hEntry.ts > FRAGMENT_SOURCE_TTL_MS) {
          hEntry = { mids: /* @__PURE__ */ new Set(), ts };
          boundedMapSet(fragmentHandlerSongsMap, handlerId, hEntry);
        }
        hEntry.ts = ts;
        if (qs.size >= 1) hEntry.mids.add(midKey);
        if (hEntry.mids.size >= 2) {
          const songCount = hEntry.mids.size;
          hEntry.mids.clear();
          previewCooldownMap.set(handlerId, ts + PREVIEW_COOLDOWN_MS);
          logWarn(`[${handlerId}] \u8FDE\u7EED ${songCount} \u9996\u4E0D\u540C\u6B4C\u5747\u53EA\u7ED9\u8BD5\u542C\u7247\u6BB5 \u2192 \u5224\u5B9A\u6E90\u7EA7\u9650\u6D41\uFF0C\u51B7\u5374 ${Math.round(PREVIEW_COOLDOWN_MS / 6e4)} \u5206\u949F\u5E76\u8F6C\u8DE8\u5E73\u53F0`);
        }
      }
      function getFragmentSources(platform, songInfo) {
        const key = `${platform}|${getHashOrMid(songInfo)}`;
        const entry = fragmentSourceMap.get(key);
        if (!entry) return /* @__PURE__ */ new Set();
        if (Date.now() - entry.ts > FRAGMENT_SOURCE_TTL_MS) {
          fragmentSourceMap.delete(key);
          return /* @__PURE__ */ new Set();
        }
        return entry.sources;
      }
      function getDeliveryQuality(handlerId, platform, songInfo, quality) {
        const key = `${handlerId}|${platform}|${getHashOrMid(songInfo)}|${String(quality || "").toLowerCase()}`;
        return deliveryQualityMap.get(key) || "";
      }
      function noteQualityCeiling(platform, songInfo, achievedQuality) {
        const key = `${platform}|${getHashOrMid(songInfo)}`;
        boundedMapSet(qualityCeilingMap, key, { quality: achievedQuality, ts: Date.now() });
      }
      function getQualityCeiling(platform, songInfo) {
        const key = `${platform}|${getHashOrMid(songInfo)}`;
        const entry = qualityCeilingMap.get(key);
        if (!entry) return "";
        if (Date.now() - entry.ts > QUALITY_CEILING_TTL_MS) {
          qualityCeilingMap.delete(key);
          return "";
        }
        return entry.quality || "";
      }
      function qualityToSuyinQQ(quality) {
        const q = String(quality || "128k").toLowerCase();
        if (q === "flac24bit") return "hires";
        if (q === "192k") return "320k";
        return QUALITY_TO_X.suyinQQ[q] ? q : "128k";
      }
      var MOBILE_UA_POOL = [
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1",
        "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36",
        "Mozilla/5.0 (Linux; Android 12; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0 Mobile Safari/537.36"
      ];
      var __uaCounter = 0;
      function getMobileUserAgent() {
        return MOBILE_UA_POOL[(__uaCounter++ + Math.floor(Date.now() / 6e4)) % MOBILE_UA_POOL.length];
      }
      function getHashOrMid(songInfo) {
        var _a2, _b2, _c2;
        return (_c2 = (_b2 = (_a2 = songInfo == null ? void 0 : songInfo.hash) != null ? _a2 : songInfo == null ? void 0 : songInfo.songmid) != null ? _b2 : songInfo == null ? void 0 : songInfo.id) != null ? _c2 : null;
      }
      function getQQSongId(songInfo) {
        var _a2, _b2, _c2, _d2, _e2, _f2;
        const mid = ((_b2 = (_a2 = songInfo == null ? void 0 : songInfo.meta) == null ? void 0 : _a2.qq) == null ? void 0 : _b2.mid) || ((_c2 = songInfo == null ? void 0 : songInfo.meta) == null ? void 0 : _c2.mid) || (songInfo == null ? void 0 : songInfo.songmid) || (typeof (songInfo == null ? void 0 : songInfo.id) === "string" && !/^\d+$/.test(songInfo.id) ? songInfo.id : null);
        if (mid) return { type: "mid", value: mid };
        const songid = ((_e2 = (_d2 = songInfo == null ? void 0 : songInfo.meta) == null ? void 0 : _d2.qq) == null ? void 0 : _e2.songid) || ((_f2 = songInfo == null ? void 0 : songInfo.meta) == null ? void 0 : _f2.songid) || (typeof (songInfo == null ? void 0 : songInfo.id) === "number" ? songInfo.id : typeof (songInfo == null ? void 0 : songInfo.id) === "string" && /^\d+$/.test(songInfo.id) ? Number(songInfo.id) : null);
        if (songid) return { type: "songid", value: songid };
        return null;
      }
      function normalizeKeyword(keyword) {
        if (!keyword) return "";
        return String(keyword).replace(/\([^)]*\)/g, "").replace(/\s+/g, "").replace(/[^\w\u4e00-\u9fa5]/g, "").trim().toLowerCase();
      }
      function titleMatch(a, b) {
        const na = normalizeKeyword(a);
        const nb = normalizeKeyword(b);
        if (!na || !nb) return true;
        return na.includes(nb) || nb.includes(na);
      }
      function durationMatch(dur1, dur2, threshold = 5) {
        if (!dur1 || !dur2) return true;
        return Math.abs(Number(dur1) - Number(dur2)) <= threshold;
      }
      function identityNormalize(v) {
        if (v === void 0 || v === null) return "";
        return String(v).replace(/\([^)]*\)/g, " ").replace(/（[^）]*）/g, " ").replace(/\[[^\]]*\]/g, " ").replace(/【[^】]*】/g, " ").replace(/[^0-9A-Za-z\u00C0-\u024F\u3040-\u30FF\u3400-\u9FFF\uF900-\uFAFF]/g, "").trim().toLowerCase();
      }
      function identityTokens(v) {
        return String(v || "").split(/\s*[\/、,&;|]\s*|\s+feat\.?\s*|\s+ft\.?\s*/i).map(identityNormalize).filter((t) => t.length >= 2);
      }
      function artistMatch(target, candidate) {
        const t = identityNormalize(target);
        const c = identityNormalize(candidate);
        if (!t) return true;
        if (!c) return false;
        if (t === c || t.includes(c) || c.includes(t)) return true;
        const tt = identityTokens(target);
        const ct = identityTokens(candidate);
        return tt.some((x) => ct.includes(x) || ct.some((y) => y.includes(x)));
      }
      function strictTitleMatch(target, candidate) {
        const t = identityNormalize(target);
        const c = identityNormalize(candidate);
        if (!t || !c) return false;
        if (t === c) return true;
        return (t.includes(c) || c.includes(t)) && Math.min(t.length, c.length) >= 4;
      }
      var CROSS_VARIANT_RE = /(remix|dj|伴奏|翻唱|cover|live|现场|instrumental|纯音乐|节奏|加速|慢速|片段|试听|demo|preview|teaser|版)/i;
      function crossVariantWords(name) {
        const m = String(name || "").match(new RegExp(CROSS_VARIANT_RE.source, "gi"));
        return m ? m.map((x) => x.toLowerCase()) : [];
      }
      function crossVariantCompatible(targetName, candidateName) {
        const targetWords = crossVariantWords(targetName);
        return crossVariantWords(candidateName).every((w) => targetWords.indexOf(w) >= 0);
      }
      function scoreCrossCandidate(cand, target) {
        const tn = identityNormalize(target == null ? void 0 : target.name);
        const cn = identityNormalize(cand == null ? void 0 : cand.name);
        if (!tn || !cn) return -1;
        let score = 0;
        if (tn === cn) score += 6;
        else if (strictTitleMatch(target == null ? void 0 : target.name, cand == null ? void 0 : cand.name)) score += 4;
        else return -1;
        const ta = identityNormalize(target == null ? void 0 : target.singer);
        const ca = identityNormalize(cand == null ? void 0 : cand.singer);
        if (ta && !ca) return -1;
        if (ta && ca) score += ta === ca ? 4 : 2;
        const td = normalizeDurationSec(target == null ? void 0 : target.duration);
        const cd = normalizeDurationSec(cand == null ? void 0 : cand.duration);
        if (td && cd) {
          const diff = Math.abs(td - cd);
          if (diff > 5) return -1;
          score += diff === 0 ? 3 : diff <= 2 ? 2 : 1;
        }
        if (!crossVariantCompatible(target == null ? void 0 : target.name, cand == null ? void 0 : cand.name)) return -1;
        const talb = identityNormalize((target == null ? void 0 : target.albumName) || (target == null ? void 0 : target.album));
        const calb = identityNormalize(cand == null ? void 0 : cand.album);
        if (talb && calb && talb === calb) score += 1;
        return score;
      }
      function pickCrossCandidate(list, target) {
        if (!Array.isArray(list) || !list.length) return null;
        let best = null;
        let bestScore = -1;
        for (const cand of list) {
          const s = scoreCrossCandidate(cand, target);
          if (s > bestScore) {
            best = cand;
            bestScore = s;
          }
        }
        return bestScore >= 0 ? best : null;
      }
      function buildCrossSearchQuery(songInfo) {
        const rawName = String((songInfo == null ? void 0 : songInfo.name) || "").replace(/\([^)]*\)/g, " ").replace(/（[^）]*）/g, " ").trim() || String((songInfo == null ? void 0 : songInfo.name) || "");
        const rawSinger = String((songInfo == null ? void 0 : songInfo.singer) || "").replace(/\([^)]*\)/g, " ").replace(/（[^）]*）/g, " ").trim();
        const firstSinger = rawSinger.split(/\s*[\/、,&;|]\s*/)[0] || rawSinger;
        return `${rawName} ${firstSinger}`.trim();
      }
      function buildSearchKeywords(songInfo) {
        const keywords = [];
        const name = (songInfo == null ? void 0 : songInfo.name) || "";
        const album = (songInfo == null ? void 0 : songInfo.albumName) || (songInfo == null ? void 0 : songInfo.album) || "";
        const singer = (songInfo == null ? void 0 : songInfo.singer) || "";
        if (name && album) {
          const kw = normalizeKeyword(name + album);
          if (kw) keywords.push({ keyword: kw, strict: true });
        }
        if (name && singer) {
          const kw = normalizeKeyword(name + singer);
          if (kw) keywords.push({ keyword: kw, strict: true });
        }
        if (name) {
          const kw = normalizeKeyword(name);
          if (kw) keywords.push({ keyword: kw, strict: false });
        }
        return keywords;
      }
      var FRAGMENT_RE = /(15\s*秒|0\.?\s*8x|片段|试听|demo|preview|teaser)/i;
      var PREVIEW_URL_RE = /(preview|test|sample|试听|片段|demo|teaser|clip)/i;
      function isPreviewFragmentUrl(url) {
        if (!url || typeof url !== "string") return false;
        return PREVIEW_URL_RE.test(url);
      }
      function normalizeDurationSec(d) {
        if (typeof d === "string" && d.indexOf(":") >= 0) {
          const parts = d.split(":").map((x) => Number(String(x).trim()));
          if (parts.some((x) => !Number.isFinite(x) || x < 0)) return 0;
          if (parts.length === 2) return Math.round(parts[0] * 60 + parts[1]);
          if (parts.length === 3) return Math.round(parts[0] * 3600 + parts[1] * 60 + parts[2]);
          return 0;
        }
        const v = Number(d);
        if (!Number.isFinite(v) || v <= 0) return 0;
        return v > 5e3 ? Math.floor(v / 1e3) : Math.round(v);
      }
      function songInfoMatch(responseData, songInfo) {
        var _a2, _b2, _c2, _d2, _e2;
        const song = (responseData == null ? void 0 : responseData.song) || ((_a2 = responseData == null ? void 0 : responseData.data) == null ? void 0 : _a2.song) || "";
        const singer = (responseData == null ? void 0 : responseData.singer) || ((_b2 = responseData == null ? void 0 : responseData.data) == null ? void 0 : _b2.singer) || "";
        const album = (responseData == null ? void 0 : responseData.album) || ((_c2 = responseData == null ? void 0 : responseData.data) == null ? void 0 : _c2.album) || "";
        if (!titleMatch(song, (songInfo == null ? void 0 : songInfo.name) || "")) return false;
        const targetName = String((songInfo == null ? void 0 : songInfo.name) || "");
        if (targetName && song && !FRAGMENT_RE.test(targetName) && FRAGMENT_RE.test(String(song))) return false;
        if ((songInfo == null ? void 0 : songInfo.singer) && singer && !artistMatch(songInfo.singer, singer)) return false;
        if (((songInfo == null ? void 0 : songInfo.albumName) || (songInfo == null ? void 0 : songInfo.album)) && album && !titleMatch(album, songInfo.albumName || songInfo.album)) return false;
        const tDur = normalizeDurationSec(songInfo == null ? void 0 : songInfo.duration);
        const rDur = normalizeDurationSec((responseData == null ? void 0 : responseData.duration) || ((_d2 = responseData == null ? void 0 : responseData.data) == null ? void 0 : _d2.duration) || ((_e2 = responseData == null ? void 0 : responseData.musicInfo) == null ? void 0 : _e2.duration));
        if (tDur && rDur && !durationMatch(tDur, rDur, 5)) return false;
        return true;
      }
      function parseMessageSongInfo(message) {
        if (!message) return null;
        const result = {};
        const lines = String(message).split("\n");
        for (const line of lines) {
          if (line.startsWith("\u6B4C\u540D\uFF1A")) result.song = line.replace("\u6B4C\u540D\uFF1A", "").trim();
          if (line.startsWith("\u6B4C\u624B\uFF1A")) result.singer = line.replace("\u6B4C\u624B\uFF1A", "").trim();
          if (line.startsWith("\u4E13\u8F91\uFF1A")) result.album = line.replace("\u4E13\u8F91\uFF1A", "").trim();
          if (line.startsWith("\u65F6\u957F\uFF1A")) result.duration = line.replace("\u65F6\u957F\uFF1A", "").trim();
        }
        return result.song ? result : null;
      }
      var HUIBQ_FAIL_MSG_REGEX = /无法获取|获取失败|失败|错误|不存在|无效|error/i;
      function isHuibqFailMsg(msg) {
        return HUIBQ_FAIL_MSG_REGEX.test(String(msg || ""));
      }
      function assertDeliverableUrl(url, sourceName) {
        const u = typeof url === "string" ? url.trim() : "";
        if (!HTTP_URL_REGEX.test(u)) {
          const err = new Error(`${ERROR_CODES.PARAM_ERROR}: ${sourceName}\u8FD4\u56DE\u975E\u6CD5URL(\u975Ehttp/https)`);
          err.code = ERROR_CODES.PARAM_ERROR;
          throw err;
        }
        return u;
      }
      function validateUrl(url, sourceName) {
        if (!url || typeof url !== "string" || !url.trim()) throw new Error(`${ERROR_CODES.NOT_FOUND}: ${sourceName}\u8FD4\u56DE\u7A7AURL`);
        if (!HTTP_URL_REGEX.test(url.trim())) throw new Error(`${ERROR_CODES.PARAM_ERROR}: ${sourceName}\u975E\u6CD5URL\u683C\u5F0F`);
        return url.trim();
      }
      function upgradeToHttps(url) {
        if (!url || typeof url !== "string") return url;
        return url.replace(/^http:\/\//i, "https://");
      }
      function buildCacheKey(prefix, songInfo, quality = "") {
        const id = (songInfo == null ? void 0 : songInfo.id) || (songInfo == null ? void 0 : songInfo.songmid) || (songInfo == null ? void 0 : songInfo.hash) || (songInfo == null ? void 0 : songInfo.rid) || "";
        const name = (songInfo == null ? void 0 : songInfo.name) || "";
        const singer = (songInfo == null ? void 0 : songInfo.singer) || "";
        const album = (songInfo == null ? void 0 : songInfo.albumName) || (songInfo == null ? void 0 : songInfo.album) || "";
        return `${prefix}_${id}_${name}_${singer}_${album}_${quality}`;
      }
      function getCachedUrl(cacheKey) {
        const entry = successCache.get(cacheKey);
        if (!entry) return null;
        const q = String(entry.quality || "128k").toLowerCase();
        const isHighQuality = q === "flac" || q === "320k" || q === "flac24bit" || q === "hires";
        const ttl = isHighQuality ? cfg("cacheTtlHighQualityMs", 18e5) : cfg("cacheTtlMs", 216e5);
        if (entry.ts && Date.now() - entry.ts > ttl) {
          return null;
        }
        return entry;
      }
      function setCachedUrl(cacheKey, url, quality, source, platform) {
        successCache.set(cacheKey, { url, quality: quality || "128k", source, platform: platform || "", ts: Date.now() });
      }
      function setFailCached(failKey, code, ttl) {
        failCache.set(failKey, { code: code || ERROR_CODES.NETWORK_ERROR, ts: Date.now(), ttl });
      }
      function getFailCachedEntry(failKey) {
        const entry = failCache.get(failKey);
        if (!entry) return null;
        const ttl = entry.ttl !== void 0 ? entry.ttl : entry.code === ERROR_CODES.NOT_FOUND ? cfg("failCacheNotFoundMs", 36e5) : entry.code === ERROR_CODES.LINK_EXPIRED ? cfg("failCacheExpiredMs", 6e4) : FAIL_CACHE_TTL_BY_CODE[entry.code];
        const effTtl = ttl === void 0 ? cfg("failCacheDefaultMs", 5 * 60 * 1e3) : ttl;
        if (effTtl === void 0) return entry;
        if (effTtl === 0) return null;
        return Date.now() - entry.ts < effTtl ? entry : null;
      }
      async function wyOuterGetUrl(platform, songId, quality, songInfo, cancelToken = null) {
        var _a2, _b2;
        if (platform !== "wy") throw new Error(`${ERROR_CODES.PARAM_ERROR}: \u7F51\u6613\u4E91\u5B98\u65B9\u4EC5\u652F\u6301wy\u5E73\u53F0`);
        const id = (_a2 = songId != null ? songId : songInfo == null ? void 0 : songInfo.id) != null ? _a2 : songInfo == null ? void 0 : songInfo.songmid;
        if (!id) throw new Error(`${ERROR_CODES.PARAM_ERROR}: \u7F51\u6613\u4E91\u5B98\u65B9\u7F3A\u5C11\u6B4C\u66F2ID`);
        const url = WY_OUTER_API.replace("{id}", encodeURIComponent(String(id)));
        const res = await httpRequestWithRetry(url, {
          method: "GET",
          headers: { "User-Agent": getMobileUserAgent() },
          timeout: TIMEOUT_CONFIG.parse,
          follow_max: 5,
          cancelToken
        });
        const ct = String(((_b2 = res.headers) == null ? void 0 : _b2["content-type"]) || "");
        if (res.statusCode !== 200 || !/audio|octet|mpeg/i.test(ct)) {
          throw new Error(`${ERROR_CODES.NOT_FOUND}: \u7F51\u6613\u4E91\u8BE5\u6B4C\u66F2\u4E0D\u53EF\u8BD5\u542C(\u53EF\u80FD\u9700VIP)\uFF0C\u8DF3\u8FC7`);
        }
        return res.url || url;
      }
      function kuwoUnescape(text) {
        return String(text || "").replace(/&nbsp;/g, " ").replace(/\\u([0-9a-fA-F]{4})/g, (m, hex) => String.fromCharCode(parseInt(hex, 16))).trim();
      }
      async function kuwoOfficialSearch(keyword, rn = 10, cancelToken = null) {
        const url = `${KUWO_SEARCH_API}?client=kt&all=${encodeURIComponent(keyword)}&pn=0&rn=${rn}&ft=music&rformat=json&encoding=utf8`;
        const res = await httpRequestWithRetry(url, {
          method: "GET",
          headers: { "User-Agent": getMobileUserAgent() },
          timeout: TIMEOUT_CONFIG.search,
          cancelToken
        });
        const raw = typeof res.body === "string" ? res.body : String(res.body || "");
        let parsed = res.body && typeof res.body === "object" ? res.body : null;
        if (!parsed) {
          const cleaned = raw.replace(/'/g, '"');
          try {
            parsed = JSON.parse(cleaned);
          } catch (e) {
          }
        }
        if (parsed && Array.isArray(parsed.abslist)) {
          return parsed.abslist.map((item) => ({
            rid: String(item.MP3RID || "").replace("MP3_", ""),
            name: kuwoUnescape(item.NAME),
            singer: kuwoUnescape(item.ARTIST),
            duration: Number(item.DURATION) || 0
          })).filter((i) => i.rid);
        }
        const items = [];
        const blockRe = /\{'MP3RID':'MP3_(\d+)'/g;
        let m;
        while (m = blockRe.exec(raw)) {
          items.push({ rid: m[1], name: "", singer: "", duration: 0 });
        }
        return items;
      }
      async function kuwoPicSearch(keyword) {
        var _a2;
        const url = `${KUWO_SEARCH_API}?client=kt&all=${encodeURIComponent(keyword)}&pn=0&rn=1&ft=music&rformat=json&encoding=utf8`;
        const res = await httpRequestWithRetry(url, {
          method: "GET",
          headers: { "User-Agent": getMobileUserAgent() },
          timeout: TIMEOUT_CONFIG.search
        });
        const raw = typeof res.body === "string" ? res.body : String(res.body || "");
        const cleaned = raw.replace(/'/g, '"');
        try {
          const parsed = JSON.parse(cleaned);
          const item = (_a2 = parsed == null ? void 0 : parsed.abslist) == null ? void 0 : _a2[0];
          if (item) {
            const pic = item.hts_MVPIC || (item.MVPIC ? `https://img2.kuwo.cn/${item.MVPIC}` : null);
            if (typeof pic === "string" && /^https?:/.test(pic)) return pic;
          }
        } catch (e) {
        }
        throw new Error(`${ERROR_CODES.NOT_FOUND}: \u9177\u6211\u5C01\u9762\u83B7\u53D6\u5931\u8D25`);
      }
      async function getLyricForPlatform(platform, songInfo) {
        var _a2, _b2;
        if (!songInfo || typeof songInfo !== "object") throw new Error(`${ERROR_CODES.PARAM_ERROR}: \u65E0\u6548\u7684\u6B4C\u66F2\u4FE1\u606F`);
        if (platform !== "wy") throw new Error(`${ERROR_CODES.NOT_FOUND}: ${platform} \u5E73\u53F0\u6682\u65E0\u7A33\u5B9A\u6B4C\u8BCD\u63A5\u53E3`);
        const id = (songInfo == null ? void 0 : songInfo.songmid) || (songInfo == null ? void 0 : songInfo.id);
        if (!id) throw new Error(`${ERROR_CODES.PARAM_ERROR}: \u7F51\u6613\u4E91\u6B4C\u8BCD\u7F3A\u5C11\u6B4C\u66F2ID`);
        const res = await httpGet(WY_LYRIC_API, { id: String(id), lv: 1, kv: 1, tv: -1 }, "parse", null, 0);
        const lyric = (_a2 = res == null ? void 0 : res.lrc) == null ? void 0 : _a2.lyric;
        if (typeof lyric !== "string" || !lyric.length) throw new Error(`${ERROR_CODES.NOT_FOUND}: \u7F51\u6613\u4E91\u6B4C\u8BCD\u4E0D\u5B58\u5728\u6216\u9700VIP`);
        return {
          lyric,
          tlyric: typeof ((_b2 = res == null ? void 0 : res.tlyric) == null ? void 0 : _b2.lyric) === "string" && res.tlyric.lyric.length ? res.tlyric.lyric : null,
          rlyric: null
        };
      }
      async function getPicForPlatform(platform, songInfo) {
        var _a2, _b2, _c2;
        if (!songInfo || typeof songInfo !== "object") throw new Error(`${ERROR_CODES.PARAM_ERROR}: \u65E0\u6548\u7684\u6B4C\u66F2\u4FE1\u606F`);
        if (platform === "wy") {
          const id = (songInfo == null ? void 0 : songInfo.songmid) || (songInfo == null ? void 0 : songInfo.id);
          if (!id) throw new Error(`${ERROR_CODES.PARAM_ERROR}: \u7F51\u6613\u4E91\u5C01\u9762\u7F3A\u5C11\u6B4C\u66F2ID`);
          const res = await httpGet(WY_DETAIL_API, { id: String(id), ids: `[${String(id)}]` }, "parse", { "User-Agent": getMobileUserAgent() });
          const song = (_a2 = res == null ? void 0 : res.songs) == null ? void 0 : _a2[0];
          const picUrl = (song == null ? void 0 : song.picUrl) || ((_b2 = song == null ? void 0 : song.album) == null ? void 0 : _b2.picUrl) || ((_c2 = song == null ? void 0 : song.album) == null ? void 0 : _c2.blurPicUrl);
          if (typeof picUrl !== "string" || !/^https?:/.test(picUrl)) throw new Error(`${ERROR_CODES.NOT_FOUND}: \u7F51\u6613\u4E91\u5C01\u9762\u83B7\u53D6\u5931\u8D25`);
          return picUrl;
        }
        if (platform === "kw") {
          const keyword = (songInfo == null ? void 0 : songInfo.name) ? `${songInfo.name} ${(songInfo == null ? void 0 : songInfo.singer) || ""}`.trim() : "";
          if (!keyword) throw new Error(`${ERROR_CODES.PARAM_ERROR}: \u9177\u6211\u5C01\u9762\u7F3A\u5C11\u6B4C\u66F2\u540D`);
          return kuwoPicSearch(keyword);
        }
        throw new Error(`${ERROR_CODES.NOT_FOUND}: ${platform} \u5E73\u53F0\u6682\u65E0\u7A33\u5B9A\u5C01\u9762\u63A5\u53E3`);
      }
      async function kuwoOfficialConvert(rid, cancelToken = null) {
        if (!rid) throw new Error(`${ERROR_CODES.PARAM_ERROR}: \u9177\u6211\u5B98\u65B9\u7F3A\u5C11rid`);
        const url = `${KUWO_CONVERT_API}?type=convert_url&rid=${encodeURIComponent(rid)}&format=mp3&response=url`;
        const res = await httpRequestWithRetry(url, {
          method: "GET",
          headers: { "User-Agent": getMobileUserAgent() },
          timeout: TIMEOUT_CONFIG.parse,
          cancelToken
        });
        const text = typeof res.body === "string" ? res.body.trim() : String(res.body || "").trim();
        if (!text || text === "refuse request!" || !HTTP_URL_REGEX.test(text)) {
          throw new Error(`${ERROR_CODES.NOT_FOUND}: \u9177\u6211\u5B98\u65B9convert_url\u672A\u8FD4\u56DE\u94FE\u63A5`);
        }
        return text;
      }
      async function kuwoOfficialGetUrl(platform, songId, quality, songInfo, cancelToken = null) {
        if (platform !== "kw") throw new Error(`${ERROR_CODES.PARAM_ERROR}: \u9177\u6211\u5B98\u65B9\u4EC5\u652F\u6301kw\u5E73\u53F0`);
        if (!(songInfo == null ? void 0 : songInfo.name)) throw new Error(`${ERROR_CODES.PARAM_ERROR}: \u9177\u6211\u5B98\u65B9\u9700\u8981\u6B4C\u66F2\u540D`);
        const cacheKey = buildCacheKey("kwoff", songInfo, "128k");
        const cached = getCachedUrl(cacheKey);
        if (cached && cached.url) return cached.url;
        const targetName = normalizeKeyword(songInfo.name);
        const items = await kuwoOfficialSearch(`${songInfo.name} ${songInfo.singer || ""}`.trim(), 10, cancelToken);
        if (!items.length) throw new Error(`${ERROR_CODES.NOT_FOUND}: \u9177\u6211\u5B98\u65B9\u641C\u7D22\u65E0\u7ED3\u679C`);
        let match = null;
        for (const item of items) {
          if (normalizeKeyword(item.name) === targetName) {
            match = item;
            break;
          }
        }
        if (!match) {
          for (const item of items) {
            const n = normalizeKeyword(item.name);
            if (n && n.includes(targetName)) {
              match = item;
              break;
            }
          }
        }
        if (!match) match = items[0];
        if (!titleMatch(match.name, songInfo.name) || songInfo.singer && !artistMatch(songInfo.singer, match.singer)) {
          throw new Error(`${ERROR_CODES.MISMATCH}: \u9177\u6211\u5B98\u65B9\u5339\u914D\u7ED3\u679C\u4E0E\u76EE\u6807\u6B4C\u66F2\u4E0D\u7B26`);
        }
        const url = await kuwoOfficialConvert(match.rid, cancelToken);
        return url;
      }
      var HELLOWORLD_KW_BR = { "128k": "128kmp3", "320k": "320kmp3", flac: "2000kflac", flac24bit: "4000kflac" };
      async function helloworldKwGetUrl(platform, songId, quality, songInfo, cancelToken = null) {
        if (platform !== "kw") throw new Error(`${ERROR_CODES.PARAM_ERROR}: helloworld\u4EC5\u652F\u6301kw\u5E73\u53F0`);
        const id = (songInfo == null ? void 0 : songInfo.rid) || (songInfo == null ? void 0 : songInfo.songmid) || (songInfo == null ? void 0 : songInfo.id) || songId;
        if (!id) throw new Error(`${ERROR_CODES.PARAM_ERROR}: helloworld\u7F3A\u5C11kw rid`);
        const q = String(quality || "128k").toLowerCase();
        const br = HELLOWORLD_KW_BR[q] || "2000kflac";
        const convertUrl = `${HELLOWORLD_KW_CONVERT_API}?f=web&user=0&source=kwplayerhd_ar_1.1.4.5_tianbao_T1A_qirui.apk&type=convert_url_with_sign&rid=${encodeURIComponent(String(id))}&br=${br}`;
        let lastError = null;
        try {
          const res = await httpRequestWithRetry(convertUrl, {
            method: "GET",
            headers: { "User-Agent": getMobileUserAgent() },
            timeout: TIMEOUT_CONFIG.parse,
            cancelToken
          });
          const data = res == null ? void 0 : res.body;
          if (data && typeof data === "object" && Number(data.code) === 200 && data.data && typeof data.data.url === "string" && data.data.url.length > 0) {
            const rawUrl = data.data.url;
            if (HTTP_URL_REGEX.test(rawUrl)) {
              const httpsUrl = assertDeliverableUrl(upgradeToHttps(rawUrl), "helloworld");
              if (!await isAudioPlayable(httpsUrl, 2500, cancelToken)) {
                const helloworldErr = new Error(`${ERROR_CODES.LINK_EXPIRED}: helloworld\u7B7E\u540DURL\u4E0D\u53EF\u64AD(CDN 410)`);
                helloworldErr.code = ERROR_CODES.LINK_EXPIRED;
                throw helloworldErr;
              }
              if (cfg("previewUrlPreFilter", false) && isPreviewFragmentUrl(httpsUrl)) {
                throw new Error(`${ERROR_CODES.NOT_FOUND}: helloworld\u8FD4\u56DE\u8BD5\u542C\u7247\u6BB5(\u975E\u5B8C\u6574\u7248)\uFF0C\u8DF3\u8FC7`);
              }
              return httpsUrl;
            }
          }
          lastError = new Error(`${ERROR_CODES.NOT_FOUND}: helloworld convert_url\u672A\u8FD4\u56DE\u6709\u6548\u94FE\u63A5`);
        } catch (e) {
          lastError = e;
        }
        try {
          const res2 = await httpRequestWithRetry(HELLOWORLD_HTW_API, {
            method: "POST",
            headers: { "Content-Type": "application/json", "User-Agent": getMobileUserAgent() },
            body: JSON.stringify({
              source: "kw",
              songmid: String(id),
              quality: q === "128k" ? "standard" : q === "320k" ? "high" : "lossless"
            }),
            timeout: TIMEOUT_CONFIG.parse,
            cancelToken
          });
          const d2 = res2 == null ? void 0 : res2.body;
          if (d2 && typeof d2 === "object" && (Number(d2.code) === 0 || Number(d2.code) === 200) && typeof d2.url === "string" && d2.url.length > 0 && HTTP_URL_REGEX.test(d2.url)) {
            const httpsUrl2 = assertDeliverableUrl(upgradeToHttps(d2.url), "helloworld htw");
            if (!await isAudioPlayable(httpsUrl2, 2500, cancelToken)) {
              const helloworldHtwErr = new Error(`${ERROR_CODES.LINK_EXPIRED}: helloworld htw\u7B7E\u540DURL\u4E0D\u53EF\u64AD(CDN 410)`);
              helloworldHtwErr.code = ERROR_CODES.LINK_EXPIRED;
              throw helloworldHtwErr;
            }
            if (cfg("previewUrlPreFilter", false) && isPreviewFragmentUrl(httpsUrl2)) {
              throw new Error(`${ERROR_CODES.NOT_FOUND}: helloworld htw\u8FD4\u56DE\u8BD5\u542C\u7247\u6BB5(\u975E\u5B8C\u6574\u7248)\uFF0C\u8DF3\u8FC7`);
            }
            return httpsUrl2;
          }
          if (!lastError) lastError = new Error(`${ERROR_CODES.NOT_FOUND}: helloworld htw\u672A\u8FD4\u56DE\u6709\u6548\u94FE\u63A5`);
        } catch (e) {
          if (!lastError) lastError = e;
        }
        throw lastError || new Error(`${ERROR_CODES.NOT_FOUND}: helloworld\u5931\u8D25`);
      }
      async function ikunGetUrl(platform, songId, quality, songInfo, cancelToken = null) {
        var _a2, _b2;
        if (platform !== "kw" && platform !== "wy") throw new Error(`${ERROR_CODES.PARAM_ERROR}: ikun\u4EC5\u652F\u6301kw/wy\u5E73\u53F0`);
        const id = (_b2 = (_a2 = songInfo == null ? void 0 : songInfo.hash) != null ? _a2 : songInfo == null ? void 0 : songInfo.songmid) != null ? _b2 : songId;
        if (!id) throw new Error(`${ERROR_CODES.PARAM_ERROR}: ikun\u7F3A\u5C11\u6B4C\u66F2ID`);
        const res = await httpRequestWithRetry(`${IKUN_API}/music/url`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "User-Agent": getMobileUserAgent(), "X-Api-Key": USER_CONFIG.ikunApiKey || "" },
          body: JSON.stringify({ source: platform, musicId: String(id), quality: quality || "128k" }),
          timeout: TIMEOUT_CONFIG.parse,
          follow_max: 5,
          cancelToken
        });
        const body = res.body;
        if (!body || typeof body !== "object" || Number.isNaN(Number(body.code))) throw new Error(`${ERROR_CODES.SERVER_ERROR}: ikun\u8FD4\u56DE\u65E0\u6548`);
        const code = Number(body.code);
        if (code === 200 && body.url) return upgradeToHttps(body.url);
        if (code === 403) throw new Error(`${ERROR_CODES.CONFIG_ERROR}: ikun\u5361\u5BC6\u5931\u6548/\u9274\u6743\u5931\u8D25\uFF08\u516C\u76CA\u7248\u7559\u7A7A\u5361\u5BC6\u5373\u53EF\uFF09`);
        if (code === 429) throw new Error(`${ERROR_CODES.RATE_LIMIT}: ikun\u8BF7\u6C42\u8FC7\u9891`);
        throw new Error(`${ERROR_CODES.NOT_FOUND}: ikun ${body.message || "\u83B7\u53D6URL\u5931\u8D25"}`);
      }
      async function xinghaiBackendGetUrl(platform, songId, quality, songInfo, cancelToken = null) {
        var _a2;
        if (platform !== "kw") {
          throw new Error(`${ERROR_CODES.PARAM_ERROR}: \u661F\u6D77\u540E\u7AEF\u4E3B\u57DF\u4EC5\u63A5\u5165kw(wy\u7B7E\u540DURL\u672C\u673A403\u7591\u7ED1\u5B9A\u540E\u7AEF\u51FA\u53E3IP\uFF0C\u9700\u5BB6\u5EAD\u5BBD\u5E26\u81EA\u9A8C\u540E\u518D\u5F00)`);
        }
        const selectedQuality = String(quality || "128k").toLowerCase();
        const id = (_a2 = songId != null ? songId : getHashOrMid(songInfo)) != null ? _a2 : null;
        if (!id) {
          const idErr = new Error(`${ERROR_CODES.PARAM_ERROR}: \u661F\u6D77\u540E\u7AEF\u7F3A\u5C11 songmid/id\uFF0C\u65E0\u6CD5\u5B9A\u4F4D\u6B4C\u66F2`);
          idErr.code = ERROR_CODES.PARAM_ERROR;
          throw idErr;
        }
        const params = {
          source: "kw",
          name: (songInfo == null ? void 0 : songInfo.name) || "",
          singer: (songInfo == null ? void 0 : songInfo.singer) || "",
          songmid: id,
          interval: (songInfo == null ? void 0 : songInfo.interval) || (songInfo == null ? void 0 : songInfo.duration) || "",
          albumName: (songInfo == null ? void 0 : songInfo.albumName) || (songInfo == null ? void 0 : songInfo.album) || "",
          quality: selectedQuality
        };
        const query = Object.keys(params).map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`).join("&");
        const res = await httpRequestWithRetry(`${XINGHAI_BACKEND_API}?${query}`, {
          method: "GET",
          // v8.4 修复：上游 token 校验升级——自定义 X-Token 被判"无效/过期，请使用官方版本"返回 403；
          // 实测不带 X-Token 的第三方调用放行(200，受总 QPS 限，notice 要求标注来源)。故不再发送自定义 token。
          headers: {
            "X-Client": "lx-aggregate/12.0",
            "User-Agent": "LX-Music-Mobile"
          },
          timeout: TIMEOUT_CONFIG.parse,
          cancelToken
        });
        const body = res.body;
        if (!body || typeof body !== "object") throw new Error(`${ERROR_CODES.SERVER_ERROR}: \u661F\u6D77\u540E\u7AEF\u8FD4\u56DE\u65E0\u6548`);
        if (Number(body.code) !== 200 || !body.url) throw new Error(body.msg ? `${ERROR_CODES.NOT_FOUND}: ${body.msg}` : `${ERROR_CODES.NOT_FOUND}: \u661F\u6D77\u540E\u7AEF\u65E0\u53EF\u7528\u94FE\u63A5`);
        return String(body.url).replace(/^http:\/\//i, "https://");
      }
      async function huibqGetUrl(platform, songId, quality, songInfo, cancelToken = null) {
        var _a2, _b2;
        if (!HUIBQ_API || !HUIBQ_REQUEST_KEY) throw new Error(`${ERROR_CODES.CONFIG_ERROR}: Huibq\u672A\u914D\u7F6E`);
        const songIdVal = (_b2 = (_a2 = songInfo == null ? void 0 : songInfo.hash) != null ? _a2 : songInfo == null ? void 0 : songInfo.songmid) != null ? _b2 : songId;
        if (!songIdVal) throw new Error(`${ERROR_CODES.PARAM_ERROR}: Huibq\u7F3A\u5C11ID`);
        const selectedQuality = String(quality || "128k").toLowerCase();
        const url = `${HUIBQ_API}/url/${platform}/${encodeURIComponent(songIdVal)}/${encodeURIComponent(selectedQuality)}`;
        const res = await httpRequestWithRetry(url, {
          method: "GET",
          headers: { "Content-Type": "application/json", "User-Agent": getMobileUserAgent(), "X-Request-Key": HUIBQ_REQUEST_KEY },
          timeout: cfg("coldStartTimeoutMs", 8e3),
          // v8.8：冷启动源放宽单源超时（默认8s）
          cancelToken
        });
        const body = res.body;
        if (!body || typeof body !== "object" || Number.isNaN(Number(body.code))) throw new Error(`${ERROR_CODES.SERVER_ERROR}: Huibq\u8FD4\u56DE\u65E0\u6548`);
        if (Number(body.code) !== 0 || !body.url) throw new Error(body.msg || `${ERROR_CODES.NOT_FOUND}: Huibq\u672A\u8FD4\u56DEURL`);
        if (isHuibqFailMsg(body.msg)) {
          throw new Error(`${ERROR_CODES.NOT_FOUND}: Huibq\u672A\u53D6\u5230\u8BE5\u5E73\u53F0\u94FE\u63A5(${String(body.msg || "").slice(0, 40)})`);
        }
        return body.url;
      }
      async function suyinQQGetUrl(songInfo, quality, cancelToken = null) {
        const qqId = getQQSongId(songInfo);
        if (!qqId) throw new Error(`${ERROR_CODES.PARAM_ERROR}: \u6EAF\u97F3QQ\u7F3A\u5C11songmid/id`);
        const normalizedQuality = qualityToSuyinQQ(quality);
        const startBr = QUALITY_TO_X.suyinQQ[normalizedQuality] || QUALITY_TO_X.suyinQQ["128k"];
        const brList = [startBr, 4, 5, 7].filter((val, idx, arr) => arr.indexOf(val) === idx && val >= startBr).sort((a, b) => a - b);
        let lastError = null;
        for (const br of brList) {
          try {
            const reqParams = { key: SUYIN_QQ_KEY, type: "json", br, n: 1 };
            if (qqId.type === "mid") reqParams.mid = qqId.value;
            else reqParams.songid = qqId.value;
            const res = await httpGet(SUYIN_QQ_API, reqParams, "parse", null, RETRY_TIMES, cancelToken);
            if (res == null ? void 0 : res.music) return res.music;
            if (res == null ? void 0 : res.url) return res.url;
            if (res == null ? void 0 : res.message) {
              const match = String(res.message).match(/音频链接[：:](.+?)(?:\n|$)/);
              if (match && match[1]) return match[1].trim();
            }
            throw new Error(`${ERROR_CODES.NOT_FOUND}: \u6EAF\u97F3QQ\u672A\u627E\u5230\u97F3\u9891\u94FE\u63A5`);
          } catch (e) {
            lastError = e;
          }
        }
        throw lastError || new Error(`${ERROR_CODES.NOT_FOUND}: \u6EAF\u97F3QQ\u5168\u90E8\u97F3\u8D28\u5C1D\u8BD5\u5931\u8D25`);
      }
      async function suyin163GetUrl(songInfo, cancelToken = null) {
        const id = (songInfo == null ? void 0 : songInfo.songmid) || (songInfo == null ? void 0 : songInfo.id);
        if (!id) throw new Error(`${ERROR_CODES.PARAM_ERROR}: \u6EAF\u97F3163\u7F3A\u5C11songmid/id`);
        const res = await httpGet(SUYIN_163_API, { id }, "parse", null, RETRY_TIMES, cancelToken);
        if ((res == null ? void 0 : res.code) === 0 && (res == null ? void 0 : res.data)) {
          const item = Array.isArray(res.data) ? res.data[0] : res.data;
          if (item == null ? void 0 : item.url) return item.url;
        }
        throw new Error(`${ERROR_CODES.NOT_FOUND}: \u6EAF\u97F3163\u83B7\u53D6\u5931\u8D25`);
      }
      async function suyinKuwoSearch(keyword, br, songInfo = null, cancelToken = null) {
        var _a2;
        const res = await httpGet(SUYIN_KUWO_API, { msg: keyword, n: 1, br }, "parse", null, RETRY_TIMES, cancelToken);
        if ((_a2 = res == null ? void 0 : res.data) == null ? void 0 : _a2.url) {
          if (songInfo && !songInfoMatch(res, songInfo)) throw new Error(`${ERROR_CODES.MISMATCH}: \u6EAF\u97F3\u9177\u6211\u6B4C\u66F2\u4FE1\u606F\u4E0D\u5339\u914D`);
          return res.data.url;
        }
        if (res == null ? void 0 : res.message) {
          const match = String(res.message).match(/音乐链接[：:](\S+)/);
          if (match && match[1]) {
            if (songInfo) {
              const parsed = parseMessageSongInfo(res.message);
              if (parsed && !songInfoMatch(parsed, songInfo)) throw new Error(`${ERROR_CODES.MISMATCH}: \u6EAF\u97F3\u9177\u6211\u6B4C\u66F2\u4FE1\u606F\u4E0D\u5339\u914D`);
              if (parsed && parsed.duration && !songInfo.duration) songInfo.duration = parsed.duration;
            }
            return match[1];
          }
        }
        throw new Error(`${ERROR_CODES.NOT_FOUND}: \u6EAF\u97F3\u9177\u6211\u672A\u627E\u5230\u94FE\u63A5`);
      }
      async function suyinKuwoGetUrl(songInfo, quality, cancelToken = null) {
        if (!(songInfo == null ? void 0 : songInfo.name)) throw new Error(`${ERROR_CODES.PARAM_ERROR}: \u6EAF\u97F3\u9177\u6211\u9700\u8981\u6B4C\u66F2\u540D`);
        const cacheKey = buildCacheKey("kw", songInfo, quality);
        const cached = getCachedUrl(cacheKey);
        if (cached && cached.url) return cached.url;
        const br = QUALITY_TO_X.kuwo[String(quality || "128k").toLowerCase()] || 1;
        const keywords = buildSearchKeywords(songInfo);
        let lastError = null;
        for (const item of keywords) {
          try {
            const url = await suyinKuwoSearch(item.keyword, br, item.strict ? songInfo : { name: songInfo.name, duration: songInfo.duration }, cancelToken);
            if (url) {
              const httpsUrl = assertDeliverableUrl(upgradeToHttps(url), "\u6EAF\u97F3\u9177\u6211");
              if (!await isAudioPlayable(httpsUrl, 2500, cancelToken)) {
                const suyinExpiredErr = new Error(`${ERROR_CODES.LINK_EXPIRED}: \u6EAF\u97F3\u9177\u6211\u7B7E\u540DURL\u5DF2\u8FC7\u671F(CDN 410)\uFF0C\u4E0D\u53EF\u64AD`);
                suyinExpiredErr.code = ERROR_CODES.LINK_EXPIRED;
                throw suyinExpiredErr;
              }
              if (!item.strict) {
                logInfo(`[\u515C\u5E95\u6863] \u6B4C\u624B\u672A\u6821\u9A8C\uFF08\u4EC5\u6B4C\u540D+\u65F6\u957F\uFF09: ${(songInfo == null ? void 0 : songInfo.name) || ""} \u2190 \u5173\u952E\u8BCD\u300C${item.keyword}\u300D`);
              }
              return httpsUrl;
            }
          } catch (e) {
            lastError = e;
          }
        }
        throw lastError || new Error(`${ERROR_CODES.NOT_FOUND}: \u6EAF\u97F3\u9177\u6211\u5931\u8D25`);
      }
      async function suyinMiguGetUrl(songInfo, cancelToken = null) {
        var _a2;
        if (!(songInfo == null ? void 0 : songInfo.name)) throw new Error(`${ERROR_CODES.PARAM_ERROR}: \u6EAF\u97F3\u54AA\u5495\u9700\u8981\u6B4C\u66F2\u540D`);
        const cacheKey = buildCacheKey("mg", songInfo);
        const cached = getCachedUrl(cacheKey);
        if (cached && cached.url) return cached.url;
        const keywords = buildSearchKeywords(songInfo);
        let lastError = null;
        for (const item of keywords) {
          try {
            const res = await httpGet(SUYIN_MIGU_API, { gm: item.keyword, n: 1, num: 1, type: "json" }, "parse", null, RETRY_TIMES, cancelToken);
            if ((res == null ? void 0 : res.code) === 200 && (res == null ? void 0 : res.musicInfo)) {
              if (!songInfoMatch(res, item.strict ? songInfo : { name: songInfo.name, duration: songInfo.duration })) throw new Error(`${ERROR_CODES.MISMATCH}: \u6EAF\u97F3\u54AA\u5495\u6B4C\u66F2\u4FE1\u606F\u4E0D\u5339\u914D`);
              const miguUrl = typeof res.musicInfo === "string" ? res.musicInfo : typeof ((_a2 = res.musicInfo) == null ? void 0 : _a2.url) === "string" ? res.musicInfo.url : null;
              if (!miguUrl || !HTTP_URL_REGEX.test(miguUrl)) throw new Error(`${ERROR_CODES.SERVER_ERROR}: \u6EAF\u97F3\u54AA\u5495\u672A\u8FD4\u56DE\u53EF\u7528\u7684\u97F3\u9891\u76F4\u94FE(\u5B57\u6BB5\u7ED3\u6784\u5F85\u4E0A\u6E38\u6062\u590D\u540E\u9A8C\u8BC1)`);
              return miguUrl;
            }
          } catch (e) {
            lastError = e;
          }
        }
        throw lastError || new Error(`${ERROR_CODES.NOT_FOUND}: \u6EAF\u97F3\u54AA\u5495\u5931\u8D25`);
      }
      async function suyinGetUrl(platform, songId, quality, songInfo, cancelToken = null) {
        switch (platform) {
          case "tx":
            return suyinQQGetUrl(songInfo, quality, cancelToken);
          case "wy":
            return suyin163GetUrl(songInfo, cancelToken);
          case "kw":
            return suyinKuwoGetUrl(songInfo, quality, cancelToken);
          case "mg":
            return suyinMiguGetUrl(songInfo, cancelToken);
          default:
            throw new Error(`${ERROR_CODES.PARAM_ERROR}: \u6EAF\u97F3\u4E0D\u652F\u6301\u8BE5\u5E73\u53F0`);
        }
      }
      function createTemplateVipSource(templateUrl, rejectRe, sourceName) {
        return async function templateVipGetUrl(platform, songId, quality, songInfo, cancelToken = null) {
          if (platform !== "kw") throw new Error(`${ERROR_CODES.PARAM_ERROR}: ${sourceName}\u4ECA\u65E5\u4EC5kw\u6062\u590D(\u5176\u4F59\u5E73\u53F0\u4ECD403/401/404)`);
          const id = getPlatformSongId(platform, songInfo);
          if (!id) throw new Error(`${ERROR_CODES.PARAM_ERROR}: ${sourceName}\u7F3A\u5C11kw rid`);
          const target = templateUrl.replace("{id}", encodeURIComponent(String(id))).replace("{level}", encodeURIComponent("standard"));
          const res = await httpRequestWithRetry(target, {
            method: "GET",
            headers: { "User-Agent": getMobileUserAgent(), "Range": "bytes=0-1023" },
            timeout: TIMEOUT_CONFIG.parse,
            follow_max: 5,
            cancelToken
          });
          const finalUrl = res.url || target;
          if (!HTTP_URL_REGEX.test(finalUrl) || rejectRe.test(finalUrl)) {
            throw new Error(`${ERROR_CODES.NOT_FOUND}: ${sourceName}\u672A\u8DDF\u968F\u5230\u97F3\u9891\u76F4\u94FE`);
          }
          return upgradeToHttps(finalUrl);
        };
      }
      async function juheGetUrl(platform, songId, quality, songInfo, cancelToken = null) {
        var _a2, _b2, _c2, _d2, _e2, _f2, _g2, _h2;
        const juheQ = String(quality || "128k").toLowerCase();
        const mid = (songInfo == null ? void 0 : songInfo.songmid) || (songInfo == null ? void 0 : songInfo.id) || songId || "";
        const idFields = platform === "kg" ? { hash: (songInfo == null ? void 0 : songInfo.hash) || mid, songmid: mid, id: mid } : platform === "wy" ? { id: mid, songmid: mid } : { songmid: mid, id: mid };
        const extraFields = {};
        for (const f of ["strMediaMid", "mediaMid", "hash", "rid", "copyrightId", "musicId", "albumAudioId", "albumId", "albumMid", "songid", "songId"]) {
          const v = songInfo == null ? void 0 : songInfo[f];
          if (v !== void 0 && v !== null && v !== "") extraFields[f] = v;
        }
        for (const f of ["strMediaMid", "mediaMid", "hash", "rid", "copyrightId", "name", "singer", "album"]) {
          const v = (_a2 = songInfo == null ? void 0 : songInfo.meta) == null ? void 0 : _a2[f];
          if (v !== void 0 && v !== null && v !== "" && extraFields[f] === void 0) extraFields[f] = v;
        }
        const info = {
          type: juheQ,
          musicInfo: __spreadProps(__spreadValues(__spreadProps(__spreadValues({}, extraFields), {
            name: (songInfo == null ? void 0 : songInfo.name) || "",
            singer: (songInfo == null ? void 0 : songInfo.singer) || "",
            album: (songInfo == null ? void 0 : songInfo.album) || "",
            duration: (songInfo == null ? void 0 : songInfo.duration) || 0,
            interval: Math.round(((songInfo == null ? void 0 : songInfo.duration) || 0) / 1e3),
            source: platform === "kw" ? "kw" : String(platform || "kw")
          }), idFields), {
            quality: juheQ
          })
        };
        const res = await httpRequestWithRetry(`${JUHE_API}/${platform}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "User-Agent": getMobileUserAgent() },
          body: JSON.stringify(info),
          timeout: 15e3,
          cancelToken
        }, 1);
        const d = res.body;
        const dCode = d && d.code !== void 0 && d.code !== null ? String(d.code) : "";
        if (dCode === "200" && typeof ((_b2 = d.data) == null ? void 0 : _b2.url) === "string") return upgradeToHttps(d.data.url);
        if (dCode === "303" && ((_c2 = d.data) == null ? void 0 : _c2.request)) {
          const r = d.data.request;
          const resp = await httpRequest(r.url, {
            method: String(((_d2 = r.options) == null ? void 0 : _d2.method) || "GET").toUpperCase(),
            headers: ((_e2 = r.options) == null ? void 0 : _e2.headers) || {},
            timeout: 1e4,
            cancelToken
          });
          const check = (_f2 = d.data.response) == null ? void 0 : _f2.check;
          if (check && ((_g2 = check.key) == null ? void 0 : _g2.length)) {
            const got = check.key.reduce((acc, k) => acc && typeof acc === "object" ? acc[k] : void 0, resp);
            if (got === void 0 || got === null || String(got) !== String(check.value)) throw new Error(`${ERROR_CODES.NOT_FOUND}: Juhe\u91CD\u5B9A\u5411\u6821\u9A8C\u5931\u8D25`);
          }
          const u = (((_h2 = d.data.response) == null ? void 0 : _h2.url) || []).reduce((acc, k) => acc && typeof acc === "object" ? acc[k] : void 0, resp);
          if (typeof u === "string" && /^https?:/.test(u)) return upgradeToHttps(u);
          throw new Error(`${ERROR_CODES.NOT_FOUND}: Juhe\u91CD\u5B9A\u5411\u672A\u53D6\u5230\u76F4\u94FE`);
        }
        throw new Error(`${ERROR_CODES.NOT_FOUND}: Juhe\u54CD\u5E94\u5F02\u5E38(${(d == null ? void 0 : d.msg) || "\u672A\u77E5"})`);
      }
      var changqingGetUrl = createTemplateVipSource(CHANGQING_URL_TEMPLATES.kw, /kw\.php/, "\u957F\u9752");
      function getPlatformSongId(platform, songInfo) {
        if (platform === "kg") return (songInfo == null ? void 0 : songInfo.hash) || (songInfo == null ? void 0 : songInfo.songmid) || (songInfo == null ? void 0 : songInfo.id) || (songInfo == null ? void 0 : songInfo.rid) || (songInfo == null ? void 0 : songInfo.mid) || null;
        if (platform === "tx") {
          const qqId = getQQSongId(songInfo);
          if (qqId == null ? void 0 : qqId.value) return qqId.value;
        }
        return (songInfo == null ? void 0 : songInfo.songmid) || (songInfo == null ? void 0 : songInfo.id) || (songInfo == null ? void 0 : songInfo.songId) || (songInfo == null ? void 0 : songInfo.rid) || (songInfo == null ? void 0 : songInfo.hash) || null;
      }
      function getHealthSnapshot() {
        var _a2;
        const snapshot = {};
        for (const id of Object.keys(SOURCE_HANDLERS)) {
          const h = SOURCE_HANDLERS[id];
          const stats = getSourceStats(id);
          const score = computeHealthScore(id);
          const gatePlatform = (h.platforms || []).find((p) => h.chain && h.chain[p] != null) || (h.platforms || [])[0] || null;
          const gate = computeEligibility(id, gatePlatform, "128k", { runtime: false, qualityShortCircuit: false });
          snapshot[id] = {
            name: h.name,
            maxQuality: h.maxQuality,
            lifecycle: h.lifecycle,
            upstreamGroup: h.upstreamGroup,
            auth: h.auth,
            reviewAt: h.reviewAt,
            platforms: h.platforms,
            enabled: runtimeToggles[id] !== false,
            // v8.14：开关权威拆分。App 必须能区分“用户关闭 / 系统自动关闭 / 休眠 / 默认关闭”，
            // 不能再只拿 enabled=false 猜原因。
            userEnabled: isUserEnabled(id),
            autoOff: !!autoOff[id],
            offReason: manualOff[id] ? "USER_OFF" : !isUserEnabled(id) && SOURCE_TOGGLES[id] === false ? "DEFAULT_OFF" : autoOff[id] ? "AUTO_OFF_PROBE" : probeState.sleeping[id] ? "SLEEPING" : isPlayDead(id) ? "PLAY_DEAD" : null,
            // 方案 6.2 I1：allowed/reason/code/until 与 computeEligibility 同源，只读不写状态。
            eligible: gate.eligible,
            eligibilityReason: gate.reason,
            eligibilityCode: gate.code,
            eligibilityUntilMs: gate.untilMs,
            autoOffReason: autoOffReason[id] || null,
            autoOffAt: autoOffAt[id] || 0,
            probeTargets: probeState.lastTargets && probeState.lastTargets[id] || [],
            successRate: stats.successRate,
            avgTime: stats.avgTime,
            state: stats.state,
            // v6.0：真实播放请求最后使用时间戳（App 五级分区'使用中'判定；0=从未用过）
            lastUsedAt: lastUsedAt.get(id) || 0,
            // v4.0：样本计数（App 显示采样数；无样本的 successRate/avgTime 为 null → 显示"-"）
            reqCount: stats.reqCount,
            probeCount: stats.probeCount,
            // v4.0：休眠状态（连续失败轮休眠，每 PROBE_WAKE_EVERY_ROUND 轮复活试探；App 显示"休眠中"）
            sleeping: !!probeState.sleeping[id],
            // v4.0：版权/业务失败计数（无版权歌等；App 面板可在后续版本展示）
            copyrightFail: stats.copyrightFail,
            // v4.0：按音质分档统计（面板后续版本可消费）
            byQuality: stats.byQuality,
            // v8.14（F43）：质量档短路必须可见，不再只存在于链构建内部判断
            qualityShortCircuit: Object.fromEntries(["128k", "320k", "flac", "flac24bit"].map((q) => [q, isQualityHopeless(id, q)])),
            // v7.0：播放实时摘除状态（连续播放失败被摘除；App 可显示"已摘除"）
            playDead: isPlayDead(id),
            resolveDead: isResolveDead(id),
            // v4.0：限流状态（被限=连续429，App 显示"被限"而非"熔断"）
            rateLimited: !!getBreaker(id).rateLimited,
            rateLimitCount: getBreaker(id).rateLimitCount || 0,
            // 第五轮审计：面板"限流中"必须能亮。rateLimited（连续 3 次被上游真拒）在串行使用中不可达——
            // 第一次 429 就把 rateLimitUntil 推后 30s，后续请求被 canExecute 本地拦下、不构成新证据。
            // 所以另给"当前是否处于退避期"的派生值供面板用，与"已被风控"这个强标记分开：
            // rateLimitActive=true 表示"现在这个源不参与竞速"，rateLimited=true 表示"历史上被拒多次"。
            rateLimitUntil: getBreaker(id).rateLimitUntil || 0,
            rateLimitActive: (getBreaker(id).rateLimitUntil || 0) > Date.now(),
            // v6.0：最近成功交付音质（音质协商链降档后诊断用）
            lastQuality: getBreaker(id).lastQuality || null,
            // v7.0：健康分输出改 10 分制（0~10，一位小数）——内部评分仍为 0~1（排序/熔断逻辑不变），
            // 仅快照输出 ×10 换算，配合 App 健康面板直观显示；负分保留（异常源 App 标红）
            healthScore: Number((score.score * 10).toFixed(1))
          };
        }
        const PLATFORM_GROUPS = {};
        const eligibleByPlatform = {};
        for (const p of Object.keys(PLATFORM_QUALITIES)) {
          const all = /* @__PURE__ */ new Set();
          const eligible = /* @__PURE__ */ new Set();
          for (const q of ["128k", "320k", "flac", "flac24bit"]) {
            for (const h of buildSourceChain(p, q)) eligible.add(h.id);
          }
          for (const id of Object.keys(SOURCE_HANDLERS)) if (SOURCE_HANDLERS[id] && (SOURCE_HANDLERS[id].platforms || []).includes(p)) all.add(id);
          PLATFORM_GROUPS[p] = [...all];
          eligibleByPlatform[p] = eligible;
        }
        const platformSummary = {};
        const healthyPlatforms = [];
        for (const [platform, sourceIds] of Object.entries(PLATFORM_GROUPS)) {
          const enabledSources = sourceIds.filter((id) => snapshot[id] && snapshot[id].enabled);
          if (!enabledSources.length) {
            platformSummary[platform] = { degraded: false, reason: "no_active_sources", activeCount: 0, eligibleCount: 0, deadCount: 0 };
            continue;
          }
          const eligible = eligibleByPlatform[platform] || /* @__PURE__ */ new Set();
          const eligibleSources = enabledSources.filter((id) => eligible.has(id));
          const deadCount = enabledSources.length - eligibleSources.length;
          const allDead = eligibleSources.length === 0;
          const avgScore = eligibleSources.length ? eligibleSources.reduce((sum, id) => sum + (snapshot[id].healthScore || 0), 0) / eligibleSources.length : 0;
          platformSummary[platform] = {
            degraded: allDead,
            reason: allDead ? "no_eligible_sources" : null,
            activeCount: eligibleSources.length,
            eligibleCount: eligibleSources.length,
            deadCount,
            avgScore: Math.round(avgScore * 10) / 10
          };
          if (!allDead) healthyPlatforms.push({ platform, avgScore });
        }
        snapshot._coverageGaps = KNOWN_COVERAGE_GAPS.map((g) => Object.assign({}, g));
        snapshot._platformRisk = {};
        for (const g of KNOWN_COVERAGE_GAPS) {
          snapshot._platformRisk[g.platform] = { risk: g.risk, reason: g.reason, reviewAt: g.reviewAt || null };
        }
        snapshot._platformSummary = platformSummary;
        healthyPlatforms.sort((a, b) => b.avgScore - a.avgScore);
        snapshot._fallbackPlatform = ((_a2 = healthyPlatforms[0]) == null ? void 0 : _a2.platform) || null;
        snapshot._memory = {
          successCache: successCache.size(),
          failCache: failCache.size(),
          deliveryQuality: deliveryQualityMap.size,
          fragmentSource: fragmentSourceMap.size,
          qualityCeiling: qualityCeilingMap.size,
          fragmentUrl: fragmentUrlMap.size,
          handlerSongs: [...fragmentHandlerSongsMap.values()].reduce((n, e) => n + (e && e.mids ? e.mids.size : 0), 0),
          limit: Math.max(1, Number(cfg("memoryMapMax", MEMORY_MAP_MAX)) || MEMORY_MAP_MAX)
        };
        return snapshot;
      }
      var HEALTH_STATE_VERSION = 2;
      var HEALTH_STATE_ACCEPTED_VERSIONS = [1, 2];
      var HEALTH_STATE_SOURCE_VERSION = "8.13.0";
      var HEALTH_STATE_MAX_BYTES = 256 * 1024;
      var HEALTH_STATE_TTL_MS = 7 * 24 * 3600 * 1e3;
      var HEALTH_STATE_FUTURE_TOLERANCE_MS = 3600 * 1e3;
      var HEALTH_BREAKER_NUMBER_FIELDS = [
        "failureCount",
        "lastFailureTime",
        "totalRequests",
        "totalSuccess",
        "totalTime",
        "probeRequests",
        "probeSuccess",
        "probeTime",
        "copyrightFail",
        "rateLimitCount",
        "rateLimitUntil"
      ];
      var HEALTH_BREAKER_BOOL_FIELDS = ["rateLimited"];
      var HEALTH_QUALITY_NUMBER_FIELDS = ["req", "success", "time", "fail", "businessFail", "linkExpired"];
      var HEALTH_STATES = ["closed", "open", "half-open"];
      var HEALTH_QUALITIES = ["128k", "320k", "flac", "flac24bit"];
      var HEALTH_FORBIDDEN_KEYS = /^(url|successurl|failcache|successcache|cache|songinfo|musicinfo|name|singer|account|cookie|token|headers|body)$/i;
      function isHealthPlainObject(v) {
        return !!v && typeof v === "object" && !Array.isArray(v);
      }
      function checkHealthForbiddenKeys(value, path) {
        if (!isHealthPlainObject(value)) return null;
        for (const key of Object.keys(value)) {
          if (HEALTH_FORBIDDEN_KEYS.test(key)) return `${path}.${key}`;
          const nested = checkHealthForbiddenKeys(value[key], `${path}.${key}`);
          if (nested) return nested;
        }
        return null;
      }
      function healthNumber(value, allowZero) {
        return typeof value === "number" && Number.isFinite(value) && (allowZero ? value >= 0 : value > 0);
      }
      function collectHealthControls() {
        const controls = {};
        for (const id of Object.keys(SOURCE_HANDLERS)) {
          controls[id] = {
            enabled: isUserEnabled(id),
            manualOff: !!manualOff[id],
            autoOff: !!autoOff[id],
            autoOffAt: Number(autoOffAt[id] || 0),
            autoOffReason: autoOffReason[id] || null
          };
        }
        return controls;
      }
      function applyHealthControls(controls) {
        for (const [id, c] of Object.entries(controls)) {
          userEnabled[id] = c.enabled;
          if (c.manualOff) manualOff[id] = true;
          else delete manualOff[id];
          const autoAge = Date.now() - (c.autoOffAt || 0);
          if (c.autoOff && (!c.autoOffAt || autoAge <= 6 * 60 * 60 * 1e3)) {
            autoOff[id] = true;
            autoOffAt[id] = c.autoOffAt || Date.now();
            autoOffReason[id] = c.autoOffReason || "AUTO_OFF_PROBE";
          } else {
            delete autoOff[id];
            delete autoOffAt[id];
            delete autoOffReason[id];
          }
          syncRuntimeToggle(id);
        }
      }
      function exportHealthState() {
        const sources = {};
        for (const id of Object.keys(SOURCE_HANDLERS)) {
          const b = getBreaker(id);
          const byQuality = {};
          for (const [quality, q] of Object.entries(b.byQuality || {})) {
            if (!HEALTH_QUALITIES.includes(quality)) continue;
            byQuality[quality] = {};
            for (const field of HEALTH_QUALITY_NUMBER_FIELDS) byQuality[quality][field] = Number(q[field] || 0);
          }
          sources[id] = {
            breaker: {
              state: HEALTH_STATES.includes(b.state) ? b.state : "closed",
              failureCount: Number(b.failureCount || 0),
              lastFailureTime: Number(b.lastFailureTime || 0),
              totalRequests: Number(b.totalRequests || 0),
              totalSuccess: Number(b.totalSuccess || 0),
              totalTime: Number(b.totalTime || 0),
              probeRequests: Number(b.probeRequests || 0),
              probeSuccess: Number(b.probeSuccess || 0),
              probeTime: Number(b.probeTime || 0),
              copyrightFail: Number(b.copyrightFail || 0),
              rateLimitCount: Number(b.rateLimitCount || 0),
              rateLimitUntil: Number(b.rateLimitUntil || 0),
              rateLimited: !!b.rateLimited,
              lastQuality: HEALTH_QUALITIES.includes(String(b.lastQuality || "").toLowerCase()) ? String(b.lastQuality).toLowerCase() : null
            },
            byQuality,
            playDead: {
              streak: Number(playDeadStreak.get(id) || 0),
              deadline: Number(playDeadDeadline.get(id) || 0)
            }
          };
        }
        const qualityShortCircuit = {};
        for (const [key, at] of qualitySkipProbeAt) {
          const [id, quality] = String(key).split(":");
          if (!SOURCE_HANDLERS[id] || !HEALTH_QUALITIES.includes(quality)) continue;
          const n = Number(at);
          if (Number.isFinite(n) && n > 0) qualityShortCircuit[`${id}:${quality}`] = n;
        }
        const controls = collectHealthControls();
        const version2 = cfg("healthV2Enabled", true) ? HEALTH_STATE_VERSION : 1;
        return { v: version2, sourceVersion: HEALTH_STATE_SOURCE_VERSION, savedAt: Date.now(), sources, qualityShortCircuit, controls };
      }
      function restoreHealthState(state) {
        try {
          if (!isHealthPlainObject(state)) return { ok: false, reason: "state \u5FC5\u987B\u662F\u5BF9\u8C61" };
          if (!HEALTH_STATE_ACCEPTED_VERSIONS.includes(state.v)) return { ok: false, reason: "schema version \u4E0D\u7B26" };
          if (!healthNumber(state.savedAt, true)) return { ok: false, reason: "savedAt \u975E\u6CD5" };
          const age = Date.now() - state.savedAt;
          if (age < -HEALTH_STATE_FUTURE_TOLERANCE_MS || age > HEALTH_STATE_TTL_MS) return { ok: false, reason: "savedAt \u8D85\u51FA TTL" };
          if (JSON.stringify(state).length > HEALTH_STATE_MAX_BYTES) return { ok: false, reason: "state \u8D85\u8FC7 256KB" };
          const forbidden = checkHealthForbiddenKeys(state, "state");
          if (forbidden) return { ok: false, reason: `\u7981\u6B62\u5B57\u6BB5 ${forbidden}` };
          const controlsRaw = state.controls === void 0 ? {} : state.controls;
          if (!isHealthPlainObject(controlsRaw)) return { ok: false, reason: "controls \u975E\u6CD5" };
          const controlsOnly = (!isHealthPlainObject(state.sources) || Object.keys(state.sources).length === 0) && Object.keys(controlsRaw).length > 0;
          if (!controlsOnly && state.sourceVersion !== HEALTH_STATE_SOURCE_VERSION) return { ok: false, reason: "sourceVersion \u4E0D\u7B26" };
          if (!isHealthPlainObject(state.sources)) {
            if (!controlsOnly) return { ok: false, reason: "sources \u5FC5\u987B\u662F\u5BF9\u8C61" };
          }
          const ids = isHealthPlainObject(state.sources) ? Object.keys(state.sources) : [];
          if (!controlsOnly && !ids.length) return { ok: false, reason: "sources \u4E3A\u7A7A" };
          const sanitized = {};
          for (const id of ids) {
            if (!SOURCE_HANDLERS[id]) return { ok: false, reason: `\u672A\u77E5\u6E90 ${id}` };
            const item = state.sources[id];
            if (!isHealthPlainObject(item) || !isHealthPlainObject(item.breaker)) return { ok: false, reason: `${id}.breaker \u975E\u6CD5` };
            const b = item.breaker;
            if (!HEALTH_STATES.includes(b.state)) return { ok: false, reason: `${id}.state \u975E\u6CD5` };
            for (const field of HEALTH_BREAKER_NUMBER_FIELDS) {
              if (!healthNumber(b[field], true)) return { ok: false, reason: `${id}.${field} \u975E\u6CD5` };
            }
            for (const field of HEALTH_BREAKER_BOOL_FIELDS) {
              if (typeof b[field] !== "boolean") return { ok: false, reason: `${id}.${field} \u975E\u6CD5` };
            }
            if (b.lastQuality !== null && !HEALTH_QUALITIES.includes(String(b.lastQuality).toLowerCase())) {
              return { ok: false, reason: `${id}.lastQuality \u975E\u6CD5` };
            }
            if (!isHealthPlainObject(item.byQuality)) return { ok: false, reason: `${id}.byQuality \u975E\u6CD5` };
            const byQuality = {};
            for (const [quality, q] of Object.entries(item.byQuality)) {
              if (!HEALTH_QUALITIES.includes(quality)) return { ok: false, reason: `${id}.byQuality.${quality} \u975E\u6CD5` };
              if (!isHealthPlainObject(q)) return { ok: false, reason: `${id}.byQuality.${quality} \u975E\u6CD5` };
              byQuality[quality] = {};
              for (const field of HEALTH_QUALITY_NUMBER_FIELDS) {
                if (!healthNumber(q[field], true)) return { ok: false, reason: `${id}.${quality}.${field} \u975E\u6CD5` };
                byQuality[quality][field] = q[field];
              }
            }
            const pd = item.playDead || {};
            if (!isHealthPlainObject(pd)) return { ok: false, reason: `${id}.playDead \u975E\u6CD5` };
            if (!healthNumber(pd.streak || 0, true) || !healthNumber(pd.deadline || 0, true)) return { ok: false, reason: `${id}.playDead \u975E\u6CD5` };
            sanitized[id] = {
              breaker: {
                state: b.state,
                failureCount: b.failureCount,
                lastFailureTime: b.lastFailureTime,
                totalRequests: b.totalRequests,
                totalSuccess: b.totalSuccess,
                totalTime: b.totalTime,
                probeRequests: b.probeRequests,
                probeSuccess: b.probeSuccess,
                probeTime: b.probeTime,
                copyrightFail: b.copyrightFail,
                rateLimitCount: b.rateLimitCount,
                rateLimitUntil: b.rateLimitUntil,
                rateLimited: b.rateLimited,
                lastQuality: b.lastQuality === null ? null : String(b.lastQuality).toLowerCase()
              },
              byQuality,
              playDead: { streak: Number(pd.streak || 0), deadline: Number(pd.deadline || 0) }
            };
          }
          const qsc = state.qualityShortCircuit === void 0 ? {} : state.qualityShortCircuit;
          if (!isHealthPlainObject(qsc)) return { ok: false, reason: "qualityShortCircuit \u975E\u6CD5" };
          const qualityShortCircuit = {};
          for (const [key, at] of Object.entries(qsc)) {
            const [id, quality] = String(key).split(":");
            if (!SOURCE_HANDLERS[id] || !HEALTH_QUALITIES.includes(quality)) return { ok: false, reason: `qualityShortCircuit.${key} \u975E\u6CD5` };
            if (!healthNumber(at, false)) return { ok: false, reason: `qualityShortCircuit.${key} \u975E\u6CD5` };
            qualityShortCircuit[`${id}:${quality}`] = at;
          }
          const controls = {};
          for (const [id, c] of Object.entries(controlsRaw)) {
            if (!SOURCE_HANDLERS[id]) return { ok: false, reason: `controls.${id} \u672A\u77E5\u6E90` };
            if (!isHealthPlainObject(c)) return { ok: false, reason: `controls.${id} \u975E\u6CD5` };
            if (typeof c.enabled !== "boolean") return { ok: false, reason: `controls.${id}.enabled \u975E\u6CD5` };
            if (c.manualOff !== void 0 && typeof c.manualOff !== "boolean") return { ok: false, reason: `controls.${id}.manualOff \u975E\u6CD5` };
            if (c.autoOff !== void 0 && typeof c.autoOff !== "boolean") return { ok: false, reason: `controls.${id}.autoOff \u975E\u6CD5` };
            if (c.autoOffAt !== void 0 && !healthNumber(c.autoOffAt, true)) return { ok: false, reason: `controls.${id}.autoOffAt \u975E\u6CD5` };
            controls[id] = {
              enabled: c.enabled,
              manualOff: !!c.manualOff,
              autoOff: !!c.autoOff,
              autoOffAt: Number(c.autoOffAt || 0),
              autoOffReason: typeof c.autoOffReason === "string" ? c.autoOffReason.slice(0, 40) : null
            };
          }
          let restored = 0;
          for (const [id, item] of Object.entries(sanitized)) {
            const b = getBreaker(id);
            Object.assign(b, item.breaker);
            b.byQuality = item.byQuality;
            if (item.playDead.streak > 0) playDeadStreak.set(id, item.playDead.streak);
            else playDeadStreak.delete(id);
            if (item.playDead.deadline > 0) playDeadDeadline.set(id, item.playDead.deadline);
            else playDeadDeadline.delete(id);
            restored++;
          }
          applyHealthControls(controls);
          qualitySkipProbeAt.clear();
          for (const [key, at] of Object.entries(qualityShortCircuit)) qualitySkipProbeAt.set(key, at);
          return { ok: true, restored, controlsRestored: Object.keys(controls).length };
        } catch (e) {
          return { ok: false, reason: e && e.message ? e.message : String(e) };
        }
      }
      var PROVIDER_LIFECYCLE = Object.freeze({ ACTIVE: "active", PROBATION: "probation" });
      var PROVIDER_AUTH = Object.freeze({ NONE: "none", OPTIONAL: "optional" });
      var PROVIDER_QUALITY_ORDER = ["128k", "320k", "flac", "flac24bit"];
      function providerQualitys(maxQuality) {
        const rank = PROVIDER_QUALITY_ORDER.indexOf(String(maxQuality || "128k").toLowerCase());
        const cap = rank < 0 ? 0 : rank;
        return PROVIDER_QUALITY_ORDER.slice(0, cap + 1);
      }
      function provider(id, name, fn, maxQuality, opts = {}) {
        const platforms = opts.platforms || ["kw", "wy", "tx", "mg", "kg"];
        const lifecycle = opts.lifecycle || PROVIDER_LIFECYCLE.ACTIVE;
        return {
          id,
          name,
          fn,
          maxQuality,
          qualitys: providerQualitys(maxQuality),
          platforms,
          timeoutMs: opts.timeoutMs || 5e3,
          anchors: opts.anchors || ["songmid", "id"],
          chain: lifecycle === PROVIDER_LIFECYCLE.ACTIVE ? Object.freeze(Object.assign({}, opts.chain || {})) : Object.freeze({}),
          upstreamGroup: opts.upstreamGroup || id,
          auth: opts.auth || PROVIDER_AUTH.NONE,
          lifecycle,
          reviewAt: opts.reviewAt || null,
          batch: opts.batch || 1,
          verified: !!opts.verified,
          coldStart: !!opts.coldStart,
          minQuality: opts.minQuality || null,
          note: opts.note || ""
        };
      }
      var SOURCE_HANDLERS = {
        // ---- 上链源：10 个 ----
        suyinKuwo: provider("suyinKuwo", "\u6EAF\u97F3\u9177\u6211", (platform, songId, quality, songInfo, cancelToken) => suyinKuwoGetUrl(songInfo, quality, cancelToken), "flac", {
          platforms: ["kw", "wy", "tx", "mg", "kg"],
          anchors: ["rid", "songmid", "id"],
          chain: { kw: 1, wy: 6, tx: 1, mg: 1, kg: 1 },
          upstreamGroup: "oiapi-kuwo",
          verified: true,
          note: "\u4E94\u5E73\u53F0\u515C\u5E95\uFF1B128k \u4F7F\u7528 br=9\uFF08\u5B9E\u6D4B\u552F\u4E00\u53EF\u64AD\uFF09"
        }),
        wyOuter: provider("wyOuter", "\u7F51\u6613\u4E91\u5B98\u65B9", wyOuterGetUrl, "128k", {
          platforms: ["wy"],
          anchors: ["songmid", "id"],
          chain: { wy: 4 },
          upstreamGroup: "wy-official",
          note: "\u5B98\u65B9 outer \u76F4\u8FDE\uFF0C\u9ED8\u8BA4\u53EA\u505A 128k"
        }),
        kuwoOfficial: provider("kuwoOfficial", "\u9177\u6211\u5B98\u65B9\u76F4\u8FDE", kuwoOfficialGetUrl, "128k", {
          platforms: ["kw"],
          anchors: ["rid", "songmid", "id"],
          chain: { kw: 5 },
          upstreamGroup: "kuwo-official"
        }),
        suyin163: provider("suyin163", "\u6EAF\u97F3163", (platform, songId, quality, songInfo, cancelToken) => suyinGetUrl("wy", songId, quality, songInfo, cancelToken), "128k", {
          platforms: ["wy"],
          anchors: ["songmid", "id"],
          chain: { wy: 3 },
          upstreamGroup: "oiapi-163"
        }),
        xinghaiBackend: provider("xinghaiBackend", "\u661F\u6D77\u540E\u7AEF", xinghaiBackendGetUrl, "flac", {
          platforms: ["kw"],
          anchors: ["songmid", "id"],
          chain: { kw: 2 },
          upstreamGroup: "xinghai-backend"
        }),
        helloworldKw: provider("helloworldKw", "helloworld(kw)", helloworldKwGetUrl, "flac", {
          platforms: ["kw"],
          anchors: ["rid", "songmid", "id"],
          chain: { kw: 4 },
          upstreamGroup: "kuwo-convert",
          note: "kw 128k/320k/flac\uFF1B\u90E8\u5206 VIP \u6B4C\u53EF\u80FD\u53EA\u7ED9\u7247\u6BB5\uFF0C\u9A8C\u771F\u95F8\u95E8\u515C\u5E95"
        }),
        changqingVip: provider("changqingVip", "\u957F\u9752kw", changqingGetUrl, "128k", {
          platforms: ["kw"],
          anchors: ["rid", "songmid", "id"],
          chain: { kw: 6 },
          upstreamGroup: "changqing-kw"
        }),
        huibq: provider("huibq", "Huibq", huibqGetUrl, "320k", {
          platforms: ["kw", "wy"],
          anchors: ["rid", "songmid", "id"],
          chain: { kw: 8, wy: 8 },
          upstreamGroup: "huibq",
          coldStart: true,
          timeoutMs: 8e3,
          note: "onrender \u51B7\u542F\u52A8\uFF1B\u4EC5 kw/wy \u5B9E\u6D4B\u53EF\u7528"
        }),
        juheTx: provider("juheTx", "Juhe\u805A\u5408(tx)", juheGetUrl, "flac", {
          platforms: ["tx"],
          anchors: ["songmid", "musicId", "id"],
          chain: { tx: 2 },
          upstreamGroup: "juhe",
          reviewAt: "2026-11-19",
          note: "2026-11-11 \u6062\u590D\uFF1B7 \u5929\u590D\u6838\uFF0C\u4ECD\u4E3A tx \u7B2C\u4E8C\u6E90"
        }),
        ikun: provider("ikun", "ikun", ikunGetUrl, "flac", {
          platforms: ["kw", "wy"],
          anchors: ["rid", "songmid", "id"],
          chain: { kw: 7, wy: 5 },
          upstreamGroup: "ikun",
          auth: PROVIDER_AUTH.OPTIONAL,
          note: "\u516C\u76CA\u7248\u514D\u5361\u5BC6\uFF1B\u5361\u5BC6\u53EF\u9009"
        }),
        // ---- 观察源：2 个（probation，只探测、不进链） ----
        suyinQQ: provider("suyinQQ", "\u6EAF\u97F3QQ", (platform, songId, quality, songInfo, cancelToken) => suyinGetUrl("tx", songId, quality, songInfo, cancelToken), "flac", {
          platforms: ["tx"],
          anchors: ["songmid", "musicId", "id"],
          lifecycle: PROVIDER_LIFECYCLE.PROBATION,
          upstreamGroup: "oiapi-qq",
          reviewAt: "2026-11-19",
          note: "2026-11-11 \u5B9E\u6D4B HTTP 403\uFF1B\u89C2\u5BDF\u81F3 2026-11-19"
        }),
        suyinMigu: provider("suyinMigu", "\u6EAF\u97F3\u54AA\u5495", (platform, songId, quality, songInfo, cancelToken) => suyinGetUrl("mg", songId, quality, songInfo, cancelToken), "flac", {
          platforms: ["mg"],
          anchors: ["copyrightId", "id"],
          lifecycle: PROVIDER_LIFECYCLE.PROBATION,
          upstreamGroup: "xcvts-migu",
          reviewAt: "2026-11-26",
          note: "2026-11-11 \u5B9E\u6D4B\u4E0A\u6E38 502\uFF1B\u89C2\u5BDF\u81F3 2026-11-26",
          verified: true
        })
      };
      var KNOWN_COVERAGE_GAPS = Object.freeze([
        Object.freeze({ platform: "mg", reason: "\u4EC5 suyinKuwo \u5355\u6E90\uFF1BsuyinMigu \u5904\u4E8E probation \u4E0D\u8FDB\u94FE", risk: "high", reviewAt: "2026-11-26" }),
        Object.freeze({ platform: "kg", reason: "\u4EC5 suyinKuwo \u5355\u6E90\uFF1B\u65E0\u7B2C\u4E8C\u6E90", risk: "high", reviewAt: "2026-11-19" }),
        Object.freeze({ platform: "tx", reason: "suyinKuwo + juheTx \u53CC\u6E90\uFF1BjuheTx \u4E3A\u57FA\u7840\u8BBE\u65BD\u9650\u6D41\u6E90\uFF0C7 \u5929\u590D\u6838", risk: "medium", reviewAt: "2026-11-19" })
      ]);
      function validateProviderContracts() {
        const errors = [];
        const ids = Object.keys(SOURCE_HANDLERS);
        const toggleIds = Object.keys(SOURCE_TOGGLES);
        const registered = ids.length;
        const active = ids.filter((id) => SOURCE_HANDLERS[id].lifecycle === PROVIDER_LIFECYCLE.ACTIVE);
        const probation = ids.filter((id) => SOURCE_HANDLERS[id].lifecycle === PROVIDER_LIFECYCLE.PROBATION);
        if (registered !== 12) errors.push(`\u767B\u8BB0\u6E90\u5FC5\u987B\u4E3A 12\uFF0C\u5B9E\u9645 ${registered}`);
        if (active.length !== 10) errors.push(`\u4E0A\u94FE\u6E90\u5FC5\u987B\u4E3A 10\uFF0C\u5B9E\u9645 ${active.length}`);
        if (probation.length !== 2) errors.push(`\u89C2\u5BDF\u6E90\u5FC5\u987B\u4E3A 2\uFF0C\u5B9E\u9645 ${probation.length}`);
        if (toggleIds.length !== registered) errors.push(`SOURCE_TOGGLES \u5FC5\u987B\u4E0E SOURCE_HANDLERS \u7B49\u91CF\uFF0Ctoggles=${toggleIds.length}, handlers=${registered}`);
        for (const id of toggleIds) if (!SOURCE_HANDLERS[id]) errors.push(`SOURCE_TOGGLES \u5B58\u5728\u672A\u767B\u8BB0\u6E90 ${id}`);
        const upstreamGroups = /* @__PURE__ */ new Set();
        for (const id of ids) {
          const h = SOURCE_HANDLERS[id];
          if (!h || h.id !== id) {
            errors.push(`${id}: id \u4E0E\u952E\u4E0D\u4E00\u81F4`);
            continue;
          }
          if (!h.name || typeof h.name !== "string") errors.push(`${id}: \u7F3A\u5C11 name`);
          if (typeof h.fn !== "function") errors.push(`${id}: \u7F3A\u5C11 fn`);
          if (!h.qualitys.includes("128k")) errors.push(`${id}: qualitys \u5FC5\u987B\u5305\u542B 128k`);
          if (!h.qualitys.includes(h.maxQuality)) errors.push(`${id}: qualitys \u672A\u5305\u542B maxQuality=${h.maxQuality}`);
          if (!Array.isArray(h.platforms) || !h.platforms.length) errors.push(`${id}: platforms \u4E3A\u7A7A`);
          if (!h.upstreamGroup) errors.push(`${id}: upstreamGroup \u4E3A\u7A7A`);
          if (upstreamGroups.has(h.upstreamGroup)) errors.push(`${id}: upstreamGroup \u91CD\u590D ${h.upstreamGroup}`);
          upstreamGroups.add(h.upstreamGroup);
          if (!Object.values(PROVIDER_AUTH).includes(h.auth)) errors.push(`${id}: auth \u975E\u6CD5 ${h.auth}`);
          if (!Object.values(PROVIDER_LIFECYCLE).includes(h.lifecycle)) errors.push(`${id}: lifecycle \u975E\u6CD5 ${h.lifecycle}`);
          if (h.lifecycle === PROVIDER_LIFECYCLE.PROBATION) {
            if (Object.keys(h.chain).length) errors.push(`${id}: probation \u6E90\u4E0D\u5F97\u6709\u94FE\u4F4D\u6B21`);
            if (SOURCE_TOGGLES[id] !== false) errors.push(`${id}: probation \u6E90\u9ED8\u8BA4\u5FC5\u987B\u5173\u95ED`);
            if (!h.reviewAt) errors.push(`${id}: probation \u6E90\u5FC5\u987B\u6709 reviewAt`);
          } else if (!Object.keys(h.chain).length) {
            errors.push(`${id}: active \u6E90\u5FC5\u987B\u6709\u94FE\u4F4D\u6B21`);
          }
        }
        for (const platform of Object.keys(PLATFORM_QUALITIES)) {
          const chain = active.filter((id) => SOURCE_HANDLERS[id].platforms.includes(platform) && SOURCE_HANDLERS[id].chain[platform] != null);
          if (!chain.length) errors.push(`${platform}: \u6CA1\u6709\u4EFB\u4F55\u4E0A\u94FE\u6E90`);
          const ranks = chain.map((id) => SOURCE_HANDLERS[id].chain[platform]);
          if (new Set(ranks).size !== ranks.length) errors.push(`${platform}: \u94FE\u4F4D\u6B21\u91CD\u590D`);
        }
        for (const gap of KNOWN_COVERAGE_GAPS) {
          const count = active.filter((id) => SOURCE_HANDLERS[id].platforms.includes(gap.platform) && SOURCE_HANDLERS[id].chain[gap.platform] != null).length;
          if (gap.platform === "mg" || gap.platform === "kg") {
            if (count !== 1) errors.push(`${gap.platform}: \u8986\u76D6\u7F3A\u53E3\u767B\u8BB0\u4E3A\u5355\u6E90\uFF0C\u5B9E\u9645 ${count} \u6E90`);
          }
        }
        if (errors.length) {
          const err = new Error(`${ERROR_CODES.CONTRACT_ERROR}: Provider Contract \u6821\u9A8C\u5931\u8D25 -> ${errors.join(" | ")}`);
          err.code = ERROR_CODES.CONTRACT_ERROR;
          err.contractErrors = errors;
          throw err;
        }
        return { ok: true, registered, active: active.length, probation: probation.length, platforms: Object.keys(PLATFORM_QUALITIES) };
      }
      function buildSourceChain(platform, quality) {
        const q = String(quality || "128k").toLowerCase();
        const handlers = Object.keys(SOURCE_HANDLERS).map((id) => SOURCE_HANDLERS[id]).filter((h) => h && h.lifecycle === PROVIDER_LIFECYCLE.ACTIVE).filter((h) => h.platforms.includes(platform)).filter((h) => h.chain[platform] != null).filter((h) => qualityRank(h.maxQuality) >= qualityRank(q)).map((h) => {
          const e = computeEligibility(h.id, platform, q, { runtime: false, qualityShortCircuit: true, consumePlayDeadTrial: true });
          if (cfg("eligibilityShadow", false)) {
            const legacy = shadowLegacyEligibility(h.id, platform, q);
            if (legacy.code !== e.code) logDebug(`[\u5F71\u5B50\u88C1\u51B3] ${h.id} ${platform}/${q}: legacy=${legacy.code} modern=${e.code}`);
          }
          if (!e.eligible) {
            if (LOG_DEBUG) logDebug(`[\u94FE] ${h.id} \u8DF3\u8FC7\uFF08${e.reason}${e.untilMs ? `\uFF0C\u81F3 ${e.untilMs}` : ""}\uFF09`);
            return null;
          }
          return Object.assign({}, h, { eligibility: e });
        }).filter(Boolean).sort((a, b) => (a.chain[platform] || 999) - (b.chain[platform] || 999));
        if (LOG_DEBUG) logDebug(`[\u94FE] ${platform} ${q}: ${handlers.map((h) => h.id).join(" \u2192 ")}`);
        return handlers;
      }
      function sortChainByHealth(chain) {
        return chain.slice().sort((a, b) => {
          const av = a.verified ? 0.15 : 0;
          const bv = b.verified ? 0.15 : 0;
          const ha = computeHealthScore(a.id).score + av;
          const hb = computeHealthScore(b.id).score + bv;
          if (Math.abs(hb - ha) > 0.05) return hb - ha;
          return computeHealthScore(a.id).avgTime - computeHealthScore(b.id).avgTime;
        });
      }
      function raceFirst(launchers, opts = {}) {
        const batchSize = Math.max(1, Number(opts.batchSize || cfg("raceBatchSize", 3)));
        const staggerMs = Math.max(0, Number(opts.staggerMs !== void 0 ? opts.staggerMs : cfg("raceBatchStaggerMs", 300)));
        const matchWaitMs = Math.max(0, Number(opts.matchWaitMs !== void 0 ? opts.matchWaitMs : cfg("raceMatchWaitMs", 600)));
        const deadline = Number(opts.deadline || Date.now() + cfg("raceBudgetMs", 12e3));
        if (!launchers || launchers.length === 0) {
          return Promise.reject(new Error(`${ERROR_CODES.NOT_FOUND}: \u65E0\u53EF\u7ADE\u901F\u7684\u97F3\u6E90`));
        }
        return new Promise((resolve, reject) => {
          let settled = false;
          const cancelTokens = launchers.map(() => createCancelToken());
          const cancelAll = (why) => {
            for (const t of cancelTokens) t.cancel(why);
          };
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
            if (waiter) {
              clearTimeout(waiter);
              waiter = null;
            }
            if (budgetTimer) {
              clearTimeout(budgetTimer);
              budgetTimer = null;
            }
            resolve(val);
          };
          const fail = (err) => {
            if (settled) return;
            settled = true;
            cancelAll("race_failed");
            if (waiter) {
              clearTimeout(waiter);
              waiter = null;
            }
            if (budgetTimer) {
              clearTimeout(budgetTimer);
              budgetTimer = null;
            }
            reject(err);
          };
          const startOne = (i) => {
            const item = launchers[i];
            const h = item && item.handler || null;
            const run = typeof item === "function" ? item : item && item.run;
            const isVerified = !!(h && h.verified);
            started += 1;
            pending += 1;
            if (isVerified) verifiedPending += 1;
            Promise.resolve().then(() => run(cancelTokens[i])).then(
              (res) => {
                pending -= 1;
                if (isVerified) verifiedPending -= 1;
                if (settled) return;
                const url = res && typeof res === "object" && res.url ? res.url : res;
                const source = res && typeof res === "object" && res.source ? res.source : h && h.id || "";
                logDebug(`[\u7ADE\u901F] \u5019\u9009\u6210\u529F: \u6E90=${source || "\u672A\u77E5"} verified=${isVerified}`);
                if (isVerified) return settle({ url, source: source || "" });
                if (!candidate) {
                  candidate = { url, source: source || "" };
                  if (verifiedPending > 0 && matchWaitMs > 0) {
                    waiter = setTimeout(() => {
                      waiter = null;
                      if (!settled && candidate) settle(candidate);
                    }, matchWaitMs);
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
                  logDebug(`[\u7ADE\u901F] \u5019\u9009\u5168\u8D25: ${errs.length} \u4E2A: ${errs.map((x) => String(x && x.message || "")).join(" | ")}`);
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
            fail(new Error(`${ERROR_CODES.NETWORK_TIMEOUT}: \u7ADE\u901F\u9884\u7B97\u8017\u5C3D(${cfg("raceBudgetMs", 12e3)}ms)`));
          }, Math.max(deadline - Date.now(), 0));
        });
      }
      var inflightCount = /* @__PURE__ */ new Map();
      var lastUsedAt = /* @__PURE__ */ new Map();
      var reqTimestamps = /* @__PURE__ */ new Map();
      function throttleCheck(sourceId) {
        const inflight = inflightCount.get(sourceId) || 0;
        const maxConc = cfg("maxConcurrency", SOURCE_MAX_CONCURRENCY);
        if (inflight >= maxConc) {
          logDebug(`[\u9650\u901F] ${sourceId} \u5E76\u53D1${inflight}\u2265${maxConc}\uFF0C\u672C\u8F6E\u8DF3\u8FC7`);
          return false;
        }
        const now = Date.now();
        const winMs = cfg("rateWindowMs", RATE_WINDOW_MS);
        const winMax = cfg("rateWindowMax", RATE_WINDOW_MAX);
        const ts = (reqTimestamps.get(sourceId) || []).filter((t) => now - t < winMs);
        reqTimestamps.set(sourceId, ts);
        if (ts.length >= winMax) {
          logDebug(`[\u9650\u901F] ${sourceId} ${winMs / 1e3}s\u5185${ts.length}\u6B21\u2265${winMax}\uFF0C\u672C\u8F6E\u8DF3\u8FC7`);
          return false;
        }
        return true;
      }
      async function wrapExecute(handler, platform, songInfo, quality, cancelToken) {
        var _a2;
        throwIfCanceled(cancelToken);
        const traceId = healthTraceOf(songInfo);
        const preGate = SOURCE_HANDLERS[handler.id] ? computeEligibility(handler.id, platform, quality, { runtime: false, consumePlayDeadTrial: false }) : { eligible: true, code: "ELIGIBLE", reason: null };
        if (!preGate.eligible) {
          recordHealthEvent({ event: "source_skip", traceId, sourceId: handler.id, platform, quality, reason: preGate.reason || "eligibility" });
          const gateErr = new Error(`${preGate.code || ERROR_CODES.RATE_LIMIT}: \u97F3\u6E90[${handler.name}]\u53D1\u8BF7\u6C42\u524D\u8D44\u683C\u5931\u6548\uFF08${preGate.reason || "eligibility"}\uFF09`);
          gateErr.isThrottleSkip = true;
          throw gateErr;
        }
        const previewCoolUntil = previewCooldownMap.get(handler.id);
        const is128k = String(quality || "").toLowerCase() === "128k";
        if (previewCoolUntil && previewCoolUntil > Date.now() && !is128k) {
          recordHealthEvent({ event: "source_skip", traceId, sourceId: handler.id, platform, quality, reason: "preview_cooldown" });
          const coolErr = new Error(`${ERROR_CODES.RATE_LIMIT}: \u97F3\u6E90[${handler.name}]\u5224\u5B9A\u4E3A\u6E90\u7EA7\u9650\u6D41\uFF0C\u51B7\u5374\u4E2D\uFF08128k \u4FDD\u5E95\u6863\u9664\u5916\uFF09`);
          coolErr.isThrottleSkip = true;
          throw coolErr;
        }
        if (!canExecute(handler.id, quality)) {
          recordHealthEvent({ event: "source_skip", traceId, sourceId: handler.id, platform, quality, reason: "breaker" });
          logDebug(`[\u65AD\u8DEF\u5668] ${handler.id} ${quality || "128k"} \u5904\u4E8E${((_a2 = (getBreaker(handler.id).byQuality[String(quality || "default")] || {}).breaker) == null ? void 0 : _a2.state) || getBreaker(handler.id).state}\u72B6\u6001\uFF0C\u8DF3\u8FC7`);
          revertHalfOpenOnSkip(handler.id, quality);
          const breakerSkip = new Error(`${ERROR_CODES.RATE_LIMIT}: \u97F3\u6E90[${handler.name}]\u5DF2\u7194\u65AD`);
          breakerSkip.isThrottleSkip = true;
          throw breakerSkip;
        }
        if (!throttleCheck(handler.id)) {
          recordHealthEvent({ event: "source_skip", traceId, sourceId: handler.id, platform, quality, reason: "local_throttle" });
          revertHalfOpenOnSkip(handler.id, quality);
          const skipErr = new Error(`${ERROR_CODES.RATE_LIMIT}: \u97F3\u6E90[${handler.name}]\u89E6\u53D1\u5E76\u53D1/\u9650\u901F\u4FDD\u62A4\uFF0C\u672C\u8F6E\u8DF3\u8FC7`);
          skipErr.isThrottleSkip = true;
          throw skipErr;
        }
        inflightCount.set(handler.id, (inflightCount.get(handler.id) || 0) + 1);
        if (!reqTimestamps.has(handler.id)) reqTimestamps.set(handler.id, []);
        reqTimestamps.get(handler.id).push(Date.now());
        lastUsedAt.set(handler.id, Date.now());
        const startTime = Date.now();
        recordHealthEvent({ event: "source_attempt", traceId, sourceId: handler.id, platform, quality });
        try {
          const mid = getHashOrMid(songInfo);
          throwIfCanceled(cancelToken);
          const url = cancelToken ? await raceWithCancel(Promise.resolve().then(() => handler.fn(platform, mid, quality, songInfo, cancelToken)), cancelToken) : await handler.fn(platform, mid, quality, songInfo, cancelToken);
          throwIfCanceled(cancelToken);
          const finalUrl = validateUrl(url, handler.name);
          const verdict = await verifyDelivery(finalUrl, { platform, handlerId: handler.id, quality, songInfo }, cancelToken);
          if (verdict && verdict.ok === false) {
            const vErr = new Error(`${verdict.code}: ${CODE_HINT[verdict.code] || "\u4EA4\u4ED8\u6821\u9A8C\u672A\u901A\u8FC7"}\uFF08${verdict.reason}\uFF09`);
            vErr.code = verdict.code;
            vErr.deliveryCheck = true;
            vErr.evidence = verdict.evidence || "strong";
            if (verdict.code === ERROR_CODES.PREVIEW_FRAGMENT) {
              vErr.fragmentUrl = finalUrl;
              if (verdict.quality) vErr.fragmentQuality = verdict.quality;
            }
            throw vErr;
          }
          const realQuality = admit({ probe: verdict, songInfo, quality }).quality || verdict && verdict.quality || "";
          if (realQuality) {
            const reqQ = String(quality || "").toLowerCase();
            if (realQuality !== reqQ) {
              boundedMapSet(deliveryQualityMap, `${handler.id}|${platform}|${mid}|${reqQ}`, realQuality);
              logInfo(`[${handler.name}] \u5B9E\u4EA4\u4ED8\u97F3\u8D28\u4E0E\u8BF7\u6C42\u6863\u4E0D\u7B26: \u8BF7\u6C42[${quality || "128k"}] \u2192 \u5B9E\u5F97[${realQuality}]`);
            } else {
              boundedMapSet(deliveryQualityMap, `${handler.id}|${platform}|${mid}|${reqQ}`, realQuality);
            }
          }
          recordSuccess(handler.id, Date.now() - startTime, quality);
          recordHealthEvent({ event: "source_result", traceId, sourceId: handler.id, platform, quality, ok: true, code: "", latencyMs: Date.now() - startTime });
          logInfo(`[${handler.name}] \u89E3\u6790\u6210\u529F: ${(songInfo == null ? void 0 : songInfo.name) || ""} \u97F3\u8D28[${quality || "128k"}]`);
          return finalUrl;
        } catch (e) {
          if (e && (e.canceled === true || e.code === ERROR_CODES.CANCELED)) throw e;
          if (e && e.isThrottleSkip) {
            revertHalfOpenOnSkip(handler.id, quality);
            throw e;
          }
          recordHealthEvent({ event: "source_result", traceId, sourceId: handler.id, platform, quality, ok: false, code: extractErrorCode(e), latencyMs: Date.now() - startTime });
          if (e && typeof e === "object" && !e.sourceId) e.sourceId = handler.id;
          logDebug(`[${handler.name}] \u5931\u8D25 code=${e.code || "?"} msg=${e.message}; \u7194\u65AD\u7C7B=${e.code === ERROR_CODES.NETWORK_TIMEOUT || e.code === ERROR_CODES.NETWORK_ERROR || e.code === ERROR_CODES.SERVER_ERROR || e.code === ERROR_CODES.RATE_LIMIT}`);
          const adm = admit({
            stage: "candidate",
            platform,
            quality,
            songInfo,
            source: handler.id,
            error: { code: extractErrorCode(e), reason: String(e && e.message || ""), evidence: e && e.evidence || "strong" }
          });
          applyAdmission(adm, { source: handler.id, quality, platform, songInfo, error: e, name: handler.name });
          throw e;
        } finally {
          inflightCount.set(handler.id, Math.max((inflightCount.get(handler.id) || 0) - 1, 0));
        }
      }
      async function fallbackRace(chain, platform, songInfo, quality, deadline) {
        if (deadline && Date.now() >= deadline) {
          const budgetErr = new Error(`${ERROR_CODES.NETWORK_TIMEOUT}: \u7ADE\u901F\u9884\u7B97\u8017\u5C3D(${cfg("raceBudgetMs", 12e3)}ms)\uFF0C\u8DF3\u8FC7\u672C\u6863`);
          budgetErr.detail = [{ source: "budget", quality, code: ERROR_CODES.NETWORK_TIMEOUT, reason: "\u9884\u7B97\u8017\u5C3D" }];
          throw budgetErr;
        }
        const collectDetails = [];
        if (chain.length === 1) {
          logDebug(`[\u7ADE\u901F] \u5355\u94FE\u8BF7\u6C42: ${platform} ${quality} \u6E90=${chain[0].id}`);
          const budgetLeft = Math.max((Number(deadline) || Date.now() + cfg("raceBudgetMs", 12e3)) - Date.now(), 1e3);
          let singleTimer = null;
          const singleToken = createCancelToken();
          try {
            const url = await Promise.race([
              wrapExecute(chain[0], platform, songInfo, quality, singleToken),
              new Promise((_, reject) => {
                singleTimer = setTimeout(() => {
                  singleToken.cancel("single_budget");
                  reject(Object.assign(new Error(`${ERROR_CODES.NETWORK_TIMEOUT}: \u5355\u6E90\u8D85\u51FA\u9884\u7B97(${Math.round(budgetLeft)}ms)`), { code: ERROR_CODES.NETWORK_TIMEOUT }));
                }, budgetLeft);
              })
            ]);
            return { url, source: chain[0].id };
          } catch (e) {
            const code = extractErrorCode(e);
            const aggErr2 = new Error(`${chain[0].name}: ${e.message}`);
            aggErr2.code = code;
            collectDetails.push({ source: chain[0].id, quality, code, reason: String(e && e.message || "") });
            aggErr2.detail = collectDetails;
            throw aggErr2;
          } finally {
            if (singleTimer) clearTimeout(singleTimer);
            singleToken.cancel("single_settled");
          }
        }
        const primary = chain.filter((h) => (h.batch || 1) === 1);
        const secondary = chain.filter((h) => (h.batch || 1) > 1);
        const launchers = [...primary, ...secondary].map((h) => ({
          handler: h,
          run: (cancelToken) => wrapExecute(h, platform, songInfo, quality, cancelToken).then((url) => ({ url, source: h.id }))
        }));
        const batchSize = Math.min(cfg("raceBatchSize", 3), Math.max(primary.length, 1));
        const errors = [];
        const details = collectDetails;
        const attempts = [];
        const recordFail = (handlerId, q, err) => {
          const code = extractErrorCode(err);
          const evidence = err && err.evidence || "strong";
          attempts.push({ code, evidence, reason: String(err && err.message || "") });
          details.push({ source: handlerId, quality: q, code, evidence, reason: String(err && err.message || "") });
          errors.push(err.message);
        };
        try {
          const winner = await raceFirst(launchers, { batchSize, deadline });
          logDebug(`[\u7ADE\u901F] ${platform} ${quality} \u9996\u80DC: \u6E90=${winner && winner.source || "unknown"}`);
          return winner;
        } catch (e) {
          if (e && e.allFailed && Array.isArray(e.errors)) {
            for (const err of e.errors) {
              recordFail(err.sourceId || "race", quality, err);
            }
          } else {
            recordFail("race", quality, e);
          }
        }
        const finalAdm = admit({ stage: "fallback", platform, quality, songInfo, attempts });
        const aggErr = new Error(errors.join("; "));
        aggErr.code = finalAdm.code || ERROR_CODES.NETWORK_ERROR;
        aggErr.detail = details;
        aggErr.admission = finalAdm;
        throw aggErr;
      }
      function buildQualityChain(requested) {
        const req = String(requested || "flac").toLowerCase();
        if (QUALITY_FIRST) {
          const chain2 = [req];
          const idx = QUALITY_PRIORITY.indexOf(req);
          if (idx >= 0) {
            const rest = QUALITY_PRIORITY.slice(idx + 1);
            for (const q of rest) chain2.push(q);
          } else {
            chain2.push("128k");
          }
          return chain2.filter((q, i) => chain2.indexOf(q) === i);
        }
        const req2 = String(requested || "128k").toLowerCase();
        const idx2 = QUALITY_PRIORITY.indexOf(req2);
        const start = idx2 >= 0 ? idx2 : QUALITY_PRIORITY.length - 1;
        const chain = [];
        for (let i = start; i < QUALITY_PRIORITY.length; i++) {
          chain.push(QUALITY_PRIORITY[i]);
        }
        if (!chain.includes(req2)) chain.unshift(req2);
        return chain;
      }
      function extractErrorCode(e) {
        if (e && e.code) return e.code;
        const m = String(e && e.message || "").match(/^([A-Z_]+):/);
        if (!m) return ERROR_CODES.NETWORK_ERROR;
        const prefix = m[1];
        if (ERROR_CODES[prefix]) return ERROR_CODES[prefix];
        const byValue = Object.keys(ERROR_CODES).find((k) => ERROR_CODES[k] === prefix);
        return byValue ? ERROR_CODES[byValue] : ERROR_CODES.NETWORK_ERROR;
      }
      var qualitySkipProbeAt = /* @__PURE__ */ new Map();
      var qualityShortCircuitKey = (id, quality) => `${id}:${String(quality || "").toLowerCase()}`;
      function isQualityHopeless(sourceId, quality) {
        const b = breakerMap.get(sourceId);
        if (!b || !b.byQuality) return false;
        const q = b.byQuality[String(quality)];
        if (!q) return false;
        if ((q.success || 0) > 0) return false;
        if ((q.fail || 0) + (q.linkExpired || 0) < cfg("qualityShortCircuitSamples", 3)) return false;
        const key = qualityShortCircuitKey(sourceId, quality);
        const probeMs = cfg("qualityShortCircuitProbeMs", 216e5);
        if (!qualitySkipProbeAt.has(key)) {
          qualitySkipProbeAt.set(key, Date.now() + probeMs);
          return true;
        }
        if (Date.now() >= qualitySkipProbeAt.get(key)) {
          qualitySkipProbeAt.set(key, Date.now() + probeMs);
          return false;
        }
        return true;
      }
      var coldStartWarmAt = /* @__PURE__ */ new Map();
      function warmUpColdStartSources(platform) {
        for (const h of Object.values(SOURCE_HANDLERS)) {
          if (!h || !h.coldStart || runtimeToggles[h.id] !== true) continue;
          if (Date.now() - (coldStartWarmAt.get(h.id) || 0) < cfg("coldStartWarmTtlMs", 3e5)) continue;
          if (!buildSourceChain(platform, "128k").some((x) => x.id === h.id)) continue;
          coldStartWarmAt.set(h.id, Date.now());
          logDebug(`[\u9884\u70ED] ${h.id} \u51B7\u542F\u52A8\u9884\u70ED\u5DF2\u53D1\u51FA`);
          Promise.resolve().then(() => h.fn("kw", "228908", "128k", { name: "\u6674\u5929", singer: "\u5468\u6770\u4F26", duration: 269e3, songmid: "228908" })).catch(() => {
          });
        }
      }
      var inflightUrl = /* @__PURE__ */ new Map();
      var INFLIGHT_URL_MAX = 200;
      function buildInflightKey(platform, songInfo, quality) {
        const m = songInfo && typeof songInfo === "object" ? songInfo : {};
        const id = m.songmid || m.hash || m.musicId || m.copyrightId || m.id || "";
        return `${platform}|${quality}|${id}|${m.name || ""}|${m.singer || ""}|${m.duration || 0}`;
      }
      async function getUrlWithFallback(platform, songInfo, quality) {
        var _a2, _b2, _c2;
        if (!platform || typeof platform !== "string" || !PLATFORM_QUALITIES[platform]) {
          throw new Error(`${ERROR_CODES.PARAM_ERROR}: \u65E0\u6548\u7684\u5E73\u53F0\u53C2\u6570`);
        }
        if (!songInfo || typeof songInfo !== "object") {
          throw new Error(`${ERROR_CODES.PARAM_ERROR}: \u65E0\u6548\u7684\u6B4C\u66F2\u4FE1\u606F`);
        }
        let cacheKey = buildCacheKey(platform, songInfo, quality);
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
              logDebug(`[\u7F13\u5B58\u8DE8\u6863] ${(songInfo == null ? void 0 : songInfo.name) || ""} \u8BF7\u6C42[${reqQ36}]\u547D\u4E2D[${eq}]\u69FD`);
              break;
            }
          }
        }
        const cachedSourceDisabled = !!(cached && cached.url && cached.source && (runtimeToggles[cached.source] === false || manualOff[cached.source]));
        if (cachedSourceDisabled) {
          logInfo(`[\u7F13\u5B58\u5931\u6548] ${(songInfo == null ? void 0 : songInfo.name) || ""} \u7F13\u5B58\u6765\u81EA\u5DF2\u5173\u95ED\u6E90 ${cached.source}\uFF0C\u4E22\u5F03\u5E76\u91CD\u65B0\u89E3\u6790`);
          successCache.delete(cacheKey);
        }
        if (cached && cached.url && !cachedSourceDisabled) {
          let cacheOk = true;
          let realQ = "";
          if (cfg("verifyOnCacheHit", true)) {
            try {
              const v = await verifyDelivery(cached.url, { platform, handlerId: cached.source || "", quality, songInfo });
              if (v && v.ok === false) {
                cacheOk = false;
                logWarn(`[\u7F13\u5B58\u6821\u9A8C] \u5185\u5BB9\u4E0D\u5408\u683C(${v.code})\uFF0C\u6E05\u9664\u8BE5\u6761\u5E76\u91CD\u65B0\u89E3\u6790: ${(songInfo == null ? void 0 : songInfo.name) || ""} \u97F3\u8D28[${quality || "128k"}]`);
              } else if (v && v.quality) {
                realQ = String(v.quality).toLowerCase();
              }
            } catch (e) {
              cacheOk = false;
              logDebug(`[\u7F13\u5B58\u6821\u9A8C] \u6821\u9A8C\u5F02\u5E38(${e.code || "?"})\uFF0C\u6E05\u9664\u8BE5\u6761: ${e.message}`);
            }
          }
          if (cacheOk) {
            const tagQ = realQ || cached.quality || "128k";
            const slotQ = String(cached.quality || "").toLowerCase();
            if (realQ && slotQ && realQ !== slotQ) {
              logInfo(`[\u7F13\u5B58\u56DE\u586B] ${(songInfo == null ? void 0 : songInfo.name) || ""} \u69FD\u4F4D[${cached.quality}]\u2192\u5B9E\u4EA4\u4ED8[${realQ}]\uFF0C\u6807\u7B7E\u6309\u771F\u5B9E\u6863\u663E\u793A`);
            }
            return { url: cached.url, type: tagQ, subSource: cached.source || "", subSourceName: ((_a2 = SOURCE_HANDLERS[cached.source]) == null ? void 0 : _a2.name) || "", sourcePlatform: actualDeliveryPlatform(cached.source, cached.platform || platform) };
          }
          successCache.delete(cacheKey);
        }
        const failKey = buildCacheKey(`fail_${platform}`, songInfo, quality);
        const failEntry = getFailCachedEntry(failKey);
        if (failEntry) {
          logDebug(`\u5931\u8D25\u7F13\u5B58\u547D\u4E2D[${platform}] ${(songInfo == null ? void 0 : songInfo.name) || ""} \u97F3\u8D28${quality || "128k"}\uFF0C\u8DF3\u8FC7\u91CD\u590D\u8BF7\u6C42`);
          const cachedCode = failEntry.code || ERROR_CODES.NOT_FOUND;
          const hitErr = new Error(`${cachedCode}: \u8BE5\u8BF7\u6C42\u5DF2\u77E5\u5931\u8D25(${failEntry.ttl === 0 ? "\u4E0D\u7F13\u5B58" : "\u7F13\u5B58\u4E2D"})\uFF0C\u8DF3\u8FC7\u91CD\u590D\u8BF7\u6C42`);
          hitErr.code = cachedCode;
          throw hitErr;
        }
        if (cfg("coldStartWarmEnabled", true)) warmUpColdStartSources(platform);
        const errors = [];
        const details = [];
        let lastFailCode = ERROR_CODES.NETWORK_ERROR;
        const attempts = [];
        const noteAttempt = (code, evidence) => {
          if (code) attempts.push({ code, evidence: evidence || "strong" });
        };
        let effectiveQuality = quality || (QUALITY_FIRST ? "flac" : "128k");
        if (cfg("truthfulQuality", true)) {
          const ceiling = getQualityCeiling(platform, songInfo);
          if (ceiling && qualityRank(ceiling) < qualityRank(effectiveQuality)) {
            logDebug(`[${platform}] \u80FD\u529B\u5907\u6863\u547D\u4E2D: ${(songInfo == null ? void 0 : songInfo.name) || ""} \u5386\u53F2\u6700\u9AD8[${ceiling}]\uFF0C\u672C\u8F6E\u4ECE\u8BE5\u6863\u8D77`);
            effectiveQuality = ceiling;
          }
        }
        const qualityChain = buildQualityChain(effectiveQuality);
        const totalDeadline = Date.now() + cfg("raceBudgetMs", 12e3);
        const perQBudget = cfg("raceBudgetPerQuality", { flac: 6e3, "320k": 5e3, "128k": 5e3, flac24bit: 6e3 });
        for (let qi = 0; qi < qualityChain.length; qi++) {
          const q = qualityChain[qi];
          const isLast = qi === qualityChain.length - 1;
          const selectedQuality = q;
          const chainAll = sortChainByHealth(buildSourceChain(platform, selectedQuality));
          let chain = chainAll;
          if (cfg("qualityFloor", true) && selectedQuality !== "128k" && chain.length > 1) {
            const frag = getFragmentSources(platform, songInfo);
            if (frag.size) {
              const filtered = chain.filter((h) => !frag.has(h.id));
              if (filtered.length && filtered.length !== chain.length) {
                logDebug(`[${platform}][${q}] \u8DF3\u8FC7\u5DF2\u5224\u7247\u6BB5\u6E90: ${chain.filter((h) => frag.has(h.id)).map((h) => h.id).join(",")}`);
                chain = filtered;
              }
            }
          }
          if (chainAll.length && !chain.length) {
            logDebug(`[${platform}][${q}] \u6863\u4F4D\u77ED\u8DEF\uFF1A\u5168\u90E8\u6E90\u8BE5\u6863\u5386\u53F2 0 \u6210\u529F\uFF0C\u76F4\u63A5\u964D\u6863`);
            errors.push(`[${q}] \u6863\u4F4D\u77ED\u8DEF(\u5168\u90E8\u6E90\u8BE5\u6863\u5386\u53F20\u6210\u529F)`);
            details.push({ source: "quality-short-circuit", quality: q, code: ERROR_CODES.NETWORK_ERROR, reason: "\u5168\u90E8\u6E90\u8BE5\u6863\u5386\u53F20\u6210\u529F\uFF0C\u5DF2\u77ED\u8DEF\u964D\u6863" });
            noteAttempt(ERROR_CODES.NETWORK_ERROR, "weak");
            continue;
          }
          if (!chain.length) {
            errors.push(`[${q}] \u65E0\u53EF\u7528\u97F3\u6E90`);
            continue;
          }
          const remaining = Math.max(totalDeadline - Date.now(), 0);
          const perQ = perQBudget[q] || cfg("raceBudgetMs", 12e3);
          const floorMs = cfg("raceBudgetFloorMs", 3e3);
          const qBudget = Math.min(perQ, remaining);
          const budget = isLast ? Math.min(Math.max(qBudget, floorMs), cfg("raceBudgetMs", 12e3) + floorMs) : qBudget;
          const raceDeadline = Date.now() + budget;
          logDebug(`[${platform}][${q}] \u97F3\u6E90\u94FE: ${chain.map((h) => h.id).join(">")} (\u6309\u5065\u5EB7\u6392\u5E8F)\uFF0C\u9884\u7B97 ${Math.round(raceDeadline - Date.now())}ms${isLast ? "\uFF08\u672B\u6863\u4FDD\u5E95\uFF0C\u53EF\u6EA2\u51FA\u603B\u9884\u7B97\u81F3" + Math.round((cfg("raceBudgetMs", 12e3) + floorMs) / 1e3) + "s\uFF09" : ""}`);
          try {
            const { url, source } = await fallbackRace(chain, platform, songInfo, selectedQuality, raceDeadline);
            const reqQ = String(quality || (QUALITY_FIRST ? "flac" : "128k")).toLowerCase();
            const deliverQ = String(selectedQuality || "128k").toLowerCase();
            const truthQ = cfg("truthfulQuality", true) && getDeliveryQuality(source, platform, songInfo, selectedQuality) || deliverQ;
            const writeKey = truthQ === reqQ ? cacheKey : buildCacheKey(platform, songInfo, truthQ);
            setCachedUrl(writeKey, url, truthQ, source, actualDeliveryPlatform(source, platform));
            if (truthQ !== reqQ) {
              logInfo(`[${platform}] ${(songInfo == null ? void 0 : songInfo.name) || ""} \u97F3\u8D28\u534F\u5546\u964D\u6863: ${reqQ}\u2192${truthQ}\uFF08\u6309\u5B9E\u4EA4\u4ED8\u6863\u5165\u7F13\u5B58\u69FD\uFF09`);
            }
            if (cfg("truthfulQuality", true) && qualityRank(truthQ) < qualityRank(reqQ)) {
              noteQualityCeiling(platform, songInfo, truthQ);
            }
            return { url, type: truthQ, subSource: source || "", subSourceName: ((_b2 = SOURCE_HANDLERS[source]) == null ? void 0 : _b2.name) || "", sourcePlatform: actualDeliveryPlatform(source, platform) };
          } catch (e) {
            noteAttempt(extractErrorCode(e), e && e.evidence || "strong");
            errors.push(`[${q}] ${e.message}`);
            if (e && Array.isArray(e.detail) && e.detail.length) {
              for (const d of e.detail) {
                details.push(__spreadValues({}, d));
                noteAttempt(d.code, d.evidence);
              }
            } else {
              const c = extractErrorCode(e);
              details.push({ source: "chain", quality: q, code: c, reason: String(e && e.message || "") });
              noteAttempt(c, e && e.evidence || "strong");
            }
          }
        }
        const fragAnchor = getHashOrMid(songInfo);
        const hasFragDetail = !!fragAnchor && details.some((d) => d.code === ERROR_CODES.PREVIEW_FRAGMENT);
        const hasFragCache = qualityChain.some((q) => fragmentUrlMap.has(`${platform}|${getHashOrMid(songInfo)}|${String(q || "").toLowerCase()}`));
        if (cfg("fragmentFallback", true) && fragAnchor && (hasFragDetail || hasFragCache)) {
          const frags = [];
          for (const q of qualityChain) {
            const k = `${platform}|${getHashOrMid(songInfo)}|${String(q || "").toLowerCase()}`;
            const f = fragmentUrlMap.get(k);
            if (f && Date.now() - (f.ts || 0) <= FRAGMENT_URL_TTL_MS) frags.push(f);
            else if (f) fragmentUrlMap.delete(k);
          }
          const best = frags.sort((a, b) => qualityRank(b.quality) - qualityRank(a.quality))[0];
          if (best) {
            logWarn(`[\u5168\u6863\u7247\u6BB5] ${(songInfo == null ? void 0 : songInfo.name) || ""} \u6240\u6709\u6E90\u90FD\u53EA\u7ED9\u8BD5\u542C\u7247\u6BB5 \u2192 \u6309 B \u65B9\u6848\u4EA4\u4ED8\u7247\u6BB5\u5E76\u6807\u6CE8\u300C\u8BD5\u542C\u7248\u300D\uFF08\u4E0D\u8BBE 6h \u7F13\u5B58\uFF09`);
            return {
              url: best.url,
              type: best.quality,
              subSource: best.source,
              subSourceName: `${best.name} \xB7 \u8BD5\u542C\u7248`,
              sourcePlatform: actualDeliveryPlatform(best.source, platform)
            };
          }
        }
        let expired = null;
        if (successCache.hasExpired(cacheKey)) expired = successCache.getExpired(cacheKey);
        if (!expired) {
          for (const eq of QUALITY_PRIORITY) {
            if (qualityRank(eq) < qualityRank(quality)) continue;
            const ek = buildCacheKey(platform, songInfo, eq);
            if (!successCache.hasExpired(ek)) continue;
            const e = successCache.getExpired(ek);
            if (e && e.url) {
              expired = e;
              break;
            }
          }
        }
        if (expired) {
          if (expired && expired.url) {
            if (qualityRank(expired.quality || "128k") >= qualityRank(quality)) {
              logWarn(`\u5168\u90E8\u97F3\u6E90\u5931\u8D25\uFF0C\u8FD4\u56DE\u8FC7\u671F\u7F13\u5B58\u515C\u5E95(\u7F13\u5B58\u97F3\u8D28${expired.quality}, \u8BF7\u6C42${quality})`);
              return { url: expired.url, type: expired.quality || "128k", subSource: expired.source || "", subSourceName: ((_c2 = SOURCE_HANDLERS[expired.source]) == null ? void 0 : _c2.name) || "", sourcePlatform: actualDeliveryPlatform(expired.source, platform) };
            }
            logWarn(`\u8FC7\u671F\u7F13\u5B58\u97F3\u8D28(${expired.quality})\u4F4E\u4E8E\u8BF7\u6C42(${quality})\uFF0C\u4E0D\u515C\u5E95`);
          }
        }
        const finalAdm = admit({ stage: "fallback", attempts });
        if (finalAdm.code) lastFailCode = finalAdm.code;
        const failTtl = finalAdm.ledger.ttlMs === 0 ? cfg("allFailShortTtlMs", 3e4) : finalAdm.ledger.ttlMs || FAIL_CACHE_TTL_MS;
        setFailCached(failKey, lastFailCode, failTtl);
        logDebug(`\u5931\u8D25\u7F13\u5B58\u5199\u5165[${platform}] code=${lastFailCode} ttl=${failTtl / 1e3}s\uFF08evidence=${finalAdm.evidence}\xB7${finalAdm.verdict}\uFF09`);
        if (details.length) {
          logInfo(`[\u5931\u8D25\u660E\u7EC6] \u5E73\u53F0=${platform} \u6B4C=${(songInfo == null ? void 0 : songInfo.name) || ""} \u97F3\u8D28=${quality || "128k"} \u4EE3\u8868\u7801=${lastFailCode}: ${details.map((d) => `${d.source}=${d.code}(${String(d.reason || "").slice(0, 50)})`).join(" | ")}`);
        }
        const finalErr = new Error(`${lastFailCode}: \u6240\u6709\u6E90\u5747\u5931\u8D25 [${errors.join(" | ")}]`);
        finalErr.code = lastFailCode;
        finalErr.detail = details;
        throw finalErr;
      }
      var CROSS_FALLBACK_CACHE_MAX = 200;
      var CROSS_FALLBACK_CACHE_TTL_MS = 10 * 60 * 1e3;
      var crossFallbackCache = /* @__PURE__ */ new Map();
      function crossCacheKey(platform, songInfo, quality) {
        return buildCacheKey(`cross_${platform}`, songInfo, quality);
      }
      function getCrossFallbackCached(platform, songInfo, quality) {
        const key = crossCacheKey(platform, songInfo, quality);
        const e = crossFallbackCache.get(key);
        if (!e) return null;
        if (Date.now() - e.ts > CROSS_FALLBACK_CACHE_TTL_MS) {
          crossFallbackCache.delete(key);
          return null;
        }
        return e;
      }
      function setCrossFallbackCached(platform, songInfo, quality, result) {
        if (crossFallbackCache.size > CROSS_FALLBACK_CACHE_MAX) crossFallbackCache.clear();
        crossFallbackCache.set(crossCacheKey(platform, songInfo, quality), {
          ts: Date.now(),
          result
        });
      }
      function clearCrossFallbackCache() {
        crossFallbackCache.clear();
      }
      function parseJsonBody(body) {
        if (body && typeof body === "object") return body;
        if (typeof body !== "string") return {};
        try {
          return JSON.parse(body);
        } catch (e) {
          return {};
        }
      }
      function normalizeQQCandidate(item) {
        var _a2;
        if (!item) return null;
        const singer = Array.isArray(item.singer) ? item.singer.map((x) => (x == null ? void 0 : x.name) || "").filter(Boolean).join(" & ") : item.singer || "";
        const mid = item.songmid || item.mid || "";
        if (!mid) return null;
        return {
          platform: "tx",
          id: mid,
          songmid: mid,
          name: item.songname || item.name || "",
          singer,
          album: item.albumname || ((_a2 = item.album) == null ? void 0 : _a2.name) || "",
          duration: normalizeDurationSec(item.interval || item.duration)
        };
      }
      function normalizeWYCandidate(item) {
        var _a2;
        if (!item) return null;
        const id = item.id || item.songId || "";
        if (!id) return null;
        const singer = Array.isArray(item.artists) ? item.artists.map((x) => (x == null ? void 0 : x.name) || "").filter(Boolean).join(" & ") : item.singer || item.artist || "";
        const album = ((_a2 = item.album) == null ? void 0 : _a2.name) || item.albumName || item.album || "";
        return {
          platform: "wy",
          id,
          songmid: id,
          name: item.name || item.songName || "",
          singer,
          album,
          duration: normalizeDurationSec(item.duration)
        };
      }
      function normalizeKWCandidate(item) {
        if (!item || !item.rid) return null;
        return {
          platform: "kw",
          id: item.rid,
          rid: item.rid,
          name: item.name || "",
          singer: item.singer || "",
          album: item.album || "",
          duration: normalizeDurationSec(item.duration)
        };
      }
      async function crossSearchPlatform(platform, songInfo) {
        var _a2, _b2, _c2;
        const query = buildCrossSearchQuery(songInfo);
        if (!query) return [];
        const timeout = cfg("crossPlatformSearchTimeoutMs", 4e3);
        if (platform === "tx") {
          const url = `${QQ_SEARCH_API}?w=${encodeURIComponent(query)}&format=json&n=10&p=1`;
          const res = await httpRequestWithRetry(url, {
            method: "GET",
            headers: { "Referer": "https://y.qq.com/", "User-Agent": getMobileUserAgent() },
            timeout
          });
          const body = parseJsonBody(res.body);
          const list = ((_b2 = (_a2 = body == null ? void 0 : body.data) == null ? void 0 : _a2.song) == null ? void 0 : _b2.list) || [];
          return list.map(normalizeQQCandidate).filter(Boolean);
        }
        if (platform === "wy") {
          const url = `${WY_SEARCH_API}?s=${encodeURIComponent(query)}&type=1&limit=10&offset=0`;
          const res = await httpRequestWithRetry(url, {
            method: "GET",
            headers: { "Referer": "https://music.163.com/", "User-Agent": getMobileUserAgent() },
            timeout
          });
          const body = parseJsonBody(res.body);
          const list = ((_c2 = body == null ? void 0 : body.result) == null ? void 0 : _c2.songs) || (body == null ? void 0 : body.songs) || [];
          return list.map(normalizeWYCandidate).filter(Boolean);
        }
        if (platform === "kw") {
          const list = await kuwoOfficialSearch(query, 10);
          return list.map(normalizeKWCandidate).filter(Boolean);
        }
        return [];
      }
      function buildCrossTargetInfo(candidate, original, targetPlatform) {
        const info = {
          name: candidate.name || original.name,
          singer: candidate.singer || original.singer,
          albumName: candidate.album || original.albumName || original.album || "",
          duration: candidate.duration || original.duration,
          source: targetPlatform,
          // 只带目标平台自己的 ID；绝不把主平台 rid/hash 带过去（否则目标源必失败）
          meta: { crossPlatformFrom: original.source }
        };
        if (targetPlatform === "tx") info.songmid = candidate.songmid || candidate.id;
        if (targetPlatform === "wy") {
          info.id = candidate.id;
          info.songmid = candidate.songmid || candidate.id;
        }
        if (targetPlatform === "kw") {
          info.id = candidate.rid || candidate.id;
          info.rid = candidate.rid || candidate.id;
        }
        return info;
      }
      async function resolveCrossPlatformCandidate(platform, songInfo) {
        const list = await crossSearchPlatform(platform, songInfo);
        return pickCrossCandidate(list, songInfo);
      }
      function isDefinitiveNoMatch(err) {
        const code = extractErrorCode(err);
        return code === ERROR_CODES.NOT_FOUND || code === ERROR_CODES.MISMATCH || code === ERROR_CODES.PARAM_ERROR;
      }
      async function tryCrossPlatformFallback(primaryPlatform, songInfo, quality, primaryErr, traceId) {
        const targets = CROSS_PLATFORM_ORDER.filter((p) => p !== primaryPlatform && PLATFORM_QUALITIES[p]);
        if (!targets.length) throw primaryErr || new Error(`${ERROR_CODES.NOT_FOUND}: \u65E0\u8DE8\u5E73\u53F0\u76EE\u6807`);
        let lastErr = null;
        let noCandidateCount = 0;
        let hadUncertain = false;
        for (const target of targets) {
          let candidate = null;
          try {
            candidate = await resolveCrossPlatformCandidate(target, songInfo);
          } catch (e) {
            lastErr = e;
            if (!isDefinitiveNoMatch(e)) hadUncertain = true;
            logDebug(`[\u8DE8\u5E73\u53F0] ${primaryPlatform}\u2192${target} \u641C\u7D22\u5931\u8D25: ${e.code || "?"} ${e.message}`);
            continue;
          }
          if (!candidate) {
            noCandidateCount++;
            logDebug(`[\u8DE8\u5E73\u53F0] ${primaryPlatform}\u2192${target} \u65E0\u4E25\u683C\u5339\u914D\u5019\u9009`);
            continue;
          }
          const targetInfo = buildCrossTargetInfo(candidate, songInfo, target);
          logInfo(`[\u8DE8\u5E73\u53F0] ${primaryPlatform}\u2192${target} \u547D\u4E2D: ${candidate.name} / ${candidate.singer} / ${candidate.duration || "?"}s (${candidate.id})`);
          try {
            const r = await getUrlWithFallback(target, targetInfo, quality);
            return __spreadProps(__spreadValues({}, r), {
              sourcePlatform: r.sourcePlatform || target,
              fallback: { from: primaryPlatform, reason: extractErrorCode(primaryErr) || "FAILED", matched: candidate.id }
            });
          } catch (e) {
            lastErr = e;
            if (!isDefinitiveNoMatch(e)) hadUncertain = true;
            logDebug(`[\u8DE8\u5E73\u53F0] ${primaryPlatform}\u2192${target} \u76EE\u6807\u94FE\u5931\u8D25: ${e.code || "?"} ${e.message}`);
          }
        }
        const primaryCode = extractErrorCode(primaryErr);
        const primaryUncertain = primaryCode === ERROR_CODES.NETWORK_TIMEOUT || primaryCode === ERROR_CODES.NETWORK_ERROR;
        const primaryCatalogMiss = primaryCode === ERROR_CODES.NOT_FOUND || primaryCode === ERROR_CODES.MISMATCH;
        if (primaryCatalogMiss && !primaryUncertain && noCandidateCount === targets.length && !hadUncertain) {
          const e = new Error(`${ERROR_CODES.NOT_FOUND}: \u4E3B\u5E73\u53F0${primaryCode || "\u5931\u8D25"}\uFF0C\u8DE8\u5E73\u53F0\u5747\u65E0\u4E25\u683C\u5339\u914D\uFF08${targets.map((p) => CROSS_PLATFORM_NAMES[p] || p).join("/")}\uFF09`);
          e.code = ERROR_CODES.NOT_FOUND;
          e.detail = [{ source: "cross-platform", code: ERROR_CODES.NOT_FOUND, reason: "\u65E0\u6B4C\u540D+\u6B4C\u624B+\u65F6\u957F\u4E25\u683C\u5339\u914D" }];
          throw e;
        }
        throw primaryErr || lastErr || new Error(`${ERROR_CODES.NOT_FOUND}: \u8DE8\u5E73\u53F0\u5747\u5931\u8D25`);
      }
      async function getUrlWithCrossPlatformFallback(platform, songInfo, quality, traceId) {
        if (!cfg("crossPlatformEnabled", true) || !(songInfo == null ? void 0 : songInfo.name)) {
          return getUrlWithFallback(platform, songInfo, quality);
        }
        const crossCached = getCrossFallbackCached(platform, songInfo, quality);
        if (crossCached) {
          logDebug(`[\u8DE8\u5E73\u53F0\u7F13\u5B58] ${platform} ${(songInfo == null ? void 0 : songInfo.name) || ""} \u547D\u4E2D ${crossCached.result.sourcePlatform}\uFF0C${CROSS_FALLBACK_CACHE_TTL_MS / 6e4}min \u5185\u4E0D\u518D\u641C`);
          return __spreadValues({}, crossCached.result);
        }
        return new Promise((resolve, reject) => {
          let settled = false;
          let fallbackStarted = false;
          let fallbackDone = false;
          let fallbackErr = null;
          let primaryErr = null;
          let timer = null;
          const failKey = buildCacheKey(`fail_${platform}`, songInfo, quality);
          const settleOk = (r) => {
            if (settled) return;
            settled = true;
            if (timer) clearTimeout(timer);
            resolve(r);
          };
          const settleErr = (e) => {
            if (settled) return;
            settled = true;
            if (timer) clearTimeout(timer);
            reject(e);
          };
          const startFallback = (reason) => {
            if (settled || fallbackStarted) return;
            fallbackStarted = true;
            recordHealthEvent({
              event: "cross_platform",
              traceId,
              platform: "multi",
              quality,
              ok: false,
              code: "START",
              reason: clipText(reason || "FAILED", 40)
            });
            tryCrossPlatformFallback(platform, songInfo, quality, primaryErr, traceId).then((r) => {
              if (settled) return;
              failCache.delete(failKey);
              setCrossFallbackCached(platform, songInfo, quality, r);
              recordHealthEvent({
                event: "cross_platform",
                traceId,
                platform: r.sourcePlatform,
                sourceId: r.subSource,
                quality,
                ok: true,
                code: "",
                reason: clipText(`${platform}->${r.sourcePlatform}`, 40),
                latencyMs: 0
              });
              logInfo(`[\u8DE8\u5E73\u53F0] ${platform} \u5931\u8D25(${extractErrorCode(primaryErr) || "?"}) \u2192 ${r.sourcePlatform} \u4EA4\u4ED8 ${r.subSource || ""}\uFF0C\u5DF2\u6E05\u4E3B\u5E73\u53F0\u5931\u8D25\u7F13\u5B58`);
              settleOk(r);
            }).catch((e) => {
              if (settled) return;
              fallbackDone = true;
              fallbackErr = e;
              recordHealthEvent({
                event: "cross_platform",
                traceId,
                platform: "multi",
                quality,
                ok: false,
                code: extractErrorCode(e) || ERROR_CODES.NOT_FOUND,
                reason: clipText(`${platform}->all`, 40)
              });
              if (primaryErr) settleErr(e);
            });
          };
          const primaryTask = getUrlWithFallback(platform, songInfo, quality);
          primaryTask.then((r) => {
            if (settled) return;
            settleOk(__spreadProps(__spreadValues({}, r), { sourcePlatform: r.sourcePlatform || actualDeliveryPlatform(r.subSource, platform) }));
          }).catch((e) => {
            primaryErr = e;
            if (/该请求已知失败/.test(String(e && e.message || ""))) {
              settleErr(e);
              return;
            }
            if (/预算耗尽|超出预算/.test(String(e && e.message || ""))) {
              settleErr(e);
              return;
            }
            if (/源级限流|冷却中|已熔断|并发\/限速保护/.test(String(e && e.message || ""))) {
              settleErr(e);
              return;
            }
            const code = extractErrorCode(e);
            if (code === ERROR_CODES.NETWORK_ERROR || /ECONNRESET|ENOTFOUND|ETIMEDOUT|ECONNREFUSED|EAI_AGAIN/i.test(String(code || "") + " " + String(e && e.message || ""))) {
              settleErr(e);
              return;
            }
            startFallback(code);
            if (fallbackDone && fallbackErr) settleErr(fallbackErr);
          });
          const graceMs = Math.max(0, Number(cfg("crossPlatformGraceMs", 6e3)) || 0);
          timer = setTimeout(() => {
            if (!settled) startFallback(primaryErr ? extractErrorCode(primaryErr) : "PRIMARY_SLOW");
          }, graceMs);
        });
      }
      var PROVIDER_CONTRACT = validateProviderContracts();
      var sourceConfig = {};
      var PLATFORM_NAMES = {
        wy: "\u7F51\u6613\u4E91\u97F3\u4E50",
        tx: "QQ\u97F3\u4E50",
        kw: "\u9177\u6211\u97F3\u4E50",
        kg: "\u9177\u72D7\u97F3\u4E50",
        mg: "\u54AA\u5495\u97F3\u4E50"
      };
      Object.keys(PLATFORM_QUALITIES).forEach((platform) => {
        const actions = ["musicUrl"];
        if (platform === "wy") actions.push("lyric", "pic");
        else if (platform === "kw") actions.push("pic");
        actions.push("health");
        actions.push("toggle", "probe", "probeSource");
        actions.push("reportPlayback");
        actions.push("config");
        actions.push("trend");
        actions.push("healthEvents");
        actions.push("exportHealthState", "restoreHealthState");
        sourceConfig[platform] = {
          name: PLATFORM_NAMES[platform],
          type: "music",
          actions,
          qualitys: REPORT_QUALITIES[platform] || ["128k"],
          // v1.0 P0-6：按真实能力裁剪
          // P1：显式声明换源所有权。本脚本内部已有跨平台兜底（tx→wy→kw），
          // 声明 source 后 App 不再重复搜索其他平台，避免同一平台被两层各搜一次。
          fallbackOwner: "source"
        };
      });
      on(EVENT_NAMES.request, ({ action, source, info }) => {
        if (action === "healthEvents") {
          return Promise.resolve(getHealthEvents(info || {}));
        }
        if (action === "probeSource") {
          const id = info && (info.id || info.sourceId);
          const pc = id ? buildProbeConfig()[id] : null;
          if (!pc) return Promise.resolve({ ok: false, reason: "source-not-probeable", id: id || null });
          return probeSingleSource(id, pc).then((result) => {
            if (info && info.apply === true) applyProbeResult(id, result.usable, result);
            return {
              ok: true,
              id,
              outcome: result.outcome,
              usable: result.usable,
              code: result.code || null,
              targets: result.targets || [],
              applied: !!(info && info.apply === true)
            };
          });
        }
        if (action === "reportPlayback") {
          const id = info && (info.sourceId || info.source);
          if (!id || !SOURCE_HANDLERS[id]) return Promise.reject(new Error(`${ERROR_CODES.PARAM_ERROR}: unknown source id`));
          const quality2 = info && info.quality || "128k";
          const ok = !!(info && info.ok === true);
          if (ok) {
            recordSuccess(id, Number(info && info.latencyMs) || 0, quality2, { playback: true });
            return Promise.resolve({ ok: true, id, state: getBreaker(id).state, playDead: isPlayDead(id), resolveDead: isResolveDead(id) });
          }
          recordFailure(id, quality2, { playDead: true });
          return Promise.resolve({ ok: false, id, state: getBreaker(id).state, playDead: isPlayDead(id), code: info && info.code || ERROR_CODES.NETWORK_ERROR });
        }
        if (action === "health") {
          return Promise.resolve(getHealthSnapshot());
        }
        if (action === "exportHealthState") {
          return Promise.resolve(exportHealthState());
        }
        if (action === "restoreHealthState") {
          return Promise.resolve(restoreHealthState(info));
        }
        if (action === "toggle") {
          try {
            return Promise.resolve(toggleSource(info == null ? void 0 : info.id, (info == null ? void 0 : info.enabled) !== false));
          } catch (e) {
            return Promise.reject(e);
          }
        }
        if (action === "probe") {
          if (probeState.running) {
            return Promise.resolve({ running: true });
          }
          return runHealthCheck(false).then(() => ({
            running: false,
            doneAt: Date.now(),
            round: globalThis.__probeRound || 0,
            active: Object.keys(runtimeToggles).filter((k) => runtimeToggles[k]),
            sleeping: Object.keys(probeState.sleeping).filter((k) => probeState.sleeping[k])
          })).catch((err) => Promise.reject(err));
        }
        if (action === "config") {
          if (!info || Object.keys(info).length === 0) {
            const _a2 = USER_CONFIG, { ikunApiKey: ikunApiKey2, lingchuanApiKey: lingchuanApiKey2, xinghaiDeviceId: xinghaiDeviceId2 } = _a2, safeConfig2 = __objRest(_a2, ["ikunApiKey", "lingchuanApiKey", "xinghaiDeviceId"]);
            return Promise.resolve(__spreadProps(__spreadValues({}, safeConfig2), {
              ikunApiKey: ikunApiKey2 ? "***\u5DF2\u8BBE\u7F6E***" : "",
              lingchuanApiKey: lingchuanApiKey2 ? "***\u5DF2\u8BBE\u7F6E***" : "",
              xinghaiDeviceId: xinghaiDeviceId2 ? "***\u5DF2\u8BBE\u7F6E***" : ""
            }));
          }
          const ALLOWED_KEYS = [
            "cacheTtlMs",
            "cacheTtlHighQualityMs",
            "failCacheNotFoundMs",
            "failCacheExpiredMs",
            "breakerThreshold",
            "breakerCooldownMs",
            "rateLimitBackoffMs",
            "maxConcurrency",
            "rateWindowMs",
            "rateWindowMax",
            "healthCheckIntervalMs",
            "probeConcurrency",
            "raceMatchWaitMs",
            "raceBudgetMs",
            "raceBudgetFloorMs",
            "raceBatchSize",
            "raceBatchStaggerMs",
            "coldStartTimeoutMs",
            "coldStartProbeTimeoutMs",
            "coldStartWarmTtlMs",
            "qualityShortCircuitSamples",
            "qualityShortCircuitProbeMs",
            "verifyTimeoutMs",
            "verifyMinOriginalSec",
            "verifyDurRatio",
            "verifyDurGapSec",
            "allFailShortTtlMs",
            "playDeadReviveMs",
            "memoryMapMax"
          ];
          const ALLOWED_BOOL_KEYS = [
            "verifyDelivery",
            "truthfulQuality",
            "qualityFloor",
            "verifyOnCacheHit",
            "previewUrlPreFilter",
            "fragmentFallback",
            "qualityShortCircuit",
            "coldStartWarmEnabled",
            "crossPlatformEnabled",
            "healthV2Enabled"
          ];
          const ZERO_ALLOWED_KEYS = ["verifyDurRatio", "verifyDurGapSec"];
          const PARAM_LIMITS = {
            cacheTtlMs: { max: 7 * 24 * 3600 * 1e3 },
            // 最大 7 天
            cacheTtlHighQualityMs: { max: 7 * 24 * 3600 * 1e3 },
            // 高音质缓存上限 7 天
            failCacheNotFoundMs: { max: 24 * 3600 * 1e3 },
            // 最大 1 天
            failCacheExpiredMs: { max: 3600 * 1e3 },
            // 最大 1 小时
            breakerThreshold: { max: 20 },
            // 最大 20 次
            breakerCooldownMs: { max: 30 * 60 * 1e3 },
            // 最大 30 分钟
            rateLimitBackoffMs: { max: 5 * 60 * 1e3 },
            // 最大 5 分钟
            maxConcurrency: { max: 5 },
            // 最大 5（单源并发，太大触发风控）
            rateWindowMs: { max: 10 * 1e3 },
            // 最大 10 秒
            rateWindowMax: { max: 20 },
            // 最大 20 次
            healthCheckIntervalMs: { min: 60 * 1e3 },
            // 最小 1 分钟（防频繁探测）
            probeConcurrency: { min: 1, max: 8 },
            // v8.14 探测并发上限 1~8
            raceBudgetMs: { max: 15 * 1e3 },
            // v8.10.3：总预算（死键 raceOverallTimeoutMs 已移除，唯一真相）
            raceBudgetFloorMs: { max: 15 * 1e3 },
            // 末档保底不得超过总预算上限
            raceBatchSize: { max: 10 },
            // 每批并发源数
            raceBatchStaggerMs: { max: 2e3 },
            // 批间错峰
            raceMatchWaitMs: { max: 5 * 1e3 },
            // 最大 5 秒
            coldStartTimeoutMs: { max: 30 * 1e3 },
            // 冷启动单源超时
            coldStartProbeTimeoutMs: { max: 60 * 1e3 },
            // 冷启动探针超时
            coldStartWarmTtlMs: { max: 60 * 60 * 1e3 },
            // 预热间隔上限 1 小时
            qualityShortCircuitSamples: { max: 20 },
            // 档位短路样本门槛
            qualityShortCircuitProbeMs: { max: 24 * 3600 * 1e3 },
            // 短路放行探路间隔上限 1 天
            verifyTimeoutMs: { min: 500, max: 10 * 1e3 },
            // 验真 Range 超时
            verifyMinOriginalSec: { max: 3600 },
            // 原曲短于此不按比例判
            verifyDurRatio: { max: 1 },
            // 真实时长/原曲 比例上限
            verifyDurGapSec: { max: 300 },
            // 绝对差上限
            memoryMapMax: { min: 1, max: 2e4 },
            // 五轮 MEM：记忆表条数上限（默认 2000）
            allFailShortTtlMs: { max: 10 * 60 * 1e3 },
            // 最大 10 分钟
            playDeadReviveMs: { max: 2 * 3600 * 1e3 }
            // 最大 2 小时
          };
          const updated = {};
          for (const [key2, value] of Object.entries(info)) {
            if (ALLOWED_BOOL_KEYS.includes(key2)) {
              if (typeof value !== "boolean") continue;
              USER_CONFIG[key2] = value;
              updated[key2] = value;
              continue;
            }
            if (!ALLOWED_KEYS.includes(key2)) continue;
            if (typeof value !== "number" || !Number.isFinite(value)) continue;
            if (value < 0 || value === 0 && !ZERO_ALLOWED_KEYS.includes(key2)) continue;
            const limits = PARAM_LIMITS[key2];
            if (limits) {
              if (limits.min !== void 0 && value < limits.min) continue;
              if (limits.max !== void 0 && value > limits.max) continue;
            }
            USER_CONFIG[key2] = value;
            updated[key2] = value;
          }
          logInfo(`[config] \u70ED\u66F4\u65B0\u914D\u7F6E\uFF1A${JSON.stringify(updated)}`);
          if (Object.keys(updated).length) recordHealthEvent({ event: "config_change", reason: "config", code: Object.keys(updated).join(",") });
          if (updated.breakerThreshold !== void 0) {
            for (const [, b] of breakerMap) {
              b.failureCount = 0;
            }
            logInfo(`[config] \u7194\u65AD\u9608\u503C\u5DF2\u66F4\u65B0\uFF0C\u6240\u6709\u6E90\u5931\u8D25\u8BA1\u6570\u5DF2\u91CD\u7F6E`);
          }
          if (updated.cacheTtlMs !== void 0) {
            successCache.clear();
            logInfo(`[config] \u7F13\u5B58 TTL \u5DF2\u66F4\u65B0\uFF0C\u6210\u529F\u7F13\u5B58\u5DF2\u6E05\u7A7A`);
          }
          const _b2 = USER_CONFIG, { ikunApiKey, lingchuanApiKey, xinghaiDeviceId } = _b2, safeConfig = __objRest(_b2, ["ikunApiKey", "lingchuanApiKey", "xinghaiDeviceId"]);
          return Promise.resolve({
            updated,
            current: __spreadProps(__spreadValues({}, safeConfig), {
              ikunApiKey: ikunApiKey ? "***\u5DF2\u8BBE\u7F6E***" : "",
              lingchuanApiKey: lingchuanApiKey ? "***\u5DF2\u8BBE\u7F6E***" : "",
              xinghaiDeviceId: xinghaiDeviceId ? "***\u5DF2\u8BBE\u7F6E***" : ""
            })
          });
        }
        if (action === "trend") {
          return Promise.resolve({
            history: healthHistory,
            maxPoints: HEALTH_HISTORY_MAX
          });
        }
        if (action === "lyric") {
          return getLyricForPlatform(source, info == null ? void 0 : info.musicInfo).catch((err) => Promise.reject(normalizeErrCode(err, ERROR_CODES.NOT_FOUND)));
        }
        if (action === "pic") {
          return getPicForPlatform(source, info == null ? void 0 : info.musicInfo).catch((err) => Promise.reject(normalizeErrCode(err)));
        }
        if (action !== "musicUrl") {
          return Promise.reject(new Error(`${ERROR_CODES.PARAM_ERROR}: action not support`));
        }
        if (!(info == null ? void 0 : info.musicInfo)) {
          const paramErr = new Error(`${ERROR_CODES.PARAM_ERROR}: \u8BF7\u6C42\u53C2\u6570\u4E0D\u5B8C\u6574`);
          paramErr.code = ERROR_CODES.PARAM_ERROR;
          return Promise.reject(paramErr);
        }
        const quality = info.type || (QUALITY_FIRST ? "flac" : "128k");
        const traceId = clipText(info.traceId, 64) || `src_${Date.now().toString(36)}_${healthEventSeq + 1}`;
        attachHealthTrace(info.musicInfo, traceId);
        recordHealthEvent({ event: "play_start", traceId, platform: source, quality });
        const key = buildInflightKey(source, info.musicInfo, quality);
        if (inflightUrl.size > INFLIGHT_URL_MAX) inflightUrl.clear();
        const prev = inflightUrl.get(key);
        if (prev) {
          logDebug(`[\u5E76\u53D1\u5408\u5E76] ${key} \u590D\u7528\u5728\u9014\u8BF7\u6C42`);
          return prev;
        }
        const task = getUrlWithCrossPlatformFallback(source, info.musicInfo, quality, traceId).catch((err) => Promise.reject(normalizeErrCode(err)));
        inflightUrl.set(key, task);
        const done = () => {
          if (inflightUrl.get(key) === task) inflightUrl.delete(key);
        };
        task.then(done, done);
        return task;
      });
      send(EVENT_NAMES.inited, {
        status: true,
        openDevTools: false,
        // P2：显式声明桥媒体信封能力；App 只对该脚本的二进制请求启用 base64 信封
        mediaEnvelope: 2,
        sources: sourceConfig
      });
      logInfo(`\u8C46\u5305\u5B9A\u5236\u805A\u5408\u97F3\u6E90 v8.13.0 \u5DF2\u52A0\u8F7D\uFF0812 \u767B\u8BB0 / 10 \u4E0A\u94FE / 2 \u89C2\u5BDF\uFF1BProvider Contract + \u751F\u547D\u5468\u671F\u6CBB\u7406 + \u771F\u53D6\u6D88\uFF1B\u5355\u6587\u4EF6\u6784\u5EFA\uFF09\uFF0C\u4E0A\u62A5 ${Object.keys(sourceConfig).length} \u4E2A\u97F3\u6E90\uFF08\u5386\u53F2\u7248\u672C\u89C1 docs/CHANGELOG.md\uFF09`);
      startHealthCheck();
      if (typeof module !== "undefined" && module.exports) {
        module.exports = {
          computeHealthScore,
          // v4.0：UA 池轮换（供测试/巡检验证轮换生效）
          getMobileUserAgent,
          sortChainByHealth,
          buildSourceChain,
          getUrlWithFallback,
          getBreaker,
          recordSuccess,
          recordFailure,
          recordRateLimit,
          // v8.14（F41）：按档限流审计需要直接驱动 429 记账
          recordBusinessFail,
          // v8.10.2：导出供测试断言半开收口
          ERROR_CODES,
          QUALITY_PRIORITY,
          // v3.0：探测巡检增强（分级轮次 + 休眠复活 + 配置构建）
          tierShouldProbe,
          applyProbeResult,
          buildProbeConfig,
          // v6.0：导出供测试断言探测清单过滤（关闭源不探测/自愈闭环保留）
          SOURCE_HANDLERS,
          // v8.8：导出供测试断言源标签（batch/coldStart）
          PROVIDER_CONTRACT,
          PROVIDER_LIFECYCLE,
          KNOWN_COVERAGE_GAPS,
          validateProviderContracts,
          probeState,
          runtimeToggles,
          SOURCE_TOGGLES,
          // v8.6：导出供测试/巡检断言各源默认开关状态（A 方案默认开启源必须可见）
          // v3.0：健康统计快照（App 健康面板/巡检消费）
          getHealthSnapshot,
          // P3：宿主持久化协议（只含健康元数据，不含 URL/歌名）
          exportHealthState,
          restoreHealthState
        };
        Object.defineProperty(module.exports, "__debug", {
          value: Object.freeze({
            isQualityHopeless,
            canExecute,
            qualitySkipProbeAt,
            createCancelToken,
            canceledError,
            raceWithCancel,
            httpRequest,
            raceFirst,
            wrapExecute,
            throwIfCanceled,
            probeSingleSource,
            sniffAudioBytes,
            // L4：L0 形态归一 + 单一判定（纯函数，供 r-admission 断言）
            toBytes,
            kindOf,
            mediaEnvelopeErrorCode,
            // L4 裁决层：唯一裁决入口 + 读侧查询 + 清账；probe 供桥模拟直接驱动
            admit,
            computeEligibility,
            shadowLegacyEligibility,
            // Batch 0：只读旧裁决，仅供影子 diff/审计
            skipReason,
            clearSourceLedger,
            probeAudioDelivery,
            probeByHeaders,
            verifyDelivery,
            // K14：medium 尺寸比分支需要直接驱动
            successCache,
            // P3：断言恢复不写缓存
            crossPlatformOrder: CROSS_PLATFORM_ORDER,
            crossSearchPlatform,
            buildCrossTargetInfo,
            applyAdmission,
            // K14：reducer 的 PASS/记账分支
            getHealthSnapshot,
            // F42：取链/播放摘除分层断言
            trialMarkOf,
            ADMISSION_POLICY,
            admissionLedger,
            suyinKuwoSearch,
            // 供测试验证 D-31
            // v8.11.2（覆盖率补测）：健康巡检主流程 L572-626 整段此前零覆盖——runHealthCheck 未导出，
            // 只能从定时器间接触发（初始延迟 60s），测试无法稳定驱动。此处只读导出（healthHistory 返回副本）。
            runHealthCheck,
            nextHealthCheckDelay,
            // F21：jitter 边界（可注入 rand 做确定性断言）
            hasActiveWork,
            // F21：播放中暂停判定
            inflightCount,
            // F21：断言构造“有播放流量”
            get inflightUrl() {
              return inflightUrl;
            },
            recordHealthEvent,
            // 2.4 压测：注入事件验证容量/白名单（只读 action 不暴露写口）
            getHealthEvents,
            get healthHistory() {
              return healthHistory.slice();
            },
            suyinKuwoGetUrl,
            // 供测试验证 D-31 端到端：兜底档日志是否落
            setCachedUrl,
            // 供测试构造脏缓存（复现"槽位是 flac、内容是 128k"的历史条目）
            buildCacheKey,
            breakerMap,
            recordRateLimit,
            // D-04 回归：半开态遇 429 必须收口回 open（否则永久卡死）
            playDeadStreak,
            resolveDeadStreak,
            isPlayDead,
            isResolveDead,
            bumpResolveDead,
            toggleSource,
            get playDeadDeadline() {
              return playDeadDeadline;
            },
            qualityShortCircuitKey,
            buildQualityChain,
            // N3（F12）：降档链构造，只读
            buildSourceChain,
            // v8.11.5 收尾：链过滤与 skipReason 同源回归
            runtimeToggles,
            // v8.11.5 收尾：断言内临时开/关源（用完还原）
            fallbackRace,
            // D-08：单链分支硬上限回归（可传入只含 1 个源的自造链）
            cfg,
            // D-05/D-06：配置白名单与布尔键 `??` 语义（只读求值，不改值）
            setFailCached,
            // N4（F10）：构造失败缓存条目
            getFailCachedEntry,
            // N4（F10）：读取时按 TTL 判过期
            get failCache() {
              return failCache;
            }
            // N4：只用于把 ts 往前挪，模拟 5 分钟流逝
          }),
          enumerable: false
        });
      }
    }
  });

  // src/providers/suyinKuwo.js
  var require_suyinKuwo = __commonJS({
    "src/providers/suyinKuwo.js"(exports, module) {
      module.exports = {
        "id": "suyinKuwo",
        "name": "\u6EAF\u97F3\u9177\u6211",
        "lifecycle": "active",
        "platforms": [
          "kw",
          "wy",
          "tx",
          "mg",
          "kg"
        ],
        "chain": {
          "kw": 1,
          "wy": 6,
          "tx": 1,
          "mg": 1,
          "kg": 1
        },
        "upstreamGroup": "oiapi-kuwo",
        "auth": "none",
        "maxQuality": "flac",
        "qualitys": [
          "128k",
          "320k",
          "flac"
        ],
        "coldStart": false,
        "reviewAt": null
      };
    }
  });

  // src/providers/wyOuter.js
  var require_wyOuter = __commonJS({
    "src/providers/wyOuter.js"(exports, module) {
      module.exports = {
        "id": "wyOuter",
        "name": "\u7F51\u6613\u4E91\u5B98\u65B9",
        "lifecycle": "active",
        "platforms": [
          "wy"
        ],
        "chain": {
          "wy": 4
        },
        "upstreamGroup": "wy-official",
        "auth": "none",
        "maxQuality": "128k",
        "qualitys": [
          "128k"
        ],
        "coldStart": false,
        "reviewAt": null
      };
    }
  });

  // src/providers/kuwoOfficial.js
  var require_kuwoOfficial = __commonJS({
    "src/providers/kuwoOfficial.js"(exports, module) {
      module.exports = {
        "id": "kuwoOfficial",
        "name": "\u9177\u6211\u5B98\u65B9\u76F4\u8FDE",
        "lifecycle": "active",
        "platforms": [
          "kw"
        ],
        "chain": {
          "kw": 5
        },
        "upstreamGroup": "kuwo-official",
        "auth": "none",
        "maxQuality": "128k",
        "qualitys": [
          "128k"
        ],
        "coldStart": false,
        "reviewAt": null
      };
    }
  });

  // src/providers/suyin163.js
  var require_suyin163 = __commonJS({
    "src/providers/suyin163.js"(exports, module) {
      module.exports = {
        "id": "suyin163",
        "name": "\u6EAF\u97F3163",
        "lifecycle": "active",
        "platforms": [
          "wy"
        ],
        "chain": {
          "wy": 3
        },
        "upstreamGroup": "oiapi-163",
        "auth": "none",
        "maxQuality": "128k",
        "qualitys": [
          "128k"
        ],
        "coldStart": false,
        "reviewAt": null
      };
    }
  });

  // src/providers/xinghaiBackend.js
  var require_xinghaiBackend = __commonJS({
    "src/providers/xinghaiBackend.js"(exports, module) {
      module.exports = {
        "id": "xinghaiBackend",
        "name": "\u661F\u6D77\u540E\u7AEF",
        "lifecycle": "active",
        "platforms": [
          "kw"
        ],
        "chain": {
          "kw": 2
        },
        "upstreamGroup": "xinghai-backend",
        "auth": "none",
        "maxQuality": "flac",
        "qualitys": [
          "128k",
          "320k",
          "flac"
        ],
        "coldStart": false,
        "reviewAt": null
      };
    }
  });

  // src/providers/helloworldKw.js
  var require_helloworldKw = __commonJS({
    "src/providers/helloworldKw.js"(exports, module) {
      module.exports = {
        "id": "helloworldKw",
        "name": "helloworld(kw)",
        "lifecycle": "active",
        "platforms": [
          "kw"
        ],
        "chain": {
          "kw": 4
        },
        "upstreamGroup": "kuwo-convert",
        "auth": "none",
        "maxQuality": "flac",
        "qualitys": [
          "128k",
          "320k",
          "flac"
        ],
        "coldStart": false,
        "reviewAt": null
      };
    }
  });

  // src/providers/changqingVip.js
  var require_changqingVip = __commonJS({
    "src/providers/changqingVip.js"(exports, module) {
      module.exports = {
        "id": "changqingVip",
        "name": "\u957F\u9752kw",
        "lifecycle": "active",
        "platforms": [
          "kw"
        ],
        "chain": {
          "kw": 6
        },
        "upstreamGroup": "changqing-kw",
        "auth": "none",
        "maxQuality": "128k",
        "qualitys": [
          "128k"
        ],
        "coldStart": false,
        "reviewAt": null
      };
    }
  });

  // src/providers/huibq.js
  var require_huibq = __commonJS({
    "src/providers/huibq.js"(exports, module) {
      module.exports = {
        "id": "huibq",
        "name": "Huibq",
        "lifecycle": "active",
        "platforms": [
          "kw",
          "wy"
        ],
        "chain": {
          "kw": 8,
          "wy": 8
        },
        "upstreamGroup": "huibq",
        "auth": "none",
        "maxQuality": "320k",
        "qualitys": [
          "128k",
          "320k"
        ],
        "coldStart": true,
        "reviewAt": null
      };
    }
  });

  // src/providers/juheTx.js
  var require_juheTx = __commonJS({
    "src/providers/juheTx.js"(exports, module) {
      module.exports = {
        "id": "juheTx",
        "name": "Juhe\u805A\u5408(tx)",
        "lifecycle": "active",
        "platforms": [
          "tx"
        ],
        "chain": {
          "tx": 2
        },
        "upstreamGroup": "juhe",
        "auth": "none",
        "maxQuality": "flac",
        "qualitys": [
          "128k",
          "320k",
          "flac"
        ],
        "coldStart": false,
        "reviewAt": "2026-11-19"
      };
    }
  });

  // src/providers/ikun.js
  var require_ikun = __commonJS({
    "src/providers/ikun.js"(exports, module) {
      module.exports = {
        "id": "ikun",
        "name": "ikun",
        "lifecycle": "active",
        "platforms": [
          "kw",
          "wy"
        ],
        "chain": {
          "kw": 7,
          "wy": 5
        },
        "upstreamGroup": "ikun",
        "auth": "optional",
        "maxQuality": "flac",
        "qualitys": [
          "128k",
          "320k",
          "flac"
        ],
        "coldStart": false,
        "reviewAt": null
      };
    }
  });

  // src/providers/55-probation.js
  var require_probation = __commonJS({
    "src/providers/55-probation.js"(exports, module) {
      module.exports = {
        "suyinQQ": {
          "id": "suyinQQ",
          "name": "\u6EAF\u97F3QQ",
          "lifecycle": "probation",
          "platforms": [
            "tx"
          ],
          "chain": {},
          "upstreamGroup": "oiapi-qq",
          "auth": "none",
          "maxQuality": "flac",
          "qualitys": [
            "128k",
            "320k",
            "flac"
          ],
          "coldStart": false,
          "reviewAt": "2026-11-19"
        },
        "suyinMigu": {
          "id": "suyinMigu",
          "name": "\u6EAF\u97F3\u54AA\u5495",
          "lifecycle": "probation",
          "platforms": [
            "mg"
          ],
          "chain": {},
          "upstreamGroup": "xcvts-migu",
          "auth": "none",
          "maxQuality": "flac",
          "qualitys": [
            "128k",
            "320k",
            "flac"
          ],
          "coldStart": false,
          "reviewAt": "2026-11-26"
        }
      };
    }
  });

  // src/providers/index.js
  var require_providers = __commonJS({
    "src/providers/index.js"(exports, module) {
      var active = [
        require_suyinKuwo(),
        require_wyOuter(),
        require_kuwoOfficial(),
        require_suyin163(),
        require_xinghaiBackend(),
        require_helloworldKw(),
        require_changqingVip(),
        require_huibq(),
        require_juheTx(),
        require_ikun()
      ];
      var probation = require_probation();
      module.exports = { active, probation, all: active.concat(Object.values(probation)) };
    }
  });

  // src/80-entry.js
  var require_entry = __commonJS({
    "src/80-entry.js"(exports, module) {
      var core = require_legacy();
      var specs = require_providers();
      module.exports = core;
      Object.defineProperty(module.exports, "PROVIDER_SPECS", {
        value: specs,
        enumerable: false,
        configurable: false,
        writable: false
      });
    }
  });
  return require_entry();
})();

if (typeof module !== "undefined" && module.exports) module.exports = __lxSourceBundle;
