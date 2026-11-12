# 音源仓库审计计划 v10.0（六轮整合版 · 活文档）

> 这份文件是**前五轮的唯一合并入口**。前五轮的分册（`audit-plans/round1~5.md`）保留为原文存档，
> 但"到底审过什么、用什么断言守、哪些还没审"只以本文件为准。
> 生成日期：2026-11-09；**最近更新：2026-11-11（v8.12.1 跨平台兜底/缓存失效 + 跨平台压力矩阵）**。
> 当前基线：`lx-music-source` HEAD `1bec334`，`lx-source.js @version 8.12.5`，审计 **365 条** / 压测 **159 条** / 冒烟 **67 组** = **591 条**；`TESTING.md` 为唯一真值。

## 0. 为什么要有 v10

v9.0 是"分轮叠加"的结构：A~T 维度矩阵 → 第三轮 U~Z → 压测两代 → 第五轮 MUT/INV/EDGE/FAULT/MEM。
问题有三个：

1. **同一个维度在不同轮里叫不同名字**（断言有效性在第二轮叫 P 组、第四轮叫 M 组、第五轮叫 MUT/INV），查重困难。
2. **"审过"与"守得住"被混为一谈**。第五轮证明了：只看"有断言"不算数，要看"注入缺陷后它红不红"。
3. **没有一张"还没审"的清单**。五轮都是"想到什么审什么"，没人列过剩余死角。

v10 把这三点收口：一张维度总表、一个三级证据分级、一张缺口清单。

## 1. 证据三级（沿用第五轮定义，全仓统一）

| 级别 | 定义 | 能支撑什么结论 |
|---|---|---|
| **A 强证据** | 断言存在，且**注入对应缺陷后能红**（red-green 反向验证过） | "这个性质被守住了" |
| **B 防回归** | 断言存在，注入无有效路径或未做注入 | "改坏了会有人喊"（不保证方向对） |
| **C 结果层** | 只验证结果层面（拿到已知错误码、不崩），不定位到具体防线 | "不会更糟" |

**铁律**：C 级不能说成"这个防线有效"。B 级不能升级为 A 级而不做注入。

## 2. 维度总表（前五轮合并）

