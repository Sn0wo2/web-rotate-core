import Parallel from "parallel-web";
import { z } from "zod";
import type { SearchProvider } from "./types";
import { mcpJSON } from "../mcp";
import { sdkRequest } from "../utils";
import { searchCount, searchResponse } from "./utils";

const settingsSchema = z.looseObject({
  mode: z.string().optional(),
  max_results: z.number().optional(),
  processor: z.unknown().optional(),
  advanced_settings: z
    .looseObject({
      excerpt_settings: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
});
type ParallelSearchSettings = z.output<typeof settingsSchema>;

export const parallel = {
  id: "parallel",
  weight: 74,
  keyless: true,
  batchSize: Infinity,
  options: settingsSchema,
  run: async ({ settings, key, queries, signal, globals }) => {
    if (!key) {
      const payload = await mcpJSON(
        "https://search.parallel.ai/mcp",
        {},
        "web_search",
        { objective: queries[0], search_queries: queries },
        signal,
      );
      return searchResponse(payload);
    }
    const { mode, advanced_settings, max_results, processor, ...rest } =
      settings;
    const client = new Parallel({ apiKey: key });
    const payload = await sdkRequest(signal, (requestSignal) =>
      client.search(
        {
          mode: (mode?.trim() || "fast") as
            "turbo" | "fast" | "basic" | "advanced",
          ...rest,
          objective: queries[0],
          search_queries: queries,
          advanced_settings: {
            ...advanced_settings,
            excerpt_settings: {
              max_chars_per_result: 1000,
              ...advanced_settings?.excerpt_settings,
            },
            max_results: max_results ?? searchCount(globals, 20),
          },
        },
        { signal: requestSignal },
      ),
    );
    return searchResponse(payload);
  },
} satisfies SearchProvider<ParallelSearchSettings>;
