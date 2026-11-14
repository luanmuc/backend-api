# 第二轮审计计划（J~T 十组）+ 压测重做

> **来源**：会话工作目录 `v8.11.1_第二轮全覆盖审计与压测_plan.md`（176 行，2026-11-08），本文件是并入仓库的正式版本。
> **基线**：v8.11.1。
> **落地脚本**：- `test/audit/e-extra.js` 57 条
- `test/stress-test.js` 12 条（S1~S10）
> **实际结果**：**57 条审计断言 + 12 条压测断言**
> **计划与实际的差异**：计划写 J~T 51 项，实际落地 57 项（部分项按平台×档位继续拆分）；压测计划写 10 组，落地为 S1~S10 共 12 条断言（S4/S5 各拆 a/b）
> **本仓状态**：全部断言已固化在 `test/`，可随时复跑；跑法见 [`../TESTING.md`](../../TESTING.md)。

---

> 对象：`repos/lx-music-source`（`lx-source.js` v8.11.1，3113 行）+ test/ scripts/ CI/ 文档
> 日期：2026-11-08
> 依据：现有 `docs/AUDIT_PLAN.md`（844 行，A~V 组历史）+ 本轮 79 项审计结果
> 目标：把「只测了 musicUrl」的口子补上，把状态机/配置面/兼容性/泄漏四类补全，压测全部重做

---

## 0. 现状核定：上一轮 79 项覆盖了什么、漏了什么

| 已覆盖（79 项） | 覆盖率 |
|---|---|
| `musicUrl` 全链路（判据、降档、缓存、限流冷却、兜底、标签） | 充分 |
| 静态语法/死代码/配置白名单 | 充分 |
| 危险 URL / 畸形响应 / 注入 / 编码 | 充分 |
| 开关回滚（verifyDelivery / truthfulQuality / fragmentFallback） | 3/5 个开关 |
| 巡检子系统的判据同源 | 充分 |
| 文档一致（5 处版本、行段、跨仓、CI） | 充分 |

**明确漏测（本轮必须补）：**

| # | 缺口 | 依据（代码里存在但没测） |
|---|---|---|
| 1 | `lyric` 歌词 action | `action === "lyric"`（L3057） |
| 2 | `health` / `toggle` / `probe` / `config` / `trend` 五个管理 action | L2934/2938/2961/2976/3050 |
| 3 | 未知 action 与非法入参兜底 | 未验证有无兜底 |
| 4 | 断路器状态机（closed→open→half-open→closed） | `breaker` 出现 19 处 |
| 5 | 限速窗口（`rateWindowMax` / `maxConcurrency` / `throttleCheck`） | 出现 7/3 处 |
| 6 | 缓存容量与 LRU 淘汰（只测了 TTL，没测容量） | `successCache` / `failCache` |
| 7 | 冷启动预热（`coldStartWarm*` / `coldStartProbeTimeoutMs`） | 16 处 |
| 8 | 质量短路（`qualityShortCircuit*`） | 9 处 |
| 9 | 播放死亡复活（`playDeadReviveMs`） | 5 处 |
| 10 | 健康分与排序（`computeHealthScore` / `sortChainByHealth`） | 6/5 处 |
| 11 | **QuickJS 兼容性**（App 内跑的是 QuickJS，不是 Node） | `??` / `Promise.race` / `finally` / 无 `Buffer` 路径 |
| 12 | 定时器/句柄泄漏（本轮新加了 `singleTimer`） | 新增代码 |
| 13 | 参数边界（非法 `type`、缺 `musicInfo`、超大/负 `duration`） | 未验证 |
| 14 | 导出面契约（19 项是否与 App 消费一致） | `module.exports` |
| 15 | 日志脱敏（签名直链、token 是否被打进日志） | `logInfo` / `logWarn` |

---

## 1. 第二轮审计矩阵（新增 J~T 十组，51 项）

### J 组 · 歌词链路（6 项）【全新】
| ID | 检查项 | 判定 |
|---|---|---|
| J1 | `lyric` action 正常返回 `{lyric, tlyric}` 结构 | 字段齐全 |
| J2 | 无歌词时返回空结构而非抛错 | 不崩 |
| J3 | 多平台（kw/wy/tx/mg/kg）歌词都能走通 | 5/5 |
| J4 | 歌词编码（UTF-8 中文/emoji）不损坏 | 原样 |
| J5 | 歌词接口超时不阻塞过久 | ≤ 预算 |
| J6 | 歌词返回字段名与 App 消费一致 | 对齐 |

