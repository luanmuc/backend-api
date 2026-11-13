# 全仓通读台账（READTHROUGH）

> **这是活文档：每次版本号变更或每轮审计后必须刷新，不许过期。**
> 谁看住它：`node scripts/docs-audit.js` 规则 18 —— 逐行行数、文件数、总行数、版本、以及「是否有 tracked 文件漏登」全部机器校验；行数不符会被自动改回实测值，漏登文件直接报 ❌。HEAD 一行按「必须是当前 HEAD 的祖先」校验（落后 ≤20 条只报 🟡、不改写）——避免审计每次把自己写成待提交改动。
> 登记处：[`DOC_INDEX.md`](./DOC_INDEX.md)。新增任何文档 → 先登记，再写内容。
>
> **时效说明**：以下逐文件结论是 2026-11-10 通读时的历史快照，保留作为审计证据；当前版本号、断言数、行数以 `README.md`、`docs/TESTING.md` 与 `scripts/docs-audit.js` 的实测为准。

HEAD `0cba276`（v8.13.0）

> 复核说明（2026-11-12）：逐文件结论沿用 2026-11-10 全量通读快照；版本/入口/文件数已同步当前值。
文件数：**135**　总行数：**34674**（`git -c core.quotepath=false ls-files` + `wc -l` 实测）

## 一、先说三个硬阻塞（比数字过期严重）

| # | 事实 | 证据 |
|---|---|---|
| X1 | ~~远端巡检已断 2 天~~ **已澄清（2026-11-10）**：巡检从未停，2026-11-10T02:27Z 有一次 schedule run 并成功提交 `4f031f1`；早前判断错在「只在本地 `git log origin/master` 看，没再 fetch」——本地领先 100 个提交、fetch 后 behind 1 就是它。`README_HEALTH` 已更新到 `2026-11-10T02:27Z`，`health-daily/2026-11-10.*` 已生成。真正的问题只剩 `test` job 红在 L2 自检（缺 v8.10.12 版本条目，本地 v8.11.2 已补） | `git fetch` → `git status -sb` = `[ahead 100, behind 1]`；GitHub API runs 显示 11-10T02:27 failure（probe/ecosystem job success，test job step7 L2 失败）；远端 commits 最新 `4f031f1` |
| X2 | 本地 v8.13.0 单提交领先 `origin/master` 1 个提交；按用户要求不推送，远端 CI 未跑 | `git status -sb` = `## master...origin/master [ahead 1]`；`git rev-parse origin/master` = `0cba276`；不声称远端 CI 绿 |
| X3 | ~~变异门禁 fail-open~~ **已闭环（v8.11.2）**：`ci.yml` 补 `--strict`，且 2026-11-10 实测 `--full --strict` 全量 **22 killed / 0 survived**、rc=0；门禁从此真会拦人（2026-11-12 复跑首轮 19 killed + 3 skipped——MU4/MU10/MU13 锚点被现行源码改得失配，修锚点后 3/3 killed，22/22 覆盖；不是 survived） | 旧：`ci.yml` 变异 job 不带 `--strict`；新：本日志 + `docs-audit` 规则16 |

## 二、四类清单（详细证据见 §四）

| 类别 | 条数 | 摘要 |
|---|---|---|
| **未审计** | A1 8 文件 / A4 5 类文档盲区 | 8 个文件 2298 行从未进矩阵；N 组「无回归保护清单」已于 2026-11-10 完成（39 条修复配对：16 有锚点 / 23 无锚点，其中 10 条需行为断言**已全部闭环**：D-04→Q1/Q2、D-01→Q3、D-08→Q4、D-05/06/26→R1~R3，D-10/11/12 复核出早有真保护并重取红证据，D-02 静态核实），见 `docs/audit-plans/round4.md` §3 |
| **数据过时** | 54 处 | 已由本轮门禁接管可计算项（见 §三）；剩余语义类逐条列在清单原文 |
| **未测试** | 15 道门禁入口全覆盖（13 个测试脚本 + 自检 + 文档门禁），原 7 项该测未测剩 3 项 | 已补：`CONFIG_ERROR` TTL（N4）、320k 跳档（N3）、`juhe` 字符串码（N1/N2）、四段零覆盖（P1~P4）；仍缺：仅 L4 真机播放（T10 已由 Z7 实测、T33 根因已定位并修复） |
| **未验证** | 仅剩 1 项 | F10~F13 已实证（N1~N4）；变异 22/0 已全量；T10 三分支已由 f-repo Z7 真跑；T33 根因=分档预算 1ms 与 mock 同毫秒竞争，已改 -1（确定性）；唯一剩余是 L4 真机播放 |

