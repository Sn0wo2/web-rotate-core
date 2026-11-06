import { chunk, orderBy, uniq } from "es-toolkit/array"
import { clamp } from "es-toolkit/math"
import { globalsSchema, RotateConfigError } from "../../shared/config"
import { HTTPError, timedSignal } from "../../shared/http"
import type { LRUCache } from "../../shared/lru"
import type { URLList } from "../../shared/types"
import { mapConcurrent } from "../../shared/utils"
import { providerRoutes, resolveProviderEntries } from "../rotation"
import type { AttemptDiagnostics, ProviderEntry, ProviderUsage } from "../types"
import { routeAttempt, usageEntry } from "../utils"
import { SEARCH_PROVIDERS } from "./index"
import type { SearchOutcome, SearchProvider, SearchProviderConfigBase, SearchResult } from "./types"

export type SearchProviderConfig<P extends readonly SearchProvider[] = []> = {
  cache?: LRUCache | undefined
  cacheWindowSeconds?: number | undefined
  providers?: (SearchProviderConfigBase<typeof SEARCH_PROVIDERS> & SearchProviderConfigBase<NoInfer<P>>) | undefined
  prefer?: "keyed" | "keyless" | undefined
  concurrency?: number | undefined
  maxAttempts?: number | undefined
  searchResults?: number | undefined
}

export type DefaultSearchProviderConfig = SearchProviderConfig

export const DEFAULT_SEARCH_PROVIDER_CONFIG: DefaultSearchProviderConfig = {
  cacheWindowSeconds: 0,
  providers: {
    perplexity: {},
    octen: {},
    tavily: {},
    parallel: {},
    you: {},
    nimble: {},
    exa: {},
    brave: {},
    hyperbrowser: {},
    firecrawl: {},
    tinyfish: {},
    keenable: {},
    serper: {},
    bocha: {},
    jina: {},
    scrapingbee: {},
    diffbot: {},
    brightdata: {},
    apify: {},
    linkup: {},
    doubao: {},
    deepseek: {},
    openai: {},
    grok: {},
    claude: {},
    gemini: {},
    native: {},
    zhipu: {},
  },
}

