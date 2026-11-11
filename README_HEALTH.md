# 端点健康表（自动巡检）

> 由 `scripts/probe.js` 自动生成 · 更新于 2026-11-11T00:17:35.734Z · 判定规则：2xx/3xx 或 Range 206 为可用（4xx/5xx/超时/域名不可解析为失败）
>
> ⚠️ **口径**：本表是"端点级"健康（服务是否活着）。v8.5 起对取链型端点（oiapi Kuwo/163、ikun、星海后端、溯音咪咕）增加真实取链 + 直链 Range 可播二次校验，失败标 `PAYLOAD_*`；但"端点可用 ≠ 音源可用"的残余风险仍存在——源级最终判据以 **App 健康面板（源内探针，带 Range 校验）** 为准。

共提取 20 个端点，可用 13 个；近 7 日成功率基于 `docs/probe-history.jsonl` 历史（2026-11-11 追加）。

### 平台健康汇总

- 🟡 **网易云 wy**：3/4 端点可用
- 🟡 **酷我 kw**：4/5 端点可用
- 🔴 **QQ tx**：0/1 端点可用
- **酷狗 kg**：无独立源，走 kw 兜底
- 🔴 **咪咕 mg**：0/1 端点可用

| 端点 | 状态 | HTTP | 耗时(ms) | 近7日成功率 | 说明 |
|---|---|---|---|---|---|
| `https://music-api.gdstudio.xyz/api.php?use_xbridge3=true&loader_name=f…` | ❌ 失败 | 403 | 112 | 0% (0/7天) | HTTP 403 |
| `https://oiapi.net/api/QQ_Music` | ❌ 失败 | 403 | 903 | 0% (0/7天) | HTTP 403 |
| `https://oiapi.net/api/Music_163` | ✅ 可用 | 200 | 941 | 86% (6/7天) | OK |
| `https://oiapi.net/api/Kuwo` | ✅ 可用 | 200 | 1209 | 86% (6/7天) | OK |
| `https://api.xcvts.cn/api/music/migu` | ❌ 失败 | 200 | 1608 | 14% (1/7天) | PAYLOAD_NO_URL |
| `https://lxmusicapi.onrender.com` | ✅ 可用 | 200 | 696 | 100% (7/7天) | OK |
| `https://api.music.lerd.dpdns.org` | ❌ 失败 | 200 | 479 | 0% (0/7天) | PAYLOAD_NO_URL |
| `https://yy.zddyr.top/lx/api/` | ✅ 可用 | 200 | 1131 | 86% (6/7天) | OK |
| `https://music.163.com/api/song/lyric` | ✅ 可用 | 200 | 973 | 100% (7/7天) | OK |
| `https://music.163.com/api/song/detail` | ✅ 可用 | 200 | 694 | 100% (7/7天) | OK |
| `http://search.kuwo.cn/r.s` | ✅ 可用 | 206 | 724 | 86% (6/7天) | OK |
| `http://antiserver.kuwo.cn/anti.s` | ✅ 可用 | 206 | 461 | 86% (6/7天) | OK |
| `https://c.wwwweb.top` | ✅ 可用 | 200 | 2202 | 100% (6/6天) | OK |
| `http://nmobi.kuwo.cn/mobi.s` | ⚪ 不适用（需带参） | 404 | 554 | 0% (0/7天) | HTTP 404 |
| `https://musicserver.haitangw.cc/v1/music/resolve-url` | ⚪ 不适用（需带参） | - | 4381 | 0% (0/7天) | TIMEOUT |
| `http://175.27.166.236/kgqq/qq.php?type=mp3&id={id}&level={level}` | ✅ 可用 | 200 | 517 | 100% (4/4天) | OK |
| `https://musicapi.haitangw.net/music/kw.php?type=mp3&id={id}&level={lev…` | ✅ 可用 | 200 | 908 | 100% (4/4天) | OK |
| `https://music.haitangw.cc/kgqq/kg.php?type=mp3&id={id}&level={level}` | ✅ 可用 | 200 | 2009 | 100% (4/4天) | OK |
| `https://music.nxinxz.com/kgqq/tx.php?id={id}&level={level}&type=mp3` | ⚪ 不适用（需带参） | 404 | 3504 | 0% (0/4天) | HTTP 404 |
| `https://music.163.com/song/media/outer/url?id={id}.mp3` | ✅ 可用 | 302 | 232 | 100% (4/4天) | OK |
