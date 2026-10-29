import { clamp } from "es-toolkit/math"
import { requireKey } from "../utils"
import type { SearchProvider } from "./types"
import { restSearch } from "./utils"

export const serper = {
  id: "serper",
  weight: 62,
  run: restSearch<Record<string, unknown>>(
    "https://google.serper.dev/search",
    ({ settings, queries, globals }) => {
      return {
        ...settings,
        q: queries[0],
        num: clamp(globals.searchResults, 1, 100),
      }
    },
    (key) => {
      return { "X-API-Key": requireKey("serper", key) }
    },
  ),
} satisfies SearchProvider
