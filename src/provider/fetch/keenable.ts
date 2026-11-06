import { isPlainObject as isRecord } from "es-toolkit/predicate"
import { z } from "zod"
import { stringValue } from "../../shared/config"
import { apiJSON } from "../../shared/http"
import { responseMetadata, urlParams } from "../utils"
import type { FetchProvider } from "./types"
import { fetchOne, providerResult } from "./utils"

const settingsSchema = z.looseObject({
  live: z.boolean().optional(),
  max_chars: z.number().int().positive().optional(),
  prompt: z.string().max(2000).optional(),
})

export const keenable = {
  id: "keenable",
  weight: 60,
  keyless: true,
  formats: ["markdown"],
  options: settingsSchema,
  run: fetchOne<z.output<typeof settingsSchema>>(async ({ settings, key, url, signal, globals }) => {
    const endpoint = urlParams(new URL(`https://api.keenable.ai/v1/fetch${key ? "" : "/public"}`), {
      ...settings,
      live: settings.live ?? globals.cacheWindowSeconds === 0,
      url,
    })
    const payload = await apiJSON(endpoint.toString(), signal, {
      headers: { "X-Keenable-Title": "web-rotate-core", ...(key ? { "X-API-Key": key } : {}) },
    })
    if (!isRecord(payload)) throw new Error("keenable returned an invalid fetch response")
    const title = stringValue(payload.title)
    const finalURL = stringValue(payload.url)
    return {
      ...providerResult(payload.content, "markdown", responseMetadata(payload)),
      ...(title ? { title } : {}),
      ...(finalURL ? { finalURL } : {}),
    }
  }),
} satisfies FetchProvider<z.output<typeof settingsSchema>>
