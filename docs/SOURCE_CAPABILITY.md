# 音源能力矩阵与适配要求

> 实测日期：2026-11-21　基线：`lx-source.js` v9.1.3（13 登记源 / 11 上链 / 2 观察）
> 方法：mock `lx` 宿主后逐个源调用 `SOURCE_HANDLERS[id].fn`，对返回 URL 发 `Range: bytes=0-1023` 验真
> 出口网络：本机直连（`yy.zddyr.top` 经代理会 TLS 中断，直连正常）

本文件记录**实测得到的能力边界**，与源码里的声明分开。声明写在 `provider()` 的 `platforms` / `maxQuality`，实测写在这里。两者不一致的地方都在下方标注。

---

## 1. 注册表

| 源 | 名称 | 平台 | 声明音质 | 生命周期 | 链位置 |
|---|---|---|---|---|---|
| `suyinKuwo` | 溯音酷我 | kw/wy/tx/mg/kg | 128k·320k·flac | active | kw:1 / wy:6 / tx:1 / mg:1 / kg:1 |
| `wyOuter` | 网易云官方 | wy | 128k | active | wy:4 |
| `kuwoOfficial` | 酷我官方直连 | kw | 128k | active | kw:5 |
| `suyin163` | 溯音163 | wy | 128k | active | wy:3 |
| `xinghaiBackend` | 星海后端 | kw | 128k·320k·flac | active | kw:2 |
| `helloworldKw` | helloworld(kw) | kw | 128k·320k·flac | active | kw:4 |
| `changqingVip` | 长青kw | kw | 128k | active | kw:6 |
| `huibq` | Huibq | kw/wy | 128k·320k | active | kw:8 / wy:8 |
| `juheTx` | Juhe聚合(tx) | tx | 128k·320k·flac | active | tx:3 |
| `qingliangTx` | 晴亮(tx) | tx | 128k·320k | active | tx:2 |
| `ikun` | ikun | kw/wy | 128k·320k·flac | active | kw:7 / wy:5 |
| `suyinQQ` | 溯音QQ | tx | 128k·320k·flac | probation | — |
| `suyinMigu` | 溯音咪咕 | mg | 128k·320k·flac | probation | — |

## 2. 实测矩阵（46 组样本）

| 源 | 平台 | 128k | 320k | flac | 交付域名 |
|---|---|---|---|---|---|
| `suyinKuwo` | kw | 206 flac | 206 mpeg | 206 flac | `kw-er.kuwo.cn` |
| `suyinKuwo` | wy | 206 flac | 206 mpeg | 206 flac | `kw-er.kuwo.cn` |
| `suyinKuwo` | tx | 206 flac | 206 mpeg | 206 flac | `kw-er.kuwo.cn` |
| `suyinKuwo` | mg | 206 flac | 206 mpeg | 206 flac | `kw-er.kuwo.cn` |
| `suyinKuwo` | kg | 206 flac | 206 mpeg | 206 flac | `kw-er.kuwo.cn` |
| `wyOuter` | wy | 206 mpeg | — | — | `m801.music.126.net` |
| `kuwoOfficial` | kw | 206 mpeg | — | — | `kw-bj.kuwo.cn` |
| `suyin163` | wy | 206 mpeg | — | — | `m801.music.126.net` |
| `xinghaiBackend` | kw | 302→206 mpeg | 302→206 mpeg | 302→206 flac | `bd-er.kuwo.cn` |
| `helloworldKw` | kw | 206 mpeg | 206 mpeg | 206 flac | `car-er.kuwo.cn` |
| `changqingVip` | kw | 206 mpeg | — | — | `car-er.kuwo.cn` |
| `huibq` | kw | 503 | 503 | — | — |
| `huibq` | wy | 503 | 503 | — | — |
| `juheTx` | tx | 206 mpeg | 206 mpeg | **206 mpeg** | `ws.stream.qqmusic.qq.com` |
| `qingliangTx` | tx | 206 mpeg | 206 mpeg | — | `aqqmusic.tc.qq.com` |
| `ikun` | kw | 206 mpeg | 206 mpeg | 206 flac | `car-er.kuwo.cn` |
| `ikun` | wy | 206 mpeg | 206 mpeg | **206 mpeg** | `m701.music.126.net` |
| `suyinQQ` | tx | 404 | 404 | 404 | — |
| `suyinMigu` | mg | NOT_FOUND | NOT_FOUND | NOT_FOUND | — |

