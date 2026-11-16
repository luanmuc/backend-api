# 脚本索引（scripts/）

> 21 个脚本 + 4 个 git hook 相关文件。**改任何脚本前先看「副作用」列**——有的会改文件、有的会起定时器、有的会打网络。
> 单一真相原则：端点清单只认 `endpoint-registry.js`，开关只认 `source-toggles.js`，日期只认 `cn-date.js`。别在别的脚本里再抄一份。
> v8.15.1 起本文件纳入 `docs-audit.js` 规则 22：脚本数、每个脚本行数、幽灵条目都会被门禁校验（登记不全直接报红）。

## 一、构建与产物（决定交付物）

| 脚本 | 职责 | 触发 | 副作用 |
|---|---|---|---|
| `build-source.js` (55) | 单文件产物构建：`src/*.js` → esbuild IIFE + CommonJS 桥，写 `lx-source.js`，并校验产物 IIFE 形态与 `@version` 一致性 | `npm run build` / 发布前 | **改** `lx-source.js`（唯一权威产物） |
| `verify-bundle.js` (105) | 产物门禁 B1~B8：版本头、契约 12/10/2、逐源一致、五平台链可重建、取消 API、退役源不在产物、体积/行数上限；**dist/ 不存在时先就地重建再校验**（干净检出也能跑） | `npm run verify:bundle` / CI | 缺产物会写 dist/ |
| `source-inventory.js` (112) | 源清单预算：12/10/2（登记/上链/观察）+ 退役 8 源不得回产物 + 观察源默认关闭、必须有 `reviewAt`、不得占链位 | `npm run inventory` / CI | 只读 + 报错退出 |
| `dump-chain.js` (75) | 链序 golden 生成：10 个 active 源 × 5 平台 × 4 音质，写 `test/fixtures/chain-golden.json`（`sourceHead` 读真实 HEAD，不写死） | 链序变更后手动 `--json` | **改** `test/fixtures/chain-golden.json` |

## 二、巡检与健康（会打网络）

| 脚本 | 职责 | 触发 | 副作用 |
|---|---|---|---|
| `probe.js` (774) | 端点存活巡检：HTTP 探测 + 取链型端点做 Range 可播二次校验（`PAYLOAD_CHECKS`）+ mp3/flac 时长自检；输出 README 可用性表 | 手动 / CI dispatch | **改** `README.md`、`README_HEALTH.md`、追加 `docs/probe-history.jsonl` |
| `health-daily.js` (470) | 健康日报：变化检测 + 分级 + 动作出口，产出 `docs/health-daily/<日期>.md/.json`（90 天清理） | CI 每日 | 新增当日日报文件；不碰 README |
| `pull-device-digests.js` (77) | 拉取公开仓 `lx-telemetry` 的真机摘要，写 `docs/device-digests.jsonl`（60 天滚动），供日报做 CI vs 真机对照 | CI 每日（日报前）；手动 | **覆写** `docs/device-digests.jsonl`；只读网络 |
| `chain-sample.js` (74) | 每日出链抽样：调用 `source-audit.js --quick`，对**启用中的源**各测 1 首固定样例（128k），补「端点活着 ≠ 能出链」 | CI 每日（probe 之后）；手动 | **追加** `docs/chain-sample.jsonl`（同日同源覆盖、30 天滚动） |
| `source-audit.js` (212) | 全源全接口深度巡检（比 probe 更细，逐源逐档真实取链 + Range 校验），`--include-probation` / `--strict` | 手动 | 只打日志 |
| `candidate-audit.js` (342) | 新候选源实证半自动化：mock 加载 + 静态提取 + 报告草案 | 手动 | 产出报告草案（不写仓库文件） |
| `recheck-candidates.js` (190) | 判否候选恢复探测，**改** `docs/candidate-status.md` | CI 每日 | 覆写 candidate-status |
| `ecosystem-scan.js` (165) | 抓 pdone 生态健康表，交叉验证本仓源状态（源列表由产物导出面读取，v8.15.1 起不再依赖正则） | CI 每周 | 只打日志 |
| `health-alert.js` (73) | 读当日 `<date>.json` 生成 GitHub Issue 正文 | 被 health-daily 调用 | 无 |
| `verify-real-platforms.js` (76) | 真实 HTTP 宿主加载 `lx-source.js`，逐平台调 `musicUrl`，输出 `sourcePlatform/subSource/host`；`--all` / `--without-suyin` 用于区分兜底链 | 手动 | 只打日志，不写仓库文件 |
| `verify-real-platform-chains.js` (103) | G7 真实平台 ID 链：先走 QQ/网易搜索拿 `songmid/id`，再隔离 `juheTx` / `wyOuter` 调 `musicUrl`，输出输入 ID、实际平台、子源、`subSourceName`、`trial`、host 与失败码 | 手动 | 只打日志，不写仓库文件 |

