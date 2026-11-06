# web-rotate-core

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/Sn0wo2/web-rotate-core)

> One Gateway for All WebSearch/WebFetch Providers!

## Language

[English](README.md) | [简体中文](README-zh-CN.md)

## A Short Story Behind It

In the past, we used search engines to find information. Today, Agents can search and browse the web on their own to learn about the outside world, but Agents no longer use traditional search engines.

That brings its own problems.

Different `WebSearch / WebFetch` providers vary in search quality, token consumption, pricing, and free quotas.

Making the most of them means bringing in a whole bunch of different providers' `MCP`s, which is quite a pain...

**So why not bring them all together?**

That's the problem **[`web-rotate-core`](https://github.com/Sn0wo2/web-rotate-core)** aims to solve (hereafter, `core`).

**`core` is a library** that you can depend on to integrate these providers into any Node.js ecosystem project.

## Ecosystem

If you want an out-of-the-box `MCP`, we've also built [`web-rotate-mcp`](https://github.com/Sn0wo2/web-rotate-mcp) on top of `core`.

If you happen to use `OpenCode2`, you can use [`oc-web-rotate`](https://github.com/Sn0wo2/oc-web-rotate) directly.

## Weights and Benchmark

See the external [WebSearch Index](./benchmark/websearch/README.md) and [WebFetch Index](./benchmark/webfetch/README.md). Each directory includes source notes covering methodology, dates, provider coverage, and limitations.

WebSearch references published API-configuration results. WebFetch keeps fetch success rates separate from content quality; vendor-run benchmarks are explicitly labeled, and unranked providers receive no invented scores.

Default routing weights have been manually reviewed and synchronized against the current indexes; providers without comparable results and untested configurations retain their existing policy weights. You can still configure provider and per-key weights.

## Providers Currently Supported Natively by `core`

### WebSearch

- [Perplexity](https://www.perplexity.ai)
- [Octen](https://octen.ai)
- [Tavily](https://www.tavily.com) `Keyless`
- [Parallel](https://parallel.ai) `Keyless`
- [You.com](https://you.com)
- [Nimble](https://nimbleway.com)
- [Exa](https://exa.ai) `Keyless`
- [Brave Search](https://brave.com/search/api)
- [HyperBrowser](https://hyperbrowser.ai)
- [Firecrawl](https://www.firecrawl.dev) `Keyless`
- [TinyFish](https://www.tinyfish.ai)
- [Keenable](https://keenable.ai) `Keyless`
- [Serper](https://serper.dev)
- [Bocha](https://bochaai.com)
- [Jina](https://jina.ai)
- [ScrapingBee](https://www.scrapingbee.com)
- [Diffbot](https://www.diffbot.com)
- [Bright Data](https://brightdata.com)
- [Apify](https://apify.com)
- [Linkup](https://www.linkup.so)
- [Doubao](https://www.volcengine.com)
- [DeepSeek](https://www.deepseek.com)
- [OpenAI](https://openai.com)
- [Grok](https://x.ai)
- [Claude](https://www.anthropic.com)
- [Gemini](https://ai.google.dev)
- Native built-in implementation `Keyless`
- [Zhipu](https://open.bigmodel.cn)

### WebFetch

- [Tavily](https://www.tavily.com) `Keyless`
- [Parallel](https://parallel.ai) `Keyless`
- [You.com](https://you.com)
- [Exa](https://exa.ai)
- [HyperBrowser](https://hyperbrowser.ai)
- [Firecrawl](https://www.firecrawl.dev) `Keyless`
- [TinyFish](https://www.tinyfish.ai)
- [Jina](https://jina.ai) `Keyless`
- [Keenable](https://keenable.ai) `Keyless`
- [Nimble](https://nimbleway.com)
- [Octen](https://octen.ai)
- [Serper](https://serper.dev)
- [ScrapingAnt](https://scrapingant.com)
- [ScrapingBee](https://www.scrapingbee.com)
- [ScrapFly](https://scrapfly.io)
- [Diffbot](https://www.diffbot.com)
- [Bright Data](https://brightdata.com)
- [Apify](https://apify.com)
- [Linkup](https://www.linkup.so)
- [DeepSeek](https://www.deepseek.com)
- [Bocha](https://bochaai.com)
- [Doubao](https://www.volcengine.com)
- [Claude](https://www.anthropic.com)
- [Gemini](https://ai.google.dev)
- Native built-in implementation `Keyless`
- [Zhipu](https://open.bigmodel.cn)

If none of these providers meet your needs, you can also easily extend `core` with your own provider.

## Observability: Attempts & Usage

Every `searchWeb` / `fetchWeb` outcome carries structured, machine-readable diagnostics for monitoring UIs (e.g. a TUI), at attempt granularity. Keys never appear — only indices/tiers:

- **`attempts[]`** — one entry per provider route attempt: `provider`, `keyless`, `keyIndex` (0-based index into the provider's deduplicated key list), `tier`, `queries` / `urls`, `durationMs`, `ok`, and `error` (including skip reasons such as a provider being blocked after an invalid-request error). Outcome-level cache reads show up as `provider: "cache"` entries with `cached: true`; on regular entries `cached` is reserved for providers that self-report cache hits. When every attempt fails, the thrown `Error` carries the same `attempts` array.
- **`usage[]`** — per provider (and per tier when one is configured): `requests` (attempted provider calls), `results` (search) / `pages` (fetch) raw counts, and `errors`. Multiply with your own price table to estimate cost — pricing is deliberately kept out of `core`, and no provider API returns billing data.
- **Attribution** — failed search `errors[]` name the `provider`, failed fetch pages keep their `provider`, and image outcomes report `provider: "native"`.

Keys can also carry tier metadata: each `keys` entry may be a plain string (as before) or `{ key, tier?, weight? }` — or use the inline `"<tier>::<key>"` string syntax. A per-key `weight` overrides the provider weight for that key's route. Keyless routes can be tiered too via the reserved key value `"keyless"` — inline (`"free::keyless"`) or as an object (`{ key: "keyless", tier: "free", weight? }`) — which tags the free route and can also rank it through its per-route `weight` (keyed-only providers reject the marker with a config error). Outcome-level caching can be plugged in via `new LRUCache({ cap })` passed as `cache` in the config (with `cacheWindowSeconds` acting as its TTL).
