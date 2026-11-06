export type LRUCacheOptions = {
  enabled?: boolean | undefined
  cap?: number | undefined
}

export type LRUCacheSetOptions = {
  ttlSeconds?: number | undefined
}

type LRUEntry<V> = {
  value: V
  expiresAt: number | undefined
}

export class LRUCache<V = unknown> {
  enabled: boolean
  cap: number
  #entries = new Map<string, LRUEntry<V>>()

  constructor({ enabled = true, cap = 0 }: LRUCacheOptions = {}) {
    this.enabled = enabled
    this.cap = Math.max(0, Math.trunc(cap))
  }

  get size(): number {
    return this.#entries.size
  }

  get<T = V>(key: string): T | undefined {
    return this.#lookup(key, true)
  }

  peek<T = V>(key: string): T | undefined {
    return this.#lookup(key, false)
  }

  has(key: string): boolean {
    return this.#lookup(key, false) !== undefined
  }

  set(key: string, value: V, { ttlSeconds }: LRUCacheSetOptions = {}): void {
    if (!this.enabled) return
    const expiresAt = ttlSeconds !== undefined && ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : undefined
    this.#entries.delete(key)
    this.#entries.set(key, { value, expiresAt })
    while (this.cap > 0 && this.#entries.size > this.cap) {
      const oldest = this.#entries.keys().next()
      if (oldest.done) break
      this.#entries.delete(oldest.value)
    }
  }

  delete(key: string): void {
    this.#entries.delete(key)
  }

  clear(): void {
    this.#entries.clear()
  }

  #lookup<T>(key: string, refresh: boolean): T | undefined {
    if (!this.enabled) return undefined
    const entry = this.#entries.get(key)
    if (!entry) return undefined
    if (entry.expiresAt !== undefined && entry.expiresAt <= Date.now()) {
      this.#entries.delete(key)
      return undefined
    }
    if (refresh) {
      this.#entries.delete(key)
      this.#entries.set(key, entry)
    }
    return entry.value as unknown as T
  }
}
