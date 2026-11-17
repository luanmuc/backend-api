# READTHROUGH v8.16.2 — `lx-source.js` 全文逐行通读

> 对象：`lx-source.js`（构建产物，**6045 行 / 317403 bytes / `@version 8.16.2` / md5 `bd692afe6a6c1eea9e27e5fdb4c891cf`**），与 `dist/lx-source.js` 逐字节一致；生产源 `src/legacy.js`（6227 行）。
> 日期：2026-11-17。上一份结论见 [`READTHROUGH_v8.16.1.md`](./READTHROUGH_v8.16.1.md)（5881 行基线，冻结不改）。
> 性质：**补做**。8.16.1 报告是「9 段 Read 覆盖全文 + 9 段二次细核」的产物；8.16.2 在修完 R-01~R-12 与三处 CI 回归后只做过改动点精读 + 全量门禁实跑，**没有**对修复后的整份产物做端到端复读。本文补上这一段。

## 一、通读方式与判定口径

1. **分段**：6045 行切 7 段（1–900 / 901–1800 / 1801–2700 / 2701–3600 / 3601–4500 / 4501–5400 / 5401–6045），每段用 `Read` 逐行读完整区间，不允许跳读、不允许 `grep` 代读、不允许凭函数名推测实现。
2. **证据优先**：每条结论必须给出 `lx-source.js` 的行号区间。无行号证据的怀疑，只能进「观察项」或「已排除」，不得写成缺陷。
3. **产物视角**：读的是 esbuild 打包产物，非 ASCII 已全部转成 `\uXXXX`。中文注释可读，但任何静态中文断言先解码再判（脚本内 `TEXT` 常量）。行号以产物为准；`src/legacy.js` 行号不同，故本文只用产物行号。
4. **与门禁的关系**：通读是**人工判据**，不能替代实跑。本文所有「已修复/无缺陷」的结论，与 `npm test`（rc=0）、`stress-round4`（133/0）、`readthrough-fixes`（18/0）、`verify-bundle`（8/0）、`source-inventory --check`、`docs-audit`（0 红）的实跑结果**互为正交证据**，缺一不算成立。

## 二、覆盖矩阵（7/7 段，6045/6045 行）

| 段 | 行区间 | 职责 | 结论 |
|---|---|---|---|
| S1 | 1–900 | 文件头/垫片、配置与错误码、取消令牌、源开关、探针配置与探测执行、健康事件环形缓冲 | 无缺陷；4 条观察项（疑-1 已排除、疑-2/疑-3 设计取舍） |
| S2 | 901–1800 | 探测调度、档位与失败分类、HTTP 层与预算、`isAudioPlayable`、音频字节嗅探 | 无缺陷；疑-4 在 S3/S5 结案排除；疑-12/13/14 可优化 |
| S3 | 1801–2700 | 交付音质推断、时长旁路、媒体信封、只取头探测、交付验真、`admit` 准入策略、资格判定、账本清理、准入记账 | **1 条真缺陷候选（疑-15 `skipReason`）**；其余无缺陷 |
| S4 | 2701–3600 | 子源取链函数库（13 源）、跨候选打分、缓存分级、健康快照 | 无缺陷；新增 3 条观察项（疑-20/21/22） |
| S5 | 3601–4500 | 健康态导出/恢复、Provider 契约、链构建、竞速器、限速并发、`wrapExecute`、`fallbackRace` 前段 | 无缺陷；疑-4 正式结案；新增疑-23/24/25/26 |
| S6 | 4501–5400 | 降档链、档位短路、`getUrlWithFallback` 主流程、跨平台兜底、事件分发、配置热更新 | 无缺陷；新增疑-28/29/30/31 |
| S7 | 5401–6045 | 配置收尾、`trend`/`lyric`/`pic`/`musicUrl` 入口、并发合并、`inited` 声明、`__debug` 导出、Provider 规格与入口组装 | 无缺陷；新增疑-33（双份源规格） |

