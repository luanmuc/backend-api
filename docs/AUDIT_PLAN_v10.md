# 音源仓库审计计划 v11.0（重构版 · 活文档 · 唯一入口）

> **重构说明**：本文件由 v10.0 重构而来，文件名保留 `AUDIT_PLAN_v10.md` 以兼容既有引用。历史 round1~5 分册、v9.0、以及各轮审计报告全部归档，不再叠加进本文件；「当前要审什么、缺口在哪」只以本文件为准。
>
> **基线（唯一真值，2026-11-22）**：
> - 源仓：`luanmuc/backend-api` @ `master`，**v9.1.6**（`c38a2c1`）；产物 **@version 9.1.6 / 7375 行 / 379380 bytes**，ed25519 签名 keyId=**k1**，manifest `487606a8`
> - App 仓：`luanmuc/mobile-app`，**v1.9.2-b199**（`b3ce7440`，已推送；`preflight` **48/0 · 124.0s**）
> - track-player：`669d2ab`（v2 分支，音频焦点 **67** 条 + 代次簿记 **24** 条）
> - 硬数字：`test/` 下 **53 个 `.js` 入口**；`npm test` 链上 **49 个脚本**（冒烟 1 + 审计 46 + 压测 2）；`test/audit/` 下 **47 个脚本**（46 进 `npm test`，`q-quickjs-real` 按需）；冒烟 **67 组**；压测 **162 条**（S12 + T14 + V133 + D3）；**错误码 19 个**（R71d 增 `UNSUPPORTED_ACTION`）；变异 **22 killed / 0 survived**；审计合计 **615 条**（589 + R77 `r77-fixes` 26 + R78 `reviewAt` 未来日期断言 1）
> - **v9.1.6 实跑（2026-11-22）**：`npm test` **rc=0**（V **133/0**、T **14/0**、元审计 16/0、`f-repo` 57/0）；`stress-test` S **12/0**（不在 `npm test` 链上，须单跑）；变异 **22 killed / 0 survived / 100%**；`docs-audit --dry-run` **待处理 0 / 报告 44 / 硬失败 0**；`self-check` 通过（9.1.6）；`v9-gate[core]` **通过 34s**；`verify:bundle` **8/0**；`api-surface` 一致（导出 27 / `__debug` 88 / 错误码 **19** / 事件字段 12 / 快照键 6）；`tg-truth` 口径全一致
> - **v9 新增防线（本轮新增审计面）**：`layer-check.js`（L1~L6 拆包分层，legacy 不得回长、core 模块依赖只能走 `dep()`）、`cross-repo-version.js`（X1~X5 用 App 真实 `HEADER_VERSION_LINE_REGEX` 解析产物）、`schema-parity.js`（4 组计数语义 + App `HealthDigest` 四顶层键）、`sign-release.js`（ed25519 签名/验签/篡改检测）、`v9-gate.sh --group fast|core|stress`
> - 本文件对应变更：v9.0「6272 行单文件 → 1290 行装配层 + 33 个 `src/core` 模块（`bindDep/dep` 110 条注册）」；`18-health-persist` 改纯区间判定（撤 7 元素白名单）；`02-config` 增 `SOURCE_VERSION`；RF18 去硬编码改「package.json 与产物 `@version` 一致」

---

## 0. 目标与边界

**目标**：按当前 HEAD 审「代码正确性 + 运行逻辑 + 全仓完成度 + 跨仓契约 + 定制功能间联动」，重点找未完成、半成品、文档说完成但代码未落地、以及**跨仓联动里被单仓审计漏掉的漂移**。

**边界**（不做，标 blocked，不写成通过）：
1. 真机安装/播放（无 adb / KVM）
2. tx 完整曲目（上游约 60 秒试听）
3. 真上游持续稳定性长跑

**纪律**：每个结论带「命令 + rc + 通过/失败计数」；失败先修实现或明确夹具漂移；反向修改必须能让断言变红；不沿用历史绿。

---

## 1. 证据三级

| 级别 | 定义 | 能支撑的结论 |
|---|---|---|
| **A 强证据** | 断言存在，且注入缺陷后能红（red-green 反向验证过） | 「这个性质被守住了」 |
| **B 防回归** | 断言存在，但注入无有效路径或未做注入 | 「改坏了会有人喊」（不保证方向对） |
| **C 结果层** | 只验结果（已知错误码、不崩），不定位到具体防线 | 「不会更糟」 |

铁律：C 级不能说成「防线有效」；B 级不能升级为 A 级而不做注入。

---

## 2. 审计维度总表（全覆盖，一表到底）

