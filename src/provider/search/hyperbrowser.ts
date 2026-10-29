import { Hyperbrowser } from "@hyperbrowser/sdk"
import get from "es-toolkit/compat/get"
import { requireKey, sdkRequest } from "../utils"
import type { SearchProvider } from "./types"
import { searchResponse } from "./utils"

export const hyperbrowser = {
  id: "hyperbrowser",
  weight: 45,
  run: async ({ settings, key, queries, signal, globals }) => {
    const client = new Hyperbrowser({
      apiKey: requireKey("hyperbrowser", key),
      baseUrl: "https://api.hyperbrowser.ai",
    })
    const payload = await sdkRequest(signal, () =>
      client.web.search({
        page: 1,
        ...settings,
        maxAgeSeconds: globals.cacheWindowSeconds,
        query: queries[0],
      }),
    )
    return searchResponse(payload, get(payload, "data.results"))
  },
} satisfies SearchProvider