**逐行覆盖确认**：7 段 `Read` 首尾相接，无空洞、无重叠错位；段首段尾均落在函数边界之外的行上（不是「跳着读函数」）。全文最后一个可执行语句在 6045 行（`module.exports = __lxSourceBundle`），已读到。

## 三、疑点清单

### 3.1 真缺陷候选（1 条）

**[R-13 / 疑-15] `skipReason` 会消费档位半开名额（只读接口有副作用）**

- 落点：`skipReason` 2539–2543 → `computeEligibility(source, q, ctx)` 调用参数为 `{ runtime: true, consumePlayDeadTrial: false }`，**缺 `peekRuntime: true`**。
- 后果链：`computeEligibility` 2517 行走「可写」分支 → `canExecute(id, q)`（1336–1383）在档位 `open` 且冷却已满时把档位转 `half-open` 并置 `trialInFlight = true`，随即返回 false（半开只准放一次）。于是**一次纯查询**会烧掉该档唯一的半开名额，并使该档在 `trialInFlight` 复位前（窗口 60s，`TRIAL_TTL`）被持续判为不可执行。
- 影响面收窄：两条主要只读路径都已正确传 peek —— `getHealthSnapshot` 3522/3525、`buildSourceChain` 4160；`preGate` 4334 用 `runtime:false` 根本不进 2517 分支。**唯一漏网的就是 `skipReason`**。
- 被谁调用：全文件只有两处引用 —— `sortChainByHealth` 4171（读链元素上的 `x.skipReason` 字段，**不是调用函数**）与 `__debug` 导出 5557。也就是说生产取链/快照/诊断路径**都不调用它**，只有测试/调试直调 `__debug.skipReason` 时才会中招。
- **定性**：真实缺陷（只读接口违反「只读不写」契约），但**当前无生产调用方**，不影响线上取链。建议修法一行：`skipReason` 内补 `peekRuntime: true`。**本轮不擅自改**——用户既有口径是「先论证真假再修」，且该项不影响线上行为，应在报告确认后再动手。

### 3.2 观察项（可优化，不改行为）

