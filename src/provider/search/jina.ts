import get from "es-toolkit/compat/get"
import { clamp } from "es-toolkit/math"
import { pick } from "es-toolkit/object"
import { isPlainObject as isRecord } from "es-toolkit/predicate"
import { z } from "zod"
import { stringValue } from "../../shared/config"
import { apiJSON } from "../../shared/http"
import { requireKey, urlParams } from "../utils"
import type { SearchProvider, SearchResult } from "./types"
import { answerResponse, searchResponse } from "./utils"

const settingsSchema = z.looseObject({
  api: z.enum(["search", "answer"]).optional(),
  headers: z.record(z.string(), z.string()).optional(),
})

export const jina = {
  id: "jina",
  weight: 58,
  options: settingsSchema,
  run: async ({ settings, key, queries, signal, globals }) => {
    const token = requireKey("jina", key)
    const { api, headers, ...options } = settings
    if (api === "answer") {
      const answerOptions: Record<string, unknown> = pick(options, [
        "model",
        "temperature",
        "max_tokens",
        "top_p",
        "presence_penalty",
        "frequency_penalty",
        "response_format",
        "seed",
        "stop",
      ])
      const payload = await apiJSON("https://deepsearch.jina.ai/v1/chat/completions", signal, {
        key: token,
        headers: headers ?? {},
        body: {
          model: "jina-deepsearch-v1",
          ...answerOptions,
          messages: [{ role: "user", content: queries[0] }],
          stream: false,
        },
      })
      const answer = stringValue(get(payload, "choices[0].message.content"))
        ?.replace(/<think>[\s\S]*?<\/think>/g, "")
        .trim()
      const sources: SearchResult[] = []
      if (answer) {
        const { lexer, walkTokens } = await import("marked")
        void walkTokens(lexer(answer.replace(/^\[\^[^\]]+\]:[\t ]*/gm, "")), (part) => {
          if (part.type === "link")
            sources.push({ url: part.href, ...(part.text !== part.href ? { title: part.text } : {}) })
        })
      }
      return answerResponse(payload, sources, answer)
    }
    const endpoint = urlParams(new URL("https://s.jina.ai"), {
      num: clamp(globals.searchResults, 1, 20),
      ...options,
      q: queries[0],
    })
    const payload = await apiJSON(endpoint.toString(), signal, {
      headers: {
        Authorization: `Bearer ${token}`,
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
} satisfies SearchProvider<z.output<typeof settingsSchema>>
