const { SOURCE_TOGGLES, userEnabled, autoOff, autoOffReason, autoOffAt, isUserEnabled, effectiveEnabled, runtimeToggles, manualOff, manualOffAt } = require("./core/35-source-switch.js");
const { breakerMap, playDeadStreak, playDeadQuality, playDeadDeadline, resolveDeadStreak, resolveDeadDeadline, qualitySkipProbeAt, qualityShortCircuitKey, getBreaker, forceQualityProbe } = require("./core/34-breaker-state.js");
const { CROSS_FALLBACK_CACHE_TTL_MS, crossFallbackCache, getCrossFallbackCached, setCrossFallbackCached, deleteCrossFallbackCached } = require("./core/33-cross-cache.js");
/*!
 * @name 豆包定制[聚合音源]
 * @description v9.0.0 模块化拆包 + 发布签名版（v9.0：6272 行单文件拆为 33 个 src/core 模块，legacy 只留装配与 3 个启动期求值定义；health 快照按版本区间判定；发布包支持 ed25519 验签）。上一版 v8.16.4 为播放摘除档位归因版。历史版本见 docs/CHANGELOG.md。
 * @version 9.1.2 门禁与断言加固（docs-audit 可红 / 签名缺钥可拦 / X-P 接 CI / live 退役源 / a-static 结构化拒绝 / C10 外呼上限）（旧版本账本可恢复 / 未来版本拒绝）
 * @author 豆包定制
 * @contribution 基线同v11.11(2026-10-15实测)；v11.12为代码加固(防错歌/https/熔断分类/探测一致性/清理)；v11.13(2026-10-28)：D11日志防御——vm无console沙箱验证通过(修复前加载抛TypeError复现)，真机装包待验证；v12.0(2026-10-28)：星海后端kw高音质——E10实测(128k/320k/flac/flac24bit四档code200、URL均Range 206、魔数正确、码率吻合、ID3歌名对应songmid)，解除仅128k限制并接入kw链双源，URL http→https升级(实测https 206可播)；v12.1-v13.4(2026-10-28)：失败缓存差异化+探测收敛+决策日志+updateAlert+自动化测试CI+端点巡检+音质表收敛+配置化，走验证链L0-L1(L2按需)
 */
// ============================================================
// 第〇部分：用户配置区（v2.0 配置化 — 开配置即用，默认不暴露）
// 需配置源（ikun 卡密 / 聆川密钥）从这里读取：
//   方式一：直接改下方 USER_CONFIG 常量（改源码即生效）；
//   方式二：宿主全局注入 globalThis.__lxSourceConfig = { ikunApiKey, lingchuanApiKey }（fork App 可做，不改源码）。
// 星海令牌默认自动生成（device_id 随机）；如需固定可在此配置 xinghaiDeviceId。
// ============================================================
// ---------- v9.0 拆包：02-config 已迁至 src/core/02-config.js（原地引入）----------
const { PROVIDER_LIFECYCLE } = require("./core/11-provider-meta.js");
const { bindDep } = require("./core/06-binding.js");

// ============================================================
// v9.0 装配清单（33 个 core 模块 → legacy 注入注册）
// 规则：模块只导出，legacy 只装配；跨模块调用一律走 dep(name)，不反向 require。
//   00-host.js                   导出 0    注入注册 0
//   01-log.js                    导出 0    注入注册 0
//   02-config.js                 导出 0    注入注册 0
//   02-error-codes.js            导出 0    注入注册 0
//   03-events.js                 导出 0    注入注册 0
//   04-cancel.js                 导出 0    注入注册 0
//   05-verdict.js                导出 0    注入注册 0
//   06-binding.js                导出 0    注入注册 0
//   07-net.js                    导出 22   注入注册 0
//   08-media.js                  导出 19   注入注册 0
//   09-match.js                  导出 29   注入注册 0
//   10-vendors.js                导出 22   注入注册 0
//   11-provider-meta.js          导出 0    注入注册 0
//   12-provider-contract.js      导出 2    注入注册 2
//   13-chain-helpers.js          导出 6    注入注册 0
//   14-lyric.js                  导出 6    注入注册 0
//   15-verify.js                 导出 13   注入注册 0
//   16-chain-misc.js             导出 8    注入注册 0
//   17-health-check.js           导出 33   注入注册 8
//   18-health-persist.js         导出 15   注入注册 3
//   19-dispatch.js               导出 27   注入注册 14
//   21-cross-search.js           导出 13   注入注册 6
//   22-chain.js                  导出 34   注入注册 20
//   24-kuwo-official.js          导出 3    注入注册 2
//   25-handlers.js               导出 27   注入注册 11
//   27-sources-admin.js          导出 10   注入注册 8
//   28-health-export.js          导出 7    注入注册 5
//   29-search.js                 导出 6    注入注册 4
//   30-suyin-extra.js            导出 3    注入注册 2
//   31-suyin-qq.js               导出 5    注入注册 2
//   33-cross-cache.js            导出 6    注入注册 4
//   34-breaker-state.js          导出 10   注入注册 9
//   35-source-switch.js          导出 11   注入注册 9
//   (legacy 自有)                  导出 0    注入注册 1
// ============================================================
const { normalizeProbeSongPool, USER_CONFIG, cfg } = require("./core/02-config.js");

// v5.0：运行参数读取（USER_CONFIG 缺失/空值时回退默认）

// ============================================================
// 第一部分：常量配置
// ============================================================

// v8.11：交付真实性闸门阈值（实测依据：FLAC STREAMINFO 与 MP3 Xing 均在文件开头，1KB 足够解析时长）
// ---------- v9.0 拆包：验真 / 链路杂项已迁至 src/core/15-verify.js、16-chain-misc.js（依赖注入）----------
const { originalDurationSec, durationHints, verifyDelivery, qualityConfidenceOf, qualityFromDelivery, probeAudioDelivery, probeByHeaders } = require("./core/15-verify.js");
const { nextHealthCheckDelay, QUALITY_FIRST, buildQualityChain } = require("./core/16-chain-misc.js");

// 五轮 MEM：按歌曲累积的表过去只有 successCache / failCache 有容量上限，
// deliveryQualityMap / fragmentSourceMap / qualityCeilingMap / fragmentUrlMap 四张表
// 只增不删（后三张靠"读取时顺手删过期"收尸，从不被读的条目会永久驻留）。
// 单条很小，但"永不释放 + 依赖访问才清理"是结构性风险，统一加最旧淘汰上限。
const { SOURCE_HANDLERS, provider, wyOuterGetUrl, helloworldKwGetUrl, changqingGetUrl, huibqGetUrl, qingliangTxGetUrl, providerQualitys, assertDeliverableUrl, isAudioPlayable, resolveColdStartTimeout, isHuibqFailMsg, trialMarkOf } = require("./core/25-handlers.js");
const { toggleSource, clearSourceLedger, clearCrossFallbackCache, clearResolveDead, clearPlayDeadTrials, probeState, clearResolveDeadTrials, playDeadTrialAt, resolveDeadTrialAt } = require("./core/27-sources-admin.js");
const { exportHealthState, HEALTH_QUALITIES, HEALTH_QUALITY_NUMBER_FIELDS, HEALTH_STATES, HEALTH_STATE_SOURCE_VERSION } = require("./core/28-health-export.js");
const { suyinKuwoSearch, setDurationHint, boundedMapSet, MEMORY_MAP_MAX } = require("./core/29-search.js");

bindDep('MEMORY_MAP_MAX', MEMORY_MAP_MAX);
async function suyin163GetUrl(songInfo, cancelToken = null) {
  const id = songInfo?.songmid || songInfo?.id;
  if (!id) throw new Error(`${ERROR_CODES.PARAM_ERROR}: 溯音163缺少songmid/id`);
  const res = await httpGet(SUYIN_163_API, { id }, 'parse', null, RETRY_TIMES, cancelToken);
  if (res?.code === 0 && res?.data) {
    const item = Array.isArray(res.data) ? res.data[0] : res.data;
    if (item?.url) return item.url;
  }
  throw new Error(`${ERROR_CODES.NOT_FOUND}: 溯音163获取失败`);
}

bindDep("suyin163GetUrl", suyin163GetUrl);

const { fallbackRace, wrapExecute, raceFirst, throttleCheck, inflightCount, reqTimestamps, lastUsedAt, validateUrl, recordSuccess, noteQualityDowngrade, applyAdmission, SOURCE_MAX_CONCURRENCY, RATE_WINDOW_MS, RATE_WINDOW_MAX, recordRateLimit, recordFailure, recordBusinessFail, rememberFragmentSource, bumpPlayDead, bumpResolveDead, fragmentHandlerSongsMap } = require("./core/19-dispatch.js");
const { resolveCrossPlatformCandidate, crossSearchPlatform, pickCrossCandidate, scoreCrossCandidate, crossVariantCompatible, crossVariantWords } = require("./core/21-cross-search.js");

const { tryCrossPlatformFallback, CROSS_PLATFORM_ORDER, buildCrossTargetInfo, getUrlWithFallback, actualDeliveryPlatform, resolveBudgetBounds, buildSourceChain, computeEligibility, noteQualityCeiling, fragmentUrlMap, admit, coldStartWarmAt, fragmentSourceMap, FRAGMENT_SOURCE_TTL_MS, isResolveDead, isPlayDead, BREAKER_COOLDOWN_MS, canExecute, isQualityHopeless, previewCooldownMap, deliveryQualityMap, admissionLedger, PLAY_DEAD_STREAK, qualityLedger } = require("./core/22-chain.js");
const { kuwoOfficialGetUrl, kuwoOfficialSearch } = require("./core/24-kuwo-official.js");

bindDep('BREAKER_COOLDOWN_MS', BREAKER_COOLDOWN_MS);

bindDep('SOURCE_MAX_CONCURRENCY', SOURCE_MAX_CONCURRENCY);

bindDep('RATE_WINDOW_MS', RATE_WINDOW_MS);

bindDep('RATE_WINDOW_MAX', RATE_WINDOW_MAX);

// ---------- v9.0 拆包：02-error-codes 已迁至 src/core/02-error-codes.js（原地引入）----------
const { ERROR_CODES } = require("./core/02-error-codes.js");

