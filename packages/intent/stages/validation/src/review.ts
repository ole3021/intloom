import type { ValidationState } from "../schema/state.ts";
import {
  bullets,
  section,
  candidateLabel,
  verificationLines,
} from "../../../src/review.ts";
export function formatReview(s: ValidationState) {
  return [
    section("Candidate", candidateLabel(s.candidate!)),
    section(
      "Acceptance scope",
      bullets(
        s.targets.map((target) => `${target.statement} (${target.kind})`),
      ),
    ),
    section(
      "Current judgments and evidence gaps",
      bullets(
        (s.submission?.assessments ?? []).map(
          (item) =>
            `${s.targets.find((target) => target.id === item.targetRef)?.statement}: ${item.verdict}. ${item.explanation}\n  Missing evidence: ${item.missingEvidence.join("; ") || "none"}. Limitations: ${item.limitations.join("; ") || "none"}.`,
        ),
      ),
    ),
    section(
      "Collection attempts",
      bullets(verificationLines(s.verifications, s.evidence)),
    ),
    section(
      "Information needed",
      bullets(s.questions.map((question) => question.question)),
    ),
    section(
      "Effect of this decision",
      "Continue supplies missing information or retries the listed unfinished collection. Pause keeps the Run waiting. Stop ends only the displayed collection work and evidence gaps; known failures and uncertainty remain. It does not approve acceptance, change goals, or cancel an unsettled execution.",
    ),
  ].join("\n\n");
}