| 维度 | 覆盖面 | 落地脚本 | 断言数 | 最高证据级 |
|---|---|---|---|---|
| A 静态与语法 | 语法、编码、TODO、密钥、调试残留、文件非空、导出面 | `a-static.js` + `f-repo.js` U1~U13 | 10 + 13 | A |
| B 框架与宿主 | lx 宿主契约、action 声明、EVENT 收发、生命周期 | `a-static.js` + `b-logic.js` | 10 + 30 | A |
| C 核心逻辑 | 取链、降档、竞速、短路、预算 | `b-logic.js` | 30 | A |
| D 功能与异常 | 歌词/封面/管理 action、异常归一 | `d-func.js` + `e-extra.js` | 30 + 94 | A |
| E 性能与并发 | 加载耗时、并发上限、30 并发压测 | `stress-test.js` + `f-repo.js` Z | 12 | B |
| F 安全 | 明文密钥、URL 校验、注入面 | `f-repo.js` U8 + 本轮 G6 | 1 + G6 | B |
| G 交付真实性 | 1KB 验真、片段判据、音质回填、缓存单写点 | `e-extra.js` W1/INV3/M14 | 3 | A |
| I 状态机 | 断路器 closed/open/half-open、休眠、playDead | `d-func.js` + `e-extra.js` FAULT4b | 3 | A |
| J 记账口径 | 成功率分子分母、429 不计失败、byQuality | `e-extra.js` J1~J6 | 6 | B |
| K 缓存身份 | 缓存键、分级 TTL、单写点、缓存命中验真、配置可管（K4c~K4e） | `e-extra.js` K1~K7 + M14 | 11 | A |
| L 竞速预算 | 总预算、分档预算、末档保底、错峰 | `e-extra.js` L1~L5 | 5 | B |
| M 探活自愈 | 探针、健康分、休眠复醒 | `e-extra.js` M1~M4 + `g-meta.js` M1~M14 | 18 | A |
| N 假成功 | 上游 code:0 但无链接、错歌、片段伪装完整 | `e-extra.js` N1~N2 | 2 | B |
| O 配置面 | 白名单 15 键、注入声明 39 键、NaN 拒写 | `e-extra.js` O1~O5 | 5 | A |
| P 测试有效性 | 断言 ID 形式、脚本守卫、退出码、入口登记 | `g-meta.js` M4~M12 | 9 | A |
| Q 文档镜像 | 版本串三文档一致、数字可解析、死链 | `f-repo.js` V1~V8 + `docs-audit.js` | 8 | A |
| R 安全与密钥 | 明文 token、40 位密钥、无 `/tmp` 硬编码 | `f-repo.js` U7/U8 | 2 | A |
| U~Z 仓库面 | 静态/引用/契约/联动/死码/资源 | `f-repo.js` | 52 | A |
| S 压测一代 | 档位矩阵、30 并发、探针故障注入 14 种 | `stress-test.js` S1~S10 | 12 | B |
| T 压测二代 | 跨歌冷却、冷却时长、缓冲撞车、片段率 | `stress-round3.js` T1~T14 | 14 | A |
| MUT 变异测试 | 12 个算子，每个只改一处 | `mutation/run.js` MU1~MU12 | 12 | A |
| INV 不变量 | 单写点、subSource、type 真话、幂等、换源 | `e-extra.js` INV1~INV6 + INV2b | 6 | 5A + 1C |
| EDGE 边界 | 非正数、NaN、时长缺失、大小写、外部注入 | `e-extra.js` EDGE1~EDGE5 | 5 | 4A + 1B |
| FAULT 故障注入 | 空 body、截断 JSON、10MB、5xx、熔断、DNS、证书、429 | `e-extra.js` FAULT1~8c | 11 | 8A + 2B + 1C |
| MEM 长时运行 | 表上限、淘汰后可用、快照可观测 | `e-extra.js` MEM1~MEM3 | 3 | 2A + 1B |
| **X 裁决层（admission）** | 证据分级、codeRank、admit 单一入口、弱证据 TTL ≤60s、链过滤分层、关源对称清账 | `r-admission.js` | 23 | A |
| **Y 跨平台兜底（v8.12.x）** | 主平台失败识别、严格身份匹配、目标平台 ID 隔离、`sourcePlatform`/`fallback` 透传、grace、10min 缓存、关源失效、总开关、健康事件 | `u-cross-platform.js` | 12 | A |
| **V 跨平台压测（v8.12.x）** | 并发同歌、顺序缓存、200+ 缓存上限、总开关、关源/重开、错歌拒绝、主/跨交替、全目标 5xx、慢主平台、事件隐私、主平台成功零跨平台 | `v-cross-platform-stress.js` | 13 | A |

**历史合计（v8.11.7 口径）**：281 条断言（258 + 23）+ 22 变异体 + 67 组冒烟 + 巡检自检；仅作版本对照，**不再作为当前总数**。

> ### 当前口径（2026-11-12 全量复跑，以此为准）
>
> | 类别 | 数量 | 构成 |
> |---|---|---|
> | 冒烟 | **67 组** | `lx-source-smoke-test.js` |
> | 审计 | **365 条** | a-static 10 / b-logic 30 / d-func 30 / e-extra 94 / f-repo 52 / g-meta 14 / h-toggles 14 / n-fixes 4 / p-gaps 4 / q-dfix 5 / q2-dseries 3 / r-admission 23 / s-health-events 22 / t-health-events-stress 12 / u-cross-platform 12 / **v-cross-platform-stress 13** / w-fallback-owner 2 / x-media-envelope 12 / QuickJS 3 / candidate 6 |
> | 压测 | **159 条** | stress 12 / round3 14 / round4（V 组）133 |
> | 变异体 | **22 个** | MU1~MU22，`--full --strict` 下 killed 率必须 100% |
> | **合计** | **365 条审计断言**（+ 159 压测 + 67 冒烟 = 591） | e-extra 的 94 已在 365 内，不再二次相加 |
>
> **注意历史 232 的偏差**：旧口径 232 = 10+30+30+92+50+14+6，**漏算 h-toggles 14 与 QuickJS 3**。
> 与其并列的「256 条断言」是 v10 当时的分项快照（含 INV/EDGE/FAULT/MEM 细分），与本表口径不可直接相加。
> 当前唯一可信来源是 [`TESTING.md`](./TESTING.md)。A 级 22 条，其余为 B/C。

