# 全仓覆盖矩阵（AUDIT_MATRIX）

> 第三轮审计的**唯一可核验载体**：证明 99 个 tracked 文件、每一个都被至少一个维度审过。
> 由 `test/audit/f-repo.js` 的 U~Z 六组实测产出，不是手写的清单。行数取 `wc -l`，随改动自动变化。
> 每次改动后重跑 `node test/audit/f-repo.js`；**本表行数、文件总数、总行数已由 `docs-audit` 规则17 自动校验与回写，漏登文件直接报红**——不再依赖人工同步。

## 维度定义

| 代号 | 含义 | 断言来源 |
|---|---|---|
| **U** 静态 | 语法可编译、编码无 BOM/CRLF、无 TODO、无明文密钥、无调试残留、文件非空 | f-repo U1~U13 |
| **V** 引用 | 相对链接无死链、`@version` 三文档一致、冒烟组数/开关数/错误码数可解析且一致 | f-repo V1~V8 |
| **W** 契约 | 脚本导出面可 require、登记表字段完整且唯一、日期时区正确、hook 语法通过 | f-repo W1~W9 |
| **X** 联动 | 跨模块消费链接通（片段码↔巡检、日报↔README_HEALTH、开关↔源码默认、CI↔脚本存在） | f-repo X1~X9 |
| **Y** 死码 | 无重复函数、无只定义不用的常量、无 debugger、错误码全被使用、无未用 let | f-repo Y1~Y6 |
| **Z** 资源 | 加载 <50ms、重复加载堆增长可控、导出面完整、无非法入库文件、无超大文件 | f-repo Z1~Z5 |
| **H** 行为 | 取链/降档/验真/缓存/熔断/限速/冷却/探针/跨平台兜底等运行时行为 | a-static 10 / b-logic 30 / d-func 30 / e-extra 94 / f-repo 52 / g-meta 14 / h-toggles 14 / n-fixes 4 / p-gaps 4 / q-dfix 5 / q2 3 / r 23 / s 22 / t 12 / u 12 / v 13 / w 2 / x 12 / candidate 6 / QuickJS 3；审计合计 **365** |

## 覆盖矩阵

