import { tavily as tavilyApi } from "@tavily/core";
import type { SearchProvider } from "./types";
import { mcpJSON } from "../mcp";
import { sdkRequest } from "../utils";
import { searchCount, searchResponse } from "./utils";

export const tavily = {
  id: "tavily",
  weight: 67,
  keyless: true,
  run: async ({ settings, key, queries, signal, globals }) => {
    if (key && !Object.keys(settings).length) {
      const payload = await mcpJSON(
        `https://mcp.tavily.com/mcp/?tavilyApiKey=${key}`,
        {},
        "tavily_search",
        {
          query: queries[0],
          search_depth: "basic",
          max_results: searchCount(globals, 20),
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
        maxResults: searchCount(globals, 20),
        ...settings,
      }),
    );
    return searchResponse(response);
  },
} satisfies SearchProvider;
