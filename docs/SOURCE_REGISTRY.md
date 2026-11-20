# 源登记表（v8.16.0）

> 单一真相：运行时 `PROVIDER_CONTRACT` / `SOURCE_HANDLERS`。本表由 `scripts/source-inventory.js` 校验；任何增删源先改契约，再同步本表。

## 预算

| 项 | 预算 | 当前 |
|---|---:|---:|
| 登记源 | 13 | 13 |
| 上链源（active） | 11 | 11 |
| 观察源（probation） | 2 | 2 |

- 上链源 = 参与 `buildSourceChain()` 竞速、计入健康分/熔断/探测托管。
- 观察源 = 默认关闭、不进链、持续探测；只在复核日期前保留名额，到期必须裁决。
- 同族只保留一条；同族第二条只能作为观察源，且不得与在册源同 `upstreamGroup`。

## 13 个登记源

| # | id | 名称 | 生命周期 | 平台 | 链位次 | 上游族 | 鉴权 | maxQuality | 备注 |
|---:|---|---|---|---|---|---|---|---|---|
| 1 | `suyinKuwo` | 溯音酷我 | active | kw/wy/tx/mg/kg | kw1, wy6, tx1, mg1, kg1 | oiapi-kuwo | none | flac | 五平台入口但只搜酷我；非 kw 交付回填 `sourcePlatform=kw`；128k 用 br=9 |
| 2 | `wyOuter` | 网易云官方 | active | wy | wy4 | wy-official | none | 128k | 官方 outer 直连 |
| 3 | `kuwoOfficial` | 酷我官方直连 | active | kw | kw5 | kuwo-official | none | 128k | 官方接口 |
| 4 | `suyin163` | 溯音163 | active | wy | wy3 | oiapi-163 | none | 128k | 网易云 128k；**2026-11-20 修 `data.items` 兼容**（上游返回从 `data[]` 变 `data.items[]`，旧取值恒 `NOT_FOUND`，v9.1.3 已兼容三形态，本地实测 206 audio/mpeg） |
| 5 | `xinghaiBackend` | 星海后端 | active | kw | kw2 | xinghai-backend | none | flac | kw 高音质主力；**2026-11-20 实测服务端完全正常**（`?source=kw&songmid=228908` → `code:200` + url，追 302 到酷我 CDN → **206 audio/mpeg** 真音频；连打 5 次全 200/0.35s；DNS 阿里+腾讯 DoH 均正常；证书 Let's Encrypt 有效至 2027-02-10）。`auth.trusted:false` 照样放行（notice 只要求标注来源）。真机 `NETWORK_ERROR` 287ms 疑似运营商对 SNI 的阻断（`07-net.js:130` 把任何 4xx 都归 `NETWORK_ERROR`），待手机侧验证 |
| 6 | `helloworldKw` | helloworld(kw) | active | kw | kw4 | kuwo-convert | none | flac | 可能只给片段，靠验真闸门 |
| 7 | `changqingVip` | 长青kw | active | kw | kw6 | changqing-kw | none | 128k | 与已砍 `nianxinVip` 同质 |
| 8 | `huibq` | Huibq | active | kw/wy | kw8, wy8 | huibq | none | 320k | 唯一 `coldStart`；取链超时由 `resolveColdStartTimeout(coldStartTimeoutMs, raceBudgetMs)` 决定，无独立 provider timeout。**2026-11-20 实测：服务已死**——`HTTP 503 + 「This service has been suspended by its owner.」`，根路径同 503，0.8s 即返回；probe-history 显示 **11-16 起连续 5 天全 503**（此前 11-04~11-15 连续 12 天全 200） |
| 9 | `juheTx` | Juhe聚合(tx) | active | tx | tx3 | juhe | none | flac | 7 天复核 `2026-11-19`；本轮 0% 成功率，降为 tx 第三源 |
| 10 | `qingliangTx` | 晴亮(tx) | active | tx | tx2 | qingliang-tx | none | 320k | 2026-11-15 实测 5/5 全曲 320k（206 + audio/mpeg）；第三方单点，3 天复核 `2026-11-18` |
| 11 | `ikun` | ikun | active | kw/wy | kw7, wy5 | ikun | optional | flac | 公益版免卡密，卡密可选 |
| 12 | `suyinQQ` | 溯音QQ | probation | tx | 无 | oiapi-qq | none | flac | 2026-11-11 实测 403；复核 `2026-11-19` |
| 13 | `suyinMigu` | 溯音咪咕 | probation | mg | 无 | xcvts-migu | none | flac | 2026-11-11 实测上游 502；复核 `2026-11-26` |

