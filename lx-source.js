/*!
 * @name 豆包定制[聚合音源]
 * @description v8.12.3 P2 桥媒体信封（2026-11-12：App 二进制响应改 base64 信封 + 256KB 分片；toBytes 识别 __lxMedia:2 并按片独立解码，byteLength 不符拒绝；X1~X6 先红后绿）｜v8.12.2 P1 降级所有权（2026-11-12：inited 显式声明 fallbackOwner="source"，App 对声明源不再重复换源；W1/W2 先红后绿）｜v8.12.1 跨平台缓存失效与面板开关（2026-11-11：①toggleSource 关闭目标源时同步清 10min 跨平台结果缓存；②成功缓存命中若来源已被手动关闭，丢弃重解析；③健康面板只暴露 crossPlatformEnabled 总开关（9 布尔/37 键）；u-cross-platform 9→10，U10 先红后绿）｜v8.12.0 跨平台兜底（2026-11-11：主平台无原版/同名错歌/网络超时时按 tx→wy→kw 严格身份匹配换平台，解决「酷我没有就死等 22 秒报请求超时」；新增 u-cross-platform 9 条（含慢主平台不被跨平台抢跑误杀））｜v8.11.7 健康面板配置可管（config 通道开放 8 个布尔开关 + 补齐 13 个数字参数白名单，验真阈值 0 值合法；K4c~K4e 先红后绿）｜v8.11.6 收尾加固（链过滤分层/关源清账/fallback 代表码收口/HEAD 补证；23 条断言）｜v8.11.5 L4 裁决层落地（admit 单一入口 + ADMISSION_POLICY + L0 桥产物归一 + 交付类代表码优先 + clearSourceLedger）｜v8.11.4 错歌兜底修复（2026-11-10 云端真测 F-01：①星海后端缺 songmid 不再兜底 1 号歌，改抛 PARAM_ERROR——旧兜底等于保证错歌；②片段兜底（B 方案）加「必须有 hash/mid 锚点」前提，无 id 时不再把他人的 5 秒片段标成「试听版」交付，改报错；q-dfix Q5 先红后绿）｜v8.11.3 源开关失败缓存失效（2026-11-10：toggle 开启某源时按该源平台前缀清 fail_<平台> 失败缓存——旧实现只重置熔断/探测状态，开启后仍命中「歌不存在 1h」，新源根本没机会被调用，用户看到"开了还是不出歌"；配套 LRU 补 keys()；q-dfix Q3 先红后绿）｜v8.11.2 通读缺陷修复（2026-11-10：Juhe code 类型归一 + 303 校验宽松比 + flac24bit 起跑补齐 320k + CONFIG_ERROR 5 分钟过期 + 删恒假守卫；N1~N4 先红后绿）｜v8.11.1 交付真实性闸门（2026-11-08：①交付前 1KB 字节验真——FLAC STREAMINFO / MP3 Xing 解析真实时长，「能播但只有 5 秒」的试听片段不再被当 FLAC 交付，阈值 60%+15s 双条件；②音质标签回填真话——请求 flac 实得 128kbps mp3 时窗口改显示 128K；③降档链修复 128k 终档被截断；④缓存双入口验真 + 移除 helloworld 内层缓存，缓存里的片段不再绕过判据；⑤源级限流识别——同源三档全片段判定被风控，冷却 5 分钟转跨平台；⑥巡检同判据——probe 片段判定 + 日报片段率单列；⑦压力测试固化 test/stress-test.js（G1~G8 / 32 断言）并据此修三处：JSON 错误体不再被「拿不准放行」放过、源级限流冷却改为跨歌证据（单曲受限不再误伤同源其他歌）、片段直链兜底加 10 分钟 TTL 防过期签名；冒烟 60→67 组）｜v8.10.12 探测素材修正（移除写死的无效 VIP 歌/单曲素材）｜v8.10.4 可播校验错误码修复（超时/网络异常不判死链 + LINK_EXPIRED 补 code）｜v8.10.3 分档预算 + 冷启动探针豁免 + 缓存分级 TTL（2026-11-06：①分档预算 flac 6s/320k 4s/128k 4s + 末档保底 3s，防高音质吃满总预算饿死低档致点歌无声；②冷启动源探针超时放宽到 30s + 豁免自动关闭，onrender 冷态 30s 不再被 20min 误摘；③短路探路窗口 6h→1h，源临时波动后用户不用等 6h 才恢复高音质；④高音质缓存分级 TTL——flac/320k 30min（原 6h 链接已死仍返回死链），128k 保持 6h；⑤历史快照 60→144（10h→24h），趋势图跨天不断；新增 5 配置键，冒烟 T46/T47/T48；v8.10.1 补修：缓存 LRU 缺 delete 致高音质缓存过期重播 TypeError，T46/T47/T48 由空壳改为真行为验证）；v8.9 huibq 平台能力收窄 + 档位短路判据拆分（2026-11-06：huibq 实测仅 kw/wy 可用，从 tx/mg/kg 链尾移除；短路判据由 fail+businessFail 拆为 fail+linkExpired——404 无版权不再误伤、410 死链仍能短路；source-audit 支持 --strict 退出码）；v8.8 竞速引擎改造（2026-11-06：6 条全做——①竞速执行器重写为全链分批错峰并发（消灭"竞速3+串行rest"，kw 最坏 31s→≤10.5s）②单次请求总预算 12s 跨音质档共享（防三级降档理论 90s+）③档位短路（某源某档历史 0 成功且样本≥3 直接跳过该档，6h 放行探路防死锁）④冷启动源预热 + 单源超时放宽到 8s（huibq onrender 冷态 30s > 旧 5s 必败）⑤gdWy 配额源 batch:2 降后批省配额⑥verified 等待精确化（无 verified 源在飞则立即交付，不再白等 600ms）；USER_CONFIG 新增 7 键，冒烟 T40/T41/T42/T43）；v8.7 huibq假成功治理（2026-11-06：msg 失败词判失败，避免交付错歌）；v8.6 huibq默认开启（2026-11-06：全平台全音质可用，进五平台链尾兜底 + 探针托管）；v8.5 巡检工具与监控口径升级（2026-11-06：source-audit 巡检工具 + probe 假阳性治理 + huibq 探针）；v8.4 全源全接口深度巡检修复（2026-11-06：suyinKuwo br 修正 + xinghaiBackend 匿名适配，可用源 15→21）；v8.3 ikun默认开启（2026-11-06：A 方案——公益版免卡密默认进 kw 链尾兜底，探测自动托管/失败自动关/恢复自动开）；v8.2 ikun探针接入（2026-11-06：默认关闭源补齐健康探针，用户手动开启后自动监控；POST /music/url 固定歌 + Range 可播校验）；v8.1 ikun源复活（2026-11-06：域名 api.ikunshare.com→c.wwwweb.top，接口 GET /url→POST /music/url，公益版免卡密，实测 rid=228908 出真实128k链）；v8.0 全量审计修复版（版本重新整理：原 v11.11~v29.9 共53个小版本合并为8个大版本；旧版本归档见 docs/ARCHIVE_OLD_TAGS.md）；v29.9 全量审计修复（helloworld通道②补试听片段检测+reqTimestamps初始化防御+raceFirst空数组防御+注释修正+self-check补config/trend检查）；v29.8 小修复合集（logInfo版本号同步+清理冗余正则+@description同步）；v29.7 helloworld(kw)试听片段修复（降优先级移到Juhe之后 + URL关键词检测preview/test/sample抛错换源）；v29.6 巡检脚本全面优化(并发池限流+403/429判定修正+退出码分级+平台健康汇总+死源分级+原因标注+恢复标记+UA轮换+重试机制+README表格自动生成)；v29.5 深度交叉点审计修复(配置写模式返回current脱敏+PARAM_LIMITS上下限校验+改熔断阈值重置failureCount+改缓存TTL清空successCache+手动探测不存历史快照+deadCount含half-open+兜底平台按avgScore排序+历史快照上限20→60条+历史快照去冗余字段+breakers→breakerMap变量名修复)；v28 自动健康日报(scripts/health-daily.js：读probe-history按端点聚合近7日成功率/均时，连续3天全失败或真故障率>50%自动生成摘除建议，输出docs/health-daily/YYYY-MM-DD.md)；v27.4 健康分10分制输出；v27.3 全面审计修复(三源内部缓存命中返回裸URL——旧返回{url,type,subSource}包装对象被wrapExecute validateUrl拦截致缓存后跨平台取链秒失败；wy封面取songs[0].album.picUrl/blurPicUrl回退+补移动UA——网易detail实测带ids参数顶层picUrl恒null、封面在album字段；probe.js端点过滤正则悬空|恒真修复；ecosystem-scan.js源表改为从SOURCE_HANDLERS动态提取防漂移)；v27.2 候选 helloworld 实证接入(生态扫描候选——kw 128k/320k/flac 三档 convert_url_with_sign 直链全端到端实证通过(2026-10-29：mock宿主加载+真实flac/320k返回+Range 206+魔数校验)，与星海后端并列 kw 高音质竞速；haitangw v1 resolve-url 作通道②备用)；v26.3 生态扫描制度化(scripts/ecosystem-scan.js抓pdone每日健康表交叉——自动产出新候选/失效清单，纳入迭代协议；运行时逻辑同v26.1)；v26.1 自动摘死源(播放连续失败≥3次实时摘除出链+playDead快照+播放成功/探测通过自动复活——与manualOff分层)；v26.0 音源日志增强(竞速过程打点+失败逐源明细——配合App「音源日志」一次失败定位到子源与原因)；v25.11 沙箱兼容(raceFirst setInterval→setTimeout——洛雪移动端VM无setInterval，修复UnhandledPromiseRejection与候选取回失效)；v25.10 防御修复(raceFirst 裸url分支source兜底空串，防未来裸值调用丢子源透出)；v25.9 子源名透出(musicUrl 返回补 subSourceName——实际子源中文名，App 播放页音源标签直接显示「平台·子源名」，无需端侧维护映射)；v25.8 实际子源透出(musicUrl 成功返回 {url,type,subSource}——实际交付链接的子源id，缓存同存；配合 App 播放页音源标签显示「平台·子源」)；v25.7 第三轮全维度审计修复(探测清单过滤手动关闭/默认关闭源——juhe五源不再白耗外呼、手动关闭源不再被标休眠)；v25.6 第二轮全量审计修复(熔断跳过不再误记限流/CDN410走1min缓存/删COPYRIGHT_LIMIT死枚举/删HIRES死常量/补allFailShortTtlMs配置键)；v25.5 全量审计修复(溯音咪咕对象冒充直链/星海备API伪装直链/酷我官方错歌校验/删死代码)；v25.4 字段完整透传(juheGetUrl 透传 strMediaMid/mediaMid/hash/rid/copyrightId 等原始ID+meta层，提升API型源高音质解析)；v25.3 音源健康审计修复(健康分口径/并发保护/本地节流误记/探测锁/休眠复活/降频生效)；v25.2 健康面板使用中分组(真实播放请求记录 lastUsedAt 时间戳进快照，配合 App 五级分区排序：使用中→正常→待采样→休眠→已关)；v25.1 Juhe源族治理(Juhe上游2026-10-28实测整体不可用：五平台超时/429→默认关闭；协议型探测(固定歌POST校验code200/303)接通休眠/自动关闭/自愈复活；全链网络类失败30s短缓存防反复卡18s)；v25.0 Juhe源族扩充(tx全链路实测通：POST→303→vkeys中转→qqmusic直链；wy/kg/mg按平台标识字段注册，服务端受限时自动降级)；v24.0 音质协商链可观测(降档日志+快照 lastQuality 实际交付音质，配合 App 真实音质显示；降档链 v11.12/v13.x 已有)；v23.1 发布前自检门(scripts/self-check.js：版本串同步/actions声明/README与ROADMAP同步，CI L2 任一失败阻断发布)；v22.0 配置化治理(USER_CONFIG 全量参数化：缓存TTL/熔断阈值与冷却/429退避/并发与限速/探测间隔/竞速超时均可配，缺省行为与历史一致)；v19.2 探测自适应(连续通过≥5轮降频为每2轮一探)+探测歌曲池扩至12首(随机轮换防单曲被风控)；v19.1 并发上限+滑动窗口限速+UA池轮换(单源并发≤2、3s窗口≤5次、4套移动UA轮换，防上游风控)；v19.0 健康分排序源链(sortChainByHealth 强化：verified 源附加优先权重，串行兜底按健康分降序；v14.1 已实现基础)；v18.0 源族扩充(Juhe聚合API：kw 全音质 303重定向校验协议全链路实测可用，独立新源族 juheKw)；v17.2 429限流退避(短退避30s不触发熔断、连续≥3次标记被限状态，快照 rateLimited)；v17.1 成功率按音质分档(byQuality：flac/320k/128k 各档 rate/avgTime，flac 坏但低音质好的源精确呈现)；v17.0 失败归因分离(版权/业务失败单独计数 copyrightFail——无版权歌不再惩罚健康分/不计入成功率分母)；v16.5.1 停用 updateAlert 发版弹窗(每次加载/导入不再弹更新提示)；v16.5 健康面板"管"能力(toggle 源级开关+manualOff手动锁定防探测复活、probe 手动探测一轮返回结果、快照 sleeping 休眠字段)；v16.4 健康面板数据语义修正(无样本 successRate/avgTime 返回 null + reqCount/probeCount 样本计数，App 显示"-"与采样数)；v16.3 App健康面板联动(health action：App fork 声明即注册 getHealth，聚合快照直通设置页面板)；v16.2发布后监控/回滚决策(Release自动巡检基线+核心源连续失败≥3天回滚)；v16.1死源建议(连续3天失败自动标记)；v16.0仓库级成功率统计(probe-history近7日)；v15.2健康统计快照(getHealthSnapshot)；v15.0歌词/封面透出(wy lyric+pic/kw pic)；v14.3分级探测+休眠复活；v14.2竞速匹配校验；v14.1健康权重自学习；v14.0失败原因结构化透出；v13.4配置化+v12.1失败缓存差异化；保留v12.0星海kw高音质双源+v11.12防错歌加固
 * @version 8.12.3 P2 桥媒体信封（2026-11-12：App 二进制响应改 base64 信封 + 256KB 分片；toBytes 识别 __lxMedia:2 并按片独立解码，byteLength 不符拒绝；X1~X6 先红后绿）｜8.12.2 P1 降级所有权（2026-11-12：inited 显式声明 fallbackOwner="source"，App 对声明源不再重复换源；W1/W2 先红后绿）｜8.12.1 跨平台缓存失效与面板开关（2026-11-11：toggleSource 清跨平台缓存 + 已关源成功缓存失效 + 面板暴露 crossPlatformEnabled；U10 回归）｜8.12.0 跨平台兜底（2026-11-11：跨平台 resolver + 严格歌名/歌手/时长 ±5s 校验 + 6s grace + 10min 结果缓存 + cross_platform 事件；juheTx 默认开启）｜8.11.7 健康面板配置可管（2026-11-10：config 写模式开放 8 个布尔开关并校验类型；数字白名单补齐 cacheTtlHighQualityMs/verify 族/竞速批参数/冷启动族/短路族，verifyDurRatio 与 verifyDurGapSec 允许 0；K4c 先红后绿）｜8.11.6 收尾加固（2026-11-10：①buildSourceChain 过滤改用无副作用的 structuralSkipReason，建链不再提前消耗半开试探；②toggleSource 开/关都清账；③fallbackRace 改 attempts+admit，交付类码不再被业务码吞；④GET 无字节且头不足时 HEAD 1500ms、405 回退 GET 只取头补证；⑤r-admission 补 A16~A20，23 条）｜8.11.5 L4 裁决层（2026-11-10：把散在六处的「判定 + 记账」收成一个 `admit()` + 一张 `ADMISSION_POLICY` 策略表 + 三个调用点（候选执行/降档聚合/缓存命中）；新增 L0 归一层 `toBytes`/`kindOf`/`headerEvidence` 修「App 桥把 Buffer 序列化成普通对象 → 全源 NOT_AUDIO」；代表码优先级改为交付类码高于 NOT_FOUND，治「NOT_AUDIO 被吞成 1h 歌级锁 → 该请求已知失败(缓存中)」；`clearSourceLedger` 统一清账，治「关源/重开无效」；证据四档 weak/medium/strong + weak 永不超 60s）｜8.11.4 错歌兜底修复（F-01）+ 8.11.3 通读缺陷修复（2026-11-10：①Juhe 响应 code 归一——上游时而 "200"(串)时而 200(数)，旧实现严格比数字，字符串形态 100% 判失败；②Juhe 303 重定向校验值同样按字符串宽松比；③降档链不再跳档——flac24bit 起跑原链 [flac24bit,flac,128k] 跳过 320k 档，现逐档下降；④未登记 TTL 的失败码（CONFIG_ERROR：ikun 403/huibq 未配置/lingchuan 未配置）按注释承诺的 5 分钟过期，旧实现永不超时；⑤删除恒假的每源 mids 上限守卫（比的是音质集合，≤4 永远 < 200）；新增 test/audit/n-fixes.js N1~N4 四条回归，四条均先红后绿）；8.11.1 交付真实性闸门（2026-11-08：①交付前 1KB 字节验真——FLAC STREAMINFO / MP3 Xing 解析真实时长，「能播但只有 5 秒」的试听片段不再被当 FLAC 交付，阈值 60%+15s 双条件；②音质标签回填真话——请求 flac 实得 128kbps mp3 时窗口改显示 128K；③降档链修复 128k 终档被截断；④缓存双入口验真 + 移除 helloworld 内层缓存，缓存里的片段不再绕过判据；⑤源级限流识别——同源三档全片段判定被风控，冷却 5 分钟转跨平台；⑥巡检同判据——probe 片段判定 + 日报片段率单列；⑦压力测试固化 test/stress-test.js（G1~G8 / 32 断言）并据此修三处：JSON 错误体不再被「拿不准放行」放过、源级限流冷却改为跨歌证据（单曲受限不再误伤同源其他歌）、片段直链兜底加 10 分钟 TTL 防过期签名；冒烟 60→67 组）；8.10.12 探测素材修正：移除写死的无效/单曲素材，统一走免费歌池轮换（2026-11-08：超时/网络异常不再判死链 + LINK_EXPIRED 补 err.code）；8.10.3 全覆盖审计修复（2026-11-07：15 项隐性缺陷——①probeSingleSource 形参 cfg 遮蔽全局 cfg()，huibq（唯一冷启动源）探针 100% TypeError、请求从未发出、健康分恒负垫底休眠；②429 不再计入 byQuality.fail/成功率分母（旧实现 3 次限流把该档短路 1h），半开遇 429 收口回 open；③降档交付按实交付音质入缓存槽（旧实现请求 flac 实给 128k 却存进 flac 槽，6h 内不再试高音质）；④失败缓存命中还原代表性 code（旧实现 code 丢失，网络全挂被当歌不存在）；⑤平台分组改由竞速链生成（旧手写清单漏 suyinKuwo，wy/tx/mg/kg 只剩它活着时误报全挂）；⑥探针通过一并复位断路器/限流退避（旧实现只清休眠，出现「探针正常 + 熔断中」矛盾态）；⑦末端预算上界显式钳在总预算+保底；⑧validateUrl 返回 trim 后 URL；⑨320k/128k 单档预算 4s→5s 对齐单源超时（旧 4s 把 5s 内本可成功的源判死并累计熔断）；⑩删死键 raceOverallTimeoutMs、面板改暴露真键 raceBudgetMs；⑪huibq 假成功判据单点化并补进探针；⑫lingchuan 补 platforms 显式声明；⑬A19 备注 20→144；⑭冒烟新增 T50–T55（回退必红）共 55 组）；v8.10.2 分档预算 + 冷启动探针豁免 + 缓存分级 TTL（2026-11-06：①分档预算 flac 6s/320k 4s/128k 4s + 末档保底 3s，防高音质吃满总预算饿死低档致点歌无声；②冷启动源探针超时放宽到 30s + 豁免自动关闭，onrender 冷态 30s 不再被 20min 误摘；③短路探路窗口 6h→1h；④高音质缓存分级 TTL——flac/320k 30min，128k 保持 6h；⑤历史快照 60→144（10h→24h）；新增 5 配置键，冒烟 T46/T47/T48；v8.10.1 补修：缓存 LRU 缺 delete 致高音质缓存过期重播 TypeError，T46/T47/T48 由空壳改为真行为验证）；v8.9 huibq 平台能力收窄 + 收尾修复（2026-11-06：实测 tx/mg/kg 必败，从三平台链尾移除仅留 kw/wy；source-audit.js 跑完自动退出；hyw 候选状态修正为已判否自动复检）；v8.8 竞速引擎改造（2026-11-06：全链分批错峰并发 + 跨档 12s 总预算 + 档位短路 + 冷启动预热 + gdWy 降批 + verified 精确等待；新增7配置键）；v8.7 huibq 假成功治理（2026-11-06：上游"无法获取播放链接！"仍返回 code=0 + 可播错链（实测 panspace 酷我 206）→ 按 msg 失败词判失败，避免静默播错歌）；v8.6 huibq 默认开启（2026-11-06：A 方案——全平台全音质实测可用，进 kw/wy/tx/mg/kg 链尾兜底 + 探针自动托管；v8.5 巡检工具与监控口径升级（2026-11-06：新增 scripts/source-audit.js 全源取链巡检工具 + docs/SOURCE_AUDIT.md 基线；probe.js 对取链型端点加真实取链+Range 可播二次校验（治理"端点✅但源410"假阳性，xcvts 由假✅转真❌）；huibq 探针补齐；真死域名排除清单更新）；v8.4 全源全接口深度巡检修复（2026-11-06：溯音酷我 128k br=7→9（实测唯一可播，flac/320k VIP 死链）；星海后端去自定义 X-Token 改匿名第三方调用（上游对无效 token 403"请使用官方版本"，匿名放行）；全源实测 15→21/35 可用）；v8.3 ikun默认开启（2026-11-06：A 方案——公益版免卡密，默认进 kw 链尾兜底 + 每3轮探测自动托管；探测失败2次自动关、恢复自动开自愈闭环）；v8.2 ikun探针接入（2026-11-06：默认关闭源补齐健康探针——用户手动开启后自动监控健康；POST /music/url 固定歌 rid=228908 + code200/url非空 + Range可播二次校验，tier=secondary 每3轮一探避免公益版频控）；v8.1 ikun源复活（2026-11-06：域名 api.ikunshare.com→c.wwwweb.top，接口 GET /url→POST /music/url，公益版免卡密，实测 rid=228908 晴天出真实128k链）；v8.0 全量审计修复版（2026-11-05 版本重新整理：原 v11.11~v29.9 共53个小版本合并为8个大版本，旧版本详细历史归档见 docs/ARCHIVE_OLD_TAGS.md）
 * @author 豆包定制
 * @contribution 基线同v11.11(2026-10-15实测)；v11.12为代码加固(防错歌/https/熔断分类/探测一致性/清理)；v11.13(2026-10-28)：D11日志防御——vm无console沙箱验证通过(修复前加载抛TypeError复现)，真机装包待验证；v12.0(2026-10-28)：星海后端kw高音质——E10实测(128k/320k/flac/flac24bit四档code200、URL均Range 206、魔数正确、码率吻合、ID3歌名对应songmid)，解除仅128k限制并接入kw链双源，URL http→https升级(实测https 206可播)；v12.1-v13.4(2026-10-28)：失败缓存差异化+探测收敛+决策日志+updateAlert+自动化测试CI+端点巡检+音质表收敛+配置化，走验证链L0-L1(L2按需)
 */
// ============================================================
// 第〇部分：用户配置区（v2.0 配置化 — 开配置即用，默认不暴露）
// 需配置源（ikun 卡密 / 聆川密钥）从这里读取：
//   方式一：直接改下方 USER_CONFIG 常量（改源码即生效）；
//   方式二：宿主全局注入 globalThis.__lxSourceConfig = { ikunApiKey, lingchuanApiKey }（fork App 可做，不改源码）。
// 星海令牌默认自动生成（device_id 随机）；如需固定可在此配置 xinghaiDeviceId。
// ============================================================
const USER_CONFIG = {
  ikunApiKey: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.ikunApiKey) || "", // 填入 ikun 卡密后开启
  lingchuanApiKey: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.lingchuanApiKey) || "",
  xinghaiDeviceId: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.xinghaiDeviceId) || "",
  // v5.0：运行参数全量可配置（从 __lxSourceConfig 读取，缺省用代码默认值，行为与历史一致）
  // v8.11.1（审计修复）：交付真实性闸门的开关/阈值必须可注入——旧版这几个键不在白名单，
  // cfg() 永远拿到默认值，导致"可关闭、可回滚"是空话（实测 __lxSourceConfig.verifyDelivery=false 完全无效，
  // 片段兜底也无法用配置关掉，只能整版回滚）。布尔开关一律用 ?? ，否则 false 会被默认值吞掉。
  verifyDelivery: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.verifyDelivery) ?? true,
  truthfulQuality: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.truthfulQuality) ?? true,
  qualityFloor: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.qualityFloor) ?? true,
  verifyOnCacheHit: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.verifyOnCacheHit) ?? true,
  // v8.12：跨平台兜底开关与等待窗口。确定性失败立即回退；只有超时类失败先给主平台
  // 一个 grace 窗口，避免主平台马上要成功时白跑一次跨平台搜索。
  crossPlatformEnabled: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.crossPlatformEnabled) ?? true,
  crossPlatformGraceMs: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.crossPlatformGraceMs) ?? 6000,
  crossPlatformSearchTimeoutMs: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.crossPlatformSearchTimeoutMs) || 4000,
  // v8.11.2（D-33，V23b 实测暴露）：previewUrlPreFilter 旧不在白名单，cfg() 永远拿到默认 false，
  // 开关等于不存在（helloworld 的试听URL预筛因此从未执行）。补进白名单，布尔用 ?? 防 false 被吞。
  previewUrlPreFilter: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.previewUrlPreFilter) ?? false,
  fragmentFallback: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.fragmentFallback) ?? true,
  // v8.11.2（D-35，V26c/d/f 实测暴露）：验真族阈值用 || 读配置时，传 0 会被吞成默认值（0 比例/0 间隔=不设限 是合法值），统一改 ?? 。
  verifyTimeoutMs: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.verifyTimeoutMs) ?? 3000,
  verifyMinOriginalSec: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.verifyMinOriginalSec) ?? 90,
  verifyDurRatio: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.verifyDurRatio) ?? 0.6,
  verifyDurGapSec: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.verifyDurGapSec) ?? 15,
  cacheTtlMs: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.cacheTtlMs) || 21600000,          // 成功缓存 TTL(6h，低音质用)
  cacheTtlHighQualityMs: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.cacheTtlHighQualityMs) || 1800000, // v8.10：高音质缓存 TTL(30min，flac/320k/24bit 用)
  failCacheNotFoundMs: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.failCacheNotFoundMs) || 3600000,  // 失败缓存 404→1h
  failCacheExpiredMs: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.failCacheExpiredMs) || 60000,      // 失败缓存 410→1min
  breakerThreshold: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.breakerThreshold) || 3,       // 熔断阈值
  breakerCooldownMs: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.breakerCooldownMs) || 180000, // 熔断冷却
  rateLimitBackoffMs: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.rateLimitBackoffMs) || 30000, // 429退避
  maxConcurrency: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.maxConcurrency) || 2,            // 单源并发上限
  rateWindowMs: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.rateWindowMs) || 3000,             // 限速窗口
  rateWindowMax: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.rateWindowMax) || 5,              // 窗口内请求上限
  healthCheckIntervalMs: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.healthCheckIntervalMs) || 600000, // 探测间隔(10min)
  raceMatchWaitMs: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.raceMatchWaitMs) || 600,         // verified 等待窗口
  allFailShortTtlMs: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.allFailShortTtlMs) ?? 30000,      // v6.0：全链网络类失败短缓存 TTL(补齐 v6.0 漏配键)
  raceBudgetMs: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.raceBudgetMs) || 12000,          // v8.8：单次请求总预算(跨音质档共享)
  raceBudgetPerQuality: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.raceBudgetPerQuality) || { flac: 6000, "320k": 5000, "128k": 5000, flac24bit: 6000 }, // v8.10：分档预算（防高音质吃满总预算饿死低档）
  raceBudgetFloorMs: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.raceBudgetFloorMs != null) ? globalThis.__lxSourceConfig.raceBudgetFloorMs : 3000,     // v8.10：最后一档保底预算(防整次取链失败)
  raceBatchSize: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.raceBatchSize) || 3,             // v8.8：每批并发源数
  raceBatchStaggerMs: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.raceBatchStaggerMs) || 300, // v8.8：批间错峰
  coldStartTimeoutMs: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.coldStartTimeoutMs) || 8000, // v8.8：冷启动源单源超时
  coldStartProbeTimeoutMs: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.coldStartProbeTimeoutMs) || 30000, // v8.10：冷启动源探针超时（onrender 冷态 30s，8s 必误判）
  coldStartWarmTtlMs: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.coldStartWarmTtlMs) || 300000, // v8.8：冷启动预热间隔
  qualityShortCircuit: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig) ? globalThis.__lxSourceConfig.qualityShortCircuit : undefined, // v8.8：档位短路开关(缺省 true)
  coldStartWarmEnabled: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig) ? globalThis.__lxSourceConfig.coldStartWarmEnabled : undefined, // v8.8：冷启动预热开关(缺省 true)
  qualityShortCircuitSamples: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.qualityShortCircuitSamples) || 3, // v8.8：档位短路样本门槛
  qualityShortCircuitProbeMs: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.qualityShortCircuitProbeMs) || 3600000, // v8.10：短路放行探路间隔(1h，原 6h 太长)
  playDeadReviveMs: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.playDeadReviveMs) || 300000,        // v7.0：播放摘除后半开试探冷却期(5min)
  // 五轮 MEM：记忆表条目上限（与 ALLOWED_KEYS/PARAM_LIMITS 同步登记；漏了这行注入会静默失效）
  memoryMapMax: (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.memoryMapMax) || 2000,
};
// v5.0：运行参数读取（USER_CONFIG 缺失/空值时回退默认）
function cfg(key, def) {
  const v = USER_CONFIG[key];
  if (v === undefined || v === null || v === "") return def;
  // 五轮 EDGE（D-21）：NaN / Infinity 一律回落默认值。
  // NaN 的 typeof 是 number，而 NaN <= 0、NaN < min、NaN > max 三个比较全为 false，
  // 三道配置校验同时失效；一旦写入 USER_CONFIG（如 raceBudgetMs=NaN），
  // 竞速预算恒为 NaN → 所有请求立即 NETWORK_TIMEOUT，直到进程重启。
  if (typeof def === "number" && !Number.isFinite(v)) return def;
  return v;
}

// ============================================================
// 第一部分：常量配置
// ============================================================
const CACHE_TTL_MS = 21600000;          // 6小时 成功缓存
// v8.11：交付真实性闸门阈值（实测依据：FLAC STREAMINFO 与 MP3 Xing 均在文件开头，1KB 足够解析时长）
const VERIFY_MIN_ORIGINAL_SEC = 90;     // 原曲短于此不按比例判（防误杀原生短歌）
const VERIFY_DUR_RATIO = 0.6;           // 真实时长 < 原曲 60%
const VERIFY_DUR_GAP_SEC = 15;          // 且绝对差值 > 15 秒（双条件，容忍同名不同版本 175s/199s 并存）
const VERIFY_RANGE_BYTES = 1023;        // Range 取 1KB
const QUALITY_CEILING_TTL_MS = 21600000; // 能力备档 6 小时
const FAIL_CACHE_TTL_MS = 300000;       // 5分钟 失败缓存（v1.0 起按失败类型差异化：见 getFailCached）
const CACHE_MAX_SIZE = 500;
const FAIL_CACHE_MAX_SIZE = 300;
// 五轮 MEM：按歌曲累积的表过去只有 successCache / failCache 有容量上限，
// deliveryQualityMap / fragmentSourceMap / qualityCeilingMap / fragmentUrlMap 四张表
// 只增不删（后三张靠"读取时顺手删过期"收尸，从不被读的条目会永久驻留）。
// 单条很小，但"永不释放 + 依赖访问才清理"是结构性风险，统一加最旧淘汰上限。
const MEMORY_MAP_MAX = 2000;              // 按歌曲累积表上限（约 500 首 × 4 档）
const HTTP_URL_REGEX = /^https?:\/\//i;
const BREAKER_THRESHOLD = 3;            // 连续失败熔断阈值
const BREAKER_COOLDOWN_MS = 180000;
const RATE_LIMIT_BACKOFF_MS = 30000;   // v4.0：429 限流短退避(30s)，不触发熔断
const RATE_LIMIT_TRIP = 3;            // v4.0：连续限流≥3 次标记"被限"状态
const SOURCE_MAX_CONCURRENCY = 2;    // v4.0：单源最大并发数（超限本轮跳过，防上游过载/风控）
const RATE_WINDOW_MS = 3000;         // v4.0：滑动窗口限速窗口(3s)
const RATE_WINDOW_MAX = 5;           // v4.0：窗口内最大请求数（超限本轮跳过）     // 熔断冷却 3分钟
const RETRY_TIMES = 1;                  // 网络错误重试次数(v1.0:2→1，避免重试放大)

const ERROR_CODES = {
  NETWORK_TIMEOUT: 'NETWORK_TIMEOUT',
  NETWORK_ERROR: 'NETWORK_ERROR',
  PARAM_ERROR: 'PARAM_ERROR',
  RATE_LIMIT: 'RATE_LIMIT',
  SERVER_ERROR: 'SERVER_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  MISMATCH: 'SONG_MISMATCH',
  CONFIG_ERROR: 'CONFIG_ERROR',
  LINK_EXPIRED: 'LINK_EXPIRED',   // v1.0：HTTP 410 签名/直链过期
  // v8.11：交付真实性闸门（wrapExecute 交付前用真实字节判定，取代靠 URL 关键词的死代码检测）
  PREVIEW_FRAGMENT: 'PREVIEW_FRAGMENT',   // 只拿到试听片段（如酷我 VIP 歌三档同给 5s）
  NOT_AUDIO: 'NOT_AUDIO',                 // 返回网页/JSON 等根本不是音频的内容
  STREAM_PLAYLIST: 'STREAM_PLAYLIST'      // m3u8 等流播放列表，播放器不支持
};

// v8.11.1（二轮审计补）：全仓 65 处 `throw new Error("CODE: msg")` 只把码写进 message、
// 没赋 err.code。音乐主链末尾有 finalErr.code 兜底，但 lyric/pic/toggle 这类**直连 action**
// 不经聚合，App 拿到的 err.code 是 undefined → 无法分类、显示"未知错误"。
// 这里在出口统一按 message 前缀归一（不逐个改 65 处，零风险）。
function normalizeErrCode(err, fallback) {
  if (!err || err.code) return err;
  const msg = String(err.message || "");
  // D-30：throw 处写的是「值」（`SONG_MISMATCH`），键名却是 `MISMATCH`（12 码里唯一键≠值）。
  // 只按键名匹配会让它回落成 NETWORK_ERROR，连带三处一起错：
  //   ① 用户/日志看到「网络错误」而真相是「搜索到的不是这首歌」；
  //   ② FAIL_CACHE_TTL_BY_CODE[MISMATCH]=1h 永不生效，同一首错歌被反复重查重外呼；
  //   ③ 熔断把业务失败当网络失败计数，用户点几首匹配不上的歌就能把健康源打进冷却。
  const hitKey = Object.keys(ERROR_CODES).find(k => msg.startsWith(k + ":") || msg.startsWith(ERROR_CODES[k] + ":"));
  // 赋「值」而不是键名：全仓比较一律是 `=== ERROR_CODES.X`（即值），
  // 而 MISMATCH 的键名 `MISMATCH` ≠ 值 `SONG_MISMATCH`，只按键名匹配会双双落空。
  err.code = hitKey ? ERROR_CODES[hitKey] : (fallback || ERROR_CODES.NETWORK_ERROR);
  return err;
}

// v8.11.1（审计补）：新增的交付类错误码在 App 侧没有专门文案，App 只原样展示 message。
// 给它们补一句中文可读说明，避免用户看到裸英文码；格式仍是「CODE: 中文（技术细节）」，
// 冒烟/巡检按 code 前缀判定，不受影响。
const CODE_HINT = {
  [ERROR_CODES.PREVIEW_FRAGMENT]: "该曲目只提供试听片段（已尽量给出可用片段）",
  [ERROR_CODES.NOT_AUDIO]: "接口返回的不是有效音频内容",
  [ERROR_CODES.STREAM_PLAYLIST]: "接口返回的是流播放列表，播放器不支持",
};


// v1.0：失败缓存差异化 TTL（404=歌确实不存在，缓存1h；410=签名死链，很快恢复，缓存1min；网络类/限流=瞬时，不缓存）
const FAIL_CACHE_TTL_BY_CODE = {
  [ERROR_CODES.NOT_FOUND]: 60 * 60 * 1000,        // 404/无版权/搜索无结果 → 1小时
  [ERROR_CODES.MISMATCH]: 60 * 60 * 1000,          // 歌信息不匹配(近1h内重查意义低) → 1小时
  [ERROR_CODES.LINK_EXPIRED]: 60 * 1000,           // 410 签名死链 → 1分钟
  [ERROR_CODES.PARAM_ERROR]: 60 * 1000,            // v8.11.2：上游返回非法URL(非http/https) → 1分钟（脏数据会很快恢复）
  // v8.11：交付真实性类——只缓存很短时间，且片段按音质档分键，避免 flac 失败连坐 128k
  [ERROR_CODES.PREVIEW_FRAGMENT]: 30 * 1000,       // 试听片段 → 30秒
  [ERROR_CODES.NOT_AUDIO]: 60 * 1000,              // 非音频内容 → 1分钟
  [ERROR_CODES.STREAM_PLAYLIST]: 60 * 1000,        // 流播放列表 → 1分钟
  [ERROR_CODES.RATE_LIMIT]: 0,                     // 限流 → 不缓存(会恢复)
  [ERROR_CODES.NETWORK_TIMEOUT]: 0,                // 超时 → 不缓存(瞬时)
  [ERROR_CODES.NETWORK_ERROR]: 0,                  // 网络错误 → 不缓存(瞬时)
  [ERROR_CODES.SERVER_ERROR]: 0,                   // 5xx → 不缓存(服务端会恢复)
};

const TIMEOUT_CONFIG = { search: 3000, parse: 5000, default: 5000 }; // v1.0: parse 8000→5000

