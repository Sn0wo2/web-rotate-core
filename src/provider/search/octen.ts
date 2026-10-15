import get from "es-toolkit/compat/get";
import type { SearchProvider } from "./types";
import { bearer } from "../utils";
import { restSearch, searchCount } from "./utils";

export const octen = {
  id: "octen",
  weight: 80,
  run: restSearch<Record<string, unknown>>(
    "https://api.octen.ai/search",
    ({ settings, queries, globals }) => ({
      highlight: { enable: true, max_tokens: 300 },
      format: "text",
      ...settings,
      query: queries[0],
      count: searchCount(globals),
    }),
    bearer,
    (payload) => get(payload, "data.results"),
  ),
} satisfies SearchProvider;
