export type FetchFormat = "text" | "markdown" | "html";
export type FetchPage = {
  url: string;
  content?: string;
  error?: string;
  format?: FetchFormat;
  title?: string;
  finalURL?: string;
  provider?: string;
  metadata?: Record<string, unknown>;
};
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
export type URLList = [string, ...string[]];
export type SearchQueries = URLList;

export type RotateContext = {
  getOption(name: string): unknown;
  getEnv(name: string): string | undefined;
};