### K 组 · 管理 action（7 项）【全新】
| ID | 检查项 | 判定 |
|---|---|---|
| K1 | `health` 返回健康快照结构（各源 score/status） | 字段齐全 |
| K2 | `toggle` 开/关单个源生效且可回读 | 状态一致 |
| K3 | `probe` 触发探测不崩、返回结果 | 有结果 |
| K4 | `config` 读/写配置项生效 | 回读一致 |
| K5 | `trend` 返回趋势数组 | 结构正确 |
| K6 | 未知 action 返回明确错误而非静默 | 有错误码 |
| K7 | 五个管理 action 不产生音乐接口外呼（除 probe 外） | 外呼=0 |

### L 组 · 断路器状态机（5 项）【此前只测了源级冷却，没测断路器】
| ID | 检查项 | 判定 |
|---|---|---|
| L1 | 连续失败达 `breakerThreshold` → 熔断开路 | 后续请求跳过该源 |
| L2 | 熔断期间 `breakerCooldownMs` 内不重试 | 外呼=0 |
| L3 | 冷却结束 → 半开试探 → 成功则恢复 | 恢复可用 |
| L4 | 半开失败 → 立即回到开路 | 不雪崩 |
| L5 | 业务失败码不计入断路器（只算网络/服务端） | 分类正确 |

### M 组 · 限速与并发（5 项）【仅测了 10 并发，没测上限触发】
| ID | 检查项 | 判定 |
|---|---|---|
| M1 | 单源并发达 `maxConcurrency` → 本轮跳过 | 不排队堆积 |
| M2 | `rateWindowMax` 内超限 → 拒绝而非全放行 | 生效 |
| M3 | 窗口滑动后配额恢复 | 恢复 |
| M4 | `inflightCount` 在异常路径下正确递减 | 不泄漏 |
| M5 | 跳过时给的是明确错误码而非静默空转 | 有码 |

### N 组 · 缓存容量与 LRU（4 项）【只测了 TTL】
| ID | 检查项 | 判定 |
|---|---|---|
| N1 | `successCache` 超容量按 LRU 淘汰最旧 | 顺序正确 |
| N2 | `failCache` 超容量淘汰 | 顺序正确 |
| N3 | 淘汰后同 key 再请求会重新外呼 | 不误命中 |
| N4 | 三档 TTL（404 1h / 410 exp / 新增 30s·60s）优先级正确 | 取对值 |

### O 组 · 冷启动与短路（5 项）【未测】
| ID | 检查项 | 判定 |
|---|---|---|
| O1 | 冷启动预热在 `coldStartTimeoutMs` 内完成或放弃 | 不挂死 |
| O2 | 预热结果 `coldStartWarmTtlMs` 内复用 | 复用 |
| O3 | `qualityShortCircuit` 采样达标后短路高音质 | 生效 |
| O4 | 采样不足时不短路（防误判） | 不误判 |
| O5 | `playDeadReviveMs` 内重复失败不放大 | 生效 |

### P 组 · 健康分与排序（4 项）
| ID | 检查项 | 判定 |
|---|---|---|
| P1 | `computeHealthScore` 对 0 样本、全失败、全成功三态取值合理 | 不 NaN |
| P2 | `sortChainByHealth` 稳定排序（同分不抖动） | 稳定 |
| P3 | 健康快照字段与 App 消费一致 | 对齐 |
| P4 | 新错误码不污染健康分口径（片段不算"成功"） | 口径正确 |

### Q 组 · QuickJS 兼容性（5 项）【关键：App 内不是 Node】
| ID | 检查项 | 判定 |
|---|---|---|
| Q1 | `??`、可选链在 ES2020 环境可用（无语法降级问题） | 可解析 |
| Q2 | `Promise.race` / `Promise.finally` 可用 | 可用 |
| Q3 | 无 `Buffer` 环境下判据层降级路径可用 | 不崩 |
| Q4 | 无 `utils.buffer` 时加载不崩（B2 已测，复验） | 不崩 |
| Q5 | 无 `setTimeout` 之外的高阶 API 依赖（如 `AbortController`） | 无 |