| # | 落点 | 事实 | 判断 |
|---|---|---|---|
| 疑-2 | 734–737 | 探测 PASS 只按「任一档通过」（`passCount > 0`），三档探针里 128k 通就整源 PASS → 触发 615 行隔轮降频，高音质档持续失败不能靠探测频率暴露 | 设计取舍；档位结论已进 `lastTargets`，健康页可见 |
| 疑-3 | 600–609 | `twoSong = true` 对所有源强制，单探针源被 666–670 复制成两条同源探针 → 一次探测打两次上游 | 设计取舍（提高采样置信度），冷启动源耗时放大但受 `coldStartProbeTimeout` 约束 |
| 疑-12 | 1695–1700 | `isAudioPlayable` catch 把 `notAudioError` 再包一层，消息成 `NOT_AUDIO: 可播性校验未完成(NOT_AUDIO: ...)` | 码不变、行为不变，仅日志难看 |
| 疑-13 | 1786 | `fullBody && declaredBytes > 0 \|\| declaredBytes > bodyLength ? … : …` 无括号，靠 `&&` 高于 `\|\|` 才正确 | 可读性隐患，建议加括号 |
| 疑-14 | 1102 | `LOG_DEBUG` 用 `\|\|` 而非 `??`，注入字符串 `"false"` 会被当真值 | 低危（注入侧传布尔） |
| 疑-20 | 2953–2954 | `const effTtl = ttl === void 0 ? FAIL_CACHE_TTL_MS : ttl;` 后 `if (effTtl === void 0) return entry;` 恒 false | 无害死代码（R-11 清的是另一处 `ttl === 0` 同族分支） |
| 疑-21 | 3326 | 兜底档 `suyinKuwoGetUrl` 传 `{name, duration}` 浅拷贝，`setDurationHint` 只落到 `n:<歌名>` 键，同名不同歌会串时长 | 仅用于片段比例校验，hash/严格档优先，风险可接受 |
| 疑-22 | 3133 / 3329 | `helloworldKwGetUrl`、`suyinKuwoGetUrl` 的 `if (!await isAudioPlayable(...))` 在 NOT_AUDIO 时不再执行（改为抛错进 `lastError`） | 语义正确，但需知道「不可播不再统一翻译为死链」 |
| 疑-23 | 4376–4377 | 半开名额被占时抛 `PLAYBACK_FAILED`，该码**不在 `ERROR_CODES` 18 码内** → `extractErrorCode`（4550–4558）反查不到，兜底成 `NETWORK_ERROR` | `isThrottleSkip` 保证不记账本，但 `fallbackRace` 的 detail/聚合码会把「本地拦截」显示成网络失败 |
| 疑-24 | 4496 | `batchSize = min(raceBatchSize, max(primary.length, 1))`；纯 secondary 链时 batchSize 被压到 1 | 当前 13 源全部 `batch:1`，实际无影响 |
| 疑-25 | 4410–4419 | `realQuality !== reqQ` 与相等两个分支写入内容完全相同，仅日志不同 | 重复代码，可合并 |
| 疑-26 | 4383–4386 | `throttleCheck` 内部已修剪并回写时间戳数组，`wrapExecute` 再 push 一次 | 功能正确（修剪 + 追加），两处写同一 map 易误读 |
| 疑-28 | 4594–4605 | `warmUpColdStartSources` 硬编码探针歌「晴天/周杰伦/228908/269s」，与 `probeSongPool` 无关 | 若该歌在某源失效，预热空转但无害 |
| 疑-29 | 4866 | `crossFallbackCache` 超 200 条直接 `clear()` 全清 | 粗暴；可改 LRU，属体验优化 |
| 疑-30 | 5137 | 主任务 `getUrlWithFallback(platform, songInfo, quality)` **未传 `crossToken`** → settle 时无法取消主请求，只有兜底链被取消 | 无正确性问题，仅浪费一次上游请求 |
| 疑-31 | 1435 / 5224 / 5226 | `reportPlayback` 的 `playDeadStreak` **只按 sourceId 累积，无档位维度**（`bumpPlayDead` 忽略 quality）→「flac 连续 3 次播放失败」会把整源摘 5 分钟，128k 明明可用亦连坐 | 设计取舍（v7.0 播放实时摘除），有 `recordSuccess(playback)` 1417 与 5 分钟半开自恢复兜底；建议下一版加档位键 |
| 疑-33 | 3996–4094 vs 5662–6045 | **源规格有两份**：legacy 内 `SOURCE_HANDLERS`（手写 JS 对象）与 `src/providers/*.js` 的 `PROVIDER_SPECS`（JSON 规格）。`chain` 位次、`qualitys`、`coldStart`、`reviewAt` 必须两边一致 | 构建期有 `source-inventory --check` 与 `verify-bundle` 挡 13/11/2 与产物存在性，但**没有逐字段交叉断言**。属测试盲区，见 §五 |

### 3.3 已排除（逐字核对后确认不成立，共 15 条）

