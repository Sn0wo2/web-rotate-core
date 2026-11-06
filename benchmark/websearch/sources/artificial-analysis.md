# 来源整理：Artificial Analysis Search Index

## 原始来源与时间

- 发布者：Artificial Analysis，第三方商业评测机构，不是本项目或参评搜索供应商自建榜。
- [原始榜单](https://artificialanalysis.ai/agents/search-api)
- [原始方法及 Search Provider API Settings](https://artificialanalysis.ai/methodology/search-api)
- 来源标示的数据日期：**2026-10-19**。
- 本次核验：**2026-11-06**，榜单及方法页均 HTTP 200。

来源原文：

> We benchmark 26 Search API products across 14 providers

这是产品配置数量，不是厂商数量。方法表能核验全部 26 个配置；本次公开榜表只能读取 12 个 API 配置的成绩及 1 个无搜索基线，不为其余配置补分。

## 评测口径

| 任务           | 样本数 | 指标                                              |
| -------------- | ------ | ------------------------------------------------- |
| DeepSearchQA   | 900    | 答案项 F1，LLM 评分                               |
| BrowseComp     | 200    | 从 1,266 题中选出的困难子集，LLM 判定短答案正确性 |
| AA-Omniscience | 600    | 私有留出集，6 个领域各 100 题，LLM 判定准确率     |

Search Index 是上述三个指标的等权均值，以 0–100 展示。直接引用原站指数，不从已取整的分项再次计算。

- 回答模型与评分模型：GPT-5.6 Luna（medium）。
- 第三方搜索流程使用 Stirrup；每题最多 25 个 agent turns，每次搜索展示最多 10 个结果。
- `web_search` 返回供应商原生响应，`web_fetch` 获取结果网页文本；启用污染过滤。
- **OpenAI 例外**：通过 Responses API 使用原生 `web_search`，不走 Stirrup 或同样的回合预算，不能简单声称所有产品执行流程完全相同。
- 成本包含搜索调用与回答模型成本；页面的每千任务成本不是每千次 API 调用单价。

## 原始配置范围

| 供应商     | 方法表中的配置                                          | 数量 |
| ---------- | ------------------------------------------------------- | ---- |
| Brave      | web；LLM context                                        | 2    |
| DeepSeek   | summary，`need_content=false`                           | 1    |
| Exa        | lite＋dynamic highlights；auto＋dynamic highlights      | 2    |
| Firecrawl  | Search，`scrape_format=none`                            | 1    |
| Keenable   | pro；realtime                                           | 2    |
| Linkup     | flash alpha；fast；standard，`outputType=searchResults` | 3    |
| Nimble     | lite；standard，`full_content=false`                    | 2    |
| Octen      | highlights，`safesearch=off`，`language=["en"]`         | 1    |
| OpenAI     | Web Search，`search_context_size=medium`                | 1    |
| Parallel   | turbo；fast；basic；advanced                            | 4    |
| Perplexity | low；medium；high                                       | 3    |
| Tavily     | basic                                                   | 1    |
| TinyFish   | web                                                     | 1    |
| You.com    | snippets；highlights                                    | 2    |
| 合计       | 14 家供应商                                             | 26   |

## 可核验成绩的分项

下列行沿用公开表顺序，三项分数按原站展示值记录。它们不是完整配置榜，也不包含显著性结论。

| 配置                         | Search Index | DeepSearchQA F1 | BrowseComp | AA-Omniscience |
| ---------------------------- | ------------ | --------------- | ---------- | -------------- |
| Exa auto, dynamic highlights | 80           | 86              | 83         | 73             |
| Perplexity medium            | 80           | 81              | 87         | 72             |
| Exa lite, dynamic highlights | 79           | 85              | 81         | 72             |
| Perplexity high              | 79           | 81              | 86         | 71             |
| Octen highlights             | 77           | 80              | 86         | 66             |
| Parallel advanced            | 75           | 81              | 77         | 67             |
| Brave LLM context            | 75           | 78              | 77         | 69             |
| OpenAI Web Search medium     | 74           | 78              | 74         | 72             |
| You.com highlights           | 74           | 77              | 77         | 69             |
| Nimble standard              | 74           | 76              | 75         | 71             |
| Firecrawl                    | 73           | 74              | 74         | 73             |
| DeepSeek summary             | 69           | 75              | 63         | 70             |
| 无搜索模型基线               | 33           | 45              | 17         | 38             |

## 采用边界

它是当前搜索主参考，但不是学术官方认证或完全开放的可复现实验：含私有集、特定回答模型、困难子集选择及不同供应商响应格式。原站的 26 配置范围不能冒充本地已取得 26 行成绩。

本项目只在[最终索引](../README.md)展示可核验成绩，并按模式标注。不把品牌的最高分套给其他模式、免密接口或本库默认参数，也不推断未取得分数的配置排在末尾。
