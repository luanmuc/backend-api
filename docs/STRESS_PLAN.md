# 音源仓库压力测试计划 v2.0（重构版）

> **重构说明**：原文件是第五轮压测的「覆盖率盲区清零」分册，标题与内容已不符。本文件重构为音源仓压测的**唯一入口**，覆盖三代压测脚本 + 本轮音质政策变更的压测关注点。
>
> **基线（唯一真值，2026-11-20）**：源仓 `master` **v9.1.4**（`297c88e` 巡检链重构，**脚本级、不改 `src/**` 与产物**，产物仍 `@version 9.1.3`）；`npm test` **46 个脚本** / 压测 **162 条** / 变异 **22 killed**；App **v1.9.2-b187**（`dadef6a1`，已推送）。
>
> **目标**：用可重复的纯 Node 压测，证明大并发、档位矩阵、跨平台、缓存上限、故障注入、边界输入下「不崩、不越界、不串歌、不假交付」。

## 1. 压测分组与边界

| 组 | 脚本 | 条数 | 覆盖边界 | 通过标准 |
|---|---|---:|---|---|
| 一代 S | `stress-test.js` | 12 | 档位矩阵（128k/320k/flac/flac24bit）、30 并发、探针故障注入 14 种 | 12/0，不崩、档位不串 |
| 二代 T | `stress-round3.js` | 14 | 跨歌冷却、冷却时长、缓冲撞车、片段率 | 14/0 |
| 三代 V | `stress-round4.js` | 133 | 跨平台 13 组 + 故障谱系 + 不变量 + 阈值边界 + 配置面 + 兜底档实证 | 133/0 |
| 四代 D（v8.17 巡检边界） | `probe.js` / `chain-sample.js` / `pull-device-digests.js` | 3 | `--reps` 1–10、当日样本 <2×端点 exit 3、chain/device 30/60 天滚动、匿名 403 降级 0 行 | 手测 rc0（51 样本 / 8·11 出链 / 1 条真机） |
| **合计** | — | **162** | — | **162/0** |

> 三组压测之外，CI 另有 `stress-long` job（长跑档，约 11 分钟）；本地按需执行，不并入 `npm test`（计时类断言与审计同跑会假红）。

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
| **健康快照版本兼容（v8.16.1）** | 旧版本快照按**数值比较**接受（`8.16` < `8.16.1` 仍拒），白名单 `[8.14.1, 8.15.1, 8.16.0, 8.16.1]`；不得因放宽而收下任意结构 | `health-persistence-v2` 10/0、`aa-p3-persist` 10/0 |
| **产物一致（v8.16.4）** | `lx-source.js` 6083 行 / 320161 bytes / `@version 8.16.4`；`chain-golden.json` 含 `version`/`sourceHead`（8.16.3） | `verify:bundle` 8/0、`y-provider-contract` Y9 |
| **拆包后行为等价（v9.0）** | 6272 行拆成 1290+33 模块后，链选择/档位/记账/取消行为必须逐项与 `test/fixtures/equiv-baseline.json` 一致（`equiv` 基线已随 9.0.0 重建）；`legacy` 行数不得回长、模块依赖只能走 `dep()` | `layer-check` L1~L6 + `verify:bundle` 8/0 |
| **发布签名与验签（v9.0）** | 真私钥签 v9.0.0 → App 内置 k1 公钥验 `{ok:true}`；**篡改产物中间字节必须验签失败**（尾部字节替换不算篡改，末尾本来就是换行）；无 `LX_SIGNING_KEY` 时跳过签名而不产半成品 | `sign-release` + App `check_source_signing` 6/0、`check_source_update_fetch` 9/0、`check_source_update_apply` 12/0 |
| **版本区间判定（v9.2/v9.5）** | 同主版本 + 最多前跳 2 minor + 仅同 minor 允许补丁回退；**不得有绝对 minor 下限**（否则 9.0.0 的 minor=0 会被判死、在线更新整体失效） | 12 条区间用例（含 9.0.0→9.1.0 采用 / 9.0.0→9.3.0 拒绝 / 9.0.0→8.16.4 拒绝） |
| **通读缺陷回归（v8.16.2）** | R-01~R-12 逐条有可用断言：档位熔断跨重启保留、真实音质入账、播放分账、快照运行期资格、试探键清理、半开名额后置、gateErr 带码、跨平台可取消、兜底结构化、ttl 死分支、7 项静态确认 | `readthrough-fixes` 18/0 |
| **巡检链口径单一真相（v9.1.4）** | `ok` 只认**端点级**最终结论（`httpOk && payload`），`httpOk`/`httpReason` 保留 HTTP 事实；成功率只有**探测级**一套（`rateRaw` + `wilsonLow`）；param 类端点一律不判可用；`legacy` 记录不参与统计；`consecutiveFail` 按全历史 | `probe --assert-samples`、`tg-truth` 口径一致、`f-repo` 57/0 |
| **仅试听降级（v9.1.4，用户口径）** | juheTx《晴天》稳定 60.1s / 960887B 试听片段 → 判「可用但受限」（`ok:true` + `fragment:true` + 实际时长），README 显示 `🟡 可用（仅试听 60s/271s）`、日报单列且**不进「需处理」**；依据是源本体 `src/core/15-verify.js` 的 `PREVIEW_FRAGMENT` 会拦截并换源，用户听不到片段 | 真实 `probe --reps=1` 三轮（可用 10/12） |

