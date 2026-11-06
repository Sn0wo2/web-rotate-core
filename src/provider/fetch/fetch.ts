import { orderBy } from "es-toolkit/array"
import { clamp } from "es-toolkit/math"
import { omit } from "es-toolkit/object"
import { globalsSchema, RotateConfigError } from "../../shared/config"
import { HTTPError } from "../../shared/http"
import type { LRUCache } from "../../shared/lru"
import type { URLList } from "../../shared/types"
import { mapConcurrent } from "../../shared/utils"
import { providerRoutes, resolveProviderEntries } from "../rotation"
import type { AttemptDiagnostics, ProviderEntry, ProviderUsage } from "../types"
import { routeAttempt, usageEntry } from "../utils"
import { fetchImage } from "./image"
import { FETCH_PROVIDERS } from "./index"
import type { FetchFormat, FetchOutcome, FetchPage, FetchProvider, FetchProviderConfigBase } from "./types"

export type FetchProviderConfig<P extends readonly FetchProvider[] = []> = {
  cache?: LRUCache | undefined
  cacheWindowSeconds?: number | undefined
  providers?: (FetchProviderConfigBase<typeof FETCH_PROVIDERS> & FetchProviderConfigBase<NoInfer<P>>) | undefined
  cleanup?: "none" | "defuddle" | undefined
  prefer?: "keyed" | "keyless" | undefined
  concurrency?: number | undefined
  maxAttempts?: number | undefined
}

export type DefaultFetchProviderConfig = FetchProviderConfig

export const DEFAULT_FETCH_PROVIDER_CONFIG: DefaultFetchProviderConfig = {
  cacheWindowSeconds: 0,
  providers: {
    tavily: {},
    parallel: {},
    you: {},
    exa: {},
    hyperbrowser: {},
    firecrawl: {},
    tinyfish: {},
    jina: {},
    scrapingant: {},
    scrapingbee: {},
    scrapfly: {},
    diffbot: {},
    brightdata: {},
    apify: {},
    linkup: {},
    deepseek: {},
    bocha: {},
    native: {},
    zhipu: {},
  },
}

