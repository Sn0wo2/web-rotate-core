# 来源整理：Proxyway Web Scraping API Report 2025

## 原始来源与时间

- 发布者：Proxyway，第三方行业评测媒体，不据联盟营销关系推断其为参评厂商所有。
- [原始报告](https://proxyway.com/research/web-scraping-api-report-2025)
- [Research 索引](https://proxyway.com/research)
- 来源说明大部分测试完成于 **2025-10**。
- 本次核验：**2026-11-06**，报告 HTTP 200；Research 索引仍链接此抓取 API 报告。索引中的 2026 Proxy Market Report 是代理市场报告，不等于新版抓取 API 报告。

## 商业关系披露

原页明确说明：

> We use affiliate links. They let us sustain ourselves at no cost to you.

多数供应商经主动联系后提供测试权限；Firecrawl、ZenRows 由评测方购买。因此它是有商业关系披露的第三方评测，不应称完全无利益冲突的实验室，也没有证据将它归为某参评厂商自办榜。

## 范围与方法

- 11 家：Apify、Crawlbase、Decodo、Firecrawl、NetNut、Nimble、Oxylabs、ScraperAPI、ScrapingBee、ZenRows、Zyte。
- 15 个目标网站：Allegro、Amazon、ChatGPT、G2、Google、Hyatt、Immobilienscout24、Instagram、Leboncoin、Lowe's、Nordstrom、Shein、Walmart、YouTube、Zillow。
- 每目标约 6,000 个不同 URL；测试负载为每秒 2 次及 10 次请求，超时 600 秒。
- 通过响应状态、页面大小和标题等启发式判断成功，部分目标额外检查 CSS 选择器。
- 按目标启用渲染或高级解锁选项，不能假定等于本库默认调用参数。

这测量可达率、响应时间与成本，不是正文逐字完整度、噪声或 Markdown 结构质量；页面类别和反爬差异也影响结果。

## 可引用的结果与不可生成的排名

原页 `Summary`、`Benchmark Results` 等部分包含成功率、响应时间、分目标／负载图表、难目标分析和成本对比。

本次可读取内容中**没有取得一张可核验的供应商统一数字总榜**，嵌入图表也未暴露完整逐供应商原始数值。编辑性的推荐、某项“最快”或“最便宜”文字，不转换为综合名次。

本次未找到公开的逐次响应数据、完整目标列表及可复现评分脚本。因此[最终索引](../README.md)将它用于第三方方向性对照，不擅自从图表或文字结论合成分数，也不与 String 的不同样本、年份及超时设置混算。

参评品牌与本项目 WebFetch 重合的只有 Apify、Firecrawl、ScrapingBee；Nimble 在本项目仅有 WebSearch 实现。
