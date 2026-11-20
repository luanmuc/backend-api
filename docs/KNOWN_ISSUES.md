# 已知问题与技术债（KNOWN_ISSUES）

> 目的：把所有已确认的问题、已修项、外部阻塞和设计取舍集中到一处。  
> 以后要判断“该不该重构”，先看本表的状态、证据和影响面，不要只依赖聊天记录。  
> 本表只记录**已经在本仓库或 App 仓验证过**的事实；推测项必须标注“待验证”。

## 状态说明

| 状态 | 含义 |
|---|---|
| OPEN | 已确认，尚未修复 |
| PARTIAL | 源侧已修复，宿主/入口侧仍待接入 |
| FIXED | 已修复并有测试/提交证据 |
| BLOCKED | 受外部条件阻塞，当前无法闭环 |
| WONTFIX | 明确不做，保留原因 |
| DEFERRED | 已决定暂缓，不是缺陷 |

## 一、音质策略（当前主线）

| ID | 状态 | 严重度 | 问题 | 证据 / 位置 | 下一步 |
|---|---|---|---|---|---|
| K01 | FIXED | 高 | 能力备档 TTL 会被重复低质交付刷新，可能事实永久降级 | `noteQualityCeiling()` 每次写 `ts: Date.now()`；2026-11-14 复现：两次 128k 记录相隔 20ms，`ts` 从 1794653669033 → 1794653669053 | P0：同档不续期，增加 `recordedAt/nextProbeAt` |
| K02 | FIXED | 高 | 能力备档不区分临时失败与确定性失败 | v8.15 新增 `classifyQualityFailureCode`：business→6h、delivery/transient→10min、rate_limit→不记、unknown→30min；QP2 覆盖 |
| K03 | OPEN | 中 | 能力备档粒度是“平台 + 歌曲”，一个源低质会压制同平台其他已恢复源 | `qualityCeilingMap` key = `${platform}|${mid}` | P1：评估按源记录，或保留平台级但加“探路优先” |
| K04 | FIXED | 中 | 高质档被短路/熔断跳过时，仍可能被记成“该歌没有高质” | `getUrlWithFallback()` 新增 `attemptedQualities`，只有 `attemptedQualities.has(reqQ)` 且未从 ceiling 起跑才记上限；QP1/QP3 覆盖 | P0：只有实际 attempted 的档才记录 |
| K05 | FIXED | 高 | 档位短路把临时网络失败计入 `fail`，3 次超时就能压 1 小时 | `isQualityHopeless()` 改用 `definitiveFail + linkExpired`；QP4 断言 3 次超时不短路 | P1：只统计确定性失败，网络类交 breaker |
| K06 | FIXED | 高 | 档位短路口径反向：404/NOT_AUDIO 等确定性失败走 `businessFail`，不进 `fail`；反而超时/5xx 进 `fail` | `recordBusinessFail` 对 delivery 类（NOT_AUDIO/STREAM_PLAYLIST/BAD_ENVELOPE/TRUNCATED_MEDIA）写 `definitiveFail`；`recordFailure` 的超时不写；QP5/QP6 覆盖 | P1：新增 `definitiveFail`，短路只看它 + `linkExpired` |
| K07 | PARTIAL | 中 | 档位短路没有用户强制重试旁路 | 源侧已加 `forceQualityProbe(sourceId, quality)` 与 request action：把 `qualitySkipProbeAt` 标记为已到期，只放行一轮链构建；不改 breaker/健康账本。QP11 覆盖“放行一次后恢复短路”。App 可见入口仍未接（P2） |
| K08 | FIXED | 中 | 唯一 flac 源连续临时失败时，1 小时窗口内没有高质可试 | 新增 `qualityShortCircuitUniqueProbeMs`（默认 600000=10min）与 `countActiveQualitySources(platform, quality)`；平台内该档 active 源 ≤1 时走 10min，否则仍走 1h；QP9/QP10 覆盖 kg 唯一 10min、tx 非唯一 1h |
| K09 | WONTFIX | 低 | 源仓 `REPORT_QUALITIES` 五平台均无 `flac24bit`，设置 flac24bit 会落到 flac | `REPORT_QUALITIES = ["128k","320k","flac"]`；`PLATFORM_QUALITIES` 有 flac24bit 但上报裁剪 | 保持现状；App 设置 flac24bit 时按 flac 请求 |
| K10 | WONTFIX | 低 | `fallbackOwner:"source"` 时 App 不跨源，源仓内部才有跨平台兜底 | `sourceConfig[platform].fallbackOwner = "source"`；App `shouldHostFallback` 为 false | 保持现状；跨源由源仓 `tx→wy→kw` 兜底 |
| K11 | FIXED | — | App 自定义源曾按内置 `_qualitys` 把 flac 错降 128k | App `src/core/music/utils.ts` 只按 `global.lx.qualityList[source]`；提交 `484b168e` | 已回归；后续改动不得重新引入 `_qualitys` |
| K12 | FIXED | — | 片段缓存命中后 `fragment` 被固定写成 false | App `src/utils/data.ts` / `online.ts` / `utils.ts` 的 P1-CACHE；`check_quality_request_runtime` 12/0 | 已回归；缓存按实际档 + 片段真值写 |

