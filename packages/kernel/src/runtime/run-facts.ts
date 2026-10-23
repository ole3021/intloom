import type { StorageCommitResult } from "@intloom/loom-sdk";
import type { RunState } from "./run-state.ts";
import type { RunEntry } from "./run-entry.ts";
import { saveCheckpoint } from "./recovery/checkpoint.ts";
import type { RunResult } from "./schemas/run-result.ts";
export { runResultSchema } from "./schemas/run-result.ts";
export type { RunResult } from "./schemas/run-result.ts";
interface RunFacts {
  inFlight: number;
  results: RunResult[];
}
const facts = new WeakMap<RunState, RunFacts>();
/** Correctness facts exist even when model metrics and budgets are disabled. */
export function runFacts(state: RunState): RunFacts {
  let value = facts.get(state);
  if (!value) {
    value = { inFlight: 0, results: [] };
    facts.set(state, value);
  }
  return value;
}
export function isRunSettled(state: RunState): boolean {
  return (
    ["completed", "failed", "paused"].includes(state.status) &&
    runFacts(state).inFlight === 0
  );
}
/** Commit references describe actual success, including a known late commit whose caller lost ownership. */
export function recordRunCommit(
  entry: RunEntry,
  cursor: { stageName: string; stepName: string },
  executionId: number,
  result: StorageCommitResult,
) {
  const facts = runFacts(entry.state);
  const base = {
    ...cursor,
    executionId,
    committedAt: new Date().toISOString(),
  };
  for (const artifact of result.writtenArtifacts)
    facts.results.push({
      ...base,
      kind: "artifact",
      id: artifact.id,
      revision: artifact.revision,
    });
  for (const record of result.appendedRecords)
    facts.results.push({ ...base, kind: "record", id: record.id });
  for (const id of result.removedArtifactIds)
    facts.results.push({ ...base, kind: "removed_artifact", id });
  for (const id of result.removedRecordIds)
    facts.results.push({ ...base, kind: "removed_record", id });
  if (entry.recovery && !entry.recovery.error)
    saveCheckpoint(entry, entry.recovery.phase);
}
