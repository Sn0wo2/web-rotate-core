import Exa from "exa-js";
import { providerOptions } from "../../shared/config";
import type { SearchProvider } from "./types";
import { mcpCall } from "../mcp";
import { sdkRequest } from "../utils";
import { searchCount, searchResponse } from "./utils";

type ExaSearchOptions = { contents?: Record<string, unknown> };

export const exa: SearchProvider = {
  id: "exa",
  weight: 73,
  keyless: true,
  run: async (key, queries, signal, ctx) => {
    if (!key) {
      const result = await mcpCall(
        "https://mcp.exa.ai/mcp",
        {},
        "web_search_exa",
        { query: queries[0], numResults: searchCount(ctx) },
        signal,
      );
      if (result.structuredContent != null)
        return searchResponse(result.structuredContent);
      const text = result.content.find((part) => part.type === "text")?.text;
      const blocks: Record<string, unknown>[] = [];
      for (const block of text?.split(/\n\n---\n\n/) ?? []) {
        const url = block.match(/^URL:\s*(.+)$/m)?.[1]?.trim();
        if (url)
          blocks.push({
            url,
            title: block.match(/^Title:\s*(.+)$/m)?.[1]?.trim(),
            content: block
              .match(/^(?:Highlights|Text):\s*([\s\S]*)$/m)?.[1]
              ?.trim(),
            publish_date: block.match(/^Published:\s*(.+)$/m)?.[1]?.trim(),
          });
      }
      return blocks.length
        ? searchResponse(blocks)
        : { results: [], ...(text ? { metadata: { text } } : {}) };
    }
    const options = providerOptions<ExaSearchOptions>(ctx, "exa", "search");
    const client = new Exa(key);
    const payload = await sdkRequest(signal, () =>
      client.search(queries[0], {
        type: "auto",
        ...options,
        numResults: searchCount(ctx),
        contents: {
          highlights: { maxCharacters: 1000 },
          ...options.contents,
        },
      }),
    );
    return searchResponse(payload);
  },
};
