import { writeSync } from "node:fs";
import { getLogger, silentLogger, type LogHandle } from "@intloom/utils";

/** Observe fatal exits without installing a recovery handler or continuing execution. */
export function installFatalLogging(logs: LogHandle): () => void {
  let recorded = false;
  const monitor = (err: Error, origin: string) => {
    if (recorded) return;
    recorded = true;
    try {
      const current = getLogger();
      (current === silentLogger ? logs.logger : current).fatal(
        "process_failed",
        {
          err,
          origin:
            origin === "unhandledRejection"
              ? "unhandled_rejection"
              : "uncaught_exception",
        },
      );
      logs.flush();
    } catch {
      try {
        writeSync(2, "Fatal execution error; diagnostic log unavailable.\n");
      } catch {
        /* Preserve the original fatal exit even when stderr is unavailable. */
      }
    }
  };
  process.on("uncaughtExceptionMonitor", monitor);
  return () => process.off("uncaughtExceptionMonitor", monitor);
}
