import { clamp } from "es-toolkit/math";
import pMap from "p-map";
import type { Globals } from "./config";

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function requestConcurrency(globals: Globals) {
  return clamp(globals.concurrency, 1, 16);
}

export function mapConcurrent<T, R>(
  items: readonly T[],
  run: (item: T, index: number) => Promise<R>,
  concurrency = 4,
  signal?: AbortSignal,
): Promise<R[]> {
  return pMap(items, run, {
    concurrency: Math.max(1, Math.floor(concurrency)),
    signal,
  });
}
