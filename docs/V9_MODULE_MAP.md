# v9.0 模块迁移地图（引用闭包静态分析）

> 由 `node scripts/ref-closure.js --write` 生成，随代码变动需重跑。
> 口径：剥离注释后的**词频级**引用，虚报方向是多算、漏报方向是动态字符串访问。

顶层定义 3 个 / legacy 1321 行 / 已拆公共层 33 个模块

## 枢纽（入度最高，迁移风险最大）
| 定义 | 行数 | 被引用 | 引用别人 | 用公共层 |
|---|---|---|---|---|
| `SUYIN_163_API` | 1 | 1 | 0 | - |
| `suyin163GetUrl` | 17 | 0 | 1 | RETRY_TIMES/httpGet |
| `PROVIDER_CONTRACT` | 1 | 0 | 0 | validateProviderContracts |

## 叶子（出度 0，共 2 个，迁移零连带）
- `SUYIN_163_API`（1 行，被引用 1）
- `PROVIDER_CONTRACT`（1 行，被引用 0）

## 近叶子（出度 ≤2，共 1 个，候选批次主体）
- `suyin163GetUrl`（17 行，引用 SUYIN_163_API）
