# Source Notes: Proxyway Web Scraping API Report 2025

## Source and snapshot

Proxyway is a third-party industry review publisher. Affiliate relationships alone do not establish ownership by a participating provider.

Sources: [original report](https://proxyway.com/research/web-scraping-api-report-2025) and [research index](https://proxyway.com/research). The report states that most tests took place in **2025-10**.

Recorded source check: **2026-11-06**; the report returned HTTP 200, and the research index still linked to it. The index's 2026 Proxy Market Report covers the proxy market; it is not a newer scraping API report.

## Commercial disclosures

The report explicitly states:

> We use affiliate links. They let us sustain ourselves at no cost to you.

Most providers supplied test access after outreach; the reviewers purchased access to Firecrawl and ZenRows. This is a third-party evaluation with disclosed commercial relationships. It is not a conflict-free laboratory study, and the reviewed evidence does not establish that a participating vendor runs the benchmark.

## Scope and methodology

The report covers 11 providers: Apify, Crawlbase, Decodo, Firecrawl, NetNut, Nimble, Oxylabs, ScraperAPI, ScrapingBee, ZenRows, and Zyte.

Its 15 target sites are Allegro, Amazon, ChatGPT, G2, Google, Hyatt, Immobilienscout24, Instagram, Leboncoin, Lowe's, Nordstrom, Shein, Walmart, YouTube, and Zillow. Tests use approximately 6,000 distinct URLs per target site, loads of 2 and 10 requests per second, and a 600-second timeout.

Success is determined through heuristics such as response status, page size, and title, with additional CSS-selector checks for some targets. Rendering or advanced unlocking options are enabled per target, so the tested settings cannot be assumed to match this project's defaults.

The report measures fetch success, response time, and cost. It does not measure verbatim main-content completeness, noise, or Markdown-structure quality. Page categories and anti-bot differences also affect the results.

## Usable results and ranking limits

Sections such as `Summary` and `Benchmark Results` include success rates, response times, charts by target and load, analysis of difficult targets, and cost comparisons.

**No verifiable unified numerical provider ranking was obtained from the accessible material.** Embedded charts did not expose complete raw values for every provider. Editorial recommendations and claims such as "fastest" or "cheapest" are not converted into overall ranks.

The source review did not find public per-attempt response data, a complete target list, or reproducible scoring scripts. The [WebFetch index](../README.md) therefore uses the report as a third-party directional comparison. It does not synthesize scores from charts or prose, or combine these results with String's different samples, year, and timeout settings.

Apify, Firecrawl, Nimble, and ScrapingBee overlap with this project's WebFetch registry.