## 三、本轮实跑证据（新鲜，非引用）

| 命令 | 输出 |
|---|---|
| `test/lx-source-smoke-test.js` | **67 组用例**，rc=0 |
| `test/audit/{a-static,b-logic,d-func,e-extra,f-repo,g-meta,h-toggles}.js` | 10 / 30 / 30 / 92 / 52 / 14 / 14 / 4 / 4 / 2，全 rc=0 |
| `test/candidate-audit-test.js` | 6 通过 / 0 失败 |
| `test/audit/q-quickjs-real.js` | 3 通过 / 0 失败（真引擎） |
| `test/stress-test.js` | 12 / 0 |
| `test/stress-round3.js` | 14 通过 / 0 失败 |
| `test/stress-round4.js` | 133 通过 / 0 失败 |
| `test/mutation/run.js` | 22 个变异体（**本轮未全量跑**） |

合计：冒烟 67 + 审计 249 + 压测 **159**（12+14+133）= **475**；变异 22。
（更正：本轮初稿把压测写成了 163，是加法错误；12+14+133=159。）

## 四、逐文件通读结论（当前 99 个文件；2026-11-10 全量通读 + 后续新增文件登记）

读法：`全文` 逐行读完；`断言` 按断言 ID + 断言名 + 实跑输出逐条核对；`生成` 按记录结构统计核对；`归档` 历史文档读正文与结论段。

