import { isPlainObject as isRecord } from "es-toolkit/predicate";
import { Keenable } from "keenable";
import type { SearchProvider } from "./types";
import { sdkRequest } from "../utils";
import { searchCount, searchResponse } from "./utils";

export const keenable = {
  id: "keenable",
  weight: 60,
  keyless: true,
  run: async ({ settings, key, queries, signal, globals }) => {
    const response = await sdkRequest(signal, (requestSignal) =>
      new Keenable(
        key
          ? { apiKey: key, clientSource: "web-rotate-core" }
          : { clientSource: "web-rotate-core" },
      ).search(queries[0], {
        mode: "pro",
        snippetMaxLength: 1000,
        ...settings,
        signal: requestSignal,
      }),
    );
    return searchResponse(
      response.raw,
      (Array.isArray(response.raw.results)
        ? response.raw.results.filter(isRecord)
        : []
      ).slice(0, searchCount(globals, 50)),
    );
  },
} satisfies SearchProvider;
