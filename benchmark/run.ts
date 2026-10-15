import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  createWebFetcher,
  FETCH_PROVIDERS,
  RotateConfigError,
} from "../src/index";
import type {
  FetchProvider,
  FetchProviderConfig,
  ProviderEntry,
} from "../src/index";
import { errorMessage, mapConcurrent } from "../src/shared/utils";

const DEFAULT_MODEL = "jev-1.13";
const FETCH_CONCURRENCY = 2;
const JUDGE_CONCURRENCY = 2;

const JUDGE_INSTRUCTIONS = `Evaluate the unnamed candidate's web page text extraction for the given URL. Use the provided native local extraction of the same page as a completeness reference, not as a candidate to score. Judge the quality of the extracted main content, considering coverage, structure, and cleanliness

First reject: score 0–2 if the candidate is empty, an error, captcha, consent or login shell, or too small and boilerplate-heavy to contain meaningful page content

Otherwise, use the full 0–9 scale:
- 3: Minimal genuine content, with most of the page missing or obscured by noise
- 4–6: Substantial genuine content, but significant omissions, extraction truncation, structural damage, or noise
- 7–9: Most or all main content preserved, with coherent structure and little noise; reserve 9 for exceptionally complete and clean extractions

Penalize ads, navigation menus, cookie banners, scripts, duplicates, unrelated content, and corrupted text. Compare substantive coverage rather than raw length; the reference may contain boilerplate that need not be reproduced

Texts are whitespace-compacted, and entries marked truncated were shortened only for display. Do not penalize these presentation artifacts or infer extraction failures from them

Return only an integer from 0 to 9`;

const SCORE_LEVELS = [
  "0 - invalid: empty, mojibake, or placeholder text",
  "1 - wrong page: content does not match the URL's page (error, captcha, login wall)",
  "2 - almost no main content: mostly template, navigation, or footer",
  "3 - severe: scattered fragments of main content dominated by ads, navigation, or scripts",
  "4 - poor: less than half of the main content, or noise dominates",
  "5 - mediocre: large sections missing or substantial noise mixed in",
  "6 - acceptable: main content present with noticeable noise or small gaps",
  "7 - good: essentially complete content with minor noise or omissions",
  "8 - excellent: complete content with negligible noise",
  "9 - perfect: complete main content, zero noise, clean structure",
];

const USAGE = `web-rotate-core benchmark

  bun run benchmark <url> [url2 ...] [--urls file] [--providers id,id2]
      [--reads n] [--retries n] [--save-dir dir]
      [--timeout s] [--env K=V] [--json]

notes:
  fetches every URL through each fetch-capable provider with a configured
  key (keyless providers included) plus the native local extraction, then
  grades each extraction independently with the Jev decision model (one
  System One call per candidate).
  provider keys come from env, one variable per provider:
  <PROVIDER>_API_KEY (no aliases); a value may hold several keys separated
  by spaces, commas, or semicolons for rotation.
  --env K=V sets config values (e.g. cleanup=defuddle, concurrency=1,
  maxAttempts=3).
  judge env: TYPESAFE_API_KEY and TYPESAFE_BASE_URL (both required),
  TYPESAFE_MODEL`;

type Parsed = {
  _: string[];
  env: string[];
  providers: string[];
  urls: string | undefined;
  reads: number;
  retries: number;
  saveDir: string;
  timeout: number;
  json: boolean;
};

function parseArgv(argv: string[]): Parsed {
  const valueFlags = new Set([
    "providers",
    "env",
    "urls",
    "reads",
    "retries",
    "save-dir",
    "timeout",
  ]);
  const parsed: Parsed = {
    _: [],
    env: [],
    providers: [],
    urls: undefined,
    reads: 1,
    retries: 3,
    saveDir: "benchmark/out",
    timeout: 1200,
    json: false,
  };
  for (let index = 0; index < argv.length; index++) {
    const token = argv[index]!;
    if (!token.startsWith("--")) {
      parsed._.push(token);
      continue;
    }
    const name = token.slice(2);
    if (name === "json") {
      parsed.json = true;
      continue;
    }
    if (!valueFlags.has(name)) throw new Error(`unknown option --${name}`);
    const value = argv[++index];
    if (value === undefined) throw new Error(`--${name} requires a value`);
    if (name === "env") parsed.env.push(value);
    else if (name === "providers")
      parsed.providers.push(...value.split(/[\s,;]+/).filter(Boolean));
    else if (name === "urls") parsed.urls = value;
    else if (name === "reads") parsed.reads = positive(value, name);
    else if (name === "retries") parsed.retries = positive(value, name);
    else if (name === "save-dir") parsed.saveDir = value;
    else if (name === "timeout") parsed.timeout = positive(value, name);
  }
  return parsed;
}

