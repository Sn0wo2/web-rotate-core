import get from "es-toolkit/compat/get";
import { Hyperbrowser } from "@hyperbrowser/sdk";
import { providerOptions } from "../../shared/config";
import type { SearchProvider } from "./types";
import { requireKey, sdkRequest } from "../utils";
import { searchResponse } from "./utils";

export const hyperbrowser: SearchProvider = {
  id: "hyperbrowser",
  weight: 45,
  run: async (key, queries, signal, ctx) => {
    const client = new Hyperbrowser({
      apiKey: requireKey("hyperbrowser", key),
    });
    const payload = await sdkRequest(signal, () =>
      client.web.search({
        page: 1,
        ...providerOptions(ctx, "hyperbrowser", "search"),
        query: queries[0],
      }),
    );
    return searchResponse(payload, get(payload, "data.results"));
  },
};