## 平台链

| 平台 | 链（128k） | 源数 |
|---|---|---:|
| kw | suyinKuwo → xinghaiBackend → helloworldKw → kuwoOfficial → changqingVip → ikun → huibq | 7 |
| wy | suyin163 → wyOuter → ikun → suyinKuwo → huibq | 5 |
| tx | suyinKuwo → qingliangTx → juheTx | 3 |
| mg | suyinKuwo | 1 |
| kg | suyinKuwo | 1 |

## 显式覆盖缺口（`KNOWN_COVERAGE_GAPS`）

| 平台 | 风险 | 原因 | 复核 |
|---|---|---|---|
| mg | high | 仅 `suyinKuwo` 单源；`suyinMigu` 观察中不进链 | 2026-11-26 |
| kg | high | 仅 `suyinKuwo` 单源，无第二源 | 2026-11-19 |
| tx | medium | `suyinKuwo` + `qingliangTx` + `juheTx` 三源；`qingliangTx` 第三方单点、`juheTx` 受基础设施限流 | 2026-11-18 |

## 默认开关

| 状态 | 源 |
|---|---|
| 默认开启（10） | `suyinKuwo` `wyOuter` `kuwoOfficial` `suyin163` `xinghaiBackend` `helloworldKw` `changqingVip` `juheTx` `qingliangTx` `ikun` |
| 默认关闭（3） | `suyinQQ` `suyinMigu`（观察）；`huibq`（**2026-11-20 关闭**：11-16 起上游 owner 暂停服务） |

## 退役源（不在册、不探测）

`xinghaiBackup` `lingchuan` `gdWy` `juheKw` `juheWy` `juheKg` `juheMg` `nianxinVip`

> `nianxinVip` 是“能通但同质”的主动退役，不是死源；证据与退出路径见 `SOURCE_RETIREMENT.md`。

## 域名与拦截器协同（HostKeeper）

本仓所有源用到的域名，必须同步登记在 HostKeeper 的内置放行清单 `allow-default.list`（仓库 `luanmuc/hostkeeper`，`v1.1.1` 起随包分发）。HostKeeper 按后缀通配匹配，因此新增源时按“域名族”登记，而不是逐个域名登记。

当前登记的 17 条，对应 `src/providers/*` 与 `src/legacy.js` 中的全部外部端点：

| 类别 | 规则 |
|---|---|
| 平台主站与 API | `*.163.com` `*.qq.com` `*.kuwo.cn` `*.kugou.com` `*.migu.cn` |
| 播放 CDN | `*.126.net` |
| 第三方聚合 / 中转 | `*.oiapi.net` `*.lzmhhh.com` `*.zddyr.top` `*.haitangw.cc` `*.haitangw.net` `*.gdstudio.xyz` `*.onrender.com` `*.xcvts.cn` `*.dpdns.org` `*.lingchuan.com` `*.wwwweb.top` |

维护要求：

- **新增源**：先把域名补进 `allow-default.list`，再重跑 HostKeeper 的 `check.sh`（断言规则数 ≥ 17）。
- **退役源**：规则可保留（代价极低），避免上游复活时还要回滚两边。
- **通配边界**：`*.kuwo.cn` 只覆盖子域，不会放行 `notkuwo.cn` —— 逐级剥离前缀匹配，同名子串不误伤。
- **不要指望它修网络故障**：放行清单只防“被拦截列表误杀”，App 侧连接失败、DNS、代理等问题不在其覆盖范围。
