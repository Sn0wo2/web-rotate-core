import { clamp } from "es-toolkit/math"
import { omit } from "es-toolkit/object"
import { isPlainObject as isRecord } from "es-toolkit/predicate"
import { z } from "zod"
import { modelCallOptions, modelProviderOptions, modelSettingsSchema } from "../ai"
import { requireKey, sdkRequest } from "../utils"
import type { SearchProvider } from "./types"
import { modelSearchResponse, searchInstructions } from "./utils"

const settingsSchema = modelSettingsSchema.extend({
  api: z.enum(["search", "answer"]).optional(),
  max_turns: z.number().int().positive().optional(),
  filters: z
    .object({
      allowed_domains: z.array(z.string()).max(5).optional(),
      excluded_domains: z.array(z.string()).max(5).optional(),
    })
    .refine((filters) => !(filters.allowed_domains && filters.excluded_domains), {
      message: "allowed_domains and excluded_domains cannot be used together",
    })
    .optional(),
  enable_image_understanding: z.boolean().optional(),
  enable_image_search: z.boolean().optional(),
})

export const grok = {
  id: "grok",
  weight: 54,
  options: settingsSchema,
  run: async ({ settings, key, queries, signal, globals }) => {
    const [{ createXai }, { generateText }] = await Promise.all([import("@ai-sdk/xai"), import("ai")])
    const client = createXai({
      apiKey: requireKey("grok", key),
      ...(settings.baseUrl ? { baseURL: settings.baseUrl } : {}),
      ...(settings.filters
        ? {
            fetch: Object.assign(
              (input: RequestInfo | URL, init?: RequestInit) => {
                const body: unknown = JSON.parse(String(init?.body))
                if (!(isRecord(body) && Array.isArray(body.tools))) throw new Error("Invalid xAI tool request")
                body.tools = body.tools.map((tool) =>
                  isRecord(tool) && tool.type === "web_search"
                    ? { ...omit(tool, ["allowed_domains", "excluded_domains"]), filters: settings.filters }
                    : tool,
                )
                return fetch(input, { ...init, body: JSON.stringify(body) })
              },
              { preconnect: fetch.preconnect },
            ),
          }
        : {}),
    })
    const callOptions = await modelCallOptions(settings)
    const result = await sdkRequest(signal, (abortSignal) =>
      generateText({
        ...callOptions,
        model: client.responses(settings.model?.trim() || "grok-4.7"),
        system: searchInstructions(settings, clamp(globals.searchResults, 1, 100)),
        prompt: queries[0],
        tools: {
          web_search: client.tools.webSearch({
            ...(settings.filters?.allowed_domains ? { allowedDomains: settings.filters.allowed_domains } : {}),
            ...(settings.filters?.excluded_domains ? { excludedDomains: settings.filters.excluded_domains } : {}),
            ...(settings.enable_image_understanding == null
              ? {}
              : { enableImageUnderstanding: settings.enable_image_understanding }),
            ...(settings.enable_image_search == null ? {} : { enableImageSearch: settings.enable_image_search }),
          }),
        },
        toolChoice: "required",
        providerOptions: {
          xai: {
            ...modelProviderOptions(omit(settings, Object.keys(settingsSchema.shape))),
            ...settings.providerOptions,
            maxTurns: settings.max_turns ?? settings.providerOptions?.maxTurns ?? 3,
            store: false,
            include: ["web_search_call.action.sources"],
          },
        },
        abortSignal,
      }),
    )
    return modelSearchResponse(result)
  },
} satisfies SearchProvider<z.output<typeof settingsSchema>>
