# 第三轮审计计划（U~Z 六组）+ 全仓结构治理

> **来源**：会话工作目录 `v8.11.1_全仓结构治理与第三轮审计_plan.md`（68 行，2026-11-08），本文件是并入仓库的正式版本。
> **基线**：v8.11.1。
> **落地脚本**：- `test/audit/f-repo.js` 50 条
- `test/stress-round3.js` 12 条（T1~T12）
> **实际结果**：**50 条审计断言 + 12 条压测断言**
> **计划与实际的差异**：计划写 U~Z 目标 ≥60 条，实际落地 50 条：U/V/W/X/Y/Z = 13/8/9/9/6/5；未凑数，按真实可判定性定格 50
> **本仓状态**：全部断言已固化在 `test/`，可随时复跑；跑法见 [`../TESTING.md`](../TESTING.md)。

---

> 写入时间：2026-11-08 | 基线 commit `1b48739` | 仓库 49 个 tracked 文件 / 12167 行

## §0 全仓清单（49 文件，五个域）

| 域 | 文件 | 行数 | 现状判定 |
|---|---|---|---|
| 主代码 | `lx-source.js` | 3139 | 已两轮审计 136 项 |
| 测试 | `test/lx-source-smoke-test.js`(1558) `candidate-audit-test.js`(131) `stress-test.js`(219) `audit/{a-static,b-logic,d-func,e-extra}.js`(194/230/232/453) | 3017 | 已覆盖，无总索引 |
| 脚本 | `scripts/` 14 个 js + 3 个 hook | 2366 | **无统一索引，职责靠猜** |
| 文档 | `docs/` 15 md + 7 天 health-daily + 1 jsonl | 3541 | 见 §1 |
| 配置 | `ci.yml` `docs-audit.yml` | 209 | 未审计 |

## §1 结构问题诊断（实测核对，10 项）

| # | 问题 | 证据 | 处置 |
|---|---|---|---|
| 1 | 三份审计报告口径不一 | `AUDIT_REPORT.md`(146,旧 13 项) / `AUDIT_REPORT-2026-11-07.md`(295,F-01) / `docs/reports/v8.11.1-全面审计报告.md`(229,两轮 136 项) | 合并为 `AUDIT_RESULTS.md`，旧两份归档 |
| 2 | `AUDIT_PLAN.md` 897 行 = 计划+结果+版本史混装 | 标题只到 "§3 维度矩阵"，后半是历轮结果 | 拆：`AUDIT_PLAN.md`(方法论+矩阵) / `AUDIT_RESULTS.md`(结果总账) |
| 3 | 无文档索引 | `docs/` 15 份 md 无入口 | 新增 `docs/README.md` |
| 4 | 无架构文档 | `DEV_GUIDE.md` 兼做架构+指南+实测表 | 新增 `docs/ARCHITECTURE.md`，DEV_GUIDE 瘦身指回 |
| 5 | 无测试总索引 | 5 个测试脚本、136 审计项 + 12 压测断言无总表 | 新增 `docs/TESTING.md` |
| 6 | 无脚本索引 | `scripts/` 14 个，`ecosystem-scan`/`recheck-candidates`/`cn-date` 用途不明 | 新增 `docs/SCRIPTS.md` |
| 7 | 版本历史塞在 README | `README.md` 105 行含 30 行版本历史 | 新增 `docs/CHANGELOG.md`，README 指回 |
| 8 | 无全仓覆盖矩阵 | 无法证明"每个文件每行都被审计过" | **新增 `docs/AUDIT_MATRIX.md`（本次核心交付）** |
| 9 | 临时进度文件在 docs 根 | `AUDIT_PROGRESS-2026-11-07.md` | 移 `docs/archive/` |
| 10 | 数据与文档混放 | `probe-history.jsonl`(664) + `health-daily/2026-11-08.json` 在 docs 根 | 保留（CI 路径写死），在 `docs/README.md` 注明为数据文件、勿手改 |

不移动：`candidate-status.md`（`docs-audit.js` 规则 5 路径写死）、`ARCHIVE_OLD_TAGS.md`（README 外链）。

## §2 新增文档内容要求（每份都要可执行、可验证，不写空话）