// API 端点
// GD Studio（实测：仅网易云 netease，br=999→真实flac/br=320→320k/br=128→128k；免费公共服务，5分钟50次限制，仅用于wy高音质链，不进128k兜底竞速）
const GD_API = "https://music-api.gdstudio.xyz/api.php?use_xbridge3=true&loader_name=forest&need_sec_link=1&sec_link_scene=im&theme=light";
// 溯音系（实测：仅 Kuwo 可用；QQ -403维护中；163 免费歌恢复可用；咪咕 502 IP限制）
const SUYIN_QQ_API = "https://oiapi.net/api/QQ_Music";
const SUYIN_QQ_KEY = "oiapi-ef6133b7-ac2f-dc7d-878c-d3e207a82575";
const SUYIN_163_API = "https://oiapi.net/api/Music_163";
const SUYIN_KUWO_API = "https://oiapi.net/api/Kuwo";
const SUYIN_MIGU_API = "https://api.xcvts.cn/api/music/migu";
// Huibq：实测仅酷我真实可用，其他平台假兜底，默认关闭
const HUIBQ_API = "https://lxmusicapi.onrender.com";
const JUHE_API = "https://api.music.lerd.dpdns.org";  // v4.0：Juhe聚合API(CF)——kw 全链路实测可用(2026-10-28 E21：POST /kw→303重定向→mobi.kuwo.cn签名→kw-er.kuwo.cn直链)
const HUIBQ_REQUEST_KEY = "share-v3";
// 聆川（未配置，默认关闭；2026-11-06 实测域名不可解析已死，保留常量便于恢复，probe 已排除该域名）
const LINGCHUAN_API = "https://api.lingchuan.com/v1";
// 星海后端主域聚合（v1.0重新接入kw；v1.0起支持 kw 128k/320k/flac 三档，E10实测四档code200+206可播+ID3对应；wy 签名URL本机403疑绑定后端出口IP，未接入wy）
const XINGHAI_BACKEND_API = "https://yy.zddyr.top/lx/api/";
// 网易云官方 outer 直连（免费歌302→真实mp3；VIP/无版权歌404自动跳过；固定128k）
const WY_OUTER_API = "https://music.163.com/song/media/outer/url?id={id}.mp3";
// v3.0：歌词/封面接口（实测：网易云公开 lyric/detail 接口可用；酷我仅封面 hts_MVPIC 可用，歌词无稳定接口）
const WY_LYRIC_API = "https://music.163.com/api/song/lyric";
const WY_DETAIL_API = "https://music.163.com/api/song/detail";
// 酷我官方直连（自研：搜索r.s→rid→convert_url，固定128k真实mp3，无第三方）
const KUWO_SEARCH_API = "http://search.kuwo.cn/r.s";
const KUWO_CONVERT_API = "http://antiserver.kuwo.cn/anti.s";
// v8.12：跨平台兜底——目标平台搜索端点。
// 关键约束：各平台 ID 不通用（kw 的 rid 喂给 tx 源必失败），所以必须先搜到目标平台自己的
// songmid/id/rid，再用目标平台源链取链；这里只做「歌名+歌手+时长」严格身份匹配。
const QQ_SEARCH_API = "https://c.y.qq.com/soso/fcgi-bin/client_search_cp";
const WY_SEARCH_API = "https://music.163.com/api/search/get/web";
const CROSS_PLATFORM_ORDER = ["tx", "wy", "kw"];
const CROSS_PLATFORM_NAMES = { tx: "QQ音乐", wy: "网易云音乐", kw: "酷我音乐" };
// ikun 服务器源（v8.1：域名迁移 api.ikunshare.com→c.wwwweb.top；公益版免卡密（X-Api-Key 留空），付费版填 USER_CONFIG.ikunApiKey；2026-11-06 实测 rid=228908 晴天出真实128k链）
const IKUN_API = "https://c.wwwweb.top";

// 长青SVIP（实测：IP白名单/无链接/需付费level，已失效，默认关闭）
const CHANGQING_URL_TEMPLATES = {
  tx: "http://175.27.166.236/kgqq/qq.php?type=mp3&id={id}&level={level}",
  wy: "http://175.27.166.236/wy/wy.php?type=mp3&id={id}&level={level}",
  kw: "https://musicapi.haitangw.net/music/kw.php?type=mp3&id={id}&level={level}",
  kg: "https://music.haitangw.cc/kgqq/kg.php?type=mp3&id={id}&level={level}",
  mg: "https://music.haitangw.cc/musicapi/mg.php?type=mp3&id={id}&level={level}"
};
// 念心SVIP（实测：全部404/空跳转，已失效，默认关闭）
const NIANXIN_URL_TEMPLATES = {
  tx: "https://music.nxinxz.com/kgqq/tx.php?id={id}&level={level}&type=mp3",
  wy: "http://music.nxinxz.com/wy.php?id={id}&level={level}&type=mp3",
  kw: "http://music.nxinxz.com/kw.php?id={id}&level={level}&type=mp3",
  kg: "https://music.nxinxz.com/kgqq/kg.php?id={id}&level={level}&type=mp3",
  mg: "http://music.nxinxz.com/mg.php?id={id}&level={level}&type=mp3"
};
// v7.0：helloworld 源（生态候选，2026-10-29 实证：kw 全链端到端可用——flac/320k 直链 Range206+魔数校验通过）
// 通道①：酷我官方 convert_url_with_sign（rid 直取，与 kuwoOfficial 同链路族但独立子源计数；flac24bit 被服务器降级 128k，按实际交付）
const HELLOWORLD_KW_CONVERT_API = "http://nmobi.kuwo.cn/mobi.s";
// 通道②：haitangw v1 新版 API（code:0 + data.url 直接匹配，实测可用；作为通道①的备用）
const HELLOWORLD_HTW_API = "https://musicserver.haitangw.cc/v1/music/resolve-url";

// ============================================================
// 第二部分：音源开关（按实测结果配置，可自行调整）
// ============================================================
const SOURCE_TOGGLES = {
  // ---- 默认开启（实测可用） ----
  suyinKuwo: true,      // 溯音酷我：全平台兜底(第三方，支持flac/320k/128k)
  wyOuter: true,        // 网易云官方outer直连：固定128k免费歌直链(实测可用)
  kuwoOfficial: true,   // 酷我官方直连：固定128k真实mp3(实测可用，无第三方)
  suyin163: true,       // 溯音163：免费歌真实128k直链，VIP歌url:null自动跳过
  gdWy: false,          // GD Studio：wy flac/320k高音质源(限5min50次，2026-11-08实测75%时间403配额用完，默认关闭省竞速预算，用户需要可手动开)
  xinghaiBackend: true, // 星海后端主域：kw 高音质双源(v1.0，与溯音酷我并列flac/320k) + 128k 兜底(与酷我官方并列)
  helloworldKw: true,   // v7.0：helloworld(kw) 生态候选——convert_url_with_sign 直链 128k/320k/flac 三档全端到端实证通过(2026-10-29)，默认开启参与 kw 链竞速
  // ---- 默认关闭（接口失效/需配置，可自行开启） ----
  xinghaiBackup: false, // 星海备：域名不可解析
  suyinQQ: false,       // 溯音QQ：2026-10-28实测仍-403(oiapi.net维护中)，保持关闭待上游恢复
  suyinMigu: false,     // 溯音咪咕：2026-10-28实测——上游api.xcvts.cn域名200可达(0.26s)但接口502"服务器IP可能被咪咕限制"，换备用域名不可行(IP级限制)，待上游恢复
  changqingVip: true,  // 长青：v1.0实测仅kw恢复(302→car-er.kuwo.cn新鲜mp3)，仅kw 128k兜底
  nianxinVip: true,    // 念心：v1.0实测仅kw恢复(302→car-er.kuwo.cn新鲜mp3)，仅kw 128k兜底
  huibq: true,          // v8.6：A 方案默认开启——2026-11-06 全源巡检实测 kw/wy/tx/mg/kg 全平台 flac/320k/128k 均出链可播，进全平台链尾兜底（onrender 免费实例冷启动慢，仅在前面源全失败时打到）
  juheKw: false, juheTx: true, juheWy: false, juheKg: false, juheMg: false, // v8.12：juheTx 2026-11-11 实测恢复——vkeys 中转返回 128k 直链且音频标签为 Michita/Pureness/302.91s；其余四源仍默认关，探测连续通过自愈
  lingchuan: false,     // 聆川：需配置
  ikun: true            // v8.3 默认开启（A 方案）：公益版免卡密（c.wwwweb.top）、kw 链尾兜底；tier=secondary 每3轮一探（30分钟）；探测失败2次自动关、恢复自动开（自愈闭环）
};

// ============================================================
// 第二部分B：健康探测模块（v1.0：探测清单收敛为当前可用源 + 并发探测 + 统一跟随302）
// ============================================================
// 运行时开关：随探测结果自动变化；buildSourceChain 以它为准
const runtimeToggles = { ...SOURCE_TOGGLES };
// v4.0：用户手动关闭锁定——手动 toggle(false) 的源，探测通过也不再自动启用（除非用户手动开启）
const manualOff = {};

const HEALTH_CHECK_INTERVAL_MS = 10 * 60 * 1000; // 每10分钟一轮
const HEALTH_CHECK_INITIAL_DELAY_MS = 60 * 1000; // 加载后1分钟开始第一轮
const HEALTH_CHECK_TIMEOUT = 6000;                // 单次探测超时(v1.0:4000→6000，减少误摘)
const PROBE_PASS_REQUIRED = 2;                    // 连续通过2次才判定可用（防抖动）
const PROBE_FAIL_REQUIRED = 2;                    // 连续失败2次才判定失效（防抖动）
// v3.0：分级探测——核心源(播放主链路)每轮探测，次要源每3轮一探（省请求且减少对免费源的骚扰）
const PROBE_TIER_CORE_INTERVAL = 1;
const PROBE_TIER_SECONDARY_INTERVAL = 3;
// v3.0：失效源休眠——连续3轮失败进入休眠(不再每轮空打)，每10轮做一次复活试探（新端点/上游恢复时自动回归）
const PROBE_SLEEP_AFTER_DEAD = 3;
const PROBE_WAKE_EVERY_ROUND = 10;
// v1.0：探测歌曲池轮换（晴天/海阔天空/稻香），避免单曲被风控导致探测误判
const PROBE_SONG_POOL = ["晴天", "海阔天空", "稻香", "青花瓷", "七里香", "夜曲", "后来", "光年之外", "演员", "平凡之路", "成都", "小幸运"];
// v1.0 (D9)：溯音163 探测免费歌池（实测 code:0 + data[0].url 真实mp3；186016周杰伦VIP无url已排除）
const PROBE_163_IDS = ["2652820720", "347230"];

// v6.0 (A2)：Juhe 协议型探测配置工厂（POST /platform，校验服务端 code 200/303）
function juheProbeCfg(platform, ids) {
  return {
    tier: "secondary",  // 每3轮一探（免费 worker，减少对限流中上游的打扰）
    url: `${JUHE_API}/${platform}`,
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": getMobileUserAgent() },
    body: JSON.stringify({
      type: "128k",
      musicInfo: { name: "晴天", singer: "周杰伦", album: "叶惠美", duration: 271000, interval: 271, source: platform, ...ids, quality: "128k" }
    }),
    check: b => !!b && typeof b === "object" && (Number(b.code) === 200 || Number(b.code) === 303)
  };
}

// 各源探测请求定义：仅保留当前可用源，失效源不再每轮空打
function buildProbeConfig() {
  const probeSong = PROBE_SONG_POOL[(globalThis.__probeRound || 0) % PROBE_SONG_POOL.length];
  const cfg = {
    gdWy: {
      tier: "core",
      // v1.0 (D9)：补 Range 可播性二次校验（防"网关200+签名过期410"假存活）。
      // v8.10.5：探测素材修正。原先写死 186016，而那是「周杰伦 VIP 无 url」——仓库早已把它从探测池排除，
      // 继续拿它探测会让本端点无论好坏都取不到链接、被恒定判死（2026-11-08 实测确认）。
      // 改用 2652820720（scripts/probe.js 实测 payload:true、真取到 mp3 链）。
      // 注意：**不能**把 PROBE_163_IDS 整体搬来轮换，该池另一首 347230 未在本端点验证过，轮换会制造假故障；
      // 各端点的探测素材须各自实测通过后才可用。
      url: `${GD_API}&types=url&source=netease&id=2652820720&br=320`,
      check: b => !!b && typeof b === "object" && typeof b.url === "string" && b.url.length > 0,
      extractUrl: b => (b && typeof b === "object" && typeof b.url === "string" && b.url.length > 0) ? b.url : null
    },
    xinghaiBackend: {
      tier: "core",
      // v8.10.5 复核结论：此处写死「晴天/周杰伦」是**刻意的**，不是缺陷——
      // 该接口按「歌名+歌手」联合检索，写死热门曲目可保证稳定命中；若换成轮换歌名但歌手对不上会直接搜不到，反而制造误判。
      url: `${XINGHAI_BACKEND_API}?source=kw&name=${encodeURIComponent("晴天")}&singer=${encodeURIComponent("周杰伦")}&songmid=1&interval=&albumName=&quality=128k`,
      headers: { "X-Client": "lx-aggregate/11.7" }, // v8.4：去 X-Token（无效 token 会被上游 403，匿名第三方调用放行）
      check: b => !!b && typeof b === "object" && Number(b.code) === 200 && typeof b.url === "string" && b.url.length > 0
    },
    suyin163: {
      tier: "core",
      // v1.0 (D9)：免费歌池轮换 + Range 可播性二次校验（与溯音酷我探测标准一致）
      url: `${SUYIN_163_API}?id=${PROBE_163_IDS[(globalThis.__probeRound || 0) % PROBE_163_IDS.length]}`,
      check: b => !!b && typeof b === "object" && Array.isArray(b.data) && typeof (b.data[0] || {}).url === "string" && b.data[0].url.length > 0,
      extractUrl: b => (b && Array.isArray(b.data) && typeof (b.data[0] || {}).url === "string" && b.data[0].url.length > 0) ? b.data[0].url : null
    },
    suyinKuwo: {
      tier: "core",
      // v1.0 P0：双音质分域探测(flac br=1 + 128k br=7)，任一可播即算源存活；
      // 修复"128k仍410死链但flac已恢复新签名"时单路探测误判整体失效、误摘高音质源
      // v1.0：探测歌曲走 PROBE_SONG_POOL 轮换，防单曲被风控误判
      probes: [
        {
          url: `${SUYIN_KUWO_API}?msg=${encodeURIComponent(probeSong)}&n=1&br=1`,
          check: b => !!b && typeof b === "object" && (!!(b.data && b.data.url) || /音乐链接/.test(String(b.message || ""))),
          extractUrl: b => ((b && b.data && b.data.url) ? b.data.url : (String((b && b.message) || "").match(/音乐链接[：:](\S+)/) || [])[1]) || null
        },
        {
          url: `${SUYIN_KUWO_API}?msg=${encodeURIComponent(probeSong)}&n=1&br=9`,
          check: b => !!b && typeof b === "object" && (!!(b.data && b.data.url) || /音乐链接/.test(String(b.message || ""))),
          extractUrl: b => ((b && b.data && b.data.url) ? b.data.url : (String((b && b.message) || "").match(/音乐链接[：:](\S+)/) || [])[1]) || null
        }
      ]
    },
    wyOuter: {
      tier: "core",
      // v8.10.5：保留写死 2652820720 —— 2026-11-08 实测该 id 走 outer 接口返回 200/audio/mpeg/4.4MB 真可播；
      // 而池内 347230 走同一接口返回 200 **但 content-type 是 text/html**（不可播），
      // 若随池轮换会每两轮误报一次「源不可用」。故本端点探测素材固定为此 id，不参与轮换。
      url: WY_OUTER_API.replace("{id}", "2652820720"),
      headers: { "User-Agent": getMobileUserAgent() },
      checkRes: res => res.statusCode === 200 && /audio|octet|mpeg/i.test(String(res.headers?.["content-type"] || ""))
    },
    kuwoOfficial: {
      tier: "secondary",
      url: `${KUWO_SEARCH_API}?client=kt&all=${encodeURIComponent("晴天 周杰伦")}&pn=0&rn=1&ft=music&rformat=json&encoding=utf8`,
      headers: { "User-Agent": getMobileUserAgent() },
      check: b => {
        const raw = typeof b === "string" ? b : String(b || "");
        return raw.includes("MP3RID") && raw.includes("abslist");
      }
    },
    // v7.0：helloworld(kw) 探测——convert_url_with_sign 2000kflac 固定歌(rid=228908 晴天)，code=200+url 非空判定
    helloworldKw: {
      tier: "secondary",
      url: `${HELLOWORLD_KW_CONVERT_API}?f=web&user=0&source=kwplayerhd_ar_1.1.4.5_tianbao_T1A_qirui.apk&type=convert_url_with_sign&rid=228908&br=2000kflac`,
      headers: { "User-Agent": getMobileUserAgent() },
      check: b => !!b && typeof b === "object" && Number(b.code) === 200 && !!b.data && typeof b.data.url === "string" && b.data.url.length > 0
    },
    // v1.0：长青kw/念心kw 302→car-er.kuwo.cn新鲜mp3，Range校验可播(用rid=228908 晴天周杰伦)
    changqingVip: {
      tier: "secondary",
      url: CHANGQING_URL_TEMPLATES.kw.replace("{id}", "228908").replace("{level}", "standard"),
      headers: { "User-Agent": getMobileUserAgent(), "Range": "bytes=0-1023" },
      checkRes: res => (res.statusCode === 200 || res.statusCode === 206) && /audio|octet|mpeg/i.test(String(res.headers?.["content-type"] || "")) && !/kw\.php/.test(String(res.url || ""))
    },
    nianxinVip: {
      tier: "secondary",
      url: NIANXIN_URL_TEMPLATES.kw.replace("{id}", "228908").replace("{level}", "standard"),
      headers: { "User-Agent": getMobileUserAgent(), "Range": "bytes=0-1023" },
      checkRes: res => (res.statusCode === 200 || res.statusCode === 206) && /audio|octet|mpeg/i.test(String(res.headers?.["content-type"] || "")) && !/nxinxz\.com/.test(String(res.url || ""))
    },
    // v6.0 (A2)：Juhe 聚合源族协议型探测——Juhe 为 POST 协议型源(需歌曲ID)，
    // 探测固定歌"服务端能否完整响应 code 200(直链)/303(重定向)"；上游整体不可用时
    // (超时/429)探测失败 → 触发自动关闭+休眠；上游恢复 → 连续通过 → 自动复活(自愈闭环)
    juheKw: juheProbeCfg("kw", { songmid: "228908", id: "228908" }),
    juheTx: juheProbeCfg("tx", { songmid: "228908", id: "228908" }),
    juheWy: juheProbeCfg("wy", { id: "2652820720", songmid: "2652820720" }),
    juheKg: juheProbeCfg("kg", { hash: "228908", songmid: "228908", id: "228908" }),
    juheMg: juheProbeCfg("mg", { songmid: "228908", id: "228908" }),
    // v8.2：ikun 探针——默认关闭源补齐健康探针（用户手动开启后进探测清单自动监控健康；
    // 关闭状态被 buildProbeConfig 过滤不白探）。POST /music/url 固定歌 kw 128k（rid=228908 晴天），
    // code=200 + url 非空 + Range 可播二次校验；tier=secondary 每3轮一探，降低公益版接口频控压力。
    // 注意：探测连续失败2次会自动关闭（默认关闭源关闭后不再探测，恢复需用户再次手动开启——避免永久白探公益接口）
    ikun: {
      tier: "secondary",
      url: `${IKUN_API}/music/url`,
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": getMobileUserAgent(), "X-Api-Key": USER_CONFIG.ikunApiKey || "" },
      body: JSON.stringify({ source: "kw", musicId: "228908", quality: "128k" }),
      check: b => !!b && typeof b === "object" && Number(b.code) === 200 && typeof b.url === "string" && b.url.length > 0,
      extractUrl: b => (b && typeof b === "object" && typeof b.url === "string" && b.url.length > 0) ? upgradeToHttps(b.url) : null
    },
    // v8.5：huibq 探针（v8.6 起源已默认开启，探针自动托管健康；2026-11-06 全源巡检实测 kw/wy/tx/mg/kg 全平台全音质出链可播）。GET /url/kw/固定歌(rid=228908) + code=0 + url 非空 + Range 可播；tier=secondary 每3轮一探。
    huibq: {
      tier: "secondary",
      url: `${HUIBQ_API}/url/kw/228908/128k`,
      headers: { "X-Request-Key": HUIBQ_REQUEST_KEY, "User-Agent": getMobileUserAgent() },
      // v8.10.3：探针补 msg 失败词判据（与取链路径同一单点 isHuibqFailMsg），
      // 否则上游 code=0 +「无法获取播放链接」+ 可播错链时探针仍判"健康"
      check: b => !!b && typeof b === "object" && Number(b.code) === 0 && typeof b.url === "string" && b.url.length > 0 && !isHuibqFailMsg(b.msg),
      extractUrl: b => (b && typeof b === "object" && typeof b.url === "string" && b.url.length > 0) ? b.url : null
    }
  };
  // v3.0：休眠源过滤——连续 PROBE_SLEEP_AFTER_DEAD 轮失败后不再每轮空打；
  // 每 PROBE_WAKE_EVERY_ROUND 轮做一次复活试探（上游恢复/新端点时自动回归）
  const round = globalThis.__probeRound || 0;
  // v6.0：探测清单过滤——(1) 用户手动关闭(manualOff)的源不探测：用户已明确不想用，白耗外呼还会把源标成"休眠"污染面板语义；
  // (2) 默认关闭(SOURCE_TOGGLES=false)且未被手动开启的源不探测：juhe 五源等默认关，探测失败进 sleeping 会让面板显示"休眠"而非"已关"。
  // 注意：自动关闭的源(SOURCE_TOGGLES=true 被探测失败关掉)保留探测——这是自愈复活闭环的前提
  for (const id of Object.keys(cfg)) {
    if (manualOff[id]) { delete cfg[id]; continue; }
    if (SOURCE_TOGGLES[id] === false && runtimeToggles[id] !== true) { delete cfg[id]; continue; }
    if (probeState.sleeping[id]) {
      const since = probeState.sleepRound[id] || 0;
      if (round - since < PROBE_WAKE_EVERY_ROUND) {
        delete cfg[id]; // 休眠中且未到复活轮：跳过本轮探测
      } else {
        logWarn(`健康探测: [${id}] 到达复活试探轮，重探`);
      }
    }
  }
  return cfg;
}

// v3.0：分级探测轮次判定（core 每轮 / secondary 每 N 轮一探）
function tierShouldProbe(round, tier, sourceId) {
  const interval = tier === "secondary" ? PROBE_TIER_SECONDARY_INTERVAL : PROBE_TIER_CORE_INTERVAL;
  if (round % interval !== 0) return false;
  // v4.0/v6.0：探测频率自适应——连续通过≥5轮的源降频为每2轮一探（健康源无需高频验证，省上游外呼）
  // v6.0 修复：改用 passStreak（连续通过轮数）判定——旧实现用 passCount，但 passCount 到 2 即清零，降频从未生效
  if (sourceId && (probeState.passStreak[sourceId] || 0) >= 5 && round % 2 !== 0) return false;
  return true;
}

const probeState = {
  passCount: {},
  // v6.0：连续通过轮数（不清零的长期连胜，用于探测降频；passCount 到 PROBE_PASS_REQUIRED 会清零，无法承载降频判断）
  passStreak: {},
  failCount: {},
  // v3.0：失效休眠状态——deadCount 连续失败累计；sleeping=true 进入休眠；sleepRound 记录休眠起点轮
  deadCount: {},
  sleeping: {},
  sleepRound: {},
  running: false
};

async function probeSingleSource(id, pc) {
  // v8.10.3：形参从 cfg 改名 pc —— 旧名遮蔽了全局配置读取函数 cfg(key, def)，
  // 而下面冷启动分支要调 cfg('coldStartProbeTimeoutMs')，直接 TypeError 被 catch 吞成"探测失败"。
  // 全仓唯一 coldStart 源是 huibq → 它的探针 100% 失败（实测：正常响应也不发请求、score 恒为负）。
  // v1.0 P0：支持多路探测(probes)，任一路"结构+可播"通过即算源存活；
  // 解决溯音酷我"flac已恢复但128k仍410"时，单路(仅128k)探测误判整体失效、误摘高音质源的问题
  const probes = pc.probes || [{
    url: pc.url,
    // v8.2 修复：method/body 漏透传——juheProbeCfg(juhe 五源)与 ikun 探针都是 POST 协议型源，
    // 旧实现只透传 url/headers/check，实际发出 GET → 上游 404/405 误判失败（juhe 探测长期"失败"的隐藏原因之一）
    method: pc.method,
    body: pc.body,
    headers: pc.headers,
    check: pc.check,
    checkRes: pc.checkRes,
    extractUrl: pc.extractUrl
  }];
  try {
    const results = await Promise.all(probes.map(async p => {
      const startProbe = Date.now();
      try {
        // v8.10：冷启动源探针超时放宽（onrender 冷态 30s，6s 必误判）
        const h = SOURCE_HANDLERS[id];
        const probeTimeout = (h && h.coldStart) ? cfg('coldStartProbeTimeoutMs', 30000) : HEALTH_CHECK_TIMEOUT;
        const res = await httpRequest(p.url || "", {
          method: p.method || "GET",
          headers: { "User-Agent": getMobileUserAgent(), ...(p.headers || {}) },
          body: p.body,
          timeout: probeTimeout,
          follow_max: 5   // v1.0 P0：统一跟随302，修复wyOuter(outer 302→mp3)被误判失败
        });
        let usable = p.checkRes ? p.checkRes(res) : (p.check ? p.check(res.body) : true);
        // v1.0 P0：结构/状态通过后，对解析出的音频URL做Range可播性二次校验，
        // 识破"网关200、结构完整、但CDN签名已过期410死链"的假存活(如溯音酷我)
        if (usable && typeof p.extractUrl === "function") {
          const audioUrl = p.extractUrl(res.body);
          usable = audioUrl ? await isAudioPlayable(audioUrl, probeTimeout) : false; // v8.10：冷启动源可播校验同放宽
        }
        return { usable, duration: Date.now() - startProbe };
      } catch (e) {
        const duration = Date.now() - startProbe;
        recordHealthEvent({ event: "probe_result", traceId: `probe:${globalThis.__probeRound || 0}:${id}`, sourceId: id, ok: false, code: extractErrorCode(e), latencyMs: duration });
        return { usable: false, duration };
      }
    }));
    const usable = results.some(r => r.usable);
    recordHealthEvent({ event: "probe_result", traceId: `probe:${globalThis.__probeRound || 0}:${id}`, sourceId: id, ok: usable, code: usable ? "" : "PROBE_FAIL", latencyMs: Math.round(results.reduce((s, r) => s + r.duration, 0) / Math.max(results.length, 1)) });
    // v1.0：探测结果并入竞速统计（成功率/均时供 sortChainByHealth 排序复用；
    // 只更新统计、不触发熔断——熔断仅由真实播放请求触发，避免探测与熔断双机制打架）
    recordProbeResult(id, usable, results.reduce((s, r) => s + r.duration, 0) / Math.max(results.length, 1));
    return { usable, raw: null };
  } catch (e) {
    recordHealthEvent({ event: "probe_result", traceId: `probe:${globalThis.__probeRound || 0}:${id}`, sourceId: id, ok: false, code: extractErrorCode(e), latencyMs: 0 });
    recordProbeResult(id, false, 0);
    return { usable: false, raw: null };
  }
}

// v1.0：探测结果并入竞速统计（见 probeSingleSource）
// v3.0：探测样本独立计数（probe*），与真实请求样本分级加权——探测仅作低权重参考，真实请求主导健康评分
function recordProbeResult(id, usable, avgDuration) {
  const b = getBreaker(id);
  b.probeRequests = (b.probeRequests || 0) + 1;
  if (usable) {
    b.probeSuccess = (b.probeSuccess || 0) + 1;
    b.probeTime = (b.probeTime || 0) + (avgDuration || 0);
  }
}

function applyProbeResult(id, usable) {
  if (usable) {
    // v8.10.3：探测通过 → 一并复位断路器与限流退避。旧实现只清 sleeping/playDead/passCount，
    // 面板会出现"探针正常 + 熔断中"的矛盾态；更关键的是 half-open 卡死（F-01）只能靠重启救回。
    const br = getBreaker(id);
    if (br.state !== "closed" || br.failureCount > 0 || br.rateLimited) {
      br.state = "closed"; br.failureCount = 0; br.lastFailureTime = 0;
      br.rateLimitUntil = 0; br.rateLimited = false; br.rateLimitCount = 0;
      logInfo(`健康探测: [${id}] 探测通过，断路器与限流退避已复位`);
    }
    probeState.failCount[id] = 0;
    probeState.passCount[id] = (probeState.passCount[id] || 0) + 1;
    probeState.passStreak[id] = (probeState.passStreak[id] || 0) + 1; // v6.0：连胜累计（降频判断用）
    // v7.0：探测通过 → 播放摘除解除（源恢复即回归竞速链）
    if ((playDeadStreak.get(id) || 0) > 0) { playDeadStreak.set(id, 0); playDeadDeadline.delete(id); }
    // v3.0：探测通过即复活（清休眠），避免复活试探成功后被下一次抖动打回休眠
    delete probeState.deadCount[id];
    delete probeState.sleeping[id];
    delete probeState.sleepRound[id];
    if (probeState.passCount[id] >= PROBE_PASS_REQUIRED) {
      const wasOff = runtimeToggles[id] === false;
      if (wasOff && !manualOff[id]) { // v4.0：手动关闭锁定的源不自动复活
        runtimeToggles[id] = true;
        logInfo(`健康探测: [${id}] 连续${PROBE_PASS_REQUIRED}次探测通过，已自动启用`);
      }
      probeState.passCount[id] = 0; // 重置，避免反复打日志
    }
  } else {
    probeState.passCount[id] = 0;
    probeState.passStreak[id] = 0; // v6.0：连胜中断
    probeState.failCount[id] = (probeState.failCount[id] || 0) + 1;
    if (probeState.failCount[id] >= PROBE_FAIL_REQUIRED) {
      const wasOn = runtimeToggles[id] === true;
      // v8.10：冷启动源豁免自动关闭——onrender 冷态 30s，两轮探测失败可能是冷态未唤醒，不是真死
      const h = SOURCE_HANDLERS[id];
      const isColdStart = h && h.coldStart;
      if (wasOn && !isColdStart) {
        runtimeToggles[id] = false;
        logWarn(`健康探测: [${id}] 连续${PROBE_FAIL_REQUIRED}次探测失败，已自动关闭(恢复后会自动启用)`);
      } else if (wasOn && isColdStart) {
        logWarn(`健康探测: [${id}] 连续${PROBE_FAIL_REQUIRED}次探测失败，冷启动豁免自动关闭（冷态可能未唤醒，保留启用）`);
      }
      probeState.failCount[id] = 0;
    }
    // v3.0：连续失败累计 → 休眠（不再每轮空打无效请求）
    probeState.deadCount[id] = (probeState.deadCount[id] || 0) + 1;
    if (probeState.deadCount[id] >= PROBE_SLEEP_AFTER_DEAD) {
      if (!probeState.sleeping[id]) {
        probeState.sleeping[id] = true;
        probeState.sleepRound[id] = globalThis.__probeRound || 0;
        logWarn(`健康探测: [${id}] 连续${PROBE_SLEEP_AFTER_DEAD}轮失败，进入休眠(每${PROBE_WAKE_EVERY_ROUND}轮复活试探一次)`);
      } else {
        // v6.0：休眠中复活试探失败 → 重置休眠起点轮。
        // 旧实现不更新 sleepRound，round-since 恒≥10 → 复活轮失败后每轮都重探（失去休眠意义、白耗外呼）
        probeState.sleepRound[id] = globalThis.__probeRound || 0;
      }
    }
  }
}

// v8.0：健康历史趋势记录（每次自动探测完成后存一条）；v8.10：上限 60→144（10min/条 ≈ 24h）
const healthHistory = [];
const HEALTH_HISTORY_MAX = 144; // v8.10：历史快照上限（60→144，10min/条 ≈ 24h，原 10h 跨天就断）

// 2.4 方案：音源侧只读事件环形缓冲。
// 只服务本地排障：记录"一次播放走到哪个子源、哪一步、什么错误码、多久"，
// 不记歌名、URL、搜索词、账号、设备 ID、位置。App 通过 healthEvents action 只读拉取。
const HEALTH_EVENT_MAX = 500;
const HEALTH_EVENT_FIELDS = ["traceId", "event", "sourceId", "platform", "quality", "ok", "code", "latencyMs", "reason"];
const healthEventRing = [];
let healthEventSeq = 0;
let healthEventDropped = 0;
const HEALTH_TRACE_KEY = Symbol("lxHealthTrace");

const clipText = (v, max) => String(v == null ? "" : v).slice(0, max);
function recordHealthEvent(entry) {
  if (!entry || typeof entry !== "object") return;
  const e = {
    seq: ++healthEventSeq,
    ts: Date.now(),
    traceId: clipText(entry.traceId, 64),
    event: clipText(entry.event || "unknown", 32),
  };
  for (const k of HEALTH_EVENT_FIELDS) {
    if (k === "traceId" || k === "event" || entry[k] === undefined) continue;
    if (k === "ok") {
      if (typeof entry.ok === "boolean") e.ok = entry.ok;
    } else if (k === "latencyMs") {
      const n = Number(entry.latencyMs);
      if (Number.isFinite(n) && n >= 0) e.latencyMs = Math.round(n);
    } else {
      e[k] = clipText(entry[k], k === "reason" ? 40 : 48);
    }
  }
  healthEventRing.push(e);
  while (healthEventRing.length > HEALTH_EVENT_MAX) {
    healthEventRing.shift();
    healthEventDropped++;
  }
}
function getHealthEvents(params) {
  const cap = Math.min(Math.max(Number(params && params.limit) || HEALTH_EVENT_MAX, 1), HEALTH_EVENT_MAX);
  const traceId = clipText(params && params.traceId, 64);
  const filtered = traceId ? healthEventRing.filter(e => e.traceId === traceId) : healthEventRing;
  return {
    schema: 1,
    capacity: HEALTH_EVENT_MAX,
    dropped: healthEventDropped,
    events: filtered.slice(-cap).map(e => ({ ...e })),
  };
}
function attachHealthTrace(songInfo, traceId) {
  if (!songInfo || typeof songInfo !== "object") return;
  try {
    Object.defineProperty(songInfo, HEALTH_TRACE_KEY, {
      value: clipText(traceId, 64),
      configurable: true,
      enumerable: false,
    });
  } catch (e) { /* 冻结对象不阻断播放 */ }
}
function healthTraceOf(songInfo) {
  return (songInfo && typeof songInfo === "object" && songInfo[HEALTH_TRACE_KEY]) || "";
}

async function runHealthCheck(saveHistory = true) {
  if (probeState.running) return;
  probeState.running = true;
  try {  // v6.0：try/finally——构建配置等任何异常都不会把 running 锁死（否则探测链永久停摆）
  // v1.0：轮次先递增再构建配置，确保探测歌曲池轮换从首轮生效
  const round = (globalThis.__probeRound = (globalThis.__probeRound || 0) + 1);
  const probeConfig = buildProbeConfig();
  // v3.0：分级探测——核心源每轮，次要源每 PROBE_TIER_SECONDARY_INTERVAL 轮一探
  const ids = Object.keys(probeConfig).filter(id => tierShouldProbe(round, probeConfig[id].tier || "core", id));
  logInfo(`健康探测: 开始第${round}轮，共${ids.length}个源(核心每轮/次要${PROBE_TIER_SECONDARY_INTERVAL}轮一探)`);
  // v1.0 P2：改并发探测，一轮从~50s降到~6s
  await Promise.all(ids.map(async id => {
    const result = await probeSingleSource(id, probeConfig[id]);
    applyProbeResult(id, result.usable);
  }));
  const active = Object.keys(runtimeToggles).filter(k => runtimeToggles[k]);
  logInfo(`健康探测: 本轮完成，当前自动启用: ${active.join(", ")}`);
  // v8.0：记录历史快照（用于趋势图）——v30.1：手动探测不存历史，避免污染趋势
  if (saveHistory) {
    const snap = getHealthSnapshot();
    const historyEntry = {
      timestamp: Date.now(),
      sources: {}
    };
    for (const [id, item] of Object.entries(snap)) {
      if (id.startsWith('_')) continue; // 跳过平台聚合等特殊字段
      // v30.1：只存趋势图需要的字段（score + successRate），去掉多余的 name/enabled
      historyEntry.sources[id] = {
        score: item.healthScore,
        successRate: item.successRate
      };
    }
    healthHistory.push(historyEntry);
    if (healthHistory.length > HEALTH_HISTORY_MAX) healthHistory.shift();
  }
  } catch (e) {
    logWarn(`健康探测异常: ${e && e.message ? e.message : String(e)}`);
  } finally {
    probeState.running = false; // v6.0：异常也释放探测锁
  }
}

function startHealthCheck() {
  setTimeout(async () => {
    try { await runHealthCheck(); } catch (e) { logWarn(`健康探测异常: ${e.message}`); }
    setTimeout(function tick() {
      const iv = cfg('healthCheckIntervalMs', HEALTH_CHECK_INTERVAL_MS);
      runHealthCheck().then(() => {
        setTimeout(tick, iv);
      }).catch(() => {
        setTimeout(tick, iv);
      });
    }, cfg('healthCheckIntervalMs', HEALTH_CHECK_INTERVAL_MS));
  }, HEALTH_CHECK_INITIAL_DELAY_MS);
}

const Q = ["128k", "320k", "flac", "flac24bit"];
const PLATFORM_QUALITIES = { wy: Q, tx: Q, kw: Q, kg: Q, mg: Q };
// v1.0 P0-6：上报 qualitys 按真实能力裁剪——不再上报无人能交付的 flac24bit
const REPORT_QUALITIES = {
  wy: ["128k", "320k", "flac"],   // outer/suyin163=128k；GD Studio=flac；suyinKuwo=flac兜底
  tx: ["128k", "320k", "flac"],   // 仅 suyinKuwo 搜索酷我兜底
  kw: ["128k", "320k", "flac"],   // kuwoOfficial/xinghaiBackend=128k；suyinKuwo=flac
  kg: ["128k", "320k", "flac"],   // 仅 suyinKuwo 搜索酷我兜底
  mg: ["128k", "320k", "flac"]    // 仅 suyinKuwo 搜索酷我兜底
};

const PLATFORM_TO_XINGHAI_BACKUP = { wy: "netease", tx: "qq", kw: "kuwo" };
// v2.0 (E11)：音质映射 magic number 收敛——统一 QUALITY_TO_X 表，按官方"源内映射"模型组织（请求音质 → 各源内部编码）
// 各子源只从本表取编码，禁止散落 magic number（gdBrMap 等已并入）
const QUALITY_TO_X = {
  // 通用 br 参考（星海 level 语义 / 长青念心 level）：flac24bit/hires 均 999
  br: { "128k": "128", "192k": "192", "320k": "320", flac: "740", flac24bit: "999", "24bit": "999" },
  // 溯音QQ：br 数值（hires=3/atmos=2/master=1/24bit=1 专用值直传）
  suyinQQ: { "128k": 7, "320k": 5, flac: 4, hires: 3, atmos: 2, master: 1, "24bit": 1 },
  // 酷我系（溯音酷我搜索 br 参数）：flac=1 / 320k=5 / 128k=7
  kuwo: { flac: 1, "320k": 5, "128k": 9, "24bit": 1 }, // v8.4 修正：128k br=7→9（实测 br=9 唯一可播 mp3，7/5/1 均 CDN410 死链；flac/320k 为 VIP 链 loginUid 空 410）
  // GD Studio：br 字符串（flac/hires 均走 999 真实 flac）
  gd: { "128k": "128", "192k": "320", "320k": "320", flac: "999", flac24bit: "999", hires: "999" }
};
// v1.0 P0-4：实际音质降级阶梯（去掉无源区分的192k短接），请求音质放首位再向下降级
const QUALITY_PRIORITY = ["flac24bit", "flac", "320k", "128k"];
// v1.0 P0-1：音质等级数值，用于源能力过滤与缓存音质校验
const QUALITY_RANK = { "128k": 1, "192k": 2, "320k": 3, flac: 4, flac24bit: 5, hires: 4, master: 5, atmos: 5, "24bit": 5 };
function qualityRank(q) { return QUALITY_RANK[String(q || "128k").toLowerCase()] || 1; }
const QUALITY_FIRST = true; // 音质优先模式：解析从请求音质(默认flac)开始逐级降级