| 文件 | 行 | 类型 | U | V | W | X | Y | Z | H | 证据 |
|---|---|---|---|---|---|---|---|---|---|---|
| `docs/音源架构执行全过程-2026-11-12.md` | 143 | .md | ✓ | ✓ | — | — | — | — | — | U2~U6/V1/V6~V8 |
| `.github/workflows/ci.yml` | 488 | .yml | ✓ | — | — | ✓ | — | — | — | U12/X7/X8 |
| `.github/workflows/docs-audit.yml` | 56 | .yml | ✓ | — | — | ✓ | — | — | — | U12/X7/X8 |
| `README.md` | 144 | .md | ✓ | ✓ | — | — | — | — | — | U2~U6/V1/V6~V8 |
| `README_HEALTH.md` | 37 | .md | ✓ | ✓ | — | — | — | — | — | U2~U6/V1/V6~V8 |
| `docs/P2_TRIAGE.md` | 104 | .md | ✓ | ✓ | — | — | — | — | — | (P2 定档表) |
| `docs/AGENTS.md` | 207 | .md | ✓ | ✓ | — | — | — | — | — | U2~U6/V1/V6~V8 |
| `docs/ARCHIVE_OLD_TAGS.md` | 138 | .md | ✓ | ✓ | — | — | — | — | — | U2~U6/V1/V6~V8 |
| `docs/AUDIT_RESULTS.md` | 2019 | .md | ✓ | ✓ | — | — | — | — | — | U2~U6/V1/V6~V8 |
| `docs/DEV_GUIDE.md` | 621 | .md | ✓ | ✓ | — | — | — | — | — | U2~U6/V1/V6~V8 |
| `docs/DOC_SEMANTIC_CHECKLIST.md` | 36 | .md | ✓ | ✓ | — | — | — | — | — | U2~U6/V1/V6~V8 |
| `docs/INTERFACE_CHANGE_PLAYBOOK.md` | 62 | .md | ✓ | ✓ | — | — | — | — | — | U2~U6/V1/V6~V8 |
| `docs/ITERATION_ROADMAP.md` | 328 | .md | ✓ | ✓ | — | — | — | — | — | U2~U6/V1/V6~V8 |
| `docs/SOURCE_AUDIT.md` | 104 | .md | ✓ | ✓ | — | — | — | — | — | U2~U6/V1/V6~V8 |
| `docs/archive/AUDIT_PROGRESS-2026-11-07.md` | 82 | .md | ✓ | ✓ | — | — | — | — | — | U2~U6/V1/V6~V8 |
| `docs/archive/AUDIT_REPORT-2026-11-05.md` | 146 | .md | ✓ | ✓ | — | — | — | — | — | U2~U6/V1/V6~V8 |
| `docs/archive/AUDIT_REPORT-2026-11-07.md` | 295 | .md | ✓ | ✓ | — | — | — | — | — | U2~U6/V1/V6~V8 |
| `docs/archive/QUALITY_POLICY_OPTIMIZATION_PLAN.md` | 266 | .md | ✓ | ✓ | — | — | — | — | — | 音质策略优化方案（已执行 P0/P1，2026-11-20 归档） |
| `docs/archive/音源架构执行全过程-2026-11-12.md` | 143 | .md | ✓ | ✓ | — | — | — | — | — | v8.6~v8.13 架构阶段纪要（2026-11-20 归档） |
| `docs/candidate-status.md` | 8 | .md | ✓ | ✓ | — | — | — | — | — | U2~U6/V1/V6~V8 |
| `docs/health-daily/` | 998 | .md+.json | ✓ | ✓ | — | — | — | — | — | U2~U6/V1/V6~V8/U10 |
| `docs/probe-history.jsonl` | 247 | .jsonl | ✓ | — | — | ✓ | — | — | — | U11/X2 |
| `lx-source.js` | 7654 | .js | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | U1/W1/Y1/H a~e/X |
| `scripts/preflight-push.sh` | 53 | .sh | ✓ | — | — | — | — | — | — | (推送前校验) |
| `scripts/candidate-audit.js` | 342 | .js | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | U1/W1/Y1/X |
| `scripts/cn-date.js` | 17 | .js | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | U1/W1/Y1/X |
| `scripts/doc-sync-map.js` | 125 | .js | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | U1/W1/Y1/X |
| `scripts/check-data-retention.js` | 99 | .js | ✓ | ✓ | — | — | — | — | — | U2~U6/V1（只读巡检，不删数据） |
| `scripts/docs-audit.js` | 561 | .js | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | U1/W1/Y1/X |
| `scripts/ecosystem-scan.js` | 165 | .js | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | U1/W1/Y1/X |
| `scripts/endpoint-registry.js` | 84 | .js | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | U1/W1/Y1/X |
| `scripts/health-alert.js` | 73 | .js | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | U1/W1/Y1/X |
| `scripts/health-daily.js` | 465 | .js | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | U1/W1/Y1/X |
| `scripts/hooks/commit-msg` | 7 | .sh | ✓ | — | — | — | — | — | — | U5 |
| `scripts/hooks/pre-push` | 16 | .sh | ✓ | — | — | — | — | — | — | U5 |
| `scripts/hooks/prepare-commit-msg` | 13 | .sh | ✓ | — | — | — | — | — | — | U5 |
| `scripts/install-hooks.sh` | 8 | .sh | ✓ | — | — | — | — | — | — | U5 |
| `scripts/probe.js` | 776 | .js | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | U1/W1/Y1/X |
| `scripts/probe-identity.js` | 266 | .js | ✓ | ✓ | — | — | ✓ | — | — | U1/W1/Y1（联网取证工具，不进 npm test） |
| `scripts/recheck-candidates.js` | 202 | .js | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | U1/W1/Y1/X |
| `scripts/self-check.js` | 128 | .js | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | U1/W1/Y1/X |
| `scripts/pull-device-digests.js` | 103 | .js | ✓ | ✓ | — | — | — | — | — | U1/W1/Y1/X |
| `scripts/chain-sample.js` | 77 | .js | ✓ | ✓ | — | — | — | — | — | U1/W1/Y1/X |
| `scripts/source-audit.js` | 224 | .js | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | U1/W1/Y1/X |
| `scripts/source-toggles.js` | 129 | .js | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | U1/W1/Y1/X |
| `test/audit/a-static.js` | 260 | .js | ✓ | — | ✓ | — | ✓ | — | ✓ | U1/W1/Y1/H a~e |
| `test/audit/b-logic.js` | 245 | .js | ✓ | — | ✓ | — | ✓ | — | ✓ | U1/W1/Y1/H a~e |
| `test/audit/d-func.js` | 241 | .js | ✓ | — | ✓ | — | ✓ | — | ✓ | U1/W1/Y1/H a~e |
| `test/audit/p-gaps.js` | 182 | .js | — | — | ✓ | ✓ | ✓ | — | ✓ | P1~P4/X (新增) |
| `test/audit/q-dfix.js` | 142 | .js | — | — | ✓ | — | ✓ | — | ✓ | Q1~Q5/D-01/D-04/F-01 |
| `test/audit/q2-dseries.js` | 84 | .js | — | — | ✓ | — | ✓ | — | ✓ | R1~R3/D-05/D-06/D-26 |
| `test/audit/anchors-contract.js` | 154 | .js | — | — | ✓ | — | ✓ | — | ✓ | A1~A4 四条判据 + 逐键验证 + 并集覆盖 |
| `test/audit/force-probe-contract.js` | 127 | .js | — | — | ✓ | — | ✓ | — | ✓ | FP1~FP10：`forceQualityProbe` action 契约（未知源 resolve 不 reject / 缺 id reject / 写入立即到期 / 不动 breaker） |
| `test/audit/n-fixes.js` | 158 | .js | — | — | ✓ | ✓ | ✓ | — | ✓ | N1~N4/X (新增) |
| `test/audit/quality-truth.js` | 123 | .js | — | — | ✓ | — | ✓ | — | ✓ | QT-1~QT-9 音质真实标签（m4a/ogg/wav/Range/200 全量/置信度） |
| `test/audit/quality-policy-v2.js` | 214 | .js | ✓ | — | ✓ | — | ✓ | — | ✓ | QP1~QP8 音质策略 P0/P1（ceiling TTL / definitiveFail / 短路口径 / 旧快照兼容） |
| `test/audit/budget-admission.js` | 48 | .js | ✓ | — | ✓ | — | ✓ | — | ✓ | A2-1~A2-7 预算边界与归因（BUDGET 不摘源 / 16s 硬顶 / 冷启动钳制 / 单链 0 宽限） |
| `test/audit/h-toggles.js` | 170 | .js | — | — | ✓ | ✓ | ✓ | — | ✓ | H1~H14/X (新增) |
| `test/audit/v-eligibility.js` | 116 | .js | ✓ | — | ✓ | — | ✓ | — | ✓ | V1~V7 统一资格 |
| `test/audit/health-linkage-invariants.js` | 159 | .js | ✓ | — | ✓ | — | ✓ | — | ✓ | L1~L4/F61/F64 联动 |
| `test/audit/health-state-machine-v2.js` | 147 | .js | ✓ | — | ✓ | — | ✓ | — | ✓ | 方案 6.2 M1~M10 状态机/快照同源 |
| `test/audit/health-authority-split.js` | 126 | .js | ✓ | — | ✓ | — | ✓ | — | ✓ | Batch 1 A1~A9 开关权威拆分 |
| `test/audit/health-probe-batch2.js` | 154 | .js | ✓ | — | ✓ | — | ✓ | — | ✓ | Batch 2 B1~B9 探测/质量档 |
| `test/audit/health-eligibility-batch3.js` | 132 | .js | ✓ | — | ✓ | — | ✓ | — | ✓ | Batch 3 C1~C9 统一 Eligibility 接入 |
| `test/audit/health-breaker-quality.js` | 135 | .js | ✓ | — | ✓ | — | ✓ | — | ✓ | Q1~Q5/F39/F40/F41 按档熔断 |
| `test/audit/health-resolve-dead.js` | 106 | .js | ✓ | — | ✓ | — | ✓ | — | ✓ | R1~R4/F42 取链摘除分层 |
| `test/audit/health-scoped-reset.js` | 74 | .js | ✓ | — | ✓ | — | ✓ | — | ✓ | S1~S2/F38 scoped 清账 |
| `test/audit/health-scheduler-fake-clock.js` | 65 | .js | ✓ | — | ✓ | — | ✓ | — | ✓ | N1~N2/F21 探测 jitter/暂停 |
| `test/audit/health-persistence-v2.js` | 176 | .js | ✓ | — | ✓ | — | ✓ | — | ✓ | F36/F57 P1~P10 持久化 v2 |
| `test/audit/health-probe-outcome.js` | 143 | .js | ✓ | — | ✓ | — | ✓ | — | ✓ | F20/F22 O1~O9 探测三值 |
| `test/audit/health-probe-fidelity.js` | 171 | .js | ✓ | — | ✓ | — | ✓ | — | ✓ | F20/F22 F1~F10 探测保真 |
| `test/audit/health-transition-events.js` | 112 | .js | ✓ | — | ✓ | — | ✓ | — | ✓ | F33 U1~U7 迁移事件优先级 |
| `test/audit/health-snapshot-eta.js` | 169 | .js | ✓ | — | ✓ | — | ✓ | — | ✓ | F35/F45/F46/F06/F32/F17 ETA/限速/冷启/事件/计数 S1~S11 |
| `test/audit/e-extra.js` | 966 | .js | ✓ | — | ✓ | — | ✓ | — | ✓ | U1/W1/Y1/H a~e |
| `test/candidate-audit-test.js` | 135 | .js | ✓ | — | ✓ | — | ✓ | — | ✓ | U1/W1/Y1/H a~e |
| `test/lx-source-smoke-test.js` | 1656 | .js | ✓ | — | ✓ | — | ✓ | — | ✓ | U1/W1/Y1/H a~e |
| `test/stress-test.js` | 228 | .js | ✓ | — | ✓ | — | ✓ | — | ✓ | U1/W1/Y1/H a~e |
| `docs/ARCHITECTURE.md` | 93 | .md | ✓ | ✓ | — | — | — | — | — | U2~U6/V1/V6~V8 |
| `docs/README.md` | 72 | .md | ✓ | ✓ | — | — | — | — | — | U2~U6/V1/V6~V8 |
| `docs/SCRIPTS.md` | 99 | .md | ✓ | ✓ | — | — | — | — | — | U2~U6/V1/V6~V8 |
| `docs/TESTING.md` | 202 | .md | ✓ | ✓ | — | — | — | — | — | U2~U6/V1/V6~V8 |
| `docs/CHANGELOG.md` | 535 | .md | ✓ | ✓ | — | — | — | — | — | U2~U6/V1/V6~V8 |
| `docs/archive/AUDIT_HISTORY.md` | 1441 | .md | ✓ | ✓ | — | — | — | — | — | 归档合集 |
| `docs/AUDIT_MATRIX.md` | 269 | .md | ✓ | ✓ | — | — | — | — | — | U2~U6/V1/V6~V8 |
| `test/audit/f-repo.js` | 517 | .js | ✓ | — | ✓ | ✓ | ✓ | — | ✓ | U1/W1/Y1/H a~e/X |
| `test/stress-round3.js` | 364 | .js | ✓ | — | ✓ | ✓ | ✓ | — | ✓ | U1/W1/Y1/H T1~T14 |
| `test/audit/g-meta.js` | 451 | .js | ✓ | — | ✓ | ✓ | ✓ | — | ✓ | U1/W1/Y1/M1~M14/M9b/M9c |
| `test/audit/tg-truth.js` | 136 | .js | ✓ | — | ✓ | — | ✓ | — | ✓ | U1/Y1/G1~G13 |
| `docs/reports/v8.11.1-第五轮审计结算.md` | 122 | .md | ✓ | ✓ | — | — | — | — | — | 五轮结算 |
| `test/mutation/run.js` | 320 | .js | ✓ | — | ✓ | ✓ | ✓ | — | ✓ | MU1~MU22（变异测试） |
| `.gitignore` | 8 | 其他 | ✓ | — | — | — | — | — | — | U13 编码扫描（本轮登记） |
| `docs/AUDIT_PLAN_v10.md` | 288 | .md | ✓ | ✓ | — | — | — | — | — | U2~U6/V1~V8（本轮登记） |
| `docs/archive/PROGRESS_round5.md` | 58 | .md | ✓ | ✓ | — | — | — | — | — | U2~U6/V1~V8（本轮登记） |
| `docs/STRESS_PLAN.md` | 155 | .md | ✓ | ✓ | — | — | — | — | — | U2~U6/V1（本轮登记） |
| `docs/reports/v8.11.1-第六轮缺口审计.md` | 480 | .md | ✓ | ✓ | — | — | — | — | — | U2~U6/V1（本轮登记） |
| `docs/reports/R76-音源全量通读-2026-11-23.md` | 86 | .md | ✓ | ✓ | — | — | — | — | — | R76 产物 7375 行通读定案（P1×2/P2×6，复现 6/4） |
| `docs/reports/候选接入评审-2026-11-15.md` | 97 | .md | ✓ | ✓ | — | — | — | — | — | R40 生态候选（qingliang tx 5/5 全曲） |
| `test/audit/q-quickjs-real.js` | 141 | .js | ✓ | — | ✓ | — | ✓ | — | ✓ | U1/W1/Y1/QR1~QR3 |
| `test/audit/aa-p3-persist.js` | 239 | .js | ✓ | — | ✓ | — | ✓ | — | ✓ | P3 A1~A6 宿主持久化协议（导出/恢复/拒绝 URL/版本 TTL） |
| `test/audit/r-admission.js` | 534 | .js | ✓ | — | ✓ | — | ✓ | — | ✓ | R 组 A1~A20 + A3d（L4 裁决层；A3d 给 trialMark 接真生产者，防「没人会置的开关」） |
| `test/audit/u-cross-platform.js` | 361 | .js | ✓ | — | ✓ | — | ✓ | — | ✓ | U 组 U1~U15（v8.12.1 跨平台缓存失效；U13 三目标；U14 mg/kg 不再作为目标；U15 实际平台标签） |
| `test/audit/v-cross-platform-stress.js` | 447 | .js | ✓ | — | ✓ | — | ✓ | — | ✓ | V 组 V1~V13（20 并发同歌 / 缓存上限 / 总开关 / 关源重开 / remix-only / 慢主平台 / 事件隐私 / 同名同歌手时长差 199s 拒绝） |
| `test/audit/w-fallback-owner.js` | 54 | .js | ✓ | — | ✓ | — | ✓ | — | ✓ | P1 W1~W2（inited 已上报 / 5 平台 fallbackOwner=source） |
| `test/audit/x-media-envelope.js` | 161 | .js | ✓ | — | ✓ | — | ✓ | — | ✓ | P2 X1~X12（64B/1B/1KB/1MiB/8MiB 信封还原 / kindOf audio / byteLength=BAD_ENVELOPE / 缺片=TRUNCATED_MEDIA / 旧 Buffer 兼容 / mediaEnvelope 能力声明 / 0 字节零长 / admit 错误码 / 1MiB JSON.parse≤10ms） |
| `test/audit/security-url-guard.js` | 128 | .js | — | — | ✓ | — | ✓ | — | ✓ | G6 非法 URL 防线：`validateUrl`/`probeAudioDelivery`/`upgradeToHttps` 三入口 × `javascript:`/`file://`/`data:`/`//evil.com`/空/100KB，12 条；先红 5/12 → 绿 12/0（放宽 `HTTP_URL_REGEX`） |
| `test/audit/r77-fixes.js` | 281 | .js | — | — | ✓ | — | ✓ | — | ✓ | R77（R76 通读缺陷修复回归，v9.1.7）27 条（R78 增 B10 reviewAt 未来日期）：G12 导出→恢复全字段等价 / G13 FLAC 小端 + ID3v2.2/2.3/2.4 真实字节夹具 / G14 快照纯度 / P2-06 档位复位 / G9 缓存 key 含时长 / 契约复核新鲜度（时间注入）/ interval 回退 / 解析顺序 / 预热锚点 / 探针元数据；红绿双向逐点验证（6 轮旧形态重演） |
| `test/audit/r81-proxy-compat.js` | 74 | .js | — | — | ✓ | — | ✓ | — | ✓ | R81 真机 QuickJS Proxy 兼容（v9.3.1）6 条：产物无可执行 `Date.parse` / 有 `parseYmdToMs` / 无 `new Proxy`，源码调用归零，12 例日期解析等价（闰年 / 跨纪元 / 非法输入） |
| `test/audit/readthrough-fixes.js` | 451 | .js | ✓ | — | — | ✓ | ✓ | — | ✓ | v8.16.2 RF1~RF18（R-01 档位熔断持久化 / R-02 真实音质入账 / R-03 播放分账 / R-04 快照运行期资格 / R-05 试探键清理 / R-06 半开名额后置 / R-07 gateErr 带码 / R-09 跨平台可取消 / R-10 兜底结构化 / R-11 ttl 死分支 / R-12 七项 / R-08 版本口径）；先红 0/18 → 绿 18/0 |
| `docs/chain-sample.jsonl` | 45 | .jsonl | ✓ | — | — | — | — | — | — | 出链抽样数据（`scripts/chain-sample.js` 产出，日报消费） |
| `docs/device-digests.jsonl` | 3 | .jsonl | ✓ | — | — | — | — | — | — | 真机摘要数据（`scripts/pull-device-digests.js` 产出） |
| `test/audit/s-health-events.js` | 290 | .js | ✓ | — | ✓ | — | ✓ | — | ✓ | S 组 S1~S6 + S5b（事件白名单 27 条；S5b 白名单漂移加载即炸） |
| `test/audit/t-health-events-stress.js` | 146 | .js | ✓ | — | ✓ | — | ✓ | — | ✓ | T 组 T1~T9（2.4 方案压力 12 条） |
| `test/stress-round4.js` | 1343 | .js | ✓ | — | ✓ | ✓ | ✓ | — | ✓ | U1/W1/Y1/V1a~V39b（133 条） |
| `tools/live/host.js` | 84 | .js | ✓ | — | ✓ | ✓ | ✓ | ✓ | — | U1/W1/Y1/Z*（真宿主桩，L1~L7） |
| `tools/live/run.js` | 348 | .js | ✓ | — | — | ✓ | ✓ | ✓ | — | U1/Y1/Z*（L1~L7 三分支实跑） |
| `docs/READTHROUGH.md` | 325 | .md | ✓ | ✓ | — | — | — | — | — | 本轮通读台账（规则18 自校验） |
| `docs/archive/READTHROUGH_v8.16.1.md` | 337 | .md | ✓ | ✓ | — | — | — | — | — | 2026-11-17 `lx-source.js` 逐行通读结论（R-01~R-12 + 证伪记录） |
| `docs/archive/READTHROUGH_v8.16.2.md` | 170 | .md | ✓ | ✓ | — | — | — | — | — | 8.16.2 产物 6045 行 7 段逐行通读（R-13 + 14 观察项 + 15 排除） |
| `docs/DOC_INDEX.md` | 82 | .md | ✓ | ✓ | — | — | — | — | — | 文档登记表（规则19 自校验） |
| `docs/KNOWN_ISSUES.md` | 111 | .md | ✓ | ✓ | — | — | — | — | — | 已知问题/技术债台账（K01~K20） |
| `docs/QUALITY_POLICY_OPTIMIZATION_PLAN.md` | 266 | .md | ✓ | ✓ | — | — | — | — | — | 音质策略优化方案（含复现证据） |
## 汇总

