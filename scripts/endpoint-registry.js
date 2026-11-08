#!/usr/bin/env node
/**
 * v8.10.5 端点登记表：探测巡检的**单一真相**。
 *
 * 背景：此前 probe.js 用正则从 lx-source.js 抽 URL，health-daily.js 另写一份手写映射表，
 * 两份清单必然漂移——v8.1 ikun 域名迁到 c.wwwweb.top 后，probe.js 在 v8.5 已移除旧端点，
 * 但 health-daily.js 仍挂着 api.ikunshare.com，导致日报连续多日对 ikun 报"全失败"假警报。
 *
 * 现约定：端点清单只在这里维护一份；probe.js 与 health-daily.js 都读它。
 * probe.js 保留源码正则抽取，仅作**漂移校验**：源码里出现但本表未登记的 URL 会打印告警，
 * 提醒登记（而不是悄悄漏检——历史上已两次因白名单漏关键词导致新源主通道脱离巡检）。
 *
 * kind 三档（决定 health-daily 的判定口径）：
 *   endpoint —— 裸 GET 即可判定存活（公开查询接口）
 *   payload  —— 端点 200 ≠ 源可用，需真实取链 + 直链 Range 校验（probe.js 内置 payloadFetch，失败记 PAYLOAD_DEAD）
 *   param    —— 裸探测缺参恒 4xx（真实调用需 query/body），**不参与判定**，只留原始记录供排查
 *
 * sources：对应 lx-source.js 的 SOURCE_HANDLERS 键；多源共用端点时给数组（任一启用即参与判定）。
 */
const ENDPOINTS = [
  {
    url: 'https://music-api.gdstudio.xyz/api.php?use_xbridge3=true&loader_name=forest&need_sec_link=1&sec_link_scene=im&theme=light',
    sources: ['gdWy'],
    kind: 'payload',
    note: '限 5 分钟 50 次，仅高音质链；403 多为风控/地区限制',
  },
  { url: 'https://oiapi.net/api/QQ_Music', sources: ['suyinQQ'], kind: 'payload', note: '上游维护中，默认关闭' },
  { url: 'https://oiapi.net/api/Music_163', sources: ['suyin163'], kind: 'payload', note: '' },
  { url: 'https://oiapi.net/api/Kuwo', sources: ['suyinKuwo'], kind: 'payload', note: 'v8.5 实锤：端点 100% 可用但源曾返回 CDN 410 死链' },
  { url: 'https://api.xcvts.cn/api/music/migu', sources: ['suyinMigu'], kind: 'payload', note: '默认关闭（上游 502）' },
  { url: 'https://lxmusicapi.onrender.com', sources: ['huibq'], kind: 'payload', note: 'onrender 免费实例，冷启动慢' },
  { url: 'https://api.music.lerd.dpdns.org', sources: ['juheKw', 'juheTx', 'juheWy', 'juheKg', 'juheMg'], kind: 'payload', note: 'Juhe 源族共用端点，默认全关闭' },
  { url: 'https://yy.zddyr.top/lx/api/', sources: ['xinghaiBackend'], kind: 'payload', note: '端点 200 曾因无效 token 403' },
  // 工具类端点（非 SOURCE_HANDLERS 里的源，无 SOURCE_TOGGLES 开关）——始终参与判定
  { url: 'https://music.163.com/api/song/lyric', sources: [], label: 'wyLyric 网易歌词接口', kind: 'endpoint', toggleable: false, note: '官方公开接口' },
  { url: 'https://music.163.com/api/song/detail', sources: [], label: 'wyDetail 网易详情接口', kind: 'endpoint', toggleable: false, note: '官方公开接口' },
  { url: 'http://search.kuwo.cn/r.s', sources: [], label: 'kuwoSearch 酷我搜索接口', kind: 'endpoint', toggleable: false, note: '' },
  { url: 'http://antiserver.kuwo.cn/anti.s', sources: ['kuwoOfficial'], kind: 'endpoint', note: '' },
  { url: 'https://c.wwwweb.top', sources: ['ikun'], kind: 'payload', note: 'v8.1 迁移后的真实主端点；裸 GET 返回首页 200，需 payloadFetch 校验' },
  { url: 'http://nmobi.kuwo.cn/mobi.s', sources: ['helloworldKw'], kind: 'param', note: 'helloworldKw 通道①，真实调用为带参 convert_url_with_sign，裸 GET 恒 404' },
  { url: 'https://musicserver.haitangw.cc/v1/music/resolve-url', sources: ['helloworldKw'], kind: 'param', note: 'helloworldKw 通道②备用接口（lx-source.js:1360），非独立源；真实调用需 query 参数，裸 GET 恒 404' },
  // v8.10.5：长青/念心的直链模板此前**完全没登记**——而这两个源 SOURCE_TOGGLES 都是 true，
  // 等于日报对它们全程失明（V 组 T1）。模板需 {id}/{level}，裸探测恒 404，故归 param。
  { url: 'http://175.27.166.236/kgqq/qq.php?type=mp3&id={id}&level={level}', sources: ['changqingVip'], kind: 'param', note: '长青 tx/wy 共用主机（lx-source.js:128-129）；需 {id}/{level} 且源方按 IP 放行，裸探测恒 404' },
  { url: 'https://musicapi.haitangw.net/music/kw.php?type=mp3&id={id}&level={level}', sources: ['changqingVip'], kind: 'param', note: '长青 kw 模板（lx-source.js:130）；需 {id}/{level}' },
  { url: 'https://music.haitangw.cc/kgqq/kg.php?type=mp3&id={id}&level={level}', sources: ['changqingVip'], kind: 'param', note: '长青 kg/mg 共用主机（lx-source.js:131-132）；需 {id}/' },
  { url: 'https://music.nxinxz.com/kgqq/tx.php?id={id}&level={level}&type=mp3', sources: ['nianxinVip'], kind: 'param', note: '念心 tx/wy/kw/kg/mg 全部模板共用该主机（lx-source.js:136-140）；需 {id}/{level}' },
  // v8.10.5：T60 抓出来的又一个漏登记——wyOuter 是启用源，却长期没有任何登记端点。
  // 官方 outer 模板必须带真实歌曲 id，裸探测恒 404，故同属 param（不参与存活判定，但生日历必须可见）。
  { url: 'https://music.163.com/song/media/outer/url?id={id}.mp3', sources: ['wyOuter'], kind: 'param', note: 'wyOuter 官方 outer 直连模板（lx-source.js:116）；需真实歌曲 id，裸探测恒 404' },
];

