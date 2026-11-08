# 架构与调用链（ARCHITECTURE）

> 单文件聚合音源：`lx-source.js`（3136 行）在 App 的 QuickJS 沙箱里运行，不是 Node。
> 本文只讲**边界、调用顺序、状态机**；逐段代码职责见 [`DEV_GUIDE.md`](./DEV_GUIDE.md)，历史取舍见 [`AUDIT_RESULTS.md`](./AUDIT_RESULTS.md)。

## 一、运行环境边界（决定了很多"不能做"）

| 事实 | 影响 |
|---|---|
| 宿主是 QuickJS，不是 Node | 无 `import`/`require`、无 `fs`、无 `Object.hasOwn`、无 `Promise.any`、无 `fetch`/`AbortController`；只能用 `lx.request` |
| 生命周期随 App 走 | 模块加载即注册事件、起 `setInterval`（不 `unref` 也没关系，随 App 退出）；**不能假设进程长期存活**，缓存要能在冷启动后重建 |
| 只有一条网络通道 | 所有请求走 `lx.request(url, {method, headers, body, binary, timeout}, cb)`；`binary:true` 才回 Buffer |
| 单次点歌有软实时要求 | 总预算 12s，分档预算 flac 6s / 320k 5s / 128k 5s，末档保底 3s，单源硬上限（防单链绕过） |

## 二、八段结构（按行段）

| 段 | 行段 | 职责 |
|---|---|---|
| ① 常量配置 | 15~198 | `USER_CONFIG`（39 键）、`SOURCE_TOGGLES`（20 键）、错误码、`CODE_HINT`、超时预算 |
| ② 开关与探测 | 199~651 | 开关真值解析、探针素材、冷启动预热 |
| ③ 日志/缓存/断路器 | 652~893 | `logInfo/logWarn`、`createLRUCache`（success 500 / fail 300）、`getBreaker` |
| ④ HTTP 与判据层 | 894~1372 | `httpRequest` 重试、`normalizeErrCode`、1KB Range 探针、真实时长解析、交付验真 |
| ⑤ 匹配工具 | 1373~1535 | `normalizeKeyword`、`getHashOrMid`、平台映射 |
| ⑥ 源实现 | 1536~2151 | 20 个源 handler，各自 `getUrl` + 能力声明 |
| ⑦ 注册表与调度 | 2152~2932 | `sourceConfig`、`buildSourceChain`、`fallbackRace`、`raceFirst`、`wrapExecute`、健康分、`getHealthSnapshot` |
| ⑧ 上报与事件 | 2933~3136 | `on(EVENT_NAMES.request)` action 分发、`inited` 上报、导出面 |

## 三、一次点歌的完整调用链

```
App → lx.on(EVENT_NAMES.request)
      ↓  action 分发（8 个 action）
      ├ musicUrl → getUrlWithFallback(platform, quality, musicInfo)
      │             ↓ buildSourceChain：按平台+音质过滤→能力过滤→跳过已知片段源→源数上限
      │             ↓ 单源？  是 → wrapExecute（Promise.race 单源硬上限）
      │             │        否 → fallbackRace → 分批错峰并发 run(handler) → raceFirst
      │             ↓ wrapExecute：冷却检查 → 断路器 canExecute → 并发/限速 throttleCheck
      │             ↓             → handler.getUrl → validateUrl → isAudioPlayable
      │             ↓             → verifyDelivery（1KB Range 读 FLAC STREAMINFO / MP3 Xing 算真实时长）
      │             ↓             判据：真实时长可定 && 原曲≥90s && ratio<0.6 && gap>15s → 拒收（PREVIEW_FRAGMENT）
      │             ↓ 成功 → 音质回填（按实测码率改写标签）→ 写 successCache（按实交付音质分槽）
      │             ↓ 失败 → recordBusinessFail / recordFailure（分业务失败与网络失败）
      │             ↓ 全链失败 → 片段兜底（fragmentFallback && (hasFragDetail || hasFragCache)）→ 标「试听版」、不进 6h 缓存
      ├ lyric / pic → 直连源（wy 有稳定接口，其余明确 NOT_FOUND）；出口 normalizeErrCode
      ├ health → getHealthSnapshot()（只读，零外呼）
      ├ toggle → 校验 handlerId ∈ SOURCE_HANDLERS → 清 manualOff/probeState/deadCount + 重置熔断
      ├ probe  → 正在跑则 {running:true}，否则 runHealthCheck(false)
      ├ config → 读（卡密脱敏）/ 写（14 个 ALLOWED_KEYS + 范围钳制；9 个闸门键不开放）
      └ trend  → {history, maxPoints}
```

## 四、四个状态机

| 状态机 | 状态/阈值 | 迁移条件 |
|---|---|---|
| 断路器 | `closed → open → half-open → closed/open` | 连续失败 ≥ `breakerThreshold`（默认很小）→ open，冷却 `breakerCooldownMs` → half-open（只放探针）；半开成功 → closed；**半开遇业务失败/429/节流 → 立刻回 open**（防永久滞留） |
| 源级冷却 | `previewCooldownMap[handlerId] = until` | 同一源对 ≥2 首**不同**歌都出现片段（跨歌证据）→ 冷却 5 分钟；冷却期**只放行 128k 保底档**（否则新歌连片段都拿不到） |
| 质量短路 | `qualityCeiling[platform][quality]` 6h | 全部源该档历史 0 成功 → 短路降档 1h 探路 |
| 缓存 | success LRU 500 / fail LRU 300 | 命中后 `get` 提序；超容量淘汰最旧；TTL 分档（flac/320k 30min，128k 6h） |

## 五、账本口径（数字别混）

| 账本 | 记什么 | 不记什么 |
|---|---|---|
| `totalRequests` / `totalSuccess` | 真实发出的请求 / 真实交付 | 冷却跳过、熔断跳过、限速跳过 |
| `byQuality.fail` | 该档业务失败 | 429 不计入 |
| `byQuality.linkExpired` | 410 死链（必须带 `err.code`） | 超时/网络异常（走熔断，不判死链） |
| 健康分（10 分制） | 真实样本主导 + 探测低权重 + 连续失败惩罚 | 无版权 404 单独计数，不进成功率分母 |

## 六、跨仓契约（App 侧依赖，改了就炸）

1. `@description` / `@version` 首行 + `logInfo` 串里的 `vX.Y` —— App 靠正则识别内置源版本（b38 教训）
2. `sourceConfig` 每个平台必须声明 `actions`：`health/toggle/probe` 全平台，`lyric/pic` 按平台
3. `musicUrl` 返回 `{url, quality?}`：`quality` 必须是**实交付**音质，不能是请求档位
4. 错误对象必须有 `err.code`（`ERROR_CODES` 键名），App 按码分类；只有 message 会显示"未知错误"
5. `toggle`/`probe`/`config` 的返回结构见 README 与 `DEV_GUIDE`
