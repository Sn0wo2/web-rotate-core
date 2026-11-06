import { clamp } from "es-toolkit/math"
import { isPlainObject as isRecord } from "es-toolkit/predicate"
import { z } from "zod"
import { apiJSON } from "../../shared/http"
import { requireKey } from "../utils"
import type { SearchProvider } from "./types"
import { searchResponse } from "./utils"

const settingsSchema = z.looseObject({ actorId: z.string().optional() })

export const apify = {
  id: "apify",
  weight: 55,
  options: settingsSchema,
  run: async ({ settings, key, queries, signal, globals }) => {
    const { actorId, ...options } = settings
    const actorPath = encodeURIComponent((actorId?.trim() || "apify~google-search-scraper").replace(/\//g, "~"))
    const payload = await apiJSON(`https://api.apify.com/v2/actors/${actorPath}/run-sync-get-dataset-items`, signal, {
      key: requireKey("apify", key),
      body: {
        maxPagesPerQuery: Math.ceil(clamp(globals.searchResults, 1, 100) / 10),
        ...options,
        queries: queries[0],
      },
    })
    if (!Array.isArray(payload)) throw new Error("apify search returned an invalid dataset")
    for (const item of payload) {
      if (isRecord(item) && item.error) throw new Error(String(item.error))
    }
    return searchResponse(
      payload,
      payload.filter(isRecord).flatMap((item) => (Array.isArray(item.organicResults) ? item.organicResults : [])),
    )
  },
} satisfies SearchProvider<z.output<typeof settingsSchema>>
