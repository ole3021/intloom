import type { ExecutableCode } from "@intloom/workflow-sdk";
import { isDeepStrictEqual } from "node:util";
import { implementationRecordSchema } from "../../schemas/implementation-state.ts";
import {
  readImplementation,
  assertImplementationBasis,
} from "../../src/implementation/state.ts";
import { passed, validateChanges } from "../../src/implementation/checks.ts";
import {
  project,
  json,
  digest,
  recordId,
  fail,
} from "../../src/flow/shared.ts";
const finalize = (async (_input, access) => {
  const state = readImplementation(access);
  await assertImplementationBasis(access, state);
  const snapshot = await project(access).snapshot();
  if (
    !state.checkedSnapshot ||
    !isDeepStrictEqual(snapshot, state.checkedSnapshot)
  )
    return { outcome: "recheck_required" };
  if (!state.checkResults.length || !state.checkResults.every(passed))
    fail("Implementation requires passing host checks.");
  validateChanges(state, snapshot);
  const record = implementationRecordSchema.parse({
    id: state.id,
    intent: state.intent,
    specification: state.specification,
    solution: state.solution,
    changes: state.changes,
    feedbacks: state.feedbacks,
    initialSnapshot: state.initialSnapshot,
    fileSnapshot: snapshot,
    checks: state.checkResults,
    resultDigest: digest(snapshot),
  });
  const id = recordId(state.id, "implementation");
  const old = await access.storage.getRecordById(id);
  if (old) {
    if (!isDeepStrictEqual(old.data, json(record)))
      fail("Implementation Record already differs.");
  } else
    await access.storage.commit([
      {
        type: "append_record",
        id,
        payload: {
          flowName: "intent",
          stageName: "implementation",
          data: json(record),
        },
      },
    ]);
  await access.state.clear();
  return { outcome: "complete" };
}) satisfies ExecutableCode;
export default finalize;