## 二、交付真实性 / 验真

| ID | 状态 | 严重度 | 问题 | 证据 / 位置 | 下一步 |
|---|---|---|---|---|---|
| K13 | WONTFIX | 低 | 网易公开 lyric 接口不返回 yrc 逐字字段，逐字歌词透出判否 | 2026-11-04 实测；`ITERATION_ROADMAP` v4.0 | 保持判否；外部接口恢复再评 |
| K14 | FIXED | — | 上游忽略 Range 返回 200 全量 body 时，`totalBytes=bodyLength` 被 `sniffAudioBytes` 丢弃 | `sniffAudioBytes(..., fullBody)`；`probeAudioDelivery` / `verifyDelivery` 对 `status=200 && !content-range` 采用 `content-length`；QT-9 9/0；源仓 `db52963` | 已回归；改动验真逻辑时保留 QT-9 |
| K15 | OPEN | 中 | 真机 10 首矩阵、标签一致率、真机 A/B 延迟未完成 | 云主机无设备，无法真机验证 | BLOCKED 外部；有设备后补矩阵与 A/B |

## 三、外部源 / 门禁

| ID | 状态 | 严重度 | 问题 | 证据 / 位置 | 下一步 |
|---|---|---|---|---|---|
| K16 | BLOCKED | 中 | `check_source_ci_gate` 受 GitHub API 403 额度限制 | 2026-11-14 跑 `check_source_ci_gate` 403 | 需要有效凭据/额度；不把 403 当代码失败 |
| K17 | OPEN | 中 | `source-audit` 14/16 可用，2 个外部源未通过 | 源仓 `source-audit` rc0，但外部源可用性 14/16 | 外部源恢复后复测；不要为了绿而删除源 |
| K18 | DEFERRED | 低 | Phase 5 host-owned 宽限窗未做；v1 App 四段竞速、v2 App 跨候选宽限窗已明确拒绝 | 用户决策；避免 App 与源仓双重重试 | 保持现状，不再引入 App 侧宽限窗 |
| K25 | FIXED | 高 | **门禁假绿三件套**：`docs-audit.js` 恒 `exit 0`（B03-005）；`verify-real-*` 无条件 `exit 0`（B03-006）；`sign-release` 缺密钥 fail-open（B03-002） | 三条都由读源码 + 变异验证确认：删台账一行 → 旧版仍 exit 0 | 已改：`runAll()` 返回 🔴 数并 `process.exit(hard ? 1 : 0)`；`--require-all-ok` 开关；`--require-key` + CI `ALLOW_UNSIGNED` 双层 |
| K26 | FIXED | 中 | **慢测试无本地入口且不随 push**：`stress-test` 不在 `npm test`（B05-002）；`mutation` job 只在 schedule/dispatch（B05-003） | `package.json` scripts 无 stress/mutation；`ci.yml:187` 的 `if` 只认 schedule/dispatch | 已改：补 `test:stress` / `test:mutation` 别名；mutation 在 push（src 变更）跑 `--fast` 子集，全量留给 schedule |
| K27 | FIXED | 中 | **live 驱动 4 个退役源 id**：`xinghaiBackup` / `nianxinVip` / `gdWy` / `lingchuan` 已不在注册表，`toggleSource` 对未知 id 抛 `PARAM_ERROR` | `tools/live/run.js` 的 `only()` 会遍历当前注册表，传退役 id 等于把全部源关掉 | 已改：`only()` 加注册表校验（不在册则 `⏭` 跳过）；L2-4 改动态取 id；L6 组引入 `L6_SRC` 常量 + 同档三首验证熔断 |
| K28 | FIXED | 中 | **provider contract tx 行口径漂移**：`12-provider-contract.js:74` 只写 `suyinKuwo + juheTx` 双源且 `reviewAt` 是 2026-11-19，而 `SOURCE_REGISTRY.md:51` 已是三源 + 2026-11-18 | 两处描述不一致，缺 `qingliangTx` 第三方单点 | 已改：三源并含 `qingliangTx`，`reviewAt` 回填 2026-11-18，加注释说明两处必须同步 |
| K29 | FIXED | 中 | **audit 断言假绿两条**：`a-static` B6 用 `p.catch(() => {})` 吞掉异步 reject（B06-002）；`b-logic` C10 只断言 10/10 成功、外呼无上限（B06-003） | 变异验证：B6 原本对畸形输入恒绿；C10 原判据 10 并发各打一遍也绿 | 已改：B6 收集拒绝码并要求落在产物 `ERROR_CODES` 枚举（实测 `PARAM_ERROR` 属正常结构化错误）；C10 加 `c10Calls <= 4`（实测 3 次） |
| K21 | FIXED | 高 | **escalated 升级标签永不触发**：`ci.yml:264` 读 `s.rows`，但 `health-daily.js:438-441` 顶层只产出 `handle`/`watch`/`fragment` 三个数组，`rows` 仅嵌在 `chainSample.rows` 内 → `(s.rows\|\|[])` 恒空、`some()` 恒 false，连续 ≥7 天失败打标签的分支永远走不到 | 2026-11-19 修复（`ci.yml:265` 改读 `s.handle`，去掉多余的 `r.bucket` 判断）；历史 JSON 逐日验证：11-15/11-16 `max consecutiveFail=7` → 老判据不触发、新判据精确触发；11-12/13/14（4/5/6）与已恢复的 11-18（3）均正确不触发 | 已修，无需后续 |
| K22 | FIXED | 高 | **`stress-test.js` S4b 判据恒真**：`rec('S4b', ..., after \|\| total() > 0, ...)`，而 `total()` 是自 `fresh()` 起的累计外呼计数，S4 前段已发 10 次请求 → 右操作数恒真；限流窗口永不恢复时断言照样 PASS（假绿） | 2026-11-19 修复（判据改为只看 `after`，`total()` 仅作 detail 输出）；两场景对比验证：窗口永不恢复 → 旧判据 PASS（假绿）/ 新判据 FAIL（正确）；窗口恢复 → 两者都 PASS | 已修，无需后续 |
| K23 | FIXED | 高 | **24 个 audit 脚本零执行点**：`test/audit/` 下 43 个脚本，`ci.yml` 只引用 19 个；其余 24 个（含 14 个 `health-*` 与 `readthrough-fixes` / `y-provider-contract`）从未在流水线里执行过，等于健康状态机/探测保真/资格/生命周期等核心契约无 CI 守门 | 2026-11-19 修复：新增 L4.1（7 个健康族①）、L4.2（7 个健康族②）、L4.3（10 个质量/契约/生命周期/预算/口径）三个 step，43/43 全部接入；实测 24 个在干净环境（`node_modules` 为空）全 exit 0、断言合计 **222** 条；改完复跑元审计无自伤：`f-repo` 56/0、`tg-truth` 全一致、`g-meta` 16/0 | 已修，无需后续 |
| K24 | FIXED | 中 | **`READTHROUGH.md` 的 `src/core/` 33 个模块结论全是 `====` 占位符**：台账声称「逐行通读」，结论列却未填，等于 33 个模块「读过但没有结论」，无法用于回归判断；同时台账文件数/总行数（185/57,723）与 `lx-source.js` 行数（7,071）均已过期 | 2026-11-19 修复：33 条全部补为「职责 + 导出面 + 已知缺陷编号（B0x-00x）」实测结论，并修正 5 处过期行数（13-chain-helpers 198→216、17-health-check 835→844、25-handlers 537→547、33-cross-cache 40→47、lx-source 7,071→7,097）；文件数口径改为 docs-audit 机器口径（**185 登记单位** = 211 tracked 文件 − health-daily 27 + 整目录 1），总行数 57,766；`docs-audit` 待处理 0 项、`tg-truth` 全一致、`f-repo` 56/0 | 已修，无需后续 |

