# 源生命周期治理（v8.13.0）

> 目标：把“加源/砍源”从临时决定变成可复核流程。预算固定 **12 登记 = 10 上链 + 2 观察**；一进一出，不允许预算无声膨胀。

## 1. 预算与名额

| 项 | 数量 | 规则 |
|---|---:|---|
| 登记源 | 12 | `SOURCE_HANDLERS` / `SOURCE_TOGGLES` 必须等量 |
| 上链源 | 10 | 必须有 `lifecycle=active` + `chain` 位次 |
| 观察源 | 2 | 默认关闭、无链位次、必须 `reviewAt` |
| 同上游族 | 1 | 同 `upstreamGroup` 只允许一条在册 |

- 增加 active 源必须先空出一个 active 名额，或把一条现有 active 降为 probation。
- 观察源不占上链名额，但占登记名额；到期未转正必须退出，不能无限续期。
- 卡密/付费源（`auth=card|paid`）只能先做 probation；转 active 需要连续 7 天探测通过 + 免费可用兜底。

## 2. 增源七步准入

1. **立项**：写明目标平台缺口、期望音质、是否同族重复；对应 `KNOWN_COVERAGE_GAPS` 中要解决的平台。
2. **端点直探**：DNS、HTTP 状态、响应体、鉴权方式；记录命令、时间、原始返回摘要。
3. **真实取链**：用 `node scripts/source-audit.js --only=<平台> --json` 至少 3 首不同歌曲，验 Range 206/音频魔数/时长。
4. **契约登记**：先写 `PROVIDER_CONTRACT` 字段（id、platforms、chain、upstreamGroup、auth、maxQuality、lifecycle），再改代码。
5. **测试先行**：新增 `y-provider-contract` / `source-inventory` 断言 + 该源正/负向用例；失败必须先红。
6. **观察期**：新源默认进入 probation，至少 7 天；默认关闭、持续探测、不进链。
7. **转正裁决**：观察期探测成功率 ≥ 80%、无 403/429 连续失败、无同族重复，且腾出 active 名额，才可转 active 并更新登记表。

### 探测与转正口径

- probation 源即使默认关闭也必须进入探测清单（`buildProbeConfig()` 可见）。
- probation 探测通过只记录“观察源已恢复”，**不得自动打开 `runtimeToggles`**、不得进链。
- 转正后 `reviewAt` 清空；转正操作必须同时更新 `SOURCE_REGISTRY.md` 与 `CHANGELOG.md`。

## 3. 减源五条退出线

任一条命中即可发起退役评审；两条以上命中直接退役。

1. **真死**：域名 NXDOMAIN、接口恒抛、连续 7 天探测 0 成功。
2. **基础设施死**：上游 403 维护中、Cloudflare challenge、固定 502、平台级 429 长期不恢复。
3. **同质冗余**：与在册源同 `upstreamGroup` 或实测返回同一 CDN/同一签名链，且无独立覆盖价值。
4. **卡密/付费不可用**：无免费额度、卡密失效、付费成本高于收益。
5. **维护不可持续**：上游无公开文档、频繁改签名、连续 30 天无稳定窗口。

### 退役动作（一次做完）

1. 从 `SOURCE_HANDLERS` / `SOURCE_TOGGLES` / `buildProbeConfig()` 删除。
2. 从 `scripts/endpoint-registry.js` 删除端点，加入 `EXCLUDE_DOMAINS`（如仍扫描）。
3. 删除或改写引用该源的测试；`source-inventory --check` 必须通过。
4. 在 `docs/SOURCE_RETIREMENT.md` 记录证据、日期、裁决人。
5. 更新 `SOURCE_REGISTRY.md`、`ARCHITECTURE.md`、`DEV_GUIDE.md`、`CHANGELOG.md`。

## 4. 一进一出

- 任何新增 active 必须绑定一次退役或降级；提交说明必须写“进：X / 出：Y”。
- 只加观察源不触发一进一出，但登记总数仍不得超过 12。
- 紧急故障可先 `manualOff`/运行时关闭，不得直接改预算；正式退役仍走五条退出线。

## 5. 复核节奏

| 对象 | 周期 | 动作 |
|---|---|---|
| probation 源 | 到期日 | 转正 / 退役 / 最多一次 14 天续期（需记录理由） |
| 单源平台（mg/kg） | 每周 | 寻找第二源；无候选则保留 high 风险登记 |
| 限流型基础设施源（juheTx） | 7 天 | 连续失败则降为 probation 或退役 |
| 全量源 | 每月 | 跑 `source-audit` + `probe --quick`，更新健康日报 |

## 6. 机器闸门

```bash
node scripts/source-inventory.js --check   # 12/10/2、同族唯一、probation 规则
node test/audit/y-provider-contract.js     # 契约 15 条
node test/audit/s-source-lifecycle.js      # 生命周期 14 条
node test/lx-source-smoke-test.js          # 端到端冒烟
```

契约非法时 `lx-source.js` 加载即抛 `CONTRACT_ERROR`，不允许带病启动。
