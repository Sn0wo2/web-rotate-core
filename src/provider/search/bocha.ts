import get from "es-toolkit/compat/get"
import { clamp } from "es-toolkit/math"
import type { SearchProvider } from "./types"
import { restSearch } from "./utils"

export const bocha = {
  id: "bocha",
  weight: 55,
  run: restSearch<Record<string, unknown>>(
    "https://api.bochaai.com/v1/web-search",
    ({ settings, queries, globals }) => {
      return {
        summary: true,
        ...settings,
        query: queries[0],
        count: clamp(globals.searchResults, 1, 50),
      }
    },
    (key) => {
      return { ...(key ? { Authorization: `Bearer ${key}` } : {}) }
    },
    (payload) => get(payload, "data.webPages.value"),
  ),
} satisfies SearchProvider