const { EVENT_NAMES, request, on, send, utils, env, version } = globalThis.lx;

// ============================================================
// 第三部分：日志 + LRU双层缓存 + 断路器
// ============================================================
// v1.0 D11：console 宿主防御 — 官方移动版「可用宿主环境 API」仅 setTimeout/clearTimeout（无 console 保证）
// 依据：lxmusic.toside.cn/mobile/custom-source 宿主 API 清单 + fork user-api-preload.js 未注入 console + vm 无 console 沙箱复现（修复前加载即抛 TypeError）
const safeConsole = {
  log: (typeof console !== "undefined" && typeof console.log === "function") ? console.log.bind(console) : () => {},
  warn: (typeof console !== "undefined" && typeof console.warn === "function") ? console.warn.bind(console) : () => {},
  error: (typeof console !== "undefined" && typeof console.error === "function") ? console.error.bind(console) : () => {},
};
const LOG_ENABLED = (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.logEnabled !== undefined) ? !!globalThis.__lxSourceConfig.logEnabled : true;
// v1.0：debug 级源级决策日志（默认关；排查时改 LOG_DEBUG=true 或宿主注入 __lxSourceConfig.logDebug=true）
const LOG_DEBUG = (typeof globalThis !== "undefined" && globalThis.__lxSourceConfig && globalThis.__lxSourceConfig.logDebug) || false;
function logInfo(...args) { if (LOG_ENABLED) safeConsole.log("[聚合音源][信息]", ...args); }
function logWarn(...args) { if (LOG_ENABLED) safeConsole.warn("[聚合音源][警告]", ...args); }
function logDebug(...args) { if (LOG_ENABLED && LOG_DEBUG) safeConsole.log("[聚合音源][决策]", ...args); }

// v1.0：直接用原字符串作 Map 键（Map 支持字符串键），省掉32位哈希与碰撞覆盖
function createLRUCache(maxSize, ttl) {
  const map = new Map();
  return {
    get(key) {
      const entry = map.get(key);
      if (!entry) return null;
      // v8.11.2（D-32）：过期只报 null、不删除——否则下层 hasExpired() 永远查不到，
      // 「全部源失败 → 过期缓存兜底」成死代码（V22 实测）。
      if (Date.now() - entry.timestamp >= ttl) { return null; }
      map.delete(key);
      map.set(key, entry);
      return entry.value;
    },
    // v8.10.1：补 delete——分级 TTL 过期时 getCachedUrl 需要主动删除条目（旧无此方法，高音质缓存超 30min 重播必 TypeError）
    delete(key) { map.delete(key); },
    set(key, value) {
      if (map.has(key)) map.delete(key);
      map.set(key, { value, timestamp: Date.now() });
      if (map.size > maxSize) {
        const firstKey = map.keys().next().value;
        if (firstKey !== undefined) map.delete(firstKey);
      }
    },
    hasExpired(key) {
      const entry = map.get(key);
      if (!entry) return false;
      return Date.now() - entry.timestamp >= ttl;
    },
    getExpired(key) {
      const entry = map.get(key);
      return entry ? entry.value : null;
    },
    // v30.1：清空所有缓存（配置热更新时调用，让新 TTL 立即生效）
    clear() {
      map.clear();
    },
    // 五轮 MEM：暴露条目数供健康快照观测（此前只有写入/读取，无任何容量可观测口径）
    size() { return map.size; },
    // v8.11.3（D-01）：键迭代——toggle 开启源时要按平台前缀精确失效失败缓存（全清会误伤其他平台）
    keys() { return map.keys(); }
  };
}

// 五轮 MEM：带上限的 Map 写入，超限淘汰最早插入的一条（Map 迭代顺序即插入顺序）。
// 上限读 cfg('memoryMapMax')，默认 MEMORY_MAP_MAX、硬顶 20000（PARAM_LIMITS 校验）。
function boundedMapSet(map, key, value) {
  if (map.has(key)) map.delete(key);
  map.set(key, value);
  const max = Math.max(1, Number(cfg('memoryMapMax', MEMORY_MAP_MAX)) || MEMORY_MAP_MAX);
  if (map.size > max) {
    const oldest = map.keys().next().value;
    if (oldest !== undefined) map.delete(oldest);
  }
}
const successCache = createLRUCache(CACHE_MAX_SIZE, cfg('cacheTtlMs', CACHE_TTL_MS));
// v1.0：失败缓存 LRU 不再用固定5min TTL——过期由 getFailCached 按失败类型差异化判断(404→1h/410→1min/网络错误不缓存)
const failCache = createLRUCache(FAIL_CACHE_MAX_SIZE, Number.MAX_SAFE_INTEGER);

const breakerMap = new Map();
// v8.11 闸门旁路状态
const deliveryQualityMap = new Map();   // `${handlerId}|${platform}|${mid}|${请求档}` → 实交付音质（供 getUrlWithFallback 回填标签）
const fragmentSourceMap = new Map();    // `${platform}|${mid}` → { sources:Set<handlerId>, ts }（片段源记忆，降档时跳过，128k 例外）
// v8.11.1（审计补）：不持久化的取舍——上限记忆只服务「同一进程内 6h 内重复点同一首」的降档试错，
// 进程重启后重新探一次成本极低（一次 flac 请求即被验真判降级后回落），引入文件/宿主存储的复杂度与风险更大。
const qualityCeilingMap = new Map(); // 内存态：重启即丢（设计如此）    // `${platform}|${mid}` → { quality, ts }（能力备档：该歌实际最高可得档）
const FRAGMENT_SOURCE_TTL_MS = 300000;  // 5 分钟（实测停 80 秒即恢复，5 分钟足够且不长期误伤）
const PREVIEW_COOLDOWN_MS = 300000;     // 源级限流冷却 5 分钟（三段全片段视为源被限流）
const previewCooldownMap = new Map();   // `${handlerId}` → 截止时间戳（源级限流冷却）
const fragmentUrlMap = new Map();       // `${platform}|${mid}|${quality}` → {url,quality,source,name}（全档片段兜底用）
const fragmentHandlerSongsMap = new Map(); // handlerId → { mids:Set, ts }（源级限流的跨歌证据）
const FRAGMENT_URL_TTL_MS = 600000;      // 片段直链是临时签名，10 分钟后不得再拿来兜底
// v7.0：播放实时失败摘除——真实播放请求连续失败 ≥PLAY_DEAD_STREAK 次即从竞速链摘除（不等探测周期）；
// 复活三路径：①播放成功即时解除；②探测通过解除（探测清单内源）；③摘除冷却期满后自动半开试探（不依赖探测清单，失败重新计时）
// 与 manualOff 用户锁定分层：手动关闭永不复活
const PLAY_DEAD_STREAK = 3;
const playDeadStreak = new Map();
const playDeadDeadline = new Map(); // 摘除计时起点（半开试探冷却）
function isPlayDead(sourceId) {
  const streak = playDeadStreak.get(sourceId) || 0;
  if (streak < PLAY_DEAD_STREAK) return false;
  // 冷却期满 → 允许半开试探（返回 false 放行进链；试探失败 recordFailure 会重新计时）
  const reviveMs = cfg('playDeadReviveMs', 5 * 60 * 1000);
  const age = Date.now() - (playDeadDeadline.get(sourceId) || 0);
  logDebug(`[摘除判定] ${sourceId} streak=${streak} age=${age}ms revive=${reviveMs}ms 结果=${age < reviveMs}`);
  return age < reviveMs;
}
function getBreaker(sourceId) {
  if (!breakerMap.has(sourceId)) {
    breakerMap.set(sourceId, { state: 'closed', failureCount: 0, lastFailureTime: 0, totalRequests: 0, totalSuccess: 0, totalTime: 0,
      // v3.0：探测样本单独计数（与真实请求分级加权，避免探测污染真实成功率）
      probeRequests: 0, probeSuccess: 0, probeTime: 0,
      // v4.0：失败归因分离——版权/业务失败（无版权404、歌不存在、错歌）单独计数，
      // 不惩罚健康分、不计入成功率分母（避免热门版权歌冤枉健康源）
      copyrightFail: 0,
      // v4.0：按音质分档统计 { quality: {req, success, time, fail, businessFail} }
      byQuality: {},
      // v4.0：限流退避——429 不触发熔断，短退避后恢复；连续限流标记"被限"
      rateLimitCount: 0, rateLimitUntil: 0, rateLimited: false,
      // v6.0：最近一次成功交付音质（音质协商链降档后可诊断"UI显示FLAC实际128k"问题）
      lastQuality: null });
  }
  return breakerMap.get(sourceId);
}
// v4.0：429 限流单独处理——短退避(30s)后自动恢复，不计入熔断阈值；连续≥3 次标记"被限"
function recordRateLimit(sourceId, quality) {
  const b = getBreaker(sourceId);
  // v8.10.3：429 不再计入请求/失败分子分母——限流是"源没坏、只是过载"，旧实现记进
  // byQuality.fail/totalRequests 后会被 isQualityHopeless(fail+linkExpired>=3) 当成
  // "该档 3 次全失败"直接短路 1 小时，同时把面板成功率拉低。
  b.rateLimitCount = (b.rateLimitCount || 0) + 1;
  b.rateLimitUntil = Date.now() + cfg('rateLimitBackoffMs', RATE_LIMIT_BACKOFF_MS);
  if (b.rateLimitCount >= RATE_LIMIT_TRIP) b.rateLimited = true;
  // v8.10.3：半开试探遇 429 必须收口——canExecute 在 half-open 恒返回 false，
  // 不收口则 state 永久停在 half-open，该源再也不会被调用（只修了业务失败/本地节流两条出口）。
  if (b.state === "half-open") {
    b.state = "open";
    b.lastFailureTime = Date.now();
    logWarn(`断路器[${sourceId}] 半开试探失败(${quality || "128k"} 限流429)，重新熔断`);
  }
  logDebug(`[${sourceId}] 429限流第${b.rateLimitCount}次，退避${cfg('rateLimitBackoffMs', RATE_LIMIT_BACKOFF_MS) / 1000}s${b.rateLimited ? '（已标记被限）' : ''}`);
}
// v8.11.2（D-34，V25b 实测暴露）：半开试探被「本地拦截」挡下时必须退回 open。
// 旧实现只在 wrapExecute 的 catch（handler.fn 之后）里做这件事，但 canExecute/throttleCheck
// 都在 try 之前抛 isThrottleSkip——catch 根本捕不到，状态就停在 half-open；
// 而 canExecute 对 half-open 恒返回 false → 该源永久不被调用，只能重启救回（F-01 卡死）。
function revertHalfOpenOnSkip(sourceId) {
  const b = getBreaker(sourceId);
  if (b.state === "half-open") {
    b.state = "open";
    b.lastFailureTime = Date.now();
    logWarn(`断路器[${sourceId}] 半开试探被本地拦截，退回熔断等待下次冷却`);
  }
}
function canExecute(sourceId) {
  const b = getBreaker(sourceId);
  // v4.0：限流退避期内跳过（源没坏，只是过载/风控）；退避结束自动恢复
  if (b.rateLimitUntil > 0) {
    if (Date.now() < b.rateLimitUntil) return false;
    b.rateLimitUntil = 0; b.rateLimited = false;
  }
  if (b.state === 'closed') return true;
  if (b.state === 'open') {
    if (Date.now() - b.lastFailureTime >= cfg('breakerCooldownMs', BREAKER_COOLDOWN_MS)) {
      b.state = 'half-open';
      return true;
    }
    return false;
  }
  return false;
}
function recordSuccess(sourceId, duration, quality) {
  const b = getBreaker(sourceId);
  b.totalRequests++;
  b.totalSuccess++;
  b.totalTime += duration;
  b.lastQuality = String(quality || "128k"); // v6.0：记录实际交付音质
  const q = b.byQuality[String(quality || 'default')] || (b.byQuality[String(quality || 'default')] = { req: 0, success: 0, time: 0, fail: 0, businessFail: 0 });
  q.req++; q.success++; q.time += duration;
  if (b.state === 'half-open') { b.state = 'closed'; b.failureCount = 0; logWarn(`断路器[${sourceId}] 半开试探成功，恢复`); }
  b.failureCount = 0;
  // v7.0：播放成功 → 解除摘除
  if ((playDeadStreak.get(sourceId) || 0) > 0) {
    playDeadStreak.set(sourceId, 0);
    playDeadDeadline.delete(sourceId);
    logWarn(`播放摘除: [${sourceId}] 播放成功，解除摘除`);
  }
}
// v8.10.3：播放失败累计抽成单点——半开试探失败同样算一次真实播放失败（旧实现 return 跳过累加，
// 与"真实播放失败累计"的注释语义不符，导致反复半开失败的源永远凑不够摘除阈值）
function bumpPlayDead(sourceId) {
  playDeadStreak.set(sourceId, (playDeadStreak.get(sourceId) || 0) + 1);
  if (playDeadStreak.get(sourceId) >= PLAY_DEAD_STREAK) playDeadDeadline.set(sourceId, Date.now()); // 摘除/续计时（半开试探冷却）
  if (isPlayDead(sourceId)) logWarn(`播放摘除: [${sourceId}] 连续${PLAY_DEAD_STREAK}次播放失败，已从竞速链摘除(${Math.round(cfg('playDeadReviveMs', 5 * 60 * 1000) / 60000)}分钟后半开试探自动复活)`);
}
function recordFailure(sourceId, quality) {
  const b = getBreaker(sourceId);
  b.totalRequests++;
  b.failureCount++;
  b.lastFailureTime = Date.now();
  const q = b.byQuality[String(quality || 'default')] || (b.byQuality[String(quality || 'default')] = { req: 0, success: 0, time: 0, fail: 0, businessFail: 0 });
  q.req++; q.fail++;
  bumpPlayDead(sourceId);
  if (b.state === 'half-open') { b.state = 'open'; logWarn(`断路器[${sourceId}] 半开试探失败，重新熔断`); return; }
  const thr = cfg('breakerThreshold', BREAKER_THRESHOLD);
  if (b.state === 'closed' && b.failureCount >= thr) {
    b.state = 'open';
    logWarn(`断路器[${sourceId}] 连续失败${thr}次，熔断${cfg('breakerCooldownMs', BREAKER_COOLDOWN_MS) / 1000}秒`);
  }
}
// v4.0：版权/业务失败单独计数（无版权404、歌不存在、错歌等——源已正常响应，只是这首歌没有/需VIP）
// 不惩罚健康分、不计入成功率分母、不触发熔断
function recordBusinessFail(sourceId, quality) {
  const b = getBreaker(sourceId);
  b.totalRequests++;
  b.copyrightFail = (b.copyrightFail || 0) + 1;
  const q = b.byQuality[String(quality || 'default')] || (b.byQuality[String(quality || 'default')] = { req: 0, success: 0, time: 0, fail: 0, businessFail: 0 });
  q.req++; q.businessFail++;
  // v8.10.2：半开试探失败收口——业务失败（404/错歌/410/空URL）同样说明这次试探没成功，
  // 不能让 state 停在 half-open（canExecute 在 half-open 恒返回 false，源会永久不被调用）。
  // 必须同时刷新 lastFailureTime，否则冷却判定用旧时间戳，会立刻再次放行。
  if (b.state === "half-open") {
    b.state = "open";
    b.lastFailureTime = Date.now();
    logWarn(`断路器[${sourceId}] 半开试探失败(${quality || "128k"} 业务失败)，重新熔断`);
  }
}
function getSourceStats(sourceId) {
  const b = getBreaker(sourceId);
  // v4.0：无样本时返回 null（App 显示"-"），不再用 1/9999 误导；同时暴露样本计数
  const reqCount = b.totalRequests || 0;
  const probeCount = b.probeRequests || 0;
  // v4.0：有效请求 = 总请求 - 版权/业务失败（无版权歌不惩罚源）；全部都是版权失败 → 无有效样本
  const validCount = Math.max(reqCount - (b.copyrightFail || 0), 0);
  return {
    successRate: validCount === 0 ? null : b.totalSuccess / validCount,
    avgTime: b.totalSuccess === 0 ? null : b.totalTime / b.totalSuccess,
    state: b.state,
    reqCount,
    probeCount,
    copyrightFail: b.copyrightFail || 0,
    // v4.0：按音质分档 { quality: {rate, avgTime, req, success, businessFail} }——flac 坏但 128k 好的源可精确呈现
    byQuality: Object.fromEntries(Object.entries(b.byQuality || {}).map(([quality, q]) => {
      const valid = Math.max(q.req - q.businessFail, 0);
      return [quality, {
        rate: valid === 0 ? null : q.success / valid,
        avgTime: q.success === 0 ? null : q.time / q.success,
        req: q.req, success: q.success, businessFail: q.businessFail
      }];
    }))
  };
}

// v3.0：源健康权重自学习——健康评分 = 真实样本成功率(置信度收缩) − 均时惩罚 − 连续失败惩罚
// 内部评分区间 −1~1（无样本基线 0：无样本按 9999ms 最劣均时惩罚压分）；v7.0 起快照输出 ×10 为 10 分制（0~10），内部排序/熔断仍用 −1~1
// 探测样本仅在无真实请求样本时整体采用（同 K=4 收缩）；有真实样本时探测不参与（非固定 0.3 混合权重）
const HEALTH_PRIOR_K = 4;      // 置信度收缩伪计数（样本少时成功率向 0.5 收缩，防止"1 次成功=满分"）
const HEALTH_TIME_PENALTY = 0.5; // 均时惩罚系数（归一化到 5000ms）
const HEALTH_STREAK_STEP = 0.08; // 每 1 次连续失败扣分
const HEALTH_STREAK_CAP = 0.5;   // 连续失败惩罚上限
function computeHealthScore(sourceId) {
  const b = getBreaker(sourceId);
  // v6.0：有效真实请求 = 真实请求 - 版权/业务失败（无版权歌不惩罚健康分）
  // 修复：probe* 为独立计数(recordProbeResult 单独记账)，totalRequests/totalSuccess 不含探测——
  // 旧实现做减法会把真实样本削掉(探测多时 realReq 归零、成功率退回 0.5)，健康分系统性偏低且与面板成功率口径不一致
  const realReq = Math.max(b.totalRequests - (b.copyrightFail || 0), 0);
  const realSuccess = b.totalSuccess;
  // 真实样本成功率（置信度收缩）
  const rateReal = realReq === 0 ? 0.5 : (realSuccess + HEALTH_PRIOR_K * 0.5) / (realReq + HEALTH_PRIOR_K);
  // 探测样本参考（纯探测期：无真实样本时用探测成功率收缩）
  const probeReq = b.probeRequests || 0;
  const probeSuccess = b.probeSuccess || 0;
  const rateProbe = probeReq === 0 ? 0.5 : (probeSuccess + HEALTH_PRIOR_K * 0.5) / (probeReq + HEALTH_PRIOR_K);
  const rate = realReq > 0 ? rateReal : rateProbe; // 真实样本存在时主导，否则退回探测参考
  // 均时惩罚：真实样本均时优先，纯探测用探测均时；无样本按 9999 最劣
  const avgTime = realSuccess > 0
    ? b.totalTime / realSuccess   // v6.0：totalTime 只计真实成功耗时，不再减 probeTime（同 S1 口径修复）
    : (probeSuccess > 0 ? (b.probeTime || 0) / probeSuccess : 9999);
  const timePenalty = Math.min(avgTime / 5000, 1) * HEALTH_TIME_PENALTY;
  // 连续失败惩罚（熔断阈值内递增；已熔断由 canExecute 挡链，此处仅影响参考分）
  const streakPenalty = Math.min(b.failureCount * HEALTH_STREAK_STEP, HEALTH_STREAK_CAP);
  const score = rate - timePenalty - streakPenalty;
  return { score, rate, avgTime, state: b.state };
}

// ============================================================
// 第四部分：HTTP 请求封装
// ============================================================
function httpRequest(url, options = { method: "GET" }) {
  const timeout = options.timeout || TIMEOUT_CONFIG.default;
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    request(url, { timeout, ...options }, (err, res) => {
      const duration = Date.now() - startTime;
      if (err) {
        const code = String(err.message || "").includes("timeout") ? ERROR_CODES.NETWORK_TIMEOUT : ERROR_CODES.NETWORK_ERROR;
        const error = new Error(`${code}: ${err.message}`);
        error.code = code;
        reject(error);
        return;
      }
      let body = res?.body;
      if (typeof body === "string") {
        const trimmed = body.trim();
        if (trimmed.startsWith("{") || trimmed.startsWith("[") || trimmed.startsWith('"')) {
          try { body = JSON.parse(trimmed); } catch (e) { /* 保持原始 */ }
        }
      }
      const result = { statusCode: res?.statusCode ?? 0, headers: res?.headers || {}, body, duration, url: res?.url || url };
      if (result.statusCode >= 500) {
        const error = new Error(`${ERROR_CODES.SERVER_ERROR}: HTTP ${result.statusCode}`);
        error.code = ERROR_CODES.SERVER_ERROR;
        reject(error);
      } else if (result.statusCode === 429) {
        const error = new Error(`${ERROR_CODES.RATE_LIMIT}: 被限流`);
        error.code = ERROR_CODES.RATE_LIMIT;
        reject(error);
      } else if (result.statusCode === 410) {
        // v1.0：410 Gone = 签名/直链过期（死链），单独映射，供失败缓存差异化(1min)与诊断
        const error = new Error(`${ERROR_CODES.LINK_EXPIRED}: 链接已过期(HTTP 410)`);
        error.code = ERROR_CODES.LINK_EXPIRED;
        reject(error);
      } else if (result.statusCode === 404) {
        // v1.0：404 = 歌曲/资源不存在，单独映射，供失败缓存差异化(1h)与诊断
        const error = new Error(`${ERROR_CODES.NOT_FOUND}: 资源不存在(HTTP 404)`);
        error.code = ERROR_CODES.NOT_FOUND;
        reject(error);
      } else if (result.statusCode >= 400) {
        const error = new Error(`${ERROR_CODES.NETWORK_ERROR}: HTTP ${result.statusCode}`);
        error.code = ERROR_CODES.NETWORK_ERROR;
        reject(error);
      } else {
        resolve(result);
      }
    });
  });
}

