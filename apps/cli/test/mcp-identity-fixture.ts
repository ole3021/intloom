import { randomUUID } from "node:crypto";
import type { Client } from "@modelcontextprotocol/client";

/** An actual test consumer binds mutations to the service identity read during connection. */
export async function bindMutationIdentity(client: Client) {
  const call = client.callTool.bind(client);
  const status = await call({ name: "status", arguments: {} });
  const service = (
    status.structuredContent as { service?: { instanceId: string } } | undefined
  )?.service;
  if (!service?.instanceId) throw new Error("Missing Service identity");
  client.callTool = (request, options) =>
    call(
      {
        ...request,
        ...(new Set([
          "run",
          "answer_ask",
          "interact",
          "cancel_run",
          "pause_run",
          "resume_run",
        ]).has(request.name)
          ? {
              arguments: {
                operationId: randomUUID(),
                serviceInstanceId: service.instanceId,
                ...request.arguments,
              },
            }
          : {}),
      },
      options,
    );
}
