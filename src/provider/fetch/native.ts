import { clamp } from "es-toolkit/math"
import { HTTPError, readBodyLimited, TARGET_USER_AGENT } from "../../shared/http"
import { mapConcurrent } from "../../shared/utils"
import type { FetchPage, FetchProvider } from "./types"
import { fetchManualRedirects } from "./utils"

const CHARSET_PATTERN = /charset\s*=\s*["']?([^;"'\s]+)/i
const HTML_TAG_PATTERN = /<\/?[a-z][\w:-]*(?:\s[^<>]*?)?>/i

export const native = {
  id: "native",
  weight: 70,
  keyless: true,
  formats: ["text", "html"],
  run: async ({ urls, signal, globals }) =>
    mapConcurrent(
      urls,
      async (url): Promise<FetchPage> => {
        try {
          const { response, url: currentURL } = await fetchManualRedirects(
            url,
            signal,
            {
              Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
              "User-Agent": TARGET_USER_AGENT,
            },
            "local webfetch",
            "webfetch-rotate",
            10,
          )
          const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() ?? ""
          if (
            contentType &&
            !contentType.startsWith("text/") &&
            !contentType.includes("html") &&
            !contentType.includes("xml") &&
            !contentType.includes("json")
          ) {
            await response.body?.cancel()
            throw new Error(`local webfetch unsupported content type ${contentType}`)
          }
          const bytes = await readBodyLimited(response, 10 * 1024 * 1024, "local webfetch")
          let body: string
          try {
            body = new TextDecoder(response.headers.get("content-type")?.match(CHARSET_PATTERN)?.[1] || "utf-8").decode(
              bytes,
            )
          } catch {
            body = new TextDecoder().decode(bytes)
          }
          if (!body.trim()) throw new Error("empty content")
          return {
            url,
            ...(currentURL !== url ? { finalURL: currentURL } : {}),
            provider: "native",
            metadata: { contentType, status: response.status },
            content: body,
            format: contentType.includes("html") || (!contentType && HTML_TAG_PATTERN.test(body)) ? "html" : "text",
          }
        } catch (error) {
          if (signal.aborted) throw error
          return {
            url,
            error: error instanceof Error ? error.message : String(error),
            ...(error instanceof HTTPError
              ? {
                  metadata: {
                    httpStatus: error.status,
                    retryable: error.retryable,
                  },
                }
              : {}),
          }
        }
      },
      clamp(globals.concurrency, 1, 16),
      signal,
    ),
} satisfies FetchProvider
