# WebFetch Benchmark Index

Snapshot: **2026-11-06**. The source review did not identify a single leaderboard that combines independent evaluation, broad commercial-provider coverage, main-content quality, and full reproducibility.

This page indexes external results by what they measure. **Fetch success is not Markdown quality, and this project does not create a composite score.**

| Source                       | Data date and scale                                               | Use in this index                                                                                            | Source notes                                                           |
| ---------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| Proxyway Scraping API Report | Tests from 2025-10; 11 providers, 15 target sites                 | Third-party comparison of fetch success, latency, and cost; no verifiable unified numerical ranking obtained | [Methodology and commercial disclosures](sources/proxyway.md)          |
| String Web Data Frontier     | 2026-10-30; 17 providers, 100 URLs, 8,500 requests                | Auditable fetch-success ranking; vendor-run, not an independent quality ranking                              | [Raw JSON, methodology, and limitations](sources/web-data-frontier.md) |
| SIGIR 2023 WCEB              | 2023; 8 annotated datasets                                        | Research on static HTML content extraction, not a commercial scraping API ranking                            | [Paper and code](sources/wceb.md)                                      |
| WebMainBench                 | 7,809 pages; a 545-page subset with detailed Markdown annotations | Reference for static HTML extraction quality, not a commercial scraping API ranking                          | [Data and methodology](sources/webmainbench.md)                        |

## Fetch success: String's published results

**String runs this benchmark and is also a participant. Its ranking is neither an independent recommendation order nor an overall content-quality ranking.** The source ranks are retained because per-attempt results are available for verification. Proxyway did not provide a verifiable unified numerical ranking in the reviewed material; its editorial conclusions are not converted into a second set of scores.

Sources: [published leaderboard](https://github.com/usestring/web-data-frontier-benchmark) and [dated raw JSON](https://github.com/usestring/web-data-frontier-benchmark/blob/main/official_results/benchmark-2026-10-30T18-48-18-489Z.json). Each provider made five requests to each of 100 targets. A request passes only when it returns HTTP `2xx` and the response body contains the expected text.

| Source rank | Source provider ID | Project WebFetch ID | Success rate | Passed / requests |
| ----------- | ------------------ | ------------------- | ------------ | ----------------- |
| 1           | `string`           | Not registered      | 98.6%        | 493/500           |
| 2           | `scrapedo`         | Not registered      | 94.0%        | 470/500           |
| 3           | `context_dev`      | Not registered      | 93.0%        | 465/500           |
| 4           | `scrapfly`         | `scrapfly`          | 86.8%        | 434/500           |
| 5           | `scrapingbee`      | `scrapingbee`       | 85.2%        | 426/500           |
| 6           | `firecrawl`        | `firecrawl`         | 81.2%        | 406/500           |
| 7           | `zyte`             | Not registered      | 79.6%        | 398/500           |
| 8           | `apify`            | `apify`             | 79.4%        | 397/500           |
| 9           | `scraperapi`       | Not registered      | 76.4%        | 382/500           |
| 10          | `bright`           | `brightdata`        | 75.4%        | 377/500           |
| 11          | `decodo`           | Not registered      | 71.2%        | 356/500           |
| 12          | `nimble`           | `nimble`            | 68.0%        | 340/500           |
| 13          | `oxylabs`          | Not registered      | 67.4%        | 337/500           |
| 14          | `browserbase`      | Not registered      | 43.0%        | 215/500           |
| 15          | `zenrows`          | Not registered      | 41.8%        | 209/500           |
| 16          | `scrapingant`      | `scrapingant`       | 40.0%        | 200/500           |
| 17          | `scrapingdog`      | Not registered      | 27.6%        | 138/500           |

Project IDs identify matching brands only. They do not establish that the benchmark used the same API, plan, or rendering strategy as this project's adapter. `bright` refers to Bright Data.

Manual weight sync (**2026-11-06**): the seven registered brands in the table use their published success-rate percentages, without rounding, as default routing weights. This is a brand-level routing heuristic, not an assertion that this project's API configuration, plan, rendering options, content quality, or keyless interface was evaluated. Unranked providers retain their existing policy weights, and provider and per-key weight overrides remain supported.

## Project coverage and unranked providers

At this snapshot, WebFetch registers **25 external providers plus `native`**. String covers **7/25** of those brands, while Proxyway covers **4/25**: Apify, Firecrawl, Nimble, and ScrapingBee. Neither source covers the full registry.

No comparable public results suitable for the ranking above were obtained for the following providers. Missing results are not assigned zero scores or last-place ranks.

| Project ID     | Status                                                                                          |
| -------------- | ----------------------------------------------------------------------------------------------- |
| `tavily`       | Unranked                                                                                        |
| `parallel`     | Unranked                                                                                        |
| `you`          | Unranked                                                                                        |
| `exa`          | Unranked                                                                                        |
| `hyperbrowser` | Unranked                                                                                        |
| `tinyfish`     | Unranked                                                                                        |
| `jina`         | Unranked                                                                                        |
| `keenable`     | Unranked                                                                                        |
| `octen`        | Unranked                                                                                        |
| `serper`       | Unranked                                                                                        |
| `diffbot`      | Unranked                                                                                        |
| `linkup`       | Unranked                                                                                        |
| `deepseek`     | Unranked                                                                                        |
| `bocha`        | Unranked                                                                                        |
| `doubao`       | Unranked                                                                                        |
| `claude`       | Unranked                                                                                        |
| `gemini`       | Unranked                                                                                        |
| `zhipu`        | Unranked                                                                                        |
| `native`       | Local implementation; these sources do not independently evaluate this project's implementation |
