import { LinkupClient } from "linkup-sdk";
import type { SearchProvider } from "./types";
import { requireKey, sdkRequest } from "../utils";
import { searchCount, searchResponse } from "./utils";

export const linkup = {
  id: "linkup",
  weight: 68,
  run: async ({ settings, key, queries, signal, globals }) => {
    const client = new LinkupClient({
      apiKey: requireKey("linkup", key),
    });
    const payload = await sdkRequest(signal, () =>
      client.search({
        depth: "standard",
        ...settings,
        outputType: "searchResults",
        query: queries[0],
        maxResults: searchCount(globals),
      }),
    );
    return searchResponse(payload);
  },
} satisfies SearchProvider;
