import type { z } from "zod";
import type { Globals } from "../shared/config";

export type Provider<Settings = Record<string, unknown>> = {
  id: string;
  weight: number;
  keyless?: boolean | undefined;
  keylessEnabled?(settings: Settings, globals: Globals): boolean | undefined;
  options?: z.ZodType<Settings> | undefined;
};

export type SettingsOf<P> = P extends { run: infer R }
  ? R extends (input: infer I) => unknown
    ? I extends { settings: infer S }
      ? S
      : Record<string, unknown>
    : Record<string, unknown>
  : Record<string, unknown>;

export type ProviderEntry<Settings = Record<string, unknown>> = {
  keys?: string | readonly string[] | undefined;
  weight?: number | undefined;
} & Settings;

export type ProviderRoute<P extends Provider<unknown>> = P & {
  key: string | undefined;
  settings: Record<string, unknown>;
};
