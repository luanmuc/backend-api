# 全仓通读台账（READTHROUGH）

> **这是活文档：每次版本号变更或每轮审计后必须刷新，不许过期。**
> 谁看住它：`node scripts/docs-audit.js` 规则 18 —— 逐行行数、文件数、总行数、版本、以及「是否有 tracked 文件漏登」全部机器校验；行数不符会被自动改回实测值，漏登文件直接报 ❌。HEAD 一行按「必须是当前 HEAD 的祖先」校验（落后 ≤20 条只报 🟡、不改写）——避免审计每次把自己写成待提交改动。
> 登记处：[`DOC_INDEX.md`](./DOC_INDEX.md)。新增任何文档 → 先登记，再写内容。
>
> **时效说明**：以下逐文件结论是 2026-11-10 通读时的历史快照，保留作为审计证据；当前版本号、断言数、行数以 `README.md`、`docs/TESTING.md` 与 `scripts/docs-audit.js` 的实测为准。

历史快照 `e9a2259`（v8.16.1 时期）。**当前工作区的版本号 / 行数 / 字节数一律以机器口径为准**（`README.md`「当前版本」行、`docs/AUDIT_MATRIX.md` 的 `lx-source.js` 行、`docs/TESTING.md` 的入口清单，均由 `scripts/docs-audit.js` 自动对齐）；本行不再手写具体版本，避免每次发版后成为一条固定漂移（R78 修：此前手写 v9.1.2 / 7,101 行 / package 9.1.1 已落后 5 个版本）。产物 `@version` 与真实行数以 `lx-source.js` 文件头注释为准

> 复核说明（2026-11-19）：`src/core/` 33 个模块的逐文件结论已由占位符补为实测结论（职责 + 导出面 + 已知缺陷编号）；文件数/总行数按当前 HEAD 实测刷新。
文件数：**202**（口径：211 个 tracked 文件，其中 `docs/health-daily/` 27 个按「整目录 1 单位」登记，见 `scripts/docs-audit.js` 的 `AUTO_GEN_DIRS`）　总行数：**62836**（`git -c core.quotepath=false ls-files` + `wc -l` 实测）

## 一、先说三个硬阻塞（比数字过期严重）

| # | 事实 | 证据 |
|---|---|---|
| X1 | ~~远端巡检已断 2 天~~ **已澄清（2026-11-10）**：巡检从未停，2026-11-10T02:27Z 有一次 schedule run 并成功提交 `4f031f1`；早前判断错在「只在本地 `git log origin/master` 看，没再 fetch」——本地领先 100 个提交、fetch 后 behind 1 就是它。`README_HEALTH` 已更新到 `2026-11-10T02:27Z`，`health-daily/2026-11-10.*` 已生成。真正的问题只剩 `test` job 红在 L2 自检（缺 v8.10.12 版本条目，本地 v8.11.2 已补） | `git fetch` → `git status -sb` = `[ahead 100, behind 1]`；GitHub API runs 显示 11-10T02:27 failure（probe/ecosystem job success，test job step7 L2 失败）；远端 commits 最新 `4f031f1` |
| X2 | 本地 v8.13.0 单提交领先 `origin/master` 1 个提交；按用户要求不推送，远端 CI 未跑 | `git status -sb` = `## master...origin/master [ahead 1]`；`git rev-parse origin/master` = `0cba276`；不声称远端 CI 绿 |
| X3 | ~~变异门禁 fail-open~~ **已闭环（v8.11.2）**：`ci.yml` 补 `--strict`，且 2026-11-10 实测 `--full --strict` 全量 **22 killed / 0 survived**、rc=0；门禁从此真会拦人（2026-11-12 复跑首轮 19 killed + 3 skipped——MU4/MU10/MU13 锚点被现行源码改得失配，修锚点后 3/3 killed，22/22 覆盖；不是 survived） | 旧：`ci.yml` 变异 job 不带 `--strict`；新：本日志 + `docs-audit` 规则16 |

## 二、四类清单（详细证据见 §四）

| 类别 | 条数 | 摘要 |
|---|---|---|
| **未审计** | A1 8 文件 / A4 5 类文档盲区 | 8 个文件 2298 行从未进矩阵；N 组「无回归保护清单」已于 2026-11-10 完成（39 条修复配对：16 有锚点 / 23 无锚点，其中 10 条需行为断言**已全部闭环**：D-04→Q1/Q2、D-01→Q3、D-08→Q4、D-05/06/26→R1~R3，D-10/11/12 复核出早有真保护并重取红证据，D-02 静态核实），见 `docs/archive/audit-plans/round4.md` §3 |
| **数据过时** | 54 处 | 已由本轮门禁接管可计算项（见 §三）；剩余语义类逐条列在清单原文 |
| **未测试** | 15 道门禁入口全覆盖（13 个测试脚本 + 自检 + 文档门禁），原 7 项该测未测剩 3 项 | 已补：`CONFIG_ERROR` TTL（N4）、320k 跳档（N3）、`juhe` 字符串码（N1/N2）、四段零覆盖（P1~P4）；仍缺：仅 L4 真机播放（T10 已由 Z7 实测、T33 根因已定位并修复） |
| **未验证** | 仅剩 1 项 | F10~F13 已实证（N1~N4）；变异 22/0 已全量；T10 三分支已由 f-repo Z7 真跑；T33 根因=分档预算 1ms 与 mock 同毫秒竞争，已改 -1（确定性）；唯一剩余是 L4 真机播放 |

## 三、本轮实跑证据（新鲜，非引用）

| 命令 | 输出 |
|---|---|
| `test/lx-source-smoke-test.js` | **67 组用例**，rc=0 |
| `test/audit/{a-static,b-logic,d-func,e-extra,f-repo,g-meta,h-toggles}.js` | 10 / 30 / 30 / 92 / 54 / 14 / 14 / 4 / 4 / 2，全 rc=0 |
| `test/candidate-audit-test.js` | 6 通过 / 0 失败 |
| `test/audit/q-quickjs-real.js` | 3 通过 / 0 失败（真引擎） |
| `test/stress-test.js` | 12 / 0 |
| `test/stress-round3.js` | 14 通过 / 0 失败 |
| `test/stress-round4.js` | 133 通过 / 0 失败 |
| `test/mutation/run.js` | 22 个变异体（**2026-11-14 `--full --strict` 22 killed / 0 survived，rc=0**） |

合计：冒烟 67 + 审计 249 + 压测 **159**（12+14+133）= **475**；变异 22。
（更正：本轮初稿把压测写成了 163，是加法错误；12+14+133=159。）

## 四、逐文件通读结论（当前 99 个文件；2026-11-10 全量通读 + 后续新增文件登记）

读法：`全文` 逐行读完；`断言` 按断言 ID + 断言名 + 实跑输出逐条核对；`生成` 按记录结构统计核对；`归档` 历史文档读正文与结论段。

