# 已知问题与技术债（KNOWN_ISSUES）

> 目的：把所有已确认的问题、已修项、外部阻塞和设计取舍集中到一处。  
> 以后要判断“该不该重构”，先看本表的状态、证据和影响面，不要只依赖聊天记录。  
> 本表只记录**已经在本仓库或 App 仓验证过**的事实；推测项必须标注“待验证”。

## 状态说明

| 状态 | 含义 |
|---|---|
| OPEN | 已确认，尚未修复 |
| PARTIAL | 源侧已修复，宿主/入口侧仍待接入 |
| FIXED | 已修复并有测试/提交证据 |
| BLOCKED | 受外部条件阻塞，当前无法闭环 |
| WONTFIX | 明确不做，保留原因 |
| DEFERRED | 已决定暂缓，不是缺陷 |

## 一、音质策略（当前主线）

| ID | 状态 | 严重度 | 问题 | 证据 / 位置 | 下一步 |
|---|---|---|---|---|---|
| K01 | FIXED | 高 | 能力备档 TTL 会被重复低质交付刷新，可能事实永久降级 | `noteQualityCeiling()` 每次写 `ts: Date.now()`；2026-11-14 复现：两次 128k 记录相隔 20ms，`ts` 从 1794653669033 → 1794653669053 | P0：同档不续期，增加 `recordedAt/nextProbeAt` |
| K02 | FIXED | 高 | 能力备档不区分临时失败与确定性失败 | v8.15 新增 `classifyQualityFailureCode`：business→6h、delivery/transient→10min、rate_limit→不记、unknown→30min；QP2 覆盖 |
| K03 | FIXED | 中 | 能力备档粒度是“平台 + 歌曲”，一个源低质会压制同平台其他已恢复源 | `qualityCeilingMap` key = `${platform}|${mid}`（`09-match.js:57`），`22-chain.js:209` 直接用它压低整条链起点 | **2026-11-21 修复（v9.1.6）**：新增 `qualityCeilingBySourceMap`（`${platform}|${sourceId}|${mid}`）与 `getQualityCeilingBySource()`；`noteQualityCeiling()` 增 `sourceId` 参数并先写源级；`buildSourceChain(platform, quality, songInfo)` 按源级备档剔候选；删除平台级压低起点的旧逻辑。`countActiveQualitySources`（K08）**故意不改**——它服务“唯一高质源 10min 探路”，属能力声明层语义，掺入临时降级会改变 K08 行为。红绿：旧产物 `buildSourceChain` 两参、`getQualityCeilingBySource` 0 处；新产物三参、7 处；QP13 13/0 |
| K04 | FIXED | 中 | 高质档被短路/熔断跳过时，仍可能被记成“该歌没有高质” | `getUrlWithFallback()` 新增 `attemptedQualities`，只有 `attemptedQualities.has(reqQ)` 且未从 ceiling 起跑才记上限；QP1/QP3 覆盖 | P0：只有实际 attempted 的档才记录 |
| K05 | FIXED | 高 | 档位短路把临时网络失败计入 `fail`，3 次超时就能压 1 小时 | `isQualityHopeless()` 改用 `definitiveFail + linkExpired`；QP4 断言 3 次超时不短路 | P1：只统计确定性失败，网络类交 breaker |
| K06 | FIXED | 高 | 档位短路口径反向：404/NOT_AUDIO 等确定性失败走 `businessFail`，不进 `fail`；反而超时/5xx 进 `fail` | `recordBusinessFail` 对 delivery 类（NOT_AUDIO/STREAM_PLAYLIST/BAD_ENVELOPE/TRUNCATED_MEDIA）写 `definitiveFail`；`recordFailure` 的超时不写；QP5/QP6 覆盖 | P1：新增 `definitiveFail`，短路只看它 + `linkExpired` |
| K07 | FIXED | 中 | 档位短路没有用户强制重试旁路 | 源侧自 v8.14.1 起有 `forceQualityProbe(sourceId, quality)` 与 request action（把 `qualitySkipProbeAt` 置为到期、放行一轮链构建，不改 breaker/健康账本），QP11 覆盖“放行一次后恢复短路”。**2026-11-21 补完 App 侧入口（v9.1.6 配套）**：`healthSourceBinding` 的 `HealthSourceAction` 加 `'forceQualityProbe'`；`Health.tsx` 的 `getQuerier` 白名单同步，新增 `retryQuality` 按 `shortQualities` 逐档渲染「重试 {q} 档」，成功后 `loadHealth(true)`；三语各补 4 key；`check_cross_repo_linkage` 新增 **C9**（App 侧入口存在并透传，不依赖 `LX_SOURCE_ROOT`），9 通过 / 0 失败。App 提交 `1cd2b58c` |
| K08 | FIXED | 中 | 唯一 flac 源连续临时失败时，1 小时窗口内没有高质可试 | 新增 `qualityShortCircuitUniqueProbeMs`（默认 600000=10min）与 `countActiveQualitySources(platform, quality)`；平台内该档 active 源 ≤1 时走 10min，否则仍走 1h；QP9/QP10 覆盖 kg 唯一 10min、tx 非唯一 1h |
| K09 | WONTFIX | 低 | 源仓 `REPORT_QUALITIES` 五平台均无 `flac24bit`，设置 flac24bit 会落到 flac | `REPORT_QUALITIES = ["128k","320k","flac"]`；`PLATFORM_QUALITIES` 有 flac24bit 但上报裁剪 | 保持现状；App 设置 flac24bit 时按 flac 请求 |
| K10 | WONTFIX | 低 | `fallbackOwner:"source"` 时 App 不跨源，源仓内部才有跨平台兜底 | `sourceConfig[platform].fallbackOwner = "source"`；App `shouldHostFallback` 为 false | 保持现状；跨源由源仓 `tx→wy→kw` 兜底 |
| K11 | FIXED | — | App 自定义源曾按内置 `_qualitys` 把 flac 错降 128k | App `src/core/music/utils.ts` 只按 `global.lx.qualityList[source]`；提交 `484b168e` | 已回归；后续改动不得重新引入 `_qualitys` |
| K12 | FIXED | — | 片段缓存命中后 `fragment` 被固定写成 false | App `src/utils/data.ts` / `online.ts` / `utils.ts` 的 P1-CACHE；`check_quality_request_runtime` 12/0 | 已回归；缓存按实际档 + 片段真值写 |

