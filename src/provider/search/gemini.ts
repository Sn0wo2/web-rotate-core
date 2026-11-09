import { clamp } from "es-toolkit/math"
import { z } from "zod"
import { modelCallOptions, modelProviderOptions, modelSettingsSchema } from "../ai"
import { requireKey, sdkRequest } from "../utils"
import type { SearchProvider } from "./types"
import { modelSearchResponse, searchInstructions } from "./utils"

const settingsSchema = modelSettingsSchema.extend({
  api: z.enum(["search", "answer"]).optional(),
  google_search: z
    .looseObject({
      searchTypes: z
        .object({
          webSearch: z.object({}).optional(),
          imageSearch: z.object({}).optional(),
        })
        .optional(),
      timeRangeFilter: z
        .object({
          startTime: z.string(),
          endTime: z.string(),
        })
        .optional(),
    })
    .optional(),
  url_context: z.boolean().optional(),
})

export const gemini = {
  id: "gemini",
  weight: 54,
  options: settingsSchema,
  run: async ({ settings, key, queries, signal, globals }) => {
    const [{ createGoogleGenerativeAI }, { generateText }] = await Promise.all([import("@ai-sdk/google"), import("ai")])
    const google = createGoogleGenerativeAI({
      apiKey: requireKey("gemini", key),
      ...(settings.baseUrl ? { baseURL: settings.baseUrl } : {}),
    })
    const callOptions = await modelCallOptions(settings)
    const result = await sdkRequest(signal, (abortSignal) =>
      generateText({
        ...callOptions,
        model: google(settings.model?.trim() || "gemini-2.5-flash"),
        system: searchInstructions(settings, clamp(globals.searchResults, 1, 100)),
        prompt: queries[0],
        tools: {
          google_search: google.tools.googleSearch(settings.google_search ?? {}),
          ...(settings.url_context ? { url_context: google.tools.urlContext({}) } : {}),
        },
        ...(settings.providerOptions
          ? { providerOptions: { google: modelProviderOptions(settings.providerOptions) } }
          : {}),
        abortSignal,
      }),
    )
    return modelSearchResponse(result)
  },
} satisfies SearchProvider<z.output<typeof settingsSchema>>