| 文件 | 行 | 读法 | 结论 |
|---|---|---|---|
| `.github/workflows/ci.yml` | 488 | 全文 | 10 个执行 job + `changes` 前置（test-fast / audit-a / audit-b / stress-long / stress-short / mutation / probe / ecosystem / sign-release / purge-cdn；2026-11-21 把 L3/L4 五个审计 step 从 `test-fast` 拆进 `audit-a`/`audit-b` 并行，墙钟 2m51 → 约 1m30）；断言数注释过期（32/21/22）；**mutation 已带 `--strict`（X3 闭环）且 job 内 `npm ci` 安装 esbuild**；schedule `0 20 * * *`；probe 只放行 exit 2，其余显式失败 |
| `.github/workflows/docs-audit.yml` | 56 | 全文 | 注释仍写「probe UTC 06:00」；红项硬失败正确；`--dry-run` 段吞错（`|| true`） |
| `.gitignore` | 8 | 全文 | 只有 `node_modules/`；`.cov/` 不在仓内 |
| `README.md` | 143 | 全文 | **L14 当前版本 v8.10.4 / @version 8.10.3 与 L73 v8.11.1 自相矛盾**；L73 写 32 断言（实 12） |
| `README_HEALTH.md` | 37 | 生成 | 20 端点 / 可用 11；更新于 11-08 → 已 2 天未刷新 |
| `lx-source.js` | 7654 | 全文 | 40 键 `USER_CONFIG` / 15 `ALLOWED_KEYS` / **18 错误码**；2026-11-17 逐行通读（v8.16.1）结论见 `docs/archive/READTHROUGH_v8.16.1.md`：证伪「版本漂移」1 条，确认缺陷 12 条（R-01~R-12，其中 P0 两条：档位熔断持久化丢失、真实音质未入账），无缺陷模块 9 类；**v8.16.2~v8.16.4 产物侧逐行结论见 `docs/archive/READTHROUGH_v8.16.2.md`（6045 行 7/7 段）** |
| `docs/P2_TRIAGE.md` | 104 | 当前态 | P2 57 条逐条定档（A 12 已修 / B 26 / C 19），2026-11-19 新建 |
| `docs/AGENTS.md` | 207 | 全文 | 协作 7 规则 / L0~L4 验证链；「4 处 clearTimeout」实为 5 |
| `docs/ARCHITECTURE.md` | 93 | 全文 | 「39 键」实 40；「3136 行」+ 八段行段表全部漂移（与 DEV_GUIDE 冲突）→ **2026-11-12 已修：4509 行** |
| `docs/ARCHIVE_OLD_TAGS.md` | 138 | 归档 | 旧 tag 表（v11.11→v29.x）；「旧 tag 已全部删除」未核远端 |
| `docs/archive/AUDIT_HISTORY.md` | 1441 | 归档合集 | v9~第五轮历史计划原文，只读 |
| `docs/AUDIT_MATRIX.md` | 269 | 全文 | 67 行 vs 75 文件 → 漏 8 个；行数全过期（3185/1111/838/174…）；自称「未覆盖 0」已不成立 |
| `docs/AUDIT_PLAN_v10.md` | 288 | 全文 | v11 重构版：26 域总表 + §2b 定制明细 + §3 音质政策 + §4 跨仓联动 + §6 缺口 G2~G9/QP-L1~3 + §7 已知取舍 + §9 v9 承接矩阵 |
| `docs/AUDIT_RESULTS.md` | 2019 | 全文 | D-01~D-39 总账 + §0~§26.13；历史段落数字按规则冻结（写的是当时事实）；U 组「.js 数」已校正为 31 |
| `docs/CHANGELOG.md` | 518 | 全文 | 版本摘要，末条到 v8.11.1；无派生数字 |
| `docs/DEV_GUIDE.md` | 621 | 全文 | §二行段已到 3357（与 ARCHITECTURE 冲突）；§11.1 面板表 14 行缺 `memoryMapMax`；L371 92/55 自相矛盾；L3 仍写 v8.10.12 |
| `docs/DOC_SEMANTIC_CHECKLIST.md` | 36 | 全文 | 机审不了的语义项；「17 条规则」实 14 |
| `docs/INTERFACE_CHANGE_PLAYBOOK.md` | 62 | 全文 | 跨仓改接口 7 步；与当前 action 面一致 |
| `docs/ITERATION_ROADMAP.md` | 328 | 全文 | 三层目标；**32 断言/49 文件/897→430/白名单 14/趋势 60 条 全过期**；3 条 `[ ] 待开发`（服务器）/ 2 条触发式未闭环 |
| `docs/archive/PROGRESS_round5.md` | 58 | 全文 | 第五轮进度记录；数字停在 82 通过（现 92） |
| `docs/README.md` | 72 | 全文 | 文档地图；「5 个测试入口」实 14；「D-01~D-26」已到 D-39 |
| `docs/SCRIPTS.md` | 99 | 全文 | 14 脚本 + 3 hook；「17 条规则」实 14；行数 235/110 实 236/111；prepare-commit-msg 的 exit 1 描述属 commit-msg |
| `docs/SOURCE_AUDIT.md` | 104 | 全文 | 11-06 基线 21/35 + 11-09 顶注 10/10；「短路探路 6h」实默认 1h |
| `docs/TESTING.md` | 202 | 全文 | 口径正确（253 审计 / 479 合计 / 22 变异）；72 文件、58/14145、203.45KB 三处过期（历史值已冻结） |
| `docs/archive/AUDIT_PROGRESS-2026-11-07.md` | 82 | 归档 | 96 维执行轨迹；F-08~F-14 待决策记录（部分已修） |
| `docs/archive/AUDIT_REPORT-2026-11-05.md` | 146 | 归档 | 音源+App 五步审计 13 问题（2 中 11 低） |
| `docs/archive/QUALITY_POLICY_OPTIMIZATION_PLAN.md` | 266 | 归档 | 音质策略方案；P0/P1 与 K08/K07 已落地，K07 的 App 入口仍 P2；2026-11-20 归档 |
| `docs/archive/音源架构执行全过程-2026-11-12.md` | 143 | 归档 | v8.6~v8.13 架构阶段纪要；随 v8.13.0 收口，2026-11-20 归档 |
| `docs/archive/AUDIT_REPORT-2026-11-07.md` | 295 | 归档 | 15 项修复 + §10.2 仍未做（L4 真网络 / F-12 第二方案 / 面板 raceBudgetMs 说明） |
| `docs/STRESS_PLAN.md` | 155 | 当前态 | 压测唯一入口（v2 重构版，§6 负载设计 + §7 方法论承接） |
| `docs/candidate-status.md` | 8 | 生成 | hyw 已恢复 / huanyin 需人工；依赖 recheck 是否真跑 |
| `docs/health-daily/` | 998 | 生成 | 整目录（每日 CI 自动生成，90 天滚动清理；当前 23 份已逐字读完） |
| `docs/probe-history.jsonl` | 247 | 生成 | 664 条全可解析；10-28→11-08；25 distinct url（registry 20）；11-08 单日 215 条异常 |
| `docs/chain-sample.jsonl` | 45 | 生成 | 出链抽样记录（2026-11-17 起），每行 src/plat/ok/code/playable/ms，供日报「出链抽样」段消费 |
| `docs/device-digests.jsonl` | 3 | 生成 | 真机摘要（lx-telemetry 拉取落地），每行一天，只含次数与错误码 |
| `docs/reports/v8.11.1-第五轮审计结算.md` | 122 | 全文 | 五组账 + 5 次自我推翻；e-extra 82 / 3179 行 / 66 文件 过期 |
| `docs/reports/v8.11.1-第六轮缺口审计.md` | 480 | 全文 | G1~G11 + §12.5 端到端 10/10 + D-27/28；尾部 6 条遗漏自查 |
| `docs/reports/R76-音源全量通读-2026-11-23.md` | 86 | 全文 | v9.1.6 产物逐行通读：P1-01 restore 丢 playDead.quality（18-health-persist.js:105/149）、P1-02 FLAC 小端长度被大端读（08-media.js:148/151/154）、P2×6；对已发布产物复现 6 通过/4 失败；架构评估成立，弱点在往返等价/二进制夹具/快照纯度/跨仓字段契约 |
| `docs/reports/候选接入评审-2026-11-15.md` | 97 | 全文 | ecosystem 扫出 4 候选逐个评审：qingliang tx 线路实测 206 + 全曲 10,792,943 bytes；xinglan 主线路只给试听（RS0 / 960,887 bytes，差 11.2 倍）；feichangdao/suyin 与我方 oiapi/xcvts 同源重复 |
| `scripts/preflight-push.sh` | 53 | 当前态 | 推送前一键全量校验（v9-gate core + npm test 43 audit + docs-audit + 产物幂等），新增 |
| `scripts/candidate-audit.js` | 342 | 全文 | mockLoadScript 同步化定时器 → 递归 setTimeout 脚本会栈溢出（仅候选用，风险低） |
| `scripts/cn-date.js` | 17 | 全文 | 北京日期单一来源 |
| `scripts/docs-audit.js` | 561 | 全文 | **14 条规则**；不校 README 当前版本行 / CI 数字 / 矩阵数字（过时数字的根因） |
| `scripts/doc-sync-map.js` | 125 | 全文 | 规则指向 `docs/SYNC_POINTS.md`（两仓均无，悬空） |
| `scripts/ecosystem-scan.js` | 165 | 全文 | 从 SOURCE_HANDLERS 动态提取，防漂移 |
| `scripts/endpoint-registry.js` | 84 | 全文 | **16 条端点（源端点 13：12 登记源中 helloworldKw 占 2 条；工具端点 3）**；v8.15.1 删重复「明确不登记」注释块并修正段头；导出 WINDOW_DAYS/CONSECUTIVE_FAIL_DAYS/EXCLUDE_DOMAINS |
| `scripts/health-alert.js` | 73 | 全文 | 缺参/非数组 exit 1；`clean()` 转义；「已有 open Issue 跳过」分支未实测 |
| `scripts/health-daily.js` | 465 | 全文 | 小样本不进 handle / dataThrough+gapDays / md+json 清理；「payload 已做 Range 校验」依赖 probe |
| `scripts/hooks/commit-msg` | 7 | 全文 | 调 `doc-sync-map.js --check`，真 exit 1 在这里 |
| `scripts/hooks/pre-push` | 16 | 全文 | 推送前拦截 |
| `scripts/hooks/prepare-commit-msg` | 13 | 全文 | 只打印摘要，不阻断（SCRIPTS.md 描述错） |
| `scripts/install-hooks.sh` | 8 | 全文 | 安装三个 hook |
| `scripts/probe.js` | 776 | 全文 | 写 README/README_HEALTH/history 三处；`parseDurationFromHead` 与 lx-source 双份实现 |
| `scripts/probe-identity.js` | 266 | 全文 | 交付身份取证（K31）：星海取链 → 跟 302 → Range 32KB → 解 ID3v2/FLAC VORBIS；判据与 `15-verify.js` 同源但独立实现（产物里的 `parseAudioTags` 需 `globalThis.lx` 桩）；不进 `npm test`（联网会抖） |
| `scripts/recheck-candidates.js` | 202 | 全文 | 候选复检写 candidate-status |
| `scripts/self-check.js` | 128 | 全文 | README 只查 `includes('v8.11.1')` → 当前版本行过期不被拦 |
| `scripts/pull-device-digests.js` | 103 | 全文 | 匿名 API 403 时降级 0 行不阻断；只读公开仓，不写 telemetry |
| `scripts/chain-sample.js` | 77 | 全文 | 只抽样启用源 1 首；失败不阻断（`--strict` 才红）；30 天滚动按 date+src 覆盖 |
| `scripts/source-audit.js` | 224 | 全文 | 35 组逐源取链；`rangeCheck` 不解析时长 → 片段判可播 |
| `scripts/source-toggles.js` | 129 | 全文 | 剥注释+配平+行内多键；20 键 |
| `test/audit/a-static.js` | 260 | 断言 | 10 条（A2~A7/B1~B6）；实跑 11/0 |
| `test/audit/tg-truth.js` | 136 | 断言 | 7 条（G1/G2/G3/G4/G9/G13/G14）；实跑 7/0 |
| `test/audit/b-logic.js` | 245 | 断言 | 30 条（C4~C10 等，含循环生成）；实跑 30/0 |
| `test/audit/d-func.js` | 241 | 断言 | 30 条（D1/I3~I5/E1~E4）；实跑 30/0 |
| `test/audit/e-extra.js` | 966 | 断言 | 94 条（含 U500/U410/U404/U429/U403 状态码族、EDGE/FAULT 五轮补测）；实跑 94/0 |
| `test/audit/f-repo.js` | 517 | 断言 | U~Z 54 条（Z6/Z7 抽取 ci.yml 告警 run 块真跑三分支；Z9 用假 git 对健康表写回做 push 失败注入）；实跑 54/0 |
| `test/audit/g-meta.js` | 451 | 断言 | 17 条（M1~M14 + M9b 行为级 require 守卫 + M9c 顶层环境侧依赖；审断言本身）；实跑 17/0 |
| `test/audit/p-gaps.js` | 182 | 断言 | 4 条（T-4/T-5/T-6/T-7 零覆盖补测）；逐条反向改坏 4/4 红 → 还原 4/0 |
| `test/audit/q-dfix.js` | 142 | 断言 | 5 条：Q1 D-04 half-open 遇 429 收口回 open（删收口段立刻红）；Q2 closed 态 429 只退避不熔断；Q3（v8.11.3）D-01 toggle 开启后失败缓存失效，先红后绿；Q4 D-08 单链悬挂源预算内超时；Q5（v8.11.4，F-01）星海后端缺 songmid 必须 PARAM_ERROR，先红后绿；实跑 5/0 |
| `test/audit/q2-dseries.js` | 84 | 断言 | 3 条：R1 D-06 布尔键 `??` 语义、R2 D-05 真键可写/死键忽略、R3 D-26 mg 链不含星海备；三条注入回退均变红，还原后 sha 一致 |
| `test/audit/anchors-contract.js` | 154 | 断言 | 4 条判据（必须显式声明 / `[]` 源不因缺 id 报错 / 声明非空须逐键验证 / 巡检样本带齐平台并集）；mock 宿主直投 `ECONNREFUSED`，负向注入 `huibq` 加回 `rid` 立即 13→12/1；实跑 13/0 + 5/5 |
| `test/audit/force-probe-contract.js` | 127 | 断言 | FP1~FP10（已知源 ok/写入立即到期/不动 breaker；未知源 resolve `{ok:false,UNKNOWN_SOURCE}` 不 reject；缺 id reject `PARAM_ERROR`；默认 flac 与大写归一）；红绿双向：产物改回 reject → FP4/FP5 立即红；实跑 10/0 |
| `test/audit/n-fixes.js` | 158 | 断言 | 4 条（F13-a/F13-b/F12/F10 推断变实测）；先红 0/4 → 修后 4/0 |
| `test/audit/quality-truth.js` | 123 | 断言 | 9 条（QT-1~QT-9：m4a/ogg 按总字节+时长估码率、wav→flac、未知总字节保留请求档、1KB Range 探针不得当全文件、200 全量响应采用 content-length、estimated/unknown 置信度）；实跑 9/0 |
| `test/audit/quality-policy-v2.js` | 214 | 断言 | 8 条（QP1~QP8：能力备档不续期、reason TTL、到期探路、超时不短路、确定性短路、429 退避、旧快照兼容）；实跑 8/0 |
| `test/audit/budget-admission.js` | 48 | 断言 | 7 条（A2-1~A2-7：BUDGET_EXHAUSTED 策略、预算源码不冒充 NETWORK_TIMEOUT、总预算+floor 16s、冷启动钳制、单链 0 宽限）；实跑 7/0 |
| `test/audit/h-toggles.js` | 170 | 断言 | 14 条（逐源开启）；实跑 14/0 |
| `test/audit/v-eligibility.js` | 116 | 断言 | 7 条（USER_OFF/DEFAULT_OFF/PLAYBACK_FAILED/短路）；实跑 11/0 |
| `test/audit/health-linkage-invariants.js` | 159 | 断言 | 4 条（链项 eligibility/链与 skipReason/建链后关源拦截）；实跑 4/0 |
| `test/audit/health-state-machine-v2.js` | 147 | 断言 | 方案 6.2 M1~M10：链项 eligibility、USER_OFF 最高、AUTO_OFF 只认 FAIL、探测不清摘除、单档隔离、短路可见、休眠优先、快照 reason 同源、快照只读、未知源；实跑 11/0 |
| `test/audit/health-authority-split.js` | 126 | 断言 |
| `test/audit/health-probe-batch2.js` | 154 | 断言 |
| `test/audit/health-eligibility-batch3.js` | 132 | 断言 | Batch 3 C1~C9：open/限流/半开在飞不入链，建链只读不推进 trial，skipReason 同 reducer，preview/短路可见，正常源带 eligibility，建链不写事件；实跑 9/0 | Batch 2 B1~B9：三档探针全走 handler、逐 target 事件、flac 失败/128k 成功只降级、UNKNOWN 不关源、全 FAIL 两轮关源、探测不清 playDead、单源只读、快照脱敏、transition 优先；实跑 11/0 | Batch 1 A1~A9：toggle 只写 user、probe 只写 auto、UNKNOWN 不关源、controls 保留手动关闭、offReason/offAt 同源、runtimeToggles 仅镜像；实跑 11/0 | Batch 0 S1~S12：新旧资格并行只读、auto-off/休眠/resolveDead/单档短路/playDead diff 全解释、建链/快照/事件零变化；实跑 12/0 |
| `test/audit/health-breaker-quality.js` | 135 | 断言 | 5 条（Q1~Q5 按档熔断/源级聚合/半开单 trial/429 分档退避）；实跑 5/0 |
| `test/audit/health-resolve-dead.js` | 106 | 断言 | 4 条（R1 取链失败只记 resolveDead/R2 链成功不清 playDead/R3 真实播放成功双清/R4 弱证据不摘除）；实跑 4/0 |
| `test/audit/health-scoped-reset.js` | 74 | 断言 | 2 条（authority 保留质量历史只复位执行门 / all 完整归零）；实跑 2/0 |
| `test/audit/health-scheduler-fake-clock.js` | 65 | 断言 | 2 条（±10% jitter 边界 / 播放取链在途暂停判定）；实跑 2/0 |
| `test/audit/q-quickjs-real.js` | 141 | 断言 | 3 条；三级依赖查找（仓内→vendor→$QUICKJS_EMSCRIPTEN→npm i），缺依赖 exit 3 |
| `test/audit/aa-p3-persist.js` | 239 | 断言 | P3 A1~A10 宿主持久化协议：导出结构/往返/URL 拒绝/版本 TTL/恢复边界/v1 拒绝/controls-only/无回滚开关；实跑 11/0 |
| `test/audit/health-persistence-v2.js` | 176 | 断言 | F36/F57 P1~P10 持久化 v2：v2 结构/v1 拒绝/controls-only/autoOff 6h/无回滚开关/拒绝非法；实跑 10/0 |
| `test/audit/health-probe-outcome.js` | 143 | 断言 | F20/F22 O1~O9 探测三值：PASS/FAIL/UNKNOWN 聚合、UNKNOWN 不累计失败、PASS 不清 playDead/resolveDead、事件无 URL；实跑 11/0 |
| `test/audit/health-probe-fidelity.js` | 171 | 断言 | F20/F22 F1~F10 探测保真：逐目标三值、全 FAIL、超时 UNKNOWN、POST 透传、check/可播校验、单源隔离、不写质量账、不清摘除、事件无 URL；实跑 11/0 |
| `test/audit/health-transition-events.js` | 112 | 断言 | F33 U1~U7 迁移事件：字段/枚举/优先级保留/probe 压缩/auto_on 单发/无敏感字段/容量 500；实跑 11/0 |
| `test/audit/health-snapshot-eta.js` | 169 | 断言 | F35 ETA/F45 限速/F46 冷启/F06 jitter/F32 eventId/F17 平台计数：字段存在、只读不改 eligible、调度 nextAt、eventId 唯一、计数守恒、默认 10% 边界；实跑 11/0 |
| `test/audit/r-admission.js` | 534 | 断言 | 23 条 A1~A20（L4 裁决层 + v8.11.6 收尾）；先红 0/11 后绿 18/0，A16~A20 逐条注入回退变红，最新 23/0 |
| `test/audit/u-cross-platform.js` | 361 | 断言 | 15 条（按脚本实际 `rec()` 编号）：U1 转 tx 并交付原版 / U2 严格匹配 302s 原版 / U3 kw 主平台成功且未搜 QQ / U4 `subSource=juheTx` / U5 二次缓存仍 tx / U6 全平台无匹配 `NOT_FOUND` / U7 `cross_platform` 事件 / U8 tx 只收 songmid / U9 慢主平台交付 kw / U10 关源后不交付缓存 / U11 wy 候选归一化 / U12 kw 候选归一化 / U13 三目标顺序 / U14 mg/kg 不再作为目标 / U15 mg 实际标签回填 kw；先红 1/8 → 绿 15/0 |
| `test/audit/v-cross-platform-stress.js` | 447 | 断言 | 13 条 V1~V13（20 并发同歌 / QQ 搜索不放大 / 50 次顺序只搜 1 次 / 201 首缓存上限 / 总开关零跨平台 / 关源重开 / remix-only 全拒绝 / 主跨交替不串 / 全目标 5xx 保留原码 / 慢主平台并发 / 事件隐私 / 100 首主命中零跨平台 / 同名同歌手时长差 199s 拒绝）；实跑 13/0 |
| `test/audit/w-fallback-owner.js` | 54 | 断言 | P1 W1~W2：W1 `inited` 已上报 / W2 5 个平台均 `fallbackOwner=source`；先红 1/2 → 绿 2/2 |
| `test/audit/x-media-envelope.js` | 161 | 断言 | P2 X1~X12：64B/1B/1KB/1MiB/8MiB 信封还原 SHA；64B FLAC 信封 `kindOf=audio`；`byteLength` 不符 `BAD_ENVELOPE`；缺片 `TRUNCATED_MEDIA`；旧 `{type:"Buffer",data}` 兼容；`inited.mediaEnvelope=2`；0 字节零长；admit 错误码；1MiB JSON.parse 基准；先红 2/4 → 绿 12/0 |
| `test/audit/security-url-guard.js` | 128 | 断言 | G6 非法 URL 防线 12 条：`validateUrl`（源返回取链）与 `probeAudioDelivery`（验真探针）对 `javascript:` / `file://` / `data:` / `//evil.com` / 空与 null 必须给 `PARAM_ERROR`（空给 `NOT_FOUND`），100KB 合法 URL 不得误杀；`upgradeToHttps` 只升 http 且不得把非法串升成合法；`HTTP_URL_REGEX` 单真相；红绿双向：放宽成正则 `/^[a-z]+:/i` → 5 条红；实跑 12/0 |
| `test/audit/r77-fixes.js` | 281 | 断言 | R77 修复回归 27 条（A01~A08 标签/匹配夹具、B01~B10 产物行为、C01~C08 源码防回退锚点）：G12 playDead.quality 往返等价（含 "*" 多档与非法拒包）/ G13 FLAC 小端长度 + ID3v2.2/2.3/2.4 真实字节夹具 / G14 快照不布防 + gate setProbe:false 静态锚点 / P2-06 探测 PASS 档位复位 / G9 有时长才加 duration 段 / 契约复核日 14 天宽限（时间可注入）/ interval 回退 / 原串优先解析 / 预热锚点分表 / 探针轮换清 singer·duration；红绿双向：7 轮旧形态重演对应断言全红后还原 26/0 |
| `test/audit/r81-proxy-compat.js` | 74 | 6 | R81 真机 QuickJS Proxy 兼容守卫：产物可执行代码（去注释）`Date.parse` / `new Proxy` 必须为 0、必须含纯算术 `parseYmdToMs`；源码 `Date.parse(` 归零；`parseYmdToMs` 与 `Date.parse` 12 例等价（闰年 / 跨纪元 / 非法输入） |
| `test/audit/readthrough-fixes.js` | 451 | 断言 | v8.16.2 通读缺陷回归 RF1~RF18：档位熔断跨重启保留（含其他档失败不抹掉已熔断档 + 全档聚合仍 open）/ 真实交付音质入账 + 降级样本不进请求分母 / 播放与取链分账 / 快照 eligible 走运行期资格 / 试探键清理命中 / preGate 不提前消耗半开名额 / gateErr 带 code 与 sourceId / 跨平台 fallback 可取消 / 兜底判据结构化（静态）/ ttl=0 死分支删除（静态）/ 取链摘除持久化 / PLATFORM_UNSUPPORTED / 逐平台资格 / kwoff 死读清除（静态）/ provider 不回写调用方对象（静态）/ 206 content-type / cacheTtlMs 热更新（静态）/ 版本口径（静态）；先红 0/18 → 绿 18/0 |
| `test/audit/s-health-events.js` | 290 | 断言 | 22 条 S1~S6（healthEvents 只读环形缓冲/同 traceId 串联/返回副本/隐私边界/超容丢弃）；先红 6 通过 16 失败 → 绿 22/0 |
| `test/audit/t-health-events-stress.js` | 146 | 断言 | 12 条 T1~T9（10000 条灌满/容量 500/dropped 9500/同 trace 链/limit 边界/隐私注入）；容量注入 500→100 翻红后还原 12/0 |
| `test/candidate-audit-test.js` | 135 | 断言 | 6 条；曾无 ID 输出，已补 |
| `test/lx-source-smoke-test.js` | 1656 | 断言 | 67 组；T50~T57 为回退必红用例 |
| `test/mutation/run.js` | 320 | 断言 | **22 变异体**；缺 esbuild 直接 exit 2；`--strict` 下 KILLED 之外全部 exit 1；字段名是 `name` 不是 `desc` |
| `test/stress-round3.js` | 364 | 断言 | 14 条 T1~T14（压「态」） |
| `test/stress-round4.js` | 1343 | 断言 | 133 条 V1a~V39b（已进 AUDIT_MATRIX） |
| `test/stress-test.js` | 228 | 断言 | 12 条 S1~S11 |
| `tools/live/host.js` | 84 | 工具 | 真宿主桩：`request(url,opts,cb)` 契约 + 302 手动跟链记 `hops` + `Range` 标记 + binary 回 Buffer；每次调用记 `{url,status,ms,hops,range}` |
| `tools/live/run.js` | 348 | 工具 | L1~L7 实跑三分支 `l1l4`/`l5`/`l6l7`；`fullCalls()` 排除 Range、`rangeCalls()` 二分，避免把验真外呼算成解析 |
| `docs/READTHROUGH.md` | 323 | 全文 | 本文件：通读台账（活文档，规则18 自校验） |
| `docs/archive/READTHROUGH_v8.16.1.md` | 337 | 全文 | 2026-11-17 `lx-source.js` 逐行通读结论文档：证伪 1 条 + 缺陷 R-01~R-12 + 无缺陷模块清单 + 复现骨架 + 修复顺序 |
| `docs/archive/READTHROUGH_v8.16.2.md` | 170 | 全文 | 2026-11-17 8.16.2 产物（6045 行）7 段逐行通读：R-13（`skipReason` 只读副作用）+ 14 观察项 + 15 排除 + 6 项测试盲区 |
| `docs/DOC_INDEX.md` | 82 | 全文 | 文档登记索引（新增文档必须先登记，规则19 硬门槛） |
| `docs/KNOWN_ISSUES.md` | 102 | 全文 | 已知问题/技术债台账（K01~K20，活文档；判断是否重构先看这里） |
| `docs/QUALITY_POLICY_OPTIMIZATION_PLAN.md` | 266 | 全文 | 音质能力备档与档位短路优化方案、复现证据、P0/P1/P2 |

