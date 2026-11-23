# 源登记表（v9.3.3）

> 单一真相：运行时 `PROVIDER_CONTRACT` / `SOURCE_HANDLERS`。本表由 `scripts/source-inventory.js` 校验；任何增删源先改契约，再同步本表。

## 预算

| 项 | 预算 | 当前 |
|---|---:|---:|
| 登记源 | 15 | 15 |
| 上链源（active） | 13 | 13 |
| 观察源（probation） | 2 | 2 |

- 上链源 = 参与 `buildSourceChain()` 竞速、计入健康分/熔断/探测托管。
- 观察源 = 默认关闭、不进链、持续探测；只在复核日期前保留名额，到期必须裁决。
- 同族只保留一条；同族第二条只能作为观察源，且不得与在册源同 `upstreamGroup`。

## 15 个登记源

| # | id | 名称 | 生命周期 | 平台 | 链位次 | 上游族 | 鉴权 | maxQuality | 备注 |
|---:|---|---|---|---|---|---|---|---|---|
| 1 | `suyinKuwo` | 溯音酷我 | active | kw/wy/tx/mg/kg | kw1, wy6, tx1, mg1, kg1 | oiapi-kuwo | none | flac | 五平台入口但只搜酷我；非 kw 交付回填 `sourcePlatform=kw`；128k 用 br=9。**R78（2026-11-23 真实复核）：`/api/Kuwo_Music` 返回 `404 code -13001`「接口不存在或已下线」（`okhttp` 各路径变体同 404），五平台入口实际全部失效** |
| 2 | `wyOuter` | 网易云官方 | active | wy | wy4 | wy-official | none | 128k | 官方 outer 直连 |
| 3 | `kuwoOfficial` | 酷我官方直连 | active | kw | kw5 | kuwo-official | none | 128k | 官方接口 |
| 4 | `suyin163` | 溯音163 | active | wy | wy3 | oiapi-163 | none | 128k | 网易云 128k；**2026-11-20 修 `data.items` 兼容**（上游返回从 `data[]` 变 `data.items[]`，旧取值恒 `NOT_FOUND`，v9.1.3 已兼容三形态）。**R78（2026-11-23 真实复核）：`/api/163_Music` 返回 `404 code -13001`「接口不存在或已下线」，wy 链第 1 位失效** |
| 5 | `xinghaiBackend` | 星海后端 | active | kw | kw2 | xinghai-backend | none | flac | kw 高音质主力；**2026-11-20 实测服务端完全正常**（`?source=kw&songmid=228908` → `code:200` + url，追 302 到酷我 CDN → **206 audio/mpeg** 真音频；连打 5 次全 200/0.35s；DNS 阿里+腾讯 DoH 均正常；证书 Let's Encrypt 有效至 2027-02-10）。`auth.trusted:false` 照样放行（notice 只要求标注来源）。真机 `NETWORK_ERROR` 287ms 疑似运营商对 SNI 的阻断（`07-net.js:130` 把任何 4xx 都归 `NETWORK_ERROR`），待手机侧验证 |
| 6 | `helloworldKw` | helloworld(kw) | active | kw | kw4 | kuwo-convert | none | flac | 可能只给片段，靠验真闸门 |
| 7 | `changqingVip` | 长青kw | active | kw | kw6 | changqing-kw | none | 128k | 与已砍 `nianxinVip` 同质 |
| 8 | `huibq` | Huibq | active | kw/wy | kw8, wy8 | huibq | none | 320k | 唯一 `coldStart`；取链超时由 `resolveColdStartTimeout(coldStartTimeoutMs, raceBudgetMs)` 决定，无独立 provider timeout。**2026-11-20 实测：服务已死**——`HTTP 503 + 「This service has been suspended by its owner.」`，根路径同 503，0.8s 即返回；probe-history 显示 **11-16 起连续 5 天全 503**（此前 11-04~11-15 连续 12 天全 200） |
| 9 | `juheTx` | Juhe聚合(tx) | active | tx | tx3 | juhe | none | 320k | 复核 `2026-11-23`，窗口 60 天（R83 `reviewEveryDays`）。**R78：上游全域 HTTP 429**（`/tx`、`/kw`、根路径均 429 + HTML 维护页，CF 层限流），当前 0% 可用。**R79：接入落月后降为 tx 第四源；tx 风险档由 high 降 medium（可用源 2 个）** |
| 10 | `qingliangTx` | 晴亮(tx) | active | tx | tx2 | qingliang-tx | none | 320k | 2026-11-15 实测 5/5 全曲 320k（206 + audio/mpeg）；第三方单点，复核 `2026-11-23`，窗口 60 天（R83）。**R78 复核：`200 code=1` 出 `aqqmusic.tc.qq.com` 直链（768ms），是 tx 链上当前唯一可用源。**R79：落月 tx 接入后转为 tx 第二源，flac 档由落月覆盖（实测 55.39MB 真 fLaC）** |
| 11 | `ikun` | ikun | active | kw/wy | kw7, wy5 | ikun | optional | flac | 公益版免卡密，卡密可选 |
| 12 | `suyinQQ` | 溯音QQ | probation | tx | 无 | oiapi-qq | none | flac | 2026-11-11 实测 403；复核 `2026-11-23`。**R78：`404 code -13001`「接口不存在或已下线」（路由已移除，非 403）** |
| 13 | `suyinMigu` | 溯音咪咕 | probation | mg | 无 | xcvts-migu | none | flac | 2026-11-11 实测上游 502；复核 `2026-11-23`。**R78：`200 code=1` 能出直链（911ms），mg 平台当前唯一可用候选** |
| 14 | `luoyueTx` | 落月(tx) | active | tx | tx3 | vkeys-luoyue | none | flac | R79（2026-11-23 实测）：`api.vkeys.cn/music/tencent/song/link` 128k 4.31MB / 320k 10.79MB / flac 55.39MB（真 `fLaC`），三档均落 QQ 官方 CDN `ws.stream.qqmusic.qq.com`（M500/M800/F000 前缀）。**只接 v3 `song/link`**——同站 `/v2/music/tencent/geturl` 只给 960KB 试听片段。第三方单点，复核 `2026-11-23`，窗口 60 天（R83） |
| 15 | `audius` | Audius | active | au | au1 | audius | none | 320k | R80（2026-11-23 实测）：`api.audius.co/v1`，免 key；`/v1/tracks/{id}` 200 + `is_streamable` 判定（false 的曲 `/stream` 实测 404，如 qRgvP）；`/stream` 302 → `creatornode.audius.co`，跟随得 `206 audio/mpeg` 8.49MB `ID3v2.4`。au 为独立平台维度（无 flac 档），不参与 tx/wy/kw 跨平台兜底；中文歌能搜到但多为翻唱/不可流式 |

