import Exa from "exa-js";
import { providerOptions, stringValue } from "../../shared/config";
import type { FetchProvider } from "./types";
import { requireKey, sdkRequest } from "../utils";
import { fetchPages } from "./utils";

type ExaFetchOptions = { text?: Record<string, unknown> };

export const exa: FetchProvider = {
  id: "exa",
  weight: 77,
  formats: ["markdown"],
  run: async (key, urls, signal, ctx, format) => {
    const options = providerOptions<ExaFetchOptions>(ctx, "exa", "fetch");
    const client = new Exa(requireKey("exa", key));
    const payload = await sdkRequest(signal, () =>
      client.getContents(urls, {
        maxAgeHours: 0,
        ...options,
        text: { ...options.text },
      }),
    );
    return fetchPages(
      urls,
      payload.results,
      (item) => stringValue(item.text),
      format,
    );
  },
};