async function httpRequestWithRetry(url, options = {}, retries = RETRY_TIMES) {
  let lastError = null;
  for (let i = 0; i <= retries; i++) {
    try {
      return await httpRequest(url, options);
    } catch (e) {
      lastError = e;
      // 网络错误/超时/5xx临时错误重试；4xx(403/404)与429限流不重试
      if (e.code !== ERROR_CODES.NETWORK_TIMEOUT && e.code !== ERROR_CODES.NETWORK_ERROR && e.code !== ERROR_CODES.SERVER_ERROR) break;
      if (i < retries) {
        const delay = Math.pow(2, i) * 200;
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

function buildQueryString(params = {}) {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  return parts.length ? "?" + parts.join("&") : "";
}

async function httpGet(url, params = {}, timeoutType = 'default', headers = null, retries = RETRY_TIMES) {
  const fullUrl = url + buildQueryString(params);
  const opts = { method: "GET", timeout: TIMEOUT_CONFIG[timeoutType] || TIMEOUT_CONFIG.default };
  // v7.0 (S4)：可选请求头——部分上游对无 UA 请求差异化响应，调用方可显式传移动 UA 提高稳定性
  if (headers && typeof headers === "object" && Object.keys(headers).length) opts.headers = headers;
  const res = await httpRequestWithRetry(fullUrl, opts, retries);
  return res.body;
}

// v1.0 P0：轻量音频可播性判定——Range 取前1KB，206/200音频即视为可播
// v8.10.4：区分「确定死链」与「校验未完成」——410/403/404 判死链；超时/网络/5xx/429 抛出交给竞速按网络类处理
async function isAudioPlayable(audioUrl, timeoutMs = 3000) {
  if (!audioUrl || typeof audioUrl !== "string" || !HTTP_URL_REGEX.test(audioUrl)) return false;
  try {
    const res = await httpRequest(audioUrl, {
      method: "GET",
      headers: { "User-Agent": getMobileUserAgent(), "Range": "bytes=0-1023" },
      timeout: timeoutMs,
      follow_max: 5
    });
    const ct = String(res.headers?.["content-type"] || "");
    if (res.statusCode === 206) return true;
    if (res.statusCode === 200 && /audio|octet|mpeg|mp3|flac|ogg|aac/i.test(ct)) return true;
    return false;
  } catch (e) {
    // v8.10.4：网络类异常 ≠ 死链。旧实现一律 return false，调用方据此抛 LINK_EXPIRED，
    // 该码不进 failureCount 但会计入 byQuality.linkExpired，命中档位短路判据
    // (fail+linkExpired)>=3 后把该源该音质档压制 6 小时——而按网络类处理只需 180s 冷却 + 半开探针自愈。
    // 故此处改为抛出原错误码（NETWORK_TIMEOUT / NETWORK_ERROR / SERVER_ERROR / RATE_LIMIT），
    // 仅当确实是 LINK_EXPIRED（410）时才仍返回 false 交给调用方判死链。
    const code = (e && e.code) ? e.code : ERROR_CODES.NETWORK_ERROR;
    if (code === ERROR_CODES.LINK_EXPIRED) return false;
    const err = new Error(`${code}: 可播性校验未完成(${(e && e.message) || "unknown"})`);
    err.code = code;
    throw err;
  }
}

// ============================================================
// v8.11 交付真实性闸门
// 用一次 Range(1KB) 同时得出：魔数 / 真实格式 / 真实码率 / 真实时长
// 实测依据：FLAC 的 STREAMINFO 与 MP3 的 Xing/Info 头都在文件开头，1KB 足够
//   （《晴天》269.7s / VIP 歌 5.3s / 溯音 199.4s 全部解析正确）
// ============================================================
const MPEG_BR_V1_L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
const MPEG_BR_V2_L3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0];
const MPEG_SR_V1 = [44100, 48000, 32000];
const MPEG_SR_V2 = [22050, 24000, 16000];
const MPEG_SR_V25 = [11025, 12000, 8000];

// 取单字节：兼容宿主返回 Buffer 或字符串（字符串场景下 ASCII 部分仍可读）
function bAt(buf, i) {
  if (i < 0) return 0;
  return typeof buf === "string" ? buf.charCodeAt(i) & 0xFF : buf[i];
}
function asciiAt(buf, off, str) {
  for (let i = 0; i < str.length; i++) if (bAt(buf, off + i) !== str.charCodeAt(i)) return false;
  return true;
}
function u32At(buf, o) {
  return (((bAt(buf, o) << 24) >>> 0) + (bAt(buf, o + 1) << 16) + (bAt(buf, o + 2) << 8) + bAt(buf, o + 3));
}

function parseMpegFrameHeader(buf, off) {
  if (off + 4 > (buf.length || 0)) return null;
  const b0 = bAt(buf, off), b1 = bAt(buf, off + 1), b2 = bAt(buf, off + 2);
  if (b0 !== 0xFF || (b1 & 0xE0) !== 0xE0) return null;
  const verBits = (b1 >> 3) & 0x03;   // 3=MPEG1, 2=MPEG2, 0=MPEG2.5, 1=保留
  const layerBits = (b1 >> 1) & 0x03; // 1=LayerIII
  if (verBits === 1 || layerBits === 0) return null;
  const brIdx = (b2 >> 4) & 0x0F;
  const srIdx = (b2 >> 2) & 0x03;
  if (brIdx === 0 || brIdx === 15 || srIdx === 3) return null;
  const bitrateKbps = (verBits === 3 ? MPEG_BR_V1_L3 : MPEG_BR_V2_L3)[brIdx];
  const sampleRate = (verBits === 3 ? MPEG_SR_V1 : (verBits === 2 ? MPEG_SR_V2 : MPEG_SR_V25))[srIdx];
  return { bitrateKbps, sampleRate, samplesPerFrame: verBits === 3 ? 1152 : 576, version: verBits };
}

// FLAC：读第一个 STREAMINFO 块，totalSamples / sampleRate 得精确时长
function parseFlacDuration(buf) {
  if ((buf.length || 0) < 8 || !asciiAt(buf, 0, "fLaC")) return null;
  let p = 4;
  let guard = 0;
  while (p + 4 <= buf.length && guard++ < 8) {
    const last = (bAt(buf, p) & 0x80) !== 0;
    const type = bAt(buf, p) & 0x7F;
    const len = (bAt(buf, p + 1) << 16) | (bAt(buf, p + 2) << 8) | bAt(buf, p + 3);
    if (type === 0) {
      const q = p + 4 + 10;
      if (q + 8 > buf.length) return null;
      const sampleRate = (bAt(buf, q) << 12) | (bAt(buf, q + 1) << 4) | (bAt(buf, q + 2) >> 4);
      const totalSamples = ((bAt(buf, q + 3) & 0x0F) * 4294967296) + (bAt(buf, q + 4) * 16777216) +
        (bAt(buf, q + 5) * 65536) + (bAt(buf, q + 6) * 256) + bAt(buf, q + 7);
      return (sampleRate > 0 && totalSamples > 0) ? +(totalSamples / sampleRate).toFixed(1) : null;
    }
    p += 4 + len;
    if (last) break;
  }
  return null;
}

// MP3：跳 ID3v2 → 找帧头 → 读 Xing/Info 帧数
function parseMp3Info(buf) {
  let off = 0;
  if ((buf.length || 0) >= 10 && asciiAt(buf, 0, "ID3")) {
    const size = (bAt(buf, 6) << 21) | (bAt(buf, 7) << 14) | (bAt(buf, 8) << 7) | bAt(buf, 9);
    off = 10 + size;
  }
  let h = null, hOff = -1;
  const limit = Math.min(buf.length - 4, off + 4096);
  for (let i = Math.max(off, 0); i < limit; i++) {
    h = parseMpegFrameHeader(buf, i);
    if (h) { hOff = i; break; }
  }
  if (!h) return null;
  const xingOff = hOff + 4 + (h.version === 3 ? 32 : 17);
  let durationSec = null;
  if (xingOff + 12 <= buf.length && (asciiAt(buf, xingOff, "Xing") || asciiAt(buf, xingOff, "Info"))) {
    const flags = u32At(buf, xingOff + 4);
    if (flags & 1) {
      const frames = u32At(buf, xingOff + 8);
      if (frames > 0) durationSec = +((frames * h.samplesPerFrame) / h.sampleRate).toFixed(1);
    }
  }
  return { bitrateKbps: h.bitrateKbps, sampleRate: h.sampleRate, durationSec };
}

// 字节嗅探：返回 { kind: audio|playlist|html|json|unknown, format, durationSec, bitrateKbps }
function sniffAudioBytes(body, headers, totalBytes) {
  const ct = String((headers && headers["content-type"]) || "").toLowerCase();
  const out = { kind: "unknown", format: null, durationSec: null, bitrateKbps: null };
  // D-29：能拿到响应体、里面却没有任何字节（或短到装不下任何音频头），是**确定不可播**，
  // 不是"拿不准"。旧逻辑在这里把 content-type 为 audio 的空体直接判成 audio ——
  // 206 + 0 字节会被当成"验真通过"交付出去：用户点到的是 0 字节 URL，播放器必报错，
  // 而音源认为成功、连失败缓存都不进，于是每次重试都重新外呼、每次都"成功"。
  // 16 字节的下限依据：FLAC 的 STREAMINFO 至少 34 字节；ID3 标签头 10 字节 + 帧头 4 字节；
  // MP3 单帧头 4 字节。任何真实音频文件的"开头 16 字节"都不可能短于这个量。
  if (!body || body.length < 16) {
    out.kind = "empty";
    return out;
  }
  // 1. 文本类优先判死
  if (asciiAt(body, 0, "#EXTM3U")) { out.kind = "playlist"; out.format = "m3u8"; return out; }
  let s = 0;
  while (s < body.length && s < 64 && (bAt(body, s) === 0x20 || bAt(body, s) === 0x0A || bAt(body, s) === 0x0D || bAt(body, s) === 0x09 || bAt(body, s) === 0xEF)) s++;
  if (bAt(body, s) === 0x3C) { // '<'
    if (asciiAt(body, s, "<html") || asciiAt(body, s, "<!DOCTYPE") || asciiAt(body, s, "<?xml") || asciiAt(body, s, "<HTML")) {
      out.kind = "html"; return out;
    }
  }
  if (bAt(body, s) === 0x7B || bAt(body, s) === 0x5B) { out.kind = "json"; return out; }

  // 2. 音频魔数
  if (asciiAt(body, 0, "fLaC")) {
    out.kind = "audio"; out.format = "flac";
    out.durationSec = parseFlacDuration(body);
    out.bitrateKbps = out.durationSec && totalBytes
      ? Math.round((totalBytes * 8) / out.durationSec / 1000)
      : 1000;
    return out;
  }
  if (asciiAt(body, 0, "OggS")) { out.kind = "audio"; out.format = "ogg"; return out; }
  if (asciiAt(body, 4, "ftyp")) { out.kind = "audio"; out.format = "m4a"; return out; }
  if (asciiAt(body, 0, "RIFF")) { out.kind = "audio"; out.format = "wav"; return out; }

  // 3. MP3（含 ID3v2 包裹）
  const mp3 = parseMp3Info(body);
  if (mp3) {
    out.kind = "audio"; out.format = "mp3";
    out.durationSec = mp3.durationSec;
    if (out.durationSec && totalBytes) {
      // 平均码率必须用「总字节 ÷ 时长」——首帧标称码率不可信（实测首帧标 80k 实为 128k）
      out.bitrateKbps = Math.round((totalBytes * 8) / out.durationSec / 1000);
    } else if (totalBytes && mp3.bitrateKbps) {
      out.durationSec = +((totalBytes * 8) / (mp3.bitrateKbps * 1000)).toFixed(1);
      out.bitrateKbps = mp3.bitrateKbps;
    } else {
      out.bitrateKbps = mp3.bitrateKbps;
    }
    return out;
  }

  // 4. 兜底：content-type 声称是音频就认（不因解析失败误杀）
  if (/audio|octet|mpeg|mp3|flac|ogg|aac/.test(ct)) {
    out.kind = "audio";
    out.format = ct.includes("flac") ? "flac" : (ct.includes("mpeg") || ct.includes("mp3") ? "mp3" : "audio");
    return out;
  }
  return out;
}

// 把真实格式/平均码率映射回音源体系里的音质档
function qualityFromDelivery(info, requestedQuality) {
  const fmt = info?.format;
  const br = info?.bitrateKbps || 0;
  if (fmt === "flac") return br >= 2500 ? "flac24bit" : "flac";
  if (fmt === "mp3" || fmt === "audio") {
    if (br >= 256) return "320k";
    return "128k";
  }
  // m4a/ogg/wav 等：保留请求档（不擅自降级标签）
  return requestedQuality || "128k";
}

// 原曲时长（秒）：兼容 ms / 秒 / "mm:ss"
function originalDurationSec(songInfo) {
  const raw = songInfo?.duration ?? songInfo?.dt ?? songInfo?.interval ?? songInfo?.songDuration;
  if (typeof raw === "string" && raw.includes(":")) {
    const parts = raw.split(":").map(x => parseInt(x, 10)).filter(x => Number.isFinite(x));
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return 0;
  }
  return normalizeDurationSec(raw);
}

// ============================================================
// L4 前置：L0 宿主通道层（形态归一 + 单一形态判定）
// ------------------------------------------------------------
// 真机事故（2026-11-10）：App 原生桥 sendAction 对二进制体做 JSON.stringify，
// Buffer 变成 {type:'Buffer',data:[0,1,…]}。判据只认 ArrayBuffer 视图 →
// 「拿不到字节」被当成「不是音频」→ 全部源 NOT_AUDIO → 代表码 NOT_FOUND →
// 1 小时歌级锁 → 用户看到「该请求已知失败(缓存中)」。
// 结论：字节「是不是原样到达」是通道问题，不是交付问题。这里先归一，再判形态。
// ============================================================

// 手动 base64 解码（真机 QuickJS 没有全局 Buffer，不能依赖宿主）
const B64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function decodeBase64Ascii(s) {
  let pad = 0;
  const origLen = s.length;   // 必须先按含 '=' 的原长算输出字节数：剥掉填充后再算会少 1~2 字节
  while (s.length && s.charAt(s.length - 1) === "=") { pad++; s = s.slice(0, -1); }
  const out = new Uint8Array(Math.floor(origLen / 4) * 3 - pad);
  let o = 0, buf = 0, bits = 0;
  for (let i = 0; i < s.length; i++) {
    const v = B64_CHARS.indexOf(s.charAt(i));
    if (v < 0) return null;
    buf = (buf << 6) | v; bits += 6;
    if (bits >= 8) { bits -= 8; out[o++] = (buf >> bits) & 0xFF; }
  }
  return out;
}

// P2 桥媒体信封：{__lxMedia:2, encoding:"base64", byteLength, body?/chunks?}
// 只认显式版本号；byteLength 不符视为通道损坏，宁可返回 null 也不把半截字节交给验真。
function decodeMediaEnvelope(x) {
  if (!x || typeof x !== "object") return null;
  if (x.__lxMedia !== 2) return null;
  try {
    if (String(x.encoding || "").toLowerCase() !== "base64") return null;
    let parts = null;
    if (Array.isArray(x.chunks)) {
      if (!x.chunks.length) return null;
      for (let i = 0; i < x.chunks.length; i++) {
        if (typeof x.chunks[i] !== "string") return null;
      }
      parts = x.chunks;
    } else if (typeof x.body === "string") {
      parts = [x.body];
    } else {
      return null;
    }
    // 每片独立解码：base64 分片各自带 '=' 填充，拼成一个大串后中间的 '=' 非法。
    let total = 0;
    const decoded = [];
    for (let i = 0; i < parts.length; i++) {
      const s = String(parts[i]).replace(/\s+/g, "");
      if (!s.length) return x.byteLength === 0 ? new Uint8Array(0) : null;
      if (s.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(s)) return null;
      const part = decodeBase64Ascii(s);
      if (!part) return null;
      decoded.push(part);
      total += part.length;
    }
    if (typeof x.byteLength === "number" && Number.isFinite(x.byteLength) && total !== x.byteLength) return null;
    if (decoded.length === 1) return decoded[0];
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (let i = 0; i < decoded.length; i++) { bytes.set(decoded[i], offset); offset += decoded[i].length; }
    return bytes;
  } catch (e) { return null; }
}

// 任意交付体 → 字节（认不出返回 null，绝不抛）
function toBytes(x) {
  if (x == null) return null;
  try {
    if (typeof ArrayBuffer !== "undefined" && typeof ArrayBuffer.isView === "function" && ArrayBuffer.isView(x)) {
      if (x instanceof Uint8Array) return x;
      return new Uint8Array(x.buffer, x.byteOffset || 0, x.byteLength);
    }
    if (Array.isArray(x)) {
      if (!x.length) return null;
      for (let i = 0; i < x.length; i++) {
        const n = x[i];
        if (typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > 255) return null;
      }
      return Uint8Array.from ? Uint8Array.from(x) : new Uint8Array(x);
    }
    if (typeof x === "object") {
      // P2：新桥信封（base64 单体或 256KB 分片）
      if (x.__lxMedia === 2) return decodeMediaEnvelope(x);
      // 旧桥产物：{ type:"Buffer", data:[…] }（真机实测形状）
      const t = String(x.type || "");
      if (/buffer/i.test(t) && Array.isArray(x.data)) return toBytes(x.data);
      if (Array.isArray(x.data)) return toBytes(x.data);
      if (x.data && typeof x.data === "object") return toBytes(x.data);
      return null;
    }
    if (typeof x === "string") {
      const s = x.replace(/\s+/g, "");
      if (s.length < 16 || s.length % 4 !== 0) return null;
      if (!/^[A-Za-z0-9+/]+=*$/.test(s)) return null;
      return decodeBase64Ascii(s);
    }
  } catch (e) { return null; }
  return null;
}

// 单一形态判定：audio | json | html | playlist | empty | bytes | unknown
// 全仓「这是什么形态」只允许走这里（字节细则仍复用 sniffAudioBytes）
function kindOf(x) {
  if (x == null) return "unknown";
  const bytes = toBytes(x);
  if (bytes) {
    if (!bytes.length || bytes.length < 16) return "empty";
    const info = sniffAudioBytes(bytes, {}, bytes.length);
    if (info && info.kind) return info.kind; // audio/playlist/html/json/empty/unknown
    return "unknown";
  }
  if (typeof x === "string") {
    const s = x.trim();
    if (s.indexOf("#EXTM3U") === 0) return "playlist";
    if (s.indexOf("<") === 0) return "html";
    if (s.indexOf("{") === 0 || s.indexOf("[") === 0) return "json";
    // 既不是 base64、又不是 JSON/HTML/播放列表，而且短到不足 16 字节：不可能是音频体
    return s.length < 16 ? "empty" : "unknown";
  }
  if (typeof x === "object") {
    if (x.code !== undefined || x.msg !== undefined || x.error !== undefined || x.url !== undefined) return "json";
    return "unknown";
  }
  return "unknown";
}

// 无字节时的「响应头证据」：只信头，不装懂。
// 返回 { ok:true|false|null, code?, reason?, evidence:"medium"|"weak"|"strong", info }
function headerEvidence(headers, totalBytes) {
  const ct = String((headers && headers["content-type"]) || "").toLowerCase();
  const info = { kind: "unknown", format: null, durationSec: null, bitrateKbps: null };
  if (/json|html|text\/plain|xml/.test(ct)) {
    return { ok: false, code: ERROR_CODES.NOT_AUDIO, reason: `响应头声明非音频(${ct.split(";")[0]})`, evidence: "strong", info: { kind: "json", format: null, durationSec: null } };
  }
  if (/audio|octet|mpeg|mp3|flac|ogg|aac/.test(ct)) {
    info.kind = "audio";
    info.format = ct.includes("flac") ? "flac" : (ct.includes("mpeg") || ct.includes("mp3") ? "mp3" : "audio");
    if (totalBytes && info.format === "mp3") info.bitrateKbps = 128;
    return { ok: true, info, evidence: "medium", reason: "仅头信息（桥未透传字节）" };
  }
  return { ok: null, code: ERROR_CODES.NETWORK_ERROR, reason: "响应头不足以判定", evidence: "weak", info };
}

function totalBytesOf(delivery) {
  if (!delivery) return 0;
  if (delivery.totalBytes) return Number(delivery.totalBytes) || 0;
  const h = delivery.headers || {};
  const cr = String(h["content-range"] || "");
  const m = cr.match(/\/\s*(\d+)/);
  if (m) return parseInt(m[1], 10) || 0;
  return parseInt(String(h["content-length"] || "0"), 10) || 0;
}

// 一次 Range(1KB) 取真实字节
// v8.11.5：GET 拿不到字节、响应头又不足以判定时，补一次只取头的探针。
// HEAD 优先（1500ms）；HEAD 被 CDN 拒（405 等，httpRequest 统一抛 NETWORK_ERROR）再退回
// GET Range: bytes=0-0——只读响应头，不下载正文。只补「头能判死/能判放行」的结论，
// 仍判不出就保持 ok:null（拿不准不放行也不判死）。
async function probeByHeaders(audioUrl, timeoutMs = 1500) {
  const tryOnce = async (method, headers) => {
    const res = await httpRequest(audioUrl, {
      method, headers: { "User-Agent": getMobileUserAgent(), ...headers },
      timeout: timeoutMs, follow_max: 5, binary: true,
    });
    const cr = String((res.headers && res.headers["content-range"]) || "");
    const m = cr.match(/\/\s*(\d+)/);
    let totalBytes = m ? (parseInt(m[1], 10) || 0) : (parseInt(String((res.headers && res.headers["content-length"]) || "0"), 10) || 0);
    const hv = headerEvidence(res.headers || {}, totalBytes);
    return { hv, statusCode: res.statusCode, totalBytes, contentType: String((res.headers && res.headers["content-type"]) || "") };
  };
  try {
    const head = await tryOnce("HEAD", {});
    if (head.hv && head.hv.ok !== null) {
      return { ok: head.hv.ok, code: head.hv.code, reason: head.hv.reason, info: head.hv.info, evidence: head.hv.evidence, statusCode: head.statusCode, totalBytes: head.totalBytes, via: "HEAD" };
    }
  } catch (e) { /* HEAD 被拒（405/超时）→ 退回只取头的 GET */ }
  try {
    const get = await tryOnce("GET", { Range: "bytes=0-0" });
    if (get.hv && get.hv.ok !== null) {
      return { ok: get.hv.ok, code: get.hv.code, reason: get.hv.reason, info: get.hv.info, evidence: get.hv.evidence, statusCode: get.statusCode, totalBytes: get.totalBytes, via: "GET-head" };
    }
    return { ok: null, code: ERROR_CODES.NETWORK_ERROR, reason: "只取头也未取得可用证据", evidence: "weak", via: "GET-head" };
  } catch (e) {
    return { ok: null, code: ERROR_CODES.NETWORK_ERROR, reason: `只取头失败(${(e && e.code) || "NETWORK_ERROR"})`, evidence: "weak", via: "none" };
  }
}

async function probeAudioDelivery(audioUrl, timeoutMs = 3000) {
  if (!audioUrl || typeof audioUrl !== "string" || !HTTP_URL_REGEX.test(audioUrl)) {
    return { ok: false, code: ERROR_CODES.PARAM_ERROR, reason: "非法URL" };
  }
  try {
    const res = await httpRequest(audioUrl, {
      method: "GET",
      headers: { "User-Agent": getMobileUserAgent(), "Range": `bytes=0-${VERIFY_RANGE_BYTES}` },
      timeout: timeoutMs,
      follow_max: 5,
      binary: true
    });
    const status = res.statusCode;
    let totalBytes = 0;
    const cr = String((res.headers && res.headers["content-range"]) || "");
    const m = cr.match(/\/\s*(\d+)/);
    if (m) totalBytes = parseInt(m[1], 10) || 0;
    if (!totalBytes) totalBytes = parseInt(String((res.headers && res.headers["content-length"]) || "0"), 10) || 0;
    // 注意：4xx/5xx 与 429 在 httpRequest 内已按状态码抛出（带 err.code），
    // 走 catch 统一映射，这里再判一遍只会得到不可能执行的死分支（覆盖率实测 0 行）。
    const body = res.body;
    const bytes = toBytes(body);
    const totalBytesKnown = totalBytes;
    if (bytes) {
      const info = sniffAudioBytes(bytes, res.headers, totalBytesKnown);
      if (info && info.kind === "audio") {
        return {
          ok: true, info, evidence: "strong", statusCode: status,
          contentType: String((res.headers && res.headers["content-type"]) || ""), totalBytes,
        };
      }
      const kind = (info && info.kind) || "unknown";
      if (kind === "empty") {
        return { ok: false, code: ERROR_CODES.NOT_AUDIO, reason: "交付内容为空(0~16 字节，不可能可播)", evidence: "strong", info, statusCode: status, totalBytes };
      }
      if (kind === "playlist") {
        return { ok: false, code: ERROR_CODES.STREAM_PLAYLIST, reason: "交付内容是流播放列表", evidence: "strong", info, statusCode: status, totalBytes };
      }
      if (kind === "json" || kind === "html") {
        return { ok: false, code: ERROR_CODES.NOT_AUDIO, reason: `交付内容不是音频(${kind})`, evidence: "strong", info, statusCode: status, totalBytes };
      }
      // 二进制但认不出形态：能走到这里说明响应头也不是音频（头是音频时 sniff 已判 audio），
      // 所以只能给弱证据，不判死但也不当交付成功。
      return { ok: false, code: ERROR_CODES.NOT_AUDIO, reason: "交付内容无法识别为音频", evidence: "weak", info, statusCode: status, totalBytes };
    }
    // 无字节（App 桥把二进制体变成了普通对象）：只信响应头，证据降为 medium/weak，
    // 绝不因为「拿不到字节」判 NOT_AUDIO —— 这正是真机全源误判的根因。
    // 但「明确给了空体」（''/{Buffer,data:[]}/零长视图）不是桥问题，是真空交付，必须判死。
    // 没有可识别字节时，仍要按形态判死：文本形态的 playlist/json/html 与空体，
    // 都是「明确不是音频」，不能因为「字节拿不到」就被响应头放行（否则 .m3u8 / 登录页会被当音频交付）。
    if (body !== undefined && body !== null) {
      const bk = kindOf(body);
      if (bk === "playlist") {
        return { ok: false, code: ERROR_CODES.STREAM_PLAYLIST, reason: "交付内容是流播放列表", evidence: "strong", statusCode: status, totalBytes };
      }
      if (bk === "json" || bk === "html") {
        return { ok: false, code: ERROR_CODES.NOT_AUDIO, reason: `交付内容不是音频(${bk})`, evidence: "strong", statusCode: status, totalBytes };
      }
      if (bk === "empty") {
        return { ok: false, code: ERROR_CODES.NOT_AUDIO, reason: "交付内容为空(空体)", evidence: "strong", statusCode: status, totalBytes };
      }
    }
    const hv = headerEvidence(res.headers, totalBytes);
    if (hv.ok === null) {
      // 头信息不足 → 补一次只取头（HEAD 1500ms，405 退回 GET Range 0-0）
      const byHead = await probeByHeaders(audioUrl, Math.min(1500, timeoutMs));
      if (byHead && byHead.ok !== null) {
        return Object.assign({}, byHead, { statusCode: byHead.statusCode || status, totalBytes: byHead.totalBytes || totalBytes });
      }
      return { ok: null, code: ERROR_CODES.NETWORK_ERROR, reason: "无字节且头信息不足", evidence: "weak", statusCode: status };
    }
    return { ok: hv.ok, code: hv.code, reason: hv.reason, info: hv.info, evidence: hv.evidence, statusCode: status, totalBytes };
  } catch (e) {
    const code = (e && e.code) ? e.code : ERROR_CODES.NETWORK_ERROR;
    // 只有 410/404 是确定结论（链接确实死了）才判死链换源，统一映射为 LINK_EXPIRED
    // —— 音频 CDN 的 404 语义就是"这条直链失效"，不是"歌不存在"（歌不存在发生在接口层）
    if (code === ERROR_CODES.LINK_EXPIRED || code === ERROR_CODES.NOT_FOUND) {
      return { ok: false, code: ERROR_CODES.LINK_EXPIRED, reason: `验真失败(${code})`, evidence: "strong" };
    }
    // 429 是确定结论（源在限流），不是「拿不准」——必须判失败并让裁决层转冷却/换源。
    if (code === ERROR_CODES.RATE_LIMIT) {
      return { ok: false, code: ERROR_CODES.RATE_LIMIT, reason: "HTTP 429", evidence: "strong" };
    }
    // 探针没跑完（超时/断连/5xx）：沿用「拿不准就放行」（T66/C8a 契约）——
    // 误杀一首能播的歌，比偶尔放一条没验过的链接更糟；真正的问题是「拿不到字节就判 NOT_AUDIO」，
    // 那种误判已经在上面用响应头证据消掉了。
    return { ok: null, code, reason: `验真未完成(${code})`, evidence: "weak" };
  }
}

// 交付前验真：返回 null 表示无法判定（放行）
async function verifyDelivery(audioUrl, ctx = {}) {
  if (!cfg("verifyDelivery", true)) return null;
  const probe = await probeAudioDelivery(audioUrl, cfg("verifyTimeoutMs", 3000));
  if (probe.ok === null) {
    // 拿不准就放行（误杀代价高于听到片段）
    logDebug(`[验真] 放行: ${probe.reason}`);
    return null;
  }
  if (probe.ok === false && probe.code) {
    const err = new Error(`${probe.code}: ${probe.reason}`);
    err.code = probe.code;
    err.evidence = probe.evidence || "strong";
    err.probeInfo = probe.info || null;
    throw err;
  }
  // 探针的返回值只有三种：ok=true / ok=false（必带 code）/ ok=null。
  // 上面已分别处理，此处不再留「!probe.ok 但无 code」的死分支（覆盖率实测 0 行）。
  const realDur = probe.info?.durationSec || null;
  const origDur = originalDurationSec(ctx.songInfo);
  // 四条同时满足才拒：真实时长可定 + 原曲可定且≥90s + <60% + 差>15s
  if (realDur && origDur && origDur >= cfg("verifyMinOriginalSec", VERIFY_MIN_ORIGINAL_SEC)) {
    const ratio = realDur / origDur;
    const gap = origDur - realDur;
    if (ratio < cfg("verifyDurRatio", VERIFY_DUR_RATIO) && gap > cfg("verifyDurGapSec", VERIFY_DUR_GAP_SEC)) {
      // 即便是片段也带出真实格式——全档兜底时标签要写真话（实测 flac 档给的是 128kbps mp3）
      return { ok: false, code: ERROR_CODES.PREVIEW_FRAGMENT, reason: `仅 ${realDur}s，原曲 ${origDur}s`, quality: qualityFromDelivery(probe.info, ctx.quality), evidence: probe.evidence || "strong" };
    }
  }
  // medium 证据（无字节、只有体积）：按 3KB/s 下界估「明显短于目标曲目」的试听片段。
  // 依据：128kbps≈16KB/s，5 秒片段≈80KB；180 秒整曲≈2.8MB。保守取 3KB/s×60% 作下界，只拦明显偏小。
  if (!realDur && origDur && origDur >= cfg("verifyMinOriginalSec", VERIFY_MIN_ORIGINAL_SEC) && probe.totalBytes) {
    const minFull = Math.max(128000, origDur * 3000 * VERIFY_DUR_RATIO);
    if (probe.totalBytes < minFull) {
      return {
        ok: false, code: ERROR_CODES.PREVIEW_FRAGMENT,
        reason: `体积仅 ${probe.totalBytes} 字节（< ${Math.round(minFull)}），明显短于 ${origDur}s 整曲`,
        quality: qualityFromDelivery(probe.info, ctx.quality),
        evidence: "medium",
      };
    }
  }
  return {
    ok: true,
    quality: qualityFromDelivery(probe.info, ctx.quality),
    realDurationSec: realDur,
    format: probe.info?.format || null,
    totalBytes: probe.totalBytes || 0,
    evidence: probe.evidence || "strong",
  };
}

// ============================================================
// L4 裁决层（Admission）：一个函数 + 一张表 + 三个调用点
// ------------------------------------------------------------
// 边界铁律：不发请求、不调度、不写状态；只回答两件事——
//   ① 这次交付是什么结果（verdict + code + evidence）
//   ② 该记什么账（ledger：TTL / 健康分类 / 是否摘除 / 源冷却）
// 读侧只允许 skipReason()，写侧只允许按 ledger 记账；不允许再出现散落的 if(code)。
// ============================================================
const ADMISSION_POLICY = {
  // verdict    是否可交付  歌×档 TTL   健康分类        是否计入摘除   源级冷却
  PASS:         { deliverable: true,  ttlMs: 0,       health: "success",      playDead: false, sourceCooldownMs: 0 },
  FRAGMENT:     { deliverable: true,  ttlMs: 30000,   health: "businessFail", playDead: false, sourceCooldownMs: 0 },
  NOT_AUDIO:    { deliverable: false, ttlMs: 60000,   health: "businessFail", playDead: false, sourceCooldownMs: 0 },
  RATE_LIMITED: { deliverable: false, ttlMs: 0,       health: "businessFail", playDead: false, sourceCooldownMs: 45000 },
  BUSINESS:     { deliverable: false, ttlMs: 3600000, health: "businessFail", playDead: false, sourceCooldownMs: 0 },
  TRANSIENT:    { deliverable: false, ttlMs: 0,       health: "hardFail",     playDead: false, sourceCooldownMs: 0 },
  BROKEN:       { deliverable: false, ttlMs: 60000,   health: "businessFail", playDead: false, sourceCooldownMs: 0 },
};

// 代表码优先级：确定性业务码(1) < 交付类码(2) < 网络类码(3)。高优先不被低覆盖。
// 旧实现把 NOT_FOUND 设成"一旦出现即固定"，直接吞掉 NOT_AUDIO → 60s 变 1h（真机事故现场）。
// 数值越大越优先。**交付类码（3）必须高于「歌不存在」类（2）**——
// 旧实现把 NOT_FOUND 设成一旦出现即固定，会直接吞掉 NOT_AUDIO（60s 变 1h，真机事故现场）。
const CODE_RANK = {
  [ERROR_CODES.NOT_AUDIO]: 3,
  [ERROR_CODES.PREVIEW_FRAGMENT]: 3,
  [ERROR_CODES.STREAM_PLAYLIST]: 3,
  [ERROR_CODES.NOT_FOUND]: 2,
  [ERROR_CODES.MISMATCH]: 2,
  [ERROR_CODES.LINK_EXPIRED]: 2,
  [ERROR_CODES.PARAM_ERROR]: 2,
  [ERROR_CODES.CONFIG_ERROR]: 2,
  [ERROR_CODES.RATE_LIMIT]: 1,
  [ERROR_CODES.NETWORK_TIMEOUT]: 1,
  [ERROR_CODES.NETWORK_ERROR]: 1,
  [ERROR_CODES.SERVER_ERROR]: 1,
};
const codeRank = (c) => CODE_RANK[c] || 1;

function verdictOfCode(code) {
  switch (code) {
    case ERROR_CODES.RATE_LIMIT: return "RATE_LIMITED";
    case ERROR_CODES.NOT_FOUND:
    case ERROR_CODES.MISMATCH:
    case ERROR_CODES.LINK_EXPIRED: return "BUSINESS";
    case ERROR_CODES.NOT_AUDIO:
    case ERROR_CODES.STREAM_PLAYLIST: return "NOT_AUDIO";
    case ERROR_CODES.PREVIEW_FRAGMENT: return "FRAGMENT";
    case ERROR_CODES.PARAM_ERROR:
    case ERROR_CODES.CONFIG_ERROR: return "BROKEN";
    default: return "TRANSIENT";
  }
}

const EVIDENCE_ORDER = { none: 0, weak: 1, medium: 2, strong: 3 };
function strongestEvidence(list) {
  let best = "none";
  for (const e of list) {
    const v = String(e || "none");
    if ((EVIDENCE_ORDER[v] || 0) > (EVIDENCE_ORDER[best] || 0)) best = v;
  }
  return best;
}

// 片段判定（与 verifyDelivery 同阈值，抽出来供 admit 复用）
function isFragmentInfo(info, songInfo) {
  const realDur = info && info.durationSec;
  const origDur = originalDurationSec(songInfo);
  if (!realDur || !origDur || origDur < cfg("verifyMinOriginalSec", VERIFY_MIN_ORIGINAL_SEC)) return false;
  const ratio = realDur / origDur;
  const gap = origDur - realDur;
  return ratio < cfg("verifyDurRatio", VERIFY_DUR_RATIO) && gap > cfg("verifyDurGapSec", VERIFY_DUR_GAP_SEC);
}

function admissionLedger(verdict, code, evidence) {
  const policy = ADMISSION_POLICY[verdict] || ADMISSION_POLICY.TRANSIENT;
  let ttlMs = policy.ttlMs;
  if (code === ERROR_CODES.LINK_EXPIRED) ttlMs = Math.min(ttlMs || 60000, 60000);
  // I6 硬约束：medium/weak 证据一律 ≤60s，不许写 1h、不许判 NOT_FOUND、不许 bump playDead
  if (evidence !== "strong") ttlMs = Math.min(ttlMs || 0, 60000);
  return {
    ttlMs,
    health: policy.health,
    playDead: evidence === "strong" ? policy.playDead : false,
    sourceCooldownMs: policy.sourceCooldownMs,
  };
}

/**
 * 唯一裁决入口（纯函数，幂等，不写任何状态）
 * input = { stage, platform, quality, songInfo, source, delivery, error, trialMark, attempts }
 * delivery = { statusCode, headers, body, totalBytes }
 * attempts = [{ code, evidence, reason }]
 */
// 接口层试听标记识别（社区同做法：jiexiang/xinglan 在拿到 playurl/privilege 时就判，不必等 Range）
// 只认「明确结构化字段」，认不出就返回 false —— 不做启发式猜测，避免把正常歌当试听。
function trialMarkOf(payload) {
  if (!payload || typeof payload !== "object") return false;
  for (const key of ["freeTrialInfo", "freeTrialPrivilege", "trialInfo", "freeTrial", "privilege"]) {
    const v = payload[key];
    if (v === true) return true;
    if (Array.isArray(v) && v.length > 0) return true;
    if (v && typeof v === "object") {
      if (v.freeTrial === true || v.trial === true || v.flag === 1 || v.status === 1) return true;
    }
  }
  const rs0 = payload.RS0 !== undefined ? payload.RS0 : payload.rs0;
  if (rs0 === 1 || rs0 === "1") return true;
  return false;
}

function admit(input) {
  const ctx = input || {};
  const stage = ctx.stage || "candidate";
  const delivery = ctx.delivery || null;
  let verdict = "TRANSIENT";
  let code = ERROR_CODES.NETWORK_ERROR;
  let evidence = "none";
  let reason = "";
  let quality = "";
  let deliverable = false;

  if (ctx.trialMark === true) {
    // API 层已明确告知是试听 → 免探针直接判片段（省一次 Range，也不受桥影响）
    verdict = "FRAGMENT";
    code = ERROR_CODES.PREVIEW_FRAGMENT;
    evidence = "medium";
    deliverable = true;
    reason = "接口层已标记试听";
  } else if (ctx.probe && ctx.probe.ok === true) {
    // 已验证过的探针结论（verifyDelivery 产出）——不再重复走形态判定
    verdict = "PASS";
    code = null;
    evidence = ctx.probe.evidence || "strong";
    deliverable = true;
    quality = ctx.probe.quality || "";
    reason = "探针已判可交付";
  } else if (stage === "fallback" && Array.isArray(ctx.attempts) && ctx.attempts.length) {
    let best = null, bestRank = -1;
    for (const a of ctx.attempts) {
      if (!a || !a.code) continue;
      const r = codeRank(a.code);
      if (r > bestRank) { best = a; bestRank = r; }
    }
    code = (best && best.code) || ERROR_CODES.NETWORK_ERROR;
    verdict = verdictOfCode(code);
    evidence = strongestEvidence(ctx.attempts.map(a => a && a.evidence));
    deliverable = verdict === "FRAGMENT";
    reason = (best && best.reason) || "";
  } else if (delivery) {
    const status = Number(delivery.statusCode) || 0;
    if (status === 429) {
      verdict = "RATE_LIMITED"; code = ERROR_CODES.RATE_LIMIT; evidence = "strong"; reason = "HTTP 429";
    } else if (status && status !== 200 && status !== 206) {
      const dead = status === 404 || status === 410;
      verdict = dead ? "BUSINESS" : "TRANSIENT";
      code = dead ? ERROR_CODES.LINK_EXPIRED : ERROR_CODES.NETWORK_ERROR;
      evidence = dead ? "strong" : "weak";
      reason = `HTTP ${status}`;
    } else {
      const bytes = toBytes(delivery.body);
      const shape = kindOf(bytes || delivery.body);
      const totalBytes = totalBytesOf(delivery);
      if (bytes) {
        const info = sniffAudioBytes(bytes, delivery.headers || {}, totalBytes);
        const kind = (info && info.kind) || "unknown";
        if (kind === "audio") {
          evidence = "strong";
          if (isFragmentInfo(info, ctx.songInfo)) {
            verdict = "FRAGMENT"; code = ERROR_CODES.PREVIEW_FRAGMENT; deliverable = true;
          } else {
            verdict = "PASS"; code = null; deliverable = true;
          }
          quality = qualityFromDelivery(info, ctx.quality);
          reason = `字节可定(${info.format || "audio"}${info.durationSec ? "/" + info.durationSec + "s" : ""})`;
        } else if (kind === "playlist") {
          verdict = "NOT_AUDIO"; code = ERROR_CODES.STREAM_PLAYLIST; evidence = "strong"; reason = "交付内容是流播放列表";
        } else if (kind === "json" || kind === "html" || kind === "empty") {
          verdict = "NOT_AUDIO"; code = ERROR_CODES.NOT_AUDIO; evidence = "strong";
          reason = kind === "empty" ? "交付内容为空" : `交付内容不是音频(${kind})`;
        } else {
          // 同 probe：认不出形态且头不是音频（头是音频时 sniff 已判 audio）→ 弱证据判非音频
          verdict = "NOT_AUDIO"; code = ERROR_CODES.NOT_AUDIO; evidence = "weak"; reason = "交付内容无法识别为音频";
        }
      } else {
        // 没有可识别字节：文本形态的 playlist/json/html 与空体一律判死，只有「头是音频」
        // 且形态不明时才 medium 放行（与 probe 的分支顺序保持一致，避免 m3u8/登录页被交付）。
        if (shape === "playlist") {
          verdict = "NOT_AUDIO"; code = ERROR_CODES.STREAM_PLAYLIST; evidence = "strong"; reason = "交付内容是流播放列表";
        } else if (shape === "json" || shape === "html" || shape === "empty") {
          verdict = "NOT_AUDIO"; code = ERROR_CODES.NOT_AUDIO; evidence = "strong";
          reason = shape === "empty" ? "交付内容为空" : `交付内容不是音频(${shape})`;
        } else {
          const hv = headerEvidence(delivery.headers || {}, totalBytes);
          if (hv.ok === true) {
            verdict = "PASS"; code = null; evidence = "medium"; deliverable = true;
            quality = qualityFromDelivery(hv.info, ctx.quality); reason = hv.reason;
          } else if (hv.ok === false) {
            verdict = "NOT_AUDIO"; code = hv.code; evidence = "strong"; reason = hv.reason;
          } else {
            verdict = "TRANSIENT"; code = ERROR_CODES.NETWORK_ERROR; evidence = "weak"; reason = hv.reason;
          }
        }
      }
    }
  } else if (ctx.error && ctx.error.code) {
    code = ctx.error.code;
    verdict = verdictOfCode(code);
    evidence = ctx.error.evidence || "strong";
    deliverable = verdict === "FRAGMENT";
    reason = ctx.error.reason || "";
  }

  const ledger = admissionLedger(verdict, code, evidence);
  return { verdict, code: code || null, evidence, deliverable, quality, reason, ledger };
}

// 读侧唯一查询：能不能用这个源（null=可用）
// 纯结构判据（无副作用）：建链阶段只能问这三个，不能碰 breaker/限流——
// canExecute() 会把 open 推进到 half-open，在建链时调用会提前消耗掉半开试探。
function structuralSkipReason(source) {
  const id = source;
  if (!SOURCE_HANDLERS[id]) return { reason: "unknown-source", untilMs: null };
  if (runtimeToggles[id] === false || manualOff[id]) return { reason: "manual-off", untilMs: null };
  if (isPlayDead(id)) return { reason: "play-dead", untilMs: playDeadDeadline.get(id) || null };
  return null;
}

function skipReason(source, ctx) {
  const id = source;
  const structural = structuralSkipReason(id);
  if (structural) return structural;
  if (typeof canExecute === "function" && !canExecute(id)) {
    const br = getBreaker(id);
    return { reason: br.state || "breaker", untilMs: br.rateLimitUntil || null };
  }
  const pv = previewCooldownMap.get(id);
  if (pv && pv > Date.now()) return { reason: "rate-limited", untilMs: pv };
  return null;
}

// 源级开关唯一入口：开/关都清账（对称），并把动作写进日志
function toggleSource(target, enabled) {
  if (!target || !SOURCE_HANDLERS[target]) throw new Error(`${ERROR_CODES.PARAM_ERROR}: unknown source id`);
  const next = enabled !== false;
  runtimeToggles[target] = next;
  if (next) delete manualOff[target];
  else manualOff[target] = true;
  clearSourceLedger(target);
  clearCrossFallbackCache();
  logInfo(`[源开关] ${target} ${next ? "开启" : "关闭"}，已清账（失败缓存/摘除/熔断限流/探测态/跨平台缓存）`);
  recordHealthEvent({ event: "config_change", sourceId: target, reason: next ? "toggle_on" : "toggle_off" });
  return { id: target, enabled: next };
}

// 写侧唯一清账：开开关 / 播放成功 / 面板重置，都走这里
function clearSourceLedger(source) {
  const handler = SOURCE_HANDLERS[source];
  if (!handler) return false;
  const prefixes = (handler.platforms || []).map(p => `fail_${p}`);
  for (const k of Array.from(failCache.keys())) {
    if (!prefixes.length || prefixes.some(pre => k.includes(pre))) failCache.delete(k);
  }
  playDeadStreak.delete(source);
  playDeadDeadline.delete(source);
  delete probeState.sleeping[source];
  delete probeState.deadCount[source];
  delete probeState.sleepRound[source];
  probeState.failCount[source] = 0;
  const br = getBreaker(source);
  br.state = "closed"; br.failureCount = 0; br.lastFailureTime = 0;
  br.rateLimitUntil = 0; br.rateLimited = false;
  if (br.byQuality) for (const q of Object.keys(br.byQuality)) {
    const s = br.byQuality[q];
    if (s && typeof s === "object") { s.fail = 0; s.success = 0; s.linkExpired = 0; }
  }
  return true;
}

// 写侧唯一记账入口：裁决结果 → 既有状态机（reducer）。
// 只允许这里把 ledger 翻译成 record* 调用；调用点不再自己 if(code)。
function applyAdmission(adm, ctx) {
  const id = ctx && ctx.source;
  if (!adm || !id) return adm;
  const q = ctx.quality;
  const L = adm.ledger || {};
  if (adm.verdict === "PASS") {
    recordSuccess(id, Number(ctx.elapsed) || 0, q);
    return adm;
  }
  if (adm.verdict === "RATE_LIMITED") recordRateLimit(id, q);
  else if (L.health === "hardFail") recordFailure(id, q);
  else recordBusinessFail(id, q);
  const err = ctx.error || {};
  if (adm.code === ERROR_CODES.PREVIEW_FRAGMENT) {
    rememberFragmentSource(ctx.platform, ctx.songInfo, id, q);
    if (err.fragmentUrl) {
      boundedMapSet(fragmentUrlMap, `${ctx.platform}|${getHashOrMid(ctx.songInfo)}|${String(q || "").toLowerCase()}`,
        { url: err.fragmentUrl, quality: err.fragmentQuality || String(q || "128k").toLowerCase(), source: id, name: ctx.name, ts: Date.now() });
    }
  }
  if (adm.code === ERROR_CODES.LINK_EXPIRED) {
    const qStat = getBreaker(id).byQuality[String(q)];
    if (qStat) qStat.linkExpired = (qStat.linkExpired || 0) + 1;
  }
  return adm;
}

// 记录「该源对该歌只给片段」，并在同一源连续三档都片段时判定源级限流（实测：风控状态下所有歌都返回同一 84972 字节片段）
function rememberFragmentSource(platform, songInfo, handlerId, quality) {
  const key = `${platform}|${getHashOrMid(songInfo)}`;
  const ts = Date.now();
  let entry = fragmentSourceMap.get(key);
  if (!entry || ts - entry.ts > FRAGMENT_SOURCE_TTL_MS) {
    entry = { sources: new Set(), bySource: new Map(), ts };
    boundedMapSet(fragmentSourceMap, key, entry);
  }
  entry.ts = ts;
  entry.sources.add(handlerId);
  const qs = entry.bySource.get(handlerId) || new Set();
  qs.add(String(quality || "128k").toLowerCase());
  entry.bySource.set(handlerId, qs);
  // v8.11.1（压测 G7 实测）：单曲三档全片段只能证明「这首歌该源给不出完整版」，
  // 不足以判定源被风控——冷却是全源级的，误判会让同源其他本可播放的歌一起被跳过（实测误伤）。
  // 改为跨歌证据：同一源在窗口内对 ≥2 首不同歌都三档全片段，才判源级限流。
  const midKey = `${platform}|${getHashOrMid(songInfo)}`;
  let hEntry = fragmentHandlerSongsMap.get(handlerId);
  if (!hEntry || ts - hEntry.ts > FRAGMENT_SOURCE_TTL_MS) {
    hEntry = { mids: new Set(), ts };
    boundedMapSet(fragmentHandlerSongsMap, handlerId, hEntry);
  }
  hEntry.ts = ts;
  // v8.11.1（二轮审计 C9a 打点实测修正）：v8.11.1 引入「跳过已知片段源」后，同源同歌首档判定片段即跳过
  // 其余档，qs.size 恒为 1，旧 `>= 3` 永远达不到 → 源级冷却事实上永不触发（实测 mapKeys 恒为空）。
  // 改为「该源对该歌出现过任一档片段即计入跨歌证据」；单歌仍不足以判源级限流，下面仍要求 ≥2 首不同歌。
  if (qs.size >= 1) hEntry.mids.add(midKey);
  // v8.11.2（F11 通读核实）：此处原有 `if (qs.size > HANDLER_MIDS_MAX)` 守卫，比较的是「每源音质集合」
  // （最多 4 个元素，HANDLER_MIDS_MAX=200），条件恒假、从未删过任何东西。跨歌证据的裁剪在
  // hEntry.mids 达到 2 首时即清空并写冷却，容器本身由 boundedMapSet 兜底，故直接删除该死守卫。
  if (hEntry.mids.size >= 2) {
    const songCount = hEntry.mids.size;
    hEntry.mids.clear();
    previewCooldownMap.set(handlerId, ts + PREVIEW_COOLDOWN_MS);
    logWarn(`[${handlerId}] 连续 ${songCount} 首不同歌均只给试听片段 → 判定源级限流，冷却 ${Math.round(PREVIEW_COOLDOWN_MS / 60000)} 分钟并转跨平台`);
  }
}

// 取该歌已判定为片段源的集合（降档时跳过；128k 档例外，永远给最后一次机会）
function getFragmentSources(platform, songInfo) {
  const key = `${platform}|${getHashOrMid(songInfo)}`;
  const entry = fragmentSourceMap.get(key);
  if (!entry) return new Set();
  if (Date.now() - entry.ts > FRAGMENT_SOURCE_TTL_MS) {
    fragmentSourceMap.delete(key);
    return new Set();
  }
  return entry.sources;
}

// 读实交付音质（供标签回填）
function getDeliveryQuality(handlerId, platform, songInfo, quality) {
  const key = `${handlerId}|${platform}|${getHashOrMid(songInfo)}|${String(quality || "").toLowerCase()}`;
  return deliveryQualityMap.get(key) || "";
}

// 能力备档：记录该歌实际最高可得档，下次直接从该档起
function noteQualityCeiling(platform, songInfo, achievedQuality) {
  const key = `${platform}|${getHashOrMid(songInfo)}`;
  boundedMapSet(qualityCeilingMap, key, { quality: achievedQuality, ts: Date.now() });
}
function getQualityCeiling(platform, songInfo) {
  const key = `${platform}|${getHashOrMid(songInfo)}`;
  const entry = qualityCeilingMap.get(key);
  if (!entry) return "";
  if (Date.now() - entry.ts > QUALITY_CEILING_TTL_MS) {
    qualityCeilingMap.delete(key);
    return "";
  }
  return entry.quality || "";
}

// ============================================================
// 第五部分：歌曲信息与匹配工具
// ============================================================
// v1.0 (D10)：已移除死代码 normalizeQuality/selectQuality/qualityToNetease（链级统一降级，源内直接使用请求音质）
function qualityToSuyinQQ(quality) {
  const q = String(quality || "128k").toLowerCase();
  if (q === "flac24bit") return "hires";
  if (q === "192k") return "320k";
  return QUALITY_TO_X.suyinQQ[q] ? q : "128k";
}

// v4.0：UA 池轮换——多套移动 UA 按请求计数器轮换，降低单 UA 被上游风控识别的概率
const MOBILE_UA_POOL = [
  "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 12; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0 Mobile Safari/537.36"
];
let __uaCounter = 0;
function getMobileUserAgent() {
  return MOBILE_UA_POOL[(__uaCounter++ + Math.floor(Date.now() / 60000)) % MOBILE_UA_POOL.length];
}

// v1.0 (D10)：已移除死代码 getSongId
function getHashOrMid(songInfo) {
  return songInfo?.hash ?? songInfo?.songmid ?? songInfo?.id ?? null;
}

function getQQSongId(songInfo) {
  const mid = songInfo?.meta?.qq?.mid || songInfo?.meta?.mid || songInfo?.songmid ||
    (typeof songInfo?.id === "string" && !/^\d+$/.test(songInfo.id) ? songInfo.id : null);
  if (mid) return { type: "mid", value: mid };
  const songid = songInfo?.meta?.qq?.songid || songInfo?.meta?.songid ||
    (typeof songInfo?.id === "number" ? songInfo.id :
      (typeof songInfo?.id === "string" && /^\d+$/.test(songInfo.id) ? Number(songInfo.id) : null));
  if (songid) return { type: "songid", value: songid };
  return null;
}

// v1.0 (D10)：已移除死代码 normalizeSongInfo/getFirstData
function normalizeKeyword(keyword) {
  if (!keyword) return "";
  return String(keyword)
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, "")
    .replace(/[^\w\u4e00-\u9fa5]/g, "")
    .trim()
    .toLowerCase();
}

function titleMatch(a, b) {
  const na = normalizeKeyword(a);
  const nb = normalizeKeyword(b);
  if (!na || !nb) return true;
  return na.includes(nb) || nb.includes(na);
}

function durationMatch(dur1, dur2, threshold = 5) {
  if (!dur1 || !dur2) return true;
  return Math.abs(Number(dur1) - Number(dur2)) <= threshold;
}

// v8.12：跨平台身份归一——与 normalizeKeyword 分开，避免改变既有搜索/匹配语义。
// 关键点：日文假名必须保留。旧 normalizeKeyword 的 [^\w\u4e00-\u9fa5] 会把
// 「ほんま　めいこ」整段删成空串，titleMatch 再因空串 return true，同名翻唱因此被放行。
function identityNormalize(v) {
  if (v === undefined || v === null) return "";
  return String(v)
    .replace(/\([^)]*\)/g, " ")
    .replace(/（[^）]*）/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/【[^】]*】/g, " ")
    .replace(/[^0-9A-Za-z\u00C0-\u024F\u3040-\u30FF\u3400-\u9FFF\uF900-\uFAFF]/g, "")
    .trim()
    .toLowerCase();
}
function identityTokens(v) {
  return String(v || "")
    .split(/\s*[\/、,&;|]\s*|\s+feat\.?\s*|\s+ft\.?\s*/i)
    .map(identityNormalize)
    .filter(t => t.length >= 2);
}
// 严格歌手匹配：目标歌手已知而候选歌手为空 → 拒绝（宁可 NOT_FOUND，不交付错歌）
function artistMatch(target, candidate) {
  const t = identityNormalize(target);
  const c = identityNormalize(candidate);
  if (!t) return true;
  if (!c) return false;
  if (t === c || t.includes(c) || c.includes(t)) return true;
  const tt = identityTokens(target);
  const ct = identityTokens(candidate);
  return tt.some(x => ct.includes(x) || ct.some(y => y.includes(x)));
}
// 严格歌名匹配：两边都归一后必须相等或互相包含且短串 ≥4，避免「Cry」匹配到「Cry For Me」
function strictTitleMatch(target, candidate) {
  const t = identityNormalize(target);
  const c = identityNormalize(candidate);
  if (!t || !c) return false;
  if (t === c) return true;
  return (t.includes(c) || c.includes(t)) && Math.min(t.length, c.length) >= 4;
}
const CROSS_VARIANT_RE = /(remix|dj|伴奏|翻唱|cover|live|现场|instrumental|纯音乐|节奏|加速|慢速|片段|试听|demo|preview|teaser|版)/i;
function crossVariantWords(name) {
  const m = String(name || "").match(new RegExp(CROSS_VARIANT_RE.source, "gi"));
  return m ? m.map(x => x.toLowerCase()) : [];
}
function crossVariantCompatible(targetName, candidateName) {
  const targetWords = crossVariantWords(targetName);
  return crossVariantWords(candidateName).every(w => targetWords.indexOf(w) >= 0);
}
function scoreCrossCandidate(cand, target) {
  const tn = identityNormalize(target?.name);
  const cn = identityNormalize(cand?.name);
  if (!tn || !cn) return -1;
  let score = 0;
  if (tn === cn) score += 6;
  else if (strictTitleMatch(target?.name, cand?.name)) score += 4;
  else return -1;
  const ta = identityNormalize(target?.singer);
  const ca = identityNormalize(cand?.singer);
  if (ta && !ca) return -1;
  if (ta && ca) score += (ta === ca ? 4 : 2);
  const td = normalizeDurationSec(target?.duration);
  const cd = normalizeDurationSec(cand?.duration);
  if (td && cd) {
    const diff = Math.abs(td - cd);
    if (diff > 5) return -1;
    score += diff === 0 ? 3 : (diff <= 2 ? 2 : 1);
  }
  if (!crossVariantCompatible(target?.name, cand?.name)) return -1;
  const talb = identityNormalize(target?.albumName || target?.album);
  const calb = identityNormalize(cand?.album);
  if (talb && calb && talb === calb) score += 1;
  return score;
}
function pickCrossCandidate(list, target) {
  if (!Array.isArray(list) || !list.length) return null;
  let best = null;
  let bestScore = -1;
  for (const cand of list) {
    const s = scoreCrossCandidate(cand, target);
    if (s > bestScore) { best = cand; bestScore = s; }
  }
  return bestScore >= 0 ? best : null;
}
function buildCrossSearchQuery(songInfo) {
  const rawName = String(songInfo?.name || "").replace(/\([^)]*\)/g, " ").replace(/（[^）]*）/g, " ").trim() || String(songInfo?.name || "");
  const rawSinger = String(songInfo?.singer || "").replace(/\([^)]*\)/g, " ").replace(/（[^）]*）/g, " ").trim();
  const firstSinger = rawSinger.split(/\s*[\/、,&;|]\s*/)[0] || rawSinger;
  return `${rawName} ${firstSinger}`.trim();
}

