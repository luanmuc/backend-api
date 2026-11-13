// 10 个上链源 + 1 组观察源（2 个）
const active = [
  require('./suyinKuwo.js'),
  require('./wyOuter.js'),
  require('./kuwoOfficial.js'),
  require('./suyin163.js'),
  require('./xinghaiBackend.js'),
  require('./helloworldKw.js'),
  require('./changqingVip.js'),
  require('./huibq.js'),
  require('./juheTx.js'),
  require('./ikun.js')
];
const probation = require('./55-probation.js');
module.exports = { active, probation, all: active.concat(Object.values(probation)) };
