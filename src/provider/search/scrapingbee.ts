import { isPlainObject as isRecord } from "es-toolkit/predicate";
import { ScrapingBeeClient } from "scrapingbee";
import { providerOptions } from "../../shared/config";
import type { SearchProvider } from "./types";
import { requireKey, sdkRequest } from "../utils";
import { searchResponse } from "./utils";

export const scrapingbee: SearchProvider = {
  id: "scrapingbee",
  weight: 48,
  run: async (key, queries, signal, ctx) => {
    const client = new ScrapingBeeClient(requireKey("scrapingbee", key));
    const response = await sdkRequest(signal, () =>
      client.googleSearch({
        search: queries[0],
        params: { ...providerOptions(ctx, "scrapingbee", "search") },
      }),
    );
    const payload = response.data as unknown;
    return searchResponse(
      payload,
      isRecord(payload) && Array.isArray(payload.organic_results)
        ? payload.organic_results
        : payload,
    );
  },
};
