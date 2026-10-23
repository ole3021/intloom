import { resolve } from "node:path";
import { parseArtifactSelector } from "@intloom/kernel/operations";
import { failure } from "../../errors.ts";
import { exportArtifact } from "../export-artifact.ts";
import type { CmdContext } from "../context.ts";
import {
  str,
  bool,
  pos,
  queryFlags,
  query,
  invalid,
  value,
} from "../arguments.ts";
export function createResourcesCommands(context: CmdContext) {
  const { core, io, print, leaf } = context;
  return {
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
        if (a.overwrite && !a.output) invalid("--overwrite requires --output.");
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
  };
}
