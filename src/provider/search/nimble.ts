import type { SearchProvider } from "./types";
import { clamp } from "es-toolkit/math";
import { restSearch } from "./utils";

export const nimble = {
  id: "nimble",
  weight: 72,
  run: restSearch<Record<string, unknown>>(
    "https://sdk.nimbleway.com/v2/search",
    ({ settings, queries, globals }) => ({
      search_depth: "standard",
      focus: "general",
      output_format: "plain_text",
      full_content: false,
      ...settings,
      query: queries[0],
      max_results: clamp(globals.searchResults, 1, 100),
    }),
    (key) => ({ ...(key ? { Authorization: `Bearer ${key}` } : {}) }),
  ),
} satisfies SearchProvider;