function positive(value: string, name: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0)
    throw new Error(`--${name} must be a positive number`);
  return parsed;
}

type EnvContext = {
  getOption(name: string): string | undefined;
};

function envMap(parsed: Parsed): Map<string, string> {
  return new Map(
    parsed.env.map((entry) => {
      const eq = entry.indexOf("=");
      return eq > 0
        ? ([entry.slice(0, eq), entry.slice(eq + 1)] as [string, string])
        : ([entry, ""] as [string, string]);
    }),
  );
}

function buildContext(parsed: Parsed): EnvContext {
  const env = envMap(parsed);
  return {
    getOption: (name) => env.get(name) ?? process.env[name.toUpperCase()],
  };
}

function providerKeys(
  env: Map<string, string>,
  id: string,
): string[] | undefined {
  const raw =
    env.get(`${id}Keys`) ?? process.env[`${id.toUpperCase()}_API_KEY`];
  return raw ? raw.split(/[\s,;]+/).filter(Boolean) : undefined;
}

function buildFetchConfig(
  parsed: Parsed,
  options?: { cleanup?: "none" | "defuddle"; only?: string },
): FetchProviderConfig {
  const env = envMap(parsed);
  const config: FetchProviderConfig = { prefer: "keyless" };
  const cleanup = options?.cleanup ?? env.get("cleanup");
  if (cleanup === "none" || cleanup === "defuddle") config.cleanup = cleanup;
  const concurrency = Number(env.get("concurrency"));
  if (Number.isFinite(concurrency) && concurrency > 0)
    config.concurrency = concurrency;
  const maxAttempts = Number(env.get("maxAttempts"));
  if (Number.isFinite(maxAttempts) && maxAttempts > 0)
    config.maxAttempts = maxAttempts;
  const slots: Record<string, ProviderEntry> = {};
  for (const provider of FETCH_PROVIDERS) {
    if (options?.only && provider.id !== options.only) continue;
    const keys = providerKeys(env, provider.id);
    slots[provider.id] = keys?.length ? { keys } : {};
  }
  config.providers = slots as NonNullable<FetchProviderConfig["providers"]>;
  return config;
}

function selectProviders(
  parsed: Parsed,
  filter?: string[],
): { provider: FetchProvider; skip?: string }[] {
  const env = envMap(parsed);
  if (filter?.length) {
    return filter.map((id) => {
      const provider = FETCH_PROVIDERS.find((entry) => entry.id === id);
      if (!provider)
        throw new Error(
          `provider ${id} has no fetch capability (available: ${FETCH_PROVIDERS.map(
            (entry) => entry.id,
          ).join(", ")})`,
        );
      return { provider };
    });
  }
  return FETCH_PROVIDERS.filter((provider) => provider.id !== "native").map(
    (provider) => {
      if (provider.keyless) return { provider };
      return providerKeys(env, provider.id)?.length
        ? { provider }
        : {
            provider,
            skip: `missing key (${provider.id.toUpperCase()}_API_KEY)`,
          };
    },
  );
}

type Row = {
  provider: string;
  url: string;
  content: string | undefined;
  format: string | undefined;
  error: string | undefined;
};

async function fetchProvider(
  urls: readonly string[],
  parsed: Parsed,
  provider: FetchProvider | undefined,
  signal: AbortSignal,
): Promise<Row[]> {
  const id = provider?.id ?? "native";
  const config = provider
    ? buildFetchConfig(parsed, { only: provider.id })
    : buildFetchConfig(parsed, { only: "native", cleanup: "defuddle" });
  const failed = (url: string, error: string): Row => ({
    provider: id,
    url,
    content: undefined,
    format: undefined,
    error,
  });
  try {
    const outcome = await createWebFetcher(config).fetch({
      urls: [...urls] as [string, ...string[]],
      format: "markdown",
      signal,
    });
    if (outcome.type !== "pages")
      return urls.map((url) =>
        failed(url, "image outcome is not benchmarkable"),
      );
    return outcome.pages.map((page) =>
      page.provider === id && page.content
        ? {
            provider: id,
            url: page.url,
            content: page.content.replace(/\s+/g, " ").trim(),
            format: page.format,
            error: undefined,
          }
        : failed(
            page.url,
            page.error ?? "unattributed result (native fallback)",
          ),
    );
  } catch (error) {
    if (signal.aborted) throw error;
    const message = errorMessage(error);
    return urls.map((url) => failed(url, message));
  }
}

