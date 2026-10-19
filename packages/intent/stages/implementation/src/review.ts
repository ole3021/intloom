import type { ImplementationState } from "../schema/state.ts";
import {
  bullets,
  section,
  candidateLabel,
  verificationLines,
} from "../../../src/review.ts";
import { gaps, unexplainedChanges } from "./rules.ts";
import { fail } from "../../../src/errors.ts";
export function formatReview(s: ImplementationState) {
  const { candidate, solution } = s;
  if (!candidate || !solution) fail("Missing implementation review data.");
  return [
    section("Candidate", candidateLabel(candidate)),
    section(
      "Planned work",
      bullets(
        (s.submission?.items ?? []).map(
          (item) =>
            `${solution.plan.implementationItems.find((work) => work.id === item.implementationRef)?.description}: ${item.outcome}. ${item.explanation}${item.remaining ? ` Remaining: ${item.remaining}` : ""}`,
        ),
      ),
    ),
    section(
      "Actual file changes",
      bullets(s.changes.map((change) => `${change.kind}: ${change.path}`)),
    ),
    section(
      "Changes with unresolved provenance",
      bullets(unexplainedChanges(s).map((change) => change.path)),
    ),
    section(
      "Verification",
      bullets(verificationLines(s.verifications, s.evidence)),
    ),
    section("Remaining work and limitations", bullets(gaps(s))),
    section(
      "Effect of partial delivery",
      "The complete confirmed acceptance scope remains in Validation. This choice does not approve acceptance or change requirements/design.",
    ),
  ].join("\n\n");
}