## 五、维护规则（这段是契约，不是说明）

1. **触发点**：版本号变更（`@version` 改动）、每轮审计结束、新增/删除 tracked 文件、断言条数变化 —— 任一发生即刷新本文件。
2. **必须刷新什么**：§四 表里新增/删除的行、每行行数（门禁会自动改，但新文件要人补行）、§三 实跑输出、§二 四类清单状态。
3. **怎么确保没漏**：`node scripts/docs-audit.js` 必须全绿；`node -c` 等价自查见 `DEV_GUIDE.md` §九发布 SOP。
4. **新文档去哪**：先在 `DOC_INDEX.md` 登记，再在本文件相应章节挂链接；未登记时门禁规则 19 直接红。
5. **历史文档不改数**：`reports/`、`archive/`、`audit-plans/` 记录的是当时的结论，写死的旧数字属于历史事实，不回填当前值。

## 六、覆盖率重测（2026-11-10，v8.11.2 基线）

**为什么要重测**：v8.11.2 修了 F10/F12/F13 并新增 N/P 两组断言，源码行号整体位移；`AUDIT_RESULTS.md` §八 里 92.2% 的口径已不适用当前文件，继续引用就是过期数据。

**口径**（与 §八 一致，便于纵向对比）：`NODE_V8_COVERAGE` 采集 **13 个进程实例**（冒烟 + a/b/d/e/f/g/h/n/p 审计 + stress 三组 + candidate），用最内层 range 判定，纯注释行与空行不计入分母。

