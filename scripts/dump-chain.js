#!/usr/bin/env node
/**
 * v8.13 链序 golden 生成器
 *
 * 只导出 10 个 active 源的 5 平台 × 4 音质链序，观察源不得进入。
 * 用法：
 *   node scripts/dump-chain.js           # 人读表格
 *   node scripts/dump-chain.js --json    # 写入 test/fixtures/chain-golden.json
 */
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'lx-source.js');
const JSON_OUT = process.argv.includes('--json');
const PLATFORMS = ['kw', 'wy', 'tx', 'mg', 'kg', 'au'];
const QUALITIES = ['128k', '320k', 'flac', 'flac24bit'];

// 最小宿主桩：只用于加载模块，不发起任何网络请求。
globalThis.lx = {
  EVENT_NAMES: { inited: 'inited', request: 'request', updateAlert: 'updateAlert' },
  version: '2.6.0',
  env: 'mobile',
  utils: { buffer: { from: (d, e) => Buffer.from(d, e), bufToString: (b, e) => b.toString(e) } },
  request: () => { throw new Error('dump-chain 不应发起请求'); },
  on() {},
  send() {},
};
const mod = require(SRC);
for (const id of Object.keys(mod.SOURCE_HANDLERS)) {
  if (mod.SOURCE_HANDLERS[id].lifecycle === 'active') mod.runtimeToggles[id] = true;
}

function main() {
  const chains = {};
  for (const platform of PLATFORMS) {
    chains[platform] = {};
    for (const quality of QUALITIES) {
      chains[platform][quality] = mod.buildSourceChain(platform, quality).map(h => h.id);
    }
  }

  const golden = {
    version: require(path.join(ROOT, 'package.json')).version,
    // v8.15.1（R18）：原为写死的 `'0cba276'`——一提交就过期，fixture 里的「基线提交」长期指向
    // 一个和当前链序无关的历史提交。改为生成时读真实 HEAD（读不到时标 unknown，不猜）。
    sourceHead: (() => {
      try { return execSync('git rev-parse --short HEAD', { cwd: ROOT, encoding: 'utf8' }).trim(); }
      catch (e) { return 'unknown'; }
    })(),
    platforms: chains,
  };

  if (JSON_OUT) {
    const out = path.join(ROOT, 'test', 'fixtures', 'chain-golden.json');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(golden, null, 2) + '\n');
    console.log(`wrote ${path.relative(ROOT, out)}`);
  } else {
    for (const platform of PLATFORMS) {
      for (const quality of QUALITIES) {
        console.log(`${platform} ${quality}: ${chains[platform][quality].join(' -> ') || '(empty)'}`);
      }
    }
  }
}

// 模块加载会启动健康探测定时器；本脚本只生成静态快照，写完立即退出。
// v8.15.1（R15）：被 require 时（如 require-safety 门禁）不得生成文件、不得 exit。
if (require.main === module) {
  main();
  process.exit(0);
}
module.exports = { main };
