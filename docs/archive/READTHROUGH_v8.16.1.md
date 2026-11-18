# `lx-source.js` 逐行通读结论（v8.16.1 / 5881 行 / 307085 bytes）

> 通读对象：`lx-source.js`（md5 `092cc008d6416d84c5ce72e10547a704`，与 `dist/lx-source.js` 逐字节一致）
> 通读方式：全文 9 段 Read 全覆盖（1–1200 / 1201–1800 / 1801–2400 / 2401–3000 / 3001–3600 / 3601–4200 / 4201–4800 / 4801–5401 / 5401–5881），对 1201–1602、1621–2040、2041–2460、2481–2900、2921–3360、3361–3660、4201–4640、4890–5110、5110–5330 做二次细核
> 结论口径：**每条缺陷必须有本轮实跑输出或逐字静态取证**；无证据的怀疑先论证真假，再定性

---

## 一、先证伪一条：不存在「版本漂移」

上一轮怀疑「产物 `@version 8.16.1` 与巡检计划里的 v8.17 不一致」。本轮四处核对后**证伪**：

| 位置 | 值 |
|---|---|
| `lx-source.js` 第 4 行 `@version` | `8.16.1` |
| `package.json` `version` | `8.16.1` |
| `README.md` 第 15 行 | 当前版本 v8.16.1 |
| `docs/AUDIT_PLAN_v10.md` 第 6 行 | 源仓 v8.16.1，`lx-source.js` v8.16.1，5881 行 / 307085 bytes |

「v8.17」只出现在 `docs/STRESS_PLAN.md`，指**巡检/脚本版本**：

```
$ git show --stat d04711b
 .github/workflows/ci.yml | docs/* | scripts/*      ← 未改 lx-source.js、未改 src/
$ git diff --stat c2f1ba0..HEAD -- lx-source.js src/ scripts/build-source.js
（无输出）
$ node scripts/build-source.js
built lx-source.js (307085 bytes)  rc=0
$ md5sum lx-source.js dist/lx-source.js
092cc008d6416d84c5ce72e10547a704  lx-source.js
092cc008d6416d84c5ce72e10547a704  dist/lx-source.js
$ git status --short
（空）
```

**结论**：v8.17 是「巡检发布口径」，音源产物仍是 8.16.1；产物可由 `src/` 逐字节复现。**这不是缺陷**。

---

## 二、缺陷清单（按严重度）

### R-01【P0】健康态恢复丢掉「档位熔断账本」，重启后熔断被抹平 —— 本轮新发现

**位置**：`exportHealthState` 3696–3723、`HEALTH_QUALITY_NUMBER_FIELDS` 3637、`restoreHealthState` 3819、`syncSourceBreaker` 1320–1333

**机制**：

1. 导出时 `byQuality[quality]` 只写 `["req","success","time","fail","businessFail","definitiveFail","linkExpired"]` 七个数字字段，**不含 `q.breaker`**；
2. 恢复时 `b.byQuality = item.byQuality` —— 于是每个档位的 `breaker` 都是 `undefined`；
3. `canExecute(id, q)` 取 `qSlot.breaker`，`qSlot` 存在但 `breaker` 缺失 → 判据失效 → **原本 `open` 的档位直接放行**；
4. 更严重：`syncSourceBreaker` 只统计 `ledgers.filter(q => q && q.breaker)`，此时一个都不剩 → `if (!ledgers.length) return` 提前返回；**但只要恢复后发生任何一次失败，`qualityLedger` 就会给该档补上 `breaker: closed`，此时 `allOpen=false / anyHalf=false` → 源级 `b.state` 被改写成 `closed`**。

**实跑证据**（`tmp_verify5.js`）：

```
源1 状态: "open" | 档位 flac: "open" | canExecute(flac): false
导出含 flac 档 breaker 字段 ? [ 'req','success','time','fail','businessFail','definitiveFail','linkExpired' ]
恢复结果: {"ok":true,"restored":13}
恢复后 源级 state: open | byQuality.flac.breaker: undefined
恢复后 canExecute(flac): true          ← 应为 false
记一次 128k 失败后 源级 state: closed | canExecute(flac): true   ← 源级 open 被抹掉
```

