import pMap from "p-map"

export function mapConcurrent<T, R>(
  items: readonly T[],
  run: (item: T, index: number) => Promise<R>,
  concurrency = 4,
  signal?: AbortSignal,
): Promise<R[]> {
  return pMap(items, run, {
    concurrency: Math.max(1, Math.floor(concurrency)),
    signal,
  })
}
