# 音质策略优化方案（2026-11-14）

> 关联台账：[`KNOWN_ISSUES.md`](./KNOWN_ISSUES.md)（K01~K20）。本文件只描述方案与验证，不替代码实现结论。

## 0. 结论

**不做全量重构，做一次受控的局部重构 + 分阶段优化。**

原因不是“6 小时 / 1 小时”这两个参数本身，而是当前两个策略的**记账口径**有缺陷：

1. 能力备档（6h ceiling）在重复播放时会反复刷新 TTL，可能把一次临时降级变成事实上的永久降级。
2. 档位短路（1h short-circuit）把“临时网络失败”和“确定性死档”混在同一个 `fail` 计数里；只有 429 被单独排除。
3. 两个机制作用域不同：ceiling 是“平台 + 歌曲”，short-circuit 是“源 + 音质档”。不应合并成一张表。

本轮已完成方案整理、两条真实复现，并落地 **P0 + P1 代码**，以及 **K08 唯一源探路窗口 / K07 源侧强制探路**（工作区未发版，见 §0.1）。K07 的 App 可见入口仍属 P2。

---

## 0.1 实现状态（2026-11-14）

| 项 | 状态 | 证据 |
|---|---|---|
| P0 能力备档 entry / TTL / 不续期 | FIXED | `noteQualityCeiling()` / `getQualityCeiling()`；QP1~QP3 |
| P0 只记真实进入请求链的高质档 | FIXED | `attemptedQualities`；QP1/QP3 |
| P1 `definitiveFail` 记账 | FIXED | `recordFailure()` / `recordBusinessFail()`；QP5/QP6 |
| P1 短路只算 `definitiveFail + linkExpired` | FIXED | `isQualityHopeless()`；QP4/QP5 |
| P1 旧快照缺字段兼容 | FIXED | `restoreHealthState()` 缺字段沿用旧 `fail`；QP8 |
| P1 用户强制重试旁路（源侧） | FIXED | `forceQualityProbe(sourceId, quality)` + request action `forceQualityProbe`；QP11 覆盖一次放行 |
| K08 唯一高质源探路窗口 | FIXED | `qualityShortCircuitUniqueProbeMs`(600000) + `countActiveQualitySources()`；QP9/QP10 |
| P2 App 侧诊断/入口（K07 可见入口） | OPEN | 未改 App；当前只保证源侧可调用 |

本轮验证：`node test/audit/quality-policy-v2.js` **12/0**（QP1~QP12）；`npm test` rc0；全量 `test/audit/*.js` 40/40 rc0（含 `g-meta` 14/0）；`verify:bundle` 8/0（bundle 297666 bytes，工作区）。
**未升版本号、未推送。**

## 1. 当前机制事实

| 机制 | 作用域 | 当前行为 | 代码位置 |
|---|---|---|---|
| 能力备档 | `platform + song` | 实交付低于请求档时记录 `{ quality, ts }`；下次从该档起跑；TTL 6h | `QUALITY_CEILING_TTL_MS`、`qualityCeilingMap`、`noteQualityCeiling()`、`getQualityCeiling()` |
| 档位短路 | `source + quality` | `definitiveFail + linkExpired >= 3` 后短路；非唯一源 1h 放行一次探路，平台内唯一高质源 10min 放行一次；`success > 0` 后不再短路 | `qualityShortCircuitSamples`、`qualityShortCircuitProbeMs`、`qualityShortCircuitUniqueProbeMs`、`isQualityHopeless()` |
| 强制探路 | `source + quality` | `forceQualityProbe()` 把下一次短路检查标记为已到期，只放行一轮；不修改 breaker/健康账本 | `forceQualityProbe()`、request action `forceQualityProbe` |
| 请求降档链 | `platform + song + quality` | `flac → 320k → 128k`，末档 128k 保底；分档预算 | `buildQualityChain()`、`getUrlWithFallback()` |
| 质量记账 | `source + quality` | `recordFailure()` 只累加 `fail`，不带失败原因；`recordRateLimit()` 单独走 429 | `recordFailure()`、`recordRateLimit()`、`byQuality` |

当前关键事实：

- `noteQualityCeiling()` 每次调用都会写 `ts: Date.now()`，没有“已记录就不再续期”的判断。
- `recordFailure()` 没有失败分类参数；3 次 generic failure 就能进入 `QUALITY_SHORT_CIRCUIT`。
- `recordRateLimit()` 已明确排除 429，不进入 `byQuality.fail`；但超时、5xx、连接错误仍走 `recordFailure()` 的 `fail`。
- `qualityCeilingMap` 是内存态，重启即丢；`qualitySkipProbeAt` 会进健康状态导出/恢复协议。

