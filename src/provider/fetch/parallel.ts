import { compact } from "es-toolkit/array"
import { z } from "zod"
import { stringValue } from "../../shared/config"
import { apiJSON } from "../../shared/http"
import { MCP_FETCH_TIMEOUT_MS, mcpJSON } from "../mcp"
import { requireKey } from "../utils"
import type { FetchProvider } from "./types"
import { fetchBatches, fetchPages } from "./utils"

const settingsSchema = z.looseObject({
  advanced_settings: z
    .looseObject({
      fetch_policy: z
        .looseObject({
          max_age_seconds: z.number().optional(),
          disable_cache_fallback: z.boolean().optional(),
        })
        .optional(),
    })
    .optional(),
})
type ParallelFetchSettings = z.output<typeof settingsSchema>

export const parallel = {
  id: "parallel",
  weight: 80,
  keyless: true,
  formats: ["markdown"],
  options: settingsSchema,
  run: async ({ settings, key, urls, signal, format, globals }) => {
    const content = (item: Record<string, unknown>) =>
      stringValue(item.raw_content) ??
      stringValue(item.full_content) ??
      (Array.isArray(item.excerpts) ? compact(item.excerpts.map(stringValue)).join("\n\n") || undefined : undefined)
    if (!(key || Object.keys(settings).length)) {
      const session = crypto.randomUUID()
      return await fetchBatches(urls, 3, globals, signal, async (batch) => {
        const payload = await mcpJSON(
          "https://search.parallel.ai/mcp",
          {},
          "web_fetch",
          { urls: batch, full_content: true, session_id: session },
          signal,
          MCP_FETCH_TIMEOUT_MS,
        )
        return fetchPages(batch, payload, content, format)
      })
    }
    const { advanced_settings: advanced, ...rest } = settings
    const apiKey = requireKey("parallel", key)
    return await fetchBatches(urls, 20, globals, signal, async (batch) => {
      const payload = await apiJSON("https://api.parallel.ai/v1/extract", signal, {
        headers: { "x-api-key": apiKey },
        body: {
          ...rest,
          urls: batch,
          advanced_settings: {
            full_content: true,
            ...advanced,
            fetch_policy: {
              ...advanced?.fetch_policy,
              max_age_seconds: Math.max(
                600,
                Math.trunc(advanced?.fetch_policy?.max_age_seconds ?? globals.cacheWindowSeconds),
              ),
              disable_cache_fallback: advanced?.fetch_policy?.disable_cache_fallback ?? true,
            },
          },
        },
      })
      return fetchPages(batch, payload, content, format)
    })
  },
} satisfies FetchProvider<ParallelFetchSettings>
