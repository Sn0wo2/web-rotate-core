import { isPlainObject as isRecord } from "es-toolkit/predicate"
import { stringValue } from "../../shared/config"
import { apiJSON, REQUEST_TIMEOUT_MS } from "../../shared/http"
import { MCP_FETCH_TIMEOUT_MS, mcpJSON } from "../mcp"
import type { FetchProvider } from "./types"
import { fetchBatches, fetchPages } from "./utils"

export const tavily = {
  id: "tavily",
  weight: 68,
  keyless: true,
  formats: ["text", "markdown"],
  run: async ({ settings, key, urls, signal, format, globals }) => {
    if (key && !Object.keys(settings).length) {
      return await fetchBatches(urls, 20, globals, signal, async (batch) => {
        const payload = await mcpJSON(
          `https://mcp.tavily.com/mcp/?tavilyApiKey=${key}`,
          {},
          "tavily_extract",
          { urls: batch, extract_depth: "advanced", format },
          signal,
          MCP_FETCH_TIMEOUT_MS,
        )
        return fetchPages(batch, payload, (item) => stringValue(item.raw_content) ?? stringValue(item.content), format)
      })
    }
    return await fetchBatches(urls, 20, globals, signal, async (batch) => {
      const { timeout, sessionId, humanId, clientName, ...options } = settings
      const requestOptions = Object.fromEntries(
        Object.entries(options).map(([name, value]) => [
          (
            {
              includeImages: "include_images",
              extractDepth: "extract_depth",
              includeFavicon: "include_favicon",
              includeUsage: "include_usage",
              chunksPerSource: "chunks_per_source",
            } as Record<string, string>
          )[name] ?? name,
          value,
        ]),
      )
      const response = await apiJSON("https://api.tavily.com/extract", signal, {
        key,
        body: {
          urls: batch,
          extract_depth: "advanced",
          format: format as "markdown" | "text",
          timeout,
          ...requestOptions,
        },
        headers: {
          ...(key
            ? { "X-Client-Source": "tavily-js" }
            : {
                "X-Tavily-Access-Mode": "keyless",
                "X-Client-Source": "tavily-js-keyless",
              }),
          ...(sessionId ? { "X-Session-Id": String(sessionId) } : {}),
          ...(humanId ? { "X-Human-Id": String(humanId) } : {}),
          ...(clientName ? { "X-Client-Name": String(clientName) } : {}),
        },
        timeoutMs:
          typeof timeout === "number" && timeout > 0
            ? Math.min(REQUEST_TIMEOUT_MS, timeout * 1000)
            : REQUEST_TIMEOUT_MS,
      })
      const payload = isRecord(response) ? response : {}
      return fetchPages(
        batch,
        {
          results: Array.isArray(payload.results)
            ? payload.results.filter(isRecord).map((item) => {
                return {
                  url: item.url,
                  title: item.title,
                  rawContent: item.raw_content,
                  images: item.images,
                  favicon: item.favicon,
                }
              })
            : [],
          failed_results: Array.isArray(payload.failed_results)
            ? payload.failed_results.filter(isRecord).map((item) => {
                return {
                  url: item.url,
                  error: item.error,
                }
              })
            : [],
        },
        (item) => stringValue(item.rawContent),
        format,
      )
    })
  },
} satisfies FetchProvider
