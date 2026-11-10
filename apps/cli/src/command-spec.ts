import { parseArgs } from "node:util";
import { IntloomError } from "@intloom/loom-sdk";
import { cliName } from "./metadata.ts";

export const options = {
  help: { type: "boolean" },
  port: { type: "string" },
  details: { type: "boolean" },
  prompt: { type: "string" },
  files: { type: "string" },
  paths: { type: "string" },
  path: { type: "string" },
  build: { type: "boolean" },
  watch: { type: "boolean" },
  "dry-run": { type: "boolean" },
  plain: { type: "boolean" },
  input: { type: "string" },
  id: { type: "string" },
  out: { type: "string" },
  project: { type: "string" },
  update: { type: "boolean" },
  dependency: { type: "string", multiple: true },
  name: { type: "string" },
  version: { type: "string" },
  cursor: { type: "string" },
  limit: { type: "string" },
  status: { type: "string" },
  reason: { type: "string" },
  after: { type: "string" },
  until: { type: "string" },
  timeout: { type: "string" },
  request: { type: "string" },
  wait: { type: "string" },
  value: { type: "string" },
  action: { type: "string" },
  run: { type: "string" },
  offset: { type: "string" },
  length: { type: "string" },
  "confirm-delivery": { type: "boolean" },
  overwrite: { type: "boolean" },
} as const;

export const commandSpecs = [
  [
    "run",
    "<loom> [command] [--prompt TEXT] [--files 'a;b'] [--paths 'x;y'] [--input JSON|@file|@-]",
    "Run an installed Loom command and start the Intloom service as needed.",
    [
      "confirm-delivery",
      "prompt",
      "files",
      "paths",
      "input",
      "until",
      "timeout",
      "details",
      "project",
    ],
    "runs",
  ],
  [
    "status",
    "[runId] [--watch]",
    "View the service, all unfinished Runs and 10 recent finished Runs, or one Run. Use --watch for live updates; Ctrl+C exits the observer.",
    ["watch", "timeout"],
    "status",
  ],
  [
    "loom list",
    "[--id id] [--cursor cursor] [--limit n]",
    "List installed Looms.",
    ["id", "cursor", "limit"],
    "packages",
  ],
  [
    "install",
    "<source> [--dependency source]",
    "Install a Loom from npm, a directory or an archive.",
    ["dependency", "project"],
    "packages",
  ],
  [
    "loom describe",
    "<loom|archive.tgz>",
    "Describe Loom inputs, storage and delivery requirements.",
    [],
    "packages",
  ],
  [
    "loom remove",
    "<id>",
    "Remove only the named package. Run history and deliveries remain available.",
    ["project"],
    "packages",
  ],
  [
    "dev init",
    "[directory] [--id id] [--name display] [--version version]",
    "Create a Loom author project.",
    ["id", "name", "version"],
    "dev",
  ],
  [
    "dev build",
    "[--path dir]",
    "Build dist/<name>-<version>.tgz; --path sets the output directory.",
    ["path", "update", "project"],
    "dev",
  ],
  [
    "dev test",
    "[--build] [--path dir] [--input JSON|@file|@-]",
    "Execute a built archive; --build builds first and --path selects its directory.",
    [
      "build",
      "path",
      "input",
      "prompt",
      "files",
      "paths",
      "until",
      "timeout",
      "update",
      "details",
      "project",
    ],
    "dev",
  ],
  [
    "dev publish",
    "[--path dir] [--dry-run]",
    "Review a built archive; publishing requires explicit confirmation.",
    ["path", "dry-run"],
    "dev",
  ],
  [
    "startup",
    "[--port n]",
    "Start Intloom with MCP HTTP and observe in the foreground; Ctrl+C leaves the service running.",
    ["port"],
    "service",
  ],
  [
    "shutdown",
    "",
    "Confirm cancellation of all unfinished Runs and shut down the Intloom service.",
    [],
    "service",
  ],
  [
    "run create",
    "<selector> [--input JSON|@file|@-]",
    "Create a Run without starting it.",
    ["input", "prompt", "files", "paths", "project", "confirm-delivery"],
    "runs",
  ],
  [
    "run start",
    "<runId>",
    "Start a created Run and return an acknowledgement.",
    [],
    "runs",
  ],
  [
    "run stop",
    "<runId> [--reason text]",
    "Request Run cancellation.",
    ["reason"],
    "runs",
  ],
  [
    "run events",
    "<runId> [--after seq] [--limit n]",
    "Read execution events in sequence.",
    ["after", "limit"],
    "runs",
  ],
  [
    "run resume",
    "<runId> --request requestId | --wait waitId [--value JSON|@file|@-]",
    "Resume a wait; the terminal guides selection when no wait is specified.",
    ["request", "wait", "value"],
    "runs",
  ],
  [
    "interaction list",
    "--run runId [--status status]",
    "List interaction requests for a Run.",
    ["run", "status"],
    "interactions",
  ],
  [
    "interaction get",
    "<requestId>",
    "Read an interaction request and its responses.",
    [],
    "interactions",
  ],
  [
    "interaction respond",
    "<requestId> [--value JSON|@file|@- | --action decline|dismiss]",
    "Submit a response; open a form when no value is supplied in a terminal.",
    ["value", "action"],
    "interactions",
  ],
  [
    "artifact list",
    "--run runId [--cursor cursor] [--limit n]",
    "List artifacts for a Run.",
    ["run", "cursor", "limit"],
    "outcomes",
  ],
  ["artifact get", "<artifactId>", "Read artifact metadata.", [], "outcomes"],
  [
    "artifact read",
    "<artifactId> [--offset bytes] [--length bytes]",
    "Write raw bytes to stdout; --plain returns base64.",
    ["offset", "length"],
    "outcomes",
  ],
  [
    "artifact export",
    "<artifactId> --out path [--overwrite]",
    "Export an artifact without overwriting an existing file by default.",
    ["out", "overwrite"],
    "outcomes",
  ],
  [
    "acceptance list",
    "--run runId [--cursor cursor] [--limit n]",
    "List acceptance records.",
    ["run", "cursor", "limit"],
    "outcomes",
  ],
  [
    "acceptance get",
    "<acceptanceId>",
    "Read an acceptance result and its findings.",
    [],
    "outcomes",
  ],
  [
    "init",
    "[directory]",
    "Create intloom.yaml for a runtime project.",
    [],
    "packages",
  ],
] as const;

