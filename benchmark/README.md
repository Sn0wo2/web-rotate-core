# WebFetch Benchmark

Latest run: **2026-10-15** · judge: **jev-1.13** · 8 URLs · 1 read per candidate

Each URL is fetched through every fetch-capable provider (keyless ones included) plus the native local extraction. Every candidate's markdown output is then graded **independently and blind** by the Jev decision model (one System One call per candidate), so the judge never knows which provider produced which output. The native extraction is judged the same way and serves as the baseline, not the reference answer.

A provider's per-URL score is the mean of its judge scores; the **Avg** column is the mean of per-URL means. `ERR` means the provider call failed (rate limit, block page, unreachable target) and the pipeline fell back to native extraction, so no score was recorded for that provider/URL.

## Scoring rubric

| Score | Meaning                                                                              |
| ----- | ------------------------------------------------------------------------------------ |
| 0     | Invalid: empty, mojibake, or placeholder text                                        |
| 1     | Wrong page: content does not match the URL's page (error, captcha, login wall)       |
| 2     | Almost no main content: mostly template, navigation, or footer                       |
| 3     | Severe: scattered fragments of main content dominated by ads, navigation, or scripts |
| 4     | Poor: less than half of the main content, or noise dominates                         |
| 5     | Mediocre: large sections missing or substantial noise mixed in                       |
| 6     | Acceptable: main content present with noticeable noise or small gaps                 |
| 7     | Good: essentially complete content with minor noise or omissions                     |
| 8     | Excellent: complete content with negligible noise                                    |
| 9     | Perfect: complete main content, zero noise, clean structure                          |

## Results

