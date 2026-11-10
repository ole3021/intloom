import { open } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { IntloomError } from "@intloom/loom-sdk";
import { allItems, type CommandContext } from "../context.ts";
import type { ServiceLogRecord, ServiceStatus } from "../service/protocol.ts";
import { serviceDisplay } from "./service.ts";

export async function observeService(
  ctx: CommandContext,
  initial: ServiceStatus,
) {
  const display = serviceDisplay(ctx.dataDir, !ctx.plain, initial.logPath);
  const file = await open(initial.logPath, "r");
  let offset = 0;
  let pending = Buffer.alloc(0);
  let stopped = false;
  let revision = -1;
  let closing = false;
  const stop = () => {
    stopped = true;
    process.exitCode = 130;
  };
  const read = async () => {
    const buffer = Buffer.alloc(64 * 1024);
    let bytesRead: number;
    do {
      ({ bytesRead } = await file.read(buffer, 0, buffer.length, offset));
      offset += bytesRead;
      pending = Buffer.concat([pending, buffer.subarray(0, bytesRead)]);
      while (pending.includes(10)) {
        const end = pending.indexOf(10);
        const record = JSON.parse(
          pending.subarray(0, end).toString("utf8"),
        ) as ServiceLogRecord;
        pending = pending.subarray(end + 1);
        if (record.kind === "diagnostic")
          display.diagnostic(record.level, record, record.time);
        else display.event(record.event, record.loomId, record.error);
      }
    } while (bytesRead === buffer.length && !stopped);
  };
  process.once("SIGINT", stop);
  try {
    display.ready(initial.mcpUrl);
    if (ctx.plain || !process.stdout.isTTY) ctx.output(initial);
    do {
      await read();
      const status = await ctx.client("serviceStatus");
      if (status.endpoint !== initial.endpoint) break;
      if (status.status === "closing" && !closing) {
        closing = true;
        display.stopping();
      }
      if (status.runRevision !== revision) {
        revision = status.runRevision;
        const runs = await allItems((page) =>
          ctx.client("listUnfinishedRuns", [page]),
        );
        for (const run of runs)
          display.activity(await ctx.client("getRunActivity", [run.id]));
        display.retain(runs.map((run) => run.id));
      }
      if (!stopped) await delay(250);
    } while (!stopped);
  } catch (error) {
    if (
      !(error instanceof IntloomError) ||
      ![
        "SERVICE_NOT_RUNNING",
        "SERVICE_BUSY",
        "SERVICE_CONNECTION_LOST",
      ].includes(error.code)
    )
      throw error;
    await read();
    display.closed();
  } finally {
    process.off("SIGINT", stop);
    await file.close();
    display.close();
    if (stopped)
      process.stderr.write(
        "Observation ended. Intloom continues running; use intloom shutdown to stop the service.\n",
      );
  }
}
