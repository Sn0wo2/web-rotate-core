import { createOpenAI } from "@ai-sdk/openai"
import { generateText } from "ai"
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
  reasoning: z.object({ effort: z.string().optional(), summary: z.string().optional() }).optional(),
  search_context_size: z.enum(["low", "medium", "high"]).optional(),
  filters: z
    .object({
      allowed_domains: z.array(z.string()).max(100).optional(),
      blocked_domains: z.array(z.string()).max(100).optional(),
    })
    .optional(),
  user_location: z
    .object({
      type: z.literal("approximate").optional(),
      country: z.string().optional(),
      city: z.string().optional(),
      region: z.string().optional(),
      timezone: z.string().optional(),
    })
    .optional(),
  external_web_access: z.boolean().optional(),
  return_token_budget: z.enum(["default", "unlimited"]).optional(),
})

export const openai = {
  id: "openai",
  weight: 74,
  options: settingsSchema,
  run: async ({ settings, key, queries, signal, globals }) => {
    const { filters, user_location, reasoning, return_token_budget } = settings
    const client = createOpenAI({
      apiKey: requireKey("openai", key),
      ...(settings.baseUrl ? { baseURL: settings.baseUrl } : {}),
      ...(return_token_budget
        ? {
            fetch: Object.assign(
              (input: RequestInfo | URL, init?: RequestInit) => {
                const body: unknown = JSON.parse(String(init?.body))
                if (!(isRecord(body) && Array.isArray(body.tools))) throw new Error("invalid OpenAI SDK search request")
                body.tools = body.tools.map((tool) =>
                  isRecord(tool) && tool.type === "web_search" ? { ...tool, return_token_budget } : tool,
                )
                return fetch(input, { ...init, body: JSON.stringify(body) })
              },
              { preconnect: fetch.preconnect },
            ),
          }
        : {}),
    })
    const selectedModel = settings.model?.trim() || "gpt-5-mini"
    const result = await sdkRequest(signal, (abortSignal) =>
      generateText({
        ...modelCallOptions(settings),
        model: client.responses(selectedModel),
        system: searchInstructions(settings, clamp(globals.searchResults, 1, 100)),
        prompt: queries[0],
        tools: {
          web_search: client.tools.webSearch({
            searchContextSize: settings.search_context_size ?? "medium",
            ...(filters
              ? {
                  filters: {
                    ...(filters.allowed_domains ? { allowedDomains: filters.allowed_domains } : {}),
                    ...(filters.blocked_domains ? { blockedDomains: filters.blocked_domains } : {}),
                  },
                }
              : {}),
            ...(user_location
              ? {
                  userLocation: {
                    type: "approximate",
                    ...(user_location.country ? { country: user_location.country } : {}),
                    ...(user_location.city ? { city: user_location.city } : {}),
                    ...(user_location.region ? { region: user_location.region } : {}),
                    ...(user_location.timezone ? { timezone: user_location.timezone } : {}),
                  },
                }
              : {}),
            ...(settings.external_web_access == null ? {} : { externalWebAccess: settings.external_web_access }),
          }),
        },
        toolChoice: "required",
        providerOptions: {
          openai: {
            maxToolCalls: 1,
            store: false,
            ...(reasoning
              ? {
                  ...(reasoning.effort ? { reasoningEffort: reasoning.effort } : {}),
                  ...(reasoning.summary ? { reasoningSummary: reasoning.summary } : {}),
                }
              : selectedModel === "gpt-5-mini"
                ? { reasoningEffort: "low" }
                : {}),
            ...modelProviderOptions(omit(settings, Object.keys(settingsSchema.shape))),
            ...settings.providerOptions,
            includeWebSearchSources: true,
          },
        },
        abortSignal,
      }),
    )
    return modelSearchResponse(result)
  },
} satisfies SearchProvider<z.output<typeof settingsSchema>>
