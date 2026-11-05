import get from "es-toolkit/compat/get"
import { clamp } from "es-toolkit/math"
import { isPlainObject as isRecord } from "es-toolkit/predicate"
import { z } from "zod"
import { stringValue } from "../../shared/config"
import { apiJSON, checkedResponseText, timedSignal, USER_AGENT } from "../../shared/http"
import { requireKey, urlParams } from "../utils"
import type { SearchProvider } from "./types"
import { answerResponse, searchResponse } from "./utils"

const SSE_LINE_SEPARATOR = /\r\n|\n|\r/
const CITATION_TAG = /<citation>([\s\S]*?)<\/citation>/g

const settingsSchema = z.looseObject({ api: z.string().optional() })
type BraveSearchSettings = z.output<typeof settingsSchema>

export const brave = {
  id: "brave",
  weight: 75,
  options: settingsSchema,
  run: async ({ settings, key, queries, signal, globals }) => {
    const token = requireKey("brave", key)
    const { api, ...rest } = settings
    if (api === "answer") {
      const endpoint = "https://api.search.brave.com/res/v1/chat/completions"
      const model = typeof rest.model === "string" ? rest.model : "brave"
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Accept: "text/event-stream",
          "Content-Type": "application/json",
          "User-Agent": USER_AGENT,
          "X-Subscription-Token": token,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: queries[0] }],
          stream: true,
          enable_citations: true,
        }),
        signal: timedSignal(signal),
        redirect: "error",
      })
      const body = await checkedResponseText(response, "brave")
      const eventData: string[] = []
      let answerText = ""
      let eventType: string | undefined
      const consumeEvent = () => {
        if (!eventData.length) {
          eventType = undefined
          return
        }
        const data = eventData.join("\n").trim()
        eventData.length = 0
        const type = eventType
        eventType = undefined
        if (!data || data === "[DONE]") return
        let event: unknown
        try {
          event = JSON.parse(data)
        } catch (error) {
          throw new Error("brave returned invalid SSE data", { cause: error })
        }
        if (type === "error" || (isRecord(event) && (event.error != null || event.type === "error"))) {
          const detail = isRecord(event)
            ? isRecord(event.error)
              ? stringValue(event.error.message)
              : (stringValue(event.error) ?? stringValue(event.message))
            : undefined
          throw new Error(detail ?? "brave answer stream failed")
        }
        if (!isRecord(event)) return
        if (Array.isArray(event.choices)) {
          for (const choice of event.choices) {
            const content = get(choice, "delta.content")
            if (typeof content === "string") answerText += content
          }
        }
      }
      for (const line of body.split(SSE_LINE_SEPARATOR)) {
        if (!line) {
          consumeEvent()
          continue
        }
        if (line.startsWith(":")) continue
        const separator = line.indexOf(":")
        const field = separator < 0 ? line : line.slice(0, separator)
        const value = separator < 0 ? "" : line.slice(separator + 1)
        const fieldValue = value.startsWith(" ") ? value.slice(1) : value
        if (field === "event") eventType = fieldValue
        if (field === "data") {
          eventData.push(fieldValue)
        }
      }
      consumeEvent()

      const sources: Record<string, unknown>[] = []
      for (const match of answerText.matchAll(CITATION_TAG)) {
        try {
          const citation: unknown = JSON.parse(match[1] ?? "")
          if (isRecord(citation) && typeof citation.url === "string") {
            sources.push({
              url: citation.url,
              ...(typeof citation.snippet === "string" ? { snippet: citation.snippet } : {}),
            })
          }
        } catch {}
      }
      const answer = answerText.replace(CITATION_TAG, "").trim()
      return answerResponse({ choices: [{ message: { content: answerText } }] }, sources, answer)
    }
    const payload = await apiJSON(
      (() => {
        if (api === "web") {
          const endpoint = urlParams(new URL("https://api.search.brave.com/res/v1/web/search"), {
            extra_snippets: true,
            ...rest,
          })
          endpoint.searchParams.set("count", String(clamp(globals.searchResults, 1, 20)))
          endpoint.searchParams.set("result_filter", "web")
          endpoint.searchParams.set("q", queries[0])
          return endpoint.toString()
        }
        const endpoint = urlParams(new URL("https://api.search.brave.com/res/v1/llm/context"), {
          maximum_number_of_urls: clamp(globals.searchResults, 1, 50),
          maximum_number_of_tokens: 1024,
          maximum_number_of_tokens_per_url: 512,
          maximum_number_of_snippets: 16,
          maximum_number_of_snippets_per_url: 2,
          context_threshold_mode: "balanced",
          enable_source_metadata: false,
          ...rest,
        })
        endpoint.searchParams.set("count", String(clamp(globals.searchResults, 1, 50)))
        endpoint.searchParams.set("q", queries[0])
        return endpoint.toString()
      })(),
      signal,
      {
        headers: {
          Accept: "application/json",
          "X-Subscription-Token": token,
        },
      },
    )
    const grounding = isRecord(payload) && isRecord(payload.grounding) ? payload.grounding : undefined
    return searchResponse(
      payload,
      grounding && Array.isArray(grounding.generic)
        ? grounding.generic.filter(isRecord).map((item) => {
            const sources = isRecord(payload) && isRecord(payload.sources) ? payload.sources : {}
            const meta = sources[stringValue(item.url) ?? ""]
            return {
              ...item,
              publish_date: stringValue(get(meta, "age.3")) ?? stringValue(get(meta, "age.1")),
            }
          })
        : payload,
    )
  },
} satisfies SearchProvider<BraveSearchSettings>