export async function fetchWeb<P extends readonly FetchProvider[] = []>({
  urls,
  format,
  signal,
  config = {},
  implementations,
}: {
  urls: URLList
  format: FetchFormat
  signal: AbortSignal
  config?: FetchProviderConfig<P> | undefined
  implementations?: P | undefined
}): Promise<FetchOutcome> {
  const globals = globalsSchema.parse(config)
  const registry = new Map<string, FetchProvider>()
  for (const provider of [...FETCH_PROVIDERS, ...(implementations ?? [])]) registry.set(provider.id, provider)
  const enabled = [...registry.values()]
  const entries = resolveProviderEntries(
    enabled,
    config.providers as Record<string, ProviderEntry> | undefined,
    "fetch",
  )
  const pool = providerRoutes(enabled, entries, globals)
  const nativeOnly = entries.size === 1 && entries.has("native")
  signal.throwIfAborted()
  if (!urls.length) throw new RotateConfigError("fetch URLs must not be empty")

  const { outcome: imageOutcome, attempts: imageAttempts } = await fetchImage(
    urls,
    signal,
    entries.has("native"),
    nativeOnly,
  )
  if (imageOutcome) return imageOutcome

  const cache = globals.cache?.enabled ? globals.cache : undefined
  const fetchKey = (url: string) => `fetch:v1:${globals.cleanup}:${format}:${url}`

  const candidates = orderBy(
    pool.filter((route) => format !== "html" || route.formats.includes("html")),
    ["weight"],
    ["desc"],
  )
  const pagesByURL = new Map<string, FetchPage>()
  const errorsByURL = new Map<string, string>()
  const providerByURL = new Map<string, string>()
  const blocked = new Set<string>()
  const attempts: AttemptDiagnostics[] = []
  const usage = new Map<string, ProviderUsage>()
  let pendingURLs = [...new Set(urls)]
  if (cache) {
    const cachedURLs: string[] = []
    const uncachedURLs: string[] = []
    for (const url of pendingURLs) {
      const page = cache.get<FetchPage>(fetchKey(url))
      if (page?.content) {
        pagesByURL.set(url, page)
        cachedURLs.push(url)
      } else uncachedURLs.push(url)
    }
    pendingURLs = uncachedURLs
    if (cachedURLs.length)
      attempts.push({ provider: "cache", keyless: true, urls: cachedURLs, durationMs: 0, ok: true, cached: true })
  }
  const maxAttempts = Math.max(1, Math.min(globals.maxAttempts, candidates.length))
  let routeTries = 0
  for (const route of candidates) {
    if (!pendingURLs.length || routeTries >= maxAttempts) break
    const fallbackFormat = route.formats[0]
    if (blocked.has(route.id) || fallbackFormat === undefined) {
      attempts.push({
        ...routeAttempt(route),
        urls: [...pendingURLs],
        durationMs: 0,
        ok: false,
        error: blocked.has(route.id)
          ? "skipped: provider blocked after an invalid-request error"
          : "skipped: provider supports no usable format",
      })
      continue
    }
    routeTries++
    for (const url of pendingURLs) providerByURL.set(url, route.id)
    const usageRecord = usageEntry(usage, route, { pages: 0 })
    const started = performance.now()
    try {
      const nativeFormat =
        globals.cleanup !== "none" && route.formats.includes("html")
          ? "html"
          : route.formats.includes(format)
            ? format
            : format === "markdown" && route.formats.includes("html")
              ? "html"
              : route.formats.includes("markdown")
                ? "markdown"
                : fallbackFormat
      const routePages = await route.run({
        settings: route.settings,
        key: route.key,
        urls: pendingURLs as URLList,
        signal,
        format: nativeFormat,
        globals,
      })
      usageRecord.requests++
      usageRecord.pages = (usageRecord.pages ?? 0) + routePages.length
      attempts.push({
        ...routeAttempt(route),
        urls: [...pendingURLs],
        durationMs: Math.round(performance.now() - started),
        ok: true,
      })
      signal.throwIfAborted()
      const convertedPages = await mapConcurrent(
        routePages,
        async (page) => {
          if (!page.content) return page
          try {
            if (!page.format) throw new Error(`${route.id} did not report its content format`)
            return {
              ...page,
              provider: route.id,
              ...(page.format === format && (page.format !== "html" || globals.cleanup === "none")
                ? {}
                : await (await import("./cleanup")).convertContent(
                    page.content,
                    page.format,
                    page.finalURL ?? page.url,
                    format,
                    globals.cleanup,
                  )),
            }
          } catch (error) {
            if (signal.aborted) throw error
            return {
              ...omit(page, ["content"]),
              provider: route.id,
              error: error instanceof Error ? error.message : String(error),
            }
          }
        },
        clamp(globals.concurrency, 1, 16),
        signal,
      )
      const routePagesByURL = new Map(convertedPages.map((page) => [page.url, page]))
      if (
        convertedPages.some(
          (page) =>
            page.error &&
            typeof page.metadata?.httpStatus === "number" &&
            new HTTPError(page.metadata.httpStatus, page.error).invalidRequest,
        )
      )
        blocked.add(route.id)
      const nextURLs: string[] = []
      for (const url of pendingURLs) {
        const page = routePagesByURL.get(url)
        if (page?.content) {
          pagesByURL.set(url, page)
          errorsByURL.delete(url)
          cache?.set(fetchKey(url), page, { ttlSeconds: globals.cacheWindowSeconds })
        } else {
          if (page?.error) errorsByURL.set(url, page.error)
          nextURLs.push(url)
        }
      }
      pendingURLs = nextURLs
    } catch (error) {
      if (signal.aborted || error instanceof RotateConfigError) throw error
      const message = error instanceof Error ? error.message : String(error)
      usageRecord.requests++
      usageRecord.errors++
      attempts.push({
        ...routeAttempt(route),
        urls: [...pendingURLs],
        durationMs: Math.round(performance.now() - started),
        ok: false,
        error: message,
      })
      if (error instanceof HTTPError && error.invalidRequest) blocked.add(route.id)
      for (const url of pendingURLs) errorsByURL.set(url, message)
    }
  }
  const pages = urls.map((url) => {
    const page = pagesByURL.get(url)
    if (page) return page
    const provider = providerByURL.get(url)
    return {
      url,
      error: errorsByURL.get(url) ?? "webfetch failed",
      ...(provider === undefined ? {} : { provider }),
    }
  })
  const recordedAttempts = imageAttempts.length ? [...imageAttempts, ...attempts] : attempts
  if (urls.length === 1 && pages[0]?.error)
    throw Object.assign(new Error(pages[0].error), { attempts: recordedAttempts })
  return {
    type: "pages",
    pages,
    ...(recordedAttempts.length ? { attempts: recordedAttempts } : {}),
    ...(usage.size ? { usage: [...usage.values()] } : {}),
  }
}
