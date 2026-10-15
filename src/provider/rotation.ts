import { compact, orderBy, uniq, zip } from "es-toolkit/array";
import { z } from "zod";
import { RotateConfigError, stringList } from "../shared/config";
import type { Globals } from "../shared/config";
import type { Provider, ProviderEntry, ProviderRoute } from "./types";

export type ParsedEntry = {
  keys: (string | undefined)[];
  settings: Record<string, unknown>;
  weight: number;
};

export function resolveProviderEntries<P extends Provider<unknown>>(
  providers: readonly P[],
  config: Readonly<Record<string, ProviderEntry>> | undefined,
  label: string,
): Map<string, ParsedEntry> {
  const byID = new Map(providers.map((provider) => [provider.id, provider]));
  const slots =
    config ??
    Object.fromEntries(
      providers.map((provider) => [provider.id, {} as ProviderEntry]),
    );
  const entries = new Map<string, ParsedEntry>();
  for (const [id, entry] of Object.entries(slots)) {
    const provider = byID.get(id);
    if (!provider)
      throw new RotateConfigError(
        `${label} provider "${id}" is not registered`,
        "unsupported-provider",
      );
    const { keys, weight, ...settings } = entry;
    let resolved: Record<string, unknown> = settings;
    if (provider.options) {
      const parsed = provider.options.safeParse(settings);
      if (!parsed.success)
        throw new RotateConfigError(
          `invalid settings for ${label} provider "${id}": ${z.prettifyError(parsed.error)}`,
        );
      resolved = parsed.data as Record<string, unknown>;
    }
    entries.set(id, {
      keys: uniq(stringList(keys)),
      settings: resolved,
      weight: weight ?? provider.weight,
    });
  }
  return entries;
}

export function providerRoutes<P extends Provider<unknown>>(
  providers: readonly P[],
  entries: ReadonlyMap<string, ParsedEntry>,
  globals: Globals,
): ProviderRoute<P>[] {
  const groups = providers
    .filter((provider) => entries.has(provider.id))
    .map((provider) => {
      const entry = entries.get(provider.id)!;
      const keyed = uniq(entry.keys);
      const keyless =
        provider.keyless &&
        (provider.keylessEnabled?.(entry.settings, globals) ?? true)
          ? [undefined]
          : [];
      return (
        globals.prefer === "keyless"
          ? [...keyless, ...keyed]
          : [...keyed, ...keyless]
      ).map((key, index) => ({
        ...provider,
        key,
        settings: entry.settings,
        weight: entry.weight,
        routeID: `${provider.id}[${index}]`,
      }));
    });
  return compact(zip(...groups).flat());
}

export function selectRoutes<P extends Provider<unknown>>(
  pool: readonly ProviderRoute<P>[],
  failures: ReadonlyMap<string, number>,
): ProviderRoute<P>[] {
  const now = Date.now();
  const ready = pool.filter(
    (route) => (failures.get(route.routeID) ?? 0) <= now,
  );
  return orderBy(ready.length ? ready : pool, ["weight"], ["desc"]);
}

export function resolveMaxAttempts(globals: Globals, routes: number): number {
  return Math.max(1, Math.min(globals.maxAttempts, routes));
}
