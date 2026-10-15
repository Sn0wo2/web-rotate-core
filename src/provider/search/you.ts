import { isPlainObject as isRecord } from "es-toolkit/predicate";
import { apiJSON } from "../../shared/http";
import { providerOptions } from "../../shared/config";
import type { SearchProvider } from "./types";
import { requireKey } from "../utils";
import { searchCount, searchResponse } from "./utils";

export const you: SearchProvider = {
  id: "you",
  weight: 74,
  run: async (key, queries, signal, ctx) => {
    const payload = await apiJSON("https://ydc-index.io/v1/search", signal, {
      label: "you",
      body: {
        extraction: { extraction_mode: "highlights" },
        safesearch: "moderate",
        ...providerOptions(ctx, "you", "search"),
        query: queries[0],
        count: searchCount(ctx),
      },
      headers: { "X-API-Key": requireKey("you", key) },
    });
    const grouped =
      isRecord(payload) && isRecord(payload.results) ? payload.results : {};
    const items = (
      Array.isArray(payload)
        ? payload
        : [
            ...(Array.isArray(grouped.web) ? grouped.web : []),
            ...(Array.isArray(grouped.news) ? grouped.news : []),
          ]
    ).map((item) => {
      if (!isRecord(item)) return item;
      const contents = isRecord(item.contents) ? item.contents : {};
      return Array.isArray(contents.highlights) && item.highlights == null
        ? { ...item, highlights: contents.highlights }
        : item;
    });
    return searchResponse(payload, items);
  },
};
