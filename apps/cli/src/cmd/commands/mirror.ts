import { defineCommand } from "citty";
import { resolve } from "node:path";
import type { CmdContext } from "../context.ts";
import { str, bool, pos, invalid, value } from "../arguments.ts";
export function createMirrorCommands(context: CmdContext) {
  const { core, io, print, leaf } = context;
  return {
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
  };
}
