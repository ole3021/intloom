import { solutionContextSchema } from "../schema/context.ts";
import type * as z from "zod";
import type { StageAccess } from "../../../src/access.ts";
import { read, save, assertRevision, toolResult } from "../../../src/state.ts";
import { solutionStateSchema } from "../schema/state.ts";
import { solutionArtifactSchema } from "../schema/artifact.ts";
import {
  planSchema,
  type analyzeInputSchema,
  type editInputSchema,
  type designInputSchema,
} from "../schema/submission.ts";
import { batchEdit, allocateIds, resolveRefs } from "../../../src/edits.ts";
import { context } from "../../../src/project.ts";
import { json } from "../../../src/json.ts";
import { unanswered } from "../../../src/questions.ts";
import { checkObjects, checkSolution } from "./rules.ts";
export const readState = (access: StageAccess) =>
  read(access, solutionStateSchema);
export async function readContext(_input: unknown, access: StageAccess) {
  const s = readState(access);
  return solutionContextSchema.parse(
    json({
      ...context(s),
      specificationRef: s.specificationRef,
      requirements: s.specification?.snapshot,
      scope: s.specification?.scope,
      baseline: s.baseline,
      analysis: s.analysis,
      draft: s.draft,
      plan: s.plan,
      aliases: s.aliases,
    }),
  );
}
export async function analyze(
  input: z.infer<typeof analyzeInputSchema>,
  access: StageAccess,
) {
  const s = readState(access);
  try {
    assertRevision(s, input.revision, ["analyze"]);
    s.analysis = input.analysis;
    s.questions = unanswered(s, input.analysis.questions);
    delete s.approval;
    delete s.reviewDigest;
    await save(access, s);
    return {
      ...toolResult(s),
      outcome: s.questions.length ? "needs_input" : "ready",
    };
  } catch (e) {
    return toolResult(s, e);
  }
}
export async function edit(
  input: z.infer<typeof editInputSchema>,
  access: StageAccess,
) {
  const s = readState(access);
  try {
    assertRevision(s, input.revision, ["design"]);
    const result = batchEdit(s.id, s.draft!, s.aliases, input.edits);
    const draft = solutionArtifactSchema.parse(result.draft);
    checkObjects(
      draft,
      s.specification!.snapshot.requirements.map((x) => x.id),
    );
    s.draft = draft;
    s.aliases = result.ids;
    s.edits.push(...result.audit);
    delete s.approval;
    delete s.reviewDigest;
    await save(access, s);
    return { ...toolResult(s), ids: s.aliases };
  } catch (e) {
    return toolResult(s, e);
  }
}
export async function submit(
  input: z.infer<typeof designInputSchema>,
  access: StageAccess,
) {
  const s = readState(access);
  try {
    assertRevision(s, input.revision, ["design"]);
    const ids = allocateIds(s.id, s.aliases, [
      {
        prefix: "IMPL",
        items: input.plan.implementationItems,
        existing: s.plan?.implementationItems ?? [],
      },
      {
        prefix: "VERIFY",
        items: input.plan.verifications,
        existing: s.plan?.verifications ?? [],
      },
      {
        prefix: "ENGINEERING",
        items: input.plan.engineeringTargets,
        existing: s.plan?.engineeringTargets ?? [],
      },
    ]);
    s.plan = planSchema.parse(resolveRefs(input.plan, ids));
    checkSolution(s);
    s.aliases = ids;
    delete s.approval;
    delete s.reviewDigest;
    await save(access, s);
    return { ...toolResult(s), outcome: "ready", ids: s.aliases };
  } catch (e) {
    return toolResult(s, e);
  }
}