| 指标 | 实测值 |
|---|---|
| `lx-source.js` 总行 | 3368 |
| 有效行（非空、非纯注释） | 2640 |
| 未覆盖行 | 136 |
| **覆盖率** | **94.8%**（上轮同口径 92.2%） |

**一个必须写下来的测量假象**：`test/audit/n-fixes.js`、`test/audit/p-gaps.js` 结尾用 `process.exit(fail?1:0)` 退出（否则模块留下的定时器会让进程不退出），V8 覆盖率来不及落盘，所以**这两组刚验证过的代码在报告里仍显示未覆盖**——例如 `530~531`（探测连续通过自动启用）已被 P4 行为验证，覆盖率表里却是空的。**看到这两组已覆盖的行号出现在未覆盖清单里，不要当缺陷报。** 想消除假象需给测试加"清定时器后自然退出"的收尾，属独立改造，未做。

| `docs/音源架构执行全过程-2026-11-12.md` | 143 | 全文 | 2026-11-12 新增过程纪要：阶段时间线、八段架构、关键决策、缺陷主题、测试/发布证据、边界；无派生数字 |

**剩余 136 行的性质**：绝大多数是刻意不可达或极难驱动的路径——探测异常兜底（`492~494`）、冷启动豁免日志（`548`）、巡检定时器 tick（`618~623`）、ID3 跳过与 FLAC 块上限保护（`1124~1125`、`1117`）、非法 URL / 验真失败分支（`1238`、`1255`、`1279`）。这些不按"补覆盖率"去硬凑用例，需要真实场景再补。