## 平台链

| 平台 | 链（128k） | 源数 |
|---|---|---:|
| kw | suyinKuwo → xinghaiBackend → helloworldKw → kuwoOfficial → changqingVip → ikun → huibq | 7 |
| wy | suyin163 → wyOuter → ikun → suyinKuwo → huibq | 5 |
| tx | suyinKuwo → qingliangTx → luoyueTx → juheTx | 4 |
| mg | suyinKuwo | 1（R78 实测该单源已下线 → 零可用） |
| kg | suyinKuwo | 1（R78 实测该单源已下线 → 零可用） |
| au | audius | 1（R80 新平台：Audius 独家，暂无第二源） |

## 显式覆盖缺口（`KNOWN_COVERAGE_GAPS`）

| 平台 | 风险 | 原因 | 复核 |
|---|---|---|---|
| mg | high | `suyinKuwo` 已下线（R78 404 -13001）→ 零上链源。**R79 纠正**：`suyinMigu` 经 11-21 与 R79 两次复测均为 `code 502`（上游 IP 被咪咕限）；`xinghaiBackend` 的 mg 分支对任意 mid 恒定返回同一首（`name` 传「晴天」「演员」URL 完全相同，3.9MB ID3v2.3），不可证身份 → **当前无可用 mg 源** | 2026-11-23（窗口 30 天，到期 12-23） |
| kg | high | `suyinKuwo` 已下线（R78 404 -13001）→ 零上链源，无第二源 | 2026-11-23（窗口 30 天，到期 12-23） |
| tx | medium | 登记四源，**R79 实测可用 2 源**（`qingliangTx` 200 code=1 出 aqqmusic 直链；`luoyueTx` v3 三档真音频）；`juheTx` 全域 429、`suyinKuwo` 已下线 → 单点故障已消除 | 2026-11-23（窗口 60 天，到期 01-22） |

## 候选测评（R79，2026-11-23 全网搜集 + 真机级实测）

> 口径：`curl`/`fetch` 取链后对返回的音频 URL 发 `Range: bytes=0-4095`，看 `http`/`content-type`/`content-range`/`magic`。只认「拿到真音频字节」为可用；只返回 JSON 不算。

