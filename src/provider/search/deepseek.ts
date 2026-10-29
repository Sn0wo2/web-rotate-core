import { clamp } from "es-toolkit/math"
import { isPlainObject as isRecord } from "es-toolkit/predicate"
import { z } from "zod"
import { stringValue } from "../../shared/config"
import { firstList, requireKey } from "../utils"
import type { SearchProvider } from "./types"
import { restSearch } from "./utils"

const settingsSchema = z.strictObject({
  localization: z.string().optional(),
  need_content: z.boolean().optional(),
})
type DeepSeekSearchSettings = z.output<typeof settingsSchema>

export const deepseek = {
  id: "deepseek",
  weight: 55,
  options: settingsSchema,
  run: restSearch<DeepSeekSearchSettings>(
    "https://api.deepseek.com/v1/tools/search",
    ({ settings, queries, globals }) => {
      return {
        ...settings,
        query: queries[0],
        count: clamp(globals.searchResults, 1, 50),
      }
    },
    (key) => {
      return {
        Authorization: `Bearer ${requireKey("deepseek", key)}`,
      }
    },
    (payload) =>
      firstList(payload)
        .filter(isRecord)
        .map((item) => {
          return {
            ...item,
            url: stringValue(item.url),
            title: stringValue(item.title),
            content: stringValue(item.content) ?? stringValue(item.summary) ?? stringValue(item.snippet),
            date: item.date,
          }
        }),
  ),
} satisfies SearchProvider<DeepSeekSearchSettings>
