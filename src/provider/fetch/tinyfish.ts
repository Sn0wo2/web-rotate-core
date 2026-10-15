import { apiJSON } from "../../shared/http";
import { providerOptions, stringValue } from "../../shared/config";
import type { FetchProvider } from "./types";
import { requireKey } from "../utils";
import { fetchBatches, fetchPages } from "./utils";

export const tinyfish: FetchProvider = {
  id: "tinyfish",
  weight: 74,
  formats: ["html", "markdown"],
  run: async (key, urls, signal, ctx, format) => {
    return fetchBatches(urls, 10, ctx, signal, async (batch) => {
      const payload = await apiJSON("https://api.fetch.tinyfish.ai", signal, {
        label: "tinyfish",
        body: {
          ...providerOptions(ctx, "tinyfish", "fetch"),
          urls: batch,
          format,
        },
        headers: { "X-API-Key": requireKey("tinyfish", key) },
      });
      return fetchPages(
        batch,
        payload,
        (item) => stringValue(item.text),
        format,
      );
    });
  },
};