| 文件 | 行 | 读法 | 结论 |
|---|---|---|---|
| `.github/workflows/ci.yml` | 207 | 全文 | 13 个 job；断言数注释过期（32/21/22）；**mutation 未带 `--strict`（X3）**；schedule `0 20 * * *`；probe 只放行 exit 2，其余显式失败 |
| `.github/workflows/docs-audit.yml` | 48 | 全文 | 注释仍写「probe UTC 06:00」；红项硬失败正确；`--dry-run` 段吞错（`|| true`） |
| `.gitignore` | 2 | 全文 | 只有 `node_modules/`；`.cov/` 不在仓内 |
| `README.md` | 119 | 全文 | **L14 当前版本 v8.10.4 / @version 8.10.3 与 L73 v8.11.1 自相矛盾**；L73 写 32 断言（实 12） |
| `README_HEALTH.md` | 44 | 生成 | 20 端点 / 可用 11；更新于 11-08 → 已 2 天未刷新 |
| `lx-source.js` | 5294 | 全文 | 40 键 `USER_CONFIG` / 15 `ALLOWED_KEYS` / 16 错误码；12 处可疑点见 F07~F22（4 条待实证） |
| `docs/AGENTS.md` | 190 | 全文 | 协作 7 规则 / L0~L4 验证链；「4 处 clearTimeout」实为 5 |
| `docs/ARCHITECTURE.md` | 94 | 全文 | 「39 键」实 40；「3136 行」+ 八段行段表全部漂移（与 DEV_GUIDE 冲突）→ **2026-11-12 已修：4509 行** |
| `docs/ARCHIVE_OLD_TAGS.md` | 138 | 归档 | 旧 tag 表（v11.11→v29.x）；「旧 tag 已全部删除」未核远端 |
| `docs/AUDIT_MATRIX.md` | 175 | 全文 | 67 行 vs 75 文件 → 漏 8 个；行数全过期（3185/1111/838/174…）；自称「未覆盖 0」已不成立 |
| `docs/AUDIT_PLAN.md` | 514 | 全文 | T 组 5 通过/3 部分/5 未通过；V 组 36 项 7✅/10⚠️/19❌；15 条修复全落地；端点 20/79 文件 20309 行已于 2026-11-10 校正 |
| `docs/AUDIT_PLAN_v10.md` | 303 | 全文 | 249 / 159（round4 129）/ 16 / 467 均过期；§6.2 `e-extra` 84→92；§七 4 条已知取舍 |
| `docs/AUDIT_RESULTS.md` | 1999 | 全文 | D-01~D-39 总账 + §0~§26.13；历史段落数字按规则冻结（写的是当时事实）；U 组「.js 数」已校正为 31 |
| `docs/CHANGELOG.md` | 59 | 全文 | 版本摘要，末条到 v8.11.1；无派生数字 |
| `docs/DEV_GUIDE.md` | 514 | 全文 | §二行段已到 3357（与 ARCHITECTURE 冲突）；§11.1 面板表 14 行缺 `memoryMapMax`；L371 92/55 自相矛盾；L3 仍写 v8.10.12 |
| `docs/DOC_SEMANTIC_CHECKLIST.md` | 36 | 全文 | 机审不了的语义项；「17 条规则」实 14 |
| `docs/INTERFACE_CHANGE_PLAYBOOK.md` | 61 | 全文 | 跨仓改接口 7 步；与当前 action 面一致 |
| `docs/ITERATION_ROADMAP.md` | 325 | 全文 | 三层目标；**32 断言/49 文件/897→430/白名单 14/趋势 60 条 全过期**；3 条 `[ ] 待开发`（服务器）/ 2 条触发式未闭环 |
| `docs/PROGRESS_round5.md` | 58 | 全文 | 第五轮进度记录；数字停在 82 通过（现 92） |
| `docs/README.md` | 68 | 全文 | 文档地图；「5 个测试入口」实 14；「D-01~D-26」已到 D-39 |
| `docs/SCRIPTS.md` | 54 | 全文 | 14 脚本 + 3 hook；「17 条规则」实 14；行数 235/110 实 236/111；prepare-commit-msg 的 exit 1 描述属 commit-msg |
| `docs/SOURCE_AUDIT.md` | 104 | 全文 | 11-06 基线 21/35 + 11-09 顶注 10/10；「短路探路 6h」实默认 1h |
| `docs/TESTING.md` | 147 | 全文 | 口径正确（253 审计 / 479 合计 / 22 变异）；72 文件、58/14145、203.45KB 三处过期（历史值已冻结） |
| `docs/archive/AUDIT_PROGRESS-2026-11-07.md` | 82 | 归档 | 96 维执行轨迹；F-08~F-14 待决策记录（部分已修） |
| `docs/archive/AUDIT_REPORT-2026-11-05.md` | 146 | 归档 | 音源+App 五步审计 13 问题（2 中 11 低） |
| `docs/archive/AUDIT_REPORT-2026-11-07.md` | 295 | 归档 | 15 项修复 + §10.2 仍未做（L4 真网络 / F-12 第二方案 / 面板 raceBudgetMs 说明） |
| `docs/audit-plans/round1.md` | 90 | 归档 | A~I 九维 50 ID → 落地 72 条 |
| `docs/audit-plans/round2.md` | 186 | 归档 | J~T 十组；**§O 冷启动与短路 5 项【未测】**，后续部分转正 |
| `docs/audit-plans/round3.md` | 78 | 归档 | U~Z 六组计划；分母写 49 文件 |
| `docs/audit-plans/round4.md` | 235 | 全文 | 归档计划；**N 组已完成**（39 条配对 16/23 + 6 条真回退）、O 组覆盖率已落地（94.8%）；M13/M14 仍未落地 |
| `docs/audit-plans/round5.md` | 111 | 全文 | MUT 12 算子 / 16 实例口径区分；EDGE/TTL ±1ms、`songmid` 含 `|` 未做理由 |
| `docs/audit-plans/stress-round4.md` | 99 | 归档 | V 组 21 组·66 条 → 落地 133 |
| `docs/audit-plans/stress-round5.md` | 49 | 归档 | 第五轮压测设计 |
| `docs/candidate-status.md` | 8 | 生成 | hyw 已恢复 / huanyin 需人工；依赖 recheck 是否真跑 |
| `docs/health-daily/2026-11-03.md` | 42 | 生成 | 首份日报（19 端点 / 9 建议摘除） |
| `docs/health-daily/2026-11-04.md` | 41 | 生成 | 同上系列 |
| `docs/health-daily/2026-11-05.md` | 40 | 生成 | 同上系列 |
| `docs/health-daily/2026-11-06.md` | 41 | 生成 | 同上系列 |
| `docs/health-daily/2026-11-07.md` | 41 | 生成 | 同上系列 |
| `docs/health-daily/2026-11-08.md` | 48 | 生成 | 参与判定 10 / 登记 20 ✔；今日变化 2 条；**最新一份，此后无产物** |
| `docs/health-daily/2026-11-09.md` | 48 | 生成 | 11-09 日报（rebase 带入；与 11-08 同结构，参与判定/需处理/今日变化三栏） |
| `docs/health-daily/2026-11-10.md` | 46 | 生成 | 11-10 日报（rebase 带入，远端 probe 产出） |
| `docs/health-daily/2026-11-10.json` | 39 | 生成 | 同份日报的 json |
| `docs/health-daily/2026-11-11.md` | 46 | 生成 | 11-11 日报（rebase 带入，远端 probe 产出） |
| `docs/health-daily/2026-11-11.json` | 40 | 生成 | 同份日报的 json |
| `docs/health-daily/2026-11-12.md` | 80 | 生成 | 11-12 日报（rebase 带入，远端 probe 产出） |
| `docs/health-daily/2026-11-12.json` | 66 | 生成 | 同份日报的 json |
| `docs/health-daily/2026-11-13.md` | 49 | 生成 | 11-13 日报（远端 probe 产出，squash 带入基线） |
| `docs/health-daily/2026-11-13.json` | 66 | 生成 | 同份日报的 json |
| `docs/health-daily/2026-11-09.json` | 48 | 生成 | 同日 json（date/prevDate/registered/judged/handle/watch/changes） |
| `docs/health-daily/2026-11-08.json` | 54 | 生成 | 字段 date/prevDate/prevDateMode/prevDates/registered/judged/handle/watch/changes |
| `docs/probe-history.jsonl` | 784 | 生成 | 664 条全可解析；10-28→11-08；25 distinct url（registry 20）；11-08 单日 215 条异常 |
| `docs/reports/v8.11.1-第五轮审计结算.md` | 122 | 全文 | 五组账 + 5 次自我推翻；e-extra 82 / 3179 行 / 66 文件 过期 |
| `docs/reports/v8.11.1-第六轮缺口审计.md` | 480 | 全文 | G1~G11 + §12.5 端到端 10/10 + D-27/28；尾部 6 条遗漏自查 |
| `scripts/candidate-audit.js` | 342 | 全文 | mockLoadScript 同步化定时器 → 递归 setTimeout 脚本会栈溢出（仅候选用，风险低） |
| `scripts/cn-date.js` | 17 | 全文 | 北京日期单一来源 |
| `scripts/docs-audit.js` | 394 | 全文 | **14 条规则**；不校 README 当前版本行 / CI 数字 / 矩阵数字（过时数字的根因） |
| `scripts/doc-sync-map.js` | 111 | 全文 | 规则指向 `docs/SYNC_POINTS.md`（两仓均无，悬空） |
| `scripts/ecosystem-scan.js` | 147 | 全文 | 从 SOURCE_HANDLERS 动态提取，防漂移 |
| `scripts/endpoint-registry.js` | 80 | 全文 | **20 条端点（纠正我早前「19」的误判）**；note 行号全过期；导出 WINDOW_DAYS/CONSECUTIVE_FAIL_DAYS/EXCLUDE_DOMAINS |
| `scripts/health-alert.js` | 66 | 全文 | 缺参/非数组 exit 1；`clean()` 转义；「已有 open Issue 跳过」分支未实测 |
| `scripts/health-daily.js` | 352 | 全文 | 小样本不进 handle / dataThrough+gapDays / md+json 清理；「payload 已做 Range 校验」依赖 probe |
| `scripts/hooks/commit-msg` | 7 | 全文 | 调 `doc-sync-map.js --check`，真 exit 1 在这里 |
| `scripts/hooks/pre-push` | 16 | 全文 | 推送前拦截 |
| `scripts/hooks/prepare-commit-msg` | 13 | 全文 | 只打印摘要，不阻断（SCRIPTS.md 描述错） |
| `scripts/install-hooks.sh` | 8 | 全文 | 安装三个 hook |
| `scripts/probe.js` | 734 | 全文 | 写 README/README_HEALTH/history 三处；`parseDurationFromHead` 与 lx-source 双份实现 |
| `scripts/recheck-candidates.js` | 146 | 全文 | 候选复检写 candidate-status |
| `scripts/self-check.js` | 109 | 全文 | README 只查 `includes('v8.11.1')` → 当前版本行过期不被拦 |
| `scripts/source-audit.js` | 175 | 全文 | 35 组逐源取链；`rangeCheck` 不解析时长 → 片段判可播 |
| `scripts/source-toggles.js` | 125 | 全文 | 剥注释+配平+行内多键；20 键 |
| `test/audit/a-static.js` | 206 | 断言 | 10 条（A2~A7/B1~B6）；实跑 10/0 |
| `test/audit/b-logic.js` | 232 | 断言 | 30 条（C4~C10 等，含循环生成）；实跑 30/0 |
| `test/audit/d-func.js` | 230 | 断言 | 30 条（D1/I3~I5/E1~E4）；实跑 30/0 |
| `test/audit/e-extra.js` | 927 | 断言 | 94 条（含 U500/U410/U404/U429/U403 状态码族、EDGE/FAULT 五轮补测）；实跑 94/0 |
| `test/audit/f-repo.js` | 406 | 断言 | U~Z 52 条（Z6/Z7 抽取 ci.yml 告警 run 块真跑三分支）；实跑 52/0 |
| `test/audit/g-meta.js` | 314 | 断言 | 14 条 M1~M14（审断言本身）；实跑 14/0 |
| `test/audit/p-gaps.js` | 165 | 断言 | 4 条（T-4/T-5/T-6/T-7 零覆盖补测）；逐条反向改坏 4/4 红 → 还原 4/0 |
| `test/audit/q-dfix.js` | 133 | 断言 | 5 条：Q1 D-04 half-open 遇 429 收口回 open（删收口段立刻红）；Q2 closed 态 429 只退避不熔断；Q3（v8.11.3）D-01 toggle 开启后失败缓存失效，先红后绿；Q4 D-08 单链悬挂源预算内超时；Q5（v8.11.4，F-01）星海后端缺 songmid 必须 PARAM_ERROR，先红后绿；实跑 5/0 |
| `test/audit/q2-dseries.js` | 79 | 断言 | 3 条：R1 D-06 布尔键 `??` 语义、R2 D-05 真键可写/死键忽略、R3 D-26 mg 链不含星海备；三条注入回退均变红，还原后 sha 一致 |
| `test/audit/n-fixes.js` | 150 | 断言 | 4 条（F13-a/F13-b/F12/F10 推断变实测）；先红 0/4 → 修后 4/0 |
| `test/audit/h-toggles.js` | 170 | 断言 | 14 条（逐源开启）；实跑 14/0 |
| `test/audit/v-eligibility.js` | 116 | 断言 | 7 条（USER_OFF/DEFAULT_OFF/PLAYBACK_FAILED/短路）；实跑 7/0 |
| `test/audit/health-linkage-invariants.js` | 137 | 断言 | 4 条（链项 eligibility/链与 skipReason/建链后关源拦截）；实跑 4/0 |
| `test/audit/health-breaker-quality.js` | 137 | 断言 | 5 条（Q1~Q5 按档熔断/源级聚合/半开单 trial/429 分档退避）；实跑 5/0 |
| `test/audit/q-quickjs-real.js` | 127 | 断言 | 3 条；三级依赖查找（仓内→vendor→$QUICKJS_EMSCRIPTEN→npm i），缺依赖 exit 3 |
| `test/audit/aa-p3-persist.js` | 176 | 断言 | P3 A1~A6 宿主持久化协议：导出结构/往返/URL 拒绝/版本 TTL/恢复边界；实跑 6/0 |
| `test/audit/r-admission.js` | 499 | 断言 | 23 条 A1~A20（L4 裁决层 + v8.11.6 收尾）；先红 0/11 后绿 18/0，A16~A20 逐条注入回退变红，最新 23/0 |
| `test/audit/u-cross-platform.js` | 354 | 断言 | 15 条（按脚本实际 `rec()` 编号）：U1 转 tx 并交付原版 / U2 严格匹配 302s 原版 / U3 kw 主平台成功且未搜 QQ / U4 `subSource=juheTx` / U5 二次缓存仍 tx / U6 全平台无匹配 `NOT_FOUND` / U7 `cross_platform` 事件 / U8 tx 只收 songmid / U9 慢主平台交付 kw / U10 关源后不交付缓存 / U11 wy 候选归一化 / U12 kw 候选归一化 / U13 三目标顺序 / U14 mg/kg 不再作为目标 / U15 mg 实际标签回填 kw；先红 1/8 → 绿 15/0 |
| `test/audit/v-cross-platform-stress.js` | 423 | 断言 | 13 条 V1~V13（20 并发同歌 / QQ 搜索不放大 / 50 次顺序只搜 1 次 / 201 首缓存上限 / 总开关零跨平台 / 关源重开 / remix-only 全拒绝 / 主跨交替不串 / 全目标 5xx 保留原码 / 慢主平台并发 / 事件隐私 / 100 首主命中零跨平台 / 同名同歌手时长差 199s 拒绝）；实跑 13/0 |
| `test/audit/w-fallback-owner.js` | 51 | 断言 | P1 W1~W2：W1 `inited` 已上报 / W2 5 个平台均 `fallbackOwner=source`；先红 1/2 → 绿 2/2 |
| `test/audit/x-media-envelope.js` | 157 | 断言 | P2 X1~X12：64B/1B/1KB/1MiB/8MiB 信封还原 SHA；64B FLAC 信封 `kindOf=audio`；`byteLength` 不符 `BAD_ENVELOPE`；缺片 `TRUNCATED_MEDIA`；旧 `{type:"Buffer",data}` 兼容；`inited.mediaEnvelope=2`；0 字节零长；admit 错误码；1MiB JSON.parse 基准；先红 2/4 → 绿 12/0 |
| `test/audit/s-health-events.js` | 230 | 断言 | 22 条 S1~S6（healthEvents 只读环形缓冲/同 traceId 串联/返回副本/隐私边界/超容丢弃）；先红 6 通过 16 失败 → 绿 22/0 |
| `test/audit/t-health-events-stress.js` | 137 | 断言 | 12 条 T1~T9（10000 条灌满/容量 500/dropped 9500/同 trace 链/limit 边界/隐私注入）；容量注入 500→100 翻红后还原 12/0 |
| `test/candidate-audit-test.js` | 135 | 断言 | 6 条；曾无 ID 输出，已补 |
| `test/lx-source-smoke-test.js` | 1618 | 断言 | 67 组；T50~T57 为回退必红用例 |
| `test/mutation/run.js` | 297 | 断言 | **22 变异体**；`--strict` 才在 survived 时 exit 1；字段名是 `name` 不是 `desc` |
| `test/stress-round3.js` | 357 | 断言 | 14 条 T1~T14（压「态」） |
| `test/stress-round4.js` | 1314 | 断言 | 133 条 V1a~V39b（已进 AUDIT_MATRIX） |
| `test/stress-test.js` | 220 | 断言 | 12 条 S1~S10 |
| `tools/live/host.js` | 84 | 工具 | 真宿主桩：`request(url,opts,cb)` 契约 + 302 手动跟链记 `hops` + `Range` 标记 + binary 回 Buffer；每次调用记 `{url,status,ms,hops,range}` |
| `tools/live/run.js` | 272 | 工具 | L1~L7 实跑三分支 `l1l4`/`l5`/`l6l7`；`fullCalls()` 排除 Range、`rangeCalls()` 二分，避免把验真外呼算成解析 |
| `docs/READTHROUGH.md` | 229 | 全文 | 本文件：通读台账（活文档，规则18 自校验） |
| `docs/DOC_INDEX.md` | 93 | 全文 | 文档登记索引（新增文档必须先登记，规则19 硬门槛） |

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
| `scripts/dump-chain.js` | 62 | 全文 | 5×4 链序 golden 生成器，只导出 active；写完退出 |
| `test/fixtures/chain-golden.json` | 89 | 全文 | v8.13.0 10 源 5×4 链序基线，Y9 逐项比对 |
| `docs/SOURCE_LIFECYCLE.md` | 76 | 全文 | 当前态治理文档 |
| `docs/SOURCE_REGISTRY.md` | 63 | 全文 | 当前态治理文档 |
| `docs/SOURCE_RETIREMENT.md` | 67 | 全文 | 当前态治理文档 |
| `package-lock.json` | 499 | 全文 | esbuild 锁定 |
| `package.json` | 17 | 全文 | v8.13.0/构建脚本入口/esbuild 依赖 |
| `scripts/build-source.js` | 49 | 全文 | esbuild IIFE/ES2017 单文件构建 + CJS 导出桥 + 版本头校验 |
| `scripts/source-inventory.js` | 110 | 全文 | 12/10/2 机器闸门 --check |
| `scripts/verify-bundle.js` | 87 | 全文 | B1~B8 构建产物校验 |
| `scripts/verify-real-platforms.js` | 76 | 全文 | 真实 HTTP 宿主五平台 `musicUrl` 取链，输出实际 `sourcePlatform/subSource/host` |
| `scripts/verify-real-platform-chains.js` | 103 | 全文 | G7 先搜平台 ID 再隔离取链；公网不可用时如实保留上游失败码 |
| `src/00-header.js` | 6 | 全文 | 单文件 banner |
| `src/80-entry.js` | 10 | 全文 | 导出面 + 非枚举 PROVIDER_SPECS |
| `src/legacy.js` | 5355 | 全文 | v8.13 实现源（契约/生命周期/取消） |
| `src/providers/55-probation.js` | 41 | 全文 | 两个观察源规格 |
| `src/providers/changqingVip.js` | 20 | 全文 | 12 源契约规格 |
| `src/providers/helloworldKw.js` | 22 | 全文 | 12 源契约规格 |
| `src/providers/huibq.js` | 23 | 全文 | 12 源契约规格 |
| `src/providers/ikun.js` | 24 | 全文 | 12 源契约规格 |
| `src/providers/index.js` | 15 | 全文 | active/probation/all 规格入口 |
| `src/providers/juheTx.js` | 22 | 全文 | 12 源契约规格 |
| `src/providers/kuwoOfficial.js` | 20 | 全文 | 12 源契约规格 |
| `src/providers/suyin163.js` | 20 | 全文 | 12 源契约规格 |
| `src/providers/suyinKuwo.js` | 30 | 全文 | 12 源契约规格 |
| `src/providers/wyOuter.js` | 20 | 全文 | 12 源契约规格 |
| `src/providers/xinghaiBackend.js` | 22 | 全文 | 12 源契约规格 |
| `test/audit/s-source-lifecycle.js` | 114 | 全文 | v8.13 审计入口 |
| `test/audit/y-provider-contract.js` | 143 | 全文 | v8.13 审计入口 |
| `test/audit/z-cancel.js` | 156 | 全文 | v8.13 审计入口 |

