# WebFetch 最终排名索引

核验日期：**2026-11-06**。当前没有核验到同时满足“独立、商业供应商广覆盖、正文质量、完整可复现”的统一总榜。

本页按测量对象索引外部结果，**不把抓取成功率当成 Markdown 质量，不自行生成综合分**。

| 来源                         | 数据日期／规模                         | 索引用途                                           | 来源整理                                              |
| ---------------------------- | -------------------------------------- | -------------------------------------------------- | ----------------------------------------------------- |
| Proxyway Scraping API Report | 2025-10 测试；11 家、15 个目标网站     | 第三方可达率、延迟、成本对照；无可核验统一数字总榜 | [方法与商业关系披露](sources/proxyway.md)             |
| String Web Data Frontier     | 2026-10-30；17 家、100 URL、8,500 请求 | 可复核的可达率分榜；厂商自办，非独立质量榜         | [原始 JSON、方法与限制](sources/web-data-frontier.md) |
| SIGIR 2023 WCEB              | 2023；8 个标注数据集                   | 静态 HTML 正文抽取算法研究，不给商业抓取 API 排名  | [论文及代码](sources/wceb.md)                         |
| WebMainBench                 | 7,809 页；545 页精细 Markdown 标注子集 | 静态 HTML 抽取质量参考，不给商业抓取 API 排名      | [数据及方法](sources/webmainbench.md)                 |

## 可达率分榜：String 原始结果

**这是参评供应商 String 自办的榜单，不是独立推荐顺序或总体内容质量排名。** 此处保留原榜名次，仅因其提供可核验的逐次结果。第三方对照 Proxyway 未提供可核验的统一数字总榜，不据其文字结论制造第二套总分。

来源：[原始榜单](https://github.com/usestring/web-data-frontier-benchmark)及[日期固定的原始 JSON](https://github.com/usestring/web-data-frontier-benchmark/blob/main/official_results/benchmark-2026-10-30T18-48-18-489Z.json)。每家 100 个目标各请求 5 次；通过条件为 HTTP `2xx` 且返回体包含预期文本。

| 原榜名次 | 原始供应商 ID | 本项目 WebFetch ID | 成功率 | 通过／请求 |
| -------- | ------------- | ------------------ | ------ | ---------- |
| 1        | `string`      | 未注册             | 98.6%  | 493/500    |
| 2        | `scrapedo`    | 未注册             | 94.0%  | 470/500    |
| 3        | `context_dev` | 未注册             | 93.0%  | 465/500    |
| 4        | `scrapfly`    | `scrapfly`         | 86.8%  | 434/500    |
| 5        | `scrapingbee` | `scrapingbee`      | 85.2%  | 426/500    |
| 6        | `firecrawl`   | `firecrawl`        | 81.2%  | 406/500    |
| 7        | `zyte`        | 未注册             | 79.6%  | 398/500    |
| 8        | `apify`       | `apify`            | 79.4%  | 397/500    |
| 9        | `scraperapi`  | 未注册             | 76.4%  | 382/500    |
| 10       | `bright`      | `brightdata`       | 75.4%  | 377/500    |
| 11       | `decodo`      | 未注册             | 71.2%  | 356/500    |
| 12       | `nimble`      | 未注册             | 68.0%  | 340/500    |
| 13       | `oxylabs`     | 未注册             | 67.4%  | 337/500    |
| 14       | `browserbase` | 未注册             | 43.0%  | 215/500    |
| 15       | `zenrows`     | 未注册             | 41.8%  | 209/500    |
| 16       | `scrapingant` | `scrapingant`      | 40.0%  | 200/500    |
| 17       | `scrapingdog` | 未注册             | 27.6%  | 138/500    |

项目 ID 仅作品牌关联，不保证原榜 API、套餐、渲染策略与本项目适配器一致。`bright` 对应 Bright Data 品牌；本项目的 Nimble 仅注册于 WebSearch，不能算 WebFetch 已支持。

## 项目覆盖与未排名项

当前 WebFetch 注册 **18 家外部供应商＋`native`**。String 分榜与其中 **6/18** 品牌重合；Proxyway 的参评品牌与其中 **3/18** 重合（Apify、Firecrawl、ScrapingBee）。两者不是完整覆盖。

以下提供商未取得可用于本页分榜的公开可比成绩，不给零分、不补排末位：

| 项目 ID        | 状态                                       |
| -------------- | ------------------------------------------ |
| `tavily`       | 未排名                                     |
| `parallel`     | 未排名                                     |
| `you`          | 未排名                                     |
| `exa`          | 未排名                                     |
| `hyperbrowser` | 未排名                                     |
| `tinyfish`     | 未排名                                     |
| `jina`         | 未排名                                     |
| `diffbot`      | 未排名                                     |
| `linkup`       | 未排名                                     |
| `deepseek`     | 未排名                                     |
| `bocha`        | 未排名                                     |
| `zhipu`        | 未排名                                     |
| `native`       | 本地实现，未在这些来源中按本库实现独立测评 |

## 正文质量与权重边界

WCEB、WebMainBench 有标注参考和客观指标，但不包含本项目商业抓取供应商的完整链路排名；不拿抽取算法名次替代 API 名次。

此页不修改代码中的权重。后续引用权重时也不能把上述成功率称为综合质量分，或为未排名供应商自行估分。旧 Jev 结果仅保留于[历史记录](legacy-jev.md)，不纳入本索引。
