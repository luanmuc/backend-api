'use strict'
/**
 * 真实标签纯函数：m4a/ogg/wav 不再无条件保留请求档。
 * 用 lx-source.js 的 __debug.sniffAudioBytes / qualityFromDelivery 实跑。
 */
const assert = require('assert')
const path = require('path')

globalThis.lx = {
  EVENT_NAMES: { inited: 'inited', request: 'request', updateAlert: 'updateAlert' },
  version: '2.0.0', env: 'mobile',
  utils: { buffer: { from: (d, e) => Buffer.from(d, e), bufToString: (b, e) => b.toString(e) } },
  request(url, opts, cb) {
    const custom = globalThis.__qualityTestResponse
    if (custom) {
      setTimeout(() => cb(null, custom), 0)
      return
    }
    setTimeout(() => cb(null, { statusCode: 200, headers: {}, body: '' }), 1)
  },
  on() {}, send() {},
}
globalThis.__lxSourceConfig = { healthCheckIntervalMs: 2147480000, coldStartWarmEnabled: false }
const mod = require(path.join(__dirname, '..', '..', 'lx-source.js'))
const debug = mod.__debug

let checks = 0
let failures = 0
const run = (name, fn) => {
  const id = String(name).match(/^[A-Z]+-\d+[a-z]?/)?.[0] || String(name)
  try {
    fn(); checks++; console.log(`  ✓ [${id}] ${name}`)
  } catch (e) {
    failures++; console.error(`  ✗ [${id}] ${name}`)
    console.error(`    ${e && e.stack ? e.stack.split('\n').slice(0, 3).join('\n    ') : e}`)
  }
}
const asyncTasks = []
const runAsync = (name, fn) => { asyncTasks.push({ name, fn }) }

const audio = (magic, offset = 0) => {
  const b = Buffer.alloc(64)
  b.write(magic, offset)
  return b
}

run('QT-1 m4a 128k：content-length 3.2MB / 200s → 128k', () => {
  const info = debug.sniffAudioBytes(audio('ftyp', 4), { 'content-length': '3200000' }, 3200000)
  assert.strictEqual(info.format, 'm4a')
  assert.strictEqual(debug.qualityFromDelivery(info, 'flac', 200), '128k')
})
run('QT-2 m4a 320k：content-length 8MB / 200s → 320k', () => {
  const info = debug.sniffAudioBytes(audio('ftyp', 4), { 'content-length': '8000000' }, 8000000)
  assert.strictEqual(info.format, 'm4a')
  assert.strictEqual(debug.qualityFromDelivery(info, 'flac', 200), '320k')
})
run('QT-3 ogg 320k：content-length 8MB / 200s → 320k', () => {
  const info = debug.sniffAudioBytes(audio('OggS'), { 'content-length': '8000000' }, 8000000)
  assert.strictEqual(info.format, 'ogg')
  assert.strictEqual(debug.qualityFromDelivery(info, 'flac', 200), '320k')
})
run('QT-4 wav 无损：RIFF → flac', () => {
  const info = debug.sniffAudioBytes(audio('RIFF'), { 'content-length': '8000000' }, 8000000)
  assert.strictEqual(info.format, 'wav')
  assert.strictEqual(debug.qualityFromDelivery(info, '128k', 200), 'flac')
})
run('QT-6 Range 1KB 探针不得被当完整文件大小', () => {
  // 真实 probeAudioDelivery 用 Range bytes=0-1023：响应头 content-length 只有 1KB，
  // 若把它当总字节，m4a 320k 会被估算成 128k。必须只认 content-range 总长度。
  const probe = Buffer.alloc(1024)
  probe.write('ftyp', 4)
  const info = debug.sniffAudioBytes(probe, { 'content-length': '1024' }, 1024)
  assert.strictEqual(info.totalBytes, 0)
  assert.strictEqual(debug.qualityFromDelivery(info, 'flac', 200), 'flac')
})
run('QT-5 m4a 未知总字节：保留请求档，不制造新误标', () => {
  const info = debug.sniffAudioBytes(audio('ftyp', 4), {}, 64)
  assert.strictEqual(info.format, 'm4a')
  assert.strictEqual(debug.qualityFromDelivery(info, 'flac', 200), 'flac')
})

run('QT-7 m4a 有总字节+时长：置信度为 estimated，不是 exact', () => {
  const info = debug.sniffAudioBytes(audio('ftyp', 4), { 'content-length': '8000000' }, 8000000)
  assert.strictEqual(debug.qualityConfidenceOf(info, 200), 'estimated')
})
run('QT-8 m4a 只有 1KB 探针：置信度为 unknown', () => {
  const probe = Buffer.alloc(1024)
  probe.write('ftyp', 4)
  const info = debug.sniffAudioBytes(probe, { 'content-length': '1024' }, 1024)
  assert.strictEqual(debug.qualityConfidenceOf(info, 200), 'unknown')
})
runAsync('QT-9 上游忽略 Range 返回 200 全量：必须采用 content-length 作为总字节', async() => {
  const body = Buffer.alloc(3200000)
  body.write('ftyp', 4)
  globalThis.__qualityTestResponse = {
    statusCode: 200,
    headers: { 'content-length': '3200000', 'content-type': 'audio/mp4' },
    body,
  }
  const probe = await debug.probeAudioDelivery('https://example.com/fullbody.m4a')
  globalThis.__qualityTestResponse = null
  assert.strictEqual(probe.ok, true)
  assert.strictEqual(probe.totalBytes, 3200000)
  assert.strictEqual(probe.info.totalBytes, 3200000)
  assert.strictEqual(debug.qualityFromDelivery(probe.info, 'flac', 200), '128k')
})

const main = async() => {
  for (const { name, fn } of asyncTasks) {
    const id = String(name).match(/^[A-Z]+-\d+[a-z]?/)?.[0] || String(name)
    try {
      await fn(); checks++; console.log(`  ✓ [${id}] ${name}`)
    } catch (e) {
      failures++; console.error(`  ✗ [${id}] ${name}`)
      console.error(`    ${e && e.stack ? e.stack.split('\n').slice(0, 3).join('\n    ') : e}`)
    }
  }
  console.log(`\n===== 源侧真实标签：${checks} 通过 / ${failures} 失败 =====`)
  if (require.main === module) process.exit(failures ? 1 : 0)
}
main()