**影响**：App 每次冷启动都会 `restoreHealthState`，因此「熔断」这个最贵的保护态**跨进程完全失效**：重启后第一首歌就会重新打满已熔断的源，且源级熔断会被一次失败静默降级为 `closed`。这也解释了真机上「明明熔断过，重启后又在打同一批失败源」的观感。

**修法**：`exportHealthState` 的 `byQuality[quality]` 增加 `breaker: { state, failureCount, lastFailureTime, trialInFlight }`（白名单化、枚举校验），`restoreHealthState` 侧按 `HEALTH_STATES` 校验后回填；`syncSourceBreaker` 在 `ledgers.length === 0` 时不要静默 return，至少保留已恢复的源级 `state`。

---

### R-02【P0】`recordSuccess` 用「请求音质」入账，而非「真实交付音质」→ 质量档短路在最该生效的场景完全失效

**位置**：`wrapExecute` 4279（已算出 `adm.quality || verdict.quality`）、4282–4290（写 `deliveryQualityMap`）、**4292 `recordSuccess(handler.id, ..., quality)`**（传的是请求档）；`isQualityHopeless` 4432–4455 首条 `if ((q.success||0) > 0) return false`

**实跑证据**（`tmp_verify2.js`：自造 handler 只替换 `fn`，请求 `flac`，交付 3.2MB/200s 的 `m4a`）：

```
byQuality 键: [ 'flac' ]
flac.success = 1 | 128k.success = undefined
lastQuality = flac                     ← 与真实交付 128k 不符
isQualityHopeless(flac) = false        ← 应为 true
快照 lastQuality = flac | byQuality.flac.req = 1
```

连打 3 次（`tmp_verify3.js` 疑点 7）：

```
flac 档 success/definitiveFail = 3 / 0
isQualityHopeless(flac) = false        ← 期望 true：3 次都只给 128k
快照 qualityShortCircuit.flac = false
```

**影响链**：

1. `byQuality` / `lastQuality` 与真实交付矛盾 → 违背 `docs/DEV_GUIDE.md` 第 88 行周边「flac 坏但 128k 好的源可精确呈现」的产品承诺；
2. `isQualityHopeless` 第一条就是「本档有成功即不无望」，于是**只会给 128k 的源永远判不出 flac 无望**，质量档短路（v8.14 F43 的核心能力）在该场景 100% 失效；
3. `computeHealthScore` 用 `totalSuccess` 被同档污染，健康分系统性偏高；
4. App `healthStatus.ts` 的 `byQuality` 逐档矩阵（F16）、`healthDiagnostics.ts:370` 的 `snapRate` 回退都读到错值。

**修法**：`wrapExecute` 把已算出的真实交付档传下去，`recordSuccess(id, dur, realQuality, opts)`；`deliveryQualityMap` 已有现成值，只差一个参数。

**测试盲区**：`test/audit/*` 的 `recordSuccess` 全是直接调用（`aa-p3-persist.js:70/89`、`health-breaker-quality.js:88/113`、`health-persistence-v2.js:164`、`health-resolve-dead.js:75/78/87`），**没有任何用例驱动 `wrapExecute` 断言真实音质入账**。

---

### R-03【P1】播放成功被算成一次「取链请求」→ 成功率与健康分被系统性抬高

**位置**：`reportPlayback` 5075 `recordSuccess(id, latencyMs, quality, { playback: true })` → `recordSuccess` 1384–1388 `b.totalRequests++; b.totalSuccess++; q.req++; q.success++`

**实跑证据**（`tmp_verify3.js` 疑点 5：1 次取链失败 + 1 次播放成功）：

```
reqCount = 2        ← 真实取链次数应为 1
successRate = 0.5   ← 真实取链成功率应为 0
byQuality.128k req/success = 2 / 1
```

**影响**：`successRate`、`reqCount`、`healthScore` 全部混入播放事件；App 健康页「近 24h 取链 N 次、成功 M 次」的分子分母都被污染。而 App `healthDiagnostics.ts:253/298/404` 自己另有 `playWindows` 分账 —— 说明「播放与取链分账」是既定产品口径，**源侧没有落实**。

