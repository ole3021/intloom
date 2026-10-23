import { validationContextSchema } from "../schema/context.ts";
import type * as z from "zod";
import type { StageAccess } from "../../../src/access.ts";
import {
  read,
  save,
  assertRevision,
  toolResult,
  contains,
} from "../../../src/state.ts";
import { validationStateSchema } from "../schema/state.ts";
import { assessmentSubmissionSchema } from "../schema/submission.ts";
import type { observationSubmissionSchema } from "../../../src/schema/verification.ts";
import { context, assertCandidate } from "../../../src/project.ts";
import { json, digest } from "../../../src/json.ts";
import { formalId } from "../../../src/edits.ts";
import { unanswered } from "../../../src/questions.ts";
import { recordObservation } from "../../../src/verification.ts";
import { checkAssessment } from "./rules.ts";
import { fail } from "../../../src/errors.ts";
export const readState = (access: StageAccess) =>
  read(access, validationStateSchema);
export async function readContext(_input: unknown, access: StageAccess) {
  const s = readState(access);
  await assertCandidate(access, s.candidate);
  return validationContextSchema.parse(
    json({
      ...context(s),
      basis: s.implementationRef,
      candidate: s.candidate,
      delivery: s.implementation?.delivery,
      targets: s.targets,
      verifications: s.verifications,
      history: s.history,
      draft: s.submission,
      collectionDecisions: s.collectionDecisions,
      observationRef: s.observationRef,
    }),
  );
}
export async function submit(
  input: z.infer<typeof assessmentSubmissionSchema>,
  access: StageAccess,
) {
  const s = readState(access);
  try {
    assertRevision(s, input.revision, ["assess"]);
    await assertCandidate(access, s.candidate);
    const submission = assessmentSubmissionSchema.parse(input);
    for (const finding of submission.findings) {
      if (finding.id.startsWith("$")) {
        const key = finding.id;
        finding.id = s.aliases[key] ??= formalId("FIND", s.id, key);
      } else if (!Object.values(s.aliases).includes(finding.id))
        fail(
          "New findings require a $temporary key; historical findings require findingUpdates.",
        );
    }
    checkAssessment(s, submission, submission.kind === "ready");
    if (submission.kind === "needs_evidence") {
      for (const request of submission.requests) {
        contains(
          s.targets.map((t) => t.id),
          request.targetRefs,
          "supplementary target",
        );
        const id = formalId("VERIFY", s.id, request.key),
          old = s.verifications.find((v) => v.requestKey === request.key);
        const definition = {
          id,
          purpose: request.purpose,
          method: request.method,
          preconditions: request.preconditions,
          expectedEvidence: request.expectedEvidence,
          executionStage: "validation" as const,
        };
        if (old) {
          if (
            digest(old.definition) !== digest(definition) ||
            digest(old.targetRefs) !== digest(request.targetRefs)
          )
            fail("A supplementary request key cannot change its definition.");
          continue;
        }
        const replacement = request.replaces;
        if (replacement) {
          const prior = s.verifications.find(
            (v) => v.definition.id === replacement.verificationRef,
          );
          if (prior?.origin !== "supplementary")
            fail("Only supplementary requests may be replaced.");
          prior.disposition = "stopped";
          prior.reason = `Replaced by ${id}: ${replacement.reason}`;
        }
        s.verifications.push({
          definition,
          origin: "supplementary",
          targetRefs: request.targetRefs,
          requestKey: request.key,
          ...(request.replaces
            ? { replaces: request.replaces.verificationRef }
            : {}),
          disposition: "pending",
          evidenceRefs: [],
          reason: request.evidenceGap,
          attempts: 0,
        });
      }
    }
    if (submission.kind === "needs_input") {
      s.questions = unanswered(s, submission.questions);
      if (!s.questions.length)
        fail(
          "These questions were already answered. Use the actual answers to assess or request genuinely missing information.",
        );
    }
    s.submission = submission;
    delete s.checkedDigest;
    await save(access, s);
    return {
      ...toolResult(s),
      outcome:
        submission.kind === "needs_evidence"
          ? "needs_evidence"
          : s.questions.length
            ? "needs_input"
            : "ready",
      ids: s.aliases,
    };
  } catch (e) {
    return toolResult(s, e);
  }
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
export async function requestStop(
  input: { revision: number; reason: string },
  access: StageAccess,
) {
  const s = readState(access);
  try {
    assertRevision(s, input.revision, ["assess"]);
    s.stopRequested = true;
    s.feedback.push(input.reason);
    await save(access, s);
    return { ...toolResult(s), outcome: "needs_input" };
  } catch (e) {
    return toolResult(s, e);
  }
}
