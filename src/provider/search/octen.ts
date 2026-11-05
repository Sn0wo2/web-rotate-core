import get from "es-toolkit/compat/get"
import { clamp } from "es-toolkit/math"
import { isPlainObject as isRecord } from "es-toolkit/predicate"
import { apiJSON } from "../../shared/http"
import { requireKey } from "../utils"
import type { SearchProvider } from "./types"
import { answerResponse, searchResponse } from "./utils"

export const octen = {
  id: "octen",
  weight: 80,
  run: async ({ settings, key, queries, signal, globals }) => {
    const { api, ...searchSettings } = settings
    if (api === "answer") {
      const model = settings.model
      const payload = await apiJSON("https://api.octen.ai/answer", signal, {
        key: requireKey("octen", key),
        body: {
          model: typeof model === "string" ? model : "anthropic/claude-sonnet-4.6",
          messages: [{ role: "user", content: queries[0] }],
          stream: false,
          mode: "full",
        },
      })
      const searchResults = isRecord(payload) ? payload.search_results : undefined
      const sources = Array.isArray(searchResults)
        ? searchResults.flatMap((item) => {
            const results = isRecord(item) ? item.results : undefined
            return Array.isArray(results)
              ? results.map((result) =>
                  isRecord(result)
                    ? {
                        ...result,
                        ...(typeof result.full_content === "string" ? { content: result.full_content } : {}),
                        ...(typeof result.highlight === "string" ? { snippets: [result.highlight] } : {}),
                      }
                    : result,
                )
              : []
          })
        : []
      return answerResponse(payload, sources, get(payload, "choices.0.message.content"))
    }

    const payload = await apiJSON("https://api.octen.ai/search", signal, {
      body: {
        highlight: { enable: true, max_tokens: 300 },
        format: "text",
        ...searchSettings,
        query: queries[0],
        count: clamp(globals.searchResults, 1, 100),
      },
      headers: { ...(key ? { Authorization: `Bearer ${key}` } : {}) },
    })
    return searchResponse(payload, get(payload, "data.results"))
  },
} satisfies SearchProvider
