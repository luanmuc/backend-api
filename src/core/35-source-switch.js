// ============================================================
// v9.0 业务层 · 35-source-switch（源开关：默认表 / 用户开关 / 自动关闭 / 手动关闭 / 运行时视图）
// 状态对象必须保持同一引用：userEnabled / autoOff / manualOff 被写时其它模块立即可见
// ============================================================

const SOURCE_TOGGLES = {
  // v8.16：13 个登记源 / 11 个上链源 / 2 个观察源。
  // 观察源（probation）默认关闭，只探测、不进播放链：suyinQQ(tx)、suyinMigu(mg)。
  suyinKuwo: true,      // 溯音酷我：五平台兜底（kw/wy/tx/mg/kg）
  wyOuter: true,        // 网易云官方 outer 直连：固定 128k 免费歌直链
  kuwoOfficial: true,   // 酷我官方直连：固定 128k 真实 mp3
  suyin163: true,       // 溯音163：免费歌真实 128k 直链
  xinghaiBackend: true, // 星海后端主域：kw 高音质双源 + 128k 兜底
  helloworldKw: true,   // helloworld(kw)：convert_url_with_sign 直链，kw 128k/320k/flac
  changqingVip: true,   // 长青：kw 128k 兜底
  huibq: false,         // Huibq：【保留，默认关闭】2026-11-20 关闭——11-16 起上游 onrender 服务被 owner 主动暂停
                        //（503「This service has been suspended by its owner.」，根路径同 503）；
                        // 11-04~11-15 曾连续 12 天全 200，属暂停而非冷启动；保留函数便于复活
                        // 2026-11-21 复测：kw 1424ms / wy 915ms 双档均为 HTTP 503，与关闭时记录一致
  juheTx: true,         // Juhe 聚合(tx)：tx 第四源，7 天复核
  qingliangTx: true,    // 晴亮(tx)：tx 主用第二源（2026-11-15 实测 5/5 全曲 320k），3 天复核
  luoyueTx: true,       // 落月(tx)：tx 第三源（R79 实测 128k/320k/flac 三档真音频，flac 55.39MB fLaC），3 天复核
  audius: true,         // Audius：第 6 平台 au（R80 实测 is_streamable 校验 + /stream 302→206 audio/mpeg），au 只有 mp3 128k/320k
  ikun: true,           // ikun：kw/wy 链尾兜底（公益版免卡密）
  suyinQQ: false,       // 观察源 suyinQQ(tx)：【已退役端点，保留函数】
                        // 2026-11-11 实测 HTTP 403；2026-11-21 复测升级结论：oiapi.net/api/QQ_Music
                        // 返回 HTTP 404 + code -13001「接口不存在或已下线」，br=4/5/7 三档响应完全一致
                        //（51~296ms）→ 这是端点级下线，不是歌级 404。接口若恢复，改回 true 即可复活
  suyinMigu: false      // 观察源 suyinMigu(mg)：【保留，等复核】
                        // 2026-11-11 实测上游 502；2026-11-21 复测真实上游 api.xcvts.cn/api/music/migu：
                        // HTTP 200 但 body code 502「咪咕搜索接口均不可用（服务器 IP 可能被咪咕限制）」，
                        //《海阔天空》《晴天》两首一致（140~162ms）→ 是上游中转 IP 被咪咕限，非我方问题。
                        // 注意 oiapi.net/api/Migu 也已 404，但该端点不在本源链路上，不据此定案。复核 2026-11-26
};

const userEnabled = { ...SOURCE_TOGGLES };

const autoOff = {}; // { [id]: true }

const autoOffReason = {}; // { [id]: 'AUTO_OFF_PROBE' | 'AUTO_OFF_UNREACHABLE' }

const autoOffAt = {}; // { [id]: timestamp }

function isUserEnabled(id) { return userEnabled[id] !== false; }

function isAutoOff(id) { return !!autoOff[id]; }

function effectiveEnabled(id) { return isUserEnabled(id) && !isAutoOff(id); }

// 普通对象 + defineProperty 动态 getter/setter 视图（勿改回 Proxy）。
// 来由更正（R82）：v9.2.0 曾把真机 `proxy: inconsistent get` 归因到这里的 `new Proxy({}, {...})`，
// R81 用产物行号对齐 + 引擎 so 版本（QuickJS CONFIG_VERSION 2024-02-14）实证后已推翻：
// 真根因是 `Date` 被包成 Proxy、宿主 preload 冻结 `Date.parse`（见 KNOWN_ISSUES K41 订正 / K42）。
// 这处改普通对象本身没错（少一个 Proxy 面），但不是当时的根因；Object.keys 走真实自有属性，各引擎一致。
const runtimeToggles = {};
for (const id of Object.keys(SOURCE_TOGGLES)) {
  Object.defineProperty(runtimeToggles, id, {
    enumerable: true,
    configurable: true,
    get() { return effectiveEnabled(id); },
    set(value) {
      userEnabled[id] = !!value;
      if (value) delete autoOff[id];
    },
  });
}

const manualOff = {};

const manualOffAt = {}; // v8.14：手动关闭时间，供快照 offAt 与诊断解释

module.exports = {
  SOURCE_TOGGLES,
  userEnabled,
  autoOff,
  autoOffReason,
  autoOffAt,
  isUserEnabled,
  isAutoOff,
  effectiveEnabled,
  runtimeToggles,
  manualOff,
  manualOffAt,
};