function buildSearchKeywords(songInfo) {
  const keywords = [];
  const name = songInfo?.name || "";
  const album = songInfo?.albumName || songInfo?.album || "";
  const singer = songInfo?.singer || "";
  if (name && album) {
    const kw = normalizeKeyword(name + album);
    if (kw) keywords.push({ keyword: kw, strict: true });
  }
  if (name && singer) {
    const kw = normalizeKeyword(name + singer);
    if (kw) keywords.push({ keyword: kw, strict: true });
  }
  if (name) {
    const kw = normalizeKeyword(name);
    if (kw) keywords.push({ keyword: kw, strict: false });
  }
  return keywords;
}

// v1.0 P0-1 (D1)：片段/试听特征词。必须对原始歌名匹配（normalizeKeyword 会删括号内容，如"难却(15秒0.8x片段)"归一化后与"难却"相同）
const FRAGMENT_RE = /(15\s*秒|0\.?\s*8x|片段|试听|demo|preview|teaser)/i;

// v8.0：试听片段URL检测——酷我VIP试听片段(5秒)URL特征
// 实测发现 helloworld 源部分歌曲返回的是酷我VIP试听片段链接（能播但只有5秒）
// 检测URL关键词，命中即判定为试听片段
const PREVIEW_URL_RE = /(preview|test|sample|试听|片段|demo|teaser|clip)/i;
function isPreviewFragmentUrl(url) {
  if (!url || typeof url !== "string") return false;
  return PREVIEW_URL_RE.test(url);
}

// v1.0 P0-4 (D4)：时长归一化到秒（兼容 ms/秒混用：>5000 视为毫秒）
function normalizeDurationSec(d) {
  // v8.11.2（D-37，V32b/c 实测暴露）：源返回的时长常见 mm:ss / hh:mm:ss（如「4:29」），
  // 旧实现只做 Number(d) → NaN → 0 → songInfoMatch 的「时长差>5s 拒绝」整段失效，
  // 片段版（时长明显更短）会被当成完整版交付。先按冒号格式解析。
  if (typeof d === "string" && d.indexOf(":") >= 0) {
    const parts = d.split(":").map((x) => Number(String(x).trim()));
    if (parts.some((x) => !Number.isFinite(x) || x < 0)) return 0;
    if (parts.length === 2) return Math.round(parts[0] * 60 + parts[1]);
    if (parts.length === 3) return Math.round(parts[0] * 3600 + parts[1] * 60 + parts[2]);
    return 0;
  }
  const v = Number(d);
  if (!Number.isFinite(v) || v <= 0) return 0;
  return v > 5000 ? Math.floor(v / 1000) : Math.round(v);
}

function songInfoMatch(responseData, songInfo) {
  const song = responseData?.song || responseData?.data?.song || "";
  const singer = responseData?.singer || responseData?.data?.singer || "";
  const album = responseData?.album || responseData?.data?.album || "";
  if (!titleMatch(song, songInfo?.name || "")) return false;
  // v1.0 P0-1 (D1)：目标歌名无片段特征词而返回歌名含 → 拒绝（防《难却》匹配到15秒0.8x片段）
  const targetName = String(songInfo?.name || "");
  if (targetName && song && !FRAGMENT_RE.test(targetName) && FRAGMENT_RE.test(String(song))) return false;
  // v8.12：源侧若没回歌手（不少聚合源只回 url），不能因此判死——保持旧行为按歌名+时长校验；
  // 只有「目标歌手和候选歌手都存在」时才做严格 artistMatch（跨平台候选在 scorer 层另做硬要求）。
  if (songInfo?.singer && singer && !artistMatch(songInfo.singer, singer)) return false;
  if ((songInfo?.albumName || songInfo?.album) && album && !titleMatch(album, songInfo.albumName || songInfo.album)) return false;
  // v1.0 P0-4 (D4)：双方时长已知且差>5s → 拒绝（片段版时长明显短于完整版）
  const tDur = normalizeDurationSec(songInfo?.duration);
  const rDur = normalizeDurationSec(responseData?.duration || responseData?.data?.duration || responseData?.musicInfo?.duration);
  if (tDur && rDur && !durationMatch(tDur, rDur, 5)) return false;
  return true;
}

function parseMessageSongInfo(message) {
  if (!message) return null;
  const result = {};
  const lines = String(message).split("\n");
  for (const line of lines) {
    if (line.startsWith("歌名：")) result.song = line.replace("歌名：", "").trim();
    if (line.startsWith("歌手：")) result.singer = line.replace("歌手：", "").trim();
    if (line.startsWith("专辑：")) result.album = line.replace("专辑：", "").trim();
    // v1.0 P0-4 (D4)：消息路径带时长时一并解析，供时长校验使用
    // D-37：保留原始文本（可能是 mm:ss），交由 normalizeDurationSec 统一解析——旧实现这里就 Number() 掉了
    if (line.startsWith("时长：")) result.duration = line.replace("时长：", "").trim();
  }
  return result.song ? result : null;
}

// v8.10.3：huibq 假成功判据单点化——上游对无版权/取链失败仍返回 code=0，但 msg 带失败词
// （实测"无法获取播放链接！" + panspace 酷我链 206 可播 = 错歌）。v8.7 只把它用在取链路径，
// 探针没有同款判据 → 上游假成功时探针判"健康"、源被抬高排序且不会被自动关闭。
const HUIBQ_FAIL_MSG_REGEX = /无法获取|获取失败|失败|错误|不存在|无效|error/i;
function isHuibqFailMsg(msg) { return HUIBQ_FAIL_MSG_REGEX.test(String(msg || "")); }

// v8.11.2（C-1）：交付前协议白名单断言。
// 旧行为：上游给了 javascript:/data:/file: 时，先发请求判"不可播"，被归成
// LINK_EXPIRED(CDN 410)——排障看到"签名URL已过期"，实际是协议非法。
// 这里先判协议，非法直接 PARAM_ERROR，不进入验真。
function assertDeliverableUrl(url, sourceName) {
  const u = typeof url === "string" ? url.trim() : "";
  if (!HTTP_URL_REGEX.test(u)) {
    const err = new Error(`${ERROR_CODES.PARAM_ERROR}: ${sourceName}返回非法URL(非http/https)`);
    err.code = ERROR_CODES.PARAM_ERROR;
    throw err;
  }
  return u;
}

function validateUrl(url, sourceName) {
  if (!url || typeof url !== "string" || !url.trim()) throw new Error(`${ERROR_CODES.NOT_FOUND}: ${sourceName}返回空URL`);
  if (!HTTP_URL_REGEX.test(url.trim())) throw new Error(`${ERROR_CODES.PARAM_ERROR}: ${sourceName}非法URL格式`);
  // v8.10.3：校验用 trim 后的串，返回也必须 trim——旧实现返回原串，带首尾空白/换行的 URL 会直达播放器
  return url.trim();
}

// v1.0 P0-3 (D2)：kw CDN 音频链 http→https（实测 https 升级后 206 可播，部分网络/播放器对 http 音频处理异常）
function upgradeToHttps(url) {
  if (!url || typeof url !== "string") return url;
  return url.replace(/^http:\/\//i, "https://");
}

// v1.0 P1：缓存 key 加入 songId 维度，避免同名不同版本冲突
function buildCacheKey(prefix, songInfo, quality = "") {
  const id = songInfo?.id || songInfo?.songmid || songInfo?.hash || songInfo?.rid || "";
  const name = songInfo?.name || "";
  const singer = songInfo?.singer || "";
  const album = songInfo?.albumName || songInfo?.album || "";
  return `${prefix}_${id}_${name}_${singer}_${album}_${quality}`;
}

// v1.0 P1：缓存值记录实际音质 {url, quality}，命中/过期兜底时校验
// v8.10：高音质缓存分级 TTL——flac/320k/24bit 用 30min（链接有效期短），128k 用 6h
function getCachedUrl(cacheKey) {
  const entry = successCache.get(cacheKey);
  if (!entry) return null;
  // v8.10：按音质判断是否过期（LRU 总 TTL 仍由 cacheTtlMs 兜底，但高音质提前判 miss）
  const q = String(entry.quality || "128k").toLowerCase();
  const isHighQuality = q === "flac" || q === "320k" || q === "flac24bit" || q === "hires";
  const ttl = isHighQuality ? cfg('cacheTtlHighQualityMs', 1800000) : cfg('cacheTtlMs', 21600000);
  if (entry.ts && (Date.now() - entry.ts) > ttl) {
    // v8.11.2（D-32）：不删除，仅视为 miss（删除会让过期兜底查不到）
    return null;
  }
  return entry;
}
function setCachedUrl(cacheKey, url, quality, source, platform) {
  successCache.set(cacheKey, { url, quality: quality || "128k", source, platform: platform || "", ts: Date.now() }); // v8.10：存 ts 用于分级 TTL 判断；v8.12：存实际平台
}
// v1.0：失败缓存差异化——按失败类型记录，get 时按差异化 TTL 判断过期（404→1h / 410→1min / 网络错误不缓存）
function setFailCached(failKey, code, ttl) { failCache.set(failKey, { code: code || ERROR_CODES.NETWORK_ERROR, ts: Date.now(), ttl }); } // v6.0(A3)：支持自定义 TTL（网络类全链失败 30s 短缓存）
// v8.10.3：返回整条记录（而不是布尔）——失败缓存命中时要还原当初的代表性失败码，
// 否则 App 只能看到 NOT_FOUND，把"网络全挂 30s 短缓存"当成"这首歌不存在"
function getFailCachedEntry(failKey) {
  const entry = failCache.get(failKey);
  if (!entry) return null;
  // v5.0：差异化 TTL 可配置（404→1h / 410→1min / 网络错误不缓存）
  const ttl = entry.ttl !== undefined ? entry.ttl   // v6.0(A3)：自定义短缓存 TTL 优先
    : entry.code === ERROR_CODES.NOT_FOUND
      ? cfg('failCacheNotFoundMs', 3600000)
      : entry.code === ERROR_CODES.LINK_EXPIRED
        ? cfg('failCacheExpiredMs', 60000)
        : FAIL_CACHE_TTL_BY_CODE[entry.code];
  // v8.11.2（N4 实测）：CONFIG_ERROR 等未登记 TTL 的码原来直接 return entry——注释写 5min，
  // 实际永不超时（ikun 403 / huibq 未配置 / lingchuan 未配置三处都抛此码，配好也救不回来）。
  const effTtl = ttl === undefined ? cfg("failCacheDefaultMs", 5 * 60 * 1000) : ttl;
  if (effTtl === undefined) return entry;
  if (effTtl === 0) return null;        // 网络错误/限流 → 不缓存
  return (Date.now() - entry.ts) < effTtl ? entry : null;
}
function getFailCached(failKey) { return !!getFailCachedEntry(failKey); }

// ============================================================
// 第六部分：音源实现
// ============================================================

/* 网易云官方 outer 直连（免费歌302直链，固定128k，VIP/无版权歌404自动跳过） */
async function wyOuterGetUrl(platform, songId, quality, songInfo) {
  if (platform !== "wy") throw new Error(`${ERROR_CODES.PARAM_ERROR}: 网易云官方仅支持wy平台`);
  const id = songId ?? songInfo?.id ?? songInfo?.songmid;
  if (!id) throw new Error(`${ERROR_CODES.PARAM_ERROR}: 网易云官方缺少歌曲ID`);
  const url = WY_OUTER_API.replace("{id}", encodeURIComponent(String(id)));
  const res = await httpRequestWithRetry(url, {
    method: "GET",
    headers: { "User-Agent": getMobileUserAgent() },
    timeout: TIMEOUT_CONFIG.parse,
    follow_max: 5
  });
  const ct = String(res.headers?.["content-type"] || "");
  if (res.statusCode !== 200 || !/audio|octet|mpeg/i.test(ct)) {
    throw new Error(`${ERROR_CODES.NOT_FOUND}: 网易云该歌曲不可试听(可能需VIP)，跳过`);
  }
  return res.url || url;
}

/* 酷我官方直连（自研：搜索 r.s → rid → convert_url，固定128k真实mp3，无第三方） */
function kuwoUnescape(text) {
  return String(text || "")
    .replace(/&nbsp;/g, " ")
    .replace(/\\u([0-9a-fA-F]{4})/g, (m, hex) => String.fromCharCode(parseInt(hex, 16)))
    .trim();
}

async function kuwoOfficialSearch(keyword, rn = 10) {
  const url = `${KUWO_SEARCH_API}?client=kt&all=${encodeURIComponent(keyword)}&pn=0&rn=${rn}&ft=music&rformat=json&encoding=utf8`;
  const res = await httpRequestWithRetry(url, {
    method: "GET",
    headers: { "User-Agent": getMobileUserAgent() },
    timeout: TIMEOUT_CONFIG.search
  });
  const raw = typeof res.body === "string" ? res.body : String(res.body || "");
  // v8.12：宿主的 httpRequest 已会把“合法 JSON 字符串”自动 parse 成对象；
  // 旧实现只按字符串处理，拿到对象后 String() 成 [object Object]，搜索恒空。
  // 兼容三种形态：已经是对象 / Python repr 单引号串 / 合法 JSON 串。
  let parsed = (res.body && typeof res.body === "object") ? res.body : null;
  if (!parsed) {
    const cleaned = raw.replace(/'/g, '"');
    try { parsed = JSON.parse(cleaned); } catch (e) { /* 解析失败走正则兜底 */ }
  }
  if (parsed && Array.isArray(parsed.abslist)) {
    return parsed.abslist.map(item => ({
      rid: String(item.MP3RID || "").replace("MP3_", ""),
      name: kuwoUnescape(item.NAME),
      singer: kuwoUnescape(item.ARTIST),
      duration: Number(item.DURATION) || 0
    })).filter(i => i.rid);
  }
  // 正则兜底
  const items = [];
  const blockRe = /\{'MP3RID':'MP3_(\d+)'/g;
  let m;
  while ((m = blockRe.exec(raw))) {
    items.push({ rid: m[1], name: "", singer: "", duration: 0 });
  }
  return items;
}

/* ============================================================
 * v3.0：歌词/封面透出（App fork 已支持 lyric/pic action，音源声明即注册）
 * 实证：网易云公开 lyric(带时间标签) / detail(picUrl) 接口可用；酷我搜索 abslist 含 hts_MVPIC 封面；
 *      酷我歌词无稳定公开接口、tx/kg/mg 无签名接口 → 对应平台不声明，App 自动走内置源兜底
 * ============================================================ */

// 酷我封面搜索（单引号 Python repr → 清洗 JSON，取 abslist[0].hts_MVPIC）
async function kuwoPicSearch(keyword) {
  const url = `${KUWO_SEARCH_API}?client=kt&all=${encodeURIComponent(keyword)}&pn=0&rn=1&ft=music&rformat=json&encoding=utf8`;
  const res = await httpRequestWithRetry(url, {
    method: "GET",
    headers: { "User-Agent": getMobileUserAgent() },
    timeout: TIMEOUT_CONFIG.search
  });
  const raw = typeof res.body === "string" ? res.body : String(res.body || "");
  const cleaned = raw.replace(/'/g, '"');
  try {
    const parsed = JSON.parse(cleaned);
    const item = parsed?.abslist?.[0];
    if (item) {
      // hts_MVPIC 为完整 https 封面；MVPIC 为短路径需拼 img2.kuwo.cn 前缀
      const pic = item.hts_MVPIC || (item.MVPIC ? `https://img2.kuwo.cn/${item.MVPIC}` : null);
      if (typeof pic === "string" && /^https?:/.test(pic)) return pic;
    }
  } catch (e) { /* 解析失败走 NOT_FOUND */ }
  throw new Error(`${ERROR_CODES.NOT_FOUND}: 酷我封面获取失败`);
}

// 歌词透出：仅 wy（网易云公开接口），返回 {lyric, tlyric, rlyric}（App verifyLyricInfo 校验 lyric 非空且≤51200）
async function getLyricForPlatform(platform, songInfo) {
  if (!songInfo || typeof songInfo !== "object") throw new Error(`${ERROR_CODES.PARAM_ERROR}: 无效的歌曲信息`);
  if (platform !== "wy") throw new Error(`${ERROR_CODES.NOT_FOUND}: ${platform} 平台暂无稳定歌词接口`);
  const id = songInfo?.songmid || songInfo?.id;
  if (!id) throw new Error(`${ERROR_CODES.PARAM_ERROR}: 网易云歌词缺少歌曲ID`);
  const res = await httpGet(WY_LYRIC_API, { id: String(id), lv: 1, kv: 1, tv: -1 }, 'parse', null, 0); // 二轮审计：歌词可降级，不重试（否则 5s→10s 拖慢切歌）
  const lyric = res?.lrc?.lyric;
  if (typeof lyric !== "string" || !lyric.length) throw new Error(`${ERROR_CODES.NOT_FOUND}: 网易云歌词不存在或需VIP`);
  return {
    lyric,
    tlyric: (typeof res?.tlyric?.lyric === "string" && res.tlyric.lyric.length) ? res.tlyric.lyric : null,
    rlyric: null
  };
}

// 封面透出：wy 用 detail 接口 picUrl；kw 用搜索接口 hts_MVPIC；返回 https 字符串 URL（App 校验）
async function getPicForPlatform(platform, songInfo) {
  if (!songInfo || typeof songInfo !== "object") throw new Error(`${ERROR_CODES.PARAM_ERROR}: 无效的歌曲信息`);
  if (platform === "wy") {
    const id = songInfo?.songmid || songInfo?.id;
    if (!id) throw new Error(`${ERROR_CODES.PARAM_ERROR}: 网易云封面缺少歌曲ID`);
    // v7.0 (S4)：网易 detail 接口实测(2026-10-30 双曲对照)带 ids 参数时返回结构顶层 picUrl 恒为 null，
    // 封面稳定存在于 songs[0].album.picUrl / blurPicUrl——必须回退取 album 字段，否则封面永远 NOT_FOUND。
    // 同时补移动 UA 头：网易对无 UA 请求存在差异化/不稳定响应(实测同参有时 200 完整有时 200 空响应)。
    const res = await httpGet(WY_DETAIL_API, { id: String(id), ids: `[${String(id)}]` }, 'parse', { "User-Agent": getMobileUserAgent() });
    const song = res?.songs?.[0];
    const picUrl = song?.picUrl || song?.album?.picUrl || song?.album?.blurPicUrl;
    if (typeof picUrl !== "string" || !/^https?:/.test(picUrl)) throw new Error(`${ERROR_CODES.NOT_FOUND}: 网易云封面获取失败`);
    return picUrl;
  }
  if (platform === "kw") {
    const keyword = songInfo?.name ? `${songInfo.name} ${songInfo?.singer || ""}`.trim() : "";
    if (!keyword) throw new Error(`${ERROR_CODES.PARAM_ERROR}: 酷我封面缺少歌曲名`);
    return kuwoPicSearch(keyword);
  }
  throw new Error(`${ERROR_CODES.NOT_FOUND}: ${platform} 平台暂无稳定封面接口`);
}

async function kuwoOfficialConvert(rid) {
  if (!rid) throw new Error(`${ERROR_CODES.PARAM_ERROR}: 酷我官方缺少rid`);
  const url = `${KUWO_CONVERT_API}?type=convert_url&rid=${encodeURIComponent(rid)}&format=mp3&response=url`;  const res = await httpRequestWithRetry(url, {
    method: "GET",
    headers: { "User-Agent": getMobileUserAgent() },
    timeout: TIMEOUT_CONFIG.parse
  });
  const text = typeof res.body === "string" ? res.body.trim() : String(res.body || "").trim();
  if (!text || text === "refuse request!" || !HTTP_URL_REGEX.test(text)) {
    throw new Error(`${ERROR_CODES.NOT_FOUND}: 酷我官方convert_url未返回链接`);
  }
  return text;
}

async function kuwoOfficialGetUrl(platform, songId, quality, songInfo) {
  if (platform !== "kw") throw new Error(`${ERROR_CODES.PARAM_ERROR}: 酷我官方仅支持kw平台`);
  if (!songInfo?.name) throw new Error(`${ERROR_CODES.PARAM_ERROR}: 酷我官方需要歌曲名`);
  const cacheKey = buildCacheKey("kwoff", songInfo, "128k");
  const cached = getCachedUrl(cacheKey);
  // v7.0 (S1)：内部缓存命中必须返回裸 URL 字符串——wrapExecute 的 validateUrl 只接受字符串，
  // 旧实现返回 {url,type,subSource} 包装对象导致缓存后取链被 validateUrl 拦截(实测0ms秒失败 NOT_FOUND)。
  // subSource 透出由 getUrlWithFallback 按实际交付源统一组装，此处无需携带。
  if (cached && cached.url) return cached.url;
  const targetName = normalizeKeyword(songInfo.name);
  const items = await kuwoOfficialSearch(`${songInfo.name} ${songInfo.singer || ""}`.trim(), 10);
  if (!items.length) throw new Error(`${ERROR_CODES.NOT_FOUND}: 酷我官方搜索无结果`);
  // 匹配优先级：歌名精确 → 歌名包含 → 第一首；歌手/时长辅助校验
  let match = null;
  for (const item of items) {
    if (normalizeKeyword(item.name) === targetName) { match = item; break; }
  }
  if (!match) {
    for (const item of items) {
      const n = normalizeKeyword(item.name);
      if (n && n.includes(targetName)) { match = item; break; }
    }
  }
  if (!match) match = items[0];
  // v6.0：匹配结果加歌手/时长轻量校验——搜索接口同名歌多（翻唱/不同版本），
  // 旧实现"精确→包含→第一首"可能取到同名错歌；校验不通过明确失败走下一源，比播放错歌可诊断
  if (!titleMatch(match.name, songInfo.name) || (songInfo.singer && !artistMatch(songInfo.singer, match.singer))) {
    throw new Error(`${ERROR_CODES.MISMATCH}: 酷我官方匹配结果与目标歌曲不符`);
  }
  const url = await kuwoOfficialConvert(match.rid);
  // v8.12（D-20）：删除内层写缓存——此处 URL 未经验真，片段会被当完整音频缓存，
  // 且缓存命中处的验真在上游异常时 fail-open，用户复播直接吃 5 秒片段。缓存统一由外层（验真后）写。
  return url;
}

/* v7.0：helloworld(kw)——生态候选实证接入（2026-10-29 全链端到端验证通过）
 * 通道① convert_url_with_sign（rid 直取，128k/320k/flac 三档真实返回，flac24bit 被服务器降级 128k 按实际交付）
 * 通道② haitangw v1 resolve-url（code:0 + data.url 直接匹配，作通道①备用）
 * 设计对齐既有源模式：ID 提取 → 请求 → JSON 校验 → https 升级 → Range 可播性二次校验（防签名死链） */
const HELLOWORLD_KW_BR = { "128k": "128kmp3", "320k": "320kmp3", flac: "2000kflac", flac24bit: "4000kflac" };
async function helloworldKwGetUrl(platform, songId, quality, songInfo) {
  if (platform !== "kw") throw new Error(`${ERROR_CODES.PARAM_ERROR}: helloworld仅支持kw平台`);
  const id = songInfo?.rid || songInfo?.songmid || songInfo?.id || songId;
  if (!id) throw new Error(`${ERROR_CODES.PARAM_ERROR}: helloworld缺少kw rid`);
  // v8.11：移除源内部缓存。旧实现在这里 6 小时直接返回裸 URL 且完全不校验——
  // 实测该源是酷我 VIP 歌「5 秒试听」的主要来源，内层缓存会把片段锁死 6 小时，
  // 即便外层判据已修好，重试也拿不到新链接。统一由 getUrlWithFallback 的单层缓存 + 命中校验管理。
  const q = String(quality || "128k").toLowerCase();
  const br = HELLOWORLD_KW_BR[q] || "2000kflac";
  // 通道①：酷我官方 convert_url_with_sign（rid 签名直链）
  const convertUrl = `${HELLOWORLD_KW_CONVERT_API}?f=web&user=0&source=kwplayerhd_ar_1.1.4.5_tianbao_T1A_qirui.apk&type=convert_url_with_sign&rid=${encodeURIComponent(String(id))}&br=${br}`;
  let lastError = null;
  try {
    const res = await httpRequestWithRetry(convertUrl, {
      method: "GET",
      headers: { "User-Agent": getMobileUserAgent() },
      timeout: TIMEOUT_CONFIG.parse
    });
    const data = res?.body;
    // v7.0：校验结构——code=200 + data.url 为直链（实测响应 {code:200, data:{url,format,...}}）
    if (data && typeof data === "object" && Number(data.code) === 200 && data.data && typeof data.data.url === "string" && data.data.url.length > 0) {
      const rawUrl = data.data.url;
      if (HTTP_URL_REGEX.test(rawUrl)) {
        // v6.0 同款：CDN 410 签名死链防御——Range 轻量校验可播才返回（不缓存、不计成功）
        const httpsUrl = assertDeliverableUrl(upgradeToHttps(rawUrl), "helloworld");
        if (!await isAudioPlayable(httpsUrl, 2500)) {
          const helloworldErr = new Error(`${ERROR_CODES.LINK_EXPIRED}: helloworld签名URL不可播(CDN 410)`);
          helloworldErr.code = ERROR_CODES.LINK_EXPIRED; // v8.10.4：必须设 code——竞速按 e.code 分类，只写在 message 里会被当成业务失败
          throw helloworldErr;
        }
        // v8.11：这里只做「URL 关键词式快速预筛」——实测对酷我试听直链（形如 car-bj.kuwo.cn/.../lx/resource/n2/53/24/1530828245.mp3）
        // 一个字都不沾，因此它从 v8.0 起就是死代码。真正的判据是 wrapExecute 里的 1KB 字节校验。
        if (cfg("previewUrlPreFilter", false) && isPreviewFragmentUrl(httpsUrl)) {
          throw new Error(`${ERROR_CODES.NOT_FOUND}: helloworld返回试听片段(非完整版)，跳过`);
        }
        return httpsUrl;
      }
    }
    lastError = new Error(`${ERROR_CODES.NOT_FOUND}: helloworld convert_url未返回有效链接`);
  } catch (e) { lastError = e; }
  // 通道②：haitangw v1 resolve-url 备用（通道①网络失败/结构异常时兜底）
  try {
    const res2 = await httpRequestWithRetry(HELLOWORLD_HTW_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": getMobileUserAgent() },
      body: JSON.stringify({
        source: "kw",
        songmid: String(id),
        quality: q === "128k" ? "standard" : (q === "320k" ? "high" : "lossless")
      }),
      timeout: TIMEOUT_CONFIG.parse
    });
    const d2 = res2?.body;
    if (d2 && typeof d2 === "object" && (Number(d2.code) === 0 || Number(d2.code) === 200) && typeof d2.url === "string" && d2.url.length > 0 && HTTP_URL_REGEX.test(d2.url)) {
      const httpsUrl2 = assertDeliverableUrl(upgradeToHttps(d2.url), "helloworld htw");
      if (!await isAudioPlayable(httpsUrl2, 2500)) {
        const helloworldHtwErr = new Error(`${ERROR_CODES.LINK_EXPIRED}: helloworld htw签名URL不可播(CDN 410)`);
        helloworldHtwErr.code = ERROR_CODES.LINK_EXPIRED; // v8.10.4：同上，必须设 code
        throw helloworldHtwErr;
      }
      // v8.11：通道②同款预筛（默认关闭，理由同通道①：主判据在 wrapExecute 的字节校验）
      if (cfg("previewUrlPreFilter", false) && isPreviewFragmentUrl(httpsUrl2)) {
        throw new Error(`${ERROR_CODES.NOT_FOUND}: helloworld htw返回试听片段(非完整版)，跳过`);
      }
      return httpsUrl2;
    }
    if (!lastError) lastError = new Error(`${ERROR_CODES.NOT_FOUND}: helloworld htw未返回有效链接`);
  } catch (e) { if (!lastError) lastError = e; }
  throw lastError || new Error(`${ERROR_CODES.NOT_FOUND}: helloworld失败`);
}

/* ikun 服务器源（v8.1：域名迁移 api.ikunshare.com→c.wwwweb.top，接口 GET /url→POST /music/url；
 * 公益版免卡密（X-Api-Key 留空即可用），付费版填 USER_CONFIG.ikunApiKey；
 * 2026-11-06 实测：POST /music/url + {source,musicId,quality} → code200 + 真实128k链（https 206 audio/mpeg 可播） */
async function ikunGetUrl(platform, songId, quality, songInfo) {
  if (platform !== "kw" && platform !== "wy") throw new Error(`${ERROR_CODES.PARAM_ERROR}: ikun仅支持kw/wy平台`);
  const id = songInfo?.hash ?? songInfo?.songmid ?? songId;
  if (!id) throw new Error(`${ERROR_CODES.PARAM_ERROR}: ikun缺少歌曲ID`);
  const res = await httpRequestWithRetry(`${IKUN_API}/music/url`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": getMobileUserAgent(), "X-Api-Key": USER_CONFIG.ikunApiKey || "" },
    body: JSON.stringify({ source: platform, musicId: String(id), quality: quality || "128k" }),
    timeout: TIMEOUT_CONFIG.parse,
    follow_max: 5
  });
  const body = res.body;
  if (!body || typeof body !== "object" || Number.isNaN(Number(body.code))) throw new Error(`${ERROR_CODES.SERVER_ERROR}: ikun返回无效`);
  const code = Number(body.code);
  if (code === 200 && body.url) return upgradeToHttps(body.url);
  if (code === 403) throw new Error(`${ERROR_CODES.CONFIG_ERROR}: ikun卡密失效/鉴权失败（公益版留空卡密即可）`);
  if (code === 429) throw new Error(`${ERROR_CODES.RATE_LIMIT}: ikun请求过频`);
  throw new Error(`${ERROR_CODES.NOT_FOUND}: ikun ${body.message || "获取URL失败"}`);
}

/* GD Studio（v1.0接入：仅wy，br=999真实flac/br=320 320k/br=128 128k；限5min50次，仅用于wy高音质链，高音质优先、不进128k兜底竞速） */
async function gdWyGetUrl(platform, songId, quality, songInfo) {
  if (platform !== "wy") throw new Error(`${ERROR_CODES.PARAM_ERROR}: GD Studio仅支持网易云`);
  const id = songId ?? songInfo?.id;
  if (!id) throw new Error(`${ERROR_CODES.PARAM_ERROR}: 缺少wy songId`);
  const q = String(quality || "flac").toLowerCase();
  // v2.0：音质编码统一走 QUALITY_TO_X.gd（原 gdBrMap 已并入）
  const br = QUALITY_TO_X.gd[q] || "320";
  const url = `${GD_API}&types=url&source=netease&id=${encodeURIComponent(id)}&br=${br}`;
  const res = await httpRequestWithRetry(url, {
    method: "GET",
    headers: { "User-Agent": "LX-Music-Mobile", Accept: "application/json" },
    timeout: TIMEOUT_CONFIG.parse
  });
  const body = res.body;
  if (!body || typeof body !== "object" || !body.url) throw new Error((body && body.message) || `${ERROR_CODES.NOT_FOUND}: GD Studio未返回可用URL`);
  return body.url;
}

/* 星海备（实测域名不可解析，默认关闭，保留函数便于恢复） */
async function xinghaiBackupGetUrl(platform, songId, quality, songInfo) {
  const source = PLATFORM_TO_XINGHAI_BACKUP[platform];
  if (!source) throw new Error(`${ERROR_CODES.PARAM_ERROR}: 星海备不支持该平台`);
  const id = songId ?? getHashOrMid(songInfo);
  if (!id) throw new Error(`${ERROR_CODES.PARAM_ERROR}: 缺少songId`);
  const selectedQuality = String(quality || "128k").toLowerCase(); // v1.0 (D10)：链级已过滤，直接音质
  // v6.0：修复——旧实现直接返回"API 请求 URL"当作音频直链（域名恢复后播放器会拿 JSON 当音频，必然播放失败）。
  // 当前域名实测不可解析、无响应可验证解析逻辑，明确失败而非伪装直链；域名恢复后需按 kuwoOfficial 模式补齐请求+校验
  throw new Error(`${ERROR_CODES.NOT_FOUND}: 星海备域名不可解析(需实测补齐直链解析)`);
}

/* 星海后端主域聚合（v1.0：仅 kw；v1.0：128k/320k/flac 三档，E10 实测） */
async function xinghaiBackendGetUrl(platform, songId, quality, songInfo) {
  if (platform !== "kw") {
    throw new Error(`${ERROR_CODES.PARAM_ERROR}: 星海后端主域仅接入kw(wy签名URL本机403疑绑定后端出口IP，需家庭宽带自验后再开)`);
  }
  // v1.0 (E10)：后端实测支持 128k/320k/flac 三档（flac24bit 亦返回 flac 同链，故 maxQuality 记为 flac），不再限制 128k
  const selectedQuality = String(quality || "128k").toLowerCase();
  // v8.11.4（F-01，云端真测暴露）：旧实现 `?? "1"` 在没有 id 时兜底成 1 号歌，
  // 而该源只按 mid 出链、name/singer 不参与校验 → 必交付别人的音频（片段兜底还会把它
  // 标成「试听版」，用户点一首不存在的歌会听到别人的 5 秒）。缺 id 必须明确报错，不得猜。
  const id = songId ?? getHashOrMid(songInfo) ?? null;
  if (!id) {
    const idErr = new Error(`${ERROR_CODES.PARAM_ERROR}: 星海后端缺少 songmid/id，无法定位歌曲`);
    idErr.code = ERROR_CODES.PARAM_ERROR;
    throw idErr;
  }
  const params = {
    source: "kw",
    name: songInfo?.name || '',
    singer: songInfo?.singer || '',
    songmid: id,
    interval: songInfo?.interval || songInfo?.duration || '',
    albumName: songInfo?.albumName || songInfo?.album || '',
    quality: selectedQuality
  };
  const query = Object.keys(params).map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`).join('&');
  const res = await httpRequestWithRetry(`${XINGHAI_BACKEND_API}?${query}`, {
    method: "GET",
    // v8.4 修复：上游 token 校验升级——自定义 X-Token 被判"无效/过期，请使用官方版本"返回 403；
    // 实测不带 X-Token 的第三方调用放行(200，受总 QPS 限，notice 要求标注来源)。故不再发送自定义 token。
    headers: {
      "X-Client": "lx-aggregate/12.0",
      "User-Agent": "LX-Music-Mobile"
    },
    timeout: TIMEOUT_CONFIG.parse
  });
  const body = res.body;
  if (!body || typeof body !== "object") throw new Error(`${ERROR_CODES.SERVER_ERROR}: 星海后端返回无效`);
  if (Number(body.code) !== 200 || !body.url) throw new Error(body.msg ? `${ERROR_CODES.NOT_FOUND}: ${body.msg}` : `${ERROR_CODES.NOT_FOUND}: 星海后端无可用链接`);
  // v1.0 (D2 模式)：实测 https 同路径 206 可播，http→https 升级，避免明文播放受限
  return String(body.url).replace(/^http:\/\//i, "https://");
}

/* Huibq（实测仅酷我真实，其他平台假兜底，默认关闭） */
async function huibqGetUrl(platform, songId, quality, songInfo) {
  if (!HUIBQ_API || !HUIBQ_REQUEST_KEY) throw new Error(`${ERROR_CODES.CONFIG_ERROR}: Huibq未配置`);
  const songIdVal = songInfo?.hash ?? songInfo?.songmid ?? songId;
  if (!songIdVal) throw new Error(`${ERROR_CODES.PARAM_ERROR}: Huibq缺少ID`);
  const selectedQuality = String(quality || "128k").toLowerCase(); // v1.0 (D10)：链级已过滤，直接音质
  const url = `${HUIBQ_API}/url/${platform}/${encodeURIComponent(songIdVal)}/${encodeURIComponent(selectedQuality)}`;
  const res = await httpRequestWithRetry(url, {
    method: "GET",
    headers: { "Content-Type": "application/json", "User-Agent": getMobileUserAgent(), "X-Request-Key": HUIBQ_REQUEST_KEY },
    timeout: cfg('coldStartTimeoutMs', 8000) // v8.8：冷启动源放宽单源超时（默认8s）
  });
  const body = res.body;
  if (!body || typeof body !== "object" || Number.isNaN(Number(body.code))) throw new Error(`${ERROR_CODES.SERVER_ERROR}: Huibq返回无效`);
  if (Number(body.code) !== 0 || !body.url) throw new Error(body.msg || `${ERROR_CODES.NOT_FOUND}: Huibq未返回URL`);
  // v8.7：上游"未取到"时假成功治理——实测 tx/mg 请求拿不到时仍返回 code=0 + 一条可播但不属于该平台的兜底链
  //（msg「无法获取播放链接！」+ 酷我 panspace 链 206 可播 = 错歌）。必须按 msg 失败词判失败，避免静默交付错歌。
  if (isHuibqFailMsg(body.msg)) {
    throw new Error(`${ERROR_CODES.NOT_FOUND}: Huibq未取到该平台链接(${String(body.msg || "").slice(0, 40)})`);
  }
  return body.url;
}

/* 聆川（未配置，默认关闭；v2.0 密钥从 USER_CONFIG.lingchuanApiKey 读取，开配置即用） */
async function lingchuanGetUrl(platform, songId, quality, songInfo) {
  if (!LINGCHUAN_API) throw new Error(`${ERROR_CODES.CONFIG_ERROR}: 聆川未配置`);
  const hashOrMid = songInfo?.hash ?? songInfo?.songmid;
  if (!hashOrMid) throw new Error(`${ERROR_CODES.PARAM_ERROR}: 聆川缺少hash/songmid`);
  const selectedQuality = String(quality || "128k").toLowerCase(); // v1.0 (D10)：链级已过滤，直接音质
  const url = `${LINGCHUAN_API}/url?source=${encodeURIComponent(platform)}&songId=${encodeURIComponent(hashOrMid)}&quality=${encodeURIComponent(selectedQuality)}`;
  const res = await httpRequestWithRetry(url, {
    method: "GET",
    headers: { "Content-Type": "application/json", "User-Agent": getMobileUserAgent(), ...(USER_CONFIG.lingchuanApiKey ? { "Authorization": `Bearer ${USER_CONFIG.lingchuanApiKey}` } : {}) },
    follow_max: 5,
    timeout: TIMEOUT_CONFIG.parse
  });
  const body = res.body;
  if (!body || typeof body !== "object" || Number.isNaN(Number(body.code))) throw new Error(`${ERROR_CODES.SERVER_ERROR}: 聆川返回无效`);
  if (Number(body.code) !== 200 || !body.url) throw new Error(body.message || `${ERROR_CODES.NOT_FOUND}: 聆川未返回URL`);
  return body.url;
}

/* 溯音QQ（实测-403维护中，默认关闭） */
async function suyinQQGetUrl(songInfo, quality) {
  const qqId = getQQSongId(songInfo);
  if (!qqId) throw new Error(`${ERROR_CODES.PARAM_ERROR}: 溯音QQ缺少songmid/id`);
  const normalizedQuality = qualityToSuyinQQ(quality);
  const startBr = QUALITY_TO_X.suyinQQ[normalizedQuality] || QUALITY_TO_X.suyinQQ["128k"];
  const brList = [startBr, 4, 5, 7]
    .filter((val, idx, arr) => arr.indexOf(val) === idx && val >= startBr)
    .sort((a, b) => a - b);
  let lastError = null;
  for (const br of brList) {
    try {
      const reqParams = { key: SUYIN_QQ_KEY, type: "json", br, n: 1 };
      if (qqId.type === "mid") reqParams.mid = qqId.value;
      else reqParams.songid = qqId.value;
      const res = await httpGet(SUYIN_QQ_API, reqParams, 'parse');
      if (res?.music) return res.music;
      if (res?.url) return res.url;
      if (res?.message) {
        const match = String(res.message).match(/音频链接[：:](.+?)(?:\n|$)/);
        if (match && match[1]) return match[1].trim();
      }
      throw new Error(`${ERROR_CODES.NOT_FOUND}: 溯音QQ未找到音频链接`);
    } catch (e) { lastError = e; }
  }
  throw lastError || new Error(`${ERROR_CODES.NOT_FOUND}: 溯音QQ全部音质尝试失败`);
}

/* 溯音163（免费歌真实128k直链，VIP歌url:null自动跳过，默认开启） */
async function suyin163GetUrl(songInfo) {
  const id = songInfo?.songmid || songInfo?.id;
  if (!id) throw new Error(`${ERROR_CODES.PARAM_ERROR}: 溯音163缺少songmid/id`);
  const res = await httpGet(SUYIN_163_API, { id }, 'parse');
  if (res?.code === 0 && res?.data) {
    const item = Array.isArray(res.data) ? res.data[0] : res.data;
    if (item?.url) return item.url;
  }
  throw new Error(`${ERROR_CODES.NOT_FOUND}: 溯音163获取失败`);
}

/* 溯音酷我（实测可用：核心音源 + 全平台兜底，支持flac/320k/128k） */
async function suyinKuwoSearch(keyword, br, songInfo = null) {
  const res = await httpGet(SUYIN_KUWO_API, { msg: keyword, n: 1, br }, 'parse');
  if (res?.data?.url) {
    if (songInfo && !songInfoMatch(res, songInfo)) throw new Error(`${ERROR_CODES.MISMATCH}: 溯音酷我歌曲信息不匹配`);
    return res.data.url;
  }
  if (res?.message) {
    const match = String(res.message).match(/音乐链接[：:](\S+)/);
    if (match && match[1]) {
      if (songInfo) {
        const parsed = parseMessageSongInfo(res.message);
        if (parsed && !songInfoMatch(parsed, songInfo)) throw new Error(`${ERROR_CODES.MISMATCH}: 溯音酷我歌曲信息不匹配`);
        // D-39：message 里的时长必须回填。旧实现只拿 parsed 做歌名校验，duration 就地丢弃，
        // 而外层 verifyDelivery 的 originalDurationSec 只读 ctx.songInfo —— 调用方没传 duration 时，
        // 整条时长校验静默失效（实测：声称 1:05:00、实际给 60 秒，直接放行且标 flac24bit）。
        if (parsed && parsed.duration && !songInfo.duration) songInfo.duration = parsed.duration;
      }
      return match[1];
    }
  }
  throw new Error(`${ERROR_CODES.NOT_FOUND}: 溯音酷我未找到链接`);
}

async function suyinKuwoGetUrl(songInfo, quality) {
  if (!songInfo?.name) throw new Error(`${ERROR_CODES.PARAM_ERROR}: 溯音酷我需要歌曲名`);
  const cacheKey = buildCacheKey("kw", songInfo, quality);
  const cached = getCachedUrl(cacheKey);
  // v7.0 (S1)：内部缓存命中返回裸 URL 字符串（validateUrl 只接受字符串；子源透出由外层统一组装）
  if (cached && cached.url) return cached.url;
  // v1.0 (D10)：链级已按 maxQuality 过滤，此处直接用请求音质，不再二次降级
  const br = QUALITY_TO_X.kuwo[String(quality || "128k").toLowerCase()] || 1;
  const keywords = buildSearchKeywords(songInfo);
  let lastError = null;
  for (const item of keywords) {
    try {
      // v1.0 P0-2：兜底档(strict=false)也做歌名校验+时长校验（轻量：歌手/专辑可放宽，但歌名与时长必须一致）
      const url = await suyinKuwoSearch(item.keyword, br, item.strict ? songInfo : { name: songInfo.name, duration: songInfo.duration });
      if (url) {
        // v1.0 P0：解析出的酷我CDN链接必须Range可播，否则视为签名过期死链(410)，不缓存、不计成功，继续下一源
        // v1.0 P0-3 (D2)：先升级 https 再校验，确保返回的 https 直链真实可播
        const httpsUrl = assertDeliverableUrl(upgradeToHttps(url), "溯音酷我");
        if (!await isAudioPlayable(httpsUrl, 2500)) {
          // v6.0：CDN 410 签名死链改用 LINK_EXPIRED 码——失败缓存走 1min 差异化 TTL（旧用 NOT_FOUND 缓存 1h，恢复要等近1小时才重试该歌）
          const suyinExpiredErr = new Error(`${ERROR_CODES.LINK_EXPIRED}: 溯音酷我签名URL已过期(CDN 410)，不可播`);
          suyinExpiredErr.code = ERROR_CODES.LINK_EXPIRED; // v8.10.4：同上，必须设 code
          throw suyinExpiredErr;
        }
        // v8.12（D-20）：删除内层写缓存——isAudioPlayable 只验「能播」，不验时长/完整度，
        // 片段 URL 会因此进入 30min/6h 成功缓存，绕过外层验真闸门。统一由外层验真后写。
        // D-31：兜底档(strict=false)丢 singer 后只剩歌名+时长校验，可能放行同名同时长的错歌手。
        // 行为按既有取舍保留（有总比没有好），但必须留下可定位的痕迹，避免"悄悄放错歌"。
        if (!item.strict) {
          logInfo(`[兜底档] 歌手未校验（仅歌名+时长）: ${songInfo?.name || ""} ← 关键词「${item.keyword}」`);
        }
        return httpsUrl;
      }
    } catch (e) { lastError = e; }
  }
  throw lastError || new Error(`${ERROR_CODES.NOT_FOUND}: 溯音酷我失败`);
}

/* 溯音咪咕（实测502，默认关闭） */
async function suyinMiguGetUrl(songInfo) {
  if (!songInfo?.name) throw new Error(`${ERROR_CODES.PARAM_ERROR}: 溯音咪咕需要歌曲名`);
  const cacheKey = buildCacheKey("mg", songInfo);
  const cached = getCachedUrl(cacheKey);
  // v7.0 (S1)：内部缓存命中返回裸 URL 字符串（validateUrl 只接受字符串；子源透出由外层统一组装）
  if (cached && cached.url) return cached.url;
  const keywords = buildSearchKeywords(songInfo);
  let lastError = null;
  for (const item of keywords) {
    try {
      const res = await httpGet(SUYIN_MIGU_API, { gm: item.keyword, n: 1, num: 1, type: "json" }, 'parse');
      if (res?.code === 200 && res?.musicInfo) {
        // v1.0 P0-2：兜底档也做歌名校验+时长校验（与溯音酷我一致，轻量：歌手/专辑可放宽）
        if (!songInfoMatch(res, item.strict ? songInfo : { name: songInfo.name, duration: songInfo.duration })) throw new Error(`${ERROR_CODES.MISMATCH}: 溯音咪咕歌曲信息不匹配`);
        // v6.0：修复缓存/返回缺陷——musicInfo 为对象不能当直链缓存与返回（validateUrl 必拦、缓存永不命中）。
        // 上游 502 实测无法确认字段结构，统一按字符串 URL 提取，失败抛明确错误（不把对象伪装成直链）
        const miguUrl = typeof res.musicInfo === "string"
          ? res.musicInfo
          : (typeof res.musicInfo?.url === "string" ? res.musicInfo.url : null);
        if (!miguUrl || !HTTP_URL_REGEX.test(miguUrl)) throw new Error(`${ERROR_CODES.SERVER_ERROR}: 溯音咪咕未返回可用的音频直链(字段结构待上游恢复后验证)`);
        // v8.12（D-20）：同上，未验真不入缓存
        return miguUrl;
      }
    } catch (e) { lastError = e; }
  }
  throw lastError || new Error(`${ERROR_CODES.NOT_FOUND}: 溯音咪咕失败`);
}

/* 溯音统一入口 */
async function suyinGetUrl(platform, songId, quality, songInfo) {
  switch (platform) {
    case "tx": return suyinQQGetUrl(songInfo, quality);
    case "wy": return suyin163GetUrl(songInfo);
    case "kw": return suyinKuwoGetUrl(songInfo, quality);
    case "mg": return suyinMiguGetUrl(songInfo);
    default: throw new Error(`${ERROR_CODES.PARAM_ERROR}: 溯音不支持该平台`);
  }
}

/* 长青/念心SVIP（v1.0实测仅kw恢复：302→car-er.kuwo.cn新鲜mp3；其余平台仍403/401/404；v1.0 D10模板工厂化） */
function createTemplateVipSource(templateUrl, rejectRe, sourceName) {
  return async function templateVipGetUrl(platform, songId, quality, songInfo) {
    if (platform !== "kw") throw new Error(`${ERROR_CODES.PARAM_ERROR}: ${sourceName}今日仅kw恢复(其余平台仍403/401/404)`);
    const id = getPlatformSongId(platform, songInfo);
    if (!id) throw new Error(`${ERROR_CODES.PARAM_ERROR}: ${sourceName}缺少kw rid`);
    // 仅128k测通，固定standard级别，忽略请求音质
    const target = templateUrl.replace("{id}", encodeURIComponent(String(id))).replace("{level}", encodeURIComponent("standard"));
    // v1.0：跟随302取car-er.kuwo.cn新鲜mp3直链（Range轻量校验，不下载全曲）
    const res = await httpRequestWithRetry(target, {
      method: "GET",
      headers: { "User-Agent": getMobileUserAgent(), "Range": "bytes=0-1023" },
      timeout: TIMEOUT_CONFIG.parse,
      follow_max: 5
    });
    const finalUrl = res.url || target;
    if (!HTTP_URL_REGEX.test(finalUrl) || rejectRe.test(finalUrl)) {
      throw new Error(`${ERROR_CODES.NOT_FOUND}: ${sourceName}未跟随到音频直链`);
    }
    // v1.0 P0-3 (D2)：http→https 升级
    return upgradeToHttps(finalUrl);
  };
}

// v4.0：Juhe 聚合API(CF)——kw 平台 303 重定向校验协议（实测：POST /kw 返回 request+check 规则，
// 再请求重定向 URL，校验 body.code==200 后取 body.data.url 为真实直链）
async function juheGetUrl(platform, songId, quality, songInfo) {
  const juheQ = String(quality || "128k").toLowerCase();
  const mid = songInfo?.songmid || songInfo?.id || songId || "";
  // v4.0：各平台标识字段——kw/tx/mg 用 songmid，wy 用 id，kg 用 hash（酷狗哈希）
  // 实测（2026-10-28）：tx 全链路通(POST→303→vkeys 中转→qqmusic 直链)；wy/kg/mg 服务端
  // 当前受限(网易云上游 1027 风控/取链失败/超时)，注册为尽力型源，恢复即自动可用
  const idFields = platform === "kg"
    ? { hash: songInfo?.hash || mid, songmid: mid, id: mid }
    : platform === "wy"
      ? { id: mid, songmid: mid }
      : { songmid: mid, id: mid };
  // v6.0：完整字段透传（借鉴 HYWmusic 模式）——tx 高音质解析依赖 strMediaMid/mediaMid、
  // kg 依赖 hash、mg 依赖 copyrightId/rid/albumAudioId 等原始 ID；meta.* 层兜底，
  // 服务端拿到完整字段才能解析高音质直链
  const extraFields = {};
  for (const f of ['strMediaMid', 'mediaMid', 'hash', 'rid', 'copyrightId', 'musicId', 'albumAudioId', 'albumId', 'albumMid', 'songid', 'songId']) {
    const v = songInfo?.[f];
    if (v !== undefined && v !== null && v !== '') extraFields[f] = v;
  }
  for (const f of ['strMediaMid', 'mediaMid', 'hash', 'rid', 'copyrightId', 'name', 'singer', 'album']) {
    const v = songInfo?.meta?.[f];
    if (v !== undefined && v !== null && v !== '' && extraFields[f] === undefined) extraFields[f] = v;
  }
  const info = {
    type: juheQ,
    musicInfo: {
      ...extraFields,
      name: songInfo?.name || "",
      singer: songInfo?.singer || "",
      album: songInfo?.album || "",
      duration: songInfo?.duration || 0,
      interval: Math.round((songInfo?.duration || 0) / 1000),
      source: platform === "kw" ? "kw" : String(platform || "kw"),
      ...idFields,
      quality: juheQ
    }
  };
  const res = await httpRequestWithRetry(`${JUHE_API}/${platform}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": getMobileUserAgent() },
    body: JSON.stringify(info),
    timeout: 15000
  }, 1);
  const d = res.body;
  // v8.11.2（N1 实测）：上游 code 时而 "200"(字符串) 时而 200(数字)，旧实现严格比数字，
  // 字符串形态一律落到"响应异常"——该源在这种响应下 100% 失败。统一 String 归一后再比。
  const dCode = d && d.code !== undefined && d.code !== null ? String(d.code) : "";
  if (dCode === "200" && typeof d.data?.url === "string") return upgradeToHttps(d.data.url);
  if (dCode === "303" && d.data?.request) {
    const r = d.data.request;
    const resp = await httpRequest(r.url, {
      method: String(r.options?.method || "GET").toUpperCase(),
      headers: r.options?.headers || {},
      timeout: 10000
    });
    // 校验作用于整个响应对象（body 已由 httpRequest 解析为对象）：
    // check.key ['body','code'] → resp.body.code；url ['body','data','url'] → resp.body.data.url
    const check = d.data.response?.check;
    if (check && check.key?.length) {
      const got = check.key.reduce((acc, k) => (acc && typeof acc === "object" ? acc[k] : undefined), resp);
      // v8.11.2（N2 实测）：check.value 是 200(数字)、响应体是 "200"(字符串) 时旧实现严格比类型判失败。
      if (got === undefined || got === null || String(got) !== String(check.value)) throw new Error(`${ERROR_CODES.NOT_FOUND}: Juhe重定向校验失败`);
    }
    const u = (d.data.response?.url || []).reduce((acc, k) => (acc && typeof acc === "object" ? acc[k] : undefined), resp);
    if (typeof u === "string" && /^https?:/.test(u)) return upgradeToHttps(u);
    throw new Error(`${ERROR_CODES.NOT_FOUND}: Juhe重定向未取到直链`);
  }
  throw new Error(`${ERROR_CODES.NOT_FOUND}: Juhe响应异常(${d?.msg || "未知"})`);
}

