# Source Notes: SIGIR 2023 Web Content Extraction Benchmark

## Source and snapshot

The paper _An Empirical Comparison of Web Content Extraction Algorithms_, by Janek Bevendorff, Sanket Gupta, Johannes Kiesel, and Benno Stein, was published at ACM SIGIR 2023 on **2023-07-18**.

Sources: [paper](https://doi.org/10.1145/3539618.3591920), [code, data, and results](https://github.com/chatnoir-eu/web-content-extraction-benchmark), and [Crossref publication metadata](https://api.crossref.org/works/10.1145/3539618.3591920).

Recorded source check: **2026-11-06**; Crossref and the repository README API both returned HTTP 200.

## Methodology and reproducibility

This reproducible comparison of main-content extraction algorithms combines 8 existing annotated datasets into one format. The published materials include `datasets/combined.tar.xz` for the unified data, `outputs/model-outputs` for archives of the study's extraction outputs, and the `wceb` CLI for extraction, scoring, and aggregation.

Metrics are ROUGE-LSum and Levenshtein, rather than project-authored LLM judging rules.

## Use and limitations

The academic publication, annotated data, code, and original extraction outputs make this a useful reference for **static HTML main-content extraction and boilerplate removal algorithms**.

It does not measure live network access, anti-bot bypass, or JavaScript rendering. It is not an overall provider ranking for commercial WebFetch APIs such as Firecrawl, Tavily, Exa, or Jina. Algorithm results cannot be transferred to APIs with different fetching and cleanup pipelines.

The [WebFetch index](../README.md) lists it only as content-extraction research, not as a way to fill gaps in commercial-provider ranks. A study from 2023 must not be presented as a live API test from 2026.
