import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { lt, valid } from "semver";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { IntloomError, type ExecutionError } from "@intloom/loom-sdk";
import { requestService } from "./client.ts";

import type { Endpoint, ServiceStatus } from "./protocol.ts";

async function runningService(dataDir: string) {
  try {
    return await requestService(dataDir, "serviceStatus");
  } catch (error) {
    if (error instanceof IntloomError && error.code === "SERVICE_NOT_RUNNING")
      return undefined;
    throw error;
  }
}

export async function startLocalService(
  dataDir: string,
  mcpPort?: number,
  starting?: () => { close(): void },
): Promise<ServiceStatus> {
  let status = await runningService(dataDir);
  if (!status) {
    const display = starting?.();
    const child = spawn(
      process.execPath,
      [fileURLToPath(new URL("./background.js", import.meta.url))],
      {
        cwd: homedir(),
        detached: true,
        stdio: ["ignore", "ignore", "ignore", "ipc"],
      },
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
      // The winner holds the store lock before publishing its endpoint.
      const waitUntil =
        Date.now() +
        (error instanceof IntloomError && error.code === "SERVICE_BUSY"
          ? 10_000
          : 0);
      while (!(await runningService(dataDir))) {
        if (Date.now() >= waitUntil) throw error;
        await delay(50);
      }
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

/** Studio always starts its bundled Kernel. Older services treat SIGTERM and shutdown as cancellation. */
export async function startStudioService(dataDir: string) {
  const { kernelVersion: target } = await import("@intloom/kernel");
  const status = await runningService(dataDir);
  if (status && status.kernelVersion !== target) {
    const previous = status.kernelVersion ?? status.version;
    if (!valid(previous) || lt(target, previous))
      throw new IntloomError(
        "PACKAGE_INCOMPATIBLE",
        `Kernel ${previous} is running. Update Studio to use it.`,
      );
    const descriptor: Endpoint = JSON.parse(
      await readFile(join(dataDir, "service.json"), "utf8"),
    );
    if (
      descriptor.endpoint !== status.endpoint ||
      descriptor.version !== status.version ||
      !Number.isSafeInteger(descriptor.pid) ||
      descriptor.pid <= 1 ||
      descriptor.pid === process.pid
    )
      throw new IntloomError(
        "SERVICE_BUSY",
        "The service changed during the upgrade. Retry startup.",
      );
    // Normal shutdown permanently cancels durable waits, including on 0.3.
    // Verify the PID against the authenticated daemon's log before interrupting it.
    if (
      dirname(status.logPath) !== join(resolve(dataDir), "logs") ||
      !new RegExp(`^service-[0-9]+-${descriptor.pid}\\.jsonl$`).test(
        basename(status.logPath),
      )
    )
      throw new IntloomError(
        "SERVICE_BUSY",
        "Cannot verify the previous background process.",
      );
    await writeFile(join(dataDir, "upgrade-recovery"), target, { mode: 0o600 });
    try {
      process.kill(descriptor.pid, "SIGKILL");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
    }
    for (let i = 0; i < 200; i++) {
      try {
        const current = await requestService(dataDir, "serviceStatus");
        if (current.endpoint !== status.endpoint) break;
      } catch (error) {
        if (
          error instanceof IntloomError &&
          error.code === "SERVICE_NOT_RUNNING"
        )
          break;
        if (
          !(error instanceof IntloomError) ||
          error.code !== "SERVICE_CONNECTION_LOST"
        )
          throw error;
      }
      await delay(25);
    }
  }
  const ready = await startLocalService(dataDir);
  if (ready.kernelVersion !== target)
    throw new IntloomError(
      "SERVICE_BUSY",
      `Expected bundled Kernel ${target}. Retry startup.`,
    );
  return ready;
}