- 文件总数：**202**（`git ls-files` 实测；四轮新增 g-meta + round1~4，五轮新增 round5 + test/mutation/run.js + 第五轮结算报告）
- 总行数：**62865**（`git ls-files | xargs wc -l` 实测，随改动自动变化）
- U：**65/65** 文件全覆盖（U 组逐个 `node --check` / 编码 / 待办 / 密钥 / 调试残留）
- V/W/X/Y/Z：对应组断言条数（V1~V8 / W1~W9 / X1~X9 / Y1~Y6 / Z1~Z5），不按文件重复计数
| `docs/SOURCE_CAPABILITY.md` | 222 | .md | ✓ | ✓ | — | — | ✓ | ✓ | — | 13 源逐档实测矩阵（U2~U6/V2/Y1~Y6/Z3） |
| `docs/SOURCE_LIFECYCLE.md` | 76 | .md | ✓ | ✓ | — | — | ✓ | ✓ | — | U2~U6/V2/Y1~Y6/Z3 |
| `docs/SOURCE_REGISTRY.md` | 111 | .md | ✓ | ✓ | — | — | ✓ | ✓ | — | U2~U6/V2/Y1~Y6/Z3 |
| `docs/SOURCE_RETIREMENT.md` | 108 | .md | ✓ | ✓ | — | — | ✓ | ✓ | — | U2~U6/V2/Y1~Y6/Z3 |
| `package-lock.json` | 502 | .json | ✓ | ✓ | — | — | ✓ | ✓ | — | U2~U6/V2/Y1~Y6/Z3 |
| `package.json` | 25 | .json | ✓ | ✓ | — | — | ✓ | ✓ | — | U2~U6/V2/Y1~Y6/Z3 |
| `scripts/build-source.js` | 56 | .js | ✓ | ✓ | — | — | ✓ | ✓ | — | U2~U6/V2/Y1~Y6/Z3 |
| `scripts/source-inventory.js` | 112 | .js | ✓ | ✓ | — | — | ✓ | ✓ | — | U2~U6/V2/Y1~Y6/Z3 |
| `scripts/verify-bundle.js` | 105 | .js | ✓ | ✓ | — | — | ✓ | ✓ | — | U2~U6/V2/Y1~Y6/Z3 |
| `scripts/verify-real-platforms.js` | 83 | .js | ✓ | — | — | — | ✓ | ✓ | — | 真实 HTTP 宿主五平台取链证据 |
| `scripts/verify-real-platform-chains.js` | 106 | .js | ✓ | — | — | — | ✓ | ✓ | — | G7 平台 ID 链真实证据 |
| `src/00-header.js` | 6 | .js | ✓ | ✓ | — | — | ✓ | ✓ | — | U2~U6/V2/Y1~Y6/Z3 |
| `src/80-entry.js` | 10 | .js | ✓ | ✓ | — | — | ✓ | ✓ | — | U2~U6/V2/Y1~Y6/Z3 |
| `src/legacy.js` | 1320 | .js | ✓ | ✓ | — | — | ✓ | ✓ | — | U2~U6/V2/Y1~Y6/Z3 |
| `src/providers/55-probation.js` | 41 | .js | ✓ | ✓ | — | — | ✓ | ✓ | — | U2~U6/V2/Y1~Y6/Z3 |
| `src/providers/changqingVip.js` | 20 | .js | ✓ | ✓ | — | — | ✓ | ✓ | — | U2~U6/V2/Y1~Y6/Z3 |
| `src/providers/helloworldKw.js` | 22 | .js | ✓ | ✓ | — | — | ✓ | ✓ | — | U2~U6/V2/Y1~Y6/Z3 |
| `src/providers/qingliangTx.js` | 21 | .js | ✓ | ✓ | — | — | ✓ | ✓ | — | V2/Y1~Y6/Z3 |
| `src/providers/luoyueTx.js` | 22 | .js | ✓ | ✓ | — | — | ✓ | ✓ | — | V2/Y1~Y6/Z3 |
| `src/providers/audius.js` | 21 | .js | ✓ | ✓ | — | — | ✓ | ✓ | — | V2/Y1~Y6/Z3/D1 |
| `src/providers/huibq.js` | 23 | .js | ✓ | ✓ | — | — | ✓ | ✓ | — | U2~U6/V2/Y1~Y6/Z3 |
| `src/providers/ikun.js` | 29 | .js | ✓ | ✓ | — | — | ✓ | ✓ | — | U2~U6/V2/Y1~Y6/Z3 |
| `src/providers/index.js` | 18 | .js | ✓ | ✓ | — | — | ✓ | ✓ | — | U2~U6/V2/Y1~Y6/Z3 |
| `src/providers/juheTx.js` | 21 | .js | ✓ | ✓ | — | — | ✓ | ✓ | — | U2~U6/V2/Y1~Y6/Z3 |
| `src/providers/kuwoOfficial.js` | 20 | .js | ✓ | ✓ | — | — | ✓ | ✓ | — | U2~U6/V2/Y1~Y6/Z3 |
| `src/providers/suyin163.js` | 20 | .js | ✓ | ✓ | — | — | ✓ | ✓ | — | U2~U6/V2/Y1~Y6/Z3 |
| `src/providers/suyinKuwo.js` | 30 | .js | ✓ | ✓ | — | — | ✓ | ✓ | — | U2~U6/V2/Y1~Y6/Z3 |
| `src/providers/wyOuter.js` | 20 | .js | ✓ | ✓ | — | — | ✓ | ✓ | — | U2~U6/V2/Y1~Y6/Z3 |
| `src/providers/xinghaiBackend.js` | 22 | .js | ✓ | ✓ | — | — | ✓ | ✓ | — | U2~U6/V2/Y1~Y6/Z3 |
| `test/audit/s-source-lifecycle.js` | 125 | .js | ✓ | ✓ | — | — | ✓ | ✓ | — | U2~U6/V2/Y1~Y6/Z3 |
| `test/audit/y-provider-contract.js` | 172 | .js | ✓ | ✓ | — | — | ✓ | ✓ | — | U2~U6/V2/Y1~Y6/Z3 |
| `test/audit/z-cancel.js` | 170 | .js | ✓ | ✓ | — | — | ✓ | ✓ | — | U2~U6/V2/Y1~Y6/Z3 |
| `scripts/dump-chain.js` | 75 | .js | ✓ | ✓ | — | — | ✓ | ✓ | — | U2~U6/V2/Y1~Y6 |
| `test/fixtures/chain-golden.json` | 102 | .json | ✓ | ✓ | — | — | — | ✓ | ✓ | U2~U6/V2/Y9 |
| `docs/V9_MODULE_MAP.md` | 20 | .md | ✓ | — | — | — | — | — | — | U1~U13 |
| `docs/health-daily/2026-11-03.md` | 42 | .md | ✓ | — | — | — | — | — | — | U1~U13 |
| `docs/health-daily/2026-11-04.md` | 41 | .md | ✓ | — | — | — | — | — | — | U1~U13 |
| `docs/health-daily/2026-11-05.md` | 40 | .md | ✓ | — | — | — | — | — | — | U1~U13 |
| `docs/health-daily/2026-11-06.md` | 41 | .md | ✓ | — | — | — | — | — | — | U1~U13 |
| `docs/health-daily/2026-11-07.md` | 41 | .md | ✓ | — | — | — | — | — | — | U1~U13 |
| `docs/health-daily/2026-11-08.json` | 54 | .json | ✓ | — | — | — | — | — | — | U1~U13 |
| `docs/health-daily/2026-11-08.md` | 48 | .md | ✓ | — | — | — | — | — | — | U1~U13 |
| `docs/health-daily/2026-11-09.json` | 48 | .json | ✓ | — | — | — | — | — | — | U1~U13 |
| `docs/health-daily/2026-11-09.md` | 48 | .md | ✓ | — | — | — | — | — | — | U1~U13 |
| `docs/health-daily/2026-11-10.json` | 39 | .json | ✓ | — | — | — | — | — | — | U1~U13 |
| `docs/health-daily/2026-11-10.md` | 46 | .md | ✓ | — | — | — | — | — | — | U1~U13 |
| `docs/health-daily/2026-11-11.json` | 40 | .json | ✓ | — | — | — | — | — | — | U1~U13 |
| `docs/health-daily/2026-11-11.md` | 46 | .md | ✓ | — | — | — | — | — | — | U1~U13 |
| `docs/health-daily/2026-11-12.json` | 66 | .json | ✓ | — | — | — | — | — | — | U1~U13 |
| `docs/health-daily/2026-11-12.md` | 80 | .md | ✓ | — | — | — | — | — | — | U1~U13 |
| `docs/health-daily/2026-11-13.json` | 66 | .json | ✓ | — | — | — | — | — | — | U1~U13 |
| `docs/health-daily/2026-11-13.md` | 49 | .md | ✓ | — | — | — | — | — | — | U1~U13 |
| `docs/health-daily/2026-11-14.json` | 65 | .json | ✓ | — | — | — | — | — | — | U1~U13 |
| `docs/health-daily/2026-11-14.md` | 47 | .md | ✓ | — | — | — | — | — | — | U1~U13 |
| `docs/health-daily/2026-11-15.json` | 64 | .json | ✓ | — | — | — | — | — | — | U1~U13 |
| `docs/health-daily/2026-11-15.md` | 46 | .md | ✓ | — | — | — | — | — | — | U1~U13 |
| `docs/health-daily/2026-11-16.json` | 53 | .json | ✓ | — | — | — | — | — | — | U1~U13 |
| `docs/health-daily/2026-11-16.md` | 45 | .md | ✓ | — | — | — | — | — | — | U1~U13 |
| `docs/health-daily/2026-11-17.json` | 187 | .json | ✓ | — | — | — | — | — | — | U1~U13 |
| `docs/health-daily/2026-11-17.md` | 74 | .md | ✓ | — | — | — | — | — | — | U1~U13 |
| `scripts/api-surface.js` | 178 | .js | ✓ | — | — | — | — | — | — | U1~U13 |
| `scripts/equiv-snapshot.js` | 216 | .js | ✓ | — | — | — | — | — | — | U1~U13 |
| `scripts/lib/js-block.js` | 190 | .js | ✓ | — | — | — | — | — | — | U1~U13 |
| `scripts/lib/history.js` | 246 | .js | ✓ | — | — | — | — | — | — | U1~U13 |
| `scripts/lib/probe-songs.js` | 54 | .js | ✓ | — | — | — | — | — | — | U1~U13 |
| `scripts/lib/source-host.js` | 106 | .js | ✓ | — | — | — | — | — | — | U1~U13 |
| `scripts/ref-closure.js` | 183 | .js | ✓ | — | — | — | — | — | — | U1~U13 |
| `scripts/v9-gate.sh` | 79 | .sh | ✓ | — | — | — | — | — | — | U1~U13 |
| `src/core/00-host.js` | 11 | .js | ✓ | — | — | — | — | — | — | U1~U13 |
| `src/core/01-log.js` | 20 | .js | ✓ | — | — | — | — | — | — | U1~U13 |
| `src/core/02-config.js` | 96 | .js | ✓ | — | — | — | — | — | — | U1~U13 |
| `src/core/02-error-codes.js` | 35 | .js | ✓ | — | — | — | — | — | — | U1~U13 |
| `src/core/03-events.js` | 124 | .js | ✓ | — | — | — | — | — | — | U1~U13 |
| `src/core/04-cancel.js` | 69 | .js | ✓ | — | — | — | — | — | — | U1~U13 |
| `src/core/05-verdict.js` | 173 | .js | ✓ | — | — | — | — | — | — | U1~U13 |
| `src/core/06-binding.js` | 32 | .js | ✓ | — | — | — | — | — | — | U1~U13 |
| `src/core/07-net.js` | 270 | .js | ✓ | — | — | — | — | — | — | U1~U13 |
| `src/core/08-media.js` | 487 | .js | ✓ | — | — | — | — | — | — | U1~U13 |
| `src/core/09-match.js` | 272 | .js | ✓ | — | — | — | — | — | — | U1~U13 |
| `src/core/10-vendors.js` | 144 | .js | ✓ | — | — | — | — | — | — | U1~U13 |
| `src/core/11-provider-meta.js` | 8 | .js | ✓ | — | — | — | — | — | — | U1~U13 |
| `src/core/12-provider-contract.js` | 137 | .js | ✓ | — | — | — | — | — | — | U1~U13 |
| `src/core/13-chain-helpers.js` | 216 | .js | ✓ | — | — | — | — | — | — | U1~U13 |
| `src/core/14-lyric.js` | 93 | .js | ✓ | — | — | — | — | — | — | U1~U13 |
| `src/core/15-verify.js` | 353 | .js | ✓ | — | — | — | — | — | — | U1~U13 |
| `src/core/16-chain-misc.js` | 102 | .js | ✓ | — | — | — | — | — | — | U1~U13 |
| `src/core/17-health-check.js` | 894 | .js | ✓ | — | — | — | — | — | — | U1~U13 |
| `src/core/18-health-persist.js` | 271 | .js | ✓ | — | — | — | — | — | — | U1~U13 |
| `src/core/19-dispatch.js` | 703 | .js | ✓ | — | — | — | — | — | — | U1~U13 |
| `src/core/21-cross-search.js` | 181 | .js | ✓ | — | — | — | — | — | — | U1~U13 |
| `src/core/22-chain.js` | 986 | .js | ✓ | — | — | — | — | — | — | U1~U13 |
| `src/core/24-kuwo-official.js` | 106 | .js | ✓ | — | — | — | — | — | — | U1~U13 |
| `src/core/25-handlers.js` | 671 | .js | ✓ | — | — | — | — | — | — | U1~U13 |
| `src/core/27-sources-admin.js` | 121 | .js | ✓ | — | — | — | — | — | — | U1~U13 |
| `src/core/28-health-export.js` | 117 | .js | ✓ | — | — | — | — | — | — | U1~U13 |
| `src/core/29-search.js` | 95 | .js | ✓ | — | — | — | — | — | — | U1~U13 |
| `src/core/30-suyin-extra.js` | 66 | .js | ✓ | — | — | — | — | — | — | U1~U13 |
| `src/core/31-suyin-qq.js` | 66 | .js | ✓ | — | — | — | — | — | — | U1~U13 |
| `src/core/33-cross-cache.js` | 47 | .js | ✓ | — | — | — | — | — | — | U1~U13 |
| `src/core/34-breaker-state.js` | 60 | .js | ✓ | — | — | — | — | — | — | U1~U13 |
| `src/core/35-source-switch.js` | 84 | .js | ✓ | — | — | — | — | — | — | U1~U13 |
| `test/fixtures/api-surface.json` | 173 | .json | ✓ | — | — | — | — | — | — | U1~U13 |
| `test/fixtures/equiv-baseline.json` | 12991 | .json | ✓ | — | — | — | — | — | — | U1~U13 |
| `scripts/cross-repo-version.js` | 55 | .js | ✓ | — | — | — | — | — | — | U1~U13 |
| `scripts/layer-check.js` | 92 | .js | ✓ | — | — | — | — | — | — | U1~U13 |
| `scripts/schema-parity.js` | 48 | .js | ✓ | — | — | — | — | — | — | U1~U13 |
| `scripts/sign-release.js` | 97 | .js | ✓ | — | — | — | — | — | — | U1~U13 |
| `lx-source.js.manifest.json` | 9 | .json | ✓ | — | — | — | — | — | — | U1~U13 |
- H：行为断言脚本 **13** 个（含 `test/mutation/run.js`）（冒烟 + a-static/b-logic/d-func/e-extra + **h-toggles** + f-repo + g-meta + 两代压测）
- **未进矩阵的文件：0**（规则17 每次实跑都对 `git ls-files` 做集合差；此前漏 9 个：`.gitignore` / `AUDIT_PLAN_v10` / `PROGRESS_round5` / 两份 stress 计划 / 第六轮报告 / `q-quickjs-real.js` / `stress-round4.js`，已补登记）
- **未被 U（静态）覆盖的文件：0**——U 组按 tracked 文件动态遍历，不依赖本表；本表漏登记会造成「看起来没审」的假象
- 口径说明：审计**执行时**分母是 49 个已被跟踪的文件；本轮新增的 9 个文件在**提交后复跑**中一并被 U/V/W/Y/Z 组扫到（`node test/audit/f-repo.js` → 50/0，rc=0）

## 复现

```bash
node test/audit/f-repo.js     # 50 条，全绿则本表 U~Z 列成立
node test/lx-source-smoke-test.js && node test/audit/{a-static,b-logic,d-func,e-extra}.js  # H 列
node --expose-gc test/stress-test.js   # 12 断言
```