## 2.3 本轮新增审计面（v8.12.x，2026-11-11）

前六轮审的是 v8.11.x 的取链/裁决/配置，**跨平台兜底（v8.12.0）与缓存失效（v8.12.1）没有进入维度表**。本轮补 Y 组，并把「并发/缓存/开关」压成 V 组压力矩阵，避免只验单条 happy path。

### Y 组：跨平台兜底审计面

| ID | 判据 | 对应断言 | 证据级 |
|---|---|---|---|
| Y1 | 主平台命中时不得发起任何跨平台搜索 | `u-cross-platform` U3 | A |
| Y2 | 主平台 `NOT_FOUND`/同名错歌时立即回退，不等满 grace | U2/U4/U5 | A |
| Y3 | 主平台 `NETWORK_TIMEOUT` 时等待 `crossPlatformGraceMs`（默认 6s），慢但最终成功不得被抢跑误杀 | U9 | A |
| Y4 | 目标候选必须按「歌名归一 + 歌手分词 + 时长 ±5s」严格匹配；remix/DJ/翻唱/同名异歌手全部拒绝 | U2/U4/U5 | A |
| Y5 | 只带目标平台自己的 ID（tx songmid / wy id / kw rid），绝不把主平台 rid/hash 带过去 | U8 | A |
| Y6 | 成功返回必须带 `sourcePlatform`/`fallback{from,reason,matched}`；缓存二次命中仍保留实际平台 | U1/U4/U5 | A |
| Y7 | 跨平台成功清主平台失败缓存；10min 跨平台结果缓存生效；关源/重开时缓存与成功缓存对称失效 | U8/U10 | A |
| Y8 | `crossPlatformEnabled=false` 时零跨平台搜索，原错误码不被改写 | V5 | A |
| Y9 | `cross_platform` 健康事件：成功/失败各一条，平台/子源/质量可定位，且不含歌名/URL | U7 + V11 | A |
| Y10 | 跨平台全失败时：主平台是曲库缺失→`NOT_FOUND`；网络/交付类→保留主平台原码，不被业务码吞 | U2/U6 + V9 | A |
| Y11 | 并发/缓存：同歌并发不产生错歌或异常；顺序请求只搜一次；200+ 不同歌缓存上限清空后仍可交付 | V1/V2/V3/V4 | A |
| Y12 | 标签消费：`sourcePlatform` 从源仓到 App 播放页/通知栏不丢；关闭目标源后旧平台标签不得复用 | 源仓 U10 + App `check_source_platform_label` | L1/L2 |

### V 组：跨平台压力矩阵（本轮计划）

| ID | 场景 | 通过标准 | 备注 |
|---|---|---|---|
| V1 | 20 并发同歌（kw 无原版、tx 有） | 20/20 交付、全部 `sourcePlatform=tx`、0 错歌 | 压竞态 |
| V2 | 20 并发同歌的 QQ 搜索次数 | ≤ 20（每请求至多一次，不得放大到 3 倍） | 压外呼放大 |
| V3 | 50 次顺序同歌 | 第 1 次后命中 10min 缓存，QQ 搜索总数 = 1 | 压缓存 |
| V4 | 201 首不同歌（每首 kw 无原版、tx 有） | 全部可交付；跨平台缓存超 200 后清空不崩、不串歌 | 压上限 |
| V5 | `crossPlatformEnabled=false` + 10 次缺失歌 | 10/10 失败且 QQ 搜索 = 0 | 压总开关 |
| V6 | 首次 tx 成功后关 `juheTx`，再开 | 关后不得交付 tx；开后恢复 tx（或明确报错，不得静默旧缓存） | 压对称失效 |
| V7 | 30 次只有 remix/DJ/翻唱候选 | 30/30 拒绝，0 次错歌交付 | 压严格匹配 |
| V8 | 40 次主平台命中/跨平台命中交替 | 主命中标签 kw、跨命中标签 tx，不串 | 压缓存身份 |
| V9 | 目标平台搜索 5xx + 主平台 NOT_FOUND | 保留主平台 `NOT_FOUND`，不假成功 | 压代表码 |
| V10 | 10 并发慢主平台（300ms）+ grace=1ms | 10/10 交付 kw，不被跨平台失败提前判死 | 压 grace |
| V11 | 5 次跨平台成功后读 `healthEvents` | ≥5 条 `cross_platform`，平台 tx，无歌名/URL | 压隐私 |
| V12 | 100 首主平台全部命中 | 100/100 kw，QQ 搜索 = 0 | 压零回退 |
| V13 | 同名同歌手、目标候选时长 103s（目标 302s） | 拒绝，0 次错交付；锁 ±5s 时长判据 | 压时长判据 |

