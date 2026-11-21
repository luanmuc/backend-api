# 端点健康表（自动巡检）

> 由 `scripts/probe.js` 自动生成 · 更新于 2026-11-21T23:58:59.718Z · 判定规则：2xx/3xx 或 Range 206 为可用（4xx/5xx/超时/域名不可解析为失败）
>
> ⚠️ **口径（v9.1.4 起）**：`状态` = **端点级最终结论**（HTTP 可达 **且** 取链校验通过）。v9.1.4 前 payload 失败只落在历史 `payload` 字段、`状态` 仍显示可用，导致本表与健康日报结论相反（实测 suyin163：本表 `PAYLOAD_NO_URL` 失败、同日日报写 94.3% 正常）。`探测成功率` 按**探测次数**统计，与 `docs/health-daily/` 日报同源同算；`可用天` 是天级辅助视图。`param` 类（真实调用必须带参）一律不计入可用；**仅试听**（表里 `🟡 可用（仅试听 …）`）计入可用——片段由音源本体的交付验真（`src/core/15-verify.js` 的 `PREVIEW_FRAGMENT`）拦截并换源，用户听不到，这里只记录能力边界。

共提取 19 个端点（其中 7 个 param 类不参与可用判定），可用 9/12 个；近 7 日探测成功率基于 `docs/probe-history.jsonl` 历史（2026-11-22 追加）。

### 平台健康汇总

- 🟢 **网易云 wy**：3/3 端点可用
- 🟢 **酷我 kw**：4/4 端点可用
- 🔴 **QQ tx**：0/1 端点可用
- **酷狗 kg**：无独立源，走 kw 兜底
- 🟢 **咪咕 mg**：1/1 端点可用

| 端点 | 状态 | HTTP | 耗时(ms) | 近7日探测成功率 | 可用天 | 说明 |
|---|---|---|---|---|---|---|
| `https://oiapi.net/api/QQ_Music` | ❌ 失败 | 404 | 247 | 0% (0/10 次) | 0/2 天 | HTTP 404 |
| `https://oiapi.net/api/Music_163` | 🟡 可用（仅试听 30s / 326s） | 200 | 988 | 100% (10/10 次) | 2/2 天 | 仅试听 30s（应 326s）；交付验真会拦截并换源 |
| `https://oiapi.net/api/Kuwo` | ✅ 可用 | 200 | 1234 | 100% (10/10 次) | 2/2 天 | OK |
| `https://api.xcvts.cn/api/music/migu` | ✅ 可用 | 206 | 1721 | 100% (10/10 次) | 2/2 天 | OK |
| `https://lxmusicapi.onrender.com` | ❌ 失败 | 503 | 244 | 0% (0/10 次) | 0/2 天 | HTTP 503 |
| `https://api.music.lerd.dpdns.org` | ❌ 失败 | 429 | 36 | 40% (4/10 次) | 1/2 天 | HTTP 429 |
| `https://music.lzmhhh.com/api/music/url` | ⚪ 不适用（需带参） | 400 | 251 | — | — | HTTP 400 |
| `https://yy.zddyr.top/lx/api/` | ✅ 可用 | 200 | 1015 | 100% (10/10 次) | 2/2 天 | OK |
| `http://antiserver.kuwo.cn/anti.s` | ✅ 可用 | 206 | 708 | 100% (10/10 次) | 2/2 天 | OK |
| `https://c.wwwweb.top` | ✅ 可用 | 200 | 1298 | 100% (10/10 次) | 2/2 天 | OK |
| `http://nmobi.kuwo.cn/mobi.s` | ⚪ 不适用（需带参） | 404 | 231 | — | — | HTTP 404 |
| `https://musicserver.haitangw.cc/v1/music/resolve-url` | ⚪ 不适用（需带参） | 404 | 464 | — | — | HTTP 404 |
| `https://musicapi.haitangw.net/music/kw.php?type=mp3&id={id}&level={lev…` | ⚪ 不适用（需带参） | 200 | 987 | — | — | OK |
| `https://music.163.com/song/media/outer/url?id={id}.mp3` | ⚪ 不适用（需带参） | 302 | 935 | — | — | OK |
| `https://music.163.com/api/song/lyric` | ✅ 可用 | 200 | 768 | 100% (10/10 次) | 2/2 天 | OK |
| `https://music.163.com/api/song/detail` | ✅ 可用 | 200 | 234 | 100% (10/10 次) | 2/2 天 | OK |
| `http://search.kuwo.cn/r.s` | ✅ 可用 | 206 | 255 | 100% (10/10 次) | 2/2 天 | OK |
| `https://c.y.qq.com/soso/fcgi-bin/client_search_cp` | ⚪ 不适用（需带参） | 200 | 1557 | — | — | OK |
| `https://music.163.com/api/search/get/web` | ⚪ 不适用（需带参） | 200 | 235 | — | — | OK |
