import { resolve } from "node:path";
import { loomSource } from "@intloom/kernel/host";
import type { CmdContext } from "../context.ts";
import { str, bool, pos, invalid, value } from "../arguments.ts";
export function createInitCommands(context: CmdContext) {
  const { core, io, common, loomInputs, machine, print, leaf } = context;
  return {
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
  };
}
