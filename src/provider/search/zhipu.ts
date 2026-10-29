import { clamp } from "es-toolkit/math"
import { isPlainObject as isRecord } from "es-toolkit/predicate"
import { z } from "zod"
import { stringValue } from "../../shared/config"
import { apiJSON } from "../../shared/http"
import { requireKey } from "../utils"
import type { SearchProvider } from "./types"
import { searchResponse } from "./utils"

const settingsSchema = z.looseObject({
  baseUrl: z.string().optional(),
})
type ZhipuSearchSettings = z.output<typeof settingsSchema>
const TRAILING_SLASHES = /\/+$/

export const zhipu = {
  id: "zhipu",
  weight: 60,
  options: settingsSchema,
  run: async ({ settings, key, queries, signal, globals }) => {
    const { baseUrl: configuredBaseUrl, ...options } = settings
    const baseUrl = stringValue(configuredBaseUrl) ?? "https://open.bigmodel.cn/api/paas/v4"
    const international = new URL(baseUrl).hostname === "api.z.ai"
    const body: Record<string, unknown> = {
      search_engine: international ? "search-prime" : "search_std",
      ...(!international ? { search_intent: false } : {}),
      ...options,
      search_query: queries[0],
      count: clamp(globals.searchResults, 1, 50),
    }
    if (international) delete body.search_intent

    const payload = await apiJSON(`${baseUrl.replace(TRAILING_SLASHES, "")}/web_search`, signal, {
      label: "zhipu web search",
      body,
      key: requireKey("zhipu", key),
    })
    const results = isRecord(payload) && Array.isArray(payload.search_result) ? payload.search_result : []
    return searchResponse(payload, results)
  },
} satisfies SearchProvider<ZhipuSearchSettings>
