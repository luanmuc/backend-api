'use strict';

/**
 * 巡检用固定探测歌 —— probe（payload 二次校验）与 source-audit（全源深度巡检）共用一份。
 *
 * 【为什么独立】
 * 此前 probe.js 的 PAYLOAD_CHECKS 与 source-audit.js 的 SONGS 各写一份「晴天」的 id，
 * 连 wy 的 id 都出现过「186016 是 VIP 无 url」与「2652820720 可用」两种写法。
 * 两个巡检用不同的歌，结论就无法互相对照，也没法解释"为什么这边通那边不通"。
 *
 * 统一口径：kw/wy/tx/mg/kg 五平台都用《晴天》271 秒版本，各平台用自己的主 id。
 * 这是"能力基线"：任何一端出不了这首歌的 128k，就是真的出不了链。
 */
const SONGS = {
  kw: { name: '晴天', singer: '周杰伦', album: '叶惠美', duration: 271000, interval: 271, hash: '228908', rid: 228908, songmid: '228908', id: '228908' },
  wy: { name: '晴天', singer: '周杰伦', album: '叶惠美', duration: 271000, interval: 271, id: 2652820720, songmid: '2652820720' },
  tx: { name: '晴天', singer: '周杰伦', album: '叶惠美', duration: 271000, interval: 271, songmid: '004Z8Ihr0JIu5s' },
  mg: { name: '晴天', singer: '周杰伦', album: '叶惠美', duration: 271000, interval: 271, songmid: '228908', id: '228908' },
  kg: { name: '晴天', singer: '周杰伦', album: '叶惠美', duration: 271000, interval: 271, hash: '228908', songmid: '228908' },
};

/** 期望时长（秒）—— payload 校验判定"片段"的基准 */
const EXPECT_SEC = 271;

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

module.exports = { SONGS, songOf, idOf, EXPECT_SEC };
