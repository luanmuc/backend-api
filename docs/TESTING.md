# 测试基建索引（test/）

> **14 个入口**，**没有统一 runner**，逐条跑。断言实测：冒烟 67 组 + 审计 10/30/30/**89**/50/**14**/**6** + 压测 12/14/**52** = **229 条审计断言 + 78 条压测断言**（另有 QuickJS 真引擎 3 条，依赖未装则跳过、不计入；`note` 信息登记不计入；`test/mutation/run.js` 是 12 个变异体，按「能否被门禁杀掉」记）。
> 铁律：截图式的"一堆绿字"不算证据，**退出码 + 通过/失败计数**才算。取退出码必须取被测命令本身，不能取管道末端的 `tail`/`grep`。

## 一、入口总表

| 入口 | 断言数 | 覆盖 | 依赖 | 命令 |
|---|---|---|---|---|
| `test/lx-source-smoke-test.js` | 67 组 | 主链行为回归：取链/降档/验真/缓存/熔断/限速/冷却/探针/歌词 | 纯 mock 宿主 | `node test/lx-source-smoke-test.js` |
| `test/audit/a-static.js` | 10(+2 note) | 静态：常量一致性、导出面、无死键、注释与代码对齐 | 读文件 | `node test/audit/a-static.js` |
| `test/audit/b-logic.js` | 30 | 逻辑：闸门判据、降档链、缓存键、记账口径、冷却状态机 | mock 宿主 | `node test/audit/b-logic.js` |
| `test/audit/d-func.js` | 30 | 功能：五平台取链、音质矩阵、订阅源、错误码、配置读写 | mock 宿主 | `node test/audit/d-func.js` |
| `test/audit/e-extra.js` | **89** | 二轮新增：歌词/管理 action/断路器/限速/缓存容量/冷启动/健康分/QuickJS/定时器/参数/日志脱敏；四轮 U 组：上游 HTTP 500/410/404/429/403 码映射；六轮新增 G4b/G4c（同歌 5 并发只 1 次外呼、结果一致）+ G12a~G12d（星海备按 `PLATFORM_TO_XINGHAI_BACKUP` 过滤平台，mg/kg 不再白 push 必败源）+ **Q7**（真删 `globalThis.Buffer` 跑交付验真，JSON 假交付必须判 `NOT_AUDIO`，不得 fail-open 放行） | mock 宿主 | `node test/audit/e-extra.js` |
| `test/audit/h-toggles.js` | 14 | 四轮新增：默认关闭/从未开启的源（helloworldKw·星海后端·酷我官方·Juhe×5·聆川·gdWy·溯音QQ·溯音咪咕·酷我封面·星海备）逐个开启后的最小可用性 | mock 宿主 | `node test/audit/h-toggles.js` |
| `test/audit/f-repo.js` | 50 | 三轮新增：全仓 **69** 文件静态合规 + 交叉引用 + 脚本自洽 + 功能联动 + 残留死码 + 资源启动（详见下方「f-repo 六组」） | 读文件 + 子进程 | `node test/audit/f-repo.js` |
| `test/audit/g-meta.js` | 14 | 四轮元审计：恒真断言/空壳断言/自指/导出面真实性/死键回流/入口登记/退出码链路/require 安全/口径统一/输出可定位 | 读文件 + 子进程 | `node test/audit/g-meta.js` |
| `test/stress-test.js` | 12 | 压测 S 组压「量」：并发/预算/配额/熔断/缓存容量/长跑/极端参数/闸门对照/定时器 | `--expose-gc` | `node --expose-gc test/stress-test.js` |
| `test/stress-round3.js` | 14 | 压测 T 组压「态」：跨档总预算、源级冷却与本地限速分离、片段翻转、闸门 8 组合矩阵、config 热更新、错误码注入、probe 并发、写满容量堆增长、档位串槽、熔断跨源污染 | `--expose-gc` | `node --expose-gc test/stress-round3.js` |
| `test/stress-round4.js` | 52 | 压测 V 组压「判据」（第四轮新增）：故障谱系 10 类 × 5 平台 × 3 档 = 150 组零假成功 / 同歌同档 100 并发只外呼 1 次 / 220 首并发无违约 / 缓存 400 首内命中·700 首后 LRU 淘汰 / 熔断全周期 / 限流滑窗 / 降档预算与末档保底 / 随机 2000 次 4 条不变量 / soak 4000 次堆收敛与句柄不累积 / 20 次重载缓存不跨实例 / MISMATCH 拒错歌 / 验真时长三阈值边界 / CONFIG_ERROR / 配置脱敏与写白名单 / logEnabled 静音 / raceBatchSize 串并行 / 音质短路拦停 | 纯 mock 宿主 | `node --expose-gc test/stress-round4.js` |
| `test/candidate-audit-test.js` | 6 | 候选实证流程 | 本地 | `node test/candidate-audit-test.js` |
| `test/audit/q-quickjs-real.js` | 3（可选） | **真 QuickJS 引擎**跑：能否加载 / 宿主是否真没有 Buffer / 无 Buffer 下 JSON 假交付必须判 NOT_AUDIO（D-28 就靠它抓出） | 需 `quickjs-emscripten`，未装自动 SKIP | `NODE_PATH=<装了它的 node_modules> node test/audit/q-quickjs-real.js` |
| `test/mutation/run.js` | 12 变异体 | 五轮新增：把源码改坏一处，看门禁能否发现（只读仓库，在 /tmp 副本上跑）；全量 12 killed / 0 survived | 本地 | `node test/mutation/run.js [--full] [--strict]` |

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
| Z | 资源 | 5 | 加载 <50ms、重复加载堆增长、导出面 19 项、非法入库文件、无 >500KB 单文件（最大 203.45KB） | 同上 |

- 覆盖分母：`git ls-files` 的 **58 个文件 / 14145 行**，未覆盖文件 **0**，矩阵见 [`AUDIT_MATRIX.md`](./AUDIT_MATRIX.md)
- **六组在同一脚本内顺序执行，不支持只跑某一组**（传组名参数会被忽略，实测过）：要定位失败直接看输出行首的 `[U1]`…`[Z5]` 编号
- **改完任何文件都要重跑**：U 组会因行数/BOM/新增文件而红；改文档后顺手把 `AUDIT_MATRIX.md` 的行数同步（`docs-audit` 不校验该表数字）
