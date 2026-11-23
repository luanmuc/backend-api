# backend-api

> 与 [`luanmuc/mobile-app`](https://github.com/luanmuc/mobile-app) 配套的内置数据源仓库。
> **App 每次云编译（CI）会自动拉取本仓库根目录 `lx-source.js` 覆盖内置数据源**，因此：
> - 本仓库是唯一权威数据源入口，改数据源只改这里；
> - App 构建直接拉 `master` 的 `lx-source.js`，实际内置版本以构建日志的跨仓版本闸门和 APK 内 `assets/builtin_source.js` 为准；
> - Releases 页是归档入口，不参与构建取源。截至 2026-11-15，`v8.12.1`~`v8.12.5` 已建 tag + Release + `lx-source-vX.js` 资产，`v8.11.7` 已补资产；`v8.13.0` 已推送 master（b116 发布），`v8.13.1` 已随 b125 发布、未单独建 tag；**`v8.14.0` 为音质优先与 CI 编排版，已建 tag/Release；`v8.14.1` 为 HDM-3 健康数据分层版（已随 App b129 发布）；`v8.15.0` 为预算边界与归因版（已推送 master，已建 tag `v8.15.0`，未单独建 Release 资产）；`v8.15.1` 为契约与死配置收口版（已推送 master 并建 tag `v8.15.1`：健康态源版本兼容、删除 2 个死键/4 个死模板/未消费 timeoutMs、工具链与 require 安全收口）；`v8.12.2` tag 的 CI `test` 在 V2 文档门禁红（历史 `DEV_GUIDE` 缺版本串，`probe` 绿，代码/资产不受影响）。

> **免责声明**：本项目仅供学习交流与技术研究。仅做接口聚合，不存储任何媒体文件；第三方接口的可用性与版权责任归相应服务方。使用即代表同意仅限个人学习用途，禁止商用。

## 快速开始

| 事项 | 说明 |
|---|---|
| 当前版本 | **v9.3.2** R82 注释订正版：把 `src/core/35-source-switch.js` 里「runtimeToggles 的 Proxy 是 R80 真机根因」的旧注释改为 K41/K42 的实证结论（真根因是 `Date` 被包成 Proxy + 宿主 preload 冻结 `Date.parse`）。运行行为零改动，产物 **397273 bytes** / 7654 行，`lx-source.js` 内 `@version 9.3.2` | 上一版 **v9.3.1** R81 真机 Proxy 兼容修复版（`Date.parse` → 纯算术 `parseYmdToMs`，`r81-proxy-compat` 6 条守卫，产物 396999 bytes）；此前 **v9.3.0** R80 Audius 第 6 平台 `au`（`GET /v1/tracks/{id}` 校验 `is_streamable` 后回 `/stream` 链，预算 **15 登记 / 13 上链 / 2 观察**）；**v9.2.0** R79 落月 tx + 星海主备域（392277 bytes）；**v9.1.7** 源级能力备档 K03（386202 bytes） |
| 支持平台 | 网易云(wy) / QQ(tx) / 酷我(kw) / 酷狗(kg) / 咪咕(mg) / Audius(au) |
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

## 音源可用性（2026-11-23 核验）

> 本表 = 本仓库实测基线 + 生态交叉验证；端点级实时健康状态见 [README_HEALTH.md](./README_HEALTH.md)（`scripts/probe.js` 每日自动刷新）。
> 口径：pdone 探测来自 CI 服务器 IP，与本仓库 IP 维度不同，分歧 ≠ 某一方错误（典型：溯音咪咕上游域名可用但本机 IP 被封）。

| 平台 | 可用音质 | 主路子源 | 交叉验证 |
|---|---|---|---|
| 网易云 wy | 128k / 320k / flac | 溯音163 / wyOuter | oiapi.net ✅；music.163.com ✅ |
| 酷我 kw | 128k / 320k / flac | 溯音酷我 + 星海后端（双源） | oiapi.net ✅；yy.zddyr.top ✅；search.kuwo.cn ❌ ETIMEDOUT；antiserver.kuwo.cn ❌ ETIMEDOUT；nmobi.kuwo.cn ❌ ETIMEDOUT |
| QQ tx | 128k（走溯音酷我兜底） | 溯音QQ（观察态）/ 聚合 tx | oiapi.net ❌ HTTP 404 |
| 酷狗 kg | 128k（走溯音酷我兜底） | — | —（无独立源，走 kw 兜底） |
| 咪咕 mg | 128k（走溯音酷我兜底） | 溯音咪咕（观察态） | api.xcvts.cn ✅ |

> 详细对照表、缺陷与**各版本当前状态（以 docs/ITERATION_ROADMAP.md 与 DEV_GUIDE 为准）**见 [DEV_GUIDE.md](./docs/DEV_GUIDE.md)。
## 版本历史

> 2026-11-05 版本重新整理：将原 53 个小版本（v11.11 ~ v29.9）按功能模块合并为 8 个大版本。
> 旧版本详细历史归档见 [docs/ARCHIVE_OLD_TAGS.md](./docs/ARCHIVE_OLD_TAGS.md)。
> 2026-11-07 全覆盖审计（96 维矩阵 + 15 项隐性缺陷 + 二次复核 + v8.10.3 修复）的数据资产：计划 [docs/archive/AUDIT_PLAN-v9.0.md](./docs/archive/AUDIT_HISTORY.md)、报告（含 §9 复核 / §10 修复落点与前后指标对比）[docs/AUDIT_REPORT-2026-11-07.md](./docs/archive/AUDIT_REPORT-2026-11-07.md)、执行轨迹 [docs/AUDIT_PROGRESS-2026-11-07.md](./docs/archive/AUDIT_PROGRESS-2026-11-07.md)。当前审计入口见 [docs/AUDIT_PLAN_v10.md](./docs/AUDIT_PLAN_v10.md)。
> 完整历史与未来新增版本的详细记录见 [docs/CHANGELOG.md](./docs/CHANGELOG.md)。


| 版本 | 核心功能 |
|---|---|
| **v9.3.2**（当前，2026-11-23，R82） | **注释订正** | `src/core/35-source-switch.js` 的「runtimeToggles Proxy 是 R80 真机根因」旧注释改为 K41/K42 实证结论（`Date` 被包成 Proxy + 宿主 preload 冻结 `Date.parse`）；同版补 `KNOWN_ISSUES` K43（reviewAt 到期提醒）。运行行为零改动，`@version 9.3.2`，产物 397273 bytes / 7654 行 |
| **v9.3.1**（2026-11-23，R81） | **真机 QuickJS Proxy 兼容** | 真机 v9.2.0/v9.3.0 一进初始化就弹 `proxy: inconsistent get`（栈 `checkFresh` → `validateProviderContracts` → `legacy.js`），根因是复核日校验用了 `Date.parse`：真机引擎（`wrapper-android 2.4.0` 内嵌 QuickJS 2024-02-14，so 里带 `proxy: inconsistent get` 消息）把 `Date` 包成 Proxy，宿主 `freezeObjectProperty(globalThis)` 又把 `Date.parse` 冻成 non-configurable/non-writable，读它必撞 Proxy invariant；V8/Node/旧版 QuickJS 不校验这条，本地永远绿。改为纯算术 `parseYmdToMs`（Howard Hinnant days_from_civil，不碰任何 Date 静态方法），12 例（闰年/跨纪元/非法输入）与 `Date.parse` 逐例等价；新增 `r81-proxy-compat` 6 条守卫（产物去注释后 `Date.parse`/`new Proxy` 必须为 0）。`@version 9.3.1`，产物 396999 bytes / 7654 行 |
| **v9.3.0**（2026-11-23，R80） | **接入 Audius 第 6 平台 `au`** | `src/providers/audius.js`（`id: audius` / `platforms: ["au"]` / `chain {au:1}` / 128k·320k / `reviewAt 2026-11-23`）；`25-handlers.js` 增 `audiusGetUrl`（校验 `data.id===id` 且 `is_streamable===true`，不跟随 302，只回 `/stream?app_name=LxSource` 链）；App 侧 `src/utils/musicSdk/au/*` 与 `sourceLabel`、三语 1047 键。预算 **15 登记 / 13 上链 / 2 观察**，端点表 23 条。`@version 9.3.0`，产物 395916 bytes |
| **v9.1.2**（2026-11-19） | **门禁与断言加固** | 9 条 P1：①`docs-audit` 有 🔴 即 exit 1（此前恒 0）②`verify-real-*` 加 `--require-all-ok` ③`sign-release` 加 `--require-key`，CI 缺钥显式失败 ④`v9-gate fast` + `equiv-snapshot --fast` 进 test-fast，App 稀疏检出后跑 X/P 跨仓校验 ⑤`tools/live` 清理 4 个退役源、L6 改按「源×档」计熔断 ⑥provider contract tx 行三源口径 ⑦`a-static` B6 异步拒绝必须结构化错误码 ⑧`b-logic` C10 外呼 ≤ 4 |
| **v9.1.2 发布流程补充**（2026-11-19，同版本不升号） | **签名 manifest 入库 + CI 自动同步**：①`.gitignore` 放行 `lx-source.js.manifest.json` 并入库——jsDelivr 不服务 GitHub Release assets，manifest 只放 Release 时 App 的 CDN 兜底通道根本拉不到；②`sign-release.js` 删除 `signedAt`（manifest 唯一非确定性字段，否则每天产生一次无意义签到提交）；③`ci.yml` 签名后自动提交 manifest 回 master（`[skip ci]`，push 失败 exit 1）；④`purge-cdn` 同时刷新 `lx-source.js` 与 `.manifest.json` 两个 URL（只刷一个会「脚本新 / manifest 旧」错配误拒） |
| v9.1.1（2026-11-18） | **探针参数修复**：巡检调用真实 handler 时第 2 参（songId）写死空串 `""`，而各 handler 取 id 都是 `songId ?? songInfo?.id` —— `??` 只对 null/undefined 生效，空串被当成"有值"选中后 `if (!id)` 抛 `PARAM_ERROR`（0~1ms、一个字节都没发），于是 `wyOuter` / `xinghaiBackend` / `suyin163` 探测 100% 假失败，健康分每轮被白扣 6 次（真机 digest 的 probe 3/9 即此）。现传 `null` 让 handler 的 songInfo 兜底生效；`suyin163` / `suyinMigu` 的「songInfo 风格」错配（5 参包装被两参调用）改走 5 参路径。`RF24` 门禁（负向+正向自检）。`@version 9.1.1`，产物 364168 bytes |
| v9.1.0（2026-11-18） | **缓存可用性判据**：`13-chain-helpers` 跨平台缓存命中前 `isAudioPlayable(cachedUrl, 2000)` 探测，探不过 `deleteCrossFallbackCached` 清理后继续走链路；新增该 API（key 构造留在模块内，调用方不拼 key）；`RF22` 静态门禁（含负向自检）。与 App v1.9.2-b155 配套（App 侧三处 URL 缓存命中点同样加判据）。`@version 9.1.0`，产物 363581 bytes |
| **v9.0.0**（2026-11-18，已被 v9.1.0 接续） | **模块化拆包 + 发布签名 + 版本区间语义**：6272 行单文件 → 1290 行 legacy + 33 个 `src/core` 模块（依赖注入 `bindDep/dep`，110 条注册）；新增 `sign-release.js`（Node 内置 crypto 的 ed25519，零新依赖）与 `ci.yml` `sign-release` job；新增 `layer-check.js`(L1–L6)、`cross-repo-version.js`(X1–X5)、`schema-parity.js`；`18-health-persist` 改纯区间判定（撤掉 7 元素白名单）；`v9-gate.sh` 重写为 `--group fast/core/stress`。`@version 9.0.0`，产物 362008 bytes |
| **v8.16.4**（2026-11-17） | **播放摘除档位归因（疑-31）**：`playDeadStreak` 原只按 `sourceId` 累计，一档播不了（典型是高档解码失败/大文件分片失败）三次就把整源连 128k 保底一起摘 5 分钟，而"播放成功才解除"的路径又被摘除挡住 → 半开试错死等。修法：`bumpPlayDead(sourceId, quality)` 记录触发档 `playDeadQuality`；`isPlayDead()` 在「请求档 ≠ 触发档 且该档 `success>0`」时放行且不消费 trial；失败跨档置哨兵 `"*"` 表示源级、永久不豁免（直到真实播放成功清零）；快照导出 `playDead.quality` 并回填（旧快照为 null = 源级，保守）。门禁：`readthrough-fixes` **21/0**（新增 RF21）、`y-provider-contract` 16/0、`verify:bundle` 8/0。`@version 8.16.4`，产物 6083 行 / 320161 bytes |
| **v8.16.3**（2026-11-17） | **本地拦截码收口**：①R-13 `skipReason` 改走 `peekRuntime:true` 只读分支——旧实现会落到 `canExecute` 的可写分支，把冷却已满的 open 档推进 half-open 并置 `trialInFlight`，等于问一句「为什么跳过」就把该档 60s 内唯一的试探名额烧掉；②`PLAYBACK_FAILED` 升一等码：补 `ERROR_CODES`/`CODE_HINT`/TTL=0/`CODE_RANK=1`，新增 `verdictOfCode → PLAYBACK_DEAD` 与 `ADMISSION_POLICY.PLAYBACK_DEAD`（`health:skip`，`applyAdmission` 直接返回不记账），`computeEligibility` 与 `wrapExecute` 改引用常量，日志里「本地拦截」不再被兜底显示成 `NETWORK_ERROR`；③`y-provider-contract` 增 Y16：`PROVIDER_SPECS.all` 与 `SOURCE_HANDLERS` 逐 id 比对 `lifecycle/platforms/chain/upstreamGroup/auth/maxQuality/qualitys/coldStart/reviewAt/name` 并双向覆盖。门禁：`readthrough-fixes` 20/0（RF1~RF20）、`y-provider-contract` 16/0、`verify:bundle` 8/0、`source-inventory --check` 通过。`@version 8.16.3`，产物 6060 行 / 318733 bytes |
| **v8.16.0 审计包落地（口径门禁 + 干净检出可验）**（2026-11-16，本地） | 新增 `test/audit/tg-truth.js`（源数/入口数/脚本数/绝对路径/版本串/CI 覆盖 `src/**`）并接入 `npm test`；`tools/live/run.js` 断言 20→13、与 `a-static.js` 一起去掉会话根硬编码；`ci.yml` push.paths 增 `src/**`；`verify-bundle` 在 dist 缺失时就地重建（新 clone 不再必红） | 2026-11-16 |
| **v8.16.0 修 CI 红（require 安全环境侧依赖）+ M9c**（2026-11-16，已含在 v8.16.0 发布范围内） | 源仓 CI 三次 push 全红但本地全绿：`build-source` 顶层 require esbuild（CI `npm ci --ignore-scripts` 无二进制）、`verify-bundle` 顶层断言 + 顶层 require 未入库 `dist/`。改为惰性 require / 断言收进 `main()`；新增 M9c 静态判据（顶层外部包必须惰性、未入库产物必须进 main） | 2026-11-16 |
| **v8.16.0 判否候选复核 R43**（2026-11-16，已含在 v8.16.0 发布范围内） | hyw 复测：首页 200 但业务 `/api/music/url` 返回 401「需要卡密」+ `cardKeyRequired:true` → **维持判否（付费门）**；`recheck-candidates.js` 修误报（首页 200 不再算恢复，新增业务探测与 `paid` 状态，内建自检 RC1~RC4） | 2026-11-16 |
| **v8.16.0 接入晴亮 tx 源**（2026-11-15，已推送 master + tag `v8.16.0` + Release 资产） | 新增 `qingliangTx`（晴亮 tx 线路，第三方单点）为 tx 第二源：登记 12→13、上链 10→11；`juheTx` 连续 7 天 0% 降为 tx 第三源；取链必带 `Referer`，超时/竞速/预算/取消全交本仓框架（不复刻候选自带 3s 内层超时）；判据自审 R23~R38 一并入账 | 2026-11-15 |
| **v8.15.1 门禁欠账与纵深补齐（R21/R22）**（2026-11-15，已推送） | `aa-p3-persist`(A1~A10) 与 `v-eligibility`(V1~V7) 两条从未进任何门禁的断言补入 `npm test`（23→**25 脚本**）；`docs-audit` 规则 20 扩为四向咬合 + 覆盖闸门（`test/audit` → 全 `test/`，且 `npm test` 路径必须真实存在）；`g-meta` M7 递归含 `test/mutation/run.js`、M1 补「第二参布尔直写」形状（当场抓出 `stress-round4` V37a 写死 true 并改真读缓存）、M12 放宽 `[${r.id}]`；`stress-round4` 删游离字面量 `40` | 2026-11-15 |
| **v8.15.1 契约与死配置收口**（2026-11-15，已推送 + tag） | 健康态导出源版本 8.15.1，恢复兼容 8.14.1；删除 2 个未登记配置键、长青 4 个死模板、provider 未消费 timeoutMs；429 `sourceCooldownMs` 改为显式回退 `rateLimitBackoffMs` | 2026-11-15 |
| **v8.14.1 HDM-3 健康数据分层**（2026-11-15，已随 App b129 发布） | L0 用户控制意图永久化（controls-only 去 7 天 TTL，跨源版本/跨长期停机存活）；未知 control 源 ID 跳过，避免单个已删除源拒绝整包开关；完整健康态仍 7 天 TTL；v1 不迁移；App 侧同步 `context`/`playback_start` 分桶 | 2026-11-15 |
| **v8.14.0 音质优先与 CI 编排**（2026-11-14，已发布） | App 自定义源只按 `global.lx.qualityList` 选请求档，不再用内置 `_qualitys` 把 flac 错降 128k；源侧真实交付档回填、片段标记、置信度、`musicUrl` 透出 `qualityCeilingApplied`、缓存按实际档写入；K08 `qualityShortCircuitUniqueProbeMs` 10min + `countActiveQualitySources`；K07 `forceQualityProbe`；源仓 CI 拆 `test-fast`/`stress-long`/`stress-short` 并行，App CI 四 job + node_modules/Gradle build cache；`lx-source.js` 297753 bytes | 2026-11-14 |
| **v8.13.1 K08/K07 源侧策略**（2026-11-14，已随 b125 发布） | 唯一高质源探路由 1h 缩短为 10min（`qualityShortCircuitUniqueProbeMs`，平台内 active 源 ≤1）；新增 `forceQualityProbe` request action，只放行一轮档位短路；QP9~QP12 12/0，`npm test` rc0，audit 40/40，`verify:bundle` 8/0（297666 bytes） | 2026-11-14 |
| **v9.1.6 源级能力备档（K03）**（2026-11-21） | ①新增源级表 `qualityCeilingBySourceMap` + `getQualityCeilingBySource()`，`noteQualityCeiling()` 增第 5 参 `sourceId` 并同时写源级与平台级（源级沿用 K01「同档或更高档未过期不续期」口径）②`buildSourceChain()` 增第 3 参 `songInfo`，按源级备档剔除候选（debug 日志打 `源级备档 `${ceil} < 请求 ${q}``）③删除 `getUrlWithFallback` 里「平台级备档压低 `effectiveQuality`」的旧逻辑，`qualityCeilingApplied` 字段保留但恒为 false（契约不变）④链空诊断补 `source-quality-ceiling`，区分「网络全挂」与「在场的源都证明给不到这一档」⑤新增 QP13 回归（同歌同平台单源低质不得剔掉其它源、不得跨歌压制、128k 档不受影响）。红绿对比：旧产物 `buildSourceChain(platform, quality)` 两参、`getQualityCeilingBySource` 0 处；新产物三参、7 处 | 2026-11-21 |
| **v9.1.5 失效源退役标记**（2026-11-21） | 三个待退役源给出定案证据并落注释：①`suyinQQ` 端点级下线（`oiapi.net/api/QQ_Music` 404 + `code -13001`，`br=4/5/7` 三档一致）②`suyinMigu` 上游中转 IP 被咪咕限（`api.xcvts.cn` 返 200 + body `code 502`，两首歌一致）③`huibq` kw/wy 双档 503，保留默认关闭待上游复活。只改开关表注释、不改行为，产物 366678→367386 bytes | 2026-11-21 |
| **v9.1.4 按平台音质上限 + wy 探测曲目修正**（2026-11-21） | ①`ikun` 新增 `maxQualityByPlatform`：kw 到 flac、**wy 只到 320k**（实测 wy flac 档实返 `audio/mpeg`），原来全局声明 flac 会让 wy 的 flac 请求把它选进候选、必然降档；`maxQuality` 保留全局值供契约校验与上报 ②`juheTx` 能力声明由 **flac 下调为 320k**：交付闸门 `wrapExecute` 早已识别它 flac 档实返 mp3（`deliveryQualityMap` 有记录），但声明仍写 flac，等于进 flac 候选却永远给不了 ③wy 探测曲目由《晴天》改为**《海阔天空》/ Beyond**（id 347230，326s）：实测 `Music_163?id=2652820720` 返回「晴天(深情版)/Lucky小爱」翻唱版 —— **网易云没有周杰伦版权**，原配置等于拿翻唱冒充原版；`PROBE_163_IDS` 收敛为单 id、`buildProbeConfig` 两处 `handlerSong` 同步、`probe-songs.js` 新增 `expectSecOf(platform)` ④`chain-golden.json` 同步 wy/flac 与 tx/flac | 2026-11-21 |
| **v9.1.3 溯音163 接口兼容修复 + huibq 下线**（2026-11-20） | ①`oiapi.net/api/Music_163` 返回从 `data[]` 变 `data.items[]`，旧取值恒 `NOT_FOUND`（真机 probe 0/6、出链抽样失败，端点层却 94.3%）→ 兼容 `data[]`/`data.items[]`/`data{url}` 三形态；本地出链 **14/17 → 15/17** ②`huibq` **默认关闭**：11-16 起上游 onrender 被 owner 暂停（`503 Service Suspended`），11-04~11-15 曾连续 12 天全 200；开关置 false、保留函数便于复活 ③`legacy.js` 加载日志版本号补到 v9.1.3（self-check 比对锚点） | 2026-11-20 |
| **v8.13.1 音质真实标签补修**（2026-11-14，已随 b125 发布） | m4a/ogg 按 content-length+时长估算码率（≥256kbps→320k、其余→128k）、wav→flac、未知总字节保留请求档；`sniffAudioBytes` 只认可信总字节；全档片段兜底 `fragment: true` + `qualityConfidence: unknown`；新增 `quality-truth` 8/0 | 2026-11-14 |
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
| Huibq | **关闭**（2026-11-20 上游暂停） | 2026-11-16 起 onrender 服务被 owner 主动暂停（`503 Service Suspended`，根路径同 503，0.8s 即返回）；11-04~11-15 曾连续 12 天全 200 正常。属服务暂停而非冷启动，关闭开关、保留函数便于复活 |
| 聆川 | 关闭 | 未配置密钥（`USER_CONFIG.lingchuanApiKey`）；v13.1 巡检：域名 api.lingchuan.com 不可解析 |
| ikun | **开启**（v8.3 起，`SOURCE_TOGGLES.ikun = true`） | 公益版免卡密，kw/wy 链尾兜底 + 自动探测自愈；域名已迁至 `c.wwwweb.top`（`api.ikunshare.com` 停用）。填 `USER_CONFIG.ikunApiKey` 可切付费版 |

> 健康探测会自动启用/停用可用源，以上为静态默认值。
