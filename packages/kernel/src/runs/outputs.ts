import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import type {
  ArtifactRef,
  CompiledLoom,
  ExecutionResult,
  OutputIssue,
  RunResult,
} from "@intloom/loom-sdk";
import { isWithin, resolvePath } from "../paths.ts";
import type { RunRecord } from "./contracts.ts";

export async function collectOutputs(
  run: RunRecord,
  manifest: CompiledLoom,
  execution: ExecutionResult,
): Promise<RunResult> {
  const issues: OutputIssue[] = [];
  const result: Record<string, ArtifactRef> = {};
  const outputs = Object.entries(manifest.output ?? {});
  for (const [name, output] of outputs) {
    const paths = output.type === "files" ? output.paths : [output.path];
    const available: string[] = [];
    for (const relative of paths) {
      const path = join(run.workDir, relative);
      try {
        const actual = await resolvePath(path, run.workDir);
        if (!isWithin(run.workDir, actual))
          throw new Error("Output leaves the work directory");
        const info = await stat(actual);
        if (output.type === "folder" ? !info.isDirectory() : !info.isFile())
          throw new Error(
            `Expected ${output.type === "folder" ? "a directory" : "a file"}`,
          );
        available.push(path);
        if (output.type === "folder" && (await readdir(actual)).length === 0)
          throw new Error("Output directory is empty");
      } catch (error) {
        issues.push({
          name,
          path,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }
    const first = available[0];
    if (first !== undefined) {
      const common = {
        source: { runId: run.runId },
        ...(output.description === undefined
          ? {}
          : { description: output.description }),
      };
      result[name] =
        output.type === "files"
          ? { ...common, type: "files", paths: available }
          : { ...common, type: output.type, path: first };
    }
  }
  const check = issues.length
    ? {
        status: "incomplete" as const,
        issues: issues as [OutputIssue, ...OutputIssue[]],
      }
    : {
        status: outputs.length ? ("ready" as const) : ("none" as const),
        issues: [] as const,
      };
  return {
    runId: run.runId,
    execution,
    outputs: {
      ...check,
      result,
      current:
        run.scope === "workspace" ||
        (execution.status === "succeeded" && check.status === "ready")
          ? result
          : {},
    },
  };
}
