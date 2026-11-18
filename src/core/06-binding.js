// ============================================================
// v9.0 依赖注入绑定表（依赖倒置）
// 目的：core 业务模块不允许直接引用 legacy 里的定义（方向会成环，导致整块迁移必裂）。
//       改为「legacy 在定义后注册 → 模块运行时 dep(name) 解析」，环被打断，子簇才可迁。
// 约束：
//   1) 只在调用点解析（不在模块加载时取快照），避免注册时序问题；
//   2) dep 未绑定时立即抛错并带名称，禁止静默返回 undefined；
//   3) 绑定表全局唯一，同名单次注册（重复注册直接抛错，防两套实现并存）。
// ============================================================

const __bindings = Object.create(null);

function bindDep(name, value) {
  if (value === undefined) throw new Error("bindDep: 绑定值为 undefined: " + name);
  if (__bindings[name] !== undefined && __bindings[name] !== value) {
    throw new Error("bindDep: 重复绑定（两套实现共存会静默分裂）: " + name);
  }
  __bindings[name] = value;
  return value;
}

function dep(name) {
  const v = __bindings[name];
  if (v === undefined) throw new Error("dep: 依赖未绑定: " + name);
  return v;
}

function depBound(name) {
  return __bindings[name] !== undefined;
}

module.exports = { bindDep, dep, depBound, __bindings };