## 七、验证债清算（2026-11-10，只清「能查实的」）

| 债 | 原表述 | 实查结论 | 证据 |
|---|---|---|---|
| probe-history 11-08 单日 215 条 | 「单日 215 条异常，未查」 | **非异常**：当日 20 个端点共跑 12 轮（20×12≈240，其中部分重复请求合并计 215），`(date,url)` 唯一组合正好 20 | 逐行解析 `docs/probe-history.jsonl`：11-08 记录 215 / 唯一 (date,url) 20，单 url 出现 12 次 |
| 25 distinct url vs 登记表 20 | 「对不上」 | **对得上**：25 是历史累计，其中 5 个是已退役或非音频端点（sayqz 旧域、lingchuan、ikunshare 旧域、kuwo 封面模板 `img2.kuwo.cn/${item.MVPIC}`、GitHub releases 更新检查）；**当日实际探测 20 个，与登记表 20 条一致** | 同上 + 登记表正则抽取计数 20 |
| `ARCHIVE_OLD_TAGS.md` 旧 tag 是否真删 | 「未核远端」 | **真删了**：远端只剩 `v1.0~v8.0` 共 8 个新体系 tag，v11~v29 旧 tag 零残留 | GitHub API `repos/luanmuc/backend-api/tags` |
| F17 三个明文端点 cleartext | 「宿主 cleartext 未验证」 | **不是缺陷（但台账记错了数量）**：明文端点实为 **8 个**（`search.kuwo.cn`、`antiserver.kuwo.cn`、`175.27.166.236` 两条、`music.nxinxz.com` 三条、`nmobi.kuwo.cn`）；App 侧 `android/app/src/main/res/xml/network_security_config.xml` 为 `base-config cleartextTrafficPermitted="true"`，Android 不拦 | 见上文件；`curl` 实测 4 个域名均支持 TLS（https 200/404），`175.27.166.236` 无 TLS（https 000、http 200） |

**为什么没顺手改 http→https**：`search.kuwo.cn` / `antiserver.kuwo.cn` 的 https 可达只是「裸路径 200」，带真实参数、真实取链的端到端行为没验过；`music.nxinxz.com` 与 `nmobi.kuwo.cn` 带参在 http/https 下**同为 404**（源本身已废）。在没有端到端证据前改协议，是拿「能用的酷我搜链」去换一个理论收益，不做。等真机验真（L4）时一并实测再定。
