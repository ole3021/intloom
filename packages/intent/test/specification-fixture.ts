import assert from "node:assert/strict";
import { runtime } from "./runtime.ts";
import { submitProposal } from "../src/specification/proposal.ts";
import init from "../codes/specification/init.ts";
import check from "../codes/specification/check.ts";
import confirm from "../codes/specification/confirm.ts";
import type { SpecificationArtifact } from "../schemas/specification-artifact.ts";

export const question = {
  id: "QST-1",
  question: "Is export required?",
  isBlock: true,
} as const;
export const proposal = {
  changes: [],
  questions: [],
  processedFeedbackCount: 0,
};
export async function ready(baseline?: SpecificationArtifact) {
  const r = runtime(baseline);
  await init(null, r.access);
  await submitProposal(proposal, r.access);
  assert.deepEqual(await check(null, r.access), { outcome: "ready" });
  return r;
}
export async function confirmed(baseline?: SpecificationArtifact) {
  const r = await ready(baseline);
  r.access.interaction.confirm = async () => ({ isConfirmed: true });
  await confirm(null, r.access);
  return r;
}