### v8.13.0 新增/变更文件登记（2026-11-12）

| 文件 | 行 | 读法 | 结论 |
|---|---|---|---|
| `scripts/dump-chain.js` | 75 | 全文 | 5×4 链序 golden 生成器，只导出 active；写完退出 |
| `test/fixtures/chain-golden.json` | 102 | 全文 | v8.13.0 10 源 5×4 链序基线，Y9 逐项比对 |
| `docs/SOURCE_CAPABILITY.md` | 222 | 全文 | 13 源能力实测矩阵与适配要求 |
| `docs/SOURCE_LIFECYCLE.md` | 76 | 全文 | 当前态治理文档 |
| `docs/SOURCE_REGISTRY.md` | 111 | 全文 | 当前态治理文档 |
| `docs/SOURCE_RETIREMENT.md` | 108 | 全文 | 当前态治理文档 |
| `package-lock.json` | 502 | 全文 | esbuild 锁（2026-11-16 补读；修根 version 8.15.0→8.16.0 漂移，f-repo U14 守） |
| `package.json` | 25 | 全文 | v8.13.0/构建脚本入口/esbuild 依赖 |
| `scripts/build-source.js` | 56 | 全文 | esbuild IIFE/ES2017 单文件构建 + CJS 导出桥 + 版本头校验 |
| `scripts/check-data-retention.js` | 99 | 全文 | 只读：probe-history 覆盖天数 >30 与 health-daily >14 份时列可归档区间，不执行删除 |
| `scripts/source-inventory.js` | 112 | 全文 | 12/10/2 机器闸门 --check |
| `scripts/verify-bundle.js` | 105 | 全文 | B1~B8 构建产物校验 |
| `scripts/verify-real-platforms.js` | 83 | 全文 | 真实 HTTP 宿主五平台 `musicUrl` 取链，输出实际 `sourcePlatform/subSource/host` |
| `scripts/verify-real-platform-chains.js` | 106 | 全文 | G7 先搜平台 ID 再隔离取链；公网不可用时如实保留上游失败码 |
| `src/00-header.js` | 6 | 全文 | 单文件 banner |
| `src/80-entry.js` | 10 | 全文 | 导出面 + 非枚举 PROVIDER_SPECS |
| `src/legacy.js` | 1320 | 全文 | v8.13 实现源（契约/生命周期/取消）；8.16.2 产物侧逐行结论见 [`READTHROUGH_v8.16.2.md`](./archive/READTHROUGH_v8.16.2.md)（6045 行 7/7 段） |
| `src/providers/55-probation.js` | 41 | 全文 | 两个观察源规格 |
| `src/providers/changqingVip.js` | 20 | 全文 | 12 源契约规格 |
| `src/providers/helloworldKw.js` | 22 | 全文 | 12 源契约规格 |
| `src/providers/qingliangTx.js` | 21 | 全文 | v8.16.0 新增：晴亮 tx 第二源规格（tx chain 2 / 320k / qingliang-tx 族） |
| `src/providers/luoyueTx.js` | 22 | 全文 | v9.2.0 新增：落月 tx 第三源规格（tx chain 3 / 128k·320k·flac / vkeys-luoyue 族；只接 v3 `song/link`，v2 仅试听片段） |
| `src/providers/audius.js` | 21 | 全文 | v9.3.0 新增：Audius au 平台规格（chain au:1 / 320k / 128k·320k 同文件 / audius 族；is_streamable 判定，false 的曲 404） |
| `src/providers/huibq.js` | 23 | 全文 | 12 源契约规格 |
| `src/providers/ikun.js` | 29 | 全文 | 12 源契约规格 |
| `src/providers/index.js` | 18 | 全文 | active/probation/all 规格入口 |
| `src/providers/juheTx.js` | 21 | 全文 | 12 源契约规格 |
| `src/providers/kuwoOfficial.js` | 20 | 全文 | 12 源契约规格 |
| `src/providers/suyin163.js` | 20 | 全文 | 12 源契约规格 |
| `src/providers/suyinKuwo.js` | 30 | 全文 | 12 源契约规格 |
| `src/providers/wyOuter.js` | 20 | 全文 | 12 源契约规格 |
| `src/providers/xinghaiBackend.js` | 22 | 全文 | 12 源契约规格 |
| `test/audit/s-source-lifecycle.js` | 125 | 全文 | v8.13 审计入口 |
| `test/audit/y-provider-contract.js` | 172 | 全文 | v8.13 审计入口 |
| `test/audit/z-cancel.js` | 170 | 全文 | v8.13 审计入口 |
| `docs/V9_MODULE_MAP.md` | 20 | 逐行 | 静态核对（U 组）：语法/编码/无调试残留/非空 |
| `docs/health-daily/2026-11-03.md` | 42 | 逐行 | 静态核对（U 组）：语法/编码/无调试残留/非空 |
| `docs/health-daily/2026-11-04.md` | 41 | 逐行 | 静态核对（U 组）：语法/编码/无调试残留/非空 |
| `docs/health-daily/2026-11-05.md` | 40 | 逐行 | 静态核对（U 组）：语法/编码/无调试残留/非空 |
| `docs/health-daily/2026-11-06.md` | 41 | 逐行 | 静态核对（U 组）：语法/编码/无调试残留/非空 |
| `docs/health-daily/2026-11-07.md` | 41 | 逐行 | 静态核对（U 组）：语法/编码/无调试残留/非空 |
| `docs/health-daily/2026-11-08.json` | 54 | 逐行 | 静态核对（U 组）：语法/编码/无调试残留/非空 |
| `docs/health-daily/2026-11-08.md` | 48 | 逐行 | 静态核对（U 组）：语法/编码/无调试残留/非空 |
| `docs/health-daily/2026-11-09.json` | 48 | 逐行 | 静态核对（U 组）：语法/编码/无调试残留/非空 |
| `docs/health-daily/2026-11-09.md` | 48 | 逐行 | 静态核对（U 组）：语法/编码/无调试残留/非空 |
| `docs/health-daily/2026-11-10.json` | 39 | 逐行 | 静态核对（U 组）：语法/编码/无调试残留/非空 |
| `docs/health-daily/2026-11-10.md` | 46 | 逐行 | 静态核对（U 组）：语法/编码/无调试残留/非空 |
| `docs/health-daily/2026-11-11.json` | 40 | 逐行 | 静态核对（U 组）：语法/编码/无调试残留/非空 |
| `docs/health-daily/2026-11-11.md` | 46 | 逐行 | 静态核对（U 组）：语法/编码/无调试残留/非空 |
| `docs/health-daily/2026-11-12.json` | 66 | 逐行 | 静态核对（U 组）：语法/编码/无调试残留/非空 |
| `docs/health-daily/2026-11-12.md` | 80 | 逐行 | 静态核对（U 组）：语法/编码/无调试残留/非空 |
| `docs/health-daily/2026-11-13.json` | 66 | 逐行 | 静态核对（U 组）：语法/编码/无调试残留/非空 |
| `docs/health-daily/2026-11-13.md` | 49 | 逐行 | 静态核对（U 组）：语法/编码/无调试残留/非空 |
| `docs/health-daily/2026-11-14.json` | 65 | 逐行 | 静态核对（U 组）：语法/编码/无调试残留/非空 |
| `docs/health-daily/2026-11-14.md` | 47 | 逐行 | 静态核对（U 组）：语法/编码/无调试残留/非空 |
| `docs/health-daily/2026-11-15.json` | 64 | 逐行 | 静态核对（U 组）：语法/编码/无调试残留/非空 |
| `docs/health-daily/2026-11-15.md` | 46 | 逐行 | 静态核对（U 组）：语法/编码/无调试残留/非空 |
| `docs/health-daily/2026-11-16.json` | 53 | 逐行 | 静态核对（U 组）：语法/编码/无调试残留/非空 |
| `docs/health-daily/2026-11-16.md` | 45 | 逐行 | 静态核对（U 组）：语法/编码/无调试残留/非空 |
| `docs/health-daily/2026-11-17.json` | 187 | 逐行 | 静态核对（U 组）：语法/编码/无调试残留/非空 |
| `docs/health-daily/2026-11-17.md` | 74 | 逐行 | 静态核对（U 组）：语法/编码/无调试残留/非空 |
| `scripts/api-surface.js` | 178 | 逐行 | v9.0 起契约面分散在多个模块：公共层在 src/core/，其余仍在 legacy.js |
| `scripts/equiv-snapshot.js` | 216 | 逐行 | 确定性歌单：名字/歌手/hash/时长都由序号派生，不依赖真实曲库 |
| `scripts/lib/js-block.js` | 190 | 逐行 | 正则字面量判定：看前一非空白字符 |
| `scripts/lib/history.js` | 246 | 逐行 | 巡检历史单一读写口：`normalize`（旧 schema 归一化 + `legacy` 标记）/ `load` / `append`（原子写 + 30 天清理）/ `dateWindow` / `wilsonLower` / `prevDataDate` / `consecutiveFailDays`（全历史，跳过 legacy）/ `windowStats`（探测级 + 天级双视图，legacy 整体剔除）/ `dailyAggregate`；probe 与 health-daily 共用，删掉两边各一份约 80 行重复 |
| `scripts/lib/probe-songs.js` | 54 | 逐行 | 五平台《晴天》271s 探测歌单一真相（`SONGS` / `songOf` / `idOf` / `EXPECT_SEC`），替代 probe 与 source-audit 各写一份歌单（历史上 wy 出现过 186016 与 2652820720 两种写法） |
| `scripts/lib/source-host.js` | 106 | 逐行 | mock `globalThis.lx` 最小面后加载 `lx-source.js`；`createHost` 走真实网络并跟随 302（默认 5 跳 / 9s 超时）；`resolveUrl` 调 `SOURCE_HANDLERS[src].fn` —— 取链只有源自己一份实现，巡检不再维护第 4 份 |
| `scripts/ref-closure.js` | 183 | 逐行 | function 声明（没有 =）：取行内花括号作为函数体 |
| `scripts/v9-gate.sh` | 79 | 逐行 | 静态核对（U 组）：语法/编码/无调试残留/非空 |
| `src/core/00-host.js` | 11 | 逐行 | 宿主绑定唯一入口：`globalThis.lx` 全仓仅此一处读取，导出 `EVENT_NAMES/request/on/send/utils/env/version`；拆包后成为唯一注入点 |
| `src/core/01-log.js` | 20 | 逐行 | console 宿主防御（官方移动版不保证有 console，缺失时降级空函数）+ 三档日志 `logInfo/logWarn/logDebug`；`logEnabled`/`logDebug` 走 `__lxSourceConfig`，默认 info 开、debug 关 |
| `src/core/02-config.js` | 96 | 逐行 | `USER_CONFIG` 40 键 + `cfg()` 运行参数读取 + 探测歌单归一化（≤20 字、去重、上限 12）；`SOURCE_VERSION` 构建期 define 注入、非 bundle 回退 8.16.4；**`cfg` 仍用 `||` 读数值 → 配置 0 被默认值吞（B02-002，D-35 只修验真族）** |
| `src/core/02-error-codes.js` | 35 | 逐行 | 19 个对外错误码（E0 直接校验）；`UNSUPPORTED_ACTION` 为 R71d 新增的**业务否定码**（源存在但不支持该 action，上层据此走 miss 而非 failed）；`PLAYBACK_FAILED` 为 v8.16.3 新升一等码（本地拦截，禁止记账/失败缓存/跨平台惩罚）；`BUDGET_EXHAUSTED` 独立成码不计源健康 |
| `src/core/03-events.js` | 124 | 逐行 | 健康事件环形缓冲 + 字段白名单/隐私正则校验 + trace 挂载（`HEALTH_TRACE_KEY`）；`assertEventFieldPolicy()` 的加载即守留在 legacy 原地以保加载顺序；**淘汰用线性 `findIndex` → 容量上限内 O(n²)（B02-009）** |
| `src/core/04-cancel.js` | 69 | 逐行 | 协作式取消令牌（QuickJS 无 AbortController）：`cancel()` 幂等、`onCancel` 对已取消即时回调、`raceWithCancel` 保证竞速输家立即 CANCELED 且不再占预算/写健康账 |
| `src/core/05-verdict.js` | 173 | 逐行 | 错误码→提示（`CODE_HINT`）/失败缓存 TTL（`FAIL_CACHE_TTL_BY_CODE`）/排序（`CODE_RANK`）、`ADMISSION_POLICY` 交付性与记账裁决、`crossFallbackPolicy` + `CROSS_NO_FALLBACK_CODES` 跨平台兜底判据 |
| `src/core/06-binding.js` | 32 | 逐行 | 依赖注入绑定表（依赖倒置）：`bindDep` 重复绑定抛错防两套实现并存、`dep` 未绑定立即抛错不静默返回 undefined、`depBound` 探测；环打断后子簇才可迁 |
| `src/core/07-net.js` | 270 | 逐行 | 网络基建 + 双缓存：`httpRequest`/`httpRequestWithRetry`、`TIMEOUT_CONFIG`、移动 UA 池轮换（`__uaCounter`）、`upgradeToHttps`、`successCache`/`failCache` 读写；**`follow_max` 默认 0 → 302 不跟随，与头注释承诺相反（B01-006）**；**失败缓存残留 `effTtl === undefined` 死分支（B02-005）** |
| `src/core/08-media.js` | 487 | 逐行 | 媒体解析与交付验真：FLAC/MP3/MPEG 帧头解析（`parseFlacDuration`/`parseMp3Info`）、base64 信封解码（`decodeMediaEnvelope`/`mediaEnvelopeErrorCode`）、音频字节嗅探（`sniffAudioBytes`/`kindOf`） |
| `src/core/09-match.js` | 272 | 逐行 | 身份匹配与音质排序：`songInfoMatch`/`titleMatch`/`artistMatch`/`durationMatch`、`identityNormalize`/`identityTokens`、`FRAGMENT_RE`/`isPreviewFragmentUrl` 片段判据、`QUALITY_RANK` 档位排序、`durationHintByKey` 时长提示 |
| `src/core/10-vendors.js` | 144 | 逐行 | 外部接口常量与供应商取链碎片（20 个互不连通孤岛分量 / 22 定义）：`KUWO_SEARCH_API`/`QQ_SEARCH_API`/`WY_SEARCH_API`/`GD_API` 等 + `lingchuanGetUrl`/`xinghaiBackupGetUrl`；**三个退役源取链函数仍打入发布包（B01-002）**；**聆川/Huibq「未配置」守卫恒假、CONFIG_ERROR 分支不可达（B01-003/B02-003）** |
| `src/core/11-provider-meta.js` | 8 | 逐行 | 纯常量层（无依赖）：`PROVIDER_LIFECYCLE`（active/probation）与 `PROVIDER_AUTH`（none/optional），冻结对象；供 22-chain / 25-handlers 顶层直接引用 |
| `src/core/12-provider-contract.js` | 137 | 逐行 | Provider Contract 校验：`validateProviderContracts` 硬校验 14 登记 / 12 上链 / 2 观察、每源必须含 128k 与 maxQuality、probation 无链位次且默认关、每平台至少 1 上链源且位次不重复；`KNOWN_COVERAGE_GAPS` 登记 mg/kg 单源高危、tx 多源中危；**tx 行 reason 漏记 qingliangTx、reviewAt 与登记表不一致（B04-001）** |
| `src/core/13-chain-helpers.js` | 216 | 逐行 | 链路辅助：`suyinKuwoGetUrl`/`suyinGetUrl`、`skipReason`/`structuralSkipReason`（R-13 只读语义）、`sortChainByHealth`、`getUrlWithCrossPlatformFallback`；**C10 只断言 10/10 成功，重复外呼/重复写缓存无上限断言（B06-003）** |
| `src/core/14-lyric.js` | 93 | 逐行 | 歌词/封面/头探测：`getLyricForPlatform`（仅 wy，歌词不重试以免 5s→10s 拖慢切歌）、`getPicForPlatform`（wy 必须回退 `songs[0].album.picUrl/blurPicUrl`，顶层 picUrl 恒 null）、`kuwoPicSearch`（`hts_MVPIC` 优先、`MVPIC` 拼 `img2.kuwo.cn`） |
| `src/core/15-verify.js` | 353 | 逐行 | 交付验真三阈值（`VERIFY_MIN_ORIGINAL_SEC`/`VERIFY_DUR_GAP_SEC`/`VERIFY_DUR_RATIO`）+ `verifyDelivery`、`probeAudioDelivery`/`probeByHeaders`/`headerEvidence`、`qualityFromDelivery`/`qualityConfidenceOf`（估算档不宣称精确档） |
| `src/core/16-chain-misc.js` | 102 | 逐行 | 健康间隔与音质链：`HEALTH_CHECK_INTERVAL_MS`=10min + `nextHealthCheckDelay` 抖动（`healthCheckJitterRatio` 默认 0.1）、`buildQualityChain` 从请求档逐档下降到 128k **末档强制保底**（v8.11.2 N3：旧实现只拿 rest[0]+128k 跳过中间档）、`createTemplateVipSource`（kw 128k 固定 standard + 302 跟随 + http→https） |
| `src/core/17-health-check.js` | 894 | 逐行 | 健康巡检调度/探活/结果应用/历史：`startHealthCheck`/`probeSchedule`/`runHealthCheck`/`tierShouldProbe`/`probeSingleSource`/`applyProbeResult`/`getHealthSnapshot`、`PROBE_PASS_REQUIRED` 门限、`healthHistory` 上限；**快照对 5 平台 × 4 音质逐档重建竞速链，高频轮询重复计算（B02-008）** |
| `src/core/18-health-persist.js` | 271 | 逐行 | 健康状态持久化校验/序列化/版本：`restoreHealthState`、`HEALTH_STATE_ACCEPTED_VERSIONS` 区间、`HEALTH_STATE_MAX_BYTES`/`TTL`/`FUTURE_TOLERANCE` 上限、`HEALTH_FORBIDDEN_KEYS` 禁键、`isAcceptedSourceVersion`；**v8.16.4 起 `breaker` 与 `playDead.quality` 随快照往返（B02-001 已修）** |
| `src/core/19-dispatch.js` | 703 | 逐行 | 裁决/竞速/闸门：`fallbackRace`/`raceFirst`（多源竞速）、`wrapExecute`（交付前验真 + 账本）、`revertHalfOpenOnSkip`、`throttleCheck`（限流窗口）、`recordSuccess`/`noteQualityDowngrade`/`applyAdmission`/`syncSourceBreaker`、`SOURCE_MAX_CONCURRENCY`；**a-static B6 吞异步 rejection（B06-002）**；**时序敏感断言可假红（B07-006）** |
| `src/core/21-cross-search.js` | 181 | 逐行 | 跨平台搜索候选：`crossSearchPlatform`、`normalizeQQCandidate`/`normalizeWYCandidate`/`normalizeKWCandidate`、`scoreCrossCandidate`/`pickCrossCandidate`、`strictTitleMatch`/`crossVariantCompatible`（`CROSS_VARIANT_RE` 变体词兼容） |
| `src/core/22-chain.js` | 986 | 逐行 | 取链主路径：`tryCrossPlatformFallback`/`CROSS_PLATFORM_ORDER`、`getUrlWithFallback`（含 cancelToken）、`resolveBudgetBounds`（总预算 + 末档保底 16s）、`buildSourceChain`/`computeEligibility`/`getDeliveryQuality`/`noteQualityCeiling`、`warmUpColdStartSources`；**冷启预热硬编码平台 kw 与固定歌曲，与 guard 请求平台不一致（B02-006）** |
| `src/core/24-kuwo-official.js` | 106 | 逐行 | 酷我官方线路：`kuwoOfficialGetUrl`/`kuwoOfficialSearch`/`kuwoOfficialConvert`（音质转换 API） |
| `src/core/25-handlers.js` | 671 | 逐行 | 平台处理器表：`SOURCE_HANDLERS`（13 登记）+ `provider` 工厂 + 各平台取链入口（wyOuter/xinghaiBackend/helloworldKw/changqing/huibq/juhe/qingliangTx/ikun）+ `providerQualitys`/`assertDeliverableUrl`/`isAudioPlayable`；**退役源 id 残留（B01-001）**；**Huibq 假成功正则过宽（B02-007）** |
| `src/core/27-sources-admin.js` | 121 | 逐行 | 源开关与账本清理：`toggleSource`、`clearSourceLedger`/`clearCrossFallbackCache`/`clearResolveDead`/`clearPlayDeadTrials`、`clearTrialKeys`（R-05 裸键 + 历史前缀双删）、`probeState`/`playDeadTrialAt` |
| `src/core/28-health-export.js` | 117 | 逐行 | 健康状态导出：`exportHealthState`（只导出/恢复 v2，`HEALTH_STATE_VERSION=2`）、`HEALTH_STATE_SOURCE_VERSION`（8.16.4）、`HEALTH_QUALITIES`/`HEALTH_STATES` 枚举、`collectHealthControls`；**v8.16.4 起 `byQuality[q].breaker` 与 `playDead.quality` 入快照（B02-001）** |
| `src/core/29-search.js` | 95 | 逐行 | 聚合搜索入口：`suyinKuwoSearch`、`parseMessageSongInfo`（消息歌解析）、`setDurationHint`（身份键旁路 Map，不回写 App 桥对象）、`boundedMapSet`（`MEMORY_MAP_MAX` 容量上限） |
| `src/core/30-suyin-extra.js` | 66 | 逐行 | 溯音补充线路：`suyinMiguGetUrl`（咪咕）、`buildSearchKeywords`（搜索词构造，多词组合） |
| `src/core/31-suyin-qq.js` | 66 | 逐行 | 溯音 QQ 线路：`suyinQQGetUrl`/`getQQSongId`（songId 解析）、`qualityToSuyinQQ`（音质映射 `QUALITY_TO_X`）、`SUYIN_QQ_KEY`/`SUYIN_QQ_API` |
| `src/core/33-cross-cache.js` | 47 | 逐行 | 跨平台兜底缓存：`CROSS_FALLBACK_CACHE_MAX`/`TTL`、`crossCacheKey`、`get`/`set`/`deleteCrossFallbackCached`；**超容量整表 `clear()` 而非 LRU（B02-004）** |
| `src/core/34-breaker-state.js` | 60 | 逐行 | 熔断计数/播放摘除/解析摘除/音质短路：`breakerMap`、`playDeadStreak` + `playDeadQuality`（v8.16.4 档位归因）、`playDeadDeadline`、`resolveDeadStreak`/`resolveDeadDeadline`、`qualitySkipProbeAt`/`qualityShortCircuitKey`/`forceQualityProbe`；状态对象必须保持同一引用 |
| `src/core/35-source-switch.js` | 84 | 逐行 | 源开关三态：`SOURCE_TOGGLES` 默认表、`userEnabled`/`autoOff`（+`autoOffReason`/`autoOffAt`）/`manualOff`/`effectiveEnabled`/`runtimeToggles`；状态对象必须保持同一引用（写时其它模块立即可见）；**退役源仍写在册文档（B01-005）** |
| `test/fixtures/api-surface.json` | 173 | 逐行 | 静态核对（U 组）：语法/编码/无调试残留/非空 |
| `test/fixtures/equiv-baseline.json` | 12991 | 逐行 | 静态核对（U 组）：语法/编码/无调试残留/非空 |
| `scripts/cross-repo-version.js` | 55 | 逐行 | 跨仓版本闸门：用 App 正则解析源仓产物，产物版本必须等于 legacy 版本 |
| `scripts/layer-check.js` | 92 | 逐行 | 分层依赖检查：core 无环/无反向 require/无同名定义/不直读 lx |
| `scripts/schema-parity.js` | 48 | 逐行 | 静态核对（U 组） |
| `scripts/sign-release.js` | 97 | 逐行 | ed25519 发布签名：生成密钥/签名产物/验签 |
| `lx-source.js.manifest.json` | 9 | 全文 | ed25519 发布签名清单（artifact/version/size/sha256/sigAlg/keyId/sig）；B2 起入库以支撑 App 的 CDN 兜底通道验签 |