## 4. 本轮实测结果（2026-11-20 · v9.1.4）

| 项 | 结果 |
|---|---|
| `npm test`（**46 个脚本**，含压测 2 条 + 冒烟 1 条） | **RC=0**；V 组 133/0 |
| `stress-test`（S） | 12/0 |
| `stress-round3`（T） | 14/0（链内） |
| `stress-round4`（V） | 133/0（链内） |
| **压测合计** | **159/0**（S12+T14+V133） |
| 变异 `--full --strict` | **22 killed / 0 survived / 100%**（修复 MU15/MU22 拆包后失效锚点） |
| `v9-gate.sh --group core` | **通过 35s**（E0/L/C2/E1/E3/X/C1 全绿） |
| `layer-check` | ✅ 33 个 core 模块，无环/无反向引用/无同名定义/无直读 lx |
| `cross-repo-version` | ✅ 产物 9.0.0 = legacy 9.0.0，App 解析器兼容 |
| `schema-parity` | ✅ 4 组计数语义对齐，顶层 probe/play/chain/schema 齐备 |
| `verify:bundle` | **8 passed / 0 failed**（7071 行 / 362008 bytes 可审计） |
| `self-check` / `docs-audit --dry-run` | 自检通过（@version 9.0.0）；文档 0 红 0 黄 |

> **本轮修掉的真实缺陷**：`MU15` / `MU22` 两个变异锚点在 v9 拆包后失效（`qualitySkipProbeAt` 改走 `dep()`、直写 `songInfo.duration` 改 `setDurationHint`），原本被静默 skipped、strict 下本应红。已按当前真实文本更新锚点，单点 2/2 与全量 22/22 均 killed。

## 5. 失败处置与外部阻塞

1. 任一脚本非 0 即记录失败，不以「局部通过」代替。
2. 计时类断言假红 → 单独串行重跑，不并发。
3. 真机/真上游长稳仍 blocked，本计划只对纯 Node/内存 FS 结论负责。

---

## 6. 压测负载设计（承接原 v9.0 §4 P1~P6）

> 原 `docs/AUDIT_PLAN.md` v9.0 的 §4 有更细的负载参数（并发数、时长、循环次数），此前未进本文件；归档前承接于此，作为压测脚本的**设计意图台账**（运行时以脚本内实际参数为准）。

| # | 套件 | 设计负载（原 v9 口径） | 通过标准 |
|---|---|---|---|
| P1 | `stress-test.js` | 1000 并发、200 并发、12s 总预算、限速窗口、熔断雪崩、505 首缓存、3000 次长跑、排序、TTL、200 次 × 2s Timer | 12/0；成功率 ≥95%；外呼收敛；Timer 不随请求线性增长；**S4b「窗口滑过后恢复」判据只看 `after`（窗口后那次请求是否成功），不得用累计外呼计数兜底——2026-11-19 前该断言写成 `after \|\| total() > 0`，因 `total()` 恒 >0 而永不失败** |
| P2 | `stress-round3.js` | 突发并发、缓存穿透、冷却、降档、限流、探针、跨平台 | 14/0；冷却仍写、128k 可走、外呼不放大 |
| P3 | `stress-round4.js` | 故障谱系、预热 TTL、探针双歌、档位 breaker、短路、排序、快照 | 133/0；TTL 内新增预热 0；半开只放一枪 |
| P4 | 变异 `mutation/run.js --full --strict` | 22 个锚点 | 22 killed / 0 survived；`--strict` 下 skipped 即失败 |
| P5 | 冒烟 `lx-source-smoke-test.js` | 67 组插件加载/导出/配置/取链 | 67/0 |
| P6 | 审计 `npm test` | **46 脚本 / 567 条断言**（含 e-extra 90/0、f-repo **57/0**、tg-truth 口径全一致） | 46 脚本 rc0 |

**执行顺序**：P5 → P6 → P1 → P2 → P3 → P4；任一红先修实现或明确夹具漂移，再全量复跑。

> 2026-11-16 起 P6 与 CI 判据同源：`npm test` 已并入 CI 的 L3/L4 全部审计脚本（42 个），本地绿不再等于「云端可能还有红」。

---

## 7. 压测方法论承接（原 stress-round4 §1/§3）

> `stress-round4.md` 的「五条不变量」与「四条压测自身翻过车」是方法论资产，随其归档后在此保留要点，避免以后重新踩坑。原文见 `docs/archive/AUDIT_HISTORY.md`「历史原文：`stress-round4.md`」一节。

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
