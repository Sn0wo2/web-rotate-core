import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  StreamableHTTPClientTransport,
  StreamableHTTPError,
} from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { REQUEST_TIMEOUT_MS, timedSignal } from "./http";

export async function mcpCall(
  url: string,
  headers: Record<string, string>,
  tool: string,
  args: Record<string, unknown>,
  signal: AbortSignal,
): Promise<CallToolResult> {
  const requestSignal = timedSignal(signal);
  for (let attempt = 0; ; attempt++) {
    const client = new Client(
      { name: "web-rotate", version: "1.0.0" },
      { capabilities: {} },
    );
    const transport = new StreamableHTTPClientTransport(new URL(url), {
      requestInit: { headers },
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          signal: AbortSignal.any([
            ...(init?.signal ? [init.signal] : []),
            init?.method === "DELETE"
              ? AbortSignal.timeout(5_000)
              : requestSignal,
          ]),
        }),
    });
    try {
      await client.connect(transport as unknown as Transport, {
        signal: requestSignal,
      });
      const result = (await client.callTool(
        { name: tool, arguments: args },
        undefined,
        { signal: requestSignal, timeout: REQUEST_TIMEOUT_MS },
      )) as CallToolResult;
      if (result.isError) {
        throw new Error(
          `MCP ${tool} error: ${(result.content.find((part) => part.type === "text")?.text ?? "tool execution failed").replace(/\s+/g, " ").trim().slice(0, 200)}`,
        );
      }
      return result;
    } catch (error) {
      if (
        requestSignal.aborted ||
        attempt ||
        !(error instanceof StreamableHTTPError) ||
        error.code !== 404
      ) {
        throw error;
      }
    } finally {
      await transport.terminateSession().catch(() => undefined);
      await client.close().catch(() => undefined);
    }
  }
}
