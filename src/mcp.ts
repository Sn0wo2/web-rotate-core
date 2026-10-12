import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  StreamableHTTPClientTransport,
  StreamableHTTPError,
} from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { REQUEST_TIMEOUT_MS } from "./http";

const mcpSessions = new Map<string, Client>();
const mcpConnects = new Map<string, Promise<Client>>();

function awaited<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    const onAbort = () => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

export async function mcpCall(
  url: string,
  headers: Record<string, string>,
  tool: string,
  args: Record<string, unknown>,
  signal: AbortSignal,
  options: { client?: string; timeoutMs?: number } = {},
): Promise<CallToolResult> {
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const key = `${url}\u0000${
    headers["x-api-key"] ?? headers.Authorization ?? headers.authorization ?? ""
  }`;
  const call = async (): Promise<CallToolResult> => {
    let client = mcpSessions.get(key);
    if (!client) {
      const pending = mcpConnects.get(key);
      if (pending) {
        client = await awaited(pending, signal);
      } else {
        const stored = (async () => {
          const transport = new StreamableHTTPClientTransport(new URL(url), {
            requestInit: { headers },
          });
          const client = new Client(
            { name: options.client ?? "web-rotate", version: "1.0.0" },
            { capabilities: {} },
          );
          try {
            await client.connect(transport as unknown as Transport, {
              signal: AbortSignal.timeout(timeoutMs),
            });
          } catch (error) {
            await client.close().catch(() => undefined);
            throw error;
          }
          mcpSessions.set(key, client);
          return client;
        })().finally(() => {
          if (mcpConnects.get(key) === stored) mcpConnects.delete(key);
        });
        mcpConnects.set(key, stored);
        client = await awaited(stored, signal);
      }
    }
    const result = (await client.callTool(
      { name: tool, arguments: args },
      undefined,
      { signal, timeout: timeoutMs },
    )) as CallToolResult;
    if (result.isError) {
      throw new Error(
        `MCP ${tool} error: ${(result.content?.find((part) => part.type === "text")?.text ?? "tool execution failed").replace(/\s+/g, " ").trim().slice(0, 200)}`,
      );
    }
    return result;
  };
  try {
    return await call();
  } catch (error) {
    if (error instanceof StreamableHTTPError && error.code === 404) {
      const client = mcpSessions.get(key);
      if (client) {
        mcpSessions.delete(key);
        await client.close().catch(() => undefined);
      }
      return call();
    }
    throw error;
  }
}

export function mcpPayload(result: CallToolResult): unknown {
  if (result.structuredContent != null) return result.structuredContent;
  const text = result.content?.find((part) => part.type === "text")?.text;
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