可用 10 / 失效 3。所有可用档位都满足 `HTTP 206` 且 `content-type` 命中音频。

## 3. 音质真实性：两处虚标

| 源 | 平台 | 档位 | 实际内容 | 判定 |
|---|---|---|---|---|
| `juheTx` | tx | flac | `audio/mpeg` | flac 档交付 mp3 |
| `ikun` | wy | flac | `audio/mpeg` | flac 档交付 mp3 |

其余 6 个 flac 档（`suyinKuwo` 五平台 + `xinghaiBackend` + `helloworldKw` + `ikun` kw）实测均为 `audio/x-flac`。

`ikun` 的分档能力是不对称的：kw 通道给 flac，wy 通道最高只到 mp3。而 `qualitys` 字段是源级别的，无法表达这种差异。

## 4. 三种取链模型

### 4.1 按 id 直取（11 个源）

把平台 id 直接投给上游，能否出链取决于该 id 在对方库里是否有效。
`wyOuter` / `kuwoOfficial` / `suyin163` / `xinghaiBackend` / `helloworldKw` / `changqingVip` / `huibq` / `juheTx` / `qingliangTx` / `ikun` / `suyinQQ` / `suyinMigu`。

### 4.2 按歌名搜索（仅 `suyinKuwo`）

`lx-source.js:2794` 的签名是 `suyinKuwoGetUrl(songInfo, quality)`，**没有 platform 参数**，缓存键 `buildCacheKey("kw", ...)` 里平台固定写死。实测同一时刻三个不同 id 拿到的是同一条 URL：

```
kw  id=228908          → kw-er.kuwo.cn/015a8218…/6b013925/…F0000
wy  id=2652820720      → kw-er.kuwo.cn/015a8218…/6b013925/…F0000
tx  id=004Z8Ihr0JIu5s  → kw-er.kuwo.cn/015a8218…/6b013925/…F0000
mg  id=228908          → kw-er.kuwo.cn/015a8218…/6b013925/…F0000
kg  id=228908          → kw-er.kuwo.cn/015a8218…/6b013925/…F0000
```

说明：它声明的“支持 5 平台”语义是**可作任意平台的兜底**，不是“给出该平台的文件”。它靠 `buildSearchKeywords` 搜出来的第一条命中，**不保证是用户点的那一版**（同名翻唱/live/不同编曲都可能命中）。

它在链里的位置是 `kw:1`、`tx:1`、`mg:1`、`kg:1`——四个平台的第一顺位。

### 4.3 平台代理

`xinghaiBackend` 302 一次后落到 `bd-er.kuwo.cn`，即酷我 CDN 的转发代理，不是独立曲库。

## 5. 播放适配要求

1. **必须跟随 302**。`xinghaiBackend` 三档全部先返回 302，跟随一次才拿到 206。App 侧 `isAudioPlayable` 的 `follow_max: 5` 已满足；任何不跟随重定向的客户端会把 302 判成不可播。
2. **必须发 `Range: bytes=0-1023`**。所有 206 都依赖 Range；不带 Range 时服务端可能返回 200 全量，验真逻辑会落到另一个分支。
3. **音质按平台分别声明**。`ikun` 的 kw/wy 能力不同，源级 `qualitys` 表达不了。
4. **`suyinKuwo` 只可作兜底，且应走 `strict`（带歌手校验）**。非 strict 分支只校验歌名+时长，会放大同名错配。

## 6. 失败源现状

- **`huibq`**：HTTP 503，根路径同样 503、0.8s 即返回。`provider()` 的 note 已记录“2026-11-16 起服务被 owner 主动暂停”。当前占 `kw:8` / `wy:8` 末位。
- **`suyinQQ`**：三档全 404，`reviewAt` 为 2026-11-19（已过期）。
- **`suyinMigu`**：三档全 `NOT_FOUND: 溯音咪咕失败`，`reviewAt` 为 2026-11-26。

## 7. 探测用例与源真实能力不一致

