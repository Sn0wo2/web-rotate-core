import pkg from "../../package.json" with { type: "json" };

export const REQUEST_TIMEOUT_MS = 30_000;

export const LIB_VERSION = pkg.version;
export const USER_AGENT = `web-rotate-core/${LIB_VERSION}`;

export const TARGET_USER_AGENT =
  "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot";

export class HTTPError extends Error {
  readonly retryable: boolean;
  readonly invalidRequest: boolean;

  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HTTPError";
    this.retryable = [408, 425, 429].includes(status) || status >= 500;
    this.invalidRequest = [400, 404, 405, 406, 413, 414, 415, 422].includes(
      status,
    );
  }
}

export const timedSignal = (
  signal: AbortSignal,
  timeoutMs = REQUEST_TIMEOUT_MS,
): AbortSignal => AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]);

export async function readBodyLimited(
  response: Response,
  maxBytes: number,
  label = "response",
): Promise<Uint8Array> {
  if (Number(response.headers.get("content-length")) > maxBytes) {
    await response.body?.cancel();
    throw new Error(`${label} exceeds the ${maxBytes} byte limit`);
  }
  if (!response.body) return new Uint8Array();
  let total = 0;
  return new Uint8Array(
    await new Response(
      response.body.pipeThrough(
        new TransformStream<Uint8Array, Uint8Array>({
          transform(chunk, controller) {
            total += chunk.byteLength;
            if (total > maxBytes) {
              throw new Error(`${label} exceeds the ${maxBytes} byte limit`);
            }
            controller.enqueue(chunk);
          },
        }),
      ),
    ).arrayBuffer(),
  );
}

export async function checkedResponseText(response: Response, label: string) {
  let body: string;
  try {
    body = new TextDecoder().decode(
      await readBodyLimited(
        response,
        response.ok ? 10 * 1024 * 1024 : 64 * 1024,
        label,
      ),
    );
  } catch (error) {
    if (
      response.ok ||
      (error instanceof Error &&
        ["AbortError", "TimeoutError"].includes(error.name))
    )
      throw error;
    throw new HTTPError(
      response.status,
      `${label} HTTP ${response.status}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!response.ok) {
    const detail = body.replace(/\s+/g, " ").trim().slice(0, 200);
    throw new HTTPError(
      response.status,
      `${label} HTTP ${response.status}${detail ? `: ${detail}` : ""}`,
    );
  }
  return body;
}

export async function apiJSON(
  url: string,
  signal: AbortSignal,
  init: {
    label?: string;
    body?: unknown;
    key?: string | undefined;
    headers?: Record<string, string>;
    timeoutMs?: number;
  } = {},
): Promise<unknown> {
  const body = await checkedResponseText(
    await fetch(url, {
      method: init.body === undefined ? "GET" : "POST",
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
        ...(init.body === undefined
          ? {}
          : { "Content-Type": "application/json" }),
        ...(init.key ? { Authorization: `Bearer ${init.key}` } : {}),
        ...init.headers,
      },
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
      signal: timedSignal(signal, init.timeoutMs),
      redirect: "error",
    }),
    init.label ?? url,
  );
  try {
    return JSON.parse(body);
  } catch {
    throw new Error(`${init.label ?? url} returned invalid JSON`);
  }
}
