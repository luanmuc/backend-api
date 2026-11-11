# 测试基建索引（test/）

> **22 个入口**，**没有统一 runner**，逐条跑。
> **QuickJS 3 条（QR）需 `NODE_PATH` 指向装了 `quickjs-emscripten` 的目录**（CI 在 L66-67 自装）；
> 缺依赖时脚本以**退出码 3** 报「未验证」——**跳过不等于通过，不得计入 257**。
> 断言实测：冒烟 **67 组** + 审计 **264 条**（10/30/30/**94**/**52**/**14**/**14**/**4**/**5**/**3** + QuickJS **3**）+ 压测 **159 条**（12/14/**133**）= **合计 490 条**；变异体 **22 个**（按「能否被门禁杀掉」记，`--full --strict` 全量 **22 killed / 0 survived**，2026-11-10 实测）。
> 铁律：截图式的"一堆绿字"不算证据，**退出码 + 通过/失败计数**才算。取退出码必须取被测命令本身，不能取管道末端的 `tail`/`grep`。

## 〇、CI 覆盖（`.github/workflows/ci.yml`）

三套压测**全部**在 CI 里跑，不是只在本地跑：

| 步骤 | 门禁 | 断言 |
|---|---|---|
| L4 | `node test/audit/r-admission.js` / `node test/audit/u-cross-platform.js` | 23 + 9（L4 裁决层 + 跨平台兜底） |
| L1.3 | `node --expose-gc test/stress-test.js` | 12（S 组，压量） |
| L5 | `node --expose-gc test/stress-round3.js` | 14（T 组，压态） |
| L5.1 | `node --expose-gc test/stress-round4.js` | 133（V 组，压判据） |
| mutation job | `node test/mutation/run.js --full --strict` | 22 个变异体，killed 率必须 100%（`--strict` 下 survived 即 exit 1） |

> 说明：`stress-round4` 曾长期缺席 CI（另两套早就在），2026-11-09 补入 L5.1。

## 一、入口总表

| 入口 | 断言数 | 覆盖 | 依赖 | 命令 |
|---|---|---|---|---|
| `test/lx-source-smoke-test.js` | 67 组 | 主链行为回归：取链/降档/验真/缓存/熔断/限速/冷却/探针/歌词 | 纯 mock 宿主 | `node test/lx-source-smoke-test.js` |
| `test/audit/a-static.js` | 10(+2 note) | 静态：常量一致性、导出面、无死键、注释与代码对齐 | 读文件 | `node test/audit/a-static.js` |
| `test/audit/b-logic.js` | 30 | 逻辑：闸门判据、降档链、缓存键、记账口径、冷却状态机 | mock 宿主 | `node test/audit/b-logic.js` |
| `test/audit/d-func.js` | 30 | 功能：五平台取链、音质矩阵、订阅源、错误码、配置读写 | mock 宿主 | `node test/audit/d-func.js` |
| `test/audit/e-extra.js` | **94** | 二轮新增：歌词/管理 action/断路器/限速/缓存容量/冷启动/健康分/QuickJS/定时器/参数/日志脱敏；四轮 U 组：上游 HTTP 500/410/404/429/403 码映射；六轮新增 G4b/G4c（同歌 5 并发只 1 次外呼、结果一致）+ G12a~G12d（星海备按 `PLATFORM_TO_XINGHAI_BACKUP` 过滤平台，mg/kg 不再白 push 必败源）+ **Q7**（真删 `globalThis.Buffer` 跑交付验真，JSON 假交付必须判 `NOT_AUDIO`，不得 fail-open 放行）+ **K4c~K4e**（v8.11.7 健康面板配置可管：布尔开关可写读回/非布尔拒写/数字参数白名单补齐） | mock 宿主 | `node test/audit/e-extra.js` |
| `test/audit/p-gaps.js` | 4 | 六轮新增：通读发现的零覆盖点补测（P1 previewUrlPreFilter 开/关差值 · P2 FLAC 多 metadata 块遍历 · P3 MP3 无 Xing 按码率回填时长 · P4 探测连续 2 次通过才自动启用）；逐条反向改坏实现 → 全红后还原 | mock 宿主 + `__debug` | `node test/audit/p-gaps.js` |
| `test/audit/q-dfix.js` | 5 | D 系列行为断言：Q1 half-open 遇 429 必须收口回 open（删收口段立刻红）；Q2 closed 态遇 429 只退避不熔断；Q3（v8.11.3）toggle 开启某源后该平台失败缓存必须失效——先红（仍 NOT_FOUND）后绿（none）；Q4（D-08）单链悬挂源预算内超时；Q5（v8.11.4，F-01）星海后端缺 songmid 必须 `PARAM_ERROR`，不得兜底 1 号歌——先红（code=undefined）后绿 | 宿主桩 + `__debug` | `node test/audit/q-dfix.js` |
| `test/audit/q2-dseries.js` | 3 | D 系列剩余行为断言：R1 D-06 布尔键 `??`（注入 false 必须取到 false）、R2 D-05 真键可写/死键忽略、R3 D-26 mg 链不得含星海备（kw 链必须含，防断言恒真）；三条均已注入回退验证会红 | 宿主桩 + `__debug.cfg` + `buildSourceChain` | `node test/audit/q2-dseries.js` |
| `test/audit/n-fixes.js` | 4 | 六轮新增：通读推断缺陷的红绿回归（N1 Juhe code 字符串 / N2 Juhe 303 校验值类型 / N3 flac24bit 起跑保留 320k / N4 CONFIG_ERROR 5 分钟过期） | mock 宿主 + `__debug` 只读钩子 | `node test/audit/n-fixes.js` |
| `test/audit/s-health-events.js` | **22** | 2.4 方案：`healthEvents` 只读环形缓冲（schema/capacity 500/dropped）、成功链 `play_start`→`source_attempt`→`source_result`、失败链 `ok:false` 且 code 非空、探测与开关事件、同 traceId 串联、返回副本不回写、隐私边界（不含歌名/URL）、超容丢弃 | mock 宿主 + `__debug` | `node test/audit/s-health-events.js` |
| `test/audit/t-health-events-stress.js` | **12** | 2.4 方案压力：10000 条灌满后容量 500/dropped 9500/seq 单调、同 trace 链、limit 边界、副本、非法参数、字段白名单、隐私注入、读取吞吐 | mock 宿主 + `__debug` | `node test/audit/t-health-events-stress.js` |
| `test/audit/h-toggles.js` | 14 | 四轮新增：默认关闭/从未开启的源（helloworldKw·星海后端·酷我官方·Juhe×5·聆川·gdWy·溯音QQ·溯音咪咕·酷我封面·星海备）逐个开启后的最小可用性 | mock 宿主 | `node test/audit/h-toggles.js` |
| `test/audit/f-repo.js` | 52 | 三轮新增：全仓 **72** 文件静态合规 + 交叉引用 + 脚本自洽 + 功能联动 + 残留死码 + 资源启动（详见下方「f-repo 六组」） | 读文件 + 子进程 | `node test/audit/f-repo.js` |
| `test/audit/g-meta.js` | 14 | 四轮元审计：恒真断言/空壳断言/自指/导出面真实性/死键回流/入口登记/退出码链路/require 安全/口径统一/输出可定位 | 读文件 + 子进程 | `node test/audit/g-meta.js` |
| `test/stress-test.js` | 12 | 压测 S 组压「量」：并发/预算/配额/熔断/缓存容量/长跑/极端参数/闸门对照/定时器 | `--expose-gc` | `node --expose-gc test/stress-test.js` |
| `test/stress-round3.js` | 14 | 压测 T 组压「态」：跨档总预算、源级冷却与本地限速分离、片段翻转、闸门 8 组合矩阵、config 热更新、错误码注入、probe 并发、写满容量堆增长、档位串槽、熔断跨源污染 | `--expose-gc` | `node --expose-gc test/stress-round3.js` |
| `test/stress-round4.js` | **133** | 压测 V 组压「判据」（第四轮新增）：故障谱系 10 类 × 5 平台 × 3 档 = 150 组零假成功 / 同歌同档 100 并发只外呼 1 次 / 220 首并发无违约 / 缓存 400 首内命中·700 首后 LRU 淘汰 / 熔断全周期 / 限流滑窗 / 降档预算与末档保底 / 随机 2000 次 4 条不变量 / soak 4000 次堆收敛与句柄不累积 / 20 次重载缓存不跨实例 / MISMATCH 拒错歌 / 验真时长三阈值边界 / CONFIG_ERROR / 配置脱敏与写白名单 / logEnabled 静音 / raceBatchSize 串并行 / 音质短路拦停 / 冷启动预热开关与 TTL（预热计数按 URL+timeout 双键，隔离同 URL 健康探针） | 纯 mock 宿主 | `node --expose-gc test/stress-round4.js` |
| `test/candidate-audit-test.js` | 6 | 候选实证流程 | 本地 | `node test/candidate-audit-test.js` |
| `test/audit/q-quickjs-real.js` | 3（可选） | **真 QuickJS 引擎**跑：能否加载 / 宿主是否真没有 Buffer / 无 Buffer 下 JSON 假交付必须判 NOT_AUDIO（D-28 就靠它抓出） | 需 `quickjs-emscripten`，未装自动 SKIP | `NODE_PATH=<装了它的 node_modules> node test/audit/q-quickjs-real.js` |
| `test/audit/r-admission.js` | **23** | L4 裁决层：桥序列化体归一 / 无字节凭头判 PASS / JSON 头判 NOT_AUDIO / 5 秒片段 / API 试听标记 / 代表码优先级（NOT_AUDIO 不被 NOT_FOUND 吞）/ weak 证据 TTL≤60s / clearSourceLedger / 裁决幂等 / skipReason / 片段与试听标记边界（A2b/A3b/A3c）/ K14 新增 A9~A15：probe 四种状态映射、交付体四形态、verify medium 尺寸比、admit delivery 全分支、clearSourceLedger 逐档归零、5xx→hardFail→recordFailure；A16~A20（v8.11.6 收尾）：链过滤与 skipReason 同源、关源清账对称、fallback 按 codeRank 取代表码、GET 无字节 HEAD 补证、非 strong 证据 TTL 全遍历 | 纯 mock 宿主，不外呼 | `node test/audit/r-admission.js` |
| `test/audit/u-cross-platform.js` | **9** | v8.12.0 跨平台兜底：U1 主平台命中不跨平台 / U2 `NOT_FOUND` 立即转 tx 并严格匹配原版 / U3 主平台成功带 `sourcePlatform` / U4 同名不同歌手拒绝 / U5 时长差 >5s 拒绝 / U6 歌名变体（feat./括号）兼容 / U7 跨平台失败保留主平台码 / U8 跨平台成功清主平台失败缓存且返回 `fallback` / U9 慢主平台最终成功不被跨平台抢跑误杀 | mock 宿主 | `node test/audit/u-cross-platform.js` |
| `test/mutation/run.js` | 22 变异体 | 五轮新增：把源码改坏一处，看门禁能否发现（在临时副本上跑）；2026-11-10 `--full --strict` 全量 **22 killed / 0 survived**；复跑曾出现 1 skipped（MU2 锚点被 F-01 改动失配），修锚点后单跑 killed，锚点失配会被脚本以「锚点命中 0 次」显式报出 | 本地 | `node test/mutation/run.js [--full] [--strict]` |

## 二、mock 宿主必须同构的四件事（不照做会出现假故障）

1. **非 binary 的可播校验与 1KB 探针也走 `request`**——`scene` 必须对音频直链返回音频，否则被误判 410 `LINK_EXPIRED`
2. `lx.request` 只有 `binary: true` 才回 Buffer；非 binary 走 text + 自动 `JSON.parse`（文本响应必须返 **string**）
3. 必须实现 `opts.timeout` 中断
4. `fragmentFallback` 开时会掩盖 `PREVIEW_FRAGMENT`——测片段判据必须把它关掉

另：`suyinKuwo` 的 mock 必须带 `{code:200, data:{url}}`，缺 `code:200` 直接判 `NETWORK_ERROR`。

## 三、测并发/缓存类前必须先注入的配置

```js
globalThis.__lxSourceConfig = {
  breakerThreshold: 999,        // 默认很小，连续 3 次失败就熔断，会把并发测试全打成跳过
  rateWindowMax: 100000,        // 否则窗口配额先打满
  rateWindowMs: 3600000,
  maxConcurrency: 100000,
  fragmentFallback: false,      // 要测片段判据时
}
```

`qualityShortCircuit` 默认开：全部源该档 0 成功会短路降档，批量压测须关掉，否则测不到真实路径。

## 四、隔离

单进程内多次请求会共享 `successCache` / `failCache` / `previewCooldownMap` / 熔断状态。每组用例前 `delete require.cache` 重载模块（各脚本里的 `fresh()` 就是干这个）。

## 五、如何新增一条断言

1. 先写断言，跑一遍确认**它是因为缺陷而红**（不是语法/拼写错）
2. 改代码让它变绿
3. 反向验证：把修复回退，断言必须重新变红（否则这条断言是空壳）
4. 固化到对应组，脚本末尾必须有 `process.exit(fail ? 1 : 0)`——`a-static` 缺这句进程不会退出

## 六、失败怎么读

- 每条输出带 `[编号] 名称 — 实际 …`，编号与 `AUDIT_RESULTS.md` 的缺陷编号可对照
- 汇总行 `X 通过 / Y 失败`，**以退出码为准**
- 断言自己错了（口径写错/mock 缺分支）时，改判据前先记录"原判据为什么错"，不要静默放宽

## 七、f-repo 六组（U~Z，50 条）· 全仓覆盖的唯一入口

| 组 | 维度 | 条数 | 覆盖内容 | 单条跑法 |
|---|---|---|---|---|
| U | 静态合规 | 13 | 21 个 `.js` 逐个 `node --check`；`.md` 的 H1 唯一（跟踪 ``` 围栏排除 bash 注释）；BOM/CRLF/TODO/`/tmp`/明文 40 位密钥/console 残留/json·jsonl 可解析/YAML 无 Tab/无空文件 | `node test/audit/f-repo.js U` |
| V | 交叉引用 | 8 | 20 个 `.md` 相对链接逐个验在否、`@version` 三文档一致、冒烟组数/开关数/错误码数、文档引用的脚本存在 | 同上 |
| W | 脚本契约 | 9 | 4 脚本退出码、登记表 20 条 url 唯一且字段完整、开关解析取 `.toggles`、北京日期 `todayCN`、doc-sync 路径、hook 语法 | 同上 |
| X | 功能联动 | 9 | 片段码↔巡检、日报字段↔`README_HEALTH`、`candidate-status` 格式、候选名单两处一致、**解析值↔源码默认值逐键比对**、docs-audit 规则数、CI/workflow 引用、兜底层 | 同上 |
| Y | 残留死码 | 6 | 重复函数 72 个、只定义不用的常量、`debugger`、12 个错误码使用率、未用 `let`、导出面 | 同上 |
| Z | 资源 | 5 | 加载 <50ms、重复加载堆增长、导出面 19 项、非法入库文件、无 >500KB 单文件（最大 219.17KB） | 同上 |

- 覆盖分母：`git ls-files` 的 **79 个文件 / 20309 行**（实测值以 [`AUDIT_MATRIX.md`](./AUDIT_MATRIX.md) 汇总为准，该表由规则17 自动同步），未覆盖文件 **0**
- **六组在同一脚本内顺序执行，不支持只跑某一组**（传组名参数会被忽略，实测过）：要定位失败直接看输出行首的 `[U1]`…`[Z5]` 编号
- **改完任何文件都要重跑**：U 组会因行数/BOM/新增文件而红；改文档后顺手把 `AUDIT_MATRIX.md` 的行数同步（`docs-audit` 不校验该表数字）

## 八、真网分层实跑（L1~L7，`tools/live/`）

本地 mock 与 QuickJS 都跑在「宿主已给定」的前提下，**真网/真宿主契约**要另用这一套：

```bash
node tools/live/run.js l1l4   # L1 协议 + L2 缓存 + L3 调度 + L4 验真
node tools/live/run.js l5     # L5 单源逐个开启（每源独立歌曲 + 真实 id，避开共享缓存）
node tools/live/run.js l6l7   # L6 状态机 + L7 巡检
```

- `tools/live/host.js` 是**真宿主桩**：按 lx 移动端 `request(url, opts, cb)` 契约实现，真 https，支持 `timeout/method/headers/follow_max/binary`，302 手动跟链并记 `hops`；每次调用落 `{url, status, ms, hops, range}`。
- 计数口径：`fullCalls()` **排除 Range 请求**、`rangeCalls()` 单独计——因为交付前的 1KB 验真本身就是一次外呼，不二分会把「验真」误判成「又解析了一次」。
- 这几个分支**会真连上游**，结果随上游存活波动；用例本身是固定夹具（含 `NOSONG`/`FRAG_SONG`/`FREE2`），失败要先按「上游 vs 本仓逻辑」归因再动手。
- 该工具不进 CI（依赖外部网络与上游可用性），只作人工验收/回归。

## QuickJS 依赖的持久化位置

`test/audit/q-quickjs-real.js` 需要 `quickjs-emscripten`。**`/tmp` 会被系统清理（已踩过两次），
仓库内 `node_modules/` 会被 `git clean -fdx` 或重新 clone 抹掉**，所以依赖查找按以下顺序：

1. `<repo>/node_modules/quickjs-emscripten`（临时，可被清）
2. **`<workdir>/vendor/quickjs/node_modules/quickjs-emscripten`** ← 主路径，工作区持久目录
3. `$QUICKJS_EMSCRIPTEN`（显式覆盖）
4. 都没有时**自动 `npm i` 到工作区 `vendor/quickjs`**，网络不可用才退 `exit 3`

第三层是自愈：只要网络可用，任何干净环境首次跑都能自动就位。`vendor/` 不在仓库内，
不占仓库体积、不受 `git clean` 影响。CI 侧仍由 `.github/workflows/ci.yml` 自行安装。

**`exit 3` 的语义是「未验证」，不是通过**——若看到 exit 3，说明依赖缺失，那 3 条不计入 249。