type Candidate = {
  provider: string;
  format: string;
  size: number;
  content: string;
};

const TOKEN_BUDGET = 32_000;

const tokenEstimate = (text: string) => {
  const cjk = (text.match(/[\u3000-\u9fff\u3040-\u30ff\uac00-\ud7af]/gu) ?? [])
    .length;
  return cjk + (text.length - cjk) * 0.3;
};

const judgeView = (text: string) =>
  text
    .replace(/!\[[^\]]*\]\((?:[^()]|\([^()]*\))*\)/g, "")
    .replace(/\[([^\]]*)\]\((?:[^()]|\([^()]*\))*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/ {2,}/g, " ")
    .trim();

const fitContent = (
  text: string,
  tokenBudget: number,
): { content: string; truncated: boolean } => {
  const estimate = tokenEstimate(text);
  if (estimate <= tokenBudget) return { content: text, truncated: false };
  const cap = Math.max(0, Math.floor((text.length * tokenBudget) / estimate));
  const head = Math.floor(cap * 0.7);
  return {
    content: `${text.slice(0, head)} [...truncated to fit the judge window...] ${cap > head ? text.slice(-cap + head) : ""}`,
    truncated: true,
  };
};

type JudgeConfig = { endpoint: string; apiKey: string; model: string };
type ScoreAnswer = { score?: number; confidence?: number };
type Usage = { input_tokens?: number; output_tokens?: number };

function judgeConfig(ctx: EnvContext): JudgeConfig {
  const rawBase =
    ctx.getOption("TYPESAFE_BASE_URL") || process.env.TYPESAFE_BASE_URL;
  if (!rawBase)
    throw new RotateConfigError("TYPESAFE_BASE_URL is not configured");
  const base = rawBase.replace(/\/+$/, "");
  const apiKey =
    ctx.getOption("TYPESAFE_API_KEY") || process.env.TYPESAFE_API_KEY;
  if (!apiKey)
    throw new RotateConfigError("TYPESAFE_API_KEY is not configured");
  return {
    endpoint: /\/v\d+$/.test(base)
      ? `${base}/systemone`
      : `${base}/v1/systemone`,
    apiKey,
    model:
      ctx.getOption("TYPESAFE_MODEL") ||
      process.env.TYPESAFE_MODEL ||
      DEFAULT_MODEL,
  };
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

async function judgeRead(
  cfg: JudgeConfig,
  state: unknown,
  questions: Record<string, unknown>,
  retries: number,
  timeoutMs: number,
): Promise<{
  answers: Record<string, ScoreAnswer>;
  usage: Usage | undefined;
}> {
  let lastError = "no attempt made";
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt) await sleep(Math.min(30_000, 2_000 * 2 ** (attempt - 1)));
    try {
      const response = await fetch(cfg.endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfg.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: cfg.model, state, questions }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) {
        const body = (await response.text().catch(() => "")).slice(0, 300);
        lastError = `HTTP ${response.status}: ${body}`;
        if (response.status === 429 || response.status >= 500) {
          const retryAfter = Number(response.headers.get("retry-after"));
          if (Number.isFinite(retryAfter) && retryAfter > 0)
            await sleep(Math.min(60_000, retryAfter * 1000));
          continue;
        }
        break;
      }
      const payload = (await response.json()) as {
        answers?: Record<string, ScoreAnswer>;
        usage?: Usage;
      };
      const answers = payload.answers ?? {};
      if (
        Object.keys(questions).some(
          (id) => typeof answers[id]?.score !== "number",
        )
      ) {
        lastError = `malformed judge response: ${JSON.stringify(payload).slice(0, 300)}`;
        continue;
      }
      return { answers, usage: payload.usage };
    } catch (error) {
      lastError = errorMessage(error);
    }
  }
  throw new Error(
    `judge call failed after ${retries + 1} attempts: ${lastError}`,
  );
}

