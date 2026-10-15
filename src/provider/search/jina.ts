import { isPlainObject as isRecord } from "es-toolkit/predicate";
import { apiJSON } from "../../shared/http";
import { providerOptions } from "../../shared/config";
import type { SearchProvider } from "./types";
import { urlParams } from "../utils";
import { searchCount, searchResponse } from "./utils";

type JinaOptions = { headers?: Record<string, string> };

export const jina: SearchProvider = {
  id: "jina",
  weight: 58,
  run: async (key, queries, signal, ctx) => {
    if (!key) throw new Error("jina API key is not configured for search");
    const { headers, ...options } = providerOptions<JinaOptions>(
      ctx,
      "jina",
      "search",
    );
    const endpoint = urlParams(new URL("https://s.jina.ai"), {
      num: searchCount(ctx, 20),
      ...options,
      q: queries[0],
    });
    const payload = await apiJSON(endpoint.toString(), signal, {
      headers: {
        Authorization: `Bearer ${key}`,
        "X-Respond-With": "no-content",
        ...headers,
      },
    });
    return searchResponse(
      payload,
      Array.isArray(payload)
        ? payload.flatMap((item) =>
            isRecord(item) && Array.isArray(item.data) ? item.data : [item],
          )
        : undefined,
    );
  },
};
