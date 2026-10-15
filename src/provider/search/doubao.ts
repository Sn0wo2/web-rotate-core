import { isPlainObject as isRecord } from "es-toolkit/predicate";
import { providerOptions, stringValue } from "../../shared/config";
import type { SearchProvider } from "./types";
import { bearer } from "../utils";
import { restSearch, searchCount } from "./utils";

export const doubao: SearchProvider = {
  id: "doubao",
  weight: 54,
  run: restSearch(
    "https://open.feedcoopapi.com/search_api/web_search",
    (queries, ctx) => ({
      SearchType: "web",
      NeedSummary: true,
      ...providerOptions(ctx, "doubao", "search"),
      Query: queries[0],
      Count: searchCount(ctx),
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
};
