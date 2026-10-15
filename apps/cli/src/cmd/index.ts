import {
  defineCommand,
  renderUsage,
  runCommand,
  type ArgsDef,
  type CommandDef,
} from "citty";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Readable, Writable } from "node:stream";
import { stripVTControlCharacters } from "node:util";
import {
  createCliCore,
  type CoreResult,
  type ProjectInput,
} from "../core/index.ts";
import { projectRoot } from "@intloom/kernel/service";
import {
  parseArtifactQuery,
  parseArtifactSelector,
} from "@intloom/kernel/service/application/artifacts";
import { errorView, failure } from "../errors.ts";
import { packageVersion } from "../version.ts";
import { formatResult } from "./render.ts";
import { formatLog } from "../ui/logs.ts";
import { loomSource } from "../looms/install.ts";
import { exportArtifact } from "../commands/export-artifact.ts";
export interface CliIo {
  readonly input: Readable;
  readonly output: Writable;
  readonly error: Writable;
  readonly cwd: string;
  readonly isTTY: boolean;
}
const defaultIo = (): CliIo => ({
  input: process.stdin,
  output: process.stdout,
  error: process.stderr,
  cwd: process.cwd(),
  isTTY: Boolean(process.stdin.isTTY && process.stderr.isTTY),
});
const str = (description: string) => ({ type: "string" as const, description });
const bool = (description: string) => ({
  type: "boolean" as const,
  description,
});
const pos = (description: string, required = true) => ({
  type: "positional" as const,
  description,
  required,
});
const globals = {
  project: str("Project directory"),
  json: bool("JSON result or JSON Lines"),
  interactive: bool("Allow setup choices"),
  color: bool("Enable color"),
  debug: bool("Debug log filter"),
  info: bool("Info log filter"),
};
type Values = Record<string, unknown> & { _: string[] };
export async function runCmd(
  rawArgs: readonly string[],
  io: CliIo = defaultIo(),
): Promise<number> {
  const core = createCliCore();
  let exitCode = 0;
  let lastResult: CoreResult<unknown> | undefined;
  const common: Record<string, unknown> = { interactive: true };
  const loomInputs: string[] = [];
  const pathInputs: { files?: string[]; dirs?: string[]; urls?: string[] } = {};
  const args: string[] = [];
  let literal = false;
  for (let index = 0; index < rawArgs.length; index++) {
    const raw = rawArgs[index];
    const item = literal ? raw : raw?.replace(/^-l(?:oom)?(?==|$)/u, "--loom");
    if (item === undefined) continue;
    if (item === "--") {
      literal = true;
      args.push(item);
      continue;
    }
    if (
      !literal &&
      /^--(?:to|scope|prompt|prompt-file|answer|answer-file|operation-id|instance|port|loom|stage|limit|cursor|output|mcp|ide|execution|until|timeout|revision|file|dir|url)(?:=|$)/u.test(
        item,
      )
    ) {
      const equals = item.indexOf("=");
      const argument =
        equals >= 0 ? item.slice(equals + 1) : rawArgs[index + 1];
      if (item === "--loom" || item.startsWith("--loom="))
        loomInputs.push(argument ?? "");
      const slot = /^--(file|dir|url)(?:=|$)/u.exec(item)?.[1];
      if (slot && rawArgs.includes("run")) {
        const key = `${slot}s` as "files" | "dirs" | "urls";
        pathInputs[key] ??= [];
        pathInputs[key].push(argument ?? "");
      }
      args.push(item);
      if (equals < 0 && argument !== undefined) {
        args.push(argument);
        index++;
      }
      continue;
    }
    const flag =
      /^--(no-)?(project|json|interactive|color|debug|info)(?:=(.*))?$/u.exec(
        item,
      );
    const key = flag?.[2];
    if (!literal && flag && key) {
      common[key] =
        key === "project"
          ? (flag[3] ?? rawArgs[++index])
          : !flag[1] && flag[3] !== "false";
    } else args.push(item);
  }
  const machine = common.json === true;
  const command = ["loom", "config", "mcp", "mirror"].includes(args[0] ?? "")
    ? args.slice(0, 2).join(" ")
    : args[0];
  function print(result: CoreResult<unknown>, exportedTo?: string) {
    lastResult = result;
    const data = result.data;
    const run =
      data && typeof data === "object" && "run" in data ? data.run : data;
    if (
      !result.ok ||
      (args[0] !== "cancel" &&
        args[0] !== "runs" &&
        run &&
        typeof run === "object" &&
        "status" in run &&
        run.status === "failed")
    )
      exitCode = 1;
    (machine || result.ok ? io.output : io.error).write(
      machine
        ? `${JSON.stringify(result)}\n`
        : `${formatResult(result, {
            ...(command ? { command } : {}),
            debug: common.debug === true,
            ...(exportedTo ? { exportedTo } : {}),
          })}\n`,
    );
  }
  function invalid(message: string): never {
    throw failure("INVALID_REQUEST", message);
  }
  function value(a: Values, name: string, required: true): string;
  function value(a: Values, name: string, required?: false): string | undefined;
  function value(
    a: Values,
    name: string,
    required = false,
  ): string | undefined {
    const item = a[name];
    if (item === undefined && !required) return undefined;
    if (typeof item !== "string" || !item.trim())
      invalid(`Provide a nonempty ${name}.`);
    return item;
  }
  function integer(
    a: Values,
    name: string,
    max: number,
    min = 0,
  ): number | undefined {
    const item = value(a, name);
    if (item === undefined) return undefined;
    if (!/^\d+$/u.test(item) || Number(item) < min || Number(item) > max)
      invalid(`${name} must be between ${min} and ${max}.`);
    return Number(item);
  }
  async function project(init = false): Promise<ProjectInput> {
    if (
      common.project !== undefined &&
      (typeof common.project !== "string" ||
        !common.project.trim() ||
        common.project.startsWith("--"))
    )
      invalid("Provide a nonempty --project directory.");
    const directory = resolve(
      io.cwd,
      typeof common.project === "string" ? common.project : ".",
    );
    return {
      projectPath: init
        ? directory
        : await projectRoot(directory, common.project === undefined),
    };
  }
  async function text(
    a: Values,
    name: string,
    fileFlag: string,
  ): Promise<string> {
    if (a[name] !== undefined && a[fileFlag] !== undefined)
      invalid(`Use either --${name} or --${fileFlag}.`);
    const file = value(a, fileFlag);
    if (!file) return value(a, name, true);
    if (file === "-") {
      const chunks: Buffer[] = [];
      for await (const chunk of io.input) chunks.push(Buffer.from(chunk));
      return Buffer.concat(chunks).toString("utf8");
    }
    try {
      return await readFile(resolve(io.cwd, file), "utf8");
    } catch {
      throw failure(
        "CLI_INPUT_FILE_INVALID",
        "Cannot read the specified input file.",
      );
    }
  }
  const instance = (input: ProjectInput, a: Values) => {
    const serviceInstanceId = value(a, "instance");
    return {
      ...input,
      ...(serviceInstanceId ? { serviceInstanceId } : {}),
    };
  };
  async function binding(input: ProjectInput, a: Values) {
    const observed = value(a, "instance"),
      operation = value(a, "operation-id");
    if (operation && !observed)
      invalid("An explicit --operation-id requires its original --instance.");
    if (observed)
      return {
        ...input,
        serviceInstanceId: observed,
        operationId: operation ?? randomUUID(),
      };
    const result = await core.getServiceStatus(input);
    if (!result.ok) {
      print(result);
      return undefined;
    }
    if (result.data.status !== "running")
      throw failure(
        "CLI_SERVICE_OFFLINE",
        "Run intloom start before execution.",
      );
    return {
      ...input,
      serviceInstanceId: result.data.service.instanceId,
      operationId: randomUUID(),
    };
  }
  function validateArguments(a: Values, flags: ArgsDef): Values {
    const known = new Set(
      Object.entries(flags).flatMap(([key, flag]) => [
        ...["alias" in flag ? (flag.alias ?? []) : []].flat(),
        key,
        key.replace(/-([a-z])/gu, (_match, letter: string) =>
          letter.toUpperCase(),
        ),
      ]),
    );
    for (const key of Object.keys(a))
      if (key !== "_" && !known.has(key)) invalid(`Unknown option: --${key}`);
    if (
      a._.length >
      Object.values(flags).filter((flag) => flag.type === "positional").length
    )
      invalid("Unexpected extra positional input; quote the complete text.");
    for (const [name, flag] of Object.entries(flags)) {
      if (
        (flag.type === "string" || flag.type === "positional") &&
        a[name] !== undefined &&
        !(
          ["loom", "file", "dir", "url"].includes(name) &&
          Array.isArray(a[name])
        )
      )
        value(a, name);
    }
    if (a.port !== undefined) integer(a, "port", 65535);
    if (a.limit !== undefined) integer(a, "limit", 200, 1);
    if (a.timeout !== undefined) integer(a, "timeout", 2147483647, 1);
    return a;
  }
  function leaf(
    description: string,
    flags: ArgsDef,
    action: (a: Values, input: ProjectInput) => Promise<void>,
    init = false,
  ): CommandDef {
    return defineCommand({
      meta: { description },
      args: flags,
      async run(context) {
        const a = validateArguments(context.args as Values, flags);
        await action(a, await project(init));
      },
    });
  }
  const instanceFlag = { instance: str("Observed Service instance") };
  const admissionFlags = {
    ...instanceFlag,
    "operation-id": str("Original operation UUID"),
  };
  const queryFlags = {
    loom: str("Loom filter"),
    stage: str("Stage filter"),
    limit: str("Page size 1–200"),
    cursor: str("Page cursor"),
  };
  function query(a: Values) {
    return parseArtifactQuery({
      ...(a.loom ? { loomName: a.loom } : {}),
      ...(a.stage ? { stageName: a.stage } : {}),
      ...(a.limit ? { limit: integer(a, "limit", 200, 1) } : {}),
      ...(a.cursor ? { cursor: a.cursor } : {}),
    });
  }
  function observing() {
    const controller = new AbortController();
    const abort = () => controller.abort();
    process.once("SIGINT", abort);
    process.once("SIGTERM", abort);
    return {
      controller,
      close() {
        controller.abort();
        process.off("SIGINT", abort);
        process.off("SIGTERM", abort);
      },
    };
  }
  const buildFlags = {
    path: pos("Loom source directory (defaults to current directory)", false),
  };
  const tree: CommandDef = defineCommand({
    meta: {
      name: "intloom",
      version: packageVersion,
      description: "CMD and TUI clients for the Kernel Service",
    },
    args: globals as ArgsDef,
    subCommands: {
      build: defineCommand({
        meta: { description: "Build a Loom source package into dist" },
        args: buildFlags,
        async run(context) {
          const a = validateArguments(context.args as Values, buildFlags);
          if (common.project !== undefined)
            invalid(
              "Use intloom build [path] to select a Loom source directory.",
            );
          print(
            await core.buildLoom({
              packagePath: resolve(io.cwd, value(a, "path") ?? "."),
            }),
          );
        },
      }),
      mirror: defineCommand({
        meta: { description: "Immutable local execution mirrors" },
        subCommands: {
          list: leaf(
            "List mirror boundaries without loading Loom",
            {},
            async (_a, input) => {
              print(await core.listMirrors(input));
            },
          ),
          inspect: leaf(
            "Inspect raw mirror State, data and file scope",
            { mirrorId: pos("Mirror UUID") },
            async (a, input) => {
              print(
                await core.inspectMirror({
                  ...input,
                  mirrorId: value(a, "mirrorId") ?? "",
                }),
              );
            },
          ),
          restore: leaf(
            "Restore into a prepared independent paused project",
            {
              mirrorId: pos("Mirror UUID"),
              to: str("Prepared target project"),
              scope: str("step, stage or loom"),
              "dry-run": bool("Validate and show write plan"),
            },
            async (a, input) => {
              const scope = value(a, "scope") ?? "loom";
              if (!["step", "stage", "loom"].includes(scope))
                invalid("Scope must be step, stage or loom.");
              const to = value(a, "to");
              if (!to) invalid("Restore requires --to.");
              print(
                await core.restoreMirror({
                  ...input,
                  mirrorId: value(a, "mirrorId") ?? "",
                  targetProject: resolve(io.cwd, to),
                  scope: scope as "step" | "stage" | "loom",
                  dryRun: a["dry-run"] === true,
                }),
              );
            },
          ),
          export: leaf(
            "Export raw immutable trace data",
            { traceId: pos("Trace UUID"), to: str("New export directory") },
            async (a, input) => {
              const to = value(a, "to");
              if (!to) invalid("Export requires --to.");
              print(
                await core.exportMirrors({
                  ...input,
                  traceId: value(a, "traceId") ?? "",
                  targetProject: resolve(io.cwd, to),
                }),
              );
            },
          ),
        },
      }),
      resume: leaf(
        "Explicitly resume a paused mirror Run",
        {
          runId: pos("Run ID"),
          scope: str("New scope after scope completion"),
          "abandon-mirror": bool(
            "Explicitly stop this Run mirror capture after a failure; requires --scope loom",
          ),
          revision: str("Observed Run revision"),
          ...admissionFlags,
        },
        async (a, input) => {
          const bound = await binding(input, a);
          if (!bound) return;
          const runId = value(a, "runId") ?? "";
          const observed = await core.getRun({ ...bound, runId });
          if (!observed.ok) {
            print(observed);
            return;
          }
          if (!observed.data.revision)
            invalid("Observed Run revision is missing.");
          const scope = value(a, "scope");
          if (scope && !["step", "stage", "loom"].includes(scope))
            invalid("Invalid scope.");
          const revision =
            a.revision === undefined
              ? observed.data.revision
              : integer(a, "revision", Number.MAX_SAFE_INTEGER, 1);
          if (revision === undefined) invalid("Resume revision is missing.");
          print(
            await core.resumeRun({
              ...bound,
              runId,
              expectedRevision: revision,
              ...(a["abandon-mirror"] ? { abandonMirror: true } : {}),
              ...(scope ? { scope: scope as "step" | "stage" | "loom" } : {}),
            }),
          );
        },
      ),
      init: leaf(
        "Initialize project with optional Loom, MCP and Service",
        {
          directory: pos("New or empty directory", false),
          loom: {
            ...str(
              "Loom package or built-in name; repeatable; also accepts -loom",
            ),
            alias: "l",
          },
          mcp: str("codex"),
          start: bool("Start after setup"),
        },
        async (a, input) => {
          if (a.directory !== undefined && common.project !== undefined)
            invalid("Use either init [directory] or --project.");
          const target = value(a, "directory"),
            ide = value(a, "mcp");
          if (ide && ide !== "codex") invalid("MCP profile must be codex.");
          const sources = loomInputs;
          const result = await core.initProject({
            projectPath: target ? resolve(io.cwd, target) : input.projectPath,
            looms: sources.map((item) => loomSource(String(item), io.cwd)),
            ...(ide ? { mcp: "codex" } : {}),
            ...(a.start ? { start: true } : {}),
          });
          print(result);
          if (!machine && result.ok)
            io.output.write(
              "Configure llms.default in intloom.yaml before model execution. Run intloom start, then intloom looms.\n",
            );
        },
        true,
      ),
      start: leaf(
        "Start or reuse Service",
        { port: str("Local port 0–65535") },
        async (a, p) => {
          const port = integer(a, "port", 65535);
          print(
            await core.startService({
              ...p,
              ...(port === undefined ? {} : { port }),
            }),
          );
        },
      ),
      stop: leaf(
        "Stop and verify resource release",
        instanceFlag,
        async (a, p) => print(await core.stopService(instance(p, a))),
      ),
      status: leaf("Verified Service status", {}, async (_a, p) =>
        print(await core.getServiceStatus(p)),
      ),
      doctor: leaf(
        "Read-only readiness checks",
        { execution: str("cli, studio, agent_ide") },
        async (a, p) => {
          const execution = value(a, "execution") ?? "cli";
          if (!["cli", "studio", "agent_ide"].includes(execution))
            invalid("Invalid execution entry.");
          print(
            await core.doctor({
              ...p,
              execution: execution as "cli" | "studio" | "agent_ide",
            }),
          );
        },
      ),
      recover: leaf(
        "Explicit stale-resource cleanup",
        { "dry-run": bool("Inspect only") },
        async (a, p) =>
          print(
            await core.recoverProject({ ...p, dryRun: a["dry-run"] === true }),
          ),
      ),
      looms: leaf("Loaded Loom readiness", {}, async (_a, p) =>
        print(await core.listLooms(p)),
      ),
      runs: leaf(
        "Runs in current instance",
        { loom: str("Loom"), ...instanceFlag },
        async (a, p) =>
          print(
            await core.listRuns({
              ...instance(p, a),
              ...(a.loom ? { loomName: value(a, "loom", true) } : {}),
            }),
          ),
      ),
      run: leaf(
        "Run a Loom with the supplied inputs",
        {
          loomName: pos("Loom name"),
          prompt: str("Description for the Loom"),
          "prompt-file": str("UTF-8 description file or -"),
          file: str("File path; repeat to provide multiple files"),
          dir: str("Directory path; repeat to provide multiple directories"),
          url: str("URL; repeat to provide multiple URLs"),
          ...admissionFlags,
        },
        async (a, p) => {
          const bound = await binding(p, a);
          if (bound)
            print(
              await core.run({
                ...bound,
                loomName: value(a, "loomName", true),
                input: {
                  ...(a.prompt !== undefined || a["prompt-file"] !== undefined
                    ? { prompt: await text(a, "prompt", "prompt-file") }
                    : {}),
                  ...pathInputs,
                },
              }),
            );
        },
      ),
      attach: leaf(
        "Inspect an existing Run",
        { runId: pos("Run ID"), ...instanceFlag },
        async (a, p) =>
          print(
            await core.getRun({
              ...instance(p, a),
              runId: value(a, "runId", true),
            }),
          ),
      ),
      answer: leaf(
        "Submit the complete Loom answer JSON",
        {
          runId: pos("Run ID"),
          action: str("Action ID"),
          answer: str("Complete JSON"),
          "answer-file": str("JSON file or -"),
          ...admissionFlags,
        },
        async (a, p) => {
          const bound = await binding(p, a);
          if (!bound) return;
          let answer: import("@intloom/kernel").JsonValue;
          try {
            answer = JSON.parse(await text(a, "answer", "answer-file"));
          } catch {
            invalid("Answer must be complete valid JSON.");
          }
          print(
            await core.answerAsk({
              ...bound,
              runId: value(a, "runId", true),
              actionId: value(a, "action", true),
              answer,
            }),
          );
        },
      ),
      cancel: leaf(
        "Explicitly cancel Run",
        { runId: pos("Run ID"), ...instanceFlag },
        async (a, p) =>
          print(
            await core.cancelRun({
              ...instance(p, a),
              runId: value(a, "runId", true),
            }),
          ),
      ),
      operation: leaf(
        "Inspect admission receipt",
        { operationId: pos("UUID"), ...instanceFlag },
        async (a, p) =>
          print(
            await core.getOperation({
              ...instance(p, a),
              operationId: value(a, "operationId", true),
            }),
          ),
      ),
      wait: leaf(
        "Wait for action or terminal; never answer/cancel",
        {
          runId: pos("Run ID"),
          until: str("action_or_terminal or terminal"),
          timeout: str("Milliseconds"),
          ...instanceFlag,
        },
        async (a, p) => {
          const until = value(a, "until") ?? "action_or_terminal";
          if (!["action_or_terminal", "terminal"].includes(until))
            invalid("Invalid until value.");
          const timeoutMs = integer(a, "timeout", 2147483647, 1);
          const observer = observing();
          try {
            print(
              await core.waitRun(
                {
                  ...instance(p, a),
                  runId: value(a, "runId", true),
                  until: until as "terminal" | "action_or_terminal",
                  ...(timeoutMs === undefined ? {} : { timeoutMs }),
                },
                { signal: observer.controller.signal },
              ),
            );
          } finally {
            observer.close();
          }
        },
      ),
      watch: leaf(
        "Observe snapshots; Ctrl+C closes observation",
        { runId: pos("Optional Run ID", false), ...instanceFlag },
        async (a, p) => {
          const observer = observing();
          try {
            const stream = a.runId
              ? core.watchRun(
                  { ...instance(p, a), runId: value(a, "runId", true) },
                  { signal: observer.controller.signal },
                )
              : core.watchProject(instance(p, a), {
                  signal: observer.controller.signal,
                });
            for await (const result of stream) print(result);
          } finally {
            observer.close();
          }
        },
      ),
      artifacts: leaf("Committed Artifact metadata", queryFlags, async (a, p) =>
        print(await core.listArtifacts({ ...p, query: query(a) })),
      ),
      artifact: leaf(
        "Read/export committed snapshot",
        {
          artifactId: pos("ID", false),
          loom: str("Loom"),
          stage: str("Stage"),
          output: str("JSON file"),
          overwrite: bool("Replace output"),
        },
        async (a, p) => {
          const selector = parseArtifactSelector({
            ...(a.artifactId ? { artifactId: a.artifactId } : {}),
            ...(a.loom ? { loomName: a.loom } : {}),
            ...(a.stage ? { stageName: a.stage } : {}),
          });
          if (a.overwrite && !a.output)
            invalid("--overwrite requires --output.");
          const result = await core.getArtifact({ ...p, ...selector });
          if (result.ok && a.output) {
            if (!result.data)
              throw failure(
                "NOT_FOUND",
                "Artifact not found; no export created.",
              );
            await exportArtifact(
              result.data,
              resolve(io.cwd, value(a, "output", true)),
              a.overwrite === true,
            );
          }
          print(
            result,
            a.output ? resolve(io.cwd, value(a, "output", true)) : undefined,
          );
        },
      ),
      records: leaf("Committed Record pages", queryFlags, async (a, p) =>
        print(await core.listRecords({ ...p, query: query(a) })),
      ),
      record: leaf(
        "Read committed Record",
        { recordId: pos("ID") },
        async (a, p) =>
          print(
            await core.getRecord({
              ...p,
              recordId: value(a, "recordId", true),
            }),
          ),
      ),
      loom: defineCommand({
        meta: { description: "Offline Loom packages" },
        subCommands: {
          list: leaf("Declarations and installation", {}, async (_a, p) =>
            print(await core.listLoomPackages(p)),
          ),
          add: leaf(
            "Install package",
            { source: pos("Package/archive") },
            async (a, p) =>
              print(
                await core.addLoomPackage({
                  ...p,
                  source: loomSource(value(a, "source", true), io.cwd),
                }),
              ),
          ),
          remove: leaf(
            "Remove declaration; retain data",
            { name: pos("Package name or unambiguous short name") },
            async (a, p) =>
              print(
                await core.removeLoomPackage({
                  ...p,
                  packageName: value(a, "name", true),
                }),
              ),
          ),
        },
      }),
      config: defineCommand({
        meta: { description: "Startup configuration" },
        subCommands: {
          show: leaf("Safe configuration projection", {}, async (_a, p) =>
            print(await core.readProjectConfig(p)),
          ),
          set: leaf(
            "Write configuration against observed revision",
            { file: str("UTF-8 file"), revision: str("Revision from show") },
            async (a, p) =>
              print(
                await core.updateProjectConfig({
                  ...p,
                  configuration: await readFile(
                    resolve(io.cwd, value(a, "file", true)),
                    "utf8",
                  ),
                  revision: value(a, "revision", true),
                }),
              ),
          ),
          codex: leaf("Preview Codex MCP configuration", {}, async (_a, p) =>
            print(await core.planMcpConfig({ ...p, ide: "codex" })),
          ),
        },
      }),
      mcp: defineCommand({
        meta: { description: "Project MCP setup and stdio bridge" },
        subCommands: {
          init: leaf(
            "Apply project Codex entry",
            { ide: str("codex"), plan: bool("Preview only") },
            async (a, p) => {
              let ide = value(a, "ide");
              if (
                !ide &&
                io.isTTY &&
                common.interactive !== false &&
                !machine
              ) {
                const { select, isCancel } = await import("@clack/prompts");
                const chosen = await select({
                  message: "Select IDE",
                  options: [{ value: "codex", label: "Codex" }],
                  input: io.input,
                  output: io.error,
                });
                if (isCancel(chosen)) return;
                ide = String(chosen);
              }
              if (ide !== "codex") invalid("Specify --ide codex.");
              const plan = await core.planMcpConfig({ ...p, ide: "codex" });
              if (!plan.ok || a.plan) {
                print(plan);
                return;
              }
              print(
                await core.applyMcpConfig({
                  ...p,
                  ide: "codex",
                  beforeHash: plan.data.beforeHash,
                }),
              );
            },
          ),
          serve: leaf(
            "Full MCP bridge to existing Service",
            { ide: str("Optional codex profile") },
            async (a, p) => {
              const ide = value(a, "ide");
              if (ide && ide !== "codex") invalid("Invalid IDE profile.");
              const { runMcpProxy } = await import("../mcp/proxy.ts");
              const observer = observing();
              try {
                await runMcpProxy(p.projectPath, io, {
                  ...(ide ? { ide: "codex" } : {}),
                  signal: observer.controller.signal,
                });
              } finally {
                observer.close();
              }
            },
          ),
        },
      }),
      logs: leaf(
        "Read logs; optionally follow Service files",
        {
          runId: pos("Optional Run ID", false),
          service: bool("Latest log"),
          follow: bool("Observe until interrupted"),
        },
        async (a, p) => {
          if (a.runId && a.service) invalid("Use Run ID or --service.");
          const request = {
            ...p,
            ...(a.runId ? { runId: value(a, "runId", true) } : {}),
            level: common.debug ? ("debug" as const) : ("info" as const),
          };
          if (!a.follow) {
            print(await core.readLogs(request));
            return;
          }
          const observer = observing();
          try {
            for await (const result of core.watchLogs(request, {
              signal: observer.controller.signal,
            }))
              print(result);
          } finally {
            observer.close();
          }
        },
      ),
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
    if (
      (common.debug || common.info) &&
      args[0] !== "logs" &&
      lastResult?.meta.projectRoot
    ) {
      const logs = await core.readLogs({
        projectPath: lastResult.meta.projectRoot,
        level: common.debug ? "debug" : "info",
        ...(args[0] === "start"
          ? {}
          : lastResult.meta.runId
            ? { runId: lastResult.meta.runId }
            : { requestId: lastResult.meta.requestId }),
      });
      if (logs.ok)
        for (const record of logs.data)
          io.error.write(
            machine
              ? `${record.level === 20 ? "DEBUG " : ""}${JSON.stringify(record)}\n`
              : formatLog(record, common.debug === true, true),
          );
    }
    return exitCode;
  } catch (error) {
    const safe = errorView(error);
    print({
      ok: false,
      error:
        safe.code === "CLI_INTERNAL_ERROR"
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