`suyin163` 的探测 id 池为 `PROBE_163_IDS = ["2652820720", "347230"]`（`lx-source.js:5077`），而 `buildProbeConfig()` 里为该源声明的曲目是 `name: "晴天", singer: "周杰伦"`（`:4594`）。实测这两个 id 在 `https://oiapi.net/api/Music_163` 返回：

| id | 实际歌曲 |
|---|---|
| `2652820720` | 晴天(深情版) / Lucky小爱 |
| `347230` | 海阔天空 / Beyond |

接口本身 `code=0` 且有 url，但歌曲与探测声明不符，一致性校验过不去即归 `NOT_FOUND`。

## 8. 复现方法

单档全源（128k，仓库自带）：

```bash
cd <音源仓> && node scripts/source-audit.js --quick --json
```

多档矩阵（临时脚本，mock `lx` 宿主后调 handler，对返回 URL 发 Range 请求）：

```bash
cat > _matrix.js <<'JS'
const path=require('path'),http=require('http'),https=require('https');
const SRC=path.resolve(__dirname,'lx-source.js');
function realRequest(url,opts,cb){const v=(u,d)=>{const lib=String(u).startsWith('https')?https:http;
 const req=lib.request(u,{method:(opts&&opts.method)||'GET',headers:(opts&&opts.headers)||{},timeout:8000},res=>{
  if(res.statusCode>=300&&res.statusCode<400&&res.headers.location&&d<5){res.resume();return v(new URL(res.headers.location,u).toString(),d+1)}
  const ch=[];res.on('data',c=>ch.push(c));res.on('end',()=>cb(null,{statusCode:res.statusCode,headers:res.headers,body:Buffer.concat(ch).toString('utf-8'),url:u}))});
 req.on('timeout',()=>{req.destroy();cb(new Error('timeout'),null)});req.on('error',e=>cb(e,null));if(opts&&opts.body)req.write(opts.body);req.end()};
 try{v(String(url),0)}catch(e){cb(e,null)}}
globalThis.lx={EVENT_NAMES:{inited:'inited',request:'request',updateAlert:'updateAlert'},version:'2.6.0',env:'mobile',
 utils:{buffer:{from:(d,e)=>Buffer.from(d,e),bufToString:(b,e)=>b.toString(e)}},request:realRequest,
 on(n,h){if(n==='request')globalThis.__h=h},send(){}};
const L=console.log; console.log=()=>{}; const mod=require(SRC); console.log=L;
const {songOf,idOf}=require('./scripts/lib/probe-songs.js');
(async()=>{ for(const [id,h] of Object.entries(mod.SOURCE_HANDLERS)){
  for(const plat of (h.platforms||[])) for(const q of (h.qualitys||[])){
    try{ const u=await h.fn(plat,idOf(plat),q,songOf(plat),null);
      console.log(id,plat,q,'->',String(u).slice(0,90)); }catch(e){ console.log(id,plat,q,'X',String(e.message).slice(0,50)); }
  } } process.exit(0); })();
JS
node _matrix.js; rm -f _matrix.js
```

## 9. 据此得出的待修项

| 级别 | 项 | 依据 |
|---|---|---|
| P0 | `suyinKuwo` 在 kw/tx/mg/kg 排首位，但按歌名搜索、不认 id | §4.2 |
| P0 | `juheTx`(tx) 与 `ikun`(wy) 的 flac 档交付 mp3 | §3 |
| P1 | `PROBE_163_IDS` 与探测声明曲目不符 | §7 |
| P1 | `chain-sample.js` 丢弃 `msg`，`NOT_FOUND` 无法归因 | `scripts/chain-sample.js` 只保留 code |
| P1 | `health-daily` 的 `deviceDigest` 不区分 App 版本 | 跨 b147~b185 数据混算 |
| P2 | `huibq` 已 503 五天，`suyinQQ`/`suyinMigu` 复核期已到 | §6 |

`xinghaiBackend` 不在待修列表内：证书正常（Let's Encrypt，`Verify return code: 0`），三档实测全部可出链。

### 9.1 修复进度

**阶段 1（2026-11-21，已完成，只动 `scripts/**`）**

