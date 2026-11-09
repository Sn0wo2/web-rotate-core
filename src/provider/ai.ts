import type { generateText } from "ai"
import { camelCase } from "es-toolkit/string"
import { z } from "zod"
import { USER_AGENT } from "../shared/http"

export type ModelResult = Pick<
  Awaited<ReturnType<typeof generateText>>,
  "usage" | "finishReason" | "rawFinishReason" | "warnings" | "sources" | "toolResults"
> & {
  finalStep: Pick<Awaited<ReturnType<typeof generateText>>["finalStep"], "content" | "response" | "providerMetadata">
}

export const modelSettingsSchema = z.looseObject({
  model: z.string().optional(),
  baseUrl: z.url().optional(),
  instructions: z.string().optional(),
  max_output_tokens: z.number().int().positive().optional(),
  max_steps: z.number().int().min(1).max(10).optional(),
  temperature: z.number().optional(),
  top_p: z.number().optional(),
  providerOptions: z.record(z.string(), z.json()).optional(),
})

export async function modelCallOptions(settings: z.output<typeof modelSettingsSchema>) {
  const { isStepCount } = await import("ai")
  return {
    maxOutputTokens: settings.max_output_tokens ?? 2048,
    maxRetries: 0,
    stopWhen: isStepCount(settings.max_steps ?? 3),
    include: { responseBody: true },
    headers: { "User-Agent": USER_AGENT },
    ...(settings.temperature == null ? {} : { temperature: settings.temperature }),
    ...(settings.top_p == null ? {} : { topP: settings.top_p }),
  }
}

export function modelProviderOptions(settings: Record<string, unknown>) {
  return z.record(z.string(), z.json()).parse(
    Object.fromEntries(
      Object.entries(settings)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => [camelCase(key), value]),
    ),
  )
}

export function modelMetadata(result: Pick<ModelResult, "usage" | "finishReason" | "finalStep" | "warnings">) {
  return {
    usage: result.usage,
    finishReason: result.finishReason,
    model: result.finalStep.response.modelId,
    ...(result.finalStep.providerMetadata ? { providerMetadata: result.finalStep.providerMetadata } : {}),
    ...(result.warnings?.length ? { warnings: result.warnings } : {}),
  }
}
