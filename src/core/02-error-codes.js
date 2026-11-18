// ============================================================
// v9.0 公共层 · 02-error-codes
// 职责：错误码常量表（18 个对外值，契约面 E0 直接校验）
// 依赖：无
// 来源：由 legacy.js 原样迁出（v9.0 第二刀）
// ============================================================
const ERROR_CODES = {
  NETWORK_TIMEOUT: 'NETWORK_TIMEOUT',
  // 预算耗尽不是上游超时：必须独立成码，不能计入源健康失败/摘除。
  BUDGET_EXHAUSTED: 'BUDGET_EXHAUSTED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  PARAM_ERROR: 'PARAM_ERROR',
  RATE_LIMIT: 'RATE_LIMIT',
  SERVER_ERROR: 'SERVER_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  MISMATCH: 'SONG_MISMATCH',
  CONFIG_ERROR: 'CONFIG_ERROR',
  LINK_EXPIRED: 'LINK_EXPIRED',   // v1.0：HTTP 410 签名/直链过期
  // v8.11：交付真实性闸门（wrapExecute 交付前用真实字节判定，取代靠 URL 关键词的死代码检测）
  PREVIEW_FRAGMENT: 'PREVIEW_FRAGMENT',   // 只拿到试听片段（如酷我 VIP 歌三档同给 5s）
  NOT_AUDIO: 'NOT_AUDIO',                 // 返回网页/JSON 等根本不是音频的内容
  STREAM_PLAYLIST: 'STREAM_PLAYLIST',     // m3u8 等流播放列表，播放器不支持
  TRUNCATED_MEDIA: 'TRUNCATED_MEDIA',     // P2：桥信封分片缺失/截断
  BAD_ENVELOPE: 'BAD_ENVELOPE',           // P2：桥信封长度或 base64 结构不符
  CONTRACT_ERROR: 'CONTRACT_ERROR',       // v8.13：Provider Contract 校验失败
  // v8.16.3（R-13）：本地拦截码——源/档位正在摘除期，或半开名额已被占用。
  // 它不是上游失败（请求根本没发出去），因此禁止记账、禁止写失败缓存、禁止触发跨平台重搜惩罚。
  PLAYBACK_FAILED: 'PLAYBACK_FAILED',
  CANCELED: 'CANCELED'                    // v8.13：竞速输家/预算耗尽后的协作式取消
};

module.exports = { ERROR_CODES };
