import type { SearchProvider } from "./types";
import { requireKey } from "../utils";
import { clamp } from "es-toolkit/math";
import { restSearch } from "./utils";

export const serper = {
  id: "serper",
  weight: 62,
  run: restSearch<Record<string, unknown>>(
    "https://google.serper.dev/search",
    ({ settings, queries, globals }) => ({
      ...settings,
      q: queries[0],
      num: clamp(globals.searchResults, 1, 100),
    }),
    (key) => ({ "X-API-Key": requireKey("serper", key) }),
  ),
} satisfies SearchProvider;
