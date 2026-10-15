import { apiJSON } from "../../shared/http";
import type { SearchProvider } from "./types";
import { requireKey, urlParams } from "../utils";
import { searchResponse } from "./utils";

export const tinyfish = {
  id: "tinyfish",
  weight: 72,
  run: async ({ settings, key, queries, signal }) => {
    const endpoint = urlParams(
      new URL("https://api.search.tinyfish.ai"),
      { domain_type: "web", ...settings },
      (_name, value) => (Array.isArray(value) ? value.join(",") : undefined),
    );
    endpoint.searchParams.set("query", queries[0]);
    return searchResponse(
      await apiJSON(endpoint.toString(), signal, {
        headers: { "X-API-Key": requireKey("tinyfish", key) },
      }),
    );
  },
} satisfies SearchProvider;