> 实现文件：`test/audit/v-cross-platform-stress.js`；登记 `docs/TESTING.md`、`.github/workflows/ci.yml`、`docs/AUDIT_MATRIX.md`、`docs/READTHROUGH.md`。新增后总数以 `TESTING.md` 为准。

### V 组本轮实跑结果（2026-11-11）

| ID | 结果 | 关键观测 |
|---|---|---|
| V1 | ✓ | 20/20 交付，`sourcePlatform` 全为 tx |
| V2 | ✓ | 20 并发只触发 1 次 QQ 搜索（缓存/去重叠加） |
| V3 | ✓ | 50 次顺序同歌 50/50 tx，QQ 搜索 = 1 |
| V4 | ✓ | 201/201 仍可交付 tx，缓存超 200 清空不崩 |
| V5 | ✓ | 总开关关闭 10/10 失败，QQ 搜索 = 0 |
| V6 | ✓ | 关源后 `NOT_FOUND` 且不交付 tx；重开新歌恢复 tx |
| V7 | ✓ | remix-only 30/30 拒绝，0 错歌 |
| V8 | ✓ | 主/跨交替 40/40，平台标签不串 |
| V9 | ✓ | 全目标 5xx 保留主平台 `NOT_FOUND`，不假成功 |
| V10 | ✓ | 10 并发慢主平台 10/10 交付 kw |
| V11 | ✓ | 5 条 `cross_platform` tx 事件，无歌名/URL |
| V12 | ✓ | 100 首主命中 100/100 kw，QQ 搜索 = 0 |
| V13 | ✓ | 同名同歌手时长差 199s 被拒绝，`accepted=0`、`code=NOT_FOUND` |

> 全量回归：`a-static 10/0`、`b-logic 30/0`、`d-func 30/0`、`e-extra 94/0`、`f-repo 52/0`、`g-meta 14/0`、`h-toggles 14/0`、`n-fixes 4/0`、`p-gaps 4/0`、`q-dfix 5/0`、`q2-dseries 3/0`、`r-admission 23/0`、`s-health-events 22/0`、`t-health-events-stress 12/0`、`u-cross-platform 10/0`、`v-cross-platform-stress 13/0`、QuickJS 3/0、candidate 6/0；`stress-test 12/0`、`round3 14/0`、`round4 133/0`；`self-check` rc=0。

### V 组注入反证（2026-11-11）

在临时目录复制 `lx-source.js` + 本脚本，改坏后实跑，确认断言会红（不改生产代码）：

| 变异 | 改法 | 结果 |
|---|---|---|
| M2 关源不清跨平台缓存 | 删 `toggleSource` 内的 `clearCrossFallbackCache()` | **11/13**，V6 红：关源后仍交付 tx |
| M3 跨平台事件改名 | `event: "cross_platform"` → `"cross_platform_mutated"` | **11/13**，V11 红：count=0 |
| M5 时长门放宽 | `scoreCrossCandidate` 的 `if (diff > 5)` → `if (diff > 500)` | **12/13**，V13 红：accepted=1 |

> 结论：V6 / V11 / V13 至少各有一个可复现的注入反证；V 组从「现状 13/13 绿」升级为「改坏会红」，证据级别可标 A。M5 最初在未补 V13 时**存活**，正是补 V13 的直接原因。

