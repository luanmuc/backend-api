#!/usr/bin/env node
// 发布签名工具（v9.3-a）—— ed25519，用 Node 内置 crypto，不引第三方依赖
//
// 用法：
//   node scripts/sign-release.js --gen-key                  # 生成密钥对（私钥贴 CI secret，公钥写进 App）
//   node scripts/sign-release.js                            # 用 LX_SIGNING_KEY 签 lx-source.js
//   node scripts/sign-release.js --verify --pub <base64>     # 用公钥验签当前产物
//
// 产物：lx-source.js.sig（base64 单行）+ lx-source.js.manifest.json
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const ARTIFACT = path.join(ROOT, 'lx-source.js')
const SIG_FILE = path.join(ROOT, 'lx-source.js.sig')
const MANIFEST = path.join(ROOT, 'lx-source.js.manifest.json')

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex')
const versionOf = (txt) => (txt.match(/@version[: \t]+([\d.]+)/) || [])[1] || ''

function genKey() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519')
  const pub = publicKey.export({ type: 'spki', format: 'der' }).toString('base64')
  const priv = privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64')
  console.log('公钥（写进 App 内置公钥表）：\n' + pub)
  console.log('\n私钥（存 CI secret LX_SIGNING_KEY，切勿入库）：\n' + priv)
  return 0
}

function sign() {
  const keyB64 = process.env.LX_SIGNING_KEY || ''
  if (!keyB64) {
    // v9.1.2（B03-002）：默认保持本地/PR 的诊断语义（跳过签名、exit 0）；
    // --require-key 时缺密钥 exit 1 —— release job 用这个开关，
    // 避免「无签名产物随绿色流水线流出」（旧行为是静默 warn + exit 0）。
    if (process.argv.includes('--require-key')) {
      console.error('❌ sign-release：--require-key 已指定，但未提供 LX_SIGNING_KEY')
      return 1
    }
    console.log('⏭ sign-release：未提供 LX_SIGNING_KEY（本地/PR 环境跳过签名，不产出 sig；release 请加 --require-key）')
    return 0
  }
  const body = fs.readFileSync(ARTIFACT)
  const key = crypto.createPrivateKey({ key: Buffer.from(keyB64, 'base64'), type: 'pkcs8', format: 'der' })
  const sig = crypto.sign(null, body, key).toString('base64')
  const ver = versionOf(body.toString('utf8'))
  fs.writeFileSync(SIG_FILE, sig + '\n')
  fs.writeFileSync(MANIFEST, JSON.stringify({
    artifact: 'lx-source.js',
    version: ver,
    size: body.length,
    sha256: sha256(body),
    sigAlg: 'ed25519',
    keyId: process.env.LX_KEY_ID || 'k1',
    sig: sig,
    signedAt: new Date().toISOString().slice(0, 10),
  }, null, 2) + '\n')
  console.log(`✅ 已签名：v${ver} / ${body.length}B / keyId=${process.env.LX_KEY_ID || 'k1'} / sig ${sig.slice(0, 12)}…`)
  return 0
}

function verify(pubB64) {
  if (!fs.existsSync(SIG_FILE)) { console.log('❌ 缺少 lx-source.js.sig'); return 1 }
  const sig = fs.readFileSync(SIG_FILE, 'utf8').trim()
  const body = fs.readFileSync(ARTIFACT)
  let pub
  try { pub = crypto.createPublicKey({ key: Buffer.from(pubB64, 'base64'), type: 'spki', format: 'der' }) }
  catch (e) { console.log('❌ 公钥解析失败：' + e.message); return 1 }
  const ok = crypto.verify(null, body, pub, Buffer.from(sig, 'base64'))
  if (!ok) { console.log('❌ 验签失败：产物与签名不匹配（可能被替换）'); return 1 }
  // B03-007：manifest 是 sha256 + 版本的锁定层。原来缺失时直接当成验签通过，
  // 等于把 sha 锁定变成可选 —— 整个 manifest 可被剥离而不报错。缺失必须算失败。
  if (!fs.existsSync(MANIFEST)) { console.log('❌ 缺少 lx-source.js.manifest.json（sha256/版本锁定层不可缺失）'); return 1 }
  const mf = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'))
  if (mf.sha256 !== sha256(body)) { console.log('❌ manifest sha256 与产物不符'); return 1 }
  // B03-007：还要交叉核对版本，避免 manifest 与产物版本错配（例如换了产物没更新 manifest）。
  const ver = versionOf(body.toString('utf8'))
  if (mf.version !== ver) { console.log(`❌ manifest 版本(${mf.version}) 与产物 @version(${ver}) 不一致`); return 1 }
  console.log(`✅ 验签通过（v${mf.version} / sha256 ${mf.sha256.slice(0, 12)}…）`)
  return 0
}

function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--gen-key')) return genKey()
  if (argv.includes('--verify')) {
    const i = argv.indexOf('--pub')
    return verify(i >= 0 ? argv[i + 1] : (process.env.LX_PUBLIC_KEY || ''))
  }
  return sign()
}

if (require.main === module) process.exit(main())
