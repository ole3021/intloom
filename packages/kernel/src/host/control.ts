import { failure } from "../errors.ts";
import { projectRoot, readConnection, readServiceInfo } from "./discovery.ts";
import {
  serviceStatusSchema,
  serviceUrl,
  type ServiceConnection,
  type ServiceStatus,
} from "./contracts.ts";
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
  const signal = AbortSignal.timeout(5_000);
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
      signal,
      redirect: "error",
    });
  } catch (cause) {
    const timedOut = path === "/_status" && signal.aborted;
    throw failure(
      timedOut ? "CLI_SERVICE_TIMEOUT" : "CLI_SERVICE_OFFLINE",
      timedOut
        ? "The local Service request timed out. Check intloom status before starting another Run."
        : "The local service is unavailable. Check intloom status before starting another Run.",
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
  const text = await response.text().catch((cause: unknown) => {
    // Control requests have only an internal timeout signal; they cannot be cancelled by a caller.
    const timedOut =
      cause instanceof Error &&
      (cause.name === "TimeoutError" || cause.name === "AbortError");
    throw failure(
      timedOut ? "CLI_SERVICE_TIMEOUT" : "CLI_SERVICE_OFFLINE",
      timedOut
        ? "The Service status response timed out."
        : "The connection ended before a Service status response was received.",
      cause,
    );
  });
  let status: ServiceStatus;
  try {
    status = serviceStatusSchema.parse(JSON.parse(text));
  } catch {
    throw failure(
      "CLI_RESULT_INVALID",
      "The Service status response is not valid status JSON.",
    );
  }
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