## 二、交付真实性 / 验真

| ID | 状态 | 严重度 | 问题 | 证据 / 位置 | 下一步 |
|---|---|---|---|---|---|
| K13 | WONTFIX | 低 | 网易公开 lyric 接口不返回 yrc 逐字字段，逐字歌词透出判否 | 2026-11-04 实测；`ITERATION_ROADMAP` v4.0 | 保持判否；外部接口恢复再评 |
| K14 | FIXED | — | 上游忽略 Range 返回 200 全量 body 时，`totalBytes=bodyLength` 被 `sniffAudioBytes` 丢弃 | `sniffAudioBytes(..., fullBody)`；`probeAudioDelivery` / `verifyDelivery` 对 `status=200 && !content-range` 采用 `content-length`；QT-9 9/0；源仓 `db52963` | 已回归；改动验真逻辑时保留 QT-9 |
| K15 | OPEN | 中 | 真机 10 首矩阵、标签一致率、真机 A/B 延迟未完成 | 云主机无设备，无法真机验证 | BLOCKED 外部；有设备后补矩阵与 A/B |
| K32 | DEFERRED（R77 登记，R78 补观测口径） | 中 | `reportPlayback` 失败只 bump playDead，不清缓存、不计熔断（playbackOnly 早退）——即「过期直链导致播放失败」只记账不反制 | v9.1.6 产物 `:2666-2669`；缓解：`verifyOnCacheHit` 默认 true（产物 `:3309`），下次取链复验即丢弃过期链接。R76 全量通读定案为已知取舍。**观测三件套（R78 定口径，不改行为）**：①`playDead` 累计 bump 次数（同源同档计数，看是否只由过期直链贡献）；②`verifyOnCacheHit` 命中率（复验判失败的比例，= 缓解实际生效比例）；③同档被摘除次数与 5 分钟窗口触发频次 | **升级触发条件（任一命中即从 DEFERRED 升 P1 改行为）**：a) 单日 `playDead` bump ≥ 3 次且 `verifyOnCacheHit` 命中率 < 50%（说明复验没兜住、过期直链在裸奔）；b) 同一源同档 24h 内被摘除 ≥ 2 次；c) 真机出现「链接能取到、播放立刻失败」≥ 2 例且复验未识别。未命中前维持 DEFERRED（改行为会牺牲 playbackOnly 分账口径） |

