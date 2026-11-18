// ============================================================
// v9.0 公共层 · 02-config
// 职责：用户配置区（USER_CONFIG）+ 运行参数读取（cfg）+ 探测歌单归一化
// 依赖：仅 globalThis.__lxSourceConfig
// 来源：由 legacy.js 原样迁出（v9.0 第二刀）
// ============================================================
// v9.2 版本区间语义：唯一真相源 = package.json.version（构建期 define 注入；非 bundle 环境走 fallback）
const SOURCE_VERSION = typeof __LX_SOURCE_VERSION__ === "string" ? __LX_SOURCE_VERSION__ : "8.16.4";
const DEFAULT_PROBE_SONG_POOL = ["晴天", "海阔天空", "稻香", "青花瓷", "七里香", "夜曲", "后来", "光年之外", "演员", "平凡之路", "成都", "小幸运"];
function normalizeProbeSongPool(value) {
  if (!Array.isArray(value)) return null;
  const out = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const name = item.trim();
    if (!name || name.length > 20) continue;
    if (!out.includes(name)) out.push(name);
  }
  return out.length && out.length <= 20 ? out : null;
}
const USER_CONFIG = {
  ikunApiKey: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.ikunApiKey) || "", // 填入 ikun 卡密后开启
  lingchuanApiKey: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.lingchuanApiKey) || "",
  xinghaiDeviceId: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.xinghaiDeviceId) || "",
  // v5.0：运行参数全量可配置（从 __lxSourceConfig 读取，缺省用代码默认值，行为与历史一致）
  // v8.11.1（审计修复）：交付真实性闸门的开关/阈值必须可注入——旧版这几个键不在白名单，
  // cfg() 永远拿到默认值，导致"可关闭、可回滚"是空话（实测 __lxSourceConfig.verifyDelivery=false 完全无效，
  // 片段兜底也无法用配置关掉，只能整版回滚）。布尔开关一律用 ?? ，否则 false 会被默认值吞掉。
  verifyDelivery: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.verifyDelivery) ?? true,
  truthfulQuality: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.truthfulQuality) ?? true,
  qualityFloor: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.qualityFloor) ?? true,
  verifyOnCacheHit: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.verifyOnCacheHit) ?? true,
  // v8.12：跨平台兜底开关与等待窗口。确定性失败立即回退；只有超时类失败先给主平台
  // 一个 grace 窗口，避免主平台马上要成功时白跑一次跨平台搜索。
  crossPlatformEnabled: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.crossPlatformEnabled) ?? true,
  crossPlatformGraceMs: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.crossPlatformGraceMs) ?? 3000,
  crossPlatformSearchTimeoutMs: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.crossPlatformSearchTimeoutMs) || 3000,
  // v8.11.2（D-33，V23b 实测暴露）：previewUrlPreFilter 旧不在白名单，cfg() 永远拿到默认 false，
  // 开关等于不存在（helloworld 的试听URL预筛因此从未执行）。补进白名单，布尔用 ?? 防 false 被吞。
  previewUrlPreFilter: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.previewUrlPreFilter) ?? false,
  fragmentFallback: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.fragmentFallback) ?? true,
  // F57：持久化 v2 回滚开关；false 时导出旧 v1，旧宿主忽略 v2。
  // v8.11.2（D-35，V26c/d/f 实测暴露）：验真族阈值用 || 读配置时，传 0 会被吞成默认值（0 比例/0 间隔=不设限 是合法值），统一改 ?? 。
  verifyTimeoutMs: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.verifyTimeoutMs) ?? 3000,
  verifyMinOriginalSec: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.verifyMinOriginalSec) ?? 90,
  verifyDurRatio: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.verifyDurRatio) ?? 0.6,
  verifyDurGapSec: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.verifyDurGapSec) ?? 15,
  cacheTtlMs: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.cacheTtlMs) || 21600000,          // 成功缓存 TTL(6h，低音质用)
  cacheTtlHighQualityMs: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.cacheTtlHighQualityMs) || 1800000, // v8.10：高音质缓存 TTL(30min，flac/320k/24bit 用)
  failCacheNotFoundMs: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.failCacheNotFoundMs) || 3600000,  // 失败缓存 404→1h
  failCacheExpiredMs: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.failCacheExpiredMs) || 60000,      // 失败缓存 410→1min
  breakerThreshold: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.breakerThreshold) || 3,       // 熔断阈值
  breakerCooldownMs: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.breakerCooldownMs) || 180000, // 熔断冷却
  rateLimitBackoffMs: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.rateLimitBackoffMs) || 30000, // 429退避
  maxConcurrency: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.maxConcurrency) || 2,            // 单源并发上限
  rateWindowMs: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.rateWindowMs) || 3000,             // 限速窗口
  rateWindowMax: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.rateWindowMax) || 5,              // 窗口内请求上限
  healthCheckIntervalMs: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.healthCheckIntervalMs) || 600000, // 探测间隔(10min)
  healthCheckJitterRatio: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.healthCheckJitterRatio) ?? 0.1, // F21/F06：探测抖动比例 0~0.5
  healthCheckPauseRetryMs: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.healthCheckPauseRetryMs) || 60000, // F21/F06：播放中暂停后重试间隔
  probeSongPool: normalizeProbeSongPool(typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.probeSongPool) || DEFAULT_PROBE_SONG_POOL, // F06：探测歌曲池可配（数组，1~20 首）
  probeTierCoreInterval: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.probeTierCoreInterval) || 1, // F22：核心源探测轮次间隔
  probeTierSecondaryInterval: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.probeTierSecondaryInterval) || 3, // F22：次要源探测轮次间隔
  probeConcurrency: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.probeConcurrency) || 3, // v8.14：探测并发上限(默认3,最大8)
  raceMatchWaitMs: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.raceMatchWaitMs) || 600,         // verified 等待窗口
  allFailShortTtlMs: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.allFailShortTtlMs) ?? 30000,      // v6.0：全链网络类失败短缓存 TTL(补齐 v6.0 漏配键)
  raceBudgetMs: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.raceBudgetMs) || 12000,          // v8.8：单次请求总预算(跨音质档共享)
  raceBudgetPerQuality: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.raceBudgetPerQuality) || { flac: 6000, "320k": 5000, "128k": 5000, flac24bit: 6000 }, // v8.10：分档预算（防高音质吃满总预算饿死低档）
  raceBudgetFloorMs: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.raceBudgetFloorMs != null) ? globalThis.__lxSourceConfig.raceBudgetFloorMs : 3000,     // v8.10：最后一档保底预算(防整次取链失败)
  raceBatchSize: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.raceBatchSize) || 3,             // v8.8：每批并发源数
  raceBatchStaggerMs: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.raceBatchStaggerMs) || 300, // v8.8：批间错峰
  coldStartTimeoutMs: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.coldStartTimeoutMs) || 5000, // v8.8：冷启动源单源超时；必须在总预算内留出重试空间
  coldStartProbeTimeoutMs: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.coldStartProbeTimeoutMs) || 30000, // v8.10：冷启动源探针超时（onrender 冷态 30s，8s 必误判）
  coldStartWarmTtlMs: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.coldStartWarmTtlMs) || 300000, // v8.8：冷启动预热间隔
  qualityShortCircuit: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig) ? globalThis.__lxSourceConfig.qualityShortCircuit : undefined, // v8.8：档位短路开关(缺省 true)
  coldStartWarmEnabled: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig) ? globalThis.__lxSourceConfig.coldStartWarmEnabled : undefined, // v8.8：冷启动预热开关(缺省 true)
  qualityShortCircuitSamples: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.qualityShortCircuitSamples) || 3, // v8.8：档位短路样本门槛
  qualityShortCircuitProbeMs: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.qualityShortCircuitProbeMs) || 3600000, // v8.10：短路放行探路间隔(1h，原 6h 太长)
  qualityShortCircuitUniqueProbeMs: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.qualityShortCircuitUniqueProbeMs) || 600000, // v8.14.1：唯一高质源探路间隔(10min)
  playDeadReviveMs: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.playDeadReviveMs) || 300000,        // v7.0：播放摘除后半开试探冷却期(5min)
  // 五轮 MEM：记忆表条目上限（与 ALLOWED_KEYS/PARAM_LIMITS 同步登记；漏了这行注入会静默失效）
  memoryMapMax: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.memoryMapMax) || 2000,
};
// v5.0：运行参数读取（USER_CONFIG 缺失/空值时回退默认）
function cfg(key, def) {
  const v = USER_CONFIG[key];
  if (v === undefined || v === null || v === "") return def;
  // 五轮 EDGE（D-21）：NaN / Infinity 一律回落默认值。
  // NaN 的 typeof 是 number，而 NaN <= 0、NaN < min、NaN > max 三个比较全为 false，
  // 三道配置校验同时失效；一旦写入 USER_CONFIG（如 raceBudgetMs=NaN），
  // 竞速预算恒为 NaN → 所有请求立即 NETWORK_TIMEOUT，直到进程重启。
  if (typeof def === "number" && !Number.isFinite(v)) return def;
  return v;
}

module.exports = { DEFAULT_PROBE_SONG_POOL, normalizeProbeSongPool, USER_CONFIG, cfg, SOURCE_VERSION };