| 域 | 覆盖内容 | 落地脚本 | 断言 | 证据级 |
|---|---|---|---|---|
| 静态与语法 | 语法、编码、TODO、密钥、调试残留、导出面 | `a-static.js` + `f-repo.js` | 10 + **57** | A |
| 框架与宿主 | lx 宿主契约、action 声明、EVENT 收发、生命周期 | `b-logic.js` + `s-source-lifecycle.js` | 30 + 14 | A |
| 核心逻辑 | 取链、降档、竞速、短路、预算 | `b-logic.js` | 30 | A |
| 功能与异常 | 歌词/封面/管理 action、异常归一 | `d-func.js` + `e-extra.js` | 30 + 90 | A |
| 交付真实性 | 1KB 验真、片段判据、音质回填、缓存单写点 | `e-extra.js` | 3 | A |
| 状态机 | 断路器 closed/open/half-open、休眠、playDead | `d-func.js` + `e-extra.js` | 3 | A |
| 记账口径 | 成功率分子分母、429 不计失败、byQuality | `e-extra.js` | 6 | B |
| 缓存身份 | 缓存键、分级 TTL、单写点、命中验真 | `e-extra.js` | 11 | A |
| 竞速预算 | 总预算、分档预算、末档保底、错峰 | `e-extra.js` | 5 | B |
| 探活自愈 | 探针、健康分、休眠复醒 | `e-extra.js` + `g-meta.js` | 18 | A |
| 假成功 | code:0 无链接、错歌、片段伪装完整 | `e-extra.js` | 2 | B |
| 配置面 | 白名单、注入声明、NaN 拒写 | `e-extra.js` | 5 | A |
| 测试有效性 | 断言 ID 形式、脚本守卫、退出码、入口登记 | `g-meta.js` | 14 | A |
| 文档镜像 | 版本串三文档一致、数字可解析、死链 | `f-repo.js` + `docs-audit.js` | 8 | A |
| 安全与密钥 | 明文 token、密钥、无 `/tmp` 硬编码 | `f-repo.js` | 2 | A |
| 裁决层 admission | 证据分级、codeRank、admit 单入口、弱证据 TTL、关源清账 | `r-admission.js` | 24 | A |
| 跨平台兜底 | 主平台失败识别、身份匹配、ID 隔离、grace、缓存失效 | `u-cross-platform.js` | 12 | A |
| Provider Contract | 14/12/2、链位不重复、观察源无链位 | `y-provider-contract.js` | 15 | A |
| 取消语义 | 真取消、竞态、在途清理 | `z-cancel.js` | 11 | A |
| 健康事件 | 事件白名单、去重、脱敏 | `s-health-events.js` | 27 | A |
| 桥媒体信封 | `__lxMedia:2`、分片、解码 | `x-media-envelope.js` | 12 | A |
| 降级所有权 | `fallbackOwner` host/source | `w-fallback-owner.js` | 2 | A |
| QuickJS 真引擎 | 宿主无 Buffer 环境 | `q-quickjs-real.js` | 3 | A |
| 候选源审计 | 候选接入证据链 | `candidate-audit-test.js` | 6 | A |
| **非法 URL 防线（R75）** | `javascript:`/`file://`/`data:`/`//evil` 伪协议、空与超长入参、http→https 升级边界 | `security-url-guard.js` | 12 | A |
| **音质真实标签** | `qualityFromDelivery`、`sniffAudioBytes` 总字节、`qualityConfidence`、片段语义 | `quality-truth.js` | 9 | A |
| **音质政策优化** | 能力备档不续期、`definitiveFail` 分类、短路改判据、唯一源探路、强制探路、旧快照兼容 | `quality-policy-v2.js` | 12 | A |

| **健康域（14 脚本）** | 探测分批/资格判定/断路器/快照 ETA/事件/状态机/持久化/版本兼容 | `health-*.js` | **102** | A |
| **计划唯一性** | 每仓审计 1 份 + 压测 1 份；归档合并为一份 | `tg-truth` G14 + `docs-audit` | 1 | A |
| **拆包分层（v9.0 新增）** | legacy 不得回长（行数上界）、core 模块只能通过 `dep()` 取依赖、装配清单与模块数一致 | `scripts/layer-check.js` | L1~L6 | A |
| **跨仓版本解析（v9.0 新增）** | 用 App 真实 `HEADER_VERSION_LINE_REGEX` 解析产物 `@version`，双仓口径必须一致 | `scripts/cross-repo-version.js` | X1~X5 | A |
| **计数语义对齐（v9.0 新增）** | `probe.total` ↔ `probeRequests` ↔ `DigestSourceCount.total` 等 4 组 + App `HealthDigest` 四顶层键 | `scripts/schema-parity.js` | 4 组 | A |
| **发布签名（v9.0 新增）** | ed25519 签名/验签/篡改必红、keyId 与 App 内置公钥表一一对应、无密钥时跳过而不产半成品 | `scripts/sign-release.js` + `check_source_signing`(App) | 签名链路 | A |
| **巡检链口径单一真相（v9.1.4 新增）** | `ok` = 端点级最终结论（`httpOk && payload`），新增 `httpOk`/`httpReason` 保留 HTTP 层原始事实（修 90 条 `ok:true`+`payload:false` 矛盾记录）；成功率统一**探测级** `rateRaw` + `wilsonLow`，天级只留「可用天」；param 类（`{id}`/`{level}` 模板）端点**一律不判可用**且不显示成功率；旧口径记录标 `legacy` 不参与统计；`consecutiveFail` 改**全历史**；仅试听降级为「可用但受限」（`ok:true` + `fragment:true` + 实际时长） | `tg-truth` + `f-repo` X 组 + `health-*.js` + `probe --assert-samples` | 口径一致 | A |
| **巡检共享库收敛（v9.1.4 新增）** | `scripts/lib/history.js`（归一化/读写/窗口/Wilson 单一实现，probe 与日报共用，删两边各约 80 行重复）、`probe-songs.js`（五平台《晴天》271s 单一真相，替代 4 份手写歌单）、`source-host.js`（provider 驱动取链，`PAYLOAD_CHECKS` 由 9 条手写 `getUrl` 降为 9 条 `{key,src,plat,expectSec}` 声明） | `f-repo` + `docs-audit` | 无重复实现 | A |

