import { clamp } from "es-toolkit/math"
import { isPlainObject as isRecord } from "es-toolkit/predicate"
import { z } from "zod"
import { stringValue } from "../../shared/config"
import { apiJSON } from "../../shared/http"
import { requireKey } from "../utils"
import type { SearchProvider, SearchResponse, SearchResult } from "./types"
import { searchResponse } from "./utils"

const settingsSchema = z.looseObject({
  model: z.string().optional(),
  instructions: z.string().optional(),
  max_output_tokens: z.number().optional(),
  reasoning: z.record(z.string(), z.unknown()).optional(),
  search_context_size: z.enum(["low", "medium", "high"]).optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
  user_location: z.record(z.string(), z.unknown()).optional(),
  external_web_access: z.boolean().optional(),
  return_token_budget: z.number().optional(),
})
type OpenAISearchSettings = z.output<typeof settingsSchema>

export const openai = {
  id: "openai",
  weight: 66,
  options: settingsSchema,
  run: async ({ settings, key, queries, signal, globals }) => {
    const {
      model,
      instructions,
      max_output_tokens,
      reasoning,
      search_context_size,
      filters,
      user_location,
      external_web_access,
      return_token_budget,
      ...rest
    } = settings
    const selectedModel = model?.trim() || "gpt-5-mini"
    const payload = await apiJSON("https://api.openai.com/v1/responses", signal, {
      key: requireKey("openai", key),
      body: {
        model: selectedModel,
        instructions:
          instructions?.trim() ||
          `Search the web. Return at most ${clamp(globals.searchResults, 1, 100)} concise factual snippets, one per line with an inline citation. Do not write a long-form answer.`,
        max_output_tokens: max_output_tokens ?? 2048,
        ...(reasoning ? { reasoning } : selectedModel === "gpt-5-mini" ? { reasoning: { effort: "low" } } : {}),
        max_tool_calls: 1,
        store: false,
        ...rest,
        tool_choice: "required",
        include: ["web_search_call.action.sources"],
        tools: [
          {
            type: "web_search",
            search_context_size: search_context_size ?? "medium",
            ...(filters ? { filters } : {}),
            ...(user_location ? { user_location } : {}),
            ...(external_web_access != null
              ? { external_web_access }
              : globals.cacheWindowSeconds === 0
                ? { external_web_access: true }
                : {}),
            ...(return_token_budget != null ? { return_token_budget } : {}),
          },
        ],
        input: queries[0],
      },
    })
    const output: unknown[] = isRecord(payload) && Array.isArray(payload.output) ? payload.output : []
    let answer = ""
    const citations: NonNullable<SearchResponse["citations"]> = []
    const results = new Map<string, SearchResult>()
    for (const item of output) {
      if (!isRecord(item) || item.type !== "message" || !Array.isArray(item.content)) continue
      for (const part of item.content) {
        if (!isRecord(part) || typeof part.text !== "string") continue
        answer = answer ? `${answer}\n${part.text}` : part.text
        for (const annotation of Array.isArray(part.annotations) ? part.annotations : []) {
          if (!isRecord(annotation) || annotation.type !== "url_citation") continue
          const url = stringValue(annotation.url)
          if (!url) continue
          const title = stringValue(annotation.title)
          citations.push({
            url,
            ...(title ? { title } : {}),
            ...(typeof annotation.start_index === "number" ? { start: annotation.start_index } : {}),
            ...(typeof annotation.end_index === "number" ? { end: annotation.end_index } : {}),
          })
          const existing = results.get(url)
          if (!existing) results.set(url, title ? { url, title } : { url })
          else if (title && !existing.title) results.set(url, { ...existing, title })
        }
      }
    }
    for (const item of output) {
      if (!isRecord(item) || item.type !== "web_search_call") continue
      const action = isRecord(item.action) ? item.action : undefined
      for (const source of Array.isArray(action?.sources) ? action.sources : []) {
        const url = stringValue(isRecord(source) ? source.url : undefined)
        if (url && !results.has(url)) results.set(url, { url })
      }
    }
    return {
      ...searchResponse(payload, [...results.values()], answer || undefined),
      ...(citations.length ? { citations } : {}),
    }
  },
} satisfies SearchProvider<OpenAISearchSettings>
