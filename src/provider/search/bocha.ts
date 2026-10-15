import get from "es-toolkit/compat/get";
import type { SearchProvider } from "./types";
import { bearer } from "../utils";
import { restSearch, searchCount } from "./utils";

export const bocha = {
  id: "bocha",
  weight: 55,
  run: restSearch<Record<string, unknown>>(
    "https://api.bochaai.com/v1/web-search",
    ({ settings, queries, globals }) => ({
      summary: true,
      ...settings,
      query: queries[0],
      count: searchCount(globals, 50),
    }),
    bearer,
    (payload) => get(payload, "data.webPages.value"),
  ),
} satisfies SearchProvider;
