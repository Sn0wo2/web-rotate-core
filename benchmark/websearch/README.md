# WebSearch 最终排名索引

核验日期：**2026-11-06**。本页只索引外部结果，不自行评分，也不合成跨榜总分。

| 榜单                             | 数据日期   | 采用范围                            | 来源整理                                                   |
| -------------------------------- | ---------- | ----------------------------------- | ---------------------------------------------------------- |
| Artificial Analysis Search Index | 2026-10-19 | 通用搜索主参考，按具体 API 配置列分 | [方法、完整配置范围与限制](sources/artificial-analysis.md) |
| Vals Web Search Index            | 2026-10-21 | 金融／法律领域的模型＋搜索工具补榜  | [完整 9 组合排名](sources/vals.md)                         |
| OpenBenchmarks Company News      | 2026-10-21 | 暂不采用：来源明确提示索引时间偏差  | [排除原因](sources/openbenchmarks.md)                      |

## 搜索主榜：AA 可核验公开子集

来源：[Artificial Analysis 原榜](https://artificialanalysis.ai/agents/search-api)。分数为原站发布的 Search Index（0–100），不由本项目重算。

**完整评测范围是 26 个配置、14 家供应商，不是 26 家供应商。** 本次可读取的公开表仅确认以下 **12 个 API 配置、10 家供应商**，另有模型无搜索基线。其余 14 个配置没有取得可核验的公开成绩，不推断其名次；本表不是完整 26 配置总榜。

| 展示顺序 | API 配置                              | 项目 ID      | Search Index |
| -------- | ------------------------------------- | ------------ | ------------ |
| 1        | Exa Search — auto, dynamic highlights | `exa`        | 80           |
| 2        | Perplexity Search — medium            | `perplexity` | 80           |
| 3        | Exa Search — lite, dynamic highlights | `exa`        | 79           |
| 4        | Perplexity Search — high              | `perplexity` | 79           |
| 5        | Octen Search — highlights             | `octen`      | 77           |
| 6        | Parallel Search — advanced            | `parallel`   | 75           |
| 7        | Brave Search — LLM context            | `brave`      | 75           |
| 8        | OpenAI Web Search — medium            | `openai`     | 74           |
| 9        | You.com Search — highlights           | `you`        | 74           |
| 10       | Nimble Search — standard              | `nimble`     | 74           |
| 11       | Firecrawl Search                      | `firecrawl`  | 73           |
| 12       | DeepSeek Search — summary             | `deepseek`   | 69           |

展示顺序沿用来源；相同的公开整数分数不代表有可确认的优劣差距。模型无搜索基线为 **33**，不是供应商，不参与本表。

该指数衡量固定回答模型使用搜索工具后的任务表现，不是纯 SERP 相关性。OpenAI 使用原生搜索工具及集成流程，与第三方 API 的 Stirrup 流程存在差异，见来源整理。

## 领域补榜：Vals

以下是 Vals 原榜的前三个**模型＋工具组合**，不能据此给搜索供应商单独排通用名次。

| 原榜名次 | 模型           | 搜索工具 | Overall |
| -------- | -------------- | -------- | ------- |
| 1        | GPT-5.6 Sol    | Keenable | 49.08%  |
| 2        | Claude Fable 5 | Exa      | 48.45%  |
| 3        | Claude Fable 5 | Native   | 46.94%  |

[完整 9 组合、任务范围及评分方法](sources/vals.md)。不把 Vals 的百分比与 AA 的指数合并。

## 项目覆盖与缺分索引

当前注册 **23 家外部供应商＋`native`**。AA 方法表覆盖其中 **14/23**；本次公开成绩能确认其中 **10/23**。

| 项目 ID        | 当前外部证据状态                                                          |
| -------------- | ------------------------------------------------------------------------- |
| `keenable`     | AA 列出 pro／realtime，未取得公开成绩；有 Vals 组合成绩，不能补入 AA 主榜 |
| `linkup`       | AA 列出 flash alpha／fast／standard，未取得公开成绩                       |
| `tavily`       | AA 列出 basic，未取得公开成绩                                             |
| `tinyfish`     | AA 列出 web，未取得公开成绩                                               |
| `hyperbrowser` | 本次 AA 配置表未覆盖                                                      |
| `serper`       | 本次 AA 配置表未覆盖                                                      |
| `bocha`        | 本次 AA 配置表未覆盖                                                      |
| `jina`         | 本次 AA 配置表未覆盖                                                      |
| `scrapingbee`  | 本次 AA 配置表未覆盖                                                      |
| `diffbot`      | 本次 AA 配置表未覆盖                                                      |
| `brightdata`   | 本次 AA 配置表未覆盖                                                      |
| `doubao`       | 本次 AA 配置表未覆盖                                                      |
| `zhipu`        | 本次 AA 配置表未覆盖                                                      |
| `native`       | 本库本地实现，未在上述来源中按此实现独立测评                              |

项目的 `native` 不是 Vals 的 Native，也不是 AA 的模型无搜索基线。品牌覆盖也不等于项目默认配置已被测评：例如项目 Parallel 默认 `fast` 不能套用 `advanced` 成绩，Perplexity 默认 `low` 不能套用 `medium` 成绩。此页不修改任何默认权重。
