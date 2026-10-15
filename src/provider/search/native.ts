import { search as googleSearchAPI, OrganicResult } from "google-sr";
import {
  SafeSearchType,
  search as duckDuckGoSearchAPI,
} from "duck-duck-scrape";
import { XMLParser } from "fast-xml-parser";
import { HTTPError, timedSignal } from "../../shared/http";
import { mapConcurrent, requestConcurrency } from "../../shared/utils";
import type { SearchResult } from "./types";
import type { SearchProvider } from "./types";
import { searchCount } from "./utils";

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

export const native: SearchProvider = {
  id: "native",
  weight: 70,
  keyless: true,
  run: async (_key, queries, signal, ctx) => {
    const count = searchCount(ctx);
    const groups = await mapConcurrent(
      queries,
      async (query): Promise<SearchResult[]> => {
        for (const engine of SERP_ENGINES) {
          try {
            const parsed = await engine.search(query, count, signal);
            if (parsed.length) return parsed;
          } catch (error) {
            if (signal.aborted) throw error;
          }
        }
        throw new Error("all native SERP engines failed");
      },
      requestConcurrency(ctx),
      signal,
    );
    return { results: groups.flat() };
  },
};
