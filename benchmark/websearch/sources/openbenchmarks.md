# 来源整理：OpenBenchmarks Company News

## 原始来源与时间

- [原始榜单与方法](https://openbenchmarks.com/company-news)
- [当前页面链接的代码仓库](https://github.com/openbenchmarks-labs/company-news)
- [公开数据子集](https://huggingface.co/datasets/openbenchmarks/OB-News-Websearch)
- 来源标示：300 个问题、21 个端点，最近测量 **2026-10-21**。
- 本次核验：**2026-11-06**，榜单 HTTP 200。

## 方法摘要

每个端点使用同一问题发起一次查询，最多 10 条结果，只根据标题及摘要提取答案，不额外抓取网页。人工预先确定标准答案；提取模型为 gpt-5.6-terra，评分模型为 claude-opus-5，经 Amazon Bedrock 调用。

代码公开，但公开数据仅为 300 题中的 100 题，省略来源 URL；页面说明该子集成绩不能与私有 300 题榜单比较。端点数量也不等于供应商数量。

## 暂不采用排名

本次核验时，页面显著警告：

> Issue · bias found · fix in progress

并明确当前结果：

> should not be used to compare vendors

原因是供应商测量时间不同，较晚测量者有更多时间索引新闻，导致分数受到索引时间混杂影响。

因此[最终索引](../README.md)仅记录该来源，不转录其成绩作为有效排名。修复及同批次重测前，不用其更大的端点数量弥补 AA 的缺分；也不把自称独立当作已验证的运营及资助独立性。
