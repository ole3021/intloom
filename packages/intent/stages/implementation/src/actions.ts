import { implementationContextSchema } from "../schema/context.ts";
import type * as z from "zod";
import type { StageAccess } from "../../../src/access.ts";
import { project } from "../../../src/access.ts";
import { read, save, assertRevision, toolResult } from "../../../src/state.ts";
import { implementationStateSchema } from "../schema/state.ts";
import type {
  implementationSubmissionSchema,
  diagnosticInputSchema,
} from "../schema/submission.ts";
import {
  executionDataSchema,
  type observationSubmissionSchema,
} from "../../../src/schema/verification.ts";
import {
  context,
  snapshot,
  changes,
  evidence,
  linkedEvidence,
} from "../../../src/project.ts";
import { json, digest } from "../../../src/json.ts";
import {
  recordObservation,
  assertSettled,
  verificationFailures,
  latestVerificationEvidence,
} from "../../../src/verification.ts";
import { checkSubmission } from "./rules.ts";
export const readState = (access: StageAccess) =>
  read(access, implementationStateSchema);
export async function refresh(
  access: StageAccess,
  s: ReturnType<typeof readState>,
) {
  assertSettled(s);
  const current = await snapshot(access);
  if (s.candidate?.id !== current.id) {
    s.candidate = current;
    s.changes = changes(s.baseline!, current, s.evidence);
    delete s.checkedDigest;
    delete s.partialApproval;
    delete s.externalApproval;
    for (const v of s.verifications) {
      v.disposition = "pending";
      v.reason = "New candidate requires verification.";
      delete v.candidateRef;
    }
    await save(access, s);
  } else s.changes = changes(s.baseline!, current, s.evidence);
}
export async function readContext(_input: unknown, access: StageAccess) {
  const s = readState(access);
  if (s.task === "implement") await refresh(access, s);
  return implementationContextSchema.parse(
    json({
      ...context(s),
      basis: s.solutionRef,
      requirements: s.specification?.snapshot,
      scope: s.specification?.scope,
      design: s.solution?.snapshot,
      plan: s.solution?.plan,
      baseline: s.baseline,
      candidate: s.candidate,
      changes: s.changes,
      verifications: s.verifications,
      submission: s.submission,
      observationRef: s.observationRef,
    }),
  );
}
export async function submit(
  input: z.infer<typeof implementationSubmissionSchema>,
  access: StageAccess,
) {
  const s = readState(access);
  try {
    assertRevision(s, input.revision, ["implement"]);
    await refresh(access, s);
    assertRevision(s, input.revision, ["implement"]);
    s.submission = input;
    checkSubmission(s);
    delete s.checkedDigest;
    delete s.partialApproval;
    await save(access, s);
    return { ...toolResult(s), outcome: "ready" };
  } catch (e) {
    return toolResult(s, e);
  }
}
export async function diagnose(
  input: z.infer<typeof diagnosticInputSchema>,
  access: StageAccess,
) {
  const s = readState(access);
  assertRevision(s, input.revision, ["implement"]);
  const before = await snapshot(access),
    startedAt = new Date().toISOString();
  const { revision: _revision, purpose, ...command } = input;
  const result = await project(access).run(
      {
        command: command.command,
        args: command.args,
        ...(command.cwd ? { cwd: command.cwd } : {}),
        ...(command.timeoutMs ? { timeoutMs: command.timeoutMs } : {}),
      },
      access.signal,
    ),
    after = await snapshot(access);
  const receipt = evidence(
    s,
    "execution",
    executionDataSchema.parse({
      origin: "diagnostic",
      startedAt,
      finishedAt: new Date().toISOString(),
      before,
      after,
      outcome: [126, 127].includes(result.exitCode ?? 0)
        ? "not_started"
        : result.exitCode === null || result.timedOut
          ? "interrupted"
          : "exited",
      result,
    }),
    before.id,
  );
  for (const change of changes(before, after, []))
    evidence(
      s,
      "project_write",
      {
        path: change.path,
        beforeDigest: change.beforeDigest,
        afterDigest: change.afterDigest,
        operationRef: receipt.id,
        purpose,
      },
      after.id,
    );
  await save(access, s);
  await refresh(access, s);
  return json({ receipt, revision: s.revision, candidateRef: s.candidate?.id });
}
export async function observe(
  input: z.infer<typeof observationSubmissionSchema>,
  access: StageAccess,
) {
  const s = readState(access);
  try {
    await recordObservation(access, s, input);
    return { ...toolResult(s), outcome: "ready" };
  } catch (e) {
    return toolResult(s, e);
  }
}

export async function retryVerification(
  input: {
    revision: number;
    verificationRef: string;
    reason: string;
    evidenceRefs: string[];
  },
  access: StageAccess,
) {
  const s = readState(access);
  try {
    assertRevision(s, input.revision, ["implement"]);
    assertSettled(s);
    const entry = verificationFailures(s).find(
      (v) => v.definition.id === input.verificationRef,
    );
    if (
      !entry ||
      ["pending", "awaiting_observation"].includes(entry.disposition)
    )
      throw new Error(
        "Only a settled failed or unavailable verification may be retried.",
      );
    const receipt = latestVerificationEvidence(s, entry),
      previous = receipt
        ? executionDataSchema.safeParse(receipt.data)
        : undefined;
    const sources = linkedEvidence(s, input.evidenceRefs, s.candidate!.id);
    if (
      !sources.some((source) => {
        const execution = executionDataSchema.safeParse(source.data);
        const data = source.data;
        const at = execution.success
          ? execution.data.finishedAt
          : source.kind === "user_report" &&
              data &&
              typeof data === "object" &&
              !Array.isArray(data) &&
              typeof data.at === "string"
            ? data.at
            : undefined;
        return (
          at &&
          (!previous?.success || at >= previous.data.finishedAt) &&
          source.id !== receipt?.id
        );
      })
    )
      throw new Error(
        "Retry requires a new diagnostic receipt or actual user information about changed execution conditions.",
      );
    const basis = digest({
      candidate: s.candidate!.id,
      evidenceRefs: [...input.evidenceRefs].sort(),
    });
    if (entry.retryBasis === basis)
      throw new Error("These retry conditions were already used.");
    entry.retryBasis = basis;
    entry.disposition = "pending";
    entry.reason = input.reason;
    delete s.checkedDigest;
    delete s.partialApproval;
    await save(access, s);
    return toolResult(s);
  } catch (error) {
    return toolResult(s, error);
  }
}
