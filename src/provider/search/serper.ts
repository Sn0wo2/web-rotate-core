import { providerOptions } from "../../shared/config";
import type { SearchProvider } from "./types";
import { requireKey } from "../utils";
import { restSearch, searchCount } from "./utils";

export const serper: SearchProvider = {
  id: "serper",
  weight: 62,
  run: restSearch(
    "https://google.serper.dev/search",
    (queries, ctx) => ({
      ...providerOptions(ctx, "serper", "search"),
      q: queries[0],
      num: searchCount(ctx),
    }),
    (key) => ({ "X-API-Key": requireKey("serper", key) }),
  ),
};
