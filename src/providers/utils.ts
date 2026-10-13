import { clamp } from "es-toolkit/math";
import { compact, keyBy } from "es-toolkit/array";
import { isPlainObject as isRecord } from "es-toolkit/predicate";
import { apiJSON, HTTPError, timedSignal } from "../core/http";
import { mapConcurrent, requestConcurrency } from "../core/utils";
import { configuredEnvironmentValue, stringValue } from "../core/config";
import type {
  FetchFormat,
  FetchPage,
  RotateContext,
  SearchQueries,
  SearchResult,
  SearchResponse,
} from "../core/types";
import type { Provider } from "./types";

export function requireKey(provider: string, key: string | undefined): string {
  if (!key) throw new Error(`${provider} API key is not configured`);
  return key;
}

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

export function firstList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!isRecord(payload)) return [];
  return (
    [
      payload.results,
      payload.data,
      payload.web,
      payload.organic,
      payload.search_results,
      payload.objects,
      payload.news,
      payload.pages,
      payload.hits,
      payload.items,
      payload.entries,
    ].find(Array.isArray) ?? []
  );
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

export function fetchBatches(
  batches: readonly string[][],
  run: (batch: string[]) => Promise<FetchPage[]>,
  concurrency: number,
  signal: AbortSignal,
): Promise<FetchPage[][]> {
  return mapConcurrent(
    batches,
    async (batch) => {
      try {
        return await run(batch);
      } catch (error) {
        if (signal.aborted) throw error;
        return batch.map((url) => ({
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
        }));
      }
    },
    concurrency,
    signal,
  );
}

export function searchCount(ctx: RotateContext, maximum = 100): number {
  const count = Number(
    ctx.getOption("searchResults") ??
      configuredEnvironmentValue(ctx, "WEBSEARCH_RESULTS"),
  );
  return Number.isFinite(count) && count > 0
    ? clamp(Math.trunc(count), 1, maximum)
    : 8;
}

export function urlParams(
  endpoint: URL,
  options: Record<string, unknown>,
  encode?: (
    name: string,
    value: unknown,
  ) => string | readonly [string, string][] | undefined,
): URL {
  for (const [name, value] of Object.entries(options)) {
    if (value == null) continue;
    const encoded = encode?.(name, value);
    if (encoded != null) {
      if (typeof encoded === "string") endpoint.searchParams.set(name, encoded);
      else
        for (const [key, item] of encoded) endpoint.searchParams.set(key, item);
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value)
        endpoint.searchParams.append(name, String(item));
    } else if (isRecord(value)) {
      endpoint.searchParams.set(name, JSON.stringify(value));
    } else {
      endpoint.searchParams.set(name, String(value));
    }
  }
  return endpoint;
}

