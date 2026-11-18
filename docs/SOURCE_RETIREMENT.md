# 源退役记录（v8.13.0）

> 每个退役源必须留下“为什么死 / 怎么验的 / 什么时候能回”。没有证据的“感觉不行”不能砍源。

## 1. 本轮裁决总览

- 裁决日期：2026-11-12
- 口径：20 源 → 12 登记（10 上链 + 2 观察）；**后续 v8.16.0 新增 `qingliangTx`，登记源升为 13 / 11 上链 / 2 观察**（本文件其余数字保留 v8.13.0 当时快照）
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

## 5.5 候选接入裁决（v8.16.0，2026-11-15）

生态扫描落盘 4 个候选，逐个判「接 / 不接」：

| 候选 | 裁决 | 证据 | 结论 |
|---|---|---|---|
| `qingliang`（晴亮） | 🟢 **只接 tx 一条** | `POST music.lzmhhh.com/api/music/url`（`type=qq` + Referer）→ 5 首矩阵全 `206 + audio/mpeg`，折 ≈320k，`ID3\x03` 头合法；裸请求同样 206 | 已接入为 `qingliangTx`（tx chain 2、320k、`reviewAt 2026-11-18`） |
| `xinglan`（星岚） | 🟡 不整包接入 | 主线路 `api.vkeys.cn/v2/music/tencent/geturl` 返回 `quality:"音乐试听"`、`RS0` 前缀，960,887 bytes vs 全曲 10,792,943（差 11.2 倍）；v3 降级 `code:110000/500011` 不可用；整包 74KB + `_u()` 混淆 + 写死卡密 `6C1F-53W0-GRKI-EVFG` | 只借鉴 `freeTrialInfo` / `RS0` 片段检测思路，不接源 |
| `feichangdao`（非常道） | ❌ 同源重复 | 端点全落在我方已有 `oiapi.net` / `api.xcvts.cn` / `music-api.gdstudio.xyz`（已在 `EXCLUDE_DOMAINS`）/ haitangw·changqing 模板 / 汽水（`api-vehicle.volcengine.com` + `api.qishui.com`） | 不接入，留档本表 |
| `suyin`（溯音） | ❌ 同源重复 | 只有 `oiapi.net` + `api.xcvts.cn` 两个上游，且 key 与溯音系同一个（`oiapi-ef6133b7-…`） | 不接入，留档本表 |

判据：**接进来必须能给出「我方尚未覆盖的上游」**；同一上游多接一份，只是同一失败率多一份分母，还会抢走竞速窗口。

## 5.6 判否候选复核（2026-11-16）

`candidate-status.md` 由 `scripts/recheck-candidates.js` 每日探测，命中「已恢复」即提示启动重评。本轮 hyw 被报 🟢，复核结论**维持判否**，并修正了探测判据本身。

| 候选 | 复核证据（2026-11-16 实测） | 裁决 |
|---|---|---|
| `hyw`（HYWmusic v1.2.0） | 首页 `https://103.79.184.97/` HTTP 200，页面含「卡密总数 / 登录控制台」；业务 `GET /api/music/url?platform=tx&songmid=0039MnYb0qxYhV&quality=320k` → **HTTP 401**，`{"code":401,"message":"需要卡密才能访问…","received":{…,"hasKey":false,"cardKeyRequired":true}}` | ❌ **维持判否（付费门）** |
| `huanyin`（幻音 v3） | DNS `music-dl.sayqz.com` 仍 `ENOTFOUND`；`api.xcvts.cn` 咪咕 HTTP 200 / 业务码 400（参数疑变），且该上游已由 `suyinMigu` 覆盖 | 🟡 维持观察，无新增量 |

**判据修正（探测工具自身缺陷）**：旧逻辑「首页 HTTP ≠ 502 → `recovered`」把付费门误报成恢复，会让触发式待办被反复空转。现改为：

- hyw 增加业务接口探测项 `type:'biz'`（不带 key 直取 `/api/music/url`）；
- `candidateState()` 优先级：`paid`（401/403 且自述需卡密）> `recovered`（DNS 通 / 业务 code 0·200）> `review`（业务 400 或仅首页活着）> `dead`；
- 新增状态 `paid` → 输出「⚪ 付费门-维持判否」，不再提示重评；
- 脚本内建自检 `RC1~RC4`（`node scripts/recheck-candidates.js` 先跑自检，失败 rc=1），其中 RC2 守的正是今天的误报形状：**仅首页 200、无业务证据必须判 `review`**。

## 6. 禁止事项

- 不得因为“旧代码里有”就保留死源。
- 不得因为“看起来可能有用”就突破 12 源预算。
- 不得把可用但同质的源说成死源；退役理由必须写真实退出线。
- 不得在未记录证据的情况下删除源或移动历史 tag。

## 7. 实现现状补充（2026-11-19）

退役动作的**契约侧**已全部完成：`SOURCE_HANDLERS`（13 键）、`SOURCE_TOGGLES`（13 键）、`buildProbeConfig` 中均无 8 个退役源。

但 `src/core/10-vendors.js` 仍保留 `gdWy` / `xinghaiBackup` / `lingchuan` 三个取链函数与
`GD_API` / `LINGCHUAN_API` / `PLATFORM_TO_XINGHAI_BACKUP` 常量；`lingchuanApiKey` 仍在
`USER_CONFIG` 与 config 白名单脱敏路径中。

**判定为不改（B 档）**：三个 helper 全仓零运行时引用，属不可达死代码，不影响运行；
删除会改变产物导出面并触发 `verify-bundle` 的导出契约复核，收益（少量体积）与风险（契约变更）不成比例。
若将来重做产物契约，可一并清理。
