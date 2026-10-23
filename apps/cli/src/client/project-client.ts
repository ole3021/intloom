import { failure } from "../errors.ts";
import {
  projectRoot,
  readConnection,
  serviceStatus,
  serviceUrl,
} from "@intloom/kernel/host";
export { serviceStatus } from "@intloom/kernel/host";
import { projectEndpointPath } from "@intloom/kernel/operations";
import type {
  ProjectClient,
  ProjectConnection,
  ProjectClientOptions,
} from "./contracts.ts";
import { connectProjectClient } from "./mcp-client.ts";

async function connectionFor(directory: string) {
  const root = await projectRoot(directory);
  const connection = await readConnection(root);
  if (!connection)
    throw failure(
      "CLI_SERVICE_OFFLINE",
      "Run intloom start in this project first.",
    );
  return connection;
}

/** Discovers and verifies the local host before passing credentials to its fixed entry. */
export async function discoverProjectConnection(
  directory: string,
  source: "cli" | "studio" = "cli",
): Promise<ProjectConnection> {
  if (source !== "cli" && source !== "studio")
    throw failure(
      "INVALID_REQUEST",
      "Local discovery requires a CLI or Studio entry.",
    );
  await serviceStatus(directory);
  const connection = await connectionFor(directory);
  return {
    url: new URL(projectEndpointPath(source), serviceUrl(connection)).href,
    token: connection.token,
  };
}

/** CLI convenience factory; Studio backends may discover their own entry and use connectProjectClient. */
export async function connectProject(
  directory: string,
  options: ProjectClientOptions = {},
): Promise<ProjectClient> {
  return connectProjectClient(
    await discoverProjectConnection(directory),
    options,
  );
}
