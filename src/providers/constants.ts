import { chunk, compact } from "es-toolkit/array";
import { mapValues, pickBy } from "es-toolkit/object";
import get from "es-toolkit/compat/get";
import { isPlainObject as isRecord } from "es-toolkit/predicate";
import {
  configuredEnvironmentValue,
  configuredString,
  providerOptions,
  stringValue,
} from "../core/config";
import { apiJSON, checkedResponseText } from "../core/http";
import { requestConcurrency } from "../core/utils";
import { mcpCall } from "../core/mcp";
import type { FetchFormat, SearchResult, SearchResponse } from "../core/types";
import type { Provider } from "./types";
import {
  fetchOne,
  fetchPages,
  fetchBatches,
  firstList,
  providerResult,
  requireKey,
  restSearch,
  searchCount,
  searchResponse,
  urlParams,
} from "./utils";

export const TARGET_USER_AGENT =
  "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot";

const PLUGIN_ID = "web-rotate";
const USER_AGENT = "opencode2-web-rotate/1.0.0";

function braveResults(payload: unknown): unknown {
  const grounding =
    isRecord(payload) && isRecord(payload.grounding)
      ? payload.grounding
      : undefined;
  if (grounding && Array.isArray(grounding.generic)) {
    const sources =
      isRecord(payload) && isRecord(payload.sources) ? payload.sources : {};
    return grounding.generic.filter(isRecord).map((item) => {
      const meta = sources[stringValue(item.url) ?? ""];
      return {
        ...item,
        publish_date:
          stringValue(get(meta, "age.3")) ?? stringValue(get(meta, "age.1")),
      };
    });
  }
  return payload;
}

function brightdataResults(payload: unknown): unknown {
  let source = payload;
  if (isRecord(source) && typeof source.body === "string") {
    try {
      source = JSON.parse(source.body);
    } catch {}
  }
  if (!isRecord(source) || !Array.isArray(source.organic)) return [];
  return source.organic.filter(isRecord).map((item) => ({
    url: stringValue(item.link) ?? stringValue(item.url),
    title: stringValue(item.title),
    description:
      stringValue(item.desc) ??
      stringValue(item.description) ??
      stringValue(item.snippet),
  }));
}

const APIFY_CONTENT_FIELDS: Record<FetchFormat, readonly FetchFormat[]> = {
  html: ["html", "text", "markdown"],
  text: ["text", "markdown", "html"],
  markdown: ["markdown", "text", "html"],
};

