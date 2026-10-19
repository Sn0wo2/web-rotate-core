import { isPlainObject as isRecord } from "es-toolkit/predicate";
import {
  checkedResponseText,
  timedSignal,
  USER_AGENT,
} from "../../shared/http";
import type { SearchProvider } from "./types";
import { requireKey, scrapingbeeURL } from "../utils";
import { searchResponse } from "./utils";

export const scrapingbee = {
  id: "scrapingbee",
  weight: 48,
  run: async ({ settings, key, queries, signal }) => {
    const endpoint = scrapingbeeURL("/api/v1/store/google", {
      search: queries[0],
      ...settings,
    });
    const response = await fetch(endpoint, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${requireKey("scrapingbee", key)}`,
        "User-Agent": USER_AGENT,
      },
      signal: timedSignal(signal),
      redirect: "error",
    });
    const body = await checkedResponseText(response, "scrapingbee");
    let payload: unknown;
    try {
      payload = JSON.parse(body);
    } catch {
      throw new Error("scrapingbee returned invalid JSON");
    }
    const result = searchResponse(
      payload,
      isRecord(payload) && Array.isArray(payload.organic_results)
        ? payload.organic_results
        : payload,
    );
    const metadata = Object.fromEntries(
      [...response.headers].filter(([name]) => name.startsWith("spb-")),
    );
    return Object.keys(metadata).length
      ? { ...result, metadata: { ...result.metadata, ...metadata } }
      : result;
  },
} satisfies SearchProvider;
