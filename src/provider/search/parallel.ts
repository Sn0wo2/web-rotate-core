import { clamp } from "es-toolkit/math"
import { isPlainObject as isRecord } from "es-toolkit/predicate"
import { z } from "zod"
import { stringValue } from "../../shared/config"
import { apiJSON } from "../../shared/http"
import { mapConcurrent } from "../../shared/utils"
import { mcpJSON } from "../mcp"
import { requireKey } from "../utils"
import type { SearchProvider } from "./types"
import { answerResponse, searchResponse } from "./utils"

const settingsSchema = z.looseObject({
  api: z.enum(["search", "answer"]).optional(),
  mode: z.string().optional(),
  max_results: z.number().optional(),
  processor: z.unknown().optional(),
  advanced_settings: z
    .looseObject({
      excerpt_settings: z.record(z.string(), z.unknown()).optional(),
      fetch_policy: z
        .looseObject({
          max_age_seconds: z.number().optional(),
          disable_cache_fallback: z.boolean().optional(),
        })
        .optional(),
    })
    .optional(),
})
export const parallel = {
  id: "parallel",
  weight: 75,
  keyless: true,
  keylessEnabled: (settings) => settings.api !== "answer",
  batchSize: Infinity,
  options: settingsSchema,
  run: async ({ settings, key, queries, signal, globals }) => {
    const { api, mode, advanced_settings, max_results, processor, ...options } = settings
    if (api === "answer") {
      const apiKey = requireKey("parallel", key)
      const payloads = await mapConcurrent(
        queries,
        (question) =>
          apiJSON("https://api.parallel.ai/v1/responses", signal, {
            headers: { Authorization: `Bearer ${apiKey}` },
            body: {
              ...options,
              model: options.model ?? "parallel",
              reasoning: options.reasoning ?? { effort: "medium" },
              input: question,
              stream: false,
            },
          }),
        clamp(globals.concurrency, 1, 16),
        signal,
      )
      const sources: Record<string, unknown>[] = []
      const answers: string[] = []
      for (const payload of payloads) {
        const output = isRecord(payload) && Array.isArray(payload.output) ? payload.output : []
        for (const item of output) {
          if (!isRecord(item) || item.type !== "message" || !Array.isArray(item.content)) continue
          for (const content of item.content) {
            if (!isRecord(content) || content.type !== "output_text") continue
            const text = stringValue(content.text)
            if (text) answers.push(text)
            if (Array.isArray(content.annotations)) sources.push(...content.annotations.filter(isRecord))
          }
        }
      }
      const answer = answers.join("\n\n")
      return answerResponse({ answer, responses: payloads }, sources, answer)
    }
    if (!key) {
      const payload = await mcpJSON(
        "https://search.parallel.ai/mcp",
        {},
        "web_search",
        { objective: queries[0], search_queries: queries },
        signal,
      )
      return searchResponse(payload)
    }
    const payload = await apiJSON("https://api.parallel.ai/v1/search", signal, {
      headers: { "x-api-key": requireKey("parallel", key) },
      body: {
        mode: mode?.trim() || "fast",
        ...options,
        objective: queries[0],
        search_queries: queries,
        advanced_settings: {
          ...advanced_settings,
          fetch_policy: {
            ...advanced_settings?.fetch_policy,
            max_age_seconds: Math.max(
              600,
              Math.trunc(advanced_settings?.fetch_policy?.max_age_seconds ?? globals.cacheWindowSeconds),
            ),
            disable_cache_fallback: advanced_settings?.fetch_policy?.disable_cache_fallback ?? true,
          },
          excerpt_settings: {
            max_chars_per_result: 1000,
            ...advanced_settings?.excerpt_settings,
          },
          max_results: max_results ?? clamp(globals.searchResults, 1, 20),
        },
      },
    })
    return searchResponse(payload)
  },
} satisfies SearchProvider<z.output<typeof settingsSchema>>
