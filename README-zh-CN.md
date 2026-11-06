# web-rotate-core

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/Sn0wo2/web-rotate-core)

> One Gateway for All WebSearch/WebFetch Providers!

## 语言

[English](README.md)

## 来源小故事

过去, 我们通过搜索引擎寻找信息; 如今, Agent 已经能够自主搜索、浏览网页, 获取外部世界的知识, 但 Agent 不再使用传统搜索引擎

问题也随之而来

不同 `WebSearch / WebFetch` 提供商的搜索质量、Token 消耗、价格和免费额度各不相同

想要充分利用这些，却不得不引入一大堆各种提供商的 `MCP`，实在有些坐牢...

**既然如此，为什么不把它们统一起来呢?**

这就是 **[`web-rotate-core`](https://github.com/Sn0wo2/web-rotate-core)** 想要解决的问题（以下简称 `core`）

**`core`** **是一个库**，你可以依赖它来给你的任意 Node 生态接入

## 生态

当然啦, 如果你想要开箱即用的 `MCP`, 我们也在 `core` 的基础上实现好了 [`web-rotate-mcp`](https://github.com/Sn0wo2/web-rotate-mcp)

如果你恰好用的是 `OpenCode2` 那么, 你可以直接用 [`oc-web-rotate`](https://github.com/Sn0wo2/oc-web-rotate)

## 权重

默认权重参考了 [WebSearch Rank Index](./benchmark/websearch/README.md) 和 [WebFetch Rank Index](./benchmark/webfetch/README.md)。

## 目前 `core` 原生支持的提供商

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
- Native 内置实现 `Keyless`

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
- Native 内置实现 `Keyless`

如果现有的这些提供商都没有满足你, 你也可以给 `core` 轻松扩展你自己想要的提供商
