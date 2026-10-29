import { isPlainObject as isRecord } from "es-toolkit/predicate"
import { z } from "zod"
import { stringValue } from "../../shared/config"
import { apiJSON } from "../../shared/http"
import { requireKey } from "../utils"
import type { FetchProvider } from "./types"
import { fetchOne, providerResult } from "./utils"

const settingsSchema = z.looseObject({
  baseUrl: z.string().optional(),
})
type ZhipuFetchSettings = z.output<typeof settingsSchema>
const TRAILING_SLASHES = /\/+$/

export const zhipu = {
  id: "zhipu",
  weight: 60,
  formats: ["markdown", "text"],
  options: settingsSchema,
  run: fetchOne<ZhipuFetchSettings>(async ({ settings, key, url, signal, format }) => {
    const { baseUrl: configuredBaseUrl, ...options } = settings
    const baseUrl = stringValue(configuredBaseUrl) ?? "https://open.bigmodel.cn/api/paas/v4"
    const payload = await apiJSON(`${baseUrl.replace(TRAILING_SLASHES, "")}/reader`, signal, {
      label: "zhipu web reader",
      body: {
        ...options,
        url,
        return_format: format === "text" ? "text" : "markdown",
      },
      key: requireKey("zhipu", key),
    })
    const result = isRecord(payload) && isRecord(payload.reader_result) ? payload.reader_result : {}
    const title = stringValue(result.title)
    const finalURL = stringValue(result.url)
    return {
      ...providerResult(result.content, format),
      ...(title ? { title } : {}),
      ...(finalURL ? { finalURL } : {}),
    }
  }),
} satisfies FetchProvider<ZhipuFetchSettings>
