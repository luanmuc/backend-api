// 真实宿主桩：按 lx 移动端 request 契约实现（真 https + 302 跟随 + Range + binary）
const http = require('http');
const https = require('https');
const { URL } = require('url');

let callCount = 0;
const calls = [];

function rawOnce(url, opts) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const mod = u.protocol === 'https:' ? https : http;
    const timeout = opts.timeout || 5000;
    const req = mod.request({
      protocol: u.protocol, hostname: u.hostname, port: u.port || undefined,
      path: u.pathname + u.search, method: opts.method || 'GET',
      headers: opts.headers || {},
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          url,
          body: opts.binary ? buf : buf.toString('utf8'),
          _raw: buf,
        });
      });
    });
    req.setTimeout(timeout, () => { req.destroy(new Error(`timeout of ${timeout}ms`)); });
    req.on('error', reject);
    if (opts.body) req.write(typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body));
    req.end();
  });
}

async function request(url, opts = {}, cb) {
  callCount += 1;
  const followMax = Number(opts.follow_max || 0);
  const t0 = Date.now();
  try {
    let res = await rawOnce(url, opts);
    let hops = 0;
    while (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && hops < followMax) {
      hops += 1;
      const next = new URL(res.headers.location, url).toString();
      res = await rawOnce(next, { ...opts, method: 'GET', body: undefined });
    }
    const hdrs = opts.headers || {};
    const rec = { url, status: res.statusCode, ms: Date.now() - t0, hops, range: !!(hdrs.Range || hdrs.range) };
    calls.push(rec);
    cb(null, res);
  } catch (e) {
    calls.push({ url, error: e.message, ms: Date.now() - t0 });
    cb(e, null);
  }
}

function createHost(extraConfig = {}) {
  const sent = [];
  const handlers = {};
  globalThis.__lxSourceConfig = Object.assign({
    logEnabled: false, logDebug: false,
  }, extraConfig);
  globalThis.lx = {
    EVENT_NAMES: { inited: 'inited', request: 'request', updateAlert: 'updateAlert' },
    version: '2.0.0',
    env: 'mobile',
    utils: {
      buffer: {
        from: (d, e) => Buffer.from(d, e),
        bufToString: (b, e) => Buffer.from(b).toString(e),
      },
    },
    request,
    on(name, fn) { handlers[name] = fn; },
    send(name, data) { sent.push({ name, data }); },
  };
  return { sent, handler: (payload) => handlers.request(payload), get calls() { return calls; }, stats: () => ({ count: callCount, calls: calls.slice() }) };
}

module.exports = { createHost };
