#!/usr/bin/env node
/**
 * 变异测试（第五轮 MUT 组的执行器）
 *
 * 思路：不靠人想场景，而是机器把源码改坏一处，看门禁能不能发现。
 * - 只读仓库：把仓库复制到系统临时目录副本，所有变异只发生在副本上，工作区一个字节都不动。
 * - 每个变异体只改一处，跑一遍门禁；任一脚本非 0 → killed；全 0 → survived（= 断言盲区）。
 *
 * 用法：
 *   node test/mutation/run.js            # 快速门禁（a-static / b-logic / e-extra / g-meta）
 *   node test/mutation/run.js --full     # 追加 stress-round3（慢，约 1~2 分钟）
 *   node test/mutation/run.js --strict   # 有 survived 时退出码 1（默认 0，信息性输出）
 */
'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const os = require('os');

const ROOT = path.join(__dirname, '../..');
const WORK = path.join(os.tmpdir(), 'lx-mutation-repo');
const SRC = 'lx-source.js';

const FAST_GATES = [
  'test/audit/a-static.js',
  'test/audit/b-logic.js',
  'test/audit/r-admission.js',   // v8.11.5：L4 裁决层的针对性断言（MU11 等锚点靠它快速杀掉）
  'test/audit/e-extra.js',
  'test/audit/g-meta.js',
];
const SLOW_GATES = ['test/stress-round3.js'];