## 3. 本轮缺口清单（G 组）

以下每条都是"前五轮确实没审到"的面，不是"没写进文档"。

| ID | 缺口 | 为什么算缺口（证据） | 验证方法 | 验收标准 |
|---|---|---|---|---|
| **G1** | CI 不跑审计脚本 | `.github/workflows/*.yml` 对 `test/audit/` 的引用数 = **0**；本地 14 项门禁（口径见 §6.2：含 docs-audit；历史 13 项不含它）只有 6 项在 CI | `grep -c "audit/" .github/workflows/*.yml` + 逐项对照 | 每项本地门禁都能在 CI 找到对应 step，或明确记录"故意不进 CI"及理由 |
| **G2** | 平台覆盖只有 kw | `req()` 默认 `source='kw'`，全部测试都用 kw 的歌；`wy/tx/mg/kg` 链路无断言 | 统计测试里各平台出现次数；对 wy/tx/mg 各构造一次取链 | 至少 wy、tx 各有一条真实取链断言，或记录"结构同 kw、风险可控"的代码依据 |
| **G3** | 配置面只读键无回滚通道 | `USER_CONFIG` 39 键，`ALLOWED_KEYS` 15 键；`verifyDelivery` 等开关不可 App 写 | 对比两集合；确认"可关闭/可回滚"承诺的落地方式 | 明确哪些键属于"只能改脚本"，并把这句写进文档，不再声称"可回滚" |
| **G4** | 同源并发写竞态 | 所有测试都是串行 `await`；`setCachedUrl` 单写点在并发下是否重复写未验 | `maxConcurrency=1e6` 下并发 5 个同歌请求，查缓存条目数与 upstream 外呼数 | 外呼数 ≤ 1 或明确记录"允许 N 次"的设计依据 |
| **G5** | 长时运行只有上限机制 | MEM 组只验证 `boundedMapSet` 上限生效，没跑"真实多轮后表/内存增长" | 连续 200 次不同歌请求，记录 `_memory` 7 表条目数与 RSS | 各表条目 ≤ 上限；RSS 增长有上界 |
| **G6** | 安全面只有静态 grep | R 组只查明文密钥与 `/tmp`；URL 协议校验、注入面、超长参数未验 | 构造 `javascript:`/`file://`/超长 songmid/超长配置值 | 非法 URL 被拒、超长参数被截或拒、无异常抛出 |
| **G7** | 性能无基线 | f-repo Z1 只验"加载 <50ms"，无探针耗时、无竞速预算实测 | 实测加载 100 次取中位数、探针单次耗时、单请求总耗时 | 记录实测数字，超预算有解释 |
| **G8** | App 仓未纳入本轮 | 本轮两仓只改了 `Health.tsx` 一处，App 侧无审计 | 读 App 仓既有审计报告，核对本轮改动是否被它覆盖 | 本轮改动要么在既有审计范围内，要么补一条 |
| **G9** | 文档写的行为与代码是否一致 | `docs-audit` 只校验数字与死链，不校验"文档描述的行为" | 抽查 3 条关键行为描述（验真阈值、冷却时长、熔断阈值）与代码对照 | 3 条全部一致，或列出偏差并修文档 |
| **G10** | 巡检子系统与主仓改动脱节 | T/V 组审过巡检，但 v8.11 D-20/D-21 改动后未复跑巡检自检 | 跑 `scripts/probe.js --selftest-duration`、`self-check.js`、`docs-audit` | 全部 rc=0，且片段判据与主仓同源 |
| **G11** | App 仓音源消费面未审 | App 仓 514 个 TS/TSX 本轮零审计，只有一次 G8 的文件读取 | 字段对照 + 既有缺陷回码核实 + 更新流程走查 | 字段差集为空、既有缺陷真修、无新缺陷或已编号 |

### 3.1 执行结果（2026-11-09，全部实跑）

