import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { E2eError, type Entry } from "./contracts.ts";

const execute = promisify(execFile);
export function caseIntent(value: unknown, original: string): string {
  if (typeof value !== "string" || value.trim() !== original.trim())
    throw new E2eError(
      "INTENT_CHANGED",
      "Submit the case's complete original intent once.",
      "scenario",
    );
  return original;
}
export async function processResult(
  command: string,
  args: readonly string[],
  cwd: string,
  timeout: number,
  signal?: AbortSignal,
  environmentOverrides: NodeJS.ProcessEnv = {},
) {
  const environment = { ...process.env, ...environmentOverrides };
  delete environment.NODE_TEST_CONTEXT;
  delete environment.NODE_OPTIONS;
  try {
    const result = await execute(command, [...args], {
      cwd,
      env: environment,
      timeout,
      maxBuffer: 16 * 1024 * 1024,
      ...(signal ? { signal } : {}),
    });
    return { code: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !("stdout" in error) ||
      !("stderr" in error)
    )
      throw error;
    return {
      code: "code" in error && typeof error.code === "number" ? error.code : 1,
      stdout: String(error.stdout),
      stderr: String(error.stderr),
      terminated: "killed" in error && error.killed === true,
    };
  }
}
export function validateCommand(
  args: string[],
  entry: Entry,
  workflow: string,
  intent: string,
  flowName?: string,
) {
  const command = args[0];
  const deniedFlags =
    /^(?:--(?:project|output|overwrite|force|file|answer|answer-file|intent-file|start|interactive|to|follow)|--no-json)(?:=|$)/u;
  if (
    !command ||
    args.some((value) => deniedFlags.test(value)) ||
    args.includes("--")
  )
    throw new E2eError(
      "COMMAND_OUT_OF_SCOPE",
      "Only bounded commands for this execution's project are allowed.",
      "runner",
    );
  const allowed = new Set([
    "--help",
    "--version",
    "init",
    "start",
    "status",
    "doctor",
    "flows",
    "runs",
    "attach",
    "wait",
    "artifacts",
    "artifact",
    "records",
    "record",
    "logs",
    "operation",
    "config",
    "workflow",
    "mirror",
  ]);
  if (!allowed.has(command) && !(command === "flow" && entry === "cmd"))
    throw new E2eError(
      "COMMAND_OUT_OF_SCOPE",
      "This command is outside the selected entry's test scope.",
      "runner",
    );
  if (command === "init" && args.length !== 1)
    throw new E2eError(
      "COMMAND_OUT_OF_SCOPE",
      "Use init without a target; the runner supplies the isolated project directory.",
      "runner",
    );
  if (
    command === "workflow" &&
    !(
      args[1] === "list" ||
      (args[1] === "add" && args.length === 3 && args[2] === workflow)
    )
  )
    throw new E2eError(
      "COMMAND_OUT_OF_SCOPE",
      "Only the pinned Workflow archive may be installed.",
      "runner",
    );
  if (command === "config" && args[1] !== "show")
    throw new E2eError(
      "COMMAND_OUT_OF_SCOPE",
      "Use configure_project for project configuration.",
      "runner",
    );
  if (command === "mirror" && !["list", "inspect"].includes(args[1] ?? ""))
    throw new E2eError(
      "COMMAND_OUT_OF_SCOPE",
      "E2E captures and inspects mirrors; repair and restore belong to a separate process.",
      "runner",
    );
  if (
    command === "flow" &&
    (args.length !== 4 ||
      args[1] !== flowName ||
      args[2] !== "--intent" ||
      args[3] !== intent)
  )
    throw new E2eError(
      "INTENT_CHANGED",
      "Submit the case's complete original intent once.",
      "scenario",
    );
}
