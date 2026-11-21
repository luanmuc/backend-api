'use strict';

/**
 * 巡检用固定探测歌 —— probe（payload 二次校验）与 source-audit（全源深度巡检）共用一份。
 *
 * 【为什么独立】
 * 此前 probe.js 的 PAYLOAD_CHECKS 与 source-audit.js 的 SONGS 各写一份「晴天」的 id，
 * 连 wy 的 id 都出现过「186016 是 VIP 无 url」与「2652820720 可用」两种写法。
 * 两个巡检用不同的歌，结论就无法互相对照，也没法解释"为什么这边通那边不通"。
 *
 * 【2026-11-21 修正：wy 不能用《晴天》】
 * 原文件假设「五平台都用《晴天》271 秒版本」，这个前提在 wy 上不成立 —— **网易云没有
 * 周杰伦版权**。实测 oiapi `Music_163?id=2652820720` 返回的是「晴天(深情版) / Lucky小爱」
 * （翻唱），不是周杰伦原版；网易云官方搜索「晴天 周杰伦」出来的也全是翻唱版。
 * 也就是说，此前 wy 分支拿翻唱版当「周杰伦《晴天》」在探测，声明与实物不符。
 * 因此 wy 改用网易云确实有版权、且实测能出链的《海阔天空》/ Beyond（id 347230，326 秒）。
 * 代价是五平台不再同名同曲，所以期望时长必须按平台取，不能再用单一 EXPECT_SEC。
 */
const SONGS = {
  kw: { name: '晴天', singer: '周杰伦', album: '叶惠美', duration: 271000, interval: 271, hash: '228908', rid: 228908, songmid: '228908', id: '228908' },
  // wy 与其余四平台不同曲：原因见文件头「wy 不能用《晴天》」。改回《晴天》前请先确认
  // 网易云拿到了周杰伦版权，否则等于又拿翻唱版冒充原版。
  wy: { name: '海阔天空', singer: 'Beyond', album: '', duration: 326000, interval: 326, id: 347230, songmid: '347230' },
  tx: { name: '晴天', singer: '周杰伦', album: '叶惠美', duration: 271000, interval: 271, songmid: '004Z8Ihr0JIu5s' },
  mg: { name: '晴天', singer: '周杰伦', album: '叶惠美', duration: 271000, interval: 271, songmid: '228908', id: '228908' },
  kg: { name: '晴天', singer: '周杰伦', album: '叶惠美', duration: 271000, interval: 271, hash: '228908', songmid: '228908' },
};

/** 默认期望时长（秒）—— 未单独声明的平台用它 */
const EXPECT_SEC = 271;

/** 取某平台的期望时长（秒）；wy 是《海阔天空》326s，其余为《晴天》271s */
function expectSecOf(platform) {
  const s = SONGS[platform];
  return s && typeof s.interval === 'number' ? s.interval : EXPECT_SEC;
}

/** 取某平台的探测歌；无该平台返回 null */
function songOf(platform) {
  return SONGS[platform] || null;
}

/** 取某平台探测歌的主 id（hash > songmid > id） */
function idOf(platform) {
  const s = SONGS[platform];
  if (!s) return null;
  return String(s.hash || s.songmid || s.id || '');
}

module.exports = { SONGS, songOf, idOf, EXPECT_SEC, expectSecOf };
