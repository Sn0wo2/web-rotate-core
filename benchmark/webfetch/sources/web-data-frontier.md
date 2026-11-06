# Source Notes: String Web Data Frontier Benchmark

## Source and snapshot

String publishes this benchmark, participates in it, and ranks first. **This is a vendor-run evaluation.** The [repository, leaderboard, and documentation](https://github.com/usestring/web-data-frontier-benchmark) use the MIT license.

The results are dated **2026-10-30T18:48:18.489Z**. Available materials include the [dated raw JSON](https://github.com/usestring/web-data-frontier-benchmark/blob/main/official_results/benchmark-2026-10-30T18-48-18-489Z.json), [direct JSON download](https://raw.githubusercontent.com/usestring/web-data-frontier-benchmark/main/official_results/benchmark-2026-10-30T18-48-18-489Z.json), [scoring code](https://github.com/usestring/web-data-frontier-benchmark/blob/main/src/check.ts), [runner](https://github.com/usestring/web-data-frontier-benchmark/blob/main/src/runner.ts), and [targets with expected text](https://github.com/usestring/web-data-frontier-benchmark/blob/main/src/tests.const.ts).

Recorded source check: **2026-11-06**; the README, code, and raw JSON were successfully read. The raw JSON returned HTTP 200.

## What it measures

The benchmark measures the ability to fetch pages protected by anti-bot systems. It does not measure main-content completeness, noise, table structure, or Markdown usability.

The source defines success as follows:

> a request **passes** when the API returns a `2xx` status **and** the response body contains the page's expected text.

There are 100 fixed URLs across 16 industries. Each of 17 providers makes five requests per URL, for 8,500 requests in total. Default concurrency is 2, with a 90-second timeout per request.

The providers are string, scrapedo, context_dev, scrapfly, scrapingbee, firecrawl, zyte, apify, scraperapi, bright, decodo, nimble, oxylabs, browserbase, zenrows, scrapingant, and scrapingdog.

Each target has a `containsText` check, so HTTP 200 alone does not count as success. Finding one expected text fragment still does not establish that the main content is complete or clean.

## Recorded raw-data verification

During the source review, the downloaded JSON's public per-attempt `attempts[].success` values were reaggregated to check the published totals. No new scoring rules were introduced and no additional provider requests were run.

| Check                                             | Result      |
| ------------------------------------------------- | ----------- |
| Providers                                         | 17          |
| Targets per provider                              | 100         |
| Attempts per target                               | 5           |
| Requests per provider                             | 500         |
| Total requests                                    | 8,500       |
| Per-attempt success counts versus provider totals | All matched |

The raw JSON includes per-attempt success flags, latency, and errors, but not the full bodies of all successful pages. It therefore cannot support an independent content-quality review of every page. See the [WebFetch index](../README.md) for all success rates and source ranks.

## Latency definition

The source's Latency score is neither a global mean nor a global p75. It first takes the nearest-rank p75 of successful attempts for each target, then averages equally across targets. When a provider fails every attempt on a target, its score is filled with the p75 of the scores of other providers that succeeded on that target. The 90-second fallback applies only when all providers fail.

The WebFetch index keeps this latency score separate from success rates and does not present it as latency measured by this project.

## Conflicts of interest and limitations

The publisher selects the targets and ranks its own product first. Default plans, server-side upgrades, and rendering behavior may not be fully comparable across products. Massive did not participate because its account was not activated in time; this is not a zero score.

Public code, targets, and per-attempt results make the statistics auditable. The publisher still has a direct commercial interest, and the success criterion does not measure main-content quality. This source is retained only as a **fetch-success ranking**, not an independent authoritative overall ranking or a recommendation order for all WebFetch products.
