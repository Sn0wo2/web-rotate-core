import { apiJSON } from "../../shared/http";
import { stringValue } from "../../shared/config";
import type { FetchProvider } from "./types";
import { requireKey } from "../utils";
import { fetchBatches, fetchPages } from "./utils";

export const you = {
  id: "you",
  weight: 67,
  formats: ["html", "markdown"],
  run: async ({ settings, key, urls, signal, format, globals }) => {
    return fetchBatches(urls, 10, globals, signal, async (batch) => {
      const payload = await apiJSON(
        "https://ydc-index.io/v1/contents",
        signal,
        {
          label: "you",
          body: {
            crawl_timeout: 30,
            ...settings,
            urls: batch,
            formats: [format],
          },
          headers: { "X-API-Key": requireKey("you", key) },
        },
      );
      return fetchPages(
        batch,
        payload,
        (item) => stringValue(item[format]),
        format,
      );
    });
  },
} satisfies FetchProvider;