| # | 原怀疑 | 排除证据 |
|---|---|---|
| 疑-1 | 档位熔断无探测复位会永久卡死 | `canExecute` 1347–1353 冷却满自动转 half-open 放行一次；`recordSuccess` 1389 复位；`revertHalfOpenOnSkip` 1320 在本地拦截时退回 open（D-34） |
| 疑-4 | 取链失败也 `bumpPlayDead` → 单档死链摘整源 | `ADMISSION_POLICY`（2257–2268）八类 `playDead` **全 false**；`applyAdmission` 2621 传 `playDead: L.playDead === true` 恒 false；`wrapExecute` 唯一失败出口 4439–4447 就是 `admit` + `applyAdmission`，无绕过 admission 的直接 `recordFailure`。取链路径**不会**摘源（播放路径见疑-31） |
| 疑-5 | `readthrough-fixes` 断言只是「跑通」没有红证据 | 该脚本先跑出 0/18 红（RF1~RF18 全挂），修后 18/18 绿；`__exit` 守卫保证失败非零退出 |
| 疑-6 | 失败缓存 TTL 为 0 会被当「永不过期」 | `setFailCache` 4837 对 `ttlMs === 0` 显式替换成 `allFailShortTtlMs`（默认 30s）；`getFailCachedEntry` 读到过期即删 |
| 疑-7 | `successCache` 过期条目无法复用 | `hasExpired`/`getExpired`（1138/1143）提供「过期但取值」通道，4813–4834 用它做过期兜底，且档位不足时明确不兜（4832） |
| 疑-8 | `runtimeToggles.set(true)` 会误清 `manualOff` | 406–415 只删 `autoOff`；`manualOff` 仅在 `toggleSource` 显式开启时清 |
| 疑-9 | 探测 PASS 会无脑复活观察源 | `applyProbeResult` 765–841 对 `probation` 源只打日志不复活；复活需连续 2 次 PASS 且是 active |
| 疑-10 | `raceFirst` 的 candidate 窗口与 verified 成功会双 settle | `settled` 幂等位 + 每次 settle 清 timer + `cancelAll` |
| 疑-11 | `restoreHealthState` 能被旧存档注入 `half-open` 永久试态 | 3879–3884 强制 `half-open → open` 且 `trialInFlight = false` |
| 疑-16 | `applyAdmission` PASS 未传 `playback` 会污染播放账 | 该处就是取链成功，计入 req/success 正确；播放账由 `reportPlayback` 单独走 `playback:true` |
| 疑-17 | 准入路径永不 bump playDead 说明摘除机制失效 | 摘除机制改由播放上报驱动（5226），取链侧改用档位熔断 + 档位短路，职责已分离 |
| 疑-18 | 空 chunk 信封判定自相矛盾 | `byteLength === 0` 允许空数组；否则按 `ceil(byteLength/chunkBytes)` 判 TRUNCATED |
| 疑-19 | `qualityFloor` 过滤会把链清空导致误报 | 4713 只在 `filtered.length` 非空时替换；清空分支由 4719「档位短路」单独处理，不会落到「无源」误判 |
| 疑-27 | `getUrlWithFallback` 跨档缓存补偿会串档 | 4624–4636 只在「更高档」里找，命中后把 `cacheKey` 切到高档次键；写回按 `truthQ` 决定键（4761），槽位与内容不会错配 |
| 疑-32 | `Object.keys(userEnabled).filter(effectiveEnabled)` 会把 index 当 opts | `effectiveEnabled(id)` 403–405 只用一个参数，多余实参被忽略 |

## 四、与 8.16.1 的差异（R-01~R-12 落点逐条复核 + 推送后 3 处修复）

