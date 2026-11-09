# 音源仓库审计结果总账（AUDIT_RESULTS）

> 本文件是**历轮审计结果的唯一汇总处**。方法论与维度矩阵见 [`AUDIT_PLAN.md`](./AUDIT_PLAN.md)。
> 计划只写"要审什么"，结果只写"审出了什么、修没修、证据在哪"——两者不再混装。

## 0. 三代审计总览

| 代 | 日期 | 范围 | 规模 | 结果 |
|---|---|---|---|---|
| 一代 | 2026-11-05 | 音源 + App 双仓，5 步递进 | 13 项 | 2 中 + 11 低，均已修（原报告归档 `archive/AUDIT_REPORT-2026-11-05.md`） |
| 二代 | 2026-11-07 | 单仓，A~V 组 96 维矩阵 | 96 维 | ⚠️ 15 项，全部修复（v8.10.3，含 T 组巡检专项 13 维、V 组全链路 36 项） |
| 三代 | 2026-11-08 | v8.11.0/.1 交付真实性闸门专项 | 79 + 57 = 136 项 + 压测 12 断言 | 修复 8 个真缺陷（2 严重） |

## 1. 缺陷总账（按发现顺序，含证据与状态）

| 编号 | 代 | 严重度 | 缺陷 | 证据 | 状态 |
|---|---|---|---|---|---|
| D-01 | 一 | 中 | `toggle` 开启未清 `failCache` | 重开源仍命中旧失败缓存 | ✅ v8.10.3 |
| D-02 | 一 | 低 | `reqTimestamps` 初始化依赖 `throttleCheck` 调用顺序 | 顺序耦合 | ✅ v8.10.3 |
| D-03 | 一 | 低 | `config` 写模式无日志 | — | ✅ v8.10.3 |
| D-04 | 二 | **高** | 半开 + 429 → 源永久停用（F-01） | 半开态遇 429 不回 closed 也不回 open，永久卡 half-open | ✅ v8.10.3 |
| D-05 | 二 | **高** | 死键 `raceOverallTimeoutMs` + 真键 `raceBudgetMs` 不在白名单（F-02） | 改配置无效 | ✅ v8.10.3 |
| D-06 | 三 | **严重** | 闸门 5 开关 + 4 阈值不在 `USER_CONFIG` 白名单，`cfg()` 恒返默认 → "可关闭/可回滚"是空话；布尔键用 `\|\|` 把 `false` 吞成 true | `__lxSourceConfig.verifyDelivery=false` 完全无效 | ✅ v8.11.0 |
| D-07 | 三 | 一般 | 死代码 `xinghaiBackendToken`（v8.4 改匿名后零引用） | grep 零引用 | ✅ v8.11.0 |
| D-08 | 三 | **严重** | 单链分支绕过全部预算：`fallbackRace` 在 `chain.length===1` 时直接 `await wrapExecute`，无 deadline | 打点实测 flac 0→20.4s → 320k/128k 跳过 → 末档再 20.4s = **40.8s** | ✅ v8.11.0（补单源硬上限 → 14.0s） |
| D-09 | 三 | **严重** | 65 处 `throw` 只把码写进 message、未赋 `err.code`；`lyric`/`pic` 直连 action 不经聚合 → App 拿 `undefined` | J2/J3/S4 实测 `code=undefined` | ✅ v8.11.1（`normalizeErrCode`） |
| D-10 | 三 | 一般 | 歌词复用 `RETRY_TIMES=1`，5s 超时变 **10.2s** | J5 实测 10207ms | ✅ v8.11.1（`retries=0` → 5005ms） |
| D-11 | 三 | 一般 | 缺 `musicInfo` 的 reject 无 code | S8 实测 `undefined` | ✅ v8.11.1 |
| D-12 | 三 | 一般 | 源级冷却整源跳过 → 连续片段歌时新歌连片段都拿不到 | S9：50 首只交付 2 首 | ✅ v8.11.1（冷却放行 128k） |
| D-13 | 三 | 一般 | 片段兜底缺缓存通道（冷却跳过的歌无 `PREVIEW_FRAGMENT` 证据） | 同 D-12 | ✅ v8.11.1（`hasFragCache`） |
| D-14 | 三 | 一般 | 跨歌冷却证据条件 `qs.size>=3` 在「跳过已知片段源」后几乎不可达 | 打点实测 `qs.size` 恒为 1 | ✅ v8.11.1（改 `>=1`，仍要求 ≥2 首不同歌） |
| D-15 | 三 | 误判（已澄清） | 曾判「冷却未拦住请求」→ 实为**断言判据错**：把 128k 档的「接口+可播校验+探针」3 次 request 当成 3 次接口调用，且要求抛 `RATE_LIMIT`（实际抛 `PREVIEW_FRAGMENT`） | `LXCOOL` 打点：`until` 为未来、flac/320k 确被跳过、`API=1` | ✅ 判据已修正（非代码缺陷） |
| D-22 | 六 | 一般 | `ARCHITECTURE.md` 说"15 个可写键"，实际另有 24 键只读（含 9 个闸门键）——文档口径与代码不符 | 逐键对 `USER_CONFIG` 39 键 | ✅ `44d80fb` |
| D-23 | 六 | 一般 | App `trend` 注释写"上限 60"，音源侧 `HEALTH_HISTORY_MAX` 已是 144 | 跨仓对照 | ✅ App `9c8ea039` |
| D-24 | 六 | **高** | App 一键更新「导新 → 删旧 → 切新」：新源加载失败且无备用时，旧源已被删掉，**回退不了** | 读 `setApiSource` 兜底链 | ✅ App `f9ba9108` |
| D-25 | 六 | 低 | `await setApiSource(...)` 中 `setApiSource` 是同步 void，`await` 只是装饰，读起来像"等切源完成" | 类型声明 `apiInitPromise: [Promise<boolean>,…]` 本就未用 | ✅ App `f9ba9108` |
| D-26 | 六 | 低 | `buildSourceChain` 挂星海备用 `platform !== "kg"`，但映射表 `{wy,tx,kw}` 没有 mg —— mg 每次白 push 一个必败源 | G12a 断言红：`mg 链=[xinghaiBackup]` | ✅ `ee7ebaf` |
| D-27 | 六 | 一般 | **跨仓**：音源抛 12 个 `ERROR_CODES`，App `FAIL_CODE_ZH` 只映射 6 个，且 `NETWORK_TIMEOUT`/`RATE_LIMIT` 两个连码名都不同（App 写 `TIMEOUT`/`TOO_MANY_REQUESTS`）→ `FAIL_CODE_ZH[code] \|\| code` 把英文码直接显示给用户 | 逐码核对：旧代码 9/10 出英文码、新代码 12/12 中文（含反证） | ✅ App `ac89035f`（音源侧仅文档，见报告 §11.4b） |
| D-28 | 六 | **高** | `probeAudioDelivery` 交付体判定裸用 `Buffer.isBuffer(body)` —— App 的 QuickJS 宿主只注入 `lx.utils.buffer`、**没有全局 Buffer**，真机上抛 `ReferenceError` → 被 catch 归一成 `NETWORK_ERROR` → 落进「网络错误拿不准放行」分支，**JSON 假链接被当成功交付**，交付真实性闸门在真机上等于失效 | 删掉 `globalThis.Buffer` 跑交付验真：修复前**放行了假链接**、修复后抛 `NOT_AUDIO` | ✅ 本仓（Q7 断言 + `ArrayBuffer.isView`） |
| D-28b | 六 | 一般 | 同上的**断言空壳**：Q3 判据写成 `typeof Buffer \|\| Buffer.isBuffer`（用「或」）→ 出现裸引用也绿；Q4 里 `origBuf` 定义了**从未真正删除** Buffer，只测「能加载」、没测运行期行为 | 两处都是「看着测过 QuickJS、实际没测」 | ✅ 本仓（Q3 改硬判据、Q4 真删、新增 Q7 行为断言） |

## 2. 结论性事实（可复核，非"看起来对"）

- 断路器 4 态迁移实测通过：连续失败第 4 次起外呼=0，冷却后半开恢复，半开再失败即回 open
- 片段（业务失败）不触发熔断
- 限速窗口 3/2000ms 打满后返回 `RATE_LIMIT`，窗口滑过恢复
- 缓存 505 首写入：最旧被淘汰，重查会重新外呼
- 健康分 0 样本得 `score=0` 无 NaN；业务失败不进成功率分母
- QuickJS 面无 `Object.hasOwn`/`Promise.any`/`fetch`/`AbortController`
- 日志无签名直链、卡密、上游响应体
- `config` 写模式对 9 个闸门键不开放（**有意设计**，只能 `__lxSourceConfig` 注入）
- 闸门开/关对照组：开 50/50 交付且全标「试听版」；关 50/50 放行且 0 标注 → 回滚有效

## 3. 历轮过程记录（原 AUDIT_PLAN.md 后半，按时间保留）

## 4. 统计

- 总维度：**96**（保留 40 + 新增 56）
- 本轮 ✅ 已审无问题：52
- 本轮 ⚠️ 有问题：**15**（二次复核后由 14 增为 15——新增 **F-15** `probeSingleSource` 形参遮蔽 `cfg()`；明细见报告 §0 与 §9）
- 已修复：**15 / 15**（v8.10.3，2026-11-07；逐项改法与验证见报告 §10）
- ⏳ 部分审 / 待深审：12
- 📝 沿用 v8.1 未重跑：15
- 🚫 环境不可达：2

- **T 组专项（2026-11-08 巡检子系统单独审计）**：13 维 → ✅ 5 / ⚠️ 3 / ❌ 5；产出修复清单 7 条（P0×2、P1×3、P2×2）
- **V 组专项（代码级 + 全链路，10 层 36 项）**：✅ 7 / ⚠️ 10 / ❌ 19；与 T 组合并去重后修复清单 **15 条**（P0×4、P1×9、P2×2）

> 计数口径：A 组 19 维逐项复核；B–G 除 Q 相关外按 v8.1 结论沿用；H–S 为本轮新增并逐维判定。

## 5. 执行顺序（下一轮照此跑）

1. **先修高危**（F-01 半开 429 收口、F-02 死键）→ 每条都要 new 一个反向用例并回退验证变红。
2. 再修中危（F-03…F-07），每条附带"改前/改后"指标对比（429 后 `byQuality`、缓存命中率）。
3. 低危合并成一批，不改行为。
4. 最后跑 Q 组镜像同步（版本串、本计划统计、`DEV_GUIDE` 配置表、`README` 状态表）。
5. L4 取链与真机项留待用户在设备网络环境跑 `scripts/source-audit.js` + 播放验证，结论回填 A9/S2。

## 6. 修复记录（v8.10.3 · 2026-11-07）

> 用户授权「按最优方式全修、顺序自定」；15 项全部落代码并已推送（提交 `47f527a`）。逐项改法、代码位置与验证方式见 `AUDIT_REPORT-2026-11-07.md` **§10**，此处只留索引与门禁状态。

### 6.1 修复门禁（三轮验证，全部实跑）

| 门 | 命令 | 结果 |
|---|---|---|
| 语法 | `node --check lx-source.js` | 通过 |
| 项目自检 | `node scripts/self-check.js` | 通过（`@version` / `@description` 首行 / `logInfo` 三处同步 v8.10.3） |
| 官方冒烟 | `node test/lx-source-smoke-test.js` | **57 组全绿，exit=0**（原 49 组 + T50–T55 + v8.10.4 新增 T56/T57） |

### 6.2 新增反向用例（回退必红）

| 用例 | 锁住的行为 | 对应项 |
|---|---|---|
| T50 | 半开 + 429 后 `state === 'open'` 且 `lastFailureTime` 已刷新 | F-01 |
| T51 | huibq 探针**真的发出请求**且 `probeSuccess ≥ 1` | F-15 / F-06 |
| T52 | 降档交付 128k 后，二次请求 flac 必须**重新取链**（不吃 128k 槽） | F-03 |
| T53 | 纯 429 后 `byQuality['128k'].fail === 0`，`rateLimitCount === 1` | F-05 |
| T54 | 只开 `suyinKuwo` 时 tx 分组 `activeCount ≥ 1` 且不误报降级 | F-07 |
| T55 | 带首尾空白的上游 URL 交付时已 `trim` | F-11 |

T46 同步改造：原用 `raceBudgetMs: 1` 依赖「剩余预算恰为 0」，受 `raceBudgetPerQuality` 默认值影响不稳定（320k 预算 4s→5s 后一度交付 320k）；改为显式分档预算 `{flac:1, '320k':1, '128k':5000}` + 保底 3000，语义确定。

### 6.3 未采纳与未做

- **F-12 第二选项**（预算到期不累计熔断）未做：需改 `aborted` 契约，影响面大；先以「单档预算 4s→5s 对齐 `TIMEOUT_CONFIG.parse`」消掉主因。
- **F-09 未砍末档保底**：强制钳到 12s 会让前两档吃满预算时末档 0ms 必败 → 点歌无声。改为口径诚实化（上界显式写成「总预算 + 保底」= 15s，与 `PARAM_LIMITS` 一致）。
- **L4 维度仍 `blocked`**：沙箱出口 IP 被三平台风控，F-06 的「上游真的返回 code=0 + 失败文案」仍来自 v8.7 历史记录，本轮无法现场复现；需真实网络环境跑 `scripts/source-audit.js` 回填 A9/S2。

### S 组 · 语义契约与 action 返回结构（2026-08 之后新增，2026-11-08 补判据）

> 来源：第二轮全覆盖审查。音源侧没有 UI 文案，本组聚焦两件事：
> ① App 对返回值的**语义假设**是否与音源实际返回一致；② 错误是否被静默吞成"空结果"。

### 触发案例（2026-11-08）

听歌统计：侧边栏文案是「今日 {today} 次 · 时长 {time}」，实际传的是累计 `playTime`。
类型全对（都是 number）、40 条文档规则全绿、`check_ts_syntax` 0 错误——**功能是错的**。

### 根因：判据太宽，执行时被简化

原计划里的 i18n / 状态机 / 持久化 组，执行时被落成"键数对不对""字段有没有"，没有落到
"文案说的意思 **vs** 数据实际的意思"。这类缺陷在单文件纵向读时处处自洽，只有横向穿才看得见。

