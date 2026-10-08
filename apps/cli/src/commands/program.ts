import { packageVersion } from "../version.ts";
import { readFile, stat } from "node:fs/promises";
import { resolve, join } from "node:path";
import { randomUUID } from "node:crypto";
import type { LogLevel } from "@intloom/utils";
import { readProjectLogs } from "./read-logs.ts";
import { createLogDisplay } from "../ui/logs.ts";
import type { Readable, Writable } from "node:stream";
import { Command, CommanderError, InvalidArgumentError } from "commander";
import { isLoomError, type RunView } from "@intloom/kernel";
import { connectProject, serviceStatus } from "../client/service-client.ts";
import type { ProjectClient } from "../client/contracts.ts";
import { startService, stopService } from "../service/lifecycle.ts";
import { diagnoseProject, recoverProject } from "../service/recovery.ts";
import { authHeaders, codexConfiguration } from "../ide/codex/config.ts";
import { handlePendingAction } from "../interaction/handle-action.ts";
import { terminalPresenter } from "../ui/presenter.ts";
import {
  createTerminalUi,
  type TerminalUi,
  type PromptApi,
} from "../ui/terminal.ts";
import {
  renderRun,
  renderStatus,
  renderWorkflows,
  renderDiagnosis,
} from "../ui/render.ts";
import { errorView, failure } from "../errors.ts";
import { registerArtifactCommands } from "./artifacts.ts";
import { showCompletionArtifacts } from "../ui/completion-artifacts.ts";
import { initProject } from "./init.ts";
import { projectRoot } from "../service/discovery.ts";
import { workflowSource } from "../workflows/install.ts";
import {
  addWorkflow,
  removeWorkflow,
  listInstalledWorkflows,
  type InstalledWorkflowList,
} from "../workflows/manage.ts";
import { doctorProject, renderDoctor } from "./doctor.ts";

export interface CliIo {
  readonly input: Readable;
  readonly output: Writable;
  readonly error: Writable;
  readonly cwd: string;
  readonly isTTY: boolean;
  readonly prompts?: PromptApi;
}
const defaultIo = (): CliIo => ({
  input: process.stdin,
  output: process.stdout,
  error: process.stderr,
  cwd: process.cwd(),
  isTTY: Boolean(process.stdin.isTTY && process.stderr.isTTY),
});

