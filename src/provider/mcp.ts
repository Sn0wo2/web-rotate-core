import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StreamableHTTPClientTransport, StreamableHTTPError } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js"
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js"
import { LIB_VERSION, REQUEST_TIMEOUT_MS, timedSignal } from "../shared/http"

export const MCP_FETCH_TIMEOUT_MS = 120_000

export async function mcpCall(
  url: string,
  headers: Record<string, string>,
  tool: string,
  args: Record<string, unknown>,
  signal: AbortSignal,
  timeoutMs: number = REQUEST_TIMEOUT_MS,
): Promise<CallToolResult> {
  const requestSignal = timedSignal(signal, timeoutMs)
  for (let attempt = 0; ; attempt++) {
    const client = new Client({ name: "web-rotate-core", version: LIB_VERSION }, { capabilities: {} })
    const transport = new StreamableHTTPClientTransport(new URL(url), {
      requestInit: { headers },
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          signal: AbortSignal.any([
            ...(init?.signal ? [init.signal] : []),
            init?.method === "DELETE" ? AbortSignal.timeout(5000) : requestSignal,
          ]),
        }),
    })
    try {
      await client.connect(transport as unknown as Transport, {
        signal: requestSignal,
      })
      const result = (await client.callTool({ name: tool, arguments: args }, undefined, {
        signal: requestSignal,
        timeout: timeoutMs,
      })) as CallToolResult
      if (result.isError) {
        throw new Error(
          `MCP ${tool} error: ${(result.content.find((part) => part.type === "text")?.text ?? "tool execution failed").replace(/\s+/g, " ").trim().slice(0, 200)}`,
        )
      }
      return result
    } catch (error) {
      if (requestSignal.aborted || attempt || !(error instanceof StreamableHTTPError) || error.code !== 404) {
        throw error
      }
    } finally {
      await transport.terminateSession().catch(() => undefined)
      await client.close().catch(() => undefined)
    }
  }
}

export async function mcpJSON(
  url: string,
  headers: Record<string, string>,
  tool: string,
  args: Record<string, unknown>,
  signal: AbortSignal,
  timeoutMs: number = REQUEST_TIMEOUT_MS,
): Promise<unknown> {
  const result = await mcpCall(url, headers, tool, args, signal, timeoutMs)
  return result.structuredContent ?? JSON.parse(result.content.find((part) => part.type === "text")?.text ?? "null")
}
