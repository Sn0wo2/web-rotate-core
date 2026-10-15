import { ScrapflyClient, ScrapeConfig } from "scrapfly-sdk";
import { providerOptions } from "../../shared/config";
import { TARGET_USER_AGENT } from "../../shared/http";
import type { FetchProvider } from "./types";
import { requireKey, sdkRequest } from "../utils";
import { fetchOne, providerResult } from "./utils";

type ScrapflyFetchOptions = {
  headers?: Record<string, string>;
  js_scenario?: string | Record<string, unknown>;
  extraction_template?: string;
  extraction_ephemeral_template?: Record<string, unknown>;
  screenshots?: Record<string, string>;
};

export const scrapfly: FetchProvider = {
  id: "scrapfly",
  weight: 58,
  formats: ["html", "markdown", "text"],
  run: fetchOne(async (key, url, signal, ctx, format) => {
    const options = providerOptions<ScrapflyFetchOptions>(
      ctx,
      "scrapfly",
      "fetch",
    );
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
          ...options,
          headers: { "user-agent": TARGET_USER_AGENT, ...options.headers },
        } as ConstructorParameters<typeof ScrapeConfig>[0]),
      ),
    );
    return providerResult(
      result instanceof Response ? undefined : result.result.content,
      format,
    );
  }),
};
