import { omit } from "es-toolkit/object";
import { HTTPError } from "../../shared/http";
import { RotateConfigError, globalsSchema } from "../../shared/config";
import type { Globals } from "../../shared/config";
import {
  errorMessage,
  mapConcurrent,
  requestConcurrency,
} from "../../shared/utils";
import type { URLList } from "../../shared/types";
import {
  providerRoutes,
  resolveMaxAttempts,
  resolveProviderEntries,
  selectRoutes,
} from "../rotation";
import type { ProviderEntry } from "../types";
import { FETCH_PROVIDERS } from "./index";
import { fetchImage } from "./image";
import type {
  FetchFormat,
  FetchOutcome,
  FetchPage,
  FetchProvider,
  FetchProviderConfigBase,
} from "./types";

export type FetchProviderConfig<P extends readonly FetchProvider[] = []> = {
  cacheWindowSeconds?: number | undefined;
  providers?:
    | (FetchProviderConfigBase<typeof FETCH_PROVIDERS> &
        FetchProviderConfigBase<NoInfer<P>>)
    | undefined;
  cleanup?: "none" | "defuddle" | undefined;
  prefer?: "keyed" | "keyless" | undefined;
  concurrency?: number | undefined;
  maxAttempts?: number | undefined;
};

export type DefaultFetchProviderConfig = FetchProviderConfig;

export const DEFAULT_FETCH_PROVIDER_CONFIG: DefaultFetchProviderConfig = {
  cacheWindowSeconds: 0,
  providers: {
    tavily: {},
    parallel: {},
    you: {},
    exa: {},
    hyperbrowser: {},
    firecrawl: {},
    tinyfish: {},
    jina: {},
    scrapingant: {},
    scrapingbee: {},
    scrapfly: {},
    diffbot: {},
    brightdata: {},
    apify: {},
    linkup: {},
    deepseek: {},
    native: {},
  },
};

export async function fetchWeb<P extends readonly FetchProvider[] = []>({
  urls,
  format,
  signal,
  config = {},
  implementations,
}: {
  urls: URLList;
  format: FetchFormat;
  signal: AbortSignal;
  config?: FetchProviderConfig<P> | undefined;
  implementations?: P | undefined;
}): Promise<FetchOutcome> {
  const globals: Globals = globalsSchema.parse(config);
  const registry = new Map<string, FetchProvider>();
  for (const provider of [...FETCH_PROVIDERS, ...(implementations ?? [])])
    registry.set(provider.id, provider);
  const enabled = [...registry.values()];
  const entries = resolveProviderEntries(
    enabled,
    config.providers as Record<string, ProviderEntry> | undefined,
    "fetch",
  );
  const pool = providerRoutes(enabled, entries, globals);
  const nativeOnly = entries.size === 1 && entries.has("native");
  signal.throwIfAborted();
  if (!urls.length) throw new RotateConfigError("fetch URLs must not be empty");

  const image = await fetchImage(
    urls,
    signal,
    entries.has("native"),
    nativeOnly,
  );
  if (image) return image;

  const candidates = selectRoutes(
    pool.filter((route) => format !== "html" || route.formats.includes("html")),
  );
  const pagesByURL = new Map<string, FetchPage>();
  const errorsByURL = new Map<string, string>();
  const blocked = new Set<string>();
  let pendingURLs = [...new Set(urls)];
  const maxAttempts = resolveMaxAttempts(globals, candidates.length);
  let attempts = 0;
  for (const route of candidates) {
    if (!pendingURLs.length || attempts >= maxAttempts) break;
    if (blocked.has(route.id)) continue;
    attempts++;
    try {
      const nativeFormat =
        globals.cleanup !== "none" && route.formats.includes("html")
          ? "html"
          : route.formats.includes(format)
            ? format
            : format === "markdown" && route.formats.includes("html")
              ? "html"
              : route.formats.includes("markdown")
                ? "markdown"
                : route.formats[0]!;
      const routePages = await route.run({
        settings: route.settings,
        key: route.key,
        urls: pendingURLs as URLList,
        signal,
        format: nativeFormat,
        globals,
      });
      signal.throwIfAborted();
      const convertedPages = await mapConcurrent(
        routePages,
        async (page) => {
          if (!page.content) return page;
          try {
            if (!page.format)
              throw new Error(`${route.id} did not report its content format`);
            return {
              ...page,
              provider: route.id,
              ...(page.format === format &&
              (page.format !== "html" || globals.cleanup === "none")
                ? {}
                : await (
                    await import("./cleanup")
                  ).convertContent(
                    page.content,
                    page.format,
                    page.finalURL ?? page.url,
                    format,
                    globals.cleanup,
                  )),
            };
          } catch (error) {
            if (signal.aborted) throw error;
            return {
              ...omit(page, ["content"]),
              error: errorMessage(error),
            };
          }
        },
        requestConcurrency(globals),
        signal,
      );
      const routePagesByURL = new Map(
        convertedPages.map((page) => [page.url, page]),
      );
      if (
        convertedPages.some(
          (page) =>
            page.error &&
            typeof page.metadata?.httpStatus === "number" &&
            new HTTPError(page.metadata.httpStatus, page.error).invalidRequest,
        )
      )
        blocked.add(route.id);
      const nextURLs: string[] = [];
      for (const url of pendingURLs) {
        const page = routePagesByURL.get(url);
        if (page?.content) {
          pagesByURL.set(url, page);
          errorsByURL.delete(url);
        } else {
          if (page?.error) errorsByURL.set(url, page.error);
          nextURLs.push(url);
        }
      }
      pendingURLs = nextURLs;
    } catch (error) {
      if (signal.aborted || error instanceof RotateConfigError) throw error;
      if (error instanceof HTTPError && error.invalidRequest)
        blocked.add(route.id);
      for (const url of pendingURLs) errorsByURL.set(url, errorMessage(error));
    }
  }
  const pages = urls.map((url) => {
    const page = pagesByURL.get(url);
    if (page) return page;
    return {
      url,
      error: errorsByURL.get(url) ?? "webfetch failed",
    };
  });
  if (urls.length === 1 && pages[0]?.error) throw new Error(pages[0].error);
  return { type: "pages", pages };
}
