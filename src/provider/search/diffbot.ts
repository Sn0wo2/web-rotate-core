import { clamp } from "es-toolkit/math"
import { apiJSON } from "../../shared/http"
import { requireKey } from "../utils"
import type { SearchProvider } from "./types"
import { searchResponse } from "./utils"

export const diffbot = {
  id: "diffbot",
  weight: 50,
  batchSize: 5,
  run: async ({ settings, key, queries, signal, globals }) => {
    const payload = await apiJSON("https://llm.diffbot.com/api/v1/web_search", signal, {
      label: "diffbot",
      body: {
        maxTokens: 2000,
        ...settings,
        text: queries,
        size: clamp(globals.searchResults, 1, 100),
      },
      headers: { Authorization: `Bearer ${requireKey("diffbot", key)}` },
    })
    return searchResponse(payload)
  },
} satisfies SearchProvider