| 编号 | 8.16.2 落点 | 通读确认 |
|---|---|---|
| R-01 档位熔断持久化 | `exportHealthState` 3790–3800 逐档导出 `breaker{state,failureCount,lastFailureTime,trialInFlight}` | 字段齐、恢复侧 3873–3888 校验且收敛 half-open |
| R-02 真实音质入账 | `wrapExecute` 4421–4426：`deliveredQuality = realQuality \|\| 请求档` → `recordSuccess` → `noteQualityDowngrade` | 降档样本只打「请求档」的 `definitiveFail`，不反向污染交付档 |
| R-03 播放与取链分账 | `recordSuccess` 1386 `opts.playback` 分支不入 req/success；`reportPlayback` 5223 传 `playback:true` | 两本账分离；`clearResolveDead` 仍无条件清（播放成功也算取链恢复） |
| R-04 只读建链 | `buildSourceChain` 4160 `peekRuntime:true + qualityShortCircuit:true + consumePlayDeadTrial:false` | 建链、快照、平台摘要三条读路径全部只读 |
| R-05 跨平台 ID 隔离 | `buildCrossTargetInfo` 4969–4980 只带目标平台自己的 id/rid/songmid | 不带主平台 rid/hash，避免目标源必失败 |
| R-06 半开名额唯一消费点 | `wrapExecute` 4373 `isResolveDead/isPlayDead(..., true)` 独占，抛 `PLAYBACK_FAILED` | 无第二处 `consume=true` |
| R-07 网关错误结构化 | `gateErr` 4337–4341 带 `code/sourceId/isThrottleSkip` | 下游 `crossFallbackPolicy` 靠 `isThrottleSkip` 判「本地拦截不兜底」 |
| R-08 片段源冷却 | `rememberFragmentSource` 2640–2667 同源 2 首均片段 → 5min 冷却 | `qualityFloor` 4709–4717 消费该集合 |
| R-09 跨平台 grace 可配 | `crossPlatformGraceMs` 入 `ALLOWED_KEYS`（5302）与 `PARAM_LIMITS`（5385，上限 30s） | 配置面板与巡检都可调 |
| R-10 兜底结构化判据 | `crossFallbackPolicy` 5047–5059 纯函数，不靠 message 文案 | 六码不兜底 + fail-cache 除 RATE_LIMIT 外不兜底 |
| R-11 失败缓存读取 | `getFailCachedEntry` 2946–2957 去掉 `ttl === 0` 同族分支（残留疑-20 死代码） | 行为正确 |
| R-12 十二项杂修 | ①`notAudioError` 1669 ②`setDurationHint` 身份键 1891–1906 ③`sniffAudioBytes` 括号族 ④`restoreHealthState` 白名单 ⑤`resolveDead` 对称持久化 3803–3808 ⑥`validateProviderContracts` 硬断言 ⑦`isAudioPlayable` 206 也核 content-type ⑧`applyHealthControls` 6h 窗口 | 逐项在正文对应行号处复核，均落实 |

**推送后 CI 三处回归的修复位置**（V1e / V28e / V39a）：
- `notAudioError` 1669–1673 + `isAudioPlayable` 1674–1702：状态码正常但 content-type 是 text/json/html → 抛 `NOT_AUDIO`，不再返回 false 被源侧翻成 `LINK_EXPIRED` 410 死链语义。
- `setDurationHint` 1891–1906：补「hash → 歌名|歌手 → 仅歌名」三级身份键；`originalDurationSec` 1907–1919 增加 `hh:mm:ss` / `mm:ss` 文本解析（旧 `Number("1:05:00") = NaN` 直接丢弃，D-39 时长校验静默失效）。
- 兜底档浅拷贝修复：`suyinKuwoGetUrl` 3326 起把 hint 写入独立旁路（不再依赖外层对象读回），使 D-39 校验在兜底档也生效。

## 五、测试盲区（通读后才看得见、门禁覆盖不到的）

1. **`PLAYBACK_FAILED` 无码登记**（疑-23）：`extractErrorCode` 落 `NETWORK_ERROR`，没有断言检查「本地拦截不得伪装成网络失败」。
2. **双份源规格无逐字段交叉断言**（疑-33）：`verify-bundle` 只查产物存在，`source-inventory --check` 只查 13/11/2 与入口登记；`chain` 位次、`qualitys`、`coldStart` 两处不一致**不会被任何门禁抓到**。建议 `y-provider-contract.js` 加：`PROVIDER_SPECS.all` 与 `SOURCE_HANDLERS` 逐 id 深度相等（除 `fn`）。
3. **`skipReason` 无「无副作用」断言**（R-13）：它被导出但无测试断言「不改变运行时状态」，故副作用长期没被发现。
4. **播放摘除无档位隔离断言**（疑-31）：测试只按源断言，无法暴露「一档坏连坐全源」。
5. **`crossFallbackCache` 全清策略无测试**：无容量/抖动断言。
6. **`warmUpColdStartSources` 探针歌硬编码**：无断言，歌失效则静默空转。

## 六、结论

