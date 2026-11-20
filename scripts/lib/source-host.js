'use strict';

/**
 * 真实 HTTP 宿主 —— 让 `lx-source.js` 以为自己跑在 App 里，从而能直接调用它的 provider。
 *
 * 【为什么需要】
 * 巡检脚本曾经用手写的 HTTP 请求复刻每个源的取链逻辑（probe.js 的 PAYLOAD_CHECKS）。
 * 结果：`legacy.js` 的 suyin163 已改成兼容 `data[] / data.items[] / data{url}` 三形态，
 * 而 PAYLOAD_CHECKS 仍只认 `data[0].url` —— 源修好了，巡检还说它坏（2026-11-20 实测）。
 * 取链逻辑必须**只有一份**：源自己那一份。巡检只负责喂 mock 宿主 + 判可播。
 *
 * 【边界】
 * 只提供 `lx` 全局的最小面（EVENT_NAMES / version / env / utils.buffer / request / on / send）。
 * `request` 走真实网络并跟随 302（与 App 侧 `follow_max` 语义一致，默认 5 跳）。
 * 加载时对 `console.log` 做静默——`lx-source.js` 的初始化日志不该污染巡检的 stdout。
 */
const http = require('http');
const https = require('https');
const path = require('path');

const SRC_PATH = path.resolve(__dirname, '..', '..', 'lx-source.js');

/**
 * 造一个真实网络宿主。
 * @param {{timeout?:number, followMax?:number}} opts
 */
function createHost(opts = {}) {
  const timeout = opts.timeout || 9000;
  const followMax = opts.followMax || 5;
  let requestHandler = null;

  function request(url, reqOpts, cb) {
    const visit = (u, depth) => {
      let lib;
      try { lib = new URL(u).protocol === 'https:' ? https : http; }
      catch (e) { return cb(e, null); }
      const req = lib.request(u, {
        method: (reqOpts && reqOpts.method) || 'GET',
        headers: (reqOpts && reqOpts.headers) || {},
        timeout,
      }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && depth < followMax) {
          res.resume();
          let next;
          try { next = new URL(res.headers.location, u).toString(); }
          catch (e) { return cb(null, { statusCode: res.statusCode, headers: res.headers, body: '' }); }
          return visit(next, depth + 1);
        }
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => cb(null, {
          statusCode: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks).toString('utf-8'),
        }));
      });
      req.on('timeout', () => { req.destroy(); cb(new Error('timeout'), null); });
      req.on('error', e => cb(e, null));
      if (reqOpts && reqOpts.body) req.write(reqOpts.body);
      req.end();
    };
    try { visit(String(url), 0); } catch (e) { cb(e, null); }
  }

  return { request, onRequestHandler: h => { requestHandler = h; }, getHandler: () => requestHandler };
}

/**
 * 加载 lx-source.js 产物。
 * @returns {{ mod:any, host:any }}
 */
function loadSource(opts = {}) {
  const host = createHost(opts);
  globalThis.lx = {
    EVENT_NAMES: { inited: 'inited', request: 'request', updateAlert: 'updateAlert' },
    version: '2.6.0',
    env: 'mobile',
    utils: { buffer: { from: (d, e) => Buffer.from(d, e), bufToString: (b, e) => b.toString(e) } },
    request: host.request,
    on(name, handler) { if (name === 'request') host.onRequestHandler(handler); },
    send() {},
  };
  const realLog = console.log;
  console.log = () => {};
  let mod;
  try { mod = require(SRC_PATH); }
  finally { console.log = realLog; }
  return { mod, host };
}

/**
 * 用源自己的 provider 取一条真实直链。
 * @param mod  loadSource().mod
 * @param {{src:string, plat:string, quality:string, song:object}} spec
 * @returns {Promise<string>} 直链（失败抛错）
 */
async function resolveUrl(mod, spec) {
  const h = mod && mod.SOURCE_HANDLERS && mod.SOURCE_HANDLERS[spec.src];
  if (!h || typeof h.fn !== 'function') throw new Error(`未知源或源无 fn：${spec.src}`);
  const quality = spec.quality || '128k';
  const url = await h.fn(spec.plat, spec.id, quality, spec.song);
  if (!url || typeof url !== 'string') throw new Error(`${spec.src} 未返回直链`);
  return url;
}

module.exports = { SRC_PATH, createHost, loadSource, resolveUrl };