| 候选 | 端点 | 实测证据 | 判定 |
|---|---|---|---|
| 星海**新主域** | `https://yy1.zddyr.top/lx/api/`（与在册 `xinghaiBackend` 同族，现役常量指向旧域 `yy.zddyr.top`，见 `src/core/10-vendors.js:21`） | `?source=kw&songmid=228908` → `200` + `kwplay.php` 中转链 → **`http=206 type=audio/x-flac range=bytes 0-4095/55397039` magic=`fLaC`**（53.5MB 真 FLAC）；`?source=wy&songmid=347230` → `m701.music.126.net` 直链 → **206 / 32.5MB / `fLaC`**；`?source=migu&songmid=228908` → `freetyst.nf.migu.cn` 直链 → **206 / 3.9MB / `ID3v2.3` mp3**；`?source=kg` → `200 code 502 KG_SONG_NOT_FOUND`（接口活、hash 无效）；`?source=qq` → `403`「仅对认证用户开放」 | **kw / wy 可用；mg 实测证否**。mg 追加验证（R79 二次探测）：`songmid=228908` 时 `name=晴天` 与 `name=演员` 返回**完全相同**的 URL（3.9MB ID3v2.3），另一 mid 直接 `502` → 该分支按酷我 mid 做固定映射、不读歌名，无法证明交付的是点的那首歌，**不得接入**（见 K39） |
| GD Studio | `https://music-api.gdstudio.xyz/api.php`（与退役 `gdWy` 同族） | `types=search&source=netease` → `200` 真实结果；`types=url&source=netease&id=2652820720&br=320` → `m701.music.126.net` → **206 / 11.16MB / `ID3v2.4`**；`source=tencent`、`source=kuwo` → **`400 {"detail":"Value of source is not supported."}`** | 仅 wy 可用（与在册 wy 链重叠） |
| ChKSz | `https://api.chksz.com`（星海插件二级上游） | `/api/163_music`、`/api/qq_music`（不带 key）→ **`401 {"code":401,"msg":"缺少 apikey 参数"}`** | 需付费 key，**不接** |
| Audius | `https://api.audius.co/v1`（Open Audio Protocol，只读免 key） | `/tracks/trending?limit=1` → `200` 真实 track；`/tracks/V66vyPP/stream?app_name=…` → **206 / `audio/mpeg` / 8.49MB / `ID3v2.4`**，落到 R2 CDN，支持 Range | **可用 → R80 已落地**：国外唯一「免 key + 合规 + 全曲 + Range」源，已作为 `au` 平台接入（见 #15） |
| Jamendo | `https://api.jamendo.com/v3.0/tracks`（CC 授权） | `client_id=709fa152` → **`200 code 11 "Your application has been suspended"`** | 需自注册 client_id，**暂不可用** |
| Internet Archive | `https://archive.org/advancedsearch.php` | `fetch failed`（本机网络层，未通） | **未通**，待换网络复测 |
| `pdone/lx-music-source` | GitHub ★11,155，v6（commit `f97ffd0`，2026-09-11） | 未逐条探测；第三方评审称无 release、8 个适配器无测试覆盖 | **待评** |
| `web-music-api` | npm 1.0.0 / AGPL-3.0，浏览器端 SDK，自带 weapi/eapi/千千 MD5 签名，覆盖 netease/qq/kuwo/migu/**千千**/**5sing** | 未探测（需在 RN 内注入 `fetch` 才可跑） | **待评**（千千 / 5sing 是当前完全没有的平台） |

