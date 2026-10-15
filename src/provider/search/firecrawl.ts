import get from "es-toolkit/compat/get";
import Firecrawl from "@mendable/firecrawl-js";
import { providerOptions } from "../../shared/config";
import type { SearchProvider } from "./types";
import { firstList, sdkRequest } from "../utils";
import { searchCount, searchResponse } from "./utils";

type FirecrawlSearchOptions = { keyless?: boolean };

export const firecrawl: SearchProvider = {
  id: "firecrawl",
  weight: 71,
  keyless: true,
  keylessEnabled: (ctx) =>
    providerOptions<FirecrawlSearchOptions>(ctx, "firecrawl", "search")
      .keyless !== false,
  run: async (key, queries, signal, ctx) => {
    const { keyless, ...options } = providerOptions<FirecrawlSearchOptions>(
      ctx,
      "firecrawl",
      "search",
    );
    const client = new Firecrawl(key ? { apiKey: key } : {});
    const payload = await sdkRequest(signal, () =>
      client.search(queries[0], {
        ...options,
        limit: searchCount(ctx),
      }),
    );
    return searchResponse(payload, firstList(get(payload, "data")));
  },
};
