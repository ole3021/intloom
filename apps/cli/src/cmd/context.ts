import { defineCommand, type ArgsDef, type CommandDef } from "citty";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import type { Readable, Writable } from "node:stream";
import { createCliCore, type ProjectInput } from "../core/index.ts";
import { projectRoot } from "@intloom/kernel/host";
import { failure } from "../errors.ts";
import {
  normalizeArguments,
  invalid,
  value,
  validateArguments,
  type Values,
} from "./arguments.ts";
import { createTextInput } from "./input.ts";
import { createOutput } from "./output/index.ts";
export interface CliIo {
  readonly input: Readable;
  readonly output: Writable;
  readonly error: Writable;
  readonly cwd: string;
  readonly isTTY: boolean;
}
export const defaultIo = (): CliIo => ({
  input: process.stdin,
  output: process.stdout,
  error: process.stderr,
  cwd: process.cwd(),
  isTTY: Boolean(process.stdin.isTTY && process.stderr.isTTY),
});
export function createCmdContext(rawArgs: readonly string[], io: CliIo) {
  const core = createCliCore();
  const parsed = normalizeArguments(rawArgs);
  const { common, args } = parsed;
  const machine = common.json === true;
  const output = createOutput(io, common, args);
  const { print, setExitCode } = output;
  const text = createTextInput(io);
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
  return {
    core,
    io,
    ...parsed,
    machine,
    output,
    print,
    setExitCode,
    text,
    instance,
    binding,
    leaf,
  };
}
export type CmdContext = ReturnType<typeof createCmdContext>;
