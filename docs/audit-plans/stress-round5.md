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

---

## 6. 压测负载设计（承接原 v9.0 §4 P1~P6）

> 原 `docs/AUDIT_PLAN.md` v9.0 的 §4 有更细的负载参数（并发数、时长、循环次数），此前未进本文件；归档前承接于此，作为压测脚本的**设计意图台账**（运行时以脚本内实际参数为准）。

| # | 套件 | 设计负载（原 v9 口径） | 通过标准 |
|---|---|---|---|
| P1 | `stress-test.js` | 1000 并发、200 并发、12s 总预算、限速窗口、熔断雪崩、505 首缓存、3000 次长跑、排序、TTL、200 次 × 2s Timer | 12/0；成功率 ≥95%；外呼收敛；Timer 不随请求线性增长 |
| P2 | `stress-round3.js` | 突发并发、缓存穿透、冷却、降档、限流、探针、跨平台 | 14/0；冷却仍写、128k 可走、外呼不放大 |
| P3 | `stress-round4.js` | 故障谱系、预热 TTL、探针双歌、档位 breaker、短路、排序、快照 | 133/0；TTL 内新增预热 0；半开只放一枪 |
| P4 | 变异 `mutation/run.js --full --strict` | 22 个锚点 | 22 killed / 0 survived；`--strict` 下 skipped 即失败 |
| P5 | 冒烟 `lx-source-smoke-test.js` | 67 组插件加载/导出/配置/取链 | 67/0 |
| P6 | 审计 `npm test` | 19 脚本（含 e-extra 90/0） | 19 脚本 rc0 |

**执行顺序**：P5 → P6 → P1 → P2 → P3 → P4；任一红先修实现或明确夹具漂移，再全量复跑。

---

## 7. 压测方法论承接（原 stress-round4 §1/§3）

> `stress-round4.md` 的「五条不变量」与「四条压测自身翻过车」是方法论资产，随其归档后在此保留要点，避免以后重新踩坑。原文见 `docs/archive/audit-plans/stress-round4.md`。

### 7.1 五条不变量（任何压测组都要过）

| ID | 不变量 | 违反后果 |
|---|---|---|
| I1 | 交付 URL 必为 http(s) 且非空 | 用户拿到死链 |
| I2 | 失败必为 12 个 `ERROR_CODES` 之一 | 上层无法分类重试 |
| I3 | 绝不 `ok:true` 但 `url` 空 | 静默失败，最难查 |
| I4 | 健康分 ∈ [0,100] | 调度被误伤或永久跳过 |
| I5 | 同歌同档并发合并成 1 次外呼 | 打爆第三方 / 触发限流 |

### 7.2 四条「压测自身翻过车」的经验（写新压测前必读）

| 组 | 翻车点 | 正确做法 |
|---|---|---|
| V17 音质短路 | 用 `500` 造故障不进短路统计（500 归 `recordBusinessFail`） | 用 `{error:'ECONNRESET'}` 进 `fail+linkExpired` 统计 |
| V19 超时阈值 | 绝对阈值 `tSlow>500` 在写死 timeout 的变异下仍绿 | 改相对比较 `tSlow>tFast*3 && tSlow>600` |
| V20 脏缓存标签 | 命中路径只判 `ok` 不回填音质，请求 flac 会留 128k 脏槽 | 命中返回用验真结果回填 `type`，**不改写槽位**（写点唯一） |
| V21 兜底档 | 末级 `strict:false` 跳过歌手校验，会交付错歌（D-31） | 兜底档放行必须落日志，并断言 stdout 有该条 |