// 明确不登记（保留说明，避免后人以为是漏项）：
//   https://music-dl.sayqz.com/api/      —— xinghaiBackup，域名不可解析且源默认关闭，无需监控
//   https://api.lingchuan.com/v1         —— lingchuan，需配置且默认关闭
//   https://img2.kuwo.cn/                —— 封面 URL 模板，非源端点
//   https://github.com/luanmuc/backend-api/releases —— 文档链接，非源端点

function byUrl() {
  const map = new Map();
  for (const e of ENDPOINTS) map.set(e.url, e);
  return map;
}

function urls() {
  return ENDPOINTS.map(e => e.url);
}

/** 取端点对应的源 id 列表（未登记时返回空数组） */
function sourcesOf(url) {
  const hit = byUrl().get(url);
  return hit ? hit.sources : [];
}

// v8.10.5：巡检共用常量收敛到这里（此前 probe 与 health-daily 各自定义一份同值常量，改一处不改另一处即口径分叉，V13）
const WINDOW_DAYS = 7;           // 成功率统计窗口（按有数据日计）
const CONSECUTIVE_FAIL_DAYS = 3; // 连续失败天数阈值
// v8.10.5：永不探测的域名（此前 probe 内另有一份 EXCLUDE_DOMAINS，与本文件"明确不登记"清单是两套，V11）
const EXCLUDE_DOMAINS = [
  'music-dl.sayqz.com', // 星海备份：域名不可解析
  'api.lingchuan.com',  // 聆川：不可解析且需配置
];

module.exports = { ENDPOINTS, byUrl, urls, sourcesOf, WINDOW_DAYS, CONSECUTIVE_FAIL_DAYS, EXCLUDE_DOMAINS };