**修法**：`opts.playback === true` 时走独立计数（或只更新 `playDead` 状态，不进 `totalRequests/byQuality`）。

---

### R-04【P1】`getHealthSnapshot` 的 `eligible` 不体现任何运行时状态，与同快照的 `eligibleCount` 自相矛盾

**位置**：3458 `computeEligibility(id, gatePlatform, "128k", { runtime:false, qualityShortCircuit:false })`；`computeEligibility` 2466 `if (!o.runtime) return { eligible:true }`

**实跑证据**（`tmp_verify2.js` 疑点 3：`helloworldKw` 连续 3 次 `NETWORK_ERROR`，`breakerThreshold=3`）：

```
breaker state = open | flac 档 = open
canExecute(flac) = false
buildSourceChain(kw,flac) 含该源 = false
快照 eligible = true | code = ELIGIBLE     ← 与实际不可执行矛盾
```

同快照里 `_platformSummary.eligibleCount` 由 `buildSourceChain`（`runtime:true`）算出 —— **两个口径在同一份数据里打架**。

**影响面**：App 侧 grep `eligible` / `eligibilityCode` **无任何消费**（只消费 `healthScore/successRate/qualityShortCircuit/enabled/offReason`），所以用户不可见；影响落在巡检脚本、外部诊断消费者与未来的 App 功能上。

**修法**：快照用 `runtime:true, peekRuntime:true`（只读不写状态，`peekThrottle` 已是这个范式），或在字段名上明确标注 `eligibleIdle` 语义。

---

### R-05【P1】`clearPlayDeadTrials` / `clearResolveDeadTrials` 前缀不匹配 → 空转

**位置**：写入 `1209/1212`（`const trialKey = sourceId`，裸 id）、`1231/1234` 同；清理 `1188`、`1195`（`k.startsWith(sourceId + "|")`）

**实跑证据**（`tmp_verify_readthrough.js`）：

```
trialAt 的键 = ["suyinKuwo"]        ← 裸 id
1209 行: resolveDeadTrialAt.get(trialKey)
1212 行: resolveDeadTrialAt.set(trialKey, Date.now())
1188 行: k.startsWith(sourceId + "|")  ⇒ 永不匹配: true
```

后果（`tmp_verify4.js` 疑点 8）：

```
消耗后立即判定 = true          （60s 内不再试探，正确）
clear 之后再判 = false         （streak 归零导致的 false，不是 trialAt 被删）
新一轮摘除后试探是否允许 = true ← 被旧 trialAt 卡住，60s 内无法半开试探
```

**影响**：默认 `playDeadReviveMs=300s` 时旧时间戳 60s 内自然过期，影响被掩盖；`playDeadReviveMs < 60s` 或「摘除→播放成功→再摘除」快速循环时可观测：**重新摘除后 60s 内无法半开试探**。

**修法**：清理侧改成 `k === sourceId || k.startsWith(sourceId + "|")`（或写入侧统一加分隔符）。**测试盲区**：`test/audit/*` 无任何 `clearPlayDeadTrials` 断言。

---

### R-06【P2】`preGate` 提前消耗半开试探名额且不回滚 → 「名额被消耗、请求却没发出」

**位置**：4224 `computeEligibility(..., { runtime:false, consumePlayDeadTrial:true })`；`revertHalfOpenOnSkip` 1315–1333 只回滚熔断器 `half-open → open`，**不回滚 `trialAt`**

**实跑证据**（`tmp_verify3.js` 疑点 6：`changqingVip` 3 次 playDead + deadline 前推 5s）：

```
preGate 前 isPlayDead(不消耗) = false
第 1 次 preGate = true   null      ← 放行并已消耗试探名额
第 2 次 preGate（1 分钟内）= false  play-dead
```

若 preGate 放行后紧随的 `canExecute`(4239) 或 `throttleCheck`(4247) 再拦截，则名额已消耗、请求没发出，最长白等 60s（`PLAY_DEAD_TRIAL_TTL_MS`）。

