import { clamp } from "es-toolkit/math"
import { isPlainObject as isRecord } from "es-toolkit/predicate"
import { z } from "zod"
import { stringValue } from "../../shared/config"
import { apiJSON } from "../../shared/http"
import { requireKey } from "../utils"
import type { SearchProvider } from "./types"
import { answerResponse, searchResponse } from "./utils"

const settingsSchema = z.looseObject({
  api: z.enum(["search", "answer"]).optional(),
  baseUrl: z.string().optional(),
  model: z.string().optional(),
  web_search: z.record(z.string(), z.unknown()).optional(),
})
type ZhipuSearchSettings = z.output<typeof settingsSchema>
const TRAILING_SLASHES = /\/+$/

export const zhipu = {
  id: "zhipu",
  weight: 60,
  options: settingsSchema,
  run: async ({ settings, key, queries, signal, globals }) => {
    const { api, baseUrl: configuredBaseUrl, model, web_search, ...options } = settings
    const baseUrl = stringValue(configuredBaseUrl) ?? "https://open.bigmodel.cn/api/paas/v4"
    if (api === "answer") {
      const answerModel = model?.trim()
      if (!answerModel) throw new Error("zhipu answer API requires a non-empty model setting")
      const payload = await apiJSON(`${baseUrl.replace(TRAILING_SLASHES, "")}/chat/completions`, signal, {
        label: "zhipu chat completion",
        body: {
          model: answerModel,
          messages: [{ role: "user", content: queries[0] }],
          tools: [{ type: "web_search", web_search: { enable: true, search_result: true, ...web_search } }],
          stream: false,
        },
        key: requireKey("zhipu", key),
      })
      const choices = isRecord(payload) && Array.isArray(payload.choices) ? payload.choices : []
      const message = isRecord(choices[0]) && isRecord(choices[0].message) ? choices[0].message : {}
      const results = isRecord(payload) && Array.isArray(payload.web_search) ? payload.web_search : []
      return answerResponse(payload, results, message.content)
    }
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
