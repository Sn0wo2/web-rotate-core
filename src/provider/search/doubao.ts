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
})
type DoubaoSearchSettings = z.output<typeof settingsSchema>
const TRAILING_SLASHES = /\/+$/

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
      const payload = await apiJSON(`${baseUrl.replace(TRAILING_SLASHES, "")}/responses`, signal, {
        label: "doubao response",
        body: {
          model: answerModel,
          input: queries[0],
          tools: [{ type: "web_search", sources: ["doubao"] }],
          stream: false,
        },
        key: requireKey("doubao", key),
      })
      const sources: Record<string, unknown>[] = []
      const answers: string[] = []
      const output = isRecord(payload) && Array.isArray(payload.output) ? payload.output : []
      for (const item of output) {
        if (!isRecord(item) || item.type !== "message" || !Array.isArray(item.content)) continue
        for (const part of item.content) {
          if (!isRecord(part) || part.type !== "output_text") continue
          const text = stringValue(part.text)
          if (text) answers.push(text)
          if (Array.isArray(part.annotations)) {
            for (const annotation of part.annotations) {
              if (!isRecord(annotation) || annotation.type !== "url_citation") continue
              const url = stringValue(annotation.url)
              if (url) sources.push({ ...annotation, url, content: stringValue(annotation.summary) })
            }
          }
        }
      }
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
} satisfies SearchProvider<DoubaoSearchSettings>
