import { stringValue } from "../../shared/config"
import { apiJSON } from "../../shared/http"
import { requireKey } from "../utils"
import type { FetchProvider } from "./types"
import { fetchBatches, fetchPages } from "./utils"

export const tinyfish = {
  id: "tinyfish",
  weight: 74,
  formats: ["html", "markdown"],
  run: async ({ settings, key, urls, signal, format, globals }) =>
    fetchBatches(urls, 10, globals, signal, async (batch) => {
      const payload = await apiJSON("https://api.fetch.tinyfish.ai", signal, {
        label: "tinyfish",
        body: {
          ...settings,
          urls: batch,
          format,
        },
        headers: { "X-API-Key": requireKey("tinyfish", key) },
      })
      return fetchPages(batch, payload, (item) => stringValue(item.text), format)
    }),
} satisfies FetchProvider
