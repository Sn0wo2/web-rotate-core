import { isPlainObject as isRecord } from "es-toolkit/predicate";
import { stringValue } from "../../shared/config";
import type { SearchProvider } from "./types";
import { bearer } from "../utils";
import { restSearch, searchCount } from "./utils";

export const doubao = {
  id: "doubao",
  weight: 54,
  run: restSearch<Record<string, unknown>>(
    "https://open.feedcoopapi.com/search_api/web_search",
    ({ settings, queries, globals }) => ({
      SearchType: "web",
      NeedSummary: true,
      ...settings,
      Query: queries[0],
      Count: searchCount(globals),
    }),
    bearer,
    (payload) => {
      const result = isRecord(payload) ? payload.Result : undefined;
      const rows = isRecord(result) ? result.WebResults : undefined;
      return (Array.isArray(rows) ? rows : []).filter(isRecord).map((item) => ({
        url: stringValue(item.Url),
        title: stringValue(item.Title),
        snippet: stringValue(item.Snippet) ?? stringValue(item.Summary),
      }));
    },
  ),
} satisfies SearchProvider;
