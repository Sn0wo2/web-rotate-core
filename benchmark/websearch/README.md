# WebSearch Benchmark Index

Snapshot: **2026-11-06**. This page indexes external results. It does not assign scores or combine results across leaderboards.

| Benchmark                        | Data date  | Use in this index                                                                 | Source notes                                                                             |
| -------------------------------- | ---------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Artificial Analysis Search Index | 2026-10-19 | Primary general-search reference, with scores tied to specific API configurations | [Methodology, full configuration scope, and limitations](sources/artificial-analysis.md) |
| Vals Web Search Index            | 2026-10-21 | Finance and law supplement for model-tool combinations                            | [All 9 ranked combinations](sources/vals.md)                                             |
| OpenBenchmarks Company News      | 2026-10-21 | Excluded pending a fix for the source's disclosed indexing-time bias              | [Reason for exclusion](sources/openbenchmarks.md)                                        |

## Primary reference: AA's verifiable public subset

Source: [Artificial Analysis leaderboard](https://artificialanalysis.ai/agents/search-api). Search Index scores use the source's published 0-100 scale and are not recalculated by this project.

**The full evaluation covers 26 configurations from 14 providers, not 26 providers.** The public table accessible during the source review confirmed only the **12 API configurations from 10 providers** below, plus a no-search model baseline. No verifiable public scores were obtained for the other 14 configurations, and their ranks are not inferred. This is not the complete 26-configuration leaderboard.

| Display order | API configuration                     | Project ID   | Search Index |
| ------------- | ------------------------------------- | ------------ | ------------ |
| 1             | Exa Search (auto, dynamic highlights) | `exa`        | 80           |
| 2             | Perplexity Search (medium)            | `perplexity` | 80           |
| 3             | Exa Search (lite, dynamic highlights) | `exa`        | 79           |
| 4             | Perplexity Search (high)              | `perplexity` | 79           |
| 5             | Octen Search (highlights)             | `octen`      | 77           |
| 6             | Parallel Search (advanced)            | `parallel`   | 75           |
| 7             | Brave Search (LLM context)            | `brave`      | 75           |
| 8             | OpenAI Web Search (medium)            | `openai`     | 74           |
| 9             | You.com Search (highlights)           | `you`        | 74           |
| 10            | Nimble Search (standard)              | `nimble`     | 74           |
| 11            | Firecrawl Search                      | `firecrawl`  | 73           |
| 12            | DeepSeek Search (summary)             | `deepseek`   | 69           |

Display order follows the source. Equal published integer scores do not establish a performance difference. The no-search model baseline scores **33**; it is not a provider and is excluded from this table.

The index measures task performance when a fixed answering model uses a search tool, rather than pure SERP relevance. OpenAI uses a native search tool and integration that differ from the Stirrup workflow used for third-party APIs; see the source notes.

## Domain supplement: Vals

These are the top three **model-tool combinations** in the Vals leaderboard. They do not establish a general ranking of search providers in isolation.

| Source rank | Model          | Search tool | Overall |
| ----------- | -------------- | ----------- | ------- |
| 1           | GPT-5.6 Sol    | Keenable    | 49.08%  |
| 2           | Claude Fable 5 | Exa         | 48.45%  |
| 3           | Claude Fable 5 | Native      | 46.94%  |

See [all 9 combinations, task scope, and scoring](sources/vals.md). Vals percentages are not combined with AA's index.

## Project coverage and missing scores

At this snapshot, WebSearch registers **28 external providers plus `native`**. AA's methodology table covers **14/28** of those providers; the public scores obtained during the review cover **10/28**.

| Project ID     | External evidence at this snapshot                                                                                   |
| -------------- | -------------------------------------------------------------------------------------------------------------------- |
| `keenable`     | AA lists pro/realtime, but no public scores were obtained; Vals combination scores cannot fill the gap in AA's table |
| `linkup`       | AA lists flash alpha/fast/standard, but no public scores were obtained                                               |
| `tavily`       | AA lists basic, but no public score was obtained                                                                     |
| `tinyfish`     | AA lists web, but no public score was obtained                                                                       |
| `hyperbrowser` | Not covered by the reviewed AA configuration table                                                                   |
| `serper`       | Not covered by the reviewed AA configuration table                                                                   |
| `bocha`        | Not covered by the reviewed AA configuration table                                                                   |
| `jina`         | Not covered by the reviewed AA configuration table                                                                   |
| `scrapingbee`  | Not covered by the reviewed AA configuration table                                                                   |
| `diffbot`      | Not covered by the reviewed AA configuration table                                                                   |
| `brightdata`   | Not covered by the reviewed AA configuration table                                                                   |
| `apify`        | Not covered by the reviewed AA configuration table                                                                   |
| `doubao`       | Not covered by the reviewed AA configuration table                                                                   |
| `grok`         | Not covered by the reviewed AA configuration table                                                                   |
| `claude`       | Not covered by the reviewed AA configuration table                                                                   |
| `gemini`       | Not covered by the reviewed AA configuration table                                                                   |
| `zhipu`        | Not covered by the reviewed AA configuration table                                                                   |
| `searxng`      | Self-hosted; not covered by the reviewed AA configuration table                                                      |
| `native`       | Local implementation; the sources above do not independently evaluate this project's implementation                  |

This project's `native` is neither Vals' Native nor AA's no-search model baseline. Brand coverage also does not establish that project defaults were tested: Parallel's default `fast` cannot inherit the `advanced` score, and Perplexity's default `low` cannot inherit the `medium` score.

Manual weight review (**2026-11-06**): Exa (`80`), Octen (`77`), Brave (`75`), OpenAI (`74`), You.com (`74`), Nimble (`74`), Firecrawl (`73`), and DeepSeek (`69`) already use the published reference values as routing weights, so no numeric changes were needed. These are routing-policy references, not claims that every default parameter, model, or keyless interface was evaluated. Perplexity (`80`), Parallel (`75`), and providers without published scores retain their existing policy weights rather than inheriting scores for untested configurations. Provider and per-key weight overrides remain supported.
