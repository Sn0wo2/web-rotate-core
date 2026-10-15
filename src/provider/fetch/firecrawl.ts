import { isPlainObject as isRecord } from "es-toolkit/predicate";
import Firecrawl from "@mendable/firecrawl-js";
import { providerOptions, stringValue } from "../../shared/config";
import { TARGET_USER_AGENT } from "../../shared/http";
import type { FetchProvider } from "./types";
import { mcpCall, MCP_FETCH_TIMEOUT_MS } from "../mcp";
import { sdkRequest } from "../utils";
import { fetchOne, providerResult } from "./utils";

export const firecrawl: FetchProvider = {
  id: "firecrawl",
  weight: 63,
  keyless: true,
  formats: ["html", "markdown"],
  run: fetchOne(async (key, url, signal, ctx, format) => {
    const options = providerOptions(ctx, "firecrawl", "fetch");
    const providerFormat = format === "html" ? "rawHtml" : "markdown";
    const data = (payload: unknown): Record<string, unknown> =>
      isRecord(payload) && isRecord(payload.data) ? payload.data : {};
    if (key && !Object.keys(options).length) {
      const result = await mcpCall(
        "https://mcp.firecrawl.dev/v2/mcp",
        { Authorization: `Bearer ${key}` },
        "firecrawl_scrape",
        {
          url,
          formats: [providerFormat],
          onlyMainContent: providerFormat === "markdown",
          maxAge: 172_800_000,
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
    const client = new Firecrawl(key ? { apiKey: key } : {});
    const document = await sdkRequest(signal, () =>
      client.scrape(url, {
        maxAge: 172_800_000,
        onlyMainContent: providerFormat === "markdown",
        headers: { "User-Agent": TARGET_USER_AGENT },
        ...options,
        formats: [providerFormat],
      }),
    );
    return providerResult(
      stringValue(
        providerFormat === "rawHtml"
          ? (document.rawHtml ?? document.html)
          : document.markdown,
      ),
      providerFormat === "rawHtml" ? "html" : "markdown",
    );
  }),
};
