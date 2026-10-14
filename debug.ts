import {
  createWebFetcher,
  createWebSearcher,
  RotateConfigError,
  type SearchOutcome,
} from "./src/index";
import { PROVIDERS } from "./src/providers/constants";
import type { FetchOutcome, RotateContext } from "./src/core/types";

type Parsed = {
  _: string[];
  provider: string[];
  env: string[];
  json: boolean;
  full: boolean;
  flag: Record<string, string | undefined>;
};

function parseArgv(argv: string[]): Parsed {
  const valueFlags = new Set([
    "provider",
    "env",
    "mode",
    "count",
    "max-attempts",
    "timeout",
    "format",
    "cleanup",
  ]);
  const parsed: Parsed = {
    _: [],
    provider: [],
    env: [],
    json: false,
    full: false,
    flag: {},
  };
  for (let index = 0; index < argv.length; index++) {
    const token = argv[index]!;
    if (!token.startsWith("--")) {
      parsed._.push(token);
      continue;
    }
    const name = token.slice(2);
    if (name === "json") parsed.json = true;
    else if (name === "full") parsed.full = true;
    else if (valueFlags.has(name)) {
      const value = argv[++index];
      if (value === undefined) throw new Error(`--${name} requires a value`);
      if (name === "provider") parsed.provider.push(value);
      else if (name === "env") parsed.env.push(value);
      else parsed.flag[name] = value;
    } else throw new Error(`unknown option --${name}`);
  }
  return parsed;
}

const USAGE = `web-rotate-core debug

  bun run debug providers
  bun run debug search "query" [query2 ...] [--provider id] [--mode id|auto]
      [--count n] [--max-attempts n] [--timeout s] [--env K=V] [--json]
  bun run debug fetch "url" [url2 ...] [--mode id|auto|native] [--format markdown|text|html]
      [--cleanup none|defuddle|readability] [--timeout s] [--env K=V] [--json] [--full]

notes:
  --provider nonexistent   pins a missing provider to force the SERP fallback chain
  --mode native            local direct fetch only (webfetch without providers)
  keys can also come from the real environment, e.g.
    JINA_API_KEY=xxx bun run debug search "query" --provider jina`;

function buildContext(parsed: Parsed): RotateContext {
  const env = new Map(
    parsed.env.map((entry) => {
      const eq = entry.indexOf("=");
      return eq > 0 ? [entry.slice(0, eq), entry.slice(eq + 1)] : [entry, ""];
    }) as [string, string][],
  );
  const options: Record<string, unknown> = {};
  if (parsed.provider.length) options.provider = parsed.provider;
  if (parsed.flag.mode) options.mode = parsed.flag.mode;
  if (parsed.flag.count) options.searchResults = Number(parsed.flag.count);
  if (parsed.flag["max-attempts"])
    options.maxAttempts = Number(parsed.flag["max-attempts"]);
  if (parsed.flag.cleanup) options.webfetchCleanup = parsed.flag.cleanup;
  return {
    getOption: (name) => options[name],
    getEnv: (name) => env.get(name) ?? process.env[name],
  };
}

const preview = (text: string | undefined, limit = 400) =>
  text ? text.replace(/\s+/g, " ").trim().slice(0, limit) : "";

function printSearch(outcome: SearchOutcome, elapsed: number, full: boolean) {
  console.log(`── provider responses (${Math.round(elapsed)}ms)`);
  for (const response of outcome.responses)
    console.log(
      `   ${response.provider} × ${JSON.stringify(response.queries)}` +
        (response.metadata
          ? ` metadata=${JSON.stringify(response.metadata)}`
          : ""),
    );
  console.log(`── results (${outcome.results.length})`);
  outcome.results.forEach((item, index) => {
    console.log(
      `   ${index + 1}. [${item.provider}] ${item.title ?? "(no title)"}\n      ${item.url}` +
        (item.content
          ? `\n      ${preview(item.content, full ? 10_000 : 200)}`
          : "") +
        (item.snippets?.length
          ? `\n      ${preview(item.snippets[0], full ? 10_000 : 200)}`
          : ""),
    );
  });
  if (outcome.errors?.length) {
    console.log(`── errors`);
    for (const { query, error } of outcome.errors)
      console.log(`   ${JSON.stringify(query)} → ${error}`);
  }
}

