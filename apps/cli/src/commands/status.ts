import { resolve } from "node:path";
import {
  IntloomError,
  type RunView,
  type RunActivityView,
} from "@intloom/loom-sdk";
import type { CommandContext } from "../context.ts";
import { detailText, printOutput } from "../ui/run-details.ts";
import { watchRun } from "../ui/run-observer.ts";
import { showOverview } from "../ui/overview-observer.ts";
import { serviceHeader } from "../ui/overview.ts";
import { observationExitCode } from "./observation-result.ts";
import { cliName } from "../metadata.ts";

export async function showStatus(ctx: CommandContext) {
  ctx.exact(ctx.operation ? 2 : 1);
  ctx.values.details = Boolean(ctx.operation);
  try {
    if (!ctx.operation) {
      await showOverview(ctx);
      return;
    }
    let run: RunView;
    let activity: RunActivityView;
    if (ctx.values.watch) {
      const observed = await watchRun(ctx, ctx.operation, "status");
      ({ run, activity } = observed);
      process.exitCode = observationExitCode(observed, "status");
    } else {
      activity = await ctx.client("getRunActivity", [ctx.operation]);
      run =
        activity.run.status === "succeeded"
          ? await ctx.client("getRun", [ctx.operation])
          : activity.run;
      if (!ctx.plain) {
        process.stdout.write(
          `${detailText(
            { activity },
            process.stdout,
            true,
            Boolean(ctx.values.details),
          )}\n`,
        );
      }
    }
    if (ctx.plain) {
      ctx.output({
        run,
        activity,
        result: await ctx.client("getRunResult", [run.id]),
        artifacts: activity.artifacts,
        questions: activity.interactions.filter(
          (request) => request.status === "pending",
        ),
      });
    } else printOutput(ctx, run);
  } catch (error) {
    if (
      !(error instanceof IntloomError) ||
      error.code !== "SERVICE_NOT_RUNNING"
    )
      throw error;
    if (ctx.plain)
      ctx.output({ status: "offline", dataDir: resolve(ctx.dataDir) });
    else
      process.stdout.write(
        `${serviceHeader("offline", ctx.dataDir, process.stdout)}\n\nStart Intloom service  ${cliName} startup\nRun a Loom  ${cliName} run <loom> (starts the Intloom service as needed)\n`,
      );
  }
}