const changqingGetUrl = createTemplateVipSource(CHANGQING_URL_TEMPLATES.kw, /kw\.php/, "长青");
const nianxinGetUrl = createTemplateVipSource(NIANXIN_URL_TEMPLATES.kw, /nxinxz\.com/, "念心");

function getPlatformSongId(platform, songInfo) {
  if (platform === "kg") return songInfo?.hash || songInfo?.songmid || songInfo?.id || songInfo?.rid || songInfo?.mid || null;
  if (platform === "tx") {
    const qqId = getQQSongId(songInfo);
    if (qqId?.value) return qqId.value;
  }
  return songInfo?.songmid || songInfo?.id || songInfo?.songId || songInfo?.rid || songInfo?.hash || null;
}

// v3.0：健康统计快照——供 App 健康面板/巡检消费；返回各源成功率/均时/熔断状态/健康分
function getHealthSnapshot() {
  const snapshot = {};
  for (const id of Object.keys(SOURCE_HANDLERS)) {
    const h = SOURCE_HANDLERS[id];
    const stats = getSourceStats(id);
    const score = computeHealthScore(id);
    snapshot[id] = {
      name: h.name,
      maxQuality: h.maxQuality,
      enabled: runtimeToggles[id] !== false,
      successRate: stats.successRate,
      avgTime: stats.avgTime,
      state: stats.state,
      // v6.0：真实播放请求最后使用时间戳（App 五级分区'使用中'判定；0=从未用过）
      lastUsedAt: lastUsedAt.get(id) || 0,
      // v4.0：样本计数（App 显示采样数；无样本的 successRate/avgTime 为 null → 显示"-"）
      reqCount: stats.reqCount,
      probeCount: stats.probeCount,
      // v4.0：休眠状态（连续失败轮休眠，每 PROBE_WAKE_EVERY_ROUND 轮复活试探；App 显示"休眠中"）
      sleeping: !!probeState.sleeping[id],
      // v4.0：版权/业务失败计数（无版权歌等；App 面板可在后续版本展示）
      copyrightFail: stats.copyrightFail,
      // v4.0：按音质分档统计（面板后续版本可消费）
      byQuality: stats.byQuality,
      // v7.0：播放实时摘除状态（连续播放失败被摘除；App 可显示"已摘除"）
      playDead: isPlayDead(id),
      // v4.0：限流状态（被限=连续429，App 显示"被限"而非"熔断"）
      rateLimited: !!getBreaker(id).rateLimited,
      rateLimitCount: getBreaker(id).rateLimitCount || 0,
      // 第五轮审计：面板"限流中"必须能亮。rateLimited（连续 3 次被上游真拒）在串行使用中不可达——
      // 第一次 429 就把 rateLimitUntil 推后 30s，后续请求被 canExecute 本地拦下、不构成新证据。
      // 所以另给"当前是否处于退避期"的派生值供面板用，与"已被风控"这个强标记分开：
      // rateLimitActive=true 表示"现在这个源不参与竞速"，rateLimited=true 表示"历史上被拒多次"。
      rateLimitUntil: getBreaker(id).rateLimitUntil || 0,
      rateLimitActive: (getBreaker(id).rateLimitUntil || 0) > Date.now(),
      // v6.0：最近成功交付音质（音质协商链降档后诊断用）
      lastQuality: getBreaker(id).lastQuality || null,
      // v7.0：健康分输出改 10 分制（0~10，一位小数）——内部评分仍为 0~1（排序/熔断逻辑不变），
      // 仅快照输出 ×10 换算，配合 App 健康面板直观显示；负分保留（异常源 App 标红）
      healthScore: Number((score.score * 10).toFixed(1))
    };
  }
  // v8.0：平台级降级聚合（按平台分组子源，判断某平台全部启用子源是否失效）
  // v8.10.3：平台分组不再手写——旧实现漏了"链构建会对所有非 kw 平台追加 suyinKuwo"这一事实
  // （wy/tx/mg/kg 的分组清单都没列它），导致这些平台只剩 suyinKuwo 活着时被判"无活跃源/全挂"。
  // 现改为按各音质把 buildSourceChain 的结果取并集：分组与竞速链永远一致，不会再漂移。
  const PLATFORM_GROUPS = {};
  for (const p of Object.keys(PLATFORM_QUALITIES)) {
    const set = new Set();
    for (const q of ["128k", "320k", "flac", "flac24bit"]) {
      for (const h of buildSourceChain(p, q)) set.add(h.id);
    }
    PLATFORM_GROUPS[p] = [...set];
  }
  const platformSummary = {};
  const healthyPlatforms = [];
  for (const [platform, sourceIds] of Object.entries(PLATFORM_GROUPS)) {
    const activeSources = sourceIds.filter(id => snapshot[id] && snapshot[id].enabled);
    if (!activeSources.length) {
      platformSummary[platform] = { degraded: false, reason: "no_active_sources" };
      continue;
    }
    // v30.1：deadCount 加上 half-open 状态（半开试探中也算"可能还坏着"）
    const deadCount = activeSources.filter(id =>
      snapshot[id].playDead || snapshot[id].sleeping ||
      snapshot[id].state === "open" || snapshot[id].state === "half-open"
    ).length;
    const allDead = deadCount === activeSources.length;
    // v30.1：计算平台平均健康分（用于选兜底平台）
    const avgScore = activeSources.reduce((sum, id) => sum + (snapshot[id].healthScore || 0), 0) / activeSources.length;
    platformSummary[platform] = { degraded: allDead, activeCount: activeSources.length, deadCount, avgScore: Math.round(avgScore * 10) / 10 };
    if (!allDead) healthyPlatforms.push({ platform, avgScore });
  }
  snapshot._platformSummary = platformSummary;
  // v30.1：兜底平台选健康分最高的（不再是第一个）
  healthyPlatforms.sort((a, b) => b.avgScore - a.avgScore);
  snapshot._fallbackPlatform = healthyPlatforms[0]?.platform || null;
  // 五轮 MEM：缓存/记忆表的条目数（长跑内存占用的唯一可观测口径，供巡检与断言读取）
  snapshot._memory = {
    successCache: successCache.size(),
    failCache: failCache.size(),
    deliveryQuality: deliveryQualityMap.size,
    fragmentSource: fragmentSourceMap.size,
    qualityCeiling: qualityCeilingMap.size,
    fragmentUrl: fragmentUrlMap.size,
    handlerSongs: [...fragmentHandlerSongsMap.values()].reduce((n, e) => n + (e && e.mids ? e.mids.size : 0), 0),
    limit: Math.max(1, Number(cfg('memoryMapMax', MEMORY_MAP_MAX)) || MEMORY_MAP_MAX)
  };
  return snapshot;
}

// ============================================================
// 第七部分：音源注册表 + 调度（源级音质过滤 + 竞速回退 + 6s整体超时）
// ============================================================
// v1.0 P0-1：每个源标注 maxQuality 真实能力；buildSourceChain 按请求音质过滤，杜绝128k源冒充flac竞速
const SOURCE_HANDLERS = {
  gdWy: { id: "gdWy", name: "GD Studio(网易)", fn: gdWyGetUrl, maxQuality: "flac", batch: 2 }, // v8.8：配额源（5min/50次）降到后批，前批失败才打，省配额
  wyOuter: { id: "wyOuter", name: "网易云官方", fn: wyOuterGetUrl, maxQuality: "128k" },
  kuwoOfficial: { id: "kuwoOfficial", name: "酷我官方直连", fn: kuwoOfficialGetUrl, maxQuality: "128k" },
  helloworldKw: { id: "helloworldKw", name: "helloworld(kw)", fn: helloworldKwGetUrl, maxQuality: "flac" }, // v7.0：生态候选实证通过——kw 128k/320k/flac 三档直链(convert_url_with_sign + htw v1 双通道)
  ikun: { id: "ikun", name: "ikun", fn: ikunGetUrl, maxQuality: "flac" },
  xinghaiBackup: { id: "xinghaiBackup", name: "星海备", fn: xinghaiBackupGetUrl, maxQuality: "128k" },
  xinghaiBackend: { id: "xinghaiBackend", name: "星海后端", fn: xinghaiBackendGetUrl, maxQuality: "flac" },
  huibq: { id: "huibq", name: "Huibq", fn: huibqGetUrl, maxQuality: "320k", coldStart: true, platforms: ["kw", "wy"] }, // v8.9：仅 kw/wy（实测 tx/mg/kg 必败）；v8.8：冷启动源（onrender 免费实例，预热 + 放宽超时）
  lingchuan: { id: "lingchuan", name: "聆川", fn: lingchuanGetUrl, maxQuality: "320k", platforms: ["kw", "wy", "tx", "mg", "kg"] }, // v8.10.3：显式声明全平台（协议为 source=平台由服务端路由），实测收窄只需改此一处
  suyinQQ: { id: "suyinQQ", name: "溯音QQ", fn: (platform, songId, quality, songInfo) => suyinGetUrl("tx", songId, quality, songInfo), maxQuality: "flac" },
  suyin163: { id: "suyin163", name: "溯音163", fn: (platform, songId, quality, songInfo) => suyinGetUrl("wy", songId, quality, songInfo), maxQuality: "128k" },
  suyinKuwo: { id: "suyinKuwo", name: "溯音酷我", fn: (platform, songId, quality, songInfo) => suyinKuwoGetUrl(songInfo, quality), maxQuality: "flac", verified: true }, // v8.4：128k br 修正为 9（实测唯一可播）；flac/320k 当前为 VIP 死链(br=1/5 均410)会失败降级，保留 maxQuality 以便 oiapi 恢复高音质时自动可用
  juheKw: { id: "juheKw", name: "Juhe聚合(kw)", fn: juheGetUrl, maxQuality: "flac" }, // v4.0：Juhe 独立新源族(kw 全音质)
  // v4.0：Juhe 源族扩充——tx 全链路实测通；wy/kg/mg 协议已实证(按平台标识字段路由)，服务端受限时由熔断/降级兜底
  juheTx: { id: "juheTx", name: "Juhe聚合(tx)", fn: juheGetUrl, maxQuality: "flac" },
  juheWy: { id: "juheWy", name: "Juhe聚合(wy)", fn: juheGetUrl, maxQuality: "flac" },
  juheKg: { id: "juheKg", name: "Juhe聚合(kg)", fn: juheGetUrl, maxQuality: "flac" },
  juheMg: { id: "juheMg", name: "Juhe聚合(mg)", fn: juheGetUrl, maxQuality: "flac" },
  suyinMigu: { id: "suyinMigu", name: "溯音咪咕", fn: (platform, songId, quality, songInfo) => suyinGetUrl("mg", songId, quality, songInfo), maxQuality: "flac", verified: true }, // v3.0：内部做 songInfoMatch 校验，竞速优先
  changqingVip: { id: "changqingVip", name: "长青kw", fn: changqingGetUrl, maxQuality: "128k" },
  nianxinVip: { id: "nianxinVip", name: "念心kw", fn: nianxinGetUrl, maxQuality: "128k" }
};

// 构建音源链：按平台 + 请求音质过滤源能力（maxQuality >= 请求音质），高音质源在前
function buildSourceChain(platform, quality) {
  const chain = [];
  const t = runtimeToggles;
  const q = String(quality || "128k").toLowerCase();
  const canDo = (h) => qualityRank(h.maxQuality) >= qualityRank(q);
  const push = (h) => {
    if (!h) return;
    // v8.11.5：链过滤统一走 skipReason()（原先只判 isPlayDead，与 skipReason 各写一份）
    // 只拦「结构性不可用」三种；breaker / rate-limited 仍留在链里，由竞速侧做半开试探。
    const skip = structuralSkipReason(h.id);
    if (skip) {
      if (LOG_DEBUG) logDebug(`[链] ${h.id} 跳过（${skip.reason}${skip.untilMs ? `，至 ${skip.untilMs}` : ""}）`);
      return;
    }
    if (canDo(h)) chain.push(h);
    else if (h && LOG_DEBUG) logDebug(`[链] ${h.id}(maxQuality=${h.maxQuality}) 不满足请求音质(${q})，已过滤`);
  };

  if (platform === "kw") {
    // 高音质(flac/320k)：溯音酷我 + 星海后端 双源(v1.0)；128k：溯音酷我 + 星海后端 + 酷我官方 + 长青 + 念心 多源竞速兜底
    if (t.suyinKuwo) push(SOURCE_HANDLERS.suyinKuwo);
    if (t.xinghaiBackend) push(SOURCE_HANDLERS.xinghaiBackend);
    // v4.0：Juhe 独立新源族(kw 全音质)——排在既有稳定源之后作兜底
    if (t.juheKw) push(SOURCE_HANDLERS.juheKw);
    // v8.0：helloworld(kw) 从高音质竞速降为备用——实测发现部分歌曲返回酷我VIP试听片段(5秒)，
    // 与溯音/星海并列竞速时经常先返回试听片段；移到 Juhe 之后，只有前面都失败才用它
    if (t.helloworldKw) push(SOURCE_HANDLERS.helloworldKw);
    if (t.kuwoOfficial) push(SOURCE_HANDLERS.kuwoOfficial);
    // v1.0：长青/念心 kw 128k，排在现有稳定源之后
    if (t.changqingVip) push(SOURCE_HANDLERS.changqingVip);
    if (t.nianxinVip) push(SOURCE_HANDLERS.nianxinVip);
    if (t.ikun) push(SOURCE_HANDLERS.ikun);
  }
  if (platform === "wy") {
    // 高音质(flac/320k)：GD Studio 优先(高音质补充)，suyinKuwo 搜索兜底；
    // 128k：suyin163 + wyOuter 官方直连优先（GD Studio 不进128k链，省配额）
    if (t.gdWy && (q === "flac" || q === "flac24bit" || q === "320k" || q === "hires")) push(SOURCE_HANDLERS.gdWy);
    // v4.0：Juhe wy 全音质兜底（服务端恢复即自动参与竞速）
    if (t.juheWy) push(SOURCE_HANDLERS.juheWy);
    if (t.suyin163) push(SOURCE_HANDLERS.suyin163);
    if (t.wyOuter) push(SOURCE_HANDLERS.wyOuter);
    if (t.ikun) push(SOURCE_HANDLERS.ikun);
  }
  // 全平台兜底（kw 已在上面 push，这里其余平台追加）
  if (t.suyinKuwo && platform !== "kw") push(SOURCE_HANDLERS.suyinKuwo);
  // 其他平台/备用源
  if (t.suyinQQ && platform === "tx") push(SOURCE_HANDLERS.suyinQQ);
  if (t.juheTx && platform === "tx") push(SOURCE_HANDLERS.juheTx); // v4.0：Juhe tx 兜底
  if (t.suyinMigu && platform === "mg") push(SOURCE_HANDLERS.suyinMigu);
  if (t.juheMg && platform === "mg") push(SOURCE_HANDLERS.juheMg); // v4.0：Juhe mg 兜底
  // v4.0：Juhe kg——kg 平台专属新源（酷狗 hash 路由）
  if (t.juheKg && platform === "kg") push(SOURCE_HANDLERS.juheKg);
  // 已知不可用：星海备域名 yy.zddyr.top 当前不可解析，默认关闭；开启后作最后备胎（必败、白耗 1~5s）
  // v8.11.1：条件改为按 PLATFORM_TO_XINGHAI_BACKUP 声明过滤——旧条件只写了 !== "kg"，
  // 但映射表 {wy,tx,kw} 里也没有 mg，导致 mg 平台每次都被 push 进来、必抛 PARAM_ERROR，
  // 白等一次外呼。按映射表判定天然排掉 mg/kg，且以后加平台不会再漏。
  if (t.xinghaiBackup && PLATFORM_TO_XINGHAI_BACKUP[platform]) push(SOURCE_HANDLERS.xinghaiBackup);
  // 长青/念心已在 kw 块内按 kw-only 顺序 push（maxQuality=128k，仅进kw 128k链）
  // v8.9：huibq 仅支持 kw/wy（2026-11-06 实测：tx/mg/kg 均返回"无法获取播放链接"，必败兜底白耗 1~1.5s）
  // v8.9：按 handler 的 platforms 能力声明过滤（单一真相，避免链构建与声明各写一份而漂移）
  if (t.huibq && (!SOURCE_HANDLERS.huibq.platforms || SOURCE_HANDLERS.huibq.platforms.includes(platform))) push(SOURCE_HANDLERS.huibq);
  if (t.lingchuan) push(SOURCE_HANDLERS.lingchuan);
  return chain;
}

// v3.0：排序改用综合健康评分（成功率×置信度 + 均时 + 连续失败惩罚）；分数差>0.05 优先，否则按均时兜底
function sortChainByHealth(chain) {
  return chain.slice().sort((a, b) => {
    // v4.0：verified 源(内部 songInfoMatch 校验)附加优先权重——健康分相近时已校验源靠前（串行兜底顺序）；
    // 竞速层 raceFirst 已有 verified 优先返回机制，此权重仅优化 rest 兜底顺序
    const av = a.verified ? 0.15 : 0;
    const bv = b.verified ? 0.15 : 0;
    const ha = computeHealthScore(a.id).score + av;
    const hb = computeHealthScore(b.id).score + bv;
    if (Math.abs(hb - ha) > 0.05) return hb - ha;
    return computeHealthScore(a.id).avgTime - computeHealthScore(b.id).avgTime;
  });
}

// v8.8：竞速执行器重写
// ① 分批错峰并发：批1 启动后 staggerMs 内未成功即启动批2（不再"竞速3个+串行rest"）
// ② 全局预算：deadline 由 getUrlWithFallback 跨音质档共享
// ③ verified 精确等待：仅当批次里还有"未 settle 的 verified 源"才给匹配等待；否则立即交付
function raceFirst(launchers, opts = {}) {
  const batchSize = Math.max(1, Number(opts.batchSize || cfg('raceBatchSize', 3)));
  const staggerMs = Math.max(0, Number(opts.staggerMs !== undefined ? opts.staggerMs : cfg('raceBatchStaggerMs', 300)));
  const matchWaitMs = Math.max(0, Number(opts.matchWaitMs !== undefined ? opts.matchWaitMs : cfg('raceMatchWaitMs', 600)));
  const deadline = Number(opts.deadline || (Date.now() + cfg('raceBudgetMs', 12000)));
  if (!launchers || launchers.length === 0) {
    return Promise.reject(new Error(`${ERROR_CODES.NOT_FOUND}: 无可竞速的音源`));
  }
  return new Promise((resolve, reject) => {
    let settled = false;
    let started = 0;
    let pending = 0;
    let verifiedPending = 0;
    let candidate = null;
    let waiter = null;
    let budgetTimer = null;
    const errs = [];
    const total = launchers.length;
    const settle = (val) => {
      if (settled) return;
      settled = true;
      if (waiter) { clearTimeout(waiter); waiter = null; }
      if (budgetTimer) { clearTimeout(budgetTimer); budgetTimer = null; }
      resolve(val);
    };
    const fail = (err) => {
      if (settled) return;
      settled = true;
      if (waiter) { clearTimeout(waiter); waiter = null; }
      if (budgetTimer) { clearTimeout(budgetTimer); budgetTimer = null; }
      reject(err);
    };
    const startOne = (i) => {
      const item = launchers[i];
      const h = (item && item.handler) || null;
      const run = typeof item === "function" ? item : (item && item.run);
      const isVerified = !!(h && h.verified);
      started += 1;
      pending += 1;
      if (isVerified) verifiedPending += 1;
      Promise.resolve().then(run).then(
        (res) => {
          pending -= 1;
          if (isVerified) verifiedPending -= 1;
          if (settled) return;
          const url = (res && typeof res === "object" && res.url) ? res.url : res;
          const source = (res && typeof res === "object" && res.source) ? res.source : ((h && h.id) || "");
          logDebug(`[竞速] 候选成功: 源=${source || "未知"} verified=${isVerified}`);
          if (isVerified) return settle({ url, source: source || "" });
          if (!candidate) {
            candidate = { url, source: source || "" };
            if (verifiedPending > 0 && matchWaitMs > 0) {
              waiter = setTimeout(() => { waiter = null; if (!settled && candidate) settle(candidate); }, matchWaitMs);
            } else {
              settle(candidate);
            }
          }
        },
        (e) => {
          pending -= 1;
          if (isVerified) verifiedPending -= 1;
          errs.push(e);
          if (settled) return;
          if (candidate && verifiedPending === 0) return settle(candidate);
          if (pending === 0 && started >= total) {
            logDebug(`[竞速] 候选全败: ${errs.length} 个: ${errs.map(x => String((x && x.message) || "")).join(" | ")}`);
            return fail({ allFailed: true, errors: errs });
          }
        }
      );
    };
    const launchBatch = () => {
      if (settled) return;
      const endIdx = Math.min(started + batchSize, total);
      while (started < endIdx) startOne(started);
      if (started < total) setTimeout(launchBatch, staggerMs);
    };
    launchBatch();
    budgetTimer = setTimeout(() => {
      budgetTimer = null;
      if (settled) return;
      if (candidate) return settle(candidate);
      fail(new Error(`${ERROR_CODES.NETWORK_TIMEOUT}: 竞速预算耗尽(${cfg('raceBudgetMs', 12000)}ms)`));
    }, Math.max(deadline - Date.now(), 0));
  });
}

