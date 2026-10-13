import { fileTypeFromBuffer } from "file-type";
import { omit } from "es-toolkit/object";
import { HTTPError, readBodyLimited, timedSignal } from "./core/http";
import { PROVIDERS, TARGET_USER_AGENT } from "./providers/constants";
import { orderedProviderRoutes, resolveMaxAttempts } from "./core/rotation";
import { RotateConfigError, configuredString } from "./core/config";
import { mapConcurrent, requestConcurrency } from "./core/utils";
import type {
  FetchFormat,
  FetchPage,
  RotateContext,
  URLList,
} from "./core/types";

export type FetchOutcome =
  | { type: "image"; url: string; mime: string; base64: string }
  | { type: "pages"; pages: FetchPage[] };

async function fetchManualRedirects(
  url: string,
  signal: AbortSignal,
  headers: Record<string, string>,
  label: string,
  validationLabel: string,
  maxRedirects: number,
) {
  const requestSignal = timedSignal(signal);
  let currentURL = url;
  for (let redirect = 0; ; redirect++) {
    const parsedURL = new URL(currentURL);
    if (parsedURL.protocol !== "http:" && parsedURL.protocol !== "https:") {
      throw new Error(
        `${validationLabel}: only http and https URLs are supported`,
      );
    }
    if (parsedURL.username || parsedURL.password) {
      throw new Error(`${validationLabel}: URL credentials are not supported`);
    }
    const response = await fetch(currentURL, {
      headers,
      redirect: "manual",
      signal: requestSignal,
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location) throw new Error(`${label} redirect has no location`);
      if (redirect >= maxRedirects)
        throw new Error(`${label} exceeded the redirect limit`);
      try {
        currentURL = new URL(location, currentURL).toString();
      } catch {
        throw new Error(`${label} returned an invalid redirect location`);
      }
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new HTTPError(response.status, `${label} HTTP ${response.status}`);
    }
    return { response, url: currentURL };
  }
}

