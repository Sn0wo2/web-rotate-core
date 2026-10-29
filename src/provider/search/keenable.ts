import { clamp } from "es-toolkit/math"
import { isPlainObject as isRecord } from "es-toolkit/predicate"
import { Keenable } from "keenable"
import { sdkRequest } from "../utils"
import type { SearchProvider } from "./types"
import { searchResponse } from "./utils"

export const keenable = {
  id: "keenable",
  weight: 60,
  keyless: true,
  run: async ({ settings, key, queries, signal, globals }) => {
    const response = await sdkRequest(signal, (requestSignal) =>
      new Keenable({
        apiKey: key ?? "",
        baseUrl: "https://api.keenable.ai",
        clientSource: "web-rotate-core",
      }).search(queries[0], {
        mode: "pro",
        snippetMaxLength: 1000,
        ...settings,
        signal: requestSignal,
      }),
    )
    return searchResponse(
      response.raw,
      (Array.isArray(response.raw.results) ? response.raw.results.filter(isRecord) : []).slice(
        0,
        clamp(globals.searchResults, 1, 50),
      ),
    )
  },
} satisfies SearchProvider
