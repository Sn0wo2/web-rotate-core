import { compact } from "es-toolkit/array";
import Parallel from "parallel-web";
import { z } from "zod";
import { stringValue } from "../../shared/config";
import type { FetchProvider } from "./types";
import { mcpJSON, MCP_FETCH_TIMEOUT_MS } from "../mcp";
import { requireKey, sdkRequest } from "../utils";
import { fetchBatches, fetchPages } from "./utils";

const settingsSchema = z.looseObject({
  advanced_settings: z.record(z.string(), z.unknown()).optional(),
});
type ParallelFetchSettings = z.output<typeof settingsSchema>;

export const parallel = {
  id: "parallel",
  weight: 80,
  keyless: true,
  formats: ["markdown"],
  options: settingsSchema,
  run: async ({ settings, key, urls, signal, format, globals }) => {
    const content = (item: Record<string, unknown>) =>
      stringValue(item.raw_content) ??
      stringValue(item.full_content) ??
      (Array.isArray(item.excerpts)
        ? compact(item.excerpts.map(stringValue)).join("\n\n") || undefined
        : undefined);
    if (!key && !Object.keys(settings).length) {
      const session = crypto.randomUUID();
      return fetchBatches(urls, 3, globals, signal, async (batch) => {
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
    const { advanced_settings: advanced, ...rest } = settings;
    const client = new Parallel({ apiKey: requireKey("parallel", key) });
    return fetchBatches(urls, 20, globals, signal, async (batch) => {
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
} satisfies FetchProvider<ParallelFetchSettings>;
