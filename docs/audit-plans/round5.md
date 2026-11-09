# 第五轮审计计划：从「审代码」到「审断言」

> 前四轮的结论是「79 + 57 + 50 + 50 条断言全绿」，但第四轮做了两件让这个结论站不住的事：
> ① 把 10 条已修缺陷逐条改回缺陷态，**3 条改回去照样全绿**（D-09 / D-13 / D-14）；
> ② 补这三条时，**其中 2 条的首版判据本身是错的**（W1 假设片段兜底会抛错、T2b 假设冷却后外呼为 0），
> 且补 W1 的过程中挖出一条四轮都没发现的真缺陷 **D-20（内层缓存把片段写成完整版）**。
>
> 也就是说：**代码层不可信，断言层同样不可信**。第五轮不再继续"人工挑场景"，而是改成机械化的方式审断言。

## 5.1 MUT：变异测试，用「杀不杀得死」量化断言强度

不靠人想场景，而是**机器改代码，看门禁能不能发现**。（已落地：`test/mutation/run.js`，9 个算子；首跑 5/8 killed，补齐 T2c/W2/W2(MEM) 后全量 9/9——详见 `docs/AUDIT_RESULTS.md` §12.6）

- 工具：`test/mutation/run.js`（新增，只读仓库 + 在 `/tmp` 生成变异副本，不改工作区）
- 变异算子（对 `lx-source.js` 逐条施加，每轮只施加一个）：

| 编号 | 算子 | 示例 |
|---|---|---|
| MU1 | 阈值 +1 / -1 | `qs.size >= 1` → `>= 2` |
| MU2 | 布尔运算符反转 | `a && b` → `a \|\| b` |
| MU3 | 比较符替换 | `>` → `>=`、`<` → `<=` |
| MU4 | 删一个 `if` 分支体 | 删掉 `if (cached) return ...` |
| MU5 | 返回值常量替换 | `return url` → `return null` |
| MU6 | 错误码替换 | `ERROR_CODES.NOT_FOUND` → `SERVER_ERROR` |
| MU7 | 删一行副作用 | 删 `recordSuccess(...)` / `setCachedUrl(...)` |
| MU8 | 常量改值 | `PREVIEW_COOLDOWN_MS` 300000 → 1000 |
| MU9 | 数量级错误 | `* 1000` → `* 1`、`ms` ↔ `s` |
| MU10 | 注释掉闸门调用 | 注释 `await verifyDelivery(...)` |
| MU11 | 删 `finally` 释放 | 删 `inflightCount.set(...-1)` |
| MU12 | 顺序颠倒 | `recordSuccess` 与 `validateUrl` 互换 |

- 判定：该变异跑 `a-static / b-logic / e-extra / g-meta / stress-round3` 任一非 0 → **killed**，全 0 → **survived**
- 验收：初始跑一遍建立基线（预计 killed 55%~70%），**每一条 survived 都要落到具体断言缺口**，补完再跑，目标 killed ≥ 85%
- 关键纪律：变异体不许"为通过而通过"——只允许补断言，不许放宽门禁

## 5.2 INV：不变量断言（不指定路径，只守"永远为真"的性质）（已落地 6 条：3 条新写 + INV1/INV4/INV6 由 M14/W2/W1 覆盖，见 §12.11）

比"某场景返回某值"更抗重构，也更容易抓住"某条路径忘了做某事"。

| ID | 不变量 | 观测方式 |
|---|---|---|
| INV1 | 缓存只允许一个写点，且在验真之后 | 已实现（M14） |
| INV2 | 交付的 `subSource` 必须在 `buildSourceChain(platform, quality)` 结果里 | 导出面交叉验证，遍历 5 平台 × 3 档 |
| INV3 | `type` 必须等于实测字节推断出的码率档（flac/mp3 分别验） | 构造 4 种体（真 flac / flac 头但 128k / mp3 5s / 空） |
| INV4 | 任意请求结束后该源 `inflight` 归零（含异常、超时、竞速落败三条退出路径） | 未导出 → 用「连续 3 次失败后第 4 次仍能发出请求」间接证明（计数泄漏会让并发上限永久占满） |
| INV5 | 幂等：同歌同档连续两次（无缓存）交付的 source 相同，或档位不降级 | 两次 fresh 对比 |
| INV6 | 任何 `fragmentUrlMap` 命中都必须带「试听版」标注（不得当完整版） | 已实现（W1），扩到 320k/128k 档 |

