module.exports = String.raw`/*!
 * @name 豆包定制[聚合音源]
 * @description v9.1.4 按平台音质上限（ikun kw=flac / wy=320k）+ juheTx flac 虚标下调 320k + wy 探测曲目修正为《海阔天空》（网易云无周杰伦版权，原用翻唱版冒充原版）；上一版 v9.1.3 为溯音163 接口兼容修复（data.items）+ 门禁与断言加固版（P1 修复：docs-audit 硬失败可退出非零 / verify-real 支持 --require-all-ok / 签名缺钥可拦 --require-key / X-P 跨仓校验接入 push CI / live 驱动清理 4 个退役源 / provider contract 三源口径与注册表同步 / a-static 异步拒绝必须结构化错误码 / C10 并发外呼上限断言；详见 CHANGELOG）（13 登记源 / 11 上链 / 2 观察；v9.1：URL/跨平台缓存命中前必须探测可用性，探不过清缓存再走链路，避免死链被长期复用。v9.0.0 阶段为13 登记源 / 11 上链 / 2 观察；v9.0：6272 行单文件拆为 33 个 src/core 模块，legacy 只留装配与 3 个启动期求值定义；发布包支持 ed25519 签名校验，App 侧内置公钥验签后才采用；健康快照按版本区间判定；上一版 v8.16.4 为播放摘除档位归因版）
 * @version 9.1.4
 * @author 豆包定制
 */`;
