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

## 四、文档 / 流程

| ID | 状态 | 严重度 | 问题 | 证据 / 位置 | 下一步 |
|---|---|---|---|---|---|
| K19 | FIXED | — | 四份计划与审计起点曾出现 hash/行数漂移 | App `AUDIT_PLAN`/`STRESS_PLAN`、源仓 `AUDIT_PLAN_v10`/`stress-round5` 已回填 | 每次审计/提交后同步 |
| K20 | FIXED | 低 | `KNOWN_ISSUES` 曾被 `ITERATION_ROADMAP` 引用但文件不存在 | 本文档为本轮补建；K13 引用此前悬空 | 已补建；后续新增问题按 K 编号追加 |

## 关联文档

- 方案：[`QUALITY_POLICY_OPTIMIZATION_PLAN.md`](./QUALITY_POLICY_OPTIMIZATION_PLAN.md)
- 当前架构：[`ARCHITECTURE.md`](./ARCHITECTURE.md)
- 逐段职责：[`DEV_GUIDE.md`](./DEV_GUIDE.md)
- 测试入口：[`TESTING.md`](./TESTING.md)
- 审计矩阵：[`AUDIT_MATRIX.md`](./AUDIT_MATRIX.md)
- 版本历史：[`CHANGELOG.md`](./CHANGELOG.md)
