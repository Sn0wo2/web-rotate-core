import { apiJSON } from "../../shared/http";
import { providerOptions } from "../../shared/config";
import type { SearchProvider } from "./types";
import { requireKey } from "../utils";
import { searchCount, searchResponse } from "./utils";

export const diffbot: SearchProvider = {
  id: "diffbot",
  weight: 50,
  batchSize: 5,
  run: async (key, queries, signal, ctx) => {
    const payload = await apiJSON(
      "https://llm.diffbot.com/api/v1/web_search",
      signal,
      {
        label: "diffbot",
        body: {
          maxTokens: 2000,
          ...providerOptions(ctx, "diffbot", "search"),
          text: queries,
          size: searchCount(ctx),
        },
        headers: { Authorization: `Bearer ${requireKey("diffbot", key)}` },
      },
    );
    return searchResponse(payload);
  },
};
