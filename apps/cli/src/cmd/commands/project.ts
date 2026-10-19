import type { CmdContext } from "../context.ts";
import { str, bool, invalid, value } from "../arguments.ts";
export function createProjectCommands(context: CmdContext) {
  const { core, print, leaf } = context;
  return {
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
  };
}
