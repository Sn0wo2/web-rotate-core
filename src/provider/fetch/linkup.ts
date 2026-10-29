import get from "es-toolkit/compat/get"
import { stringValue } from "../../shared/config"
import { apiJSON } from "../../shared/http"
import { requireKey } from "../utils"
import type { FetchProvider } from "./types"
import { fetchOne, providerResult } from "./utils"

export const linkup = {
  id: "linkup",
  weight: 64,
  formats: ["markdown"],
  run: fetchOne<Record<string, unknown>>(async ({ settings, key, url, signal }) => {
    const {
      url: fetchURL,
      mode,
      renderJs,
      includeRawContent,
      includeRawHtml,
      extractImages,
      schema,
      instructions,
    }: Record<string, unknown> = { url, ...settings }
    const response = await apiJSON("https://api.linkup.so/v1/fetch", signal, {
      key: requireKey("linkup", key),
      body: {
        url: fetchURL,
        ...(mode !== undefined ? { mode } : {}),
        ...(renderJs !== undefined ? { renderJs } : {}),
        ...(includeRawContent !== undefined ? { includeRawContent } : {}),
        ...(includeRawHtml !== undefined ? { includeRawHtml } : {}),
        ...(extractImages !== undefined ? { extractImages } : {}),
        ...(schema !== undefined
          ? {
              schema: typeof schema === "string" ? schema : JSON.stringify(schema),
            }
          : {}),
        ...(instructions !== undefined ? { instructions } : {}),
      },
    })
    return providerResult(stringValue(get(response, "content")) ?? stringValue(get(response, "markdown")), "markdown")
  }),
} satisfies FetchProvider
