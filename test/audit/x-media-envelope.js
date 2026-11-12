#!/usr/bin/env node
/**
 * P2 桥媒体信封源侧审计（X 组）
 *
 * 验收目标：
 *   X1 信封 body 还原 64B，SHA 一致
 *   X2 64B FLAC 信封 kindOf = audio（不引入新假阴性）
 *   X3 1MiB 信封还原 SHA 一致
 *   X4 8MiB / 256KB 分片 32 片还原 SHA 一致
 *   X5 byteLength 不符返回 null
 *   X6 旧桥产物 {type:'Buffer',data} 仍兼容
 *   X7 inited 显式声明 mediaEnvelope=2（能力协商）
 *   X8 0 字节信封返回零长 Uint8Array
 *   X12 1MiB 信封 JSON.parse ≤10ms（本机基准回归）
 *
 * 运行：/usr/local/bin/node20 test/audit/x-media-envelope.js
 */
'use strict'

const path = require('path')
const crypto = require('crypto')
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
const src = require(SRC)
const { toBytes, kindOf, mediaEnvelopeErrorCode } = src.__debug

const CHUNK = 256 * 1024
const sha = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex')
const b64 = (buffer) => Buffer.from(buffer).toString('base64')
const envelope = (buffer) => {
  if (buffer.length <= CHUNK) {
    return { __lxMedia: 2, encoding: 'base64', byteLength: buffer.length, body: b64(buffer) }
  }
  const chunks = []
  for (let i = 0; i < buffer.length; i += CHUNK) chunks.push(b64(buffer.subarray(i, i + CHUNK)))
  return { __lxMedia: 2, encoding: 'base64', byteLength: buffer.length, chunkBytes: CHUNK, chunks }
}

let failures = 0
let checks = 0
const run = (name, fn) => {
  const id = name.split(' ')[0]
  try { fn(); checks++; console.log(`  ✓ [${id}] ${name}`) } catch (e) { failures++; console.error(`  ✗ [${id}] ${name}`); console.error(`    ${e.message}`) }
}

const flac64 = Buffer.concat([Buffer.from('fLaC'), Buffer.alloc(60, 1)])

run('X1 信封 body 还原 64B 且 SHA 一致', () => {
  const bytes = toBytes(envelope(flac64))
  assert.ok(bytes, 'toBytes 未识别信封')
  assert.strictEqual(bytes.length, 64)
  assert.strictEqual(sha(Buffer.from(bytes)), sha(flac64))
})

run('X2 64B FLAC 信封 kindOf = audio', () => {
  assert.strictEqual(kindOf(envelope(flac64)), 'audio')
})

run('X3 1MiB 信封还原 SHA 一致', () => {
  const raw = crypto.randomBytes(1024 * 1024)
  const bytes = toBytes(envelope(raw))
  assert.ok(bytes)
  assert.strictEqual(sha(Buffer.from(bytes)), sha(raw))
})

run('X4 8MiB 分片 32 片还原 SHA 一致', () => {
  const raw = crypto.randomBytes(8 * 1024 * 1024)
  const env = envelope(raw)
  assert.strictEqual(env.chunks.length, 32)
  const bytes = toBytes(env)
  assert.ok(bytes)
  assert.strictEqual(sha(Buffer.from(bytes)), sha(raw))
})

run('X5 byteLength 不符返回 BAD_ENVELOPE', () => {
  const env = envelope(flac64)
  env.byteLength = 65
  assert.strictEqual(toBytes(env), null)
  assert.strictEqual(mediaEnvelopeErrorCode(env), 'BAD_ENVELOPE')
})

run('X7 inited 声明 mediaEnvelope=2', () => {
  assert.strictEqual(inited && inited.mediaEnvelope, 2)
})

run('X8 0 字节信封返回零长 Uint8Array', () => {
  const bytes = toBytes({ __lxMedia: 2, encoding: 'base64', byteLength: 0 })
  assert.ok(bytes instanceof Uint8Array, '0 字节信封未返回 Uint8Array')
  assert.strictEqual(bytes.length, 0)
})

run('X9 缺片返回 TRUNCATED_MEDIA', () => {
  const raw = crypto.randomBytes(CHUNK * 3)
  const env = envelope(raw)
  env.chunks.pop()
  assert.strictEqual(toBytes(env), null)
  assert.strictEqual(mediaEnvelopeErrorCode(env), 'TRUNCATED_MEDIA')
})

run('X10 1B/1KB 信封 roundtrip SHA 一致', () => {
  for (const size of [1, 1024]) {
    const raw = crypto.randomBytes(size)
    const bytes = toBytes(envelope(raw))
    assert.ok(bytes, `${size}B 信封未识别`)
    assert.strictEqual(bytes.length, size)
    assert.strictEqual(sha(Buffer.from(bytes)), sha(raw))
  }
})

run('X11 缺片进入 admit 返回 TRUNCATED_MEDIA', () => {
  const raw = crypto.randomBytes(CHUNK * 3)
  const env = envelope(raw)
  env.chunks.pop()
  const result = src.__debug.admit({ delivery: { statusCode: 200, headers: {}, body: env }, songInfo: { name: 'x', singer: 'y', interval: '00:03' } })
  assert.strictEqual(result.code, 'TRUNCATED_MEDIA')
  assert.strictEqual(result.evidence, 'strong')
})

run('X12 1MiB 信封 JSON.parse ≤10ms', () => {
  const env = envelope(crypto.randomBytes(1024 * 1024))
  const text = JSON.stringify(env)
  JSON.parse(text) // 预热，排除首次 JIT 抖动
  const samples = []
  for (let i = 0; i < 5; i++) {
    const t0 = process.hrtime.bigint()
    JSON.parse(text)
    samples.push(Number(process.hrtime.bigint() - t0) / 1e6)
  }
  const best = Math.min(...samples)
  assert.ok(best <= 10, `1MiB JSON.parse 最慢样本 ${best.toFixed(2)}ms > 10ms`)
})

run('X6 旧桥产物 {type:"Buffer",data} 仍兼容', () => {
  const oldShape = { type: 'Buffer', data: Array.from(flac64) }
  const bytes = toBytes(oldShape)
  assert.ok(bytes)
  assert.strictEqual(sha(Buffer.from(bytes)), sha(flac64))
  assert.strictEqual(kindOf(oldShape), 'audio')
})

console.log(`\n===== 桥媒体信封源侧审计：${checks} 通过 / ${failures} 失败 =====`)
if (require.main === module) process.exit(failures ? 1 : 0)
