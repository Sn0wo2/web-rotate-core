import { isPlainObject as isRecord } from "es-toolkit/predicate";
import { ScrapingBeeClient } from "scrapingbee";
import type { SearchProvider } from "./types";
import { requireKey, sdkRequest } from "../utils";
import { searchResponse } from "./utils";

export const scrapingbee = {
  id: "scrapingbee",
  weight: 48,
  run: async ({ settings, key, queries, signal }) => {
    const client = new ScrapingBeeClient(requireKey("scrapingbee", key));
    const response = await sdkRequest(signal, () =>
      client.googleSearch({
        search: queries[0],
        params: { ...settings },
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
} satisfies SearchProvider;
