import type { SearchProvider } from "./types";
import { bearer } from "../utils";
import { restSearch, searchCount } from "./utils";

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
      max_results: searchCount(globals),
    }),
    bearer,
  ),
} satisfies SearchProvider;
