import get from "es-toolkit/compat/get";
import { providerOptions } from "../../shared/config";
import type { SearchProvider } from "./types";
import { bearer } from "../utils";
import { restSearch, searchCount } from "./utils";

export const bocha: SearchProvider = {
  id: "bocha",
  weight: 55,
  run: restSearch(
    "https://api.bochaai.com/v1/web-search",
    (queries, ctx) => ({
      summary: true,
      ...providerOptions(ctx, "bocha", "search"),
      query: queries[0],
      count: searchCount(ctx, 50),
    }),
    bearer,
    (payload) => get(payload, "data.webPages.value"),
  ),
};