// v8.11.1（二轮审计补）：全仓 65 处 `throw new Error("CODE: msg")` 只把码写进 message、
// 没赋 err.code。音乐主链末尾有 finalErr.code 兜底，但 lyric/pic/toggle 这类**直连 action**
// 不经聚合，App 拿到的 err.code 是 undefined → 无法分类、显示"未知错误"。
// 这里在出口统一按 message 前缀归一（不逐个改 65 处，零风险）。

// v8.11.1（审计补）：新增的交付类错误码在 App 侧没有专门文案，App 只原样展示 message。
// 给它们补一句中文可读说明，避免用户看到裸英文码；格式仍是「CODE: 中文（技术细节）」，
// 冒烟/巡检按 code 前缀判定，不受影响。
// ============================================================
// v8.13：协作式取消令牌
// QuickJS 宿主没有 AbortController；这里做的是「编排层真取消」：
// 令牌一旦 cancel，所有后续步骤（重试、验真、降档、交付）立即抛 CANCELED，
// 竞速输家不再占用预算与上游连接，也不再把失败写进健康账本。
// ============================================================
// ---------- v9.0 拆包：04-cancel 已迁至 src/core/04-cancel.js（原地引入）----------
const { createCancelToken, canceledError, throwIfCanceled, raceWithCancel } = require("./core/04-cancel.js");

// ---------- v9.0 拆包：05-verdict 已迁至 src/core/05-verdict.js（原地引入）----------
const { ADMISSION_POLICY, normalizeErrCode, crossFallbackPolicy } = require("./core/05-verdict.js");

// v1.0：失败缓存差异化 TTL（404=歌确实不存在，缓存1h；410=签名死链，很快恢复，缓存1min；网络类/限流=瞬时，不缓存）

// API 端点
// GD Studio（实测：仅网易云 netease，br=999→真实flac/br=320→320k/br=128→128k；免费公共服务，5分钟50次限制，仅用于wy高音质链，不进128k兜底竞速）

// 溯音系（实测：仅 Kuwo 可用；QQ -403维护中；163 免费歌恢复可用；咪咕 502 IP限制）
const { validateProviderContracts, KNOWN_COVERAGE_GAPS } = require("./core/12-provider-contract.js");
const { suyinMiguGetUrl, buildSearchKeywords } = require("./core/30-suyin-extra.js");
const { suyinQQGetUrl, getQQSongId } = require("./core/31-suyin-qq.js");

// ============================================================

// v9.0 业务层 · 33-cross-cache（跨平台兜底缓存（容量/过期/键构造））
// ============================================================

const SUYIN_163_API = "https://oiapi.net/api/Music_163";

// v9.0 业务层 · 34-breaker-state（熔断与摘除状态（熔断计数、播放/解析摘除、音质短路））
// ============================================================

// Huibq：实测仅酷我真实可用，其他平台假兜底（35-source-switch 中 huibq 默认开启）

// 聆川（未配置，默认关闭；2026-11-06 实测域名不可解析已死，保留常量便于恢复，probe 已排除该域名）
// ---------- v9.0 拆包：10-vendors 已迁至 src/core/10-vendors.js（原地引入）----------
const { REPORT_QUALITIES, INFLIGHT_URL_MAX, buildInflightKey, sourceConfig, PLATFORM_NAMES } = require("./core/10-vendors.js");

// 星海后端主域聚合（v1.0重新接入kw；v1.0起支持 kw 128k/320k/flac 三档，E10实测四档code200+206可播+ID3对应；wy 签名URL本机403疑绑定后端出口IP，未接入wy）

// 网易云官方 outer 直连（免费歌302→真实mp3；VIP/无版权歌404自动跳过；固定128k）

// v3.0：歌词/封面接口（实测：网易云公开 lyric/detail 接口可用；酷我仅封面 hts_MVPIC 可用，歌词无稳定接口）
// ---------- v9.0 拆包：歌词封面已迁至 src/core/14-lyric.js（依赖注入）----------
const { getLyricForPlatform, httpGet, getPicForPlatform } = require("./core/14-lyric.js");

// 酷我官方直连（自研：搜索r.s→rid→convert_url，固定128k真实mp3，无第三方）

// v8.12：跨平台兜底——目标平台搜索端点。
// 关键约束：各平台 ID 不通用（kw 的 rid 喂给 tx 源必失败），所以必须先搜到目标平台自己的
// songmid/id/rid，再用目标平台源链取链；这里只做「歌名+歌手+时长」严格身份匹配。

// v8.13 平台化：suyinKuwo 的 mg/kg/tx/wy 入口实际仍是酷我搜索+酷我 CDN，
// 标签必须回填实际平台 kw，不能把酷我链冒充成咪咕/酷狗/QQ/网易。
// 其他源如未来出现跨平台复用，必须在这里显式登记，禁止静默沿用请求平台。

bindDep("actualDeliveryPlatform", actualDeliveryPlatform);

// ikun 服务器源（v8.1：域名迁移 api.ikunshare.com→c.wwwweb.top；公益版免卡密（X-Api-Key 留空），付费版填 USER_CONFIG.ikunApiKey；2026-11-06 实测 rid=228908 晴天出真实128k链）

// 长青SVIP（实测：仅 kw 上游有历史可用通道；tx/wy/kg/mg 无稳定上游，已失效，默认关闭）

// v7.0：helloworld 源（生态候选，2026-10-29 实证：kw 全链端到端可用——flac/320k 直链 Range206+魔数校验通过）
// 通道①：酷我官方 convert_url_with_sign（rid 直取，与 kuwoOfficial 同链路族但独立子源计数；flac24bit 被服务器降级 128k，按实际交付）

// 通道②：haitangw v1 新版 API（code:0 + data.url 直接匹配，实测可用；作为通道①的备用）

// ============================================================
// 第二部分：音源开关（按实测结果配置，可自行调整）
// ============================================================

bindDep('SOURCE_TOGGLES', SOURCE_TOGGLES);

// ============================================================
// 第二部分B：健康探测模块（v1.0：探测清单收敛为当前可用源 + 并发探测 + 统一跟随302）
// ============================================================
// 运行时开关：随探测结果自动变化；buildSourceChain 以它为准
// v8.14：用户意图与自动状态分离。
// userEnabled = 用户是否愿意使用该源；autoOff = 系统因连续探测失败临时关闭。
// 运行期不再维护 runtimeToggles 镜像；需要“当前是否可用”一律走 effectiveEnabled()。

bindDep('userEnabled', userEnabled);

bindDep('autoOff', autoOff);

bindDep('autoOffReason', autoOffReason);

bindDep('autoOffAt', autoOffAt);

bindDep('isUserEnabled', isUserEnabled);

bindDep('effectiveEnabled', effectiveEnabled);

// 测试夹具：runtimeToggles 是 userEnabled/autoOff 的只读投影 + 写回 userEnabled。
// 生产代码不得读取它；仅 __debug 暴露给审计脚本做临时开关。

// v4.0：用户手动关闭锁定——手动 toggle(false) 的源，探测通过也不再自动启用（除非用户手动开启）

bindDep('manualOff', manualOff);

bindDep('manualOffAt', manualOffAt);

// ---------- v9.0 拆包：健康巡检 / 健康持久化已迁至 src/core/17-health-check.js、18-health-persist.js ----------
const { startHealthCheck, probeSchedule, hasActiveWork, runHealthCheck, inflightUrl, buildProbeConfig, tierShouldProbe, probeSingleSource, applyProbeResult, getHealthSnapshot, healthHistory, HEALTH_HISTORY_MAX, computeHealthScore } = require("./core/17-health-check.js");
const { restoreHealthState, checkHealthForbiddenKeys, isAcceptedSourceVersion } = require("./core/18-health-persist.js");

// v3.0：分级探测——核心源(播放主链路)每轮探测，次要源每3轮一探（省请求且减少对免费源的骚扰）

// v3.0：失效源休眠——连续3轮失败进入休眠(不再每轮空打)，每10轮做一次复活试探（新端点/上游恢复时自动回归）

// v1.0：探测歌曲池轮换（晴天/海阔天空/稻香），避免单曲被风控导致探测误判
// v1.0 (D9)：溯音163 探测免费歌池（实测 code:0 + data[0].url 真实mp3；186016周杰伦VIP无url已排除）

// v6.0 (A2)：Juhe 协议型探测配置工厂（POST /platform，校验服务端 code 200/303）

// 各源探测请求定义：仅保留当前可用源，失效源不再每轮空打

bindDep("buildProbeConfig", buildProbeConfig);

// v3.0：分级探测轮次判定（core 每轮 / secondary 每 N 轮一探）

bindDep("tierShouldProbe", tierShouldProbe);

bindDep('probeState', probeState);

bindDep("probeSingleSource", probeSingleSource);

// v1.0：探测结果并入竞速统计（见 probeSingleSource）
// v3.0：探测样本独立计数（probe*），与真实请求样本分级加权——探测仅作低权重参考，真实请求主导健康评分

bindDep("applyProbeResult", applyProbeResult);

// v8.0：健康历史趋势记录（每次自动探测完成后存一条）；v8.10：上限 60→144（10min/条 ≈ 24h）

// 2.4 方案：音源侧只读事件环形缓冲。
// 只服务本地排障：记录"一次播放走到哪个子源、哪一步、什么错误码、多久"，
// 不记歌名、URL、搜索词、账号、设备 ID、位置。App 通过 healthEvents action 只读拉取。
// ---------- v9.0 拆包：03-events 已迁至 src/core/03-events.js（原地引入）----------
const { HEALTH_EVENT_FIELDS, assertEventFieldPolicy, clipText, recordHealthEvent, getHealthEventFieldAudit, getHealthEvents, attachHealthTrace, getHealthEventSeq } = require("./core/03-events.js");

// v8.16：事件白名单的**源码侧对偶**——测试侧（s-health-events S5）只验「文本里没有隐私字段名」，
// 一旦有人把 name/url/songmid 加进白名单，行为层抽样未必覆盖得到。这里让口径自己守自己：
// 加载即校验，含隐私字段或重复项直接抛 CONTRACT_ERROR（与 Provider Contract 同一条「宁可起不来」策略）。

assertEventFieldPolicy();   // 加载即守：白名单漂移不必等测试跑

bindDep("runHealthCheck", runHealthCheck);

