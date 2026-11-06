import { isPlainObject as isRecord } from "es-toolkit/predicate"
import { apiJSON } from "../../shared/http"
import { requireKey, responseMetadata } from "../utils"
import type { FetchProvider } from "./types"
import { fetchOne, providerResult } from "./utils"

export const serper = {
  id: "serper",
  weight: 60,
  formats: ["markdown", "text"],
  run: fetchOne<Record<string, unknown>>(async ({ settings, key, url, signal, format }) => {
    const payload = await apiJSON("https://scrape.serper.dev", signal, {
      headers: { "X-API-Key": requireKey("serper", key) },
      body: {
        ...settings,
        url,
        includeMarkdown: format === "markdown",
      },
    })
    return providerResult(isRecord(payload) ? payload[format] : undefined, format, responseMetadata(payload))
  }),
} satisfies FetchProvider
