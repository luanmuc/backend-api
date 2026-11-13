#!/usr/bin/env node
/**
 * v8.13 源库存与预算校验（生命周期治理的机器闸门）
 *
 * 口径：12 登记源 = 10 上链（active）+ 2 观察（probation）。
 * 用法：
 *   node scripts/source-inventory.js          # 打印清单
 *   node scripts/source-inventory.js --check  # 只校验，违规退出 1
 *   node scripts/source-inventory.js --json   # 机器可读
 */
const fs = require('fs');
const path = require('path');

const SOURCE_FILE = path.join(__dirname, '..', 'lx-source.js');
const RETIRED = ['xinghaiBackup', 'lingchuan', 'gdWy', 'juheKw', 'juheWy', 'juheKg', 'juheMg', 'nianxinVip'];
const BUDGET = { total: 12, active: 10, probation: 2 };
const AUTH = new Set(['none', 'optional', 'card', 'paid']);
const LIFECYCLE = new Set(['active', 'probation']);

function load() {
  // 独立 CLI：没有宿主时注入最小 lx 壳，只读取契约，不发外呼。
  if (!globalThis.lx) {
    globalThis.lx = {
      EVENT_NAMES: { inited: "inited", request: "request", updateAlert: "updateAlert" },
      version: "1.2.0", env: {},
      utils: { buffer: { from: (d, e) => Buffer.from(d, e), bufToString: (b, e) => b.toString(e) } },
      request: (u, o, cb) => setTimeout(() => cb(new Error("mock-no-network"), null), 1),
      on: () => {}, send: () => {},
    };
  }
  delete require.cache[require.resolve(SOURCE_FILE)];
  const savedLog = console.log;
  console.log = () => {};
  try { return require(SOURCE_FILE); }
  finally { console.log = savedLog; }
}

function inventory(mod) {
  const handlers = mod.SOURCE_HANDLERS || {};
  const ids = Object.keys(handlers);
  const active = ids.filter(id => handlers[id].lifecycle === 'active');
  const probation = ids.filter(id => handlers[id].lifecycle === 'probation');
  const groups = new Map();
  for (const id of ids) {
    const g = handlers[id].upstreamGroup || id;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(id);
  }
  return {
    ids,
    active,
    probation,
    groups: Object.fromEntries(groups),
    coverage: mod.KNOWN_COVERAGE_GAPS || [],
  };
}

function check(mod) {
  const errors = [];
  const inv = inventory(mod);
  if (inv.ids.length !== BUDGET.total) errors.push(`登记源预算应为 ${BUDGET.total}，实际 ${inv.ids.length}`);
  if (inv.active.length !== BUDGET.active) errors.push(`上链源预算应为 ${BUDGET.active}，实际 ${inv.active.length}`);
  if (inv.probation.length !== BUDGET.probation) errors.push(`观察源预算应为 ${BUDGET.probation}，实际 ${inv.probation.length}`);
  for (const id of RETIRED) if (inv.ids.includes(id)) errors.push(`退役源仍在册：${id}`);
  for (const id of inv.ids) {
    const h = mod.SOURCE_HANDLERS[id];
    if (!LIFECYCLE.has(h.lifecycle)) errors.push(`${id}: lifecycle 非法 ${h.lifecycle}`);
    if (!AUTH.has(h.auth)) errors.push(`${id}: auth 非法 ${h.auth}`);
    if (h.lifecycle === 'probation') {
      if (mod.SOURCE_TOGGLES[id] !== false) errors.push(`${id}: 观察源默认必须关闭`);
      if (!h.reviewAt) errors.push(`${id}: 观察源缺少 reviewAt`);
      if (h.chain && Object.keys(h.chain).length) errors.push(`${id}: 观察源不得有链位次`);
    }
    if (h.lifecycle === 'active' && (!h.chain || !Object.keys(h.chain).length)) errors.push(`${id}: 上链源缺少链位次`);
  }
  for (const [g, members] of Object.entries(inv.groups)) {
    if (members.length > 1) errors.push(`上游族 ${g} 出现多个登记源：${members.join(',')}（同族只保留一条）`);
  }
  try {
    const c = mod.validateProviderContracts();
    if (!c || c.registered !== BUDGET.total) errors.push('validateProviderContracts() 返回值异常');
  } catch (e) {
    errors.push(`Provider Contract 校验失败：${e.message}`);
  }
  return { ok: errors.length === 0, errors, inventory: inv };
}

function main() {
  const args = new Set(process.argv.slice(2));
  const mod = load();
  const res = check(mod);
  if (args.has('--json')) {
    console.log(JSON.stringify(res, null, 2));
  } else {
    console.log(`源库存：${res.inventory.ids.length} 登记 / ${res.inventory.active.length} 上链 / ${res.inventory.probation.length} 观察`);
    console.log(`上链源：${res.inventory.active.join(', ')}`);
    console.log(`观察源：${res.inventory.probation.join(', ')}`);
    console.log(`上游族：${Object.entries(res.inventory.groups).map(([g, m]) => `${g}=${m.join('+')}`).join(', ')}`);
    if (res.errors.length) {
      console.log('\n违规：');
      for (const e of res.errors) console.log(`- ${e}`);
    } else {
      console.log('\n预算与生命周期校验通过。');
    }
  }
  if (args.has('--check') && !res.ok) process.exit(1);
  process.exit(0);
}

main();