**修法**：preGate 改 `consumePlayDeadTrial:false`（只读判定），把消耗留到真正发出请求的那一处；或在 `revertHalfOpenOnSkip` 里一并删除 `trialAt`。

---

### R-07【P2】`gateErr` 抛在 `try{}` 之前 → 无 `source_result` 失败事件、丢源名

**位置**：4225–4229 构造 `gateErr` 并 throw；`try{}` 从 4303 才开始，`catch` 内才挂 `sourceId`

**实跑证据**（`tmp_verify4.js` 疑点 9：`suyin163` 被 `toggleSource(id,false)` 后走 `wrapExecute`）：

```
err.code = undefined | isThrottleSkip = true | sourceId = undefined
最近事件类型 = config_change, source_skip
是否有 source_result 失败事件 = false
```

**影响**：失败明细里 `source` 落成 `"race"` / `"chain"`（链级占位），**定位不到具体源**；巡检与真机摘要的失败归因精度受损。

**修法**：`gateErr.sourceId = handler.id`；或在 throw 前补一条 `source_result` 失败事件。

---

### R-08【P2】产物头与多份文档仍是「v8.15.1 / 12 登记 / 10 上链」旧口径

运行时真实口径是「v8.16.1，13 登记 / 11 上链 / 2 观察」（模块加载日志可证）。旧值残留在：

| 位置 | 现值 | 应为 |
|---|---|---|
| `lx-source.js` 头部 `@description`（模板 `src/00-header.js`） | v8.15.1 契约与死配置收口版（12 登记源 / 10 上链 / 2 观察…） | v8.16.1，13 登记 / 11 上链 / 2 观察 |
| `package.json:8` `description` | 12 登记 / 10 上链 / 2 观察 | 13 / 11 / 2 |
| `docs/ARCHITECTURE.md:25` | 12 个登记源 handler（10 上链 / 2 观察） | 13 / 11 / 2 |
| `docs/SOURCE_RETIREMENT.md:8` | 20 源 → 12 登记（10 上链 + 2 观察） | 13 / 11 / 2 |
| `docs/音源架构执行全过程-2026-11-12.md:32/45` | 12 登记 / 10 上链 / 2 观察 | 13 / 11 / 2 |
| `docs/DEV_GUIDE.md:26` | 13 个子源（10 上链 + 2 观察） | 13 个子源（11 上链 + 2 观察） |
| `docs/CHANGELOG.md` 首条 | 「每日巡检第一阶段升级（2026-11-17，本地未推送）」 | 实际已推送（`d04711b`） |

**影响**：用户在 App 音源列表看到旧版本号/旧源数，是可复现的文档级不一致。

---

### R-09【P3】跨平台兜底：grace 定时器启动的 fallback 无法取消

**位置**：`getUrlWithCrossPlatformFallback` 4900–5008；`settleOk` 4917–4922 只 `clearTimeout` + `resolve`；`startFallback` 4929；`.then` 里 `if (settled) return` 4942

**语义**：主平台在 `crossPlatformGraceMs`（默认 3s）之后才成功时，fallback 已经发出 → 其 `.then` 的 `if (settled) return` **不写 cross 缓存、不发 `cross_platform` 成功事件**（这一点修正了上一版口径），但 `tryCrossPlatformFallback`(4854) 内部走 `getUrlWithFallback`(4879) → 仍经 `wrapExecute` 记 `source_attempt`/`source_result`/`recordSuccess`/`recordFailure`。**代价 = 多打一轮上游请求 + 污染健康账本**。

`crossPlatformGraceMs` **不在热更新白名单**（5118–5235 实查 `false`），面板无法调。

**修法**：`startFallback` 返回可取消句柄，`settleOk` 时置 `cancelToken`；或 fallback 的记账走「旁路账本」。

---

### R-10【P3】跨平台兜底用中文文案做控制流；失败缓存命中即彻底不兜底；同类失败两种待遇

**位置**：4980 `if (/该请求已知失败/.test(...)) { settleErr(e); return }`；4988「预算耗尽」；4992「源级限流|冷却中|已熔断|并发/限速保护」；4997 `NETWORK_ERROR|ECONNRESET|…`

