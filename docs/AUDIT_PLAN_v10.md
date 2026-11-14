# 音源仓库审计计划 v11.0（重构版 · 活文档 · 唯一入口）

> **重构说明**：本文件由 v10.0 重构而来，文件名保留 `AUDIT_PLAN_v10.md` 以兼容既有引用。历史 round1~5 分册、v9.0、以及各轮审计报告全部归档，不再叠加进本文件；「当前要审什么、缺口在哪」只以本文件为准。
>
> **基线（唯一真值，2026-11-14）**：
> - 源仓：`luanmuc/backend-api` @ `fb94fcf`（已推送），`lx-source.js` **v8.13.1**，5563 行
> - App 仓：`luanmuc/mobile-app` @ `3cecdd02`（已推送），v1.9.2-b125 / versionCode 284
> - 本文件对应变更：`fb94fcf`「音质优先播放策略收口」= 音质政策优化 P0/P1 + K07/K08 + 第 14 个 action `forceQualityProbe`

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
| 静态与语法 | 语法、编码、TODO、密钥、调试残留、导出面 | `a-static.js` + `f-repo.js` | 10 + 52 | A |
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
| 裁决层 admission | 证据分级、codeRank、admit 单入口、弱证据 TTL、关源清账 | `r-admission.js` | 23 | A |
| 跨平台兜底 | 主平台失败识别、身份匹配、ID 隔离、grace、缓存失效 | `u-cross-platform.js` | 12 | A |
| Provider Contract | 12/10/2、链位不重复、观察源无链位 | `y-provider-contract.js` | 15 | A |
| 取消语义 | 真取消、竞态、在途清理 | `z-cancel.js` | 11 | A |
| 健康事件 | 事件白名单、去重、脱敏 | `s-health-events.js` | 22 | A |
| 桥媒体信封 | `__lxMedia:2`、分片、解码 | `x-media-envelope.js` | 12 | A |
| 降级所有权 | `fallbackOwner` host/source | `w-fallback-owner.js` | 2 | A |
| QuickJS 真引擎 | 宿主无 Buffer 环境 | `q-quickjs-real.js` | 3 | A |
| 候选源审计 | 候选接入证据链 | `candidate-audit-test.js` | 6 | A |
| **音质真实标签** | `qualityFromDelivery`、`sniffAudioBytes` 总字节、`qualityConfidence`、片段语义 | `quality-truth.js` | 9 | A |
| **音质政策优化** | 能力备档不续期、`definitiveFail` 分类、短路改判据、唯一源探路、强制探路、旧快照兼容 | `quality-policy-v2.js` | 12 | A |

**当前总数**：冒烟 **67 组** + 审计 **416 条**（旧 395 + 音质真实标签 9 + 音质政策 12）+ 压测 **159 条** + 变异 **22 killed / 0 survived**。计数真值以 `docs/TESTING.md` 与 `docs/AUDIT_MATRIX.md` 为准。

---

## 2b. 定制功能逐项明细（排除车机版）

> 每个定制功能单列一行：功能 → 关键位置 → 守的脚本/断言 → 状态。音源仓无车机版；App 侧车机版不在本计划范围。

