import {
  checkedResponseText,
  TARGET_USER_AGENT,
  USER_AGENT,
} from "../../shared/http";
import { providerOptions } from "../../shared/config";
import type { FetchProvider } from "./types";
import { fetchOne, providerResult } from "./utils";

type JinaOptions = { headers?: Record<string, string> };

export const jina: FetchProvider = {
  id: "jina",
  weight: 66,
  keyless: true,
  formats: ["text", "markdown", "html"],
  run: fetchOne(async (key, url, signal, ctx, format) => {
    const { headers } = providerOptions<JinaOptions>(ctx, "jina", "fetch");
    const response = await fetch(`https://r.jina.ai/${url}`, {
      headers: {
        Accept:
          format === "html"
            ? "text/html, text/plain;q=0.9"
            : format === "text"
              ? "text/plain"
              : "text/markdown, text/plain;q=0.9",
        ...(key ? { Authorization: `Bearer ${key}` } : {}),
        "User-Agent": USER_AGENT,
        "X-User-Agent": TARGET_USER_AGENT,
        "X-Respond-With": format,
        ...headers,
      },
      signal,
      redirect: "error",
    });
    return providerResult(await checkedResponseText(response, "jina"), format);
  }),
};
