# 架构与调用链（ARCHITECTURE）

> 单文件聚合音源：`lx-source.js`（7100 行 / 364735 bytes，v9.1.2）在 App 的 QuickJS 沙箱里运行，不是 Node。
> 本文只讲**边界、调用顺序、状态机**；逐段职责见 [`DEV_GUIDE.md`](./DEV_GUIDE.md)，历史取舍见 [`AUDIT_RESULTS.md`](./AUDIT_RESULTS.md)。

## 一、运行环境边界（决定了很多"不能做"）

| 事实 | 影响 |
|---|---|
| 宿主是 QuickJS，不是 Node | 无 `import`/`require`、无 `fs`、无 `Object.hasOwn`、无 `Promise.any`、无 `fetch`/`AbortController`；只能用 `lx.request` |
| 生命周期随 App 走 | 模块加载即注册事件、起 `setInterval`；**不能假设进程长期存活**，缓存要能在冷启动后重建 |
| 只有一条网络通道 | 所有请求走 `lx.request(url, {method, headers, body, binary, timeout}, cb)`；`binary:true` 才回 Buffer |
| 单次点歌有软实时要求 | 总预算默认 12s（可配上限 15s），分档预算 flac24bit/flac 6s、320k 5s、128k 5s，末档保底默认 3s；运行时总预算 + 末档保底**硬顶 16s**（`BUDGET_TOTAL_HARD_LIMIT_MS`） |
| 跨平台兜底有独立窗口 | grace 默认 3s、搜索超时默认 3s；最坏 `3 + 3 + 16 = 22s`，低于 App 音源桥 23s 超时 |

## 二、八段结构（按职责）

| 段 | 职责 |
|---|---|
| ① 常量配置 | `USER_CONFIG`（35 个数字键 + 9 个布尔键 + `probeSongPool` 数组 + 卡密/设备 ID 字符串 + `raceBudgetPerQuality` 对象；App 面板契约 39 键 = 30 数字 + 9 布尔）、`SOURCE_TOGGLES`（13 键）、19 个错误码、`CODE_HINT`、预算常量 |
| ② 开关与探测 | 三层开关真值（`userEnabled` / `autoOff` / `probeState.sleeping`）、`manualOff`、探测歌池、核心/次要轮次、并发 1~8、抖动、播放/取链在飞暂停、冷启动预热 |
| ③ 日志/缓存/断路器 | `logInfo/logWarn`、`createLRUCache`（成功 500 / 失败 300）、源级+音质档级双层 `getBreaker`、限流退避、健康事件环形缓冲 500 |
| ④ HTTP/判据/L0/L4 | `httpRequest` 自动 JSON、cancelToken、5xx→`SERVER_ERROR`、429→`RATE_LIMIT`、410→`LINK_EXPIRED`、4xx→`NETWORK_ERROR`，仅超时/网络/5xx 重试 1 次；1KB Range 字节嗅探（FLAC/MP3/OGG/M4A/WAV/m3u8/HTML/JSON/空体）、真实时长解析、`probeAudioDelivery`、`verifyDelivery`、`ADMISSION_POLICY` / `admit` / `applyAdmission` / `clearSourceLedger` |
| ⑤ 匹配工具 | `normalizeKeyword`、`getHashOrMid`、平台映射、跨平台候选严格匹配 |
| ⑥ 源实现 | 13 个登记源 handler（11 上链 / 2 观察），各自 `getUrl` + 能力声明；`validateProviderContracts()` 启动强校验 |
| ⑦ 注册表与调度 | `sourceConfig`、`buildSourceChain`、`sortChainByHealth`、`fallbackRace`、`raceFirst`、`wrapExecute`；`getUrlWithFallback` 负责缓存、跨档、预算、失败兜底与跨平台兜底；健康分与 `getHealthSnapshot` |
| ⑧ 上报与事件 | `on(EVENT_NAMES.request)` 14 个 action 分发、`inited` 上报 `mediaEnvelope:2`、健康态导出/恢复 |

> **行号只在 `DEV_GUIDE.md` §二维护**；`docs-audit` 规则 7 从生成物 `var PROVIDER_CONTRACT` 到 EOF 校验末段边界。

## 三、一次点歌的完整调用链

