import { digest } from "../../src/flow/shared.ts";
import type { ExecutableCode } from "@intloom/workflow-sdk";
import { getLogger } from "@intloom/utils";
import { isDeepStrictEqual } from "node:util";
import * as z from "zod";
import { specificationRecordSchema } from "../../schemas/specification-record.ts";
import {
  artifactId,
  flowName,
  stageName,
} from "../../src/specification/constants.ts";
import { fail } from "../../src/specification/errors.ts";
import { readInitializedState } from "../../src/specification/state.ts";
import { assertBaseline } from "../../src/specification/baseline.ts";
import {
  assertConfirmation,
  confirmationContext,
} from "../../src/specification/confirmation.ts";
import { review } from "../../src/specification/review.ts";

const finalize = (async (_input, access) => {
  const state = readInitializedState(access);
  assertConfirmation(state);
  const { artifact, originRefs } = review(state);
  const context = confirmationContext(state);
  const record = specificationRecordSchema.parse({
    id: state.id,
    intent: state.intent,
    resultDigest: digest(artifact),
    origin_refs: originRefs,
    changes: state.changes,
    questions: context.questions,
    feedbacks: state.feedbacks,
  });
  const existing = await access.storage.getRecordById(state.id);
  // A retry after commit succeeded but State.clear failed must not commit twice.
  if (existing) {
    if (
      existing.flowName !== flowName ||
      existing.stageName !== stageName ||
      !isDeepStrictEqual(existing.data, record)
    )
      fail("Run record already exists with different content");
    getLogger().debug("specification_commit_reused", { recordId: state.id });
  } else {
    await assertBaseline(access, state);
    const payload = { flowName, stageName, data: z.json().parse(artifact) };
    await access.storage.commit([
      state.baseline
        ? {
            type: "replace_artifact",
            id: state.baseline.artifactId,
            expectedRevision: state.baseline.revision,
            payload,
          }
        : { type: "create_artifact", id: artifactId, payload },
      {
        type: "append_record",
        id: state.id,
        payload: { flowName, stageName, data: z.json().parse(record) },
      },
    ]);
  }
  await access.state.clear();
  return { outcome: "complete" };
}) satisfies ExecutableCode;
export default finalize;