export async function searchWeb<P extends readonly SearchProvider[] = []>({
  queries,
  signal,
  config = {},
  implementations,
}: {
  queries: URLList
  signal: AbortSignal
  config?: SearchProviderConfig<P> | undefined
  implementations?: P | undefined
}): Promise<SearchOutcome> {
  const globals = globalsSchema.parse(config)
  const registry = new Map<string, SearchProvider>()
  for (const provider of [...SEARCH_PROVIDERS, ...(implementations ?? [])]) registry.set(provider.id, provider)
  const enabled = [...registry.values()]
  const entries = resolveProviderEntries(
    enabled,
    config.providers as Record<string, ProviderEntry> | undefined,
    "websearch",
  )
  const pool = providerRoutes(enabled, entries, globals)
  signal.throwIfAborted()
  if (!queries.length || queries.some((query) => !query.trim()))
    throw new RotateConfigError("search queries must not be empty")
  const uniqueQueries = uniq(queries.map((query) => query.trim()))
  const maxResults = clamp(globals.searchResults, 1, 100)
  const cache = globals.cache?.enabled ? globals.cache : undefined
  const candidates = orderBy(pool, ["weight"], ["desc"])
  const maxAttempts = Math.min(globals.maxAttempts, candidates.length)
  const pending = new Set(uniqueQueries)
  const blocked = new Map<string, Error>()
  const errors = new Map<string, { error: string; provider: string }>()
  const results = new Map<string, SearchResult>()
  const responses: SearchOutcome["responses"] = []
  const attempts: AttemptDiagnostics[] = []
  const usage = new Map<string, ProviderUsage>()
  const absorb = (incoming: SearchResult) => {
    const existing = results.get(incoming.url)
    if (!existing) {
      results.set(incoming.url, incoming)
      return
    }
    const snippets = uniq([
      ...(existing.snippets ?? []),
      ...(incoming.snippets ?? []),
      ...(existing.content && incoming.content && incoming.content !== existing.content ? [incoming.content] : []),
    ])
    const incomingQueries = incoming.queries ?? []
    const prior = existing.metadata?.providerResults
    results.set(incoming.url, {
      ...incoming,
      ...existing,
      ...(existing.title || !incoming.title ? {} : { title: incoming.title }),
      ...(existing.content || !incoming.content ? {} : { content: incoming.content }),
      ...(snippets.length ? { snippets } : {}),
      queries: uniq([...(existing.queries ?? []), ...incomingQueries]),
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
    })
  }
  if (cache) {
    const cachedQueries: string[] = []
    for (const query of uniqueQueries) {
      const cached = cache.get<SearchResult[]>(`search:v1:${maxResults}:${query}`)
      if (!cached) continue
      pending.delete(query)
      cachedQueries.push(query)
      for (const item of cached) absorb(item)
    }
    if (cachedQueries.length)
      attempts.push({ provider: "cache", keyless: true, queries: cachedQueries, durationMs: 0, ok: true, cached: true })
  }
  let routeTries = 0
  for (const route of candidates) {
    if (!pending.size || routeTries >= maxAttempts) break
    if (blocked.has(route.id)) {
      attempts.push({
        ...routeAttempt(route),
        queries: [...pending],
        durationMs: 0,
        ok: false,
        error: "skipped: provider blocked after an invalid-request error",
      })
      continue
    }
    routeTries++
    const groups = chunk([...pending], Math.min(pending.size, route.batchSize ?? 1))
    const outcomes = await mapConcurrent(
      groups,
      async (group) => {
        signal.throwIfAborted()
        const previousError = blocked.get(route.id)
        if (previousError) return { group, error: previousError.message, durationMs: 0, skipped: true }
        const started = performance.now()
        try {
          const budget = Math.max(1, Math.ceil(maxResults / uniqueQueries.length)) * group.length
          const response = await route.run({
            settings: route.settings,
            key: route.key,
            queries: group as URLList,
            signal: timedSignal(signal),
            globals: { ...globals, searchResults: budget },
          })
          return { group, response, durationMs: Math.round(performance.now() - started) }
        } catch (error) {
          if (signal.aborted || error instanceof RotateConfigError) throw error
          if (error instanceof HTTPError && error.invalidRequest) blocked.set(route.id, error)
          return {
            group,
            error: error instanceof Error ? error.message : String(error),
            durationMs: Math.round(performance.now() - started),
          }
        }
      },
      clamp(globals.concurrency, 1, 16),
      signal,
    )
    signal.throwIfAborted()
    const usageRecord = usageEntry(usage, route, { results: 0 })
    for (const outcome of outcomes) {
      if (!outcome.skipped) usageRecord.requests++
      if (!outcome.response) {
        const error = outcome.error ?? "search provider failed"
        if (!outcome.skipped) usageRecord.errors++
        attempts.push({
          ...routeAttempt(route),
          queries: outcome.group,
          durationMs: outcome.durationMs,
          ok: false,
          error: outcome.skipped ? "skipped: provider blocked after an invalid-request error" : error,
        })
        for (const query of outcome.group) errors.set(query, { error, provider: route.id })
        continue
      }
      attempts.push({
        ...routeAttempt(route),
        queries: outcome.group,
        durationMs: outcome.durationMs,
        ok: true,
      })
      const { results: items, ...response } = outcome.response
      usageRecord.results = (usageRecord.results ?? 0) + items.length
      responses.push({
        ...response,
        provider: route.id,
        queries: outcome.group,
      })
      for (const query of outcome.group) {
        pending.delete(query)
        errors.delete(query)
      }
      const attributed = items.map((item) => {
        return {
          ...item,
          provider: item.provider ?? route.id,
          queries: item.queries ?? outcome.group,
        }
      })
      for (const item of attributed) absorb(item)
      if (cache)
        for (const query of outcome.group) {
          const cached = attributed.filter((item) => item.queries.includes(query))
          if (cached.length || !(response.answer || response.citations?.length))
            cache.set(`search:v1:${maxResults}:${query}`, cached, { ttlSeconds: globals.cacheWindowSeconds })
        }
    }
  }
  if (pending.size === uniqueQueries.length)
    throw Object.assign(
      new Error(
        `all ${routeTries} attempt(s) failed. Last error: ${[...errors.values()].at(-1)?.error ?? "no usable provider route"}`,
      ),
      { attempts },
    )
  return {
    results: [...results.values()].slice(0, maxResults),
    responses,
    ...(attempts.length ? { attempts } : {}),
    ...(usage.size ? { usage: [...usage.values()] } : {}),
    ...(errors.size
      ? {
          errors: [...errors].map(([query, failure]) => {
            return { query, error: failure.error, provider: failure.provider }
          }),
        }
      : {}),
  }
}
