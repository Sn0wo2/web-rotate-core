# web-rotate-core

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/Sn0wo2/web-rotate-core)

> One Gateway for All WebSearch/WebFetch Providers!

## 语言

[English](README.md) | [简体中文](README-zh-CN.md)

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

## 权重和Benchmark

外部评测结果见 [WebSearch Index](./benchmark/websearch/README.md)和 [WebFetch Index](./benchmark/webfetch/README.md)。各目录附有来源整理，记录评测方法、数据日期、供应商覆盖和限制。

WebSearch 引用外部已发布的具体 API 配置成绩。WebFetch 将抓取成功率与正文质量分开，明确标注厂商自办评测，不为未排名供应商编造分数。

默认路由权重已参考当前索引人工核对并同步；未获得可比结果的提供商及未受测配置保留原有策略权重。你仍可自行配置提供商和单 Key 的权重。

## 目前 `core` 原生支持的提供商

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
- Native 内置实现 `Keyless`
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
- Native 内置实现 `Keyless`
- [Zhipu](https://open.bigmodel.cn)

如果现有的这些提供商都没有满足你, 你也可以给 `core` 轻松扩展你自己想要的提供商
