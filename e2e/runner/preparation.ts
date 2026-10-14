import { dirname, join } from "node:path";
import type { Configuration } from "./configuration.ts";
import { suiteFile } from "./configuration.ts";
import type { Session } from "./session.ts";
import { processResult } from "./commands.ts";
import { E2eError } from "./contracts.ts";

export async function runPreparation(
  session: Session,
  config: Configuration,
  suite: string,
) {
  const scripts = config.preparation?.scripts ?? [];
  if (!scripts.length) return;
  const name = "preparation.json";
  await session.evidence.save(name, {
    entry: session.options.entry,
    project: session.project,
    execution: dirname(session.project),
    cli: session.options.cli,
    flowName: session.options.flowName,
    storage: session.profile.storage,
    caseDirectory: session.caseData.directory,
  });
  for (const script of scripts) {
    await session.evidence.event("preparation_started", { script });
    const result = await processResult(
      process.execPath,
      [suiteFile(suite, script), join(session.evidence.directory, name)],
      session.project,
      session.limits.commandTimeoutMs,
      session.signal,
      session.environment,
    );
    await session.evidence.event("preparation_finished", { script, ...result });
    if (result.code !== 0)
      throw new E2eError(
        "PREPARATION_FAILED",
        `Workflow preparation script ${script} failed. No Run was started.`,
        "scenario",
      );
  }
}
