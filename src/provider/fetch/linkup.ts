import get from "es-toolkit/compat/get";
import { LinkupClient } from "linkup-sdk";
import { providerOptions, stringValue } from "../../shared/config";
import type { FetchProvider } from "./types";
import { requireKey, sdkRequest } from "../utils";
import { fetchOne, providerResult } from "./utils";

export const linkup: FetchProvider = {
  id: "linkup",
  weight: 64,
  formats: ["markdown"],
  run: fetchOne(async (key, url, signal, ctx) => {
    const client = new LinkupClient({
      apiKey: requireKey("linkup", key),
    });
    const response = await sdkRequest(signal, () =>
      client.fetch({
        url,
        ...providerOptions(ctx, "linkup", "fetch"),
      }),
    );
    return providerResult(
      stringValue(get(response, "content")) ?? stringValue(response.markdown),
      "markdown",
    );
  }),
};