- **全文 6045 行 7 段逐行读完，7/7 覆盖，无跳读、无 grep 代读**。产物与 `dist/` 逐字节一致，md5 `bd692afe6a6c1eea9e27e5fdb4c891cf`。
- **本轮新增真缺陷 1 条（R-13）**：`skipReason` 缺 `peekRuntime`，只读接口有写副作用；**当前无生产调用方**（仅 `__debug` 可直调），不影响线上取链。
- **8.16.1 的 12 条缺陷（R-01~R-12）与推送后 3 处 CI 回归，逐条在上述行号处确认已落实**，且与 `readthrough-fixes` 18/18、`stress-round4` 133/0、`npm test` rc=0、`verify-bundle` 8/0 的实跑结果互为印证。
- **新发现 14 条观察项**（疑-20~疑-33），均为可优化/可读性/设计取舍，**不建议在本版本内改动**；其中疑-31（播放摘除无档位维度）与疑-33（双份规格）最值得进下一版计划。
- 建议的下一步（需用户拍板）：①`skipReason` 补 `peekRuntime:true`（一行，即 R-13）；②`ERROR_CODES` 补 `PLAYBACK_FAILED`；③`y-provider-contract` 加规格交叉断言。三项都不改变对外行为，可单提交、不升版本，或随后续版本一起发。

## 七、证据链（可复现）

| 项 | 值 |
|---|---|
| 产物 | `lx-source.js` 6045 行 / 317403 bytes / `@version 8.16.2` / md5 `bd692afe6a6c1eea9e27e5fdb4c891cf` |
| 基线 | 8.16.1：5881 行 / 307085 bytes（见 `READTHROUGH_v8.16.1.md`） |
| 分段结论 | `work/active/2026-11-17-readthrough-v8162/`：PLAN.md + S1~S7 逐段结论 |
| 门禁实跑 | `npm test` rc=0（43 脚本 / 49 入口）；`readthrough-fixes` 18/0；`stress-round4` 133/0；`verify-bundle` 8/0；`source-inventory --check` 通过；`self-check` 通过；`docs-audit` 0 红 |
| 产物一致性 | `lx-source.js` 与 `dist/lx-source.js` 逐字节一致；jsDelivr `@master` 拉回同为 6045 行 / 317403 bytes / 8.16.2 |

## 八、8.16.3 落地记录（2026-11-17，本报告结论的修复批次）

本报告第六节的 1 条真缺陷 + 报告末尾提出的 2 项收口已合并为一批修掉，版本升 **8.16.3**（发布口径）：

| 项 | 类型 | 落地 | 验证 |
|---|---|---|---|
| R-13 `skipReason` 只读副作用 | 真缺陷 | `skipReason()` 的 `computeEligibility` 调用补 `peekRuntime:true`（旧实现落 `canExecute` 可写分支，把「`open` 且冷却已满」的档推进 `half-open` 并置 `trialInFlight`，只读查询即烧掉 60s 内唯一半开名额） | `RF19`：断言返回 `null`、档位仍 `open`、`trialInFlight` 仍 `false`、熔断 JSON 前后一致、`canExecute` 仍能放行（TDD 红证：首次跑 `18 passed / 2 failed`） |
| `PLAYBACK_FAILED` 非一等码 | 码级收口 | `ERROR_CODES` 补键 + `CODE_HINT` 中文提示 + `FAIL_CACHE_TTL_BY_CODE=0` + `CODE_RANK=1` + 新增 `verdictOfCode → PLAYBACK_DEAD` 与 `ADMISSION_POLICY.PLAYBACK_DEAD`（`health:"skip"`，`applyAdmission` 直接返回不记账）+ `computeEligibility`/`wrapExecute` 改用常量 | `RF20`：`ERROR_CODES` 有键、`admit` 判 `PLAYBACK_DEAD`、`ttlMs=0`、`health=skip`、静态无裸写字面量 |
| `PROVIDER_SPECS` 漂移无看护 | 防漂移护栏 | `y-provider-contract` 增 `Y16`：逐 id 比对 `lifecycle/platforms/chain/upstreamGroup/auth/maxQuality/qualitys/coldStart/reviewAt/name` 并双向覆盖 | `Y16` 16/0（当前两份规格一致，属护栏非修缺陷） |