// F21：探测 jitter + 播放中暂停。
// 固定 10min 会让所有实例同一秒打上游；这里给 ±10% 抖动，并在有真实取链/播放流量时
// 只延后探测，不打断用户请求。探测本身不走 wrapExecute，不会自己把自己判成“忙”。

bindDep("hasActiveWork", hasActiveWork);

bindDep("startHealthCheck", startHealthCheck);

// v1.0 P0-6：上报 qualitys 按真实能力裁剪——不再上报无人能交付的 flac24bit

// v2.0 (E11)：音质映射 magic number 收敛——统一 QUALITY_TO_X 表，按官方"源内映射"模型组织（请求音质 → 各源内部编码）
// 各子源只从本表取编码，禁止散落 magic number（gdBrMap 等已并入）

// v1.0 P0-4：实际音质降级阶梯（去掉无源区分的192k短接），请求音质放首位再向下降级

// v1.0 P0-1：音质等级数值，用于源能力过滤与缓存音质校验

// v8.15（P0/P1）：音质策略失败分类——能力备档与档位短路共用同一套语义。
// 注意：这里的 definitive 指“对音质能力有结论”的失败；NOT_FOUND/MISMATCH 只说明这首歌没有，
// 不直接说明该源该档坏了，故不进入档位短路；但可用于能力备档（该歌确实只到低档）。

const { EVENT_NAMES, request, on, send, utils, env, version } = globalThis.lx;

// ============================================================
// 第三部分：日志 + LRU双层缓存 + 断路器
// ============================================================
// v1.0 D11：console 宿主防御 — 官方移动版「可用宿主环境 API」仅 setTimeout/clearTimeout（无 console 保证）
// 依据：lxmusic.toside.cn/mobile/custom-source 宿主 API 清单 + fork user-api-preload.js 未注入 console + vm 无 console 沙箱复现（修复前加载即抛 TypeError）
// ---------- v9.0 拆包：01-log 已迁至 src/core/01-log.js（原地引入）----------
const { LOG_DEBUG, logInfo, logDebug } = require("./core/01-log.js");

// v1.0：debug 级源级决策日志（默认关；排查时改 LOG_DEBUG=true 或宿主注入 __lxSourceConfig.logDebug=true）

// v1.0：直接用原字符串作 Map 键（Map 支持字符串键），省掉32位哈希与碰撞覆盖

// 五轮 MEM：带上限的 Map 写入，超限淘汰最早插入的一条（Map 迭代顺序即插入顺序）。
// 上限读 cfg('memoryMapMax')，默认 MEMORY_MAP_MAX、硬顶 20000（PARAM_LIMITS 校验）。

bindDep('boundedMapSet', boundedMapSet);

// v1.0：失败缓存 LRU 不再用固定5min TTL——过期由 getFailCachedEntry 按失败类型差异化判断(404→1h/410→1min/网络错误不缓存)

bindDep('breakerMap', breakerMap);

// v8.11 闸门旁路状态

bindDep('deliveryQualityMap', deliveryQualityMap);

bindDep('fragmentSourceMap', fragmentSourceMap);

// v8.11.1（审计补）：不持久化的取舍——上限记忆只服务「同一进程内 6h 内重复点同一首」的降档试错，
// 进程重启后重新探一次成本极低（一次 flac 请求即被验真判降级后回落），引入文件/宿主存储的复杂度与风险更大。

bindDep('FRAGMENT_SOURCE_TTL_MS', FRAGMENT_SOURCE_TTL_MS);

bindDep('previewCooldownMap', previewCooldownMap);

bindDep('fragmentUrlMap', fragmentUrlMap);

bindDep('fragmentHandlerSongsMap', fragmentHandlerSongsMap);

// v7.0：播放实时失败摘除——真实播放请求连续失败 ≥PLAY_DEAD_STREAK 次即从竞速链摘除（不等探测周期）；
// 复活三路径：①播放成功即时解除；②探测通过解除（探测清单内源）；③摘除冷却期满后自动半开试探（不依赖探测清单，失败重新计时）
// 与 manualOff 用户锁定分层：手动关闭永不复活

bindDep('PLAY_DEAD_STREAK', PLAY_DEAD_STREAK);

bindDep('playDeadStreak', playDeadStreak);

// v8.16.4（疑-31）：播放摘除的「归因档」。真实播放失败带 quality 回传，若三次失败都落在同一档，
// 说明很可能是该档本身播不了（大文件/该档链接/CDN 分片），不该把同一源其他还能播的档一起摘掉；
// 一旦失败跨档，说明是源/链路级问题，清空归因 → 退回源级摘除（保守）。

bindDep('playDeadQuality', playDeadQuality);

bindDep('playDeadDeadline', playDeadDeadline);

bindDep('playDeadTrialAt', playDeadTrialAt);

// v8.16.2（R-05）：写入侧用裸 sourceId、清理侧却按 `sourceId|` 前缀匹配 → 永远删不掉，
// 一轮摘除后 60s 内再也放不出半开试探（默认 300s 冷却把症状掩盖成“能自愈”）。
// 清理必须同时删裸键与历史前缀键，兼容旧版本写入的 `sourceId|quality` 形态。

bindDep('clearPlayDeadTrials', clearPlayDeadTrials);

// F42：取链失败与真实播放失败分层。resolveDead 只由“取链/准入失败”累计，
// playDead 只由 App reportPlayback 的真实播放失败累计；二者都阻塞执行，但解除路径不同。

bindDep('resolveDeadStreak', resolveDeadStreak);

bindDep('resolveDeadDeadline', resolveDeadDeadline);

bindDep('resolveDeadTrialAt', resolveDeadTrialAt);

bindDep('clearResolveDeadTrials', clearResolveDeadTrials);

bindDep('clearResolveDead', clearResolveDead);

bindDep("isResolveDead", isResolveDead);

bindDep("isPlayDead", isPlayDead);

bindDep('getBreaker', getBreaker);

// v8.14（F39/F41）：熔断/限流必须按“源×档”记账。旧账只有源级 state，flac 坏了会连 128k 一起停。
// 这里给每个档位补独立的 breaker/rateLimit 槽；旧的源级字段继续保留，作为“全档不可达”的聚合摘要。

bindDep('qualityLedger', qualityLedger);

// 源级 state 只做聚合：所有已建账档位都 open 才 open；任一半开则半开；否则 closed。
// 这样 flac 熔断不会误伤 128k，但“全档都不可达”仍能从源级一眼看出。

// v4.0：429 限流单独处理——退避时长由 rateLimitBackoffMs 统一决定（默认 30s），不计入熔断阈值；连续≥3 次标记"被限"
// cooldownMs 只在策略显式给出正数时覆盖配置；0 = 使用配置值。

bindDep("recordRateLimit", recordRateLimit);

// v8.11.2（D-34，V25b 实测暴露）：半开试探被「本地拦截」挡下时必须退回 open。
// 旧实现只在 wrapExecute 的 catch（handler.fn 之后）里做这件事，但 canExecute/throttleCheck
// 都在 try 之前抛 isThrottleSkip——catch 根本捕不到，状态就停在 half-open；
// 而 canExecute 对 half-open 恒返回 false → 该源永久不被调用，只能重启救回（F-01 卡死）。

bindDep("canExecute", canExecute);

// v8.16.2（R-02）：请求高档、实交付低档 = 该档「确定性交付降级」样本。
// 只累计 definitiveFail，不进 req/success（这不是一次该档的成功请求）；
// isQualityHopeless 以 definitiveFail>=N && success===0 判短路，连续 3 次降级即短路该档。
// 反过来只要该档真交付过一次（success>0），短路判据立刻失效——不会误封能出高质的源。

// v8.10.3：播放失败累计抽成单点——半开试探失败同样算一次真实播放失败（旧实现 return 跳过累加，
// 与"真实播放失败累计"的注释语义不符，导致反复半开失败的源永远凑不够摘除阈值）

bindDep("recordFailure", recordFailure);

// v4.0：版权/业务失败单独计数（无版权404、歌不存在、错歌等——源已正常响应，只是这首歌没有/需VIP）
// 不惩罚健康分、不计入成功率分母、不触发熔断

// v3.0：源健康权重自学习——健康评分 = 真实样本成功率(置信度收缩) − 均时惩罚 − 连续失败惩罚
// 内部评分区间 −1~1（无样本基线 0：无样本按 9999ms 最劣均时惩罚压分）；v7.0 起快照输出 ×10 为 10 分制（0~10），内部排序/熔断仍用 −1~1
// 探测样本仅在无真实请求样本时整体采用（同 K=4 收缩）；有真实样本时探测不参与（非固定 0.3 混合权重）

bindDep("computeHealthScore", computeHealthScore);

// ============================================================
// 第四部分：HTTP 请求封装
// ============================================================
// ---------- v9.0 拆包：07-net 已迁至 src/core/07-net.js（原地引入）----------
const { httpRequest, RETRY_TIMES, getMobileUserAgent, successCache, setCachedUrl, getFailCachedEntry, setFailCached, buildCacheKey, failCache } = require("./core/07-net.js");

// v8.14.1：预算边界统一入口。总预算与末档保底共享 16s 硬顶，
// 防止 raceBudgetMs/raceBudgetFloorMs 各自合法但叠加后越过 App 桥 23s。

bindDep("resolveBudgetBounds", resolveBudgetBounds);

// v1.0 P0：轻量音频可播性判定——Range 取前1KB，206/200音频即视为可播
// v8.10.4：区分「确定死链」与「校验未完成」——410/403/404 判死链；超时/网络/5xx/429 抛出交给竞速按网络类处理
// v8.16.2（R-12⑦）：活着但内容不是音频 ≠ 死链。旧调用方把 `false` 一律翻译成 LINK_EXPIRED（410 死链语义），
// 于是 1min 死链缓存 + 180s 冷却，与「内容性结论」该走的短路账本完全不同。这里带码抛出，让调用方按 NOT_AUDIO 记账。

bindDep("isAudioPlayable", isAudioPlayable);

// ============================================================
// v8.11 交付真实性闸门
// 用一次 Range(1KB) 同时得出：魔数 / 真实格式 / 真实码率 / 真实时长
// 实测依据：FLAC 的 STREAMINFO 与 MP3 的 Xing/Info 头都在文件开头，1KB 足够
//   （《晴天》269.7s / VIP 歌 5.3s / 溯音 199.4s 全部解析正确）
// ============================================================

