# web-rotate-core

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/Sn0wo2/web-rotate-core)

> One Gateway for All WebSearch/WebFetch Providers!

## i18n

[简体中文](README-zh-CN.md)

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

## Weights

The default weights are based on the [WebSearch Rank Index](./benchmark/websearch/README.md) and [WebFetch Rank Index](./benchmark/webfetch/README.md).

## Providers Currently Supported Natively by `core`

### WebSearch

- [Perplexity](https://www.perplexity.ai)
- [Exa](https://exa.ai) `Keyless`
- [Octen](https://octen.ai)
- [Parallel](https://parallel.ai) `Keyless`
- [Brave Search](https://brave.com/search/api)
- [You.com](https://you.com)
- [Nimble](https://nimbleway.com)
- [OpenAI](https://openai.com)
- [Firecrawl](https://www.firecrawl.dev) `Keyless`
- [TinyFish](https://www.tinyfish.ai)
- [DeepSeek](https://www.deepseek.com)
- [Linkup](https://www.linkup.so)
- [Tavily](https://www.tavily.com) `Keyless`
- [Serper](https://serper.dev)
- [Keenable](https://keenable.ai) `Keyless`
- [Zhipu](https://open.bigmodel.cn)
- [Jina](https://jina.ai)
- [Bocha](https://bochaai.com)
- [Apify](https://apify.com)
- [Doubao](https://www.volcengine.com)
- [Grok](https://x.ai)
- [Claude](https://www.anthropic.com)
- [Gemini](https://ai.google.dev)
- [Diffbot](https://www.diffbot.com)
- [Bright Data](https://brightdata.com)
- [ScrapingBee](https://www.scrapingbee.com)
- [HyperBrowser](https://hyperbrowser.ai)
- Native built-in implementation `Keyless`

### WebFetch

- [ScrapFly](https://scrapfly.io)
- [ScrapingBee](https://www.scrapingbee.com)
- [Firecrawl](https://www.firecrawl.dev) `Keyless`
- [Parallel](https://parallel.ai) `Keyless`
- [Apify](https://apify.com)
- [Exa](https://exa.ai)
- [Bright Data](https://brightdata.com)
- [TinyFish](https://www.tinyfish.ai)
- [Tavily](https://www.tavily.com) `Keyless`
- [Nimble](https://nimbleway.com)
- [You.com](https://you.com)
- [Jina](https://jina.ai) `Keyless`
- [Linkup](https://www.linkup.so)
- [Diffbot](https://www.diffbot.com)
- [Keenable](https://keenable.ai) `Keyless`
- [Octen](https://octen.ai)
- [Serper](https://serper.dev)
- [Zhipu](https://open.bigmodel.cn)
- [HyperBrowser](https://hyperbrowser.ai)
- [DeepSeek](https://www.deepseek.com)
- [Bocha](https://bochaai.com)
- [Doubao](https://www.volcengine.com)
- [Claude](https://www.anthropic.com)
- [Gemini](https://ai.google.dev)
- [ScrapingAnt](https://scrapingant.com)
- Native built-in implementation `Keyless`

If none of these providers meet your needs, you can also easily extend `core` with your own provider.
