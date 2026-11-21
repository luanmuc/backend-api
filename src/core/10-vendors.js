// ============================================================
// v9.0 业务层 · 10-vendors（外部接口常量 / 供应商取链碎片）
// 来源：由 legacy.js 整块迁出（闭包划分：20 个互不连通的孤岛分量，合计 22 定义）
// ============================================================
const { ERROR_CODES } = require("./02-error-codes.js");
const { httpRequestWithRetry, getMobileUserAgent, TIMEOUT_CONFIG } = require("./07-net.js");
const { USER_CONFIG } = require("./02-config.js");
const { getHashOrMid, QUALITY_TO_X } = require("./09-match.js");

// v9.1.6（K31）：从 1KB 提到 32KB。原因：ID3v2 标签（尤其带封面 APIC 的文件）前 1KB
// 常常只够读到标签头、读不到 TIT2/TPE1，而验真要靠这两个字段判断「是不是这首歌」。
// 代价是每次验真多下 ~31KB；音频本身是 MB 级，占比可忽略。
const VERIFY_RANGE_BYTES = 32767;

const GD_API = "https://music-api.gdstudio.xyz/api.php?use_xbridge3=true&loader_name=forest&need_sec_link=1&sec_link_scene=im&theme=light";

const JUHE_API = "https://api.music.lerd.dpdns.org";  // v4.0：Juhe聚合API(CF)——kw 全链路实测可用(2026-10-28 E21：POST /kw→303重定向→mobi.kuwo.cn签名→kw-er.kuwo.cn直链)

const LINGCHUAN_API = "https://api.lingchuan.com/v1";

const XINGHAI_BACKEND_API = "https://yy.zddyr.top/lx/api/";

const KUWO_SEARCH_API = "http://search.kuwo.cn/r.s";

const KUWO_CONVERT_API = "http://antiserver.kuwo.cn/anti.s";

const QQ_SEARCH_API = "https://c.y.qq.com/soso/fcgi-bin/client_search_cp";

const WY_SEARCH_API = "https://music.163.com/api/search/get/web";

const CROSS_PLATFORM_NAMES = { tx: "QQ音乐", wy: "网易云音乐", kw: "酷我音乐" };

const IKUN_API = "https://c.wwwweb.top";

const HELLOWORLD_KW_CONVERT_API = "http://nmobi.kuwo.cn/mobi.s";

const REPORT_QUALITIES = {
  wy: ["128k", "320k", "flac"],   // outer/suyin163=128k；GD Studio=flac；suyinKuwo=flac兜底
  tx: ["128k", "320k", "flac"],   // 仅 suyinKuwo 搜索酷我兜底
  kw: ["128k", "320k", "flac"],   // kuwoOfficial/xinghaiBackend=128k；suyinKuwo=flac
  kg: ["128k", "320k", "flac"],   // 仅 suyinKuwo 搜索酷我兜底
  mg: ["128k", "320k", "flac"]    // 仅 suyinKuwo 搜索酷我兜底
};

const PLATFORM_TO_XINGHAI_BACKUP = { wy: "netease", tx: "qq", kw: "kuwo" };

function kuwoUnescape(text) {
  return String(text || "")
    .replace(/&nbsp;/g, " ")
    .replace(/\\u([0-9a-fA-F]{4})/g, (m, hex) => String.fromCharCode(parseInt(hex, 16)))
    .trim();
}

async function gdWyGetUrl(platform, songId, quality, songInfo) {
  if (platform !== "wy") throw new Error(`${ERROR_CODES.PARAM_ERROR}: GD Studio仅支持网易云`);
  const id = songId ?? songInfo?.id;
  if (!id) throw new Error(`${ERROR_CODES.PARAM_ERROR}: 缺少wy songId`);
  const q = String(quality || "flac").toLowerCase();
  // v2.0：音质编码统一走 QUALITY_TO_X.gd（原 gdBrMap 已并入）
  const br = QUALITY_TO_X.gd[q] || "320";
  const url = `${GD_API}&types=url&source=netease&id=${encodeURIComponent(id)}&br=${br}`;
  const res = await httpRequestWithRetry(url, {
    method: "GET",
    headers: { "User-Agent": "LX-Music-Mobile", Accept: "application/json" },
    timeout: TIMEOUT_CONFIG.parse
  });
  const body = res.body;
  if (!body || typeof body !== "object" || !body.url) throw new Error((body && body.message) || `${ERROR_CODES.NOT_FOUND}: GD Studio未返回可用URL`);
  return body.url;
}

