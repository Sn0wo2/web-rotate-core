import { configuredEnvironmentValue } from "./config";
import type { RotateContext } from "./types";
import type { Provider } from "../providers/types";
import { compact, orderBy, uniq, uniqBy, zip } from "es-toolkit/array";

export function orderedProviderRoutes<
  T extends Pick<Provider, "id" | "keyEnv"> &
    Pick<
      NonNullable<Provider["search"]>,
      "weight" | "keyless" | "keylessEnabled"
    >,
>(
  providers: readonly T[],
  ctx: RotateContext,
  modes: readonly string[],
  failures: ReadonlyMap<string, number>,
) {
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
    return [
      ...uniq(keys),
      ...(provider.keyless && (provider.keylessEnabled?.(ctx) ?? true)
        ? [undefined]
        : []),
    ].map((key, index) => ({
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

export function resolveMaxAttempts(
  ctx: RotateContext,
  environmentName: string,
  routes: number,
): number {
  const value = Number(
    ctx.getOption("maxAttempts") ??
      configuredEnvironmentValue(ctx, environmentName),
  );
  const attempts = Number.isFinite(value) && value > 0 ? value : 3;
  return Math.max(1, Math.min(Math.floor(attempts), routes));
}
