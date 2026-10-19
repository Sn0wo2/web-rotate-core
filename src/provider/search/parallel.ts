import { z } from "zod";
import { apiJSON } from "../../shared/http";
import type { SearchProvider } from "./types";
import { mcpJSON } from "../mcp";
import { requireKey } from "../utils";
import { searchCount, searchResponse } from "./utils";

const settingsSchema = z.looseObject({
  mode: z.string().optional(),
  max_results: z.number().optional(),
  processor: z.unknown().optional(),
  advanced_settings: z
    .looseObject({
      excerpt_settings: z.record(z.string(), z.unknown()).optional(),
      fetch_policy: z
        .looseObject({
          max_age_seconds: z.number().optional(),
          disable_cache_fallback: z.boolean().optional(),
        })
        .optional(),
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
    const payload = await apiJSON("https://api.parallel.ai/v1/search", signal, {
      headers: { "x-api-key": requireKey("parallel", key) },
      body: {
        mode: mode?.trim() || "fast",
        ...rest,
        objective: queries[0],
        search_queries: queries,
        advanced_settings: {
          ...advanced_settings,
          fetch_policy: {
            ...advanced_settings?.fetch_policy,
            max_age_seconds: Math.max(
              600,
              Math.trunc(
                advanced_settings?.fetch_policy?.max_age_seconds ??
                  globals.cacheWindowSeconds,
              ),
            ),
            disable_cache_fallback:
              advanced_settings?.fetch_policy?.disable_cache_fallback ?? true,
          },
          excerpt_settings: {
            max_chars_per_result: 1000,
            ...advanced_settings?.excerpt_settings,
          },
          max_results: max_results ?? searchCount(globals, 20),
        },
      },
    });
    return searchResponse(payload);
  },
} satisfies SearchProvider<ParallelSearchSettings>;
