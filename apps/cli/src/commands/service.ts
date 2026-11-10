import { allItems } from "../context.ts";
import { confirm, interactive } from "../ui/prompts.ts";
import { wrapText } from "../ui/theme.ts";
import { ensureService } from "../service/process.ts";
import { observeService } from "../ui/service-observer.ts";
import { progress } from "../ui/live.ts";
import { setTimeout as delay } from "node:timers/promises";
import { IntloomError } from "@intloom/loom-sdk";
import type { CommandContext } from "../context.ts";
export async function runServiceCommand(ctx: CommandContext) {
  const { command, dataDir, mcpPort, output, client, exact, plain } = ctx;
  if (command === "startup") {
    exact(1);
    const service = await ensureService(dataDir, !plain, mcpPort);
    await observeService(ctx, service);
    return;
  }
  if (command === "shutdown") {
    exact(1);
    try {
      const service = await client("serviceStatus");
      for (const issue of service.storageIssues)
        process.stderr.write(
          `${issue.message}\nShutdown will retain stop requests for inaccessible Runs; they cannot resume when storage returns.\n`,
        );
    } catch (error) {
      if (
        !(error instanceof IntloomError) ||
        error.code !== "SERVICE_NOT_RUNNING"
      )
        throw error;
      output({ status: "stopped" });
      return;
    }
    const runs = await allItems((page) => client("listUnfinishedRuns", [page]));
    process.stderr.write(
      `${wrapText(
        [
          "Shut down Intloom service",
          `Service  ${dataDir}`,
          ...runs.map(
            (run) =>
              `${run.id}  ${run.loom.id}  ${run.status}  ${run.location.storage}  ${run.location.projectDir ?? "No project"}`,
          ),
          `Cancel ${runs.length} unfinished Runs and close the MCP endpoint. Cancelled Runs cannot resume.`,
        ].join("\n"),
        process.stderr,
      )}\n`,
    );
    if (!interactive())
      throw new IntloomError(
        "CONFIRMATION_REQUIRED",
        "Run intloom shutdown in an interactive terminal to confirm.",
      );
    if (!(await confirm("Cancel these Runs and shut down Intloom?"))) return;
    const display = progress(
      "Stopping Runs and closing MCP",
      "waiting",
      !plain,
    );
    let done = false;
    const shutdown = client("serviceShutdown").finally(() => {
      done = true;
    });
    const monitor = (async () => {
      let previous = -1;
      while (!done) {
        const state = await client("serviceStatus").catch(() => undefined);
        if (state && state.activeRunCount !== previous) {
          previous = state.activeRunCount;
          process.stderr.write(
            `Shutting down · ${previous} active Runs still settling\n`,
          );
        }
        if (!done) await delay(250);
      }
    })();
    try {
      output(await shutdown);
    } finally {
      await monitor;
      display.close();
    }
  }
}