// v4.0：单源并发计数 + 滑动窗口限速（超限本轮跳过，不阻塞其他源）
const inflightCount = new Map();
// v6.0：真实播放请求最后使用时间戳（健康快照 lastUsedAt，供 App 判断'使用中'分组）
const lastUsedAt = new Map();
const reqTimestamps = new Map();
function throttleCheck(sourceId) {
  const inflight = inflightCount.get(sourceId) || 0;
  const maxConc = cfg('maxConcurrency', SOURCE_MAX_CONCURRENCY);
  if (inflight >= maxConc) {
    logDebug(`[限速] ${sourceId} 并发${inflight}≥${maxConc}，本轮跳过`);
    return false;
  }
  const now = Date.now();
  const winMs = cfg('rateWindowMs', RATE_WINDOW_MS);
  const winMax = cfg('rateWindowMax', RATE_WINDOW_MAX);
  const ts = (reqTimestamps.get(sourceId) || []).filter(t => now - t < winMs);
  reqTimestamps.set(sourceId, ts);
  if (ts.length >= winMax) {
    logDebug(`[限速] ${sourceId} ${winMs / 1000}s内${ts.length}次≥${winMax}，本轮跳过`);
    return false;
  }
  return true;
}
async function wrapExecute(handler, platform, songInfo, quality) {
  const traceId = healthTraceOf(songInfo);
  // v8.11：源级限流冷却——同一源对同一首歌三档都只给片段时判定为源被限流，
  // 冷却期内直接跳过（实测密集请求时整个源会统一返回同一个 84972 字节片段，跑三档纯属白等）
  // v8.11.1（二轮压测 S9 实测）：冷却期若整源跳过，新歌会连片段都拿不到（与「整站只有片段时给片段」冲突）。
  // 修法：冷却期只放行 128k 这一档（既有 128k 保底思路）——单档不会累积「三档全片段」证据，冷却不会被无限延长。
  const previewCoolUntil = previewCooldownMap.get(handler.id);
  const is128k = String(quality || "").toLowerCase() === "128k";
  if (previewCoolUntil && previewCoolUntil > Date.now() && !is128k) {
    recordHealthEvent({ event: "source_skip", traceId, sourceId: handler.id, platform, quality, reason: "preview_cooldown" });
    const coolErr = new Error(`${ERROR_CODES.RATE_LIMIT}: 音源[${handler.name}]判定为源级限流，冷却中（128k 保底档除外）`);
    coolErr.isThrottleSkip = true;
    throw coolErr;
  }
  if (!canExecute(handler.id)) {
    recordHealthEvent({ event: "source_skip", traceId, sourceId: handler.id, platform, quality, reason: "breaker" });
    logDebug(`[断路器] ${handler.id} 处于${getBreaker(handler.id).state}状态，跳过`);
    // v6.0：熔断跳过打 isThrottleSkip 标记——catch 短路抛出，不再误记 recordRateLimit
    //（旧实现熔断期每轮跳过都虚增 rateLimitCount，App 面板限流计数被污染）
    revertHalfOpenOnSkip(handler.id); // D-34：half-open 恒 false，必须退回 open 否则永久卡死
    const breakerSkip = new Error(`${ERROR_CODES.RATE_LIMIT}: 音源[${handler.name}]已熔断`);
    breakerSkip.isThrottleSkip = true;
    throw breakerSkip;
  }
  if (!throttleCheck(handler.id)) {
    recordHealthEvent({ event: "source_skip", traceId, sourceId: handler.id, platform, quality, reason: "local_throttle" });
    // v6.0：本地并发/限速保护跳过——标记 isThrottleSkip：非上游429，不记限流统计、不污染成功率、
    // 不触发 30s 退避（旧实现误记 recordRateLimit，流量高峰会把源冤枉成"被限"）
    revertHalfOpenOnSkip(handler.id); // D-34：同上，节流也在 try 之外抛
    const skipErr = new Error(`${ERROR_CODES.RATE_LIMIT}: 音源[${handler.name}]触发并发/限速保护，本轮跳过`);
    skipErr.isThrottleSkip = true;
    throw skipErr;
  }
  inflightCount.set(handler.id, (inflightCount.get(handler.id) || 0) + 1);
  // v8.0：防御性初始化——不依赖 throttleCheck 先调用，直接确保数组存在
  if (!reqTimestamps.has(handler.id)) reqTimestamps.set(handler.id, []);
  reqTimestamps.get(handler.id).push(Date.now());
  // v6.0：真实播放请求（成败均记）——健康面板'使用中'判定依据；探测不经过此路径
  lastUsedAt.set(handler.id, Date.now());
  const startTime = Date.now();
  recordHealthEvent({ event: "source_attempt", traceId, sourceId: handler.id, platform, quality });
  try {
    const mid = getHashOrMid(songInfo);
    const url = await handler.fn(platform, mid, quality, songInfo);
    // v8.10.2：先验后记——validateUrl 抛错时不再"既记成功又记业务失败"（旧顺序同一请求双记账，
    // 成功率分子分母各被记一次，健康分失真；也掩盖了真失败）
    const finalUrl = validateUrl(url, handler.name);
    // v8.11：交付前真实性闸门——一次 Range(1KB) 拿真实字节判定「是不是音频 / 是不是只有试听片段」
    const verdict = await verifyDelivery(finalUrl, { platform, handlerId: handler.id, quality, songInfo });
    if (verdict && verdict.ok === false) {
      const vErr = new Error(`${verdict.code}: ${CODE_HINT[verdict.code] || "交付校验未通过"}（${verdict.reason}）`);
      vErr.code = verdict.code;
      vErr.deliveryCheck = true;
      vErr.evidence = verdict.evidence || "strong";
      // v8.11：把片段 URL 带出去——全链都只有片段时要按 B 方案兜底返回它（标注「试听版」），
      // 否则用户点歌直接"没声"，比听到 5 秒更糟
      if (verdict.code === ERROR_CODES.PREVIEW_FRAGMENT) {
        vErr.fragmentUrl = finalUrl;
        if (verdict.quality) vErr.fragmentQuality = verdict.quality;
      }
      throw vErr;
    }
    const realQuality = (admit({ probe: verdict, songInfo, quality }).quality) || (verdict && verdict.quality) || "";
    if (realQuality) {
      const reqQ = String(quality || "").toLowerCase();
      if (realQuality !== reqQ) {
        // 旁路记录实交付音质，供 getUrlWithFallback 把标签改成真话（请求 flac 实得 128k 时界面不能写 FLAC）
        boundedMapSet(deliveryQualityMap, `${handler.id}|${platform}|${mid}|${reqQ}`, realQuality);
        logInfo(`[${handler.name}] 实交付音质与请求档不符: 请求[${quality || "128k"}] → 实得[${realQuality}]`);
      } else {
        boundedMapSet(deliveryQualityMap, `${handler.id}|${platform}|${mid}|${reqQ}`, realQuality);
      }
    }
    recordSuccess(handler.id, Date.now() - startTime, quality);
    recordHealthEvent({ event: "source_result", traceId, sourceId: handler.id, platform, quality, ok: true, code: "", latencyMs: Date.now() - startTime });
    logInfo(`[${handler.name}] 解析成功: ${songInfo?.name || ""} 音质[${quality || "128k"}]`);
    return finalUrl;
  } catch (e) {
    // v6.0：本地节流跳过——不记账直接抛出（finally 仍释放并发计数）
    if (e && e.isThrottleSkip) {
      // v8.10.2：半开收口——canExecute 放行一次后若被本地节流/熔断拦下，试探并未真正发生，
      // 状态不能停在 half-open（那里恒返回 false，该源会永久不被调用）；退回 open 重新等冷却
      revertHalfOpenOnSkip(handler.id); // D-34：抽函数统一，三处收口行为一致
      throw e;
    }
    recordHealthEvent({ event: "source_result", traceId, sourceId: handler.id, platform, quality, ok: false, code: extractErrorCode(e), latencyMs: Date.now() - startTime });
    // v6.0：删除 catch 里的 inflightCount 递减——finally 已统一释放；
    // 旧实现 catch+finally 双递减会把并发中其他请求的计数也归零，单源并发保护(2)失效
    // v3.0：失败原因结构化透出——给错误附加源 id，供聚合 detail 关联具体子源
    if (e && typeof e === "object" && !e.sourceId) e.sourceId = handler.id;
    // v1.0：决策日志——区分熔断类错误(网络类)与业务失败(不熔断)
    logDebug(`[${handler.name}] 失败 code=${e.code || "?"} msg=${e.message}; 熔断类=${e.code === ERROR_CODES.NETWORK_TIMEOUT || e.code === ERROR_CODES.NETWORK_ERROR || e.code === ERROR_CODES.SERVER_ERROR || e.code === ERROR_CODES.RATE_LIMIT}`);
    // v1.0：仅网络类错误(超时/5xx/429)计入熔断——业务失败(NOT_FOUND/MISMATCH等)说明源已正常响应，
    // 不应因"歌不存在/无版权"累积连续失败而误熔断健康源。
    // L4：判据与记账分离——admit 出裁决，applyAdmission 按 ledger 落账（不再在此处 if(code) 分叉）。
    const adm = admit({
      stage: "candidate", platform, quality, songInfo, source: handler.id,
      error: { code: extractErrorCode(e), reason: String((e && e.message) || ""), evidence: (e && e.evidence) || "strong" },
    });
    applyAdmission(adm, { source: handler.id, quality, platform, songInfo, error: e, name: handler.name });
    throw e;
  } finally {
    inflightCount.set(handler.id, Math.max((inflightCount.get(handler.id) || 0) - 1, 0));
  }
}

// v1.0 P0-5：fallbackRace 加 6s 整体超时；超时后继续 rest 串行
async function fallbackRace(chain, platform, songInfo, quality, deadline) {
  // v8.8：预算耗尽快速失败（跨音质档共享）
  if (deadline && Date.now() >= deadline) {
    const budgetErr = new Error(`${ERROR_CODES.NETWORK_TIMEOUT}: 竞速预算耗尽(${cfg('raceBudgetMs', 12000)}ms)，跳过本档`);
    budgetErr.detail = [{ source: "budget", quality, code: ERROR_CODES.NETWORK_TIMEOUT, reason: "预算耗尽" }];
    throw budgetErr;
  }
  // v3.0：失败原因结构化——detail 数组每项 {source, quality, code, reason}，供 App 端展示/统计
  const collectDetails = [];
  if (chain.length === 1) {
    // v7.0：单链请求打点（可观测：只走一个候选源时的开始）
    logDebug(`[竞速] 单链请求: ${platform} ${quality} 源=${chain[0].id}`);
    // v8.11.1（审计修复）：单链分支此前直接 await wrapExecute，完全绕过 raceFirst，
    // 也就绕过了所有 deadline —— 实测单源 8s 无响应时，flac 档跑 20.4s、末档 floor 再跑 20.4s，
    // 单次点歌 40.8s 远超 15s 预算。此处补上单源硬上限，到点即判超时（在飞请求自然结束，不影响后续档）。
    const budgetLeft = Math.max((Number(deadline) || (Date.now() + cfg('raceBudgetMs', 12000))) - Date.now(), 1000);
    let singleTimer = null;
    try {
      const url = await Promise.race([
        wrapExecute(chain[0], platform, songInfo, quality),
        new Promise((_, reject) => {
          singleTimer = setTimeout(() => {
            reject(Object.assign(new Error(`${ERROR_CODES.NETWORK_TIMEOUT}: 单源超出预算(${Math.round(budgetLeft)}ms)`), { code: ERROR_CODES.NETWORK_TIMEOUT }));
          }, budgetLeft);
        }),
      ]);
      return { url, source: chain[0].id };
    } catch (e) {
      const code = extractErrorCode(e);
      const aggErr = new Error(`${chain[0].name}: ${e.message}`);
      aggErr.code = code;
      collectDetails.push({ source: chain[0].id, quality, code, reason: String((e && e.message) || "") });
      aggErr.detail = collectDetails;
      throw aggErr;
    } finally {
      if (singleTimer) clearTimeout(singleTimer);
    }
  }
  // v8.8：全链分批并发（不再"竞速3 + 串行 rest"）；batch 标签>1 的源（gdWy 配额源）排后批
  const primary = chain.filter(h => (h.batch || 1) === 1);
  const secondary = chain.filter(h => (h.batch || 1) > 1);
  const launchers = [...primary, ...secondary].map(h => ({
    handler: h,
    run: () => wrapExecute(h, platform, songInfo, quality).then(url => ({ url, source: h.id })),
  }));
  const batchSize = Math.min(cfg('raceBatchSize', 3), Math.max(primary.length, 1));
  const errors = [];
  const details = collectDetails;
  // v8.11.5：跨源聚合收口到 admit({stage:'fallback'})——按 CODE_RANK（交付类 3 > 业务类 2 > 网络类 1）
  // 取代旧 mergeCode「业务码一旦出现即固定」，避免 NOT_AUDIO 被 NOT_FOUND 吞成 1h 歌级锁。
  const attempts = [];
  const recordFail = (handlerId, q, err) => {
    const code = extractErrorCode(err);
    const evidence = (err && err.evidence) || "strong";
    attempts.push({ code, evidence, reason: String((err && err.message) || "") });
    details.push({ source: handlerId, quality: q, code, evidence, reason: String((err && err.message) || "") });
    errors.push(err.message);
  };
  try {
    const winner = await raceFirst(launchers, { batchSize, deadline });
    logDebug(`[竞速] ${platform} ${quality} 首胜: 源=${(winner && winner.source) || "unknown"}`);
    return winner;
  } catch (e) {
    if (e && e.allFailed && Array.isArray(e.errors)) {
      for (const err of e.errors) { recordFail(err.sourceId || "race", quality, err); }
    } else {
      recordFail("race", quality, e);
    }
  }
  const finalAdm = admit({ stage: "fallback", platform, quality, songInfo, attempts });
  const aggErr = new Error(errors.join("; "));
  aggErr.code = finalAdm.code || ERROR_CODES.NETWORK_ERROR; // 唯一代表码出口
  aggErr.detail = details; // v3.0：结构化失败明细
  aggErr.admission = finalAdm;
  throw aggErr;
}

// v1.0 P0-4：请求音质放首位，再按 QUALITY_PRIORITY 向下降级，截到≤3级；flac24bit/192k不再被短路
function buildQualityChain(requested) {
  const req = String(requested || "flac").toLowerCase();
  if (QUALITY_FIRST) {
    const chain = [req];
    const idx = QUALITY_PRIORITY.indexOf(req);
    if (idx >= 0) {
      // v8.11：末档强制 128k。旧实现用 `chain.length < 3` 截断，使 flac24bit 起只得到
      // [flac24bit, flac, 320k]，128k 永远走不到；而实测《八千里路明月照》恰恰只有 128k 档
      // 能拿到完整版（另两档同给同一个 5 秒片段）。同时 flac24bit 无任何源支持，第一档必空。
      const rest = QUALITY_PRIORITY.slice(idx + 1);
      // v8.11.2（N3 实测）：旧实现只拿 rest[0] 再补 128k，把中间档整段跳过——
      // flac24bit 起跑时链是 [flac24bit, flac, 128k]，320k 永远没被尝试过。
      // 现在按优先级逐档下降（末档天然是 128k，128k 保底仍在）。
      for (const q of rest) chain.push(q);
    } else {
      // 未知档位：只降到 128k 保底，避免无意义的多档尝试
      chain.push("128k");
    }
    return chain.filter((q, i) => chain.indexOf(q) === i);
  }
  const req2 = String(requested || "128k").toLowerCase();
  const idx2 = QUALITY_PRIORITY.indexOf(req2);
  const start = idx2 >= 0 ? idx2 : QUALITY_PRIORITY.length - 1;
  const chain = [];
  for (let i = start; i < QUALITY_PRIORITY.length; i++) {
    chain.push(QUALITY_PRIORITY[i]);
  }
  if (!chain.includes(req2)) chain.unshift(req2);
  return chain;
}

// v1.0：统一错误码提取——业务层抛错沿用"CODE: msg"前缀风格(e.code 未设置)，从 message 前缀还原 code，
// 供失败缓存差异化与决策日志使用；无前缀按网络错误处理(不缓存)
function extractErrorCode(e) {
  if (e && e.code) return e.code;
  const m = String((e && e.message) || "").match(/^([A-Z_]+):/);
  if (!m) return ERROR_CODES.NETWORK_ERROR;
  const prefix = m[1];
  // 前缀可能写成键名（PARAM_ERROR）也可能写成值（SONG_MISMATCH）——两种都要认，
  // 且一律返回「值」，与全仓 `=== ERROR_CODES.X` 的比较口径对齐（D-30）。
  if (ERROR_CODES[prefix]) return ERROR_CODES[prefix];
  const byValue = Object.keys(ERROR_CODES).find(k => ERROR_CODES[k] === prefix);
  return byValue ? ERROR_CODES[byValue] : ERROR_CODES.NETWORK_ERROR;
}

// v8.8：档位短路——某源某音质档历史 success=0 且失败样本达标，则该档直接跳过该源
//（典型：tx/mg/kg 的 flac 只有 suyinKuwo 单源，而它 flac 档是 oiapi VIP 死链，每次点 flac 都白试一次必败档）
// 防死锁：每 qualityShortCircuitProbeMs 放行一次真实探路，避免源恢复后永久被跳。
const qualitySkipProbeAt = new Map();
const qualityShortCircuitKey = (id, quality) => `${id}:${String(quality || "").toLowerCase()}`;
// v8.9：短路判据拆分为两类失败之和——fail（超时/5xx/连接错）+ linkExpired（410 死链）；
// 排除 businessFail（404 无版权/歌不存在/错歌）：无版权是歌的问题不是源的问题，连续 3 首无版权歌不该把源该档短路 6h。
// 同时保留 410：oiapi flac/320k 是 VIP 死链，恒 410 属"这一档拿不到"，必须能短路，否则 v8.8 第③条收益会被修没。
function isQualityHopeless(sourceId, quality) {
  const b = breakerMap.get(sourceId);
  if (!b || !b.byQuality) return false;
  const q = b.byQuality[String(quality)];
  if (!q) return false;
  if ((q.success || 0) > 0) return false;
  if (((q.fail || 0) + (q.linkExpired || 0)) < cfg('qualityShortCircuitSamples', 3)) return false;
  const key = qualityShortCircuitKey(sourceId, quality);
  const probeMs = cfg('qualityShortCircuitProbeMs', 21600000);
  if (!qualitySkipProbeAt.has(key)) { qualitySkipProbeAt.set(key, Date.now() + probeMs); return true; } // 首次达标即短路
  if (Date.now() >= qualitySkipProbeAt.get(key)) { qualitySkipProbeAt.set(key, Date.now() + probeMs); return false; } // 到期放行探路
  return true;
}

// v8.8：冷启动源预热——huibq 跑 onrender 免费实例，冷态 30s+ 远超单源超时(5s)，冷态必然失败；
// 首次进链时后台 fire-and-forget 预热（不阻塞、不计统计），实例热起来后下一次即可参与竞速。
const coldStartWarmAt = new Map();
function warmUpColdStartSources(platform) {
  for (const h of Object.values(SOURCE_HANDLERS)) {
    if (!h || !h.coldStart || runtimeToggles[h.id] !== true) continue;
    if (Date.now() - (coldStartWarmAt.get(h.id) || 0) < cfg('coldStartWarmTtlMs', 300000)) continue;
    if (!buildSourceChain(platform, "128k").some(x => x.id === h.id)) continue;
    coldStartWarmAt.set(h.id, Date.now());
    logDebug(`[预热] ${h.id} 冷启动预热已发出`);
    Promise.resolve()
      .then(() => h.fn("kw", "228908", "128k", { name: "晴天", singer: "周杰伦", duration: 269000, songmid: "228908" }))
      .catch(() => {});
  }
}

// v8.11.2（G4）：同歌同档并发合并。
// 旧行为：同歌同档 5 个并发请求 → 上游外呼 5 次（inflightCount 只是计数，没有去重）。
// 现在：相同 key 的并发请求共享第一个 Promise，上游只被真正打一次。
const inflightUrl = new Map();
const INFLIGHT_URL_MAX = 200; // 兜底：异常情况下不让这个 Map 无界增长

function buildInflightKey(platform, songInfo, quality) {
  const m = (songInfo && typeof songInfo === "object") ? songInfo : {};
  const id = m.songmid || m.hash || m.musicId || m.copyrightId || m.id || "";
  return `${platform}|${quality}|${id}|${m.name || ""}|${m.singer || ""}|${m.duration || 0}`;
}

async function getUrlWithFallback(platform, songInfo, quality) {
  if (!platform || typeof platform !== "string" || !PLATFORM_QUALITIES[platform]) {
    throw new Error(`${ERROR_CODES.PARAM_ERROR}: 无效的平台参数`);
  }
  if (!songInfo || typeof songInfo !== "object") {
    throw new Error(`${ERROR_CODES.PARAM_ERROR}: 无效的歌曲信息`);
  }

  let cacheKey = buildCacheKey(platform, songInfo, quality);

  // 1. 成功缓存命中（缓存值带实际音质）
  // v8.11.2（D-36，V30b 实测暴露）：缓存槽按**实交付音质**写（D-20 起），却按**请求音质**查——
  // 请求 128k 实给 flac 时，条目在 flac 槽、查询走 128k 槽，同一请求永不命中，每次都重新外呼
  // （全片段曲目更糟：每次都重跑三档再判失败）。与 D-32 兜底同理，按 QUALITY_PRIORITY
  // 找「不低于请求档」的条目；请求档槽本身优先级最高，先查它。
  let cached = getCachedUrl(cacheKey);
  if (!cached) {
    const reqQ36 = String(quality || "128k").toLowerCase();
    for (const eq of QUALITY_PRIORITY) {
      if (eq === reqQ36 || qualityRank(eq) < qualityRank(reqQ36)) continue;
      const k36 = buildCacheKey(platform, songInfo, eq);
      const c36 = getCachedUrl(k36);
      if (c36 && c36.url) {
        cached = c36;
        cacheKey = k36;
        logDebug(`[缓存跨档] ${songInfo?.name || ""} 请求[${reqQ36}]命中[${eq}]槽`);
        break;
      }
    }
  }
  const cachedSourceDisabled = !!(cached && cached.url && cached.source &&
    (runtimeToggles[cached.source] === false || manualOff[cached.source]));
  if (cachedSourceDisabled) {
    logInfo(`[缓存失效] ${songInfo?.name || ""} 缓存来自已关闭源 ${cached.source}，丢弃并重新解析`);
    successCache.delete(cacheKey);
  }
  if (cached && cached.url && !cachedSourceDisabled) {
    // v8.11：缓存命中必须同样验真——旧实现直接返回，导致 6 小时缓存里若存着 5 秒片段，
    // 即便判据修好了，用户照样听 5 秒。#4 期最容易被漏掉的一环
    let cacheOk = true;
    let realQ = "";   // T33：缓存命中同样要拿到真实档位，否则脏条目会一直把 128k 标成 flac
    if (cfg("verifyOnCacheHit", true)) {
      try {
        const v = await verifyDelivery(cached.url, { platform, handlerId: cached.source || "", quality, songInfo });
        if (v && v.ok === false) {
          cacheOk = false;
          logWarn(`[缓存校验] 内容不合格(${v.code})，清除该条并重新解析: ${songInfo?.name || ""} 音质[${quality || "128k"}]`);
        } else if (v && v.quality) {
          realQ = String(v.quality).toLowerCase();
        }
      } catch (e) {
        cacheOk = false;
        logDebug(`[缓存校验] 校验异常(${e.code || "?"})，清除该条: ${e.message}`);
      }
    }
    if (cacheOk) {
      // T33：验真已算出真实档位，就把它回填进标签与缓存——旧实现只信 cached.quality，
      // 历史脏条目（修复前按请求档写槽：请求 flac 实给 128k → 128k 存进 flac 槽）会
      // 一直显示 FLAC 直到 6h TTL 到期，属于"能纠正却不纠正"。
      const tagQ = realQ || cached.quality || "128k";
      const slotQ = String(cached.quality || "").toLowerCase();
      // 注意：这里**不写缓存**（M14：缓存写入只允许唯一入口、且必须在验真之后）。
      // 脏条目的槽位留给下一次正常写入修正；命中时每次都用验真结果纠正标签即可。
      if (realQ && slotQ && realQ !== slotQ) {
        logInfo(`[缓存回填] ${songInfo?.name || ""} 槽位[${cached.quality}]→实交付[${realQ}]，标签按真实档显示`);
      }
      return { url: cached.url, type: tagQ, subSource: cached.source || "", subSourceName: SOURCE_HANDLERS[cached.source]?.name || "", sourcePlatform: cached.platform || platform };
    }
    successCache.delete(cacheKey);
  }

  // 2. 失败缓存命中（v1.0：差异化 TTL——404→1h / 410→1min / 网络错误不缓存）
  const failKey = buildCacheKey(`fail_${platform}`, songInfo, quality);
  const failEntry = getFailCachedEntry(failKey);
  if (failEntry) {
    logDebug(`失败缓存命中[${platform}] ${songInfo?.name || ""} 音质${quality || "128k"}，跳过重复请求`);
    // v8.10.3：命中路径补 code —— 旧实现只抛文案，err.code 为 undefined，App 无法区分
    // "网络全挂的 30s 短缓存"与"真的没版权"；这里按缓存里的代表性失败码还原
    const cachedCode = failEntry.code || ERROR_CODES.NOT_FOUND;
    const hitErr = new Error(`${cachedCode}: 该请求已知失败(${failEntry.ttl === 0 ? "不缓存" : "缓存中"})，跳过重复请求`);
    hitErr.code = cachedCode;
    throw hitErr;
  }

  if (cfg('coldStartWarmEnabled', true)) warmUpColdStartSources(platform); // v8.8：冷启动源后台预热

  const errors = [];
  const details = []; // v3.0：结构化失败明细（跨音质级汇总，供 App 端展示）
  // v1.0：代表性失败码——业务码(NOT_FOUND/MISMATCH/LINK_EXPIRED)一旦出现即固定(稳定结论)，
  // 网络类码仅在没有业务码时记录；防止低音质级(128k)的网络错误覆盖高音质级的"歌不存在"
  // L4：改为收集 attempts，最后一次 admit 定代表码与 TTL——
  // 优先级「确定性业务码 < 交付类码 < 网络类码」，NOT_AUDIO 不再被 NOT_FOUND 吞掉。
  let lastFailCode = ERROR_CODES.NETWORK_ERROR;
  const attempts = [];
  const noteAttempt = (code, evidence) => {
    if (code) attempts.push({ code, evidence: evidence || "strong" });
  };

  // 3. 音质降级链（请求音质首位→向下降级；链内按源能力过滤，末级必有源）
  // v8.11：能力备档——该歌上次实际最高只拿到 128k 时，本轮直接从该档起，
  // 避免「用户设 flac 但某首只能 128k，每次都白跑 flac→320k 两档链」
  let effectiveQuality = quality || (QUALITY_FIRST ? "flac" : "128k");
  if (cfg("truthfulQuality", true)) {
    const ceiling = getQualityCeiling(platform, songInfo);
    if (ceiling && qualityRank(ceiling) < qualityRank(effectiveQuality)) {
      logDebug(`[${platform}] 能力备档命中: ${songInfo?.name || ""} 历史最高[${ceiling}]，本轮从该档起`);
      effectiveQuality = ceiling;
    }
  }
  const qualityChain = buildQualityChain(effectiveQuality);
  // v8.8：单次请求总预算（跨音质档共享）；v8.10：分档预算 + 最后一档保底（防高音质吃满总预算饿死低档）
  const totalDeadline = Date.now() + cfg('raceBudgetMs', 12000);
  const perQBudget = cfg('raceBudgetPerQuality', { flac: 6000, "320k": 5000, "128k": 5000, flac24bit: 6000 });
  for (let qi = 0; qi < qualityChain.length; qi++) {
    const q = qualityChain[qi];
    const isLast = qi === qualityChain.length - 1;
    const selectedQuality = q; // v1.0 (D10)：buildQualityChain 已产出具体音质，无需再选
    const chainAll = sortChainByHealth(buildSourceChain(platform, selectedQuality));
    let chain = cfg('qualityShortCircuit', true)
      ? chainAll.filter(h => !isQualityHopeless(h.id, selectedQuality))
      : chainAll;
    // v8.11：降档时跳过「已判定只给试听片段」的源，别在同一首歌上重复白等；
    // 128k 档例外——它是最后保底机会，永远保留（实测有歌只有 128k 能给完整版）
    if (cfg('qualityFloor', true) && selectedQuality !== "128k" && chain.length > 1) {
      const frag = getFragmentSources(platform, songInfo);
      if (frag.size) {
        const filtered = chain.filter(h => !frag.has(h.id));
        if (filtered.length && filtered.length !== chain.length) {
          logDebug(`[${platform}][${q}] 跳过已判片段源: ${chain.filter(h => frag.has(h.id)).map(h => h.id).join(",")}`);
          chain = filtered;
        }
      }
    }
    if (chainAll.length && !chain.length) {
      // 整条链该档历史 0 成功 → 档位短路，直接降档（省一次必败尝试）
      logDebug(`[${platform}][${q}] 档位短路：全部源该档历史 0 成功，直接降档`);
      errors.push(`[${q}] 档位短路(全部源该档历史0成功)`);
      details.push({ source: "quality-short-circuit", quality: q, code: ERROR_CODES.NETWORK_ERROR, reason: "全部源该档历史0成功，已短路降档" });
      noteAttempt(ERROR_CODES.NETWORK_ERROR, "weak");
      continue;
    }
    if (!chain.length) {
      errors.push(`[${q}] 无可用音源`);
      continue;
    }
    // v8.10.3：分档 deadline —— 单档 = min(该档预算, 剩余总预算)；
    // 末档保底 floor 允许突破总预算（否则前两档吃满预算时末档 0ms 必败 → 点歌无声），
    // 但上界显式钳在 "总预算 + 保底"，即默认 12s + 3s = 15s（与 PARAM_LIMITS 上限一致）
    const remaining = Math.max(totalDeadline - Date.now(), 0);
    const perQ = perQBudget[q] || cfg('raceBudgetMs', 12000);
    const floorMs = cfg('raceBudgetFloorMs', 3000);
    const qBudget = Math.min(perQ, remaining);
    const budget = isLast
      ? Math.min(Math.max(qBudget, floorMs), cfg('raceBudgetMs', 12000) + floorMs)
      : qBudget;
    const raceDeadline = Date.now() + budget;
    logDebug(`[${platform}][${q}] 音源链: ${chain.map(h => h.id).join(">")} (按健康排序)，预算 ${Math.round(raceDeadline - Date.now())}ms${isLast ? '（末档保底，可溢出总预算至' + Math.round((cfg('raceBudgetMs', 12000) + floorMs) / 1000) + 's）' : ''}`);
    try {
      const { url, source } = await fallbackRace(chain, platform, songInfo, selectedQuality, raceDeadline);
      // v8.10.3：缓存槽必须与"实交付音质"一致——旧实现用请求音质的 key 写实交付音质的值，
      // 导致请求 flac 实给 128k 时，这条 128k 被存进 flac 槽并按 128k 的 6h TTL 生效，
      // 6 小时内再点 flac 直接吃 128k、永不再试高音质
      const reqQ = String(quality || (QUALITY_FIRST ? "flac" : "128k")).toLowerCase();
      const deliverQ = String(selectedQuality || "128k").toLowerCase();
      // v8.11：标签回填真实音质——窗口里显示的必须是真话
      //（实测：请求 flac，溯音实给 3.19MB/199.4s = 128kbps mp3，旧实现仍标 FLAC）
      const truthQ = (cfg("truthfulQuality", true) && getDeliveryQuality(source, platform, songInfo, selectedQuality)) || deliverQ;
      const writeKey = truthQ === reqQ ? cacheKey : buildCacheKey(platform, songInfo, truthQ);
      setCachedUrl(writeKey, url, truthQ, source, platform); // v1.0：记录实际音质；v6.0：同存实际子源；v8.12：同存实际平台
      // v6.0：音质协商链降档日志（请求flac实际320k/128k时明示，配合 App 真实音质显示）
      if (truthQ !== reqQ) {
        logInfo(`[${platform}] ${songInfo?.name || ""} 音质协商降档: ${reqQ}→${truthQ}（按实交付档入缓存槽）`);
      }
      // v8.11：能力备档——实交付档低于请求档时，记下这首的真实上限，下轮直接从该档起跑
      if (cfg("truthfulQuality", true) && qualityRank(truthQ) < qualityRank(reqQ)) {
        noteQualityCeiling(platform, songInfo, truthQ);
      }
      return { url, type: truthQ, subSource: source || "", subSourceName: SOURCE_HANDLERS[source]?.name || "" };
    } catch (e) {
      noteAttempt(extractErrorCode(e), (e && e.evidence) || "strong"); // L4：收集 attempt，末尾统一裁决
      errors.push(`[${q}] ${e.message}`);
      // v3.0：透出结构化失败明细（fallbackRace 已结构化；旧路径兜底单条）
      if (e && Array.isArray(e.detail) && e.detail.length) {
        for (const d of e.detail) { details.push({ ...d }); noteAttempt(d.code, d.evidence); }
      } else {
        const c = extractErrorCode(e);
        details.push({ source: "chain", quality: q, code: c, reason: String((e && e.message) || "") });
        noteAttempt(c, (e && e.evidence) || "strong");
      }
    }
  }

  // 3.5 v8.11 全档片段兜底（用户拍板 B 方案）：所有源都只给试听片段时，宁可交付片段并明确标注
  // 「试听版」，也不要点歌没声——「没声」比「听到 5 秒并知道这是试听」更糟。该条不进 6h 成功缓存。
  // v8.11.1（二轮压测 S9 实测）：源级限流冷却期间该源直接被跳过（details 里没有 PREVIEW_FRAGMENT），
  // 旧条件会导致「连续片段歌触发冷却后，连片段都拿不到」，与「整站只有片段时给片段」的决策冲突。
  // 补一个零上游请求的通道：若该歌该档已记录过片段 URL，冷却期照样按 B 方案交付。
  // v8.11.4（F-01，云端真测暴露）：片段兜底只判「是不是 5 秒音频」，不判「是不是这首歌」。
  // 无 id/hash 时（歌名模糊检索、外部调用、脏数据）上游可能返回别人的片段，兜底会把它
  // 标成「试听版」交付 → 用户听到别人的 5 秒且无提示。片段兜底必须以「有 id 锚点」为前提，
  // 没有锚点就宁可报 NOT_FOUND，也不猜歌。
  const fragAnchor = getHashOrMid(songInfo);
  const hasFragDetail = !!fragAnchor && details.some(d => d.code === ERROR_CODES.PREVIEW_FRAGMENT);
  const hasFragCache = qualityChain.some(q =>
    fragmentUrlMap.has(`${platform}|${getHashOrMid(songInfo)}|${String(q || "").toLowerCase()}`));
  if (cfg("fragmentFallback", true) && fragAnchor && (hasFragDetail || hasFragCache)) {
    const frags = [];
    for (const q of qualityChain) {
      const k = `${platform}|${getHashOrMid(songInfo)}|${String(q || "").toLowerCase()}`;
      const f = fragmentUrlMap.get(k);
      if (f && Date.now() - (f.ts || 0) <= FRAGMENT_URL_TTL_MS) frags.push(f);
      else if (f) fragmentUrlMap.delete(k); // 过期签名直链不得兜底（否则用户听到死链）
    }
    const best = frags.sort((a, b) => qualityRank(b.quality) - qualityRank(a.quality))[0];
    if (best) {
      logWarn(`[全档片段] ${songInfo?.name || ""} 所有源都只给试听片段 → 按 B 方案交付片段并标注「试听版」（不设 6h 缓存）`);
      return {
        url: best.url,
        type: best.quality,
        subSource: best.source,
        subSourceName: `${best.name} · 试听版`,
      };
    }
  }

  // 4. 过期缓存兜底：仅当过期记录的实际音质不低于请求音质时才返回（防128k冒充flac）
  // v8.11.2（D-32）：原实现只查「请求档」槽，但槽位按**实交付音质**写（D-20），
  // 请求 128k 实给 flac 时条目在 flac 槽 → 兜底永远查不到。改为跨档查找、取不低于请求档的最优条目。
  let expired = null;
  if (successCache.hasExpired(cacheKey)) expired = successCache.getExpired(cacheKey);
  if (!expired) {
    for (const eq of QUALITY_PRIORITY) {
      if (qualityRank(eq) < qualityRank(quality)) continue;
      const ek = buildCacheKey(platform, songInfo, eq);
      if (!successCache.hasExpired(ek)) continue;
      const e = successCache.getExpired(ek);
      if (e && e.url) { expired = e; break; }
    }
  }
  if (expired) {
    if (expired && expired.url) {
      if (qualityRank(expired.quality || "128k") >= qualityRank(quality)) {
        logWarn(`全部音源失败，返回过期缓存兜底(缓存音质${expired.quality}, 请求${quality})`);
        return { url: expired.url, type: expired.quality || "128k", subSource: expired.source || "", subSourceName: SOURCE_HANDLERS[expired.source]?.name || "" };
      }
      logWarn(`过期缓存音质(${expired.quality})低于请求(${quality})，不兜底`);
    }
  }

  // 5. 记录失败缓存（v1.0：按代表性失败码差异化 TTL；网络错误不缓存，下次立即重试）
  // v6.0 (A3)：整链全失败且为网络类（上游整体不可用/超时/5xx）→ 写 30s 短失败缓存，
  // 避免同一首歌每次重播都在降级链里白跑 ≈18s；30s 后自动过期恢复重试（上游可能恢复）。
  // 业务类(NOT_FOUND等)维持原差异化 TTL。熔断不受影响——缓存过期后的重试仍会计入源失败。
  // L4：全链失败 → 唯一裁决。代表码按优先级（交付类码不被 NOT_FOUND 覆盖），TTL 由策略表给。
  const finalAdm = admit({ stage: "fallback", attempts });
  if (finalAdm.code) lastFailCode = finalAdm.code;
  const failTtl = finalAdm.ledger.ttlMs === 0 ? cfg('allFailShortTtlMs', 30000) : (finalAdm.ledger.ttlMs || FAIL_CACHE_TTL_MS);
  setFailCached(failKey, lastFailCode, failTtl);
  logDebug(`失败缓存写入[${platform}] code=${lastFailCode} ttl=${failTtl / 1000}s（evidence=${finalAdm.evidence}·${finalAdm.verdict}）`);
  // v7.0：失败逐源明细 logInfo——一次失败一屏看懂"哪些源、为什么失败"（供 App「音源日志」自查）
  if (details.length) {
    logInfo(`[失败明细] 平台=${platform} 歌=${songInfo?.name || ""} 音质=${quality || "128k"} 代表码=${lastFailCode}: ${details.map(d => `${d.source}=${d.code}(${String(d.reason || "").slice(0, 50)})`).join(" | ")}`);
  }
  // v8.10.3：文案前缀改用"代表性失败码"——旧实现固定写 NOT_FOUND，导致 code=NETWORK_TIMEOUT
  // 的错误读起来也像"这首歌不存在"（App 若按文案判类型会误判）
  const finalErr = new Error(`${lastFailCode}: 所有源均失败 [${errors.join(" | ")}]`);
  finalErr.code = lastFailCode; // v1.0：代表性失败码
  finalErr.detail = details; // v3.0：结构化失败明细（{source, quality, code, reason} 数组）
  throw finalErr;
}