---

## 2. 真实验证

### 2.1 复现一：能力备档 TTL 会被重复播放刷新

用 `src/legacy.js` 直接执行，暴露 `qualityCeilingMap / noteQualityCeiling` 做函数级验证：

```bash
node /tmp/quality-ceiling-verify.js
```

实测输出：

```json
{
  "firstQuality": "128k",
  "firstTs": 1794653669033,
  "secondQuality": "128k",
  "secondTs": 1794653669053,
  "ttlMs": 21600000,
  "ttlRefreshedOnRepeat": true
}
```

结论：仅隔 20ms 再记录一次同样低的 `128k`，`ts` 就被刷新。当前实现下，用户只要每 6 小时内播放一次，这首歌就可能一直停留在 128k 起跑，不再尝试 flac。这不是“6 小时上限”，而是“持续使用即永久续期”。

### 2.2 复现二：3 次 generic failure 直接触发 1 小时档位短路

用当前 `lx-source.js` 的公开测试导出驱动：

```bash
node /tmp/quality-shortcircuit-verify.js
```

实测输出：

```json
{
  "afterThreeGenericFailures": {
    "eligible": false,
    "code": "QUALITY_SHORT_CIRCUIT",
    "reason": "quality-short-circuit",
    "untilMs": 1794657281734
  },
  "afterThreeRateLimits": {
    "eligible": false,
    "code": "RATE_LIMITED",
    "reason": "closed"
  }
}
```

结论：

- 3 次不带原因的 `recordFailure()` 就触发 `QUALITY_SHORT_CIRCUIT`，`untilMs` 约 1 小时后。
- 3 次 429 走 `RATE_LIMITED`，没有进入档位短路；说明当前只区分了限流，没有区分“超时/5xx”和“404/410”。
- 也就是说，某个 flac 源如果连续 3 次网络超时，可能被 1 小时短路；如果它是唯一 flac 源，这一小时就没有高质可试。

### 2.3 当前回归基线

本轮之前的源仓完整门禁：

- `npm test` rc0
- `quality-truth` 9/0
- 39 个 `test/audit/*.js` 39/39 rc0
- `stress-test 12/0 + stress-round3 14/0 + stress-round4 133/0 = 159/0`
- `verify:bundle` 8/0
- `docs-audit` 0 修复 / 34 报告

验证脚本只读当前代码，没有改动仓库状态。

---

## 3. 优化目标

### 3.1 能力备档

要解决的问题：

- 重复低质交付不能续期 TTL；
- 临时失败和确定性失败要有不同 TTL；
- 只有高质档实际进入请求链才记录；
- 到期后要有一次“高质探路”，而不是永远从低档起跑；
- 用户手动切高质/刷新时能绕过一次。

建议数据模型：

```js
// qualityCeilingMap: platform|song -> entry
{
  quality,        // 实际最高可得档，例如 128k
  recordedAt,     // 首次记录时间，不随重复低质交付刷新
  nextProbeAt,    // 下一次允许试高质的时间
  reason,         // definitive | transient | unknown
  ttlMs
}
```

行为：

1. 首次出现 `truthQ < reqQ` 时记录 ceiling。
2. 同一 `quality` 重复出现时，不更新 `recordedAt / nextProbeAt`；只有实际档位升高才更新。
3. `getQualityCeiling()` 只在 `now < nextProbeAt` 时压制起跑档；到 `nextProbeAt` 后允许从请求档试一次。
4. 高质探路成功则清除 ceiling；失败则重新设置 `nextProbeAt`。
5. `nextProbeAt` 按原因设置：
   - definitive：404 / 410 / 无版权 / `NOT_AUDIO` / `PREVIEW_FRAGMENT` → 6h；
   - transient：`NETWORK_TIMEOUT` / `NETWORK_ERROR` / `SERVER_ERROR` / 5xx → 10min；
   - 429 / `RATE_LIMIT` → 不记 ceiling，走现有短退避；
   - 未知 → 30min。
6. 只有请求档真正进入 `qualityChain` 才记录；被短路或健康策略跳过时不记录。

### 3.2 档位短路

建议把“记账”和“判定”拆开：

```js
recordQualityFailure(sourceId, quality, failureClass)
  // failureClass: definitive | transient | rate_limit

isQualityShortCircuited(sourceId, quality, now)
  // 只看 definitive + linkExpired；transient 交给 breaker 的短冷却/半开
```

规则：

