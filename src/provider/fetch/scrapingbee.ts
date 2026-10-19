import { checkedResponseText, timedSignal } from "../../shared/http";
import type { FetchProvider } from "./types";
import { requireKey, scrapingbeeURL } from "../utils";
import { fetchOne, providerResult } from "./utils";

export const scrapingbee = {
  id: "scrapingbee",
  weight: 63,
  formats: ["html", "markdown", "text"],
  run: fetchOne<Record<string, unknown>>(
    async ({ settings, key, url, signal, format }) => {
      const params: Record<string, unknown> = {
        forward_headers_pure: true,
        render_js: true,
        ...settings,
        ...(format === "markdown"
          ? { return_page_markdown: true }
          : format === "text"
            ? { return_page_text: true }
            : {}),
        url,
      };
      delete params.cookies;
      const endpoint = scrapingbeeURL("/api/v1/", params);
      const response = await fetch(endpoint, {
        headers: {
          Accept: "application/json, text/plain, */*",
          Authorization: `Bearer ${requireKey("scrapingbee", key)}`,
          "User-Agent": "ScrapingBee-Node/2.0.0",
        },
        signal: timedSignal(signal),
        redirect: "error",
      });
      const content = await checkedResponseText(response, "scrapingbee");
      const metadata = Object.fromEntries(
        [...response.headers].filter(([name]) => name.startsWith("spb-")),
      );
      return providerResult(content, format, metadata);
    },
  ),
} satisfies FetchProvider;
