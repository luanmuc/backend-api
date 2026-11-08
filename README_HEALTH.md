# 端点健康表（自动巡检）

> 由 `scripts/probe.js` 自动生成 · 更新于 2026-11-08T06:19:52.508Z · 判定规则：2xx/3xx 或 Range 206 为可用（4xx/5xx/超时/域名不可解析为失败）
>
> ⚠️ **口径**：本表是"端点级"健康（服务是否活着）。v8.5 起对取链型端点（oiapi Kuwo/163、ikun、星海后端、溯音咪咕）增加真实取链 + 直链 Range 可播二次校验，失败标 `PAYLOAD_*`；但"端点可用 ≠ 音源可用"的残余风险仍存在——源级最终判据以 **App 健康面板（源内探针，带 Range 校验）** 为准。

共提取 20 个端点，可用 12 个；近 7 日成功率基于 `docs/probe-history.jsonl` 历史（2026-11-08 追加）。

### 平台健康汇总

- 🟡 **网易云 wy**：3/4 端点可用
- 🟡 **酷我 kw**：2/5 端点可用
- 🔴 **QQ tx**：0/1 端点可用
- **酷狗 kg**：无独立源，走 kw 兜底
- 🔴 **咪咕 mg**：0/1 端点可用

| 端点 | 状态 | HTTP | 耗时(ms) | 近7日成功率 | 说明 |
|---|---|---|---|---|---|
| `https://music-api.gdstudio.xyz/api.php?use_xbridge3=true&loader_name=f…` | ❌ 失败 | 403 | 139 | 14% (1/7天) | HTTP 403 |
| `https://oiapi.net/api/QQ_Music` | ❌ 失败 | 403 | 986 | 0% (0/7天) | HTTP 403 |
| `https://oiapi.net/api/Music_163` | ✅ 可用 | 200 | 1360 | 100% (7/7天) | OK |
| `https://oiapi.net/api/Kuwo` | ❌ 失败 | 200 | 1414 | 86% (6/7天) | PAYLOAD_DEAD |
| `https://api.xcvts.cn/api/music/migu` | ❌ 失败 | 206 | 1521 | 43% (3/7天) | PAYLOAD_NO_URL |
| `https://lxmusicapi.onrender.com` | ✅ 可用 | 200 | 1586 | 71% (5/7天) | OK |
| `https://api.music.lerd.dpdns.org` | ✅ 可用 | 200 | 225 | 14% (1/7天) | OK |
| `https://yy.zddyr.top/lx/api/` | ❌ 失败 | 429 | 819 | 57% (4/7天) | HTTP 429 |
| `https://music.163.com/api/song/lyric` | ✅ 可用 | 200 | 984 | 100% (7/7天) | OK |
| `https://music.163.com/api/song/detail` | ✅ 可用 | 200 | 874 | 100% (7/7天) | OK |
| `http://search.kuwo.cn/r.s` | ✅ 可用 | 206 | 777 | 86% (6/7天) | OK |
| `http://antiserver.kuwo.cn/anti.s` | ✅ 可用 | 206 | 1453 | 86% (6/7天) | OK |
| `https://c.wwwweb.top` | ✅ 可用 | 200 | 1613 | 100% (3/3天) | OK |
| `http://nmobi.kuwo.cn/mobi.s` | ⚪ 不适用（需带参） | 404 | 897 | 0% (0/7天) | HTTP 404 |
| `https://musicserver.haitangw.cc/v1/music/resolve-url` | ⚪ 不适用（需带参） | 404 | 3293 | 0% (0/7天) | HTTP 404 |
| `http://175.27.166.236/kgqq/qq.php?type=mp3&id={id}&level={level}` | ✅ 可用 | 200 | 593 | 100% (1/1天) | OK |
| `https://musicapi.haitangw.net/music/kw.php?type=mp3&id={id}&level={lev…` | ✅ 可用 | 200 | 1207 | 100% (1/1天) | OK |
| `https://music.haitangw.cc/kgqq/kg.php?type=mp3&id={id}&level={level}` | ✅ 可用 | 200 | 880 | 100% (1/1天) | OK |
| `https://music.nxinxz.com/kgqq/tx.php?id={id}&level={level}&type=mp3` | ⚪ 不适用（需带参） | 404 | 1782 | 0% (0/1天) | HTTP 404 |
| `https://music.163.com/song/media/outer/url?id={id}.mp3` | ✅ 可用 | 302 | 250 | 100% (1/1天) | OK |

## ⚠️ 死源建议（连续 3 天以上失败，供迭代时摘除/留档）

### 🟡 次要（备用/边缘端点连续失败）

- `https://music-dl.sayqz.com/api/`：连续 5 天失败（近7日成功率 0%），当前仍失败 · 历史连续失败
- `https://api.lingchuan.com/v1`：连续 5 天失败（近7日成功率 0%），当前仍失败 · 历史连续失败
- `https://api.ikunshare.com`：连续 5 天失败（近7日成功率 0%），当前仍失败 · 历史连续失败
- `https://music-api.gdstudio.xyz/api.php?use_xbridge3=true&loader_name=forest&need_sec_link=1&sec_link_scene=im&theme=light`：连续 4 天失败（近7日成功率 14%），当前仍失败 · HTTP 403
