import { providerOptions } from "../../shared/config";
import type { SearchProvider } from "./types";
import { bearer } from "../utils";
import { restSearch, searchCount } from "./utils";

export const nimble: SearchProvider = {
  id: "nimble",
  weight: 72,
  run: restSearch(
    "https://sdk.nimbleway.com/v2/search",
    (queries, ctx) => ({
      search_depth: "standard",
      focus: "general",
      output_format: "plain_text",
      full_content: false,
      ...providerOptions(ctx, "nimble", "search"),
      query: queries[0],
      max_results: searchCount(ctx),
    }),
    bearer,
  ),
};
