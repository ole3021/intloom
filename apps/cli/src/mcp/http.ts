import { IntloomError, type ResponseSource } from "@intloom/loom-sdk";
import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { createServiceClient } from "../service/client.ts";
import { createMcpServer } from "./server.ts";
import { interactionPresenter } from "./interactions.ts";

export async function openMcpHttp(options: {
  dataDir: string;
  token: string;
  port: number;
  nativeResponseSource?: ResponseSource;
  closing(): boolean;
}) {
  const presenter = interactionPresenter(
    createServiceClient(options.dataDir),
    options,
  );
  const handler = createMcpHandler(
    () =>
      createMcpServer({
        dataDir: options.dataDir,
        presenter,
        log: (message) => console.info(`[MCP] ${message}`),
      }),
    { legacy: "reject" },
  );
  const handle = toNodeHandler(handler);
  const expected = Buffer.from(`Bearer ${options.token}`);
  const server = createServer((req, res) => {
    if (options.closing()) {
      res.writeHead(503).end();
      return;
    }
    if (req.url !== "/mcp") {
      res.writeHead(404).end();
      return;
    }
    const host = req.headers.host;
    const port = (server.address() as import("node:net").AddressInfo).port;
    const allowed = [`127.0.0.1:${port}`, `localhost:${port}`];
    if (
      !host ||
      !allowed.includes(host) ||
      (req.headers.origin &&
        !allowed.map((value) => `http://${value}`).includes(req.headers.origin))
    ) {
      res.writeHead(403).end();
      return;
    }
    const supplied = Buffer.from(req.headers.authorization ?? "");
    if (
      supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected)
    ) {
      res.writeHead(401, { "WWW-Authenticate": "Bearer" }).end();
      return;
    }
    // The adapter omits explicit undefined in its optional Node request types.
    void handle(req as Parameters<typeof handle>[0], res);
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", (error: NodeJS.ErrnoException) =>
      reject(
        new IntloomError(
          error.code === "EADDRINUSE" ? "PORT_IN_USE" : "SERVICE_LISTEN_FAILED",
          error.code === "EADDRINUSE"
            ? `MCP port ${options.port} is already in use. Release that port or run intloom startup --port <unused-port>; you can also change service.port in ${options.dataDir}/intloom.yaml.`
            : `Cannot listen on MCP port ${options.port} (${error.code ?? "unknown error"}). Check local permissions or run intloom startup --port <unused-port>.`,
          { port: options.port },
        ),
      ),
    );
    server.listen(options.port, "127.0.0.1", () => {
      server.removeAllListeners("error");
      resolve();
    });
  });
  return {
    url: `http://127.0.0.1:${(server.address() as import("node:net").AddressInfo).port}/mcp`,
    async close() {
      await handler.close();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      });
    },
  };
}
