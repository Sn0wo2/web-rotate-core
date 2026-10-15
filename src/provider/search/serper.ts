import type { SearchProvider } from "./types";
import { requireKey } from "../utils";
import { restSearch, searchCount } from "./utils";

export const serper = {
  id: "serper",
  weight: 62,
  run: restSearch<Record<string, unknown>>(
    "https://google.serper.dev/search",
    ({ settings, queries, globals }) => ({
      ...settings,
      q: queries[0],
      num: searchCount(globals),
    }),
    (key) => ({ "X-API-Key": requireKey("serper", key) }),
  ),
} satisfies SearchProvider;