export function createProgram(io: CliIo = defaultIo()) {
  let display: ReturnType<typeof createLogDisplay> | undefined;
  function logLevel(): LogLevel | undefined {
    const options = program.opts();
    return options.debug ? "debug" : options.info ? "info" : undefined;
  }
  function logDisplay(showRun = false) {
    const options = program.opts();
    display ??= createLogDisplay(
      io.error,
      io.isTTY &&
        options.color !== false &&
        !options.json &&
        !process.env.NO_COLOR,
      options.debug === true,
      showRun,
    );
    return display;
  }
  const program = new Command()
    .name("intloom")
    .description("IntLoom project execution and local MCP service")
    .version(packageVersion)
    .option("--project <directory>", "Project directory", io.cwd)
    .option("--json", "Output JSON without interactive prompts")
    .option("--info", "Display service logs at info level and above")
    .option("--debug", "Display service logs at debug level and above")
    .option("--no-interactive", "Disable terminal prompts")
    .option("--no-color", "Disable colors")
    .exitOverride()
    .configureOutput({
      writeOut: (text) => io.output.write(text),
      writeErr: (text) => io.error.write(text),
      outputError: () => undefined,
    });
  function settings(command: Command) {
    const options = command.optsWithGlobals();
    const ui = createTerminalUi({
      progress: !logLevel(),
      onPromptState: (active) => display?.pause(active),
      input: io.input,
      output: io.output,
      error: io.error,
      interactive: io.isTTY && options.interactive !== false,
      json: options.json === true,
      color: io.isTTY && options.color !== false && !process.env.NO_COLOR,
      ...(io.prompts ? { prompts: io.prompts } : {}),
    });
    return { directory: resolve(io.cwd, options.project), options, ui };
  }
  async function connected<T>(
    directory: string,
    action: (client: ProjectClient) => Promise<T>,
  ) {
    const level = logLevel();
    const requestId = randomUUID();
    let stopLogs: (() => Promise<void>) | undefined;
    if (level) {
      const service = await serviceStatus(directory);
      if (service.logFile) {
        const path = join(directory, ".intloom", "logs", service.logFile);
        const offset = (await stat(path)).size;
        stopLogs = logDisplay().watch(path, { level, requestId, offset });
      }
    }
    let client: ProjectClient | undefined;
    try {
      client = await connectProject(directory, { requestId });
      return await action(client);
    } finally {
      try {
        await client?.close();
      } finally {
        await stopLogs?.();
      }
    }
  }
  async function follow(
    client: ProjectClient,
    initial: RunView,
    ui: TerminalUi,
    directory: string,
  ) {
    let view = initial;
    while (view.status === "waiting" && ui.interactive) {
      const handled = await handlePendingAction(
        view,
        terminalPresenter(ui),
        (id, action, answer) =>
          ui.work("Resume Workflow", () =>
            client.answerAsk(id, action, answer),
          ),
      );
      view = handled.run;
      if (handled.interaction !== "answered") break;
    }
    ui.result({ run: view }, renderRun(view));
    await showCompletionArtifacts(
      client,
      view,
      ui,
      directory === resolve(io.cwd) ? undefined : directory,
    );
    if (view.status === "failed")
      throw failure(
        "CLI_RUN_FAILED",
        view.lastError?.message ?? "The Workflow Run failed.",
      );
  }
  registerArtifactCommands(program, settings, io.cwd, connected);
  program.hook("preAction", async (_thisCommand, command) => {
    if (command.name() === "init") return;
    const explicit = program.getOptionValueSource("project") === "cli";
    const root = await projectRoot(settings(command).directory, !explicit);
    program.setOptionValue("project", root);
  });
  program
    .command("init [directory]")
    .description("Create an IntLoom scaffold in a new or empty directory")
    .option(
      "--workflow <package-or-tgz>",
      "Install an optional Workflow; repeat to install multiple (bare names use latest)",
      (value: string, previous: string[]) => [
        ...previous,
        workflowSource(value, io.cwd),
      ],
      [],
    )
    .action(async (target: string | undefined, _options, command) => {
      const { directory, options, ui } = settings(command);
      if (
        target !== undefined &&
        program.getOptionValueSource("project") === "cli"
      )
        throw failure(
          "INVALID_REQUEST",
          "Use either init [directory] or --project, not both.",
        );
      if (!(target ?? options.project).trim())
        throw failure(
          "INVALID_REQUEST",
          "Provide a nonempty project directory.",
        );
      const result = await ui.work("Create project scaffold", () =>
        initProject(
          target === undefined ? directory : resolve(io.cwd, target),
          options.workflow,
        ),
      );
      ui.result(
        result,
        `Project scaffold created at ${result.projectRoot}\nRun intloom start to connect clients. Configure llms.default in intloom.yaml before CLI/Studio execution. Run intloom doctor --execution agent_ide to inspect MCP readiness.\n${options.workflow.length ? "Selected Workflows installed. Run intloom flows after start." : "No Workflows selected. Run intloom workflow add <package-or-tgz> in this project."}`,
      );
    });
  program
    .command("start")
    .description("Start or connect to the current project service")
    .option(
      "--port <port>",
      "Fixed local port (0 selects automatically)",
      (value: string) => {
        if (!/^\d+$/u.test(value) || Number(value) > 65535)
          throw new InvalidArgumentError("port must be between 0 and 65535");
        return Number(value);
      },
    )
    .action(async (_options, command) => {
      const { directory, options, ui } = settings(command);
      let stopLogs: (() => Promise<void>) | undefined;
      const level = logLevel();
      try {
        const result = await ui.work("Initialize project service", () =>
          startService(
            {
              projectRoot: directory,
              ...(options.port === undefined ? {} : { port: options.port }),
            },
            level
              ? (filePath) => {
                  stopLogs = logDisplay(true).watch(filePath, { level });
                }
              : undefined,
          ),
        );
        ui.result(
          result,
          `${result.reused ? "Reusing existing service" : "Service started"}\n${renderStatus(result.service)}`,
        );
      } finally {
        await stopLogs?.();
      }
    });
  program
    .command("stop")
    .description("Stop the current project service and release resources")
    .action(async (_options, command) => {
      const { directory, ui } = settings(command);
      let stopLogs: (() => Promise<void>) | undefined;
      const level = logLevel();
      if (level) {
        const service = (await diagnoseProject(directory)).service;
        if (service?.logFile) {
          const path = join(directory, ".intloom", "logs", service.logFile);
          stopLogs = logDisplay(true).watch(path, {
            level,
            offset: (await stat(path)).size,
          });
        }
      }
      try {
        const result = await ui.work("Release project service resources", () =>
          stopService(directory),
        );
        ui.result(
          result,
          result.stopped
            ? "The original service instance stopped. Active Runs ended; committed data is retained."
            : "The service is not running; no stop is needed.",
        );
      } finally {
        await stopLogs?.();
      }
    });
  program
    .command("status")
    .description("Show service status and Run counts")
    .action(async (_options, command) => {
      const { directory, ui } = settings(command);
      const diagnosis = await diagnoseProject(directory);
      ui.result(
        diagnosis.service ? { service: diagnosis.service } : diagnosis,
        renderDiagnosis(diagnosis),
      );
    });
  program
    .command("doctor")
    .description(
      "Inspect the service and stale locks without starting or cleaning up resources",
    )
    .option(
      "--execution <entry>",
      "Inspect cli, studio, or agent_ide readiness",
      (value: string) => {
        if (value !== "cli" && value !== "studio" && value !== "agent_ide")
          throw new InvalidArgumentError(
            "execution must be cli, studio, or agent_ide",
          );
        return value;
      },
      "cli",
    )
    .action(async (_options, command) => {
      const { directory, options, ui } = settings(command);
      const diagnosis = await doctorProject(directory, options.execution);
      ui.result(diagnosis, renderDoctor(diagnosis));
    });
  const workflow = program
    .command("workflow")
    .description(
      "Manage installed Workflow packages; changes require a stopped service",
    );
  function installedText(result: InstalledWorkflowList) {
    return [
      `Installation: ${result.installation}`,
      ...result.workflows.map((item) => `${item.name}@${item.version}`),
      result.workflows.length
        ? "Run intloom start, then intloom flows to check execution readiness."
        : "No Workflow packages are declared. Run intloom workflow add <package-or-tgz>.",
    ].join("\n");
  }
  workflow
    .command("list")
    .description(
      "Inspect declared packages and installation integrity without starting the service",
    )
    .action(async (_options, command) => {
      const { directory, ui } = settings(command);
      const result = await listInstalledWorkflows(directory);
      ui.result(result, installedText(result));
    });
  workflow
    .command("add <package-or-tgz>")
    .description("Install a Workflow package into an existing project")
    .action(async (source: string, _options, command) => {
      const { directory, ui } = settings(command);
      const result = await ui.work("Install Workflow", () =>
        addWorkflow(directory, workflowSource(source, io.cwd)),
      );
      ui.result(result, installedText(result));
    });
  workflow
    .command("remove <package>")
    .description(
      "Remove a declared package while retaining committed artifacts and records",
    )
    .action(async (name: string, _options, command) => {
      const { directory, ui } = settings(command);
      const result = await ui.work("Remove Workflow", () =>
        removeWorkflow(directory, name),
      );
      ui.result(
        result,
        `Workflow removed; committed artifacts and records are retained.\n${installedText(result)}`,
      );
    });
  program
    .command("recover")
    .description(
      "Explicitly clean up stale execution resources whose owners have exited",
    )
    .option("--dry-run", "Show eligible resources without cleaning them up")
    .action(async (_options, command) => {
      const { directory, options, ui } = settings(command);
      const result = await recoverProject(directory, options.dryRun === true);
      ui.result(
        result,
        result.dryRun
          ? `Recovery plan: ${result.paths.join(", ") || "no stale resources"}. No cleanup performed.`
          : result.recovered
            ? "Stale execution resources removed. Run intloom start; committed data is retained."
            : "There are no stale resources to clean up.",
      );
    });
  program
    .command("logs [runId]")
    .description("Read persisted logs, optionally filtered by Run")
    .option("--service", "Read the current or most recent service log")
    .option("--follow", "Continue reading until interrupted")
    .action(async (runId: string | undefined, _options, command) => {
      const { directory, options } = settings(command);
      if (runId && options.service)
        throw failure("INVALID_REQUEST", "Use either a Run ID or --service.");
      const folder = join(directory, ".intloom", "logs");
      const output = options.json ? io.output : logDisplay(!runId).output;
      const filter = {
        output,
        level: logLevel() ?? "info",
        ...(runId ? { runId } : {}),
      };
      const controller = new AbortController();
      const interrupt = () => controller.abort();
      if (options.follow) {
        process.once("SIGINT", interrupt);
        process.once("SIGTERM", interrupt);
      }
      try {
        await readProjectLogs(folder, {
          ...filter,
          follow: options.follow === true,
          signal: controller.signal,
        });
      } finally {
        process.off("SIGINT", interrupt);
        process.off("SIGTERM", interrupt);
      }
    });
  program
    .command("flows")
    .description("List Workflows and initialization diagnostics")
    .action(async (_options, command) => {
      const { directory, ui } = settings(command);
      await connected(directory, async (client) => {
        const workflows = await client.listWorkflows();
        ui.result({ workflows }, renderWorkflows(workflows));
      });
    });
  program
    .command("flow [flowName]")
    .description("Execute a Workflow with interactive selection and questions")
    .option("--intent <text>", "Original intent text")
    .option(
      "--intent-file <filename>",
      "Read UTF-8 intent text; use - for stdin",
    )
    .action(async (flowName: string | undefined, _options, command) => {
      const { directory, options, ui } = settings(command);
      if (options.intent !== undefined && options.intentFile !== undefined)
        throw failure(
          "INVALID_REQUEST",
          "Use either --intent or --intent-file, not both.",
        );
      await connected(directory, async (client) => {
        let name = flowName;
        if (!name) {
          if (!ui.interactive)
            throw failure(
              "INVALID_REQUEST",
              "Noninteractive mode requires flowName.",
            );
          const available = (await client.listWorkflows()).filter(
            (view) => view.isAvailable,
          );
          if (!available.length)
            throw failure(
              "NOT_FOUND",
              "This project has no available Workflows. Run intloom flows for diagnostics.",
            );
          name = await ui.choose(
            "Select a Workflow",
            available.map((view) => ({
              value: view.flowName,
              label: view.flowName,
              hint: view.packageName,
            })),
          );
          if (name === undefined) {
            ui.result({ cancelled: true }, "Cancelled; no Run was created.");
            return;
          }
        }
        let intent: string | undefined = options.intent;
        if (options.intentFile) {
          if (options.intentFile === "-") {
            const chunks = [];
            for await (const chunk of io.input) chunks.push(Buffer.from(chunk));
            intent = Buffer.concat(chunks).toString("utf8");
          } else
            intent = await readFile(
              resolve(io.cwd, options.intentFile),
              "utf8",
            ).catch((cause: unknown) => {
              throw failure(
                "CLI_INTENT_FILE_INVALID",
                "Cannot read the specified intent file.",
                cause,
              );
            });
        }
        if (intent === undefined && ui.interactive)
          intent = await ui.text("Describe what you want to accomplish", true);
        if (intent === undefined && ui.interactive) {
          ui.result({ cancelled: true }, "Cancelled; no Run was created.");
          return;
        }
        if (!intent?.trim())
          throw failure(
            "INVALID_REQUEST",
            "Provide a nonempty --intent or --intent-file.",
          );
        const view = await ui.work("Execute Workflow", () =>
          client.flow(name, intent),
        );
        await follow(client, view, ui, directory);
      });
    });
  program
    .command("runs")
    .description("List Runs in the current service")
    .option("--flow <flowName>", "Filter by Workflow")
    .action(async (_options, command) => {
      const { directory, options, ui } = settings(command);
      await connected(directory, async (client) => {
        const runs = await client.listRuns(options.flow);
        ui.result(
          { runs },
          runs.length
            ? runs.map(renderRun).join("\n\n")
            : "The current service has no Runs.",
        );
      });
    });
  program
    .command("attach <runId>")
    .description(
      "Inspect and answer an existing Run without creating a new one",
    )
    .action(async (runId: string, _options, command) => {
      const { directory, ui } = settings(command);
      await connected(directory, async (client) =>
        follow(client, await client.getRun(runId), ui, directory),
      );
    });
  program
    .command("cancel <runId>")
    .description("Explicitly stop a Run")
    .action(async (runId: string, _options, command) => {
      const { directory, ui } = settings(command);
      await connected(directory, async (client) => {
        const run = await client.cancelRun(runId);
        const terminal =
          run.status === "completed" ||
          (run.status === "failed" && run.lastError?.code !== "RUN_STOPPED");
        ui.result(
          { run },
          `${terminal ? "The Run has ended; no stop is needed.\n" : ""}${renderRun(run)}`,
        );
      });
    });
  program
    .command("record <recordId>")
    .description("Read a committed Record")
    .action(async (recordId: string, _options, command) => {
      const { directory, ui } = settings(command);
      await connected(directory, async (client) => {
        const record = await client.getRecord(recordId);
        ui.result(
          { record },
          record === null
            ? "Record not found."
            : JSON.stringify(record, null, 2),
        );
      });
    });
  program
    .command("config")
    .description("Generate client connection configuration")
    .command("codex")
    .description("Generate a Codex MCP TOML configuration snippet")
    .action(async (_options, command) => {
      const { directory, ui } = settings(command);
      const config = await codexConfiguration(directory);
      ui.result({ config }, config.trimEnd());
    });
  program
    .command("_auth-headers", { hidden: true })
    .action(async (_options, command) => {
      const { directory } = settings(command);
      io.output.write(`${JSON.stringify(await authHeaders(directory))}\n`);
    });
  return { program, settings };
}

export async function runCli(
  args: readonly string[],
  io: CliIo = defaultIo(),
): Promise<number> {
  const { program, settings } = createProgram(io);
  try {
    await program.parseAsync([...args], { from: "user" });
    return 0;
  } catch (error) {
    if (error instanceof CommanderError && error.exitCode === 0) return 0;
    // The failed Run snapshot has already been printed; avoid a second JSON line.
    if (isLoomError(error) && error.code === "CLI_RUN_FAILED") return 1;
    const view =
      error instanceof CommanderError
        ? { code: "INVALID_REQUEST", message: error.message, retryable: false }
        : errorView(error);
    settings(program).ui.error(
      { error: view },
      `${view.code}: ${view.message}`,
    );
    return 1;
  }
}