### 三条硬判据（改动 UI 展示 / 统计 / 配置时必须过）

1. **文案 ↔ 字段横向穿**：每个带参 `t()` 填五行表
   `文案键 → 占位符 → 传入表达式 → 字段定义 → 写入点`，任一处语义不符即缺陷。
   易错语义词：今日/累计/剩余/总数/上次/平均/速度/已下载/本次/总时长。
2. **类型正确不算通过**：`playTime` 与 `dayTime` 都是 number，编译器不会警告；
   必须人工确认"这个数字语义上是不是文案要的那一个"。
3. **"改过"不等于"审过"**：注释里的"已修正"只证明被碰过一次，不证明展示层被审查过。

### 三类假阳性（写报告前必须过滤，否则制造假缺陷）

| 假阳性 | 成因 | 过滤方法 |
|---|---|---|
| 文案占位符"缺参" | 脚本不认 ES6 属性简写 `{ name }` | 回读源码确认调用形态 |
| "设置项没人读" | 正则漏 `useSettingValue('...')` / 动态 key | 用短名全仓 grep 复核 |
| "导出零引用=没接线" | 可能是有意保留的上游死代码 | `git log -S '<符号>'` 回查引入提交再定性 |

### 一条跨仓新判据

**依赖版本"落后"不等于"有问题"**：App 锁定 fork sha 落后 9 个提交，需先看这 9 个提交的性质
（本例全为 docs/hooks，零代码变更 → 无风险），不能只比较 sha 差异就判缺陷。

### 本轮实跑结果（作为基线）

- 29 处 `catch` 逐块核对：
  - 多数正确透传（`lastError` 累积 + `mergeLastCode` 结构化）
  - **🟡（2026-11-08 二次复核升级，同日已修复 v8.10.4）** `isAudioPlayable()`（L909）把超时/网络错误一律判"不可播"，
    调用方（L1344 / 1374 / 1617）据此抛 `LINK_EXPIRED`。
    **第一次复核的因果链写错了**（原判"计入 `linkExpired` → 6 小时档位短路"）。实测纠正：那 3 处
    `throw new Error(...)` **只把码写进 message、没有设 `.code`**，而竞速是按 `e.code` 分类的
    （仅 `NETWORK_TIMEOUT`/`NETWORK_ERROR`/`SERVER_ERROR` 调 `recordFailure`，仅 `LINK_EXPIRED` 才写
    `byQuality.linkExpired`），`code === undefined` 一律落 `else` → `recordBusinessFail`。真实后果是**双向失效**：
    1. 超时被当成业务失败 → 不熔断、不冷却，坏源一直挂在链上，每次点歌白跑 2.5s 校验（弱网尤甚）
    2. 410 死链也没被识别成 410 → `linkExpired` 永不计数，档位短路判据 `(fail+linkExpired)>=3` 永远不达标；
       失败缓存也无法按 `LINK_EXPIRED` 走 1 分钟差异化 TTL
    影响面：仅 helloworld（两通道）/ 溯音酷我的对应音质档，其他源仍在竞速链上 → 不会无声，但成功率与耗时变差。
    **修法（v8.10.4 已实施）**：
    ① `isAudioPlayable` 超时/网络异常改为抛出原错误码（`NETWORK_TIMEOUT`/`NETWORK_ERROR`/`SERVER_ERROR`/`RATE_LIMIT`），
       仅 `LINK_EXPIRED` 仍返回 false 判死链 → 超时改走 180s 熔断 + 半开探针自愈
    ② 三处 `LINK_EXPIRED` 抛错补 `err.code = ERROR_CODES.LINK_EXPIRED` → 410 才真正进死链短路与 1min 失败缓存
    反向用例：**T56**（弱网超时不得记 `linkExpired`、必须按网络类计 fail）、**T57**（410 必须记 `linkExpired` 且不熔断），
    均已做 red-green（回退修复 → 对应断言失败；恢复 → 57 组全绿）。
  - ~~btoa 失败 `return ''`~~ → **复核后撤回**：该函数实为 `xinghaiBackendToken()`（L1433），全仓仅 1 处定义、**零引用**（v8.4 已改为不发送自定义 X-Token，注释写明），属死代码，不构成缺陷
- `config` 热更新有上下限校验（`PARAM_LIMITS`）、改熔断阈值重置计数、改 TTL 清缓存 → 正确
- `isAudioPlayable` 仅 3 处调用（L1333/L1363/L1605），均在源内链切换，不污染全局熔断
- 自带测试 `test/candidate-audit-test.js`：**6 通过 / 0 失败**
- 自带测试 `test/lx-source-smoke-test.js`：**57 组全通过**（v8.10.3 时 55 组，v8.10.4 增 T56/T57；mock 宿主，不联网，`assert` 失败即非零退出）
- 补充机械检查：i18n 不可用于音源，改为核对 action 返回字段与 App 消费端一致（见 S 组）


---

## 附：T7 与 F01 残留（v8.10.6，2026-11-08 修复）

用户问「T7 是啥意思」后复查代码，确认两条并修复。

### T7 变化检测基准日取错层级

`health-daily.js` 原实现：

```js
const allDates = [...new Set(entries.map(e => e.date))].filter(d => d <= targetDate).sort();
const prevDate = allDates.length >= 2 ? allDates[allDates.length - 2] : null;   // 全局倒数第二天
```

`prevDate` 对**所有端点**是同一个值。若某端点中间几天缺样本（probe 部分失败、端点新登记），
它拿不到"上次状态"（`lastOk=null`），于是：

- 真正的翻转（可用 → 失败）**不报 🔴**
- 还会掉进 `Math.abs(delta) >= 30` 分支，报成 `🟡 窗口成功率 100% → 50%（-50pp）`
- 读的人只会以为"在缓慢变差"，不知道"这个源已经直接坏了"

**RED 取证**（隔离副本合成历史 `U2: 11-01 可用 / 11-07 无样本 / 11-08 失败`）：

```
## 今日变化
- 🟡 helloworldKw：窗口成功率 100% → 50%（-50pp）     ← 翻转被降级，且不含基准日
```

**修法**：新增 `prevDataDate(entries, url, targetDate)` 按端点各取基准；变化检测、文案、json 全部改用它；
各端点基准不一致时，日报的「对比基准」行显式标注区间（`各端点各自基准（最早 … ~ 最晚 …）`），不再用一个日期冒充全部。

**GREEN 同一场景**：

```
## 今日变化
- 🔴 helloworldKw：2026-11-01 可用 → 2026-11-08 失败（HTTP 502）    ← 翻转被正确捕获
```

**无回归证明**：用真实 `probe-history.jsonl`（20 端点每天全量、基准日唯一）重生成 2026-11-08 日报，
与远端 CI 生成版 **`diff` 为空**（含对比基准行仍是 `2026-11-07`）。

### F01 残留：health-daily 默认日期仍走 UTC

`health-daily.js:194` 的默认值 `new Date().toISOString().slice(0, 10)` 是 UTC。
CI 显式传 `--date $(TZ=Asia/Shanghai date +%F)` 所以线上没暴露；但本地直接跑脚本时，北京 0~8 点会拿到"昨天"。

修法：新建 `scripts/cn-date.js` 导出 `todayCN()`（`Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Shanghai'})`），
`probe.js` 与 `health-daily.js` 共用，日期实现收敛为单一真相。

边界验证（旧写法 vs 新写法）：

| 北京时刻 | 旧(UTC) | 新(北京) | 结论 |
|---|---|---|---|
| 2026-11-09 00:10 | 2026-11-08 | 2026-11-09 | 旧写法差一天 ✗ |
| 2026-11-09 07:50 | 2026-11-08 | 2026-11-09 | 旧写法差一天 ✗ |
| 2026-11-09 08:10 | 2026-11-09 | 2026-11-09 | 一致 |
| 2026-11-09 23:50 | 2026-11-09 | 2026-11-09 | 一致 |

`probe.js --quick` 真实跑通：14/20 可用、历史追加 `2026-11-08`、README 表日期同步 `2026-11-08`。

### 门禁

`self-check` 0 · 冒烟 60 组 0 · candidate 6/6 0 · docs-audit 待处理 0 · health-alert 0（按 CI 位置参数调用）


---

## 附：T2 与 T6（v8.10.7，2026-11-08 修复）

用户追问「剩下这两个没办法修吗」后回代码实测，两条都修掉了。**旧的"修不了"结论有两条是错的**，这里记录更正。

### T2 `anti.s` 的 2xx 语义（原判"需真实上游返回才能定性"）

**实测定型**（同一 URL、同一台机器，只改是否带参）：

| 请求 | 状态码 | 大小 | 正文 |
|---|---|---|---|
| 裸请求（含 `Range: bytes=0-1023`，即 probe 的真实探测方式） | **206** | 6B | `failed` |
| `?type=convert_url&rid=MUSIC_228908&format=mp3&response=url` | 206 | 98B | `https://kw-bj.kuwo.cn/....mp3` |

即：这个接口对**任何**请求都回 206，裸探测拿到的 `failed` 也被 probe 判成"可用"。
历史 35 条样本里 32 条 `ok=true` —— 看着 91% 健康，实际**从未被真正监控过**。

**修法**：`kind` → `payload`，`PAYLOAD_CHECKS` 加带参取链 + 正则 + `rangeOk` 真下载三重校验。
另外给 `appendHistory` 补写 `payload` 字段（v8.10.8）：原先只落盘 date/url/ok/status/time/reason，
`--json` 里的 payload 在写历史时丢失，导致「这次是真带参取链校验过、还是只看了状态码」无法从数据区分。
改后走 `PAYLOAD_CHECKS` 的端点会留下 `"payload":true/false`（实测今日 155 条样本中 6 条带该字段，
端点恰为 anti.s / c.wwwweb.top / oiapi.net / yy.zddyr.top / api.xcvts.cn）。
改后 `node scripts/probe.js --json` 输出 `{"ok":true,"status":206,"payload":true}`。

**一处必须如实说明**：我原以为「用两个不同 rid 兜底，单 id 失效不该判死」，实测发现该接口**根本不校验 rid**
（`rid=MUSIC_000000000` 同样返回真实 URL）。所以双 rid 在这个接口上不产生额外保护，保留仅作无害兜底；
真正的判活依据是"带 `convert_url` 能否返回 URL + 该 URL 能否真取到 Range 字节"。

### T6 窗口口径（原判"按日历日会把整段窗口判死"）

旧结论是在 **F02（no-today）/F03（小样本不进 handle）上线前**得出的。补上这两条规则后再实测：

| 场景 | 有数据日窗口（旧） | 日历日窗口（新） |
|---|---|---|
| 真实完整数据（20 端点每天全量） | 参与判定 10 / 需处理 1 / 变化 2 | **完全相同**（整份日报 diff 为空） |
| 断档 4 天（11-05 起无数据） | 参与判定 0 / 需处理 0 | **参与判定 0 / 需处理 0**（F02 全接管，不会判死）|
| 中间态（11-05~11-07 缺、11-08 有数据） | 17 样本（窗口被拉到 10-29 起，含两周前数据） | **14 样本**（= 7 个日历日里实际有数据的 4 天）|

结论：日历窗口更符合"最近 7 天健康度"的语义，且不会判死。已改。

### 门禁

self-check 0 · 冒烟 60 组 0 · candidate 6/6 0 · docs-audit 待处理 0 · 日报 0 · 告警器 0 · probe 真实跑 14/20（`anti.s` payload 校验通过）

### v8.10.9 `payload` 端点必须配校验实现（fail-closed 断言）

起因：用户追问「留下的数据能证明吗」。实测把 `PAYLOAD_CHECKS` 里 anti.s 的条目删掉（=校验被撤销）后，
probe 对 anti.s 立刻退化回「只看状态码」——206 + 6 字节 `failed` 再次被算作可用（耗时 545ms → 80ms），
而当时 self-check / 冒烟 / docs-audit **全绿**。即：历史数据能证明"这一次跑过校验"，
证明不了"以后被撤销会被发现"。

修法：probe 启动时断言「registry 声明 `kind=payload` ⇒ 必须存在对应 `PAYLOAD_CHECKS` 实现」，
缺失则 `::error::` + `exit 1`（CI 只放行 exit 0/2，因此必然阻断）；另对"有校验但 registry 未声明 payload"
的孤儿校验给 `::warning::`。

**这条断言上线后立刻抓出 4 个既存缺口**（都登记为 payload 却从未配校验，与 anti.s 同一类假绿）：

| 端点 | 裸探测拿到什么 | 真实调用 | 补校验后 |
|---|---|---|---|
| `lxmusicapi.onrender.com`（huibq） | 200 + 文档 JSON（"MusicFree 音源script2"）→ **假绿** | `/url/{platform}/{id}/{quality}` + `X-Request-Key` | ✅ `payload:true`，真取到 mp3 链 |
| `oiapi.net/api/QQ_Music`（suyinQQ） | 403「该Api暂时无法访问」 | 带 key 仍 403（服务维护中） | 判死（真实状态，恢复后可自动真验证） |
| `music-api.gdstudio.xyz`（gdWy） | 连接失败 / 503 网页 | `types=url&source=&id=&br=` | 判死（真实状态） |
| `api.music.lerd.dpdns.org`（juhe×5） | 200 + `<html>200 OK</html>` 空壳 → **假绿** | POST `/{platform}` + JSON body | `PAYLOAD_NO_URL` 判死（识破空壳） |

RED/GREEN：删掉 huibq 的校验 → `probe` 退出码 1 + `::error::payload 类端点缺少取链校验实现`；
恢复后全部通过。门禁：self-check 0 / 冒烟 60 组 0 / candidate 6-0 / docs-audit 0 / 日报 0 / 告警器 0；
日报输出与线上版**完全一致**（juhe 五源为禁用源，不参与判定）。

### v8.10.10 `403`/`429` 分级与自动升级（巡检出口局限）

实测发现：`music-api.gdstudio.xyz`（gdWy）从**上海代理出口**连接失败（000）、从 **GitHub Actions（海外 IP）** 返回 403，
而同一时刻同代理访问 `oiapi.net` 正常 200 —— 说明是目标站按出口 IP/风控拦截，**不是巡检代码判错**，
但也**不能等同于用户在手机上不可用**。