type CandidateAudit = {
  provider: string;
  reads: { answers: Record<string, ScoreAnswer>; usage: Usage | undefined }[];
  error: string | undefined;
};

type JudgeResult = {
  scores: Record<string, number[]>;
  confidences: Record<string, number[]>;
  judgements: CandidateAudit[];
};

async function judgeCandidate(
  cfg: JudgeConfig,
  url: string,
  candidate: Candidate,
  reference: Candidate | undefined,
  parsed: Parsed,
  auditDir: string | undefined,
): Promise<CandidateAudit> {
  const questions = {
    candidate: {
      type: "score",
      instructions: JUDGE_INSTRUCTIONS,
      criteria: SCORE_LEVELS,
    },
  };
  const referenceCandidate =
    reference && candidate.provider !== "native" ? reference : undefined;
  const candidateTokens = tokenEstimate(judgeView(candidate.content));
  const referenceTokens = referenceCandidate
    ? tokenEstimate(judgeView(referenceCandidate.content))
    : 0;
  const share = candidateTokens / (candidateTokens + referenceTokens || 1);
  const audit: CandidateAudit = {
    provider: candidate.provider,
    reads: [],
    error: undefined,
  };
  for (let read = 0; read < parsed.reads; read++) {
    for (let budget = TOKEN_BUDGET - 2_000; ; budget = Math.floor(budget / 2)) {
      const fitted = fitContent(judgeView(candidate.content), budget * share);
      const fittedReference = referenceCandidate
        ? fitContent(
            judgeView(referenceCandidate.content),
            budget * (1 - share),
          )
        : undefined;
      const state = {
        url,
        ...(referenceCandidate && fittedReference
          ? {
              native_reference: {
                format: referenceCandidate.format,
                size: referenceCandidate.size,
                ...(fittedReference.truncated ? { truncated: true } : {}),
                content: fittedReference.content,
              },
            }
          : {}),
        candidates: {
          candidate: {
            format: candidate.format,
            size: candidate.size,
            ...(fitted.truncated ? { truncated: true } : {}),
            content: fitted.content,
          },
        },
      };
      try {
        const { answers, usage } = await judgeRead(
          cfg,
          state,
          questions,
          parsed.retries,
          parsed.timeout * 1000,
        );
        const scored = { [candidate.provider]: answers.candidate ?? {} };
        audit.reads.push({ answers: scored, usage });
        if (auditDir)
          await writeFile(
            join(auditDir, `${candidate.provider}-read-${read}.json`),
            JSON.stringify(
              {
                request: { model: cfg.model, state, questions },
                answers: scored,
                usage,
              },
              null,
              2,
            ),
          );
        break;
      } catch (error) {
        if (
          budget > 4_000 &&
          /max_tokens_exceeded/i.test(errorMessage(error))
        ) {
          continue;
        }
        audit.error = errorMessage(error);
        break;
      }
    }
    if (audit.error) break;
  }
  return audit;
}

async function judgeURL(
  cfg: JudgeConfig,
  url: string,
  candidates: Candidate[],
  parsed: Parsed,
  auditDir: string | undefined,
): Promise<JudgeResult> {
  if (auditDir) await mkdir(auditDir, { recursive: true });
  const judgements = await mapConcurrent(
    candidates,
    (candidate) =>
      judgeCandidate(
        cfg,
        url,
        candidate,
        candidates.find((entry) => entry.provider === "native"),
        parsed,
        auditDir,
      ),
    JUDGE_CONCURRENCY,
  );
  const scores: Record<string, number[]> = {};
  const confidences: Record<string, number[]> = {};
  for (const { provider, reads } of judgements)
    for (const { answers } of reads) {
      const answer = answers[provider];
      if (typeof answer?.score === "number")
        (scores[provider] ??= []).push(answer.score);
      if (typeof answer?.confidence === "number")
        (confidences[provider] ??= []).push(answer.confidence);
    }
  return { scores, confidences, judgements };
}

const mean = (values: number[]) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

const stddev = (values: number[]) => {
  if (values.length < 2) return 0;
  const average = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - average) ** 2)));
};

