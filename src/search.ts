import { chunk, compact, uniq } from "es-toolkit/array";
import { parseHTML } from "linkedom";
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
import { fetchPageLocally } from "./fetch";
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

const cleanSerpText = (value: string | null | undefined) =>
  value?.replace(/\s+/g, " ").trim();

function parseGoogleSerp(
  html: string,
  query: string,
  limit: number,
): SearchResult[] {
  const { document } = parseHTML(html);
  const seen = new Set<string>();
  const results: SearchResult[] = [];
  for (const anchor of document.querySelectorAll("a[href]")) {
    if (!anchor.querySelector("h3")) continue;
    const href = anchor.getAttribute("href") ?? "";
    const target = /^https?:\/\//i.test(href)
      ? href
      : href.startsWith("/url?")
        ? new URL(href, "https://www.google.com").searchParams.get("q")
        : null;
    if (!target) continue;
    let parsed: URL;
    try {
      parsed = new URL(target);
    } catch {
      continue;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") continue;
    if (/(?:^|\.)(?:google|gstatic|googleusercontent)\./i.test(parsed.hostname))
      continue;
    if (seen.has(parsed.href)) continue;
    seen.add(parsed.href);
    const container =
      anchor.closest("div.g") ??
      anchor.closest("div.MjjYud") ??
      anchor.closest("div[data-sokoban-container]");
    const snippet = cleanSerpText(
      container?.querySelector("div.VwiC3b")?.textContent ??
        container?.querySelector("span.aCOpRe")?.textContent,
    );
    const title = cleanSerpText(anchor.querySelector("h3")?.textContent);
    results.push({
      url: parsed.href,
      ...(title ? { title } : {}),
      ...(snippet ? { snippets: [snippet] } : {}),
      provider: "google-serp",
      queries: [query],
    });
    if (results.length >= limit) break;
  }
  return results;
}

function parseBingSerp(
  html: string,
  query: string,
  limit: number,
): SearchResult[] {
  const { document } = parseHTML(html);
  const seen = new Set<string>();
  const results: SearchResult[] = [];
  for (const item of document.querySelectorAll("li.b_algo")) {
    const heading = item.querySelector("h2");
    const anchor =
      heading?.querySelector("a[href]") ?? item.querySelector("a[href]");
    const href = anchor?.getAttribute("href") ?? "";
    if (!href) continue;
    let parsed: URL;
    try {
      parsed = new URL(href, "https://www.bing.com");
    } catch {
      continue;
    }
    let target = parsed;
    if (
      /(?:^|\.)bing\./i.test(parsed.hostname) &&
      parsed.pathname.startsWith("/ck/a")
    ) {
      const encoded = parsed.searchParams.get("u");
      if (!encoded?.startsWith("a1")) continue;
      try {
        target = new URL(
          Buffer.from(
            encoded.slice(2).replaceAll("-", "+").replaceAll("_", "/"),
            "base64",
          ).toString("utf8"),
        );
      } catch {
        continue;
      }
    }
    if (target.protocol !== "http:" && target.protocol !== "https:") continue;
    if (/(?:^|\.)bing\./i.test(target.hostname)) continue;
    if (seen.has(target.href)) continue;
    seen.add(target.href);
    const title = cleanSerpText(anchor?.textContent);
    const snippet = cleanSerpText(item.querySelector("p")?.textContent);
    results.push({
      url: target.href,
      ...(title ? { title } : {}),
      ...(snippet ? { snippets: [snippet] } : {}),
      provider: "bing-serp",
      queries: [query],
    });
    if (results.length >= limit) break;
  }
  return results;
}

function parseDuckDuckGoSerp(
  html: string,
  query: string,
  limit: number,
): SearchResult[] {
  const { document } = parseHTML(html);
  const seen = new Set<string>();
  const results: SearchResult[] = [];
  for (const anchor of document.querySelectorAll("a.result__a")) {
    let href = anchor.getAttribute("href") ?? "";
    if (!href) continue;
    if (href.startsWith("//")) href = `https:${href}`;
    let parsed: URL;
    try {
      parsed = new URL(href, "https://duckduckgo.com");
      href = parsed.searchParams.get("uddg") ?? "";
    } catch {
      continue;
    }
    if (!/^https?:\/\//i.test(href)) continue;
    let target: URL;
    try {
      target = new URL(href);
    } catch {
      continue;
    }
    if (target.protocol !== "http:" && target.protocol !== "https:") continue;
    if (/(?:^|\.)duckduckgo\./i.test(target.hostname)) continue;
    if (seen.has(target.href)) continue;
    seen.add(target.href);
    const title = cleanSerpText(anchor.textContent);
    const snippet = cleanSerpText(
      anchor.closest("div.result")?.querySelector("a.result__snippet")
        ?.textContent ??
        anchor.closest("div.result")?.querySelector("div.result__snippet")
          ?.textContent,
    );
    results.push({
      url: target.href,
      ...(title ? { title } : {}),
      ...(snippet ? { snippets: [snippet] } : {}),
      provider: "duckduckgo-serp",
      queries: [query],
    });
    if (results.length >= limit) break;
  }
  return results;
}

const SERP_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const SERP_ENGINES: {
  buildURL: (query: string, count: number) => string;
  parse: (html: string, query: string, limit: number) => SearchResult[];
}[] = [
  {
    buildURL: (query, count) => {
      const url = new URL("https://www.google.com/search");
      url.searchParams.set("q", query);
      url.searchParams.set("num", String(Math.min(Math.max(count, 1), 20)));
      url.searchParams.set("hl", "en");
      return url.toString();
    },
    parse: parseGoogleSerp,
  },
  {
    buildURL: (query) =>
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
    parse: parseDuckDuckGoSerp,
  },
  {
    buildURL: (query, count) => {
      const url = new URL("https://www.bing.com/search");
      url.searchParams.set("q", query);
      url.searchParams.set("count", String(Math.min(Math.max(count, 1), 30)));
      url.searchParams.set("mkt", "en-US");
      return url.toString();
    },
    parse: parseBingSerp,
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
                const page = await fetchPageLocally(
                  engine.buildURL(query, budget),
                  signal,
                  "html",
                  "none",
                  undefined,
                  { "User-Agent": SERP_USER_AGENT },
                );
                if (page.error || !page.content)
                  throw new Error(page.error ?? "empty SERP response");
                const parsed = engine.parse(page.content, query, budget);
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
