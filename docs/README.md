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

## 二、文件清单与性质

| 文件 | 性质 | 说明 |
|---|---|---|
| `README.md` | 手写 | 根入口：导入方式、可用性表、版本摘要、关闭源表 |
| `README_HEALTH.md` | **自动生成**（`scripts/probe.js`） | 端点健康表，别手改 |
| `docs/ARCHITECTURE.md` | 手写 | 边界、8 段结构、调用链、4 个状态机、账本口径、跨仓契约 |
| `docs/DEV_GUIDE.md` | 手写 | 逐段职责、机制细节、子源实测总表、已知缺陷 |
| `docs/TESTING.md` | 手写 | 5 个测试入口、mock 四件事、隔离与新增断言流程 |
| `docs/SCRIPTS.md` | 手写 | 14 脚本 + 3 hook 的职责/触发/副作用 |
| `docs/AUDIT_PLAN.md` | 手写 | 方法论 + 维度矩阵（只写"要审什么"） |
| `docs/AUDIT_RESULTS.md` | 手写 | 三代审计总账 + 15 条缺陷编号 + 结论性事实 + 历轮过程 |
| `docs/AUDIT_MATRIX.md` | 手写（每轮更新） | **58 文件 × 审计维度覆盖矩阵**，证明"每个文件都被审过" |
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