## 三、外部源 / 门禁

| ID | 状态 | 严重度 | 问题 | 证据 / 位置 | 下一步 |
|---|---|---|---|---|---|
| K16 | **FIXED**（2026-11-21） | 中 | `check_source_ci_gate` 报 403，此前记为「需要有效凭据/额度」 | 定案：额度充足（认证配额 5000 / used 20），真因是全链路走**未认证** `api.github.com`，吃按出口 IP 的 60 次/小时 | ✅ 已修：该闸门脚本位于 App 仓（`mobile-app` 的 `check_source_ci_gate.js`），已让它在无 `GITHUB_TOKEN` 时自动从 `~/.config/gh/hosts.yml` 读 `oauth_token` 兜底；改后本机直跑即通过（`✅ 源仓 CI 闸门通过`） |
| K17 | OPEN | 中 | `source-audit` 全量仍有外部源未通过 | **2026-11-21 全量实测：15/17 可用**，2 个失败均为 `huibq`（kw 1371ms / wy 942ms `HTTP 503`，已默认关闭待上游复活，见 K 表 §三与 `src/core/35-source-switch.js:16`）；`--quick` 抽样 **15/15**。旧记录「14/16」是 v9.1.3 阶段口径 | 外部源恢复后复测；不要为了绿而删除源。`huibq` 状态已由 v9.1.5 注释封存，无需再改 |
| K18 | DEFERRED | 低 | Phase 5 host-owned 宽限窗未做；v1 App 四段竞速、v2 App 跨候选宽限窗已明确拒绝 | 用户决策；避免 App 与源仓双重重试 | 保持现状，不再引入 App 侧宽限窗 |
| K25 | FIXED | 高 | **门禁假绿三件套**：`docs-audit.js` 恒 `exit 0`（B03-005）；`verify-real-*` 无条件 `exit 0`（B03-006）；`sign-release` 缺密钥 fail-open（B03-002） | 三条都由读源码 + 变异验证确认：删台账一行 → 旧版仍 exit 0 | 已改：`runAll()` 返回 🔴 数并 `process.exit(hard ? 1 : 0)`；`--require-all-ok` 开关；`--require-key` + CI `ALLOW_UNSIGNED` 双层 |
| K26 | FIXED | 中 | **慢测试无本地入口且不随 push**：`stress-test` 不在 `npm test`（B05-002）；`mutation` job 只在 schedule/dispatch（B05-003） | `package.json` scripts 无 stress/mutation；`ci.yml:187` 的 `if` 只认 schedule/dispatch | 已改：补 `test:stress` / `test:mutation` 别名；mutation 在 push（src 变更）跑 `--fast` 子集，全量留给 schedule |
| K27 | FIXED | 中 | **live 驱动 4 个退役源 id**：`xinghaiBackup` / `nianxinVip` / `gdWy` / `lingchuan` 已不在注册表，`toggleSource` 对未知 id 抛 `PARAM_ERROR` | `tools/live/run.js` 的 `only()` 会遍历当前注册表，传退役 id 等于把全部源关掉 | 已改：`only()` 加注册表校验（不在册则 `⏭` 跳过）；L2-4 改动态取 id；L6 组引入 `L6_SRC` 常量 + 同档三首验证熔断 |
| K28 | FIXED | 中 | **provider contract tx 行口径漂移**：`12-provider-contract.js:74` 只写 `suyinKuwo + juheTx` 双源且 `reviewAt` 是 2026-11-19，而 `SOURCE_REGISTRY.md:51` 已是三源 + 2026-11-18 | 两处描述不一致，缺 `qingliangTx` 第三方单点 | 已改：三源并含 `qingliangTx`，`reviewAt` 回填 2026-11-18，加注释说明两处必须同步 |
| K33 | FIXED（2026-11-23） | 中 | **CI L4.3 与 npm test 口径漂移**：R75/R75b 新增的 `security-url-guard` / `force-probe-contract` / `anchors-contract` 三个审计脚本只进了 `npm test` 与文档台账，从未进 `.github/workflows/ci.yml` 的 L4.3 step——推送后云端不跑这三条，文档却声称 L4.3 含 security-url-guard（TESTING.md L19 合计 132） | ci.yml L4.3 逐行比对：`grep -c "node test/audit/"` = 43，缺 3 个新脚本；继承 K23「新增审计脚本必须同时进 npm test + ci.yml + 三份台账」的教训 | 已修：L4.3 补 3 个旧漏 + `r77-fixes.js` 共 4 个脚本；TESTING.md L4.3 合计 132→185；K23 流程规则已内化 |
| K34 | **OPEN**（R78 复核登记，外部） | **高** | **上游大面积失效（不是代码缺陷）**：oiapi 的 `Kuwo_Music` / `QQ_Music` / `163_Music` 三接口均 `404 code -13001`「接口不存在或已下线」，`Migu_Music` 仍活；juhe 全域 `429`（含根路径，CF 层维护/限流）；qingliangTx `200 code=1` 正常 | 2026-11-23 03:49~03:56 实测（`/tmp/r78-review-probe.js` 与 probe2/probe3，6 次探测）：`suyinKuwo` 4 次（含 3 个路径变体）全 404；`suyinQQ`/`suyin163` 各 1 次 404；`suyinMigu` `200 code=1` 出链；`juhe` `/tx`(2次)+`/kw`+根路径共 4 次全 429；`qingliangTx` `200 code=1` 出 `aqqmusic.tc.qq.com` 直链 | **能力影响**：kg / mg **零可用源**（唯一上链源 `suyinKuwo` 下线），tx 实际仅 `qingliangTx` 单点，wy 首位 `suyin163` 失效。**下一步（待决策，不在 v9.1.7 做）**：①`kg`/`mg` 拓扑决策（把 `suyinMigu` 由 probation 升 active 恢复 mg 覆盖 / 找 kg 替代源）；②`wy` 首位换 `wyOuter` 或补源；③`juhe` 等限流解除后复测。**本项不阻塞 v9.1.7 发布**：拓扑未变、产物行为未变，只是已知缺口的风险档从「单源」改述为「零源」。**R79 进展（2026-11-23 07:20 实测）**：已找到直接补位源——星海新主域 `yy1.zddyr.top/lx/api/` 的 `?source=migu` 出 `freetyst.nf.migu.cn` 链，`Range` 实测 `206 / 3.9MB / ID3v2.3` 真 mp3；`?source=kg` 接口可达（`code 502 KG_SONG_NOT_FOUND`，需正确 hash 才能出链）。另 `wy` 同接口可出 `fLaC` 32.5MB 真音频。接入方式=放开 `xinghaiBackendGetUrl` 的平台白名单（当前硬限 `platform !== 'kw'` 即抛错，`src/core/25-handlers.js:83`），**待决策**（收益：mg 零源归零；代价：上游为第三方商业服务、有总 QPS 限流、`auth.trusted:false`）。**tx 亦有备选**：落月 `https://api.vkeys.cn/music/tencent/song/link?mid=…&quality=8` 实测 `206 / 10.79MB / ID3v2.3` 真全曲（注意同站 `v2/music/tencent/geturl` 只给 960KB 试听片段，必须用 v3 `song/link`）；`api.vkeys.cn` **不在 HostKeeper 放行清单**，接入前需补 `*.vkeys.cn` |
| K35 | FIXED（R78） | 中 | **`reviewAt` 写成未来日期可永久绕过 14 天宽限**：R77 把三个源与两条缺口顺延到 `2026-11-30`，`checkFresh` 只算 `nowMs - ts > 14d`，负差值永不超窗 → 「用未来日历把门禁关掉」 | `src/core/12-provider-contract.js:16`（R77 形态）；R78 加 `REVIEW_FUTURE_TOLERANCE_MS = 24h` 反向判定（`ts - nowMs > 24h` → 契约失败「reviewAt 是未来日期」），并把 5 处日期改回真实复核日 `2026-11-23` | ✅ 已修 + `test/audit/r77-fixes.js` **B10** 双向验证（删未来判定 → 26/1 红；还原 → 27/0 绿）；C06 提取式防回退（不得出现未来日期） |
| K36 | FIXED（R78） | 中 | **文档同步规则长期空转**：`docs/AGENTS.md` §文档同步规范写着「强制、无需提醒」，`scripts/hooks/` 三个 hook 与 `scripts/doc-sync-map.js` 也在库，但 ① 本机 `core.hooksPath` 未设置、`.git/hooks/` 为空 → 提交时既不打印清单也不拦截；② `RULES` 只匹配产物 `lx-source.js`，v9.0 拆包后真正改的是 `src/core/*`、`src/providers/*` → 改源码时触发清单为空、`--check` 也不拒（R77 改了 15 个 src 文件全部静默通过） | `git config core.hooksPath`（空）；`.git/hooks/` 仅 sample；`scripts/doc-sync-map.js:32` RULES 无 `src/` 项、`HARD_TRIGGER` 无 `src/` | ✅ 已修：①两仓执行 `sh scripts/install-hooks.sh`（`core.hooksPath=scripts/hooks`）；②`RULES` 补 `src/` → DEV_GUIDE / KNOWN_ISSUES / CHANGELOG / README + 跨仓 action，`test/` 规则补 AUDIT_MATRIX / TESTING；③`HARD_TRIGGER` 补 `src/`；④`AGENTS.md` 第 3 条触发面改写 + 新增第 7 条「安装自检」；双向验证见下 |
| K37 | FIXED（R78） | 低 | **App 仓 `doc-sync-map.js` 的 `getStagedFiles` catch 后返回空数组**：`git diff --cached` 读失败时被当成「本次无改动」直接放行（音源侧 B03-015 已修为抛错，App 侧未同步该修复） | `mobile-app/scripts/doc-sync-map.js` getStagedFiles 的 `catch (_) { return [] }` | ✅ 已修：与音源侧对齐为抛错（读不出改动集合时必须让 `--check` 失败，不能假装通过） |
| K38 | **FIXED**（v9.2.0 / R79） | 低 | **`xinghaiBackend` 只有单域名，且指向上游自己标注的「旧/备用域」**：`XINGHAI_BACKEND_API` 硬编码 `https://yy.zddyr.top/lx/api/`，无主备回退。上游插件（v3.2.20）源码注释明确：`primary: yy1.zddyr.top` 是「新域名，避开部分地区 DNS 拦截」，`backup: yy.zddyr.top` 是「原域名，主域名不可用时自动回退」，并实现 `requestWithFallback`（网络失败或 5xx 时切备用域重试一次）。我们只用其中一个，且恰是被标注为备用/易被拦截的那个 → 与 R78 记录的真机 `NETWORK_ERROR` 287ms 互为印证 | `src/core/10-vendors.js:21`（单常量）；`src/core/25-handlers.js:82-120`（无回退）；插件证据 `https://zrcdy.dpdns.org/lx/xinghai-music-sourcev3.2.20.js` 第 1061~1105 字节段（`URL_CONFIG.domains` / `PRIMARY_HOST` / `requestWithFallback`） | **建议修法（低风险，不改拓扑）**：`XINGHAI_BACKEND_API` 改为 `[新主域, 旧域]` 有序候选；`xinghaiBackendGetUrl` 在 `NETWORK_ERROR`/`NETWORK_TIMEOUT`/`SERVER_ERROR` 时切下一候选（4xx/业务码不切，避免多打请求）。两域名同属 `*.zddyr.top`，HostKeeper 放行清单无需改。**已修（v9.2.0）**：`10-vendors.js` 新增 `XINGHAI_BACKEND_APIS` 有序候选，`25-handlers.js` 按三类网络错误切备域（4xx/业务码不切）。验证：`npm test` EXIT=0（B9 登记数 14 断言通过）、`verify-bundle` 8/0、`api-surface` E0 一致；主备切换分支目前只有代码事实，注入式回归用例待补（P2） |
| K29 | FIXED | 中 | **audit 断言假绿两条**：`a-static` B6 用 `p.catch(() => {})` 吞掉异步 reject（B06-002）；`b-logic` C10 只断言 10/10 成功、外呼无上限（B06-003） | 变异验证：B6 原本对畸形输入恒绿；C10 原判据 10 并发各打一遍也绿 | 已改：B6 收集拒绝码并要求落在产物 `ERROR_CODES` 枚举（实测 `PARAM_ERROR` 属正常结构化错误）；C10 加 `c10Calls <= 4`（实测 3 次） |
| K21 | FIXED | 高 | **escalated 升级标签永不触发**：`ci.yml:264` 读 `s.rows`，但 `health-daily.js:438-441` 顶层只产出 `handle`/`watch`/`fragment` 三个数组，`rows` 仅嵌在 `chainSample.rows` 内 → `(s.rows\|\|[])` 恒空、`some()` 恒 false，连续 ≥7 天失败打标签的分支永远走不到 | 2026-11-19 修复（`ci.yml:265` 改读 `s.handle`，去掉多余的 `r.bucket` 判断）；历史 JSON 逐日验证：11-15/11-16 `max consecutiveFail=7` → 老判据不触发、新判据精确触发；11-12/13/14（4/5/6）与已恢复的 11-18（3）均正确不触发 | 已修，无需后续 |
| K22 | FIXED | 高 | **`stress-test.js` S4b 判据恒真**：`rec('S4b', ..., after \|\| total() > 0, ...)`，而 `total()` 是自 `fresh()` 起的累计外呼计数，S4 前段已发 10 次请求 → 右操作数恒真；限流窗口永不恢复时断言照样 PASS（假绿） | 2026-11-19 修复（判据改为只看 `after`，`total()` 仅作 detail 输出）；两场景对比验证：窗口永不恢复 → 旧判据 PASS（假绿）/ 新判据 FAIL（正确）；窗口恢复 → 两者都 PASS | 已修，无需后续 |
| K23 | FIXED | 高 | **24 个 audit 脚本零执行点**：`test/audit/` 下 43 个脚本，`ci.yml` 只引用 19 个；其余 24 个（含 14 个 `health-*` 与 `readthrough-fixes` / `y-provider-contract`）从未在流水线里执行过，等于健康状态机/探测保真/资格/生命周期等核心契约无 CI 守门 | 2026-11-19 修复：新增 L4.1（7 个健康族①）、L4.2（7 个健康族②）、L4.3（10 个质量/契约/生命周期/预算/口径）三个 step，43/43 全部接入；实测 24 个在干净环境（`node_modules` 为空）全 exit 0、断言合计 **222** 条；改完复跑元审计无自伤：`f-repo` 56/0、`tg-truth` 全一致、`g-meta` 16/0 | 已修，无需后续 |
| K24 | FIXED | 中 | **`READTHROUGH.md` 的 `src/core/` 33 个模块结论全是 `====` 占位符**：台账声称「逐行通读」，结论列却未填，等于 33 个模块「读过但没有结论」，无法用于回归判断；同时台账文件数/总行数（185/57,723）与 `lx-source.js` 行数（7,071）均已过期 | 2026-11-19 修复：33 条全部补为「职责 + 导出面 + 已知缺陷编号（B0x-00x）」实测结论，并修正 5 处过期行数（13-chain-helpers 198→216、17-health-check 835→844、25-handlers 537→547、33-cross-cache 40→47、lx-source 7,071→7,097）；文件数口径改为 docs-audit 机器口径（**185 登记单位** = 211 tracked 文件 − health-daily 27 + 整目录 1），总行数 57,766；`docs-audit` 待处理 0 项、`tg-truth` 全一致、`f-repo` 56/0 | 已修，无需后续 |

