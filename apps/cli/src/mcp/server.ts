import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  createMcpHandler,
  isLegacyRequest,
} from "@modelcontextprotocol/server";
import {
  NodeStreamableHTTPServerTransport,
  toNodeHandler,
  toWebRequest,
} from "@modelcontextprotocol/node";
import type { ProjectHost } from "../service/host.ts";
import { createProjectApplication } from "../application/project.ts";
import { resolveProjectEntry } from "../application/entry.ts";
import { failure } from "../errors.ts";
import { createToolServer } from "./tools.ts";

export function createMcpEndpoint(host: ProjectHost) {
  function serverFor(path: string) {
    const entry = resolveProjectEntry(path);
    if (!entry) throw failure("INVALID_REQUEST", "Unknown project entry.");
    return createToolServer(
      createProjectApplication(host, entry.source),
      entry.ide,
    );
  }
  const factory = ({ requestInfo }: { requestInfo?: Request }) =>
    serverFor(requestInfo ? new URL(requestInfo.url).pathname : "");
  const modern = createMcpHandler(factory);
  const node = toNodeHandler(modern);
  const sessions = new Map<
    string,
    {
      readonly transport: NodeStreamableHTTPServerTransport;
      readonly path: string;
    }
  >();
  const protocols = new Set<NodeStreamableHTTPServerTransport>();
  return {
    async handle(req: IncomingMessage, res: ServerResponse, body?: unknown) {
      const path = req.url ?? "/";
      if (!resolveProjectEntry(path)) {
        res.writeHead(404).end();
        return;
      }
      const session = req.headers["mcp-session-id"];
      if (typeof session === "string") {
        const entry = sessions.get(session);
        if (!entry || entry.path !== path) {
          res.writeHead(404).end();
          return;
        }
        await entry.transport.handleRequest(req, res, body);
        return;
      }
      // 2025 clients retain negotiated capabilities and SSE responses; this layer stores protocol connections, not Run state.
      const request = Object.assign(req, {
        method: req.method ?? "GET",
        url: req.url ?? "/",
      });
      const probe = await toWebRequest(request, body);
      if (await isLegacyRequest(probe)) {
        if (
          !body ||
          typeof body !== "object" ||
          !("method" in body) ||
          body.method !== "initialize"
        ) {
          res.writeHead(400).end();
          return;
        }
        if (protocols.size >= 64) {
          res.writeHead(503).end();
          return;
        }
        const server = serverFor(path);
        const transport = new NodeStreamableHTTPServerTransport({
          sessionIdGenerator: randomUUID,
        });
        protocols.add(transport);
        await server.connect(transport);
        const previousClose = transport.onclose;
        transport.onclose = () => {
          previousClose?.();
          protocols.delete(transport);
          if (transport.sessionId) sessions.delete(transport.sessionId);
        };
        try {
          await transport.handleRequest(req, res, body);
          if (transport.sessionId)
            sessions.set(transport.sessionId, { transport, path });
          else await transport.close();
        } catch (error) {
          await transport.close();
          throw error;
        }
        return;
      }
      await node(request, res, body);
    },
    async close() {
      await Promise.allSettled(
        [...protocols].map((transport) => transport.close()),
      );
      protocols.clear();
      sessions.clear();
      await modern.close();
    },
  };
}