**当前总数**：冒烟 **67 组** + 审计 **589 条**（健康域 102 + 其余 455 + 口径 10 + **R71d 新增 `force-probe-contract` 10** + **R75 新增 `security-url-guard` 12**）+ 压测 **162 条** + 变异 **22 killed / 0 survived**。计数真值以 `docs/TESTING.md` 与 `docs/AUDIT_MATRIX.md` 为准；`npm test` rc=0 覆盖 **48 个脚本**（v9.1.6 + R75 实跑；`f-repo` 57/0、`force-probe-contract` 10/0、`security-url-guard` 12/0、`readthrough-fixes` 18/0 均已计入）。

---

## 2b. 定制功能逐项明细（排除车机版）

> 每个定制功能单列一行：功能 → 关键位置 → 守的脚本/断言 → 状态。音源仓无车机版；App 侧车机版不在本计划范围。

| 定制功能 | 关键位置 | 守的脚本/断言 | 状态 |
|---|---|---|---|
| 请求处理全流程（getUrlWithFallback） | `lx-source.js` | `b-logic` | ✅ |
| 音质降级链（128k/320k/flac/flac24bit） | `lx-source.js` | `stress-test` S 组 12/0 | ✅ |
| 竞速回退（fallbackRace） | `lx-source.js` | `b-logic` | ✅ |
| L4 裁决层（admit 判定+记账唯一入口/证据分级/codeRank） | `lx-source.js` | `r-admission` 24 | ✅ |
| 健康自愈（健康探测/10 分制/断路器/休眠/playDead） | `lx-source.js` + `health-*.js` | `s-health-events` 27 + 18 个 `health-*` 分项 | ✅ |
| 音质政策优化（能力备档不续期/definitiveFail 分类/短路判据/唯一源探路/forceQualityProbe） | `lx-source.js` | `quality-policy-v2` 12 | ✅ |
| 音质真实标签（qualityFromDelivery/sniffAudioBytes/qualityConfidence/片段语义） | `lx-source.js` | `quality-truth` 9 | ✅ |
| 缓存与防死链（分级 TTL/单写点/1min 失败缓存） | `lx-source.js` | `e-extra` | ✅ |
| 跨平台兜底（主平台失败识别/ID 隔离/grace） | `lx-source.js` | `u-cross-platform` 12、`v-cross-platform-stress` 13 | ✅ |
| 降级所有权（fallbackOwner host/source） | `lx-source.js` | `w-fallback-owner` 2 | ✅ |
| 媒体信封（`__lxMedia:2`/分片/解码） | `lx-source.js` | `x-media-envelope` 12 | ✅ |
| 取消语义（真取消/在途清理） | `lx-source.js` | `z-cancel` 11 | ✅ |
| Provider Contract（14/12/2/链位不重复） | `lx-source.js` | `y-provider-contract` 15 | ✅ |
| 候选源接入（fish/helloworld/hyw/jiexiang/lx/qdy） | `lx-source.js` | `candidate-audit-test` 6 | ✅ |
| 健康事件（白名单/去重/脱敏） | `lx-source.js` | `s-health-events` 27、`t-health-events-stress` 12 | ✅ |
| QuickJS 真引擎（宿主无 Buffer） | `lx-source.js` | `q-quickjs-real` 3 | ✅ |
| 配置键体系（config action 面板可写/只读/已删键） | `lx-source.js` | `e-extra` 配置面 | ✅ |
| 接口生命周期管理 | `lx-source.js` | `s-source-lifecycle` 14 | ✅ |
| 巡检链口径（端点级 `ok`/探测级成功率/param 不适用/legacy 隔离/仅试听降级/`consecutiveFail` 全历史） | `scripts/probe.js`、`health-daily.js`、`scripts/lib/{history,probe-songs,source-host}.js` | `tg-truth` 口径一致 + `f-repo` X 组 + `probe --assert-samples` | ✅ |

