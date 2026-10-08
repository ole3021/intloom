import type { StageStateInitializer } from "@intloom/workflow-sdk";
const initializeState = (({ runId, intent }) => ({
  id: runId,
  intent,
})) satisfies StageStateInitializer;
export default initializeState;
