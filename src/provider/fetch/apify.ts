import { z } from "zod"
import { stringValue } from "../../shared/config"
import { apiJSON } from "../../shared/http"
import { requireKey, sdkRequest } from "../utils"
import type { FetchProvider } from "./types"

const settingsSchema = z.looseObject({ actorId: z.string().optional() })
type ApifyFetchSettings = z.output<typeof settingsSchema>
const TRAILING_SLASHES = /\/+$/

export const apify = {
  id: "apify",
  weight: 65,
  formats: ["html", "markdown", "text"],
  options: settingsSchema,
  run: async ({ settings, key, urls, signal, format }) => {
    const { actorId, ...options } = settings
    const apiKey = requireKey("apify", key)
    const actorPath = encodeURIComponent((actorId?.trim() || "apify~website-content-crawler").replace(/\//g, "~"))
    const input = {
      crawlerType: "playwright:firefox",
      maxCrawlPages: urls.length,
      maxCrawlDepth: 0,
      maxRequestRetries: 3,
      removeCookieWarnings: true,
      ...(format === "markdown" ? { saveMarkdown: true } : {}),
      ...(format === "html" ? { saveHtml: true } : {}),
      proxyConfiguration: { useApifyProxy: true },
      ...options,
      startUrls: urls.map((url) => {
        return { url }
      }),
    }
    const run = await sdkRequest(
      signal,
      async (requestSignal) => {
        let payload = (await apiJSON(
          `https://api.apify.com/v2/actors/${actorPath}/runs?waitForFinish=60`,
          requestSignal,
          { body: input, key: apiKey, timeoutMs: 300_000 },
        )) as {
          data: { id: string; status: string; defaultDatasetId: string }
        }
        while (["READY", "RUNNING", "TIMING-OUT", "ABORTING"].includes(payload.data.status)) {
          payload = (await apiJSON(
            `https://api.apify.com/v2/actor-runs/${encodeURIComponent(payload.data.id)}?waitForFinish=60`,
            requestSignal,
            { key: apiKey, timeoutMs: 300_000 },
          )) as typeof payload
        }
        return payload.data
      },
      300_000,
    )
    const items = await sdkRequest(
      signal,
      async (requestSignal) =>
        (await apiJSON(
          `https://api.apify.com/v2/datasets/${encodeURIComponent(run.defaultDatasetId)}/items?limit=${urls.length * 2}`,
          requestSignal,
          { key: apiKey, timeoutMs: 300_000 },
        )) as Record<string, unknown>[],
      300_000,
    )
    const dataset = new Map<string, Record<string, unknown>>()
    for (const row of items) {
      const itemURL = stringValue(row.url)
      if (!itemURL) continue
      dataset.set(itemURL, row)
      const trimmed = itemURL.replace(TRAILING_SLASHES, "")
      if (trimmed && !dataset.has(trimmed)) dataset.set(trimmed, row)
    }
    return urls.map((url) => {
      const item = dataset.get(url) ?? dataset.get(url.replace(TRAILING_SLASHES, ""))
      if (!item) return { url, error: "no dataset item matched the URL" }
      for (const name of (
        {
          html: ["html", "text", "markdown"],
          text: ["text", "markdown", "html"],
          markdown: ["markdown", "text", "html"],
        } as const
      )[format]) {
        const value = stringValue(item[name])
        if (value) return { url, content: value, format: name }
      }
      return { url, error: stringValue(item.error) ?? "empty content" }
    })
  },
} satisfies FetchProvider<ApifyFetchSettings>
