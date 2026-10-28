import * as z from "zod";
import type { McpServer, CallToolResult } from "@modelcontextprotocol/server";
import {
  appMethods,
  appMetaKey,
  appReadSchema,
  appAnswerSchema,
  appOperationSchema,
} from "@intloom/loom-sdk/app-contracts";
import type { ProjectOperations } from "../../operations/project.ts";
import { toolFailure, toolResult } from "./results.ts";

export function appResult(data: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: "Loom App view updated." }],
    _meta: { [appMetaKey]: data },
  };
}
export async function registerApps(
  server: McpServer,
  application: ProjectOperations,
) {
  const resources = await application.apps.resources();
  if (!resources.length) return;
  for (const resource of resources) {
    server.registerResource(
      resource.toolName,
      resource.uri,
      {
        mimeType: resource.descriptor.mimeType,
        description: `${resource.loomName} / ${resource.appId}`,
      },
      async () => ({
        contents: [
          {
            uri: resource.uri,
            mimeType: resource.descriptor.mimeType,
            text: await resource.readHtml(),
            _meta: {
              ui: {
                csp: {
                  connectDomains: [],
                  resourceDomains: [],
                  frameDomains: [],
                },
              },
            },
          },
        ],
      }),
    );
    server.registerTool(
      resource.toolName,
      {
        description: `Open ${resource.appId} for an existing ${resource.loomName} Run. Does not create or restart a Run.`,
        inputSchema: z.strictObject({ runId: z.string().min(1) }),
        annotations: { readOnlyHint: true, openWorldHint: false },
        _meta: {
          ui: { resourceUri: resource.uri, visibility: ["model"] },
          "ui/resourceUri": resource.uri,
        },
      },
      async ({ runId }) => {
        try {
          const capabilities = server.server.getClientCapabilities();
          const ui = capabilities?.extensions?.["io.modelcontextprotocol/ui"] as
            | { mimeTypes?: string[] }
            | undefined;
          if (!ui?.mimeTypes?.includes(resource.descriptor.mimeType))
            return toolResult({
              run: await application.getRun(runId),
              interaction:
                "Use interact or an exact human answer; this host does not support Loom Apps.",
            });
          return appResult(
            await application.apps.open(
              runId,
              resource.appId,
              resource.loomName,
            ),
          );
        } catch (error) {
          return toolFailure(error);
        }
      },
    );
  }
  server.registerTool(
    appMethods.read,
    {
      description: "Read the bound Loom App view",
      inputSchema: appReadSchema,
      annotations: { readOnlyHint: true, openWorldHint: false },
      _meta: { ui: { visibility: ["app"] } },
    },
    async ({ viewToken }) => {
      try {
        return appResult(await application.apps.read(viewToken));
      } catch (error) {
        return toolFailure(error);
      }
    },
  );
  server.registerTool(
    appMethods.answer,
    {
      description: "Submit a human answer for this view's current interaction",
      inputSchema: appAnswerSchema,
      annotations: {
        readOnlyHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
      _meta: { ui: { visibility: ["app"] } },
    },
    async (input) => {
      try {
        return appResult(await application.apps.answer(input));
      } catch (error) {
        return toolFailure(error);
      }
    },
  );
  server.registerTool(
    appMethods.operation,
    {
      description: "Inspect the original App submission receipt",
      inputSchema: appOperationSchema,
      annotations: { readOnlyHint: true, openWorldHint: false },
      _meta: { ui: { visibility: ["app"] } },
    },
    async (input) => {
      try {
        return appResult(await application.apps.operation(input));
      } catch (error) {
        return toolFailure(error);
      }
    },
  );
}
