import { isPlainObject as isRecord } from "es-toolkit/predicate";
import { z } from "zod";
import { apiJSON } from "../../shared/http";
import { stringValue } from "../../shared/config";
import type { SearchProvider } from "./types";
import { requireKey } from "../utils";
import { searchCount, searchResponse } from "./utils";

const BASE_URL = "https://open.bigmodel.cn/api/paas/v4";

const settingsSchema = z.looseObject({
  baseUrl: z.string().optional(),
});
type ZhipuSearchSettings = z.output<typeof settingsSchema>;

export const zhipu = {
  id: "zhipu",
  weight: 60,
  options: settingsSchema,
  run: async ({ settings, key, queries, signal, globals }) => {
    const { baseUrl: configuredBaseUrl, ...options } = settings;
    const baseUrl = stringValue(configuredBaseUrl) ?? BASE_URL;
    const international = new URL(baseUrl).hostname === "api.z.ai";
    const body: Record<string, unknown> = {
      search_engine: international ? "search-prime" : "search_std",
      ...(!international ? { search_intent: false } : {}),
      ...options,
      search_query: queries[0],
      count: searchCount(globals, 50),
    };
    if (international) delete body.search_intent;

    const payload = await apiJSON(
      `${baseUrl.replace(/\/+$/, "")}/web_search`,
      signal,
      {
        label: "zhipu web search",
        body,
        key: requireKey("zhipu", key),
      },
    );
    const results =
      isRecord(payload) && Array.isArray(payload.search_result)
        ? payload.search_result
        : [];
    return searchResponse(payload, results);
  },
} satisfies SearchProvider<ZhipuSearchSettings>;
