# 音源仓库压力测试计划 v2.0（重构版）

> **重构说明**：原文件是第五轮压测的「覆盖率盲区清零」分册，标题与内容已不符。本文件重构为音源仓压测的**唯一入口**，覆盖三代压测脚本 + 本轮音质政策变更的压测关注点。
>
> **基线（唯一真值，2026-11-14）**：源仓 `fb94fcf`（v8.13.1，已推送）；App `3cecdd02`（b125）。
>
> **目标**：用可重复的纯 Node 压测，证明大并发、档位矩阵、跨平台、缓存上限、故障注入、边界输入下「不崩、不越界、不串歌、不假交付」。

## 1. 压测分组与边界

| 组 | 脚本 | 条数 | 覆盖边界 | 通过标准 |
|---|---|---:|---|---|
| 一代 S | `stress-test.js` | 12 | 档位矩阵（128k/320k/flac/flac24bit）、30 并发、探针故障注入 14 种 | 12/0，不崩、档位不串 |
| 二代 T | `stress-round3.js` | 14 | 跨歌冷却、冷却时长、缓冲撞车、片段率 | 14/0 |
| 三代 V | `stress-round4.js` | 133 | 跨平台 13 组 + 故障谱系 + 不变量 + 阈值边界 + 配置面 + 兜底档实证 | 133/0 |
| **合计** | — | **159** | — | **159/0** |

> 音质真实标签（`quality-truth` 9 条）与音质政策优化（`quality-policy-v2` 12 条）属**审计**，不重复计入压测；其边界见 `AUDIT_PLAN_v10.md` §3。

## 2. 执行顺序

```bash
node test/stress-test.js                # S  12
node test/stress-round3.js              # T  14
node --expose-gc test/stress-round4.js  # V 133
node test/mutation/run.js --full --strict  # 变异 22 killed/0 survived（不可与压测同跑）
```

> 压测与变异不可同跑；计时类断言在高 CPU 抢占下会假红。

## 2b. 定制功能压测映射（排除车机版）

| 定制功能 | 压测脚本 | 条数 | 压测边界 |
|---|---|---:|---|
| 音质降级链/档位矩阵 | `stress-test` S 组 | 12 | 四档不串/30 并发/探针故障注入 14 种 |
| 跨歌冷却/缓冲撞车/片段率 | `stress-round3` T 组 | 14 | 冷却时长/缓冲撞车 |
| 跨平台/故障谱系/不变量/阈值/兜底档 | `stress-round4` V 组 | 133 | 13 组/故障谱系/阈值边界 |
| 音质政策（能力备档/短路/唯一源探路/旧快照兼容） | `quality-policy-v2`（审计归属，不计入压测） | 12 | QP1~QP12 |
| 音质真实标签（Range 探针/片段兜底） | `quality-truth`（审计归属，不计入压测） | 9 | QT1~QT9 |
| 变异测试 | `mutation/run.js` | 22 | killed 22 / survived 0 |

> 车机版相关项已移出本计划。

---

## 3. 音质政策变更的压测关注点（`fb94fcf` 新增）

| 关注点 | 判据 | 守的脚本 |
|---|---|---|
| 档位矩阵仍全链 | 128k/320k/flac/flac24bit 四档全链选择不被 `qualityConfidenceOf` 改变 | `stress-test` S 组 |
| 片段兜底语义 | 全档片段兜底仍返回 `fragment:true` + `confidence:unknown`，不把片段计完整交付 | `quality-truth` + `stress-round3` |
| Range 探针回归 | 上游忽略 Range 返回 200 全量时采用 `content-length` 作为整文件字节 | `quality-truth` QT-9 |
| 能力备档不续期 | 同档重复低质不刷新 `nextProbeAt`；transient 10min 后可试高质 | `quality-policy-v2` QP1~QP3 |
| 短路只算确定性失败 | 3 次超时不短路（走 breaker）、3 次 410 才短路 | `quality-policy-v2` QP4~QP5 |
| 唯一源探路窗口 | 平台内唯一高质源短路后 10min 放行一次 | `quality-policy-v2` QP9~QP10 |
| 旧快照兼容 | 缺 `definitiveFail` 的旧快照恢复回退旧 `fail` | `quality-policy-v2` QP8 |

## 4. 本轮实测结果（2026-11-14）

| 项 | 结果 |
|---|---|
| `stress-test` | 12/0 |
| `stress-round3` | 14/0 |
| `stress-round4` | 133/0 |
| **压测合计** | **159/0** |
| 变异 | 22 killed / 0 survived |

## 5. 失败处置与外部阻塞

1. 任一脚本非 0 即记录失败，不以「局部通过」代替。
2. 计时类断言假红 → 单独串行重跑，不并发。
3. 真机/真上游长稳仍 blocked，本计划只对纯 Node/内存 FS 结论负责。