这暴露的是这套巡检的天花板：探测跑在海外云 IP，与国内用户真实网络不同，`403` 会系统性产生误报。

**改法**：
- `403`/`429`（服务器活着但拒绝）先归「观察」，日报备注写明「疑似出口 IP/风控拦截，非必然用户不可用」；
- 设自动升级：**连续失败 ≥ 5 天**，或**成功率 < 20%（样本 ≥ 20）** → 仍回到「需处理」，避免真挂被永久降级；
- 日报首屏增加「巡检出口」说明，读者一眼知道怎么解读 403。

**三场景验证**：

| 场景 | 结果 |
|---|---|
| 真实数据（gdWy 403·2 天·25%） | 需处理 **0** 条；gdWy 落「观察」并标注 403 说明 |
| 合成：连续 5 天全 403（10 样本 0%） | 需处理 **1** 条（重新升级） |
| 合成：403 且成功率 9.5%（21 样本·6 天） | 需处理 **1** 条（重新升级） |

门禁：self-check 0 / 冒烟 60 组 0 / candidate 6-0 / docs-audit 0 / 日报 0 / 告警器 0。

### v8.10.11 探测 id 用 VIP 歌导致「恒定判死」（用户手机实测发现）

用户按提示在手机浏览器打开 gdWy 的探测链接，返回：
`{"url":"","br":0,"size":0,"from":"music-api.gdstudio.xyz"}`
—— **服务活着、请求被受理，但给不出链接**。

回仓库查证，`lx-source.js` 第 207 行注释早就写着：
`// v1.0 (D9)：溯音163 探测免费歌池（实测 code:0 + data[0].url 真实mp3；186016周杰伦VIP无url已排除）`

而 `buildProbeConfig` 里 gdWy 仍写死 `id=186016`（旁边注释「未验证新曲」）。
即：**我给 gdWy 加的 payload 校验，用的是仓库自己已经排除的 VIP 歌**——端点无论好坏都会判死。

**修法**：改用已验证能出真实 mp3 的免费歌 id（`2652820720` / `347230`，同源网易云 id），双 id 兜底。

**改后实测**（本机直连，Node 不走 http_proxy）：
```
gdstudio → {"ok": true, "status": 200, "time": 1068, "reason": "OK", "payload": true}
```
立刻能取到真实链接。

**但必须纠正上一轮的判断**：我当时的结论「403 是巡检出口 IP 被拦、gdWy 可能是误报」**不成立**。
改 id 后继续观察当天样本，**本机直连同样出现 403 / 503**：
`403, 403, 503, 200(payload:true, 4519ms)` —— 说明这个端点本身就不稳定（间歇 403/503、成功也要 4.5s），
日报把它列「需处理」（成功率 25.8%）是**正确**的，不是误报。

因此 403 降级机制保留（对其它可能被地区拦的端点仍有用），但对 gdWy 这类「端点自己返回 403」的情形，
降级条件不触发（当天最后一条成功 → 不算 geo blocked），仍按真实成功率告警。

门禁：self-check 0 / 冒烟 60 组 0 / candidate 6-0 / docs-audit 0 / 日报 0 / 告警器 0。

### v8.10.12 闭环：gdWy 最终默认关闭

改 id 后确认端点本身可用（本机直连 `payload:true` 取到真链），但同时暴露两个客观限制：
1. **按出口 IP 拦截** —— GitHub Actions（海外）今日 12 条样本 **恒 403、0 成功**；本机直连可 200；
2. **配额极紧** —— 官方限 5min/50 次，实测 **75% 的时间都在 403**（配额耗尽）。

结论：留作默认启用不划算（既污染日报、又持续消耗竞速预算），
已于 `39a0fa8` 将 `gdWy` 置为 `false`（默认关闭，需要时手动打开）。

至此 gdWy 这条线闭环：**误判（VIP 歌）→ 修 id → 验端点真实可用 → 发现出口与配额限制 → 默认关闭**。

### v8.10.12 探测素材全量修正（用户要求「全部都修」）

清点 `buildProbeConfig` 里全部写死的探测素材后，逐条给结论（不为了"统一"去动正常项）：

| 端点 | 原探测素材 | 实测 | 处置 |
|---|---|---|---|
| `gdWy` | 网易云 `186016` | 该歌「周杰伦 VIP 无 url」，**永远取不到链接** | ✅ 改为 `2652820720`（`probe --json` 实测 `payload:true` 真出 mp3） |
| `wyOuter` | 写死 `2652820720` | 走 outer 接口 **200 / audio/mpeg / 4.4MB 真可播** | ⏸ **保留写死**：池内 `347230` 同一接口返回 200 但 `content-type: text/html`（不可播），随池轮换会每两轮误报一次 |
| `xinghaiBackend` | 写死「晴天/周杰伦」 | 接口按「歌名+歌手」联合检索 | ⏸ **保留写死**并注明是刻意设计：换成轮换歌名但歌手对不上会直接搜不到，反而制造误判 |
| `suyin163` | `PROBE_163_IDS` 轮换 | 已实测出真实 mp3 | ✅ 保持 |
| `suyinKuwo` | `PROBE_SONG_POOL` 轮换 | 已有双音质分域探测 | ✅ 保持 |

**关键教训（推翻了我自己先前的改法）**：一开始想把 `PROBE_163_IDS` 整池套到 `gdWy`/`wyOuter` 上，实测发现
**同一组"免费歌"在不同端点的适用性不同**（`347230` 对 wyOuter 返回 HTML），照搬会制造新的假故障。
结论：**每个端点的探测素材必须各自实测通过后才可用，不能共用一张池**。

**新增回归保护**：`self-check` 规则 6 —— 直接扫 `buildProbeConfig` 函数体，出现 `186016` 即阻断发布。
红绿已验证：改回 `id=186016` → `[自检失败] buildProbeConfig 又用回 VIP 无效歌 186016`；恢复 → 通过。

版本：`lx-source.js` `@version` 8.10.4 → **8.10.12**（同步 `logInfo`、`@description`、README 版本历史、ROADMAP、DEV_GUIDE 行数基线 2619→2629、App 跨仓引用）。

门禁：self-check 0 / 冒烟 60 组 0 / candidate 6-0 / docs-audit 0。

---

### v8.11.0 闭环：交付真实性闸门（2026-11-08）

用户报告《八千里路明月照》（rid 660878096）显示「音质 FLAC / 音源 helloworld(kw)」但总时长只有 00:05，播到 3 秒弹 VIP。真实网络隔离复现：

| 源 / 档位 | 接口自报 | 1KB 实测真实时长 | 总字节 | 判定 |
|---|---|---|---|---|
| helloworld 通道① flac / 320k / 128k | `duration:5, format:mp3, bitrate:1` | **5.3s** | **84972** | 片段（三档返回同一文件） |
| 溯音酷我 br=9 flac | — | **199.4s** | **3,191,784** → 修复后交付 46,787,765 | 完整版存在 |

根因三层：①`getUrlWithFallback` 末尾 `type: selectedQuality` 是**请求档**不是真实格式；②`raceFirst` 认为「HTTP 200 + audio/mpeg」= 成功，5 秒片段完全满足且回得更快；③`isPreviewFragmentUrl` 对酷我试听链一字不沾，从 v8.0 起是死代码。

修复（六处）：①`verifyDelivery` 交付前 Range 0-1023 字节验真，FLAC STREAMINFO / MP3 Xing 算真实时长，阈值 60% + 15s 双条件；②`deliveryQualityMap` 回填实交付音质；③`buildQualityChain` 修 128k 终档截断；④`verifyOnCacheHit` 校验命中缓存 + 移除 helloworld 内层缓存；⑤`previewCooldownMap` 源级限流识别（同源三档全片段 → 冷却 5 分钟）；⑥巡检同判据。

**关键设计**：探针异常（超时/5xx/DNS）一律返回 `ok:null` **放行**，只有 410/404 判死链。理由：误杀代价是「点歌没声」，比「听到 5 秒」更严重。

验证（真实网络，非 mock）：VIP 歌只开 helloworld → 三档全部 `PREVIEW_FRAGMENT（仅 5.3s，原曲 200s）` 并触发 `该歌三档均只给试听片段 → 判定源级限流`；全链开启 → 溯音交付 199.4 秒 / 46,787,765 字节 / `fLaC` / `audio/x-flac`（独立 curl 解析 STREAMINFO：sampleRate 48000，totalSamples 9,571,385）；免费歌《晴天》269.7 秒 / 55,397,039 字节放行。

版本：`@version` 8.10.12 → **8.11.0**（同步 `logInfo`、`@description`、README 版本历史、ROADMAP、DEV_GUIDE 行段基线、App `docs/MUSIC_SOURCE_GUIDE.md` 标题）。

门禁：self-check 0 / 冒烟 **67 组** 0（新增 T61–T67）/ candidate 6-0 / docs-audit 0 / probe 时长解析自检 4-4。

---

### v8.11.1 压测加固：压测抓出 3 个真缺陷（2026-11-08）

新增固化压测 `test/stress-test.js`（8 组 32 断言，全 mock 零外网，CI 必跑）：G1 档位矩阵（flac24bit/flac/320k/128k/大写/undefined）、G2 30 并发混合档、G3 探针故障注入 14 种、G4 `duration` 为 0/null/缺失/负数/1e9/非数字、G5 2000 首长跑堆增长、G6 全档片段兜底、G7 冷却误伤、G8 缓存命中开销。

首轮压测 30 通过 / 2 失败，两个失败都是**真缺陷**（不是测试环境问题，首版的 23 个失败才是我把 mock 路由漏了音频直链、缓存未隔离造成的误报，已修正后重跑）：

| 缺陷 | 触发路径 | 危害 | 修复 |
|---|---|---|---|
| JSON 错误体被放行 | 音频直链返回 `{"code":403}`（`application/json`）→ `httpRequest` 把 `{` 开头文本自动 `JSON.parse` 成对象 → `sniffAudioBytes` 拿不到字节 → `kind=unknown` → `verifyDelivery` 判「拿不准」放行 | 交付一段 JSON 给播放器 = 点歌没声 | `probeAudioDelivery` 增加：body 是对象（非 Buffer）直接判 `NOT_AUDIO` |
| 源级限流冷却误伤 | 同一首歌三档全片段 → 直接给整个源 5 分钟冷却 | 一首 VIP 歌会让同源其他本可播放的歌一起被跳过（掉音质甚至全失败） | 改为跨歌证据：同源在 5 分钟窗口内对 ≥2 首不同歌都三档全片段才冷却；单曲只记「该歌该源不可用」 |
| 片段兜底可能返回过期签名 | `fragmentUrlMap` 无 TTL，酷我直链是临时签名 | 10 分钟后仍拿旧链兜底 → 用户听到死链 | 记录带 `ts`，兜底前校验 `FRAGMENT_URL_TTL_MS=10min`，过期即删 |

**压测量化结果（修后复跑 32/32 通过）**：30 并发 17ms 完成、未捕获拒绝 0；探针 404/410/HTML/m3u8/JSON 全部拒收，500/503/429/超时/DNS/空 body/无 ct 全部放行（无误杀）；`duration` 六种异常全部不被误判片段；2000 首成功 2000/2000、堆增长 0.9MB（0.5KB/首）；全片段兜底交付 `helloworld(kw) · 试听版`；一完整+其余片段时正确给完整版（不提前兜底）；单曲受限后同源换歌未被误伤。

版本：`@version` 8.11.0 → **8.11.1**（同步 `logInfo`、`@description`、README、ROADMAP、DEV_GUIDE 行段基线 3032→3090、App `docs/MUSIC_SOURCE_GUIDE.md`）。

门禁：self-check 0 / 冒烟 67 组 0 / 压测 32 断言 0 / candidate 6-0 / docs-audit 0 / probe 自检 4-4。


## v8.11.1 全面审计结果（2026-11-08）

9 维度 79 项，全部可复跑（脚本固化在 `test/audit/`）：

| 批次 | 维度 | 结果 | 命令 |
|---|---|---|---|
| 批0/1 | 静态 A1–A7 + 框架 B1–B6 | 12 / 0 | `node test/audit/a-static.js` |
| 批2 | 逻辑与状态机 C1–C10 | 30 / 0 | `node test/audit/b-logic.js` |
| 批3/4/5/8 | 功能 D + 性能 E + 安全 F + 边界回滚 I | 30 / 0 | `node test/audit/d-func.js` |
| 批6 | 运维闭环 G1–G3 | 3 / 0 | 错误码闭环脚本 / probe 阈值比对 / 压测 G7 |
| 批7 | 文档一致 H1–H4 | 4 / 0 | self-check / 行段核对 / 跨仓标题 / CI 步骤 |

**抓到 2 个真缺陷，均已修复**：

1. （严重）闸门 5 开关 + 4 阈值不在 `USER_CONFIG` 白名单 → `cfg()` 恒返默认值，`__lxSourceConfig.verifyDelivery=false` 完全无效，“可关闭/可回滚”是空话。已全部纳入白名单，布尔键改用 `??`（`||` 会把 `false` 吞成默认 true）。
2. （一般）死代码 `xinghaiBackendToken`（v8.4 改匿名调用后零引用），已删除。

**已知边界（记录未修）**：慢源场景单次点歌可达 40s——`raceBudget*` 只约束竞速决策，不取消“已在飞的请求”，每源 5s 超时 × 重试 1 次 + 可播校验 5s 逐档累加。真实源 P95 < 1s 时不触发，仅上游整体抖动时放大。

**待确认语义**：`xinghaiBackup` 的 `platform !== "kg"` 条件（该源是 20 源中唯一在其全部候选平台零外呼者，域名已不可解析、默认关闭，现网零影响）。

### 审计后按决策修复（2026-11-08）

| 项 | 决策 | 结果 |
|---|---|---|
| 慢源 40s | **修** | 根因不是"预算按档"，而是**单源链分支绕过 `raceFirst`**：`fallbackRace` 在 `chain.length === 1` 时直接 `await wrapExecute`，无任何 deadline。打点实测：flac 档 0→20.4s、320k/128k 预算耗尽跳过、末档 floor 再跑 20.4s = **40.8s**。给单链补单源硬上限后 **14.0s**（≤15s 上界） |
| `xinghaiBackup` 语义 | 保留行为 + 显式标注 | 加注释说明"域名不可解析、默认关闭、非 kg 备用胎"，避免误以为可用 |
| 新错误码文案 | 源侧补中文 | 新增 `CODE_HINT`，message 变为「PREVIEW_FRAGMENT: 该曲目只提供试听片段（已尽量给出可用片段）（技术细节）」，code 前缀不变，App 原样展示即可读 |
| `qualityCeilingMap` 持久化 | 不持久化 | 加注释写明取舍：重启后重新探一次的代价远小于引入存储依赖 |

