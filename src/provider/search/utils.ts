import { clamp } from "es-toolkit/math";
import { compact } from "es-toolkit/array";
import { isPlainObject as isRecord } from "es-toolkit/predicate";
import { apiJSON } from "../../shared/http";
import type { Globals } from "../../shared/config";
import { stringValue } from "../../shared/config";
import type { URLList } from "../../shared/types";
import type { SearchProvider, SearchResponse, SearchResult } from "./types";
import { firstList, responseMetadata } from "../utils";

export function searchCount(globals: Globals, maximum = 100): number {
  return clamp(globals.searchResults, 1, maximum);
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

export function restSearch<S>(
  url: string,
  body: (input: { settings: S; queries: URLList; globals: Globals }) => unknown,
  headers: (key: string | undefined) => Record<string, string>,
  select?: (payload: unknown) => unknown,
): SearchProvider<S>["run"] {
  return async ({ settings, queries, signal, globals, key }) => {
    const payload = await apiJSON(url, signal, {
      body: body({ settings, queries, globals }),
      headers: headers(key),
    });
    return searchResponse(payload, select?.(payload));
  };
}