| ID | 结果一句话 | 详见 |
|---|---|---|
| G1 | 14 项门禁 CI 只跑 5 项，9 项从未在 CI 守过提交（`grep -c "audit/"` = 0） | 报告「G1」 |
| G2 | tx/mg/kg 三平台链上只剩 `suyinKuwo` 单源；宽容上游下均 OK，真实取歌未验 | 报告「G2」 |
| G3 | 39 键可读 / 15 可写 / 24 只读；`ARCHITECTURE.md` 写 14 → 已修 | D-22 |
| G4 | 同歌 5 并发 → 上游外呼 5 次，无按歌去重（`inflightCount` 只是并发计数） | 报告「G4」 |
| G5 | 200 次全失败路径：`failCache=200`（上限 300），heap 未增长；**成功路径长跑未覆盖** | 报告「G5」 |
| G6 | `validateUrl` 显式 http(s) 白名单 + 验真兜底，两道独立；非法协议不交付 | 报告「G6」 |
| G7 | 冷加载中位 11ms（10 次 10~12ms） | 报告「G7」 |
| G8 | App 仓既有审计（11-07）不含本轮 `rateLimitActive` 改动；由 FAULT8c + tsc 守 | 报告「G8」 |
| G9 | 60%+15s / 5min / 3 次 / 180s 四处一致；键数偏差已修 | D-22 |
| G10 | probe 自检 4/4、self-check rc=0、docs-audit 0 项 | 报告「G10」 |
| G11 | App 音源消费面：字段差集为空、实测 `healthScore=-4.5`（「异常」判据非死判据）、R1/R4/R5/R6 均真修；新发现 D-23 注释过期 | 报告「G11」 |

完整记录：`docs/reports/v8.11.1-第六轮缺口审计.md`

### Z 组：v8.12.5 发布后收口审计面（2026-11-12）

| ID | 判据 | 命令/证据 | 证据级 |
|---|---|---|---|
| Z1 | 死代码清理真实生效：`getFailCached` 包装与 `safeConsole.error` 不再存在，且无调用点；`safeConsole.log/warn` 仍被 `logInfo/logWarn/logDebug` 使用 | `rg` 反查 + `a-static` / `f-repo` | L0/L1 |
| Z2 | 版本与文档同步：`lx-source.js @version=8.12.5`，README/ROADMAP/DEV_GUIDE/CHANGELOG 同步 | `scripts/self-check.js` + `scripts/docs-audit.js` | L1 |
| Z3 | 发布归档字节一致：`v8.12.1`~`v8.12.5` 与 `v8.11.7` 的 Release 资产与 tag 内容 `cmp` 一致 | GitHub API + `git show tag:lx-source.js` + `cmp` | L3 |
| Z4 | App 内置源一致：b115 `assets/builtin_source.js` 的版本/SHA-256 与源仓 `v8.12.5` 资产一致 | APK 解包 + `sha256sum` + `cmp` | L3 |
| Z5 | 全量测试矩阵：25 个入口完成；核心 19 项、压测 12/14/133 均 rc=0；变异 22 killed/0 survived（全量日志汇总） | `docs/TESTING.md` 命令逐条 | L2/L3 |
| Z6 | 历史红项不冒充：`v8.12.2` tag 的 V2 文档门禁红保留记录，tag 不移动 | CI run 证据 + Release note | L3 |

## 4. 执行顺序与记录要求

按 G1→G12 顺序执行（G12 为 2026-11-09 补充的星海备平台声明一致性），**每条必须留下可复现的命令与原始输出**，写进
`docs/reports/v8.11.1-第六轮缺口审计.md`。

规则：

1. **不许用经验下结论**。每条先跑命令，再读输出，最后写结论。
2. 结论必须区分"事实/推断/未知"。跑不出来的记为未知，不记为通过。
3. 发现的真实缺陷按 D-2x 编号，修完必须补断言并注入验证。
4. 不改判据去迁就现状——只改代码或如实降级证据级别。

## 5. 与前五轮的关系

- 前五轮的分册不删，作为原文存档；本文件是**唯一索引**。
- 第五轮的 A/B/C 分级直接沿用，不重新定义。
- 本轮（第六轮）只做 G 组，不重跑前五轮已确认的 A 级断言——除非 G 组执行中发现它们失效。

