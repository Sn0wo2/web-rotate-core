import { tavily as tavilyApi } from "@tavily/core";
import { stringValue } from "../../shared/config";
import type { FetchProvider } from "./types";
import { mcpJSON, MCP_FETCH_TIMEOUT_MS } from "../mcp";
import { sdkRequest } from "../utils";
import { fetchBatches, fetchPages } from "./utils";

export const tavily = {
  id: "tavily",
  weight: 68,
  keyless: true,
  formats: ["text", "markdown"],
  run: async ({ settings, key, urls, signal, format, globals }) => {
    if (key && !Object.keys(settings).length) {
      return fetchBatches(urls, 20, globals, signal, async (batch) => {
        const payload = await mcpJSON(
          `https://mcp.tavily.com/mcp/?tavilyApiKey=${key}`,
          {},
          "tavily_extract",
          { urls: batch, extract_depth: "advanced", format },
          signal,
          MCP_FETCH_TIMEOUT_MS,
        );
        return fetchPages(
          batch,
          payload,
          (item) => stringValue(item.raw_content) ?? stringValue(item.content),
          format,
        );
      });
    }
    return fetchBatches(urls, 20, globals, signal, async (batch) => {
      const response = await sdkRequest(signal, () =>
        tavilyApi(key ? { apiKey: key } : {}).extract(batch, {
          extractDepth: "advanced",
          format: format as "markdown" | "text",
          ...settings,
        }),
      );
      return fetchPages(
        batch,
        {
          results: response.results,
          failed_results: response.failedResults,
        },
        (item) => stringValue(item.rawContent),
        format,
      );
    });
  },
} satisfies FetchProvider;
