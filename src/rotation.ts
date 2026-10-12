import type { RotateContext } from "./util";
import { timedSignal } from "./http";
import { configuredEnvironmentValue } from "./util";

export type RotationState = {
  cursor: number;
  failures: Map<string, number>;
};

export function expandProviderRoutes<
  T extends {
    id: string;
    keyless?: boolean | undefined;
    keylessEnabled?: ((ctx: RotateContext) => boolean) | undefined;
    keyEnv?: readonly string[] | undefined;
  },
>(
  providers: readonly T[],
  ctx: RotateContext,
): { provider: T; key: string | undefined; index: number }[] {
  const groups = providers.map((provider) => {
    const configuredKeys = ctx.getOption(`${provider.id}Keys`);
    let keys = (
      Array.isArray(configuredKeys) ? configuredKeys : [configuredKeys]
    ).flatMap((value) =>
      (typeof value === "string" ? value : "").split(/[\s,;]+/).filter(Boolean),
    );
    if (!keys.length) {
      for (const environmentName of provider.keyEnv ?? [
        `${provider.id.toUpperCase()}_API_KEY`,
      ]) {
        const multiple = (
          configuredEnvironmentValue(ctx, `${environmentName}S`) ?? ""
        )
          .split(/[\s,;]+/)
          .filter(Boolean);
        if (multiple.length) {
          keys = multiple;
          break;
        }
        const single = configuredEnvironmentValue(ctx, environmentName);
        if (single) {
          keys = [single];
          break;
        }
      }
    }
    return (
      keys.length
        ? keys
        : provider.keyless && (provider.keylessEnabled?.(ctx) ?? true)
          ? [undefined]
          : []
    ).map((key, index) => ({ provider, key, index }));
  });
  const values: { provider: T; key: string | undefined; index: number }[] = [];
  let longest = 0;
  for (const group of groups) longest = Math.max(longest, group.length);
  for (let index = 0; index < longest; index++) {
    for (const group of groups) {
      const value = group[index];
      if (value !== undefined) values.push(value);
    }
  }
  return values;
}

export function resolveMaxAttempts(
  ctx: RotateContext,
  environmentName: string,
  routes: number,
): number {
  const value = Number(
    ctx.getOption("maxAttempts") ??
      configuredEnvironmentValue(ctx, environmentName),
  );
  const attempts = Number.isFinite(value) && value > 0 ? value : routes;
  return Math.max(1, Math.min(Math.floor(attempts), routes));
}

export function orderedCandidates<T>(
  pool: readonly T[],
  mode: string,
  state: RotationState,
  id: (value: T) => string,
  provider: (value: T) => string,
  isExplicitMode: (mode: string) => boolean,
  weight: (value: T) => number = () => 0,
): T[] {
  if (!pool.length) return [];
  const ready = pool.filter(
    (value) => (state.failures.get(id(value)) ?? 0) <= Date.now(),
  );
  const available = ready.length ? ready : pool;
  let selected = available;
  if (isExplicitMode(mode)) {
    selected = available.filter((value) => provider(value) === mode);
    if (!selected.length) return [];
  }
  const ranked = [...selected].sort((a, b) => weight(b) - weight(a));
  const start =
    mode === "random"
      ? Math.floor(Math.random() * ranked.length)
      : state.cursor++ % ranked.length;
  return [...ranked.slice(start), ...ranked.slice(0, start)];
}

export async function attemptRoutes<T, Result>(
  routes: readonly T[],
  maxAttempts: number,
  state: RotationState,
  id: (route: T) => string,
  signal: AbortSignal,
  timeoutMs: number,
  run: (route: T, signal: AbortSignal) => Promise<Result>,
): Promise<Result> {
  const selected = routes.slice(0, maxAttempts);
  let lastError: unknown;
  for (const route of selected) {
    try {
      const result = await run(route, timedSignal(signal, timeoutMs));
      state.failures.delete(id(route));
      return result;
    } catch (error) {
      if (signal.aborted) throw error;
      state.failures.set(id(route), Date.now() + 60_000);
      lastError = error;
    }
  }
  throw new Error(
    `all ${selected.length} attempt(s) failed. Last error: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}
