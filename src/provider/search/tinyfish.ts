import { apiJSON } from "../../shared/http";
import { providerOptions } from "../../shared/config";
import type { SearchProvider } from "./types";
import { requireKey, urlParams } from "../utils";
import { searchResponse } from "./utils";

export const tinyfish: SearchProvider = {
  id: "tinyfish",
  weight: 72,
  run: async (key, queries, signal, ctx) => {
    const endpoint = urlParams(
      new URL("https://api.search.tinyfish.ai"),
      { domain_type: "web", ...providerOptions(ctx, "tinyfish", "search") },
      (_name, value) => (Array.isArray(value) ? value.join(",") : undefined),
    );
    endpoint.searchParams.set("query", queries[0]);
    return searchResponse(
      await apiJSON(endpoint.toString(), signal, {
        headers: { "X-API-Key": requireKey("tinyfish", key) },
      }),
    );
  },
};
