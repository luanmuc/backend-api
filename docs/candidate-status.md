# 判否候选恢复状态（自动探测）

> 由 `scripts/recheck-candidates.js` 自动生成 · 2026-11-08 07:35:26Z
> 最后人工复核：2026-11-08 · 判否记录见 DEV_GUIDE「已判否的候选」。

| 候选 | 状态 | 探测证据 | 人工复核结论（2026-11-08） |
|---|---|---|---|
| hyw（HYWmusic v1.2.0） | 🔴 维持判否 | 后端 http 103.79.184.97=HTTP 200 | 后端已恢复，但**需要卡密**（首页显示"卡密总数/登录控制台"），非免费公益源 → 不接入 |
| huanyin（幻音 v3） | 🔴 维持判否 | DNS music-dl.sayqz.com=ENOTFOUND；业务 api.xcvts.cn 咪咕=HTTP 200/400 | 主域名 DNS 仍失效；业务接口 api.xcvts.cn 已接入（suyinMigu）→ 无新增量 |

---

## 2026-11-08 全网生态扫描结论

**核心结论：没有新的、免费的、长期稳定的独立 API 后端可以接入。**

### 已接入的独立后端（10 个）
GDAPI / Juhe聚合 / 星海后端 / 溯音(oiapi+xcvts) / 长青 / 念心 / Huibq / ikun / HelloWorld-haitangw / 聆川

### 新发现但无法接入的
| 候选 | 原因 |
|---|---|
| CHKSZ API（api.chksz.com） | 需要 apikey（付费服务），返回 401 |
| pdone / 洛雪科技独家音源 | 代码完全混淆加密，私有 API 服务器，非开源 |
| SixYin（六音） | 官网是软件下载站，不是音乐 API 服务 |
| 汽水音乐（qs） | 星海支持，但需单独开发新平台 |

### 候选源全部已实证（6 个）
fish / hyw / jiexiang / lx / qdy / huanyin → 全部判否或零增量，详见 DEV_GUIDE。