| 定制功能 | 关键位置 | 守的脚本/断言 | 状态 |
|---|---|---|---|
| 请求处理全流程（getUrlWithFallback） | `lx-source.js` | `b-logic` | ✅ |
| 音质降级链（128k/320k/flac/flac24bit） | `lx-source.js` | `stress-test` S 组 12/0 | ✅ |
| 竞速回退（fallbackRace） | `lx-source.js` | `b-logic` | ✅ |
| L4 裁决层（admit 判定+记账唯一入口/证据分级/codeRank） | `lx-source.js` | `r-admission` 23 | ✅ |
| 健康自愈（健康探测/10 分制/断路器/休眠/playDead） | `lx-source.js` + `health-*.js` | `s-health-events` 22 + 18 个 `health-*` 分项 | ✅ |
| 音质政策优化（能力备档不续期/definitiveFail 分类/短路判据/唯一源探路/forceQualityProbe） | `lx-source.js` | `quality-policy-v2` 12 | ✅ |
| 音质真实标签（qualityFromDelivery/sniffAudioBytes/qualityConfidence/片段语义） | `lx-source.js` | `quality-truth` 9 | ✅ |
| 缓存与防死链（分级 TTL/单写点/1min 失败缓存） | `lx-source.js` | `e-extra` | ✅ |
| 跨平台兜底（主平台失败识别/ID 隔离/grace） | `lx-source.js` | `u-cross-platform` 12、`v-cross-platform-stress` 13 | ✅ |
| 降级所有权（fallbackOwner host/source） | `lx-source.js` | `w-fallback-owner` 2 | ✅ |
| 媒体信封（`__lxMedia:2`/分片/解码） | `lx-source.js` | `x-media-envelope` 12 | ✅ |
| 取消语义（真取消/在途清理） | `lx-source.js` | `z-cancel` 11 | ✅ |
| Provider Contract（12/10/2/链位不重复） | `lx-source.js` | `y-provider-contract` 15 | ✅ |
| 候选源接入（fish/helloworld/hyw/jiexiang/lx/qdy） | `lx-source.js` | `candidate-audit-test` 6 | ✅ |
| 健康事件（白名单/去重/脱敏） | `lx-source.js` | `s-health-events` 22、`t-health-events-stress` 12 | ✅ |
| QuickJS 真引擎（宿主无 Buffer） | `lx-source.js` | `q-quickjs-real` 3 | ✅ |
| 配置键体系（config action 面板可写/只读/已删键） | `lx-source.js` | `e-extra` 配置面 | ✅ |
| 接口生命周期管理 | `lx-source.js` | `s-source-lifecycle` 14 | ✅ |

**状态说明**：✅ 有脚本断言且已审；车机版相关项已移出本计划。

---

## 3. 音质政策优化审计面（本轮核心变更，`fb94fcf`）

> 方案见 `docs/QUALITY_POLICY_OPTIMIZATION_PLAN.md`。这不是「音质真实标签」，而是**能力备档与档位短路的记账口径修正**——修两个真实缺陷：①重复播放低质把 6h 备档续成永久降级；②3 次网络超时把唯一 flac 源短路 1h。

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

**本轮实跑**：`quality-policy-v2` 12/0、`quality-truth` 9/0、`npm test` rc0、压测 159/0。

---

## 4. 跨仓联动审计面（本轮新发现，单仓审计会漏）

| 编号 | 联动点 | 现状 | 性质 |
|---|---|---|---|
| QP-L1 | **第 14 个 action `forceQualityProbe` 未进 App 契约** | 音源已实现可调用；App `SOURCE_ACTIONS` 仍 13、`check_source_contract` 硬断言 `length===13`、`SYNC_POINTS.md` 写「13 action」 | 契约漂移（P2 暂缓但必须登记） |
| QP-L2 | **能力备档压制起跑档无 App 可见解释** | 音源 `getQualityCeiling` 把「这首歌只有 128k」记 6h/10min，请求 flac 被直接 128k 起跑；App `onQuality` 回填 128k 但 UI 无「因源能力备档跳过」提示 | 体验缺口 |
| QP-L3 | **`definitiveFail`/`linkExpired` App 不消费** | 音源 byQuality 快照新增两字段；App `Health.tsx` 类型仍 `req/success/fail/businessFail/rate/avgTime/state` | 源有数据、App 不展示（无害） |
| QP-L4 | **`qualityConfidence` 三值跨仓一致** | 音源返回 `exact/estimated/unknown`；App 消费时 `default='exact'` 仅作旧源兼容 | 已对齐，回归面继续守 |

