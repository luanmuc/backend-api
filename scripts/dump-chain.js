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

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'lx-source.js');
const JSON_OUT = process.argv.includes('--json');
const PLATFORMS = ['kw', 'wy', 'tx', 'mg', 'kg'];
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

const chains = {};
for (const platform of PLATFORMS) {
  chains[platform] = {};
  for (const quality of QUALITIES) {
    chains[platform][quality] = mod.buildSourceChain(platform, quality).map(h => h.id);
  }
}

const golden = {
  version: require(path.join(ROOT, 'package.json')).version,
  sourceHead: '0cba276',
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

// 模块加载会启动健康探测定时器；本脚本只生成静态快照，写完立即退出。
if (require.main === module) process.exit(0);
