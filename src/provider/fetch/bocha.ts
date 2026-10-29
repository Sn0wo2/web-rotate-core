import { z } from "zod"
import { stringValue } from "../../shared/config"
import { apiJSON } from "../../shared/http"
import { requireKey } from "../utils"
import type { FetchProvider } from "./types"
import { fetchOne, providerResult } from "./utils"

const settingsSchema = z.strictObject({}).transform((settings): Record<string, unknown> => settings)
type BochaFetchSettings = z.output<typeof settingsSchema>

export const bocha = {
  id: "bocha",
  weight: 55,
  formats: ["markdown"],
  options: settingsSchema,
  run: fetchOne<BochaFetchSettings>(async ({ key, url, signal }) => {
    const payload = await apiJSON("https://api.bocha.cn/v1/deepseek-fetch", signal, {
      body: { url },
      key: requireKey("bocha", key),
    })
    const response = (payload ?? {}) as Record<string, unknown>
    const title = stringValue(response.title)
    return {
      ...providerResult(stringValue(response.content), "markdown"),
      ...(title ? { title } : {}),
    }
  }),
} satisfies FetchProvider
