#!/usr/bin/env node
/**
 * P1 降级所有权静态审计（W 组）
 *
 * 验收目标：
 *   W1 inited 上报 5 个平台
 *   W2 每个平台都显式声明 fallbackOwner="source"
 *   W3 未声明时 App 会回退 host，因此源侧不能让字段缺失
 *
 * 运行：/usr/local/bin/node20 test/audit/w-fallback-owner.js
 */
'use strict'

const path = require('path')
const assert = require('assert')
const SRC = path.join(__dirname, '../../lx-source.js')

let inited = null
globalThis.lx = {
  EVENT_NAMES: { inited: 'inited', request: 'request', updateAlert: 'updateAlert' },
  version: '2.0.0',
  env: 'mobile',
  utils: { buffer: { from: (d, e) => Buffer.from(d, e), bufToString: (b, e) => b.toString(e) } },
  request(_url, _opts, cb) { setTimeout(() => cb(new Error('ECONNREFUSED'), null), 2) },
  on() {},
  send(name, data) { if (name === 'inited') inited = data },
}
globalThis.__lxSourceConfig = {}

const p = require.resolve(SRC)
if (require.cache[p]) delete require.cache[p]
require(SRC)

const platforms = ['kw', 'kg', 'tx', 'wy', 'mg']
let failures = 0
let checks = 0
const run = (name, fn) => {
  const id = name.split(' ')[0]
  try { fn(); checks++; console.log(`  ✓ [${id}] ${name}`) } catch (e) { failures++; console.error(`  ✗ [${id}] ${name}`); console.error(`    ${e.message}`) }
}

run('W1 inited 已上报', () => assert.ok(inited && inited.sources, '没有捕获到 inited'))
run('W2 5 个平台均声明 fallbackOwner=source', () => {
  for (const platform of platforms) {
    assert.ok(inited.sources[platform], `缺少平台 ${platform}`)
    assert.strictEqual(inited.sources[platform].fallbackOwner, 'source', `${platform} 未声明 fallbackOwner=source`)
  }
})

console.log(`\n===== P1 fallback owner 审计：${checks} 通过 / ${failures} 失败 =====`)
if (require.main === module) process.exit(failures ? 1 : 0)
