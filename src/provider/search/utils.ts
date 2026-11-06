import { compact } from "es-toolkit/array"
import { pick } from "es-toolkit/object"
import { isPlainObject as isRecord } from "es-toolkit/predicate"
import type { Globals } from "../../shared/config"
import { stringValue } from "../../shared/config"
import { apiJSON } from "../../shared/http"
import type { URLList } from "../../shared/types"
import type { ModelResult } from "../ai"
import { modelMetadata } from "../ai"
import { firstList, responseMetadata } from "../utils"
import type { SearchProvider, SearchResponse, SearchResult } from "./types"

const URL_KEYS = ["url", "link", "pageUrl", "page_url"] as const
const TITLE_KEYS = ["title", "name"] as const
const CONTENT_KEYS = ["content", "summary", "highlight", "snippet", "description", "text"] as const
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
] as const
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
] as const
const CONSUMED_KEYS = new Set<string>([
  ...URL_KEYS,
  ...TITLE_KEYS,
  ...CONTENT_KEYS,
  "snippets",
  "highlights",
  "excerpts",
  "contents",
  ...PUBLISHED_KEYS,
  ...UPDATED_KEYS,
])
function parseTimestamp(value: unknown): number | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) return undefined
    const numeric = Number(trimmed)
    if (Number.isNaN(numeric)) {
      const parsed = Date.parse(trimmed)
      return Number.isNaN(parsed) ? undefined : parsed
    }
    value = numeric
  }
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.round(value < 1e12 ? value * 1000 : value)
    : undefined
}

export function normalizeResults(payload: unknown): SearchResult[] {
  return firstList(payload)
    .filter(isRecord)
    .flatMap((item): SearchResult[] => {
      const url = URL_KEYS.map((key) => stringValue(item[key])).find((value) => value != null)
      if (!url) return []
      const parsed = URL.parse(url)
      if (
        !parsed ||
        (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
        parsed.username ||
        parsed.password
      )
        return []
      const title = TITLE_KEYS.map((key) => stringValue(item[key])).find((value) => value != null)
      const content = CONTENT_KEYS.map((key) => stringValue(item[key])).find((value) => value != null)
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
            (isRecord(value) ? (stringValue(value.text) ?? stringValue(value.content)) : undefined),
        ),
      )
      const published = PUBLISHED_KEYS.map((key) => parseTimestamp(item[key])).find((value) => value != null)
      const updated = UPDATED_KEYS.map((key) => parseTimestamp(item[key])).find((value) => value != null)
      const metadata = Object.fromEntries(
        Object.entries(item).filter(([key, value]) => value != null && !CONSUMED_KEYS.has(key)),
      )
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
      ]
    })
}

export function searchResponse(payload: unknown, results?: unknown, answer?: string): SearchResponse {
  const resolvedAnswer = answer ?? (isRecord(payload) ? stringValue(payload.answer) : undefined)
  const metadata = responseMetadata(payload)
  return {
    results: normalizeResults(results === undefined ? payload : results),
    ...(resolvedAnswer ? { answer: resolvedAnswer } : {}),
    ...(metadata ? { metadata } : {}),
  }
}

export function searchInstructions(
  settings: { api?: string | undefined; instructions?: string | undefined },
  count: number,
) {
  return (
    settings.instructions?.trim() ||
    (settings.api === "answer"
      ? "Search the web and answer the question using reliable sources. Include inline citations for factual claims."
      : `Search the web. Return at most ${count} concise factual snippets, one per line with an inline citation. Do not write a long-form answer.`)
  )
}

export function modelSearchResponse(result: ModelResult): SearchResponse {
  if (["error", "content-filter", "length"].includes(result.finishReason))
    throw new Error(`web search generation failed: ${result.rawFinishReason ?? result.finishReason}`)
  const payload = result.finalStep.response.body
  if (isRecord(payload) && (payload.error || (payload.status != null && payload.status !== "completed")))
    throw new Error("web search returned a failed or incomplete response")
  const rawParts = (isRecord(payload) && Array.isArray(payload.output) ? payload.output : [])
    .flatMap((item) =>
      isRecord(item) && item.type === "message" && Array.isArray(item.content) ? item.content.filter(isRecord) : [],
    )
    .filter((part) => part.type === "output_text")
  const citations: NonNullable<SearchResponse["citations"]> = []
  let answer = ""
  let index = 0
  let position = 0
  for (const part of result.finalStep.content) {
    if (part.type !== "text") continue
    const offset = position + (answer ? 1 : 0)
    answer = answer ? `${answer}\n${part.text}` : part.text
    for (const citation of part.citations ?? []) {
      if (citation.source.sourceType !== "url") continue
      citations.push({
        url: citation.source.url,
        ...(citation.source.title ? { title: citation.source.title } : {}),
        ...(citation.startIndex == null ? {} : { start: offset + citation.startIndex }),
        ...(citation.endIndex == null ? {} : { end: offset + citation.endIndex }),
      })
    }
    if (!part.citations?.length) {
      const annotations = rawParts[index]?.annotations
      for (const annotation of Array.isArray(annotations) ? annotations : []) {
        if (!isRecord(annotation) || annotation.type !== "url_citation" || typeof annotation.url !== "string") continue
        const title = stringValue(annotation.title)
        citations.push({
          url: annotation.url,
          ...(title ? { title } : {}),
          ...(typeof annotation.start_index === "number" ? { start: offset + annotation.start_index } : {}),
          ...(typeof annotation.end_index === "number" ? { end: offset + annotation.end_index } : {}),
        })
      }
    }
    position = offset + [...part.text].length
    index++
  }
  const sources = [
    ...citations,
    ...result.sources.filter((source) => source.sourceType === "url"),
    ...result.toolResults.flatMap(({ output }) =>
      Array.isArray(output) ? output : isRecord(output) && Array.isArray(output.sources) ? output.sources : [],
    ),
    ...(isRecord(payload) && Array.isArray(payload.citations)
      ? payload.citations.map((url) => (typeof url === "string" ? { url } : url))
      : []),
  ]
  const results = new Map<string, SearchResult>()
  for (const item of normalizeResults(sources)) {
    const existing = results.get(item.url)
    if (!existing) results.set(item.url, pick(item, ["url", "title", "content", "published"]))
    else if (!existing.title && item.title) existing.title = item.title
  }
  if (!results.size) throw new Error("web search returned no grounded sources")
  const validCitations = citations.filter(({ url }) => results.has(url))
  return {
    results: [...results.values()],
    ...(answer.trim() ? { answer } : {}),
    citations: validCitations.length
      ? validCitations
      : [...results.values()].map((item) => pick(item, ["url", "title"])),
    metadata: modelMetadata(result),
  }
}

export function answerResponse(payload: unknown, results?: unknown, answer?: unknown): SearchResponse {
  const value = answer ?? (isRecord(payload) ? payload.answer : undefined)
  const sources = results ?? (isRecord(payload) ? (payload.sources ?? payload.citations ?? payload) : payload)
  const response = searchResponse(
    payload,
    firstList(sources).map((source) => (typeof source === "string" ? { url: source } : source)),
    value == null ? undefined : typeof value === "string" ? stringValue(value) : JSON.stringify(value),
  )
  if (!(response.results.length || response.answer))
    throw new Error("answer response contained neither sources nor an answer")
  return {
    ...response,
    citations: response.results.map((result) => pick(result, ["url", "title"])),
  }
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
    })
    return searchResponse(payload, select?.(payload))
  }
}
