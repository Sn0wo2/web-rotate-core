import { isPlainObject as isRecord } from "es-toolkit/predicate";
import { stringValue } from "../../shared/config";
import { apiJSON, TARGET_USER_AGENT } from "../../shared/http";
import type { FetchProvider } from "./types";
import { mcpCall, MCP_FETCH_TIMEOUT_MS } from "../mcp";
import { fetchOne, providerResult } from "./utils";

export const firecrawl = {
  id: "firecrawl",
  weight: 63,
  keyless: true,
  formats: ["html", "markdown"],
  run: fetchOne<Record<string, unknown>>(
    async ({ settings, key, url, signal, format, globals }) => {
      const providerFormat = format === "html" ? "rawHtml" : "markdown";
      const data = (payload: unknown): Record<string, unknown> =>
        isRecord(payload) && isRecord(payload.data) ? payload.data : {};
      if (key && !Object.keys(settings).length) {
        const result = await mcpCall(
          "https://mcp.firecrawl.dev/v2/mcp",
          { Authorization: `Bearer ${key}` },
          "firecrawl_scrape",
          {
            url,
            formats: [providerFormat],
            onlyMainContent: providerFormat === "markdown",
            maxAge: globals.cacheWindowSeconds * 1000,
          },
          signal,
          MCP_FETCH_TIMEOUT_MS,
        );
        const text =
          result.content.find((part) => part.type === "text")?.text ?? "";
        let content: string | undefined;
        try {
          const item = data(result.structuredContent ?? JSON.parse(text));
          content = stringValue(
            providerFormat === "rawHtml"
              ? (item.rawHtml ?? item.html)
              : item.markdown,
          );
        } catch {}
        return providerResult(
          content ?? text,
          providerFormat === "rawHtml" ? "html" : "markdown",
        );
      }
      const {
        autoResume: _autoResume,
        domainTools,
        ...scrapeSettings
      } = settings;
      const response = await apiJSON(
        "https://api.firecrawl.dev/v2/scrape",
        signal,
        {
          key,
          body: {
            url: url.trim(),
            onlyMainContent: providerFormat === "markdown",
            headers: { "User-Agent": TARGET_USER_AGENT },
            ...scrapeSettings,
            ...(domainTools ? { domainTools } : {}),
            maxAge: globals.cacheWindowSeconds * 1000,
            formats: [providerFormat],
          },
        },
      );
      const payload = isRecord(response) ? response : {};
      if (!payload.success)
        throw new Error(
          stringValue(payload.error) ??
            stringValue(payload.message) ??
            "Firecrawl scrape failed",
        );
      const document = data(payload);
      return providerResult(
        stringValue(
          providerFormat === "rawHtml"
            ? (document.rawHtml ?? document.html)
            : document.markdown,
        ),
        providerFormat === "rawHtml" ? "html" : "markdown",
      );
    },
  ),
} satisfies FetchProvider;
