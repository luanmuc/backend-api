/**
 * R 组：N 组「无 ID 锚点」清单里剩下的行为断言（D-05 / D-06 / D-26）
 *
 * 背景：2026-11-10 复核 round4 §3.2 的 23 条无锚点修复，判定其中真正需要行为断言的 10 条。
 * D-01 已由 q-dfix Q3、D-04 已由 Q1/Q2、D-08 已由 Q4 覆盖；D-11/D-12 已有真保护
 * （e-extra S8 / stress-round3 T2，回退验证过），不重复造测。本组补剩余三条：
 *
 * R1  D-06  布尔配置键必须能表达 false（旧实现用 `||` 读配置，false 被吞成默认 true）
 * R2  D-05  配置白名单：真键 raceBudgetMs 可写且生效；死键 raceOverallTimeoutMs 必须被忽略
 * R3  D-26  buildSourceChain 不得给 mg 挂「必败」的星海备源（映射表只有 wy/tx/kw），
 *          且 kw 链必须仍能看到它（否则断言可能因源被关而恒真）
 */
const path = require('path');
const SRC = path.join(__dirname, '..', '..', 'lx-source.js');
const res = [];
const rec = (id, name, ok, detail) => { res.push({ id, name, ok, detail }); };

// D-06 需要在加载期注入配置：布尔键 false 必须真的生效（这是 __lxSourceConfig 的唯一真实入口）
globalThis.__lxSourceConfig = { verifyDelivery: false, previewUrlPreFilter: true, logEnabled: false };

let handler = null;
globalThis.lx = {
  EVENT_NAMES: { inited: 'inited', request: 'request', updateAlert: 'updateAlert' },
  version: '2.0.0',
  env: 'mobile',
  utils: { buffer: { from: (d, e) => Buffer.from(d, e), bufToString: (b, e) => b.toString(e) } },
  request(url, opts, cb) { setTimeout(() => cb(Object.assign(new Error('NETWORK_ERROR'), { code: 'NETWORK_ERROR' }), null), 2); },
  on(n, h) { if (n === 'request') handler = h; },
  send() {},
};

const src = require(SRC);
const dbg = src.__debug;

(async () => {
  // ── R1：D-06 布尔键 `??` 语义 ──
  try {
    const vf = dbg.cfg('verifyDelivery', true);
    const pre = dbg.cfg('previewUrlPreFilter', false);
    rec('R1', 'D-06：注入 verifyDelivery=false 必须真的取到 false（`||` 会吞成 true）',
      vf === false && pre === true,
      `verifyDelivery=${vf}（期望 false）previewUrlPreFilter=${pre}（期望 true）`);
  } catch (e) {
    rec('R1', 'D-06：布尔配置键', false, e.message);
  }

  // ── R2：D-05 白名单 ──
  try {
    const before = dbg.cfg('raceBudgetMs', 12000);
    await Promise.resolve(handler({ action: 'config', source: 'kw', info: { raceBudgetMs: 15000 } }));
    const after = dbg.cfg('raceBudgetMs', 12000);
    const dead = dbg.cfg('raceOverallTimeoutMs', 12000);   // 死键：不该被写入
    rec('R2', 'D-05：真键 raceBudgetMs 可写且生效、死键 raceOverallTimeoutMs 必须被忽略',
      before === 12000 && after === 15000 && dead === 12000,
      `写前=${before} 写后=${after} 死键读=${dead}`);
    await Promise.resolve(handler({ action: 'config', source: 'kw', info: { raceBudgetMs: 12000 } })); // 还原
  } catch (e) {
    rec('R2', 'D-05：配置白名单', false, e.message);
  }

  // ── R3：D-26 mg 不得挂星海备 ──
  try {
    await Promise.resolve(handler({ action: 'toggle', source: 'kw', info: { id: 'xinghaiBackup', enabled: true } }));
    const kwChain = src.buildSourceChain('kw', '128k').map(h => h.id);
    const mgChain = src.buildSourceChain('mg', '128k').map(h => h.id);
    rec('R3', 'D-26：开启星海备后 kw 链含它、mg 链不得含它',
      kwChain.includes('xinghaiBackup') && !mgChain.includes('xinghaiBackup'),
      `kw=[${kwChain.join(',')}] mg=[${mgChain.join(',')}]`);
    await Promise.resolve(handler({ action: 'toggle', source: 'kw', info: { id: 'xinghaiBackup', enabled: false } }));
  } catch (e) {
    rec('R3', 'D-26：星海备平台映射', false, e.message);
  }

  console.log('');
  for (const r of res) { const id = r.id; console.log(`${r.ok ? '✓' : '✗'} [${id}] ${r.name} — ${r.detail}`); }
  const fail = res.filter(r => !r.ok).length;
  console.log(`\nR 组（D 系列行为断言补测）汇总：${res.length - fail} 通过 / ${fail} 失败`);
  if (require.main === module) process.exit(fail ? 1 : 0);
})();
module.exports = { results: () => res };
