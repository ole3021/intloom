import { failure } from "../errors.ts";
import {
  projectRoot,
  readConnection,
  readServiceInfo,
} from "../service/discovery.ts";
import {
  serviceStatusSchema,
  serviceUrl,
  type ServiceConnection,
} from "../service/contracts.ts";
import { projectEndpointPath } from "../application/entry.ts";
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

export async function controlRequest(
  connection: ServiceConnection,
  path: "/_status" | "/_stop",
  instanceId?: string,
) {
  const url = new URL(path, serviceUrl(connection));
  try {
    return await fetch(url, {
      method: path === "/_stop" ? "POST" : "GET",
      headers: {
        authorization: `Bearer ${connection.token}`,
        "content-type": "application/json",
      },
      ...(instanceId === undefined
        ? {}
        : { body: JSON.stringify({ instanceId }) }),
      signal: AbortSignal.timeout(5_000),
      redirect: "error",
    });
  } catch (cause) {
    throw failure(
      "CLI_SERVICE_OFFLINE",
      "The local service is unavailable. Check intloom status before starting another Run.",
      cause,
    );
  }
}

export async function serviceStatus(directory: string) {
  const connection = await connectionFor(directory);
  const info = await readServiceInfo(connection.projectRoot);
  if (!info)
    throw failure(
      "CLI_SERVICE_OFFLINE",
      "The project service is offline. Run intloom start.",
    );
  // Always derive loopback addresses from the private connection file; never send credentials to arbitrary metadata URLs.
  if (
    info.url !== serviceUrl(connection) ||
    info.storage !== connection.storage
  )
    throw failure(
      "CLI_SERVICE_METADATA_INVALID",
      "Service identity and connection do not match.",
    );
  const response = await controlRequest(connection, "/_status");
  if (response.status === 503)
    throw failure(
      "CLI_SERVICE_CLOSING",
      "The project service is closing or unavailable; resource release is not confirmed.",
    );
  if (!response.ok)
    throw failure(
      "CLI_SERVICE_UNAVAILABLE",
      `The local service rejected status (${response.status}).`,
    );
  const status = serviceStatusSchema.parse(await response.json());
  if (
    status.instanceId !== info.instanceId ||
    status.projectRoot !== connection.projectRoot ||
    status.url !== info.url ||
    status.pid !== info.pid
  )
    throw failure(
      "CLI_SERVICE_METADATA_INVALID",
      "The listening service does not match the saved project identity.",
    );
  return status;
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
