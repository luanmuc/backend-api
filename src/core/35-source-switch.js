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
  huibq: true,          // Huibq：kw/wy 链尾兜底（冷启动源）
  juheTx: true,         // Juhe 聚合(tx)：tx 第三源，7 天复核
  qingliangTx: true,    // 晴亮(tx)：tx 主用第二源（2026-11-15 实测 5/5 全曲 320k），3 天复核
  ikun: true,           // ikun：kw/wy 链尾兜底（公益版免卡密）
  suyinQQ: false,       // 观察源：2026-11-11 实测 HTTP 403，只探测，不进链，复核 2026-11-19
  suyinMigu: false      // 观察源：2026-11-11 实测上游 502，只探测，不进链，复核 2026-11-26
};

const userEnabled = { ...SOURCE_TOGGLES };

const autoOff = {}; // { [id]: true }

const autoOffReason = {}; // { [id]: 'AUTO_OFF_PROBE' | 'AUTO_OFF_UNREACHABLE' }

const autoOffAt = {}; // { [id]: timestamp }

function isUserEnabled(id) { return userEnabled[id] !== false; }

function isAutoOff(id) { return !!autoOff[id]; }

function effectiveEnabled(id) { return isUserEnabled(id) && !isAutoOff(id); }

const runtimeToggles = new Proxy({}, {
  get(_t, id) {
    if (typeof id !== "string") return undefined;
    return effectiveEnabled(id);
  },
  set(_t, id, value) {
    if (typeof id !== "string") return false;
    userEnabled[id] = !!value;
    if (value) delete autoOff[id];
    return true;
  },
  has(_t, id) { return typeof id === "string" && id in userEnabled; },
  ownKeys() { return Object.keys(userEnabled); },
  getOwnPropertyDescriptor() { return { enumerable: true, configurable: true }; },
});

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