export function commandSpec(positionals: string[]) {
  return (
    commandSpecs.find(([name]) => name === positionals.slice(0, 2).join(" ")) ??
    commandSpecs.find(([name]) => name === positionals[0])
  );
}

export function parseCommand(args: string[]) {
  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs({ args, options, allowPositionals: true });
  } catch {
    throw new IntloomError(
      "INVALID_ARGUMENT",
      `Invalid command options. Run ${cliName} --help.`,
    );
  }
  const spec = commandSpec(parsed.positionals);
  const allowed = new Set<string>([
    "help",
    "plain",
    ...(parsed.positionals.length ? [] : ["project"]),
    ...(spec?.[3] ?? []),
  ]);
  for (const name of Object.keys(parsed.values)) {
    if (!allowed.has(name)) {
      throw new IntloomError(
        "INVALID_ARGUMENT",
        `--${name} is not supported by ${spec?.[0] ?? (parsed.positionals.join(" ") || "the menu")}. Run ${cliName} ${spec?.[0] ?? ""} --help.`,
      );
    }
  }
  if (
    parsed.values.port !== undefined &&
    (!/^\d+$/.test(String(parsed.values.port)) ||
      Number(parsed.values.port) < 1 ||
      Number(parsed.values.port) > 65535)
  )
    throw new IntloomError(
      "INVALID_ARGUMENT",
      "--port must be an integer from 1 to 65535. Retry intloom startup --port <unused-port>.",
    );
  if (
    spec?.[0] === "status" &&
    parsed.values.timeout !== undefined &&
    (!parsed.values.watch || parsed.positionals.length !== 2)
  )
    throw new IntloomError(
      "INVALID_ARGUMENT",
      "--timeout requires status <runId> --watch.",
    );
  if (spec?.[0] === "dev test" && parsed.values.update && !parsed.values.build)
    throw new IntloomError(
      "INVALID_ARGUMENT",
      "--update requires dev test --build.",
    );
  if (
    parsed.values.until !== undefined &&
    parsed.values.until !== "waiting" &&
    parsed.values.until !== "terminal"
  )
    throw new IntloomError(
      "INVALID_ARGUMENT",
      "Use --until waiting or terminal.",
    );
  if (
    parsed.values.timeout !== undefined &&
    (!Number.isFinite(Number(parsed.values.timeout)) ||
      Number(parsed.values.timeout) < 0)
  )
    throw new IntloomError(
      "INVALID_ARGUMENT",
      "timeout must be a nonnegative number.",
    );
  return { parsed, spec };
}
