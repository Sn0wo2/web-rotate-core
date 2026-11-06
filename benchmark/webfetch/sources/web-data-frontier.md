# 来源整理：String Web Data Frontier Benchmark

## 原始来源与时间

- 发布者：String，同时是参评供应商，**属于厂商自办评测**；其原榜排名第一。
- [原始仓库、榜单与说明](https://github.com/usestring/web-data-frontier-benchmark)，MIT 许可。
- [日期固定的原始结果 JSON](https://github.com/usestring/web-data-frontier-benchmark/blob/main/official_results/benchmark-2026-10-30T18-48-18-489Z.json)
- [原始结果直接下载](https://raw.githubusercontent.com/usestring/web-data-frontier-benchmark/main/official_results/benchmark-2026-10-30T18-48-18-489Z.json)
- [评分代码](https://github.com/usestring/web-data-frontier-benchmark/blob/main/src/check.ts)、[执行代码](https://github.com/usestring/web-data-frontier-benchmark/blob/main/src/runner.ts)、[目标及预期文本](https://github.com/usestring/web-data-frontier-benchmark/blob/main/src/tests.const.ts)
- 结果时间：**2026-10-30T18:48:18.489Z**。
- 本次核验：**2026-11-06**，README、代码及原始 JSON 均成功读取；原始 JSON HTTP 200。

## 测量对象与方法

测量受反爬保护网页的获取能力，不测主内容完整度、噪声、表格结构或 Markdown 可用性。

来源原文：

> a request **passes** when the API returns a `2xx` status **and** the response body contains the page's expected text.

- 100 个固定 URL，覆盖 16 个行业。
- 每家每个 URL 请求 5 次；17 家共 8,500 次请求。
- 默认并发 2，单次超时 90 秒。
- 供应商：string、scrapedo、context_dev、scrapfly、scrapingbee、firecrawl、zyte、apify、scraperapi、bright、decodo、nimble、oxylabs、browserbase、zenrows、scrapingant、scrapingdog。
- 每个目标有 `containsText` 检查，避免仅以 HTTP 200 当成功，但不能由一个预期文本片段推断正文完整或干净。

## 原始数据核验

本次下载 JSON 后重新汇总公开的逐次 `attempts[].success`，只验证原站统计，没有自行制定评分规则或补跑供应商请求。

| 检查项                 | 核验结果 |
| ---------------------- | -------- |
| 供应商数               | 17       |
| 每家目标数             | 100      |
| 每目标尝试数           | 5        |
| 每家请求数             | 500      |
| 总请求数               | 8,500    |
| 逐次成功数与每家汇总值 | 全部一致 |

原始 JSON 保留逐次成功标记、延迟及错误，但不包含全部成功页面正文，不能据此独立复核每个页面的内容质量。完整成功率及原榜名次见[最终索引](../README.md)。

## 延迟口径

原站 Latency score 不是简单的全局平均或全局 p75：先按目标取成功尝试的 nearest-rank p75，再在目标之间等权平均。某供应商在目标上全失败时，使用其他成功供应商在该目标上的分数 p75 填充；全部失败才使用 90 秒。

因此最终索引不把该延迟分数混入成功率，也不将其当作本项目实测延迟。

## 利益冲突与采用边界

目标由发布者选择，发布者自身排名第一；不同产品的默认套餐、服务端升级及渲染行为不一定完全可比。Massive 因账户未及时开通未参评，不能视为零分。

优点是代码、目标及逐次结果公开。限制是发布方有直接商业利益，成功判定也不测正文质量。仅保留为**可达率分榜**，不称作独立权威总榜，不直接用其名次推荐所有 WebFetch 产品。