回归：冒烟 67 组 0 / 压测 32 断言 0 / 审计 79 项全绿（12+30+30+3+4）/ self-check 0 / docs-audit 0

## 第二轮全覆盖审计 + 压测重做（2026-11-08）

### 为什么重做
第一轮 79 项**只覆盖了 `musicUrl` 一条链路**。仓库里还有 `lyric`/`pic`/`health`/`toggle`/`probe`/`config`/`trend` 七个 action、断路器、限速窗口、冷启动、质量短路、健康分、LRU 容量、QuickJS 兼容性、定时器泄漏——全部未测。

### 新增 J~T 十组 57 条断言（`test/audit/e-extra.js`，退出码 0）
| 组 | 覆盖 | 结果 |
|---|---|---|
| J | 歌词链路（wy 可用、非 wy 明确 NOT_FOUND、无歌词、emoji、超时、字段） | 6/6 |
| K | 五个管理 action + 未知 action + 只读 action 不外呼 | 8/8 |
| L | 断路器 closed→open→half-open→closed、业务失败不熔断 | 5/5 |
| M | 并发上限、窗口配额、滑动恢复、退避有界 | 5/5 |
| N | successCache 500 / failCache 300 容量淘汰、三档 TTL | 4/4 |
| O | 冷启动上限、预热复用、质量短路开关、playDeadRevive | 5/5 |
| P | 健康分 0 样本不 NaN、排序稳定、快照字段、片段不污染口径 | 4/4 |
| Q | QuickJS 兼容（无 ES2022 独有语法、Promise.race、无 Buffer 降级、不依赖 fetch） | 5/5 |
| R | 定时器残留（正常路径、单链超时、200 次） | 3/3 |
| S | 非法 type / 缺 musicInfo / duration 0·负·1e9 / 未知 platform / 导出面 / 试听版字段 | 7/7 |
| T | 签名直链、卡密、上游响应体不入日志 | 3/3 |

### 本轮抓到并修复的真缺陷（5 个）
| # | 严重度 | 缺陷 | 实测证据 | 修法 |
|---|---|---|---|---|
| 1 | **严重** | 65 处 `throw new Error("CODE: msg")` 只把码写进 message、**没赋 `err.code`**；`lyric`/`pic`/缺参等**直连 action** 不经聚合，App 拿到 `undefined` 无法分类 | J2/J3/S4 三条实测 `code=undefined`；日志显示 `NOT_FOUND` 只在 message 里 | 新增 `normalizeErrCode()`，在 action 出口按 message 前缀归一（不改 65 处，零风险） |
| 2 | **一般** | 歌词接口走 `RETRY_TIMES=1` 重试 → 超时 5s×2=**10.2s**，切歌卡顿 | J5 实测 10207ms | `httpGet` 增 `retries` 参数，歌词传 0 → 实测 **5005ms** |
| 3 | **一般** | 缺 `musicInfo` 的 reject 未赋 code | S8 实测 `undefined` | 显式赋 `PARAM_ERROR` |
| 4 | **一般** | 源级冷却整源跳过 → 连续片段歌时**新歌连片段都拿不到**，与「整站只有片段时给片段」冲突 | S9 压测：50 首片段只交付 2 首 | 冷却期放行 128k 保底档（单档不累积三档证据，冷却不会被延长）→ 实测 **50/50 交付且 50/50 标「试听版」** |
| 5 | **一般** | 片段兜底条件要求本次链上有 `PREVIEW_FRAGMENT`，冷却跳过的歌无该证据 → 兜底不触发 | 同上 | 补 `hasFragCache`：该歌该档已有片段记录时零上游请求也交付 |

### 压测全部重做（`test/stress-test.js`，10 组 12 断言，退出码 0）
| 组 | 场景 | 实测 |
|---|---|---|
| S1 | 120 并发混合（musicUrl/lyric/health） | 120/120 成功，26ms，无未捕获拒绝 |
| S2 | 200 并发 musicUrl | 200/200，22ms，外呼 600 |
| S3 | 单链预算专项 | **14005ms**（≤15s 上界；修复前 40838ms） |
| S4 | 窗口配额 3/2000ms 打满 | 前 3 次 OK，后 7 次 RATE_LIMIT；窗口滑过后恢复 |
| S5 | 熔断雪崩 10 连败 | 外呼 13→0,0,0…（收敛）；冷却后半开恢复 |
| S6 | 缓存写 505 首超容量 | 505/505 成功，3.3s，堆 5.3MB，最旧被淘汰后重查外呼 3 |
| S7 | 3000 次长跑混合 | 8.5s（350 次/秒），堆 5.3→5.6MB（+0.3），Timer 7→7 |
| S8 | 极端参数（5000 字歌名/0/负/1e9/null） | 不崩，空 info=PARAM_ERROR |
| S9 | 闸门开 vs 关对照组（50 首全片段） | 开：50/50 交付且 **50/50 标「试听版」**；关：50/50 按旧行为放行、0 标注 → 回滚有效 |
| S10 | 200 次超时路径定时器 | 50 次=25、100 次=25（请求路径零累积），抬升来自模块重载 interval |

### 二轮遗留项（已定位并修复）
1. ~~源级冷却设置后未拦住请求~~ → **已修复**。加 `LXCOOL` 打点实测：`previewCooldownMap` 里 `until` 是未来时间戳、冷却**一直生效**，flac/320k 确实被拦，只放行 128k 保底档。所谓「外呼=3」是 128k 档的「接口请求 + 可播校验 + 1KB 探针」三次 `request`，**旧断言误把总量当成接口次数**（原判据还要求抛 `RATE_LIMIT`，但 128k 保底档正常返回内容、最终抛的是 `PREVIEW_FRAGMENT`）。
   同时修掉真正的隐患：v8.11.1「跳过已知片段源」让同源同歌首档片段即跳过其余档，`qs.size` 恒为 1，`>= 3` 的跨歌证据条件几乎不可达 → 改为 `qs.size >= 1`（单歌不足以判源级限流，仍要求 ≥2 首不同歌）。
   C9a 判据改为「该源接口至多 1 次调用」，冒烟同步收紧到 `apiCalls.length <= 1`。
2. **`config` action 的 `ALLOWED_KEYS` 只有 14 键**：本轮新增的 9 个闸门键（`verifyDelivery` 等）不在其中，App 设置页无法热改闸门——**有意如此**（防用户误关质检），但需在文档写明仅支持 `__lxSourceConfig` 注入。
3. `xinghaiBackup` 域名不可解析、默认关闭（已加注释标注）。

### 本轮门禁最终态（真实退出码）
`node --check` 0 ｜ 冒烟 67 组 0 ｜ a-static 12/0 ｜ b-logic 30/0 ｜ d-func 30/0 ｜ **e-extra 57/0** ｜ **压测 12/0** ｜ candidate 6/0 ｜ probe 自检 4/4 ｜ self-check 0 ｜ docs-audit 0

## 六、第三轮：全仓覆盖审计（2026-11-08）

前两轮审的是 `lx-source.js` 的行为与边界，**没有一个断言检查过仓库本身**：文档之间的链接是不是死的、脚本能不能被安全 require、开关的键数口径对不对、CI 引用的文件存不存在。第三轮补的正是这一层。

### 6.1 执行面

| 组 | 条数 | 审计对象 |
|---|---|---|
| U 静态合规 | 13 | 全部 tracked 文件：21 个 .js 逐 `node --check`、.md 的 H1（**跳过代码块内 `#` 注释**）、BOM/CRLF、TODO、`/tmp` 硬编码、明文 40 位密钥、console 残留、json/jsonl 可解析、YAML 无 Tab、无空文件 |
| V 交叉引用 | 8 | 20 个 .md 的相对链接逐个验在否、`@version` 三文档一致、冒烟组数/开关数/错误码数、文档引用的脚本与测试文件是否存在、归档目录 |
| W 脚本自洽 | 9 | 4 个脚本退出码、登记表 20 条 url 唯一且字段完整、开关解析、北京日期、doc-sync 映射路径、hook 语法 |
| X 功能联动 | 9 | 片段码对齐、日报字段↔README_HEALTH、candidate-status 格式、候选名单两处一致、**解析值与源码默认值逐键比对**、docs-audit 规则数、CI/workflow 引用文件、兜底层 |
| Y 残留死码 | 6 | 重复函数、只定义不用的常量、debugger、错误码使用率、未用 let、导出面 |
| Z 资源启动 | 5 | 加载耗时、重复加载堆增长、导出面项数、非法入库文件、超大文件 |

### 6.2 抓到的真问题（已修）

| 编号 | 缺陷 | 严重度 | 证据 | 状态 |
|---|---|---|---|---|
| **D-16** | `scripts/doc-sync-map.js` 顶层写 `process.exit(main())`——**任何脚本 require 它，自己就会被 `exit(0)` 杀掉**。f-repo 跑到 W8 时表现为"输出突然截断、退出码 0、X/Y/Z 三组 24 条断言从未执行" | 高（静默吞掉后续测试） | `node -e "require('./scripts/doc-sync-map.js');console.log('after')"` → 只打印 `before`，无 `after`，rc=0 | 已修：加 `require.main === module` 守卫 + 导出 `main` |
| **D-17** | `lx-source.js` 三个死常量：`RACE_OVERALL_TIMEOUT_MS=6000`、`RACE_MATCH_WAIT_MS=600`、`XINGHAI_BACKUP_API`，各只出现 1 次（仅定义）。v8.10.3 删的是**配置键** `raceOverallTimeoutMs`，常量本体漏删 | 中（维护误导：改它不生效） | `grep -c` 各得 1 | 已删，3139→3136 行，DEV_GUIDE/ARCHITECTURE 基线同步 |
| **D-18** | README 两条链接指向 `docs/AUDIT_REPORT-2026-11-07.md` / `docs/AUDIT_PROGRESS-2026-11-07.md`，这两个文件本轮已 `git mv` 进 `docs/archive/` → 死链 | 中 | V1 首跑直接报出 | 已改指向 archive |
| **D-19** | `SOURCE_TOGGLES` 键数口径：`grep -c '^\s+\w+:'` 数**行**得 16，真实是 **20 个键**（`juheKw/Tx/Wy/Kg/Mg` 五源写在同一行）。此前多份文档写"16 键"或"20 键"混用 | 中（统计口径） | `parseToggles()` 返回 20 键；源码该行含 5 个键 | 判据改为以 `parseToggles` 解析值 20 为准，V4/X5/W6 三处统一 |

### 6.3 我自己写错的判据（已改判据，未放宽标准）