**状态说明**：✅ 有脚本断言且已审；车机版相关项已移出本计划。

---

## 3. 音质政策优化审计面（本轮核心变更，`fb94fcf`）

> 方案见 `docs/archive/QUALITY_POLICY_OPTIMIZATION_PLAN.md`。这不是「音质真实标签」，而是**能力备档与档位短路的记账口径修正**——修两个真实缺陷：①重复播放低质把 6h 备档续成永久降级；②3 次网络超时把唯一 flac 源短路 1h。

| ID | 检查面 | 关键位置 | 验收 |
|---|---|---|---|
| QP-A | 能力备档不续期 | `noteQualityCeiling()` / `getQualityCeiling()` | 同档重复低质不刷新 `nextProbeAt`；definitive 6h / transient 10min / 未知 30min / 429 不记 |
| QP-B | 只记真实进入请求链的档 | `attemptedQualities` | 被短路/健康策略跳过的档不记 ceiling |
| QP-C | definitiveFail 分类 | `classifyQualityFailureCode()` | 超时/5xx/连接=transient 不涨 `definitiveFail`；404/410/NOT_AUDIO/PREVIEW_FRAGMENT=definitive；429=rate_limit |
| QP-D | 短路只算确定性失败 | `isQualityHopeless()` | `definitiveFail + linkExpired ≥ 3` 才短路；transient 走 breaker 180s 冷却 |
| QP-E | 唯一高质源探路 | `countActiveQualitySources()` + `qualityShortCircuitUniqueProbeMs`(600000) | 唯一源短路后 10min 放行一次（非唯一源 1h） |
| QP-F | 用户强制重试旁路 | `forceQualityProbe()` + action `forceQualityProbe` | 只放行一轮，不动 breaker/健康账本 |
| QP-G | 旧快照字段兼容 | `restoreHealthState()` | 缺 `definitiveFail` 回退旧 `fail` |
| QP-H | 健康快照只读 | `HEALTH_QUALITY_NUMBER_FIELDS` | 探路不写 1h 快照 |

**本轮实跑**：`quality-policy-v2` 12/0、`quality-truth` 9/0、`npm test` rc0、压测 162/0。

---

## 4. 跨仓联动审计面（本轮新发现，单仓审计会漏）

| 编号 | 联动点 | 现状 | 性质 |
|---|---|---|---|
| QP-L1 | **第 14 个 action `forceQualityProbe`** | **已闭合（2026-11-16）**：App `SOURCE_ACTIONS` 14、`check_source_contract` 14/0 对齐、`SYNC_POINTS.md` 已写 14；源侧实现完整 + `quality-policy-v2` QP6 覆盖。App 无 UI 调用方属「源能力声明」，不删 | 已闭合 |
| QP-L2 | **能力备档压制起跑档无 App 可见解释** | 音源 `getQualityCeiling` 把「这首歌只有 128k」记 6h/10min，请求 flac 被直接 128k 起跑；App `onQuality` 回填 128k 但 UI 无「因源能力备档跳过」提示 | 体验缺口 |
| QP-L3 | **`definitiveFail`/`linkExpired` App 不消费** | 音源 byQuality 快照新增两字段；App `Health.tsx` 类型仍 `req/success/fail/businessFail/rate/avgTime/state` | 源有数据、App 不展示（无害） |
| QP-L4 | **`qualityConfidence` 三值跨仓一致** | 音源返回 `exact/estimated/unknown`；App 消费时 `default='exact'` 仅作旧源兼容 | 已对齐，回归面继续守 |

**联动审计铁律**：字段名对得上 ≠ 语义对得上；字段、枚举、默认值、单位四样都要对。音源新增字段/action/字段枚举时，必须反查 App 的 `sourceContract.ts`、`Health.tsx`、`SYNC_POINTS.md`、`check_source_contract.js` 是否同步。

---

## 5. 执行清单（本轮必跑，不接受「上次绿过」）

> 2026-11-16 起：**`npm test` 就是 CI 判据**，不再先跑本地子集再看云端（当前 **48 脚本**）。压测与变异单独串行（计时类断言不能被抢占）。


```bash
npm test                                   # 48 脚本（= CI 的 L3+L4+L4.1~L4.3 全量清单）
node --expose-gc test/stress-test.js        # S 12
node --expose-gc test/stress-round3.js      # T 14
node --expose-gc test/stress-round4.js      # V 133
node test/mutation/run.js --full --strict   # 变异 22 killed / 0 survived（不可与压测同跑）
node scripts/self-check.js                  # 版本串三处一致
node scripts/docs-audit.js --dry-run        # 文档镜像 0 红
npm run verify:bundle                       # 产物 lx-source.js 8/0
bash scripts/v9-gate.sh --group core        # v9 门禁（E0+L+C2+E1抽样+E3+X+C1），~35s
node scripts/layer-check.js                 # L1~L6 拆包分层
node scripts/cross-repo-version.js          # X1~X5 双仓版本口径
node scripts/schema-parity.js               # 4 组计数语义 + App HealthDigest 键
node scripts/sign-release.js --verify --pub "$LX_PUBKEY"   # 发布签名可验
```

