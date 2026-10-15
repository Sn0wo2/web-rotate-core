import { apiJSON } from "../../shared/http";
import { providerOptions, stringValue } from "../../shared/config";
import type { FetchProvider } from "./types";
import { requireKey } from "../utils";
import { fetchBatches, fetchPages } from "./utils";

export const you: FetchProvider = {
  id: "you",
  weight: 67,
  formats: ["html", "markdown"],
  run: async (key, urls, signal, ctx, format) => {
    return fetchBatches(urls, 10, ctx, signal, async (batch) => {
      const payload = await apiJSON(
        "https://ydc-index.io/v1/contents",
        signal,
        {
          label: "you",
          body: {
            crawl_timeout: 30,
            ...providerOptions(ctx, "you", "fetch"),
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
};
