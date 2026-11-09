# 第四轮压力测试计划（V 组：只压「判据」，不压「流程」）

> **落地脚本**：`test/stress-round4.js`（**68 条**，实测通过）
> **基线**：v8.11.2（未发版），本轮结束时 commit 见 `git log`
> **与** [`round4.md`](./round4.md) **的区别**：那份是「第四轮**元审计** M~O」（审审计本身）；
> 本文件是第四轮**压力测试**（V 组）。两者同轮次、不同维度，此前 V 组计划只在会话工作目录
> `.trae/documents/` 里（换会话即丢），现并入仓库。

---

## §0 为什么压「判据」而不只是压「流程」

前三轮压测（`stress-test` 12 条、`stress-round3` 14 条）主要压**流程**：能不能取到链、会不会崩、并发会不会炸。
但真正决定「用户听到什么」的是**判据**——什么算交付成功、什么算失败、什么算片段、什么该被拒。

判据错的时候，流程全绿也照样给错结果。所以 V 组只打判据。

## §1 五条不变量（全组共同底座）

| ID | 不变量 | 违反后果 |
|---|---|---|
| I1 | 交付 URL 必为 http(s) 且非空 | 用户拿到死链 |
| I2 | 失败必为 12 个 `ERROR_CODES` 之一 | 上层无法分类重试 |
| I3 | 绝不 `ok:true` 但 `url` 空 | 静默失败，最难查 |
| I4 | 健康分 ∈ [0,100] | 调度被误伤或永久跳过 |
| I5 | 同歌同档并发合并成 1 次外呼 | 打爆第三方接口 / 触发限流 |

## §2 组划分（V1~V21）

| 组 | 靶子 | 要点 |
|---|---|---|
| V1~V10 | 故障谱系 / 错误码归一 / 缓存 LRU / 熔断 / 限速 | 150 组故障注入零假成功 |
| V11~V12 | `MISMATCH` 与验真时长阈值 | 错配必须拒、阈值边界双侧 |
| V13 | ikun `200 + {"code":403}` | 不是 HTTP 403（曾误判） |
| V14~V16 | 并发 / 预算 / 竞速 | 220 并发无违约 |
| V17 | 音质短路到期放行 | 4 条，见 §3.1 |
| V18 | 冷启动预热 | 4 条，含计数锚定 |
| V19 | `coldStartProbeTimeoutMs` | 2 条，见 §3.2 |
| V20 | 脏缓存音质标签（T33） | 2 条，见 §3.3 |
| V21 | 兜底档丢 singer（D-31） | 3 条，见 §3.4 |

## §3 四条「压测自身翻过车」的组

### §3.1 V17：一次失败的自证

V17 最初用 `statusCode: 500` 造故障 → **短路从未达标**。真因：500 归 `recordBusinessFail`，
而短路只统计 `fail + linkExpired`。改用 `{error:'ECONNRESET'}` 才进统计。
端到端仍拿不到「放行后确有一次外呼」（被播放摘除 / 冷却 / 失败缓存三层叠加挡住），
故按授权加 `__debug` 只读钩子，落到**判据层**断言。

V17a 达标短路 / V17b 强制到期放行 / V17c 放行后立刻重新短路 / V17d `fail=2<3` 不短路。
双向反向验证：变异 A（到期 `return false`→`true`）→ V17b 红；变异 B（首次 `true`→`false`）→ V17a 红。

### §3.2 V19：绝对阈值不可靠

初版 `tSlow > 500` 在「把 `probeTimeout` 写死成 `HEALTH_CHECK_TIMEOUT`」的变异下仍绿（1000ms 也 >500）。
改为相对比较 `tSlow > tFast*3 && tSlow > 600` 后，该变异使两值趋同 → V19a/V19b 双双翻红。

### §3.3 V20：脏缓存不再把 128k 标成 FLAC

D-20 之前写槽用**请求档**，请求 flac 实给 128k 时会留下脏槽。命中路径已调 `verifyDelivery`
（`v.quality` 就是真音质）却只用来判 `ok===false`。修法：命中返回时用验真结果回填 `type`。

**M14 拦下过一次设计违反**：第一版在命中路径加 `setCachedUrl` 一起改槽位 → `g-meta`
报「缓存写入只有唯一入口，写点 2 处」。改为只回填标签、槽位留给下次正常写入修正。

### §3.4 V21：兜底档丢 singer 的实证（D-31）

`buildSearchKeywords` 三级，末级 `strict:false` 只传 `{name, duration}`，
`songInfoMatch` 的歌手校验（`if (songInfo?.singer && singer && ...)`）**整条被跳过**。

| 断言 | 场景 | 结果 |
|---|---|---|
| V21a | 严格档（带歌手）遇错歌手 | 抛 `SONG_MISMATCH`，拒绝 |
| V21b | 兜底档遇**同一条**错歌手 | 放行并交付（会播错歌） |
| V21c | 兜底档放行必须落日志 | 实测 stdout 捕获到 1 条 |

V21c 观测踩了三轮：patch `console.log` 抓不到（`safeConsole.log` 是**加载期** `console.log.bind(console)`）
→ 降级源码断言（不证明输出）→ 改捕 `process.stdout.write` 才真验证。**反向验证**：注掉日志分支 → V21c 红。

## §4 变异看护（`test/mutation/run.js`）

| 变异体 | 靶子 | 门禁 |
|---|---|---|
| MU13 | 注掉歌手校验 | `stress-round4` |
| MU14 | 关闭冷启动预热入口 | `stress-round4` |
| MU15 | 音质短路到期不放行 | `stress-round4` |
| MU16 | 冷启动探针超时写死 | `stress-round4` |

全量复跑：**16 killed / 0 survived，100%**。

## §5 跑法

```bash
node --expose-gc test/stress-round4.js          # 约 60~70 秒
node test/mutation/run.js --only=MU15,MU16 --strict
```

**纪律**：压测与变异**不可同跑**（CPU 抢占会让计时类断言假红）。
