import { clamp } from "es-toolkit/math"
import Exa from "exa-js"
import { z } from "zod"
import { mcpCall } from "../mcp"
import { sdkRequest } from "../utils"
import type { SearchProvider } from "./types"
import { searchResponse } from "./utils"

const settingsSchema = z.looseObject({
  contents: z.record(z.string(), z.unknown()).optional(),
})
type ExaSearchSettings = z.output<typeof settingsSchema>
const MCP_RESULT_SEPARATOR = /\n\n---\n\n/
const URL_LINE = /^URL:\s*(.+)$/m
const TITLE_LINE = /^Title:\s*(.+)$/m
const CONTENT_LINE = /^(?:Highlights|Text):\s*([\s\S]*)$/m
const PUBLISHED_LINE = /^Published:\s*(.+)$/m

export const exa = {
  id: "exa",
  weight: 73,
  keyless: true,
  options: settingsSchema,
  run: async ({ settings, key, queries, signal, globals }) => {
    if (!key) {
      const result = await mcpCall(
        "https://mcp.exa.ai/mcp",
        {},
        "web_search_exa",
        { query: queries[0], numResults: clamp(globals.searchResults, 1, 100) },
        signal,
      )
      if (result.structuredContent != null) return searchResponse(result.structuredContent)
      const text = result.content.find((part) => part.type === "text")?.text
      const blocks: Record<string, unknown>[] = []
      for (const block of text?.split(MCP_RESULT_SEPARATOR) ?? []) {
        const url = block.match(URL_LINE)?.[1]?.trim()
        if (url)
          blocks.push({
            url,
            title: block.match(TITLE_LINE)?.[1]?.trim(),
            content: block.match(CONTENT_LINE)?.[1]?.trim(),
            publish_date: block.match(PUBLISHED_LINE)?.[1]?.trim(),
          })
      }
      return blocks.length ? searchResponse(blocks) : { results: [], ...(text ? { metadata: { text } } : {}) }
    }
    const client = new Exa(key)
    const payload = await sdkRequest(signal, () =>
      client.search(queries[0], {
        type: "auto",
        ...settings,
        numResults: clamp(globals.searchResults, 1, 100),
        contents: {
          highlights: { maxCharacters: 1000 },
          ...settings.contents,
          maxAgeHours: Math.floor(globals.cacheWindowSeconds / 3600),
        },
      }),
    )
    return searchResponse(payload)
  },
} satisfies SearchProvider<ExaSearchSettings>
