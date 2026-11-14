# backend-api

> 与 [`luanmuc/mobile-app`](https://github.com/luanmuc/mobile-app) 配套的内置数据源仓库。
> **App 每次云编译（CI）会自动拉取本仓库根目录 `lx-source.js` 覆盖内置数据源**，因此：
> - 本仓库是唯一权威数据源入口，改数据源只改这里；
> - App 构建直接拉 `master` 的 `lx-source.js`，实际内置版本以构建日志的跨仓版本闸门和 APK 内 `assets/builtin_source.js` 为准；
> - Releases 页是归档入口，不参与构建取源。截至 2026-11-14，`v8.12.1`~`v8.12.5` 已建 tag + Release + `lx-source-vX.js` 资产，`v8.11.7` 已补资产；`v8.13.0` 已推送 master（b116 发布），`v8.13.1` 已随 b125 发布、未单独建 tag；**`v8.14.0` 为当前音质优先与 CI 编排版，已建 tag/Release**；`v8.12.2` tag 的 CI `test` 在 V2 文档门禁红（历史 `DEV_GUIDE` 缺版本串，`probe` 绿，代码/资产不受影响）。

> **免责声明**：本项目仅供学习交流与技术研究。仅做接口聚合，不存储任何媒体文件；第三方接口的可用性与版权责任归相应服务方。使用即代表同意仅限个人学习用途，禁止商用。

## 快速开始

| 事项 | 说明 |
|---|---|
| 当前版本 | **v8.14.0** 音质优先与 CI 编排版：在 v8.13.1 审计修复版之上，落地音质优先播放（App 自定义源只按 `global.lx.qualityList` 选请求档，不再用内置 `_qualitys` 把 flac 错降 128k）；源侧真实交付档回填、片段标记、置信度、`musicUrl` 透出 `qualityCeilingApplied`、缓存按实际档写入；K08 唯一高质源 10min 探路（`qualityShortCircuitUniqueProbeMs`）+ K07 `forceQualityProbe`；源仓 CI 拆 `test-fast` / `stress-long` / `stress-short` 并行；单文件构建（`npm run build`）。`lx-source.js` 内 `@version 8.14.0` |
| 支持平台 | 网易云(wy) / QQ(tx) / 酷我(kw) / 酷狗(kg) / 咪咕(mg) |
| 音质能力 | flac / 320k / 128k（按真实来源能力裁剪上报） |
| 集成方式 | App CI 用 GitHub Contents API 拉 `luanmuc/backend-api/contents/lx-source.js` |
| 发布入口 | 本仓库 **Releases 页**（归档入口）：发布 SOP 要求每次迭代出 tag + 附 `lx-source.js` 产物；`v8.12.1`~`v8.12.5` 与 `v8.11.7` 资产均已归档；`v8.13.0` 已推送 master、b116 已发布；`v8.13.1` 随 b125 发布、未单独归档；**`v8.14.0` 已归档**；`v8.12.2` tag CI 文档门禁红见上 |
| 迭代机制 | 任何豆包账号说「**迭代**」即按 [docs/ITERATION_ROADMAP.md](./docs/ITERATION_ROADMAP.md) 自动推进下一版本；规则见 [docs/AGENTS.md](./docs/AGENTS.md) |

## 在线导入（自定义源）

> 面向其他洛雪音乐用户：设置 → 基本设置 → 自定义源 → 自定义源管理 → 在线导入。

```
https://raw.githubusercontent.com/luanmuc/backend-api/master/lx-source.js
```

加速链接（GitHub 受限时使用）：

```
https://ghproxy.net/raw.githubusercontent.com/luanmuc/backend-api/master/lx-source.js
```

## 音源可用性（2026-11-14 核验）

> 本表 = 本仓库实测基线 + 生态交叉验证；端点级实时健康状态见 [README_HEALTH.md](./README_HEALTH.md)（`scripts/probe.js` 每日自动刷新）。
> 口径：pdone 探测来自 CI 服务器 IP，与本仓库 IP 维度不同，分歧 ≠ 某一方错误（典型：溯音咪咕上游域名可用但本机 IP 被封）。

| 平台 | 可用音质 | 主路子源 | 交叉验证 |
|---|---|---|---|
| 网易云 wy | 128k / 320k / flac | 溯音163 / wyOuter / gdWy | oiapi.net ✅；music.163.com ✅ |
| 酷我 kw | 128k / 320k / flac | 溯音酷我 + 星海后端（双源 v1.0） | oiapi.net ✅；yy.zddyr.top ✅；search.kuwo.cn ❌ ETIMEDOUT；antiserver.kuwo.cn ✅；nmobi.kuwo.cn ❌ ETIMEDOUT |
| QQ tx | 128k（走溯音酷我兜底） | 溯音QQ 关闭 | oiapi.net ❌ 403 被封 |
| 酷狗 kg | 128k（走溯音酷我兜底） | — | —（无独立源，走 kw 兜底） |
| 咪咕 mg | 128k（走溯音酷我兜底） | 溯音咪咕关闭 | api.xcvts.cn ❌ PAYLOAD_NO_URL |

> 详细对照表、缺陷与**各版本当前状态（以 docs/ITERATION_ROADMAP.md 与 DEV_GUIDE 为准）**见 [DEV_GUIDE.md](./docs/DEV_GUIDE.md)。
## 版本历史

> 2026-11-05 版本重新整理：将原 53 个小版本（v11.11 ~ v29.9）按功能模块合并为 8 个大版本。
> 旧版本详细历史归档见 [docs/ARCHIVE_OLD_TAGS.md](./docs/ARCHIVE_OLD_TAGS.md)。
> 2026-11-07 全覆盖审计（96 维矩阵 + 15 项隐性缺陷 + 二次复核 + v8.10.3 修复）的数据资产：计划 [docs/archive/AUDIT_PLAN-v9.0.md](./docs/archive/AUDIT_PLAN-v9.0.md)、报告（含 §9 复核 / §10 修复落点与前后指标对比）[docs/AUDIT_REPORT-2026-11-07.md](./docs/archive/AUDIT_REPORT-2026-11-07.md)、执行轨迹 [docs/AUDIT_PROGRESS-2026-11-07.md](./docs/archive/AUDIT_PROGRESS-2026-11-07.md)。当前审计入口见 [docs/AUDIT_PLAN_v10.md](./docs/AUDIT_PLAN_v10.md)。
> 完整历史与未来新增版本的详细记录见 [docs/CHANGELOG.md](./docs/CHANGELOG.md)。


| 版本 | 核心功能 |
|---|---|
| **v8.14.0 音质优先与 CI 编排**（2026-11-14，已发布） | App 自定义源只按 `global.lx.qualityList` 选请求档，不再用内置 `_qualitys` 把 flac 错降 128k；源侧真实交付档回填、片段标记、置信度、`musicUrl` 透出 `qualityCeilingApplied`、缓存按实际档写入；K08 `qualityShortCircuitUniqueProbeMs` 10min + `countActiveQualitySources`；K07 `forceQualityProbe`；源仓 CI 拆 `test-fast`/`stress-long`/`stress-short` 并行，App CI 四 job + node_modules/Gradle build cache；`lx-source.js` 297671 bytes | 2026-11-14 |
| **v8.13.1 K08/K07 源侧策略**（2026-11-14，本地未推送） | 唯一高质源探路由 1h 缩短为 10min（`qualityShortCircuitUniqueProbeMs`，平台内 active 源 ≤1）；新增 `forceQualityProbe` request action，只放行一轮档位短路；QP9~QP12 12/0，`npm test` rc0，audit 40/40，`verify:bundle` 8/0（297666 bytes） | 2026-11-14 |
| **v8.13.1 音质真实标签补修**（2026-11-14，本地未推送） | m4a/ogg 按 content-length+时长估算码率（≥256kbps→320k、其余→128k）、wav→flac、未知总字节保留请求档；`sniffAudioBytes` 只认可信总字节；全档片段兜底 `fragment: true` + `qualityConfidence: unknown`；新增 `quality-truth` 8/0 | 2026-11-14 |
| **v8.13.1 审计修复版**（2026-11-14，已推送） | 链空错误码回收（限流升级 `RATE_LIMIT`、其余保护态保留 `NETWORK_ERROR` + `isThrottleSkip`）；跨平台兜底遇本地保护直接 settle；e-extra 纳入 19 脚本；L3/L4 夹具与 MU1/MU5 变异门禁收口；`lx-source.js` 288771 bytes | 2026-11-14 |
| **v8.13.0 健康整功能重构**（2026-11-13，已推送，b116） | 开关权威拆分（userEnabled/autoOff/offReason）+ 三值探测（PASS/FAIL/UNKNOWN）+ `playDead` 只认真实播放回传 + 半开只放一个试探 + `controls` 持久化（manualOff 独立；F36/F57 v2 拆独立 control key、仅 v2、无回滚开关） + 统一 `computeEligibility`（含 sleeping 跳过、观察源默认关闭不误报） + `suyinKuwo/helloworldKw/kuwoOfficial/suyinQQ/Juhe 五源/星海后端/ikun/huibq/wyOuter/changqingVip/suyin163/suyinMigu` 探针只走真实 handler（不再回退旧 URL 探针）；`suyinQQ` 观察探针补 320k；`QUALITY_SHORT_CIRCUIT` 并入统一资格入口 + `probeSource` 只读单源探测 + `reportPlayback` + `probeConcurrency` + `getHealthSnapshot` 只读 `eligible/eligibilityCode` | 2026-11-13 |
| **v8.12.4**（P2 负向归因：缺片返回 `TRUNCATED_MEDIA`、`byteLength`/base64 不符返回 `BAD_ENVELOPE`，probe/admit 均保留错误码；X5/X9/X11/X12 先红后绿） | 2026-11-12 |
| **v8.12.3**（2026-11-12） | **P2 桥媒体信封**：App 二进制响应从 `JSON.stringify(Buffer)` 改为 `{__lxMedia:2,encoding:"base64",byteLength}`，>256KB 按 256KB 分片；源侧 `toBytes` 按片独立解码（base64 分片各自带 `=` 填充，拼大串非法）、`byteLength` 不符返回 null；新增 `test/audit/x-media-envelope.js` X1~X8 | 2026-11-12 |
| **v8.12.2**（2026-11-12） | **P1 降级所有权**：`inited.sources[platform].fallbackOwner="source"`，App 对显式声明 source 所有权的源不再启动自己的换源，消除 bundled 源双层跨平台搜索；新增 `test/audit/w-fallback-owner.js` W1/W2 | 2026-11-12 |
| **v8.12.1**（2026-11-11） | **跨平台缓存失效 + 面板开关**：①`toggleSource` 关闭/开启子源时清 10min 跨平台结果缓存；②成功缓存命中若来源已被手动关闭则丢弃重解析；③健康面板只暴露 `crossPlatformEnabled` 总开关（9 布尔/37 键，三语 874）；`u-cross-platform` 9→10（U10 先红后绿） | 2026-11-11 |
| **v8.12.0**（2026-11-11） | **跨平台兜底**：主平台返回 `NOT_FOUND`/同名错歌/网络超时时，按 `tx→wy→kw` 跨平台搜索，严格校验歌名归一 + 歌手分词 + 时长 ±5s，命中后用目标平台自己的 songmid/id/rid 走目标源链；主平台确定性失败立即回退、超时等 6s grace；成功写 10min 跨平台缓存并清主平台失败缓存；新增 `sourcePlatform`/`fallback` 返回字段与 `cross_platform` 健康事件；`juheTx` 按 2026-11-11 实测恢复默认开启。`u-cross-platform` U1~U9 9/9（含慢主平台不被跨平台抢跑误杀） | 2026-11-11 |
| **v8.11.7**（2026-11-10） | **健康面板配置可管**（B 方案）：`config` 写模式新增 8 个布尔键（`verifyDelivery`/`truthfulQuality`/`qualityFloor`/`verifyOnCacheHit`/`previewUrlPreFilter`/`fragmentFallback`/`qualityShortCircuit`/`coldStartWarmEnabled`），严格 `typeof value === "boolean"`——字符串 `"false"` 与数字 0 一律拒绝；数字白名单补齐 `cacheTtlHighQualityMs`、`verify*`、竞速批参数、冷启动族、短路族共 13 键，并补 `PARAM_LIMITS`；`verifyDurRatio`/`verifyDurGapSec` 允许 0（0=关闭该门槛）。`e-extra` K4c 改为「布尔可写并读回」、新增 K4d「拒非布尔」/K4e「新数字键可写」，第二轮审计 92→94 条 | 2026-11-10 |
| **v8.11.6**（当前，2026-11-10） | **收尾加固**：①**链过滤分层**——`buildSourceChain` 改用无副作用的 `structuralSkipReason`，`skipReason` 拆「纯结构 + 运行期」，修「建链提前消耗 half-open 试探」；②**关源清账**——新增 `toggleSource` 唯一入口，开/关都 `clearSourceLedger`；③**fallback 代表码**——删 `mergeCode/aggCode`，改 `attempts + admit({stage:'fallback'})`，`NOT_AUDIO` 不再被 `NOT_FOUND` 吞成 1h 歌级锁；④**HEAD 补证**——GET 无字节且头不足时 `probeByHeaders`（HEAD 1500ms，405 回退 GET Range 0-0），证据 weak→medium；⑤`r-admission` A16~A20 共 **23 条**，注入回退逐条变红 | 2026-11-10 |
| **v8.11.5**（L4 裁决层） | **v8.11.5 L4 裁决层**（2026-11-10）：把散在六处的「判定 + 记账」收成 **一个 `admit()` + 一张策略表（`ADMISSION_POLICY` 七 verdict）+ 三个调用点**（候选执行 `wrapExecute` / 降档聚合 `getUrlWithFallback` / 缓存校验）。核心治三件事：①**全源 `NOT_AUDIO`**——新增 L0 归一层 `toBytes`（认 `view`/数组/`{type:"Buffer",data}`/base64 串），App 桥 `JSON.stringify(Buffer)` 过来的体不再被当「不是音频」；`probeAudioDelivery` 重写为「有字节看字节、无字节看响应头」，拿不到字节不再判死；②**代表码被吞成 1h 歌级锁**——`CODE_RANK` 改为交付类码（`NOT_AUDIO`/`PREVIEW_FRAGMENT`/`STREAM_PLAYLIST`）高于 `NOT_FOUND`，`admit({stage:"fallback"})` 统一聚合，弱证据 TTL 一律 ≤60s；③**关源/重开无效**——`clearSourceLedger()` 按平台前缀清失败缓存 + 复位 playDead/探针/熔断/限流，`toggle` 一处调用。新增 `test/audit/r-admission.js`（18 条，先红 0/11 后绿，K14 补到 18 条）| 2026-11-10 |
| **v8.11.4** | **v8.11.4 错歌兜底修复**（2026-11-10 云端真测 F-01）：`xinghaiBackendGetUrl` 的 `songId ?? getHashOrMid ?? "1"` 在无 id 时兜底成 1 号歌，而该源只按 mid 出链、name 不参与校验 → 必交付别人的音频；片段兜底（B 方案）又只判「是不是 5 秒音频」不判「是不是这首歌」，于是不存在的歌被标成「试听版」交付。现改为：缺 id 直接 `PARAM_ERROR`；B 方案以「有 hash/mid 锚点」为前提，无锚点报错不猜歌。新增 `q-dfix.js` Q5，先红后绿。| 2026-11-10 |
| **v8.11.3** | 源开关失败缓存失效（2026-11-10）：`toggle` 手动开启某源时，旧实现只重置熔断/限流/探测状态，**没清失败缓存**——失败缓存是 `fail_<平台>` 粒度（404 记 1h、410 记 1min），开启新源后仍命中「歌不存在」，新源根本没机会被调用，用户体感是"开了还是不出歌"（D-01）。现按该源声明的 `platforms` 前缀精确失效（未声明平台则全清），并给自建 LRU 补 `keys()`。新增 `test/audit/q-dfix.js` Q3，先红（开启后仍 NOT_FOUND）后绿（开启后 none）。|
| **v8.11.2** | 通读缺陷修复（2026-11-10）：全仓 75 文件逐行通读后，把只读推断的 4 条缺陷变成可跑断言（先红后绿）：①**Juhe 取链恒失败**——上游响应 `code` 时而字符串 `"200"` 时而数字 `200`，旧实现 `d.code === 200` 严格比数字，字符串形态一律落到「响应异常」，该源在这种响应下 100%；现统一 String 归一；②**Juhe 303 重定向校验**——`check.value` 为数字 `200`、响应体为字符串 `"200"` 时严格比类型判失败，改为宽松比；③**降档链跳档**——`flac24bit` 起跑原链是 `[flac24bit, flac, 128k]`，320k 档从未被尝试，改为逐档下降 `[flac24bit, flac, 320k, 128k]`；④**失败缓存永不超时**——`CONFIG_ERROR`（ikun 403 / huibq 未配置 / lingchuan 未配置）不在 TTL 表内，`ttl === undefined` 直接 `return entry`，注释写 5 分钟、实际永久命中，现按 `failCacheDefaultMs`(5min) 过期；⑤删除恒假的每源 mids 上限守卫（比较对象是音质集合，≤4，永远小于 200）。新增 `test/audit/n-fixes.js`（N1~N4）。| **v8.11.1** | 压测加固（2026-11-08）：新增 `test/stress-test.js`（G1 档位矩阵 / G2 30 并发 / G3 探针故障注入 14 种 / G4 duration 边界 / G5 2000 首长跑堆增长 / G6 全档片段兜底 / G7 冷却误伤 / G8 缓存命中开销，共 32 断言）。压测暴露并修复三处：①`httpRequest` 把 `{` 开头文本 parse 成对象后，验真判成 unknown 被「拿不准放行」→ 交付一段 JSON 给播放器（点歌没声），现直接判 `NOT_AUDIO`；②源级限流冷却从「单歌三档全片段」改为「同源 ≥2 首不同歌都全片段」的跨歌证据，避免一首 VIP 歌把同源其他能播的歌一起冷却 5 分钟；③片段直链是临时签名，兜底加 10 分钟 TTL，过期不再拿旧链糊弄；④**交付真实性闸门的 5 个开关 + 4 个阈值此前不在 `USER_CONFIG` 白名单**，`cfg()` 永远返回默认值，「可关闭/可回滚」实际是空话（实测 `__lxSourceConfig.verifyDelivery=false` 完全无效），现已全部纳入白名单（布尔键用 `??` 防 false 被吞）；⑤**单源链绕过预算**：链上只有 1 个源时 `fallbackRace` 直接 `await`，不经 `raceFirst`、不受任何 deadline 约束——实测单源 8s 无响应时 flac 档跑 20.4s、末档 floor 再跑 20.4s，单次点歌 **40.8s**；已给单链分支补单源硬上限，实测降到 **14.0s**；⑥新增交付类错误码补中文可读文案（App 直接展示 message）；⑦**二轮全覆盖审计（57 项）+ 压测重做（10 组）**：抓出 65 处 `throw` 未赋 `err.code`（App 拿 undefined）、歌词超时翻倍到 10.2s、源级冷却导致新歌连片段都拿不到，均已修；留 1 项源级冷却未拦请求待专项排查；**第三轮全仓结构治理 + 全仓审计 + 全新压测**（同日）：58 个 tracked 文件 / 14100 行全覆盖（未覆盖 0），归档 3 份旧报告，`AUDIT_PLAN` 897→430 行并拆出 `AUDIT_RESULTS`（D-01~D-19 缺陷总账），新增 6 份文档（文档地图 / ARCHITECTURE / TESTING / SCRIPTS / CHANGELOG / AUDIT_MATRIX），新增 `test/audit/f-repo.js`（U~Z 六组 50 项）与 `test/stress-round3.js`（T1~T12 只压「态」）；修 D-16~D-19 四个缺陷（`doc-sync-map.js` 顶层 `process.exit` 会静默杀掉 require 它的进程，另 2 个脚本同病同修）；T2/T3 由空断言改为「冷却分支文案 + 1/3 外呼比」并经 red-green 反向验证；13 道门禁 rc 全 0；**第四轮元审计（同日）**：新增 `test/audit/g-meta.js`（M1~M12）**专审断言本身**，抓出 **10 处写死 true 的伪断言**（`a-static` A5/A6/B1、`e-extra` L3/M1/M4/M5/N3/N4/O2/O4），其中 B1（外呼唯一通道）/M1（并发布明确结果）/M4（退避真生效）改成真判据，其余降为不计入通过/失败的 `· note`；M9 抓出 `f-repo` 与 `g-meta` 顶层 `process.exit` 无守卫（同类 D-16）；另修 3 处判据自身错误（M2 误报工具函数的 `typeof`、M4 解析 0 项却报绿、M6 把活键 `raceMatchWaitMs` 当死键）；发现 `docs/audit-plans/round1~3.md` **从未进 git**（本轮连同 round4 一并入库）；回归 a-static 10/0、e-extra 55/0、f-repo 50/0、g-meta 12/0，覆盖 63 文件 / 15338 行；**H 组未测源开启（同日）**：新增 `test/audit/h-toggles.js`（H1~H14）——每条只开一个默认关闭/从未开启的源，mock 按其真实响应形状返回，断言拿到 https 直链且 `subSource` 正确；覆盖 helloworldKw/星海后端/酷我官方/Juhe×5/聆川/gdWy/溯音QQ/溯音咪咕/酷我封面/星海备，**14/0**；首跑全绿后注入 3 处回退（code 200→403、Juhe 200→500、封面清单清空）**三条全红**再还原，排除恒真空断言；新脚本被元审计当场抓 M7（TESTING 未登记）+ M12（输出 ID 格式），修脚本而非放宽判据，`g-meta` 回到 12/0；**O 组覆盖率（同日）**：用 `NODE_V8_COVERAGE` 跑 10 个入口采集 39 份 json，按「覆盖每行行首 offset 的最内层 range」判定（用外层 range 会得出假的「未执行 0 行」），实测未执行代码行 **829/1811 = 45.8%**、208 个未执行区间、137 个函数中 115 个有未执行行；据此补 `e-extra` U500/U410/U404/U429/U403 五条「上游状态码 → 错误码」断言（含错误对象是否真带 `code`），e-extra 50→**55/0**；覆盖率暴露的零执行重点：`httpRequest` 五状态码分支、`truthQ` 降档链、`verifyDelivery` 放行与三类非音频判定、`sniffAudioBytes` 头部解析、`realQuality` 回填、`recordBusinessFail` **整函数从未被调用**，以及 9 个默认关闭源的整条取链接收链；五轮审计审断言（2026-11-09）：变异测试 12 算子 100% killed，INV/EDGE/FAULT/MEM 共 22 条断言（`e-extra` 57→78）；修复 D-20 片段被当 FLAC 交付、D-21 NaN 致实例全部请求超时；22 条断言经注入验证，4 条如实降级 |
| v8.11.0 | 交付真实性闸门（2026-11-08）：①交付前 1KB 字节验真（FLAC STREAMINFO / MP3 Xing 算真实时长），「能播但只有 5 秒」的试听片段不再被当 FLAC 交付——实测 VIP 歌三档统一 84972 字节 / 5.3 秒，修复后全部拒收并换源，同曲最终交付 46,787,765 字节 / 199.4 秒真 FLAC；②音质标签回填真话（请求 flac 实得 128kbps mp3 → 显示 128K）；③降档链修复 128k 终档被截断；④缓存双入口验真 + 移除 helloworld 内层缓存；⑤源级限流识别（同源三档全片段 → 判定被风控，冷却 5 分钟转跨平台）；⑥巡检同判据（probe 片段判定 + 日报片段率单列）；冒烟 60→67 组，新增 probe 时长解析自检（mp3/flac × 完整/片段 4 例） |
| v8.10.12 ~ v8.10.5 | 巡检与治理闭环（2026-11-07 ~ 11-08）：端点登记表单一维护（registry + source-toggles + 三态对齐自检：启用源必须至少有一个登记端点）、candidate-audit 专项、健康日报基准日按端点各取、半开态收口（业务失败 / 429 不得永久滞留 half-open）、huibq 探针形参遮蔽修复、validateUrl 返回 trim 后 URL、可播校验超时不再记 410、LINK_EXPIRED 必须带 err.code、探测素材改为免费歌池轮换 |
| **v8.10.4** | 可播校验错误码修复（2026-11-08）：①`isAudioPlayable` 超时/网络异常不再判死链，改抛 `NETWORK_TIMEOUT`/`NETWORK_ERROR` 等原码 → 弱网走 180s 熔断 + 半开探针自愈（旧实现被当成业务失败，不熔断不冷却）；②三处 `LINK_EXPIRED` 抛错补 `err.code`（旧实现只把码写进 message）→ 410 死链才真正计入 `byQuality.linkExpired` 与 1min 失败缓存；冒烟 55→57 组（T56 超时 / T57 410），均 red-green；冒烟共 67 组 |
| **v8.10.3** | 全覆盖审计修复（2026-11-07）：15 项隐性缺陷全修——①`probeSingleSource` 形参 `cfg` 遮蔽全局 `cfg()`（huibq 唯一冷启动源探针 100% TypeError、请求从未发出）；②429 不再计入 `byQuality.fail`/成功率分母 + 半开遇 429 收口；③降档按**实交付音质**入缓存槽；④失败缓存命中还原代表性 `code`；⑤平台分组改由竞速链生成（消除手写清单漂移）；⑥探针通过一并复位断路器/限流；⑦末档预算上界显式钳制；⑧`validateUrl` 返回 `trim` 后 URL；⑨320k/128k 单档预算 4s→5s 对齐单源超时；⑩删死键 `raceOverallTimeoutMs`、暴露 `raceBudgetMs`；⑪huibq 假成功判据单点化并补进探针；⑫lingchuan 补 `platforms` 声明；⑬A19 备注 20→144；⑭冒烟新增 T50–T55（回退必红），当时 55 组 |
| **v8.10.2** | 记账顺序修复 + 半开收口（2026-11-06）：①`wrapExecute` 改为**先 validateUrl 后 recordSuccess**——旧顺序把"URL 非法"的请求既记成功又记业务失败，成功率/健康分双记账失真；②`recordBusinessFail` 与本地节流分支补**半开收口**：half-open 试探的业务失败/节流跳过一律 `half-open → open` 并刷新 `lastFailureTime`，否则源会永久停在 half-open（`canExecute` 恒 false）；③冒烟新增 T49 断言收口，T46 放宽限流干扰；`recordBusinessFail` 加入测试导出块 |
| **v8.10.1** | 缓存 LRU delete 补修 + 用例真化（v8.10.1，2026-11-06）：`getCachedUrl` 分级 TTL 过期分支调用 `successCache.delete()` 而 LRU 无该方法 → 高音质缓存超 30min 重播必抛 TypeError（实测复现）；补 `delete(key)`；注释/DEV_GUIDE 同步；冒烟 T46/T47/T48 由空壳断言改为真行为验证（T48 先在旧实现复现崩溃再修实现转绿） |
| **v8.10** | 分档预算 + 冷启动豁免 + 缓存分级（2026-11-06）：①分档预算 flac 6s/320k 4s/128k 4s + 末档保底 3s（防高音质吃满总预算饿死低档致点歌无声）；②冷启动源探针超时放宽到 30s + 豁免自动关闭（onrender 冷态 30s 不再被 20min 误摘）；③短路探路窗口 6h→1h（源临时波动后用户不用等 6h 才恢复高音质）；④高音质缓存分级 TTL——flac/320k 30min（原 6h 链接已死仍返回死链），128k 保持 6h；⑤历史快照 60→144（10h→24h，趋势图跨天不断）；新增 5 配置键 + 冒烟 T46/T47/T48 |
| **v8.9** | huibq 平台能力收窄 + 收尾修复（2026-11-06）：实测 tx/mg/kg 必败（"无法获取播放链接"），从三平台链尾移除，仅保留 kw/wy 进链（省 1~1.5s 白耗）；source-audit.js 跑完自动退出（防进程常驻）；hyw 候选状态修正为"已判否（自动复检）" |
| **v8.8** | 竞速引擎改造（2026-11-06）：6 条全做——全链分批错峰并发（消灭"竞速3+串行 rest"）、跨音质档共享 12s 总预算、档位短路（历史 0 成功的档跳过 + 6h 探路）、冷启动源预热与超时放宽（huibq 8s）、gdWy 配额源降后批、verified 精确等待；新增 7 配置键 + 冒烟 T40/T41/T42/T43 |
| **v8.7** | huibq 假成功治理（2026-11-06）：实测上游"无法获取播放链接！"仍返回 `code:0` + 一条可播但不属于该平台的兜底链（酷我 panspace 206）= 静默播错歌；改为按 msg 失败词判失败 |
| **v8.6** | huibq 默认开启（2026-11-06）：全源巡检实测 kw/wy/tx/mg/kg 全平台 flac/320k/128k 均出链可播，纳入 A 方案——五平台链尾兜底 + 探针自动托管（onrender 免费实例冷启动慢，仅前面源全失败时打到） |
| **v8.5** | 巡检工具与监控口径升级（2026-11-06）：新增 `scripts/source-audit.js` 全源取链巡检工具 + `docs/SOURCE_AUDIT.md` 基线（每次巡检对照打勾）；`scripts/probe.js` 对取链型端点加真实取链 + Range 可播二次校验（治理"端点✅但源 410 死链"假阳性，如 xcvts 由假✅转真❌）；huibq 探针补齐；真死域名排除清单更新（移除已复活的 ikunshare） |
| **v8.4** | 全源全接口深度巡检修复（2026-11-06）：逐源真实调用 35 组 → 溯音酷我 128k br 修正（br=7→9，实测唯一可播、flac/320k 为 VIP 死链）；星海后端去无效 X-Token 匿名适配（上游 403"请使用官方版本"）；可用源 15→21/35。剩余失败：xinghaiBackup/lingchuan 域名死（归档）、juheWy/Kg 服务端受限、suyinQQ 403、suyinMigu 上游 IP 被咪咕封（均已默认关闭） |
| **v8.3** | ikun 默认开启（A 方案，2026-11-06）：公益版免卡密，默认进 kw 链尾兜底 + 每 30 分钟自动探测（tier=secondary）+ 探测失败 2 次自动关/恢复自动开自愈闭环；健康面板 kw 平台分组补 ikun |
| **v8.2** | ikun 探针接入 + POST 探测修复（2026-11-06）：默认关闭源补齐健康探针（用户手动开启后自动监控健康：POST `/music/url` 固定歌 + code200/url非空 + Range 可播二次校验，tier=secondary 每3轮一探）；修复 `probeSingleSource` 漏透传 `method`/`body`（juhe 五源/ikun 等 POST 协议型源旧实现实际发 GET → 404/405 误判失败） |
| **v8.1** | 候选实证半自动化：`scripts/candidate-audit.js` 输入候选 URL → 自动 mock 加载 + 静态提取 + 实证报告草案；`scripts/recheck-candidates.js` 判否候选恢复探测（触发式待办自动监控，2026-11-05）<br>ikun 源复活（2026-11-06）：域名 `api.ikunshare.com`→`c.wwwweb.top`、接口 GET `/url`→POST `/music/url`、公益版免卡密（实测 rid=228908 出真实128k链） |
| **v8.0** | 全量审计修复 + 自动健康日报 + App 配合功能（趋势图/配置热更新/平台降级） |
| **v7.0** | 候选源生态：helloworld（kw 高音质竞速）实证接入，fish/hyw/qdy/jiexiang/lx 等候选逐层实证判否 + 自动摘死源（播放连续失败摘除）+ 健康分 10 分制 |
| **v6.0** | 音质协商链 + 全链路审计 + 子源透出（播放页显示「平台·子源名」） |
| **v5.0** | 配置化全参数 + 发布前自检门 |
| **v4.0** | 智能调度：仓库级统计 + 死源建议/自动标记 + 失败归因 + Juhe 源族 + 并发限速 + 自适应探测 |
| **v3.0** | 健康系统雏形：失败原因结构化 + 健康权重 + 竞速校验 + 歌词封面透出 + 健康快照 |
| **v2.0** | 工程化：CI 冒烟 + 巡检 + 协作规范 + 配置化可选源 |
| **v1.0** | 基础四源（kw/wy/tx/mg）+ 高音质双源冗余 + 失败缓存 |

> 完整深度分析、模块地图、已知缺陷与升级规划见 **[DEV_GUIDE.md](./docs/DEV_GUIDE.md)**。
> 后续版本规划（**终极版本三层目标**：第一层"够用了"✅ 已完成；第二层"省心了"✅ 核心功能已达成；第三层"完美了"🔮 价值都不大，暂时不用做）见 [ITERATION_ROADMAP.md](./docs/ITERATION_ROADMAP.md)。

## 发布规范

> 完整发布 SOP（改 `@version` → 实测 → 提交 → Release → 联动 App）见 [DEV_GUIDE.md 第九节](./docs/DEV_GUIDE.md#九发布-sop每次迭代必须走完)，本表只列红线。

1. 每次迭代**必须**更新 `lx-source.js` 文件头 `@version` 与 `@description`（写明本轮变更与实测结论）；
2. 发布前必须跑完 [DEV_GUIDE.md 测试清单](./docs/DEV_GUIDE.md#八测试清单发布前必做)；
3. 需要 App 换新音源时，用 `workflow_dispatch` 触发 `mobile-app` 的 release.yml 构建（push 空提交亦可）。

## 已知失效/关闭源（保留函数便于恢复）

| 源 | 状态 | 说明 |
|---|---|---|
| 溯音QQ | 关闭 | 实测 -403 维护中；上游 oiapi.net 可用，修复即解禁（跟踪中） |
| 溯音咪咕 | 关闭 | 上游 api.xcvts.cn 域名 200 可用（每日巡检确认）；播放接口业务层 502（IP 封禁未解除，2026-10-29 实测）；mg 真源恢复已判否 |
| 星海备 | 关闭 | 域名不可解析 |
| Huibq | **开启**（v8.6，v8.9 收窄） | 仅 kw/wy 实测可播（tx/mg/kg 必败已移出链），链尾兜底；免费实例冷启动慢 |
| 聆川 | 关闭 | 未配置密钥（`USER_CONFIG.lingchuanApiKey`）；v13.1 巡检：域名 api.lingchuan.com 不可解析 |
| ikun | **开启**（v8.3 起，`SOURCE_TOGGLES.ikun = true`） | 公益版免卡密，kw/wy 链尾兜底 + 自动探测自愈；域名已迁至 `c.wwwweb.top`（`api.ikunshare.com` 停用）。填 `USER_CONFIG.ikunApiKey` 可切付费版 |

> 健康探测会自动启用/停用可用源，以上为静态默认值。
