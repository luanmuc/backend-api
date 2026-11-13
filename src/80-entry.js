// 单文件构建入口：保留核心导出的全部属性（含非枚举 __debug），只追加契约规格。
const core = require('./legacy.js');
const specs = require('./providers');
module.exports = core;
Object.defineProperty(module.exports, 'PROVIDER_SPECS', {
  value: specs,
  enumerable: false,
  configurable: false,
  writable: false,
});
