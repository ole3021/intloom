import { mkdirSync, openSync, closeSync, writeSync } from "node:fs";
import { join } from "node:path";
import { format, stripVTControlCharacters } from "node:util";
import { currentExecutionLog } from "@intloom/kernel";
import { openService } from "./server.ts";
import { publicError, type ServiceLogRecord } from "./protocol.ts";

// Launch configuration comes only from the parent, not a public instance selector.
process.once(
  "message",
  async (options: { dataDir: string; mcpPort?: number }) => {
    const directory = join(options.dataDir, "logs");
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const logPath = join(
      directory,
      `service-${Date.now()}-${process.pid}.jsonl`,
    );
    const file = openSync(logPath, "a", 0o600);
    const write = (entry: ServiceLogRecord) =>
      writeSync(file, `${JSON.stringify(entry)}\n`);
    for (const method of ["log", "info", "debug", "warn", "error"] as const)
      console[method] = (...args: unknown[]) => {
        const message = stripVTControlCharacters(format(...args));
        write({
          kind: "diagnostic",
          time: new Date().toISOString(),
          level: method === "log" ? "info" : method,
          ...(currentExecutionLog(message) ?? { message }),
        });
      };
    let server: Awaited<ReturnType<typeof openService>> | undefined;
    const changed = new Set<string>();
    const cursors = new Map<string, number>();
    let updating: Promise<void> | undefined;
    const refresh = () => {
      if (!server || updating) return;
      const kernel = server.kernel;
      updating = (async () => {
        while (changed.size) {
          const runId = changed.values().next().value as string;
          changed.delete(runId);
          let page: Awaited<ReturnType<typeof kernel.listRunEvents>>;
          do {
            page = await kernel.listRunEvents({
              runId,
              after: cursors.get(runId) ?? 0,
              limit: 100,
            });
            const run = await kernel.getRun(runId);
            for (const event of page.items) {
              write({
                kind: "event",
                event,
                loomId: run.loom.id,
                ...((event.type === "run.failed" ||
                  event.type === "run.interrupted") &&
                run.error
                  ? { error: run.error }
                  : {}),
              });
              cursors.set(runId, event.seq);
            }
          } while (page.nextAfter !== undefined);
        }
      })()
        .catch((error) => console.error(error))
        .finally(() => {
          updating = undefined;
          if (changed.size) refresh();
        });
    };
    try {
      server = await openService({
        ...options,
        logPath,
        onRunEvents: (notice) => {
          changed.add(notice.runId);
          refresh();
        },
      });
      refresh();
      console.info(`Intloom service ready · ${server.mcpUrl}`);
      process.send?.({ ok: true });
      const { close } = server;
      const stop = () => {
        void close().catch((error) => console.error(error));
      };
      // The service has its own process group; Ctrl+C belongs to the foreground observer.
      process.on("SIGTERM", stop);
      process.on("SIGINT", stop);
      await server.done;
      await updating;
      console.info("Intloom service stopped");
      process.off("SIGTERM", stop);
      process.off("SIGINT", stop);
    } catch (error) {
      const projected = publicError(error);
      console.error(`${projected.code}: ${projected.message}`);
      if (process.connected) process.send?.({ ok: false, error: projected });
      process.exitCode = 1;
    } finally {
      closeSync(file);
      if (process.connected) process.disconnect?.();
    }
  },
);
