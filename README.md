# backend-api

> 与 [`luanmuc/mobile-app`](https://github.com/luanmuc/mobile-app) 配套的内置数据源仓库。
> **App 每次云编译（CI）会自动拉取本仓库根目录 `lx-source.js` 覆盖内置数据源**，因此：
> - 本仓库是唯一权威数据源入口，改数据源只改这里；
> - 每次发布到 Release 页的版本 = 用户 App 实际内置的版本。

> **免责声明**：本项目仅供学习交流与技术研究。仅做接口聚合，不存储任何媒体文件；第三方接口的可用性与版权责任归相应服务方。使用即代表同意仅限个人学习用途，禁止商用。

## 快速开始

| 事项 | 说明 |
|---|---|
| 当前版本 | **v8.10.4**（可播校验错误码修复；v8.10.3 全覆盖审计 15 项隐性缺陷全修；v8.10.2 记账顺序修复 + 半开收口；v8.10.1 缓存 LRU delete 补修 + 用例真化；v8.0 全量审计修复 + ikun/huibq 复活与默认开启 + 全源巡检修复 + 巡检工具升级 + 竞速引擎改造 + huibq 收窄 + **分档预算/冷启动豁免/缓存分级**；`lx-source.js` 内 `@version 8.10.3`） |
| 支持平台 | 网易云(wy) / QQ(tx) / 酷我(kw) / 酷狗(kg) / 咪咕(mg) |
| 音质能力 | flac / 320k / 128k（按真实来源能力裁剪上报） |
| 集成方式 | App CI 用 GitHub Contents API 拉 `luanmuc/backend-api/contents/lx-source.js` |
| 发布入口 | 本仓库 **Releases 页**：每次迭代出 tag + 附 `lx-source.js` 产物 |
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

## 音源可用性（2026-11-10 核验）

> 本表 = 本仓库实测基线 + 生态交叉验证；端点级实时健康状态见 [README_HEALTH.md](./README_HEALTH.md)（`scripts/probe.js` 每日自动刷新）。
> 口径：pdone 探测来自 CI 服务器 IP，与本仓库 IP 维度不同，分歧 ≠ 某一方错误（典型：溯音咪咕上游域名可用但本机 IP 被封）。

| 平台 | 可用音质 | 主路子源 | 交叉验证 |
|---|---|---|---|
| 网易云 wy | 128k / 320k / flac | 溯音163 / wyOuter / gdWy | oiapi.net ✅；music.163.com ✅；music-api.gdstudio.xyz ❌ 403 被封 |
| 酷我 kw | 128k / 320k / flac | 溯音酷我 + 星海后端（双源 v1.0） | oiapi.net ✅；yy.zddyr.top ✅；search.kuwo.cn ✅；antiserver.kuwo.cn ✅；nmobi.kuwo.cn ❌ HTTP 404 |
| QQ tx | 128k（走溯音酷我兜底） | 溯音QQ 关闭 | oiapi.net ❌ 403 被封 |
| 酷狗 kg | 128k（走溯音酷我兜底） | — | —（无独立源，走 kw 兜底） |
| 咪咕 mg | 128k（走溯音酷我兜底） | 溯音咪咕关闭 | api.xcvts.cn ❌ PAYLOAD_NO_URL |

> 详细对照表、缺陷与**各版本当前状态（以 docs/ITERATION_ROADMAP.md 与 DEV_GUIDE 为准）**见 [DEV_GUIDE.md](./docs/DEV_GUIDE.md)。
## 版本历史

> 2026-11-05 版本重新整理：将原 53 个小版本（v11.11 ~ v29.9）按功能模块合并为 8 个大版本。
> 旧版本详细历史归档见 [docs/ARCHIVE_OLD_TAGS.md](./docs/ARCHIVE_OLD_TAGS.md)。
> 2026-11-07 全覆盖审计（96 维矩阵 + 15 项隐性缺陷 + 二次复核 + v8.10.3 修复）的数据资产：计划 [docs/AUDIT_PLAN.md](./docs/AUDIT_PLAN.md)、报告（含 §9 复核 / §10 修复落点与前后指标对比）[docs/AUDIT_REPORT-2026-11-07.md](./docs/archive/AUDIT_REPORT-2026-11-07.md)、执行轨迹 [docs/AUDIT_PROGRESS-2026-11-07.md](./docs/archive/AUDIT_PROGRESS-2026-11-07.md)。
> 完整历史与未来新增版本的详细记录见 [docs/CHANGELOG.md](./docs/CHANGELOG.md)。


| 版本 | 核心功能 |
|---|---|
| **v8.11.1**（当前） | 压测加固（2026-11-08）：新增 `test/stress-test.js`（G1 档位矩阵 / G2 30 并发 / G3 探针故障注入 14 种 / G4 duration 边界 / G5 2000 首长跑堆增长 / G6 全档片段兜底 / G7 冷却误伤 / G8 缓存命中开销，共 32 断言）。压测暴露并修复三处：①`httpRequest` 把 `{` 开头文本 parse 成对象后，验真判成 unknown 被「拿不准放行」→ 交付一段 JSON 给播放器（点歌没声），现直接判 `NOT_AUDIO`；②源级限流冷却从「单歌三档全片段」改为「同源 ≥2 首不同歌都全片段」的跨歌证据，避免一首 VIP 歌把同源其他能播的歌一起冷却 5 分钟；③片段直链是临时签名，兜底加 10 分钟 TTL，过期不再拿旧链糊弄；④**交付真实性闸门的 5 个开关 + 4 个阈值此前不在 `USER_CONFIG` 白名单**，`cfg()` 永远返回默认值，「可关闭/可回滚」实际是空话（实测 `__lxSourceConfig.verifyDelivery=false` 完全无效），现已全部纳入白名单（布尔键用 `??` 防 false 被吞）；⑤**单源链绕过预算**：链上只有 1 个源时 `fallbackRace` 直接 `await`，不经 `raceFirst`、不受任何 deadline 约束——实测单源 8s 无响应时 flac 档跑 20.4s、末档 floor 再跑 20.4s，单次点歌 **40.8s**；已给单链分支补单源硬上限，实测降到 **14.0s**；⑥新增交付类错误码补中文可读文案（App 直接展示 message）；⑦**二轮全覆盖审计（57 项）+ 压测重做（10 组）**：抓出 65 处 `throw` 未赋 `err.code`（App 拿 undefined）、歌词超时翻倍到 10.2s、源级冷却导致新歌连片段都拿不到，均已修；留 1 项源级冷却未拦请求待专项排查；**第三轮全仓结构治理 + 全仓审计 + 全新压测**（同日）：58 个 tracked 文件 / 14100 行全覆盖（未覆盖 0），归档 3 份旧报告，`AUDIT_PLAN` 897→430 行并拆出 `AUDIT_RESULTS`（D-01~D-19 缺陷总账），新增 6 份文档（文档地图 / ARCHITECTURE / TESTING / SCRIPTS / CHANGELOG / AUDIT_MATRIX），新增 `test/audit/f-repo.js`（U~Z 六组 50 项）与 `test/stress-round3.js`（T1~T12 只压「态」）；修 D-16~D-19 四个缺陷（`doc-sync-map.js` 顶层 `process.exit` 会静默杀掉 require 它的进程，另 2 个脚本同病同修）；T2/T3 由空断言改为「冷却分支文案 + 1/3 外呼比」并经 red-green 反向验证；13 道门禁 rc 全 0；**第四轮元审计（同日）**：新增 `test/audit/g-meta.js`（M1~M12）**专审断言本身**，抓出 **10 处写死 true 的伪断言**（`a-static` A5/A6/B1、`e-extra` L3/M1/M4/M5/N3/N4/O2/O4），其中 B1（外呼唯一通道）/M1（并发布明确结果）/M4（退避真生效）改成真判据，其余降为不计入通过/失败的 `· note`；M9 抓出 `f-repo` 与 `g-meta` 顶层 `process.exit` 无守卫（同类 D-16）；另修 3 处判据自身错误（M2 误报工具函数的 `typeof`、M4 解析 0 项却报绿、M6 把活键 `raceMatchWaitMs` 当死键）；发现 `docs/audit-plans/round1~3.md` **从未进 git**（本轮连同 round4 一并入库）；回归 a-static 10/0、e-extra 50/0、f-repo 50/0、g-meta 12/0，覆盖 63 文件 / 15015 行 |
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
