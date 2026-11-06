import { createAnthropic } from "@ai-sdk/anthropic"
import { generateText } from "ai"
import { clamp } from "es-toolkit/math"
import { z } from "zod"
import { modelCallOptions, modelProviderOptions, modelSettingsSchema } from "../ai"
import { requireKey, sdkRequest } from "../utils"
import type { SearchProvider } from "./types"
import { modelSearchResponse, searchInstructions } from "./utils"

const settingsSchema = modelSettingsSchema
  .extend({
    api: z.enum(["search", "answer"]).optional(),
    max_uses: z.number().int().positive().optional(),
    allowed_domains: z.array(z.string()).optional(),
    blocked_domains: z.array(z.string()).optional(),
    user_location: z
      .object({
        city: z.string().optional(),
        region: z.string().optional(),
        country: z.string().optional(),
        timezone: z.string().optional(),
      })
      .optional(),
  })
  .refine((settings) => !(settings.allowed_domains && settings.blocked_domains), {
    message: "allowed_domains and blocked_domains cannot be used together",
  })

export const claude = {
  id: "claude",
  weight: 54,
  options: settingsSchema,
  run: async ({ settings, key, queries, signal, globals }) => {
    const anthropic = createAnthropic({
      apiKey: requireKey("claude", key),
      ...(settings.baseUrl ? { baseURL: settings.baseUrl } : {}),
    })
    const result = await sdkRequest(signal, (abortSignal) =>
      generateText({
        ...modelCallOptions(settings),
        model: anthropic(settings.model?.trim() || "claude-sonnet-4-6"),
        system: searchInstructions(settings, clamp(globals.searchResults, 1, 100)),
        prompt: queries[0],
        tools: {
          web_search: anthropic.tools.webSearch_20260318({
            maxUses: settings.max_uses ?? 3,
            ...(settings.allowed_domains ? { allowedDomains: settings.allowed_domains } : {}),
            ...(settings.blocked_domains ? { blockedDomains: settings.blocked_domains } : {}),
            ...(settings.user_location
              ? {
                  userLocation: {
                    type: "approximate",
                    ...(settings.user_location.city === undefined ? {} : { city: settings.user_location.city }),
                    ...(settings.user_location.region === undefined ? {} : { region: settings.user_location.region }),
                    ...(settings.user_location.country === undefined
                      ? {}
                      : { country: settings.user_location.country }),
                    ...(settings.user_location.timezone === undefined
                      ? {}
                      : { timezone: settings.user_location.timezone }),
                  },
                }
              : {}),
            responseInclusion: "full",
          }),
        },
        toolChoice: "required",
        ...(settings.providerOptions
          ? { providerOptions: { anthropic: modelProviderOptions(settings.providerOptions) } }
          : {}),
        abortSignal,
      }),
    )
    return modelSearchResponse(result)
  },
} satisfies SearchProvider<z.output<typeof settingsSchema>>
