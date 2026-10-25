import get from "es-toolkit/compat/get";
import type { SearchProvider } from "./types";
import { clamp } from "es-toolkit/math";
import { restSearch } from "./utils";

export const bocha = {
  id: "bocha",
  weight: 55,
  run: restSearch<Record<string, unknown>>(
    "https://api.bochaai.com/v1/web-search",
    ({ settings, queries, globals }) => ({
      summary: true,
      ...settings,
      query: queries[0],
      count: clamp(globals.searchResults, 1, 50),
    }),
    (key) => ({ ...(key ? { Authorization: `Bearer ${key}` } : {}) }),
    (payload) => get(payload, "data.webPages.value"),
  ),
} satisfies SearchProvider;