1. `docs/README.md`：文档地图（谁管什么、什么时候读、哪些是自动生成勿手改）
2. `docs/ARCHITECTURE.md`：模块边界 8 段 + 调用链（request→action 分发→调度→源→验真→缓存）+ 状态机（断路器 4 态/冷却/熔断）+ 数据流
3. `docs/TESTING.md`：5 个测试入口的命令、覆盖域、断言数、失败怎么读、如何新增一条
4. `docs/SCRIPTS.md`：14 个脚本一句话职责 + 触发方式（手动/CI/定时）+ 副作用（会不会改文件）
5. `docs/CHANGELOG.md`：v8.0 → v8.11.1 按版本列（从 README + ROADMAP 提取）
6. `docs/AUDIT_MATRIX.md`：49 文件 × 审计维度矩阵，每格标 ✅ 项号 / ⬜ 未覆盖
7. `docs/AUDIT_RESULTS.md`：三轮结果总账 + 缺陷清单（编号、严重度、修没修、证据）

## §3 第三轮审计设计（`test/audit/f-repo.js`，U~Z 六组，目标 ≥60 条）

| 组 | 覆盖 | 断言要点 |
|---|---|---|
| U 全文件静态合规 | 全部 49 文件 | 每个 .js `node --check` 通过；每个 .md 只有一个 H1 且首行是标题；无 CRLF；无行尾空白；UTF-8 无 BOM；无 `TODO/FIXME/XXX` 未处理；无 `/tmp/` 硬编码路径；无明文 token/卡密/key；无 `console.log` 调试残留（允许 logInfo/logWarn） |
| V 交叉引用与一致性 | 15 份 md + README | md 相对链接全部存在（死链 0）；`@version` 串在代码/README/ROADMAP/DEV_GUIDE 四处一致；冒烟组数 67 全文档一致；源数 20 一致；跨仓 App 文档版本可读 |
| W 脚本自洽 | 14 个 scripts | 每个都能被 require 或 `--dry-run`/`--help` 跑通且不改仓库；导出面无重复；`cn-date` 时区正确；`endpoint-registry` 条目数 = 源数；`doc-sync-map` 覆盖所有 docs |
| X 功能联动（跨模块） | 代码 ↔ 脚本 ↔ 文档 | `health-daily` 产出的 summary 字段被 `README_HEALTH` 模板消费；`probe` 的 `PAYLOAD_FRAGMENT` 码与 `lx-source.js` 的 `PREVIEW_FRAGMENT` 对齐；`candidate-audit` 判否记录与 `DEV_GUIDE` 候选表一致；`source-toggles` 读到的开关值与 `SOURCE_TOGGLES` 常量一致；`docs-audit` 规则数与 `DOC_SEMANTIC_CHECKLIST` 声明一致 |
| Y 残留与死代码 | 主代码 | 无人引用的函数/常量；重复定义的 ERROR_CODES；只写不读的 Map（打点实测）；`@deprecated` 标记与实际引用；注释里引用的行号是否仍成立 |
| Z 资源与启动 | 主代码 + 脚本 | 模块加载耗时 < 50ms；冷启动内存；`require` 副作用（加载即起 interval）；脚本并发运行是否互相覆盖同一文件 |

## §4 执行顺序

1. 先做 §2 文档整理（6 新增 + 2 拆分 + 2 归档），每步后跑 `docs-audit --dry-run`
2. 按新结构补 `docs/AUDIT_MATRIX.md`（写前先 realpath 校验每个文件存在）
3. 写 `test/audit/f-repo.js`，U→Z 逐组实现，每写完一组立即跑
4. 全门禁：check / 冒烟 / a-static / b-logic / d-func / e-extra / f-repo / stress / candidate / probe / self-check / docs-audit
5. 发现的真缺陷按「先证伪再修」处理，修完重跑受影响组

## §5 验收标准（缺一条不算完成）

- [ ] 49 个文件全部在 `AUDIT_MATRIX.md` 中出现，且至少被一个组覆盖
- [ ] 新增 6 份文档全部有实质内容（行数 > 40 且含可执行命令或表格）
- [ ] `test/audit/f-repo.js` 退出码 0，断言 ≥60 条
- [ ] 12 条门禁全部退出码 0，且数字与文档声明一致
- [ ] 发现的每个缺陷都有「实测证据 → 修法 → 修后复测」三段记录
- [ ] 不 commit、不推送（等用户指令）
