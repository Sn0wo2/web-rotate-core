import { ScrapingBeeClient } from "scrapingbee";
import { providerOptions } from "../../shared/config";
import type { FetchProvider } from "./types";
import { requireKey, sdkRequest } from "../utils";
import { fetchOne, providerResult } from "./utils";

export const scrapingbee: FetchProvider = {
  id: "scrapingbee",
  weight: 63,
  formats: ["html", "markdown", "text"],
  run: fetchOne(async (key, url, signal, ctx, format) => {
    const client = new ScrapingBeeClient(requireKey("scrapingbee", key));
    const response = await sdkRequest(signal, () =>
      client.htmlApi({
        url,
        params: {
          forward_headers_pure: true,
          render_js: true,
          ...providerOptions(ctx, "scrapingbee", "fetch"),
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
  }),
};
