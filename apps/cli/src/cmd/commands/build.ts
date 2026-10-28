import { defineCommand, type ArgsDef } from "citty";
import { resolve } from "node:path";
import type { CmdContext } from "../context.ts";
import {
  type Values,
  str,
  pos,
  buildFlags,
  invalid,
  value,
  validateArguments,
} from "../arguments.ts";
export function createBuildCommands(context: CmdContext) {
  const { core, io, common, print } = context;
  function sourceCommand(
    description: string,
    args: ArgsDef,
    action: (values: Values) => Promise<void>,
  ) {
    return defineCommand({
      meta: { description },
      args,
      async run(context) {
        if (common.project !== undefined)
          invalid("Select the Loom source directory with the path argument.");
        await action(validateArguments(context.args as Values, args));
      },
    });
  }
  return {
    check: sourceCommand(
      "Check a Loom including TypeScript and packaged imports; preserve dist",
      { path: pos("Source directory", false) },
      async (a) =>
        print(
          await core.checkLoom({
            packagePath: resolve(io.cwd, value(a, "path") ?? "."),
          }),
        ),
    ),
    inspect: sourceCommand(
      "Inspect a new Loom source definition and generated plan without executing it",
      { path: pos("Source directory", false) },
      async (a) =>
        print(
          await core.inspectLoom({
            packagePath: resolve(io.cwd, value(a, "path") ?? "."),
          }),
        ),
    ),
    new: sourceCommand(
      "Create a minimal Loom in a new directory",
      { path: pos("New directory"), template: str("code or agent") },
      async (a) => {
        const template = value(a, "template") ?? "code";
        if (template !== "code" && template !== "agent")
          invalid("Template must be code or agent.");
        print(
          await core.scaffoldLoom({
            packagePath: resolve(io.cwd, value(a, "path", true)),
            template,
          }),
        );
      },
    ),
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
  };
}