URLs: [bbc.com](https://www.bbc.com/news/science-environment-65602519) · [Wikipedia (en)](<https://en.wikipedia.org/wiki/List_of_countries_by_GDP_(nominal)>) · [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions) · [react.dev](https://react.dev/learn/render-and-commit) · [Stack Overflow](https://stackoverflow.com/questions/11227809/why-is-processing-a-sorted-array-faster-than-processing-an-unsorted-array) · [quotes.toscrape](https://quotes.toscrape.com/js/) · [The Guardian](https://www.theguardian.com/australia-news/2023/oct/06/chatgpt-ai-allowed-australian-schools-2024) · [Wikipedia (zh)](https://zh.wikipedia.org/wiki/人工智慧)

### Summary (avg of per-URL mean scores)

| #   | Provider     | Avg                                         | Scored | Failed |
| --- | ------------ | ------------------------------------------- | ------ | ------ |
| 1   | tinyfish     | 7.04                                        | 8/8    | 0      |
| 2   | you          | 6.75                                        | 8/8    | 0      |
| 3   | diffbot      | 6.59                                        | 5/8    | 3      |
| 4   | exa          | 6.50                                        | 8/8    | 0      |
| 5   | apify        | 6.49                                        | 7/8    | 1      |
| 6   | native       | 6.46                                        | 7/8    | 1      |
| 7   | scrapingbee  | 6.37                                        | 7/8    | 1      |
| 8   | scrapingant  | 6.22                                        | 1/8    | 7      |
| 9   | tavily       | 6.13                                        | 7/8    | 1      |
| 10  | linkup       | 5.87                                        | 7/8    | 1      |
| 11  | jina         | 5.76                                        | 8/8    | 0      |
| 12  | parallel     | 5.54                                        | 8/8    | 0      |
| 13  | hyperbrowser | 5.33                                        | 8/8    | 0      |
| —   | firecrawl    | —                                           | 0/8    | 8      |
| —   | scrapfly     | skipped: missing key (`SCRAPFLY_API_KEY`)   | —      | —      |
| —   | brightdata   | skipped: missing key (`BRIGHTDATA_API_KEY`) | —      | —      |

### Per-URL mean scores

| Provider     | BBC News | Wikipedia (en) | MDN  | react.dev | Stack Overflow | quotes.toscrape | The Guardian | Wikipedia (zh) |
| ------------ | -------- | -------------- | ---- | --------- | -------------- | --------------- | ------------ | -------------- |
| native       | 7.52     | 7.65           | 7.36 | 7.22      | ERR            | 1.11            | 7.00         | 7.34           |
| tinyfish     | 7.53     | 7.72           | 7.63 | 7.29      | 7.15           | 4.64            | 7.31         | 7.09           |
| you          | 6.52     | 6.80           | 7.42 | 7.09      | 6.95           | 4.66            | 7.97         | 6.60           |
| diffbot      | 7.20     | 7.16           | ERR  | 6.68      | ERR            | 4.51            | 7.42         | ERR            |
| exa          | 6.60     | 7.75           | 6.76 | 6.99      | 7.90           | 4.93            | 4.16         | 6.88           |
| apify        | 7.59     | 4.58           | 6.87 | 6.86      | 7.95           | 4.47            | 7.14         | ERR            |
| scrapingbee  | 6.51     | 6.85           | 5.86 | 6.98      | ERR            | 5.24            | 6.85         | 6.28           |
| scrapingant  | 6.22     | ERR            | ERR  | ERR       | ERR            | ERR             | ERR          | ERR            |
| tavily       | 6.47     | 6.83           | 6.85 | 5.92      | 6.11           | 4.81            | ERR          | 5.92           |
| linkup       | 6.57     | 6.75           | 6.32 | 6.60      | ERR            | 1.98            | 6.72         | 6.17           |
| jina         | 6.60     | 6.84           | 5.70 | 6.69      | 6.29           | 2.25            | 5.95         | 5.79           |
| parallel     | 2.05     | 6.94           | 6.83 | 7.95      | 6.16           | 5.76            | 2.54         | 6.13           |
| hyperbrowser | 5.96     | 6.37           | 5.55 | 6.74      | 1.12           | 5.06            | 6.08         | 5.75           |
| firecrawl    | ERR      | ERR            | ERR  | ERR       | ERR            | ERR             | ERR          | ERR            |

### Failure notes

- **native**: HTTP 403 on Stack Overflow (local fetch blocked).
- **firecrawl**: every run fell back to native extraction, so no firecrawl-attributed result could be judged.
- **scrapingant**: rate-limited / non-retryable errors on 7 of 8 URLs; only the BBC News fetch survived.
- **diffbot**: HTTP 429 rate limits and unattributed fallbacks on 3 URLs (MDN, Stack Overflow, Wikipedia zh).
- **tavily / linkup / scrapingbee / apify**: single-URL failures (Guardian, Stack Overflow, and Wikipedia zh respectively), each caused by provider-side errors with the native fallback also blocked.

## Caveats

- This is a personal project, so the benchmark is far from lab-grade.
- jev-1.13 has a small 32k-token context; it may not even fit a full native webfetch result plus a blind candidate side by side, so long pages are truncated before judging.
- JavaScript-heavy pages (quotes.toscrape/js, which needs JS rendering) score low across the board for non-rendering providers — the rubric's "wrong page" bucket captures that.
- Rankings shift between runs; treat them as advisory. You can tune each provider's weight to your own standards.

## Reproduce

```
bun run benchmark <url> [url2 ...] [--urls file] [--providers id,id2]
    [--reads n] [--retries n] [--save-dir dir] [--timeout s] [--env K=V] [--json]
```

- Provider keys come from env, one variable per provider: `<PROVIDER>_API_KEY` (no aliases); a value may hold several keys separated by spaces, commas, or semicolons for rotation.
- Judge env: `TYPESAFE_API_KEY` and `TYPESAFE_BASE_URL` (both required), `TYPESAFE_MODEL` (default `jev-1.13`).
- `--env K=V` sets library options verbatim (e.g. `fetchConcurrency=1`, `mode=auto`, `webfetchCleanup=defuddle`, `maxAttempts=3`).
- Results are written to `<save-dir>/<timestamp>/results.json` with per-candidate dumps under `candidates/` and judge audits under `judge/`.
