import { chunk, compact, uniq } from "es-toolkit/array";
import { search as googleSearchAPI, OrganicResult } from "google-sr";
import {
  SafeSearchType,
  search as duckDuckGoSearchAPI,
} from "duck-duck-scrape";
import { XMLParser } from "fast-xml-parser";
import { PROVIDERS } from "./providers/constants";
import { searchCount } from "./providers/utils";
import { HTTPError, timedSignal } from "./core/http";
import { orderedProviderRoutes, resolveMaxAttempts } from "./core/rotation";
import {
  RotateConfigError,
  configuredString,
  stringValue,
} from "./core/config";
import { mapConcurrent, requestConcurrency } from "./core/utils";
import type {
  RotateContext,
  SearchQueries,
  SearchResponse,
  SearchResult,
} from "./core/types";

export type SearchOutcome = {
  results: SearchResult[];
  responses: (Omit<SearchResponse, "results"> & {
    provider: string;
    queries: string[];
  })[];
  errors?: { query: string; error: string }[];
};

const SERP_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const xmlParser = new XMLParser({ ignoreAttributes: true });

const SERP_ENGINES: {
  search: (
    query: string,
    count: number,
    signal: AbortSignal,
  ) => Promise<SearchResult[]>;
}[] = [
  {
    search: async (query, count, signal) => {
      const results = await googleSearchAPI({
        query,
        parsers: [OrganicResult],
        noPartialResults: true,
        requestConfig: { signal: timedSignal(signal) },
      });
      return results.slice(0, count).flatMap((result) =>
        result.link
          ? [
              {
                url: result.link,
                ...(result.title ? { title: result.title } : {}),
                ...(result.description
                  ? { snippets: [result.description] }
                  : {}),
                provider: "google-serp",
                queries: [query],
              },
            ]
          : [],
      );
    },
  },
  {
    search: async (query, count, signal) => {
      const url = new URL("https://www.bing.com/search");
      url.searchParams.set("q", query);
      url.searchParams.set("format", "rss");
      url.searchParams.set("count", String(Math.min(Math.max(count, 1), 30)));
      url.searchParams.set("mkt", "en-US");
      const response = await fetch(url, {
        headers: {
          Accept: "application/rss+xml, application/xml, text/xml",
          "User-Agent": SERP_USER_AGENT,
        },
        signal: timedSignal(signal),
      });
      const channel = xmlParser.parse(await response.text())?.rss?.channel;
      const items: {
        link?: string;
        title?: string;
        description?: string;
      }[] = Array.isArray(channel?.item)
        ? channel.item
        : channel?.item
          ? [channel.item]
          : [];
      if (!response.ok || !items.length)
        throw new HTTPError(
          response.status,
          `bing rss returned ${response.status} with no items`,
        );
      return items.slice(0, count).flatMap((item) =>
        item.link
          ? [
              {
                url: item.link,
                ...(item.title ? { title: item.title } : {}),
                ...(item.description ? { snippets: [item.description] } : {}),
                provider: "bing-serp",
                queries: [query],
              },
            ]
          : [],
      );
    },
  },
  {
    search: async (query, count) => {
      const results = await duckDuckGoSearchAPI(
        query,
        { safeSearch: SafeSearchType.OFF },
        {
          headers: { "User-Agent": SERP_USER_AGENT },
          timeout: 30_000,
          response_timeout: 30_000,
        },
      );
      return results.results.slice(0, count).map((result) => ({
        url: result.url,
        ...(result.title ? { title: result.title } : {}),
        ...(result.description ? { snippets: [result.description] } : {}),
        provider: "duckduckgo-serp",
        queries: [query],
      }));
    },
  },
];

