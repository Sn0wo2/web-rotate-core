import { isPlainObject as isRecord } from "es-toolkit/predicate";
import { apiJSON } from "../../shared/http";
import { providerOptions, stringValue } from "../../shared/config";
import type { SearchProvider } from "./types";
import { requireKey } from "../utils";
import { searchResponse } from "./utils";

type BrightdataOptions = { zone?: string };

export const brightdata: SearchProvider = {
  id: "brightdata",
  weight: 50,
  run: async (key, queries, signal, ctx) => {
    const { zone, ...options } = providerOptions<BrightdataOptions>(
      ctx,
      "brightdata",
      "search",
    );
    if (!zone?.trim())
      throw new Error("brightdata SERP zone is not configured");
    const searchURL = new URL("https://www.google.com/search");
    searchURL.searchParams.set("q", queries[0]);
    searchURL.searchParams.set("brd_json", "1");
    const payload = await apiJSON(
      "https://api.brightdata.com/request",
      signal,
      {
        headers: { Authorization: `Bearer ${requireKey("brightdata", key)}` },
        body: {
          ...options,
          zone,
          url: searchURL.toString(),
          format: "json",
        },
      },
    );
    let source = payload;
    if (isRecord(source) && typeof source.body === "string") {
      try {
        source = JSON.parse(source.body);
      } catch {}
    }
    return searchResponse(
      payload,
      !isRecord(source) || !Array.isArray(source.organic)
        ? []
        : source.organic.filter(isRecord).map((item) => ({
            url: stringValue(item.link) ?? stringValue(item.url),
            title: stringValue(item.title),
            description:
              stringValue(item.desc) ??
              stringValue(item.description) ??
              stringValue(item.snippet),
          })),
    );
  },
};