// 取单字节：兼容宿主返回 Buffer 或字符串（字符串场景下 ASCII 部分仍可读）

// FLAC：读第一个 STREAMINFO 块，totalSamples / sampleRate 得精确时长
// ---------- v9.0 拆包：08-media 已迁至 src/core/08-media.js（原地引入）----------
const { mediaEnvelopeErrorCode, sniffAudioBytes, kindOf, toBytes } = require("./core/08-media.js");

// MP3：跳 ID3v2 → 找帧头 → 读 Xing/Info 帧数

// 字节嗅探：返回 { kind: audio|playlist|html|json|unknown, format, durationSec, bitrateKbps }

// 把真实格式/平均码率映射回音源体系里的音质档。
// m4a/ogg/wav 之前一律保留请求档，导致「请求 flac、实给 128k m4a」仍标 FLAC；
// 这里在能拿到完整 content-length + 歌曲时长时按平均码率回填，拿不到才保留请求档。

// 档位置信度：不把估算档宣称为精确真实档

// 原曲时长（秒）：兼容 ms / 秒 / "mm:ss"
// v8.16.2（R-12②）：子源解析出的时长走「旁路提示」，不再回写调用方对象。
// 旧实现 `songInfo.duration = parsed.duration` 直接改 App 通过桥传进来的 musicInfo（跨桥副作用，
// 同一首歌后续请求会带上被改过的字段）；但 D-39 的时长校验又确实需要这个值，
// 所以改为按对象记在内部表里，由 originalDurationSec 读取，调用方对象保持只读。

// v8.16.2（R-12② 修正）：子源解析到的时长还须按「歌曲身份」留一份。
// 原因：suyinKuwoGetUrl 的兜底档会传 `{name, duration}` 浅拷贝给搜索函数（D-31 故意丢 singer），
// hint 挂在那个临时对象上，外层验真拿到的却是原始 songInfo —— 只按对象键存会读不到，
// 时长校验（D-39）随之失效（V39a 实测放行）。身份键用 hash 优先、退化到 歌名|歌手。

// 兜底档传进来的浅拷贝只剩歌名（singer/hash 被有意丢掉），键要与完整对象对得上，
// 故额外留一份「仅歌名」键；读取时 hash → 歌名|歌手 → 仅歌名，逐级回退。

bindDep("setDurationHint", setDurationHint);

// ============================================================
// L4 前置：L0 宿主通道层（形态归一 + 单一形态判定）
// ------------------------------------------------------------
// 真机事故（2026-11-10）：App 原生桥 sendAction 对二进制体做 JSON.stringify，
// Buffer 变成 {type:'Buffer',data:[0,1,…]}。判据只认 ArrayBuffer 视图 →
// 「拿不到字节」被当成「不是音频」→ 全部源 NOT_AUDIO → 代表码 NOT_FOUND →
// 1 小时歌级锁 → 用户看到「该请求已知失败(缓存中)」。
// 结论：字节「是不是原样到达」是通道问题，不是交付问题。这里先归一，再判形态。
// ============================================================

// 手动 base64 解码（真机 QuickJS 没有全局 Buffer，不能依赖宿主）

// P2 桥媒体信封：{__lxMedia:2, encoding:"base64", byteLength, body?/chunks?}
// 只认显式版本号；byteLength 不符视为通道损坏，宁可返回 null 也不把半截字节交给验真。

// P2 负向归因：只对「显式信封」返回错误码；普通无法识别体仍返回 null，交给既有降级。

// 任意交付体 → 字节（认不出返回 null，绝不抛）

// 单一形态判定：audio | json | html | playlist | empty | bytes | unknown
// 全仓「这是什么形态」只允许走这里（字节细则仍复用 sniffAudioBytes）

// 无字节时的「响应头证据」：只信头，不装懂。
// 返回 { ok:true|false|null, code?, reason?, evidence:"medium"|"weak"|"strong", info }

// 一次 Range(1KB) 取真实字节
// v8.11.5：GET 拿不到字节、响应头又不足以判定时，补一次只取头的探针。
// HEAD 优先（1500ms）；HEAD 被 CDN 拒（405 等，httpRequest 统一抛 NETWORK_ERROR）再退回
// GET Range: bytes=0-0——只读响应头，不下载正文。只补「头能判死/能判放行」的结论，
// 仍判不出就保持 ok:null（拿不准不放行也不判死）。

// 交付前验真：返回 null 表示无法判定（放行）

// ============================================================
// L4 裁决层（Admission）：一个函数 + 一张表 + 三个调用点
// ------------------------------------------------------------
// 边界铁律：不发请求、不调度、不写状态；只回答两件事——
//   ① 这次交付是什么结果（verdict + code + evidence）
//   ② 该记什么账（ledger：TTL / 健康分类 / 是否摘除 / 源冷却）
// 读侧只允许 skipReason()，写侧只允许按 ledger 记账；不允许再出现散落的 if(code)。
// ============================================================

// 代表码优先级：确定性业务码(1) < 交付类码(2) < 网络类码(3)。高优先不被低覆盖。
// 旧实现把 NOT_FOUND 设成"一旦出现即固定"，直接吞掉 NOT_AUDIO → 60s 变 1h（真机事故现场）。
// 数值越大越优先。**交付类码（3）必须高于「歌不存在」类（2）**——
// 旧实现把 NOT_FOUND 设成一旦出现即固定，会直接吞掉 NOT_AUDIO（60s 变 1h，真机事故现场）。

// 片段判定（与 verifyDelivery 同阈值，抽出来供 admit 复用）

/**
 * 唯一裁决入口（纯函数，幂等，不写任何状态）
 * input = { stage, platform, quality, songInfo, source, delivery, error, trialMark, attempts }
 * delivery = { statusCode, headers, body, totalBytes }
 * attempts = [{ code, evidence, reason }]
 */
// 接口层试听标记识别（社区同做法：jiexiang/xinglan 在拿到 playurl/privilege 时就判，不必等 Range）
// 只认「明确结构化字段」，认不出就返回 false —— 不做启发式猜测，避免把正常歌当试听。

bindDep("admit", admit);

// 读侧唯一查询：能不能用这个源（null=可用）
// 纯结构判据（无副作用）：建链阶段只能问这三个，不能碰 breaker/限流——
// canExecute() 会把 open 推进到 half-open，在建链时调用会提前消耗掉半开试探。
// v8.14：统一资格入口。v2 优先级：
// USER_OFF > AUTO_OFF_PROBE > SOURCE_SLEEPING > PLAYBACK_FAILED > SOURCE_UNREACHABLE
// > QUALITY_OPEN > QUALITY_SHORT_CIRCUIT > RATE_LIMITED > PREVIEW_COOLDOWN > LOCAL_THROTTLE > COLD_START > ELIGIBLE
// 链构建只跑结构层（runtime=false），诊断 skipReason 再叠加运行期层（runtime=true）；
// 半开试探只有链构建传 consumePlayDeadTrial=true 才会消费，诊断/UI 不会消耗试探额度。

bindDep("computeEligibility", computeEligibility);

// 源级开关唯一入口：开/关都清账（对称），并把动作写进日志

bindDep("toggleSource", toggleSource);

// 写侧唯一清账：开开关 / 播放成功 / 面板重置，都走这里。
// F38 scoped reset：默认 all 保持旧行为；authority 只清用户相关账（失败缓存/摘除/熔断/限流/探测态），
// 保留 byQuality 的 req/success/fail/linkExpired 质量历史，供趋势/诊断继续可见。

// 写侧唯一记账入口：裁决结果 → 既有状态机（reducer）。
// 只允许这里把 ledger 翻译成 record* 调用；调用点不再自己 if(code)。

// 记录「该源对该歌只给片段」，并在同一源连续三档都片段时判定源级限流（实测：风控状态下所有歌都返回同一 84972 字节片段）

bindDep("rememberFragmentSource", rememberFragmentSource);

// 取该歌已判定为片段源的集合（降档时跳过；128k 档例外，永远给最后一次机会）

// 读实交付音质（供标签回填）

// 能力备档：记录该歌实际最高可得档，下次直接从该档起。
// v8.15（P0）：同档/更低档重复交付不得刷新 recordedAt/nextProbeAt；否则用户持续播放
// 会让一次临时降级永久续期。只有实际档位升高、或旧条目已过期时才重写。

// ============================================================
// 第五部分：歌曲信息与匹配工具
// ============================================================
// v1.0 (D10)：已移除死代码 normalizeQuality/selectQuality/qualityToNetease（链级统一降级，源内直接使用请求音质）

// v4.0：UA 池轮换——多套移动 UA 按请求计数器轮换，降低单 UA 被上游风控识别的概率

// v1.0 (D10)：已移除死代码 getSongId

bindDep("getQQSongId", getQQSongId);

// v1.0 (D10)：已移除死代码 normalizeSongInfo/getFirstData

// v8.12：跨平台身份归一——与 normalizeKeyword 分开，避免改变既有搜索/匹配语义。
// 关键点：日文假名必须保留。旧 normalizeKeyword 的 [^\w\u4e00-\u9fa5] 会把
// 「ほんま　めいこ」整段删成空串，titleMatch 再因空串 return true，同名翻唱因此被放行。

// 严格歌手匹配：目标歌手已知而候选歌手为空 → 拒绝（宁可 NOT_FOUND，不交付错歌）

// 严格歌名匹配：两边都归一后必须相等或互相包含且短串 ≥4，避免「Cry」匹配到「Cry For Me」

bindDep("crossVariantWords", crossVariantWords);

bindDep("crossVariantCompatible", crossVariantCompatible);

bindDep("scoreCrossCandidate", scoreCrossCandidate);

bindDep("pickCrossCandidate", pickCrossCandidate);

bindDep("buildSearchKeywords", buildSearchKeywords);

// v1.0 P0-1 (D1)：片段/试听特征词。必须对原始歌名匹配（normalizeKeyword 会删括号内容，如"难却(15秒0.8x片段)"归一化后与"难却"相同）

