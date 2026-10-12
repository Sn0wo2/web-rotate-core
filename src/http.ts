export const USER_AGENT = "opencode2-web-rotate/1.0.0";
export const REQUEST_TIMEOUT_MS = 30_000;

export const timedSignal = (
  signal: AbortSignal,
  timeoutMs = REQUEST_TIMEOUT_MS,
): AbortSignal => AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]);

export async function readBodyLimited(
  response: Response,
  maxBytes: number,
  label = "response",
): Promise<Uint8Array> {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new Error(`${label} exceeds the ${maxBytes} byte limit`);
  }
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array();

  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new Error(`${label} exceeds the ${maxBytes} byte limit`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks, total);
}

export async function checkedResponseText(
  response: Response,
  label: string,
): Promise<string> {
  const body = new TextDecoder().decode(
    await readBodyLimited(
      response,
      response.ok ? 10 * 1024 * 1024 : 64 * 1024,
      label,
    ),
  );
  if (!response.ok) {
    const detail = body.replace(/\s+/g, " ").trim().slice(0, 200);
    throw new Error(
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
  } = {},
): Promise<unknown> {
  const label = init.label ?? url;
  const response = await fetch(url, {
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
    signal: timedSignal(signal),
    redirect: "error",
  });
  const body = await checkedResponseText(response, label);
  try {
    return JSON.parse(body);
  } catch {
    throw new Error(`${label} returned invalid JSON`);
  }
}