### 5b. 全量脚本台账（53 入口 = 49 进 `npm test` + 4 按需）

| 脚本 | 条数 | 归属 |
|---|---:|---|
| `test/lx-source-smoke-test.js` | 67 组 | 冒烟（进 npm test） |
| `a-static` / `b-logic` / `d-func` / `e-extra` | 10 / 30 / 30 / 90 | 静态/逻辑/功能/扩展 |
| `f-repo` / `g-meta` / `h-toggles` | **57** / 16 / 8 | 仓库/元审计/开关 |
| `n-fixes` / `p-gaps` / `q-dfix` / `q2-dseries` | 4 / 4 / 5 / 3 | 缺陷回归/零覆盖补测/D 系列 |
| `r-admission` / `s-health-events` / `t-health-events-stress` | 24 / 27 / 12 | 裁决层/健康事件/压力 |
| `u-cross-platform` / `v-cross-platform-stress` / `w-fallback-owner` / `x-media-envelope` | 15 / 13 / 2 / 12 | 跨平台/降级所有权/媒体信封 |
| `y-provider-contract` / `s-source-lifecycle` / `z-cancel` | 15 / 14 / 11 | Provider/生命周期/取消 |
| `quality-truth` / `quality-policy-v2` | 9 / 12 | 音质真实标签/音质政策 |
| `budget-admission` / `aa-p3-persist` / `v-eligibility` | 7 / 10 / 7 | 预算裁决/P3 持久化/资格 |
| `tg-truth` | 9 规则 | 口径门禁（含 G14 计划唯一、G15 双口径、G17 空跑守卫） |
| `health-*.js`（14 个） | 102 | 健康域（探测/资格/断路器/快照/事件/版本） |
| `candidate-audit-test.js` | 6 | 候选源接入 |
| `security-url-guard.js` | 12 | **R75**：非法 URL 防线（三处运行时校验 + 协议白名单） |
| `r77-fixes.js` | 27 | **R77**：R76 通读缺陷修复回归（G12/G13/G14 + P2-06/G9/契约新鲜度/interval/解析顺序/预热锚点/探针元数据） |
| `q-quickjs-real.js` | 3 | **按需**：需 `npm i quickjs-emscripten`（CI L5.2 单独装） |
| `test/stress-test.js` / `stress-round3` / `stress-round4` | 12 / 14 / 133 | **按需**：压测，见 `STRESS_PLAN.md` |
| `test/mutation/run.js` | 22 | **按需**：变异，不可与压测同跑 |

通过标准：全部 rc0；变异 killed 率 100%。

---

## 6. 缺口清单（当前未覆盖，不是「没写进文档」）

| ID | 缺口 | 验证方法 | 验收 |
|---|---|---|---|
| ~~G10~~ **已闭合** | 原记「`f-repo` 不在 `npm test` 里，文档死链/H1 门禁本地从不跑」 | **2026-11-16 实锤**：合并归档后 `f-repo` 报 2 红（`AUDIT_HISTORY.md` 多个 H1、README/AUDIT_RESULTS 指向已删分册、归档原文相对链接全死），云端 CI 会红而本地 `npm test` 全绿 | 已把 CI 的 L3/L4 清单全量并入 `npm test`（26→42），死链与 H1 全部修好，`f-repo` 56/0 |
| ~~G11~~ **已闭合** | 原记「`package.json` 无 `engines.node`，CI 钉 20 与本地/协作者无约束」 | 2026-11-16 加 `"engines": { "node": ">= 18" }`；纯声明、零运行时影响 |
| G2 | 平台覆盖只有 kw 全链；wy/tx/mg/kg 无真实取歌断言 | 各构造一次取链 | 至少 wy、tx 各一条真实取链，或记录「结构同 kw」依据 |
| G5 | 长时运行成功路径未覆盖 | 200 次不同歌，记 RSS | 各表 ≤ 上限，RSS 有上界 |
| G6 | 安全面只有静态 grep | 构造 `javascript:`/`file://`/超长参数 | 非法 URL 拒、超长截或拒 |
| G7 | 性能无基线 | 实测加载/探针/单请求耗时 | 记录数字，超预算有解释 |
| QP-L1~L3 | 音质政策 App 消费面（见 §4） | App 侧跟进 | 见 §4 处置 |
| G8 | 冷启动预热与短路 5 项（原 round2 §O，O1~O5 全部【未测】） | `coldStartTimeoutMs` 内完成或放弃、`coldStartWarmTtlMs` 内复用、`qualityShortCircuit` 采样达标短路且采样不足不短路、`playDeadReviveMs` 内重复失败不放大 | 补 `coldStart-*` 断言 5 条并双向验证，或记 blocked |
| G12 | export→restore 全字段等价（R76 P1-01 漏网根因） | 导出含 `playDead.quality` 的快照→恢复→逐字段比对 | 全字段等价断言入 `test/audit/`，红绿双向 |
| G13 | 二进制解析真实格式夹具（R76 P1-02 漏网根因） | 合法 FLAC（小端长度）/ID3v2.3/2.4/2.2 字节夹具喂 `parseAudioTags` | 标签解析断言入 `test/audit/`，红绿双向 |
| G14 | 快照纯度（R76 P2-01） | `getHealthSnapshot` 调用前后 `qualitySkipProbeAt`/熔断器指纹不变 | 纯度断言入 `test/audit/` |
| G9 | 预览冷却/缓存 key 边界（原 round5 EDGE6/EDGE7、TTL ±1ms、`songmid` 含 `\|`） | 同歌同档 duration 差 2 分钟须区分 key、冷却到期前 1ms/后 1ms、`platform\|mid\|quality` 拼接不粘连 | **已定性（R75）**：`07-net.js:197` `buildCacheKey` 只拼 `prefix_id_name_singer_album_quality`，**不含 duration**——同 id 不同版本（现场版/原版同时长档）会撞同一槽位。修它会改动产物字节、必须重签 manifest，属发布窗口动作，本轮不改，留作 P2。 |

