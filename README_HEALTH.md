# 端点健康表（自动巡检）

> 由 `scripts/probe.js` 自动生成 · 更新于 2026-11-14T23:28:05.623Z · 判定规则：2xx/3xx 或 Range 206 为可用（4xx/5xx/超时/域名不可解析为失败）
>
> ⚠️ **口径**：本表是"端点级"健康（服务是否活着）。v8.5 起对取链型端点（oiapi Kuwo/163、ikun、星海后端、溯音咪咕）增加真实取链 + 直链 Range 可播二次校验，失败标 `PAYLOAD_*`；但"端点可用 ≠ 音源可用"的残余风险仍存在——源级最终判据以 **App 健康面板（源内探针，带 Range 校验）** 为准。

共提取 16 个端点，可用 10 个；近 7 日成功率基于 `docs/probe-history.jsonl` 历史（2026-11-15 追加）。

### 平台健康汇总

- 🟢 **网易云 wy**：3/3 端点可用
- 🟡 **酷我 kw**：3/5 端点可用
- 🔴 **QQ tx**：0/1 端点可用
- **酷狗 kg**：无独立源，走 kw 兜底
- 🔴 **咪咕 mg**：0/1 端点可用

| 端点 | 状态 | HTTP | 耗时(ms) | 近7日成功率 | 说明 |
|---|---|---|---|---|---|
| `https://oiapi.net/api/QQ_Music` | ❌ 失败 | 403 | 859 | 0% (0/8天) | HTTP 403 |
| `https://oiapi.net/api/Music_163` | ✅ 可用 | 200 | 890 | 88% (7/8天) | OK |
| `https://oiapi.net/api/Kuwo` | ❌ 失败 | 200 | 1114 | 50% (4/8天) | PAYLOAD_DEAD |
| `https://api.xcvts.cn/api/music/migu` | ❌ 失败 | 200 | 1212 | 0% (0/8天) | PAYLOAD_NO_URL |
| `https://lxmusicapi.onrender.com` | ✅ 可用 | 200 | 666 | 100% (8/8天) | OK |
| `https://api.music.lerd.dpdns.org` | ❌ 失败 | 429 | 120 | 0% (0/8天) | HTTP 429 |
| `https://yy.zddyr.top/lx/api/` | ✅ 可用 | 200 | 535 | 100% (8/8天) | OK |
| `http://antiserver.kuwo.cn/anti.s` | ✅ 可用 | 206 | 970 | 88% (7/8天) | OK |
| `https://c.wwwweb.top` | ✅ 可用 | 200 | 1236 | 88% (7/8天) | OK |
| `http://nmobi.kuwo.cn/mobi.s` | ⚪ 不适用（需带参） | 404 | 524 | 0% (0/8天) | HTTP 404 |
| `https://musicserver.haitangw.cc/v1/music/resolve-url` | ⚪ 不适用（需带参） | 404 | 2738 | 0% (0/8天) | HTTP 404 |
| `https://musicapi.haitangw.net/music/kw.php?type=mp3&id={id}&level={lev…` | ✅ 可用 | 200 | 851 | 100% (8/8天) | OK |
| `https://music.163.com/song/media/outer/url?id={id}.mp3` | ✅ 可用 | 302 | 646 | 100% (8/8天) | OK |
| `https://music.163.com/api/song/lyric` | ✅ 可用 | 200 | 589 | 100% (8/8天) | OK |
| `https://music.163.com/api/song/detail` | ✅ 可用 | 200 | 194 | 100% (8/8天) | OK |
| `http://search.kuwo.cn/r.s` | ✅ 可用 | 206 | 515 | 88% (7/8天) | OK |

## ⚠️ 死源建议（连续 3 天以上失败，供迭代时摘除/留档）

### 🟡 次要（备用/边缘端点连续失败）

- `https://api.music.lerd.dpdns.org`：连续 8 天失败（近7日成功率 0%），当前仍失败 · HTTP 429
- `https://music-api.gdstudio.xyz/api.php?use_xbridge3=true&loader_name=forest&need_sec_link=1&sec_link_scene=im&theme=light`：连续 6 天失败（近7日成功率 0%），当前仍失败 · 历史连续失败
- `https://music.nxinxz.com/kgqq/tx.php?id={id}&level={level}&type=mp3`：连续 6 天失败（近7日成功率 0%），当前仍失败 · 历史连续失败
