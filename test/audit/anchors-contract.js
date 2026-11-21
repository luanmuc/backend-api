#!/usr/bin/env node
/**
 * v9.1.6（K30 后续）：anchors 声明一致性门禁。
 *
 * 【为什么需要】
 * anchors 从 provider() 引入起就是个**只被声明、从未被读取**的死字段。
 * 正因为没人查，它可以随便写错而多年不暴露——2026-11-21 实测发现：
 *   · suyinKuwo / kuwoOfficial / suyinMigu 的实现**完全按歌名搜索**，却声明着 rid/songmid/id
 *   · huibq / ikun 实现读 hash ?? songmid ?? songId（不读 rid），声明里却有 rid
 *   · tx 家族声明 musicId，但 getQQSongId 只认 meta.mid/songmid/id，musicId 只是透传
 * 一旦有人（比如 K30 的 B 方案）真把它当约束用，这些错声明就会把能用的源误剔出链。
 *
 * 【判据】
 * ①anchors 必须显式声明，不许依赖工厂默认值。
 * ②声明 [] = 明示「不依赖任何 id 键」。这类源在完全不给 id 时必须不因缺 id 而报错。
 * ③声明非空 = 「我认这些键」。对**每一个**声明的键单独验证：只给这一个键（并按链层约定
 *   把 getHashOrMid(songInfo) 传进第二个参数）时若仍报「缺 id」，说明实现根本不认这个键。
 * ④巡检样本覆盖：每个平台的探测歌必须带齐该平台所有源 anchors 的并集。
 *
 * 全程用 mock 宿主，不联网。
 */
const path = require('path');

const SRC = path.resolve(__dirname, '..', '..', 'lx-source.js');
const NO_ID_SONG = { name: '晴天', singer: '周杰伦', interval: '04:31' };

// M9：process.exit 只出现在这个 helper 体内（被静态检查豁免），调用点用 __exit。
function __exit(code) {
  process.exit(code)
}

function installMockHost() {
  globalThis.lx = {
    EVENT_NAMES: { request: 0 },
    request(url, opts, cb) {
      const err = new Error('mock: network disabled');
      err.code = 'ECONNREFUSED';
      if (typeof cb === 'function') setTimeout(() => cb(err, null), 0);
    },
    on() {},
    send() {},
  };
}

// 源仓有一批 handler 抛错时只把 PARAM_ERROR 写进 message 前缀、不设 err.code，
// 早期靠外层 extractErrorCode 从消息里抠。判定要同时认 code 与消息前缀。
function isMissingIdError(e) {
  if (!e) return false;
  const code = String(e.code || '');
  const msg = String(e.message || '');
  const looksParam = code === 'PARAM_ERROR' || /^PARAM_ERROR\b/.test(msg) || msg.includes('PARAM_ERROR:');
  if (!looksParam) return false;
  return /缺少|需要|缺|missing|require/i.test(msg) && /id|songmid|rid|hash|musicId|copyrightId/i.test(msg);
}

async function run() {
  installMockHost();
  let mod;
  try {
    mod = require(SRC);
  } catch (e) {
    console.log('✗ 无法加载产物：' + String(e.message).slice(0, 80));
    return 1;
  }

  const handlers = Object.values(mod.SOURCE_HANDLERS || {});
  const fails = [];
  let pass = 0;

  for (const h of handlers) {
    if (!Array.isArray(h.anchors)) {
      fails.push('[' + h.id + '] anchors 未显式声明（不要依赖工厂默认值）');
      continue;
    }
    const plats = (h.platforms || []).slice(0, 2);
    let probed = 0;
    let needsIdWithoutAnchors = false;
    for (const plat of plats) {
      try {
        await h.fn(plat, null, '128k', NO_ID_SONG);
        probed++;
      } catch (e) {
        probed++;
        if (isMissingIdError(e)) needsIdWithoutAnchors = true;
      }
    }
    if (probed === 0) continue;

    if (h.anchors.length === 0) {
      if (needsIdWithoutAnchors) {
        fails.push('[' + h.id + '] 声明 anchors=[]（不依赖 id），但实现因缺 id 抛 PARAM_ERROR —— 声明与实现矛盾');
      } else {
        pass++;
      }
      continue;
    }

    const badKeys = [];
    for (const k of h.anchors) {
      const one = { name: '晴天', singer: '周杰伦', interval: '04:31' };
      one[k] = k === 'rid' ? 228908 : '228908';
      // 链层实际给 handler 的第二个参数是 getHashOrMid(songInfo)，必须同样模拟，
      // 否则「靠 songId 参数间接认 id」的源会被误判成不认 id。
      const paramId = one.hash ?? one.songmid ?? one.id ?? null;
      let accepted = true;
      for (const plat of plats) {
        try {
          await h.fn(plat, paramId, '128k', one);
        } catch (e) {
          if (isMissingIdError(e)) { accepted = false; break; }
        }
      }
      if (!accepted) badKeys.push(k);
    }
    if (badKeys.length === 0) {
      pass++;
    } else {
      fails.push('[' + h.id + '] 声明的 ' + badKeys.join('/') + ' 单独给上仍报缺 id —— 实现并不认这些键，声明应删除');
    }
  }

  const { SONGS } = require(path.resolve(__dirname, '..', '..', 'scripts', 'lib', 'probe-songs.js'));
  let probePass = 0;
  for (const plat of ['kw', 'wy', 'tx', 'mg', 'kg']) {
    const union = new Set();
    for (const h of handlers) {
      if ((h.platforms || []).includes(plat)) for (const k of (h.anchors || [])) union.add(k);
    }
    const song = SONGS[plat];
    if (!song) { fails.push('[probe-songs] 平台 ' + plat + ' 没有探测歌样本'); continue; }
    const missing = [...union].filter(k => song[k] === undefined || song[k] === null || song[k] === '');
    if (missing.length) {
      fails.push('[probe-songs] ' + plat + ' 样本缺少该平台 anchors 并集里的 ' + missing.join('/') + '（并集：' + [...union].join('/') + '）');
    } else probePass++;
  }

  const id = 'A1';
  for (const f of fails) console.log('✗ ' + '[' + id + '] ' + f);
  console.log('[' + id + '] anchors 声明一致性：' + pass + ' 通过 / ' + fails.length + ' 失败（共 ' + handlers.length + ' 源）');
  console.log('[' + id + '] 巡检样本锚点覆盖：' + probePass + '/5 平台带齐并集');
  return fails.length ? 1 : 0;
}

module.exports = { run };

// M9：被别的脚本 require 时不得直接退出进程，只有直接运行才设置退出码
if (require.main === module) {
  // 源仓加载后会启动健康探测定时器，只设 exitCode 进程不会退；这里必须显式结束，
  // 且该调用被 require.main 守卫包住（M9 合规）。
  run().then(code => { __exit(code) }).catch(e => {
    console.log('✗ ' + '[' + 'A1' + '] 脚本异常：' + String(e && e.message).slice(0, 100));
    __exit(1);
  });
}
