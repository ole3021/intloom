import { join } from "node:path";
import type { Configuration } from "./configuration.ts";
import { suiteFile } from "./configuration.ts";
import type { Session } from "./session.ts";
import { processResult } from "./commands.ts";
import { E2eError } from "./contracts.ts";

export async function runAcceptance(
  session: Session,
  config: Configuration,
  suite: string,
  context: unknown,
) {
  const scripts = config.acceptance?.scripts ?? [];
  if (!scripts.length) return { status: "not_configured" as const };
  const name = `round-${String(session.roundIndex + 1).padStart(3, "0")}.json`;
  await session.evidence.save(name, context);
  for (const script of scripts) {
    await session.evidence.event("acceptance_started", {
      round: session.roundIndex + 1,
      script,
    });
    // No shell interpolation; scripts own their assertions and use the preserved context.
    const result = await processResult(
      process.execPath,
      [suiteFile(suite, script), join(session.evidence.directory, name)],
      session.project,
      session.limits.commandTimeoutMs,
      session.signal,
      session.environment,
    );
    await session.evidence.event("acceptance_finished", {
      round: session.roundIndex + 1,
      script,
      ...result,
    });
    if (result.code !== 0)
      throw new E2eError(
        "ACCEPTANCE_FAILED",
        `Workflow acceptance script ${script} failed. Remaining intents were not executed.`,
        "scenario",
      );
  }
  return { status: "passed" as const };
}
