'use strict';

/**
 * 北京日期（Asia/Shanghai）——巡检链路的**单一真相**。
 *
 * 为什么需要它：CI 的 cron 是 `0 20 * * *`（UTC），换算成北京是**次日 04:00**。
 * 只要任何一处用 `toISOString().slice(0,10)`（UTC）算"今天"，日报的"当天"就永远
 * 比实际北京日期早一天 —— 表现就是"日报里今天一行数据都没有"。
 *
 * 历史：v8.10.5 修 F01 时只改了 probe.js 的本地实现，health-daily 的默认参数漏了；
 * 现统一收敛到本模块，避免再次分叉。
 */
function todayCN() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date());
}

module.exports = { todayCN };
