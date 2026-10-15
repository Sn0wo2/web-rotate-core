import { isPlainObject as isRecord } from "es-toolkit/predicate";
import { Keenable } from "keenable";
import { providerOptions } from "../../shared/config";
import type { SearchProvider } from "./types";
import { sdkRequest } from "../utils";
import { searchCount, searchResponse } from "./utils";

export const keenable: SearchProvider = {
  id: "keenable",
  weight: 60,
  keyless: true,
  run: async (key, queries, signal, ctx) => {
    const response = await sdkRequest(signal, (requestSignal) =>
      new Keenable(
        key
          ? { apiKey: key, clientSource: "web-rotate-core" }
          : { clientSource: "web-rotate-core" },
      ).search(queries[0], {
        mode: "pro",
        snippetMaxLength: 1000,
        ...providerOptions(ctx, "keenable", "search"),
        signal: requestSignal,
      }),
    );
    return searchResponse(
      response.raw,
      (Array.isArray(response.raw.results)
        ? response.raw.results.filter(isRecord)
        : []
      ).slice(0, searchCount(ctx, 50)),
    );
  },
};