## 5.3 EDGE：边界与时间

四轮测的都是"正常值附近"，边界几乎没碰：

| ID | 边界 | 期望 |
|---|---|---|
| EDGE1 | 高音质缓存 TTL ±1ms（`cacheTtlHighQualityMs`） | -1ms 命中、+1ms 未命中（`>` 与 `>=` 的区别） |
| EDGE2 | `raceBudgetMs = 0` / 负数 / NaN | 被 PARAM_LIMITS 钳制或明确报错，不得静默跑 12s |
| EDGE3 | `duration` 为 0 / undefined / 负数 | 时长校验不得把所有候选判成"错歌" |
| EDGE4 | `quality` 大小写 `FLAC` / `Flac` | 必须与 `flac` 等价（缓存 key 不得分裂） |
| EDGE5 | `songmid` 含 `\|`、空格、emoji | 缓存 key 不得与相邻字段粘连（`platform\|mid\|quality` 是拼接串） |
| EDGE6 | 同名同歌手、duration 差 2 分钟的两首歌 | `buildCacheKey` 必须区分，否则交付错歌 |
| EDGE7 | 冷却到期瞬间（`previewCooldownMap` 截止前 1ms / 后 1ms） | 前 1ms 跳过该源、后 1ms 恢复 |

## 5.4 FAULT：故障注入（上游"不像正常错误"的失败）

现有 mock 只覆盖 `{error:'ECONNREFUSED'}`、`{statusCode:410}`、`{code:500}` 三类：

| ID | 故障 | 期望 |
|---|---|---|
| FAULT1 | HTTP 200 + 空 body | 判失败，不得当"能播"放行 |
| FAULT2 | JSON 截断（`{"code":200,"data":`） | 解析失败走 `SERVER_ERROR`，不得崩栈 |
| FAULT3 | 10MB body | 有上限或至少不阻塞整条链 |
| FAULT4 | 连续 502/503/504 | 计入 `recordFailure` 并按熔断阈值收敛 |
| FAULT5 | `ENOTFOUND`（DNS 失败） | 归 `NETWORK_ERROR`，不判 `LINK_EXPIRED` |
| FAULT6 | 证书错误 `DEPTH_ZERO_SELF_SIGNED_CERT` | 同上 |
| FAULT7 | mock 回调抛字符串（非 Error 对象） | `catch` 里读 `e.code` 不得触发 TypeError |

## 5.5 MEM：长时运行与内存（本轮侦察已发现的缺口）

实测：`successCache` 有 LRU/TTL，但另外 **6 个 Map 只有 TTL、没有条数上限**，
且 `fragmentUrlMap` 只在**读取时**才删过期条目——从不被读取的过期条目会永久驻留。

| ID | 目标 | 做法 |
|---|---|---|
| MEM1 | 1000 首不同歌后 7 个 Map 的条目数 | `getHealthSnapshot` 增加 `cacheSizes` 字段（可观测性），断言 `fragmentUrlMap ≤ 上限` |
| MEM2 | `fragmentUrlMap` / `deliveryQualityMap` / `qualityCeilingMap` 加上限 | 写入时按条数淘汰最旧（≥200 条），并断言淘汰后仍能正常命中热数据 |
| MEM3 | 冷却/片段源记忆的 TTL 清理 | 断言过期后 Map 条目**会减少**（当前只在读取时清） |

## 5.6 验收与边界

- 每组都必须给出「注入 → 红 → 还原 → 绿」的证据，没有红过的断言不计入完成；
- MUT 的 survived 清单要逐条关掉（补断言或明确记录"不值得守"及理由）；
- 不改产品行为的部分（EDGE 期望值）必须先确认"现有行为是否已正确"，再决定补断言还是修代码；
- 本轮不做：重复已覆盖维度、给未导出状态加测试专用导出（宁愿用行为差观测）。

## 5.7 与本轮（第四轮收尾）的关系

第四轮已闭环：方案 1 的 10 条回退抽样 + 三条盲区补测（M13/W1/T2b）+ 新增 M14 结构性守门，
并修出 **D-20**。第五轮直接建在这些断言之上做"断言的断言"。
