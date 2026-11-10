import { setTimeout as delay } from "node:timers/promises";
import { resolve } from "node:path";
import type { RunActivityView } from "@intloom/loom-sdk";
import { allItems, type CommandContext } from "../context.ts";
import { liveOutput } from "./live.ts";
import { remainingRows } from "./layout.ts";
import { finished } from "./run.ts";
import { serviceHeader, runCounts, runOverview } from "./overview.ts";
import { paint } from "./theme.ts";
import { cliName } from "../metadata.ts";

export async function showOverview(ctx: CommandContext) {
  const watch = Boolean(ctx.values.watch);
  const view = liveOutput(process.stdout, watch && !ctx.plain, true);
  const cached = new Map<
    string,
    { updatedAt: string; activity: RunActivityView }
  >();
  let endpoint: string | undefined;
  let previous: string | undefined;
  let stopped = false;
  const stop = () => {
    stopped = true;
    process.exitCode = 130;
  };
  if (watch) process.once("SIGINT", stop);
  try {
    do {
      const service = await ctx.client("serviceStatus");
      if (endpoint !== service.endpoint) cached.clear();
      endpoint = service.endpoint;
      const version = `${service.endpoint}/${service.status}/${service.runRevision}/${service.storageIssues.length}/${process.stdout.columns}/${process.stdout.rows}`;
      if (version !== previous) {
        previous = version;
        const [unfinished, { recent, totalRuns }] = await Promise.all([
          allItems((page) => ctx.client("listUnfinishedRuns", [page])),
          ctx.client("getRunOverview"),
        ]);
        const ended = new Set(recent.map((run) => run.id));
        const open = unfinished.filter((run) => !ended.has(run.id));
        const runs = [...open, ...recent];
        if (ctx.plain) {
          ctx.output({
            service,
            dataDir: resolve(ctx.dataDir),
            runs,
            totalRuns,
            historyLimit: 10,
          });
          if (!watch) return;
        } else {
          const activities = new Map<string, RunActivityView>();
          for (const run of runs) {
            const entry = cached.get(run.id);
            if (finished(run) && entry?.updatedAt === run.updatedAt)
              activities.set(run.id, entry.activity);
          }
          const stream = process.stdout;
          const header = `${serviceHeader(service.status, ctx.dataDir, stream, undefined, true)}\nMCP      ${service.mcpUrl}\nToken    ${service.tokenPath}\nLog      ${service.logPath}\n${service.storageIssues.map((issue) => issue.message).join("\n")}\n${runCounts(open, totalRuns)} · Latest 10 finished Runs`;
          const footer = `\n\n${paint(stream, "dim", `Details  ${cliName} status <runId>`)}\n${paint(stream, "dim", watch ? "Ctrl+C to stop watching" : `Watch  ${cliName} status --watch`)}`;
          const layout = (elapsed?: number) =>
            runOverview(runs, stream, {
              elapsed,
              activities,
              ...(watch && view.dynamic
                ? { maxLines: remainingRows(stream, header + footer) }
                : {}),
            });
          // Measure rows before hydrating; a projected summary can wrap differently from its placeholder.
          for (;;) {
            const missing = layout().visibleRuns.filter(
              (run) => !activities.has(run.id),
            );
            if (!missing.length) break;
            // Static overviews may contain hundreds of Runs; bound IPC fan-out.
            for (let offset = 0; offset < missing.length; offset += 16)
              await Promise.all(
                missing
                  .slice(offset, offset + 16)
                  .map(async (run) =>
                    activities.set(
                      run.id,
                      await ctx.client("getRunActivity", [run.id]),
                    ),
                  ),
              );
          }
          cached.clear();
          for (const run of layout().visibleRuns) {
            const activity = activities.get(run.id);
            if (finished(run) && activity)
              cached.set(run.id, { updatedAt: run.updatedAt, activity });
          }
          const frame = (elapsed?: number) =>
            header + layout(elapsed).text + footer;
          if (watch)
            view.frame(runs.some((r) => !finished(r)) ? frame : frame());
          else view.line(frame());
        }
      }
      if (watch && !stopped) await delay(500);
    } while (watch && !stopped);
  } finally {
    if (watch) process.off("SIGINT", stop);
    view.close(watch && stopped);
  }
}
