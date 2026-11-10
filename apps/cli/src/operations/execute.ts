import { findProject } from "@intloom/kernel";
import { resolve, join } from "node:path";
import { ensureService } from "../service/process.ts";
import { selectNpmCommand } from "./npm-looms.ts";
import { runInput, structuredInput } from "./input.ts";
import { correctValue } from "../ui/form.ts";
import { interactive } from "../ui/prompts.ts";
import { cliName } from "../metadata.ts";
import { watchRun } from "../ui/run-observer.ts";
import { printOutput } from "../ui/run-details.ts";
import { answerRequest } from "./respond.ts";
import {
  IntloomError,
  type InstalledLoom,
  type JsonObject,
  type RunView,
} from "@intloom/loom-sdk";
import type { CommandContext } from "../context.ts";
export async function executeLoom(
  ctx: CommandContext,
  name: string,
  options: {
    installed?: InstalledLoom;
    createOnly?: boolean;
    command?: string;
  } = {},
) {
  const { dataDir, output, client, select } = ctx;
  const selector = select(name);
  await ensureService(dataDir, !ctx.plain, ctx.mcpPort);
  let installed = options.installed;
  let publicInput: JsonObject | undefined;
  if (!installed) {
    const npm = await selectNpmCommand(ctx, name, options.command);
    if (npm && "help" in npm) return;
    if (options.command && !npm)
      throw new IntloomError(
        "LOOM_NOT_FOUND",
        `Install the Loom package first: ${name}`,
      );
    installed = await client("getLoom", [npm?.ref ?? selector]);
    publicInput = npm?.input;
  }
  const directory = resolve(ctx.string("project") ?? process.cwd());
  const project = await findProject(directory);
  const storage = installed.manifest.storage;
  let storagePath: string;
  if (storage === "project") {
    if (!project)
      throw new IntloomError(
        "PROJECT_REQUIRED",
        `Loom ${installed.ref.id} requires project storage. Run intloom init in your project root, then retry from that directory or a subdirectory.`,
      );
    storagePath = join(project, ".intloom");
  } else {
    storagePath = publicInput
      ? join(dataDir, installed.ref.id)
      : join(dataDir, "looms", installed.ref.id);
  }
  process.stderr.write(
    `Directory  ${directory}\nProject    ${project ?? "No project"}\nStorage    ${storage} · ${storagePath}\n`,
  );
  const schema = publicInput ?? installed.manifest.contracts.input;
  const draft = await runInput(
    ctx,
    schema,
    `${installed.ref.id}@${installed.ref.version}`,
  );
  let created: RunView;
  for (;;) {
    try {
      created = await client("createRun", [
        {
          loom: installed.ref,
          ...(ctx.values["confirm-delivery"] ? { confirmDelivery: true } : {}),
          ...structuredInput(draft.input, draft.pathField),
        },
      ]);
      break;
    } catch (error) {
      if (!interactive() || ctx.string("input") !== undefined) throw error;
      draft.input = await correctValue(
        error,
        "INPUT_INVALID",
        draft.input,
        schema,
      );
    }
  }
  if (options.createOnly) {
    output(created);
    return;
  }
  process.stderr.write(`Run ${created.id}\n`);
  await client("startRun", [created.id]);
  const cursor = { after: 0 };
  let observed = await watchRun(ctx, created.id, "execute", cursor);
  let { run } = observed;
  while (
    interactive() &&
    observed.reason === "waiting" &&
    run.status === "waiting"
  ) {
    const requestId = run.pendingInteractionIds[0];
    if (!requestId) break;
    const receipt = await answerRequest(ctx, requestId);
    if (
      receipt.requestStatus !== "answered" ||
      receipt.continuation.status === "needs_attention"
    ) {
      if (receipt.requestStatus === "pending")
        process.stderr.write(
          `Continue later  ${cliName} interaction respond ${requestId}\n`,
        );
      break;
    }
    observed = await watchRun(ctx, created.id, "execute", cursor, requestId);
    run = observed.run;
  }
  if (ctx.plain) output(run);
  else printOutput(ctx, run);
  return observed;
}