// v8.0：试听片段URL检测——酷我VIP试听片段(5秒)URL特征
// 实测发现 helloworld 源部分歌曲返回的是酷我VIP试听片段链接（能播但只有5秒）
// 检测URL关键词，命中即判定为试听片段

// v8.16：QQ 官方 CDN 的试听链是 `/RS0…` 前缀（xinglan 候选实测：该前缀 960,887 bytes vs 全曲 10,792,943，
// 差 11.2 倍）。全曲是 `M800…`/`M500…`，前缀不同，所以这是结构特征不是猜词。命中仍需 Range 复核。

// v1.0 P0-4 (D4)：时长归一化到秒（兼容 ms/秒混用：>5000 视为毫秒）

// ---------- v9.0 拆包：09-match 已迁至 src/core/09-match.js（原地引入）----------
const { titleMatch, normalizeKeyword, QUALITY_TO_X, QUALITY_PRIORITY, PLATFORM_QUALITIES, getQualityCeiling, classifyQualityFailureCode, qualityCeilingMap } = require("./core/09-match.js");

// v8.10.3：huibq 假成功判据单点化——上游对无版权/取链失败仍返回 code=0，但 msg 带失败词
// （实测"无法获取播放链接！" + panspace 酷我链 206 可播 = 错歌）。v8.7 只把它用在取链路径，
// 探针没有同款判据 → 上游假成功时探针判"健康"、源被抬高排序且不会被自动关闭。

bindDep("isHuibqFailMsg", isHuibqFailMsg);

// v8.11.2（C-1）：交付前协议白名单断言。
// 旧行为：上游给了 javascript:/data:/file: 时，先发请求判"不可播"，被归成
// LINK_EXPIRED(CDN 410)——排障看到"签名URL已过期"，实际是协议非法。
// 这里先判协议，非法直接 PARAM_ERROR，不进入验真。

bindDep("assertDeliverableUrl", assertDeliverableUrl);

bindDep("validateUrl", validateUrl);

// v1.0 P0-3 (D2)：kw CDN 音频链 http→https（实测 https 升级后 206 可播，部分网络/播放器对 http 音频处理异常）

// v1.0 P1：缓存 key 加入 songId 维度，避免同名不同版本冲突

// v1.0 P1：缓存值记录实际音质 {url, quality}，命中/过期兜底时校验
// v8.10：高音质缓存分级 TTL——flac/320k/24bit 用 30min（链接有效期短），128k 用 6h

// v1.0：失败缓存差异化——按失败类型记录，get 时按差异化 TTL 判断过期（404→1h / 410→1min / 网络错误不缓存）

// v8.10.3：返回整条记录（而不是布尔）——失败缓存命中时要还原当初的代表性失败码，
// 否则 App 只能看到 NOT_FOUND，把"网络全挂 30s 短缓存"当成"这首歌不存在"

// ============================================================
// 第六部分：音源实现
// ============================================================

/* 网易云官方 outer 直连（免费歌302直链，固定128k，VIP/无版权歌404自动跳过） */

bindDep("wyOuterGetUrl", wyOuterGetUrl);

/* 酷我官方直连（自研：搜索 r.s → rid → convert_url，固定128k真实mp3，无第三方） */

bindDep('kuwoOfficialSearch', kuwoOfficialSearch);

/* ============================================================
 * v3.0：歌词/封面透出（App fork 已支持 lyric/pic action，音源声明即注册）
 * 实证：网易云公开 lyric(带时间标签) / detail(picUrl) 接口可用；酷我搜索 abslist 含 hts_MVPIC 封面；
 *      酷我歌词无稳定公开接口、tx/kg/mg 无签名接口 → 对应平台不声明，App 自动走内置源兜底
 * ============================================================ */

// 酷我封面搜索（单引号 Python repr → 清洗 JSON，取 abslist[0].hts_MVPIC）

// 歌词透出：仅 wy（网易云公开接口），返回 {lyric, tlyric, rlyric}（App verifyLyricInfo 校验 lyric 非空且≤51200）

// 封面透出：wy 用 detail 接口 picUrl；kw 用搜索接口 hts_MVPIC；返回 https 字符串 URL（App 校验）

bindDep("kuwoOfficialGetUrl", kuwoOfficialGetUrl);

/* v7.0：helloworld(kw)——生态候选实证接入（2026-10-29 全链端到端验证通过）
 * 通道① convert_url_with_sign（rid 直取，128k/320k/flac 三档真实返回，flac24bit 被服务器降级 128k 按实际交付）
 * 通道② haitangw v1 resolve-url（code:0 + data.url 直接匹配，作通道①备用）
 * 设计对齐既有源模式：ID 提取 → 请求 → JSON 校验 → https 升级 → Range 可播性二次校验（防签名死链） */

bindDep("helloworldKwGetUrl", helloworldKwGetUrl);

/* ikun 服务器源（v8.1：域名迁移 api.ikunshare.com→c.wwwweb.top，接口 GET /url→POST /music/url；
 * 公益版免卡密（X-Api-Key 留空即可用），付费版填 USER_CONFIG.ikunApiKey；
 * 2026-11-06 实测：POST /music/url + {source,musicId,quality} → code200 + 真实128k链（https 206 audio/mpeg 可播） */

/* GD Studio（v1.0接入：仅wy，br=999真实flac/br=320 320k/br=128 128k；限5min50次，仅用于wy高音质链，高音质优先、不进128k兜底竞速） */

/* 星海备（实测域名不可解析，默认关闭，保留函数便于恢复） */

/* 星海后端主域聚合（v1.0：仅 kw；v1.0：128k/320k/flac 三档，E10 实测） */

/* Huibq（实测仅酷我真实，其他平台假兜底；默认开启见 35-source-switch） */

bindDep("huibqGetUrl", huibqGetUrl);

/* 聆川（未配置，默认关闭；v2.0 密钥从 USER_CONFIG.lingchuanApiKey 读取，开配置即用） */

/* 溯音QQ（实测-403维护中，默认关闭） */

bindDep("suyinQQGetUrl", suyinQQGetUrl);

/* 溯音163（免费歌真实128k直链，VIP歌url:null自动跳过，默认开启） */

/* 溯音酷我（实测可用：核心音源 + 全平台兜底，支持flac/320k/128k） */

bindDep("suyinKuwoSearch", suyinKuwoSearch);

// ---------- v9.0 拆包：链路辅助已迁至 src/core/13-chain-helpers.js（依赖注入）----------
const { suyinKuwoGetUrl, skipReason, sortChainByHealth, getUrlWithCrossPlatformFallback } = require("./core/13-chain-helpers.js");

/* 溯音咪咕（实测502，默认关闭） */

bindDep("suyinMiguGetUrl", suyinMiguGetUrl);

/* 溯音统一入口 */

/* 长青/念心SVIP（v1.0实测仅kw恢复：302→car-er.kuwo.cn新鲜mp3；其余平台仍403/401/404；v1.0 D10模板工厂化） */

// v4.0：Juhe 聚合API(CF)——kw 平台 303 重定向校验协议（实测：POST /kw 返回 request+check 规则，
// 再请求重定向 URL，校验 body.code==200 后取 body.data.url 为真实直链）

// v8.16：晴亮（qingliang）tx 线路。生态扫描候选里唯一实测能出全曲的一条，只取 tx。
// 取链必须带 Referer（不带会被拒）；它返回的 aqqmusic.tc.qq.com 直链实测"裸请求"也能 Range 206 / audio/mpeg，
// 不依赖 UA、不依赖 Referer——播放器拿到就能播。
// 超时/重试/竞速/预算/取消一律由上层（raceWithBudget / getUrlWithFallback + cancelToken）掌握，
// 这里只留一个防悬挂上限，不复刻候选脚本自带的 3s 超时：两套超时会互相打断，
// 表现为"外层预算还剩 5s，内层 3s 就 abort 了"，白丢一次竞速机会。

bindDep("qingliangTxGetUrl", qingliangTxGetUrl);

bindDep("changqingGetUrl", changqingGetUrl);

// v3.0：健康统计快照——供 App 健康面板/巡检消费；返回各源成功率/均时/熔断状态/健康分
// v8.14：offReason/offAt 单一来源；与 computeEligibility 的优先序保持一致。

// ============================================================
// P3：健康元数据持久化（只存统计/熔断/短路/摘除；绝不存 URL/歌名/账号）
// 官方移动版自定义源没有 storage API，持久化只能由 App 宿主承担；
// 源侧只负责导出白名单快照、校验后恢复，successCache/failCache 永远不落盘。
// ============================================================

// 导出时写当前源版本；恢复时同时接受上一版，避免一次版本升级把用户已存健康态整包丢掉。

bindDep('HEALTH_STATE_SOURCE_VERSION', HEALTH_STATE_SOURCE_VERSION);

// HC：旧版本快照应可恢复（结构校验兜底），未来版本仍拒绝。
// 原来只放行固定白名单，导致音源每升一个版本、用户熔断/短路记录就被整包拒绝丢失；
// 白名单同时随版本漂移（漏加一条即丢数据）。改为按版本号数值比较。

bindDep("isAcceptedSourceVersion", isAcceptedSourceVersion);

bindDep('HEALTH_QUALITY_NUMBER_FIELDS', HEALTH_QUALITY_NUMBER_FIELDS);

bindDep('HEALTH_STATES', HEALTH_STATES);

bindDep('HEALTH_QUALITIES', HEALTH_QUALITIES);

bindDep("checkHealthForbiddenKeys", checkHealthForbiddenKeys);

// F57：用户意图独立导出/恢复；autoOff 仍是短期临时态，恢复时按 6h 复验。

bindDep("exportHealthState", exportHealthState);

bindDep("restoreHealthState", restoreHealthState);

// ============================================================
// 第七部分：音源注册表 + 调度（源级音质过滤 + 竞速回退 + 6s整体超时）
// ============================================================
// v1.0 P0-1：每个源标注 maxQuality 真实能力；buildSourceChain 按请求音质过滤，杜绝128k源冒充flac竞速
// ============================================================
// v8.13：Provider Contract
// 每个源是一份自描述契约：能力、平台、上游族、鉴权、生命周期、复核日、链位次。
// buildSourceChain / buildProbeConfig / 健康面板 / 巡检工具都从这一份契约读取，禁止再手写平台分支。
// ============================================================

bindDep("providerQualitys", providerQualitys);

