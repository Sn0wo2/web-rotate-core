import type {
  FetchFormat,
  FetchPage,
  RotateContext,
  SearchQueries,
  URLList,
} from "./util";
import { isPlainObject as isRecord } from "es-toolkit/predicate";
import {
  configuredEnvironmentValue,
  configuredString,
  firstList,
  pickPath,
  providerResult,
  stringValue,
} from "./util";
import {
  REQUEST_TIMEOUT_MS,
  USER_AGENT,
  apiJSON,
  checkedResponseText,
} from "./http";
import { mcpCall, mcpPayload } from "./mcp";

export const RESULTS_PER_SEARCH = 8;
export const TARGET_USER_AGENT =
  "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot";

const CLIENT_NAME = "web-rotate";

type FetchCall = (
  key: string | undefined,
  urls: URLList,
  signal: AbortSignal,
  ctx: RotateContext,
  format: FetchFormat,
) => Promise<FetchPage[]>;

function fetchOne(
  run: (
    key: string | undefined,
    url: string,
    signal: AbortSignal,
    ctx: RotateContext,
    format: FetchFormat,
  ) => Promise<{ content: string }>,
): FetchCall {
  return async (key, urls, signal, ctx, format) =>
    Promise.all(
      urls.map(async (url) => {
        try {
          return {
            url,
            content: (await run(key, url, signal, ctx, format)).content,
          };
        } catch (error) {
          return {
            url,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      }),
    );
}

function restSearch(
  url: string,
  body: (queries: SearchQueries) => unknown,
  headers: (key: string | undefined) => Record<string, string>,
  select: (payload: unknown) => unknown,
): (
  key: string | undefined,
  queries: SearchQueries,
  signal: AbortSignal,
) => Promise<unknown> {
  return async (key, queries, signal) =>
    select(
      await apiJSON(url, signal, {
        body: body(queries),
        headers: headers(key),
      }),
    );
}

const tavilySearchBody = (queries: SearchQueries) => ({
  query: queries[0],
  search_depth: "basic",
  chunks_per_source: 3,
  max_results: RESULTS_PER_SEARCH,
});

export const PROVIDERS = [
  {
    id: "perplexity",
    weight: 10,
    keyEnv: ["PERPLEXITY_API_KEY", "PERPLEXITY_SEARCH_API_KEY"],
    search: {
      run: restSearch(
        "https://api.perplexity.ai/search",
        (queries) => ({
          query: queries.length === 1 ? queries[0] : queries,
          max_results: RESULTS_PER_SEARCH,
          search_context_size: "low",
        }),
        (key) => (key ? { Authorization: `Bearer ${key}` } : {}),
        (payload) => (isRecord(payload) ? payload.results : payload),
      ),
    },
  },
  {
    id: "octen",
    weight: 10,
    keyEnv: ["OCTEN_API_KEY"],
    search: {
      run: restSearch(
        "https://api.octen.ai/search",
        (queries) => ({ query: queries.join("; "), count: RESULTS_PER_SEARCH }),
        (key) => (key ? { Authorization: `Bearer ${key}` } : {}),
        (payload) => pickPath(payload, "data", "results"),
      ),
    },
  },
  {
    id: "tavily",
    weight: 7,
    fetch: {
      keyless: true,
      run: async (key, urls, signal, _ctx, requestedFormat) => {
        const format = requestedFormat === "text" ? "text" : "markdown";
        const payload = await apiJSON(
          "https://api.tavily.com/extract",
          signal,
          {
            label: "tavily",
            body: { urls, extract_depth: "basic", format },
            key,
            headers: key ? {} : { "X-Tavily-Access-Mode": "keyless" },
          },
        );
        const raw = firstList(payload);
        return urls.map((url, index) => {
          const item = isRecord(raw[index]) ? raw[index] : undefined;
          const content = stringValue(item?.raw_content);
          return content
            ? { url, content }
            : { url, error: stringValue(item?.error) ?? "empty content" };
        });
      },
    },
    search: {
      keyless: true,
      run: async (key, queries, signal) =>
        key
          ? mcpPayload(
              await mcpCall(
                "https://mcp.tavily.com/mcp/",
                { Authorization: `Bearer ${key}` },
                "tavily-search",
                {
                  query: queries[0],
                  max_results: RESULTS_PER_SEARCH,
                  search_depth: "basic",
                },
                signal,
                { client: CLIENT_NAME, timeoutMs: REQUEST_TIMEOUT_MS },
              ),
            )
          : apiJSON("https://api.tavily.com/search", signal, {
              body: tavilySearchBody(queries),
              headers: {
                "X-Client-Name": "opencode2",
                "X-Tavily-Access-Mode": "keyless",
              },
            }),
    },
  },
  {
    id: "parallel",
    weight: 7,
    keyEnv: ["PARALLEL_API_KEY"],
    fetch: {
      run: async (key, urls, signal) => {
        const payload = await apiJSON(
          "https://api.parallel.ai/v1/extract",
          signal,
          {
            label: "parallel",
            body: { urls, advanced_settings: { full_content: true } },
            headers: { "x-api-key": key! },
          },
        );
        const raw = firstList(payload);
        return urls.map((url, index) => {
          const item = isRecord(raw[index]) ? raw[index] : undefined;
          const content =
            (typeof item?.full_content === "string" && item.full_content
              ? item.full_content
              : undefined) ??
            (Array.isArray(item?.excerpts)
              ? item.excerpts
                  .filter((value) => typeof value === "string")
                  .join("\n\n")
              : undefined);
          const error = item ? stringValue(item.error) : undefined;
          return content
            ? { url, content }
            : { url, error: error ?? "empty content" };
        });
      },
    },
    search: {
      keyless: true,
      run: async (key, queries, signal) => {
        if (!key) {
          return mcpPayload(
            await mcpCall(
              "https://search.parallel.ai/mcp",
              {},
              "web_search",
              { objective: queries[0], search_queries: [queries[0]] },
              signal,
              { client: CLIENT_NAME, timeoutMs: REQUEST_TIMEOUT_MS },
            ),
          );
        }
        return apiJSON("https://api.parallel.ai/v1/search", signal, {
          body: {
            objective: queries[0],
            search_queries: queries,
            max_results: RESULTS_PER_SEARCH,
          },
          headers: { "x-api-key": key },
        });
      },
    },
  },
  {
    id: "you",
    weight: 7,
    keyEnv: ["YDC_API_KEY", "YOU_API_KEY"],
    fetch: {
      run: async (key, urls, signal, _ctx, requestedFormat) => {
        const format = requestedFormat === "html" ? "html" : "markdown";
        const payload = await apiJSON(
          "https://ydc-index.io/v1/contents",
          signal,
          {
            label: "you",
            body: { urls, formats: [format] },
            headers: { "X-API-Key": key! },
          },
        );
        const raw = Array.isArray(payload) ? payload : [];
        return urls.map((url, index) => {
          const item = isRecord(raw[index]) ? raw[index] : undefined;
          const content = stringValue(item?.[format]);
          return content ? { url, content } : { url, error: "empty content" };
        });
      },
    },
    search: {
      run: async (key, queries, signal) => {
        const payload = await apiJSON(
          "https://ydc-index.io/v1/search",
          signal,
          {
            label: "you",
            body: {
              query: queries[0],
              extraction: { extraction_mode: "highlights" },
            },
            headers: { "X-API-Key": key! },
          },
        );
        const results =
          isRecord(payload) && isRecord(payload.results) ? payload.results : {};
        return (
          Array.isArray(payload)
            ? payload
            : [
                ...(Array.isArray(results.web) ? results.web : []),
                ...(Array.isArray(results.news) ? results.news : []),
              ]
        )
          .filter(isRecord)
          .map((item) => ({
            ...item,
            content:
              (Array.isArray(item.snippets)
                ? item.snippets.map(stringValue).filter(Boolean).join("\n")
                : "") || item.content,
          }));
      },
    },
  },
  {
    id: "nimble",
    weight: 7,
    keyEnv: ["NIMBLE_API_KEY"],
    search: {
      run: restSearch(
        "https://sdk.nimbleway.com/v2/search",
        (queries) => ({
          query: queries[0],
          search_depth: "lite",
          max_results: RESULTS_PER_SEARCH,
        }),
        (key) => (key ? { Authorization: `Bearer ${key}` } : {}),
        (payload) => (isRecord(payload) ? payload.results : payload),
      ),
    },
  },
  {
    id: "exa",
    weight: 7,
    fetch: {
      run: async (key, urls, signal, _ctx, requestedFormat) => {
        const payload = await apiJSON("https://api.exa.ai/contents", signal, {
          label: "exa",
          body: {
            urls,
            text: requestedFormat === "html" ? { includeHtmlTags: true } : true,
          },
          key: key!,
        });
        const raw = firstList(payload);
        return urls.map((url, index) => {
          const item = isRecord(raw[index]) ? raw[index] : undefined;
          const content = stringValue(item?.text);
          return content ? { url, content } : { url, error: "empty content" };
        });
      },
    },
    search: {
      keyless: true,
      run: async (key, queries, signal) => {
        const text = (
          await mcpCall(
            "https://mcp.exa.ai/mcp",
            key ? { "x-api-key": key } : {},
            "web_search_exa",
            { query: queries[0], numResults: RESULTS_PER_SEARCH },
            signal,
            { client: CLIENT_NAME, timeoutMs: REQUEST_TIMEOUT_MS },
          )
        ).content?.find((part) => part.type === "text")?.text;
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
        return blocks;
      },
    },
  },
  {
    id: "brave",
    weight: 7,
    keyEnv: ["BRAVE_API_KEY", "BRAVE_SEARCH_API_KEY"],
    search: {
      run: async (key, queries, signal) => {
        const endpoint = new URL(
          "https://api.search.brave.com/res/v1/web/search",
        );
        endpoint.searchParams.set("q", queries[0]);
        endpoint.searchParams.set("count", String(RESULTS_PER_SEARCH));
        return apiJSON(endpoint.toString(), signal, {
          headers: {
            Accept: "application/json",
            "X-Subscription-Token": key!,
          },
        });
      },
      select: (payload) =>
        isRecord(payload) &&
        isRecord(payload.web) &&
        Array.isArray(payload.web.results)
          ? payload.web.results
          : undefined,
    },
  },
  {
    id: "hyperbrowser",
    weight: 5,
    keyEnv: ["HYPERBROWSER_API_KEY"],
    fetch: {
      run: fetchOne(async (key, url, signal, _ctx, requestedFormat) => {
        const format = requestedFormat === "html" ? "html" : "markdown";
        const payload = await apiJSON(
          "https://api.hyperbrowser.ai/api/web/fetch",
          signal,
          {
            label: "hyperbrowser",
            body: { url, outputs: { formats: [format] } },
            headers: { "x-api-key": key! },
          },
        );
        const content = stringValue(pickPath(payload, "data", format));
        return providerResult(content);
      }),
    },
    search: {
      run: restSearch(
        "https://api.hyperbrowser.ai/api/web/search",
        (queries) => ({
          query: queries.length === 1 ? queries[0] : queries,
          max_results: RESULTS_PER_SEARCH,
        }),
        (key) => ({ "x-api-key": key! }),
        (payload) => pickPath(payload, "data", "results"),
      ),
    },
  },
  {
    id: "firecrawl",
    weight: 5,
    fetch: {
      keyless: true,
      run: fetchOne(async (key, url, signal, _ctx, requestedFormat) => {
        const providerFormat =
          requestedFormat === "html" ? "rawHtml" : "markdown";
        const payload = await apiJSON(
          "https://api.firecrawl.dev/v2/scrape",
          signal,
          {
            label: "firecrawl",
            body: {
              url,
              formats: [providerFormat],
              ...(providerFormat === "markdown"
                ? { onlyMainContent: true }
                : {}),
              headers: { "User-Agent": TARGET_USER_AGENT },
            },
            key,
          },
        );
        const data =
          isRecord(payload) && isRecord(payload.data) ? payload.data : {};
        const content = stringValue(
          providerFormat === "rawHtml"
            ? (data.rawHtml ?? data.html)
            : data.markdown,
        );
        return providerResult(content);
      }),
    },
    search: {
      keyless: true,
      keylessEnabled: (ctx) => {
        const value =
          ctx.getOption("firecrawlKeyless") ??
          configuredEnvironmentValue(ctx, "FIRECRAWL_KEYLESS");
        return (
          value === true ||
          ["1", "true", "yes", "on"].includes(String(value).toLowerCase())
        );
      },
      run: restSearch(
        "https://api.firecrawl.dev/v2/search",
        (queries) => ({ query: queries[0], limit: RESULTS_PER_SEARCH }),
        (key) => (key ? { "X-API-Key": key } : {}),
        (payload) => pickPath(payload, "data", "web"),
      ),
    },
  },
  {
    id: "tinyfish",
    weight: 5,
    keyEnv: ["TINYFISH_API_KEY"],
    fetch: {
      run: async (key, urls, signal, _ctx, requestedFormat) => {
        const format = requestedFormat === "html" ? "html" : "markdown";
        const payload = await apiJSON("https://api.fetch.tinyfish.ai", signal, {
          label: "tinyfish",
          body: { urls, format },
          headers: { "X-API-Key": key! },
        });
        const raw = firstList(payload);
        const errors =
          isRecord(payload) && Array.isArray(payload.errors)
            ? payload.errors
            : [];
        return urls.map((url, index) => {
          const item = isRecord(raw[index]) ? raw[index] : undefined;
          const content = stringValue(item?.text);
          const error = isRecord(errors[index])
            ? stringValue(errors[index].error)
            : undefined;
          return content
            ? { url, content }
            : { url, error: error ?? "empty content" };
        });
      },
    },
    search: {
      run: async (key, queries, signal) =>
        apiJSON(
          `https://api.search.tinyfish.ai?query=${encodeURIComponent(queries[0])}`,
          signal,
          {
            headers: { "X-API-Key": key! },
          },
        ),
    },
  },
  {
    id: "keenable",
    weight: 5,
    keyEnv: ["KEENABLE_API_KEY"],
    search: {
      keyless: true,
      run: async (key, queries, signal) => {
        const payload = await apiJSON(
          key
            ? "https://api.keenable.ai/v1/search"
            : "https://api.keenable.ai/v1/search/public",
          signal,
          {
            body: { query: queries[0], max_results: RESULTS_PER_SEARCH },
            headers: key
              ? { "X-API-Key": key }
              : { "X-Keenable-Title": CLIENT_NAME },
          },
        );
        return isRecord(payload) ? payload.results : payload;
      },
    },
  },
  {
    id: "tavily-keyless-fallback",
    weight: 3,
    search: {
      keyless: true,
      run: async (key, queries, signal) => {
        const payload = await apiJSON("https://api.tavily.com/search", signal, {
          body: tavilySearchBody(queries),
          key,
          headers: key ? {} : { "X-Tavily-Access-Mode": "keyless" },
        });
        return isRecord(payload) ? payload.results : payload;
      },
    },
  },
  {
    id: "serper",
    weight: 1,
    keyEnv: ["SERPER_API_KEY"],
    search: {
      run: restSearch(
        "https://google.serper.dev/search",
        (queries) => ({ q: queries[0] }),
        (key) => ({ "X-API-Key": key! }),
        (payload) => (isRecord(payload) ? payload.organic : payload),
      ),
    },
  },
  {
    id: "bocha",
    weight: 1,
    keyEnv: ["BOCHA_API_KEY"],
    search: {
      run: restSearch(
        "https://api.bochaai.com/v1/web-search",
        (queries) => ({
          query: queries[0],
          count: RESULTS_PER_SEARCH,
          summary: true,
        }),
        (key) => (key ? { Authorization: `Bearer ${key}` } : {}),
        (payload) => pickPath(payload, "data", "webPages", "value"),
      ),
    },
  },
  {
    id: "jina",
    fetch: {
      keyless: true,
      run: fetchOne(async (key, url, signal, _ctx, format) => {
        const response = await fetch(
          `https://r.jina.ai/${encodeURIComponent(url)}`,
          {
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
            },
            signal,
            redirect: "error",
          },
        );
        return providerResult(await checkedResponseText(response, "jina"));
      }),
    },
    search: {
      run: async (key, queries, signal) => {
        if (!key) throw new Error("jina API key is not configured for search");
        return apiJSON(
          `https://s.jina.ai/${encodeURIComponent(queries[0])}`,
          signal,
          {
            headers: { Authorization: `Bearer ${key}` },
          },
        );
      },
      select: (payload) => {
        if (Array.isArray(payload)) {
          return payload.flatMap((item) =>
            isRecord(item) && Array.isArray(item.data) ? item.data : [],
          );
        }
        return isRecord(payload) && Array.isArray(payload.data)
          ? payload.data
          : payload;
      },
    },
  },
  {
    id: "scrapingant",
    fetch: {
      run: fetchOne(async (key, url, signal, _ctx, format) => {
        const endpoint = new URL(
          format === "html"
            ? "https://api.scrapingant.com/v2/general"
            : `https://api.scrapingant.com/v2/${format === "text" ? "extended" : "markdown"}`,
        );
        endpoint.searchParams.set("url", url);
        endpoint.searchParams.set("x-api-key", key!);
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
        );
      }),
    },
  },
  {
    id: "scrapingbee",
    fetch: {
      run: fetchOne(async (key, url, signal, _ctx, format) => {
        const endpoint = new URL("https://app.scrapingbee.com/api/v1");
        endpoint.searchParams.set("url", url);
        if (format === "markdown")
          endpoint.searchParams.set("return_page_markdown", "true");
        else if (format === "text")
          endpoint.searchParams.set("return_page_text", "true");
        endpoint.searchParams.set("forward_headers_pure", "true");
        endpoint.searchParams.set("render_js", "false");
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
                Authorization: `Bearer ${key!}`,
                "User-Agent": USER_AGENT,
                "Spb-User-Agent": TARGET_USER_AGENT,
              },
              signal,
              redirect: "error",
            }),
            "scrapingbee",
          ),
        );
      }),
    },
    search: {
      run: async (key, queries, signal) => {
        const endpoint = new URL("https://app.scrapingbee.com/api/v1/google");
        endpoint.searchParams.set("search", queries[0]);
        return apiJSON(endpoint.toString(), signal, {
          headers: {
            Authorization: `Bearer ${key!}`,
            Accept: "application/json",
          },
        });
      },
      select: (payload) =>
        isRecord(payload) && Array.isArray(payload.organic_results)
          ? payload.organic_results
          : payload,
    },
  },
  {
    id: "scrapfly",
    fetch: {
      run: fetchOne(async (key, url, signal, _ctx, requestedFormat) => {
        const endpoint = new URL("https://api.scrapfly.io/scrape");
        endpoint.searchParams.set("key", key!);
        endpoint.searchParams.set("url", url);
        endpoint.searchParams.set(
          "format",
          requestedFormat === "html" ? "raw" : requestedFormat,
        );
        endpoint.searchParams.set("headers[user-agent]", TARGET_USER_AGENT);
        const payload = await apiJSON(endpoint.toString(), signal, {
          label: "scrapfly",
        });
        return providerResult(
          isRecord(payload) && isRecord(payload.result)
            ? payload.result.content
            : undefined,
        );
      }),
    },
  },
  {
    id: "diffbot",
    keyEnv: ["DIFFBOT_API_KEY", "DIFFBOT_TOKEN"],
    fetch: {
      run: fetchOne(async (key, url, signal, _ctx, requestedFormat) => {
        const endpoint = new URL("https://api.diffbot.com/v3/article");
        endpoint.searchParams.set("token", key!);
        endpoint.searchParams.set("url", url);
        if (requestedFormat === "html")
          endpoint.searchParams.set("fields", "html");
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
          requestedFormat === "html" ? item?.html : item?.text,
        );
      }),
    },
    search: {
      run: async (key, queries, signal) => {
        const endpoint = new URL("https://llm.diffbot.com/api/v1/web_search");
        endpoint.searchParams.set("text", queries[0]);
        return apiJSON(endpoint.toString(), signal, {
          headers: { Authorization: `Bearer ${key!}` },
        });
      },
      select: (payload) => {
        if (isRecord(payload) && Array.isArray(payload.results))
          return payload.results;
        if (isRecord(payload) && Array.isArray(payload.objects))
          return payload.objects;
        return payload;
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
      run: fetchOne(async (key, url, signal, ctx, requestedFormat) => {
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
        const format = requestedFormat === "html" ? "html" : "markdown";
        return providerResult(
          await checkedResponseText(
            await fetch("https://api.brightdata.com/request", {
              method: "POST",
              headers: {
                Accept: "text/markdown, text/plain;q=0.9",
                Authorization: `Bearer ${key!}`,
                "Content-Type": "application/json",
                "User-Agent": USER_AGENT,
              },
              body: JSON.stringify({
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
        );
      }),
    },
    search: {
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
        return apiJSON("https://api.brightdata.com/request", signal, {
          headers: { Authorization: `Bearer ${key!}` },
          body: { zone, url: searchURL.toString(), format: "json" },
        });
      },
      select: (payload) => {
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
      },
    },
  },
  {
    id: "apify",
    keyEnv: ["APIFY_API_KEY", "APIFY_API_TOKEN"],
    fetch: {
      run: fetchOne(async (key, url, signal, ctx, format) => {
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
        endpoint.searchParams.set("token", key!);
        const payload = await apiJSON(endpoint.toString(), signal, {
          label: "apify",
          body: {
            startUrls: [{ url }],
            crawlerType: "playwright:firefox",
            maxCrawlPages: 1,
            ...(format === "markdown" ? { saveMarkdown: true } : {}),
            ...(format === "html" ? { saveHtml: true } : {}),
            proxyConfiguration: { useApifyProxy: true },
          },
        });
        return providerResult(
          Array.isArray(payload) && isRecord(payload[0])
            ? payload[0][format]
            : undefined,
        );
      }),
    },
  },
  {
    id: "linkup",
    weight: 3,
    keyEnv: ["LINKUP_API_KEY"],
    search: {
      run: restSearch(
        "https://api.linkup.so/v1/search",
        (queries) => ({
          query: queries[0],
          depth: "standard",
          outputType: "searchResults",
        }),
        (key) => (key ? { Authorization: `Bearer ${key}` } : {}),
        (payload) => (isRecord(payload) ? payload.results : payload),
      ),
    },
    fetch: {
      run: fetchOne(async (key, url, signal) => {
        const payload = await apiJSON(
          "https://api.linkup.so/v1/fetch",
          signal,
          {
            label: "linkup",
            body: { url },
            headers: { Authorization: `Bearer ${key!}` },
          },
        );
        return providerResult(
          isRecord(payload)
            ? (stringValue(payload.content) ?? stringValue(payload.markdown))
            : undefined,
        );
      }),
    },
  },
  {
    id: "doubao",
    search: {
      run: async (key, queries, signal) =>
        apiJSON("https://open.feedcoopapi.com/search_api/web_search", signal, {
          headers: key ? { Authorization: `Bearer ${key}` } : {},
          body: {
            Query: queries[0],
            SearchType: "web",
            Count: RESULTS_PER_SEARCH,
            NeedSummary: true,
          },
        }),
      select: (payload) => {
        const result =
          isRecord(payload) && isRecord(payload.Result) ? payload.Result : {};
        return (Array.isArray(result.WebResults) ? result.WebResults : [])
          .filter(isRecord)
          .map((item) => ({
            url: stringValue(item.Url),
            title: stringValue(item.Title),
            snippet: stringValue(item.Snippet) ?? stringValue(item.Summary),
          }));
      },
    },
  },
] satisfies {
  id: string;
  weight?: number;
  keyEnv?: readonly string[];
  fetch?: { run: FetchCall; keyless?: boolean };
  search?: {
    run: (
      key: string | undefined,
      queries: SearchQueries,
      signal: AbortSignal,
      ctx: RotateContext,
    ) => Promise<unknown>;
    keyless?: boolean;
    keylessEnabled?: (ctx: RotateContext) => boolean;
    select?: (payload: unknown) => unknown;
  };
}[];
