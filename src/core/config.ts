import type { RotateContext } from "./types";
import { isPlainObject } from "es-toolkit/predicate";

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

export function providerOptions(
  ctx: RotateContext,
  id: string,
  capability: "search" | "fetch",
): Record<string, unknown> {
  const name = `${id}${capability === "search" ? "Search" : "Fetch"}Options`;
  const value = ctx.getOption(name);
  if (value == null) return {};
  if (!isPlainObject(value)) {
    throw new RotateConfigError(`${name} must be an object`);
  }
  return value;
}
