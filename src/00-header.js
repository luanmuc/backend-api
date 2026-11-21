module.exports = String.raw`/*!
 * @name 豆包定制[聚合音源]
 * @description v9.1.5 失效源退役标记版：suyinQQ 端点级下线（oiapi.net/api/QQ_Music 404 + code -13001「接口不存在或已下线」，br=4/5/7 三档一致）、suyinMigu 上游中转 IP 被咪咕限（api.xcvts.cn 返回 200 + code 502）、huibq 保留待复活（kw/wy 双档 503）；只改开关表注释、行为零变化；上一版 v9.1.4 为按平台音质上限版（ikun kw=flac / wy=320k、juheTx flac 虚标下调 320k、wy 探测曲目改《海阔天空》/Beyond）（13 登记源 / 11 上链 / 2 观察；v9.1：URL/跨平台缓存命中前必须探测可用性，探不过清缓存再走链路，避免死链被长期复用。v9.0.0 阶段为13 登记源 / 11 上链 / 2 观察；v9.0：6272 行单文件拆为 33 个 src/core 模块，legacy 只留装配与 3 个启动期求值定义；发布包支持 ed25519 签名校验，App 侧内置公钥验签后才采用；健康快照按版本区间判定；上一版 v8.16.4 为播放摘除档位归因版）
 * @version 9.1.5
 * @author 豆包定制
 */`;
