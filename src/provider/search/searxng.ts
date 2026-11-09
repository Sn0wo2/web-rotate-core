import { clamp } from "es-toolkit/math"
import { isPlainObject as isRecord } from "es-toolkit/predicate"
import { z } from "zod"
import { stringValue } from "../../shared/config"
import { apiBase, apiJSON, HTTPError } from "../../shared/http"
import { urlParams } from "../utils"
import type { SearchProvider } from "./types"
import { searchResponse } from "./utils"

const settingsSchema = z.looseObject({
  baseUrl: z.url().optional(),
  headers: z.record(z.string(), z.string()).optional(),
})

export const searxng = {
  id: "searxng",
  weight: 61,
  keyless: true,
  options: settingsSchema,
  run: async ({ settings, key, queries, signal, globals }) => {
    const { baseUrl, headers, ...options } = settings
    const base = stringValue(baseUrl)
    if (!base) throw new Error("searxng requires a baseUrl setting pointing at a SearXNG instance")
    const endpoint = urlParams(new URL(apiBase(base, "/search")), {
      ...options,
      format: "json",
      q: queries[0],
    })
    let payload: unknown
    try {
      payload = await apiJSON(endpoint.toString(), signal, {
        label: "searxng",
        headers: {
          ...(key ? { Authorization: `Bearer ${key}` } : {}),
          ...headers,
        },
      })
    } catch (error) {
      if (error instanceof HTTPError && error.status === 403)
        throw new Error(`${error.message}; enable the "json" format in the searxng instance's search.formats setting`, {
          cause: error,
        })
      throw error
    }
    if (!isRecord(payload)) return searchResponse(payload)
    const answer = (Array.isArray(payload.answers) ? payload.answers : [])
      .map((item) => (isRecord(item) ? stringValue(item.answer) : stringValue(item)))
      .filter((item) => item != null)
      .join("\n")
    return searchResponse(
      payload,
      Array.isArray(payload.results) ? payload.results.slice(0, clamp(globals.searchResults, 1, 100)) : undefined,
      answer || undefined,
    )
  },
} satisfies SearchProvider<z.output<typeof settingsSchema>>