const MUTANTS = [
  {
    id: 'MU1',
    name: '跨歌证据阈值 +1（mids.size >= 2 → >= 3）',
    from: 'if (hEntry.mids.size >= 2) {',
    to: 'if (hEntry.mids.size >= 3) {',
    gates: ['test/lx-source-smoke-test.js'],
  },
  {
    id: 'MU2',
    name: '去掉片段缓存通道（hasFragDetail || hasFragCache → hasFragDetail）',
    // v8.11.5（F-01 后同步）：原锚点是 `... && (hasFragDetail || hasFragCache)`，F-01 给该条件
    // 加了 `fragAnchor &&` 前提后锚点失配、MU2 变成「锚点命中 0 次」被跳过（等于少一道门禁）。
    from: 'cfg("fragmentFallback", true) && fragAnchor && (hasFragDetail || hasFragCache)',
    to: 'cfg("fragmentFallback", true) && fragAnchor && (hasFragDetail)',
  },
  {
    id: 'MU3',
    name: '永不记录片段证据（PREVIEW_FRAGMENT 分支失效）',
    from: 'if (adm.code === ERROR_CODES.PREVIEW_FRAGMENT) {',
    to: 'if (false) {',
  },
  {
    id: 'MU4',
    name: '删掉唯一缓存写入（交付结果不入缓存）',
    from: 'setCachedUrl(writeKey, url, truthQ, source, actualDeliveryPlatform(source, platform));',
    to: 'void 0; // mutant: no cache write',
  },
  {
    id: 'MU5',
    name: '冷却时长数量级错误（300000 → 1000）',
    from: 'const PREVIEW_COOLDOWN_MS = 300000;',
    to: 'const PREVIEW_COOLDOWN_MS = 1000;',
    gates: ['test/lx-source-smoke-test.js'],
  },
  {
    id: 'MU6',
    name: '错误码归一失效（一律归 NETWORK_ERROR）',
    from: 'err.code = hitKey ? ERROR_CODES[hitKey] : (fallback || ERROR_CODES.NETWORK_ERROR);',
    to: 'err.code = ERROR_CODES.NETWORK_ERROR;',
  },
  {
    id: 'MU7',
    name: '关闭交付验真闸门',
    from: 'if (!cfg("verifyDelivery", true)) return null;',
    to: 'return null; // mutant: gate off',
  },
  {
    id: 'MU11',
    name: '5xx 不计入熔断（服务端持续故障却永不切源）',
    from: '    health: policy.health,',
    to: '    health: "businessFail",',
  },
  {
    id: 'MU12',
    name: '整链失败不写短失败缓存（同歌重播反复白跑降级链）',
    from: '  setFailCached(failKey, lastFailCode, failTtl);',
    to: '  void 0;',
  },
  {
    id: 'MU10',
    name: '配置校验不防 NaN（NaN 可绕过 <=0 与上下限）',
    from: 'if (typeof value !== "number" || !Number.isFinite(value)) continue;',
    to: 'if (typeof value !== "number") continue;',
  },
  {
    id: 'MU9',
    name: '记忆表上限失效（不淘汰最旧条目）',
    from: '  if (map.size > max) {',
    to: '  if (false) {',
  },
  {
    id: 'MU8',
    name: '不释放并发计数（inflight 永久占位）',
    from: 'inflightCount.set(handler.id, Math.max((inflightCount.get(handler.id) || 0) - 1, 0));',
    to: 'void 0; // mutant: leak inflight',
  },
  {
    id: 'MU13',
    name: '注掉同名错歌的歌手校验（songInfoMatch 不再比对 singer）',
    from: 'if (songInfo?.singer && singer && !artistMatch(songInfo.singer, singer)) return false;',
    to: 'if (false && songInfo?.singer && singer) return false;',
    gates: ['test/stress-round4.js'],
  },
  {
    id: 'MU14',
    name: '关闭冷启动预热入口（coldStartWarmEnabled 恒不生效）',
    from: "if (cfg('coldStartWarmEnabled', true)) warmUpColdStartSources(platform);",
    to: 'if (false) warmUpColdStartSources(platform);',
    gates: ['test/stress-round4.js'],
  },
  {
    id: 'MU15',
    name: '音质短路到期不放行（qualityShortCircuitProbeMs 形同虚设，该档永久被跳过）',
    from: "if (Date.now() >= qualitySkipProbeAt.get(key)) { qualitySkipProbeAt.set(key, Date.now() + probeMs); return false; }",
    to: 'if (Date.now() >= qualitySkipProbeAt.get(key)) { qualitySkipProbeAt.set(key, Date.now() + probeMs); return true; }',
    gates: ['test/stress-round4.js'],
  },
  {
    id: 'MU16',
    name: '冷启动探针超时写死成 HEALTH_CHECK_TIMEOUT（coldStartProbeTimeoutMs 失效）',
    from: "const probeTimeout = (h && h.coldStart) ? cfg('coldStartProbeTimeoutMs', 30000) : HEALTH_CHECK_TIMEOUT;",
    to: 'const probeTimeout = HEALTH_CHECK_TIMEOUT;',
    gates: ['test/stress-round4.js'],
  },
  {
    id: 'MU17',
    name: '缓存跨档命中回退（只查请求档，D-36 保护）',
    from: 'let cached = getCachedUrl(cacheKey);\n  if (!cached) {',
    to: 'let cached = getCachedUrl(cacheKey);\n  if (false) {',
    gates: ['test/stress-round4.js'],
  },
  {
    id: 'MU18',
    name: '验真比例阈值退回 || 读配置（0 被吞成 0.6，D-35 保护）',
    // 原版此处变异 verifyDurGapSec，但那是等价变异体：判据是
    // `ratio < 0.6 && gap > 15` 的 AND，能走到 gap 判据时 gap 必然远大于 15
    // （实际 < 原曲 60% 时差值必然 > 24s），gap 传 0 与传 15 行为完全相同，无法区分。
    // 改为变异 verifyDurRatio：配置 0（最严以外的合法值）会被 || 吞成 0.6，可观测。
    from: 'verifyDurRatio: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.verifyDurRatio) ?? 0.6',
    to: 'verifyDurRatio: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.verifyDurRatio) || 0.6',
    gates: ['test/stress-round4.js'],
  },
  {
    id: 'MU19',
    name: '去掉半开退回 open（节流路径卡死，D-34 保护）',
    from: 'revertHalfOpenOnSkip(handler.id, quality); // D-34：同上，节流也在 try 之外抛',
    to: '// D-34 变异体：删掉半开退回',
    gates: ['test/stress-round4.js'],
  },
  {
    id: 'MU20',
    name: '冒号时长解析回退成只 Number()（mm:ss 失效，D-37 保护）',
    from: 'if (typeof d === "string" && d.indexOf(":") >= 0) {',
    to: 'if (false) { // D-37 变异体：砍掉冒号格式解析',
    gates: ['test/stress-round4.js'],
  },
  {
    id: 'MU21',
    name: 'allFailShortTtlMs 退回 || 读配置（0 被吞，D-38 保护）',
    from: 'globalThis.__lxSourceConfig.allFailShortTtlMs) ?? 30000',
    to: 'globalThis.__lxSourceConfig.allFailShortTtlMs) || 30000',
    gates: ['test/stress-round4.js'],
  },
  // MU22（v8.11.1 / D-39）：message 里的时长不回填 → 调用方没传 duration 时片段校验静默失效
  { id: 'MU22', name: 'D-39 message 时长回填被删 → 超长曲片段校验失效',
    from: 'if (parsed && parsed.duration && !songInfo.duration) songInfo.duration = parsed.duration;',
    to: 'if (false) songInfo.duration = parsed.duration;',
    gates: ['test/stress-round4.js'] }
];

function sourceFiles() {
  const out = [];
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (name.endsWith('.js')) out.push(p);
    }
  };
  walk(path.join(ROOT, 'src'));
  return out;
}

function findAnchor(files, text) {
  for (const file of files) {
    const body = fs.readFileSync(file, 'utf8');
    const hits = body.split(text).length - 1;
    if (hits) return { file, body, hits };
  }
  return { file: null, body: null, hits: 0 };
}

