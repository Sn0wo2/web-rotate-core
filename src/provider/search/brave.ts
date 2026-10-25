import get from "es-toolkit/compat/get";
import { isPlainObject as isRecord } from "es-toolkit/predicate";
import { z } from "zod";
import { apiJSON } from "../../shared/http";
import { stringValue } from "../../shared/config";
import type { SearchProvider } from "./types";
import { requireKey, urlParams } from "../utils";
import { clamp } from "es-toolkit/math";
import { searchResponse } from "./utils";

const settingsSchema = z.looseObject({ api: z.string().optional() });
type BraveSearchSettings = z.output<typeof settingsSchema>;

export const brave = {
  id: "brave",
  weight: 75,
  options: settingsSchema,
  run: async ({ settings, key, queries, signal, globals }) => {
    const token = requireKey("brave", key);
    const { api, ...rest } = settings;
    const payload = await apiJSON(
      (() => {
        if (api === "web") {
          const endpoint = urlParams(
            new URL("https://api.search.brave.com/res/v1/web/search"),
            { extra_snippets: true, ...rest },
          );
          endpoint.searchParams.set(
            "count",
            String(clamp(globals.searchResults, 1, 20)),
          );
          endpoint.searchParams.set("result_filter", "web");
          endpoint.searchParams.set("q", queries[0]);
          return endpoint.toString();
        }
        const endpoint = urlParams(
          new URL("https://api.search.brave.com/res/v1/llm/context"),
          {
            maximum_number_of_urls: clamp(globals.searchResults, 1, 50),
            maximum_number_of_tokens: 1024,
            maximum_number_of_tokens_per_url: 512,
            maximum_number_of_snippets: 16,
            maximum_number_of_snippets_per_url: 2,
            context_threshold_mode: "balanced",
            enable_source_metadata: false,
            ...rest,
          },
        );
        endpoint.searchParams.set(
          "count",
          String(clamp(globals.searchResults, 1, 50)),
        );
        endpoint.searchParams.set("q", queries[0]);
        return endpoint.toString();
      })(),
      signal,
      {
        headers: {
          Accept: "application/json",
          "X-Subscription-Token": token,
        },
      },
    );
    const grounding =
      isRecord(payload) && isRecord(payload.grounding)
        ? payload.grounding
        : undefined;
    return searchResponse(
      payload,
      grounding && Array.isArray(grounding.generic)
        ? grounding.generic.filter(isRecord).map((item) => {
            const sources =
              isRecord(payload) && isRecord(payload.sources)
                ? payload.sources
                : {};
            const meta = sources[stringValue(item.url) ?? ""];
            return {
              ...item,
              publish_date:
                stringValue(get(meta, "age.3")) ??
                stringValue(get(meta, "age.1")),
            };
          })
        : payload,
    );
  },
} satisfies SearchProvider<BraveSearchSettings>;
