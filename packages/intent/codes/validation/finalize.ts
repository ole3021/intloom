import type { ExecutableCode } from "@intloom/workflow-sdk";
import {
  readValidation,
  reviewValidation,
  summarize,
} from "../../src/validation/review.ts";
import { commitStage } from "../../src/flow/shared.ts";
const finalize = (async (_input, access) => {
  const state = readValidation(access);
  const report = await reviewValidation(access, state);
  const artifact = {
    id: state.id,
    specification: state.specification,
    solution: state.solution,
    implementationRecordId: state.implementationRecordId,
    codeSnapshot: state.fileSnapshot,
    commandResults: state.commandResults,
    scope: state.scope,
    ...report,
    results: summarize(state),
  };
  await commitStage(
    access,
    state.id,
    "validation",
    artifact,
    undefined,
    state.baseline ?? null,
  );
  return { outcome: "complete" };
}) satisfies ExecutableCode;
export default finalize;
