import type { StageStateInitializer } from "@intloom/workflow-sdk";

/** Constructs only the business seed; Schema applies defaults, and entry Code reads the business baseline. */
const initializeState = (({ runId, intent }) => ({
  id: runId,
  intent,
})) satisfies StageStateInitializer;

export default initializeState;