## 七、验证债清算（2026-11-10，只清「能查实的」）

| 债 | 原表述 | 实查结论 | 证据 |
|---|---|---|---|
| probe-history 11-08 单日 215 条 | 「单日 215 条异常，未查」 | **非异常**：当日 20 个端点共跑 12 轮（20×12≈240，其中部分重复请求合并计 215），`(date,url)` 唯一组合正好 20 | 逐行解析 `docs/probe-history.jsonl`：11-08 记录 215 / 唯一 (date,url) 20，单 url 出现 12 次 |
| 25 distinct url vs 登记表 20 | 「对不上」 | **对得上**：25 是历史累计，其中 5 个是已退役或非音频端点（sayqz 旧域、lingchuan、ikunshare 旧域、kuwo 封面模板 `img2.kuwo.cn/${item.MVPIC}`、GitHub releases 更新检查）；**当日实际探测 20 个，与登记表 20 条一致** | 同上 + 登记表正则抽取计数 20 |
| `ARCHIVE_OLD_TAGS.md` 旧 tag 是否真删 | 「未核远端」 | **真删了**：远端只剩 `v1.0~v8.0` 共 8 个新体系 tag，v11~v29 旧 tag 零残留 | GitHub API `repos/luanmuc/backend-api/tags` |
| F17 三个明文端点 cleartext | 「宿主 cleartext 未验证」 | **不是缺陷（但台账记错了数量）**：明文端点实为 **8 个**（`search.kuwo.cn`、`antiserver.kuwo.cn`、`175.27.166.236` 两条、`music.nxinxz.com` 三条、`nmobi.kuwo.cn`）；App 侧 `android/app/src/main/res/xml/network_security_config.xml` 为 `base-config cleartextTrafficPermitted="true"`，Android 不拦 | 见上文件；`curl` 实测 4 个域名均支持 TLS（https 200/404），`175.27.166.236` 无 TLS（https 000、http 200） |

**为什么没顺手改 http→https**：`search.kuwo.cn` / `antiserver.kuwo.cn` 的 https 可达只是「裸路径 200」，带真实参数、真实取链的端到端行为没验过；`music.nxinxz.com` 与 `nmobi.kuwo.cn` 带参在 http/https 下**同为 404**（源本身已废）。在没有端到端证据前改协议，是拿「能用的酷我搜链」去换一个理论收益，不做。等真机验真（L4）时一并实测再定。
