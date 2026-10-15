import type { Globals } from "../../shared/config";
import type { URLList } from "../../shared/types";
import type { Provider, ProviderEntry, SettingsOf } from "../types";

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

export type FetchProvider<Settings = Record<string, unknown>> =
  Provider<Settings> & {
    formats: readonly FetchFormat[];
    run(input: {
      settings: Settings;
      key: string | undefined;
      urls: URLList;
      signal: AbortSignal;
      format: FetchFormat;
      globals: Globals;
    }): Promise<FetchPage[]>;
  };

export type FetchProviderConfigBase<P extends readonly FetchProvider[]> = {
  [K in P[number]["id"]]+?: ProviderEntry<
    SettingsOf<Extract<P[number], { id: K }>>
  >;
};
