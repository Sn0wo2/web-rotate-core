import Exa from "exa-js";
import { z } from "zod";
import { stringValue } from "../../shared/config";
import type { FetchProvider } from "./types";
import { requireKey, sdkRequest } from "../utils";
import { fetchPages } from "./utils";

const settingsSchema = z.looseObject({
  text: z.record(z.string(), z.unknown()).optional(),
});
type ExaFetchSettings = z.output<typeof settingsSchema>;

export const exa = {
  id: "exa",
  weight: 77,
  formats: ["markdown"],
  options: settingsSchema,
  run: async ({ settings, key, urls, signal, format, globals }) => {
    const client = new Exa(requireKey("exa", key));
    const payload = await sdkRequest(signal, () =>
      client.getContents(urls, {
        ...settings,
        maxAgeHours: Math.floor(globals.cacheWindowSeconds / 3600),
        text: { ...settings.text },
      }),
    );
    return fetchPages(
      urls,
      payload.results,
      (item) => stringValue(item.text),
      format,
    );
  },
} satisfies FetchProvider<ExaFetchSettings>;