export function newWebSearch(ctx: RotateContext): {
  search(input: {
    queries: SearchQueries;
    signal: AbortSignal;
  }): Promise<SearchOutcome>;
} {
  const failures = new Map<string, number>();
  return {
    search: async ({ queries, signal }) => {
      signal.throwIfAborted();
      if (!queries.length || queries.some((query) => !query.trim()))
        throw new RotateConfigError("search queries must not be empty");
      const uniqueQueries = uniq(queries.map((query) => query.trim()));
      const mode =
        configuredString(ctx, ["mode"], ["WEBSEARCH_MODE"]) ?? "auto";
      const maxResults = searchCount(ctx);
      const pins = compact(
        [ctx.getOption("provider")]
          .flatMap((value) => (Array.isArray(value) ? value : [value]))
          .map(stringValue),
      );
      const routes = orderedProviderRoutes(
        PROVIDERS.flatMap(({ id, keyEnv, search }) =>
          search ? [{ id, keyEnv, ...search }] : [],
        ),
        ctx,
        pins.length ? pins : [mode],
        failures,
      );
      const maxAttempts = resolveMaxAttempts(
        ctx,
        "WEBSEARCH_MAX_ATTEMPTS",
        routes.length,
      );
      const pending = new Set(uniqueQueries);
      const blocked = new Map<string, Error>();
      const errors = new Map<string, string>();
      const results = new Map<string, SearchResult>();
      const responses: SearchOutcome["responses"] = [];
      let attempts = 0;
      for (const route of routes) {
        if (!pending.size || attempts >= maxAttempts) break;
        if (blocked.has(route.id)) continue;
        attempts++;
        const groups = chunk(
          [...pending],
          Math.min(pending.size, route.batchSize ?? 1),
        );
        const outcomes = await mapConcurrent(
          groups,
          async (group) => {
            signal.throwIfAborted();
            try {
              const previousError = blocked.get(route.id);
              if (previousError) throw previousError;
              const budget =
                Math.max(1, Math.ceil(maxResults / uniqueQueries.length)) *
                group.length;
              const response = await route.run(
                route.key,
                group as SearchQueries,
                timedSignal(signal),
                {
                  getOption: (name) =>
                    name === "searchResults" ? budget : ctx.getOption(name),
                  getEnv: (name) => ctx.getEnv(name),
                },
              );
              return { group, response };
            } catch (error) {
              if (signal.aborted || error instanceof RotateConfigError)
                throw error;
              if (error instanceof HTTPError && error.invalidRequest)
                blocked.set(route.id, error);
              return {
                group,
                error: error instanceof Error ? error.message : String(error),
              };
            }
          },
          requestConcurrency(ctx, "search"),
          signal,
        );
        signal.throwIfAborted();
        let succeeded = false;
        for (const outcome of outcomes) {
          if (!outcome.response) {
            for (const query of outcome.group)
              errors.set(query, outcome.error!);
            continue;
          }
          succeeded = true;
          const { results: items, ...response } = outcome.response;
          responses.push({
            ...response,
            provider: route.id,
            queries: outcome.group,
          });
          for (const query of outcome.group) {
            pending.delete(query);
            errors.delete(query);
          }
          for (const item of items) {
            const incoming = {
              ...item,
              provider: route.id,
              queries: item.queries ?? outcome.group,
            };
            const existing = results.get(item.url);
            if (!existing) {
              results.set(item.url, incoming);
              continue;
            }
            const snippets = uniq([
              ...(existing.snippets ?? []),
              ...(incoming.snippets ?? []),
              ...(existing.content &&
              incoming.content &&
              incoming.content !== existing.content
                ? [incoming.content]
                : []),
            ]);
            const prior = existing.metadata?.providerResults;
            results.set(item.url, {
              ...incoming,
              ...existing,
              ...(existing.title || !incoming.title
                ? {}
                : { title: incoming.title }),
              ...(existing.content || !incoming.content
                ? {}
                : { content: incoming.content }),
              ...(snippets.length ? { snippets } : {}),
              queries: uniq([...(existing.queries ?? []), ...incoming.queries]),
              metadata: {
                ...existing.metadata,
                providerResults: [
                  ...(Array.isArray(prior)
                    ? prior
                    : [
                        {
                          provider: existing.provider,
                          queries: existing.queries,
                          published: existing.published,
                          updated: existing.updated,
                          metadata: existing.metadata,
                        },
                      ]),
                  {
                    provider: incoming.provider,
                    queries: incoming.queries,
                    published: incoming.published,
                    updated: incoming.updated,
                    metadata: incoming.metadata,
                  },
                ],
              },
            });
          }
        }
        if (succeeded) failures.delete(route.routeID);
        else failures.set(route.routeID, Date.now() + 60_000);
      }
      if (!responses.length) {
        const budget = Math.max(
          1,
          Math.ceil(maxResults / uniqueQueries.length),
        );
        const serpOutcomes = await mapConcurrent(
          [...pending],
          async (query): Promise<SearchResult[] | Error> => {
            for (const engine of SERP_ENGINES) {
              try {
                const parsed = await engine.search(query, budget, signal);
                if (parsed.length) return parsed;
              } catch (error) {
                if (signal.aborted) throw error;
              }
            }
            return new Error("all SERP fallback engines failed");
          },
          requestConcurrency(ctx, "search"),
          signal,
        );
        signal.throwIfAborted();
        const serpErrors: string[] = [];
        const engineQueries = new Map<string, string[]>();
        for (const outcome of serpOutcomes) {
          if (outcome instanceof Error) {
            serpErrors.push(outcome.message);
            continue;
          }
          for (const item of outcome) {
            if (!results.has(item.url)) results.set(item.url, item);
            const provider = item.provider ?? "serp";
            const queries = engineQueries.get(provider) ?? [];
            for (const query of item.queries ?? [])
              if (!queries.includes(query)) queries.push(query);
            engineQueries.set(provider, queries);
          }
        }
        if (results.size)
          for (const [provider, queries] of engineQueries)
            responses.push({ provider, queries });
        else
          throw new Error(
            `all ${attempts} attempt(s) failed. Last error: ${serpErrors.at(-1) ?? [...errors.values()].at(-1) ?? "no usable provider route"}`,
          );
      }
      return {
        results: [...results.values()].slice(0, maxResults),
        responses,
        ...(errors.size
          ? { errors: [...errors].map(([query, error]) => ({ query, error })) }
          : {}),
      };
    },
  };
}
