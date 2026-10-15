import get from "es-toolkit/compat/get";
import { Hyperbrowser } from "@hyperbrowser/sdk";
import type { SearchProvider } from "./types";
import { requireKey, sdkRequest } from "../utils";
import { searchResponse } from "./utils";

export const hyperbrowser = {
  id: "hyperbrowser",
  weight: 45,
  run: async ({ settings, key, queries, signal }) => {
    const client = new Hyperbrowser({
      apiKey: requireKey("hyperbrowser", key),
    });
    const payload = await sdkRequest(signal, () =>
      client.web.search({
        page: 1,
        ...settings,
        query: queries[0],
      }),
    );
    return searchResponse(payload, get(payload, "data.results"));
  },
} satisfies SearchProvider;