bindDep("provider", provider);

bindDep("SOURCE_HANDLERS", SOURCE_HANDLERS);

// 显式覆盖缺口：单源平台与待复核源必须在这里登记，禁止用“5 平台都有源”糊过去。

bindDep('KNOWN_COVERAGE_GAPS', KNOWN_COVERAGE_GAPS);

bindDep("validateProviderContracts", validateProviderContracts);

bindDep("buildSourceChain", buildSourceChain);

// v3.0：排序改用综合健康评分（成功率×置信度 + 均时 + 连续失败惩罚）；分数差>0.05 优先，否则按均时兜底

// v8.8：竞速执行器重写
// ① 分批错峰并发：批1 启动后 staggerMs 内未成功即启动批2（不再"竞速3个+串行rest"）
// ② 全局预算：deadline 由 getUrlWithFallback 跨音质档共享
// ③ verified 精确等待：仅当批次里还有"未 settle 的 verified 源"才给匹配等待；否则立即交付

bindDep("raceFirst", raceFirst);

// v4.0：单源并发计数 + 滑动窗口限速（超限本轮跳过，不阻塞其他源）

bindDep('inflightCount', inflightCount);

// v6.0：真实播放请求最后使用时间戳（健康快照 lastUsedAt，供 App 判断'使用中'分组）

bindDep('lastUsedAt', lastUsedAt);

bindDep('reqTimestamps', reqTimestamps);

bindDep("wrapExecute", wrapExecute);

// v1.0 P0-5：fallbackRace 加 6s 整体超时；超时后继续 rest 串行

bindDep("fallbackRace", fallbackRace);

// v1.0 P0-4：请求音质放首位，再按 QUALITY_PRIORITY 向下降级，截到≤3级；flac24bit/192k不再被短路

// v1.0：统一错误码提取——业务层抛错沿用"CODE: msg"前缀风格(e.code 未设置)，从 message 前缀还原 code，
// 供失败缓存差异化与决策日志使用；无前缀按网络错误处理(不缓存)

// v8.8：档位短路——某源某音质档历史 success=0 且失败样本达标，则该档直接跳过该源
//（典型：tx/mg/kg 的 flac 只有 suyinKuwo 单源，而它 flac 档是 oiapi VIP 死链，每次点 flac 都白试一次必败档）
// 防死锁：每 qualityShortCircuitProbeMs 放行一次真实探路，避免源恢复后永久被跳。

bindDep('qualitySkipProbeAt', qualitySkipProbeAt);

bindDep('qualityShortCircuitKey', qualityShortCircuitKey);

// v8.9：短路判据拆分为两类失败之和——fail（超时/5xx/连接错）+ linkExpired（410 死链）；
// 排除 businessFail（404 无版权/歌不存在/错歌）：无版权是歌的问题不是源的问题，连续 3 首无版权歌不该把源该档短路 6h。
// 同时保留 410：oiapi flac/320k 是 VIP 死链，恒 410 属"这一档拿不到"，必须能短路，否则 v8.8 第③条收益会被修没。

bindDep('isQualityHopeless', isQualityHopeless);

// v8.14.1（K07）：源侧强制探路——把下一次短路检查标记为“已到期”，只放行一轮链构建；
// 若用户不主动调用，短路行为完全不变。App 侧入口留 P2。

// v8.8：冷启动源预热——huibq 跑 onrender 免费实例，冷态 30s+ 远超单源超时(5s)，冷态必然失败；
// 首次进链时后台 fire-and-forget 预热（不阻塞、不计统计），实例热起来后下一次即可参与竞速。

bindDep('coldStartWarmAt', coldStartWarmAt);

// v8.11.2（G4）：同歌同档并发合并。
// 旧行为：同歌同档 5 个并发请求 → 上游外呼 5 次（inflightCount 只是计数，没有去重）。
// 现在：相同 key 的并发请求共享第一个 Promise，上游只被真正打一次。

bindDep("getUrlWithFallback", getUrlWithFallback);

// ============================================================
// v8.12：跨平台兜底（aggregate 语义的补齐）
// 目标：主平台确定性失败（无匹配/错歌/片段）立即去其他平台找同一首；超时类失败给
// 主平台一个 grace 窗口后再并行起跨平台。只有「歌名+歌手+时长」严格匹配才交付。
// 关键：目标平台 ID 必须重新解析（kw rid 不能喂给 tx 源），因此这里先搜索再跑目标链。
// ============================================================

bindDep("CROSS_FALLBACK_CACHE_TTL_MS", CROSS_FALLBACK_CACHE_TTL_MS);

bindDep("crossFallbackCache", crossFallbackCache);

bindDep("getCrossFallbackCached", getCrossFallbackCached);

bindDep("deleteCrossFallbackCached", deleteCrossFallbackCached);

bindDep("setCrossFallbackCached", setCrossFallbackCached);

// 源开关唯一入口调用：关闭/开启子源后，10min 跨平台结果缓存必须同步失效，
// 否则「已关掉的源」仍会从缓存继续交付（U10 回归）。

bindDep("clearCrossFallbackCache", clearCrossFallbackCache);

bindDep("crossSearchPlatform", crossSearchPlatform);

bindDep("resolveCrossPlatformCandidate", resolveCrossPlatformCandidate);

bindDep("tryCrossPlatformFallback", tryCrossPlatformFallback);

// v8.16.2（R-10）：跨平台兜底策略——**结构化判据**，禁止再按中文文案做控制流。
// 旧实现用 `/该请求已知失败/`、`/预算耗尽/`、`/源级限流|冷却中|已熔断/` 四个正则判分支，
// 任何文案改动都会静默改变兜底行为，且单测无法覆盖。这里改为读 err.code / 布尔标记。
// 语义：只有「本地保护态」「网络类整体不可用」「预算耗尽」「失败缓存里已是内容类结论」才不兜底，
// 其余（曲库无匹配/错歌/非音频/试听片段/流列表/链接过期/5xx）都值得换平台再试一次。

// ============================================================
// 第八部分：音源配置上报 + 事件监听（洛雪官方协议）
// ============================================================
// v8.13：Provider Contract 在加载时校验——契约不合法直接拒绝加载，不允许带病启动。
const PROVIDER_CONTRACT = validateProviderContracts();

Object.keys(PLATFORM_QUALITIES).forEach(platform => {
  // v3.0：歌词/封面按平台真实能力声明（App fork 声明即注册 getLyric/getPic）——
  // wy: 歌词+封面（网易云公开接口实测可用）；kw: 封面（搜索 hts_MVPIC 实测可用）；
  // tx/kg/mg: 无稳定接口不声明，App 自动走内置源兜底
  const actions = ["musicUrl"];
  if (platform === "wy") actions.push("lyric", "pic");
  else if (platform === "kw") actions.push("pic");
  actions.push("health"); // v4.0：健康快照 action（App fork 声明即注册 getHealth，与平台无关的聚合查询）
  actions.push("toggle", "probe", "probeSource"); // v4.0：源级开关 + 手动探测；v8.14：单源只读探测
  actions.push("reportPlayback"); // v8.14：App 真实播放回传（playDead 的唯一真实播放入口）
  actions.push("config"); // v8.0：配置热更新 action（App 设置页读写 USER_CONFIG 内存值，免重载音源）
  actions.push("trend"); // v8.0：健康趋势 action（返回历史健康快照数组，App 折线图展示）
  actions.push("healthEvents"); // 2.4：只读事件环形缓冲（本地排障；不记歌名/URL）
  actions.push("exportHealthState", "restoreHealthState"); // P3：宿主持久化协议（仅健康元数据）
  actions.push("forceQualityProbe"); // P2 K07：强制探路旁路（分发已在 request 处理器，此处声明保证宿主白名单 14 个 action 对齐）
  sourceConfig[platform] = {
    name: PLATFORM_NAMES[platform],
    type: "music",
    actions,
    qualitys: REPORT_QUALITIES[platform] || ["128k"], // v1.0 P0-6：按真实能力裁剪
    // P1：显式声明换源所有权。本脚本内部已有跨平台兜底（tx→wy→kw），
    // 声明 source 后 App 不再重复搜索其他平台，避免同一平台被两层各搜一次。
    fallbackOwner: "source"
  };
});

