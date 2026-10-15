import { chunk, keyBy } from "es-toolkit/array";
import { isPlainObject as isRecord } from "es-toolkit/predicate";
import { HTTPError, timedSignal } from "../../shared/http";
import {
  errorMessage,
  mapConcurrent,
  requestConcurrency,
} from "../../shared/utils";
import { stringValue } from "../../shared/config";
import type { RotateContext } from "../../shared/types";
import type { FetchFormat, FetchPage, FetchProvider } from "./types";
import { firstList, responseMetadata } from "../utils";

export function providerResult(
  content: unknown,
  format: FetchFormat,
  metadata?: Record<string, unknown>,
): {
  content: string;
  format: FetchFormat;
  metadata?: Record<string, unknown>;
} {
  if (typeof content !== "string" || !content.trim())
    throw new Error("provider returned empty content");
  return { content, format, ...(metadata ? { metadata } : {}) };
}

export function fetchPages(
  urls: readonly string[],
  payload: unknown,
  content: (item: Record<string, unknown>) => string | undefined,
  format: FetchFormat,
): FetchPage[] {
  const rows = firstList(payload).filter(isRecord);
  const hasURLs = rows.some(
    (row) =>
      stringValue(row.url) != null ||
      stringValue(row.final_url) != null ||
      stringValue(row.finalURL) != null,
  );
  const data = new Map<string, Record<string, unknown>>();
  for (const row of rows)
    for (const key of [
      stringValue(row.url),
      stringValue(row.final_url),
      stringValue(row.finalURL),
    ])
      if (key && !data.has(key)) data.set(key, row);
  const errors = keyBy(
    (isRecord(payload) ? [payload.errors, payload.failed_results] : [])
      .flatMap((items) => (Array.isArray(items) ? items : []))
      .filter(isRecord),
    (item) => String(item.url),
  );
  return urls.map((url, index) => {
    const item = data.get(url) ?? (hasURLs ? undefined : rows[index]);
    const text = item ? content(item) : undefined;
    const metadata = {
      ...responseMetadata(payload),
      ...Object.fromEntries(
        Object.entries(item ?? errors[url] ?? {}).filter(
          ([key]) =>
            ![
              "content",
              "text",
              "html",
              "markdown",
              "raw_content",
              "full_content",
              "excerpts",
              "url",
              "title",
              "final_url",
              "finalURL",
            ].includes(key),
        ),
      ),
    };
    if (!item || !text)
      return {
        url,
        error:
          stringValue(item?.error) ??
          stringValue(errors[url]?.error) ??
          "empty content",
        ...(Object.keys(metadata).length ? { metadata } : {}),
      };
    const title = stringValue(item.title);
    const finalURL = stringValue(item.final_url) ?? stringValue(item.finalURL);
    return {
      url,
      content: text,
      format,
      ...(title ? { title } : {}),
      ...(finalURL ? { finalURL } : {}),
      ...(Object.keys(metadata).length ? { metadata } : {}),
    };
  });
}

/** 按 size 分批并发抓取，单批失败转为该批 URL 的 error 页 */
export async function fetchBatches(
  urls: readonly string[],
  size: number,
  ctx: RotateContext,
  signal: AbortSignal,
  run: (batch: string[]) => Promise<FetchPage[]>,
): Promise<FetchPage[]> {
  const batches = await mapConcurrent(
    chunk(urls, Math.max(1, size)),
    async (batch) => {
      try {
        return await run(batch);
      } catch (error) {
        if (signal.aborted) throw error;
        return batch.map((url) => ({
          url,
          error: errorMessage(error),
          ...(error instanceof HTTPError
            ? {
                metadata: {
                  httpStatus: error.status,
                  retryable: error.retryable,
                },
              }
            : {}),
        }));
      }
    },
    requestConcurrency(ctx),
    signal,
  );
  return batches.flat();
}

export async function fetchManualRedirects(
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

export function fetchOne(
  run: (
    key: string | undefined,
    url: string,
    signal: AbortSignal,
    ctx: RotateContext,
    format: FetchFormat,
  ) => Promise<Omit<FetchPage, "url">>,
): FetchProvider["run"] {
  return async (key, urls, signal, ctx, format) => {
    const results = new Array<FetchPage | undefined>(urls.length);
    const stop = new AbortController();
    try {
      await mapConcurrent(
        urls,
        async (url, index) => {
          if (stop.signal.aborted) return;
          const requestSignal = timedSignal(signal);
          try {
            results[index] = {
              url,
              ...(await run(key, url, requestSignal, ctx, format)),
            };
          } catch (error) {
            if (error instanceof HTTPError) {
              results[index] = {
                url,
                error: error.message,
                metadata: {
                  httpStatus: error.status,
                  retryable: error.retryable,
                },
              };
              if (!error.retryable) stop.abort();
              return;
            }
            if (
              error instanceof Error &&
              error.name === "TimeoutError" &&
              !signal.aborted
            ) {
              results[index] = { url, error: error.message };
              return;
            }
            results[index] = { url, error: errorMessage(error) };
          }
        },
        requestConcurrency(ctx),
        signal,
      );
    } catch (error) {
      if (
        signal.aborted ||
        !(error instanceof Error && error.name === "AbortError")
      )
        throw error;
    }
    return urls.map(
      (url, index) =>
        results[index] ?? {
          url,
          error: stop.signal.aborted
            ? "skipped after a non-retryable HTTP error"
            : "request did not complete",
        },
    );
  };
}
