# 文档登记索引（DOC_INDEX）

> **作用：防「新文档生成了却没进仓库/没登记」。** 本表逐文件登记 docs 下每个文件的性质、谁生成、何时必须刷新、被哪条机器规则看住。
> 门禁：`node scripts/docs-audit.js` 的规则 19 —— docs 下任何文件未在本表登记 → 直接 ❌ 红；登记了但文件不存在 → 也红。
> 新增文档的流程固定为三步：①放进 `docs/` ②在本表加一行 ③若它在 `docs/README.md` 文件清单里也补一行。缺一步门禁就红。

## 更新触发总则

| 文档类型 | 何时必须刷新 |
|---|---|
| 当前态（手写） | **每次版本号变更 / 每轮审计后**：文件数、总行数、断言数、入口数、缺陷编号上界、版本串 |
| 自动生成 | 不手改；由对应脚本运行时覆盖（`probe` / `health-daily` / `recheck-candidates`） |
| 历史快照 | 冻结不改。历史记录写的是「当时的数字」，不能拿当前值回写，否则等于篡改历史 |
| 归档 | 只读，不随版本更新 |

## 逐文件登记

| 文件 | 性质 | 谁生成 | 何时刷新 | 机器校验 |
|---|---|---|---|---|
| `docs/AGENTS.md` | 当前态 | 人 | 每次版本变更/每轮审计后 | 见下行专表 |
| `docs/ARCHITECTURE.md` | 当前态 | 人 | 每次版本变更/每轮审计后 | 见下行专表 |
| `docs/ARCHIVE_OLD_TAGS.md` | 归档 | 人 | 只读，不再更新 | — |
| `docs/AUDIT_MATRIX.md` | 当前态 | 人 | 每次版本变更/每轮审计后 | 见下行专表 |
| `docs/AUDIT_PLAN.md` | 当前态 | 人 | 每次版本变更/每轮审计后 | 见下行专表 |
| `docs/AUDIT_PLAN_v10.md` | 当前态 | 人 | 每次版本变更/每轮审计后 | 见下行专表 |
| `docs/AUDIT_RESULTS.md` | 当前态 | 人 | 每次版本变更/每轮审计后 | 见下行专表 |
| `docs/CHANGELOG.md` | 当前态 | 人 | 每次版本变更/每轮审计后 | 见下行专表 |
| `docs/DEV_GUIDE.md` | 当前态 | 人 | 每次版本变更/每轮审计后 | 见下行专表 |
| `docs/DOC_SEMANTIC_CHECKLIST.md` | 当前态 | 人 | 每次版本变更/每轮审计后 | 见下行专表 |
| `docs/INTERFACE_CHANGE_PLAYBOOK.md` | 当前态 | 人 | 每次版本变更/每轮审计后 | 见下行专表 |
| `docs/ITERATION_ROADMAP.md` | 当前态 | 人 | 每次版本变更/每轮审计后 | 见下行专表 |
| `docs/PROGRESS_round5.md` | 历史快照 | 人 | 冻结：只记录当时结论 | — |
| `docs/README.md` | 当前态 | 人 | 每次版本变更/每轮审计后 | 见下行专表 |
| `docs/DOC_INDEX.md` | 当前态（本表自身） | 人 | 新增/删除任何 docs 文件时 | 规则19 自校验 |
| `docs/SCRIPTS.md` | 当前态 | 人 | 每次版本变更/每轮审计后 | 见下行专表 |
| `docs/SOURCE_AUDIT.md` | 当前态 | 人 | 每次版本变更/每轮审计后 | 见下行专表 |
| `docs/TESTING.md` | 当前态 | 人 | 每次版本变更/每轮审计后 | 见下行专表 |
| `docs/archive/AUDIT_PROGRESS-2026-11-07.md` | 归档 | 人 | 只读，不再更新 | — |
| `docs/archive/AUDIT_REPORT-2026-11-05.md` | 归档 | 人 | 只读，不再更新 | — |
| `docs/archive/AUDIT_REPORT-2026-11-07.md` | 归档 | 人 | 只读，不再更新 | — |
| `docs/audit-plans/round1.md` | 历史快照 | 人 | 冻结：只记录当时结论 | — |
| `docs/audit-plans/round2.md` | 历史快照 | 人 | 冻结：只记录当时结论 | — |
| `docs/audit-plans/round3.md` | 历史快照 | 人 | 冻结：只记录当时结论 | — |
| `docs/audit-plans/round4.md` | 历史快照 | 人 | 冻结：只记录当时结论 | — |
| `docs/audit-plans/round5.md` | 历史快照 | 人 | 冻结：只记录当时结论 | — |
| `docs/audit-plans/stress-round4.md` | 历史快照 | 人 | 冻结：只记录当时结论 | — |
| `docs/audit-plans/stress-round5.md` | 历史快照 | 人 | 冻结：只记录当时结论 | — |
| `docs/candidate-status.md` | 自动生成 | scripts/recheck-candidates.js | 每次候选复检覆盖 | 规则5 新鲜度 |
| `docs/health-daily/2026-11-03.md` | 自动生成 | scripts/health-daily.js | 每日 CI 运行时覆盖 | — |
| `docs/health-daily/2026-11-04.md` | 自动生成 | scripts/health-daily.js | 每日 CI 运行时覆盖 | — |
| `docs/health-daily/2026-11-05.md` | 自动生成 | scripts/health-daily.js | 每日 CI 运行时覆盖 | — |
| `docs/health-daily/2026-11-06.md` | 自动生成 | scripts/health-daily.js | 每日 CI 运行时覆盖 | — |
| `docs/health-daily/2026-11-07.md` | 自动生成 | scripts/health-daily.js | 每日 CI 运行时覆盖 | — |
| `docs/health-daily/2026-11-08.json` | 自动生成 | scripts/health-daily.js | 每日 CI 运行时覆盖 | — |
| `docs/health-daily/2026-11-09.md` | 自动生成 | scripts/health-daily.js | 每日 CI 运行时覆盖 | — |
| `docs/health-daily/2026-11-10.md` | 自动生成 | scripts/health-daily.js | 每日 CI 运行时覆盖 | — |
| `docs/health-daily/2026-11-10.json` | 自动生成 | scripts/health-daily.js | 同上（日报机器可读版） | — |
| `docs/health-daily/2026-11-09.json` | 自动生成 | scripts/health-daily.js | 每日 CI 运行时覆盖 | — |
| `docs/health-daily/2026-11-08.md` | 自动生成 | scripts/health-daily.js | 每日 CI 运行时覆盖 | — |
| `docs/probe-history.jsonl` | 自动追加 | scripts/probe.js | 每次巡检追加一行 | — |
| `docs/reports/v8.11.1-第五轮审计结算.md` | 历史快照 | 人 | 冻结：只记录当时结论 | — |
| `docs/reports/v8.11.1-第六轮缺口审计.md` | 历史快照 | 人 | 冻结：只记录当时结论 | — |

