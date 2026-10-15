import get from "es-toolkit/compat/get";
import { LinkupClient } from "linkup-sdk";
import { stringValue } from "../../shared/config";
import type { FetchProvider } from "./types";
import { requireKey, sdkRequest } from "../utils";
import { fetchOne, providerResult } from "./utils";

export const linkup = {
  id: "linkup",
  weight: 64,
  formats: ["markdown"],
  run: fetchOne<Record<string, unknown>>(
    async ({ settings, key, url, signal }) => {
      const client = new LinkupClient({
        apiKey: requireKey("linkup", key),
      });
      const response = await sdkRequest(signal, () =>
        client.fetch({
          url,
          ...settings,
        }),
      );
      return providerResult(
        stringValue(get(response, "content")) ?? stringValue(response.markdown),
        "markdown",
      );
    },
  ),
} satisfies FetchProvider;
