import { pick } from "es-toolkit/object"
import { isPlainObject as isRecord } from "es-toolkit/predicate"
import { stringValue } from "../../shared/config"
import { checkedResponseText, timedSignal, USER_AGENT } from "../../shared/http"
import { requireKey, scrapingbeeURL } from "../utils"
import type { SearchProvider } from "./types"
import { answerResponse, searchResponse } from "./utils"

export const scrapingbee = {
  id: "scrapingbee",
  weight: 48,
  run: async ({ settings, key, queries, signal }) => {
    const { api, ...options } = settings
    const endpoint = scrapingbeeURL(
      api === "answer" ? "/api/v1/chatgpt" : "/api/v1/store/google",
      api === "answer"
        ? { ...pick(options, ["add_html", "country_code", "tag"]), prompt: queries[0], search: true }
        : { search: queries[0], ...options },
    )
    const response = await fetch(endpoint, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${requireKey("scrapingbee", key)}`,
        "User-Agent": USER_AGENT,
      },
      signal: timedSignal(signal),
      redirect: "error",
    })
    const body = await checkedResponseText(response, "scrapingbee")
    let payload: unknown
    try {
      payload = JSON.parse(body)
    } catch (error) {
      throw new Error("scrapingbee returned invalid JSON", { cause: error })
    }
    const result =
      api === "answer"
        ? answerResponse(
            payload,
            isRecord(payload) ? payload.citations : [],
            isRecord(payload)
              ? (stringValue(payload.results_markdown) ?? stringValue(payload.results_text) ?? payload.results_json)
              : undefined,
          )
        : searchResponse(
            payload,
            isRecord(payload) && Array.isArray(payload.organic_results) ? payload.organic_results : payload,
          )
    const metadata = Object.fromEntries([...response.headers].filter(([name]) => name.startsWith("spb-")))
    return Object.keys(metadata).length ? { ...result, metadata: { ...result.metadata, ...metadata } } : result
  },
} satisfies SearchProvider