## 6. 本轮待修清单（2026-11-09）

审计完不代表修完。下面 8 条是本轮**实际发现**、按修复优先级排的清单，修一条销一条。

| # | 编号 | 位置 | 问题 | 修法 | 风险 |
|---|---|---|---|---|---|
| 1 | D-24+D-25 | App `Basic/Source.tsx` + `core/apiSource.ts` | 一键更新「导入新→删旧→切新」，切源失败时旧源已删无法回退；`await setApiSource()` 对同步函数无效 | `setApiSource` 返回 `apiInitPromise[0]`（Promise<boolean>，类型已声明）；顺序改「导入新→切新并等结果→删旧」；失败则不删旧源 | 中：需超时兜底，防 init 永不触发导致 await 卡死 |
| 2 | C-1 | 音源验真链 | 非法协议最终代表码 `LINK_EXPIRED` 而非 `PARAM_ERROR`，排障误判成链接过期 | 本地协议拒绝时强制归因 `PARAM_ERROR`，不被后续验真失败覆盖代表码 | 中：影响错误码分类与熔断计数，需确认 PARAM_ERROR 不计入源健康 |
| 3 | G4 | 音源 `inflightCount` | 同歌同档 5 并发 → 上游 5 次外呼，无去重 | 加按 `songmid+quality` 的 in-flight 复用：同键后续请求等首个结果而非另发 | 中：新增机制，需测「复用返回同一 url」与「不同歌不串」 |
| 4 | G1 | `.github/workflows/ci.yml` | 14 项门禁 CI 只跑 5 项，22 条 A 级断言从未守过任何提交 | 快组（a-static/b-logic/d-func/e-extra/f-repo/g-meta/h-toggles/stress-test/stress-round3/candidate）接入 push/PR；mutation 放 nightly | 低：只增步骤，不改业务 |
| 5 | D-22 | `docs/ARCHITECTURE.md` | 键数 14→15 | **已修** | — |
| 6 | D-23 | App `trend` 注释 | 60→144 | **已修** | — |
| 7 | 口径 | 全仓文档 | 门禁「13 项」vs「14 项」不统一 | 统一为 14 项，并注明历史 13 项不含 `docs-audit` | 低 |
| 8 | 验证 | — | `PARAM_LIMITS` 未逐键核对、G9 只抽查 4 条、G5 成功路径未长跑 | 补做，不改代码 | 低 |

**执行顺序**：1 → 2 → 3 → 4 → 9 → 7 → 8。前四条是行为修复（含 D-26），各需独立验证；后三条是文档与验证补全。

### 6.2 门禁口径（统一写 14 项）

全仓此前两套说法并存：**13 项**（不含 `docs-audit`）与 **14 项**（含它）。两个数都对，差在 `docs-audit` 由独立 workflow（`.github/workflows/docs-audit.yml`，每周一）跑，不在 `ci.yml` 里。

统一口径：**14 项**，逐项列出——

| # | 门禁 | 脚本 | 进 ci.yml（本轮后） |
|---|---|---|---|
| 1 | 冒烟 | `test/lx-source-smoke-test.js`（67 组） | ✓ |
| 2 | 静态 | `test/audit/a-static.js` | ✓ 本轮新增 |
| 3 | 逻辑 | `test/audit/b-logic.js` | ✓ 本轮新增 |
| 4 | 功能 | `test/audit/d-func.js` | ✓ 本轮新增 |
| 5 | 扩展 | `test/audit/e-extra.js`（92 条） | ✓ 本轮新增 |
| 6 | 仓库 | `test/audit/f-repo.js`（50 条） | ✓ 本轮新增 |
| 7 | 元审计 | `test/audit/g-meta.js`（14 条） | ✓ 本轮新增 |
| 8 | 开关 | `test/audit/h-toggles.js` | ✓ 本轮新增 |
| 9 | 压测 | `test/stress-test.js`（12 条） | ✓ |
| 10 | 第三轮压测 | `test/stress-round3.js`（14 条） | ✓ 本轮新增 |
| 11 | 候选恢复 | `test/candidate-audit-test.js` | ✓ |
| 12 | 自检门 | `scripts/self-check.js` | ✓ |
| 13 | 变异 | `test/mutation/run.js`（12 变异体） | ✓ 夜间调度（本轮新增） |
| 14 | 文档 | `scripts/docs-audit.js` | 独立 workflow（每周一） |