## 四、文档 / 流程

| ID | 状态 | 严重度 | 问题 | 证据 / 位置 | 下一步 |
|---|---|---|---|---|---|
| K19 | FIXED | — | 四份计划与审计起点曾出现 hash/行数漂移 | App `AUDIT_PLAN`/`STRESS_PLAN`、源仓 `AUDIT_PLAN_v10`/`stress-round5` 已回填 | 每次审计/提交后同步 |
| K20 | FIXED | 低 | `KNOWN_ISSUES` 曾被 `ITERATION_ROADMAP` 引用但文件不存在 | 本文档为本轮补建；K13 引用此前悬空 | 已补建；后续新增问题按 K 编号追加 |
| K30 | OPEN | 中 | **聚合代表码被「源能力不足」的 PARAM_ERROR 盖掉**：整个平台的结论被写成「参数错误」，App 会把「上游限流」当「请求参数不对」而不重试 | 2026-11-21 `tools/live/run.js l1l4` 连跑 5 首复现两首：`七里香`/`平凡之路` 抛出 `PARAM_ERROR: 所有源均失败`，而 `err.detail` 是 `RATE_LIMIT/RATE_LIMIT/RATE_LIMIT/PARAM_ERROR/PARAM_ERROR`。根因两层：①`xinghaiBackendGetUrl` 这类「只按 mid 出链」的源在 `songInfo` 无 id（歌名搜索未命中）时抛 `PARAM_ERROR: 星海后端缺少 songmid/id`（`25-handlers.js:89-94`），它是**源自身能力不足**，不代表平台结论；②`05-verdict.js:92` 的 `CODE_RANK` 给 `PARAM_ERROR` 排 2、`RATE_LIMIT` 排 1，`admit({stage:'fallback'})` 取 rank 最高者，于是 PARAM_ERROR 胜出。单测已验证 `admit` 本身没错（只喂一条 RATE_LIMIT 时返回 RATE_LIMIT） | 待定方向：①给「源缺 id」引入独立码（`SOURCE_INCAPABLE`，rank 0），与用户传参错误的 PARAM_ERROR 区分；②或让 `buildSourceChain` 在 `songInfo` 无 id 时就不放该类源进链（资格层修法，更彻底但牵动面大）。注意新增码要同步 `schema-parity` / `ERROR_CODES` 白名单 / `y-provider-contract`。**未修** |
| K31 | **FIXED**（2026-11-21） | 高 | 验真层**不校验身份**：星海后端对任意 mid 都返回真实音频，`tools/live` L4-5 的假 id `999999999` 实际落地 181,521 字节 `audio/mpeg`（约 113s），被当成可播交付并标「试听版」 | 2026-11-21 `node tools/live/run.js l1l4`：`L4-5` 交付 `kwplay.php?mid=999999999&q=128k`，`sub=星海后端 · 试听版`；直连实测 `mid=999999999`→206/181521B、`mid=1`→206/1047532B、`mid=228908`→206/4317292B，**三条都是 206 audio/mpeg** | 根因两层：①`xinghaiBackend` 只按 mid 中转，上游对无效 mid 也生成 play 链（handler 注释自己写过「必交付别人的音频」）；②`15-verify.js` 的四条判据只有时长/体积比例（`ratio<0.6 && gap>15s`），**没有任何歌名/歌手证据**，长度像样就放行。修法：①`08-media.js` 新增 `parseAudioTags`（ID3v2 TIT2/TPE1 + FLAC VORBIS TITLE/ARTIST），探针 Range 1KB→32KB；②`15-verify.js` 新增 `checkDeliveryIdentity`：有标签且歌名对不上→`MISMATCH`（任何源都拒），有标签且对得上→放行，无标签时 `identityStrict` 源**只在被判片段时**拒；③`provider()` 新增 `identityStrict`，星海标记开启。验证：`L4-5` 由「交付别人的音频」变 `NOT_FOUND`，`L4-1` 恢复如实降档，`l1l4` 14/0、`l5` 9/1、`npm test` V 组 133/0 |

## 关联文档

- 方案：[`QUALITY_POLICY_OPTIMIZATION_PLAN.md`](./archive/QUALITY_POLICY_OPTIMIZATION_PLAN.md)
- 当前架构：[`ARCHITECTURE.md`](./ARCHITECTURE.md)
- 逐段职责：[`DEV_GUIDE.md`](./DEV_GUIDE.md)
- 测试入口：[`TESTING.md`](./TESTING.md)
- 审计矩阵：[`AUDIT_MATRIX.md`](./AUDIT_MATRIX.md)
- 版本历史：[`CHANGELOG.md`](./CHANGELOG.md)
