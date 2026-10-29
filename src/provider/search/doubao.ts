import { clamp } from "es-toolkit/math"
import { isPlainObject as isRecord } from "es-toolkit/predicate"
import { stringValue } from "../../shared/config"
import type { SearchProvider } from "./types"
import { restSearch } from "./utils"

export const doubao = {
  id: "doubao",
  weight: 54,
  run: restSearch<Record<string, unknown>>(
    "https://open.feedcoopapi.com/search_api/web_search",
    ({ settings, queries, globals }) => {
      return {
        SearchType: "web",
        NeedSummary: true,
        ...settings,
        Query: queries[0],
        Count: clamp(globals.searchResults, 1, 100),
      }
    },
    (key) => {
      return { ...(key ? { Authorization: `Bearer ${key}` } : {}) }
    },
    (payload) => {
      const result = isRecord(payload) ? payload.Result : undefined
      const rows = isRecord(result) ? result.WebResults : undefined
      return (Array.isArray(rows) ? rows : []).filter(isRecord).map((item) => {
        return {
          url: stringValue(item.Url),
          title: stringValue(item.Title),
          snippet: stringValue(item.Snippet) ?? stringValue(item.Summary),
        }
      })
    },
  ),
} satisfies SearchProvider
