import { tavily as tavilyApi } from "@tavily/core";
import { providerOptions } from "../../shared/config";
import type { SearchProvider } from "./types";
import { mcpJSON } from "../mcp";
import { sdkRequest } from "../utils";
import { searchCount, searchResponse } from "./utils";

export const tavily: SearchProvider = {
  id: "tavily",
  weight: 67,
  keyless: true,
  run: async (key, queries, signal, ctx) => {
    const options = providerOptions(ctx, "tavily", "search");
    if (key && !Object.keys(options).length) {
      const payload = await mcpJSON(
        `https://mcp.tavily.com/mcp/?tavilyApiKey=${key}`,
        {},
        "tavily_search",
        {
          query: queries[0],
          search_depth: "basic",
          max_results: searchCount(ctx, 20),
        },
        signal,
      );
      return searchResponse(payload);
    }
    const response = await sdkRequest(signal, () =>
      tavilyApi(
        key
          ? { apiKey: key, clientName: "web-rotate-core" }
          : { clientName: "web-rotate-core" },
      ).search(queries[0], {
        searchDepth: "basic",
        chunksPerSource: 1,
        includeAnswer: false,
        includeRawContent: false,
        autoParameters: false,
        topic: "general",
        maxResults: searchCount(ctx, 20),
        ...options,
      }),
    );
    return searchResponse(response);
  },
};
