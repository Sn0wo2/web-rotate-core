import { isPlainObject as isRecord } from "es-toolkit/predicate"
import { HTTPError, REQUEST_TIMEOUT_MS, timedSignal } from "../shared/http"
import type { AttemptDiagnostics, ProviderUsage } from "./types"

export function routeAttempt(route: {
  id: string
  key: string | undefined
  tier?: string | undefined
  keyIndex?: number | undefined
}): Pick<AttemptDiagnostics, "provider" | "keyless" | "tier" | "keyIndex"> {
  return {
    provider: route.id,
    keyless: route.key === undefined,
    ...(route.tier === undefined ? {} : { tier: route.tier }),
    ...(route.keyIndex === undefined ? {} : { keyIndex: route.keyIndex }),
  }
}

export function usageEntry(
  usage: Map<string, ProviderUsage>,
  route: { id: string; key: string | undefined; tier?: string | undefined },
  init?: { results?: number | undefined; pages?: number | undefined },
): ProviderUsage {
  const bucket = `${route.id}\u0000${route.key === undefined ? "\u0000keyless" : (route.tier ?? "")}`
  const existing = usage.get(bucket)
  if (existing) return existing
  const entry: ProviderUsage = {
    provider: route.id,
    keyless: route.key === undefined,
    ...(route.key === undefined || route.tier === undefined ? {} : { tier: route.tier }),
    requests: 0,
    errors: 0,
    ...(init?.results === undefined ? {} : { results: init.results }),
    ...(init?.pages === undefined ? {} : { pages: init.pages }),
  }
  usage.set(bucket, entry)
  return entry
}

export function requireKey(provider: string, key: string | undefined): string {
  if (!key) throw new Error(`${provider} API key is not configured`)
  return key
}

export function firstList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload
  if (!isRecord(payload)) return []
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
  )
}

export function responseMetadata(payload: unknown): Record<string, unknown> | undefined {
  if (!isRecord(payload)) return undefined
  const entries = Object.entries(payload).filter(
    ([key, value]) =>
      value != null &&
      key !== "answer" &&
      (["meta", "usage", "warnings", "images", "citations"].includes(key) ||
        typeof value !== "object" ||
        (Array.isArray(value)
          ? value.every((item) => item == null || typeof item !== "object")
          : Object.values(value).every((item) => item == null || typeof item !== "object"))),
  )
  return entries.length ? Object.fromEntries(entries) : undefined
}

export function urlParams(
  endpoint: URL,
  options: Record<string, unknown>,
  encode?: (name: string, value: unknown) => string | readonly [string, string][] | undefined,
): URL {
  for (const [name, value] of Object.entries(options)) {
    if (value == null) continue
    const encoded = encode?.(name, value)
    if (encoded != null) {
      if (typeof encoded === "string") endpoint.searchParams.set(name, encoded)
      else for (const [key, item] of encoded) endpoint.searchParams.set(key, item)
      continue
    }
    if (Array.isArray(value)) {
      for (const item of value) endpoint.searchParams.append(name, String(item))
    } else if (isRecord(value)) {
      endpoint.searchParams.set(name, JSON.stringify(value))
    } else {
      endpoint.searchParams.set(name, String(value))
    }
  }
  return endpoint
}

export function scrapingbeeURL(path: string, params: Record<string, unknown>): URL {
  const endpoint = new URL(path, "https://app.scrapingbee.com")
  for (const [name, value] of Object.entries(params)) {
    if (
      value == null ||
      (typeof value !== "number" &&
        typeof value !== "boolean" &&
        (typeof value === "object" ? Object.keys(value).length === 0 : !value))
    )
      continue
    if (["extract_rules", "js_scenario", "ai_extract_rules"].includes(name) && typeof value !== "string") {
      urlParams(endpoint, { [name]: value }, (_, item) => JSON.stringify(item))
    } else if (Array.isArray(value)) {
      for (const item of value) if (item != null) endpoint.searchParams.append(`${name}[]`, String(item))
    } else {
      urlParams(endpoint, { [name]: value }, (parameter, item) => {
        if (parameter === "js_snippet" && typeof item === "string") {
          let binary = ""
          for (const byte of new TextEncoder().encode(item)) binary += String.fromCharCode(byte)
          return btoa(binary)
        }
        return undefined
      })
    }
  }
  return endpoint
}

export async function sdkRequest<T>(
  signal: AbortSignal,
  run: (signal: AbortSignal) => Promise<T>,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<T> {
  const gate = timedSignal(signal, timeoutMs)
  try {
    return await Promise.race([
      run(gate),
      new Promise<never>((_, reject) => {
        if (gate.aborted) reject(gate.reason)
        else
          gate.addEventListener("abort", () => reject(gate.reason), {
            once: true,
          })
      }),
    ])
  } catch (error) {
    const status = (error as { status?: unknown } | null)?.status
    if (typeof status === "number" && status >= 400)
      throw Object.assign(new HTTPError(status, error instanceof Error ? error.message : String(error)), {
        cause: error,
      })
    throw error
  }
}
