import { apiJSON } from "../../shared/http";
import type { SearchProvider } from "./types";
import { requireKey } from "../utils";
import { searchCount, searchResponse } from "./utils";

export const linkup = {
  id: "linkup",
  weight: 68,
  run: async ({ settings, key, queries, signal, globals }) => {
    const {
      depth,
      includeDomains,
      excludeDomains,
      fromDate,
      toDate,
      maxResults,
      includeImages,
      includeInlineCitations,
      includeSources,
      structuredOutputSchema,
    }: Record<string, unknown> = {
      depth: "standard",
      ...settings,
      maxResults: searchCount(globals),
    };
    const payload = await apiJSON("https://api.linkup.so/v1/search", signal, {
      key: requireKey("linkup", key),
      body: {
        depth,
        outputType: "searchResults",
        q: queries[0],
        ...(includeDomains ? { includeDomains } : {}),
        ...(excludeDomains ? { excludeDomains } : {}),
        ...(fromDate !== undefined
          ? {
              fromDate:
                fromDate instanceof Date
                  ? fromDate.toISOString().slice(0, 10)
                  : fromDate,
            }
          : {}),
        ...(toDate !== undefined
          ? {
              toDate:
                toDate instanceof Date
                  ? toDate.toISOString().slice(0, 10)
                  : toDate,
            }
          : {}),
        ...(maxResults !== undefined ? { maxResults } : {}),
        ...(includeImages !== undefined ? { includeImages } : {}),
        ...(includeInlineCitations !== undefined
          ? { includeInlineCitations }
          : {}),
        ...(includeSources !== undefined ? { includeSources } : {}),
        ...(structuredOutputSchema !== undefined
          ? {
              structuredOutputSchema:
                typeof structuredOutputSchema === "string"
                  ? structuredOutputSchema
                  : JSON.stringify(structuredOutputSchema),
            }
          : {}),
      },
    });
    return searchResponse(payload);
  },
} satisfies SearchProvider;
