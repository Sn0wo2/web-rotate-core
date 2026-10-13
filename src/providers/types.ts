import type {
  FetchFormat,
  FetchPage,
  RotateContext,
  SearchQueries,
  SearchResponse,
  URLList,
} from "../core/types";

export type Provider = {
  id: string;
  keyEnv?: readonly string[] | undefined;
  search?: {
    weight: number;
    batchSize?: number;
    keyless?: boolean | undefined;
    keylessEnabled?: ((ctx: RotateContext) => boolean) | undefined;
    run: (
      key: string | undefined,
      queries: SearchQueries,
      signal: AbortSignal,
      ctx: RotateContext,
    ) => Promise<SearchResponse>;
  };
  fetch?: {
    weight: number;
    formats: readonly FetchFormat[];
    keyless?: boolean | undefined;
    run: (
      key: string | undefined,
      urls: URLList,
      signal: AbortSignal,
      ctx: RotateContext,
      format: FetchFormat,
    ) => Promise<FetchPage[]>;
  };
};