- definitive + `linkExpired` 累计 3 次才短路；
- 超时、5xx、连接错误仍由 `recordFailure()` 计入 breaker 的连续失败，走 180s 冷却 + 半开探路，不参与 1h 短路；
- 429 继续走 `recordRateLimit()`，不参与短路；
- 如果某档只有一个可用源，短路窗口缩短为 10min，或保留“用户强制重试”旁路；
- 探路时间仍保留 1h 默认，但用户主动重试可以绕过一次。

### 3.3 用户入口与可观测性

- App 播放诊断增加 `ceiling_hit` / `short_circuit` / `next_probe_at` 字段；
- 播放页或诊断页提供“强制重试高质”入口，绕过一次 ceiling/short-circuit；
- 不改变现有缓存协议；缓存仍按实际交付档写，片段仍带 `fragment:true`。

---

## 4. 重构边界

### 建议做

- 抽出 `classifyQualityFailure(code)` 纯函数；
- 抽出 `resolveStartQuality(platform, songInfo, requestedQuality)`，返回起跑档、原因、`nextProbeAt`；
- 抽出 `isQualityShortCircuited(sourceId, quality, now)`；
- `getUrlWithFallback()` 只负责按决策结果请求，不负责解释策略。

### 不建议做

- 不合并 `qualityCeilingMap` 和 `qualitySkipProbeAt`：作用域不同；
- 不重写 `admission`、`fallbackRace`、缓存、健康快照；
- 不改变 `exportHealthState / restoreHealthState` 的既有字段形状；
- 不做全量“质量策略中心”模块化，等策略数量真的增加后再考虑。

### 为什么不全量重构

1. 当前问题集中在 2 个函数，局部修复即可解决主要用户痛点。
2. `qualitySkipProbeAt` 已进健康状态持久化协议，全量重构会扩大回归面。
3. `r-admission`、`s-health-events`、`v-eligibility`、健康面板、链构建都依赖现有判定。
4. 两个机制作用域不同，硬合并会增加误判。

---

## 5. 分阶段实施

### P0（先修行为，低风险）

- `noteQualityCeiling()` 增加“同档不续期”；
- `qualityCeilingMap` 增加 `nextProbeAt / reason`；
- 按 definitive / transient 设置 TTL；
- 记录前确认高质档实际进入请求链；
- 补假时钟测试：重复低质不续期、到期重新试高质、临时失败 10min 后重试。

### P1（局部重构，策略可测）

- 抽 `classifyQualityFailure`、`resolveStartQuality`、`isQualityShortCircuited`；
- `isQualityHopeless()` 改为只看 definitive + linkExpired；
- 临时失败交 breaker；唯一源/用户重试旁路；
- 跑 `quality-truth`、`r-admission`、`s-health-events`、`v-eligibility`、全量 39 个 audit。

### P2（可选，等策略变多再做）

- 抽独立 policy 模块；
- 加账号/VIP 能力、平台配额、每源独立上限等策略；
- 再评估是否统一状态表。

---

## 6. 验证矩阵（建议新增）

| ID | 场景 | 期望 |
|---|---|---|
| QC-1 | 同一首歌连续 10 次交付 128k | `recordedAt` 不变，`nextProbeAt` 不后移 |
| QC-2 | 临时超时后 10min | 到点允许试 flac；成功清除 ceiling |
| QC-3 | 404/410 后 6h | 6h 内不重复试 flac；到期探路 |
| QC-4 | 请求档因短路被跳过 | 不得记成“这首歌没有 flac” |
| QS-1 | 3 次超时 | 不触发 1h 短路，只走 breaker 冷却 |
| QS-2 | 3 次 410 | 触发 1h 短路 |
| QS-3 | 唯一 flac 源恢复 | 10min 探路或用户强制重试能重新拿到高质 |
| QS-4 | 用户强制重试 | 绕过一次 ceiling/short-circuit |

---

## 7. 风险与回滚

- 风险：把“临时失败”放得太松，会恢复高质白跑；用 10min TTL + 单次探路控制成本。
- 风险：`byQuality` 新增字段影响健康持久化；先只改内存判定，必要时再扩 `HEALTH_QUALITY_NUMBER_FIELDS`。
- 回滚：保留现有 `qualityCeilingMap` / `qualitySkipProbeAt` 读取路径，新增字段缺省时回退旧行为；配置开关可关闭新策略。

## 8. 最终建议

先做 P0，再做 P1 的局部重构；暂时不做全量重构。  
最优先修的是“能力备档 TTL 续期”，因为它会把一次临时失败变成长期降级；档位短路的 1h 参数本身可以保留，但必须只对确定性失败生效。
