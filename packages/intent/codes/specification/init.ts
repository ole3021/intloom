import type { ExecutableCode } from "@intloom/workflow-sdk";
import { validateArtifact } from "../../src/specification/changes.ts";
import { fail } from "../../src/specification/errors.ts";
import { flowName, stageName } from "../../src/specification/constants.ts";
import { readState, saveState } from "../../src/specification/state.ts";

const init = (async (_input, access) => {
  const state = readState(access);
  if (state.baseline !== undefined) return { outcome: "complete" };
  if (
    state.changes.length ||
    state.questions.length ||
    state.feedbacks.length ||
    state.confirmation ||
    state.processedFeedbackCount
  )
    fail(
      "Initial State must contain only Runtime's run identity and intent text",
    );
  const stored = await access.storage.getArtifact(flowName, stageName);
  if (
    stored &&
    (stored.flowName !== flowName || stored.stageName !== stageName)
  )
    fail("Storage returned an Artifact for another Stage");
  state.baseline = stored
    ? {
        artifactId: stored.id,
        revision: stored.revision,
        data: validateArtifact(stored.data),
      }
    : null;
  await saveState(access, state);
  return { outcome: "complete" };
}) satisfies ExecutableCode;
export default init;
