# 源退役记录（v8.13.0）

> 每个退役源必须留下“为什么死 / 怎么验的 / 什么时候能回”。没有证据的“感觉不行”不能砍源。

## 1. 本轮裁决总览

- 裁决日期：2026-11-12
- 口径：20 源 → 12 登记（10 上链 + 2 观察）
- 退役 8 个：`xinghaiBackup` `lingchuan` `gdWy` `juheKw` `juheWy` `juheKg` `juheMg` `nianxinVip`
- 保留观察 2 个：`suyinQQ`（tx）、`suyinMigu`（mg）

## 2. 退役明细

| id | 退出线 | 真实证据 | 结论 |
|---|---|---|---|
| `xinghaiBackup` | 1 真死 | 函数恒抛，0ms 失败；20 源逐源审计中三个平台均 0 成功 | 删除 |
| `lingchuan` | 1 真死 | `api.lingchuan.com` NXDOMAIN；kw/wy/tx/mg/kg 全平台 `ENOTFOUND` | 删除（同时移除 `lingchuanApiKey` 配置项） |
| `gdWy` | 2 基础设施死 / 4 配额不可用 | `br=999` 返回 HTTP 503 + Cloudflare challenge HTML；`minQuality` 使其不进 128k 链 | 删除 |
| `juheKw` | 2 基础设施死 | 直探 `RATE_LIMIT` 1551ms；Juhe 族整体 429 `error code: 1027` | 删除；只保留 `juheTx` |
| `juheWy` | 2 基础设施死 | 直探 `RATE_LIMIT` 608ms；同上 | 删除 |
| `juheKg` | 2 基础设施死 | 直探 `RATE_LIMIT` 1673ms；同上 | 删除 |
| `juheMg` | 2 基础设施死 | 直探 `RATE_LIMIT` 4505ms；同上 | 删除 |
| `nianxinVip` | 3 同质冗余 | kw 128k 端点 **真实可用**：206 audio/mpeg，505ms，302→`car-er.kuwo.cn`；与 `changqingVip`（286ms）同质 | 主动退役，不是死源 |

### 关键纠正

- `changqingVip` 与 `nianxinVip` 都曾被认为是“死源”；端点直探证明两者当前都可用。`nianxinVip` 被砍是因为**同质冗余**，不是不可用。
- `suyinQQ`、`suyinMigu` 当前分别返回 403 / 502，但仍保留观察名额：它们是 `tx`/`mg` 唯一可快速补位的候选，且不需要卡密。
- `juheTx` 属平台级限流源，保留但设 7 天复核；连续失败即降 probation 或退役。

## 3. 退役动作清单（已执行）

1. `SOURCE_HANDLERS` / `SOURCE_TOGGLES` / `buildProbeConfig()` 删除 8 源。
2. `scripts/endpoint-registry.js` 删除 8 源端点；`music-api.gdstudio.xyz` 加入 `EXCLUDE_DOMAINS`。
3. `test/audit/h-toggles.js` 删除 `xinghaiBackup` 例，新增 probation 断言。
4. `test/lx-source-smoke-test.js` 退役源断言为“不在册 / 不在探测 / 不在快照”。
5. 登记表、生命周期、架构、开发指南、CHANGELOG 同步。

## 4. 退出线（复用于未来）

1. **真死**：NXDOMAIN、恒抛、连续 7 天 0 成功。
2. **基础设施死**：403 维护、Cloudflare challenge、固定 502、长期 429。
3. **同质冗余**：同上游族/同 CDN/同签名链，无独立覆盖。
4. **卡密/付费不可用**：无免费额度、卡密失效、成本高于收益。
5. **维护不可持续**：无文档、频繁改签名、连续 30 天无稳定窗口。

## 4.1 一进一出

- 新增一条 active 源，必须同时退役或降级一条现有 active；提交说明写“进：X / 出：Y”。
- 观察源不占上链名额，但登记总数不得超过 12。
- 紧急故障先 `manualOff`，不得直接改预算。

## 5. 回归窗口

| 源 | 可回归条件 | 回归方式 |
|---|---|---|
| `nianxinVip` | `changqingVip` 失效且 nianxin 恢复独立可用 | 先 probation，观察 7 天 |
| `suyinQQ` | 403 解除 | 观察期转正评审 |
| `suyinMigu` | 上游 502 解除 | 观察期转正评审 |
| Juhe 族（kw/wy/kg/mg） | 429 基础设施恢复且 `juheTx` 稳定 | 一次只回一个平台，先 probation |

## 6. 禁止事项

- 不得因为“旧代码里有”就保留死源。
- 不得因为“看起来可能有用”就突破 12 源预算。
- 不得把可用但同质的源说成死源；退役理由必须写真实退出线。
- 不得在未记录证据的情况下删除源或移动历史 tag。