三个问题：

1. **失败缓存命中即不兜底**：本地 429 会写 30s 短 TTL（4700–4701 `allFailShortTtlMs`，`RATE_LIMITED` 的 ledger `ttlMs=0`，2196）→ **本地限流一次后 30s 内跨平台兜底被完全阻断**。文档只写了「遇本地保护直接 settle」是有意（v8.13.0/v8.13.1），**没写失败缓存命中是否同属有意**。
2. **同类失败两种待遇**：`NETWORK_TIMEOUT` 不在 4997 列表 → 超时会兜底；`NETWORK_ERROR` 在列表 → 不兜底。需确认是否有意。
3. **中文文案当控制流**：任何日志/错误文案改动都会**静默改变兜底行为**，且单测无法覆盖（没有以文案为断言的用例）。

**修法**：改成按 `err.code` + `err.isThrottleSkip` + `err.fromFailCache` 布尔标记判定；文案只做展示。

---

### R-11【P3】`setFailCached` 的 `ttl === 0` 文案分支不可达

**位置**：`getFailCachedEntry` 2885 起，`effTtl === 0` 直接 `return null`；4540 文案 `failEntry.ttl === 0 ? "不缓存" : "缓存中"` 依赖 `failEntry` 非空

**实跑**（`tmp_verify2.js` 疑点 4）：`setFailCached('fk0','NOT_AUDIO',0)` 读回 `null` → 三元永远走不到「不缓存」。属死分支，非行为缺陷。

---

### R-12【P3】其他静态确认项

| 项 | 位置 | 结论 |
|---|---|---|
| `kwoff` 缓存只读不写 | 3020 读 `buildCacheKey("kwoff",...)`；全仓 `setCachedUrl` 仅 4625 一处且写 `buildCacheKey(platform,...)` | `kwoff` 永远 miss，无害死读 |
| `suyinKuwoSearch` 写调用方对象 | 3246 `songInfo.duration = parsed.duration` | 修改 App 传入的 musicInfo（跨桥对象），有副作用 |
| 平台不支持时诊断码语义错 | 2438 `code:"QUALITY_OPEN"` | 应为「平台不支持」专用码 |
| 多平台源只按首平台算 | 3457 `gatePlatform`、3516 `qualityShortCircuit` 用 `platforms[0]` | `suyinKuwo`(`kw,wy,tx,mg,kg`)/`ikun`/`huibq` 只测首平台 |
| `resolveDead` 不导出不恢复 | 3696–3723 只导 `playDead`；3805/3840 只恢复 `playDead` | 重启后「取链摘除」立即复活，「播放摘除」保留，**两者不对称** |
| `cacheTtlMs` 热更新调大不生效 | LRU 创建时已捕获 ttl；变更只 `successCache.clear()` | 调小由 `getCachedUrl` 自身校验生效，调大进程内无效 |
| `isAudioPlayable` 206 无条件 true | 1645–1664 | 仅 `200` 校验 `audio|octet|mpeg`；调用点 691/712、3070/3100/3266 |

---

## 三、逐字读完确认「无缺陷」的部分（避免下轮误报）

| 模块 | 行段 | 结论 |
|---|---|---|
| 身份/交叉匹配 | 2684–2790 `identityNormalize`/`identityTokens`/`artistMatch`/`strictTitleMatch`/`crossVariantWords`/`crossVariantCompatible`/`scoreCrossCandidate`/`pickCrossCandidate`/`buildCrossSearchQuery`/`buildSearchKeywords` | 自洽。跨变体词命中即拒、标题严格匹配需 ≥4 字、歌手空则拒、时长差 >5s 拒，均为有意的防误配设计 |
| 版本口径 | 见第一节 | 无漂移，产物可字节复现 |
| `getCachedUrl` 高音质过期不删条目 | 4676–4697 过期缓存兜底 | 有意（v8.10.1 注释措辞不准，非行为缺陷） |
| `applyHealthControls` autoOff 超 6h 不恢复 | 3674–3690 | 有意，`health-persistence-v2.js` P5 明确断言 |
| `PROVIDER_SPECS` | 5870 / `src/80-entry.js` | 非死代码，`scripts/verify-bundle.js` B4 在守 |
| 13 个源 `platforms` 声明 | 3889–3976 | 与端点登记一致 |
| `__debug` 导出面 | 5334–5493 | 完整；`getSourceStats` 不在 `module.exports`（读统计走 `getHealthSnapshot`） |
| 配置热更新白名单 | 5118–5235 | 33 数值键 + 9 布尔键 + `probeSongPool`，类型严格（布尔非 boolean、数值非有限即静默丢弃） |
| 歌词/封面 | 2968 `getLyricForPlatform`、2987 `getPicForPlatform` | 仅 `wy` 有实现，其他平台 `NOT_FOUND`，属能力边界非缺陷 |