export function fetchOne(
  run: (
    key: string | undefined,
    url: string,
    signal: AbortSignal,
    ctx: RotateContext,
    format: FetchFormat,
  ) => Promise<Omit<FetchPage, "url">>,
): NonNullable<Provider["fetch"]>["run"] {
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
            results[index] = {
              url,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        },
        requestConcurrency(ctx, "fetch"),
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

export function restSearch(
  url: string,
  body: (queries: SearchQueries, ctx: RotateContext) => unknown,
  headers: (key: string | undefined) => Record<string, string>,
  select?: (payload: unknown) => unknown,
): NonNullable<Provider["search"]>["run"] {
  return async (key, queries, signal, ctx) => {
    const payload = await apiJSON(url, signal, {
      body: body(queries, ctx),
      headers: headers(key),
    });
    return searchResponse(payload, select?.(payload));
  };
}

const URL_KEYS = ["url", "link", "pageUrl", "page_url"] as const;
const TITLE_KEYS = ["title", "name"] as const;
const CONTENT_KEYS = [
  "content",
  "summary",
  "highlight",
  "snippet",
  "description",
  "text",
] as const;
const PUBLISHED_KEYS = [
  "datePublished",
  "date_published",
  "publishedDate",
  "published_date",
  "publishedAt",
  "published_at",
  "publish_date",
  "published",
  "time_published",
  "dateCreated",
  "date",
  "page_age",
] as const;
const UPDATED_KEYS = [
  "updatedAt",
  "updated_at",
  "lastUpdated",
  "last_updated",
  "time_last_crawled",
  "updated",
  "dateModified",
  "date_modified",
  "dateLastCrawled",
  "date_last_crawled",
  "lastmod",
] as const;
const CONSUMED_KEYS = new Set<string>([
  ...URL_KEYS,
  ...TITLE_KEYS,
  ...CONTENT_KEYS,
  "snippet",
  "snippets",
  "highlights",
  "excerpts",
  "contents",
  ...PUBLISHED_KEYS,
  ...UPDATED_KEYS,
]);

function parseTimestamp(value: unknown): number | undefined {
  if (typeof value === "number")
    return Number.isFinite(value) && value > 0
      ? Math.round(value < 1e12 ? value * 1000 : value)
      : undefined;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^\d+$/.test(trimmed)) {
    const numeric = Number(trimmed);
    return numeric < 1e12 ? numeric * 1000 : numeric;
  }
  const parsed = Date.parse(trimmed);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function firstDefined<T>(values: readonly T[]): T | undefined {
  return values.find((value) => value != null);
}

export function normalizeResults(payload: unknown): SearchResult[] {
  return firstList(payload)
    .filter(isRecord)
    .flatMap((item): SearchResult[] => {
      const url = firstDefined(URL_KEYS.map((key) => stringValue(item[key])));
      if (!url) return [];
      const title = firstDefined(
        TITLE_KEYS.map((key) => stringValue(item[key])),
      );
      const content = firstDefined([
        ...CONTENT_KEYS.map((key) => stringValue(item[key])),
        typeof item.snippet === "string"
          ? stringValue(item.snippet)
          : undefined,
      ]);
      const snippets = compact(
        (Array.isArray(item.snippets)
          ? item.snippets
          : Array.isArray(item.highlights)
            ? item.highlights
            : Array.isArray(item.excerpts)
              ? item.excerpts
              : []
        ).map(
          (value) =>
            stringValue(value) ??
            (isRecord(value)
              ? (stringValue(value.text) ?? stringValue(value.content))
              : undefined),
        ),
      );
      const published = firstDefined(
        PUBLISHED_KEYS.map((key) => parseTimestamp(item[key])),
      );
      const updated = firstDefined(
        UPDATED_KEYS.map((key) => parseTimestamp(item[key])),
      );
      const metadata = Object.fromEntries(
        Object.entries(item).filter(
          ([key, value]) => value != null && !CONSUMED_KEYS.has(key),
        ),
      );
      return [
        {
          url,
          ...(title ? { title } : {}),
          ...(content ? { content } : {}),
          ...(snippets.length ? { snippets } : {}),
          ...(published != null ? { published } : {}),
          ...(updated != null ? { updated } : {}),
          ...(Object.keys(metadata).length ? { metadata } : {}),
        },
      ];
    });
}

function responseMetadata(
  payload: unknown,
): Record<string, unknown> | undefined {
  if (!isRecord(payload)) return undefined;
  const entries = Object.entries(payload).filter(
    ([key, value]) =>
      value != null &&
      key !== "answer" &&
      (["meta", "usage", "warnings", "images", "citations"].includes(key) ||
        typeof value !== "object" ||
        (Array.isArray(value)
          ? value.every((item) => item == null || typeof item !== "object")
          : Object.values(value).every(
              (item) => item == null || typeof item !== "object",
            ))),
  );
  return entries.length ? Object.fromEntries(entries) : undefined;
}

export function searchResponse(
  payload: unknown,
  results?: unknown,
  answer?: string,
): SearchResponse {
  const resolvedAnswer =
    answer ?? (isRecord(payload) ? stringValue(payload.answer) : undefined);
  const metadata = responseMetadata(payload);
  return {
    results: normalizeResults(results === undefined ? payload : results),
    ...(resolvedAnswer ? { answer: resolvedAnswer } : {}),
    ...(metadata ? { metadata } : {}),
  };
}
