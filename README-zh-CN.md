# web-rotate-core

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

外部评测结果见 [WebSearch 最终排名索引](./benchmark/websearch/README.md)和 [WebFetch 最终排名索引](./benchmark/webfetch/README.md)。各目录附有来源整理，记录评测方法、数据日期、供应商覆盖和限制。

WebSearch 引用外部已发布的具体 API 配置成绩。WebFetch 将抓取成功率与正文质量分开，明确标注厂商自办评测，不为未排名供应商编造分数。

排名索引不会自动更新代码中的默认路由权重，你仍可自行配置各供应商权重。旧 Jev 自评仅保留为[历史记录](./benchmark/webfetch/legacy-jev.md)，不纳入当前外部排名。

## 目前 `core` 原生支持的提供商

按默认路由优先级排列, 给提供商名称 trim space 后 lowercase 就是提供商`id`啦

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
- Native 内置实现 `Keyless`

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
- Native 内置实现 `Keyless`

如果现有的这些提供商都没有满足你, 你也可以给 `core` 轻松扩展你自己想要的提供商

## 可观测性: Attempts 与 Usage

每次 `searchWeb` / `fetchWeb` 的 outcome 都会携带结构化、机器可读的 attempt 级诊断数据, 供监控界面(例如 TUI)渲染。key 本身永远不会出现——只有索引与 tier:

- **`attempts[]`** — 每次提供商路由尝试一条记录: `provider`、`keyless`、`keyIndex`(该提供商去重后的 key 列表中的 0-based 下标)、`tier`、`queries` / `urls`、`durationMs`、`ok`、`error`(包括跳过原因, 例如某提供商因无效请求错误被拉黑)。outcome 级缓存读取会显示为 `provider: "cache"`、`cached: true` 的条目; 普通条目上的 `cached` 字段预留给自行上报缓存命中的提供商。当全部尝试失败时, 抛出的 `Error` 会附带同样的 `attempts` 数组。
- **`usage[]`** — 按提供商(配置了 tier 则再按 tier 分档)聚合: `requests`(已发起的提供商调用数)、`results`(搜索) / `pages`(抓取)原始数量、`errors`。与一份你自己的价目表相乘即可估算费用——定价刻意不放进 `core`, 各家 API 也不返回计费数据。
- **归属** — 搜索失败的 `errors[]` 会标注 `provider`, 抓取失败页保留其 `provider`, 图片结果报告 `provider: "native"`。

key 还可以携带 tier 元数据: `keys` 的每一项可以是原来的纯字符串, 也可以是 `{ key, tier?, weight? }` 对象, 或使用内联的 `"<tier>::<key>"` 字符串语法。per-key `weight` 会覆盖该 key 路由的提供商权重。keyless 免费路由同样可以用保留 key 值 `"keyless"` 挂上 tier——内联写法(`"free::keyless"`)或对象写法(`{ key: "keyless", tier: "free", weight? }`)——给免费路由打档并通过 per-route `weight` 调整排序(纯 keyed 提供商遇到该标记会报配置错误)。outcome 级缓存可以通过在配置里传入 `new LRUCache({ cap })` 作为 `cache` 来启用(并以 `cacheWindowSeconds` 作为其 TTL)。

# 文档

代码文档可在 <https://deepwiki.com/Sn0wo2/web-rotate-core> 查看