| 项 | 状态 | 验证 |
|---|---|---|
| 多平台源逐平台测（原只测 `platforms[0]`） | 已修 | `--quick` 由 11 → 15 行，`suyinKuwo` 五平台各一行 |
| payload 按 `maxQuality` 逐档抽测 | 已修 | `probe --reps=1` 抓到 `api.music.lerd.dpdns.org` 的 `flac 档实返 audio/mpeg` |
| 可播判定纳入 content-type | 已修 | 新增 `QUALITY_MISMATCH` 态，`README_HEALTH` 显示「flac 档实返 audio/mpeg」 |
| `chain-sample` 保留上游 `msg` | 已修 | 产出记录含 `msg` 字段 |
| `kwplay` 直链判定误伤（整串匹配） | 已修 | `helloworldKw`/`changqingVip`/`ikun` 由 `playable=skipped` 转 206 |

**阶段 2（2026-11-21，已完成，动 App 仓 + telemetry 仓 + 云端聚合）**

先说一个被推翻的判断：`recent_events` 里出现的「跨窗口重复」不是 App 的过滤 bug。每份摘要都是「最近 24h」的滑动窗口，两份相隔 N 小时就有 24−N 小时重叠；11-20 的 b171（01:25）与 b185（09:17）重叠 16 小时，于是有 8 条同时间戳事件同时出现在两份里。App 侧 `buildDigest` 的去重本来就正常，重复发生在**云端把两份直接相加**这一步。

| 项 | 改在哪 | 状态 | 验证 |
|---|---|---|---|
| `DigestEvent` 补 `quality` 声明 | App `healthDigest.ts` | 已改 | 采集端本来就有 `quality`（`healthLog.ts:185`），只是接口没声明、聚合时被丢掉 |
| `probe`/`play` 各加 `by_quality` | App + 云端 + schema + ingest | 已改 | 契约 A10：同源 128k 通、flac 挂能分开；不影响 `total` |
| 顶层加 `source.version` | App + 云端 + schema + ingest | 已改 | 取 `active_source_version`（与设置页导出证据同一个键）；契约 A11 验证缺省时不伪造 |
| `recent_events` 每条加 `q` | App + schema + ingest | 已改 | 契约 A12：同毫秒同源不同档**不合并**，同档重复仍去重 |
| 播放侧源维度从未汇总 | 云端 `health-daily.js` | 已修 | 新增 `play.bySource`，此前只汇总 `probe.by_source` |
| 旧包字段缺失兜底 | 云端 `health-daily.js` | 已改 | `by_quality` 缺省只跳过、不补零，避免把「无音质信息」算成失败 |
| 窗口重叠重复计数 | 云端 `pull-device-digests.js` | 已改 | 同设备同日多份按 `generated_at` 只留最后一份；摘要无事件级明细，无法精确去重，这是可接受近似 |

**改 schema 时踩到的硬约束**：telemetry 侧不是「加了字段自然生效」——`digest.schema.json` 的顶层、`probe`/`play`、`recent_events` items 三处都是 `additionalProperties: false`，且 `ingest-digest.js` 有 4 处独立白名单（顶层、`validateCount`、`recent_events` 条目、`source` 子结构）。**只改 App 不改 telemetry，新包的摘要会被原样拒收**，而且拒收理由是「含未知字段」，从 Issue 回执上看不出是版本不兼容。

验证数字：App 摘要契约 **9 → 12 条**（12/0）；14 个健康相关脚本全绿（含跨仓往返 4/0，需 `LX_SOURCE_ROOT` 强制跑）；`tsc --noEmit` rc=0；telemetry `node --test` **9/9**（旧格式仍通过）；新格式、旧格式、坏样本（多余键/超长 `q`）、超限（`total=5000`）四种样本分别验证为「通过/通过/拒收/拒收」。

**阶段 3（未开始，需动产物与升版本）**：`suyinKuwo` 首位策略、`ikun` 按平台拆 `qualitys`、`juheTx` flac 降档校验、`PROBE_163_IDS` 换 id。

**阶段 4（未开始）**：`huibq` / `suyinQQ` / `suyinMigu` 退役与复核。

---

> 本文件为实测快照，源侧接口随时可能变化。复测请按 §8 重跑后更新本文件，不要凭本文件断言当前可用性。
