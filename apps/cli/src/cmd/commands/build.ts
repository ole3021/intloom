import { defineCommand } from "citty";
import { resolve } from "node:path";
import type { CmdContext } from "../context.ts";
import {
  type Values,
  buildFlags,
  invalid,
  value,
  validateArguments,
} from "../arguments.ts";
export function createBuildCommands(context: CmdContext) {
  const { core, io, common, print } = context;
  return {
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
