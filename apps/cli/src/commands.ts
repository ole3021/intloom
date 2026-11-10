import { parseCommand, commandSpec } from "./command-spec.ts";
import { helpText } from "./ui/help.ts";
import { cliName } from "./metadata.ts";
import { PromptCancelled, interactive } from "./ui/prompts.ts";
import { IntloomError } from "@intloom/loom-sdk";
import { publicError } from "./service/protocol.ts";
import { commandContext } from "./context.ts";
import { errorBlock } from "./ui/errors.ts";
import { withPlainOutput } from "./ui/output-mode.ts";

export function runCli(
  args: string[],
  options: {
    serviceDir?: string | undefined;
    mcpPort?: number | undefined;
  } = {},
): Promise<void> {
  return withPlainOutput(args.includes("--plain"), () =>
    executeCli(args, options.serviceDir, options.mcpPort),
  );
}

async function executeCli(
  args: string[],
  serviceDir?: string,
  mcpPort?: number,
): Promise<void> {
  let plain = args.includes("--plain");
  let hasOutput = false;
  process.exitCode = 0;
  const output = (data: unknown) => {
    process.stdout.write(
      `${JSON.stringify(plain ? { ok: true, data } : data, null, plain ? undefined : 2)}\n`,
    );
    hasOutput = true;
  };
  try {
    const { parsed, spec } = parseCommand(args);
    if (parsed.values.help) {
      const help = helpText(parsed.positionals, process.stdout, plain);
      if (plain) output({ help });
      else process.stdout.write(help);
      return;
    }
    const context = commandContext(parsed, output, serviceDir, mcpPort);
    const { command } = context;
    plain = context.plain;
    switch (command) {
      case undefined: {
        if (context.plain) {
          output({ help: helpText([], process.stdout, true) });
          break;
        }
        if (!interactive()) {
          process.stdout.write(helpText());
          break;
        }
        const project = context.string("project");
        const { terminal } = await import("./commands/terminal.ts");
        await terminal(context, (args) =>
          runCli(
            [
              ...args,
              ...(project &&
              commandSpec(args)?.[3].some((option) => option === "project")
                ? ["--project", project]
                : []),
            ],
            {
              serviceDir,
              mcpPort,
            },
          ),
        );
        break;
      }
      default:
        switch (spec?.[4]) {
          case "status":
            await (await import("./commands/status.ts")).showStatus(context);
            break;
          case "dev":
            await (await import("./commands/dev.ts")).runDev(context);
            break;
          case "service":
            await (await import("./commands/service.ts")).runServiceCommand(
              context,
            );
            break;
          case "packages":
            await (await import("./commands/packages.ts")).runPackageCommand(
              context,
            );
            break;
          case "interactions":
            await (
              await import("./commands/interactions.ts")
            ).runInteractionCommand(context);
            break;
          case "outcomes":
            await (await import("./commands/outcomes.ts")).runOutcomeCommand(
              context,
            );
            break;
          case "runs":
            await (await import("./commands/runs.ts")).handleRuns(context);
            break;
          default:
            throw new IntloomError(
              "INVALID_ARGUMENT",
              `Unknown command. Run ${cliName} --help.`,
            );
        }
    }
  } catch (error) {
    if (error instanceof PromptCancelled) {
      process.exitCode = 130;
      return;
    }
    const projected = publicError(error);
    if (plain && !hasOutput)
      process.stdout.write(
        `${JSON.stringify({ ok: false, error: projected })}\n`,
      );
    else process.stderr.write(`${errorBlock(projected)}\n`);
    process.exitCode = [
      "INVALID_ARGUMENT",
      "INPUT_INVALID",
      "RESPONSE_INVALID",
      "DEFINITION_INVALID",
    ].includes(projected.code)
      ? 2
      : 1;
  }
}
