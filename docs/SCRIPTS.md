# 脚本索引（scripts/）

> 14 个脚本 + 3 个 git hook。**改任何脚本前先看「副作用」列**——有的会改文件、有的会起定时器、有的会打网络。
> 单一真相原则：端点清单只认 `endpoint-registry.js`，开关只认 `source-toggles.js`，日期只认 `cn-date.js`。别在别的脚本里再抄一份。

## 一、巡检与健康（会打网络）

| 脚本 | 职责 | 触发 | 副作用 |
|---|---|---|---|
| `probe.js` (734) | 端点存活巡检：HTTP 探测 + 取链型端点做 Range 可播二次校验；输出 README 可用性表 | 手动 / CI dispatch | **改** `README.md`、`README_HEALTH.md`、追加 `docs/probe-history.jsonl` |
| `health-daily.js` (352) | 健康日报：变化检测 + 分级 + 动作出口，产出 `docs/health-daily/<日期>.md/.json` | CI 每日 | 新增当日日报文件；不碰 README |
| `source-audit.js` (155) | 全源全接口深度巡检（比 probe 更细，逐源逐档真实取链） | 手动 | 只打日志，跑完自动 `process.exit` |
| `candidate-audit.js` (342) | 新候选源实证半自动化：mock 加载 + 静态提取 + 报告草案 | 手动 | 产出报告草案（不写仓库文件） |
| `recheck-candidates.js` (146) | 判否候选恢复探测，**改** `docs/candidate-status.md` | CI 每日 | 覆写 candidate-status |
| `ecosystem-scan.js` (147) | 抓 pdone 生态健康表，交叉验证本仓源状态 | CI 每周 | 只打日志 |
| `health-alert.js` (66) | 读当日 `<date>.json` 生成 GitHub Issue 正文 | 被 health-daily 调用 | 无 |

## 二、门禁与文档一致性（不联网）

| 脚本 | 职责 | 触发 | 副作用 |
|---|---|---|---|
| `self-check.js` (109) | 发布自检门 L2：`@version` ↔ logInfo 串、各平台 actions 声明、README/ROADMAP 三向同步 | 手动 / CI | 只读 + 报错退出 |
| `docs-audit.js` (356) | 文档一致性 L4：21 条规则，可自动修数字 | CI 每日 / `--dry-run` | **默认会改文档**；`--dry-run` 只报告 |
| `doc-sync-map.js` (110) | 改动文件 → 必同步文档清单（hook 用） | commit 时 hook | 无（被 hook 调用） |

## 三、单一真相模块（被其他脚本 require）

| 脚本 | 职责 | 关键出口 |
|---|---|---|
| `endpoint-registry.js` (86) | 20 条端点登记表（探测与巡检的唯一来源） | `ENDPOINTS` |
| `source-toggles.js` (124) | 解析 `SOURCE_TOGGLES` 真值（health-daily 与 probe 共用） | `getToggles()` |
| `cn-date.js` (17) | 北京日期（CI cron 是 UTC，直接 `new Date()` 会差一天） | `today()` |

## 四、git hooks（`scripts/hooks/`）

| hook | 行为 |
|---|---|
| `prepare-commit-msg` (13) | 调 `doc-sync-map.js`，改脚本/测试却无文档更新 → 提示并 `exit 1` |
| `commit-msg` (7) | 校验提交信息格式 |
| `pre-push` (16) | 推送前跑轻量门禁 |
| `install-hooks.sh` (8) | 设置 `core.hooksPath=scripts/hooks` |

## 五、常用命令

```bash
node scripts/probe.js                    # 全端点探测（会改 README，pull 前先 git checkout -- 这三个文件）
node scripts/probe.js --selftest-duration # 时长解析自检 4/4，不联网
node scripts/health-daily.js             # 生成当日健康日报
node scripts/self-check.js               # 发布前自检
node scripts/docs-audit.js --dry-run     # 文档一致性只读检查
node scripts/docs-audit.js               # 自动修数字（改完记得 git diff）
```