export const PROVIDERS: readonly Provider[] = [
  {
    id: "perplexity",
    keyEnv: ["PERPLEXITY_API_KEY", "PERPLEXITY_SEARCH_API_KEY"],
    search: {
      weight: 80,
      batchSize: Infinity,
      run: restSearch(
        "https://api.perplexity.ai/search",
        (queries, ctx) => {
          const { search_context_size, ...options } = providerOptions(
            ctx,
            "perplexity",
            "search",
          );
          return {
            search_type: "fast",
            ...options,
            query: queries.length === 1 ? queries[0] : queries,
            max_results: searchCount(
              ctx,
              options.search_type === "people" ? 50 : 20,
            ),
            ...(options.max_tokens == null &&
            options.max_tokens_per_page == null
              ? { search_context_size: search_context_size ?? "low" }
              : {}),
          };
        },
        (key) => (key ? { Authorization: `Bearer ${key}` } : {}),
      ),
    },
  },
  {
    id: "octen",
    keyEnv: ["OCTEN_API_KEY"],
    search: {
      weight: 80,
      run: restSearch(
        "https://api.octen.ai/search",
        (queries, ctx) => ({
          highlight: { enable: true, max_tokens: 300 },
          format: "text",
          ...providerOptions(ctx, "octen", "search"),
          query: queries[0],
          count: searchCount(ctx),
        }),
        (key) => (key ? { Authorization: `Bearer ${key}` } : {}),
        (payload) => get(payload, "data.results"),
      ),
    },
  },
  {
    id: "tavily",
    fetch: {
      weight: 75,
      keyless: true,
      formats: ["text", "markdown"],
      run: async (key, urls, signal, ctx, format) => {
        const options = providerOptions(ctx, "tavily", "fetch");
        const batches = await fetchBatches(
          chunk(urls, 20),
          async (batch) => {
            const payload = await apiJSON(
              "https://api.tavily.com/extract",
              signal,
              {
                label: "tavily",
                body: {
                  extract_depth: "basic",
                  ...options,
                  urls: batch,
                  format,
                },
                key,
                headers: key ? {} : { "X-Tavily-Access-Mode": "keyless" },
              },
            );
            return fetchPages(
              batch,
              payload,
              (item) =>
                stringValue(item.raw_content) ?? stringValue(item.content),
              format,
            );
          },
          requestConcurrency(ctx, "fetch"),
          signal,
        );
        return batches.flat();
      },
    },
    search: {
      weight: 67,
      keyless: true,
      run: restSearch(
        "https://api.tavily.com/search",
        (queries, ctx) => ({
          search_depth: "basic",
          chunks_per_source: 1,
          include_answer: false,
          include_raw_content: false,
          auto_parameters: false,
          topic: "general",
          ...providerOptions(ctx, "tavily", "search"),
          query: queries[0],
          max_results: searchCount(ctx, 20),
        }),
        (key) => ({
          ...(key ? { Authorization: `Bearer ${key}` } : {}),
          "X-Client-Name": "opencode2",
          ...(key ? {} : { "X-Tavily-Access-Mode": "keyless" }),
        }),
      ),
    },
  },
  {
    id: "parallel",
    keyEnv: ["PARALLEL_API_KEY"],
    fetch: {
      weight: 72,
      formats: ["markdown"],
      run: async (key, urls, signal, ctx, format) => {
        const options = providerOptions(ctx, "parallel", "fetch");
        const { advanced_settings, ...rest } = options;
        const advanced = isRecord(advanced_settings) ? advanced_settings : {};
        const batches = await fetchBatches(
          chunk(urls, 20),
          async (batch) => {
            const payload = await apiJSON(
              "https://api.parallel.ai/v1/extract",
              signal,
              {
                label: "parallel",
                body: {
                  ...rest,
                  urls: batch,
                  advanced_settings: {
                    full_content: false,
                    ...advanced,
                  },
                },
                headers: { "x-api-key": requireKey("parallel", key) },
              },
            );
            return fetchPages(
              batch,
              payload,
              (item) =>
                stringValue(item.raw_content) ??
                stringValue(item.full_content) ??
                (Array.isArray(item.excerpts)
                  ? compact(item.excerpts.map(stringValue)).join("\n\n") ||
                    undefined
                  : undefined),
              format,
            );
          },
          requestConcurrency(ctx, "fetch"),
          signal,
        );
        return batches.flat();
      },
    },
    search: {
      weight: 74,
      keyless: true,
      batchSize: Infinity,
      run: async (key, queries, signal, ctx) => {
        if (!key) {
          const result = await mcpCall(
            "https://search.parallel.ai/mcp",
            {},
            "web_search",
            { objective: queries[0], search_queries: queries },
            signal,
          );
          return searchResponse(
            result.structuredContent ??
              JSON.parse(
                result.content.find((part) => part.type === "text")?.text ??
                  "null",
              ),
          );
        }
        const options = providerOptions(ctx, "parallel", "search");
        const { mode, advanced_settings, max_results, processor, ...rest } =
          options;
        const advanced = isRecord(advanced_settings) ? advanced_settings : {};
        const payload = await apiJSON(
          "https://api.parallel.ai/v1/search",
          signal,
          {
            body: {
              mode: stringValue(mode) ?? "fast",
              ...rest,
              objective: queries[0],
              search_queries: queries,
              advanced_settings: {
                ...advanced,
                excerpt_settings: {
                  max_chars_per_result: 1000,
                  ...(isRecord(advanced.excerpt_settings)
                    ? advanced.excerpt_settings
                    : {}),
                },
                max_results: max_results ?? searchCount(ctx, 20),
              },
            },
            headers: { "x-api-key": key },
          },
        );
        return searchResponse(payload);
      },
    },
  },
  {
    id: "you",
    keyEnv: ["YDC_API_KEY", "YOU_API_KEY"],
    fetch: {
      weight: 70,
      formats: ["html", "markdown"],
      run: async (key, urls, signal, ctx, format) => {
        const options = providerOptions(ctx, "you", "fetch");
        const batches = await fetchBatches(
          chunk(urls, 10),
          async (batch) => {
            const payload = await apiJSON(
              "https://ydc-index.io/v1/contents",
              signal,
              {
                label: "you",
                body: {
                  crawl_timeout: 10,
                  ...options,
                  urls: batch,
                  formats: [format],
                },
                headers: { "X-API-Key": requireKey("you", key) },
              },
            );
            return fetchPages(
              batch,
              payload,
              (item) => stringValue(item[format]),
              format,
            );
          },
          requestConcurrency(ctx, "fetch"),
          signal,
        );
        return batches.flat();
      },
    },
    search: {
      weight: 74,
      run: async (key, queries, signal, ctx) => {
        const payload = await apiJSON(
          "https://ydc-index.io/v1/search",
          signal,
          {
            label: "you",
            body: {
              extraction: { extraction_mode: "highlights" },
              safesearch: "moderate",
              ...providerOptions(ctx, "you", "search"),
              query: queries[0],
              count: searchCount(ctx),
            },
            headers: { "X-API-Key": requireKey("you", key) },
          },
        );
        const grouped =
          isRecord(payload) && isRecord(payload.results) ? payload.results : {};
        const items = (
          Array.isArray(payload)
            ? payload
            : [
                ...(Array.isArray(grouped.web) ? grouped.web : []),
                ...(Array.isArray(grouped.news) ? grouped.news : []),
              ]
        ).map((item) => {
          if (!isRecord(item)) return item;
          const contents = isRecord(item.contents) ? item.contents : {};
          return Array.isArray(contents.highlights) && item.highlights == null
            ? { ...item, highlights: contents.highlights }
            : item;
        });
        return searchResponse(payload, items);
      },
    },
  },
  {
    id: "nimble",
    keyEnv: ["NIMBLE_API_KEY"],
    search: {
      weight: 72,
      run: restSearch(
        "https://sdk.nimbleway.com/v2/search",
        (queries, ctx) => ({
          search_depth: "standard",
          focus: "general",
          output_format: "plain_text",
          full_content: false,
          ...providerOptions(ctx, "nimble", "search"),
          query: queries[0],
          max_results: searchCount(ctx),
        }),
        (key) => (key ? { Authorization: `Bearer ${key}` } : {}),
      ),
    },
  },
  {
    id: "exa",
    fetch: {
      weight: 76,
      formats: ["markdown"],
      run: async (key, urls, signal, ctx, format) => {
        const options = providerOptions(ctx, "exa", "fetch");
        const payload = await apiJSON("https://api.exa.ai/contents", signal, {
          label: "exa",
          body: {
            ...options,
            format: "markdown",
            urls,
            text: {
              ...(isRecord(options.text) ? options.text : {}),
            },
          },
          key: requireKey("exa", key),
        });
        return fetchPages(
          urls,
          payload,
          (item) => stringValue(item.text),
          format,
        );
      },
    },
    search: {
      weight: 73,
      keyless: true,
      run: async (key, queries, signal, ctx) => {
        if (!key) {
          const result = await mcpCall(
            "https://mcp.exa.ai/mcp",
            {},
            "web_search_exa",
            { query: queries[0], numResults: searchCount(ctx) },
            signal,
          );
          if (result.structuredContent != null)
            return searchResponse(result.structuredContent);
          const text = result.content.find(
            (part) => part.type === "text",
          )?.text;
          const blocks: Record<string, unknown>[] = [];
          for (const block of text?.split(/\n\n---\n\n/) ?? []) {
            const url = block.match(/^URL:\s*(.+)$/m)?.[1]?.trim();
            if (url)
              blocks.push({
                url,
                title: block.match(/^Title:\s*(.+)$/m)?.[1]?.trim(),
                content: block
                  .match(/^(?:Highlights|Text):\s*([\s\S]*)$/m)?.[1]
                  ?.trim(),
                publish_date: block.match(/^Published:\s*(.+)$/m)?.[1]?.trim(),
              });
          }
          return blocks.length
            ? searchResponse(blocks)
            : { results: [], ...(text ? { metadata: { text } } : {}) };
        }
        const options = providerOptions(ctx, "exa", "search");
        const payload = await apiJSON("https://api.exa.ai/search", signal, {
          body: {
            type: "auto",
            ...options,
            query: queries[0],
            numResults: searchCount(ctx),
            contents: {
              highlights: { maxCharacters: 1000 },
              ...(isRecord(options.contents) ? options.contents : {}),
            },
          },
          headers: { "x-api-key": key },
        });
        return searchResponse(payload);
      },
    },
  },
  {
    id: "brave",
    keyEnv: ["BRAVE_API_KEY", "BRAVE_SEARCH_API_KEY"],
    search: {
      weight: 75,
      run: async (key, queries, signal, ctx) => {
        const token = requireKey("brave", key);
        const { api, ...rest } = providerOptions(ctx, "brave", "search");
        const payload = await apiJSON(
          (() => {
            if (api === "web") {
              const endpoint = urlParams(
                new URL("https://api.search.brave.com/res/v1/web/search"),
                { extra_snippets: true, ...rest },
              );
              endpoint.searchParams.set("count", String(searchCount(ctx, 20)));
              endpoint.searchParams.set("result_filter", "web");
              endpoint.searchParams.set("q", queries[0]);
              return endpoint.toString();
            }
            const endpoint = urlParams(
              new URL("https://api.search.brave.com/res/v1/llm/context"),
              {
                maximum_number_of_urls: searchCount(ctx, 50),
                maximum_number_of_tokens: 1024,
                maximum_number_of_tokens_per_url: 512,
                maximum_number_of_snippets: 16,
                maximum_number_of_snippets_per_url: 2,
                context_threshold_mode: "balanced",
                enable_source_metadata: false,
                ...rest,
              },
            );
            endpoint.searchParams.set("count", String(searchCount(ctx, 50)));
            endpoint.searchParams.set("q", queries[0]);
            return endpoint.toString();
          })(),
          signal,
          {
            headers: {
              Accept: "application/json",
              "X-Subscription-Token": token,
            },
          },
        );
        return searchResponse(payload, braveResults(payload));
      },
    },
  },
  {
    id: "hyperbrowser",
    keyEnv: ["HYPERBROWSER_API_KEY"],
    fetch: {
      weight: 56,
      formats: ["html", "markdown"],
      run: fetchOne(async (key, url, signal, ctx, format) => {
        const options = providerOptions(ctx, "hyperbrowser", "fetch");
        const payload = await apiJSON(
          "https://api.hyperbrowser.ai/api/web/fetch",
          signal,
          {
            label: "hyperbrowser",
            body: {
              ...options,
              url,
              outputs: {
                ...(isRecord(options.outputs) ? options.outputs : {}),
                formats: [format],
              },
            },
            headers: { "x-api-key": requireKey("hyperbrowser", key) },
          },
        );
        return providerResult(
          stringValue(get(payload, ["data", format])),
          format,
        );
      }),
    },
    search: {
      weight: 45,
      run: restSearch(
        "https://api.hyperbrowser.ai/api/web/search",
        (queries, ctx) => ({
          page: 1,
          ...providerOptions(ctx, "hyperbrowser", "search"),
          query: queries[0],
        }),
        (key) => ({ "x-api-key": requireKey("hyperbrowser", key) }),
        (payload) => get(payload, "data.results"),
      ),
    },
  },
  {
    id: "firecrawl",
    fetch: {
      weight: 78,
      keyless: true,
      formats: ["html", "markdown"],
      run: fetchOne(async (key, url, signal, ctx, format) => {
        const providerFormat = format === "html" ? "rawHtml" : "markdown";
        const payload = await apiJSON(
          "https://api.firecrawl.dev/v2/scrape",
          signal,
          {
            label: "firecrawl",
            body: {
              maxAge: 172_800_000,
              onlyMainContent: providerFormat === "markdown",
              headers: { "User-Agent": TARGET_USER_AGENT },
              ...providerOptions(ctx, "firecrawl", "fetch"),
              url,
              formats: [providerFormat],
            },
            key,
          },
        );
        const data: Record<string, unknown> =
          isRecord(payload) && isRecord(payload.data) ? payload.data : {};
        return providerResult(
          stringValue(
            providerFormat === "rawHtml"
              ? (data.rawHtml ?? data.html)
              : data.markdown,
          ),
          providerFormat === "rawHtml" ? "html" : "markdown",
        );
      }),
    },
    search: {
      weight: 71,
      keyless: true,
      keylessEnabled: (ctx) => {
        const value =
          ctx.getOption("firecrawlKeyless") ??
          configuredEnvironmentValue(ctx, "FIRECRAWL_KEYLESS") ??
          true;
        return (
          value === true ||
          ["1", "true", "yes", "on"].includes(String(value).toLowerCase())
        );
      },
      run: restSearch(
        "https://api.firecrawl.dev/v2/search",
        (queries, ctx) => ({
          ...providerOptions(ctx, "firecrawl", "search"),
          query: queries[0],
          limit: searchCount(ctx),
        }),
        (key) => (key ? { Authorization: `Bearer ${key}` } : {}),
        (payload) => firstList(get(payload, "data")),
      ),
    },
  },
  {
    id: "tinyfish",
    keyEnv: ["TINYFISH_API_KEY"],
    fetch: {
      weight: 67,
      formats: ["html", "markdown"],
      run: async (key, urls, signal, ctx, format) => {
        const options = providerOptions(ctx, "tinyfish", "fetch");
        const batches = await fetchBatches(
          chunk(urls, 10),
          async (batch) => {
            const payload = await apiJSON(
              "https://api.fetch.tinyfish.ai",
              signal,
              {
                label: "tinyfish",
                body: { ...options, urls: batch, format },
                headers: { "X-API-Key": requireKey("tinyfish", key) },
              },
            );
            return fetchPages(
              batch,
              payload,
              (item) => stringValue(item.text),
              format,
            );
          },
          requestConcurrency(ctx, "fetch"),
          signal,
        );
        return batches.flat();
      },
    },
    search: {
      weight: 72,
      run: async (key, queries, signal, ctx) => {
        const endpoint = urlParams(
          new URL("https://api.search.tinyfish.ai"),
          { domain_type: "web", ...providerOptions(ctx, "tinyfish", "search") },
          (_name, value) =>
            Array.isArray(value) ? value.join(",") : undefined,
        );
        endpoint.searchParams.set("query", queries[0]);
        return searchResponse(
          await apiJSON(endpoint.toString(), signal, {
            headers: { "X-API-Key": requireKey("tinyfish", key) },
          }),
        );
      },
    },
  },
  {
    id: "keenable",
    keyEnv: ["KEENABLE_API_KEY"],
    search: {
      weight: 60,
      keyless: true,
      run: async (key, queries, signal, ctx) => {
        const payload = await apiJSON(
          key
            ? "https://api.keenable.ai/v1/search"
            : "https://api.keenable.ai/v1/search/public",
          signal,
          {
            body: {
              mode: "pro",
              snippet_max_length: 1000,
              ...providerOptions(ctx, "keenable", "search"),
              query: queries[0],
              max_results: searchCount(ctx, 50),
            },
            headers: key
              ? { "X-API-Key": key }
              : { "X-Keenable-Title": PLUGIN_ID },
          },
        );
        return searchResponse(payload);
      },
    },
  },
  {
    id: "serper",
    keyEnv: ["SERPER_API_KEY"],
    search: {
      weight: 62,
      run: restSearch(
        "https://google.serper.dev/search",
        (queries, ctx) => ({
          ...providerOptions(ctx, "serper", "search"),
          q: queries[0],
          num: searchCount(ctx),
        }),
        (key) => ({ "X-API-Key": requireKey("serper", key) }),
      ),
    },
  },
  {
    id: "bocha",
    keyEnv: ["BOCHA_API_KEY"],
    search: {
      weight: 55,
      run: restSearch(
        "https://api.bochaai.com/v1/web-search",
        (queries, ctx) => ({
          summary: true,
          ...providerOptions(ctx, "bocha", "search"),
          query: queries[0],
          count: searchCount(ctx, 50),
        }),
        (key) => (key ? { Authorization: `Bearer ${key}` } : {}),
        (payload) => get(payload, "data.webPages.value"),
      ),
    },
  },
  {
    id: "jina",
    fetch: {
      weight: 80,
      keyless: true,
      formats: ["text", "markdown", "html"],
      run: fetchOne(async (key, url, signal, ctx, format) => {
        const headers = get(providerOptions(ctx, "jina", "fetch"), "headers");
        const response = await fetch(`https://r.jina.ai/${url}`, {
          headers: {
            Accept:
              format === "html"
                ? "text/html, text/plain;q=0.9"
                : format === "text"
                  ? "text/plain"
                  : "text/markdown, text/plain;q=0.9",
            ...(key ? { Authorization: `Bearer ${key}` } : {}),
            "User-Agent": USER_AGENT,
            "X-User-Agent": TARGET_USER_AGENT,
            "X-Respond-With": format,
            ...mapValues(
              pickBy(
                isRecord(headers) ? headers : {},
                (value) => value != null && typeof value !== "object",
              ),
              String,
            ),
          },
          signal,
          redirect: "error",
        });
        const contentType = (
          response.headers.get("content-type") ?? ""
        ).toLowerCase();
        return providerResult(
          await checkedResponseText(response, "jina"),
          contentType.includes("html")
            ? "html"
            : contentType.includes("markdown")
              ? "markdown"
              : contentType.includes("plain")
                ? "text"
                : format,
        );
      }),
    },
    search: {
      weight: 58,
      run: async (key, queries, signal, ctx) => {
        if (!key) throw new Error("jina API key is not configured for search");
        const { headers, ...options } = providerOptions(ctx, "jina", "search");
        const endpoint = urlParams(new URL("https://s.jina.ai"), {
          num: searchCount(ctx, 20),
          ...options,
          q: queries[0],
        });
        const payload = await apiJSON(endpoint.toString(), signal, {
          headers: {
            Authorization: `Bearer ${key}`,
            "X-Respond-With": "no-content",
            ...mapValues(
              pickBy(
                isRecord(headers) ? headers : {},
                (value) => value != null && typeof value !== "object",
              ),
              String,
            ),
          },
        });
        return searchResponse(
          payload,
          Array.isArray(payload)
            ? payload.flatMap((item) =>
                isRecord(item) && Array.isArray(item.data) ? item.data : [item],
              )
            : undefined,
        );
      },
    },
  },
  {
    id: "scrapingant",
    fetch: {
      weight: 58,
      formats: ["html", "markdown", "text"],
      run: fetchOne(async (key, url, signal, ctx, format) => {
        const endpoint = urlParams(
          new URL(
            format === "html"
              ? "https://api.scrapingant.com/v2/general"
              : `https://api.scrapingant.com/v2/${format === "text" ? "extended" : "markdown"}`,
          ),
          {
            browser: "false",
            proxy_type: "datacenter",
            ...providerOptions(ctx, "scrapingant", "fetch"),
          },
        );
        endpoint.searchParams.set("url", url);
        endpoint.searchParams.set("x-api-key", requireKey("scrapingant", key));
        if (format === "html") {
          return providerResult(
            await checkedResponseText(
              await fetch(endpoint, {
                headers: {
                  Accept: "text/html, */*;q=0.1",
                  "User-Agent": USER_AGENT,
                  "Ant-Custom-Header-User-Agent": TARGET_USER_AGENT,
                },
                signal,
                redirect: "error",
              }),
              "scrapingant",
            ),
            "html",
          );
        }
        const payload = await apiJSON(endpoint.toString(), signal, {
          label: "scrapingant",
          headers: { "Ant-Custom-Header-User-Agent": TARGET_USER_AGENT },
        });
        return providerResult(
          isRecord(payload)
            ? payload[format === "text" ? "text" : "markdown"]
            : undefined,
          format,
        );
      }),
    },
  },
  {
    id: "scrapingbee",
    fetch: {
      weight: 60,
      formats: ["html", "markdown", "text"],
      run: fetchOne(async (key, url, signal, ctx, format) => {
        const endpoint = urlParams(
          new URL("https://app.scrapingbee.com/api/v1"),
          {
            forward_headers_pure: true,
            render_js: false,
            ...providerOptions(ctx, "scrapingbee", "fetch"),
          },
        );
        endpoint.searchParams.set("url", url);
        if (format === "markdown")
          endpoint.searchParams.set("return_page_markdown", "true");
        else if (format === "text")
          endpoint.searchParams.set("return_page_text", "true");
        return providerResult(
          await checkedResponseText(
            await fetch(endpoint, {
              headers: {
                Accept:
                  format === "html"
                    ? "text/html, text/plain;q=0.9"
                    : format === "text"
                      ? "text/plain"
                      : "text/markdown, text/plain;q=0.9",
                Authorization: `Bearer ${requireKey("scrapingbee", key)}`,
                "User-Agent": USER_AGENT,
                "Spb-User-Agent": TARGET_USER_AGENT,
              },
              signal,
              redirect: "error",
            }),
            "scrapingbee",
          ),
          format,
        );
      }),
    },
    search: {
      weight: 48,
      run: async (key, queries, signal, ctx) => {
        const endpoint = urlParams(
          new URL("https://app.scrapingbee.com/api/v1/google"),
          providerOptions(ctx, "scrapingbee", "search"),
        );
        endpoint.searchParams.set("search", queries[0]);
        const payload = await apiJSON(endpoint.toString(), signal, {
          headers: {
            Authorization: `Bearer ${requireKey("scrapingbee", key)}`,
            Accept: "application/json",
          },
        });
        return searchResponse(
          payload,
          isRecord(payload) && Array.isArray(payload.organic_results)
            ? payload.organic_results
            : payload,
        );
      },
    },
  },
  {
    id: "scrapfly",
    fetch: {
      weight: 58,
      formats: ["html", "markdown", "text"],
      run: fetchOne(async (key, url, signal, ctx, format) => {
        const options = providerOptions(ctx, "scrapfly", "fetch");
        const endpoint = urlParams(
          new URL("https://api.scrapfly.io/scrape"),
          {
            render_js: "false",
            asp: "false",
            proxy_pool: "datacenter",
            ...options,
            headers: {
              "user-agent": TARGET_USER_AGENT,
              ...(isRecord(options.headers) ? options.headers : {}),
            },
          },
          (name, value) => {
            if (
              (name === "js_scenario" || name === "extraction_template") &&
              typeof value !== "string"
            )
              return new TextEncoder().encode(JSON.stringify(value)).toBase64();
            if (
              (name === "headers" || name === "screenshots") &&
              isRecord(value)
            )
              return Object.entries(value)
                .filter(([, item]) => item != null)
                .map(
                  ([itemKey, item]) =>
                    [`${name}[${itemKey}]`, String(item)] as const,
                );
            return undefined;
          },
        );
        endpoint.searchParams.set("key", requireKey("scrapfly", key));
        endpoint.searchParams.set("url", url);
        endpoint.searchParams.set("format", format === "html" ? "raw" : format);
        const payload = await apiJSON(endpoint.toString(), signal, {
          label: "scrapfly",
        });
        return providerResult(
          isRecord(payload) && isRecord(payload.result)
            ? payload.result.content
            : undefined,
          format,
        );
      }),
    },
  },
  {
    id: "diffbot",
    keyEnv: ["DIFFBOT_API_KEY", "DIFFBOT_TOKEN"],
    fetch: {
      weight: 62,
      formats: ["html", "text"],
      run: fetchOne(async (key, url, signal, ctx, format) => {
        const endpoint = urlParams(
          new URL("https://api.diffbot.com/v3/article"),
          {
            paging: "false",
            discussion: "false",
            timeout: 30000,
            ...providerOptions(ctx, "diffbot", "fetch"),
          },
        );
        endpoint.searchParams.set("token", requireKey("diffbot", key));
        endpoint.searchParams.set("url", url);
        if (format === "html") endpoint.searchParams.set("fields", "html");
        const payload = await apiJSON(endpoint.toString(), signal, {
          label: "diffbot",
        });
        const item =
          isRecord(payload) &&
          Array.isArray(payload.objects) &&
          isRecord(payload.objects[0])
            ? payload.objects[0]
            : undefined;
        return providerResult(
          format === "html" ? item?.html : item?.text,
          format,
        );
      }),
    },
    search: {
      weight: 50,
      batchSize: 5,
      run: async (key, queries, signal, ctx) => {
        const payload = await apiJSON(
          "https://llm.diffbot.com/api/v1/web_search",
          signal,
          {
            label: "diffbot",
            body: {
              maxTokens: 2000,
              ...providerOptions(ctx, "diffbot", "search"),
              text: queries,
              size: searchCount(ctx),
            },
            headers: {
              Authorization: `Bearer ${requireKey("diffbot", key)}`,
            },
          },
        );
        return searchResponse(payload);
      },
    },
  },
  {
    id: "brightdata",
    keyEnv: [
      "BRIGHTDATA_API_KEY",
      "BRIGHTDATA_API_TOKEN",
      "BRIGHT_DATA_API_KEY",
      "BRIGHT_DATA_API_TOKEN",
    ],
    fetch: {
      weight: 62,
      formats: ["html", "markdown"],
      run: fetchOne(async (key, url, signal, ctx, format) => {
        const zone = configuredString(
          ctx,
          [
            "brightdataZone",
            "brightDataZone",
            "bright_data_zone",
            "BRIGHTDATA_ZONE",
          ],
          ["BRIGHTDATA_ZONE", "BRIGHT_DATA_ZONE"],
        );
        if (!zone) throw new Error("brightdata zone is not configured");
        return providerResult(
          await checkedResponseText(
            await fetch("https://api.brightdata.com/request", {
              method: "POST",
              headers: {
                Accept: "text/markdown, text/plain;q=0.9",
                Authorization: `Bearer ${requireKey("brightdata", key)}`,
                "Content-Type": "application/json",
                "User-Agent": USER_AGENT,
              },
              body: JSON.stringify({
                ...providerOptions(ctx, "brightdata", "fetch"),
                zone,
                url,
                format: "raw",
                ...(format === "markdown" ? { data_format: "markdown" } : {}),
              }),
              signal,
              redirect: "error",
            }),
            "brightdata",
          ),
          format,
        );
      }),
    },
    search: {
      weight: 50,
      run: async (key, queries, signal, ctx) => {
        const zone = configuredString(
          ctx,
          [
            "brightdataSerpZone",
            "brightDataSerpZone",
            "bright_data_serp_zone",
            "BRIGHTDATA_SERP_ZONE",
          ],
          ["BRIGHTDATA_SERP_ZONE", "BRIGHT_DATA_SERP_ZONE"],
        );
        if (!zone) throw new Error("brightdata SERP zone is not configured");
        const searchURL = new URL("https://www.google.com/search");
        searchURL.searchParams.set("q", queries[0]);
        searchURL.searchParams.set("brd_json", "1");
        const payload = await apiJSON(
          "https://api.brightdata.com/request",
          signal,
          {
            headers: {
              Authorization: `Bearer ${requireKey("brightdata", key)}`,
            },
            body: {
              ...providerOptions(ctx, "brightdata", "search"),
              zone,
              url: searchURL.toString(),
              format: "json",
            },
          },
        );
        return searchResponse(payload, brightdataResults(payload));
      },
    },
  },
  {
    id: "apify",
    keyEnv: ["APIFY_API_KEY", "APIFY_API_TOKEN"],
    fetch: {
      weight: 57,
      formats: ["html", "markdown", "text"],
      run: async (key, urls, signal, ctx, format) => {
        const endpoint = new URL(
          `https://api.apify.com/v2/actors/${encodeURIComponent(
            configuredString(
              ctx,
              [
                "apifyActorID",
                "apifyActorId",
                "apify_actor_id",
                "APIFY_ACTOR_ID",
              ],
              ["APIFY_ACTOR_ID"],
            ) ?? "apify~website-content-crawler",
          )}/run-sync-get-dataset-items`,
        );
        endpoint.searchParams.set("token", requireKey("apify", key));
        const payload = await apiJSON(endpoint.toString(), signal, {
          label: "apify",
          body: {
            crawlerType: "cheerio",
            maxCrawlPages: urls.length,
            maxCrawlDepth: 0,
            maxRequestRetries: 3,
            removeCookieWarnings: true,
            ...(format === "markdown" ? { saveMarkdown: true } : {}),
            ...(format === "html" ? { saveHtml: true } : {}),
            proxyConfiguration: { useApifyProxy: true },
            ...providerOptions(ctx, "apify", "fetch"),
            startUrls: urls.map((url) => ({ url })),
          },
        });
        const dataset = new Map<string, Record<string, unknown>>();
        for (const row of Array.isArray(payload) ? payload : []) {
          if (!isRecord(row)) continue;
          const itemURL = stringValue(row.url);
          if (!itemURL) continue;
          dataset.set(itemURL, row);
          const trimmed = itemURL.replace(/\/+$/, "");
          if (trimmed && !dataset.has(trimmed)) dataset.set(trimmed, row);
        }
        return urls.map((url) => {
          const item = dataset.get(url) ?? dataset.get(url.replace(/\/+$/, ""));
          if (!item) return { url, error: "no dataset item matched the URL" };
          for (const name of APIFY_CONTENT_FIELDS[format]) {
            const value = stringValue(item[name]);
            if (value) return { url, content: value, format: name };
          }
          return { url, error: stringValue(item.error) ?? "empty content" };
        });
      },
    },
  },
  {
    id: "linkup",
    keyEnv: ["LINKUP_API_KEY"],
    search: {
      weight: 68,
      run: restSearch(
        "https://api.linkup.so/v1/search",
        (queries, ctx) => ({
          depth: "standard",
          ...providerOptions(ctx, "linkup", "search"),
          outputType: "searchResults",
          q: queries[0],
          maxResults: searchCount(ctx),
        }),
        (key) => (key ? { Authorization: `Bearer ${key}` } : {}),
      ),
    },
    fetch: {
      weight: 68,
      formats: ["markdown"],
      run: fetchOne(async (key, url, signal, ctx) => {
        const payload = await apiJSON(
          "https://api.linkup.so/v1/fetch",
          signal,
          {
            label: "linkup",
            body: { ...providerOptions(ctx, "linkup", "fetch"), url },
            headers: {
              Authorization: `Bearer ${requireKey("linkup", key)}`,
            },
          },
        );
        return providerResult(
          isRecord(payload)
            ? (stringValue(payload.content) ?? stringValue(payload.markdown))
            : undefined,
          "markdown",
        );
      }),
    },
  },
  {
    id: "doubao",
    search: {
      weight: 54,
      run: restSearch(
        "https://open.feedcoopapi.com/search_api/web_search",
        (queries, ctx) => ({
          SearchType: "web",
          NeedSummary: true,
          ...providerOptions(ctx, "doubao", "search"),
          Query: queries[0],
          Count: searchCount(ctx),
        }),
        (key) => (key ? { Authorization: `Bearer ${key}` } : {}),
        (payload) => {
          const result = isRecord(payload) ? payload.Result : undefined;
          const rows = isRecord(result) ? result.WebResults : undefined;
          return (Array.isArray(rows) ? rows : [])
            .filter(isRecord)
            .map((item) => ({
              url: stringValue(item.Url),
              title: stringValue(item.Title),
              snippet: stringValue(item.Snippet) ?? stringValue(item.Summary),
            }));
        },
      ),
    },
  },
  {
    id: "openai",
    keyEnv: ["OPENAI_API_KEY"],
    search: {
      weight: 66,
      run: async (key, queries, signal, ctx) => {
        const {
          model,
          instructions,
          max_output_tokens,
          reasoning,
          search_context_size,
          filters,
          user_location,
          external_web_access,
          return_token_budget,
          ...rest
        } = providerOptions(ctx, "openai", "search");
        const selectedModel =
          stringValue(model) ??
          configuredString(ctx, ["openaiModel"], ["OPENAI_MODEL"]) ??
          "gpt-5-mini";
        const payload = await apiJSON(
          "https://api.openai.com/v1/responses",
          signal,
          {
            label: "openai",
            headers: {
              Authorization: `Bearer ${requireKey("openai", key)}`,
            },
            body: {
              model: selectedModel,
              instructions:
                stringValue(instructions) ??
                `Search the web. Return at most ${searchCount(ctx)} concise factual snippets, one per line with an inline citation. Do not write a long-form answer.`,
              max_output_tokens:
                typeof max_output_tokens === "number"
                  ? max_output_tokens
                  : 2048,
              ...(isRecord(reasoning)
                ? { reasoning }
                : selectedModel === "gpt-5-mini"
                  ? { reasoning: { effort: "low" } }
                  : {}),
              max_tool_calls: 1,
              store: false,
              ...rest,
              tool_choice: "required",
              include: ["web_search_call.action.sources"],
              tools: [
                {
                  type: "web_search",
                  search_context_size:
                    stringValue(search_context_size) ?? "medium",
                  ...(isRecord(filters) ? { filters } : {}),
                  ...(isRecord(user_location) ? { user_location } : {}),
                  ...(external_web_access != null
                    ? { external_web_access }
                    : {}),
                  ...(return_token_budget != null
                    ? { return_token_budget }
                    : {}),
                },
              ],
              input: queries[0],
            },
          },
        );
        const output =
          isRecord(payload) && Array.isArray(payload.output)
            ? payload.output
            : [];
        let answer = "";
        const citations: NonNullable<SearchResponse["citations"]> = [];
        const results = new Map<string, SearchResult>();
        for (const item of output) {
          if (
            !isRecord(item) ||
            item.type !== "message" ||
            !Array.isArray(item.content)
          )
            continue;
          for (const part of item.content) {
            if (!isRecord(part) || typeof part.text !== "string") continue;
            answer = answer ? `${answer}\n${part.text}` : part.text;
            for (const annotation of Array.isArray(part.annotations)
              ? part.annotations
              : []) {
              if (!isRecord(annotation) || annotation.type !== "url_citation")
                continue;
              const url = stringValue(annotation.url);
              if (!url) continue;
              const title = stringValue(annotation.title);
              citations.push({
                url,
                ...(title ? { title } : {}),
                ...(typeof annotation.start_index === "number"
                  ? { start: annotation.start_index }
                  : {}),
                ...(typeof annotation.end_index === "number"
                  ? { end: annotation.end_index }
                  : {}),
              });
              const existing = results.get(url);
              if (!existing) results.set(url, title ? { url, title } : { url });
              else if (title && !existing.title)
                results.set(url, { ...existing, title });
            }
          }
        }
        for (const item of output) {
          if (!isRecord(item) || item.type !== "web_search_call") continue;
          const action = isRecord(item.action) ? item.action : undefined;
          for (const source of Array.isArray(action?.sources)
            ? action.sources
            : []) {
            const url = stringValue(isRecord(source) ? source.url : undefined);
            if (url && !results.has(url)) results.set(url, { url });
          }
        }
        return {
          ...searchResponse(
            payload,
            [...results.values()],
            answer || undefined,
          ),
          ...(citations.length ? { citations } : {}),
        };
      },
    },
  },
];
