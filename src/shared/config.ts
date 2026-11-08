import { LRUCache } from "lru-cache"
import { z } from "zod"

export class RotateConfigError extends Error {
  constructor(
    message: string,
    readonly code: "configuration" | "unsupported-provider" = "configuration",
  ) {
    super(message)
    this.name = "RotateConfigError"
  }
}

export function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value.trim() || undefined : undefined
}

export const CLEANUP_ENGINES = [
  "none",
  "defuddle",
  "readability",
  "article-extractor",
  "mercury",
  "trafilatura",
  "firecrawl-html",
] as const

export type CleanupEngine = (typeof CLEANUP_ENGINES)[number]

export const cleanupEngineSchema = z.enum(CLEANUP_ENGINES)

export const globalsSchema = z.object({
  cacheWindowSeconds: z.coerce.number().transform(Math.trunc).pipe(z.number().nonnegative()).catch(0),
  cache: z.custom<LRUCache<string, NonNullable<unknown>>>((value) => value instanceof LRUCache).optional(),
  cleanup: cleanupEngineSchema.catch("none"),
  prefer: z.enum(["keyed", "keyless"]).catch("keyless"),
  concurrency: z.coerce.number().transform(Math.trunc).pipe(z.number().positive()).catch(4),
  maxAttempts: z.coerce.number().transform(Math.trunc).pipe(z.number().positive()).catch(3),
  searchResults: z.coerce.number().transform(Math.trunc).pipe(z.number().positive()).catch(8),
})

export type Globals = z.output<typeof globalsSchema>
