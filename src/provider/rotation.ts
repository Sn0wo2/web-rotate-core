import { option, stringList } from "../shared/config";
import type { RotateContext } from "../shared/types";
import { compact, orderBy, uniq, uniqBy, zip } from "es-toolkit/array";
import type { Provider } from "./types";

export function orderedProviderRoutes<T extends Provider>(
  providers: readonly T[],
  ctx: RotateContext,
  modes: readonly string[],
  failures: ReadonlyMap<string, number>,
) {
  const groups = providers.map((provider) => {
    const keys = stringList(ctx.getOption(`${provider.id}Keys`));
    const keyless =
      provider.keyless && (provider.keylessEnabled?.(ctx) ?? true)
        ? [undefined]
        : [];
    const keyed = uniq(keys);
    return (
      option(ctx, "prefer") === "keyless"
        ? [...keyless, ...keyed]
        : [...keyed, ...keyless]
    ).map((key, index) => ({
      ...provider,
      key,
      routeID: `${provider.id}[${index}]`,
    }));
  });
  const pool = compact(zip(...groups).flat());
  const now = Date.now();
  const routes = modes.flatMap((mode) => {
    const selected =
      mode === "auto" ? pool : pool.filter((route) => route.id === mode);
    const ready = selected.filter(
      (route) => (failures.get(route.routeID) ?? 0) <= now,
    );
    return orderBy(ready.length ? ready : selected, ["weight"], ["desc"]);
  });
  return modes.length === 1 ? routes : uniqBy(routes, (route) => route.routeID);
}

export function resolveMaxAttempts(ctx: RotateContext, routes: number): number {
  const value = Number(option(ctx, "maxAttempts"));
  const attempts = Number.isFinite(value) && value > 0 ? value : 3;
  return Math.max(1, Math.min(Math.floor(attempts), routes));
}