## 当前态文档的「机器看住哪些字段」

| 文档 | 被哪条规则看住 | 字段 |
|---|---|---|
| `README.md` | 规则2 / 规则15 | 当前版本行 `**vX.Y.Z**`、行内 `@version` 标注、关闭源表布尔 |
| `docs/README.md` | 规则19 / 规则20 / 规则21 | 测试入口数、缺陷编号上界、docs 文件登记完整性 |
| `docs/TESTING.md` | 规则20 | 入口总数 |
| `docs/AUDIT_MATRIX.md` | 规则17 | 逐行行数、文件总数、总行数、漏登文件（漏一个即红） |
| `docs/READTHROUGH.md` | 规则18 | 逐行行数、文件数、总行数、版本；HEAD 须为当前 HEAD 的祖先（落后 ≤20 条只提示不改写）、漏登文件 |
| `docs/AGENTS.md` | 规则1 / 规则6 / 规则8 | 冒烟组数、L1 组数、setTimeout 处数 |
| `docs/DEV_GUIDE.md` | 规则6 / 规则7 / 规则9 / 规则11 | 冒烟组数、总行数、行段表末段、子源数、写死的增长量 |
| `docs/ITERATION_ROADMAP.md` | 规则13 | 当前最新版本 |
| `docs/SOURCE_AUDIT.md` | 规则14 | 登记源数、verified 源数 |
| `docs/AUDIT_PLAN_v10.md` | 规则21 | 缺陷编号上界 |
| `.github/workflows/ci.yml` | 规则6 / 规则16 | 冒烟组数、变异体数、**必须带 `--strict`** |

## 机器管不了的部分

语义类（章节内容是否还描述得对、取舍是否已变）靠人，清单在 [`DOC_SEMANTIC_CHECKLIST.md`](./DOC_SEMANTIC_CHECKLIST.md)；
每次版本更新按 [`READTHROUGH.md`](./READTHROUGH.md) 的四类清单过一遍，把新出现的过期点补进本表或对应文档。
