# web-rotate-core

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

For WebSearch, the default routing weights are based on [Artificial Analysis's Search API Index](https://artificialanalysis.ai/agents/search-api).

For WebFetch, we use our own [WebFetch Benchmark](./benchmark/README.md).

We use `jev v1.13` as the judge model to score the results from each `WebFetch` provider.

However, this is a personal project, so the benchmark is certainly not very standardized. Also, jev's context window is pitifully small (32k); it may not even fit both the result from one native webfetch (used as the baseline) and the result from a provider being tested blind.

So you can still adjust the weights for each `WebSearch / WebFetch` provider according to your own criteria.

## Providers Currently Supported Natively by `core`

Listed in default routing priority order. Trim whitespace from a provider name and lowercase it to get the provider `id`.

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
- [Linkup](https://www.linkup.so)
- [Doubao](https://www.volcengine.com)
- [DeepSeek](https://www.deepseek.com)
- [OpenAI](https://openai.com)
- Native built-in implementation `Keyless`

### WebFetch

- [Tavily](https://www.tavily.com) `Keyless`
- [Parallel](https://parallel.ai) `Keyless`
- [You.com](https://you.com)
- [Exa](https://exa.ai)
- [HyperBrowser](https://hyperbrowser.ai)
- [Firecrawl](https://www.firecrawl.dev) `Keyless`
- [TinyFish](https://www.tinyfish.ai)
- [Jina](https://jina.ai) `Keyless`
- [ScrapingAnt](https://scrapingant.com)
- [ScrapingBee](https://www.scrapingbee.com)
- [ScrapFly](https://scrapfly.io)
- [Diffbot](https://www.diffbot.com)
- [Bright Data](https://brightdata.com)
- [Apify](https://apify.com)
- [Linkup](https://www.linkup.so)
- [DeepSeek](https://www.deepseek.com)
- Native built-in implementation `Keyless`

If none of these providers meet your needs, you can also easily extend `core` with your own provider.

# Documentation

Code documentation is available at <https://deepwiki.com/Sn0wo2/web-rotate-core>.
