import { ScrapflyClient, ScrapeConfig } from "scrapfly-sdk";
import { z } from "zod";
import { TARGET_USER_AGENT } from "../../shared/http";
import type { FetchProvider } from "./types";
import { requireKey, sdkRequest } from "../utils";
import { fetchOne, providerResult } from "./utils";

const settingsSchema = z.looseObject({
  cache: z.boolean().optional(),
  cache_ttl: z.number().optional(),
  headers: z.record(z.string(), z.string()).optional(),
  js_scenario: z
    .union([z.string(), z.record(z.string(), z.unknown())])
    .optional(),
  extraction_template: z.string().optional(),
  extraction_ephemeral_template: z.record(z.string(), z.unknown()).optional(),
  screenshots: z.record(z.string(), z.string()).optional(),
});
type ScrapflyFetchSettings = z.output<typeof settingsSchema>;

export const scrapfly = {
  id: "scrapfly",
  weight: 58,
  formats: ["html", "markdown", "text"],
  options: settingsSchema,
  run: fetchOne<ScrapflyFetchSettings>(
    async ({ settings, key, url, signal, format, globals }) => {
      const client = new ScrapflyClient({
        key: requireKey("scrapfly", key),
      });
      const result = await sdkRequest(signal, () =>
        client.scrape(
          new ScrapeConfig({
            url,
            render_js: true,
            asp: false,
            proxy_pool: "datacenter",
            format: format === "html" ? "raw" : format,
            ...settings,
            cache: globals.cacheWindowSeconds > 0,
            ...(globals.cacheWindowSeconds > 0
              ? { cache_ttl: globals.cacheWindowSeconds }
              : {}),
            headers: { "user-agent": TARGET_USER_AGENT, ...settings.headers },
          } as ConstructorParameters<typeof ScrapeConfig>[0]),
        ),
      );
      return providerResult(
        result instanceof Response ? undefined : result.result.content,
        format,
      );
    },
  ),
} satisfies FetchProvider<ScrapflyFetchSettings>;
