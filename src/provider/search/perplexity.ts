import Perplexity, {
  type SearchCreateParams,
} from "@perplexity-ai/perplexity_ai";
import { providerOptions } from "../../shared/config";
import type { SearchProvider } from "./types";
import { requireKey, sdkRequest } from "../utils";
import { searchCount, searchResponse } from "./utils";

type PerplexitySearchOptions = {
  search_context_size?: string;
  search_type?: string;
  max_tokens?: number;
  max_tokens_per_page?: number;
};

export const perplexity: SearchProvider = {
  id: "perplexity",
  weight: 80,
  batchSize: Infinity,
  run: async (key, queries, signal, ctx) => {
    const { search_context_size, ...options } =
      providerOptions<PerplexitySearchOptions>(ctx, "perplexity", "search");
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
            ctx,
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
};