function printFetch(outcome: FetchOutcome, elapsed: number, full: boolean) {
  console.log(`── outcome (${Math.round(elapsed)}ms)`);
  if (outcome.type === "image") {
    console.log(
      `   image ${outcome.url} mime=${outcome.mime} base64=${outcome.base64.length}b`,
    );
    return;
  }
  outcome.pages.forEach((page, index) => {
    console.log(
      `   ${index + 1}. ${page.url}` +
        ` provider=${page.provider ?? "?"}` +
        (page.finalURL ? ` final=${page.finalURL}` : "") +
        (page.format ? ` format=${page.format}` : "") +
        (page.content ? ` size=${page.content.length}` : "") +
        (page.error ? ` ERROR: ${page.error}` : "") +
        (page.metadata ? ` metadata=${JSON.stringify(page.metadata)}` : ""),
    );
    if (page.content)
      console.log(
        `      ${preview(page.content, full ? Number.POSITIVE_INFINITY : 400)}`,
      );
  });
}

async function main() {
  const parsed = parseArgv(process.argv.slice(2));
  const [command, ...rest] = parsed._;
  if (!command || command === "help") {
    console.log(USAGE);
    return;
  }
  const ctx = buildContext(parsed);
  const timeoutSeconds = Number(parsed.flag.timeout ?? "") || 60;
  const signal = AbortSignal.timeout(timeoutSeconds * 1000);

  if (command === "providers") {
    for (const provider of PROVIDERS) {
      const keyEnv = provider.keyEnv ?? [
        `${provider.id.toUpperCase()}_API_KEY`,
      ];
      const hasKey = keyEnv.some((name) => ctx.getEnv(name));
      const keyless =
        provider.search?.keyless || provider.fetch?.keyless ? "y" : "n";
      console.log(
        `   ${provider.id.padEnd(14)} search=${provider.search ? "y" : "n"} fetch=${provider.fetch ? "y" : "n"}` +
          ` keyless=${keyless} key=${hasKey ? "configured" : `missing (${keyEnv.join("/")})`}`,
      );
    }
    return;
  }

  if (command === "search") {
    if (!rest.length)
      throw new Error('usage: bun run debug search "query" ...');
    const started = performance.now();
    const outcome = await createWebSearcher(ctx).search({
      queries: rest as [string, ...string[]],
      signal,
    });
    const elapsed = performance.now() - started;
    if (parsed.json) console.log(JSON.stringify(outcome, null, 2));
    else printSearch(outcome, elapsed, parsed.full);
    return;
  }

  if (command === "fetch") {
    if (!rest.length) throw new Error('usage: bun run debug fetch "url" ...');
    const urls = rest.map((url) =>
      /^https?:\/\//i.test(url) ? url : `https://${url}`,
    ) as [string, ...string[]];
    const started = performance.now();
    const outcome = await createWebFetcher(ctx).fetch({
      urls,
      format:
        (parsed.flag.format as "markdown" | "text" | "html") ?? "markdown",
      signal,
    });
    const elapsed = performance.now() - started;
    if (parsed.json) console.log(JSON.stringify(outcome, null, 2));
    else printFetch(outcome, elapsed, parsed.full);
    return;
  }

  throw new Error(`unknown command ${command}\n\n${USAGE}`);
}

try {
  await main();
} catch (error) {
  console.error(
    error instanceof RotateConfigError
      ? `config error: ${error.message}`
      : error instanceof Error
        ? error.message
        : String(error),
  );
  process.exitCode = 1;
}
