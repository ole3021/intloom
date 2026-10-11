import { StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import {
  readConnection,
  serviceStatus,
  projectRoot,
} from "@intloom/kernel/service";
import type { Readable, Writable } from "node:stream";
import { failure } from "../errors.ts";

/** A protocol bridge, not a Kernel owner. Message IDs and both directions remain intact. */
export async function runMcpProxy(
  directory: string,
  io: { input: Readable; output: Writable },
  options: { ide?: "codex"; signal?: AbortSignal } = {},
): Promise<void> {
  const root = await projectRoot(directory);
  const status = await serviceStatus(root);
  const connection = await readConnection(root);
  if (!connection)
    throw failure(
      "CLI_SERVICE_OFFLINE",
      "Start the project Service before connecting MCP.",
    );
  const http = new StreamableHTTPClientTransport(
    new URL(
      options.ide === "codex" ? "/mcp/codex" : "/mcp",
      `http://127.0.0.1:${connection.port}`,
    ),
    {
      requestInit: {
        redirect: "error",
        headers: {
          authorization: `Bearer ${connection.token}`,
          "x-intloom-service-instance": status.instanceId,
        },
      },
      redirectPolicy: "same-origin",
      reconnectionOptions: {
        maxRetries: 0,
        initialReconnectionDelay: 100,
        maxReconnectionDelay: 100,
        reconnectionDelayGrowFactor: 1,
      },
    },
  );
  const stdio = new StdioServerTransport(io.input, io.output);
  let finish: (() => void) | undefined;
  let closing = false;
  let initializationId: string | number | undefined;
  const closed = new Promise<void>((resolve) => {
    finish = resolve;
  });
  async function close() {
    if (closing) return;
    closing = true;
    await Promise.allSettled([
      http.terminateSession(),
      http.close(),
      stdio.close(),
    ]);
    finish?.();
  }
  const abort = () => {
    void close();
  };
  options.signal?.addEventListener("abort", abort, { once: true });
  http.onmessage = (message) => {
    if (
      "id" in message &&
      message.id === initializationId &&
      "result" in message
    ) {
      const result = message.result;
      if (
        result &&
        typeof result === "object" &&
        "protocolVersion" in result &&
        typeof result.protocolVersion === "string"
      )
        http.setProtocolVersion(result.protocolVersion);
    }
    void stdio.send(message).catch(close);
  };
  stdio.onmessage = (message) => {
    if (
      "method" in message &&
      message.method === "initialize" &&
      "id" in message
    )
      initializationId = message.id;
    // Sending stays concurrent: a server request can require a client response before the original request completes.
    void http.send(message).catch(async (cause: unknown) => {
      const code =
        cause instanceof Error && "code" in cause
          ? String(cause.code)
          : "MCP_TRANSPORT_FAILED";
      const status =
        cause instanceof Error && "status" in cause
          ? String(cause.status)
          : "unknown";
      process.stderr.write(`MCP bridge: ${code} (HTTP ${status})\n`);
      if ("id" in message && "method" in message)
        await stdio
          .send({
            jsonrpc: "2.0",
            id: message.id,
            error: {
              code: -32603,
              message:
                "The project Service connection failed; do not replay execution automatically.",
            },
          })
          .catch(() => {});
      await close();
    });
  };
  stdio.onclose = abort;
  http.onclose = abort;
  stdio.onerror = abort;
  // Optional GET/SSE can be rejected before initialize; POST exchange errors close through send().
  http.onerror = () => {};
  try {
    await http.start();
    await stdio.start();
    if (options.signal?.aborted) await close();
    await closed;
  } finally {
    options.signal?.removeEventListener("abort", abort);
    await close();
  }
}
