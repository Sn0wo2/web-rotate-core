import type { RotateContext, URLList } from "../../shared/types";
import type { Provider } from "../types";

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

export type FetchOutcome =
  | { type: "image"; url: string; mime: string; base64: string }
  | { type: "pages"; pages: FetchPage[] };

export type FetchProvider = Provider & {
  formats: readonly FetchFormat[];
  run: (
    key: string | undefined,
    urls: URLList,
    signal: AbortSignal,
    ctx: RotateContext,
    format: FetchFormat,
  ) => Promise<FetchPage[]>;
};