---

## 7. 已知取舍（已确认，不再当新问题重复提）

| 事项 | 现状 | 为什么保持 |
|---|---|---|
| tx/mg/kg 只有单源，链接时效波动 | 靠验真 + 降档 + 1min 失败缓存 | 如实失败不假交付 |
| `INFLIGHT_URL_MAX=200` 超限 clear | 最坏是合并失效多打外呼 | 不出错不丢交付 |
| MEM Map 上限淘汰是产品行为变更 | 上限 2000，淘汰生效 | 已确认接受 |
| `AUDIT_RESULTS.md` 1100+ 行不拆 | 缺陷总账已补齐 D-01~D-39 | 拆分破坏历史链接 |
| 高质缓存 TTL ±1ms 不单独断言（原 round5 §12.9） | `cacheTtlHighQualityMs` 用 `>` 边界，-1ms 命中/+1ms 未命中无独立用例 | 毫秒级计时在 CI 上假红风险高于收益；功能性边界已由 EDGE1~EDGE5 覆盖 |
| `songmid` 含 `\|`/空格/emoji 不单独断言（原 round5 §12.9） | key 为 `platform\|mid\|quality` 拼接，无分隔符转义用例 | 平台返回的 songmid 实际不含 `\|`；若出现即先修 key 生成而非只补断言 |

---

## 8. 断点与记录要求

1. 每条结论分「事实 / 推断 / 未知」，跑不出来的记未知不记通过。
2. 真实缺陷按 `D-<序号>` 编号，修完补断言并注入验证。
3. 不改判据迁就现状；只改代码或如实降级证据级。
4. 每轮结论写入 `docs/AUDIT_REPORT-YYYY-MM-DD.md`；本文件只更新基线、维度状态、缺口状态。

---

## 9. 细粒度检查矩阵与 2026-11-13 实测（原 v9.0 独有，归档前承接）

> v9.0（原 `docs/AUDIT_PLAN.md`，600 行）已归档至 `docs/archive/AUDIT_HISTORY.md`（与 round1~5、stress-round4 合并成一份历史合集）。归档前甄别出**两项未进本文件**的独有信息，在此承接：带行号的 13 项细粒度矩阵、2026-11-13 实测的 5 条缺陷。其余历轮结论见 `docs/AUDIT_RESULTS.md`。

### 9.1 细粒度审计矩阵（S-A01~S-A13）