**联动审计铁律**：字段名对得上 ≠ 语义对得上；字段、枚举、默认值、单位四样都要对。音源新增字段/action/字段枚举时，必须反查 App 的 `sourceContract.ts`、`Health.tsx`、`SYNC_POINTS.md`、`check_source_contract.js` 是否同步。

---

## 5. 执行清单（本轮必跑，不接受「上次绿过」）

```bash
node test/lx-source-smoke-test.js          # 冒烟 67 组
node test/audit/a-static.js                # 10
node test/audit/b-logic.js                 # 30
node test/audit/d-func.js                  # 30
node test/audit/e-extra.js                 # 90
node test/audit/f-repo.js                  # 52
node test/audit/g-meta.js                  # 14
node test/audit/h-toggles.js               # 8
node test/audit/n-fixes.js                 # 4
node test/audit/p-gaps.js                  # 4
node test/audit/q-dfix.js                  # 5
node test/audit/q2-dseries.js              # 3
node test/audit/r-admission.js             # 23
node test/audit/s-health-events.js         # 22
node test/audit/t-health-events-stress.js  # 12
node test/audit/u-cross-platform.js        # 12
node test/audit/v-cross-platform-stress.js # 13
node test/audit/w-fallback-owner.js        # 2
node test/audit/x-media-envelope.js        # 12
node test/audit/y-provider-contract.js     # 15
node test/audit/s-source-lifecycle.js      # 14
node test/audit/z-cancel.js                # 11
node test/audit/quality-truth.js           # 9  （音质真实标签）
node test/audit/quality-policy-v2.js       # 12 （音质政策优化）
node test/candidate-audit-test.js          # 6
node test/stress-test.js                   # 12
node test/stress-round3.js                 # 14
node --expose-gc test/stress-round4.js     # 133
node test/mutation/run.js --full --strict  # 22 killed / 0 survived
node scripts/self-check.js                 # 版本串同步
node scripts/docs-audit.js                 # 文档镜像
```

通过标准：全部 rc0；变异 killed 率 100%。

---

## 6. 缺口清单（当前未覆盖，不是「没写进文档」）

| ID | 缺口 | 验证方法 | 验收 |
|---|---|---|---|
| G2 | 平台覆盖只有 kw 全链；wy/tx/mg/kg 无真实取歌断言 | 各构造一次取链 | 至少 wy、tx 各一条真实取链，或记录「结构同 kw」依据 |
| G5 | 长时运行成功路径未覆盖 | 200 次不同歌，记 RSS | 各表 ≤ 上限，RSS 有上界 |
| G6 | 安全面只有静态 grep | 构造 `javascript:`/`file://`/超长参数 | 非法 URL 拒、超长截或拒 |
| G7 | 性能无基线 | 实测加载/探针/单请求耗时 | 记录数字，超预算有解释 |
| QP-L1~L3 | 音质政策 App 消费面（见 §4） | App 侧跟进 | 见 §4 处置 |

---

## 7. 已知取舍（已确认，不再当新问题重复提）

| 事项 | 现状 | 为什么保持 |
|---|---|---|
| tx/mg/kg 只有单源，链接时效波动 | 靠验真 + 降档 + 1min 失败缓存 | 如实失败不假交付 |
| `INFLIGHT_URL_MAX=200` 超限 clear | 最坏是合并失效多打外呼 | 不出错不丢交付 |
| MEM Map 上限淘汰是产品行为变更 | 上限 2000，淘汰生效 | 已确认接受 |
| `AUDIT_RESULTS.md` 1100+ 行不拆 | 缺陷总账已补齐 D-01~D-39 | 拆分破坏历史链接 |

---

## 8. 断点与记录要求

1. 每条结论分「事实 / 推断 / 未知」，跑不出来的记未知不记通过。
2. 真实缺陷按 `D-<序号>` 编号，修完补断言并注入验证。
3. 不改判据迁就现状；只改代码或如实降级证据级。
4. 每轮结论写入 `docs/AUDIT_REPORT-YYYY-MM-DD.md`；本文件只更新基线、维度状态、缺口状态。
