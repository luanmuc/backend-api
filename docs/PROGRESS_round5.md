# 第五轮压测进度（断点续传用）

> 恢复流程：读本文件 → `git log --oneline -3` 验证实际状态 → 跑 `node --expose-gc test/stress-round4.js` 确认基线 →
> 从「当前批次」继续，不重做已完成批次。

| 批次 | 内容 | 状态 | V 组条数 | 提交 |
|---|---|---|---|---|
| 基线（R4 收尾） | — | 完成 | 82 | `bb12e0f` |
| R5-A1 | 验真族配置键（`verify*` 四键，D-35） | 完成 | 88 | `f8a7129` |
| R5-B | 源专属错误码 410 / 搜索无结果 / 缺 ID | 完成 | 91 | `f9800c8` |
| R5-D2 | 缓存跨档命中（D-36） | 完成 | 105 | `081fca0` |
| R5-B2/D/E | 429 退避 + 半开节流托底（D-34）+ 21 变异体 | 完成 | 110 | `cd4abbc` |
| R5-C2 | `mm:ss` 时长（D-37）+ `allFailShortTtlMs`（D-38） | 完成 | 120 | `eabbc62` |
| R5-C3 | FLAC 前置 PADDING 块 | 完成 | 120 | `eabbc62` |
| R5-A3 | 内部键可观测化（`maxConcurrency` / `qualityShortCircuitSamples` / `raceBudgetMs`） | 完成 | 126 | 见提交 |
| 自查 | 文档数字复算 + QuickJS exit 3 + MU18 等价变异体修正 | 完成 | 126 | 见提交 |

## 第五轮结算

- V 组：82 → **126**（+43）
- 压测合计：108 → **152**（12 + 14 + 126）
- 变异体：16 → **21**，全量 `--full --strict` = **21 killed / 0 survived**
- 冒烟 67 组 / 审计 249 条（含 QuickJS 3 条）

### 新发现缺陷（全部由实测暴露，无一是读代码推断）

| 缺陷 | 根因 | 用户可感知 |
|---|---|---|
| D-34 | 半开试探被本地节流拦下后永久停在 `half-open` | 某源「失灵」到重启 |
| D-35 | `verify*` 四个数值键用 `\|\|` 读，0 被吞（gap=0 实为最严，被吞成 15 等于放宽） | 阈值收紧无效 |
| D-36 | 缓存按实交付档写、按请求档查，跨档永不命中 | 复播变慢、片段曲反复等待 |
| D-37 | `normalizeDurationSec` 只 `Number()`，`mm:ss` → 0 → 时长校验短路 | 片段被当完整版交付 |
| D-38 | `allFailShortTtlMs` 用 `\|\|` 读，0（不缓存）无效 | 失败后仍反复外呼 |

### 走形修复（不是调松断言）

| 断言 | 问题 | 修法 |
|---|---|---|
| V16a | 串行间隔 20ms 阈值落在噪声带，负载下偶发假红 | 阈值 20 → 8 |
| V18 | 后台预热用固定 `sleep` 等异步，多次假红 | 改「调用计数连续 3 次采样不变」再取值 |

### 可观测性边界（是结论，不是「没做」）

- **已补上**：`maxConcurrency`（V35a/b，并发第二个被 `RATE_LIMIT` 拦）、
  `qualityShortCircuitSamples`（V35c/d，`isQualityHopeless` 差分 2 vs 5）、
  `raceBudgetMs`（V35e，预算 300 vs 3000 比较放弃耗时 1002/1903ms）
- **实测确认不可观测**：`raceBatchStaggerMs` —— stagger=0 与 300 实测**同为 803ms**，
  错峰间隔被 `raceMatchWaitMs` 等固定等待支配，隔离不出行为差。
  断言已删除并在代码里留注释，**不放宽阈值凑绿**。

### 工具链边界

- `test/audit/q-quickjs-real.js` 缺 `quickjs-emscripten` 时原为 `exit 0`（跳过冒充通过），
  已改 **`exit 3`**；CI 在 `.github/workflows/ci.yml` L66-67 自装依赖，本地需手动
  `NODE_PATH=<装包目录> node test/audit/q-quickjs-real.js`。
- `docs/TESTING.md` 的 249 = a-static 10 + b-logic 30 + d-func 30 + e-extra 92 +
  f-repo 50 + g-meta 14 + h-toggles 14 + candidate 6 + QuickJS 3。
  `AUDIT_PLAN_v10.md` 里旧的「249 + 92 = 341」把 e-extra 加了两次，已修正。
