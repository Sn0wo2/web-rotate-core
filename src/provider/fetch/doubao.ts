import { isPlainObject as isRecord } from "es-toolkit/predicate"
import { z } from "zod"
import { stringValue } from "../../shared/config"
import { apiJSON } from "../../shared/http"
import { requireKey } from "../utils"
import type { FetchProvider } from "./types"
import { fetchOne, providerResult } from "./utils"

const settingsSchema = z.strictObject({})

export const doubao = {
  id: "doubao",
  weight: 55,
  formats: ["text"],
  options: settingsSchema,
  run: fetchOne(async ({ key, url, signal }) => {
    const payload = await apiJSON("https://open.feedcoopapi.com/search_api/fetch", signal, {
      key: requireKey("doubao", key),
      body: { Url: url },
    })
    if (!isRecord(payload)) throw new Error("doubao returned an invalid fetch response")
    const metadata = isRecord(payload.ResponseMetadata) ? payload.ResponseMetadata : undefined
    if (isRecord(metadata?.Error))
      throw new Error(stringValue(metadata.Error.Message) ?? stringValue(metadata.Error.Code) ?? "doubao fetch failed")
    const data = isRecord(payload.Result) && isRecord(payload.Result.Data) ? payload.Result.Data : undefined
    if (!data) throw new Error("doubao returned no fetch data")
    if (typeof data.StatusCode === "number" && data.StatusCode >= 400)
      throw new Error(`doubao target HTTP ${data.StatusCode}`)
    const title = stringValue(data.Title)
    const finalURL = stringValue(data.RedirectedUrl) ?? stringValue(data.Url)
    return {
      ...providerResult(data.ContentText, "text", {
        ...metadata,
        ...(typeof data.PublishTime === "number" ? { published: data.PublishTime } : {}),
      }),
      ...(title ? { title } : {}),
      ...(finalURL ? { finalURL } : {}),
    }
  }),
} satisfies FetchProvider
