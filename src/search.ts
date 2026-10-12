import { PROVIDERS } from "./providers";
import { REQUEST_TIMEOUT_MS } from "./http";
import { isPlainObject as isRecord } from "es-toolkit/predicate";
import {
  attemptRoutes,
  expandProviderRoutes,
  orderedCandidates,
  resolveMaxAttempts,
} from "./rotation";
import type { RotationState } from "./rotation";
import {
  RotateConfigError,
  configuredString,
  firstList,
  stringValue,
} from "./util";
import type { RotateContext, SearchQueries } from "./util";

export type SearchResult = {
  url: string;
  title?: string;
  content?: string;
  published?: number;
};

const rotation: RotationState = { cursor: 0, failures: new Map() };

export function createWebSearcher(ctx: RotateContext): {
  search(input: {
    queries: SearchQueries;
    signal: AbortSignal;
  }): Promise<SearchResult[]>;
} {
  return {
    search: async ({ queries, signal }) => {
      const mode =
        configuredString(ctx, ["mode"], ["WEBSEARCH_MODE"]) ?? "round-robin";
      const providerOption = ctx.getOption("provider");
      const pins = Array.isArray(providerOption)
        ? providerOption.flatMap((value) => {
            const pin = stringValue(value);
            return pin ? [pin] : [];
          })
        : [stringValue(providerOption) ?? mode];
      const pool = expandProviderRoutes(
        PROVIDERS.flatMap((provider) =>
          provider.search
            ? [
                {
                  id: provider.id,
                  keyEnv: provider.keyEnv,
                  keyless: provider.search.keyless,
                  keylessEnabled: provider.search.keylessEnabled,
                  search: provider.search.run,
                  select: provider.search.select,
                  weight: provider.weight ?? 0,
                },
              ]
            : [],
        ),
        ctx,
      ).map(({ provider, key, index }) => ({
        id: `${provider.id}[${index}]`,
        provider: provider.id,
        weight: provider.weight ?? 0,
        run: async (
          search: SearchQueries,
          routeSignal: AbortSignal,
        ): Promise<SearchResult[]> => {
          const raw = await provider.search(key, search, routeSignal, ctx);
          const results = firstList(
            provider.select ? provider.select(raw) : raw,
          )
            .map((item): SearchResult | undefined => {
              if (!isRecord(item)) return undefined;
              const url = stringValue(item.url) ?? stringValue(item.link);
              if (!url) return undefined;
              const stamp = Date.parse(
                stringValue(item.publish_date) ??
                  stringValue(item.published_date) ??
                  stringValue(item.published_at) ??
                  stringValue(item.date) ??
                  stringValue(item.page_age) ??
                  "",
              );
              const title = stringValue(item.title) ?? stringValue(item.name);
              const content =
                stringValue(item.content) ??
                stringValue(item.description) ??
                stringValue(item.snippet) ??
                stringValue(item.highlight) ??
                [item.snippets, item.excerpts]
                  .map((value) =>
                    Array.isArray(value)
                      ? value.map(stringValue).filter(Boolean).join("\n")
                      : "",
                  )
                  .find(Boolean) ??
                stringValue(item.text);
              return {
                url,
                ...(title ? { title } : {}),
                ...(content ? { content } : {}),
                ...(Number.isNaN(stamp) ? {} : { published: stamp }),
              };
            })
            .filter((item): item is SearchResult => item !== undefined);
          if (!results.length) throw new Error(`no ${provider.id} results`);
          return results;
        },
      }));
      const choose = (value: string) =>
        orderedCandidates(
          pool,
          value,
          rotation,
          (route) => route.id,
          (route) => route.provider,
          (candidate) =>
            !["random", "round-robin", "auto"].includes(candidate) &&
            candidate !== "websearch-rotate",
          (route) => route.weight,
        );
      const routes = pins.length ? pins.flatMap(choose) : choose(mode);
      if (!routes.length) {
        throw new RotateConfigError(
          `no usable provider route for "${pins.join(", ") || mode}"`,
        );
      }
      return await attemptRoutes(
        routes,
        resolveMaxAttempts(ctx, "WEBSEARCH_MAX_ATTEMPTS", routes.length),
        rotation,
        (route) => route.id,
        signal,
        REQUEST_TIMEOUT_MS,
        (route, routeSignal) => route.run(queries, routeSignal),
      );
    },
  };
}
