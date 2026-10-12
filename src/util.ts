import { isPlainObject as isRecord } from "es-toolkit/predicate";
import get from "es-toolkit/compat/get";

export type FetchFormat = "text" | "markdown" | "html";
export type FetchPage = { url: string; content?: string; error?: string };
export type URLList = [string, ...string[]];
export type SearchQueries = [string, ...string[]];

export type RotateContext = {
  getOption(name: string): unknown;
  getEnv(name: string): string | undefined;
};

export class RotateConfigError extends Error {
  constructor(
    message: string,
    readonly code: "configuration" | "unsupported-mode" = "configuration",
  ) {
    super(message);
  }
}

export function stringValue(value: unknown): string | undefined {
  const text = typeof value === "string" ? value.trim() : "";
  return text || undefined;
}

export function configuredEnvironmentValue(
  ctx: RotateContext,
  name: string,
): string | undefined {
  return stringValue(ctx.getOption(name)) ?? stringValue(ctx.getEnv(name));
}

export function configuredString(
  ctx: RotateContext,
  optionNames: readonly string[],
  environmentNames: readonly string[] = [],
): string | undefined {
  for (const name of optionNames) {
    const value = stringValue(ctx.getOption(name));
    if (value) return value;
  }
  for (const name of environmentNames) {
    const value = configuredEnvironmentValue(ctx, name);
    if (value) return value;
  }
  return undefined;
}

export function pickPath(
  payload: unknown,
  ...paths: (string | number)[]
): unknown {
  if (!paths.length) return payload;
  return get(payload as object | null | undefined, paths as never) ?? undefined;
}

export function firstList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (isRecord(payload)) {
    for (const key of ["results", "data", "web"]) {
      if (Array.isArray(payload[key])) return payload[key];
    }
  }
  return [];
}

export function providerResult(content: unknown): { content: string } {
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("provider returned empty content");
  }
  return { content };
}

export function assertHTTPURL(value: string, label = "URL"): void {
  const parsed = new URL(value);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`${label}: only http and https URLs are supported`);
  }
  if (parsed.username || parsed.password) {
    throw new Error(`${label}: URL credentials are not supported`);
  }
}
