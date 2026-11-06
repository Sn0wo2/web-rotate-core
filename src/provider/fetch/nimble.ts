import { isPlainObject as isRecord } from "es-toolkit/predicate"
import { stringValue } from "../../shared/config"
import { apiJSON } from "../../shared/http"
import { requireKey, responseMetadata } from "../utils"
import type { FetchProvider } from "./types"
import { fetchOne, providerResult } from "./utils"

export const nimble = {
  id: "nimble",
  weight: 68,
  formats: ["html", "markdown"],
  run: fetchOne<Record<string, unknown>>(async ({ settings, key, url, signal, format }) => {
    const payload = await apiJSON("https://sdk.nimbleway.com/v2/extract", signal, {
      key: requireKey("nimble", key),
      body: {
        render: true,
        ...settings,
        url,
        formats: [format],
      },
    })
    if (!isRecord(payload)) throw new Error("nimble returned an invalid extraction response")
    if (typeof payload.status_code === "number" && payload.status_code >= 400)
      throw new Error(stringValue(payload.message) ?? `nimble target HTTP ${payload.status_code}`)
    if (payload.status !== "success") throw new Error(stringValue(payload.message) ?? "nimble extraction failed")
    const finalURL = stringValue(payload.url)
    return {
      ...providerResult(isRecord(payload.data) ? payload.data[format] : undefined, format, responseMetadata(payload)),
      ...(finalURL ? { finalURL } : {}),
    }
  }),
} satisfies FetchProvider
