import { chunk, uniq } from "es-toolkit/array";
import { HTTPError, timedSignal } from "../../shared/http";
import { RotateConfigError, option, stringList } from "../../shared/config";
import {
  errorMessage,
  mapConcurrent,
  requestConcurrency,
} from "../../shared/utils";
import type { RotateContext, URLList } from "../../shared/types";
import { orderedProviderRoutes, resolveMaxAttempts } from "../rotation";
import { SEARCH_PROVIDERS } from "./index";
import { searchCount } from "./utils";
import type { SearchOutcome, SearchProvider, SearchResult } from "./types";

export function newWebSearch(
  ctx: RotateContext,
  providers: readonly SearchProvider[] = SEARCH_PROVIDERS,
): {
  search(input: {
    queries: URLList;
    signal: AbortSignal;
  }): Promise<SearchOutcome>;
} {
  const failures = new Map<string, number>();
  return {
    search: async ({ queries, signal }) => {
      signal.throwIfAborted();
      if (!queries.length || queries.some((query) => !query.trim()))
        throw new RotateConfigError("search queries must not be empty");
      const uniqueQueries = uniq(queries.map((query) => query.trim()));
      const mode = option(ctx, "mode");
      const maxResults = searchCount(ctx);
      const pins = stringList(ctx.getOption("provider"));
      const modes = pins.length ? pins : [mode];
      if (
        modes.some(
          (name) =>
            name !== "auto" &&
            !providers.some((provider) => provider.id === name),
        )
      )
        throw new RotateConfigError(
          `websearch-rotate: unsupported provider or mode ${modes.join(", ")}`,
          "unsupported-mode",
        );
      const routes = orderedProviderRoutes(providers, ctx, modes, failures);
      const maxAttempts = resolveMaxAttempts(ctx, routes.length);
      const pending = new Set(uniqueQueries);
      const blocked = new Map<string, Error>();
      const errors = new Map<string, string>();
      const results = new Map<string, SearchResult>();
      const responses: SearchOutcome["responses"] = [];
      let attempts = 0;
      for (const route of routes) {
        if (!pending.size || attempts >= maxAttempts) break;
        if (blocked.has(route.id)) continue;
        attempts++;
        const groups = chunk(
          [...pending],
          Math.min(pending.size, route.batchSize ?? 1),
        );
        const outcomes = await mapConcurrent(
          groups,
          async (group) => {
            signal.throwIfAborted();
            try {
              const previousError = blocked.get(route.id);
              if (previousError) throw previousError;
              const budget =
                Math.max(1, Math.ceil(maxResults / uniqueQueries.length)) *
                group.length;
              const response = await route.run(
                route.key,
                group as URLList,
                timedSignal(signal),
                {
                  getOption: (name) =>
                    name === "searchResults" ? budget : ctx.getOption(name),
                },
              );
              return { group, response };
            } catch (error) {
              if (signal.aborted || error instanceof RotateConfigError)
                throw error;
              if (error instanceof HTTPError && error.invalidRequest)
                blocked.set(route.id, error);
              return {
                group,
                error: errorMessage(error),
              };
            }
          },
          requestConcurrency(ctx),
          signal,
        );
        signal.throwIfAborted();
        let succeeded = false;
        for (const outcome of outcomes) {
          if (!outcome.response) {
            for (const query of outcome.group)
              errors.set(query, outcome.error!);
            continue;
          }
          succeeded = true;
          const { results: items, ...response } = outcome.response;
          responses.push({
            ...response,
            provider: route.id,
            queries: outcome.group,
          });
          for (const query of outcome.group) {
            pending.delete(query);
            errors.delete(query);
          }
          for (const item of items) {
            const incoming = {
              ...item,
              provider: item.provider ?? route.id,
              queries: item.queries ?? outcome.group,
            };
            const existing = results.get(item.url);
            if (!existing) {
              results.set(item.url, incoming);
              continue;
            }
            const snippets = uniq([
              ...(existing.snippets ?? []),
              ...(incoming.snippets ?? []),
              ...(existing.content &&
              incoming.content &&
              incoming.content !== existing.content
                ? [incoming.content]
                : []),
            ]);
            const prior = existing.metadata?.providerResults;
            results.set(item.url, {
              ...incoming,
              ...existing,
              ...(existing.title || !incoming.title
                ? {}
                : { title: incoming.title }),
              ...(existing.content || !incoming.content
                ? {}
                : { content: incoming.content }),
              ...(snippets.length ? { snippets } : {}),
              queries: uniq([...(existing.queries ?? []), ...incoming.queries]),
              metadata: {
                ...existing.metadata,
                providerResults: [
                  ...(Array.isArray(prior)
                    ? prior
                    : [
                        {
                          provider: existing.provider,
                          queries: existing.queries,
                          published: existing.published,
                          updated: existing.updated,
                          metadata: existing.metadata,
                        },
                      ]),
                  {
                    provider: incoming.provider,
                    queries: incoming.queries,
                    published: incoming.published,
                    updated: incoming.updated,
                    metadata: incoming.metadata,
                  },
                ],
              },
            });
          }
        }
        if (succeeded) failures.delete(route.routeID);
        else failures.set(route.routeID, Date.now() + 60_000);
      }
      if (!responses.length)
        throw new Error(
          `all ${attempts} attempt(s) failed. Last error: ${[...errors.values()].at(-1) ?? "no usable provider route"}`,
        );
      return {
        results: [...results.values()].slice(0, maxResults),
        responses,
        ...(errors.size
          ? { errors: [...errors].map(([query, error]) => ({ query, error })) }
          : {}),
      };
    },
  };
}
