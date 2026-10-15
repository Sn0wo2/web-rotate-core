import { LinkupClient } from "linkup-sdk";
import { providerOptions } from "../../shared/config";
import type { SearchProvider } from "./types";
import { requireKey, sdkRequest } from "../utils";
import { searchCount, searchResponse } from "./utils";

export const linkup: SearchProvider = {
  id: "linkup",
  weight: 68,
  run: async (key, queries, signal, ctx) => {
    const client = new LinkupClient({
      apiKey: requireKey("linkup", key),
    });
    const payload = await sdkRequest(signal, () =>
      client.search({
        depth: "standard",
        ...providerOptions(ctx, "linkup", "search"),
        outputType: "searchResults",
        query: queries[0],
        maxResults: searchCount(ctx),
      }),
    );
    return searchResponse(payload);
  },
};
