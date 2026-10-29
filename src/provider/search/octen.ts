import get from "es-toolkit/compat/get"
import { clamp } from "es-toolkit/math"
import type { SearchProvider } from "./types"
import { restSearch } from "./utils"

export const octen = {
  id: "octen",
  weight: 80,
  run: restSearch<Record<string, unknown>>(
    "https://api.octen.ai/search",
    ({ settings, queries, globals }) => {
      return {
        highlight: { enable: true, max_tokens: 300 },
        format: "text",
        ...settings,
        query: queries[0],
        count: clamp(globals.searchResults, 1, 100),
      }
    },
    (key) => {
      return { ...(key ? { Authorization: `Bearer ${key}` } : {}) }
    },
    (payload) => get(payload, "data.results"),
  ),
} satisfies SearchProvider