async function xinghaiBackupGetUrl(platform, songId, quality, songInfo) {
  const source = PLATFORM_TO_XINGHAI_BACKUP[platform];
  if (!source) throw new Error(`${ERROR_CODES.PARAM_ERROR}: 星海备不支持该平台`);
  const id = songId ?? getHashOrMid(songInfo);
  if (!id) throw new Error(`${ERROR_CODES.PARAM_ERROR}: 缺少songId`);
  const selectedQuality = String(quality || "128k").toLowerCase(); // v1.0 (D10)：链级已过滤，直接音质
  // v6.0：修复——旧实现直接返回"API 请求 URL"当作音频直链（域名恢复后播放器会拿 JSON 当音频，必然播放失败）。
  // 当前域名实测不可解析、无响应可验证解析逻辑，明确失败而非伪装直链；域名恢复后需按 kuwoOfficial 模式补齐请求+校验
  throw new Error(`${ERROR_CODES.NOT_FOUND}: 星海备域名不可解析(需实测补齐直链解析)`);
}

async function lingchuanGetUrl(platform, songId, quality, songInfo) {
  if (!LINGCHUAN_API) throw new Error(`${ERROR_CODES.CONFIG_ERROR}: 聆川未配置`);
  const hashOrMid = songInfo?.hash ?? songInfo?.songmid;
  if (!hashOrMid) throw new Error(`${ERROR_CODES.PARAM_ERROR}: 聆川缺少hash/songmid`);
  const selectedQuality = String(quality || "128k").toLowerCase(); // v1.0 (D10)：链级已过滤，直接音质
  const url = `${LINGCHUAN_API}/url?source=${encodeURIComponent(platform)}&songId=${encodeURIComponent(hashOrMid)}&quality=${encodeURIComponent(selectedQuality)}`;
  const res = await httpRequestWithRetry(url, {
    method: "GET",
    headers: { "Content-Type": "application/json", "User-Agent": getMobileUserAgent(), ...(USER_CONFIG.lingchuanApiKey ? { "Authorization": `Bearer ${USER_CONFIG.lingchuanApiKey}` } : {}) },
    follow_max: 5,
    timeout: TIMEOUT_CONFIG.parse
  });
  const body = res.body;
  if (!body || typeof body !== "object" || Number.isNaN(Number(body.code))) throw new Error(`${ERROR_CODES.SERVER_ERROR}: 聆川返回无效`);
  if (Number(body.code) !== 200 || !body.url) throw new Error(body.message || `${ERROR_CODES.NOT_FOUND}: 聆川未返回URL`);
  return body.url;
}

const INFLIGHT_URL_MAX = 200; // 兜底：异常情况下不让这个 Map 无界增长

function buildInflightKey(platform, songInfo, quality) {
  const m = (songInfo && typeof songInfo === "object") ? songInfo : {};
  const id = m.songmid || m.hash || m.musicId || m.copyrightId || m.id || "";
  return `${platform}|${quality}|${id}|${m.name || ""}|${m.singer || ""}|${m.duration || 0}`;
}

const sourceConfig = {};

const PLATFORM_NAMES = {
  wy: "网易云音乐", tx: "QQ音乐", kw: "酷我音乐", kg: "酷狗音乐", mg: "咪咕音乐"
};

module.exports = {
  LINGCHUAN_API,
  lingchuanGetUrl,
  PLATFORM_TO_XINGHAI_BACKUP,
  xinghaiBackupGetUrl,
  VERIFY_RANGE_BYTES,
  GD_API,
  JUHE_API,
  XINGHAI_BACKEND_API,
  KUWO_SEARCH_API,
  KUWO_CONVERT_API,
  QQ_SEARCH_API,
  WY_SEARCH_API,
  CROSS_PLATFORM_NAMES,
  IKUN_API,
  HELLOWORLD_KW_CONVERT_API,
  REPORT_QUALITIES,
  kuwoUnescape,
  gdWyGetUrl,
  INFLIGHT_URL_MAX,
  buildInflightKey,
  sourceConfig,
  PLATFORM_NAMES,
};