| **落月 vkeys** | `https://api.vkeys.cn`（xinglan 插件 v4.0.2 的 QQ 主线路） | `v2/music/tencent/geturl?mid=0039MnYb0qxYhV&quality=8` → `200`「请求成功」，但返回音频仅 **960887 bytes 片段**（`fffb` 裸 MP3 帧，约 30 秒试听），`quality=10`（flac）同样 960887 → **该线路只给试听**；`music/tencent/song/link?mid=…&quality=8` → **206 / 10.79MB / `ID3v2.3` 真全曲 320k** | **tx 备选可用，但只能用 v3 `song/link` 线路**（v2 出的是试听片段，接错会把片段当全曲） |
| `pdone/lx-music-source` | 20 个源目录（GitHub ★11,155） | 目录全部为已知族（`changqing/helloworld/huibq/hyw/ikun/juhe/qingliang/sixyin/suyin/xinghai` 等）+ 8 个新名（`feichangdao/fish/flower/grass/jiexiang/qdy/xinglan/yuningxi`）。**静态归因（只读文本、不执行）**：新名里覆盖 kg/mg，但上游多为复用已知端点（`api.xcvts.cn`、`music-api.gdstudio.xyz`、`musicapi.haitangw.net`、`api.huibq.com`、`api.lingchuan.com`、`music-dl.sayqz.com`）；真正新端点 4 个：`api.vkeys.cn`（见上）、`ffapi.cn`（`fetch failed`）、`api.chksz.top`（网页）、`api.qishui.com`（`404`） | **无独立新增量**（除 `api.vkeys.cn`）；**⚠️ 该仓库 README 声明已下架「LX 独家音源」脚本，因其含 `shutdown` 强制关机恶意逻辑（issue #16）→ 任何第三方源接入前必须做静态审计，禁止直接执行** |

**结论（分级）**

- **A 级 · 已落地（R79 执行）**：① 落月 `luoyueTx` 接入 tx 链第三源（三档实测真音频，tx 风险档 high→medium）；② 星海后端改主备双域（K38 修复）。`*.zddyr.top` 已在放行清单；`*.vkeys.cn` 本轮补入（第 18 条）。
- **A 级 · 可靠性修复**：`XINGHAI_BACKEND_API` 单域名且指向上游标注的「旧/备用域」，上游插件已给新主域 `yy1` 并自带「网络失败/5xx 切备用」逻辑 → 见 K38。
- **A 级 · 已落地（R80）**：Audius（`au` 平台）——音源侧已接入并实测 206 真音频；App 侧平台类型/搜索/UI 同步落地后可见。
- **C 级 · 不接或暂缓**：ChKSz（付费 key）、Jamendo（应用被停用）、Internet Archive（未通）、GD Studio（仅 wy，与现役链重叠）、`pdone`/`web-music-api`（待评）。

## 默认开关

| 状态 | 源 |
|---|---|
| 默认开启（12） | `suyinKuwo` `wyOuter` `kuwoOfficial` `suyin163` `xinghaiBackend` `helloworldKw` `changqingVip` `juheTx` `qingliangTx` `luoyueTx` `ikun` `audius` |
| 默认关闭（3） | `suyinQQ` `suyinMigu`（观察）；`huibq`（**2026-11-20 关闭**：11-16 起上游 owner 暂停服务） |

## 退役源（不在册、不探测）

`xinghaiBackup` `lingchuan` `gdWy` `juheKw` `juheWy` `juheKg` `juheMg` `nianxinVip`

> `nianxinVip` 是“能通但同质”的主动退役，不是死源；证据与退出路径见 `SOURCE_RETIREMENT.md`。

## 域名与拦截器协同（HostKeeper）

本仓所有源用到的域名，必须同步登记在 HostKeeper 的内置放行清单 `allow-default.list`（仓库 `luanmuc/hostkeeper`，`v1.1.1` 起随包分发）。HostKeeper 按后缀通配匹配，因此新增源时按“域名族”登记，而不是逐个域名登记。

当前登记的 19 条，对应 `src/providers/*` 与 `src/legacy.js` 中的全部外部端点：

| 类别 | 规则 |
|---|---|
| 平台主站与 API | `*.163.com` `*.qq.com` `*.kuwo.cn` `*.kugou.com` `*.migu.cn` |
| 播放 CDN | `*.126.net` |
| 第三方聚合 / 中转 | `*.oiapi.net` `*.lzmhhh.com` `*.zddyr.top` `*.haitangw.cc` `*.haitangw.net` `*.gdstudio.xyz` `*.onrender.com` `*.xcvts.cn` `*.dpdns.org` `*.lingchuan.com` `*.wwwweb.top` `*.vkeys.cn` `*.audius.co` `*.audius.org` |

维护要求：

- **新增源**：先把域名补进 `allow-default.list`，再重跑 HostKeeper 的 `check.sh`（断言规则数 ≥ 17）。
- **退役源**：规则可保留（代价极低），避免上游复活时还要回滚两边。
- **通配边界**：`*.kuwo.cn` 只覆盖子域，不会放行 `notkuwo.cn` —— 逐级剥离前缀匹配，同名子串不误伤。
- **不要指望它修网络故障**：放行清单只防“被拦截列表误杀”，App 侧连接失败、DNS、代理等问题不在其覆盖范围。