| ID | 检查面 | 关键位置 | 验收 |
|---|---|---|---|
| S-A01 | 资格判定唯一入口 | `computeEligibility` 约 2380 | open/限流/半开/短路/冷却/本地限额优先级不串 |
| S-A02 | 128k 保底档 | `wrapExecute` 约 4340、`computeEligibility` 约 2416 | flac/320k 冷却排除；128k 仍入链、仍可执行 |
| S-A03 | 半开恢复 | `canExecute` 约 1250、`buildSourceChain` 约 4156 | build 只 peek 不推进；冷却到期只放一枪；trial 失败收回 open |
| S-A04 | 短路与熔断互斥 | `isQualityHopeless`、`breakerTrialReady` | 短路不能抢在冷却到期试探前剪链 |
| S-A05 | 探针双歌/间隔 | `buildProbeConfig` 约 408、`probeSingleSource` 约 631 | 单目标补第二首；tier 间隔可配 |
| S-A06 | 预热 TTL | `coldStartWarmTtlMs`、`warmCalls` | TTL 内不重复预热；显式探针单独结算 |
| S-A07 | 快照只读 | `getHealthSnapshot` 约 3595、`peekThrottle` 约 4268 | 读快照不改 `reqTimestamps` |
| S-A08 | 记账唯一 reducer | `applyAdmission` | PASS/FAIL 只走一处；跳过不污染成功率 |
| S-A09 | 事件/容量 | `recordHealthEvent`、`HEALTH_HISTORY_MAX=1008` | eventId 唯一、环形容量、不丢最新 |
| S-A10 | 排序防线 | `sortChainByHealth` 约 4164 | `eligible=false`/`skipReason` 不入链 |
| S-A11 | 配置边界 | `USER_CONFIG`/`PARAM_LIMITS`（约 15–75 行） | jitter 0~0.5、pause 1s~5min、池 1~20 |
| S-A12 | 全仓完成度 | `src`/`test`/`docs`/`scripts` | TODO/占位/死字段/文档漂移逐条定性 |
| S-A13 | 产物同步 | `npm run build` | `lx-source.js` 字节数/内容与 `src` 一致 |

> 行号是 2026-11-13 时的定位锚点，代码演进后以 `grep` 重新定位；本表是**检查面清单**，不是行号台账。§2 域总表是「审什么」，本表是同一批检查面的「更细切口」，二者互补不重复。

### 9.2 2026-11-13 实测发现（S-F01~S-F05）

| 编号 | 发现 | 等级 | 证据 | 处置 |
|---|---|---|---|---|
| S-F01 | `computeEligibility` 把 preview 冷却源整源过滤，128k 保底档也被挡 | 高 | 三档全被剪；`wrapExecute` 明确放行 128k | 已改为仅非 128k 返回 `PREVIEW_COOLDOWN`；C6 改为 flac 排除/128k 包含 |
| S-F02 | 冷却到期的 open 被 `qualityShortCircuit` 抢先剪链，半开恢复拿不到请求 | 高 | S5b 冷却后外呼 0 | 已加 `breakerTrialReady`，短路让路；S5b 复跑外呼 3 |
| S-F03 | `probeSingleSource` catch 注释与代码相反（注释称回退 URL，代码为 `throw e`） | 低 | 注释与代码相反 | 已改注释为「直接三值失败、不回退 URL」 |
| S-F04 | T2/V18c/V25b/V25c/S5 夹具漂移 | 中 | 首跑 11/3、130/3、11/1 | 已修夹具（不动实现） |
| S-F05 | 文档计数漂移：CHANGELOG 写 286797、TESTING 写 429/655 | 低 | 实际 288771；入口 44 / npm test 19 | 已同步 |

> S-F01/S-F02 是**已修复并加断言**的真实缺陷，不是待办；本节保留其证据链，供后续回退验证（反向改实现必须变红）。

---

## 10. 维护记录（本文件只记基线变更，不堆历史）

