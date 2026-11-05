import get from "es-toolkit/compat/get"
import { clamp } from "es-toolkit/math"
import { isPlainObject as isRecord } from "es-toolkit/predicate"
import { apiJSON } from "../../shared/http"
import { requireKey } from "../utils"
import type { SearchProvider } from "./types"
import { answerResponse, searchResponse } from "./utils"

export const you = {
  id: "you",
  weight: 74,
  run: async ({ settings, key, queries, signal, globals }) => {
    const { api, ...searchSettings } = settings
    if (api === "answer") {
      const payload = await apiJSON("https://api.you.com/v1/answer", signal, {
        label: "you",
        body: {
          query: queries[0],
          ...(searchSettings.freshness !== undefined ? { freshness: searchSettings.freshness } : {}),
          ...(searchSettings.country !== undefined ? { country: searchSettings.country } : {}),
          ...(searchSettings.language !== undefined ? { language: searchSettings.language } : {}),
          ...(searchSettings.domains !== undefined ? { domains: searchSettings.domains } : {}),
        },
        headers: { "X-API-Key": requireKey("you", key) },
      })
      const webResults = get(payload, "results.web")
      const citations = isRecord(payload) ? payload.citations : undefined
      const citedSources = Array.isArray(citations)
        ? citations.flatMap((item) =>
            isRecord(item) && typeof item.source === "string"
              ? [
                  {
                    url: item.source,
                    ...(Array.isArray(item.excerpts)
                      ? { snippets: item.excerpts.filter((excerpt): excerpt is string => typeof excerpt === "string") }
                      : {}),
                  },
                ]
              : [],
          )
        : []
      return answerResponse(
        payload,
        [...(Array.isArray(webResults) ? webResults : []), ...citedSources],
        get(payload, "answer"),
      )
    }

    const extraction = isRecord(settings.extraction) ? settings.extraction : {}
    const payload = await apiJSON("https://ydc-index.io/v1/search", signal, {
      label: "you",
      body: {
        safesearch: "moderate",
        ...searchSettings,
        extraction: {
          extraction_mode: "highlights",
          ...(globals.cacheWindowSeconds === 0 ? { extraction_mode: "full_page", extraction_source: "fetch" } : {}),
          ...extraction,
        },
        query: queries[0],
        count: clamp(globals.searchResults, 1, 100),
      },
      headers: { "X-API-Key": requireKey("you", key) },
    })
    const grouped = isRecord(payload) && isRecord(payload.results) ? payload.results : {}
    const items = (
      Array.isArray(payload)
        ? payload
        : [...(Array.isArray(grouped.web) ? grouped.web : []), ...(Array.isArray(grouped.news) ? grouped.news : [])]
    ).map((item) => {
      if (!isRecord(item)) return item
      const contents = isRecord(item.contents) ? item.contents : {}
      return Array.isArray(contents.highlights) && item.highlights == null
        ? { ...item, highlights: contents.highlights }
        : item
    })
    return searchResponse(payload, items)
  },
} satisfies SearchProvider
