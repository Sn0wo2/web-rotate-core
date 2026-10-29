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

const STRING_LIST_SEPARATOR = /[\s,;]+/

export function stringList(value: unknown): string[] {
  return (Array.isArray(value) ? value : [value]).flatMap((item) =>
    typeof item === "string" ? item.split(STRING_LIST_SEPARATOR).filter(Boolean) : [],
  )
}

export const globalsSchema = z.object({
  cacheWindowSeconds: z.coerce.number().transform(Math.trunc).pipe(z.number().nonnegative()).catch(0),
  cleanup: z.enum(["none", "defuddle"]).catch("none"),
  prefer: z.enum(["keyed", "keyless"]).catch("keyless"),
  concurrency: z.coerce.number().transform(Math.trunc).pipe(z.number().positive()).catch(4),
  maxAttempts: z.coerce.number().transform(Math.trunc).pipe(z.number().positive()).catch(3),
  searchResults: z.coerce.number().transform(Math.trunc).pipe(z.number().positive()).catch(8),
})

export type Globals = z.output<typeof globalsSchema>
