import OpenAI from "openai";
import type { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";
import { isPlainObject as isRecord } from "es-toolkit/predicate";
import { providerOptions, stringValue } from "../../shared/config";
import type { SearchProvider, SearchResponse, SearchResult } from "./types";
import { requireKey } from "../utils";
import { searchCount, searchResponse } from "./utils";

type OpenAISearchOptions = {
  model?: string;
  instructions?: string;
  max_output_tokens?: number;
  reasoning?: Record<string, unknown>;
  search_context_size?: "low" | "medium" | "high";
  filters?: Record<string, unknown>;
  user_location?: Record<string, unknown>;
  external_web_access?: boolean;
  return_token_budget?: number;
};

export const openai: SearchProvider = {
  id: "openai",
  weight: 66,
  run: async (key, queries, signal, ctx) => {
    const {
      model,
      instructions,
      max_output_tokens,
      reasoning,
      search_context_size,
      filters,
      user_location,
      external_web_access,
      return_token_budget,
      ...rest
    } = providerOptions<OpenAISearchOptions>(ctx, "openai", "search");
    const selectedModel = model?.trim() || "gpt-5-mini";
    const client = new OpenAI({ apiKey: requireKey("openai", key) });
    const payload = await client.responses.create(
      {
        model: selectedModel,
        instructions:
          instructions?.trim() ||
          `Search the web. Return at most ${searchCount(ctx)} concise factual snippets, one per line with an inline citation. Do not write a long-form answer.`,
        max_output_tokens: max_output_tokens ?? 2048,
        ...(reasoning
          ? { reasoning }
          : selectedModel === "gpt-5-mini"
            ? { reasoning: { effort: "low" } }
            : {}),
        max_tool_calls: 1,
        store: false,
        ...rest,
        tool_choice: "required",
        include: ["web_search_call.action.sources"],
        tools: [
          {
            type: "web_search",
            search_context_size: search_context_size ?? "medium",
            ...(filters ? { filters } : {}),
            ...(user_location ? { user_location } : {}),
            ...(external_web_access != null ? { external_web_access } : {}),
            ...(return_token_budget != null ? { return_token_budget } : {}),
          },
        ],
        input: queries[0],
      } as ResponseCreateParamsNonStreaming,
      { signal },
    );
    const output: unknown[] =
      isRecord(payload) && Array.isArray(payload.output) ? payload.output : [];
    let answer = "";
    const citations: NonNullable<SearchResponse["citations"]> = [];
    const results = new Map<string, SearchResult>();
    for (const item of output) {
      if (
        !isRecord(item) ||
        item.type !== "message" ||
        !Array.isArray(item.content)
      )
        continue;
      for (const part of item.content) {
        if (!isRecord(part) || typeof part.text !== "string") continue;
        answer = answer ? `${answer}\n${part.text}` : part.text;
        for (const annotation of Array.isArray(part.annotations)
          ? part.annotations
          : []) {
          if (!isRecord(annotation) || annotation.type !== "url_citation")
            continue;
          const url = stringValue(annotation.url);
          if (!url) continue;
          const title = stringValue(annotation.title);
          citations.push({
            url,
            ...(title ? { title } : {}),
            ...(typeof annotation.start_index === "number"
              ? { start: annotation.start_index }
              : {}),
            ...(typeof annotation.end_index === "number"
              ? { end: annotation.end_index }
              : {}),
          });
          const existing = results.get(url);
          if (!existing) results.set(url, title ? { url, title } : { url });
          else if (title && !existing.title)
            results.set(url, { ...existing, title });
        }
      }
    }
    for (const item of output) {
      if (!isRecord(item) || item.type !== "web_search_call") continue;
      const action = isRecord(item.action) ? item.action : undefined;
      for (const source of Array.isArray(action?.sources)
        ? action.sources
        : []) {
        const url = stringValue(isRecord(source) ? source.url : undefined);
        if (url && !results.has(url)) results.set(url, { url });
      }
    }
    return {
      ...searchResponse(payload, [...results.values()], answer || undefined),
      ...(citations.length ? { citations } : {}),
    };
  },
};
