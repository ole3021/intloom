import { specificationContextSchema } from "../schema/context.ts";
import type * as z from "zod";
import type { StageAccess } from "../../../src/access.ts";
import { read, save, assertRevision, toolResult } from "../../../src/state.ts";
import { specificationStateSchema } from "../schema/state.ts";
import { specificationArtifactSchema } from "../schema/artifact.ts";
import {
  scopeSchema,
  type analyzeInputSchema,
  type editInputSchema,
  type draftInputSchema,
} from "../schema/submission.ts";
import { batchEdit, allocateIds, resolveRefs } from "../../../src/edits.ts";
import { context } from "../../../src/project.ts";
import { json } from "../../../src/json.ts";
import { unanswered } from "../../../src/questions.ts";
import { checkObjects, checkSpecification } from "./rules.ts";
export const readState = (access: StageAccess) =>
  read(access, specificationStateSchema);
export async function readContext(_input: unknown, access: StageAccess) {
  const s = readState(access);
  return specificationContextSchema.parse(
    json({
      ...context(s),
      baseline: s.baseline,
      analysis: s.analysis,
      draft: s.draft,
      scope: s.scope,
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
    assertRevision(s, input.revision, ["draft"]);
    const result = batchEdit(s.id, s.draft!, s.aliases, input.edits);
    const draft = specificationArtifactSchema.parse(result.draft);
    checkObjects(draft);
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
  input: z.infer<typeof draftInputSchema>,
  access: StageAccess,
) {
  const s = readState(access);
  try {
    assertRevision(s, input.revision, ["draft"]);
    const ids = allocateIds(s.id, s.aliases, [
      {
        prefix: "WORK",
        items: input.scope.workItems,
        existing: s.scope?.workItems ?? [],
      },
      {
        prefix: "ROUND",
        items: input.scope.roundCriteria,
        existing: s.scope?.roundCriteria ?? [],
      },
    ]);
    s.scope = scopeSchema.parse(resolveRefs(input.scope, ids));
    checkSpecification(s);
    s.aliases = ids;
    delete s.approval;
    delete s.reviewDigest;
    await save(access, s);
    return { ...toolResult(s), outcome: "ready", ids: s.aliases };
  } catch (e) {
    return toolResult(s, e);
  }
}