| 编号 | 原判据 | 为什么错 | 改法 |
|---|---|---|---|
| U3 | 正则 `/^# /` 数 H1 | `docs/AGENTS.md` 等文件里的 `# 语法检查` 是 **bash 代码块内的注释** | 跟踪 ``` 围栏状态，跳过围栏内行 |
| U9 | 抓所有 `console.log/error` | `lx-source.js` 的 `console.log.bind(console)` 是 `logInfo` 的**宿主降级通道**（QuickJS 无 console 时的兜底），不是调试残留 | 排除 `bind(console)` 行 |
| W5 | 用 `e.id || e.key` 查唯一 | 登记表真实字段是 `url/sources/kind/note`，**没有 id** → 全取到 undefined，去重后只剩 1 | 改按 `url` 唯一 + 字段完整性 |
| W6 | 找 `getToggles` | 导出名是 `parseToggles`，且返回 `{toggles:{...}}` 包裹层，直接 `Object.keys(raw)` 只得 2 键 | 取 `raw.toggles`，断言 20 键 |
| W7 | 找 `today` | 导出名是 `todayCN` | 改调用 `todayCN()` |
| Y6 | `module.exports = {…\n};` | 真实结尾是缩进 2 空格的 `  };`，正则不匹配 | 放宽为 `\n\s*\};` |
| Z1~Z3 | 直接 `require('lx-source.js')` | 顶层会解构 `globalThis.lx`，无宿主时 TypeError | 注入最小 lx mock（EVENT_NAMES/request/on/send/utils/env/version）再 require |

### 6.4 第三轮压测：`test/stress-round3.js`（T1~T12，全新写，不复用 S 组）

S 组压**量**（并发数、容量、长跑、极端参数）；T 组压**态**——状态机相互作用、跨模块联动、配置生效时机、多档预算。**首跑 9 通过 / 3 失败**，三条全部定位为**我自己的判据错**（不是产品缺陷），改判据后 **12 通过 / 0 失败，rc=0**。

| 组 | 压的是什么态 | 实测结果 |
|---|---|---|
| T1 | 三档全超时是否守 12s 总预算（**不累加**） | 11010ms < 12000+3000，`NETWORK_TIMEOUT` |
| T2 | 同源 2 首不同歌全片段 → 源级冷却；第 3 首仍放行保底 | 前两次 `PREVIEW_FRAGMENT`，第 3 次外呼 **显著减少但仍 >0**（没锁死） |
| T3 | 同一首歌重复片段**不**触发源级冷却（证据需 ≥2 首不同歌） | 不冷却，符合设计 |
| T4 | 同一 mid 100 并发：外呼次数有界 | 成功 100/100、耗时 16ms、外呼 300 次（≤ 最差 100×3） |
| T5 | 片段→完整版翻转：首次标「试听版」，恢复后真实版**且不残留标注** | 首次标试听版 / 第二次真实版 |
| T6 | 闸门 8 组合矩阵（verifyDelivery × fragmentFallback × truthfulQuality） | 开闸门片段必被识别（5 标 0 拒）；关闸门按旧行为放行（5 交付）→ **回滚真实有效** |
| T7 | `config` 热更新：开放键立即生效；闸门键按设计拒绝远端改写 | `cacheTtlMs` 写入即生效；`verifyDelivery:false` 被拒（9 个闸门键**不开放**是设计） |
| T8 | 12 个错误码逐个：对外值齐备、网络/业务两类注入都带 code | 12 码齐备；`NETWORK_ERROR` 两类都归一正确 |
| T9 | `probe` 与 30 个 `musicUrl` 并发不互锁 | 探测正常跑、取链 30/30 |
| T10 | 写入 4000 首（容量 500）堆增长有界 | 堆 5.5→5.8→6.1MB（+0.6，不随写入线性膨胀） |
| T11 | flac/320k/128k 交替 300 次无档位串槽 | flac=100 / 320k=100 / 128k=100 |
| T12 | kw 源持续失败时 wy 源不被牵连（熔断不跨源污染） | wy 成功 10/10 |

### 6.5 T 组首跑三条失败：全部是判据错（已记原判据为何错）

> **6.5.1 二次修正（本轮追加）**：T2/T3 第一次改法仍然不够硬，已再次收紧。
>
> - **T2 原改法 `a3 < a1 && a3 > 0` 鉴别力不足**：它无法区分「冷却拦了 flac/320k」与「本地限速拦了」——两者抛**同一个** `RATE_LIMIT` 码。
>   实测证明**是冷却**（`fresh()` 默认就把 `rateWindowMax` 放宽到 1e6、`rateWindowMs` 到 3600000，本地限速根本不参与；
>   第 3 首真实 message 为 `RATE_LIMIT: 音源[溯音酷我]判定为源级限流`，出自冷却分支 L2448，而非限速分支 L2463 的「触发并发/限速保护」）。
> - **现判据（三条同时成立）**：①前两次必须 `PREVIEW_FRAGMENT`；②第 3 次文案必须命中「判定为源级限流」且**不得**命中「限速保护/限流保护」；③第 3 次外呼 / 第 1 次外呼 = **1/3**（误差 0.02）且 > 0。
>   实测：外呼 **9 / 6 / 3**，比值 **0.3333** —— 精确等于「三档砍到一档」，同时证明没有锁死。
> - **T3 原判据是恒真空断言**：`m.previewCooldownMap` 不在导出面，读到 undefined → `Object.keys(...)` 恒为 0 条 → `n===0` **永远成立**。
>   现改为行为断言：同一首歌连续 3 次片段，三次都必须还是 `PREVIEW_FRAGMENT`，且**不得出现**「判定为源级限流」。
> - **反向验证（red-green）**：把源码冷却分支临时改成 `if (false && …)` → T2 变 **✗**、外呼 9/9/9、比值 1.00、`rc=1`；还原后 `md5` 与原文件逐位一致（`3894f40e…`）、`node --check` 通过。
>   这证明该断言**能真的抓到冷却失效**，不是碰巧为真。
> - **结论**：两个关于限速的改动方案（调大 `rateWindowMax` / 限速只作用于探测请求）**均不做** —— 前提就错了，限速从未参与。

> **6.5.2 第三条修正：U6 的两类假阳性（本轮追加）**
>
> 文档补章后复跑 f-repo，U6 变红，报 `docs/AUDIT_MATRIX.md(1),AUDIT_PLAN.md(1),AUDIT_RESULTS.md(1),TESTING.md(1),f-repo.js(6)`。查下来是**两类假阳性叠加**：
>
> 1. **描述性提及被当违规**：U6 原判据对 `.js`/`.md` 全文匹配待办标记词，而这些文档里恰恰在写「无 XXX」这条规则——规则本身的说明文字被判定成违规。
> 2. **脚本自指**：`f-repo.js` 自己就是判据实现，源码里必然出现这 3 个字面量（正则 + 断言标题），于是**永远报自己 6 次**。
>
> **修法**：①`.js` 保持全文匹配（代码里的待办标记是真问题）；②`.md` 只认**行首**的待办条目（`^[ \t]*(?:[-*][ \t]+)?(标记)\b`，排除表格与句中提及）；③标记词改用 `['TO'+'DO','FI'+'XE','XX'+'X'].join('|')` **拼接构造**，让脚本自身源码不再出现该字面量。
>
> **red-green**：往 `docs/CHANGELOG.md` 插一行真待办条目 → **rc=1**，且**只报 `docs/CHANGELOG.md(1)`**、不再误报自己；删掉后 → **rc=0**、50/0。修前修后都实测了退出码。
>
> **教训**：任何「文件里不得出现 X」的检查，都要同时处理两种情况——**被检查对象正在描述这条规则**，以及**检查脚本自身包含 X**。只做全文匹配，这两类必然假阳性。

| 组 | 原判据 | 为什么错 | 改法 |
|---|---|---|---|
| T2 | 直接读 `previewCooldownMap` 的 key 数，场景开 `fragmentFallback:true` | ①`previewCooldownMap` **不在导出面**（19 项导出里没有它），只能读到 undefined→永远 0 条；②`fragmentFallback:true` 时片段被**兜底成成功交付**，根本不抛 `PREVIEW_FRAGMENT`，也就不记证据、不冷却——这是**设计一致**的行为 | 关掉 `fragmentFallback` 让片段真被拒收；再按 6.5.1 收紧为「分支文案 + 1/3 外呼比」 |
| T7 | `info:{config:{verifyDelivery:true}}`，期望热更新后识别片段 | `config` 写模式读的是 `info` **本身**（`Object.keys(info).length !== 0` 即进写模式），传 `config` 会被当未知键 `continue` 跳过；且 `verifyDelivery` 等 **9 个闸门键不在 `ALLOWED_KEYS`**，远端根本改不了 | 用开放键 `cacheTtlMs` 验热更新立即生效；另加一条断言「闸门键写入被拒（符合设计）」 |
| T8 | 认为 `CODE_HINT` 是 12 码全表，从源码数出 12 条 | `CODE_HINT` 实为 **3 条**（`PREVIEW_FRAGMENT/NOT_AUDIO/STREAM_PLAYLIST`），是对最需要解释的 3 个码的**补充说明**，不是全表；12 个码的对外值本身就是稳定英文标识 | 断言改为：12 码对外值齐备 + 网络/业务两类真实注入都带 `code` |
| T3 | 沿用 T2 的 `fragmentFallback:true` | 同上，片段被兜底 → 不记证据 → 「不冷却」恒真，等于**空断言** | 见 6.5.1：改行为断言，禁出现冷却文案 |

### 6.6 最终态

- `node test/audit/f-repo.js` → **50 通过 / 0 失败，rc=0**
- `node --expose-gc test/stress-round3.js` → **12 通过 / 0 失败，rc=0**
- 覆盖矩阵见 [`AUDIT_MATRIX.md`](./AUDIT_MATRIX.md)：**58 个 tracked 文件 / 14100 行（第三轮时点口径；第四轮后 63 / 15107），未覆盖文件 0**
- 本轮**不 commit、不推送**（用户明确）

## 七、第四轮：元审计（审审计本身，2026-11-08）

> 起因：用户明确表达对代码质量的不信任——「写代码非常容易失误、容易写错、判断出问题、修复还能修复错」。
> 计划原文见 [`audit-plans/round4.md`](./audit-plans/round4.md)。前三轮审的是**仓库**，本轮审的是**审计体系**。

### 7.1 三个靶子与落地情况

| 靶子 | 组 | 状态 |
|---|---|---|
| 断言可信度：会不会有本来就永远为真的断言 | M（`test/audit/g-meta.js`，12 条） | **已落地，12/0，rc=0** |
| 修复正确性：回退某个修复，断言会不会红 | N（D-01~D-19 回退） | 未开始 |
| 未覆盖代码：哪些行从没被测试执行过 | O（V8 原生覆盖率） | 未开始 |

### 7.2 本轮抓到的真问题

**（1）10 处「写死 true」的伪断言——前三轮"全绿"里最隐蔽的一类**

| 脚本 | 条目 | 原写法 | 问题 |
|---|---|---|---|
| `a-static` | A5 空 catch | `rec(..., true, ...)` | 计数永远是"允许"，不构成任何结论 |
| `a-static` | A6 `.then` 候选 | `rec(..., true, ...)` | 同上 |
| `a-static` | B1 调用点一致性 | `rec(..., true, ...)` | 全仓 `request(` 只有 1 处，天然成立 |
| `e-extra` | M1 并发 | `rec(..., true, ...)` | 从没验证过"两路都有明确结果" |
| `e-extra` | M4 退避 | `(typeof m4r === 'number' \|\| true) && total() >= 0` | **表达式恒真** |
| `e-extra` | L3/M5/N3/N4/O2/O4/P2 | 占位 / 依赖其他条 / 静态确认 | 不独立构成断言 |

改造：`a-static` 与 `e-extra` 各新增 `note(id,name,detail)`——输出 `·`，**不计入通过/失败**，只登记事实。A5/A6、L3/M5/N3/N4/O2/O4/P2 降为 note；**B1 与 M1、M4 改成真判据**：

- B1：外呼只允许一个物理发起点，且必须落在 `httpRequest` 函数体内——将来有人裸调 `lx.request` 会立刻变红
- M1：并发上限=1 时两路都必须有明确结果（成功带 url，失败带 code），不许"返回了但既没 url 也没 code"的静默空转
- M4：失败 3 次后立即重试，外呼必须 = 0（退避真的存在）

**（2）M9：2 处顶层 `process.exit` 无守卫**

`test/audit/f-repo.js` 与新建的 `g-meta.js` 都是顶层 `process.exit(...)`——任何脚本 require 它们就会静默截断调用方（与 D-16 同类）。已各加 `if (require.main === module)` + `module.exports`。修后 19 个脚本全部安全。

**（3）M1 抓出的条目变红后，先定性再改判据**

M1 改成真判据后首跑红：`r1=LINK_EXPIRED r2=RATE_LIMIT；总外呼=12`。隔离复现四组：

| 场景 | 结果 |
|---|---|
| 单路，scene 对所有 URL 返 JSON | LINK_EXPIRED（外呼 12） |
| 单路，scene 对音频直链返音频 | 成功（外呼 3） |
| 双路（同上修正） | 一路 OK + 一路 `RATE_LIMIT`（外呼 3） |
| 双路 `maxConcurrency=1e6` | 两路都 OK（外呼 6） |

**单路也红 ⇒ 不是并发自锁**；根因是 mock 违反了「非 binary 探针也走 `request`，scene 必须对音频直链返回音频」。修正场景后转绿——**这是一次假阴性，不是产品缺陷**，记下来避免下一轮重复踩。

### 7.3 本轮我自己又写错的判据（5 处）

| 条目 | 首跑现象 | 真因 | 修法 |
|---|---|---|---|
| M2 | 报 2 处空壳断言 | 正则刮到工具函数里的 `typeof global.gc === 'function'` | 只查含 `assert(` / `throw new Error` 的行 |
| M4 | **报绿**但实际解析出 0 项 | 导出块结尾是缩进 `  };`，正则要求 `\n};` | 改 `\n\s*\}\s*;?` + 「解析 0 项即判失败」自检 |
| M6 | 把 `raceMatchWaitMs` 当死键 | 它是**活键**（默认值/读取/白名单/上限四处都在），死的是同名**常量** | 剔出名单；死键名拼接构造；只扫三个语义位置 |
| M1（自指） | 报 `g-meta.js:37,37,51` | 脚本自己的注释与断言标题就写着被检文本 | 注释改写 + 正则拼接构造 |
| M7/M12 | 缺 g-meta 登记 / `candidate-audit-test.js` 无 `[ID]` | 文档没同步 / 输出格式不含 ID | 补 `TESTING.md` 入口行；`test()` 拆出 `[ID]` |

### 7.4 一个口径漏洞：计划文件根本没进 git

核查 `git ls-files docs/audit-plans` = **0**——`round1~3.md` 上一轮只写进了工作区，**没被提交**，文档却写着"已并入仓库"。本轮把 `round1~4.md` 一并纳入提交才真正成立。

### 7.5 第四轮门禁最终态（真实退出码）

- `node test/audit/a-static.js` → **10 通过 / 0 失败（+2 note），rc=0**
- `node test/audit/e-extra.js` → **55 通过 / 0 失败（+7 note），rc=0**（含 O 组补的 U500~U403 五条）
- `node test/audit/f-repo.js` → **50 通过 / 0 失败，rc=0**
- `node test/audit/g-meta.js` → **12 通过 / 0 失败，rc=0**
- 覆盖矩阵：**63 个 tracked 文件 / 15107 行，未覆盖 0**

## 八、第四轮 O 组：V8 原生覆盖率（谁从来没被执行过）

用 `NODE_V8_COVERAGE` 跑全部 10 个入口（smoke / a-static / b-logic / d-func / e-extra / f-repo / g-meta / stress-test / stress-round3 / candidate-audit-test，全 rc=0），采集 39 份 coverage json（3.0M）。

判定口径（**本组第一版与第二版都写错过，第三次才定**）：**不能用「包含该行的任意 range」**——外层全文件 range 的 count>0 会把所有行判成已执行（首版就得出「未执行 0 行」的假结论）。正确做法是取**覆盖该行行首 offset 的最内层（最窄）range** 的 count。

### 8.1 数字

| 口径 | 可计行 | 未执行 | 占比 |
|---|---|---|---|
| 严格口径·**正确算法**（按单份 coverage 实例独立判定后取并集） | 1811 | **142** | **7.8%** |
| ~~初版~~（跨 39 份 json 混算最内层 range） | 1811 | ~~829~~ | ~~45.8%~~ ❌ 作废 |

**为什么 45.8% 是错的**（本轮第三次栽在口径上，必须记下来）：

把 39 份 json 的 ranges 全部混进一个池子，再对每行取「最窄 range」——不同进程实例对同一段代码可能生成**不同粒度**的 range（一个实例把它并进外层大 range 且 count>0，另一个实例有更窄的子 range 且 count=0）。混算后「最窄」会选中那个 count=0 的子 range，于是**别的实例明明执行过的行被判成未执行**。39 份混算把误差累积成 5.8 倍虚高。

正确做法：**每份实例各自判定已执行行，再把各实例结果取并集**。修正后基线未执行 **142 行 / 7.8%**；加入 H 组后 **125 行 / 6.9%**（-17 行）。

这个修正直接影响结论：前三轮测试的真实覆盖面是 **92%**，不是 54%。原「115 个函数有未执行行」也随之作废——实际未执行集中在 `round=12`、`startHealthCheck=9`、`parseMessageSongInfo=8`、`truthQ=8` 等 12 个函数。

### 8.2 三分类（决定「补不补」）

**① 纯兜底/防御（可接受，不补测）**：`buildProbeConfig`（84 行，给每个源写死探针配置，只有对应源被探测才走到自己那段）、`canExecute` 返回 false 的分支、`getSourceStats`/`getHealthSnapshot` 的展示兜底。

**② 真实可达但没测（真缺口，本轮重点）**：

| 函数 | 未执行行 | 具体没跑到的内容 |
|---|---|---|
| `httpRequest` | 22 | HTTP 500 / 429 / 410 / 404 / `>=400` 五个错误分支——**错误码映射半边从未被测** |
| `truthQ` | 34 | 音质协商降档日志、`noteQualityCeiling`、`mergeLastCode`+`e.detail` 数组展开、`successCache.getExpired` 过期缓存兜底 |
| `verifyDelivery` | 21 | 放行分支、`probe.code` 透传 throw、playlist/html/json 三类非音频判定、`verifyMinOriginalSec` 时长闸门 |
| `realQuality` | 20 | 实交付音质回填 `deliveryQualityMap.set`、半开试探被本地节流拦下退回熔断、`recordRateLimit`、`NETWORK_TIMEOUT` 分支、`qStat.linkExpired` 计数 |
| `sniffAudioBytes` | 18 | 空 body 分支、`<html`/`<!DOCTYPE` 判定、MP3 Xing 时长反算、bitrate 回填、收尾 `return out` |
| `recordBusinessFail` | 12 | **整函数从未被调用**：版权失败计数、`q.req++/q.businessFail++`、半开→重新熔断 |
| `normalizeDurationSec` | 36 | 时长归一的大部分输入形态（`m:ss` / 纯秒 / 带单位） |
| `normalizeKeyword` | 33 | 关键词归一的大部分形态（繁简 / 符号 / 全半角） |
| `getUrlWithFallback` | 16 | 两个 `PARAM_ERROR` 抛出（无效平台 / 无效歌曲信息） |

**③ 未启用源整条处理链（开关打开才会走到，但仍属未测）**：`juheGetUrl` 35、`helloworldKwGetUrl` 21、`xinghaiBackendGetUrl` 20、`suyinQQGetUrl` 19、`kuwoOfficialSearch` 16、`lingchuanGetUrl` 15、`gdWyGetUrl` 14、`suyinMiguGetUrl` 14、`kuwoPicSearch` 14。这些源默认 `false`，全部测试只开 `suyinKuwo`——**一旦用户手动打开某个源，那条链路是零验证的**。

### 8.3 本轮因覆盖率补的断言（e-extra U 组）

挑第 ② 类里最危险的一项落地：`httpRequest` 五个状态码分支零执行，而「throw 时忘了给错误对象赋 code」是本仓反复出现的缺陷类型。按真实状态码注入，验证**码型正确 + 错误对象真的带 `code`**：

- U500 → `SERVER_ERROR`、U410 → `LINK_EXPIRED`、U404 → `NOT_FOUND`、U429 → `RATE_LIMIT`、U403 → `NETWORK_ERROR`
- 结果 **5/5 通过**，`e-extra` 由 50 条升到 **55 通过 / 0 失败**

过程中又抓到**自己判据的一处错**：U429 首跑红，因为 429 的文案是「被限流」而非「HTTP 429」——判据假设错了，不是产品缺陷。改 hint 后转绿。与 7.2 的 M1 同类：**先定性、再改判据**。

### 8.4 结论

「三轮全绿」实际覆盖 **92.2% 的有效代码行**（修正口径后；初版误算成 45.8%），且集中在 `suyinKuwo` 单源 happy path。覆盖率数字**不用于设阈值**（设阈值会诱导后续写空壳断言凑数），只作为缺口地图：上表第 ② 类是下一轮靶子，第 ③ 类应随「开关打开」补最小用例。

## 九、第四轮 N 组：修复有没有回归保护（red-green 抽样）

方法：把已修好的代码**故意改回缺陷态** → 跑对应门禁 → **必须变红**；再 `git checkout` 还原 → 跑**必须变绿**；并核对 `lx-source.js` md5 与改前一致。只跑一次绿无法排除「断言恒真」，红→绿才是断言真的在守。

| 抽样 | 对应修复 | 注入的回退 | 回退态 | 还原态 |
|---|---|---|---|---|
| U410 | 本轮 O 组新补的状态码断言 | 410 分支错误码 `LINK_EXPIRED` → `SERVER_ERROR` | e-extra **54 / 1，rc=1**（U410 红，`code="SERVER_ERROR"`） | **55 / 0，rc=0** |
| I5 | 第二轮「交付真实性闸门可关闭」修复 | 删掉 `if (!cfg("verifyDelivery", true)) return null;` | d-func **rc=1**（I5 红：开/关结果相同，说明开关失效） | **30 / 0，rc=0** |
| M9 | 本轮「顶层 `process.exit` 无守卫」修复 | 去掉 `f-repo.js` 的 `if (require.main === module)` | g-meta **rc=1**（M9 红，点名 `f-repo.js`） | **12 / 0，rc=0** |

三次注入后 `lx-source.js` md5 均为 `3894f40e…`，`git status` 干净（未污染工作区）。

结论：这 3 类修复**都有真回归保护**。其余 D-01~D-19 未逐条回退（成本高），但方法已验证可复用，列为下一轮可选项；**没有做逐条回退的缺陷，只能说「有断言覆盖」，不能说「有回归保护」**——这两件事不能混。

## 十、第四轮 H 组：把「从没开启过的源」真的打开一次

O 组扫出 9 个源的取链函数有 15~35 行从未执行，原因是全部测试只开 `suyinKuwo`。这意味着：**用户手动打开某个源时，那条链路一次都没被验证过。**

新增 `test/audit/h-toggles.js`（H1~H14）：每条只开目标源（关掉其余全部），mock 按该源真实响应形状返回，断言「拿到 https 直链 + `subSource` 透出正确」。

| ID | 源 | 平台/音质 | 结果 |
|---|---|---|---|
| H1 | helloworld(kw) | kw/128k | ✓ |
| H2 | 星海后端 | kw/flac | ✓ |
| H3 | 酷我官方直连（搜索→convert 两跳） | kw/128k | ✓ |
| H4~H8 | Juhe 聚合 kw/tx/wy/kg/mg | 各平台/128k | ✓ 5/5 |
| H9 | 聆川 | kw/128k | ✓ |
| H10 | GD Studio(网易) | wy/flac | ✓ |
| H11 | 溯音QQ | tx/128k | ✓ |
| H12 | 溯音咪咕（含歌名/时长校验） | mg/128k | ✓ |
| H13 | 酷我封面（pic action 的 `hts_MVPIC`） | kw | ✓ |
| H14 | 星海备（域名不可解析） | kw | ✓ 明确 `NOT_FOUND`，不伪装直链 |

**14 通过 / 0 失败。**

### 10.1 一次全绿不算数，做了反向验证

14 条首跑全绿，按本轮规矩必须排除「恒真空断言」。注入三处回退：

- H1 把上游 `code` 从 200 改成 403 → **红**（`NOT_FOUND: 所有源均失败`）
- H4 把 Juhe(kw) 返回改成 `code:500` → **红**
- H13 把封面清单改成 `abslist:[]` → **红**

三条全红后再还原 → 14/0。断言确实在守，不是写死绿。

### 10.2 新脚本被元审计当场抓了两条

- **M7 红**：`TESTING.md` 入口表没登记 `h-toggles.js`（新增测试脚本必登记，否则等于没人知道它在跑）
- **M12 红**：输出用的是 `[${r.id}]`，判据要求 `[${id}]`；改脚本统一成 `id` 局部变量后通过（**改脚本，不放松判据**）

修后 `g-meta` **12 通过 / 0 失败**。这条链路本身就是元审计的价值：新脚本不可能绕过既有约定悄悄进仓库。

### 10.3 结论

这 14 条把 O 组第 ③ 类缺口从「零验证」补到「打开就有一条最小用例守门」。它证明的是**这些源的取链协议在当前 mock 下是通的**，不等于线上真实可用（线上可用性仍需 `probe`/巡检判定）；但把「代码写错了却没人发现」这一层关掉了。


## 十一、方案对比实验：补用例 vs 逐条回退，哪个更值

用户要求「先真实验证两个方案哪个更好，再决定做哪个」，因此不按印象选，按同一把尺子量。

### 11.1 方案 2（补未测源用例）的收益：可量化，但量出来很小

用 `NODE_V8_COVERAGE` 跑同一套 10 个入口建基线，再加入 `h-toggles.js` 重跑：

| 状态 | 实例 | 有效代码行 | 未执行 | 占比 |
|---|---|---|---|---|
| 基线（10 入口 40 份） | 9 | 1811 | 142 | 7.8% |
| 加 H 组（+1 份） | 10 | 1811 | **125** | **6.9%** |

**净收益 −17 行（相对 −12%）**。且 `suyinMiguGetUrl`(7 行)、`kuwoOfficialSearch`(6 行) 直接从未执行榜上消失——这两个源的取链被真正点亮。

代价：1 个脚本 187 行 / 14 条 mock 场景。**产品缺陷发现数：0**（14 条全绿）；流程问题发现数：2（M7 未登记、M12 输出 ID 格式）。

结论：方案 2 扩大的是**「被验证的面积」**，不是**「已有断言的可信度」**。它证明「这些源按当前 mock 形状能出链」，但连一条产品缺陷都没抓到——说明这些源本来就没写错，补测只是把已知正确的代码纳入门禁。

### 11.2 方案 1（逐条回退抽样）的收益：直接检验「修了守不守得住」

抽 4 条已修缺陷，把代码改回缺陷态 → 门禁必须红 → `git checkout` 还原 → 必须绿：

| 缺陷 | 回退内容 | 注入态 | 判定 |
|---|---|---|---|
| D-12 | 冷却条件去掉 `&& !is128k`（恢复「整源跳过」） | T2 **红**（`冷却分支只放行 128k` 断言生效） | ✅ 有真保护 |
| D-11 | 删缺 `musicInfo` 的 `paramErr.code` | S8 **红**（`极端参数有明确码`） | ✅ 有真保护 |
| D-09 | 删 `httpRequest` 500 分支的 `error.code` | **全绿（未变红）** | ⚠️ 见 11.3 |
| D-18 | README 改死链 | 锚点未命中（链接格式与预期不同） | 未计入 |

**3 条有效抽样中 2 条红、1 条未红。**

### 11.3 D-09 未变红，但结论不是「没保护」，而是「保护是脆的」

`U500` 断言检查「对外 `e.code === 'SERVER_ERROR'`」。回退后仍绿，原因是 `normalizeErrCode`：

```
const hit = Object.keys(ERROR_CODES).find(k => msg.startsWith(k + ":"));
err.code = hit || fallback || NETWORK_ERROR;
```

它**按 message 前缀回填 code**。所以删掉 `error.code` 赋值后，只要 message 还是 `SERVER_ERROR: HTTP 500`，对外 code 就会被补回来。

这暴露一个真问题：**错误码契约是「message 文案驱动」的**。熔断、限流分类、业务失败计数都按 `code` 分支，而 `code` 的最终值依赖 message 前缀是否与错误码常量名完全一致。谁改一句文案（比如 `SERVER_ERROR: HTTP 500` → `服务端错误: HTTP 500`），分类就会静默落到 `fallback`。没有任何断言在守「throw 处必须显式赋 code」这件事——**只有守「最终对外 code 正确」的断言**。

### 11.4 结论：该做方案 1，方案 2 已做的保留

| 维度 | 方案 2（已做） | 方案 1（待做） |
|---|---|---|
| 直接收益 | 未执行行 −17（7.8%→6.9%） | 每条回退回答「这个修复守不守得住」 |
| 产品缺陷发现 | 0 | 3 抽样发现 1 处脆弱契约（D-09） |
| 能否回答「修了又修错」 | **不能**（只证代码能通） | **能**（改回缺陷态看是否被拦） |
| 成本 | 187 行 / 14 场景（已完成） | 每条 1~2 分钟自动化，剩余 15 条约 30 分钟 |
| 风险 | 无（只加测试） | 需改源码，必须每次 md5 校验 + `git checkout` 还原 |

**方案 1 更贴合用户的真实痛点**（不信任的是「修复会不会又错」）。抽样已证明它有鉴别力（D-12/D-11 真红），也证明它能抓出方案 2 抓不到的东西（D-09 的脆弱契约）。

因此建议：保留已完成的 H 组（沉没成本已付、且确实点亮 2 个源），**接下来执行方案 1 的剩余 15 条回退**，并把「throw 处必须显式赋 code」补成一条静态断言（`g-meta` 加 M13），专治 11.3 那类「靠 message 兜底」的隐性依赖。


## 十二、方案 1 全量回退抽样结果（10 条）

方法：把已修缺陷改回缺陷态 → 对应门禁必须红 → `git checkout` 还原 → 必须绿 → 核对 `lx-source.js` md5 仍为 `3894f40eb9da19878292021450d07df4`。

| 缺陷 | 回退内容 | 注入态 | 结论 |
|---|---|---|---|
| D-05 | `raceBudgetMs` 从可写白名单移除 | **K4b 红** | ✅ 有保护 |
| D-06 | `verifyDelivery` 从 `USER_CONFIG` 删除（只能读默认） | **I5 红**（开/关结果相同） | ✅ 有保护 |
| D-08 | 单链分支 `budgetLeft` 改成 999999999（等于无上限） | **T1 红**（实测 40832ms） | ✅ 有保护 |
| D-10 | 歌词请求删掉 `retries=0`（恢复重试） | **J5 红**（10207ms） | ✅ 有保护 |
| D-18 | README 相对链接指向不存在文件 | **V1 红** | ✅ 有保护 |
| D-11 | 删缺 `musicInfo` 的 `paramErr.code` | **S8 红** | ✅ 有保护 |
| D-12 | 冷却条件去掉 `&& !is128k` | **T2 红** | ✅ 有保护 |
| D-09 | 删 `httpRequest` 500 分支的 `error.code` | **全绿** | ❌ 见 12.1 |
| D-13 | 片段兜底去掉 `|| hasFragCache` | **全绿** | ❌ 见 12.2 |
| D-14 | 跨歌证据阈值 `qs.size >= 1` 改回 `>= 3` | **全绿** | ❌ 见 12.3 |

**7 红 / 3 未红。** 未红的 3 条全部做了根因二次确认，不是「注入无效」，而是断言/场景的盲区。

### 12.1 D-09：保护的是「对外 code」，不是「throw 处赋 code」

`U500` 检查对外 `e.code`，回退后仍绿，因为 `normalizeErrCode` 按 message 前缀回填：

```
const hit = Object.keys(ERROR_CODES).find(k => msg.startsWith(k + ":"));
err.code = hit || fallback || NETWORK_ERROR;
```

后果：**错误码契约是文案驱动的**。熔断/限流分类/业务失败计数都按 `code` 分支，而最终 code 取决于 message 前缀是否与常量名逐字一致。谁改一句文案，分类就静默落到 fallback，没有任何断言在守「throw 处必须显式赋 code」。

### 12.2 D-13：测试场景里片段证据总在 `hasFragDetail`，缓存通道从未被单独验证

删掉 `|| hasFragCache` 后 T5/T6 全绿，说明这两个场景每次都能拿到「本轮的详细片段证据」，**没有一条场景是「只有历史缓存、本轮没证据」**。而真实使用中冷启动后的复播恰恰只有缓存。

### 12.3 D-14：T2 跑了全三档，掩盖了「首档即跳过」的真实路径

`qs.size >= 1` 改回 `>= 3` 后 T2/T3 仍绿，因为 T2 场景对每首歌把三档都跑了一遍，`qs.size` 能涨到 3，旧阈值照样满足。而 v8.11.1 引入「跳过已知片段源」后，**线上同源同歌只跑 1 档**，`qs.size` 恒为 1，旧阈值永远达不到——这正是该修复要解决的场景，测试却没复现。

### 12.4 三条盲区已补测并完成双向验证（2026-11-09）

| ID | 手段 | 首跑 | 反向注入 | 还原 |
|---|---|---|---|---|
| **M13** | `g-meta` 静态扫描：①每处 `throw new Error` 的 message 必须以 `${ERROR_CODES.` 开头（注释行排除）；②`normalizeErrCode` 仍在 `musicUrl/lyric/pic` 三出口调用 | 13 通过 / 0 失败 | 加一行无前缀 throw → 红；删 lyric 出口兜底 → 红 | 绿，rc=0 |
| **W1** | `e-extra`：同一模块实例内两次请求同一首歌——第一次上游给片段（写入 `fragmentUrlMap`），第二次上游全挂（details 里不可能再有 `PREVIEW_FRAGMENT`），断言两次都交付「试听版」 | 56 通过 / 0 失败 | 删 `\|\| hasFragCache` → 红（二次变 `NETWORK_ERROR`） | 绿，rc=0 |
| **T2b** | `stress-round3`：前两首请求 128k（天然只 1 档，`qs.size=1`）制造跨歌证据，第三首请求 flac；冷却生效时只放行 128k 一档（共 1 次外呼） | 13 通过 / 0 失败 | `qs.size >= 1` 改回 `>= 3` → 红（外呼 1/1/**3**） | 绿，rc=0 |

M13 的基线数据：全仓 `throw new Error` **70** 处，其中带 `${ERROR_CODES.` 前缀 **69** 处，
唯一的例外是 L104 的注释行（已被注释排除规则过滤）。所以「码前缀由常量拼出」这条契约当前**零违规**，
可以当真门禁用——文案怎么改都不会把码前缀改坏。

W1/T2b 都在首跑时暴露了判据设计错误，按纪律先定性再改判据：
- W1 最初假设片段兜底会抛 `PREVIEW_FRAGMENT`，实际是**返回带「试听版」标注的成功对象**；且 `fresh()` 会重载模块清空 `fragmentUrlMap`，跨实例测不出缓存通道——两次请求必须落在同一实例。
- T2b 最初假设「冷却后该源外呼为 0」，实际冷却策略**只放行 128k 一档**，用 128k 请求时外呼恒为 1，测不出差异；改用 flac 请求才把「1 次（冷却）」与「3 次（三档全问）」区分开。

### 12.5 补测过程中挖出的新缺陷 D-20：内层缓存把「片段」写成「完整版」

**这是本轮最有价值的产出**——不是补测的副产品，而是一条直接影响用户听感的链路缺陷。

起因：W1 第二次请求返回 `{"url":"https://audio.test/frag.mp3","type":"flac","subSource":"","subSourceName":""}`，
即**同一个 5.3 秒片段 URL，被当作 FLAC 完整音频交付，且没有任何「试听版」标注**。加临时 trace 后定位到：

```
TRACE write kw_..._flac  q=flac  src=undefined  url=https://audio.test/frag.mp3  | from suyinKuwoGetUrl
TRACE write kw_..._320k  q=320k  src=undefined  url=https://audio.test/frag.mp3  | from suyinKuwoGetUrl
TRACE write kw_..._128k  q=128k  src=undefined  url=https://audio.test/frag.mp3  | from suyinKuwoGetUrl
TRACE cacheHit kw_..._flac  q=flac  src=undefined
```

完整链路：

1. `suyinKuwoGetUrl` 取到 CDN 链接后只做 `isAudioPlayable`（**只验「能播」，不验时长/完整度**），通过后立刻 `setCachedUrl` 写入三档缓存，`source` 为空；
2. 同一首歌的三个 handler 内层缓存（`kuwoOfficial` L1701、`suyinKuwo` L1996、`suyinMigu` L2025）都在验真之前写；
3. 外层 `getUrlWithFallback` 的 `verifyDelivery`（L2481）确实识别了片段，第一次正确地标了「试听版」——但**缓存已经被内层写好**；
4. 用户复播：缓存命中路径（L2738）会再验真，但验真对**网络异常是 fail-open**（拿不到字节就放行），上游一抖就直接交付缓存里的片段，标成 `flac`、无「试听版」。

这正好解释了用户截图里「音质 FLAC + 只有 5 秒」的现象，也解释了 T5 为什么一直是假绿：T5 的判据是
`!subSourceName.includes('试听版')`，而缓存命中返回的 `subSourceName` 是**空字符串**，同样不含「试听版」，
于是「片段被缓存当完整版交付」被误判成「源恢复后交付真实版」。

**修复**：三处内层 `setCachedUrl` 全部删除，缓存统一由外层（`verifyDelivery` 之后，且带真实音质与子源）写。
代价只是缓存 miss 时多一次上游搜索（原本也要发），收益是片段再也不可能进入 30min/6h 缓存。

**验证**：W1 转绿（两次都是「试听版」）；把 suyinKuwo 内层 `setCachedUrl` 加回去 → W1 立刻红（二次变「完整版」）；
`lx-source.js` md5 由 `3894f40e…` 变为 `b47d204e83ff6e3b3f26885a2f125cdf`（源码净变化 −3 行 +9 行注释，净 +6 行）。

**为什么四轮审计没抓到**：前三轮都按「缓存双入口」查（成功缓存 + 过期兜底两处），
没查**handler 自己写的第三入口**；而第三入口写的 URL 恰恰是唯一没验真过的。

未覆盖的 5 条说明：D-02（初始化顺序，回退不改变可观测行为）、D-03（写日志，无断言）、D-07 / D-17（死代码与死常量，删了没有功能影响，回退无法观测）、D-19（文档计数口径，属 f-repo 静态判据而非运行时行为）——这 5 条不具备「回退可变红」的前提，不列为本轮缺口。

### 12.6 变异测试基线：8 个变异体，63% 被杀死（第五轮的起点）

补完三条盲区后立刻做了第一件事：**把源码改坏，看门禁发不发现**（而不是继续人工挑场景）。
执行器 `test/mutation/run.js` 已落地：只读仓库 → 复制到 `/tmp` 副本 → 每个变异体只改一处 → 跑门禁 → 还原。

**首跑基线（只跑 4 个快脚本 a-static / b-logic / e-extra / g-meta）：5 killed / 3 survived，63%**

| 变异体 | 首跑 | 结论 |
|---|---|---|
| MU1 `qs.size >= 1` → `>= 2` | 存活 | 快组里没有跨歌冷却用例（只有 stress-round3 的 T2b 守，属"快组不含"，非真空） |
| MU5 `PREVIEW_COOLDOWN_MS 300000` → `1000` | 存活 | **真真空**：全部用例只断言"冷却发生"，没人断言"冷却持续多久" |
| MU8 删掉 `inflight` 释放 | 存活 | **真真空**：没有用例在"连续失败之后"还要求能再发一次请求 |

两条真真空已补：
- **T2c**（stress-round3）：冷却触发 1.5s 后请求 flac，断言该源仍只放行 128k 一档（外呼 1 次）。注入 1000ms → 外呼变 3 → 红。
- **W2**（e-extra）：`maxConcurrency=1` 下连续 4 次失败请求，断言全部是 `NETWORK_ERROR`。注入删释放 → 4 次全变 `RATE_LIMIT` → 红。

**补完后**：快速子集 **6/8（75%）**，含 stress-round3 的全量 **8/8（100%）**。

变异测试真正的价值不在这个 8 分的分数，而在它把"断言够不够强"从主观判断变成了可执行、可复跑的数字：
以后每加一个算子（阈值 ±1、条件反转、常量改值、删副作用、顺序颠倒……），漏掉的就会直接显形。

### 12.7 MEM 组落地：记忆表加上限 + 内存占用可观测（第五轮 5.5）

侦察确认的事实（**不是**"6 个 Map 都没上限"这么笼统）：
- `successCache` / `failCache` 有 LRU 上限（500 / 300）——本来就有；
- `breakerMap` / `previewCooldownMap` / `playDeadStreak` / `playDeadDeadline` / `inflightCount` / `lastUsedAt` / `reqTimestamps` 按 **sourceId** 建键（≤21 源），天然有界；
- `fragmentHandlerSongsMap.mids` 在 `size >= 2` 时 `clear()`，不是无界；
- **真正只增不删的是 4 张按歌曲累积的表**：`deliveryQualityMap`（无 TTL 无 delete 无上限）、`fragmentSourceMap` / `qualityCeilingMap` / `fragmentUrlMap`（有 TTL，但**靠"读取时顺手删"收尸**——从不被读的条目永久驻留）。

改动（`lx-source.js` 3138 → 3173 行）：

| 项 | 内容 |
|---|---|
| `boundedMapSet(map, key, value)` | 带上限写入，超限淘汰**最早插入**一条（Map 迭代顺序即插入顺序），4 张表 5 处写入点全部改走它 |
| 上限可配 | 新增 `memoryMapMax`（默认 2000、`PARAM_LIMITS` 上限 20000），同时登记 `ALLOWED_KEYS` 与 `USER_CONFIG` |
| 跨歌证据 | `mids` 加 `HANDLER_MIDS_MAX`（200）防御上限 |
| 可观测 | `getHealthSnapshot()._memory` 输出 7 张表的条目数 + `limit`；`createLRUCache` 补 `size()` |

**断言（e-extra MEM1~MEM3，57 → 60 项）与双向验证**

| ID | 断言 | 首跑 | 注入后 |
|---|---|---|---|
| MEM1 | `memoryMapMax=5` + 8 首不同歌 → `_memory.deliveryQuality === 5`、`limit === 5` | 绿（5/5） | 把 `if (map.size > max)` 改成 `if (false)` → **条目变 8 → 红** |
| MEM2 | 被淘汰的那首重播仍能正常交付（淘汰只影响记忆，不伤害功能） | 绿 | — |
| MEM3 | `_memory` 的 7 个计数字段 + `limit` 全部是数字 | 绿 | — |

**过程中我自己踩的两个坑（记录在案）**
1. 第一版只加了 `cfg('memoryMapMax', 2000)`，忘了在 `USER_CONFIG` 里做 `__lxSourceConfig` 注入声明 → MEM1 首跑 `limit=2000`、条目 8，**上限根本没生效**。这正是 D-09 那类"配置开关静默失效"的老坑，被自己的断言当场抓住。
2. 补注入行时把 `playDeadReviveMs` 行尾的逗号弄丢，`node --check` 直接 SyntaxError。

**未做（有意）**：没有把 `fragmentSourceMap / qualityCeilingMap / fragmentUrlMap` 的"读取时清过期"改成定时清理——目前上限淘汰已经兜住了最坏情况（条目不超上限），再叠一层定时器会引入新的生命周期复杂度，收益不抵风险。

### 12.8 EDGE 组：配置校验的 NaN 漏洞（D-21）

EDGE 组第一条就抓到真缺陷，触发方式比预想的简单：**往配置里写一个 NaN**。

`manageConfig` 的写入校验只有一行：
```js
if (typeof value !== "number" || value <= 0) continue;
```
NaN 恰好从三道门里全穿过去：

| 判断 | NaN 的结果 | 是否拦下 |
|---|---|---|
| `typeof value !== "number"` | `typeof NaN === "number"` → false | ✗ |
| `value <= 0` | `NaN <= 0` → false | ✗ |
| `value < limits.min` | `NaN < 1` → false | ✗ |
| `value > limits.max` | `NaN > 20000` → false | ✗ |

**实测后果（比"值是 NaN"严重得多）**：`raceBudgetMs = NaN` 写入后，
`Date.now() + NaN = NaN` → 每次请求的竞速预算都是 NaN → **该实例所有请求立即 `NETWORK_TIMEOUT`，直到进程重启**。
这一条不是推测：本次 EDGE3/EDGE4 首跑双双变 `NETWORK_TIMEOUT`，就是被前面那次 NaN 写入拖累的连带证据。

| 项 | 内容 |
|---|---|
| 影响面 | 所有数值型白名单键（`cacheTtlMs`、`rateWindowMax`、`breakerThreshold`、`raceBudgetMs`…），NaN 会同时绕过 `<=0` 与上下限 |
| 修复 1（写入口） | 校验加 `!Number.isFinite(value)` → NaN/Infinity 直接 `continue` |
| 修复 2（读出口，纵深） | `cfg()` 对数值型默认值做回落：`typeof def === "number" && !Number.isFinite(v) ? def : v` |
| 双向验证 | 删掉修复 1 → EDGE2 立刻红（`{"raceBudgetMs":null}`）；恢复 → 绿 |

**一处诚实的说明**：修复 2（`cfg` 里那道 `Number.isFinite`）**没有独立可观测路径能证明它在生效**——写入口已被修复 1 挡住、初始化入口本来就有 `|| 默认值`。
实测"删掉修复 2"后 EDGE5 依旧绿，说明 EDGE5 真正验证的是初始化兜底，不是 `cfg` 那道防线。
因此 EDGE5 的文案改成了它实际证明的东西（"实例不瘫痪"），`cfg` 那道防线保留但标注为**不可独立观测的纵深防御**，不当作已证明的修复。

### 12.9 EDGE 组其余四条（都是"防护已在，防回归"）

| ID | 断言 | 结果 |
|---|---|---|
| EDGE1 | 非正数配置被拒（`raceBudgetMs=0` → `updated={}`） | 绿（原有行为，加 NaN 修复后仍绿） |
| EDGE3 | 原曲时长 `0`/`undefined` 时完整音频不被误判成片段（`realDur && origDur && origDur>=90` 三重短路） | 绿 |
| EDGE4 | 音质大小写不分裂（`type:'FLAC'` 与 `flac` 等价，全链 `toLowerCase`） | 绿（`type=FLAC → OK:320k`，档位按源真实能力回落） |
| EDGE5 | 外部注入 `raceBudgetMs=NaN` 时实例不瘫痪（初始化 `|| 默认` 兜底） | 绿 |

**未覆盖、也不打算假装覆盖**：冷却到期瞬间的 ±1ms（`Date.now()` 不可控，只能靠"1.5s 后仍在冷却"下界近似，已在 T2c）；TTL 精确 ±1ms（同理，改用 `cacheTtlMs` 注入 + sleep 近似）；`songmid` 含 `|`（缓存键是拼接串，但从当前分段结构看撞键需要 mid 与 quality 同时错位，构造成本高、现实收益低，暂列观察项）。

### 12.10 FAULT 故障注入（8 条）

只注入"上游真实会发生、但 mock 从没模拟过"的形状。全部断言都做了反向注入验证：**能变红的才算数**。

| ID | 注入形状 | 实测结果 | 反向注入（证明断言有效） |
|---|---|---|---|
| FAULT1 | HTTP 200 + 空 body | `NOT_FOUND` | — |
| FAULT2 | JSON 截断 | `NOT_FOUND`（解析失败不抛 TypeError） | — |
| FAULT3 | 10MB 响应体（API 侧大 JSON + 音频侧大音频） | `OK`（正常交付） | — |
| FAULT4 | 三首不同歌各遇 502/503/504 | 三次全 `SERVER_ERROR` | — |
| FAULT4b | 连续 5xx 后熔断 | `state=open`、`reqCount=3`、第 4 首不再外呼 | 把 5xx 从 `recordFailure` 条件里摘掉 → **红**（`state=closed`、外呼 99→103） |
| FAULT4c | 同歌 30s 内重复失败 | 首次外呼 +4，重复两次 +0 | 整行删掉失败缓存写入 → **红**（重复 +8） |
| FAULT5 | `ENOTFOUND` | `NETWORK_ERROR` | — |
| FAULT6 | 证书错误（self signed） | `NETWORK_ERROR` | — |
| FAULT7 | 抛字符串（非 Error） | `NETWORK_ERROR` | — |
| FAULT7b | 抛纯对象（无 message） | `NETWORK_ERROR` | 见下方诚实说明 |

**FAULT4b 的判据改了三次，每次都是因为判据被别的机制满足**：

1. 首版看"第 4 次返回什么码（期望 RATE_LIMIT）"→ 红，实际返回 `SERVER_ERROR`；
2. 改成"外呼计数不变"→ 绿，但**注入"5xx 不计熔断"后仍然绿**，说明这个判据太弱；
3. 最终要求 `getHealthSnapshot().state === 'open'` **且**外呼不变 → 正常绿、注入红。

第 2 版为什么假绿，是这次最有价值的收获：**"不再外呼"可以被三种机制同时满足**——断路器熔断、播放摘除（`PLAY_DEAD_STREAK`）、失败缓存。只看行为结果，分不清是谁在起作用。必须读内部状态。

**顺带验证出一条设计事实**：同一首歌连续失败**不会**累积到熔断阈值。因为整链全失败会写 30s 短失败缓存（`allFailShortTtlMs`），第二次直接返回缓存错误、不记账。
这是刻意的雪崩保护（源码注释写明"避免同一首歌每次重播都在降级链里白跑 ≈18s"），不是缺陷——熔断累积要靠**不同歌**的真实失败。这也解释了为什么必须用三首不同歌测熔断。

**FAULT7b 的诚实说明**：把 `String(err.message || "")` 改成 `err.message.includes(...)`（即撤掉对"非 Error 抛掷"的防御）后，FAULT7b **仍然是绿的**。
说明异常在更外层就被归一成已知码，这条断言只证明**结果层**（用户拿到已知错误码、不会二次崩溃），**不能定位到 `httpRequest` 里那行防御**。文档保留它为"结果层保证"，不当成"那行代码已证明有效"。

### 12.11 INV 不变量（六条）

不指定路径，只守"永远为真"的性质，比"某场景返回某值"更抗重构。

| ID | 不变量 | 状态 | 证据 |
|---|---|---|---|
| INV1 | 缓存只允许一个写点，且在 `verifyDelivery` 之后 | 已落地（M14 静态统计） | 注入内层 `setCachedUrl` → 红（"写点 2 处"） |
| INV2 | 交付的 `subSource` 必须在 `buildSourceChain(platform, quality)` 结果里 | 已落地 | `subSource=suyinKuwo`、`chain=[suyinKuwo]` |
| INV3 | 交付 `type` 必须与实测字节一致，不得照抄请求档 | 已落地 | 请求 `flac`、上游给 mp3 → 交付 `type=128k` |
| INV4 | 请求结束后该源 inflight 归零（含异常/超时/竞速落败） | 已由 W2 覆盖 | `maxConcurrency=1` 下连 4 次失败仍是 `NETWORK_ERROR`（不释放则变 `RATE_LIMIT`） |
| INV5 | 幂等：同歌同档两次（各自全新实例）交付同一源 | 已落地 | 两次均 `suyinKuwo` |
| INV6 | 任何片段命中都必须带「试听版」标注 | 已由 W1 覆盖 | 两次请求均交付 `subSourceName` 含「试听版」 |

**INV3 做了反向注入验证**：把 `quality: qualityFromDelivery(probe.info, ctx.quality)` 改成 `quality: ctx.quality`（即"忽略实测字节、直接标请求档"）→ 立刻红（`type=flac`）。
这条断言直接指向 D-20 的修复成果：交付的音质标签现在来自真实字节，不是用户请求的档位。

**两条必须标注的弱判据**：

- **INV2** 只在单源链路下验证过（`chain` 长度 1），"交付源 ∈ 链"在这种场景下接近恒真。真正的检验需要多源链路里优选源失败、交付落到第二个源——本次没构造（`helloworldKw`/`kuwoOfficial` 的 mock 形状与 oiapi 不同，成本高）。
- **INV5** 同理：同配置 + 单源，两次结果必然一致。它的价值不在于当下，而在于"以后若引入竞速随机性或负载均衡，这条能立刻抓住交付不稳定"。

这两条按现状如实记为**弱判据**，不计入"已验证"的强证据里。

## 13. 第五轮结算（审断言）

第五轮的完整结算单独成文：`docs/reports/v8.11.1-第五轮审计结算.md`。

要点摘录（详细证据见该报告）：

- 第五轮 8 个提交（`7ae87f2` → `4f33d8b`），抓到 **D-20、D-21** 两个真实缺陷。
- **22 条断言做过注入确认能红**（M13/M14/W1/W2/T2b/T2c/MEM1/MEM3/EDGE1/EDGE2/EDGE3/EDGE4/FAULT2/FAULT4b/FAULT4c/FAULT5/FAULT6/FAULT8/FAULT8b/FAULT8c/INV2b/INV3），12 个变异体全部 killed。
- **B 类补验结果**：7 条确认能红（EDGE1/EDGE3/EDGE4/FAULT2/FAULT5/FAULT6/MEM3，已升入 A 类），5 条判定不可注入（FAULT1、FAULT3、MEM2、INV2、INV5）。
- **补验中又抓到两条空转**：EDGE3（`d0==="OK"` 分不清完整版与片段兜底）、EDGE4（只看 `OK` 前缀、不看档位值），均已收紧判据后重验。
- **C 类（降级为结果层）**：EDGE5（证明的是初始化兜底，不是 `cfg` 防线）、FAULT7b（撤掉防御后仍绿，只证明不二次崩溃）。
- **明确未覆盖**：冷却 ±1ms、TTL ±1ms、`songmid` 含 `|`。
- **本轮补上的两块**：INV2b（多源换源，优选源挂掉必须换到 backup 且 subSource 真的换）、FAULT8/8b/8c（429 走独立限流分支 + 「被限」标记只在并发下可达 + 面板「限流中」在退避期即可亮）。
- 结论：第五轮证明的不是"代码没问题"，而是"**原来的断言不足以证明代码没问题**"。

## 14. D-29：0 字节响应被当成「音频」交付（第四轮压测压出）

**发现方式**：V1 故障谱系（10 类故障 × 5 平台 × 3 档 = 150 组）跑出分布表，
`emptyBody`（206 + `content-range: bytes 0-1023/0` + 空 body）、`truncLen`（body 只有 `fLaC` 4 字节）、
`shortMp3`（body 只有 `ID3\x03` 5 字节）**各 15/15 全部「成功交付」**。

**根因**（`sniffAudioBytes` 空体分支）：

```js
if (!body || !body.length) {
  if (/audio|octet|mpeg|mp3|flac|ogg|aac|m4a/.test(ct)) out.kind = "audio";
  return out;
}
```

只要响应体里没有任何字节、而 content-type 含 `audio`，就被判成「音频」放行。
后果：点歌点到 0 字节 URL，用户端必然播放失败，而音源侧认为成功——不进失败缓存，
每次重试都重新外呼、每次都「成功」，用户侧每次报错。

**修法**：`!body || body.length < 16` → `out.kind = "empty"`；`verifyDelivery` 增加 `empty` 分支返回 `NOT_AUDIO`，
理由串写「交付内容为空(0~16 字节，不可能可播)」。16 字节下限的依据：FLAC STREAMINFO 至少 34 字节、
ID3 标签头 10 + 帧头 4、MP3 帧头 4 字节——低于 16 字节无论何种容器都不可能构成可播头。

**验证**（修前 / 修后同一套 150 组）：

| 故障档 | 修前 | 修后 |
|---|---|---|
| `emptyBody`（206 + 空 body） | 15/15 判「成功」 | 15/15 返回 `NOT_AUDIO` |
| `truncLen`（body 4 字节） | 15/15 判「成功」 | 15/15 返回 `NOT_AUDIO` |
| `shortMp3`（body 5 字节） | 15/15 判「成功」 | 15/15 返回 `NOT_AUDIO` |
| 其余 7 类 | 均明确失败 | 均明确失败（无回归） |

**为什麼 228 条既有断言没抓到**：既有断言都在「校验能过的时候」和「明显坏的时候」两端，
没有造「**响应体是空的、但 HTTP 语义完全正常（206 + content-range）**」这种中间态——
它既不是网络错误、也不是非法 URL、也不是 JSON，恰好落在「格式全对、内容为零」的盲区。

**方法论**：压测断言要覆盖「**状态码正确但内容为空/极短**」这一档。V1 的 150 组矩阵现已常驻，
若有人回退这段判据，`emptyBody/truncLen/shortMp3` 三档会立刻重新变绿（=假成功），断言即红。


## §15 D-30：错误码「键名/值」混用，MISMATCH 永久丢失（2026-11-09）

**怎么发现**：补 V11（MISMATCH 覆盖）时断言先红，报出的码却是 `NETWORK_ERROR`。

**根因**：`ERROR_CODES` 里 12 个码只有 `MISMATCH → 'SONG_MISMATCH'` 键≠值，而两处归一函数都按**键名**匹配：

```js
// 错（normalizeErrCode）
const hit = Object.keys(ERROR_CODES).find(k => msg.startsWith(k + ":"));
err.code = hit || fallback;            // ① 匹配 'MISMATCH:' 而 message 是 'SONG_MISMATCH:' ② 赋的是键名
// 错（extractErrorCode）
return m && ERROR_CODES[m[1]] ? m[1] : NETWORK_ERROR;   // ERROR_CODES['SONG_MISMATCH'] 为 undefined
```

**连带三处一起错**：
1. 用户/日志看到「网络错误」，真相是「搜到的不是这首歌」；
2. `FAIL_CACHE_TTL_BY_CODE[MISMATCH] = 1h` 永不生效 → 同一首错歌反复重查、反复外呼；
3. 熔断把业务失败当网络失败计数 —— 源码注释明确「业务失败(MISMATCH等)不计入熔断」，实际却计入，用户点几首匹配不上的歌就能把健康源打进冷却。

**修法**：两处统一「认键名也认值、一律赋**值**」，与全仓 `=== ERROR_CODES.X` 的比较口径对齐。修后实测 `code=SONG_MISMATCH`。

**同源测试缺陷**：V 组 `isLegalCode` 也用键名判定（`hasOwnProperty(CODES(), 'SONG_MISMATCH')` 为 false），会把合法码误判成非法 —— 11 个码键值同名，一直没暴露。已改按 `Object.values` 判定。

### D-31（取舍记录，未改代码）：兜底档放宽歌手是有意设计
`suyinKuwoGetUrl` 的兜底关键词用 `strict=false`，只传 `{name, duration}`，**丢 singer**（注释写明「歌手/专辑可放宽，但歌名与时长必须一致」）。后果：flac 档拒了同名错歌，降档到兜底档仍会放行，用户最终可能听到翻唱。
未擅自收紧（歌手写法差异在真实源很常见，收紧会大面积误拒）。V11 改用「首轮给错歌、之后给正确歌」的口径，精确验证 strict 档闸门生效（首错被拒 → 交付正确链接）。是否收紧兜底档待拍板。
