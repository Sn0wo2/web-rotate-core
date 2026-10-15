import Parallel from "parallel-web";
import { providerOptions } from "../../shared/config";
import type { SearchProvider } from "./types";
import { mcpJSON } from "../mcp";
import { sdkRequest } from "../utils";
import { searchCount, searchResponse } from "./utils";

type ParallelSearchOptions = {
  mode?: string;
  max_results?: number;
  processor?: unknown;
  advanced_settings?: { excerpt_settings?: Record<string, unknown> };
};

export const parallel: SearchProvider = {
  id: "parallel",
  weight: 74,
  keyless: true,
  batchSize: Infinity,
  run: async (key, queries, signal, ctx) => {
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
    const options = providerOptions<ParallelSearchOptions>(
      ctx,
      "parallel",
      "search",
    );
    const { mode, advanced_settings, max_results, processor, ...rest } =
      options;
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
            max_results: max_results ?? searchCount(ctx, 20),
          },
        },
        { signal: requestSignal },
      ),
    );
    return searchResponse(payload);
  },
};
