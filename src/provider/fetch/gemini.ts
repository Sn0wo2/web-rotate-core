import get from "es-toolkit/compat/get"
import { isPlainObject as isRecord } from "es-toolkit/predicate"
import type { z } from "zod"
import { modelCallOptions, modelMetadata, modelProviderOptions, modelSettingsSchema } from "../ai"
import { requireKey, sdkRequest } from "../utils"
import type { FetchProvider } from "./types"
import { fetchOne, normalizeFetchURL, providerResult } from "./utils"

export const gemini = {
  id: "gemini",
  weight: 55,
  formats: ["markdown", "text"],
  options: modelSettingsSchema,
  run: fetchOne(async ({ settings, key, url, signal, format }) => {
    const requestedURL = normalizeFetchURL(url)
    if (!requestedURL) throw new Error("web fetch requires a valid HTTP(S) URL")
    const [{ createGoogleGenerativeAI }, { generateText }] = await Promise.all([import("@ai-sdk/google"), import("ai")])
    const google = createGoogleGenerativeAI({
      apiKey: requireKey("gemini", key),
      ...(settings.baseUrl ? { baseURL: settings.baseUrl } : {}),
    })
    const callOptions = await modelCallOptions({ ...settings, max_output_tokens: settings.max_output_tokens ?? 8192 })
    const result = await sdkRequest(signal, (abortSignal) =>
      generateText({
        ...callOptions,
        model: google(settings.model?.trim() || "gemini-2.5-flash"),
        system: [
          settings.instructions?.trim(),
          `Retrieve the requested page and reproduce its available content as native ${format} without summarizing, paraphrasing, or adding commentary. Preserve the page's structure and wording as faithfully as possible.`,
        ]
          .filter(Boolean)
          .join("\n\n"),
        prompt: `Retrieve and extract the page content from this URL: ${url}. Return it as ${format}.`,
        tools: { url_context: google.tools.urlContext({}) },
        ...(settings.providerOptions
          ? { providerOptions: { google: modelProviderOptions(settings.providerOptions) } }
          : {}),
        abortSignal,
      }),
    )
    if (result.finishReason !== "stop")
      throw new Error(`URL context generation did not complete: ${result.finishReason}`)
    const retrievals: unknown = get(result.finalStep.providerMetadata, "google.urlContextMetadata.urlMetadata")
    if (
      !(
        Array.isArray(retrievals) &&
        retrievals.some(
          (retrieval: unknown) =>
            isRecord(retrieval) &&
            retrieval.urlRetrievalStatus === "URL_RETRIEVAL_STATUS_SUCCESS" &&
            typeof retrieval.retrievedUrl === "string" &&
            normalizeFetchURL(retrieval.retrievedUrl) === requestedURL,
        )
      )
    )
      throw new Error("URL context did not successfully retrieve the requested URL")
    return providerResult(result.finalStep.text, format, { ...modelMetadata(result), modelGenerated: true })
  }),
} satisfies FetchProvider<z.output<typeof modelSettingsSchema>>
