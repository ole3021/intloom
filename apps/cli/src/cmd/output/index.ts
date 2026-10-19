import type { CoreResult } from "../../core/index.ts";
import { formatResult } from "./render.ts";
import { formatLog } from "../../shared/presentation/logs.ts";
import type { CliIo } from "../context.ts";
import type { CliCore } from "../../core/index.ts";
export function createOutput(
  io: CliIo,
  common: Record<string, unknown>,
  args: readonly string[],
) {
  let exitCode = 0;
  let lastResult: CoreResult<unknown> | undefined;
  const machine = common.json === true;
  const command = ["loom", "config", "mcp", "mirror"].includes(args[0] ?? "")
    ? args.slice(0, 2).join(" ")
    : args[0];
  function print(result: CoreResult<unknown>, exportedTo?: string) {
    lastResult = result;
    const data = result.data;
    const run =
      data && typeof data === "object" && "run" in data ? data.run : data;
    const receipt =
      data && typeof data === "object" && "receipt" in data
        ? data.receipt
        : undefined;
    if (
      !result.ok ||
      (receipt &&
        typeof receipt === "object" &&
        "status" in receipt &&
        (receipt.status === "rejected" ||
          receipt.status === "indeterminate")) ||
      (args[0] !== "cancel" &&
        args[0] !== "runs" &&
        run &&
        typeof run === "object" &&
        "status" in run &&
        run.status === "failed")
    )
      exitCode = 1;
    (machine || result.ok ? io.output : io.error).write(
      machine
        ? `${JSON.stringify(result)}\n`
        : `${formatResult(result, {
            ...(command ? { command } : {}),
            debug: common.debug === true,
            ...(exportedTo ? { exportedTo } : {}),
          })}\n`,
    );
  }
  async function diagnostics(core: CliCore) {
    if (
      (common.debug || common.info) &&
      args[0] !== "logs" &&
      lastResult?.meta.projectRoot
    ) {
      const logs = await core.readLogs({
        projectPath: lastResult.meta.projectRoot,
        level: common.debug ? "debug" : "info",
        ...(args[0] === "start"
          ? {}
          : lastResult.meta.runId
            ? { runId: lastResult.meta.runId }
            : { requestId: lastResult.meta.requestId }),
      });
      if (logs.ok)
        for (const record of logs.data)
          io.error.write(
            machine
              ? `${record.level === 20 ? "DEBUG " : ""}${JSON.stringify(record)}\n`
              : formatLog(record, common.debug === true, true),
          );
    }
  }
  return {
    print,
    diagnostics,
    setExitCode(code: number) {
      exitCode = code;
    },
    get exitCode() {
      return exitCode;
    },
  };
}
