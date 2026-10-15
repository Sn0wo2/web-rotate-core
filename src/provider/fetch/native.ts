import {
  HTTPError,
  readBodyLimited,
  TARGET_USER_AGENT,
} from "../../shared/http";
import {
  errorMessage,
  mapConcurrent,
  requestConcurrency,
} from "../../shared/utils";
import { fetchManualRedirects } from "./utils";
import type { FetchPage } from "./types";
import type { FetchProvider } from "./types";

export const native: FetchProvider = {
  id: "native",
  weight: 70,
  keyless: true,
  formats: ["text", "html"],
  run: async (_key, urls, signal, ctx) =>
    mapConcurrent(
      urls,
      async (url): Promise<FetchPage> => {
        try {
          const { response, url: currentURL } = await fetchManualRedirects(
            url,
            signal,
            {
              Accept:
                "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
              "User-Agent": TARGET_USER_AGENT,
            },
            "local webfetch",
            "webfetch-rotate",
            10,
          );
          const contentType =
            response.headers
              .get("content-type")
              ?.split(";", 1)[0]
              ?.trim()
              .toLowerCase() ?? "";
          if (
            contentType &&
            !contentType.startsWith("text/") &&
            !contentType.includes("html") &&
            !contentType.includes("xml") &&
            !contentType.includes("json")
          ) {
            await response.body?.cancel();
            throw new Error(
              `local webfetch unsupported content type ${contentType}`,
            );
          }
          const bytes = await readBodyLimited(
            response,
            10 * 1024 * 1024,
            "local webfetch",
          );
          let body: string;
          try {
            body = new TextDecoder(
              response.headers
                .get("content-type")
                ?.match(/charset\s*=\s*["']?([^;"'\s]+)/i)?.[1] || "utf-8",
            ).decode(bytes);
          } catch {
            body = new TextDecoder().decode(bytes);
          }
          if (!body.trim()) throw new Error("empty content");
          return {
            url,
            ...(currentURL !== url ? { finalURL: currentURL } : {}),
            provider: "native",
            metadata: { contentType, status: response.status },
            content: body,
            format:
              contentType.includes("html") ||
              (!contentType && /<\/?[a-z][\w:-]*(?:\s[^<>]*?)?>/i.test(body))
                ? "html"
                : "text",
          };
        } catch (error) {
          if (signal.aborted) throw error;
          return {
            url,
            error: errorMessage(error),
            ...(error instanceof HTTPError
              ? {
                  metadata: {
                    httpStatus: error.status,
                    retryable: error.retryable,
                  },
                }
              : {}),
          };
        }
      },
      requestConcurrency(ctx),
      signal,
    ),
};
