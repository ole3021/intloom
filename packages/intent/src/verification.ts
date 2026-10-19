import type * as z from "zod";
import type { StageAccess } from "./access.ts";
import type { BaseState, Candidate } from "./schema/common.ts";
import {
  executionDataSchema,
  observationDataSchema,
  type VerificationEntry,
  type observationSubmissionSchema,
} from "./schema/verification.ts";
import { assertRevision, save, unique } from "./state.ts";
import {
  assertCandidate,
  evidence,
  linkedEvidence,
  verifyEntry,
} from "./project.ts";
import { fail } from "./errors.ts";
export interface VerificationState extends BaseState {
  candidate?: Candidate | undefined;
  verifications: VerificationEntry[];
  observationRef?: string | undefined;
}
export function assertSettled(state: VerificationState) {
  if (state.verifications.some((entry) => entry.disposition === "executing"))
    fail(
      "An original command has no settled receipt. Reconcile that execution before continuing; it must not be automatically replayed.",
      "INTENT_EXECUTION_UNSETTLED",
    );
}
export function latestVerificationEvidence(
  state: VerificationState,
  entry: VerificationEntry,
) {
  return entry.evidenceRefs
    .map((ref) => state.evidence.find((e) => e.id === ref))
    .filter((e) => e?.candidateRef === state.candidate?.id)
    .at(-1);
}
export function verificationFailures(state: VerificationState) {
  return state.verifications.filter((item) => {
    if (!["executed", "adopted"].includes(item.disposition)) return true;
    const latest = latestVerificationEvidence(state, item);
    if (!latest) return true;
    const execution = executionDataSchema.safeParse(latest.data);
    const observation = observationDataSchema.safeParse(latest.data);
    if (observation.success)
      return (
        observation.data.kind === "needs_attention" ||
        observation.data.steps.some(
          (step) =>
            step.status !== "observed" || step.assessment !== "supports",
        )
      );
    return (
      execution.success &&
      (execution.data.outcome !== "exited" ||
        execution.data.result.exitCode !== 0 ||
        execution.data.result.timedOut ||
        execution.data.result.truncated)
    );
  });
}
export async function verifyQueue(
  access: StageAccess,
  state: VerificationState,
  completeTask: string,
) {
  assertSettled(state);
  if (!state.candidate) fail("Missing fixed candidate.");
  await assertCandidate(access, state.candidate);
  for (const entry of state.verifications) {
    if (
      entry.disposition !== "pending" &&
      entry.disposition !== "awaiting_observation"
    )
      continue;
    if (entry.definition.method.kind === "procedure") {
      entry.disposition = "awaiting_observation";
      state.observationRef = entry.definition.id;
      state.task = "observe";
      await save(access, state);
      return { outcome: "observe" };
    }
    await verifyEntry(access, state, entry, state.candidate);
  }
  delete state.observationRef;
  state.task = completeTask;
  await save(access, state);
  return { outcome: "ready" };
}
export async function recordObservation(
  access: StageAccess,
  state: VerificationState,
  input: z.infer<typeof observationSubmissionSchema>,
) {
  assertRevision(state, input.revision, ["observe"]);
  if (
    !state.candidate ||
    input.candidateRef !== state.candidate.id ||
    input.verificationRef !== state.observationRef
  )
    fail("Observation does not match its assigned candidate or task.");
  await assertCandidate(access, state.candidate);
  const entry = state.verifications.find(
    (v) => v.definition.id === input.verificationRef,
  );
  if (entry?.definition.method.kind !== "procedure") fail("Unknown procedure.");
  const procedureSteps = entry.definition.method.steps;
  unique(
    input.steps.map((s) => String(s.stepIndex)),
    "observation steps",
  );
  if (
    input.steps.length !== procedureSteps.length ||
    input.steps.some((s) => s.stepIndex >= procedureSteps.length)
  )
    fail("Every procedure step needs an actual disposition.");
  for (const step of input.steps) {
    const sources = linkedEvidence(
      state,
      step.evidenceRefs,
      state.candidate.id,
    );
    if (
      step.status === "observed" &&
      !sources.some((e) =>
        ["execution", "project_read", "user_report"].includes(e.kind),
      )
    )
      fail(
        "An observation needs a real operation, source read or user report.",
      );
  }
  const item = evidence(
    state,
    "observation",
    { ...input, method: entry.definition.method, at: new Date().toISOString() },
    state.candidate.id,
  );
  entry.evidenceRefs.push(item.id);
  entry.attempts++;
  entry.candidateRef = state.candidate.id;
  entry.disposition = input.steps.every((s) => s.status === "observed")
    ? "executed"
    : "unavailable";
  entry.reason =
    input.limitations.join("; ") || "Actual observations were recorded.";
  state.task = "verify";
  delete state.observationRef;
  await save(access, state);
}
