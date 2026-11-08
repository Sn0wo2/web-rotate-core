import { clamp } from "es-toolkit/math"
import { isPlainObject as isRecord } from "es-toolkit/predicate"
import { z } from "zod"
import { stringValue } from "../../shared/config"
import { apiBase, apiJSON } from "../../shared/http"
import { requireKey } from "../utils"
import type { SearchProvider } from "./types"
import { answerResponse, responseOutputs, searchResponse } from "./utils"

const settingsSchema = z.looseObject({
  api: z.enum(["search", "answer"]).optional(),
  baseUrl: z.string().optional(),
  model: z.string().optional(),
})

export const doubao = {
  id: "doubao",
  weight: 54,
  options: settingsSchema,
  run: async ({ settings, key, queries, signal, globals }) => {
    const { api, baseUrl: configuredBaseUrl, model, ...options } = settings
    if (api === "answer") {
      const answerModel = model?.trim()
      if (!answerModel) throw new Error("doubao answer API requires a non-empty model setting")
      const baseUrl = stringValue(configuredBaseUrl) ?? "https://ark.cn-beijing.volces.com/api/v3"
      const payload = await apiJSON(apiBase(baseUrl, "/responses"), signal, {
        label: "doubao response",
        body: {
          model: answerModel,
          input: queries[0],
          tools: [{ type: "web_search", sources: ["doubao"] }],
          stream: false,
        },
        key: requireKey("doubao", key),
      })
      const { answers, sources } = responseOutputs(payload)
      const answer = answers.join("\n\n")
      return answerResponse({ answer, response: payload }, sources, answer)
    }
    const payload = await apiJSON("https://open.feedcoopapi.com/search_api/web_search", signal, {
      body: {
        SearchType: "web",
        NeedSummary: true,
        ...options,
        Query: queries[0],
        Count: clamp(globals.searchResults, 1, 100),
      },
      headers: key ? { Authorization: `Bearer ${key}` } : {},
    })
    const result = isRecord(payload) ? payload.Result : undefined
    const rows = isRecord(result) ? result.WebResults : undefined
    const results = (Array.isArray(rows) ? rows : []).filter(isRecord).map((item) => {
      return {
        url: stringValue(item.Url),
        title: stringValue(item.Title),
        snippet: stringValue(item.Snippet) ?? stringValue(item.Summary),
      }
    })
    return searchResponse(payload, results)
  },
} satisfies SearchProvider<z.output<typeof settingsSchema>>
