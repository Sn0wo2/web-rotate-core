import { configuredEnvironmentValue } from "./config";
import type { RotateContext } from "./types";

export function requestConcurrency(
  ctx: RotateContext,
  capability: "search" | "fetch",
) {
  const value = Number(
    ctx.getOption("concurrency") ??
      configuredEnvironmentValue(
        ctx,
        `WEB${capability.toUpperCase()}_CONCURRENCY`,
      ),
  );
  return Number.isFinite(value) && value > 0
    ? Math.min(16, Math.max(1, Math.floor(value)))
    : 4;
}

export async function mapConcurrent<T, R>(
  items: readonly T[],
  run: (item: T, index: number) => Promise<R>,
  concurrency = 4,
  signal?: AbortSignal,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let index = 0;
  let failed = false;
  await Promise.all(
    Array.from(
      { length: Math.min(items.length, Math.max(1, Math.floor(concurrency))) },
      async () => {
        while (!failed && index < items.length) {
          signal?.throwIfAborted();
          const current = index++;
          try {
            results[current] = await run(items[current]!, current);
          } catch (error) {
            failed = true;
            throw error;
          }
        }
      },
    ),
  );
  return results;
}
