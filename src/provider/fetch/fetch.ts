import { omit } from "es-toolkit/object";
import { HTTPError } from "../../shared/http";
import { RotateConfigError, option } from "../../shared/config";
import {
  errorMessage,
  mapConcurrent,
  requestConcurrency,
} from "../../shared/utils";
import type { RotateContext, URLList } from "../../shared/types";
import { orderedProviderRoutes, resolveMaxAttempts } from "../rotation";
import { FETCH_PROVIDERS } from "./index";
import { fetchImage } from "./image";
import type {
  FetchFormat,
  FetchOutcome,
  FetchPage,
  FetchProvider,
} from "./types";

export function newWebFetch(
  ctx: RotateContext,
  providers: readonly FetchProvider[] = FETCH_PROVIDERS,
): {
  fetch(input: {
    urls: URLList;
    format: FetchFormat;
    signal: AbortSignal;
  }): Promise<FetchOutcome>;
} {
  const failures = new Map<string, number>();
  return {
    fetch: async ({ urls, format, signal }) => {
      signal.throwIfAborted();
      if (!urls.length)
        throw new RotateConfigError("fetch URLs must not be empty");
      const mode = option(ctx, "mode");
      const cleanup = option(ctx, "webfetchCleanup");
      if (cleanup !== "none" && cleanup !== "defuddle") {
        throw new RotateConfigError(
          `webfetch-rotate: unsupported cleanup mode ${cleanup}`,
        );
      }
      if (
        mode !== "auto" &&
        !providers.some((provider) => provider.id === mode)
      ) {
        throw new RotateConfigError(
          `webfetch-rotate: unsupported provider or mode ${mode}`,
          "unsupported-mode",
        );
      }

      const image = await fetchImage(urls, mode, signal);
      if (image) return image;

      const candidates = orderedProviderRoutes(
        providers.filter(
          (provider) => format !== "html" || provider.formats.includes("html"),
        ),
        ctx,
        [mode],
        failures,
      );
      const pagesByURL = new Map<string, FetchPage>();
      const errorsByURL = new Map<string, string>();
      const blocked = new Set<string>();
      let pendingURLs = [...new Set(urls)];
      const maxAttempts = resolveMaxAttempts(ctx, candidates.length);
      let attempts = 0;
      for (const route of candidates) {
        if (!pendingURLs.length || attempts >= maxAttempts) break;
        if (blocked.has(route.id)) continue;
        attempts++;
        try {
          const nativeFormat =
            cleanup !== "none" && route.formats.includes("html")
              ? "html"
              : route.formats.includes(format)
                ? format
                : format === "markdown" && route.formats.includes("html")
                  ? "html"
                  : route.formats.includes("markdown")
                    ? "markdown"
                    : route.formats[0]!;
          const routePages = await route.run(
            route.key,
            pendingURLs as URLList,
            signal,
            ctx,
            nativeFormat,
          );
          signal.throwIfAborted();
          const convertedPages = await mapConcurrent(
            routePages,
            async (page) => {
              if (!page.content) return page;
              try {
                if (!page.format)
                  throw new Error(
                    `${route.id} did not report its content format`,
                  );
                return {
                  ...page,
                  provider: route.id,
                  ...(page.format === format &&
                  (page.format !== "html" || cleanup === "none")
                    ? {}
                    : await (
                        await import("./cleanup")
                      ).convertContent(
                        page.content,
                        page.format,
                        page.finalURL ?? page.url,
                        format,
                        cleanup,
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
            requestConcurrency(ctx),
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
                new HTTPError(page.metadata.httpStatus, page.error)
                  .invalidRequest,
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
          if (nextURLs.length === pendingURLs.length)
            failures.set(route.routeID, Date.now() + 60_000);
          else failures.delete(route.routeID);
          pendingURLs = nextURLs;
        } catch (error) {
          if (signal.aborted || error instanceof RotateConfigError) throw error;
          if (error instanceof HTTPError && error.invalidRequest)
            blocked.add(route.id);
          failures.set(route.routeID, Date.now() + 60_000);
          for (const url of pendingURLs)
            errorsByURL.set(url, errorMessage(error));
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
    },
  };
}
