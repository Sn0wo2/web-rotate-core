import { clamp } from "es-toolkit/math"
import { apiJSON, REQUEST_TIMEOUT_MS } from "../../shared/http"
import { mcpJSON } from "../mcp"
import type { SearchProvider } from "./types"
import { searchResponse } from "./utils"

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
          max_results: clamp(globals.searchResults, 1, 20),
        },
        signal,
      )
      return searchResponse(payload)
    }
    const { timeout, sessionId, humanId, clientName, maxAgeHours, maxHours, ...options } = settings
    const requestOptions = Object.fromEntries(
      Object.entries(options).map(([name, value]) => [
        (
          {
            searchDepth: "search_depth",
            maxResults: "max_results",
            includeImages: "include_images",
            includeImageDescriptions: "include_image_descriptions",
            includeAnswer: "include_answer",
            includeRawContent: "include_raw_content",
            includeDomains: "include_domains",
            excludeDomains: "exclude_domains",
            includeDomainsMode: "include_domains_mode",
            timeRange: "time_range",
            chunksPerSource: "chunks_per_source",
            startDate: "start_date",
            endDate: "end_date",
            autoParameters: "auto_parameters",
            includeFavicon: "include_favicon",
            includeUsage: "include_usage",
            exactMatch: "exact_match",
            fetchTimeout: "fetch_timeout",
            cacheFallback: "cache_fallback",
            filterByLanguage: "filter_by_language",
          } as Record<string, string>
        )[name] ?? name,
        value,
      ]),
    )
    const resolvedClientName = clientName === undefined ? "web-rotate-core" : clientName
    const payload = await apiJSON("https://api.tavily.com/search", signal, {
      key,
      body: {
        query: queries[0],
        search_depth: "basic",
        chunks_per_source: 1,
        include_answer: false,
        include_raw_content: false,
        auto_parameters: false,
        topic: "general",
        max_results: clamp(globals.searchResults, 1, 20),
        ...(maxAgeHours !== undefined || maxHours !== undefined
          ? {
              max_age_hours: maxAgeHours != null ? maxAgeHours : maxHours,
            }
          : {}),
        ...requestOptions,
      },
      headers: {
        ...(key
          ? { "X-Client-Source": "tavily-js" }
          : {
              "X-Tavily-Access-Mode": "keyless",
              "X-Client-Source": "tavily-js-keyless",
            }),
        ...(resolvedClientName ? { "X-Client-Name": String(resolvedClientName) } : {}),
        ...(sessionId ? { "X-Session-Id": String(sessionId) } : {}),
        ...(humanId ? { "X-Human-Id": String(humanId) } : {}),
      },
      timeoutMs:
        typeof timeout === "number" && timeout > 0 ? Math.min(REQUEST_TIMEOUT_MS, timeout * 1000) : REQUEST_TIMEOUT_MS,
    })
    return searchResponse(payload)
  },
} satisfies SearchProvider
