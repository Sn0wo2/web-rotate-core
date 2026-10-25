import { isPlainObject as isRecord } from "es-toolkit/predicate";
import { z } from "zod";
import type { SearchProvider } from "./types";
import { apiJSON } from "../../shared/http";
import { firstList } from "../utils";
import { clamp } from "es-toolkit/math";
import { searchResponse } from "./utils";

const settingsSchema = z.looseObject({ keyless: z.boolean().optional() });
type FirecrawlSearchSettings = z.output<typeof settingsSchema>;

export const firecrawl = {
  id: "firecrawl",
  weight: 71,
  keyless: true,
  keylessEnabled: (settings) => settings.keyless !== false,
  options: settingsSchema,
  run: async ({ settings, key, queries, signal, globals }) => {
    const { keyless, ...options } = settings;
    const {
      query: configuredQuery,
      toolDetail,
      domainTools,
      sources,
      categories,
      includeDomains,
      excludeDomains,
      tbs,
      location,
      country,
      ignoreInvalidURLs,
      timeout,
      highlights,
      scrapeOptions,
      enterprise,
      threatProtection,
      integration,
      origin,
    } = options;
    const query = configuredQuery === undefined ? queries[0] : configuredQuery;
    if (!query || !(query as string).trim())
      throw new Error("Query cannot be empty");
    const payload = await apiJSON(
      "https://api.firecrawl.dev/v2/search",
      signal,
      {
        key,
        body: {
          query,
          ...(toolDetail != null ? { toolDetail } : {}),
          ...(domainTools != null ? { domainTools } : {}),
          ...(sources ? { sources } : {}),
          ...(categories ? { categories } : {}),
          ...(includeDomains ? { includeDomains } : {}),
          ...(excludeDomains ? { excludeDomains } : {}),
          limit: clamp(globals.searchResults, 1, 100),
          ...(tbs != null ? { tbs } : {}),
          ...(location != null ? { location } : {}),
          ...(country != null ? { country } : {}),
          ...(ignoreInvalidURLs != null ? { ignoreInvalidURLs } : {}),
          ...(timeout != null ? { timeout } : {}),
          ...(highlights != null ? { highlights } : {}),
          ...(integration && (integration as string).trim()
            ? { integration: (integration as string).trim() }
            : {}),
          ...(origin ? { origin } : {}),
          ...(enterprise ? { enterprise } : {}),
          ...(threatProtection != null ? { threatProtection } : {}),
          ...(scrapeOptions ? { scrapeOptions } : {}),
        },
      },
    );
    const response = isRecord(payload) ? payload : {};
    if (!response.success) {
      const error = response.error || response.message;
      throw new Error(
        typeof error === "string" ? error : "Firecrawl search failed",
      );
    }
    const agentHints = response.agent_hints;
    return searchResponse(
      {
        ...(Array.isArray(agentHints) &&
        agentHints.every((hint) => typeof hint === "string")
          ? { agent_hints: [...agentHints] as string[] }
          : {}),
        ...(response.warning ? { warning: response.warning } : {}),
      },
      firstList(response.data).map((item) =>
        item && typeof item === "object" ? item : { url: item },
      ),
    );
  },
} satisfies SearchProvider<FirecrawlSearchSettings>;
