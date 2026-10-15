import get from "es-toolkit/compat/get";
import Firecrawl from "@mendable/firecrawl-js";
import { z } from "zod";
import type { SearchProvider } from "./types";
import { firstList, sdkRequest } from "../utils";
import { searchCount, searchResponse } from "./utils";

const settingsSchema = z.looseObject({ keyless: z.boolean().optional() });
type FirecrawlSearchSettings = z.output<typeof settingsSchema>;

export const firecrawl = {
  id: "firecrawl",
  weight: 71,
  keyless: true,
  keylessEnabled: (settings) => settings.keyless !== false,
  options: settingsSchema,
  run: async ({ settings, key, queries, signal, globals }) => {
    const { keyless, ...options } = settings;
    const client = new Firecrawl(key ? { apiKey: key } : {});
    const payload = await sdkRequest(signal, () =>
      client.search(queries[0], {
        ...options,
        limit: searchCount(globals),
      }),
    );
    return searchResponse(payload, firstList(get(payload, "data")));
  },
} satisfies SearchProvider<FirecrawlSearchSettings>;
