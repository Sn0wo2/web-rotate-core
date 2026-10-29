import { isPlainObject as isRecord } from "es-toolkit/predicate"
import { z } from "zod"
import { stringValue } from "../../shared/config"
import { apiJSON } from "../../shared/http"
import { requireKey } from "../utils"
import type { SearchProvider } from "./types"
import { searchResponse } from "./utils"

const settingsSchema = z.looseObject({ zone: z.string().optional() })
type BrightdataSearchSettings = z.output<typeof settingsSchema>

export const brightdata = {
  id: "brightdata",
  weight: 50,
  options: settingsSchema,
  run: async ({ settings, key, queries, signal }) => {
    const { zone, ...options } = settings
    if (!zone?.trim()) throw new Error("brightdata SERP zone is not configured")
    const searchURL = new URL("https://www.google.com/search")
    searchURL.searchParams.set("q", queries[0])
    searchURL.searchParams.set("brd_json", "1")
    const payload = await apiJSON("https://api.brightdata.com/request", signal, {
      headers: { Authorization: `Bearer ${requireKey("brightdata", key)}` },
      body: {
        ...options,
        zone,
        url: searchURL.toString(),
        format: "json",
      },
    })
    let source = payload
    if (isRecord(source) && typeof source.body === "string") {
      try {
        source = JSON.parse(source.body)
      } catch {}
    }
    return searchResponse(
      payload,
      !(isRecord(source) && Array.isArray(source.organic))
        ? []
        : source.organic.filter(isRecord).map((item) => {
            return {
              url: stringValue(item.link) ?? stringValue(item.url),
              title: stringValue(item.title),
              description: stringValue(item.desc) ?? stringValue(item.description) ?? stringValue(item.snippet),
            }
          }),
    )
  },
} satisfies SearchProvider<BrightdataSearchSettings>