function copyRepo() {
  fs.rmSync(WORK, { recursive: true, force: true });
  fs.cpSync(ROOT, WORK, {
    recursive: true,
    filter: (p) => !/\/\.git$/.test(p) && !/\/\.git\//.test(p) &&
      !/node_modules/.test(p) && !/health-daily/.test(p) && !/\/\.sessions/.test(p),
  });
}

function runGates(repo, gates) {
  const killers = [];
  const uncertain = [];
  for (const g of gates) {
    // maxBuffer 必须放大：压测脚本日志量远超默认 1MB，溢出会让 spawnSync 以 ENOBUFS/SIGTERM
    // 杀掉进程并返回 status=null —— 那会被误判成「门禁发现」，即假杀。
    const r = cp.spawnSync(process.execPath, ['--expose-gc', g], {
      cwd: repo, timeout: 120000, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    });
    const name = path.basename(g, '.js');
    if (r.status === null) {
      // 被信号杀/超时/buffer 溢出：不是断言判定，不能算 killed
      uncertain.push(`${name}(${r.signal || (r.error && r.error.code) || 'timeout'})`);
    } else if (r.status !== 0) {
      killers.push(name);
      break; // 任一断言门禁非 0 即已证明变异被杀，不必继续跑后面的慢门禁
    }
  }
  return { killers, uncertain };
}

function main() {
  const args = process.argv.slice(2);
  const full = args.includes('--full');
  const strict = args.includes('--strict');
  const gates = full ? FAST_GATES.concat(SLOW_GATES) : FAST_GATES;
  // --only=MU15,MU16 只跑指定变异体：单验证新加变异体时不必等 20 分钟全跑
  const onlyArg = args.find((a) => a.startsWith('--only='));
  const only = onlyArg ? onlyArg.slice('--only='.length).split(',').filter(Boolean) : [];

  const files = sourceFiles();
  copyRepo();
  // 构建需要 esbuild；复用工作区 node_modules，避免每个变异体复制一份。
  fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(WORK, 'node_modules'), 'dir');
  const rows = [];

  try {
    for (const m of MUTANTS) {
      if (only.length && !only.includes(m.id)) continue;
      const hit = findAnchor(files, m.from);
      if (hit.hits !== 1) {
        rows.push({ id: m.id, name: m.name, status: 'SKIPPED', killers: [`锚点命中 ${hit.hits} 次`] });
        continue;
      }
      const workFile = path.join(WORK, path.relative(ROOT, hit.file));
      fs.writeFileSync(workFile, hit.body.replace(m.from, m.to));
      const build = cp.spawnSync(process.execPath, [path.join(WORK, 'scripts/build-source.js')], {
        cwd: WORK, timeout: 120000, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
      });
      if (build.status !== 0) {
        fs.writeFileSync(workFile, hit.body);
        rows.push({ id: m.id, name: m.name, status: 'BUILD_FAILED', killers: [(build.stderr || '').slice(0, 160)] });
        continue;
      }
      const res = runGates(WORK, m.gates || gates);   // 变异体可指定专属门禁（只被压测杀的变异体不必跑全部审计）
      const killers = res.killers;
      fs.writeFileSync(workFile, hit.body); // 每个变异体都从原版重来
      const status = killers.length ? 'KILLED' : (res.uncertain.length ? 'UNCERTAIN' : 'SURVIVED');
      console.log(`[mutation] ${m.id} ${status}${killers.length ? ` (${killers.join(',')})` : ''}`);
      rows.push({ id: m.id, name: m.name, status, killers: killers.length ? killers : res.uncertain });
    }
  } finally {
    fs.rmSync(WORK, { recursive: true, force: true });
  }

  const killed = rows.filter((r) => r.status === 'KILLED').length;
  const survived = rows.filter((r) => r.status === 'SURVIVED');
  const skipped = rows.filter((r) => r.status === 'SKIPPED');

  for (const r of rows) {
    const mark = r.status === 'KILLED' ? '✓' : (r.status === 'SURVIVED' ? '✗' : '·');
    const extra = r.status === 'KILLED' ? `被 ${r.killers.join(', ')} 杀掉`
      : (r.status === 'SURVIVED' ? '无门禁发现（断言盲区）'
        : (r.status === 'UNCERTAIN' ? `门禁未给出判定：${r.killers.join(', ')}` : r.killers[0]));
    console.log(`${mark} [${r.id}] ${r.name} — ${extra}`);
  }
  const pct = rows.length ? Math.round((killed / rows.length) * 100) : 0;
  console.log(`\n变异测试（${gates.length} 个门禁）汇总：${killed} killed / ${survived.length} survived` +
    `${skipped.length ? ` / ${skipped.length} skipped` : ''}，killed 率 ${pct}%`);
  if (survived.length) console.log('存活变异体（需补断言）：' + survived.map((r) => r.id).join(', '));
  if (require.main === module) process.exit(strict && survived.length ? 1 : 0);
}

if (require.main === module) main();
module.exports = { mutants: MUTANTS };