## 四、文档 / 流程

| ID | 状态 | 严重度 | 问题 | 证据 / 位置 | 下一步 |
|---|---|---|---|---|---|
| K19 | FIXED | — | 四份计划与审计起点曾出现 hash/行数漂移 | App `AUDIT_PLAN`/`STRESS_PLAN`、源仓 `AUDIT_PLAN_v10`/`stress-round5` 已回填 | 每次审计/提交后同步 |
| K20 | FIXED | 低 | `KNOWN_ISSUES` 曾被 `ITERATION_ROADMAP` 引用但文件不存在 | 本文档为本轮补建；K13 引用此前悬空 | 已补建；后续新增问题按 K 编号追加 |

## 关联文档

- 方案：[`QUALITY_POLICY_OPTIMIZATION_PLAN.md`](./archive/QUALITY_POLICY_OPTIMIZATION_PLAN.md)
- 当前架构：[`ARCHITECTURE.md`](./ARCHITECTURE.md)
- 逐段职责：[`DEV_GUIDE.md`](./DEV_GUIDE.md)
- 测试入口：[`TESTING.md`](./TESTING.md)
- 审计矩阵：[`AUDIT_MATRIX.md`](./AUDIT_MATRIX.md)
- 版本历史：[`CHANGELOG.md`](./CHANGELOG.md)
