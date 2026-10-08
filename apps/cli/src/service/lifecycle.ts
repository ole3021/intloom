import { fork } from "node:child_process";
import { join } from "node:path";
import { isLoomError, loadConfig } from "@intloom/kernel";
import { serviceStatus } from "../client/service-client.ts";
import { failure } from "../errors.ts";
import { projectRoot } from "./discovery.ts";
import { errorViewSchema, serviceInfoSchema } from "./contracts.ts";
import type { StartHostOptions } from "./host.ts";
export { stopService, type StopServiceResult } from "./stop-service.ts";

export async function startService(
  options: StartHostOptions,
  onLogFile?: (filePath: string) => void,
) {
  const root = await projectRoot(options.projectRoot);
  try {
    const existing = await serviceStatus(root);
    const configured = (await loadConfig(root)).localStorage ?? "file";
    if (
      configured !== existing.storage ||
      (options.port && new URL(existing.url).port !== String(options.port))
    )
      throw failure(
        "CLI_SERVICE_CONFLICT",
        "Stop the running service before changing its storage or port.",
      );
    return { service: existing, reused: true };
  } catch (error) {
    if (!isLoomError(error) || error.code !== "CLI_SERVICE_OFFLINE")
      throw error;
  }
  // The new host opens its log before configuration parsing so startup failures remain inspectable.
  const child = fork(
    new URL("./entry.js", import.meta.url),
    [JSON.stringify({ ...options, projectRoot: root })],
    {
      detached: true,
      stdio: ["ignore", "ignore", "ignore", "ipc"],
      execArgv: ["--unhandled-rejections=strict"],
    },
  );
  try {
    await new Promise<void>((resolveReady, rejectReady) => {
      const timer = setTimeout(
        () =>
          rejectReady(
            failure(
              "CLI_SERVICE_TIMEOUT",
              "The service did not finish initialization and Workflow restoration within 5 minutes.",
            ),
          ),
        300_000,
      );
      const done = (error?: unknown) => {
        clearTimeout(timer);
        child.off("message", message);
        child.off("error", onError);
        child.off("exit", exited);
        if (error) rejectReady(error);
        else resolveReady();
      };
      const onError = (cause: Error) =>
        done(
          failure(
            "CLI_SERVICE_UNAVAILABLE",
            "Could not launch the Node.js project service.",
            cause,
          ),
        );
      const exited = () =>
        done(
          failure(
            "CLI_SERVICE_UNAVAILABLE",
            "The service exited during initialization.",
          ),
        );
      const message = (value: unknown) => {
        if (
          value &&
          typeof value === "object" &&
          "logFile" in value &&
          typeof value.logFile === "string" &&
          /^LOG-\d{8}T\d{9}Z\.jsonl$/u.test(value.logFile) &&
          !("instanceId" in value)
        ) {
          onLogFile?.(join(root, ".intloom", "logs", value.logFile));
          return;
        }
        const ready = serviceInfoSchema.safeParse(value);
        if (ready.success && ready.data.projectRoot === root) {
          done();
          return;
        }
        const error = errorViewSchema.safeParse(value);
        if (error.success) done(failure(error.data.code, error.data.message));
      };
      child.on("message", message);
      child.once("error", onError);
      child.once("exit", exited);
    });
    if (child.connected) child.disconnect();
    child.unref();
    return { service: await serviceStatus(root), reused: false };
  } catch (error) {
    // Terminates only the new child before ownership is handed off; old metadata PIDs are not trusted.
    if (child.connected) child.disconnect();
    if (child.exitCode === null && child.signalCode === null)
      child.kill("SIGTERM");
    child.unref();
    throw error;
  }
}