```
App → lx.on(EVENT_NAMES.request)
      ↓  action 分发（14 个 action）
      ├ musicUrl → getUrlWithFallback(platform, quality, musicInfo)
      │             ↓ 请求档缓存 → 更高档缓存 → 缓存来源已关闭则丢弃 → verifyOnCacheHit（默认 true）
      │             ↓ 失败缓存命中直接抛；truthfulQuality 命中历史 ceiling 时从 ceiling 档起跑
      │             ↓ buildSourceChain：active + 平台匹配 + 有链位 + maxQuality 足够 + computeEligibility 通过
      │             ↓ 按 chain[platform] 升序，再按健康分 + verified 0.15 加权排序；分差 ≤0.05 按平均耗时升序
      │             ↓ fallbackRace：单链预算 max(deadline-now,0)，≤0 直接抛 BUDGET_EXHAUSTED；
      │             ↓              多链 primary/secondary 合并为 launchers 交给 raceFirst
      │             ↓ raceFirst：批大小 3、批间错峰 300ms；verified 源优先立即结算，非 verified 等 600ms
      │             ↓ 预算到期且已有候选 → 交付候选；否则抛 BUDGET_EXHAUSTED 并记录实际 budgetMs
      │             ↓ wrapExecute：冷却/熔断/限流检查 → handler.getUrl → validateUrl → isAudioPlayable
      │             ↓             → verifyDelivery（verifyDelivery=true 时；1KB Range 读真实时长/字节）
      │             ↓             时长比例 < verifyDurRatio 且差值 > verifyDurGapSec → PREVIEW_FRAGMENT
      │             ↓ 成功 → 按实交付档回填 quality → 写 successCache（按实际音质分槽）→ recordSuccess
      │             ↓ 失败 → admit({stage, attempts|probe|delivery|error.code}) → verdict + 代表码 + TTL
      │             ↓             → applyAdmission：预算耗尽 BUDGET 不 bump resolveDead/playDead
      │             ↓ 全档失败 → 片段兜底 → 过期缓存兜底 → 写失败缓存并聚合错误
      │             ↓ 主平台目录性失败且所有目标无候选 → tryCrossPlatformFallback（tx→wy→kw，排除主平台）
      ├ lyric / pic → wy 直连；其余明确 NOT_FOUND；出口 normalizeErrCode
      ├ health → getHealthSnapshot()（只读，零外呼）
      ├ healthEvents → getHealthEvents()（只读环形缓冲 500 条；traceId 串联，不记歌名/URL/账号/设备）
      ├ toggle → 校验 handlerId ∈ SOURCE_HANDLERS → 清 manualOff/probeState/deadCount + 重置熔断
      ├ probe / probeSource → 全量探测或单源探测；正在跑则 {running:true}
      ├ forceQualityProbe → 手动解除档位短路，只放行一次
      ├ reportPlayback → App 真实播放回传；playDead 的唯一真实播放入口
      ├ config → 读（卡密脱敏）/ 写（35 个数字 ALLOWED_KEYS + 9 个布尔 ALLOWED_BOOL_KEYS + probeSongPool，范围钳制）
      ├ exportHealthState / restoreHealthState → schema v2；完整态 7 天 TTL、controls-only 不受 TTL；源版本 9.1.2，恢复兼容不高于当前版本
      └ trend → {history, maxPoints}
```

## 四、状态机

| 状态机 | 状态/阈值 | 迁移条件 |
|---|---|---|
| 源级 + 档级断路器 | `closed → open → half-open → closed/open` | 连续失败 ≥ `breakerThreshold`（默认 3）→ 该档 open；`syncSourceBreaker` 聚合：所有档 open 才源级 open，任一档 half-open 则源级 half-open；半开成功 → closed；半开遇 429 直接重熔 |
| 播放摘除 `playDead` | 连续 3 次真实播放失败 | 5 分钟（`playDeadReviveMs`）后半开试探；只由 `reportPlayback` 累计 |
| 取链摘除 `resolveDead` | 连续 3 次取链/准入失败 | 与 `playDead` 共用 5 分钟复活窗口；**预算耗尽 BUDGET 不累计** |
| 源级限流 | 连续 3 次 429 → `rateLimited` | 退避 `rateLimitBackoffMs` 默认 30s；半开试探遇 429 直接重熔；`sourceCooldownMs=0` 表示使用配置退避 |
| 档位短路 | 同源同档 `success=0` 且 `definitiveFail+linkExpired >= qualityShortCircuitSamples`（默认 3） | 普通源 1h 后再探，唯一高质源 10min 后再探；`forceQualityProbe` 可手动解除 |
| 探测休眠 | 连续 3 轮失败 → `sleeping` | 每 10 轮唤醒试探；PASS 复位熔断与限流；UNKNOWN 不关闭、不累计失败 |
| 缓存 | 成功 LRU 500 / 失败 LRU 300 | 成功 TTL：flac/320k 30min，128k 6h；失败 TTL：预算/网络/限流 0，404/错歌 1h，410 1min，片段 30s，非音频/流列表 1min |

## 五、账本口径（数字别混）

| 账本 | 记什么 | 不记什么 |
|---|---|---|
| `totalRequests` / `totalSuccess` | 真实发出的请求 / 真实交付 | 冷却跳过、熔断跳过、限速跳过 |
| `byQuality.fail` | 该档业务失败 | 429 不计入 |
| `byQuality.linkExpired` | 410 死链（必须带 `err.code`） | 超时/网络异常（走熔断，不判死链） |
| 健康分（10 分制） | 真实样本主导 + 探测低权重 + 连续失败惩罚（`HEALTH_PRIOR_K=4`，时间惩罚上限 0.5，连续失败步进 0.08 上限 0.5） | 无版权 404 单独计数，不进成功率分母 |

## 六、跨仓契约（App 侧依赖，改了就炸）

1. **版本唯一真相**：脚本 `@version` 首 token；`@description` / `logInfo` 不再作为版本识别依据。App 内置版本不可解析时不覆盖现有源，禁止降级。
2. `sourceConfig` 每个平台必须声明 `actions`：`musicUrl`、`health`、`toggle`、`probe`、`probeSource`、`reportPlayback`、`config`、`trend`、`healthEvents`、`exportHealthState`、`restoreHealthState`、`forceQualityProbe`；wy 额外 `lyric`/`pic`，kw 额外 `pic`；`fallbackOwner:"source"`；`send(inited)` 声明 `mediaEnvelope:2`。
3. `musicUrl` 返回 `{url, quality?}`：`quality` 必须是**实交付**音质，不能是请求档位。
4. 错误对象必须有 `err.code`（19 个 `ERROR_CODES` 键名），App 按码分类；只有 message 会显示"未知错误"。
5. `config` 写只接受 35 个数字键 + 9 个布尔键 + `probeSongPool`；与 App 39 键对表（App 侧 30 数字 + 9 布尔），5 个 source-only 数字键为 `probeConcurrency`、`probeTierCoreInterval`、`probeTierSecondaryInterval`、`qualityShortCircuitUniqueProbeMs`、`crossPlatformGraceMs`。
6. 健康态持久化 schema v2：完整态 7 天 TTL、controls-only 永久；导出源版本 9.1.2，恢复兼容不高于当前版本；禁止 URL/歌名/账号/设备。
