# web-rotate-core

> One Gateway for All WebSearch/WebFetch Providers!

## 来源小故事

过去, 我们通过搜索引擎寻找信息; 如今, Agent 已经能够自主搜索、浏览网页, 获取外部世界的知识, 但 Agent 不再使用传统搜索引擎

问题也随之而来

不同 `WebSearch / WebFetch` 提供商的搜索质量、Token 消耗、价格和免费额度各不相同

想要充分利用这些，却不得不引入一大堆各种提供商的 `MCP`，实在有些坐牢...

**既然如此，为什么不把它们统一起来呢?**

这就是 **[`web-rotate-core`](https://github.com/Sn0wo2/web-rotate-core)** 想要解决的问题（以下简称 `core`）

**`core` 是一个库**，你可以依赖它来给你的任意 Node 生态接入

## 生态

当然啦, 如果你想要开箱即用的 `MCP`, 我们也在 `core` 的基础上实现好了 [`web-rotate-mcp`](https://github.com/Sn0wo2/web-rotate-mcp)

如果你恰好用的是 `OpenCode2` 那么, 你可以直接用 [`oc-web-rotate`](https://github.com/Sn0wo2/oc-web-rotate)

## 权重和Benchmark

在 WebSearch 方面，默认路由权重参考了 [Artificial Analysis 的 Search API 评测](https://artificialanalysis.ai/agents/search-api)

---

WebFetch 方面我们使用了自己的 [WebFetch Benchmark](./BENCHMARK.md)

使用 `jev v1.13` 来作为裁判模型, 对各个 `WebFetch` 提供商的结果进行打分

不过毕竟是个人项目, 所以 benchmark 肯定没有那么标准, 而且 jev 的 context 少的可怜（32k）甚至不一定能塞满一个 native webfetch（作为基准）的结果和盲测提供商的 webfetch 结果

所以你仍然可以根据自己的标准来调整每个 `WebSearch / WebFetch` 提供商的权重

## 目前 `core` 原生支持的提供商

按默认路由优先级排列, 给提供商名称 trim space 后 lowercase 就是提供商`id`啦

### WebSearch

- [Perplexity](https://www.perplexity.ai)
- [Octen](https://octen.ai)
- [Tavily](https://www.tavily.com)
- [Parallel](https://parallel.ai)
- [You.com](https://you.com)
- [Nimble](https://nimbleway.com)
- [Exa](https://exa.ai)
- [Brave Search](https://brave.com/search/api)
- [HyperBrowser](https://hyperbrowser.ai)
- [Firecrawl](https://www.firecrawl.dev)
- [TinyFish](https://www.tinyfish.ai)
- [Keenable](https://keenable.ai)
- [Serper](https://serper.dev)
- [Bocha](https://bochaai.com)
- [Jina](https://jina.ai)
- [ScrapingBee](https://www.scrapingbee.com)
- [Diffbot](https://www.diffbot.com)
- [Bright Data](https://brightdata.com)
- [Linkup](https://www.linkup.so)
- [Doubao](https://www.volcengine.com)
- [OpenAI](https://openai.com)
- Native 内置实现

### WebFetch

- [Tavily](https://www.tavily.com)
- [Parallel](https://parallel.ai)
- [You.com](https://you.com)
- [Exa](https://exa.ai)
- [HyperBrowser](https://hyperbrowser.ai)
- [Firecrawl](https://www.firecrawl.dev)
- [TinyFish](https://www.tinyfish.ai)
- [Jina](https://jina.ai)
- [ScrapingAnt](https://scrapingant.com)
- [ScrapingBee](https://www.scrapingbee.com)
- [ScrapFly](https://scrapfly.io)
- [Diffbot](https://www.diffbot.com)
- [Bright Data](https://brightdata.com)
- [Apify](https://apify.com)
- [Linkup](https://www.linkup.so)
- Native 内置实现

如果现有的这些提供商都没有满足你, 你也可以给 `core` 轻松扩展你自己想要的提供商

# 文档

这个中文`README-zh-CN.md`是纯手写的啦, 放心看, 不过 en-US `README.md`是用AI翻译的
所以我基本没有写代码文档, 你可以在 https://deepwiki.com/Sn0wo2/web-rotate-core 查看代码文档