type ScoreStat = { mean: number; stddev: number; confidence: number | null };
type CandidateReport = {
  format: string | undefined;
  size: number;
  error: string | undefined;
};
type URLReport = {
  url: string;
  candidates: Record<string, CandidateReport>;
  scores: Record<string, ScoreStat>;
  judgements: CandidateAudit[];
  judgeError: string | undefined;
};

function toStats(
  scores: Record<string, number[]>,
  confidences: Record<string, number[]>,
): Record<string, ScoreStat> {
  return Object.fromEntries(
    Object.entries(scores).map(([id, values]) => [
      id,
      {
        mean: mean(values),
        stddev: stddev(values),
        confidence: confidences[id] ? mean(confidences[id]!) : null,
      },
    ]),
  );
}

function table(headers: string[], rows: string[][]) {
  const widths = headers.map((header, column) =>
    Math.max(header.length, ...rows.map((row) => (row[column] ?? "").length)),
  );
  const line = (cells: string[]) =>
    cells.map((cell, column) => cell.padEnd(widths[column]!)).join("  ");
  console.log(line(headers));
  for (const row of rows) console.log(line(row));
}

const clip = (text: string, limit = 60) =>
  text.length > limit ? `${text.slice(0, limit - 1)}…` : text;

function printURLReport(report: URLReport) {
  console.log(`\n── ${report.url}`);
  const scored = Object.entries(report.scores).sort(
    ([, a], [, b]) => b.mean - a.mean,
  );
  table(
    ["provider", "score", "±sd", "conf", "format", "chars", "note"],
    [
      ...scored.map(([id, stat]) => {
        const candidate = report.candidates[id]!;
        return [
          id,
          stat.mean.toFixed(1),
          stat.stddev ? stat.stddev.toFixed(1) : "-",
          stat.confidence == null ? "-" : stat.confidence.toFixed(2),
          candidate.format ?? "-",
          String(candidate.size),
          "",
        ];
      }),
      ...Object.entries(report.candidates)
        .filter(([id]) => !report.scores[id])
        .map(([id, candidate]) => [
          id,
          "-",
          "-",
          "-",
          candidate.format ?? "-",
          candidate.size ? String(candidate.size) : "-",
          clip(candidate.error ?? report.judgeError ?? "not judged"),
        ]),
    ],
  );
}

type SummaryRow = {
  provider: string;
  avg: number | null;
  scored: number;
  failed: number;
  note: string | undefined;
};

function summarize(
  reports: URLReport[],
  selection: { provider: FetchProvider; skip?: string }[],
): SummaryRow[] {
  return [...new Set(["native", ...selection.map((row) => row.provider.id)])]
    .map((id) => {
      const means = reports
        .map((report) => report.scores[id]?.mean)
        .filter((value): value is number => value != null);
      return {
        provider: id,
        avg: means.length ? mean(means) : null,
        scored: means.length,
        failed: reports.filter((report) => report.candidates[id]?.error).length,
        note: selection.find((row) => row.provider.id === id)?.skip,
      };
    })
    .sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1));
}

function printSummary(summary: SummaryRow[], total: number) {
  console.log(`\n── summary (avg of per-URL mean scores, ${total} urls)`);
  table(
    ["provider", "avg", "scored", "failed", "note"],
    summary.map((row) => [
      row.provider,
      row.avg == null ? "-" : row.avg.toFixed(2),
      `${row.scored}/${total}`,
      String(row.failed),
      clip(row.note ?? "", 50),
    ]),
  );
}

