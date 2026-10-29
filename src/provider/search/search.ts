import { chunk, orderBy, uniq } from "es-toolkit/array"
import { clamp } from "es-toolkit/math"
import { globalsSchema, RotateConfigError } from "../../shared/config"
import { HTTPError, timedSignal } from "../../shared/http"
import type { URLList } from "../../shared/types"
import { mapConcurrent } from "../../shared/utils"
import { providerRoutes, resolveProviderEntries } from "../rotation"
import type { ProviderEntry } from "../types"
import { SEARCH_PROVIDERS } from "./index"
import type { SearchOutcome, SearchProvider, SearchProviderConfigBase, SearchResult } from "./types"

export type SearchProviderConfig<P extends readonly SearchProvider[] = []> = {
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
    linkup: {},
    doubao: {},
    deepseek: {},
    openai: {},
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
  const candidates = orderBy(pool, ["weight"], ["desc"])
  const maxAttempts = Math.max(1, Math.min(globals.maxAttempts, candidates.length))
  const pending = new Set(uniqueQueries)
  const blocked = new Map<string, Error>()
  const errors = new Map<string, string>()
  const results = new Map<string, SearchResult>()
  const responses: SearchOutcome["responses"] = []
  let attempts = 0
  for (const route of candidates) {
    if (!pending.size || attempts >= maxAttempts) break
    if (blocked.has(route.id)) continue
    attempts++
    const groups = chunk([...pending], Math.min(pending.size, route.batchSize ?? 1))
    const outcomes = await mapConcurrent(
      groups,
      async (group) => {
        signal.throwIfAborted()
        try {
          const previousError = blocked.get(route.id)
          if (previousError) throw previousError
          const budget = Math.max(1, Math.ceil(maxResults / uniqueQueries.length)) * group.length
          const response = await route.run({
            settings: route.settings,
            key: route.key,
            queries: group as URLList,
            signal: timedSignal(signal),
            globals: { ...globals, searchResults: budget },
          })
          return { group, response }
        } catch (error) {
          if (signal.aborted || error instanceof RotateConfigError) throw error
          if (error instanceof HTTPError && error.invalidRequest) blocked.set(route.id, error)
          return {
            group,
            error: error instanceof Error ? error.message : String(error),
          }
        }
      },
      clamp(globals.concurrency, 1, 16),
      signal,
    )
    signal.throwIfAborted()
    for (const outcome of outcomes) {
      if (!outcome.response) {
        const error = outcome.error ?? "search provider failed"
        for (const query of outcome.group) errors.set(query, error)
        continue
      }
      const { results: items, ...response } = outcome.response
      responses.push({
        ...response,
        provider: route.id,
        queries: outcome.group,
      })
      for (const query of outcome.group) {
        pending.delete(query)
        errors.delete(query)
      }
      for (const item of items) {
        const incoming = {
          ...item,
          provider: item.provider ?? route.id,
          queries: item.queries ?? outcome.group,
        }
        const existing = results.get(item.url)
        if (!existing) {
          results.set(item.url, incoming)
          continue
        }
        const snippets = uniq([
          ...(existing.snippets ?? []),
          ...(incoming.snippets ?? []),
          ...(existing.content && incoming.content && incoming.content !== existing.content ? [incoming.content] : []),
        ])
        const prior = existing.metadata?.providerResults
        results.set(item.url, {
          ...incoming,
          ...existing,
          ...(existing.title || !incoming.title ? {} : { title: incoming.title }),
          ...(existing.content || !incoming.content ? {} : { content: incoming.content }),
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
        })
      }
    }
  }
  if (!responses.length)
    throw new Error(
      `all ${attempts} attempt(s) failed. Last error: ${[...errors.values()].at(-1) ?? "no usable provider route"}`,
    )
  return {
    results: [...results.values()].slice(0, maxResults),
    responses,
    ...(errors.size
      ? {
          errors: [...errors].map(([query, error]) => {
            return { query, error }
          }),
        }
      : {}),
  }
}