on(EVENT_NAMES.request, ({ action, source, info }) => {
  // 2.4：只读事件环形缓冲（App 健康页/导出诊断包消费；不提供任何写能力）
  if (action === "healthEvents") {
    return Promise.resolve(getHealthEvents(info || {}));
  }
  if (action === "probeSource") {
    // v8.14：单源探测默认只读；只有显式 apply:true 才改健康状态（全局“手动探测”仍走 probe apply）。
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
  if (action === "forceQualityProbe") {
    // v8.14.1（K07）：源侧强制探路，只解除一次档位短路；不改 breaker/健康账本。
    const id = info && (info.sourceId || info.id);
    if (!id || !SOURCE_HANDLERS[id]) return Promise.reject(new Error(`${ERROR_CODES.PARAM_ERROR}: unknown source id`));
    const q = String((info && info.quality) || "flac").toLowerCase();
    return Promise.resolve({ ok: forceQualityProbe(id, q), id, quality: q });
  }
  if (action === "reportPlayback") {
    // v8.14：真实播放回传。这是 playDead 的唯一“真实播放失败”入口；
    // App 播放器启动/失败/成功时调用，源侧不再把取链 HTTP 失败当播放失败。
    const id = info && (info.sourceId || info.source);
    if (!id || !SOURCE_HANDLERS[id]) return Promise.reject(new Error(`${ERROR_CODES.PARAM_ERROR}: unknown source id`));
    const quality = (info && info.quality) || "128k";
    const ok = !!(info && info.ok === true);
    if (ok) {
      recordSuccess(id, Number(info && info.latencyMs) || 0, quality, { playback: true });
      return Promise.resolve({ ok: true, id, state: getBreaker(id).state, playDead: isPlayDead(id), resolveDead: isResolveDead(id) });
    }
    recordFailure(id, quality, { playDead: true, playbackOnly: true, code: (info && info.code) || ERROR_CODES.NETWORK_ERROR });
    return Promise.resolve({ ok: false, id, state: getBreaker(id).state, playDead: isPlayDead(id), code: (info && info.code) || ERROR_CODES.NETWORK_ERROR });
  }
  // v4.0：健康快照 action（聚合查询，与请求的 source 无关）
  if (action === "health") {
    return Promise.resolve(getHealthSnapshot());
  }
  // P3：健康元数据导入/导出（宿主持久化；只接受白名单元数据）
  if (action === "exportHealthState") {
    return Promise.resolve(exportHealthState());
  }
  if (action === "restoreHealthState") {
    return Promise.resolve(restoreHealthState(info));
  }
  // v4.0：源级开关（手动启用/停用某子源；停用写入 manualOff 锁定，探测不再自动复活；启用清除锁定并清休眠立即纳入探测）
  if (action === "toggle") {
    try {
      return Promise.resolve(toggleSource(info?.id, info?.enabled !== false));
    } catch (e) {
      return Promise.reject(e);
    }
  }
  // v4.0：手动触发一轮健康探测（并发 ~6s；探测中返回 running:true 不排队）
  // v30.1：手动探测不存历史快照（避免污染趋势图）
  if (action === "probe") {
    if (probeState.running) {
      return Promise.resolve({ running: true });
    }
    return runHealthCheck(false).then(() => ({
      running: false,
      doneAt: Date.now(),
      round: globalThis.__probeRound || 0,
      active: Object.keys(userEnabled).filter(effectiveEnabled),
      sleeping: Object.keys(probeState.sleeping).filter(k => probeState.sleeping[k])
    })).catch(err => Promise.reject(err));
  }
  // v8.0：配置热更新 action（App 设置页读写 USER_CONFIG 内存值，免重载音源）
  // 无参数调用：返回当前所有配置项（只读）
  // 带参数调用（{key: value}）：更新内存中的配置值，立即生效
  if (action === "config") {
    if (!info || Object.keys(info).length === 0) {
      // 读模式：返回当前配置（过滤掉敏感的卡密类字段）
      const { ikunApiKey, lingchuanApiKey, xinghaiDeviceId, ...safeConfig } = USER_CONFIG;
      return Promise.resolve({
        ...safeConfig,
        ikunApiKey: ikunApiKey ? "***已设置***" : "",
        lingchuanApiKey: lingchuanApiKey ? "***已设置***" : "",
        xinghaiDeviceId: xinghaiDeviceId ? "***已设置***" : ""
      });
    }
    // 写模式：更新内存配置（仅允许白名单字段，防止乱改）
    // v8.11.7：数字键补齐 v8.10~v8.11 新增可调参数；布尔键单独白名单（B 方案，App 健康页可开关）
    const ALLOWED_KEYS = ["cacheTtlMs", "cacheTtlHighQualityMs", "failCacheNotFoundMs", "failCacheExpiredMs",
      "breakerThreshold", "breakerCooldownMs", "rateLimitBackoffMs",
      "maxConcurrency", "rateWindowMs", "rateWindowMax",
      "healthCheckIntervalMs", "healthCheckJitterRatio", "healthCheckPauseRetryMs", "probeConcurrency", "probeTierCoreInterval", "probeTierSecondaryInterval", "raceMatchWaitMs", "raceBudgetMs", "raceBudgetFloorMs",
      "raceBatchSize", "raceBatchStaggerMs", "coldStartTimeoutMs", "coldStartProbeTimeoutMs",
      "coldStartWarmTtlMs", "qualityShortCircuitSamples", "qualityShortCircuitProbeMs", "qualityShortCircuitUniqueProbeMs",
      "verifyTimeoutMs", "verifyMinOriginalSec", "verifyDurRatio", "verifyDurGapSec",
      "allFailShortTtlMs", "playDeadReviveMs", "memoryMapMax",
      // v8.16.2（R-09）：跨平台 grace 窗口此前不在白名单，面板/巡检无法调整
      "crossPlatformGraceMs"];
    const ALLOWED_BOOL_KEYS = ["verifyDelivery", "truthfulQuality", "qualityFloor", "verifyOnCacheHit",
      "previewUrlPreFilter", "fragmentFallback", "qualityShortCircuit", "coldStartWarmEnabled",
      "crossPlatformEnabled"];
    // v8.11.7：这两个阈值 0 是合法值（0=不设比例/间隔门槛），不能被 <=0 校验吞掉
    const ZERO_ALLOWED_KEYS = ["verifyDurRatio", "verifyDurGapSec"];
    // v30.1：每个参数的合理上下限（防极端值触发上游风控/雪崩）
    const PARAM_LIMITS = {
      cacheTtlMs: { max: 7 * 24 * 3600 * 1000 },        // 最大 7 天
      cacheTtlHighQualityMs: { max: 7 * 24 * 3600 * 1000 }, // 高音质缓存上限 7 天
      failCacheNotFoundMs: { max: 24 * 3600 * 1000 },   // 最大 1 天
      failCacheExpiredMs: { max: 3600 * 1000 },         // 最大 1 小时
      breakerThreshold: { max: 20 },                      // 最大 20 次
      breakerCooldownMs: { max: 30 * 60 * 1000 },       // 最大 30 分钟
      rateLimitBackoffMs: { max: 5 * 60 * 1000 },       // 最大 5 分钟
      maxConcurrency: { max: 5 },                          // 最大 5（单源并发，太大触发风控）
      rateWindowMs: { max: 10 * 1000 },                  // 最大 10 秒
      rateWindowMax: { max: 20 },                         // 最大 20 次
      healthCheckIntervalMs: { min: 60 * 1000 },        // 最小 1 分钟（防频繁探测）
      healthCheckJitterRatio: { min: 0, max: 0.5 },        // F06：抖动比例 0~0.5
      healthCheckPauseRetryMs: { min: 1000, max: 5 * 60 * 1000 }, // F06：暂停重试 1s~5min
      probeTierCoreInterval: { min: 1, max: 10 },        // F22：核心源间隔 1~10 轮
      probeTierSecondaryInterval: { min: 1, max: 20 },   // F22：次要源间隔 1~20 轮
      probeConcurrency: { min: 1, max: 8 },              // v8.14 探测并发上限 1~8
      raceBudgetMs: { max: 15 * 1000 },                     // v8.10.3：总预算（死键 raceOverallTimeoutMs 已移除，唯一真相；运行时与 floor 合计钳制 16s）
      raceBudgetFloorMs: { max: 15 * 1000 },            // 末档保底；与总预算合计不得超过 16s，超出部分运行时钳掉
      raceBatchSize: { max: 10 },                         // 每批并发源数
      raceBatchStaggerMs: { max: 2000 },                // 批间错峰
      raceMatchWaitMs: { max: 5 * 1000 },               // 最大 5 秒
      coldStartTimeoutMs: { max: 30 * 1000 },           // 冷启动单源超时
      coldStartProbeTimeoutMs: { max: 60 * 1000 },      // 冷启动探针超时
      coldStartWarmTtlMs: { max: 60 * 60 * 1000 },      // 预热间隔上限 1 小时
      qualityShortCircuitSamples: { max: 20 },          // 档位短路样本门槛
      qualityShortCircuitProbeMs: { max: 24 * 3600 * 1000 }, // 短路放行探路间隔上限 1 天
      qualityShortCircuitUniqueProbeMs: { min: 60 * 1000, max: 24 * 3600 * 1000 }, // 唯一高质源探路 1min~1天
      verifyTimeoutMs: { min: 500, max: 10 * 1000 },    // 验真 Range 超时
      verifyMinOriginalSec: { max: 3600 },              // 原曲短于此不按比例判
      verifyDurRatio: { max: 1 },                       // 真实时长/原曲 比例上限
      verifyDurGapSec: { max: 300 },                    // 绝对差上限
      memoryMapMax: { min: 1, max: 20000 },              // 五轮 MEM：记忆表条数上限（默认 2000）
      allFailShortTtlMs: { max: 10 * 60 * 1000 },       // 最大 10 分钟
      playDeadReviveMs: { max: 2 * 3600 * 1000 },       // 最大 2 小时
      crossPlatformGraceMs: { max: 30 * 1000 },         // v8.16.2（R-09）：grace 窗口上限 30s
    };
    const ALLOWED_ARRAY_KEYS = ["probeSongPool"];
    const updated = {};
    for (const [key, value] of Object.entries(info)) {
      if (ALLOWED_ARRAY_KEYS.includes(key)) {
        const pool = normalizeProbeSongPool(value);
        if (!pool) continue;
        USER_CONFIG[key] = pool;
        updated[key] = pool;
        continue;
      }
      if (ALLOWED_BOOL_KEYS.includes(key)) {
        if (typeof value !== "boolean") continue;
        USER_CONFIG[key] = value;
        updated[key] = value;
        continue;
      }
      if (!ALLOWED_KEYS.includes(key)) continue;
      if (typeof value !== "number" || !Number.isFinite(value)) continue;  // 五轮 EDGE：NaN 会绕过下面三条比较
      if (value < 0 || (value === 0 && !ZERO_ALLOWED_KEYS.includes(key))) continue;
      // v30.1：上下限校验
      const limits = PARAM_LIMITS[key];
      if (limits) {
        if (limits.min !== undefined && value < limits.min) continue;
        if (limits.max !== undefined && value > limits.max) continue;
      }
      USER_CONFIG[key] = value;
      updated[key] = value;
    }
    logInfo(`[config] 热更新配置：${JSON.stringify(updated)}`);
    if (Object.keys(updated).length) recordHealthEvent({ event: "config_change", reason: "config", code: Object.keys(updated).join(",") });
    // v30.1：修改熔断阈值后，重置所有源的 failureCount——避免"突然熔断"
    // （阈值从 3 改成 1 后，已累计 2 次失败的源下一次失败不会立即熔断）
    if (updated.breakerThreshold !== undefined) {
      for (const [, b] of breakerMap) {
        b.failureCount = 0;
      }
      logInfo(`[config] 熔断阈值已更新，所有源失败计数已重置`);
    }
    // v30.1：修改缓存 TTL 后，清空所有缓存——让新 TTL 立即生效
    if (updated.cacheTtlMs !== undefined) {
      successCache.clear();
      logInfo(`[config] 缓存 TTL 已更新，成功缓存已清空`);
    }
    // v30.1：返回 current 也脱敏（和读模式一致）
    const { ikunApiKey, lingchuanApiKey, xinghaiDeviceId, ...safeConfig } = USER_CONFIG;
    return Promise.resolve({
      updated,
      current: {
        ...safeConfig,
        ikunApiKey: ikunApiKey ? "***已设置***" : "",
        lingchuanApiKey: lingchuanApiKey ? "***已设置***" : "",
        xinghaiDeviceId: xinghaiDeviceId ? "***已设置***" : ""
      }
    });
  }
  // v8.0：健康趋势 action（返回历史健康快照数组，App 折线图展示）
  if (action === "trend") {
    return Promise.resolve({
      history: healthHistory,
      maxPoints: HEALTH_HISTORY_MAX
    });
  }
  // v3.0：歌词/封面 action（App fork userApi 已支持；失败 App 自动走内置源兜底）
  if (action === "lyric") {
    return getLyricForPlatform(source, info?.musicInfo).catch(err => Promise.reject(normalizeErrCode(err, ERROR_CODES.NOT_FOUND)));
  }
  if (action === "pic") {
    return getPicForPlatform(source, info?.musicInfo).catch(err => Promise.reject(normalizeErrCode(err)));
  }
  if (action !== "musicUrl") {
    return Promise.reject(new Error(`${ERROR_CODES.PARAM_ERROR}: action not support`));
  }
  if (!info?.musicInfo) {
    const paramErr = new Error(`${ERROR_CODES.PARAM_ERROR}: 请求参数不完整`);
    paramErr.code = ERROR_CODES.PARAM_ERROR;
    return Promise.reject(paramErr);
  }
  const quality = info.type || (QUALITY_FIRST ? "flac" : "128k");
  const traceId = clipText(info.traceId, 64) || `src_${Date.now().toString(36)}_${getHealthEventSeq() + 1}`;
  attachHealthTrace(info.musicInfo, traceId);
  recordHealthEvent({ event: "play_start", traceId, platform: source, quality });
  const key = buildInflightKey(source, info.musicInfo, quality);
  if (inflightUrl.size > INFLIGHT_URL_MAX) inflightUrl.clear();
  const prev = inflightUrl.get(key);
  if (prev) {
    logDebug(`[并发合并] ${key} 复用在途请求`);
    return prev;
  }
  const task = getUrlWithCrossPlatformFallback(source, info.musicInfo, quality, traceId)
    .catch(err => Promise.reject(normalizeErrCode(err)));
  inflightUrl.set(key, task);
  const done = () => { if (inflightUrl.get(key) === task) inflightUrl.delete(key); };
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

// v4.0.1：发版通知（updateAlert）已停用——每次加载/导入都弹更新提示过于打扰，
// 用户选择关闭（App 端「允许显示更新弹窗」勾选与否都不再弹；版本信息看 logInfo/Release）
//
// v9.1.2：下面这行**必须**保留字面量版本号 —— `scripts/self-check.js:38-47` 用
// `/豆包定制聚合音源\s+v(\S+)/` 取第一个匹配并与 @version 比对，App 内置升级正则同理。
// 因此：①不能改成模板变量；②本注释也不要写出被该正则命中的完整串（否则注释先于 logInfo
// 被匹配到，会报「版本串不同步」）。升版本时这里和 `src/00-header.js` 的 @version 一起改。
logInfo(`豆包定制聚合音源 v9.1.2 已加载（13 登记 / 11 上链 / 2 观察；Provider Contract + 生命周期治理 + 真取消；单文件构建），上报 ${Object.keys(sourceConfig).length} 个音源（历史版本见 docs/CHANGELOG.md）`);

// 启动健康探测（全自动自愈）
startHealthCheck();

// v3.0：测试导出块——宿主动态执行无 module，自动跳过；冒烟测试 require 后可断言纯函数
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
    recordRateLimit, // v8.14（F41）：按档限流审计需要直接驱动 429 记账
    recordBusinessFail, // v8.10.2：导出供测试断言半开收口
    ERROR_CODES,
    QUALITY_PRIORITY,
    // v3.0：探测巡检增强（分级轮次 + 休眠复活 + 配置构建）
    tierShouldProbe,
    applyProbeResult,
    buildProbeConfig, // v6.0：导出供测试断言探测清单过滤（关闭源不探测/自愈闭环保留）
    SOURCE_HANDLERS, // v8.8：导出供测试断言源标签（batch/coldStart）
    PROVIDER_CONTRACT,
    PROVIDER_LIFECYCLE,
    KNOWN_COVERAGE_GAPS,
    validateProviderContracts,
    probeState,
    probeSchedule,
    runtimeToggles,
    SOURCE_TOGGLES, // v8.6：导出供测试/巡检断言各源默认开关状态（A 方案默认开启源必须可见）
    // v3.0：健康统计快照（App 健康面板/巡检消费）
    getHealthSnapshot,
    // P3：宿主持久化协议（只含健康元数据，不含 URL/歌名）
    exportHealthState,
    restoreHealthState
  };
  // 测试钩子（非枚举）：压测需要验证「纯判据」语义（如音质短路到期放行、
  // 单源探针超时），而端到端外呼层会被冷却/摘除/失败缓存多层叠加干扰（实测无法隔离）。
  // 非枚举可避免影响导出面断言；不暴露任何写能力给外部调用方。
  Object.defineProperty(module.exports, "__debug", {
    value: Object.freeze({
      isQualityHopeless,
      canExecute,
      qualitySkipProbeAt,
      // v8.15（P0/P1）：策略单测钩子（只读 + 直接驱动纯策略，不参与生产调用）
      noteQualityCeiling,
      getQualityCeiling,
      qualityCeilingMap,
      classifyQualityFailureCode,
      forceQualityProbe,
      createCancelToken,
      canceledError,
      raceWithCancel,
      httpRequest,
      raceFirst,
      resolveBudgetBounds,
      resolveColdStartTimeout,
      wrapExecute,
      throwIfCanceled,
      probeSingleSource,
      sniffAudioBytes,
      qualityFromDelivery,
      qualityConfidenceOf,
      // L4：L0 形态归一 + 单一判定（纯函数，供 r-admission 断言）
      toBytes,
      kindOf,
      mediaEnvelopeErrorCode,
      // L4 裁决层：唯一裁决入口 + 读侧查询 + 清账；probe 供桥模拟直接驱动
      admit,
      computeEligibility,
      previewCooldownMap, // Batch 3：只读审计用
      skipReason,
      clearSourceLedger,
      probeAudioDelivery,
      probeByHeaders,
      verifyDelivery,      // K14：medium 尺寸比分支需要直接驱动
      successCache,        // P3：断言恢复不写缓存
      crossPlatformOrder: CROSS_PLATFORM_ORDER,
      crossSearchPlatform,
      buildCrossTargetInfo,
      applyAdmission,      // K14：reducer 的 PASS/记账分支
      getHealthSnapshot,   // F42：取链/播放摘除分层断言
      trialMarkOf,
      HEALTH_EVENT_FIELDS,        // S5b：策略校验需要能注入漂移的白名单
      assertEventFieldPolicy,     // S5b：白名单漂移必须加载即炸
      getHealthEventFieldAudit,   // S5b：未知/隐私字段计数（只读快照）
      qingliangTxGetUrl,   // A3d：试听标记必须有真实生产者，防「没人会置的开关」
      ADMISSION_POLICY,
      admissionLedger,
      suyinKuwoSearch,   // 供测试验证 D-31
      // v8.11.2（覆盖率补测）：健康巡检主流程 L572-626 整段此前零覆盖——runHealthCheck 未导出，
      // 只能从定时器间接触发（初始延迟 60s），测试无法稳定驱动。此处只读导出（healthHistory 返回副本）。
      runHealthCheck,
      nextHealthCheckDelay,   // F21：jitter 边界（可注入 rand 做确定性断言）
      hasActiveWork,          // F21：播放中暂停判定
      inflightCount,          // F21：断言构造“有播放流量”
      get inflightUrl() { return inflightUrl; },
      recordHealthEvent,   // 2.4 压测：注入事件验证容量/白名单（只读 action 不暴露写口）
      getHealthEvents,
      get healthHistory() { return healthHistory.slice(); },
      normalizeProbeSongPool,
      get probeSongPool() { return USER_CONFIG.probeSongPool.slice(); },
      suyinKuwoGetUrl,   // 供测试验证 D-31 端到端：兜底档日志是否落
      setCachedUrl,      // 供测试构造脏缓存（复现"槽位是 flac、内容是 128k"的历史条目）
      buildCacheKey,
      breakerMap,
      recordRateLimit,   // D-04 回归：半开态遇 429 必须收口回 open（否则永久卡死）
      playDeadStreak,
      playDeadQuality,
      resolveDeadStreak,
      isPlayDead,
      isResolveDead,
      bumpResolveDead,
      bumpPlayDead,   // v8.16.4：按档位归因回归（RF21）
      toggleSource,
      get playDeadDeadline() { return playDeadDeadline; },
      qualityShortCircuitKey,
      buildQualityChain,          // N3（F12）：降档链构造，只读
      buildSourceChain,           // v8.11.5 收尾：链过滤与 skipReason 同源回归
      runtimeToggles,             // v8.11.5 收尾：断言内临时开/关源（用完还原）
      fallbackRace,               // D-08：单链分支硬上限回归（可传入只含 1 个源的自造链）
      cfg,                        // D-05/D-06：配置白名单与布尔键 `??` 语义（只读求值，不改值）
      setFailCached,              // N4（F10）：构造失败缓存条目
      getFailCachedEntry,         // N4（F10）：读取时按 TTL 判过期
      get failCache() { return failCache; },   // N4：只用于把 ts 往前挪，模拟 5 分钟流逝
      // v8.16.2：通读修复的只读/直调钩子
      noteQualityDowngrade,       // R-02：质量档降级样本入账（纯策略，供断言短路生效）
      isAudioPlayable,            // R-12⑦：206 也必须核对 content-type
      tryCrossPlatformFallback,   // R-09：跨平台可取消（传入 token 断言 settle 后不再打上游）
      crossFallbackPolicy,        // R-10：兜底结构化判据（纯函数，断言文案不再决定行为）
      durationHints,              // R-12②：子源时长旁路回填（断言不再写调用方对象）
      setDurationHint,
    }),
    enumerable: false,
  });
}
