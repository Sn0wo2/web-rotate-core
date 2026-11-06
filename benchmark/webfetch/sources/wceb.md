# 来源整理：SIGIR 2023 Web Content Extraction Benchmark

## 原始来源与时间

- 论文：_An Empirical Comparison of Web Content Extraction Algorithms_。
- 作者：Janek Bevendorff、Sanket Gupta、Johannes Kiesel、Benno Stein。
- [ACM SIGIR 2023 论文](https://doi.org/10.1145/3539618.3591920)，出版日期 **2023-07-18**。
- [原始代码、数据与结果](https://github.com/chatnoir-eu/web-content-extraction-benchmark)
- [Crossref 出版信息](https://api.crossref.org/works/10.1145/3539618.3591920)
- 本次核验：**2026-11-06**，Crossref 与仓库 README API 均 HTTP 200。

## 方法与可复现材料

这是一项网页主内容抽取算法的可复现比较研究，将 8 个已有标注数据集合并为统一格式。

- `datasets/combined.tar.xz`：统一格式的数据。
- `outputs/model-outputs`：原研究抽取输出的压缩包。
- `wceb` CLI：执行抽取、评分及聚合。
- 指标：ROUGE-LSum、Levenshtein；不是依据本项目编写的 LLM 评分规则。

## 采用边界

学术发表、标注数据、代码及原始抽取结果使其适合评估**静态 HTML 的正文提取／去模板算法**。

它不衡量实时网络可达率、反爬绕过或 JavaScript 渲染，也不是 Firecrawl、Tavily、Exa、Jina 等商业 WebFetch API 的供应商总榜。不能把算法结果套到使用不同抓取及清理管线的 API 上。

因此[最终索引](../README.md)仅将它列为正文抽取研究参考，不用它填补商业供应商名次。其研究时间也不能冒充 2026 年的实时 API 测试。
