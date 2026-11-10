import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { IntloomError, type ExecutionError } from "@intloom/loom-sdk";
import { requestService } from "./client.ts";

import type { ServiceStatus } from "./protocol.ts";

export async function startLocalService(
  dataDir: string,
  mcpPort?: number,
  starting?: () => { close(): void },
): Promise<ServiceStatus> {
  let status: ServiceStatus | undefined;
  try {
    status = await requestService(dataDir, "serviceStatus");
  } catch (error) {
    if (
      !(error instanceof IntloomError) ||
      error.code !== "SERVICE_NOT_RUNNING"
    )
      throw error;
  }
  if (!status) {
    const display = starting?.();
    const child = spawn(
      process.execPath,
      [fileURLToPath(new URL("./background.js", import.meta.url))],
      { detached: true, stdio: ["ignore", "ignore", "ignore", "ipc"] },
    );
    try {
      await new Promise<void>((ready, reject) => {
        child.once("error", reject);
        child.once(
          "message",
          (message: { ok: true } | { ok: false; error: ExecutionError }) => {
            if (message.ok) ready();
            else
              reject(
                new IntloomError(
                  message.error.code,
                  message.error.message,
                  message.error.details,
                ),
              );
          },
        );
        child.once("exit", () =>
          reject(
            new IntloomError(
              "SERVICE_START_FAILED",
              `Could not start Intloom. Check the service logs in ${dataDir}/logs and retry intloom startup.`,
            ),
          ),
        );
        child.send({ dataDir, mcpPort });
      });
    } catch (error) {
      // Another first invocation may already have acquired the service lock.
      await requestService(dataDir, "serviceStatus").catch(() => {
        throw error;
      });
    } finally {
      display?.close();
      if (child.connected) child.disconnect();
      child.unref();
    }
    status = await requestService(dataDir, "serviceStatus");
  }
  if (mcpPort && Number(new URL(status.mcpUrl).port) !== mcpPort)
    throw new IntloomError(
      "SERVICE_PORT_MISMATCH",
      `Intloom is already running at ${status.mcpUrl}. Run intloom shutdown, then intloom startup --port ${mcpPort} to change the port.`,
    );
  return status;
}
