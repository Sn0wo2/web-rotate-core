import type { Globals } from "../../shared/config"
import type { URLList } from "../../shared/types"
import type { Provider, ProviderEntry, SettingsOf } from "../types"

export type SearchResult = {
  url: string
  title?: string
  content?: string
  snippets?: string[]
  published?: number
  updated?: number
  provider?: string
  queries?: string[]
  metadata?: Record<string, unknown>
}

export type SearchResponse = {
  results: SearchResult[]
  answer?: string
  citations?: { url: string; title?: string; start?: number; end?: number }[]
  metadata?: Record<string, unknown>
}

export type SearchOutcome = {
  results: SearchResult[]
  responses: (Omit<SearchResponse, "results"> & {
    provider: string
    queries: string[]
  })[]
  errors?: { query: string; error: string }[]
}

export type SearchProvider<Settings = Record<string, unknown>> = Provider<Settings> & {
  batchSize?: number | undefined
  run(input: {
    settings: Settings
    key: string | undefined
    queries: URLList
    signal: AbortSignal
    globals: Globals
  }): Promise<SearchResponse>
}

export type SearchProviderConfigBase<P extends readonly SearchProvider[]> = {
  [K in P[number]["id"]]+?: ProviderEntry<SettingsOf<Extract<P[number], { id: K }>>>
}
