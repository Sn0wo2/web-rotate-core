import { ApifyClient } from "apify-client";
import { providerOptions, stringValue } from "../../shared/config";
import type { FetchProvider } from "./types";
import { requireKey, sdkRequest } from "../utils";

type ApifyFetchOptions = { actorId?: string };

export const apify: FetchProvider = {
  id: "apify",
  weight: 65,
  formats: ["html", "markdown", "text"],
  run: async (key, urls, signal, ctx, format) => {
    const { actorId, ...options } = providerOptions<ApifyFetchOptions>(
      ctx,
      "apify",
      "fetch",
    );
    const client = new ApifyClient({ token: requireKey("apify", key) });
    const run = await sdkRequest(
      signal,
      () =>
        client.actor(actorId?.trim() || "apify~website-content-crawler").call({
          crawlerType: "playwright:firefox",
          maxCrawlPages: urls.length,
          maxCrawlDepth: 0,
          maxRequestRetries: 3,
          removeCookieWarnings: true,
          ...(format === "markdown" ? { saveMarkdown: true } : {}),
          ...(format === "html" ? { saveHtml: true } : {}),
          proxyConfiguration: { useApifyProxy: true },
          ...options,
          startUrls: urls.map((url) => ({ url })),
        }),
      300_000,
    );
    const { items } = await sdkRequest(
      signal,
      () =>
        client
          .dataset(run.defaultDatasetId)
          .listItems({ limit: urls.length * 2 }),
      300_000,
    );
    const dataset = new Map<string, Record<string, unknown>>();
    for (const row of items) {
      const itemURL = stringValue(row.url);
      if (!itemURL) continue;
      dataset.set(itemURL, row);
      const trimmed = itemURL.replace(/\/+$/, "");
      if (trimmed && !dataset.has(trimmed)) dataset.set(trimmed, row);
    }
    return urls.map((url) => {
      const item = dataset.get(url) ?? dataset.get(url.replace(/\/+$/, ""));
      if (!item) return { url, error: "no dataset item matched the URL" };
      for (const name of (
        {
          html: ["html", "text", "markdown"],
          text: ["text", "markdown", "html"],
          markdown: ["markdown", "text", "html"],
        } as const
      )[format]) {
        const value = stringValue(item[name]);
        if (value) return { url, content: value, format: name };
      }
      return { url, error: stringValue(item.error) ?? "empty content" };
    });
  },
};
