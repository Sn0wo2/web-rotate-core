import { compact } from "es-toolkit/array";
import Parallel from "parallel-web";
import { providerOptions, stringValue } from "../../shared/config";
import type { FetchProvider } from "./types";
import { mcpJSON, MCP_FETCH_TIMEOUT_MS } from "../mcp";
import { requireKey, sdkRequest } from "../utils";
import { fetchBatches, fetchPages } from "./utils";

type ParallelFetchOptions = { advanced_settings?: Record<string, unknown> };

export const parallel: FetchProvider = {
  id: "parallel",
  weight: 80,
  keyless: true,
  formats: ["markdown"],
  run: async (key, urls, signal, ctx, format) => {
    const options = providerOptions<ParallelFetchOptions>(
      ctx,
      "parallel",
      "fetch",
    );
    const content = (item: Record<string, unknown>) =>
      stringValue(item.raw_content) ??
      stringValue(item.full_content) ??
      (Array.isArray(item.excerpts)
        ? compact(item.excerpts.map(stringValue)).join("\n\n") || undefined
        : undefined);
    if (!key && !Object.keys(options).length) {
      const session = crypto.randomUUID();
      return fetchBatches(urls, 3, ctx, signal, async (batch) => {
        const payload = await mcpJSON(
          "https://search.parallel.ai/mcp",
          {},
          "web_fetch",
          { urls: batch, full_content: true, session_id: session },
          signal,
          MCP_FETCH_TIMEOUT_MS,
        );
        return fetchPages(batch, payload, content, format);
      });
    }
    const { advanced_settings: advanced, ...rest } = options;
    const client = new Parallel({ apiKey: requireKey("parallel", key) });
    return fetchBatches(urls, 20, ctx, signal, async (batch) => {
      const payload = await sdkRequest(signal, (requestSignal) =>
        client.extract(
          {
            ...rest,
            urls: batch,
            advanced_settings: {
              full_content: true,
              ...advanced,
            },
          },
          { signal: requestSignal },
        ),
      );
      return fetchPages(batch, payload, content, format);
    });
  },
};
