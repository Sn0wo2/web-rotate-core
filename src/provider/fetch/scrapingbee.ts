import { ScrapingBeeClient } from "scrapingbee";
import type { FetchProvider } from "./types";
import { requireKey, sdkRequest } from "../utils";
import { fetchOne, providerResult } from "./utils";

export const scrapingbee = {
  id: "scrapingbee",
  weight: 63,
  formats: ["html", "markdown", "text"],
  run: fetchOne<Record<string, unknown>>(
    async ({ settings, key, url, signal, format }) => {
      const client = new ScrapingBeeClient(requireKey("scrapingbee", key));
      const response = await sdkRequest(signal, () =>
        client.htmlApi({
          url,
          params: {
            forward_headers_pure: true,
            render_js: true,
            ...settings,
            ...(format === "markdown"
              ? { return_page_markdown: true }
              : format === "text"
                ? { return_page_text: true }
                : {}),
          },
        }),
      );
      return providerResult(
        typeof response.data === "string" ? response.data : undefined,
        format,
      );
    },
  ),
} satisfies FetchProvider;
