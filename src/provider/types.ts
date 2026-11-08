import type { z } from "zod"
import type { CleanupEngine, Globals } from "../shared/config"

export type Provider<Settings = Record<string, unknown>> = {
  id: string
  weight: number
  keyless?: boolean | undefined
  keylessEnabled?(settings: Settings, globals: Globals): boolean | undefined
  options?: z.ZodType<Settings> | undefined
}

export type SettingsOf<P> = P extends { run: infer R }
  ? R extends (input: infer I) => unknown
    ? I extends { settings: infer S }
      ? S
      : Record<string, unknown>
    : Record<string, unknown>
  : Record<string, unknown>

export type ProviderKey = {
  key: string
  tier?: string | undefined
  weight?: number | undefined
}

export type ProviderEntry<Settings = Record<string, unknown>> = {
  keys?: string | readonly (string | ProviderKey)[] | undefined
  weight?: number | undefined
  cleanup?: CleanupEngine | undefined
} & Settings

export type ProviderRoute<P extends Provider<unknown>> = P & {
  key: string | undefined
  tier?: string | undefined
  keyIndex?: number | undefined
  settings: Record<string, unknown>
  cleanup?: CleanupEngine | undefined
}

export type AttemptDiagnostics = {
  provider: string
  keyless: boolean
  keyIndex?: number | undefined
  tier?: string | undefined
  queries?: string[] | undefined
  urls?: string[] | undefined
  durationMs: number
  ok: boolean
  error?: string | undefined
  cached?: boolean | undefined
}

export type ProviderUsage = {
  provider: string
  keyless: boolean
  tier?: string | undefined
  requests: number
  results?: number | undefined
  pages?: number | undefined
  errors: number
}
