# 文档地图（docs/README）

> 先读这张表再翻别的文件。**标「自动生成」的不要手改**——改了下次 CI 会覆盖，且会跟脚本打架。

## 一、按"你现在要干什么"找文件

| 你要做的事 | 读这个 |
|---|---|
| 第一次接手这个仓库 | 根 [`README.md`](../README.md) → 本文 → [`ARCHITECTURE.md`](./ARCHITECTURE.md) |
| 改代码前搞清结构 | [`ARCHITECTURE.md`](./ARCHITECTURE.md)（边界/调用链/状态机）→ [`DEV_GUIDE.md`](./DEV_GUIDE.md)（逐段职责） |
| 跑测试 / 新增一条断言 | [`TESTING.md`](./TESTING.md) |
| 找某个脚本干什么、会不会改文件 | [`SCRIPTS.md`](./SCRIPTS.md) |
| 要审计 / 想知道历史上审出过什么 | 计划 [`AUDIT_PLAN.md`](./AUDIT_PLAN.md) → 结果 [`AUDIT_RESULTS.md`](./AUDIT_RESULTS.md) → 覆盖矩阵 [`AUDIT_MATRIX.md`](./AUDIT_MATRIX.md) |
| 查某版本改了什么 | [`CHANGELOG.md`](./CHANGELOG.md) → 规划 [`ITERATION_ROADMAP.md`](./ITERATION_ROADMAP.md) |
| 源挂了 / 平台改接口 | [`INTERFACE_CHANGE_PLAYBOOK.md`](./INTERFACE_CHANGE_PLAYBOOK.md) |
| 查当前源可用性基线 | [`SOURCE_AUDIT.md`](./SOURCE_AUDIT.md) |
| 文档改了怕不同步 | [`DOC_SEMANTIC_CHECKLIST.md`](./DOC_SEMANTIC_CHECKLIST.md)（机器管不了的靠人） |
| 多账号协作 / 提交规范 | [`AGENTS.md`](./AGENTS.md) |
| 查「哪些文件审过/没审、哪些数字已核查过时」 | [`READTHROUGH.md`](./READTHROUGH.md)（全仓通读台账 + 四类清单） |
| 新增文档该放哪、哪些字段要跟着改 | [`DOC_INDEX.md`](./DOC_INDEX.md)（逐文件登记 + 机器校验归属） |

## 二、文件清单与性质

| 文件 | 性质 | 说明 |
|---|---|---|
| `README.md` | 手写 | 根入口：导入方式、可用性表、版本摘要、关闭源表 |
| `README_HEALTH.md` | **自动生成**（`scripts/probe.js`） | 端点健康表，别手改 |
| `docs/ARCHITECTURE.md` | 手写 | 边界、8 段结构、调用链、4 个状态机、账本口径、跨仓契约 |
| `docs/DEV_GUIDE.md` | 手写 | 逐段职责、机制细节、子源实测总表、已知缺陷 |
| `docs/TESTING.md` | 手写 | 15 个测试入口、mock 四件事、隔离与新增断言流程 |
| `docs/SCRIPTS.md` | 手写 | 14 脚本 + 3 hook 的职责/触发/副作用 |
| `docs/AUDIT_PLAN.md` | 手写 | 方法论 + 维度矩阵（只写"要审什么"） |
| `docs/AUDIT_PLAN_v10.md` | 手写（**六轮整合活文档**） | 以它为准：维度总表、G1~G12 缺口、待修清单、销项记录、门禁 14 项口径、已知取舍 |
| `docs/audit-plans/round1~5.md` | 手写（归档性） | 前五轮的分轮计划，历史用；当前计划看 v10 |
| `docs/reports/*.md` | 手写（每轮一份） | 分轮审计报告：`v8.11.1-全面审计报告.md`、`-第五轮审计结算.md`、`-第六轮缺口审计.md` |
| `docs/AUDIT_RESULTS.md` | 手写 | 三代审计总账 + **D-01~D-39** 缺陷编号 + 结论性事实 + 历轮过程 |
| `docs/READTHROUGH.md` | 手写（**活文档·每版本必刷**） | 全仓通读台账：75 文件逐条结论 + 未审计/过时/未测试/未验证四类清单；规则18 校验 |
| `docs/DOC_INDEX.md` | 手写（**活文档·新增文档必登**） | docs 下逐文件登记（性质/生成者/刷新时机/机器校验）；规则19 校验，漏登即红 |
| `docs/AUDIT_MATRIX.md` | 手写（每轮更新） | **75 tracked 文件 × 审计维度覆盖矩阵**（含逐行行数与漏登检测），证明"每个文件都被审过" |
| `docs/CHANGELOG.md` | 手写 | 完整版本历史；README 只留最近摘要 |
| `docs/ITERATION_ROADMAP.md` | 手写 | 版本规划与三层目标 |
| `docs/SOURCE_AUDIT.md` | 手写 | 源可用性基线、巡检方法、决策记录 |
| `docs/candidate-status.md` | **自动生成**（`scripts/recheck-candidates.js`） | 判否候选恢复状态，别手改 |
| `docs/INTERFACE_CHANGE_PLAYBOOK.md` | 手写（活文档） | 六类接口变更模式 + 案例库，修一次回填一行 |
| `docs/DOC_SEMANTIC_CHECKLIST.md` | 手写 | 机器管不了的语义一致项 + 红绿自检 |
| `docs/AGENTS.md` | 手写 | 多账号协作规范、命令、hook |
| `docs/health-daily/<date>.md/.json` | **自动生成**（`scripts/health-daily.js`） | 每日健康日报；按天累积，保留策略：只留最近 7 天，旧的可删 |
| `docs/probe-history.jsonl` | **自动追加**（`scripts/probe.js`） | 巡检历史，一行一条；不要手改，只追加 |
| `docs/archive/*` | 归档 | 过期报告与旧进度记录，只读不改 |
| `docs/ARCHIVE_OLD_TAGS.md` | 归档 | 2026-11-05 重整前的旧版本历史 |

## 三、单一真相（同一事实只允许有一处定义）

| 事实 | 唯一来源 | 谁在消费 |
|---|---|---|
| 端点清单 | `scripts/endpoint-registry.js` | probe / health-daily |
| 子源开关 | `lx-source.js` 的 `SOURCE_TOGGLES` | `scripts/source-toggles.js` |
| 日期 | `scripts/cn-date.js` | health-daily / probe |
| 版本号 | `lx-source.js` 的 `@version` | self-check / docs-audit / App 正则 |
| 冒烟组数 | 冒烟脚本实际输出 | docs-audit 校验各文档 |
| 行段表 | `DEV_GUIDE.md` | docs-audit 校验末段边界 |

改这些"真相"时，先改源头，再让文档连锁跟着改（`node scripts/docs-audit.js` 会帮你揪出漏改）。