## 三、门禁与文档一致性（不联网）

| 脚本 | 职责 | 触发 | 副作用 |
|---|---|---|---|
| `self-check.js` (116) | 发布自检门 L2：`@version` ↔ logInfo 串、各平台 actions 声明、README/ROADMAP 三向同步 | 手动 / CI | 只读 + 报错退出 |
| `docs-audit.js` (488) | 文档一致性 L4：22 条规则，可自动修数字/版本/行数/脚本清单 | CI 每日 / `--dry-run` | **默认会改文档**；`--dry-run` 只报告 |
| `doc-sync-map.js` (111) | 改动文件 → 必同步文档清单（hook 用），`--check` 硬触发拦截 | commit 时 hook | 无（被 hook 调用） |

## 四、单一真相模块（被其他脚本 require）

| 脚本 | 职责 | 关键出口 |
|---|---|---|
| `endpoint-registry.js` (75) | 16 条端点登记表（源端点 13 + 工具端点 3，探测与巡检的唯一来源） | `ENDPOINTS`/`urls`/`sourcesOf`/`EXCLUDE_DOMAINS` |
| `source-toggles.js` (125) | 单遍字符扫描解析 `SOURCE_TOGGLES` 真值（health-daily 与 probe 共用） | `parseToggles`/`stripLineComment`/`matchBrace` |
| `cn-date.js` (17) | 北京日期（CI cron 是 UTC，直接 `new Date()` 会差一天） | `todayCN` |

## 五、git hooks（`scripts/hooks/`）

| hook | 行为 |
|---|---|
| `prepare-commit-msg` (13) | 调 `doc-sync-map.js`，改脚本/测试却无文档更新 → 提示并 `exit 1` |
| `commit-msg` (7) | 校验提交信息格式 |
| `pre-push` (16) | 推送前跑轻量门禁 |
| `install-hooks.sh` (8) | 设置 `core.hooksPath=scripts/hooks` |

## 六、require 安全约定（v8.15.1 起为门禁项）

除显式标注为纯 CLI 的脚本外，`scripts/*.js` 被 `require` 时**不得**写文件、打网络、`process.exit`。
入口一律写 `if (require.main === module) main();`，纯 CLI 脚本（`health-alert.js`）在被 require 时首行 return。
`test/audit/g-meta.js` 的 M9b 会逐个 require 全部脚本并断言「加载后仍能继续执行」，缩进的 `process.exit` 与顶层 `main()` 都会被抓出来。M9c 再补静态面：顶层 `require` 外部包（如 `esbuild`）必须惰性加载、顶层 `require` 指向未入库的 `dist/` 产物必须进 `main()`——这两类只在 CI 干净检出里才炸（`npm ci --ignore-scripts` 无 esbuild 二进制、`dist/` 不在库里），本地有产物时 M9b 照样绿。

## 七、常用命令

```bash
node scripts/build-source.js             # 重建 lx-source.js（改 src/ 后必跑）
node scripts/verify-bundle.js            # 产物门禁 B1~B8
node scripts/source-inventory.js         # 源预算 12/10/2 与退役源检查
node scripts/probe.js                    # 全端点探测（会改 README，pull 前先 git checkout -- 这三个文件）
node scripts/probe.js --selftest-duration # 时长解析自检 4/4，不联网
node scripts/health-daily.js             # 生成当日健康日报
node scripts/self-check.js               # 发布前自检
node scripts/docs-audit.js --dry-run     # 文档一致性只读检查
node scripts/docs-audit.js               # 自动修数字（改完记得 git diff）
node scripts/dump-chain.js --json        # 链序变更后重生成 golden
```
