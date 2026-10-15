import Perplexity, {
  type SearchCreateParams,
} from "@perplexity-ai/perplexity_ai";
import { z } from "zod";
import type { SearchProvider } from "./types";
import { requireKey, sdkRequest } from "../utils";
import { searchCount, searchResponse } from "./utils";

const settingsSchema = z.looseObject({
  search_context_size: z.string().optional(),
  search_type: z.string().optional(),
  max_tokens: z.number().optional(),
  max_tokens_per_page: z.number().optional(),
});
type PerplexitySearchSettings = z.output<typeof settingsSchema>;

export const perplexity = {
  id: "perplexity",
  weight: 80,
  batchSize: Infinity,
  options: settingsSchema,
  run: async ({ settings, key, queries, signal, globals }) => {
    const { search_context_size, ...options } = settings;
    const client = new Perplexity({
      apiKey: requireKey("perplexity", key),
    });
    const payload = await sdkRequest(signal, (requestSignal) =>
      client.search.create(
        {
          search_type: "fast",
          ...options,
          query: queries.length === 1 ? queries[0] : queries,
          max_results: searchCount(
            globals,
            options.search_type === "people" ? 50 : 20,
          ),
          ...(options.max_tokens == null && options.max_tokens_per_page == null
            ? { search_context_size: search_context_size ?? "low" }
            : {}),
        } as SearchCreateParams,
        { signal: requestSignal },
      ),
    );
    return searchResponse(payload);
  },
} satisfies SearchProvider<PerplexitySearchSettings>;
