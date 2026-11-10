import type { ResponseSource } from "@intloom/loom-sdk";
import { Server } from "@modelcontextprotocol/server";
import { createServiceClient } from "../service/client.ts";
import { version } from "../metadata.ts";
import { interactionPresenter } from "./interactions.ts";
import { registerTools } from "./tool-handlers.ts";
import { registerResources } from "./resources.ts";

export function createMcpServer(options: {
  dataDir: string;
  projectDir?: string;
  /** Automated form tests must record test provenance, never human authorization. */
  nativeResponseSource?: ResponseSource;
  log?: (message: string) => void;
  presenter?: ReturnType<typeof interactionPresenter>;
}) {
  const client = createServiceClient(options.dataDir, options.projectDir);
  const presenter = options.presenter ?? interactionPresenter(client, options);
  const server = new Server(
    { name: "intloom", version },
    {
      capabilities: { tools: {}, resources: {} },
      supportedProtocolVersions: ["2026-07-28"],
      inputRequired: { legacyShim: false },
      requestState: { verify: presenter.verify },
    },
  );
  registerTools(server, client, presenter.prompt, options.log, (directory) =>
    createServiceClient(options.dataDir, directory),
  );
  registerResources(server, client);
  return server;
}
