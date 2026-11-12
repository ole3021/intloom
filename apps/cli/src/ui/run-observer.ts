import type { CommandContext } from "../context.ts";
import { observeRun, type ObservationResult } from "../operations/observe.ts";
import { printMarkdownDeliveries } from "./markdown.ts";
import { interactive } from "./prompts.ts";
import { logPage } from "./page.ts";
import { eventLine } from "./run.ts";
import { pathLine, heading, paint, wrapText } from "./theme.ts";
import { cliName } from "../metadata.ts";
import { activityText } from "./run-activity.ts";
import { detailText } from "./run-details.ts";
import { remainingRows } from "./layout.ts";

export async function watchRun(
  ctx: CommandContext,
  id: string,
  mode: "execute" | "status",
  cursor = { after: 0 },
  answered?: string,
) {
  const until = mode === "status" ? "terminal" : ctx.observation.until;
  const { timeoutMs } = ctx.observation;
  const stream =
    mode === "status" && !ctx.plain ? process.stdout : process.stderr;
  const initial = await ctx.client("getRun", [id]);
  const location = initial.location;
  const projectDir = location.projectDir;
  const dataDir = location.dataDir;
  const page = logPage(
    stream,
    dataDir,
    `run-${id}`,
    Boolean(process.stdout.isTTY),
  );
  const observation = new AbortController();
  let lastDetails = "",
    finalDetails = "";
  const stop = () => {
    observation.abort();
  };
  process.once("SIGINT", stop);
  if (ctx.plain && mode === "execute")
    page.line(`Watching Run ${id} until ${until}.`);
  let result: ObservationResult;
  try {
    result = await observeRun({
      client: ctx.client,
      runId: id,
      until,
      timeoutMs,
      answered,
      cursor,
      signal: observation.signal,
      events(events, loomId) {
        for (const event of events.items) {
          if (event.seq <= cursor.after) continue;
          if (eventLine(event, stream, loomId))
            page.line((target) => eventLine(event, target, loomId) ?? "");
        }
      },
      activity(activity, waiting, terminal) {
        const { run } = activity;
        page.frame((elapsedMs) => {
          const context = [
            heading(stream, "Run"),
            ...(location.directory
              ? [
                  pathLine(
                    "Directory",
                    location.directory,
                    stream,
                    Boolean(ctx.values.details),
                  ),
                ]
              : []),
            ...(projectDir
              ? [
                  pathLine(
                    "Project",
                    projectDir,
                    stream,
                    Boolean(ctx.values.details),
                  ),
                ]
              : []),
            `Storage  ${location.storage}`,
            pathLine("Data", dataDir, stream, Boolean(ctx.values.details)),
            pathLine("Log", page.path, stream, Boolean(ctx.values.details)),
          ];
          return [
            ...context,
            activityText(activity, stream, {
              elapsedMs,
              ...(page.dynamic
                ? {
                    maxLines: remainingRows(stream, context.join("\n"), {
                      reserved: 4,
                      minimum: 2,
                    }),
                  }
                : {}),
            }),
            ...(ctx.plain
              ? []
              : [paint(stream, "dim", "Ctrl+C to stop watching")]),
          ].join("\n");
        });
        if (
          (terminal || waiting) &&
          (run.updatedAt !== lastDetails || terminal)
        ) {
          lastDetails = run.updatedAt;
          if (
            !(
              waiting &&
              mode === "execute" &&
              interactive() &&
              run.pendingInteractionIds.length
            )
          ) {
            page.line((target) =>
              detailText(
                { activity },
                target,
                false,
                Boolean(ctx.values.details),
              ),
            );
            if (terminal || until === "waiting")
              finalDetails = detailText(
                { activity },
                stream,
                true,
                Boolean(ctx.values.details),
              );
          }
        }
      },
    });
    if (
      ctx.plain &&
      mode === "execute" &&
      result.reason !== "interrupted" &&
      result.reason !== "timeout"
    ) {
      page.line(
        `Run ${id}: ${result.run.status}; quality: ${result.activity.result.quality}`,
      );
      for (const request of result.run.pendingInteractionIds)
        page.line(`${cliName} interaction respond ${request}`);
    }
  } finally {
    page.close(!finalDetails);
    if (page.dynamic)
      stream.write(
        `${wrapText(`${finalDetails ? `${finalDetails}\n` : ""}${pathLine("Log", page.path, stream, true)}`, stream)}\n`,
      );
    process.off("SIGINT", stop);
  }
  if (
    !ctx.plain &&
    process.stdout.isTTY &&
    result.reason === "terminal" &&
    result.run.status === "succeeded" &&
    result.activity.result.quality !== "rejected"
  )
    await printMarkdownDeliveries(ctx.client, result, process.stdout);
  return result;
}