---

## 四、测试覆盖盲区（与上面缺陷一一对应）

1. **无 `wrapExecute` 驱动真实音质入账的用例** → R-02 长期不可见；
2. **无 `clearPlayDeadTrials` / `clearResolveDeadTrials` 断言** → R-05 长期不可见；
3. **无档位熔断持久化往返用例**（`aa-p3-persist.js` A4 只验旧版本恢复与 `lastQuality` 字段）→ R-01 长期不可见；
4. **无播放/取链分账断言** → R-03 长期不可见；
5. **无「preGate 放行后 canExecute 再拦截」用例** → R-06 长期不可见。

---

## 五、复现方法（本轮所有结论的取证脚本骨架）

```js
// 必须先注入宿主再 require
globalThis.lx = {
  EVENT_NAMES: { inited: 'inited', request: 'request', updateAlert: 'updateAlert' },
  version: '2.0.0', env: 'mobile',
  utils: { buffer: { from: (d,e)=>Buffer.from(d,e), bufToString: (b,e)=>b.toString(e) } },
  request(url, opts, cb) { setTimeout(()=>cb(null, response), 0); return () => {} },
  on() {}, send() {},
}
const fresh = (cfg) => {                       // 每例干净实例
  globalThis.__lxSourceConfig = cfg || {}
  const p = require.resolve('./lx-source.js')
  if (require.cache[p]) delete require.cache[p]
  return require('./lx-source.js')
}
```

- 伪造可播响应：`{ statusCode:200, headers:{'content-type':'audio/mp4','content-length':'3200000'}, body: Buffer.alloc(64)` 且 `body.write('ftyp',4)`（body 必须 >16 字节，否则 `NOT_AUDIO: 交付内容为空`）
- 造 handler：`Object.assign({}, m.SOURCE_HANDLERS[id], { fn: async () => 'https://example.com/a.m4a' })`，再 `__debug.wrapExecute(fake, platform, songInfo, quality, null)`
- 必须 async IIFE 包裹（Node 22 CommonJS + 顶层 await → `ERR_AMBIGUOUS_MODULE_SYNTAX`），末尾 `process.exit(0)`（模块会起健康定时器，否则进程挂住）
- `m.getSourceStats` / `m.toggleSource` **不在导出面**：统计走 `getHealthSnapshot()`，开关走 `__debug.toggleSource`

---

## 六、建议的修复顺序（按投入产出比）

| 顺序 | 项 | 理由 |
|---|---|---|
| 1 | R-01 档位熔断持久化 | 保护态跨进程完全失效，影响最大，改动面最小（导出/恢复各加一个字段） |
| 2 | R-02 真实音质入账 | 一处传参即可，直接救活「质量档短路」与 `byQuality` 矩阵 |
| 3 | R-03 播放/取链分账 | 与 App 已有 `playWindows` 口径对齐 |
| 4 | R-05 / R-06 试探键与 preGate | 同一族（摘除态），一起改一起验 |
| 5 | R-07 gateErr 源名 | 一行 `err.sourceId` |
| 6 | R-08 文案口径 | 纯文档，可顺手做完 |
| 7 | R-09 ~ R-12 | 需要产品决策或属死分支清理，单独排期 |

每项均按仓库既有门禁执行：**先红后绿**（新断言先跑出失败、再改码转绿）→ 单次本地提交 → 等用户明确「推送」再推。
