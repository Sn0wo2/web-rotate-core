# Source Notes: Artificial Analysis Search Index

## Source and snapshot

Artificial Analysis is a third-party commercial evaluation organization. This leaderboard is not run by this project or a participating search provider.

Sources: [leaderboard](https://artificialanalysis.ai/agents/search-api) and [methodology with Search Provider API Settings](https://artificialanalysis.ai/methodology/search-api). The source reports a data date of **2026-10-19**.

Recorded source check: **2026-11-06**; the leaderboard and methodology pages both returned HTTP 200. The source states:

> We benchmark 26 Search API products across 14 providers

The product count refers to configurations, not providers. The methodology table documents all 26 configurations. During the source review, the public leaderboard yielded scores for only 12 API configurations and one no-search baseline. No scores are filled in for the remaining configurations.

## Evaluation scope

| Task           | Samples | Metric                                                                                    |
| -------------- | ------- | ----------------------------------------------------------------------------------------- |
| DeepSearchQA   | 900     | Answer-item F1, graded by an LLM                                                          |
| BrowseComp     | 200     | Difficult subset selected from 1,266 questions; short-answer correctness judged by an LLM |
| AA-Omniscience | 600     | Private holdout with 100 questions in each of 6 domains; accuracy judged by an LLM        |

Search Index is the equal-weight mean of these three metrics on a 0-100 scale. The published index is quoted directly, not recalculated from rounded component scores.

GPT-5.6 Luna (medium) is both the answering and grading model. Third-party search APIs use Stirrup, with at most 25 agent turns per question and up to 10 displayed results per search. `web_search` returns the provider's native response, while `web_fetch` retrieves text from result pages. Contamination filtering is enabled.

**OpenAI is an exception:** it uses native `web_search` through the Responses API, without Stirrup or the same turn budget. The workflows therefore cannot be described as identical across all products.

Costs include search calls and the answering model. The page's cost per thousand tasks is not a price per thousand API calls.

## Published configuration scope

| Provider   | Configurations in the methodology table                 | Count |
| ---------- | ------------------------------------------------------- | ----- |
| Brave      | web; LLM context                                        | 2     |
| DeepSeek   | summary, `need_content=false`                           | 1     |
| Exa        | lite + dynamic highlights; auto + dynamic highlights    | 2     |
| Firecrawl  | Search, `scrape_format=none`                            | 1     |
| Keenable   | pro; realtime                                           | 2     |
| Linkup     | flash alpha; fast; standard, `outputType=searchResults` | 3     |
| Nimble     | lite; standard, `full_content=false`                    | 2     |
| Octen      | highlights, `safesearch=off`, `language=["en"]`         | 1     |
| OpenAI     | Web Search, `search_context_size=medium`                | 1     |
| Parallel   | turbo; fast; basic; advanced                            | 4     |
| Perplexity | low; medium; high                                       | 3     |
| Tavily     | basic                                                   | 1     |
| TinyFish   | web                                                     | 1     |
| You.com    | snippets; highlights                                    | 2     |
| Total      | 14 providers                                            | 26    |

## Verifiable score breakdown

Rows follow the public table's order, and component scores retain the source's displayed values. This is not the complete configuration leaderboard and does not establish statistical significance.

| Configuration                | Search Index | DeepSearchQA F1 | BrowseComp | AA-Omniscience |
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
| No-search model baseline     | 33           | 45              | 17         | 38             |

## Use and limitations

This is the index's primary search reference, not an official academic certification or a fully open, reproducible experiment. It includes private data, a specific answering model, a selected difficult subset, and differing provider response formats. The source's scope of 26 configurations does not mean that 26 score rows were obtained in this review.

The [WebSearch index](../README.md) displays only verifiable scores and labels their configurations. A brand's highest score is not transferred to other modes, keyless interfaces, or this project's default settings. Configurations without obtained scores are not assumed to rank last.
