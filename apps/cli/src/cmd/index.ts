import {
  defineCommand,
  renderUsage,
  runCommand,
  type ArgsDef,
  type CommandDef,
} from "citty";
import { randomUUID } from "node:crypto";
import { stripVTControlCharacters } from "node:util";
import { errorView } from "../errors.ts";
import { packageVersion } from "../version.ts";
import { createE2eCommands } from "./commands/e2e.ts";
import { createBuildCommands } from "./commands/build.ts";
import { createMirrorCommands } from "./commands/mirror.ts";
import { createRunsCommands } from "./commands/runs.ts";
import { createInitCommands } from "./commands/init.ts";
import { createServiceCommands } from "./commands/service.ts";
import { createProjectCommands } from "./commands/project.ts";
import { createLoomsCommands } from "./commands/looms.ts";
import { createResourcesCommands } from "./commands/resources.ts";
import { createConfigurationCommands } from "./commands/configuration.ts";
import { createMcpCommands } from "./commands/mcp.ts";
import { createLogsCommands } from "./commands/logs.ts";
import { createCmdContext, defaultIo, type CliIo } from "./context.ts";
import { globals } from "./arguments.ts";
export type { CliIo } from "./context.ts";
export async function runCmd(
  rawArgs: readonly string[],
  io: CliIo = defaultIo(),
): Promise<number> {
  const context = createCmdContext(rawArgs, io);
  const { core, args, common, print, output } = context;
  const e2e = createE2eCommands(context);
  const build = createBuildCommands(context);
  const mirror = createMirrorCommands(context);
  const runs = createRunsCommands(context);
  const init = createInitCommands(context);
  const service = createServiceCommands(context);
  const project = createProjectCommands(context);
  const looms = createLoomsCommands(context);
  const resources = createResourcesCommands(context);
  const configuration = createConfigurationCommands(context);
  const mcp = createMcpCommands(context);
  const logs = createLogsCommands(context);
  const tree: CommandDef = defineCommand({
    meta: {
      name: "intloom",
      version: packageVersion,
      description: "CMD and TUI clients for the Kernel Service",
    },
    args: globals as ArgsDef,
    subCommands: {
      e2e: e2e.e2e,
      build: build.build,
      mirror: mirror.mirror,
      resume: runs.resume,
      init: init.init,
      start: service.start,
      stop: service.stop,
      status: service.status,
      doctor: project.doctor,
      recover: project.recover,
      looms: looms.looms,
      runs: runs.runs,
      run: runs.run,
      attach: runs.attach,
      answer: runs.answer,
      cancel: runs.cancel,
      pause: runs.pause,
      operation: runs.operation,
      wait: runs.wait,
      watch: runs.watch,
      artifacts: resources.artifacts,
      artifact: resources.artifact,
      records: resources.records,
      record: resources.record,
      loom: looms.loom,
      config: configuration.config,
      mcp: mcp.mcp,
      logs: logs.logs,
      tui: defineCommand({
        meta: { description: "Persistent terminal UI; also the default entry" },
      }),
    },
  });
  try {
    if (args.includes("--version") || args.includes("-v")) {
      io.output.write(`${packageVersion}\n`);
      return 0;
    }
    if (args.includes("--help") || args.includes("-h")) {
      let selected = tree;
      for (const item of args) {
        if (item.startsWith("-")) break;
        const children = selected.subCommands;
        if (
          !children ||
          typeof children !== "object" ||
          children instanceof Promise
        )
          break;
        const child = children[item];
        if (!child || typeof child !== "object" || child instanceof Promise)
          break;
        selected = child;
      }
      const usage = await renderUsage(selected);
      const color =
        common.color !== false &&
        (common.color === true ||
          Boolean((io.output as NodeJS.WriteStream).isTTY));
      io.output.write(color ? usage : stripVTControlCharacters(usage));
      return 0;
    }
    await runCommand(tree, { rawArgs: args });
    await output.diagnostics(core);
    return output.exitCode;
  } catch (error) {
    const safe = errorView(error);
    print({
      ok: false,
      error:
        safe.code === "KERNEL_INTERNAL_ERROR"
          ? {
              code: "INVALID_REQUEST",
              message: "Invalid command or arguments. Run intloom --help.",
              retryable: false,
            }
          : safe,
      outcome: "not_applied",
      meta: { requestId: randomUUID() },
    });
    return 1;
  }
}