async function readURLsFile(path: string | undefined): Promise<string[]> {
  if (!path) return [];
  const text = await readFile(path, "utf8");
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

function urlSlug(url: string): string {
  const base =
    url
      .replace(/^https?:\/\//i, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "url";
  return `${base}-${Bun.hash(url).toString(36).slice(0, 6)}`;
}

async function main() {
  const parsed = parseArgv(process.argv.slice(2));
  const positions = [...parsed._, ...(await readURLsFile(parsed.urls))].map(
    (url) => (/^https?:\/\//i.test(url) ? url : `https://${url}`),
  );
  const urls = [...new Set(positions)];
  if (!urls.length) throw new Error(USAGE);
  const ctx = buildContext(parsed);
  const cfg = judgeConfig(ctx);
  const selection = selectProviders(
    parsed,
    parsed.providers.length ? parsed.providers : undefined,
  );
  const selected = selection.filter((row) => !row.skip);

  console.log("── plan");
  console.log(`   urls: ${urls.length}`);
  console.log(
    `   providers: native(defuddle) + ${selected.map((row) => row.provider.id).join(", ") || "(none)"}`,
  );
  for (const { provider, skip } of selection)
    if (skip) console.log(`   skipped: ${provider.id}: ${skip}`);
  console.log(
    `   judge: ${cfg.model} @ ${cfg.endpoint} x${parsed.reads} reads/candidate`,
  );

  const fetchSignal = AbortSignal.timeout(parsed.timeout * 1000);
  const providers = [undefined, ...selected.map((row) => row.provider)];
  console.log(
    `\n── fetching ${urls.length} urls × ${providers.length} providers (concurrency ${FETCH_CONCURRENCY})`,
  );
  const rows = (
    await mapConcurrent(
      providers,
      async (provider) => {
        const id = provider?.id ?? "native";
        const started = Date.now();
        const providerRows = await fetchProvider(
          urls,
          parsed,
          provider,
          fetchSignal,
        );
        const ok = providerRows.filter((row) => row.content).length;
        console.log(
          `   fetched ${id.padEnd(12)} ${ok}/${providerRows.length} ok in ${Math.round((Date.now() - started) / 1000)}s` +
            (ok === providerRows.length
              ? ""
              : `, first error: ${clip(
                  providerRows.find((row) => row.error)?.error ??
                    "no content returned",
                  80,
                )}`),
        );
        return providerRows;
      },
      FETCH_CONCURRENCY,
      fetchSignal,
    )
  ).flat();

  const stamp = new Date()
    .toISOString()
    .slice(0, 19)
    .replace("T", "-")
    .replace(/:/g, "");
  const runDir = join(parsed.saveDir, stamp);
  const reports: URLReport[] = [];
  let judgeCalls = 0;
  let judgeInputTokens = 0;

  for (const url of urls) {
    const urlRows = rows.filter((row) => row.url === url);
    const urlDir = join(runDir, urlSlug(url));
    const candidates: Candidate[] = [];
    for (const row of urlRows) {
      if (!row.content) continue;
      candidates.push({
        provider: row.provider,
        format: row.format ?? "unknown",
        size: row.content.length,
        content: row.content,
      });
      await mkdir(join(urlDir, "candidates"), { recursive: true });
      await writeFile(
        join(urlDir, "candidates", `${row.provider}.md`),
        row.content,
      );
    }
    const report: URLReport = {
      url,
      candidates: Object.fromEntries(
        urlRows.map((row) => [
          row.provider,
          {
            format: row.format,
            size: row.content?.length ?? 0,
            error: row.error,
          },
        ]),
      ),
      scores: {},
      judgements: [],
      judgeError: undefined,
    };
    if (candidates.length >= 2) {
      const judged = await judgeURL(
        cfg,
        url,
        candidates,
        parsed,
        join(urlDir, "judge"),
      );
      report.scores = toStats(judged.scores, judged.confidences);
      report.judgements = judged.judgements;
      for (const judgement of judged.judgements) {
        judgeCalls += judgement.reads.length;
        judgeInputTokens += judgement.reads.reduce(
          (sum, read) => sum + (read.usage?.input_tokens ?? 0),
          0,
        );
      }
    } else {
      report.judgeError = `fewer than 2 successful extractions (${candidates.length})`;
    }
    reports.push(report);
    printURLReport(report);
  }

  const summary = summarize(reports, selection);
  printSummary(summary, reports.length);
  console.log(
    `\n── judge usage: ${judgeCalls} calls, ~${judgeInputTokens} input tokens`,
  );

  const resultsPath = join(runDir, "results.json");
  await mkdir(dirname(resultsPath), { recursive: true });
  await writeFile(
    resultsPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        config: {
          model: cfg.model,
          endpoint: cfg.endpoint,
          reads: parsed.reads,
        },
        skipped: selection
          .filter((row) => row.skip)
          .map((row) => ({ id: row.provider.id, reason: row.skip })),
        reports,
        summary,
      },
      null,
      2,
    ),
  );
  console.log(`   saved: ${resultsPath}`);
  if (parsed.json) console.log(JSON.stringify({ reports, summary }, null, 2));
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
