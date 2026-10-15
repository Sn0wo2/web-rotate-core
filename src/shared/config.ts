import { z } from "zod";
import { isPlainObject } from "es-toolkit/predicate";
import type { RotateContext } from "./types";

export class RotateConfigError extends Error {
  constructor(
    message: string,
    readonly code: "configuration" | "unsupported-mode" = "configuration",
  ) {
    super(message);
    this.name = "RotateConfigError";
  }
}

export function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value.trim() || undefined : undefined;
}

export type ProviderName = "auto" | "native" | (string & {});
export type CleanupMode = "none" | "defuddle";
export type PreferRoutes = "keyed" | "keyless";

export type RotateOptions = {
  mode?: ProviderName;
  webfetchCleanup?: CleanupMode;
  prefer?: PreferRoutes;
  concurrency?: number;
  maxAttempts?: number;
  searchResults?: number;
  provider?: string | readonly string[];
};

// 每个字段解析失败（含缺失/类型不对）都静默回退默认值，语义与旧的手写 OPTION_PARSERS 一致
const optionsSchema = z.object({
  mode: z.string().trim().min(1).catch("auto"),
  webfetchCleanup: z.enum(["none", "defuddle"]).catch("none"),
  prefer: z.enum(["keyed", "keyless"]).catch("keyless"),
  concurrency: z.coerce
    .number()
    .transform(Math.trunc)
    .pipe(z.number().positive())
    .catch(4),
  maxAttempts: z.coerce
    .number()
    .transform(Math.trunc)
    .pipe(z.number().positive())
    .catch(3),
  searchResults: z.coerce
    .number()
    .transform(Math.trunc)
    .pipe(z.number().positive())
    .catch(8),
});

export type ResolvedOptions = z.output<typeof optionsSchema>;

export const DEFAULT_OPTIONS: ResolvedOptions = optionsSchema.parse({});

export function options(ctx: RotateContext): ResolvedOptions {
  return optionsSchema.parse({
    mode: ctx.getOption("mode"),
    webfetchCleanup: ctx.getOption("webfetchCleanup"),
    prefer: ctx.getOption("prefer"),
    concurrency: ctx.getOption("concurrency"),
    maxAttempts: ctx.getOption("maxAttempts"),
    searchResults: ctx.getOption("searchResults"),
  });
}

export function option<K extends keyof ResolvedOptions>(
  ctx: RotateContext,
  name: K,
): ResolvedOptions[K] {
  return options(ctx)[name];
}

export function stringList(value: unknown): string[] {
  return (Array.isArray(value) ? value : [value]).flatMap((item) =>
    typeof item === "string" ? item.split(/[\s,;]+/).filter(Boolean) : [],
  );
}

export function providerOptions<T extends object = Record<string, unknown>>(
  ctx: RotateContext,
  id: string,
  capability: "search" | "fetch",
): T {
  const name = `${id}${capability === "search" ? "Search" : "Fetch"}Options`;
  const value = ctx.getOption(name);
  if (value == null) return {} as T;
  if (!isPlainObject(value)) {
    throw new RotateConfigError(`${name} must be an object`);
  }
  return value as T;
}
