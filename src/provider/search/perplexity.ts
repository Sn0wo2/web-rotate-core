import get from "es-toolkit/compat/get"
import { clamp } from "es-toolkit/math"
import { z } from "zod"
import { apiJSON } from "../../shared/http"
import { mapConcurrent } from "../../shared/utils"
import { requireKey } from "../utils"
import type { SearchProvider } from "./types"
import { answerResponse, searchResponse } from "./utils"

const settingsSchema = z.looseObject({
  api: z.string().optional(),
  search_context_size: z.string().optional(),
  search_type: z.string().optional(),
  max_tokens: z.number().optional(),
  max_tokens_per_page: z.number().optional(),
})
type PerplexitySearchSettings = z.output<typeof settingsSchema>

export const perplexity = {
  id: "perplexity",
  weight: 80,
  batchSize: Infinity,
  options: settingsSchema,
  run: async ({ settings, key, queries, signal, globals }) => {
    const { api, search_context_size, ...options } = settings
    if (api === "answer") {
      const { search_type, max_tokens_per_page, model, ...answerOptions } = options
      const responses = await mapConcurrent(
        queries,
        async (query) => {
          const payload = await apiJSON("https://api.perplexity.ai/v1/sonar", signal, {
            key: requireKey("perplexity", key),
            body: {
              ...answerOptions,
              model: typeof model === "string" ? model : "sonar",
              messages: [{ role: "user", content: query }],
              stream: false,
            },
          })
          const searchResults = get(payload, "search_results")
          const citations = get(payload, "citations")
          const sources = [
            ...(Array.isArray(searchResults) ? searchResults : []),
            ...(Array.isArray(citations) ? citations : []),
          ]
          return answerResponse(payload, sources, get(payload, "choices.0.message.content"))
        },
        clamp(globals.concurrency, 1, 16),
        signal,
      )
      const answers = responses.flatMap((response) => (response.answer ? [response.answer] : []))
      const citations = responses.flatMap((response) => response.citations ?? [])
      return {
        results: responses.flatMap((response) => response.results),
        ...(answers.length ? { answer: answers.join("\n\n") } : {}),
        ...(citations.length ? { citations } : {}),
      }
    }

    const payload = await apiJSON("https://api.perplexity.ai/search", signal, {
      key: requireKey("perplexity", key),
      body: {
        search_type: "fast",
        ...options,
        query: queries.length === 1 ? queries[0] : queries,
        max_results: clamp(globals.searchResults, 1, options.search_type === "people" ? 50 : 20),
        ...(options.max_tokens == null && options.max_tokens_per_page == null
          ? { search_context_size: search_context_size ?? "low" }
          : {}),
      },
    })
    return searchResponse(payload)
  },
} satisfies SearchProvider<PerplexitySearchSettings>
