import get from "es-toolkit/compat/get";
import { Hyperbrowser } from "@hyperbrowser/sdk";
import { z } from "zod";
import { stringValue } from "../../shared/config";
import type { FetchProvider } from "./types";
import { requireKey, sdkRequest } from "../utils";
import { fetchOne, providerResult } from "./utils";

const settingsSchema = z.looseObject({
  outputs: z.record(z.string(), z.unknown()).optional(),
});
type HyperbrowserFetchSettings = z.output<typeof settingsSchema>;

export const hyperbrowser = {
  id: "hyperbrowser",
  weight: 56,
  formats: ["html", "markdown"],
  options: settingsSchema,
  run: fetchOne<HyperbrowserFetchSettings>(
    async ({ settings, key, url, signal, format }) => {
      const client = new Hyperbrowser({
        apiKey: requireKey("hyperbrowser", key),
      });
      const payload = await sdkRequest(signal, () =>
        client.web.fetch({
          ...settings,
          url,
          outputs: {
            ...settings.outputs,
            formats: [format as "html" | "markdown"],
          },
        }),
      );
      return providerResult(
        stringValue(get(payload, ["data", format])),
        format,
      );
    },
  ),
} satisfies FetchProvider<HyperbrowserFetchSettings>;
