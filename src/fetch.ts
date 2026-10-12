import { fileTypeFromBuffer } from "file-type";
import { readBodyLimited, timedSignal } from "./http";
import { PROVIDERS, TARGET_USER_AGENT } from "./providers";
import {
  expandProviderRoutes,
  orderedCandidates,
  resolveMaxAttempts,
} from "./rotation";
import type { RotationState } from "./rotation";
import { RotateConfigError, assertHTTPURL, configuredString } from "./util";
import type { FetchFormat, FetchPage, RotateContext, URLList } from "./util";

const MAX_IMAGE_BYTES = Math.floor((5 * 1024 * 1024 * 3) / 4);

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
    assertHTTPURL(currentURL, validationLabel);
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
      throw new Error(`${label} HTTP ${response.status}`);
    }
    return { response, url: currentURL };
  }
}

const rotation: RotationState = { cursor: 0, failures: new Map() };

export function createWebFetcher(ctx: RotateContext): {
  fetch(input: {
    urls: URLList;
    format: FetchFormat;
    signal: AbortSignal;
  }): Promise<FetchOutcome>;
} {
  return {
    fetch: async ({ urls, format, signal }) => {
      const mode =
        configuredString(ctx, ["mode"], ["WEBFETCH_MODE"]) ?? "round-robin";
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
      const explicit =
        !["random", "round-robin", "auto"].includes(mode) && mode !== "native";
      if (
        explicit &&
        !PROVIDERS.some((provider) => provider.id === mode && provider.fetch)
      ) {
        throw new RotateConfigError(
          `webfetch-rotate: unsupported provider or mode ${mode}`,
          "unsupported-mode",
        );
      }

      if (
        mode === "native" ||
        (["random", "round-robin", "auto"].includes(mode) &&
          /\.(?:avif|bmp|gif|heic|heif|ico|jfif|jpe?g|png|tiff?|webp)$/i.test(
            new URL(urls[0]).pathname,
          ))
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
              await response.body?.cancel();
              break imageFetch;
            }
            const contentLength = Number(
              response.headers.get("content-length") || NaN,
            );
            if (
              Number.isFinite(contentLength) &&
              contentLength > MAX_IMAGE_BYTES
            ) {
              await response.body?.cancel();
              throw new Error(
                "native image exceeds the configured image payload limit",
              );
            }
            const body = await readBodyLimited(
              response,
              MAX_IMAGE_BYTES,
              "native image",
            );
            const detected = await fileTypeFromBuffer(body);
            const mime =
              detected &&
              [
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
              ].includes(detected.mime)
                ? detected.mime
                : undefined;
            if (!mime) break imageFetch;
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
        Promise.all(
          targets.map(async (url): Promise<FetchPage> => {
            try {
              const { response, url: currentURL } = await fetchManualRedirects(
                url,
                signal,
                {
                  Accept:
                    "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
                  "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
                },
                "local webfetch",
                "webfetch-rotate",
                10,
              );
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
                throw new Error(
                  `local webfetch unsupported content type ${contentType}`,
                );
              }
              const bytes = await readBodyLimited(
                response,
                10 * 1024 * 1024,
                "local webfetch",
              );
              const charset = response.headers
                .get("content-type")
                ?.match(/charset\s*=\s*["']?([^;"'\s]+)/i)?.[1];
              let html: string;
              try {
                html = new TextDecoder(charset || "utf-8").decode(bytes);
              } catch {
                html = new TextDecoder().decode(bytes);
              }
              return {
                url,
                content: await (
                  await import("./cleanup")
                ).cleanHTML(
                  html,
                  currentURL,
                  format,
                  cleanup === "none" ? "readability" : cleanup,
                ),
              };
            } catch (error) {
              if (signal.aborted) throw error;
              return {
                url,
                error: error instanceof Error ? error.message : String(error),
              };
            }
          }),
        );
      if (mode === "native") {
        const pages = await fetchLocally(urls);
        if (urls.length === 1 && pages[0]?.error)
          throw new Error(pages[0].error);
        return { type: "pages", pages };
      }

      const pool = expandProviderRoutes(
        PROVIDERS.flatMap((provider) =>
          provider.fetch
            ? [
                {
                  id: provider.id,
                  keyEnv: provider.keyEnv,
                  keyless: provider.fetch.keyless,
                  fetch: provider.fetch.run,
                  weight: provider.weight ?? 0,
                },
              ]
            : [],
        ),
        ctx,
      ).map(({ provider, key, index }) => ({
        ...provider,
        key,
        routeID: `${provider.id}[${index}]`,
      }));
      const candidates = orderedCandidates(
        pool,
        mode,
        rotation,
        (route) => route.routeID,
        (route) => route.id,
        (value) => explicit && value === mode,
        (route) => route.weight,
      );
      const pagesByURL = new Map<string, FetchPage>();
      const errorsByURL = new Map<string, string>();
      let pendingURLs = [...urls];
      for (const route of candidates.slice(
        0,
        resolveMaxAttempts(ctx, "WEBFETCH_MAX_ATTEMPTS", candidates.length),
      )) {
        if (!pendingURLs.length) break;
        try {
          let routePages = await route.fetch(
            route.key,
            pendingURLs as URLList,
            timedSignal(signal),
            ctx,
            cleanup !== "none" ? "html" : format,
          );
          if (cleanup !== "none") {
            const { cleanHTML } = await import("./cleanup");
            routePages = await Promise.all(
              routePages.map(async (page) =>
                page.content
                  ? {
                      ...page,
                      content: await cleanHTML(
                        page.content,
                        page.url,
                        format,
                        cleanup,
                      ),
                    }
                  : page,
              ),
            );
          }
          const routePagesByURL = new Map(
            routePages.map((page) => [page.url, page]),
          );
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
            rotation.failures.set(route.routeID, Date.now() + 60_000);
          else rotation.failures.delete(route.routeID);
          pendingURLs = nextURLs;
        } catch (error) {
          if (signal.aborted) throw error;
          rotation.failures.set(route.routeID, Date.now() + 60_000);
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
