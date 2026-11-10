# 全仓通读台账（READTHROUGH）

> **这是活文档：每次版本号变更或每轮审计后必须刷新，不许过期。**
> 谁看住它：`node scripts/docs-audit.js` 规则 18 —— 逐行行数、文件数、总行数、HEAD 与版本、以及「是否有 tracked 文件漏登」全部机器校验；行数不符会被自动改回实测值，漏登文件直接报 ❌。
> 登记处：[`DOC_INDEX.md`](./DOC_INDEX.md)。新增任何文档 → 先登记，再写内容。

HEAD `15b8c20`（v8.11.2）
文件数：**81**　总行数：**20994**（`git -c core.quotepath=false ls-files` + `wc -l` 实测）

## 一、先说三个硬阻塞（比数字过期严重）

| # | 事实 | 证据 |
|---|---|---|
| X1 | **远端巡检已断 2 天**：`origin/master` 最新 `45d8e7a`（2026-11-08，v8.10.12），11-09 / 11-10 无自动提交；`README_HEALTH` 停在 `2026-11-08T08:32Z`，`health-daily` 最新一份也是 11-08 | `git fetch` + `git log origin/master --since=2026-11-09` 为空 |
| X2 | **本地 85 个提交未推**，远端 CI 跑的还是 v8.10.12，D-20~D-39 与 22 个变异体远端全无覆盖 | `git status -sb` = `[ahead 85]` |
| X3 | ~~变异门禁 fail-open~~ **已闭环（v8.11.2）**：`ci.yml` 补 `--strict`，且 2026-11-10 实测 `--full --strict` 全量 **22 killed / 0 survived**、rc=0；门禁从此真会拦人 | 旧：`ci.yml` 变异 job 不带 `--strict`；新：本日志 + `docs-audit` 规则16 |

## 二、四类清单（详细证据见 §四）

| 类别 | 条数 | 摘要 |
|---|---|---|
| **未审计** | A1 8 文件 / A2 4 项未开始组 / A3 4 段零覆盖代码 / A4 5 类文档盲区 | 8 个文件 2298 行从未进矩阵；N 组「无回归保护清单」`docs/audit-plans/round4.md` §3 至今写「未开始」；健康巡检自动启用链、FLAC 多块遍历、MP3 位率回填、`isPreviewFragmentUrl` 四段零执行 |
| **数据过时** | 54 处 | 已由本轮门禁接管可计算项（见 §三）；剩余语义类逐条列在清单原文 |
| **未测试** | 14 入口全覆盖，但有 7 项该测未测 | `CONFIG_ERROR` 缓存 TTL 缺失、320k 档被跳过、`juhe` 字符串状态码、`isPreviewFragmentUrl` 零覆盖等 |
| **未验证** | 4 条推断 + 6 条只到结果层 + 9 项从未做 | F10~F13 已实证（N1~N4 先红后绿）；L4 真机播放从未做；22 只变异体已于 2026-11-10 全量跑完（22/0）；T10「Issue 已存在」分支文档自写「未单独实测」 |

## 三、本轮实跑证据（新鲜，非引用）

| 命令 | 输出 |
|---|---|
| `test/lx-source-smoke-test.js` | **67 组用例**，rc=0 |
| `test/audit/{a-static,b-logic,d-func,e-extra,f-repo,g-meta,h-toggles}.js` | 10 / 30 / 30 / 92 / 50 / 14 / 14，全 rc=0 |
| `test/candidate-audit-test.js` | 6 通过 / 0 失败 |
| `test/audit/q-quickjs-real.js` | 3 通过 / 0 失败（真引擎） |
| `test/stress-test.js` | 12 / 0 |
| `test/stress-round3.js` | 14 通过 / 0 失败 |
| `test/stress-round4.js` | 133 通过 / 0 失败 |
| `test/mutation/run.js` | 22 个变异体（**本轮未全量跑**） |

合计：冒烟 67 + 审计 249 + 压测 **159**（12+14+133）= **475**；变异 22。
（更正：本轮初稿把压测写成了 163，是加法错误；12+14+133=159。）

## 四、逐文件通读结论（75 个）

读法：`全文` 逐行读完；`断言` 按断言 ID + 断言名 + 实跑输出逐条核对；`生成` 按记录结构统计核对；`归档` 历史文档读正文与结论段。

