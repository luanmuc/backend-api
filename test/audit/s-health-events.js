#!/usr/bin/env node
/**
 * 2.4 方案 · 音源侧健康事件环形缓冲审计（S 组）
 *
 * 验收目标：
 *   S1  5 个平台的 actions 都声明 healthEvents
 *   S2  healthEvents 只读返回 {schema, capacity, dropped, events}
 *   S3  一次成功播放留下 play_start + source_attempt + source_result
 *   S4  一次失败播放留下 ok=false 且 code 非空
 *   S5  事件不含歌名 / URL 等隐私内容
 *   S6  超容后 dropped>0 且返回长度不超过容量
 *   S7  探测留下 probe_result
 *   S8  开关留下 config_change
 *   S9  返回副本，外部改动不污染环形缓冲
 *
 * 运行：/usr/local/bin/node20 test/audit/s-health-events.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const SRC = path.join(__dirname, '../../lx-source.js');

let handler = null;
let inited = null;
let current = null;
let scene = null;

const setLx = () => {
  handler = null;
  inited = null;
  globalThis.lx = {
    EVENT_NAMES: { inited: 'inited', request: 'request', updateAlert: 'updateAlert' },
    version: '2.0.0',
    env: 'mobile',
    utils: { buffer: { from: (d, e) => Buffer.from(d, e), bufToString: (b, e) => b.toString(e) } },
    request(url, opts, cb) {
      const u = String(url);
      let r;
      try {
        r = scene ? scene(u, opts) : { error: 'ECONNREFUSED' };
      } catch (e) {
        return setTimeout(() => cb(e, null), 2);
      }
      if (!r) r = { error: 'ECONNREFUSED' };
      const d = r.delay || 2;
      setTimeout(() => {
        if (r.error) return cb(Object.assign(new Error(r.error), { code: r.error }), null);
        cb(null, { statusCode: r.statusCode, headers: r.headers || {}, body: r.body ?? '', url: u });
      }, d);
    },
    on(n, h) { if (n === 'request') handler = h; },
    send(n, data) { if (n === 'inited') inited = data; },
  };
};

const load = () => {
  if (require.cache[require.resolve(SRC)]) delete require.cache[require.resolve(SRC)];
  return require(SRC);
};
const fresh = (toggles) => {
  setLx();
  const m = load();
  current = m;
  for (const k of Object.keys(m.runtimeToggles)) m.runtimeToggles[k] = toggles.includes(k);
  return m;
};
const call = (action, info, source = 'kw') => handler({ action, source, info });
const json = (o) => ({ statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });
const audio = (body, ct = 'audio/mpeg', tot = null) => ({
  statusCode: 206,
  headers: { 'content-type': ct, ...(tot ? { 'content-range': `bytes 0-1023/${tot}` } : {}) },
  body,
});
function mp3(sec) {
  const f = Math.max(0, Math.round(sec * 44100 / 1152));
  const b = Buffer.alloc(64);
  b[0] = 0xFF; b[1] = 0xFB; b[2] = 0x90; b[3] = 0x64;
  b.write('Xing', 36, 'ascii');
  b.writeUInt32BE(1, 40);
  b.writeUInt32BE(f, 44);
  return b;
}

const res = [];
const rec = (id, name, ok, detail) => {
  res.push({ id, ok: !!ok, name, detail: String(detail || '') });
  console.log(`${ok ? '✓' : '✗'} [${id}] ${name}${detail ? ' — ' + String(detail).slice(0, 240) : ''}`);
};
const eventsOf = async(traceId) => {
  try {
    return await call('healthEvents', traceId ? { traceId } : {});
  } catch (e) {
    return { schema: 0, capacity: 0, dropped: 0, events: [], error: e && e.message };
  }
};

(async () => {
  globalThis.__lxSourceConfig = { rateWindowMax: 100000, maxConcurrency: 100000, rateWindowMs: 3600000 };

  // ---------- S1 action 声明 ----------
  console.log('\n[S1] healthEvents action 声明');
  fresh(['suyinKuwo']);
  for (const pf of ['kw', 'wy', 'tx', 'kg', 'mg']) {
    const acts = inited && inited.sources && inited.sources[pf] && inited.sources[pf].actions;
    rec('S1', `${pf} 声明 healthEvents`, Array.isArray(acts) && acts.includes('healthEvents'), acts ? acts.join(',') : 'no actions');
  }

  // ---------- S2 初始只读结构 ----------
  console.log('\n[S2] healthEvents 初始返回结构');
  try {
    const r = await eventsOf();
    rec('S2', '返回 schema/capacity/dropped/events', r && r.schema === 1 && r.capacity >= 500 && Array.isArray(r.events) && typeof r.dropped === 'number', JSON.stringify(r).slice(0, 160));
  } catch (e) {
    rec('S2', 'healthEvents 可调用', false, e && e.message);
  }

  // ---------- S3 成功播放事件链 ----------
  console.log('\n[S3] 成功播放：play_start + source_attempt + source_result');
  fresh(['suyinKuwo']);
  scene = (u) => u.includes('audio.test')
    ? audio(mp3(200), 'audio/mpeg', 8000000)
    : json({ data: { url: 'https://audio.test/SECRET_URL.mp3' } });
  const traceOk = 'trace-ok-001';
  await call('musicUrl', { type: '128k', traceId: traceOk, musicInfo: { name: 'SECRET_SONG_NAME', singer: 'S', songmid: 'ok1', hash: 'OK1' } }, 'kw').catch(() => null);
  {
    const r = await eventsOf(traceOk);
    const types = r.events.map(e => e.event);
    rec('S3', '成功链含 play_start', types.includes('play_start'), types.join(','));
    rec('S3', '成功链含 source_attempt', types.includes('source_attempt'), types.join(','));
    rec('S3', '成功链含 source_result 且 ok=true', r.events.some(e => e.event === 'source_result' && e.ok === true), types.join(','));
    // R27：原判据 `r.events.every(e => e.traceId === traceOk)` 是恒真的——eventsOf(traceId) 已经把结果
    // 按 traceId 过滤过了，再断言「每条都带这个 traceId」不可能失败。拆成两条真判据：
    // ① 过滤真生效：不存在的 traceId 必须返回 0 条；② 返回的事件确实带 traceId 且非空。
    const none = await eventsOf('trace-does-not-exist');
    rec('S3', '不存在的 traceId 返回 0 条（过滤真生效）', none.events.length === 0, `len=${none.events.length}`);
    rec('S3', '事件确实带 traceId', r.events.length > 0 && r.events.every(e => e.traceId === traceOk), `${r.events.length} 条`);
  }

  // ---------- S4 失败播放事件 ----------
  console.log('\n[S4] 失败播放：source_result ok=false 且 code 非空');
  fresh(['suyinKuwo']);
  scene = () => ({ statusCode: 500, headers: { 'content-type': 'text/plain' }, body: 'upstream down' });
  const traceFail = 'trace-fail-001';
  await call('musicUrl', { type: '128k', traceId: traceFail, musicInfo: { name: 'SECRET_SONG_NAME', singer: 'S', songmid: 'fail1', hash: 'F1' } }, 'kw').catch(() => null);
  {
    const r = await eventsOf(traceFail);
    const fail = r.events.find(e => e.event === 'source_result' && e.ok === false);
    rec('S4', '失败链有 source_result ok=false', !!fail, fail ? JSON.stringify(fail) : 'none');
    rec('S4', '失败 code 非空', !!(fail && fail.code), fail ? String(fail.code) : 'none');
  }

  // ---------- S5 隐私 ----------
  console.log('\n[S5] 事件不含歌名 / URL');
  {
    // R27：原写法在 S4 的 fresh() 之后还去查 traceOk —— 重载已清空环形缓冲，结果是**空数组上恒真**
    // （detail 打印出来就是 `[]`，两条隐私断言永远不可能失败）。改为查整条缓冲（含 S4 那首
    // SECRET_SONG_NAME 的失败链），并要求非空。
    const r = await eventsOf();
    const text = JSON.stringify(r.events);
    rec('S5', '不含歌名 SECRET_SONG_NAME', r.events.length > 0 && !text.includes('SECRET_SONG_NAME'), `${r.events.length} 条 / ${text.slice(0, 120)}`);
    rec('S5', '不含 URL SECRET_URL', r.events.length > 0 && !text.includes('SECRET_URL') && !text.includes('audio.test'), `${r.events.length} 条`);
    // R27：S5 的两条是行为层抽样，真正的隐私保证是 `recordHealthEvent` 的**字段白名单**
    // （HEALTH_EVENT_FIELDS）——注入任意未知字段会被直接丢弃（已实测：往 play_start 里塞
    // `songName:"SECRET_SONG_NAME"` 后事件里根本没有该字段，S5 依然绿）。
    // 所以白名单本身必须守：一旦有人把 name/url/songmid 加进去，行为层抽样未必覆盖得到。
    const srcText = fs.readFileSync(SRC, 'utf8');
    const wl = srcText.match(/(?:const|var|let) HEALTH_EVENT_FIELDS = \[([^\]]*)\]/);
    const fields = wl ? wl[1].split(',').map(x => x.trim().replace(/['"]/g, '')).filter(Boolean) : [];
    const risky = fields.filter(f => /^(name|songName|singer|url|hash|songmid|traceUrl|lyric)$/.test(f));
    rec('S5', '事件字段白名单不含隐私字段（结构性保证）',
      fields.length > 0 && risky.length === 0,
      `白名单 ${fields.length} 字段${risky.length ? '，含隐私字段: ' + risky.join(',') : '，无 name/url/songmid'}`);
  }

// ---------- S5b 运行时守备（白名单的「结构性判据」现在有源码侧对偶） ----------
  console.log('\n[S5b] 事件字段运行时守备');
  {
    const dbg2 = current.__debug;
    const before = typeof dbg2.getHealthEventFieldAudit === 'function' ? dbg2.getHealthEventFieldAudit() : null;
    dbg2.recordHealthEvent({
      traceId: 'audit-x', event: 'play_start',
      name: 'SECRET_SONG_NAME', url: 'https://secret.example/a.mp3', account: 'SECRET_USER', extraUnknownField: 'x',
    });
    const after = typeof dbg2.getHealthEventFieldAudit === 'function' ? dbg2.getHealthEventFieldAudit() : null;
    const ev = dbg2.getHealthEvents({ traceId: 'audit-x' }).events[0] || {};
    const leaked = ['name', 'url', 'account'].filter(k => k in ev);
    rec('S5b', '未知/隐私字段被丢弃且被计数（不再静默吞）',
      !!after && leaked.length === 0
      && after.privacyDropped >= (before ? before.privacyDropped : 0) + 3
      && (after.unknown || []).includes('extraUnknownField')
      // 隐私键单独计数（不进 unknown 名单）：3 个隐私键（name/url/account）
      && !(after.unknown || []).includes('name') && !(after.unknown || []).includes('url'),
      after ? `privacy=${after.privacyDropped} unknown=[${(after.unknown || []).join(',')}] 泄漏=[${leaked.join(',')}]` : '未导出 getHealthEventFieldAudit');

    // 白名单被塞隐私字段时必须加载即炸（而不是等行为层抽样偶然发现）
    const wl = dbg2.HEALTH_EVENT_FIELDS;
    let threw = false;
    if (wl && typeof dbg2.assertEventFieldPolicy === 'function') {
      wl.push('songName');
      try { dbg2.assertEventFieldPolicy(); } catch (e) { threw = true; }
      finally { wl.pop(); }
    }
    rec('S5b', '白名单含隐私字段 → 策略校验抛 CONTRACT_ERROR',
      threw, threw ? 'ok' : (wl ? '未抛（策略缺失或未导出）' : 'HEALTH_EVENT_FIELDS 未导出'));
    // 加载即守：产物里必须在顶层调用一次，否则「以后再加字段」仍要等人跑测试才知道
    const srcText2 = fs.readFileSync(SRC, 'utf8');
    rec('S5b', '产物加载时即执行字段策略（顶层调用存在）',
      /assertEventFieldPolicy\(\);/.test(srcText2), '源码里找到顶层 assertEventFieldPolicy() 调用');
  }

  // ---------- S7 探测事件 ----------
  console.log('\n[S7] 探测：probe_result');
  fresh(['suyinKuwo']);
  scene = (u) => u.includes('audio.test')
    ? audio(mp3(200), 'audio/mpeg', 8000000)
    : json({ data: { url: 'https://audio.test/SECRET_URL.mp3' } });
  try {
    const pc = current.buildProbeConfig()['suyinKuwo'];
    if (!pc) throw new Error('buildProbeConfig 没有 suyinKuwo');
    await current.__debug.probeSingleSource('suyinKuwo', pc);
    const r = await eventsOf();
    const pe = r.events.filter(e => e.event === 'probe_result');
    rec('S7', '探测留下 probe_result', pe.length > 0, `${pe.length} 条`);
    rec('S7', '探测字段含 sourceId 与 ok', pe.every(e => e.sourceId === 'suyinKuwo' && typeof e.ok === 'boolean'), JSON.stringify(pe[0] || {}));
  } catch (e) {
    rec('S7', '探测事件可生成', false, e && e.message);
  }

  // ---------- S8 开关事件 ----------
  console.log('\n[S8] 开关：config_change');
  try {
    current.__debug.toggleSource('suyinKuwo', false);
    const r = await eventsOf();
    const ce = r.events.filter(e => e.event === 'config_change');
    rec('S8', '开关留下 config_change', ce.length > 0, `${ce.length} 条`);
    rec('S8', 'config_change 含 sourceId 与 reason', ce.every(e => e.sourceId === 'suyinKuwo' && typeof e.reason === 'string'), JSON.stringify(ce[0] || {}));
    current.__debug.toggleSource('suyinKuwo', true);
  } catch (e) {
    rec('S8', '开关事件可生成', false, e && e.message);
  }

  // ---------- S9 返回副本 ----------
  console.log('\n[S9] 返回副本，外部改动不污染');
  try {
    const a = await eventsOf();
    if (a.events.length) {
      a.events[0].code = 'MUTATED';
      const b = await eventsOf();
      rec('S9', '外部改动不回写', b.events[0].code !== 'MUTATED', `first=${JSON.stringify(b.events[0]).slice(0, 120)}`);
    } else {
      rec('S9', '有事件可验证副本', false, 'events 为空');
    }
  } catch (e) {
    rec('S9', '副本可验证', false, e && e.message);
  }

  // ---------- S6 容量 ----------
  console.log('\n[S6] 环形缓冲容量');
  fresh(['suyinKuwo']);
  scene = () => ({ statusCode: 500, headers: { 'content-type': 'text/plain' }, body: 'down' });
  for (let i = 0; i < 620; i++) {
    await call('musicUrl', { type: '128k', traceId: `cap-${i}`, musicInfo: { name: 'N', singer: 'S', songmid: `cap${i}`, hash: `C${i}` } }, 'kw').catch(() => null);
  }
  {
    const r = await eventsOf();
    rec('S6', '返回长度不超过容量', r.events.length <= r.capacity, `len=${r.events.length} cap=${r.capacity}`);
    rec('S6', 'dropped > 0', r.dropped > 0, `dropped=${r.dropped}`);
    rec('S6', '容量为 500', r.capacity === 500, `cap=${r.capacity}`);
  }

  const failed = res.filter(x => !x.ok);
  console.log(`\n===== S 组汇总：${res.length - failed.length} 通过 / ${failed.length} 失败 =====`);
  if (failed.length) {
    console.log('失败项：');
    for (const f of failed) console.log(`  - [${f.id}] ${f.name} — ${f.detail}`);
    __exit(1);
  }
  __exit(0);
})().catch(e => {
  console.error('审计脚本自身异常：', e);
  __exit(1);
});

// __exit(R25)：被 require 时只设退出码，绝不 process.exit 杀掉调用方（脚本独立运行时行为不变）。
// 用函数声明写在这里：声明会提升到模块顶层，IIFE / 内部函数里的调用都能找到它。
function __exit(code) {
  if (require.main === module) process.exit(code);
  else process.exitCode = Number(code) || 0;
}