| 日期 | 变更 | 实跑证据 |
|---|---|---|
| 2026-11-23 | **R76 全量通读**：v9.1.6 产物 7375 行逐行只读通读；定案 P1×2 + P2×6（报告 `docs/reports/R76-音源全量通读-2026-11-23.md`）；§6 新增 G12~G14 三个覆盖面 | 对已发布产物复现 6 通过 / 4 失败（失败=缺陷坐实）；`verify:bundle` 8/0；未改代码 |
| 2026-11-23 | **R77 全量通读修复（v9.1.7）**：新增 `test/audit/r77-fixes.js`（25 条）固化 R76 定案修复——G12 导出→恢复全字段等价 / G13 FLAC 小端 + ID3v2.2/2.3/2.4 真实字节夹具 / G14 快照纯度 / P2-06 档位复位 / G9 缓存 key 含时长 / 契约复核新鲜度（`REVIEW_GRACE_DAYS=14` + 时间注入）/ interval 回退 / 原串优先解析 / 预热锚点分表 / 探针轮换清 singer·duration；红绿双向 6 轮旧形态重演全红后还原 25/0；`npm test` **48→49 脚本**、`test/` 入口 **52→53**、`test/audit` **46→47**、审计合计 **589→615**；同步补齐 ci.yml L4.3 此前遗漏的 `security-url-guard` / `force-probe-contract` / `anchors-contract` |
| 2026-11-23 | **R78 真实复核与 `reviewAt` 门禁收口（v9.1.7 同版）**：①对 4 个源 + 3 个覆盖缺口做真复核（6 次真实上游探测），结论：`suyinKuwo`/`suyinQQ`/`suyin163` 三接口 `404 code -13001` 已下线、`juhe` 全域 `429`、`qingliangTx` 与 `suyinMigu` 可用；②`reviewAt` 语义收口为「真实复核日」，`REVIEW_FUTURE_TOLERANCE_MS=24h` 反向卡死「写未来日期绕过 14 天宽限」（R77 的 11-26/11-30 正是这种写法，登记 K35）；③覆盖缺口 risk 按实际可用源数改写（tx medium→high）；④新增 **B10** 双向验证（删未来判定 26/1 红、还原 27/0 绿）+ C06 提取式防回退；⑤新增 **K34**（上游大面积失效，外部 OPEN）与 **K32** 观测三件套/升级触发条件。审计合计 **614→615** |
| 2026-11-23 | **R79 新源与主备双域（v9.2.0）**：①新增 `luoyueTx`（落月 tx，`api.vkeys.cn/music/tencent/song/link`，128k/320k/flac 三档真音频验真）→ tx 链四源（`suyinKuwo→qingliangTx→luoyueTx→juheTx`）；②`xinghaiBackend` 改主备双域 `yy1`→`yy`，仅 NETWORK_ERROR/TIMEOUT/SERVER_ERROR 切换；③mg 放开证否（星海 mg 分支对任意 mid 恒定返回同一首 + `suyinMigu` 复测 `code 502`），改为如实登记不接；④预算 13/11 → 14/12（`luoyueTx: true`），契约/开关/探针/端点表 19→21/台账/verify-bundle/tools-live/smoke 全链同步；`npm test` EXIT=0（R77 回归 **27/0**）、`verify-bundle` 8/0、`api-surface` E0、`cross-repo` 9.2.0 一致；产物 392277 bytes |
| 2026-11-22 | **R75 补 G6**：新增 `test/audit/security-url-guard.js`（12 条）覆盖 `validateUrl` / `probeAudioDelivery` / `upgradeToHttps` 三处运行时校验；`npm test` **47→48 脚本**、`test/` 入口 **51→52**、`test/audit` **45→46**、审计合计 **577→589** | 12/0；红绿双向（把 `HTTP_URL_REGEX` 放宽成 `/^[a-z]+:/i` → 5 条红）；`npm test` rc0 |
| 2026-11-22 | 基线升到 **v9.1.6 / `c38a2c1`**（产物 9.1.6 / 7375 行 / 379380 bytes / manifest `487606a8`）；App **b199 / `b3ce7440`**；`npm test` **46→47 脚本**（新增 `force-probe-contract` 10 条，审计合计 **567→577**）；`test/` 入口 **49→51**（按需 **3→4**）；错误码 **18→19**（`UNSUPPORTED_ACTION`，R71d） | `npm test` **rc=0**（V **133/0**、T **14/0**、元审计 16/0、`f-repo` **57/0**、`FP` **10/0**）；`stress-test` S **12/0**；变异 **22 killed / 0 survived**；`docs-audit` 待处理 0 / 报告 44 / 硬失败 0；`v9-gate[core]` 34s；`verify:bundle` **8/0**；`api-surface` 错误码 **19** |
| 2026-11-20 | 基线升到 **v9.1.4 / `297c88e`**（巡检链重构，脚本级、产物仍 9.1.3）；App 基线 b151→**b187**、RNTP 88b062b→**3f8546d**；`npm test` **45→46 脚本**；新增两个审计面（**巡检链口径单一真相**、**巡检共享库收敛**）；§2b 补「巡检链口径」定制行 | `npm test` **rc=0**（V **133/0**、S 12/0、T 14/0）；`f-repo` **57/0**；`docs-audit` 0 待处理；`self-check` 通过；`v9-gate[fast]` 通过；`tg-truth` 口径全一致 |
| 2026-11-18 | 基线升到 **v9.0.0**（7071 行 / 362008B / ed25519 k1）；新增 4 个审计面（layer-check L1~L6、cross-repo-version X1~X5、schema-parity、sign-release 验签）；`npm test` 42→**45 条命令**；修 MU15/MU22 拆包后失效锚点 | `npm test` RC=0；V 133/0；S 12/0；变异 22 killed/0 survived；`v9-gate core` 35s 通过；`verify:bundle` 8/0；`docs-audit` 0 红 |
| 2026-11-17 | 巡检升级第一阶段：probe 每次 3 次探测 + `--assert-samples` 空跑守卫；日报加 Wilson 95% 下限与出链抽样段；告警改滚动 Issue；`tg-truth` 加 G15/G17（口径 7→9） | `npm test` rc0 42 脚本 / 567 条；`probe --reps=3 --assert-samples` 当日 51 样本；`source-audit --quick` 8/11 出链 |
| 2026-11-16 | 基线升到 v8.16.1 / App b143；`npm test` 26→42 脚本（并入 CI 审计清单）；计划唯一性收口（`tg-truth` G14） | `npm test` rc0 42 脚本 / 564 条；`f-repo` 56/0；`docs-audit --dry-run` 0 红；`verify:bundle` 8/0；`npm test` rc0 |
