# web-rotate-core

> One Gateway for All WebSearch/WebFetch Providers!

## Language

- [README-zh-CN.md](./README-zh-CN.md)

## Origin Story

We used to find information through search engines; today, Agents can search and browse the web on their own, gathering knowledge from the outside world — but they no longer use traditional search engines.

And problems come with it.

Different `WebSearch / WebFetch` providers vary in search quality, token consumption, pricing, and free quotas.

To make the most of them all, you'd have to pull in a whole pile of provider `MCP`s — which honestly feels like a prison sentence...

**So why not just unify them?**

That's exactly what **[`web-rotate-core`](https://github.com/Sn0wo2/web-rotate-core)** aims to solve (hereinafter referred to as `core`).

**`core` is a library** — depend on it to plug into any Node-based ecosystem.

## Ecosystem

Of course, if you want a ready-to-use `MCP`, we've also built [`web-rotate-mcp`](https://github.com/Sn0wo2/web-rotate-mcp) on top of `core`.

And if you happen to be using `OpenCode2`, you can go straight for [`oc-web-rotate`](https://github.com/Sn0wo2/oc-web-rotate).

## Weights and Benchmark

For WebSearch, the default routing weights are based on [Artificial Analysis's Search API Index](https://artificialanalysis.ai/agents/search-api).

---

For WebFetch, we use our own [WebFetch Benchmark](./benchmark/README.md).

It uses `jev v1.13` as the judge model to score the results of each `WebFetch` provider.

That said, this is a personal project, so the benchmark is admittedly not that rigorous — plus jev's context is pitifully small (32k), sometimes not even enough to fit the result of a native webfetch (as the baseline) together with a blind-tested provider's webfetch result.

So you can still adjust the weight of each `WebSearch / WebFetch` provider according to your own standards.

## Providers currently natively supported by `core`

Listed by default routing priority. To get a provider's `id`, just take its name, trim the spaces, and lowercase it.

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
- Native built-in implementation

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
- Native built-in implementation

If none of the existing providers works for you, you can also easily extend `core` with your own.

# Documentation

The Chinese `README-zh-CN.md` is fully handwritten, so read it with confidence — the en-US `README.md` is AI-translated, though.

That's why I basically haven't written any code documentation — you can find it at https://deepwiki.com/Sn0wo2/web-rotate-core