以后写"全绿"必须带口径，避免 13/14 被当成回归。

| 9 | **D-26** | `lx-source.js` `buildSourceChain` 星海备挂载 | 条件 `platform !== "kg"` 与映射表 `{wy,tx,kw}` 不一致，mg 每次白 push 一个必败源 | 改为 `PLATFORM_TO_XINGHAI_BACKUP[platform]` | 极低（默认关闭） | 第 9 位 |

### 6.1 销项记录（2026-11-09）

| # | 编号 | 状态 | 提交 / 证据 |
|---|---|---|---|
| 1 | D-24 + D-25 | ✅ 已修 | App `f9ba9108`：顺序改「导新 → 切新并等 init(8s 上限) → 删旧」，`setApiSource` 返回 `apiInitPromise[0]`；tsc 无新增错误 |
| 2 | C-1 | ✅ 已修 | 音源 `a57d593`：新增 `assertDeliverableUrl`，接入 3 处 `isAudioPlayable` 之前；`PARAM_ERROR` 补 1min TTL。复现对比：修前 `LINK_EXPIRED`，修后 `PARAM_ERROR` |
| 3 | G4 | ✅ 已修 | 音源：`inflightUrl` 按 `platform\|quality\|songmid\|name\|singer\|duration` 合并并发；新断言 G4b/G4c（先红后绿：外呼 5→1，5/5 拿到 url） |
| 4 | G1 | ✅ 已修 | 音源 `0ee8c5e`：ci.yml 新增 L3/L4/L5 三步 + nightly mutation job；7 个审计脚本全部进 CI |
| 5 | D-22 | ✅ 已修 | 前序提交 |
| 6 | D-23 | ✅ 已修 | App `9c8ea039` |
| 7 | 口径统一 | ✅ 已修 | v10 §6.2 给出 14 项逐项清单；第五轮报告注「不含 docs-audit」 |
| 8 | 验证补全 | ✅ 完成 | PARAM_LIMITS 15/15 拦住；G9 数值 15/15 一致；G5 成功路径 200/600 次长跑缓存生效、超限淘汰不增长 |
| 9 | D-26 | ✅ 已修 | `ee7ebaf`：星海备按 `PLATFORM_TO_XINGHAI_BACKUP` 过滤；G12a 红→绿 |

## 七、已知取舍（2026-11-09 用户已确认，不再作为待决项）

这四条都被评估过，**决定保持现状**，写在这里是为了让下一轮审计别再当新问题重复提。

| # | 事项 | 现状 | 为什么保持 |
|---|---|---|---|
| 1 | tx / mg / kg 三个平台只有 `suyinKuwo` 单源，链接时效逐次波动（br=1 实测 410；**端到端矩阵实测五平台 10/10 可交付**，见报告 §12.5） | 靠验真 + 降档 + 1min 失败缓存重试 | 如实失败、报 `LINK_EXPIRED`、1 分钟后可重试，**不假交付**。隐藏平台或补源都会改变 App 可见功能，收益不明 |
| 2 | `INFLIGHT_URL_MAX=200` 超限时 `inflightUrl.clear()` 会把在途合并清掉 | 保持 `clear()` | 只有 200 首**不同歌**同时请求才会触发；最坏结果是合并失效（多打几次外呼），不会出错，也不会漏交付 |
| 3 | MEM 组的 Map 上限淘汰是**产品行为变更**（不是纯修 bug） | 接受 | 上限 2000 条，淘汰策略已生效；实测 600 次请求 heap 4.3→4.7MB 趋稳 |
| 4 | `docs/AUDIT_RESULTS.md` 已 1100+ 行 | 不拆 | 缺陷总账已补齐 D-01~D-39，章节结构够用；拆分会让历史链接失效，收益小于成本 |

> 改这四条中的任何一条之前，先看本节理由，别把"已确认的取舍"当成"漏审的问题"。