// ============================================================
// v8.12：跨平台兜底（aggregate 语义的补齐）
// 目标：主平台确定性失败（无匹配/错歌/片段）立即去其他平台找同一首；超时类失败给
// 主平台一个 grace 窗口后再并行起跨平台。只有「歌名+歌手+时长」严格匹配才交付。
// 关键：目标平台 ID 必须重新解析（kw rid 不能喂给 tx 源），因此这里先搜索再跑目标链。
// ============================================================
const CROSS_FALLBACK_CACHE_MAX = 200;
const CROSS_FALLBACK_CACHE_TTL_MS = 10 * 60 * 1000;
const crossFallbackCache = new Map();

function crossCacheKey(platform, songInfo, quality) {
  return buildCacheKey(`cross_${platform}`, songInfo, quality);
}
function getCrossFallbackCached(platform, songInfo, quality) {
  const key = crossCacheKey(platform, songInfo, quality);
  const e = crossFallbackCache.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > CROSS_FALLBACK_CACHE_TTL_MS) { crossFallbackCache.delete(key); return null; }
  return e;
}
function setCrossFallbackCached(platform, songInfo, quality, result) {
  if (crossFallbackCache.size > CROSS_FALLBACK_CACHE_MAX) crossFallbackCache.clear();
  crossFallbackCache.set(crossCacheKey(platform, songInfo, quality), {
    ts: Date.now(),
    result,
  });
}
// 源开关唯一入口调用：关闭/开启子源后，10min 跨平台结果缓存必须同步失效，
// 否则「已关掉的源」仍会从缓存继续交付（U10 回归）。
function clearCrossFallbackCache() {
  crossFallbackCache.clear();
}

function parseJsonBody(body) {
  if (body && typeof body === "object") return body;
  if (typeof body !== "string") return {};
  try { return JSON.parse(body); } catch (e) { return {}; }
}

function normalizeQQCandidate(item) {
  if (!item) return null;
  const singer = Array.isArray(item.singer) ? item.singer.map(x => x?.name || "").filter(Boolean).join(" & ") : (item.singer || "");
  const mid = item.songmid || item.mid || "";
  if (!mid) return null;
  return {
    platform: "tx",
    id: mid,
    songmid: mid,
    name: item.songname || item.name || "",
    singer,
    album: item.albumname || item.album?.name || "",
    duration: normalizeDurationSec(item.interval || item.duration),
  };
}
function normalizeWYCandidate(item) {
  if (!item) return null;
  const id = item.id || item.songId || "";
  if (!id) return null;
  const singer = Array.isArray(item.artists) ? item.artists.map(x => x?.name || "").filter(Boolean).join(" & ") : (item.singer || item.artist || "");
  const album = item.album?.name || item.albumName || item.album || "";
  return {
    platform: "wy",
    id,
    songmid: id,
    name: item.name || item.songName || "",
    singer,
    album,
    duration: normalizeDurationSec(item.duration),
  };
}
function normalizeKWCandidate(item) {
  if (!item || !item.rid) return null;
  return {
    platform: "kw",
    id: item.rid,
    rid: item.rid,
    name: item.name || "",
    singer: item.singer || "",
    album: item.album || "",
    duration: normalizeDurationSec(item.duration),
  };
}

async function crossSearchPlatform(platform, songInfo) {
  const query = buildCrossSearchQuery(songInfo);
  if (!query) return [];
  const timeout = cfg("crossPlatformSearchTimeoutMs", 4000);
  if (platform === "tx") {
    const url = `${QQ_SEARCH_API}?w=${encodeURIComponent(query)}&format=json&n=10&p=1`;
    const res = await httpRequestWithRetry(url, {
      method: "GET",
      headers: { "Referer": "https://y.qq.com/", "User-Agent": getMobileUserAgent() },
      timeout,
    });
    const body = parseJsonBody(res.body);
    const list = body?.data?.song?.list || [];
    return list.map(normalizeQQCandidate).filter(Boolean);
  }
  if (platform === "wy") {
    const url = `${WY_SEARCH_API}?s=${encodeURIComponent(query)}&type=1&limit=10&offset=0`;
    const res = await httpRequestWithRetry(url, {
      method: "GET",
      headers: { "Referer": "https://music.163.com/", "User-Agent": getMobileUserAgent() },
      timeout,
    });
    const body = parseJsonBody(res.body);
    const list = body?.result?.songs || body?.songs || [];
    return list.map(normalizeWYCandidate).filter(Boolean);
  }
  if (platform === "kw") {
    const list = await kuwoOfficialSearch(query, 10);
    return list.map(normalizeKWCandidate).filter(Boolean);
  }
  return [];
}

function buildCrossTargetInfo(candidate, original, targetPlatform) {
  const info = {
    name: candidate.name || original.name,
    singer: candidate.singer || original.singer,
    albumName: candidate.album || original.albumName || original.album || "",
    duration: candidate.duration || original.duration,
    source: targetPlatform,
    // 只带目标平台自己的 ID；绝不把主平台 rid/hash 带过去（否则目标源必失败）
    meta: { crossPlatformFrom: original.source },
  };
  if (targetPlatform === "tx") info.songmid = candidate.songmid || candidate.id;
  if (targetPlatform === "wy") { info.id = candidate.id; info.songmid = candidate.songmid || candidate.id; }
  if (targetPlatform === "kw") { info.id = candidate.rid || candidate.id; info.rid = candidate.rid || candidate.id; }
  return info;
}

async function resolveCrossPlatformCandidate(platform, songInfo) {
  const list = await crossSearchPlatform(platform, songInfo);
  return pickCrossCandidate(list, songInfo);
}

function isDefinitiveNoMatch(err) {
  const code = extractErrorCode(err);
  return code === ERROR_CODES.NOT_FOUND || code === ERROR_CODES.MISMATCH || code === ERROR_CODES.PARAM_ERROR;
}

async function tryCrossPlatformFallback(primaryPlatform, songInfo, quality, primaryErr, traceId) {
  const targets = CROSS_PLATFORM_ORDER.filter(p => p !== primaryPlatform && PLATFORM_QUALITIES[p]);
  if (!targets.length) throw primaryErr || new Error(`${ERROR_CODES.NOT_FOUND}: 无跨平台目标`);
  let lastErr = null;
  let noCandidateCount = 0;
  let hadUncertain = false;
  for (const target of targets) {
    let candidate = null;
    try {
      candidate = await resolveCrossPlatformCandidate(target, songInfo);
    } catch (e) {
      lastErr = e;
      if (!isDefinitiveNoMatch(e)) hadUncertain = true;
      logDebug(`[跨平台] ${primaryPlatform}→${target} 搜索失败: ${e.code || "?"} ${e.message}`);
      continue;
    }
    if (!candidate) {
      noCandidateCount++;
      logDebug(`[跨平台] ${primaryPlatform}→${target} 无严格匹配候选`);
      continue;
    }
    const targetInfo = buildCrossTargetInfo(candidate, songInfo, target);
    logInfo(`[跨平台] ${primaryPlatform}→${target} 命中: ${candidate.name} / ${candidate.singer} / ${candidate.duration || "?"}s (${candidate.id})`);
    try {
      const r = await getUrlWithFallback(target, targetInfo, quality);
      return {
        ...r,
        sourcePlatform: target,
        fallback: { from: primaryPlatform, reason: extractErrorCode(primaryErr) || "FAILED", matched: candidate.id },
      };
    } catch (e) {
      lastErr = e;
      if (!isDefinitiveNoMatch(e)) hadUncertain = true;
      logDebug(`[跨平台] ${primaryPlatform}→${target} 目标链失败: ${e.code || "?"} ${e.message}`);
    }
  }
  const primaryCode = extractErrorCode(primaryErr);
  const primaryUncertain = primaryCode === ERROR_CODES.NETWORK_TIMEOUT ||
    primaryCode === ERROR_CODES.NETWORK_ERROR;
  const primaryCatalogMiss = primaryCode === ERROR_CODES.NOT_FOUND || primaryCode === ERROR_CODES.MISMATCH;
  // 只有主平台「曲库没有/同名错歌」才把跨平台无匹配写成 NOT_FOUND；
  // NOT_AUDIO/片段/限流/网络类必须保留原码，否则 App 的失败分类会被改写（实测 Q7 红）。
  if (primaryCatalogMiss && !primaryUncertain && noCandidateCount === targets.length && !hadUncertain) {
    const e = new Error(`${ERROR_CODES.NOT_FOUND}: 主平台${primaryCode || "失败"}，跨平台均无严格匹配（${targets.map(p => CROSS_PLATFORM_NAMES[p] || p).join("/")}）`);
    e.code = ERROR_CODES.NOT_FOUND;
    e.detail = [{ source: "cross-platform", code: ERROR_CODES.NOT_FOUND, reason: "无歌名+歌手+时长严格匹配" }];
    throw e;
  }
  throw primaryErr || lastErr || new Error(`${ERROR_CODES.NOT_FOUND}: 跨平台均失败`);
}

async function getUrlWithCrossPlatformFallback(platform, songInfo, quality, traceId) {
  if (!cfg("crossPlatformEnabled", true) || !songInfo?.name) {
    return getUrlWithFallback(platform, songInfo, quality);
  }
  const crossCached = getCrossFallbackCached(platform, songInfo, quality);
  if (crossCached) {
    logDebug(`[跨平台缓存] ${platform} ${songInfo?.name || ""} 命中 ${crossCached.result.sourcePlatform}，${CROSS_FALLBACK_CACHE_TTL_MS / 60000}min 内不再搜`);
    return { ...crossCached.result };
  }
  return new Promise((resolve, reject) => {
    let settled = false;
    let fallbackStarted = false;
    let fallbackDone = false;
    let fallbackErr = null;
    let primaryErr = null;
    let timer = null;
    const failKey = buildCacheKey(`fail_${platform}`, songInfo, quality);

    const settleOk = (r) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve(r);
    };
    const settleErr = (e) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      reject(e);
    };
    const startFallback = (reason) => {
      if (settled || fallbackStarted) return;
      fallbackStarted = true;
      recordHealthEvent({
        event: "cross_platform", traceId, platform: "multi", quality,
        ok: false, code: "START", reason: clipText(reason || "FAILED", 40),
      });
      tryCrossPlatformFallback(platform, songInfo, quality, primaryErr, traceId).then(r => {
        if (settled) return;
        // 主平台失败缓存立刻清掉：跨平台已经证明这首歌可交付，不能让 1h/30s 的
        // 「已知失败」把下一次播放继续挡在主平台失败分支里。
        failCache.delete(failKey);
        setCrossFallbackCached(platform, songInfo, quality, r);
        recordHealthEvent({
          event: "cross_platform", traceId, platform: r.sourcePlatform, sourceId: r.subSource,
          quality, ok: true, code: "", reason: clipText(`${platform}->${r.sourcePlatform}`, 40), latencyMs: 0,
        });
        logInfo(`[跨平台] ${platform} 失败(${extractErrorCode(primaryErr) || "?"}) → ${r.sourcePlatform} 交付 ${r.subSource || ""}，已清主平台失败缓存`);
        settleOk(r);
      }).catch(e => {
        if (settled) return;
        fallbackDone = true;
        fallbackErr = e;
        recordHealthEvent({
          event: "cross_platform", traceId, platform: "multi", quality,
          ok: false, code: extractErrorCode(e) || ERROR_CODES.NOT_FOUND,
          reason: clipText(`${platform}->all`, 40),
        });
        // 主平台还没返回时，跨平台先失败不能替主平台判死：
        // 主平台可能只是慢（例如取链 6s+ 但最终成功）。等 primaryTask 自己收口。
        if (primaryErr) settleErr(e);
      });
    };

    const primaryTask = getUrlWithFallback(platform, songInfo, quality);
    primaryTask.then(r => {
      if (settled) return;
      settleOk({ ...r, sourcePlatform: r.sourcePlatform || platform });
    }).catch(e => {
      primaryErr = e;
      // 失败缓存命中：这首歌刚刚已经被判定失败（可能正是上一次跨平台也失败后写的），
      // 不能再搜一次跨平台，否则失败缓存等于没缓存（实测 T6 会多打 2~4 次外呼）。
      if (/该请求已知失败/.test(String(e && e.message || ""))) {
        settleErr(e);
        return;
      }
      // 预算耗尽（竞速总预算/单档预算）是内部性能保护，不是「平台没这首歌」；
      // 再起跨平台搜索只会把总时长拖长（实测 T43 会从 2s 级拖到 16s）。直接保留原码。
      if (/预算耗尽|超出预算/.test(String(e && e.message || ""))) {
        settleErr(e);
        return;
      }
      // 本地保护态：源级限流冷却、熔断中、并发/限速跳过——这些不是「平台没歌」，
      // 跨平台会绕过本地保护（实测 C9a 冷却被绕过、L1/L4 熔断期仍外呼）。
      if (/源级限流|冷却中|已熔断|并发\/限速保护/.test(String(e && e.message || ""))) {
        settleErr(e);
        return;
      }
      // 所有源都网络失败（ENOTFOUND/ECONNREFUSED/ETIMEDOUT/ECONNRESET 汇总成 NETWORK_ERROR）
      // 时，再搜跨平台只会把已有的预算上界突破（实测 E4 14s→22s、I3 1.5s→6.4s、L1 熔断被绕过）。
      const code = extractErrorCode(e);
      if (code === ERROR_CODES.NETWORK_ERROR ||
        /ECONNRESET|ENOTFOUND|ETIMEDOUT|ECONNREFUSED|EAI_AGAIN/i.test(String(code || "") + " " + String(e && e.message || ""))) {
        settleErr(e);
        return;
      }
      // 只有「超时/主链尚未返回」才等 grace；其余确定性结论立即跨平台。
      // 尤其 NOT_AUDIO / 片段：上游已明确给出不可用内容，再等 6s 只会白等
      // （实测 V1e/V12a 会因等待期间跨平台抢跑而把原错误码改写成 NOT_FOUND）。
      startFallback(code);
      // 跨平台已经先失败、现在主平台也失败 → 此时才允许整体失败。
      if (fallbackDone && fallbackErr) settleErr(fallbackErr);
    });
    const graceMs = Math.max(0, Number(cfg("crossPlatformGraceMs", 6000)) || 0);
    timer = setTimeout(() => {
      if (!settled) startFallback(primaryErr ? extractErrorCode(primaryErr) : "PRIMARY_SLOW");
    }, graceMs);
  });
}


// ============================================================
// 第八部分：音源配置上报 + 事件监听（洛雪官方协议）
// ============================================================
const sourceConfig = {};
const PLATFORM_NAMES = {
  wy: "网易云音乐", tx: "QQ音乐", kw: "酷我音乐", kg: "酷狗音乐", mg: "咪咕音乐"
};
Object.keys(PLATFORM_QUALITIES).forEach(platform => {
  // v3.0：歌词/封面按平台真实能力声明（App fork 声明即注册 getLyric/getPic）——
  // wy: 歌词+封面（网易云公开接口实测可用）；kw: 封面（搜索 hts_MVPIC 实测可用）；
  // tx/kg/mg: 无稳定接口不声明，App 自动走内置源兜底
  const actions = ["musicUrl"];
  if (platform === "wy") actions.push("lyric", "pic");
  else if (platform === "kw") actions.push("pic");
  actions.push("health"); // v4.0：健康快照 action（App fork 声明即注册 getHealth，与平台无关的聚合查询）
  actions.push("toggle", "probe"); // v4.0：源级开关 + 手动探测 action（App fork 声明即注册，健康面板「管」能力）
  actions.push("config"); // v8.0：配置热更新 action（App 设置页读写 USER_CONFIG 内存值，免重载音源）
  actions.push("trend"); // v8.0：健康趋势 action（返回历史健康快照数组，App 折线图展示）
  actions.push("healthEvents"); // 2.4：只读事件环形缓冲（本地排障；不记歌名/URL）
  sourceConfig[platform] = {
    name: PLATFORM_NAMES[platform],
    type: "music",
    actions,
    qualitys: REPORT_QUALITIES[platform] || ["128k"], // v1.0 P0-6：按真实能力裁剪
    // P1：显式声明换源所有权。本脚本内部已有跨平台兜底（tx→wy→kw），
    // 声明 source 后 App 不再重复搜索其他平台，避免同一平台被两层各搜一次。
    fallbackOwner: "source"
  };
});

on(EVENT_NAMES.request, ({ action, source, info }) => {
  // 2.4：只读事件环形缓冲（App 健康页/导出诊断包消费；不提供任何写能力）
  if (action === "healthEvents") {
    return Promise.resolve(getHealthEvents(info || {}));
  }
  // v4.0：健康快照 action（聚合查询，与请求的 source 无关）
  if (action === "health") {
    return Promise.resolve(getHealthSnapshot());
  }
  // v4.0：源级开关（手动启用/停用某子源；停用写入 manualOff 锁定，探测不再自动复活；启用清除锁定并清休眠立即纳入探测）
  if (action === "toggle") {
    try {
      return Promise.resolve(toggleSource(info?.id, info?.enabled !== false));
    } catch (e) {
      return Promise.reject(e);
    }
  }
  // v4.0：手动触发一轮健康探测（并发 ~6s；探测中返回 running:true 不排队）
  // v30.1：手动探测不存历史快照（避免污染趋势图）
  if (action === "probe") {
    if (probeState.running) {
      return Promise.resolve({ running: true });
    }
    return runHealthCheck(false).then(() => ({
      running: false,
      doneAt: Date.now(),
      round: globalThis.__probeRound || 0,
      active: Object.keys(runtimeToggles).filter(k => runtimeToggles[k]),
      sleeping: Object.keys(probeState.sleeping).filter(k => probeState.sleeping[k])
    })).catch(err => Promise.reject(err));
  }
  // v8.0：配置热更新 action（App 设置页读写 USER_CONFIG 内存值，免重载音源）
  // 无参数调用：返回当前所有配置项（只读）
  // 带参数调用（{key: value}）：更新内存中的配置值，立即生效
  if (action === "config") {
    if (!info || Object.keys(info).length === 0) {
      // 读模式：返回当前配置（过滤掉敏感的卡密类字段）
      const { ikunApiKey, lingchuanApiKey, xinghaiDeviceId, ...safeConfig } = USER_CONFIG;
      return Promise.resolve({
        ...safeConfig,
        ikunApiKey: ikunApiKey ? "***已设置***" : "",
        lingchuanApiKey: lingchuanApiKey ? "***已设置***" : "",
        xinghaiDeviceId: xinghaiDeviceId ? "***已设置***" : ""
      });
    }
    // 写模式：更新内存配置（仅允许白名单字段，防止乱改）
    // v8.11.7：数字键补齐 v8.10~v8.11 新增可调参数；布尔键单独白名单（B 方案，App 健康页可开关）
    const ALLOWED_KEYS = ["cacheTtlMs", "cacheTtlHighQualityMs", "failCacheNotFoundMs", "failCacheExpiredMs",
      "breakerThreshold", "breakerCooldownMs", "rateLimitBackoffMs",
      "maxConcurrency", "rateWindowMs", "rateWindowMax",
      "healthCheckIntervalMs", "raceMatchWaitMs", "raceBudgetMs", "raceBudgetFloorMs",
      "raceBatchSize", "raceBatchStaggerMs", "coldStartTimeoutMs", "coldStartProbeTimeoutMs",
      "coldStartWarmTtlMs", "qualityShortCircuitSamples", "qualityShortCircuitProbeMs",
      "verifyTimeoutMs", "verifyMinOriginalSec", "verifyDurRatio", "verifyDurGapSec",
      "allFailShortTtlMs", "playDeadReviveMs", "memoryMapMax"];
    const ALLOWED_BOOL_KEYS = ["verifyDelivery", "truthfulQuality", "qualityFloor", "verifyOnCacheHit",
      "previewUrlPreFilter", "fragmentFallback", "qualityShortCircuit", "coldStartWarmEnabled",
      "crossPlatformEnabled"];
    // v8.11.7：这两个阈值 0 是合法值（0=不设比例/间隔门槛），不能被 <=0 校验吞掉
    const ZERO_ALLOWED_KEYS = ["verifyDurRatio", "verifyDurGapSec"];
    // v30.1：每个参数的合理上下限（防极端值触发上游风控/雪崩）
    const PARAM_LIMITS = {
      cacheTtlMs: { max: 7 * 24 * 3600 * 1000 },        // 最大 7 天
      cacheTtlHighQualityMs: { max: 7 * 24 * 3600 * 1000 }, // 高音质缓存上限 7 天
      failCacheNotFoundMs: { max: 24 * 3600 * 1000 },   // 最大 1 天
      failCacheExpiredMs: { max: 3600 * 1000 },         // 最大 1 小时
      breakerThreshold: { max: 20 },                      // 最大 20 次
      breakerCooldownMs: { max: 30 * 60 * 1000 },       // 最大 30 分钟
      rateLimitBackoffMs: { max: 5 * 60 * 1000 },       // 最大 5 分钟
      maxConcurrency: { max: 5 },                          // 最大 5（单源并发，太大触发风控）
      rateWindowMs: { max: 10 * 1000 },                  // 最大 10 秒
      rateWindowMax: { max: 20 },                         // 最大 20 次
      healthCheckIntervalMs: { min: 60 * 1000 },        // 最小 1 分钟（防频繁探测）
      raceBudgetMs: { max: 15 * 1000 },                     // v8.10.3：总预算（死键 raceOverallTimeoutMs 已移除，唯一真相）
      raceBudgetFloorMs: { max: 15 * 1000 },            // 末档保底不得超过总预算上限
      raceBatchSize: { max: 10 },                         // 每批并发源数
      raceBatchStaggerMs: { max: 2000 },                // 批间错峰
      raceMatchWaitMs: { max: 5 * 1000 },               // 最大 5 秒
      coldStartTimeoutMs: { max: 30 * 1000 },           // 冷启动单源超时
      coldStartProbeTimeoutMs: { max: 60 * 1000 },      // 冷启动探针超时
      coldStartWarmTtlMs: { max: 60 * 60 * 1000 },      // 预热间隔上限 1 小时
      qualityShortCircuitSamples: { max: 20 },          // 档位短路样本门槛
      qualityShortCircuitProbeMs: { max: 24 * 3600 * 1000 }, // 短路放行探路间隔上限 1 天
      verifyTimeoutMs: { min: 500, max: 10 * 1000 },    // 验真 Range 超时
      verifyMinOriginalSec: { max: 3600 },              // 原曲短于此不按比例判
      verifyDurRatio: { max: 1 },                       // 真实时长/原曲 比例上限
      verifyDurGapSec: { max: 300 },                    // 绝对差上限
      memoryMapMax: { min: 1, max: 20000 },              // 五轮 MEM：记忆表条数上限（默认 2000）
      allFailShortTtlMs: { max: 10 * 60 * 1000 },       // 最大 10 分钟
      playDeadReviveMs: { max: 2 * 3600 * 1000 },       // 最大 2 小时
    };
    const updated = {};
    for (const [key, value] of Object.entries(info)) {
      if (ALLOWED_BOOL_KEYS.includes(key)) {
        if (typeof value !== "boolean") continue;
        USER_CONFIG[key] = value;
        updated[key] = value;
        continue;
      }
      if (!ALLOWED_KEYS.includes(key)) continue;
      if (typeof value !== "number" || !Number.isFinite(value)) continue;  // 五轮 EDGE：NaN 会绕过下面三条比较
      if (value < 0 || (value === 0 && !ZERO_ALLOWED_KEYS.includes(key))) continue;
      // v30.1：上下限校验
      const limits = PARAM_LIMITS[key];
      if (limits) {
        if (limits.min !== undefined && value < limits.min) continue;
        if (limits.max !== undefined && value > limits.max) continue;
      }
      USER_CONFIG[key] = value;
      updated[key] = value;
    }
    logInfo(`[config] 热更新配置：${JSON.stringify(updated)}`);
    if (Object.keys(updated).length) recordHealthEvent({ event: "config_change", reason: "config", code: Object.keys(updated).join(",") });
    // v30.1：修改熔断阈值后，重置所有源的 failureCount——避免"突然熔断"
    // （阈值从 3 改成 1 后，已累计 2 次失败的源下一次失败不会立即熔断）
    if (updated.breakerThreshold !== undefined) {
      for (const [, b] of breakerMap) {
        b.failureCount = 0;
      }
      logInfo(`[config] 熔断阈值已更新，所有源失败计数已重置`);
    }
    // v30.1：修改缓存 TTL 后，清空所有缓存——让新 TTL 立即生效
    if (updated.cacheTtlMs !== undefined) {
      successCache.clear();
      logInfo(`[config] 缓存 TTL 已更新，成功缓存已清空`);
    }
    // v30.1：返回 current 也脱敏（和读模式一致）
    const { ikunApiKey, lingchuanApiKey, xinghaiDeviceId, ...safeConfig } = USER_CONFIG;
    return Promise.resolve({
      updated,
      current: {
        ...safeConfig,
        ikunApiKey: ikunApiKey ? "***已设置***" : "",
        lingchuanApiKey: lingchuanApiKey ? "***已设置***" : "",
        xinghaiDeviceId: xinghaiDeviceId ? "***已设置***" : ""
      }
    });
  }
  // v8.0：健康趋势 action（返回历史健康快照数组，App 折线图展示）
  if (action === "trend") {
    return Promise.resolve({
      history: healthHistory,
      maxPoints: HEALTH_HISTORY_MAX
    });
  }
  // v3.0：歌词/封面 action（App fork userApi 已支持；失败 App 自动走内置源兜底）
  if (action === "lyric") {
    return getLyricForPlatform(source, info?.musicInfo).catch(err => Promise.reject(normalizeErrCode(err, ERROR_CODES.NOT_FOUND)));
  }
  if (action === "pic") {
    return getPicForPlatform(source, info?.musicInfo).catch(err => Promise.reject(normalizeErrCode(err)));
  }
  if (action !== "musicUrl") {
    return Promise.reject(new Error(`${ERROR_CODES.PARAM_ERROR}: action not support`));
  }
  if (!info?.musicInfo) {
    const paramErr = new Error(`${ERROR_CODES.PARAM_ERROR}: 请求参数不完整`);
    paramErr.code = ERROR_CODES.PARAM_ERROR;
    return Promise.reject(paramErr);
  }
  const quality = info.type || (QUALITY_FIRST ? "flac" : "128k");
  const traceId = clipText(info.traceId, 64) || `src_${Date.now().toString(36)}_${healthEventSeq + 1}`;
  attachHealthTrace(info.musicInfo, traceId);
  recordHealthEvent({ event: "play_start", traceId, platform: source, quality });
  const key = buildInflightKey(source, info.musicInfo, quality);
  if (inflightUrl.size > INFLIGHT_URL_MAX) inflightUrl.clear();
  const prev = inflightUrl.get(key);
  if (prev) {
    logDebug(`[并发合并] ${key} 复用在途请求`);
    return prev;
  }
  const task = getUrlWithCrossPlatformFallback(source, info.musicInfo, quality, traceId)
    .catch(err => Promise.reject(normalizeErrCode(err)));
  inflightUrl.set(key, task);
  const done = () => { if (inflightUrl.get(key) === task) inflightUrl.delete(key); };
  task.then(done, done);
  return task;
});

send(EVENT_NAMES.inited, {
  status: true,
  openDevTools: false,
  // P2：显式声明桥媒体信封能力；App 只对该脚本的二进制请求启用 base64 信封
  mediaEnvelope: 2,
  sources: sourceConfig
});

// v4.0.1：发版通知（updateAlert）已停用——每次加载/导入都弹更新提示过于打扰，
// 用户选择关闭（App 端「允许显示更新弹窗」勾选与否都不再弹；版本信息看 logInfo/Release）
//
logInfo(`豆包定制聚合音源 v8.12.3 已加载（P2 桥媒体信封（2026-11-12：App 二进制响应改 base64 信封 + 256KB 分片；toBytes 识别 __lxMedia:2 并按片独立解码，byteLength 不符拒绝；X1~X7 先红后绿））｜v8.12.2（P1 降级所有权：inited 声明 fallbackOwner=source，App 对声明源不再重复换源）｜v8.12.1（跨平台缓存失效：关源清 10min 跨平台缓存 + 已关源成功缓存失效；面板暴露 crossPlatformEnabled；u-cross-platform 10 条）｜v8.12.0（跨平台兜底：主平台无原版/错歌/超时按 tx→wy→kw 严格匹配换平台）｜v8.11.7（健康面板配置可管：布尔开关 8 个 + 数字参数补齐，K4c~K4e 先红后绿）｜v8.11.6（收尾加固：链过滤分层 + 源开关对称清账 + fallback 代表码 codeRank + HEAD 补证）｜v8.11.5（L4 裁决层：admit 单一入口 + 策略表 + 三调用点，L0 桥产物归一，clearSourceLedger 统一清账）｜v8.11.4（源开关失败缓存失效（2026-11-10：toggle 开启按平台前缀清 fail 缓存 + LRU 补 keys()，q-dfix Q3 先红后绿）｜v8.11.2 通读缺陷修复（2026-11-10：Juhe code 类型归一/303 校验宽松比/flac24bit 起跑补齐 320k/CONFIG_ERROR 5 分钟过期/删恒假守卫）；v8.11.1 交付真实性闸门（2026-11-08：①交付前 1KB 字节验真——FLAC STREAMINFO / MP3 Xing 解析真实时长，「能播但只有 5 秒」的试听片段不再被当 FLAC 交付，阈值 60%+15s 双条件；②音质标签回填真话——请求 flac 实得 128kbps mp3 时窗口改显示 128K；③降档链修复 128k 终档被截断；④缓存双入口验真 + 移除 helloworld 内层缓存，缓存里的片段不再绕过判据；⑤源级限流识别——同源三档全片段判定被风控，冷却 5 分钟转跨平台；⑥巡检同判据——probe 片段判定 + 日报片段率单列；⑦压力测试固化 test/stress-test.js（G1~G8 / 32 断言）并据此修三处：JSON 错误体不再被「拿不准放行」放过、源级限流冷却改为跨歌证据（单曲受限不再误伤同源其他歌）、片段直链兜底加 10 分钟 TTL 防过期签名；冒烟 60→67 组）；v8.10.12：v8.10.4：可播校验错误码修复（2026-11-08：超时/网络异常不再判死链，改抛 NETWORK 码走 180s 熔断；三处 LINK_EXPIRED 抛错补 err.code，使 410 真正计入 linkExpired 与 1min 失败缓存；冒烟 55 增至 57 组，T56/T57 均已 red-green 验证；v8.10.3：全覆盖审计修复（2026-11-07：15 项隐性缺陷——①probeSingleSource 形参 cfg 遮蔽全局 cfg()，huibq（唯一冷启动源）探针 100% TypeError、请求从未发出、健康分恒负垫底休眠；②429 不再计入 byQuality.fail/成功率分母（旧实现 3 次限流把该档短路 1h），半开遇 429 收口回 open；③降档交付按实交付音质入缓存槽（旧实现请求 flac 实给 128k 却存进 flac 槽，6h 内不再试高音质）；④失败缓存命中还原代表性 code（旧实现 code 丢失，网络全挂被当歌不存在）；⑤平台分组改由竞速链生成（旧手写清单漏 suyinKuwo，wy/tx/mg/kg 只剩它活着时误报全挂）；⑥探针通过一并复位断路器/限流退避（旧实现只清休眠，出现「探针正常 + 熔断中」矛盾态）；⑦末端预算上界显式钳在总预算+保底；⑧validateUrl 返回 trim 后 URL；⑨320k/128k 单档预算 4s→5s 对齐单源超时（旧 4s 把 5s 内本可成功的源判死并累计熔断）；⑩删死键 raceOverallTimeoutMs、面板改暴露真键 raceBudgetMs；⑪huibq 假成功判据单点化并补进探针；⑫lingchuan 补 platforms 显式声明；⑬A19 备注 20→144；⑭冒烟新增 T50–T55（回退必红）共 55 组）；v8.10.2：修 validateUrl 与 recordSuccess 顺序——旧顺序把"URL 非法"既记成功又记业务失败(双记账)，现改为先验后记；并补齐半开试探收口(业务失败/本地节流也要 half-open→open，否则该源永久不被调用)；v8.10.1：分档预算 flac6s/320k4s/128k4s + 末档保底3s 防点歌无声、冷启动探针30s超时+豁免自动关 防onrender冷态误摘、短路窗口6h→1h、高音质缓存分级TTL flac/320k30min、历史快照60→144，冒烟48组；v8.10.1：修缓存 LRU 缺 delete（高音质缓存过期重播 TypeError）+ T46/T47/T48 改真验证；v8.9：huibq平台能力收窄至kw/wy + 短路判据拆分(fail+linkExpired，404不误伤/410仍短路) + source-audit --strict退出码；v8.8：竞速引擎改造——全链分批错峰并发/跨档12s总预算/档位短路/冷启动预热/gdWy降批/verified精确等待；v8.7：huibq假成功治理——上游"无法获取播放链接"仍返回 code=0 + 可播错链，按 msg 失败词判失败；v8.6：huibq默认开启——全平台全音质实测可用、进五平台链尾兜底、探针自动托管；v8.5：巡检工具与监控口径升级——scripts/source-audit.js + docs/SOURCE_AUDIT.md 基线、probe.js 取链可播二次校验、huibq 探针；v8.4：全源全接口深度巡检修复——suyinKuwo 128k br=9、xinghaiBackend 匿名调用适配，可用源 15→21/35；v8.3：ikun默认开启——公益版免卡密默认进 kw 链尾兜底、探测自动托管/失败自动关/恢复自动开；v8.2：ikun探针接入——默认关闭源补齐健康探针，手动开启后自动监控健康（POST /music/url 固定歌 + Range 可播校验）；v8.1：ikun源复活——域名 api.ikunshare.com→c.wwwweb.top、接口 GET /url→POST /music/url、公益版免卡密，2026-11-06实测 rid=228908 出真实128k链；v8.0：全量审计修复版——2026-11-05 版本重新整理，原 v1.0~v8.0 共53个小版本合并为8个大版本；旧版本归档见 docs/ARCHIVE_OLD_TAGS.md），上报 ${Object.keys(sourceConfig).length} 个音源；v4.0 health action(App健康面板)；v3.0歌词/封面透出；v3.0失败原因结构化+健康自愈；v2.0配置化(USER_CONFIG)；保留v1.0星海kw高音质双源+防错歌加固`);

// 启动健康探测（全自动自愈）
startHealthCheck();

// v3.0：测试导出块——宿主动态执行无 module，自动跳过；冒烟测试 require 后可断言纯函数
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    computeHealthScore,
    // v4.0：UA 池轮换（供测试/巡检验证轮换生效）
    getMobileUserAgent,
    sortChainByHealth,
    buildSourceChain,
    getUrlWithFallback,
    getBreaker,
    recordSuccess,
    recordFailure,
    recordBusinessFail, // v8.10.2：导出供测试断言半开收口
    ERROR_CODES,
    QUALITY_PRIORITY,
    // v3.0：探测巡检增强（分级轮次 + 休眠复活 + 配置构建）
    tierShouldProbe,
    applyProbeResult,
    buildProbeConfig, // v6.0：导出供测试断言探测清单过滤（关闭源不探测/自愈闭环保留）
    SOURCE_HANDLERS, // v8.8：导出供测试断言源标签（batch/coldStart）
    probeState,
    runtimeToggles,
    SOURCE_TOGGLES, // v8.6：导出供测试/巡检断言各源默认开关状态（A 方案默认开启源必须可见）
    // v3.0：健康统计快照（App 健康面板/巡检消费）
    getHealthSnapshot
  };
  // 测试钩子（非枚举）：压测需要验证「纯判据」语义（如音质短路到期放行、
  // 单源探针超时），而端到端外呼层会被冷却/摘除/失败缓存多层叠加干扰（实测无法隔离）。
  // 非枚举可避免影响导出面断言；不暴露任何写能力给外部调用方。
  Object.defineProperty(module.exports, "__debug", {
    value: Object.freeze({
      isQualityHopeless,
      qualitySkipProbeAt,
      probeSingleSource,
      sniffAudioBytes,
      // L4：L0 形态归一 + 单一判定（纯函数，供 r-admission 断言）
      toBytes,
      kindOf,
      // L4 裁决层：唯一裁决入口 + 读侧查询 + 清账；probe 供桥模拟直接驱动
      admit,
      skipReason,
      clearSourceLedger,
      probeAudioDelivery,
      probeByHeaders,
      verifyDelivery,      // K14：medium 尺寸比分支需要直接驱动
      applyAdmission,      // K14：reducer 的 PASS/记账分支
      trialMarkOf,
      ADMISSION_POLICY,
      admissionLedger,
      suyinKuwoSearch,   // 供测试验证 D-31
      // v8.11.2（覆盖率补测）：健康巡检主流程 L572-626 整段此前零覆盖——runHealthCheck 未导出，
      // 只能从定时器间接触发（初始延迟 60s），测试无法稳定驱动。此处只读导出（healthHistory 返回副本）。
      runHealthCheck,
      recordHealthEvent,   // 2.4 压测：注入事件验证容量/白名单（只读 action 不暴露写口）
      getHealthEvents,
      get healthHistory() { return healthHistory.slice(); },
      suyinKuwoGetUrl,   // 供测试验证 D-31 端到端：兜底档日志是否落
      setCachedUrl,      // 供测试构造脏缓存（复现"槽位是 flac、内容是 128k"的历史条目）
      buildCacheKey,
      breakerMap,
      recordRateLimit,   // D-04 回归：半开态遇 429 必须收口回 open（否则永久卡死）
      playDeadStreak,
      toggleSource,
      get playDeadDeadline() { return playDeadDeadline; },
      qualityShortCircuitKey,
      buildQualityChain,          // N3（F12）：降档链构造，只读
      buildSourceChain,           // v8.11.5 收尾：链过滤与 skipReason 同源回归
      runtimeToggles,             // v8.11.5 收尾：断言内临时开/关源（用完还原）
      fallbackRace,               // D-08：单链分支硬上限回归（可传入只含 1 个源的自造链）
      cfg,                        // D-05/D-06：配置白名单与布尔键 `??` 语义（只读求值，不改值）
      setFailCached,              // N4（F10）：构造失败缓存条目
      getFailCachedEntry,         // N4（F10）：读取时按 TTL 判过期
      get failCache() { return failCache; },   // N4：只用于把 ts 往前挪，模拟 5 分钟流逝
    }),
    enumerable: false,
  });
}