### R 组 · 定时器与句柄（3 项）【本轮新加 singleTimer，必测】
| ID | 检查项 | 判定 |
|---|---|---|
| R1 | 正常路径结束后无残留定时器 | 句柄数回落 |
| R2 | 超时路径（新加 `singleTimer`）被 `finally` 清理 | 无残留 |
| R3 | 连续 200 次请求后句柄数不增长 | 不泄漏 |

### S 组 · 参数与导出契约（6 项）
| ID | 检查项 | 判定 |
|---|---|---|
| S1 | 非法 `type`（`""`/`"abc"`/`"192k"`）不崩、有兜底 | 有码 |
| S2 | 缺 `musicInfo` / 缺 `name` / 缺 `songmid` 不崩 | 有码 |
| S3 | `duration` 为 0 / 负数 / 1e9 不误判为片段 | 不误杀 |
| S4 | 未知 platform 返回 PARAM_ERROR | 明确 |
| S5 | `module.exports` 19 项全部存在且类型正确 | 齐全 |
| S6 | `subSourceName`/`subSource` 字段在试听版场景正确拼接 | 一致 |

### T 组 · 日志脱敏（3 项）
| ID | 检查项 | 判定 |
|---|---|---|
| T1 | 签名直链（含 `sign`/`token`/`expire` 参数）不入日志 | 不泄露 |
| T2 | `ikunApiKey` / `lingchuanApiKey` 不入日志 | 不泄露 |
| T3 | 错误 message 不含完整上游响应体（防超大日志） | 截断 |

---

## 2. 压测重做（10 组，全部重跑，不看历史结果）

| 组 | 场景 | 规模 | 断言 |
|---|---|---|---|
| S1 | 混合 action 并发（musicUrl + lyric + health） | 120 并发 | 全部有结果、0 未捕获拒绝 |
| S2 | 纯 musicUrl 高并发 | 200 并发 | 成功率 ≥ 95%、外呼不放大 |
| S3 | **单链预算专项**（本轮新修） | 慢源 8s × 3 档 | 总耗时 ≤ 15s |
| S4 | 限速窗口打满 | 单源 60 次/窗口 | 超限被拒、窗口后恢复 |
| S5 | 熔断雪崩 | 连续 20 次失败 | 第 N 次起外呼=0，冷却后恢复 |
| S6 | 缓存容量打满 | 500 首（超容量） | 淘汰生效、内存有界 |
| S7 | 长跑混合 | 3000 次（musicUrl+lyric 交替） | 耗时线性、堆增长 < 5MB、句柄不增长 |
| S8 | 极端参数轰炸 | 歌名 5000 字 / duration 0·负·1e9 / 空 info | 不崩、有码 |
| S9 | 全开关关 vs 全开对照组 | 同一批 50 首 × 2 组 | 行为差异可解释、且关掉后能复现旧行为 |
| S10 | 定时器泄漏专项 | 200 次含超时请求 | `getActiveResourcesInfo` 无残留 Timer |

---

## 3. 执行顺序

1. 写审计脚本 `test/audit/e-extra.js`（J~T 五十一项）
2. 重写 `test/stress-test.js`（10 组，替代原 8 组 32 断言）
3. 跑 e-extra → 修真缺陷 → 复跑
4. 跑新压测 → 修真缺陷 → 复跑
5. 全门禁回归（check / 冒烟 67 / 压测 / candidate / probe 自检 / self-check / docs-audit）
6. 文档连锁（AUDIT_PLAN 追加本节结果、DEV_GUIDE 行段如再改动则重测、README/ROADMAP 记新缺陷）

## 4. 验收标准

- J~T 51 项全部有实测证据（`test/audit/e-extra.js` 退出码 0）
- 压测 10 组全部通过，且给出规模/耗时/内存/句柄真实数字
- 新发现缺陷：能修则修 + 回归；不能修则写明阻塞原因与影响面
- 全门禁最终态真实退出码全 0
- **不推送**，等用户指令
