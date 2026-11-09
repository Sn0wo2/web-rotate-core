import { z } from "zod"
import { modelCallOptions, modelMetadata, modelProviderOptions, modelSettingsSchema } from "../ai"
import { requireKey, sdkRequest } from "../utils"
import type { FetchProvider } from "./types"
import { fetchOne, normalizeFetchURL, providerResult } from "./utils"

const settingsSchema = modelSettingsSchema
  .extend({
    max_uses: z.number().int().positive().optional(),
    allowed_domains: z.array(z.string()).optional(),
    blocked_domains: z.array(z.string()).optional(),
    citations: z.boolean().optional(),
    max_content_tokens: z.number().int().positive().optional(),
    use_cache: z.boolean().optional(),
  })
  .refine((settings) => !(settings.allowed_domains && settings.blocked_domains), {
    message: "allowed_domains and blocked_domains cannot be used together",
  })

export const claude = {
  id: "claude",
  weight: 55,
  formats: ["text"],
  options: settingsSchema,
  run: fetchOne(async ({ settings, key, url, signal, globals }) => {
    const requestedURL = normalizeFetchURL(url)
    if (!requestedURL) throw new Error("web fetch requires a valid HTTP(S) URL")
    const [{ createAnthropic }, { generateText }] = await Promise.all([import("@ai-sdk/anthropic"), import("ai")])
    const anthropic = createAnthropic({
      apiKey: requireKey("claude", key),
      ...(settings.baseUrl ? { baseURL: settings.baseUrl } : {}),
    })
    const callOptions = await modelCallOptions(settings)
    const result = await sdkRequest(signal, (abortSignal) =>
      generateText({
        ...callOptions,
        model: anthropic(settings.model?.trim() || "claude-sonnet-4-6"),
        system:
          settings.instructions?.trim() ||
          "Fetch the requested URL. Do not summarize or paraphrase its content; retrieve the page source.",
        prompt: `Fetch this exact URL and do not return a summary: ${url}`,
        tools: {
          web_fetch: anthropic.tools.webFetch_20260318({
            maxUses: settings.max_uses ?? 1,
            ...(settings.allowed_domains ? { allowedDomains: settings.allowed_domains } : {}),
            ...(settings.blocked_domains ? { blockedDomains: settings.blocked_domains } : {}),
            citations: { enabled: settings.citations ?? true },
            ...(settings.max_content_tokens ? { maxContentTokens: settings.max_content_tokens } : {}),
            useCache: settings.use_cache ?? globals.cacheWindowSeconds > 0,
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
    const output = result.staticToolResults.find(
      (toolResult) => toolResult.toolName === "web_fetch" && normalizeFetchURL(toolResult.input.url) === requestedURL,
    )?.output
    if (!output) throw new Error("web fetch returned no valid result for the requested URL")
    const source = output.content.source
    if (source.type !== "text") throw new Error("PDF web fetch results are not supported")
    const finalURL = normalizeFetchURL(output.url)
    if (!finalURL) throw new Error("web fetch returned an invalid final URL")
    return {
      ...providerResult(source.data, "text", {
        ...modelMetadata(result),
        ...(output.retrievedAt ? { retrievedAt: output.retrievedAt } : {}),
      }),
      ...(output.content.title ? { title: output.content.title } : {}),
      finalURL,
    }
  }),
} satisfies FetchProvider<z.output<typeof settingsSchema>>
