import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join, sep } from "node:path";
import { filesUnder, localPath } from "./cases.ts";
import { E2eError } from "./contracts.ts";
import type { Evidence } from "./evidence.ts";
import { processResult } from "./process.ts";

export async function snapshotSuite(source: string, target: string) {
  for (const file of await filesUnder(source)) {
    if (
      file.startsWith(`cases${sep}`) ||
      /\.(?:spec|intg)\.[cm]?[jt]s$/u.test(file)
    )
      continue;
    const destination = localPath(target, file);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(join(source, file), destination, 1);
  }
}
export async function runScripts(input: {
  scripts: string[];
  phase: "preparation" | "checks";
  suite: string;
  project: string;
  context: unknown;
  contextName: string;
  evidence: Evidence;
  timeout: number;
  environment: NodeJS.ProcessEnv;
  signal: AbortSignal;
}) {
  await input.evidence.save(input.contextName, input.context);
  const results = [];
  for (const script of input.scripts) {
    await input.evidence.event(`${input.phase}_started`, { script });
    const result = await processResult(
      process.execPath,
      [
        localPath(input.suite, script),
        join(input.evidence.directory, input.contextName),
      ],
      input.project,
      input.timeout,
      input.signal,
      input.environment,
    );
    await input.evidence.event(`${input.phase}_finished`, {
      script,
      ...result,
    });
    results.push({ script, status: result.code === 0 ? "passed" : "failed" });
    if (result.code !== 0)
      throw new E2eError(
        input.phase === "checks" ? "CASE_CHECK_FAILED" : "PREPARATION_FAILED",
        `${script} failed. See preserved script receipts.`,
        "scenario",
      );
  }
  return {
    status: input.scripts.length
      ? ("passed" as const)
      : ("not_configured" as const),
    scripts: results,
  };
}
