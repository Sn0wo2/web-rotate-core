import { isPlainObject as isRecord } from "es-toolkit/predicate";
import { apiJSON } from "../../shared/http";
import type { SearchProvider } from "./types";
import { requireKey } from "../utils";
import { searchCount, searchResponse } from "./utils";

export const you = {
  id: "you",
  weight: 74,
  run: async ({ settings, key, queries, signal, globals }) => {
    const extraction = isRecord(settings.extraction) ? settings.extraction : {};
    const payload = await apiJSON("https://ydc-index.io/v1/search", signal, {
      label: "you",
      body: {
        safesearch: "moderate",
        ...settings,
        extraction: {
          extraction_mode: "highlights",
          ...(globals.cacheWindowSeconds === 0
            ? { extraction_mode: "full_page", extraction_source: "fetch" }
            : {}),
          ...extraction,
        },
        query: queries[0],
        count: searchCount(globals),
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
} satisfies SearchProvider;
