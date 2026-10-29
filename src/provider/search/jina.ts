import { clamp } from "es-toolkit/math"
import { isPlainObject as isRecord } from "es-toolkit/predicate"
import { z } from "zod"
import { apiJSON } from "../../shared/http"
import { urlParams } from "../utils"
import type { SearchProvider } from "./types"
import { searchResponse } from "./utils"

const settingsSchema = z.looseObject({
  headers: z.record(z.string(), z.string()).optional(),
})
type JinaSearchSettings = z.output<typeof settingsSchema>

export const jina = {
  id: "jina",
  weight: 58,
  options: settingsSchema,
  run: async ({ settings, key, queries, signal, globals }) => {
    if (!key) throw new Error("jina API key is not configured for search")
    const { headers, ...options } = settings
    const endpoint = urlParams(new URL("https://s.jina.ai"), {
      num: clamp(globals.searchResults, 1, 20),
      ...options,
      q: queries[0],
    })
    const payload = await apiJSON(endpoint.toString(), signal, {
      headers: {
        Authorization: `Bearer ${key}`,
        "X-Respond-With": "no-content",
        ...headers,
        ...(globals.cacheWindowSeconds === 0
          ? { "X-No-Cache": "true" }
          : { "X-Cache-Tolerance": String(globals.cacheWindowSeconds) }),
      },
    })
    return searchResponse(
      payload,
      Array.isArray(payload)
        ? payload.flatMap((item) => (isRecord(item) && Array.isArray(item.data) ? item.data : [item]))
        : undefined,
    )
  },
} satisfies SearchProvider<JinaSearchSettings>
