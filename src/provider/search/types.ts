import type { RotateContext, URLList } from "../../shared/types";
import type { Provider } from "../types";

export type SearchResult = {
  url: string;
  title?: string;
  content?: string;
  snippets?: string[];
  published?: number;
  updated?: number;
  provider?: string;
  queries?: string[];
  metadata?: Record<string, unknown>;
};

export type SearchResponse = {
  results: SearchResult[];
  answer?: string;
  citations?: { url: string; title?: string; start?: number; end?: number }[];
  metadata?: Record<string, unknown>;
};

export type SearchOutcome = {
  results: SearchResult[];
  responses: (Omit<SearchResponse, "results"> & {
    provider: string;
    queries: string[];
  })[];
  errors?: { query: string; error: string }[];
};

export type SearchProvider = Provider & {
  batchSize?: number;
  run: (
    key: string | undefined,
    queries: URLList,
    signal: AbortSignal,
    ctx: RotateContext,
  ) => Promise<SearchResponse>;
};
