import get from "es-toolkit/compat/get";
import { providerOptions } from "../../shared/config";
import type { SearchProvider } from "./types";
import { bearer } from "../utils";
import { restSearch, searchCount } from "./utils";

export const octen: SearchProvider = {
  id: "octen",
  weight: 80,
  run: restSearch(
    "https://api.octen.ai/search",
    (queries, ctx) => ({
      highlight: { enable: true, max_tokens: 300 },
      format: "text",
      ...providerOptions(ctx, "octen", "search"),
      query: queries[0],
      count: searchCount(ctx),
    }),
    bearer,
    (payload) => get(payload, "data.results"),
  ),
};
