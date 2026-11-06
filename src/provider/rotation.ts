import { compact, zip } from "es-toolkit/array"
import { z } from "zod"
import type { Globals } from "../shared/config"
import { RotateConfigError, stringList, stringValue } from "../shared/config"
import type { Provider, ProviderEntry, ProviderKey, ProviderRoute } from "./types"

export type ParsedEntry = {
  keys: ProviderKey[]
  settings: Record<string, unknown>
  weight: number
}

function parseKeyToken(token: string): ProviderKey {
  const separator = token.indexOf("::")
  if (separator > 0) {
    const tier = token.slice(0, separator).trim()
    const key = token.slice(separator + 2).trim()
    if (tier && key) return { key, tier }
  }
  return { key: token }
}

export function parseProviderKeys(value: unknown, label: string): ProviderKey[] {
  if (value === undefined) return []
  const keys: ProviderKey[] = []
  const seen = new Set<string>()
  for (const item of Array.isArray(value) ? value : [value]) {
    if (typeof item === "string") {
      for (const token of stringList(item)) {
        const parsed = parseKeyToken(token)
        if (!seen.has(parsed.key)) {
          seen.add(parsed.key)
          keys.push(parsed)
        }
      }
      continue
    }
    if (typeof item !== "object" || item === null)
      throw new RotateConfigError(`${label} provider keys must be strings or { key, tier?, weight? } objects`)
    const { key, tier, weight } = item as Record<string, unknown>
    if (typeof key !== "string" || !key.trim())
      throw new RotateConfigError(`${label} provider key objects require a non-empty string "key"`)
    if (seen.has(key.trim())) continue
    seen.add(key.trim())
    const parsedTier = stringValue(tier)
    keys.push({
      key: key.trim(),
      ...(parsedTier ? { tier: parsedTier } : {}),
      ...(typeof weight === "number" && Number.isFinite(weight) ? { weight } : {}),
    })
  }
  return keys
}

export function resolveProviderEntries<P extends Provider<unknown>>(
  providers: readonly P[],
  config: Readonly<Record<string, ProviderEntry>> | undefined,
  label: string,
): Map<string, ParsedEntry> {
  const byID = new Map(providers.map((provider) => [provider.id, provider]))
  const slots = config ?? Object.fromEntries(providers.map((provider) => [provider.id, {} as ProviderEntry]))
  const entries = new Map<string, ParsedEntry>()
  for (const [id, entry] of Object.entries(slots)) {
    const provider = byID.get(id)
    if (!provider) throw new RotateConfigError(`${label} provider "${id}" is not registered`, "unsupported-provider")
    const { keys, weight, ...settings } = entry
    let resolved: Record<string, unknown> = settings
    if (provider.options) {
      const parsed = provider.options.safeParse(settings)
      if (!parsed.success)
        throw new RotateConfigError(`invalid settings for ${label} provider "${id}": ${z.prettifyError(parsed.error)}`)
      resolved = parsed.data as Record<string, unknown>
    }
    entries.set(id, {
      keys: parseProviderKeys(keys, label),
      settings: resolved,
      weight: weight ?? provider.weight,
    })
  }
  return entries
}

export function providerRoutes<P extends Provider<unknown>>(
  providers: readonly P[],
  entries: ReadonlyMap<string, ParsedEntry>,
  globals: Globals,
): ProviderRoute<P>[] {
  const groups = providers
    .filter((provider) => entries.has(provider.id))
    .map((provider) => {
      const entry = entries.get(provider.id)
      if (!entry) return []
      const keyless =
        provider.keyless && (provider.keylessEnabled?.(entry.settings, globals) ?? true)
          ? [{ key: undefined, tier: undefined, weight: undefined, keyIndex: undefined }]
          : []
      const keyed = entry.keys.map((parsed, index) => {
        return { ...parsed, keyIndex: index }
      })
      return (globals.prefer === "keyless" ? [...keyless, ...keyed] : [...keyed, ...keyless]).map((parsed) => {
        return {
          ...provider,
          key: parsed.key,
          ...(parsed.tier === undefined ? {} : { tier: parsed.tier }),
          ...(parsed.keyIndex === undefined ? {} : { keyIndex: parsed.keyIndex }),
          settings: entry.settings,
          weight: parsed.weight ?? entry.weight,
        }
      })
    })
  return compact(zip(...groups).flat())
}
