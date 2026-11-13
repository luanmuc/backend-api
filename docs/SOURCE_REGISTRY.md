# 源登记表（v8.13.0）

> 单一真相：运行时 `PROVIDER_CONTRACT` / `SOURCE_HANDLERS`。本表由 `scripts/source-inventory.js` 校验；任何增删源先改契约，再同步本表。

## 预算

| 项 | 预算 | 当前 |
|---|---:|---:|
| 登记源 | 12 | 12 |
| 上链源（active） | 10 | 10 |
| 观察源（probation） | 2 | 2 |

- 上链源 = 参与 `buildSourceChain()` 竞速、计入健康分/熔断/探测托管。
- 观察源 = 默认关闭、不进链、持续探测；只在复核日期前保留名额，到期必须裁决。
- 同族只保留一条；同族第二条只能作为观察源，且不得与在册源同 `upstreamGroup`。

## 12 个登记源

| # | id | 名称 | 生命周期 | 平台 | 链位次 | 上游族 | 鉴权 | maxQuality | 备注 |
|---:|---|---|---|---|---|---|---|---|---|
| 1 | `suyinKuwo` | 溯音酷我 | active | kw/wy/tx/mg/kg | kw1, wy6, tx1, mg1, kg1 | oiapi-kuwo | none | flac | 五平台入口但只搜酷我；非 kw 交付回填 `sourcePlatform=kw`；128k 用 br=9 |
| 2 | `wyOuter` | 网易云官方 | active | wy | wy4 | wy-official | none | 128k | 官方 outer 直连 |
| 3 | `kuwoOfficial` | 酷我官方直连 | active | kw | kw5 | kuwo-official | none | 128k | 官方接口 |
| 4 | `suyin163` | 溯音163 | active | wy | wy3 | oiapi-163 | none | 128k | 网易云 128k |
| 5 | `xinghaiBackend` | 星海后端 | active | kw | kw2 | xinghai-backend | none | flac | kw 高音质主力 |
| 6 | `helloworldKw` | helloworld(kw) | active | kw | kw4 | kuwo-convert | none | flac | 可能只给片段，靠验真闸门 |
| 7 | `changqingVip` | 长青kw | active | kw | kw6 | changqing-kw | none | 128k | 与已砍 `nianxinVip` 同质 |
| 8 | `huibq` | Huibq | active | kw/wy | kw8, wy8 | huibq | none | 320k | 唯一 `coldStart`，timeout 8s |
| 9 | `juheTx` | Juhe聚合(tx) | active | tx | tx2 | juhe | none | flac | 7 天复核 `2026-11-19` |
| 10 | `ikun` | ikun | active | kw/wy | kw7, wy5 | ikun | optional | flac | 公益版免卡密，卡密可选 |
| 11 | `suyinQQ` | 溯音QQ | probation | tx | 无 | oiapi-qq | none | flac | 2026-11-11 实测 403；复核 `2026-11-19` |
| 12 | `suyinMigu` | 溯音咪咕 | probation | mg | 无 | xcvts-migu | none | flac | 2026-11-11 实测上游 502；复核 `2026-11-26` |

## 平台链

| 平台 | 链（128k） | 源数 |
|---|---|---:|
| kw | suyinKuwo → xinghaiBackend → helloworldKw → kuwoOfficial → changqingVip → ikun → huibq | 7 |
| wy | suyin163 → wyOuter → ikun → suyinKuwo → huibq | 5 |
| tx | suyinKuwo → juheTx | 2 |
| mg | suyinKuwo | 1 |
| kg | suyinKuwo | 1 |

## 显式覆盖缺口（`KNOWN_COVERAGE_GAPS`）

| 平台 | 风险 | 原因 | 复核 |
|---|---|---|---|
| mg | high | 仅 `suyinKuwo` 单源；`suyinMigu` 观察中不进链 | 2026-11-26 |
| kg | high | 仅 `suyinKuwo` 单源，无第二源 | 2026-11-19 |
| tx | medium | `suyinKuwo` + `juheTx` 双源；`juheTx` 受基础设施限流 | 2026-11-19 |

## 默认开关

| 状态 | 源 |
|---|---|
| 默认开启（10） | `suyinKuwo` `wyOuter` `kuwoOfficial` `suyin163` `xinghaiBackend` `helloworldKw` `changqingVip` `huibq` `juheTx` `ikun` |
| 默认关闭（2，观察） | `suyinQQ` `suyinMigu` |

## 退役源（不在册、不探测）

`xinghaiBackup` `lingchuan` `gdWy` `juheKw` `juheWy` `juheKg` `juheMg` `nianxinVip`

> `nianxinVip` 是“能通但同质”的主动退役，不是死源；证据与退出路径见 `SOURCE_RETIREMENT.md`。
