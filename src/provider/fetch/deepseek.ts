import { z } from "zod"
import { stringValue } from "../../shared/config"
import { apiJSON } from "../../shared/http"
import { requireKey } from "../utils"
import type { FetchProvider } from "./types"
import { fetchOne, providerResult } from "./utils"

const settingsSchema = z.strictObject({}).transform((settings): Record<string, unknown> => settings)
type DeepSeekFetchSettings = z.output<typeof settingsSchema>

export const deepseek = {
  id: "deepseek",
  weight: 55,
  formats: ["markdown"],
  options: settingsSchema,
  run: fetchOne<DeepSeekFetchSettings>(async ({ key, url, signal }) => {
    const payload = await apiJSON("https://api.deepseek.com/v1/tools/fetch", signal, {
      body: { url },
      key: requireKey("deepseek", key),
    })
    const response = (payload ?? {}) as Record<string, unknown>
    const title = stringValue(response.title)
    return {
      ...providerResult(stringValue(response.content), "markdown"),
      ...(title ? { title } : {}),
    }
  }),
} satisfies FetchProvider
