# 测试基建索引（test/）

> **44 个入口**，**没有统一 runner**，逐条跑；CI 必跑子集是 `npm test` 的 **18 个脚本**（冒烟 1 + 审计 17），其余 26 个按需执行。
> **QuickJS 3 条（QR）需 `NODE_PATH` 指向装了 `quickjs-emscripten` 的目录**（CI 在 L66-67 自装）；
> 缺依赖时脚本以**退出码 3** 报「未验证」——**跳过不等于通过，不得计入 363**。
> 断言实测（2026-11-13 当前工作树）：冒烟 **67 组** + 压测 **159 条**（12/14/**133**）+ 审计断言按各脚本输出汇总（本轮新增 health-snapshot **11/0**、health-probe-batch2 **9/0**、health-eligibility-batch3 **9/0**）；历史 429/655 是旧口径，不再作为当前总数。逐入口明细见下方「入口总表」。变异体 **22 个**（`--full --strict` 全量 **22 killed / 0 survived**，2026-11-13 实测）。
> 铁律：截图式的"一堆绿字"不算证据，**退出码 + 通过/失败计数**才算。取退出码必须取被测命令本身，不能取管道末端的 `tail`/`grep`。

## 〇、CI 覆盖（`.github/workflows/ci.yml`）

三套压测**全部**在 CI 里跑，不是只在本地跑：

| 步骤 | 门禁 | 断言 |
|---|---|---|
| L4 | `node test/audit/r-admission.js` / `node test/audit/u-cross-platform.js` / `node test/audit/v-cross-platform-stress.js` | 23 + 15 + 13（L4 裁决层 + 跨平台兜底 + 跨平台压力） |
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
| `test/audit/q2-dseries.js` | 3 | D 系列剩余行为断言：R1 D-06 布尔键 `??`（注入 false 必须取到 false）、R2 D-05 真键可写/死键忽略、R3 v8.13 观察源 `suyinQQ` 手动开启后仍不进 tx 链（tx 链含 `juheTx`）；三条均已注入回退验证会红 | 宿主桩 + `__debug.cfg` + `buildSourceChain` | `node test/audit/q2-dseries.js` |
| `test/audit/n-fixes.js` | 4 | 六轮新增：通读推断缺陷的红绿回归（N1 Juhe code 字符串 / N2 Juhe 303 校验值类型 / N3 flac24bit 起跑保留 320k / N4 CONFIG_ERROR 5 分钟过期） | mock 宿主 + `__debug` 只读钩子 | `node test/audit/n-fixes.js` |
| `test/audit/s-health-events.js` | **22** | 2.4 方案：`healthEvents` 只读环形缓冲（schema/capacity 500/dropped）、成功链 `play_start`→`source_attempt`→`source_result`、失败链 `ok:false` 且 code 非空、探测与开关事件、同 traceId 串联、返回副本不回写、隐私边界（不含歌名/URL）、超容丢弃 | mock 宿主 + `__debug` | `node test/audit/s-health-events.js` |
| `test/audit/t-health-events-stress.js` | **12** | 2.4 方案压力：10000 条灌满后容量 500/dropped 9500/seq 单调、同 trace 链、limit 边界、副本、非法参数、字段白名单、隐私注入、读取吞吐 | mock 宿主 + `__debug` | `node test/audit/t-health-events-stress.js` |
| `test/audit/h-toggles.js` | 8 | v8.13 口径：helloworldKw / 星海后端 / 酷我官方 / Juhe(tx) / changqingVip 开启后最小可用性；两个观察源手动开启仍不进链但探测可见；酷我封面透出 | mock 宿主 | `node test/audit/h-toggles.js` |
| `test/audit/f-repo.js` | 52 | 三轮新增：全仓 **72** 文件静态合规 + 交叉引用 + 脚本自洽 + 功能联动 + 残留死码 + 资源启动（详见下方「f-repo 六组」） | 读文件 + 子进程 | `node test/audit/f-repo.js` |
| `test/audit/g-meta.js` | 14 | 四轮元审计：恒真断言/空壳断言/自指/导出面真实性/死键回流/入口登记/退出码链路/require 安全/口径统一/输出可定位 | 读文件 + 子进程 | `node test/audit/g-meta.js` |
| `test/stress-test.js` | 12 | 压测 S 组压「量」：并发/预算/配额/熔断/缓存容量/长跑/极端参数/闸门对照/定时器 | `--expose-gc` | `node --expose-gc test/stress-test.js` |
| `test/stress-round3.js` | 14 | 压测 T 组压「态」：跨档总预算、源级冷却与本地限速分离、片段翻转、闸门 8 组合矩阵、config 热更新、错误码注入、probe 并发、写满容量堆增长、档位串槽、熔断跨源污染 | `--expose-gc` | `node --expose-gc test/stress-round3.js` |
| `test/stress-round4.js` | **133** | 压测 V 组压「判据」（第四轮新增）：故障谱系 10 类 × 5 平台 × 3 档 = 150 组零假成功 / 同歌同档 100 并发只外呼 1 次 / 220 首并发无违约 / 缓存 400 首内命中·700 首后 LRU 淘汰 / 熔断全周期 / 限流滑窗 / 降档预算与末档保底 / 随机 2000 次 4 条不变量 / soak 4000 次堆收敛与句柄不累积 / 20 次重载缓存不跨实例 / MISMATCH 拒错歌 / 验真时长三阈值边界 / CONFIG_ERROR / 配置脱敏与写白名单 / logEnabled 静音 / raceBatchSize 串并行 / 音质短路拦停 / 冷启动预热开关与 TTL（预热计数按 URL+timeout 双键，隔离同 URL 健康探针） | 纯 mock 宿主 | `node --expose-gc test/stress-round4.js` |
| `test/candidate-audit-test.js` | 6 | 候选实证流程 | 本地 | `node test/candidate-audit-test.js` |
| `test/audit/q-quickjs-real.js` | 3（可选） | **真 QuickJS 引擎**跑：能否加载 / 宿主是否真没有 Buffer / 无 Buffer 下 JSON 假交付必须判 NOT_AUDIO（D-28 就靠它抓出） | 需 `quickjs-emscripten`，未装自动 SKIP | `NODE_PATH=<装了它的 node_modules> node test/audit/q-quickjs-real.js` |
| `test/audit/r-admission.js` | **23** | L4 裁决层：桥序列化体归一 / 无字节凭头判 PASS / JSON 头判 NOT_AUDIO / 5 秒片段 / API 试听标记 / 代表码优先级（NOT_AUDIO 不被 NOT_FOUND 吞）/ weak 证据 TTL≤60s / clearSourceLedger / 裁决幂等 / skipReason / 片段与试听标记边界（A2b/A3b/A3c）/ K14 新增 A9~A15：probe 四种状态映射、交付体四形态、verify medium 尺寸比、admit delivery 全分支、clearSourceLedger 逐档归零、5xx→hardFail→recordFailure；A16~A20（v8.11.6 收尾）：链过滤与 skipReason 同源、关源清账对称、fallback 按 codeRank 取代表码、GET 无字节 HEAD 补证、非 strong 证据 TTL 全遍历 | 纯 mock 宿主，不外呼 | `node test/audit/r-admission.js` |
| `test/audit/health-transition-events.js` | **7** | F33 状态迁移事件：U1 字段完整 · U2 状态枚举 · U3 transition 不被 probe 洪水挤掉 · U4 溢出只压 probe · U5 auto_on 只发一次 · U6 无敏感字段 · U7 容量恒 500 | `__debug.recordHealthEvent`/`applyProbeResult` | `node test/audit/health-transition-events.js` |
| `test/audit/health-eligibility-batch3.js` | **9** | Batch 3 统一 Eligibility：C1 open 不入链 · C2 限流不入链 · C3 半开在飞不入链/未飞可入 · C4 建链只读不推进 trial · C5 skipReason 同 reducer · C6 preview 冷却不入链 · C7 质量短路可见 · C8 正常源带 eligibility · C9 建链稳定不写事件 | `computeEligibility`/`buildSourceChain`/`skipReason`/`breakerMap`/`previewCooldownMap` | `node test/audit/health-eligibility-batch3.js` |
| `test/audit/health-probe-batch2.js` | **9** | Batch 2 探测/质量档：B1 三档齐且全走 handler · B2 每 target 一条事件无 URL · B3 flac FAIL+128k PASS 只降级不关源 · B4 UNKNOWN 不关源 · B5 全 FAIL 两轮才关 · B6 探测不清 playDead · B7 单源只读/显式 apply · B8 快照逐档结果脱敏 · B9 transition 优先 | `buildProbeConfig`/`__debug.probeSingleSource`/`applyProbeResult`/`getHealthSnapshot` | `node test/audit/health-probe-batch2.js` |
| `test/audit/health-authority-split.js` | **9** | Batch 1 开关权威：A1 手动关闭只写 user · A2 用户关闭探测不能开 · A3 连续 FAIL 只写 autoOff · A4 自动恢复 · A5 UNKNOWN 不关源 · A6 controls 导出/恢复保留手动关闭与 offAt · A7 默认关闭/休眠可区分 · A8 offAt 与 reason 同源 · A9 runtimeToggles 仅派生镜像 | `__debug.toggleSource`/`applyProbeResult`/`getHealthSnapshot`/`exportHealthState`/`restoreHealthState` | `node test/audit/health-authority-split.js` |
| `test/audit/health-state-machine-v2.js` | **10** | 方案 6.2 状态机：M1 链项 eligibility · M2 USER_OFF 最高 · M3 AUTO_OFF 只认 FAIL · M4 探测不清摘除 · M5 单档隔离 · M6 短路可见 · M7 休眠优先 · M8 快照同源 · M9 只读 · M10 未知源 | `__debug.computeEligibility`/`buildSourceChain`/`getHealthSnapshot` | `node test/audit/health-state-machine-v2.js` |
| `test/audit/health-probe-fidelity.js` | **10** | F20/F22 探测保真：F1 逐目标三值 · F2 全 FAIL · F3 超时 UNKNOWN · F4 POST 透传 · F5 check 生效 · F6 可播校验 · F7 单源隔离 · F8 不写质量账 · F9 不清摘除 · F10 事件无 URL | `__debug.probeSingleSource` + `lx.request` mock | `node test/audit/health-probe-fidelity.js` |
| `test/audit/health-probe-outcome.js` | **9** | F20/F22 探测三值：O1 单档 PASS · O2 404=FAIL · O3 超时=UNKNOWN · O4 任一 PASS 源级 PASS · O5 全 FAIL · O6 全 UNKNOWN · O7 UNKNOWN 不累计失败 · O8 PASS 不清 playDead/resolveDead · O9 事件无 URL | mock 宿主 `lx.request` + `__debug.probeSingleSource`/`applyProbeResult` | `node test/audit/health-probe-outcome.js` |
| `test/audit/health-persistence-v2.js` | **8** | F36/F57 持久化 v2：P1 v2 结构 · P2 v1 拒绝 · P3 controls-only 不绑 sourceVersion · P4 controls-only 不恢复健康元数据 · P5 autoOff 6h 复验 · P6 始终 v2 · P7 版本/未知源/容量/禁止字段 · P8 导出无 URL/歌名/缓存 | mock 宿主 + `__debug` | `node test/audit/health-persistence-v2.js` |
| `test/audit/aa-p3-persist.js` | **10** | P3 宿主持久化 v2：A1 导出 v2 结构/controls · A2 合法状态往返一致 · A3 含 `successUrl` 必须拒绝 · A4 版本/过期/超容量拒绝 · A5 restore 不写 `successCache/failCache` · A6 档位短路恢复 · A7 controls 权威 · A8 v1 拒绝 · A9 controls-only 不绑 sourceVersion · A10 始终 v2 | mock 宿主 + `__debug` | `node test/audit/aa-p3-persist.js` |
| `test/audit/u-cross-platform.js` | **15** | v8.12.1 跨平台兜底 + 缓存失效 + v8.12.4 覆盖补证（按脚本实际 `rec()` 编号）：U1 转 tx 并交付 Michita 原版 / U2 严格匹配 302s 原版（拒绝 remix/翻唱/同名异歌手）/ U3 kw 主平台成功且未搜 QQ / U4 `subSource=juheTx` / U5 二次命中缓存、平台仍 tx、无新搜索 / U6 全平台无匹配抛 `NOT_FOUND` / U7 留下 `cross_platform` 事件 / U8 tx 源只收到 songmid、无 kw rid / U9 慢主平台最终交付 kw，不被跨平台失败提前判死 / U10 关闭目标源后不得再交付其缓存 / U11 wy 候选归一化后按 id 交付 / U12 kw 候选归一化后按 rid 交付 / U13 跨平台目标顺序 tx>wy>kw / U14 mg/kg 不再作为跨平台目标 / U15 mg 经 suyinKuwo 实际交付酷我 CDN 时 `sourcePlatform` 必须回填 `kw` | mock 宿主 | `node test/audit/u-cross-platform.js` |
| `test/audit/w-fallback-owner.js` | **2** | v8.12.2 P1 降级所有权：W1 `inited` 已上报 / W2 5 个平台均显式声明 `fallbackOwner="source"` | mock 宿主 | `node test/audit/w-fallback-owner.js` |
| `test/audit/x-media-envelope.js` | **11** | v8.12.4 P2 桥媒体信封：X1 64B body SHA / X2 64B FLAC 信封 `kindOf=audio` / X3 1MiB / X4 8MiB 32 片 / X5 `byteLength` 不符返回 `BAD_ENVELOPE` / X6 旧 `{type:"Buffer",data}` 兼容 / X7 `inited.mediaEnvelope=2` 能力声明 / X8 0 字节零长 / X9 缺片 `TRUNCATED_MEDIA` / X10 1B/1KB roundtrip / X11 缺片进入 admit / X12 1MiB `JSON.parse` ≤10ms | mock 宿主 | `node test/audit/x-media-envelope.js` |
| `test/audit/v-cross-platform-stress.js` | **12** | v8.12.1 跨平台压力（V 组）：V1 20 并发同歌 20/20 tx / V2 并发 QQ 搜索不放大 / V3 50 次顺序同歌只搜 1 次 / V4 201 首不同歌缓存上限清空后仍可交付 / V5 总开关关闭零跨平台 / V6 关源不交付缓存、重开恢复 / V7 30 次 remix-only 全拒绝 / V8 主/跨交替 40 次标签不串 / V9 目标全 5xx 保留主平台 NOT_FOUND / V10 10 并发慢主平台全部 kw / V11 `cross_platform` 事件 ≥5 且无歌名/URL / V12 100 首主命中零跨平台 | mock 宿主 | `node test/audit/v-cross-platform-stress.js` |
| `test/audit/y-provider-contract.js` | **15** | v8.13 Provider Contract：12/10/2 预算、key 对齐、上游族唯一、qualitys/platforms/chain、active 必须有链位次、probation 无链位次且默认关闭 + reviewAt、覆盖缺口、非法契约拒绝加载 | mock 宿主 + `validateProviderContracts` | `node test/audit/y-provider-contract.js` |
| `test/audit/s-source-lifecycle.js` | **14** | v8.13 生命周期治理：三份治理文档存在、增源七步/减源五条/一进一出、`source-inventory --check`、退役源清零、版本 8.13.0 | 读文件 + 子进程 | `node test/audit/s-source-lifecycle.js` |
| `test/audit/z-cancel.js` | **10** | v8.13 协作式真取消：预取消零外呼、请求中取消调用宿主 `lx.request` 返回的取消句柄、race 取消全部 launcher、wrapExecute 前后检查、取消不写熔断/失败计数、观察源不进链 | mock 宿主 + `__debug` | `node test/audit/z-cancel.js` |
| `test/mutation/run.js` | 22 变异体 | 五轮新增：把源码改坏一处，看门禁能否发现（在临时副本上跑）；2026-11-13 `--full --strict` 全量（MU19 锚点已随 `revertHalfOpenOnSkip(id,quality)` 更新） **22 killed / 0 survived**；变异器改为改 `src/*` 后重建再跑门禁，22 个锚点全部命中；2026-11-10 曾因对压缩产物打锚点出现 skipped，已消除 | 本地 | `node test/mutation/run.js [--full] [--strict]` |

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
node scripts/verify-real-platform-chains.js  # G7 平台 ID 链：先搜 songmid/id，再隔离 tx/wy 取链
```

- `tools/live/host.js` 是**真宿主桩**：按 lx 移动端 `request(url, opts, cb)` 契约实现，真 https，支持 `timeout/method/headers/follow_max/binary`，302 手动跟链并记 `hops`；每次调用落 `{url, status, ms, hops, range}`。
- 计数口径：`fullCalls()` **排除 Range 请求**、`rangeCalls()` 单独计——因为交付前的 1KB 验真本身就是一次外呼，不二分会把「验真」误判成「又解析了一次」。
- 这几个分支**会真连上游**，结果随上游存活波动；用例本身是固定夹具（含 `NOSONG`/`FRAG_SONG`/`FREE2`），失败要先按「上游 vs 本仓逻辑」归因再动手。
- `verify-real-platform-chains.js` 是 G7 专用：先走 QQ/网易真实搜索拿 `songmid`/`id`，再分别隔离 `juheTx`、`wyOuter`，避免跨平台兜底掩盖原生结果；失败时保留上游码（如 Juhe 303 目标 vkeys 503、溯音QQ -403），不伪造交付。2026-11-13 复测：vkeys 直连不带 `quality` 可返回 60 秒试听（ffprobe 60.029s / 960887 bytes），但 `quality=6` 仍 503；源侧连续 5 次 `NOT_FOUND`，只能算 tx 间歇试听，不能算完整原生链。
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

## 发布门禁未闭环（2026-11-13）

- **G2 真机验收：blocked**。云主机无 `adb`、无 `/dev/kvm`、`ANDROID_HOME` 未设置；`scripts/health_device_acceptance.sh --dry-run` 返回 3。未执行真机 UI 验收，不得写成通过。
- **G7 tx 完整链：blocked**。上游约 60 秒试听；代码只能识别 `PREVIEW_FRAGMENT` 并回退，不能证明完整曲目。
