import { clamp } from "es-toolkit/math"
import { isPlainObject as isRecord } from "es-toolkit/predicate"
import { z } from "zod"
import { stringValue } from "../../shared/config"
import { apiJSON } from "../../shared/http"
import { requireKey } from "../utils"
import type { FetchProvider } from "./types"
import { fetchBatches, fetchPages } from "./utils"

const settingsSchema = z.looseObject({
  max_age_seconds: z.number().int().min(300).max(31_536_000).optional(),
})

export const octen = {
  id: "octen",
  weight: 60,
  formats: ["markdown", "text"],
  options: settingsSchema,
  run: async ({ settings, key, urls, signal, format, globals }) =>
    fetchBatches(urls, 20, globals, signal, async (batch) => {
      const payload = await apiJSON("https://api.octen.ai/extract", signal, {
        key: requireKey("octen", key),
        body: {
          max_age_seconds: clamp(globals.cacheWindowSeconds, 300, 31_536_000),
          ...settings,
          urls: batch,
          format,
        },
      })
      if (!isRecord(payload)) throw new Error("octen returned an invalid extraction response")
      if (payload.code != null && payload.code !== 0)
        throw new Error(stringValue(payload.msg) ?? `octen extraction failed: ${payload.code}`)
      const rows = isRecord(payload.data) && Array.isArray(payload.data.results) ? payload.data.results : []
      return fetchPages(
        batch,
        {
          ...payload,
          results: rows.filter(isRecord).map((item) => {
            return { ...item, error: stringValue(item.error_message) }
          }),
        },
        (item) => (item.status === "failed" ? undefined : stringValue(item.full_content)),
        format,
      )
    }),
} satisfies FetchProvider<z.output<typeof settingsSchema>>