| 文件 | 行 | 读法 | 结论 |
|---|---|---|---|
| `.github/workflows/ci.yml` | 198 | 全文 | 13 个 job；断言数注释过期（32/21/22）；**mutation 未带 `--strict`（X3）**；schedule `0 20 * * *`；probe 只放行 exit 2，其余显式失败 |
| `.github/workflows/docs-audit.yml` | 48 | 全文 | 注释仍写「probe UTC 06:00」；红项硬失败正确；`--dry-run` 段吞错（`|| true`） |
| `.gitignore` | 1 | 全文 | 只有 `node_modules/`；`.cov/` 不在仓内 |
| `README.md` | 121 | 全文 | **L14 当前版本 v8.10.4 / @version 8.10.3 与 L73 v8.11.1 自相矛盾**；L73 写 32 断言（实 12） |
| `README_HEALTH.md` | 46 | 生成 | 20 端点 / 可用 11；更新于 11-08 → 已 2 天未刷新 |
| `lx-source.js` | 3367 | 全文 | 40 键 `USER_CONFIG` / 15 `ALLOWED_KEYS` / 12 错误码；12 处可疑点见 F07~F22（4 条待实证） |
| `docs/AGENTS.md` | 190 | 全文 | 协作 7 规则 / L0~L4 验证链；「4 处 clearTimeout」实为 5 |
| `docs/ARCHITECTURE.md` | 91 | 全文 | 「39 键」实 40；「3136 行」+ 八段行段表全部漂移（与 DEV_GUIDE 冲突） |
| `docs/ARCHIVE_OLD_TAGS.md` | 138 | 归档 | 旧 tag 表（v11.11→v29.x）；「旧 tag 已全部删除」未核远端 |
| `docs/AUDIT_MATRIX.md` | 121 | 全文 | 67 行 vs 75 文件 → 漏 8 个；行数全过期（3185/1111/838/174…）；自称「未覆盖 0」已不成立 |
| `docs/AUDIT_PLAN.md` | 514 | 全文 | T 组 5 通过/3 部分/5 未通过；V 组 36 项 7✅/10⚠️/19❌；15 条修复全落地；「15 条端点」「63 文件/15338 行」过期 |
| `docs/AUDIT_PLAN_v10.md` | 197 | 全文 | 249 / 159（round4 129）/ 16 / 467 均过期；§6.2 `e-extra` 84→92；§七 4 条已知取舍 |
| `docs/AUDIT_RESULTS.md` | 1899 | 全文 | D-01~D-39 总账 + §0~§26.13；多处旧数字（8 缺陷/32 断言/12 变异体/58 文件） |
| `docs/CHANGELOG.md` | 44 | 全文 | 版本摘要，末条到 v8.11.1；无派生数字 |
| `docs/DEV_GUIDE.md` | 470 | 全文 | §二行段已到 3357（与 ARCHITECTURE 冲突）；§11.1 面板表 14 行缺 `memoryMapMax`；L371 92/55 自相矛盾；L3 仍写 v8.10.12 |
| `docs/DOC_SEMANTIC_CHECKLIST.md` | 36 | 全文 | 机审不了的语义项；「17 条规则」实 14 |
| `docs/INTERFACE_CHANGE_PLAYBOOK.md` | 61 | 全文 | 跨仓改接口 7 步；与当前 action 面一致 |
| `docs/ITERATION_ROADMAP.md` | 325 | 全文 | 三层目标；**32 断言/49 文件/897→430/白名单 14/趋势 60 条 全过期**；3 条 `[ ] 待开发`（服务器）/ 2 条触发式未闭环 |
| `docs/PROGRESS_round5.md` | 58 | 全文 | 第五轮进度记录；数字停在 82 通过（现 92） |
| `docs/README.md` | 63 | 全文 | 文档地图；「5 个测试入口」实 14；「D-01~D-26」已到 D-39 |
| `docs/SCRIPTS.md` | 52 | 全文 | 14 脚本 + 3 hook；「17 条规则」实 14；行数 235/110 实 236/111；prepare-commit-msg 的 exit 1 描述属 commit-msg |
| `docs/SOURCE_AUDIT.md` | 96 | 全文 | 11-06 基线 21/35 + 11-09 顶注 10/10；「短路探路 6h」实默认 1h |
| `docs/TESTING.md` | 111 | 全文 | 14 入口 / 249 审计口径正确；72 文件、58/14145、203.45KB 三处过期 |
| `docs/archive/AUDIT_PROGRESS-2026-11-07.md` | 82 | 归档 | 96 维执行轨迹；F-08~F-14 待决策记录（部分已修） |
| `docs/archive/AUDIT_REPORT-2026-11-05.md` | 146 | 归档 | 音源+App 五步审计 13 问题（2 中 11 低） |
| `docs/archive/AUDIT_REPORT-2026-11-07.md` | 295 | 归档 | 15 项修复 + §10.2 仍未做（L4 真网络 / F-12 第二方案 / 面板 raceBudgetMs 说明） |
| `docs/audit-plans/round1.md` | 90 | 归档 | A~I 九维 50 ID → 落地 72 条 |
| `docs/audit-plans/round2.md` | 186 | 归档 | J~T 十组；**§O 冷启动与短路 5 项【未测】**，后续部分转正 |
| `docs/audit-plans/round3.md` | 78 | 归档 | U~Z 六组计划；分母写 49 文件 |
| `docs/audit-plans/round4.md` | 180 | 全文 | **N 组「未开始」、M13 覆盖率门槛未落地、M14 未落地**；§6 四项未勾选 |
| `docs/audit-plans/round5.md` | 111 | 全文 | MUT 12 算子 / 16 实例口径区分；EDGE/TTL ±1ms、`songmid` 含 `|` 未做理由 |
| `docs/audit-plans/stress-round4.md` | 99 | 归档 | V 组 21 组·66 条 → 落地 133 |
| `docs/audit-plans/stress-round5.md` | 45 | 归档 | 第五轮压测设计 |
| `docs/candidate-status.md` | 8 | 生成 | hyw 已恢复 / huanyin 需人工；依赖 recheck 是否真跑 |
| `docs/health-daily/2026-11-03.md` | 42 | 生成 | 首份日报（19 端点 / 9 建议摘除） |
| `docs/health-daily/2026-11-04.md` | 41 | 生成 | 同上系列 |
| `docs/health-daily/2026-11-05.md` | 40 | 生成 | 同上系列 |
| `docs/health-daily/2026-11-06.md` | 41 | 生成 | 同上系列 |
| `docs/health-daily/2026-11-07.md` | 41 | 生成 | 同上系列 |
| `docs/health-daily/2026-11-08.md` | 48 | 生成 | 参与判定 10 / 登记 20 ✔；今日变化 2 条；**最新一份，此后无产物** |
| `docs/health-daily/2026-11-09.md` | 48 | 生成 | 11-09 日报（rebase 带入；与 11-08 同结构，参与判定/需处理/今日变化三栏） |
| `docs/health-daily/2026-11-09.json` | 48 | 生成 | 同日 json（date/prevDate/registered/judged/handle/watch/changes） |
| `docs/health-daily/2026-11-08.json` | 54 | 生成 | 字段 date/prevDate/prevDateMode/prevDates/registered/judged/handle/watch/changes |
| `docs/probe-history.jsonl` | 684 | 生成 | 664 条全可解析；10-28→11-08；25 distinct url（registry 20）；11-08 单日 215 条异常 |
| `docs/reports/v8.11.1-第五轮审计结算.md` | 122 | 全文 | 五组账 + 5 次自我推翻；e-extra 82 / 3179 行 / 66 文件 过期 |
| `docs/reports/v8.11.1-第六轮缺口审计.md` | 480 | 全文 | G1~G11 + §12.5 端到端 10/10 + D-27/28；尾部 6 条遗漏自查 |
| `scripts/candidate-audit.js` | 342 | 全文 | mockLoadScript 同步化定时器 → 递归 setTimeout 脚本会栈溢出（仅候选用，风险低） |
| `scripts/cn-date.js` | 17 | 全文 | 北京日期单一来源 |
| `scripts/docs-audit.js` | 356 | 全文 | **14 条规则**；不校 README 当前版本行 / CI 数字 / 矩阵数字（过时数字的根因） |
| `scripts/doc-sync-map.js` | 111 | 全文 | 规则指向 `docs/SYNC_POINTS.md`（两仓均无，悬空） |
| `scripts/ecosystem-scan.js` | 147 | 全文 | 从 SOURCE_HANDLERS 动态提取，防漂移 |
| `scripts/endpoint-registry.js` | 86 | 全文 | **20 条端点（纠正我早前「19」的误判）**；note 行号全过期；导出 WINDOW_DAYS/CONSECUTIVE_FAIL_DAYS/EXCLUDE_DOMAINS |
| `scripts/health-alert.js` | 66 | 全文 | 缺参/非数组 exit 1；`clean()` 转义；「已有 open Issue 跳过」分支未实测 |
| `scripts/health-daily.js` | 352 | 全文 | 小样本不进 handle / dataThrough+gapDays / md+json 清理；「payload 已做 Range 校验」依赖 probe |
| `scripts/hooks/commit-msg` | 7 | 全文 | 调 `doc-sync-map.js --check`，真 exit 1 在这里 |
| `scripts/hooks/pre-push` | 16 | 全文 | 推送前拦截 |
| `scripts/hooks/prepare-commit-msg` | 13 | 全文 | 只打印摘要，不阻断（SCRIPTS.md 描述错） |
| `scripts/install-hooks.sh` | 8 | 全文 | 安装三个 hook |
| `scripts/probe.js` | 734 | 全文 | 写 README/README_HEALTH/history 三处；`parseDurationFromHead` 与 lx-source 双份实现 |
| `scripts/recheck-candidates.js` | 146 | 全文 | 候选复检写 candidate-status |
| `scripts/self-check.js` | 109 | 全文 | README 只查 `includes('v8.11.1')` → 当前版本行过期不被拦 |
| `scripts/source-audit.js` | 155 | 全文 | 35 组逐源取链；`rangeCheck` 不解析时长 → 片段判可播 |
| `scripts/source-toggles.js` | 124 | 全文 | 剥注释+配平+行内多键；20 键 |
| `test/audit/a-static.js` | 206 | 断言 | 10 条（A2~A7/B1~B6）；实跑 10/0 |
| `test/audit/b-logic.js` | 232 | 断言 | 30 条（C4~C10 等，含循环生成）；实跑 30/0 |
| `test/audit/d-func.js` | 232 | 断言 | 30 条（D1/I3~I5/E1~E4）；实跑 30/0 |
| `test/audit/e-extra.js` | 929 | 断言 | 92 条（含 U500/U410/U404/U429/U403 状态码族、EDGE/FAULT 五轮补测）；实跑 92/0 |
| `test/audit/f-repo.js` | 339 | 断言 | U~Z 50 条；实跑 50/0，最大单文件 219.17KB |
| `test/audit/g-meta.js` | 314 | 断言 | 14 条 M1~M14（审断言本身）；实跑 14/0 |
| `test/audit/p-gaps.js` | 165 | 断言 | 4 条（T-4/T-5/T-6/T-7 零覆盖补测）；逐条反向改坏 4/4 红 → 还原 4/0 |
| `test/audit/n-fixes.js` | 150 | 断言 | 4 条（F13-a/F13-b/F12/F10 推断变实测）；先红 0/4 → 修后 4/0 |
| `test/audit/h-toggles.js` | 187 | 断言 | 14 条（逐源开启）；实跑 14/0 |
| `test/audit/q-quickjs-real.js` | 127 | 断言 | 3 条；三级依赖查找（仓内→vendor→$QUICKJS_EMSCRIPTEN→npm i），缺依赖 exit 3 |
| `test/candidate-audit-test.js` | 135 | 断言 | 6 条；曾无 ID 输出，已补 |
| `test/lx-source-smoke-test.js` | 1594 | 断言 | 67 组；T50~T57 为回退必红用例 |
| `test/mutation/run.js` | 262 | 断言 | **22 变异体**；`--strict` 才在 survived 时 exit 1；字段名是 `name` 不是 `desc` |
| `test/stress-round3.js` | 349 | 断言 | 14 条 T1~T14（压「态」） |
| `test/stress-round4.js` | 1291 | 断言 | 133 条 V1a~V39b；**未进 AUDIT_MATRIX** |
| `test/stress-test.js` | 219 | 断言 | 12 条 S1~S10 |
| `docs/READTHROUGH.md` | 137 | 全文 | 本文件：通读台账（活文档，规则18 自校验） |
| `docs/DOC_INDEX.md` | 81 | 全文 | 文档登记索引（新增文档必须先登记，规则19 硬门槛） |

## 五、维护规则（这段是契约，不是说明）

1. **触发点**：版本号变更（`@version` 改动）、每轮审计结束、新增/删除 tracked 文件、断言条数变化 —— 任一发生即刷新本文件。
2. **必须刷新什么**：§四 表里新增/删除的行、每行行数（门禁会自动改，但新文件要人补行）、§三 实跑输出、§二 四类清单状态。
3. **怎么确保没漏**：`node scripts/docs-audit.js` 必须全绿；`node -c` 等价自查见 `DEV_GUIDE.md` §九发布 SOP。
4. **新文档去哪**：先在 `DOC_INDEX.md` 登记，再在本文件相应章节挂链接；未登记时门禁规则 19 直接红。
5. **历史文档不改数**：`reports/`、`archive/`、`audit-plans/` 记录的是当时的结论，写死的旧数字属于历史事实，不回填当前值。
