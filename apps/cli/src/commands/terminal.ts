import * as p from "@clack/prompts";
import { finished } from "../ui/run.ts";
import type { RunView } from "@intloom/loom-sdk";
import { IntloomError } from "@intloom/loom-sdk";
import { answer, choose, menu, confirm, terminalIO } from "../ui/prompts.ts";
import { allItems, type CommandContext } from "../context.ts";
import { ensureService } from "../service/process.ts";
import { pathLine, wrapText } from "../ui/theme.ts";

async function pick<T>(
  message: string,
  items: readonly T[],
  label: (item: T) => string,
) {
  if (!items.length) {
    process.stderr.write("No records yet.\n");
    return;
  }
  return items[await choose(message, [...items.map(label), "Back"], true)];
}
export async function terminal(
  ctx: CommandContext,
  execute: (args: string[]) => Promise<void>,
) {
  p.intro("Intloom", terminalIO);
  process.stderr.write(
    `${wrapText(`${pathLine("Project", ctx.string("project") ?? process.cwd(), process.stderr)}\n${pathLine("Data", ctx.dataDir, process.stderr)}\n`, process.stderr)}\n`,
  );
  while (true) {
    const choice = await menu("What would you like to do?", [
      { value: "run", label: "Run a Loom" },
      { value: "runs", label: "View Runs" },
      { value: "looms", label: "Manage Looms" },
      { value: "kernel", label: "Intloom service status" },
      { value: "quit", label: "Quit" },
    ]);
    if (choice === "quit") return;
    if (choice === "kernel") {
      await execute(["status"]);
      const action = await menu("Intloom service", [
        { value: "back", label: "Back" },
        { value: "start", label: "Startup" },
        { value: "stop", label: "Shutdown" },
      ]);
      if (action === "start")
        await ensureService(ctx.dataDir, !ctx.plain, ctx.mcpPort);
      if (action === "stop") await execute(["shutdown"]);
      continue;
    }
    if (choice === "looms") {
      const action = await menu("Manage Looms", [
        { value: "list", label: "View installed Looms" },
        { value: "install", label: "Install a Loom" },
        { value: "back", label: "Back" },
      ]);
      if (action === "back") continue;
      if (action === "install") {
        const source = answer(
          await p.text({
            ...terminalIO,
            message: "npm package name or local archive path",
          }),
        );
        if (source) await execute(["install", source]);
        continue;
      }
    }
    if (choice === "runs") {
      let records: RunView[];
      try {
        records = await allItems((page) => ctx.client("listRuns", [page]));
      } catch (error) {
        if (
          !(error instanceof IntloomError) ||
          error.code !== "SERVICE_NOT_RUNNING"
        )
          throw error;
        await execute(["status"]);
        continue;
      }
      const run = await pick(
        "Select a Run",
        records,
        (r) => `${r.loom.id} · ${r.status} · ${r.id}`,
      );
      if (!run) continue;
      await execute(["status", run.id]);
      const activity = await ctx.client("getRunActivity", [run.id]);
      const current = activity.run;
      const action = await menu("Next action", [
        { value: "back", label: "Back" },
        ...(current.status === "created"
          ? [{ value: "start", label: "Start Run" }]
          : []),
        ...(!finished(current)
          ? [
              { value: "watch", label: "Watch" },
              { value: "stop", label: "Stop Run" },
            ]
          : []),
        ...(current.status === "waiting"
          ? [{ value: "resume", label: "Answer or resume" }]
          : []),
        ...(activity.artifacts.length
          ? [{ value: "artifacts", label: "Artifacts" }]
          : []),
      ]);
      if (action === "watch") await execute(["status", run.id, "--watch"]);
      if (action === "start") await execute(["run", "start", run.id]);
      if (action === "resume") await execute(["run", "resume", run.id]);
      if (action === "artifacts") {
        const file = await pick(
          "Select a file",
          await allItems((page) =>
            ctx.client("listArtifacts", [{ ...page, runId: run.id }]),
          ),
          (f) => f.name,
        );
        if (file) {
          const dest = answer(
            await p.text({
              ...terminalIO,
              message: "Export path (leave blank to preview text)",
            }),
          );
          if (dest)
            await execute(["artifact", "export", file.id, "--out", dest]);
          else if (file.mediaType.startsWith("text/"))
            await execute(["artifact", "read", file.id]);
        }
      }
      if (
        action === "stop" &&
        (await confirm("Stop this Run? It cannot resume."))
      )
        await execute(["run", "stop", run.id]);
      continue;
    }
    await ensureService(ctx.dataDir, !ctx.plain, ctx.mcpPort);
    const items = await allItems((page) => ctx.client("listLooms", [page]));
    if (choice === "run" && !items.length) {
      const name = answer(
        await p.text({
          ...terminalIO,
          message: "First run · Enter the Loom npm package name",
        }),
      );
      if (name) await execute(["run", name]);
      continue;
    }
    const loom = await pick(
      "Select a Loom",
      items,
      (l) => `${l.name} · ${l.ref.id}@${l.ref.version}`,
    );
    if (!loom) continue;
    if (choice === "run") {
      await execute(["run", loom.ref.artifactDigest]);
      continue;
    }
    await execute(["loom", "describe", loom.ref.artifactDigest]);
    if (await confirm("Remove this installed Loom?"))
      await execute(["loom", "remove", loom.ref.id]);
  }
}
