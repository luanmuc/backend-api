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
  'test/audit/e-extra.js',
  'test/audit/g-meta.js',
];
const SLOW_GATES = ['test/stress-round3.js'];

const MUTANTS = [
  {
    id: 'MU1',
    name: '阈值 +1（qs.size >= 1 → >= 2）',
    from: 'if (qs.size >= 1) hEntry.mids.add(midKey);',
    to: 'if (qs.size >= 2) hEntry.mids.add(midKey);',
  },
  {
    id: 'MU2',
    name: '去掉片段缓存通道（hasFragDetail || hasFragCache → hasFragDetail）',
    from: 'if (cfg("fragmentFallback", true) && (hasFragDetail || hasFragCache)) {',
    to: 'if (cfg("fragmentFallback", true) && (hasFragDetail)) {',
  },
  {
    id: 'MU3',
    name: '永不记录片段证据（PREVIEW_FRAGMENT 分支失效）',
    from: 'if (e.code === ERROR_CODES.PREVIEW_FRAGMENT) {',
    to: 'if (false) {',
  },
  {
    id: 'MU4',
    name: '删掉唯一缓存写入（交付结果不入缓存）',
    from: 'setCachedUrl(writeKey, url, truthQ, source);',
    to: 'void 0; // mutant: no cache write',
  },
  {
    id: 'MU5',
    name: '冷却时长数量级错误（300000 → 1000）',
    from: 'const PREVIEW_COOLDOWN_MS = 300000;',
    to: 'const PREVIEW_COOLDOWN_MS = 1000;',
  },
  {
    id: 'MU6',
    name: '错误码归一失效（一律归 NETWORK_ERROR）',
    from: 'err.code = hit || fallback || ERROR_CODES.NETWORK_ERROR;',
    to: 'err.code = ERROR_CODES.NETWORK_ERROR;',
  },
  {
    id: 'MU7',
    name: '关闭交付验真闸门',
    from: 'if (!cfg("verifyDelivery", true)) return null;',
    to: 'return null; // mutant: gate off',
  },
  {
    id: 'MU10',
    name: '配置校验不防 NaN（NaN 可绕过 <=0 与上下限）',
    from: '|| !Number.isFinite(value) || value <= 0',
    to: '|| value <= 0',
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
];

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
  for (const g of gates) {
    const r = cp.spawnSync(process.execPath, [g], {
      cwd: repo, timeout: 180000, encoding: 'utf8',
    });
    if (r.status !== 0) killers.push(path.basename(g, '.js'));
  }
  return killers;
}

function main() {
  const args = process.argv.slice(2);
  const full = args.includes('--full');
  const strict = args.includes('--strict');
  const gates = full ? FAST_GATES.concat(SLOW_GATES) : FAST_GATES;

  const srcPath = path.join(ROOT, SRC);
  const original = fs.readFileSync(srcPath, 'utf8');
  copyRepo();
  const workSrc = path.join(WORK, SRC);
  const rows = [];

  try {
    for (const m of MUTANTS) {
      const hits = original.split(m.from).length - 1;
      if (hits !== 1) {
        rows.push({ id: m.id, name: m.name, status: 'SKIPPED', killers: [`锚点命中 ${hits} 次`] });
        continue;
      }
      fs.writeFileSync(workSrc, original.replace(m.from, m.to));
      const killers = runGates(WORK, gates);
      fs.writeFileSync(workSrc, original); // 每个变异体都从原版重来
      rows.push({ id: m.id, name: m.name, status: killers.length ? 'KILLED' : 'SURVIVED', killers });
    }
  } finally {
    fs.writeFileSync(workSrc, original);
    fs.rmSync(WORK, { recursive: true, force: true });
  }

  const killed = rows.filter((r) => r.status === 'KILLED').length;
  const survived = rows.filter((r) => r.status === 'SURVIVED');
  const skipped = rows.filter((r) => r.status === 'SKIPPED');

  for (const r of rows) {
    const mark = r.status === 'KILLED' ? '✓' : (r.status === 'SURVIVED' ? '✗' : '·');
    const extra = r.status === 'KILLED' ? `被 ${r.killers.join(', ')} 杀掉`
      : (r.status === 'SURVIVED' ? '无门禁发现（断言盲区）' : r.killers[0]);
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