export async function fetchPageLocally(
  url: string,
  signal: AbortSignal,
  format: FetchFormat,
  cleanup: "none" | "defuddle" | "readability",
  native: {
    response?: Awaited<ReturnType<typeof fetchManualRedirects>> | undefined;
  } = {},
  headers: Record<string, string> = {},
): Promise<FetchPage> {
  try {
    const { response, url: currentURL } =
      native.response ??
      (await fetchManualRedirects(
        url,
        signal,
        {
          Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
          "User-Agent": TARGET_USER_AGENT,
          ...headers,
        },
        "local webfetch",
        "webfetch-rotate",
        10,
      ));
    native.response = undefined;
    const contentType =
      response.headers
        .get("content-type")
        ?.split(";", 1)[0]
        ?.trim()
        .toLowerCase() ?? "";
    if (
      contentType &&
      !contentType.startsWith("text/") &&
      !contentType.includes("html") &&
      !contentType.includes("xml") &&
      !contentType.includes("json")
    ) {
      await response.body?.cancel();
      throw new Error(`local webfetch unsupported content type ${contentType}`);
    }
    const bytes = await readBodyLimited(
      response,
      10 * 1024 * 1024,
      "local webfetch",
    );
    let html: string;
    try {
      html = new TextDecoder(
        response.headers
          .get("content-type")
          ?.match(/charset\s*=\s*["']?([^;"'\s]+)/i)?.[1] || "utf-8",
      ).decode(bytes);
    } catch {
      html = new TextDecoder().decode(bytes);
    }
    if (!html.trim()) throw new Error("empty content");
    const source =
      contentType.includes("html") ||
      (!contentType && /<\/?[a-z][\w:-]*(?:\s[^<>]*?)?>/i.test(html))
        ? "html"
        : "text";
    return {
      url,
      ...(currentURL !== url ? { finalURL: currentURL } : {}),
      provider: "native",
      metadata: { contentType, status: response.status },
      ...(source === format && (source !== "html" || cleanup === "none")
        ? { content: html, format: source }
        : await (
            await import("./cleanup")
          ).convertContent(html, source, currentURL, format, cleanup)),
    };
  } catch (error) {
    if (signal.aborted) throw error;
    return {
      url,
      error: error instanceof Error ? error.message : String(error),
      ...(error instanceof HTTPError
        ? {
            metadata: {
              httpStatus: error.status,
              retryable: error.retryable,
            },
          }
        : {}),
    };
  }
}

export function newWebFetch(ctx: RotateContext): {
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
      const mode = configuredString(ctx, ["mode"], ["WEBFETCH_MODE"]) ?? "auto";
      const cleanup =
        configuredString(ctx, ["webfetchCleanup"], ["WEBFETCH_CLEANUP"]) ??
        "none";
      if (
        cleanup !== "none" &&
        cleanup !== "defuddle" &&
        cleanup !== "readability"
      ) {
        throw new RotateConfigError(
          `webfetch-rotate: unsupported cleanup mode ${cleanup}`,
        );
      }
      const explicit = mode !== "auto" && mode !== "native";
      if (
        explicit &&
        !PROVIDERS.some((provider) => provider.id === mode && provider.fetch)
      ) {
        throw new RotateConfigError(
          `webfetch-rotate: unsupported provider or mode ${mode}`,
          "unsupported-mode",
        );
      }

      const native: {
        response?: Awaited<ReturnType<typeof fetchManualRedirects>> | undefined;
      } = {};
      if (
        urls.length === 1 &&
        (mode === "native" ||
          (mode === "auto" &&
            /\.(?:avif|bmp|gif|heic|heif|ico|jfif|jpe?g|png|tiff?|webp)$/i.test(
              new URL(urls[0]).pathname,
            )))
      ) {
        try {
          imageFetch: {
            const { response, url } = await fetchManualRedirects(
              urls[0],
              signal,
              {
                Accept: "image/*,*/*;q=0.1",
                "User-Agent": TARGET_USER_AGENT,
              },
              "native image",
              "web-rotate",
              5,
            );
            const contentType =
              response.headers
                .get("content-type")
                ?.split(";", 1)[0]
                ?.trim()
                .toLowerCase() ?? "";
            if (
              !contentType.startsWith("image/") ||
              contentType === "image/svg+xml" ||
              contentType === "image/vnd.fastbidsheet"
            ) {
              if (mode === "native") native.response = { response, url };
              else await response.body?.cancel();
              break imageFetch;
            }
            const body = await readBodyLimited(
              response,
              Math.floor((5 * 1024 * 1024 * 3) / 4),
              "native image",
            );
            const mime = (await fileTypeFromBuffer(body))?.mime;
            if (
              !mime ||
              ![
                "image/jpeg",
                "image/png",
                "image/gif",
                "image/webp",
                "image/bmp",
                "image/tiff",
                "image/x-icon",
                "image/avif",
                "image/heic",
                "image/heif",
              ].includes(mime)
            )
              break imageFetch;
            const base64 = body.toBase64();
            if (base64.length > 5 * 1024 * 1024) {
              throw new Error(
                "native image exceeds the configured Base64 limit",
              );
            }
            return { type: "image", url, mime, base64 };
          }
        } catch (error) {
          if (signal.aborted) throw error;
        }
      }
      const fetchLocally = (targets: readonly string[]) =>
        mapConcurrent(
          targets,
          (url) => fetchPageLocally(url, signal, format, cleanup, native),
          requestConcurrency(ctx, "fetch"),
          signal,
        );
      if (mode === "native") {
        const pages = await fetchLocally(urls);
        if (urls.length === 1 && pages[0]?.error)
          throw new Error(pages[0].error);
        return { type: "pages", pages };
      }

      const candidates = orderedProviderRoutes(
        PROVIDERS.flatMap(({ id, keyEnv, fetch }) =>
          fetch && (format !== "html" || fetch.formats.includes("html"))
            ? [{ id, keyEnv, ...fetch }]
            : [],
        ),
        ctx,
        [mode],
        failures,
      );
      const pagesByURL = new Map<string, FetchPage>();
      const errorsByURL = new Map<string, string>();
      const blocked = new Set<string>();
      let pendingURLs = [...new Set(urls)];
      const maxAttempts = resolveMaxAttempts(
        ctx,
        "WEBFETCH_MAX_ATTEMPTS",
        candidates.length,
      );
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
                  error: error instanceof Error ? error.message : String(error),
                };
              }
            },
            requestConcurrency(ctx, "fetch"),
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
            errorsByURL.set(
              url,
              error instanceof Error ? error.message : String(error),
            );
        }
      }
      const localPages = await fetchLocally(pendingURLs);
      const localPagesByURL = new Map(
        localPages.map((page) => [page.url, page]),
      );
      const pages = urls.map((url) => {
        const page = pagesByURL.get(url);
        if (page) return page;
        const localPage = localPagesByURL.get(url);
        if (localPage?.content) return localPage;
        const primaryError = errorsByURL.get(url);
        const localError = localPage?.error;
        return {
          url,
          error:
            primaryError && localError
              ? `${primaryError}; local fallback failed: ${localError}`
              : (localError ?? primaryError ?? "webfetch failed"),
        };
      });
      if (urls.length === 1 && pages[0]?.error) throw new Error(pages[0].error);
      return { type: "pages", pages };
    },
  };
}