**8.16.3 产物基线（覆盖上表 8.16.2 数字）**：`lx-source.js` **6060 行 / 318733 bytes** / `@version 8.16.3` / md5 `bb4b0df7f1aae6e85ad54eb920b180a4`（`dist/` 逐字节一致）；`src/legacy.js` 6243 行；`chain-golden.json` 重建（`version 8.16.3`）；`HEALTH_STATE_SOURCE_VERSION="8.16.3"`，接受列表追加 `8.16.3`（兼容 8.14.1~8.16.2）。
**门禁实跑（本轮）**：`readthrough-fixes` **20/0** · `y-provider-contract` **16/0** · `verify:bundle` **8/0** · `source-inventory --check` 通过 · `npm test` **rc=0（0 项 ❌）** · `self-check` 通过 · `docs-audit` 0 红。
**顺带修的一处测试硬编码**：`r-admission` A20 原写死「策略表 8 类」（`verdicts.length === 8`），新增 `PLAYBACK_DEAD` 后随契约改 9 —— 属契约同步，不是放松断言（仍要求全遍历 `bad.length === 0`）。

## 九、8.16.4 落地记录（疑-31，2026-11-17）

第六节观察项里唯一一条「设计取舍里藏真误判」的项，单独开一轮修掉，版本 **8.16.4**。

**取证结论（真缺陷，但不是「加个档位字段」那么简单）**

| 证据 | 位置 | 说明 |
|---|---|---|
| 失败码被整条丢弃 | `recordFailure(...,{playbackOnly:true})` → `bumpPlayDead(sourceId)` | 收到 `quality` 却只按 sourceId 累计 |
| 判定完全不看档 | `isPlayDead(sourceId, quality, consume)` | quality 只用于日志，不参与判据 |
| 成功解除被自己挡住 | `recordSuccess{playback:true}` 才清零，但摘除期内 `preGate` 已拦 | 用户无法靠正常播放自证恢复 |
| App 唯一失败码 | `player/service.ts:142` → `PLAYBACK_ERROR` | 播放器解码/播放内核报错，不区分「链接坏」还是「解码器不支持」 |

后果：高档（flac24bit/flac）因解码器或大文件播放失败 3 次 → 整源（含 128k 保底）摘 5 分钟 → 用户换音质也没声。

**修法（保留「playDead = 真实播放失败 / 源级摘除 / 半开一个/源」的原设计，只补归因维度）**

1. `playDeadQuality`（sourceId → 触发档）；`bumpPlayDead(sourceId, quality)` 首次记录，**跨档置 `"*"` 哨兵 = 源级**（此后不豁免，直到真实播放成功清零）。
2. `isPlayDead()`：`deadQ !== "*" && 请求档 !== deadQ && 该档 success>0` → 放行，且**不消费 trial**（半开唯一试探仍归触发档）。
3. 解除（`recordSuccess{playback}`）与清账（`clearSourceLedger`）同步删归因。
4. 快照 `playDead.quality` 导出 + 回填；旧快照无该字段 → `null` → 按源级（行为不弱于旧版）。
5. 取链失败路径也带 `quality`。

**红绿**：`RF21`（触发档仍拦 / 有成功史的他档不连坐 / 无成功史档不豁免 / 跨档失败不豁免 / 快照必须带 quality）先 **20 passed / 1 failed** → 修后 **21/0**。
**8.16.4 产物基线**：`lx-source.js` **6083 行 / 320161 bytes** / `@version 8.16.4` / md5 `50431e1a1a578b1b062645b496afad11`；`src/legacy.js` 6272 行；`chain-golden.json` 重建；`HEALTH_STATE_SOURCE_VERSION="8.16.4"`（兼容 8.14.1~8.16.3）。

