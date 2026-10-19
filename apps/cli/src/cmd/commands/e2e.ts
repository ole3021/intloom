import { defineCommand } from "citty";
import type { CmdContext } from "../context.ts";
import {
  str,
  bool,
  pos,
  type Values,
  invalid,
  value,
  validateArguments,
} from "../arguments.ts";
export function createE2eCommands(context: CmdContext) {
  const { io, common, setExitCode } = context;
  return {
    e2e: defineCommand({
      meta: {
        description: "Run local Loom E2E cases against its built distribution",
      },
      args: {
        path: pos("Local Loom project (defaults to current directory)", false),
        root: str("Directory for isolated test projects and reports"),
        case: str("Case ID; omitted selects using the recorded seed"),
        entry: str("cmd (default) or mcp"),
        seed: str("Case selection seed"),
        profile: str("Model profile YAML or JSON file"),
        list: bool("List cases without starting a model"),
      },
      async run(context) {
        const a = validateArguments(context.args as Values, {
          path: pos("Local Loom project", false),
          root: str("Output root"),
          case: str("Case ID"),
          entry: str("Entry"),
          seed: str("Seed"),
          profile: str("Profile"),
          list: bool("List cases"),
        });
        if (common.project !== undefined)
          invalid("Use intloom e2e [path] to select a Loom project.");
        const { runE2e } = await import("../e2e.ts");
        setExitCode(
          await runE2e(
            {
              ...(a.path ? { path: value(a, "path", true) } : {}),
              ...(a.root ? { root: value(a, "root", true) } : {}),
              ...(a.case ? { caseId: value(a, "case", true) } : {}),
              ...(a.entry ? { entry: value(a, "entry", true) } : {}),
              ...(a.seed ? { seed: value(a, "seed", true) } : {}),
              ...(a.profile ? { profile: value(a, "profile", true) } : {}),
              list: a.list === true,
            },
            io,
          ),
        );
      },
    }),
  };
}
