import type { StageStateInitializer } from "@intloom/loom-sdk";
import { fail } from "./errors.ts";
const initializeState = (({ runId, stageName, input }) => {
  if (!input.prompt?.trim()) fail("Intent requires a prompt input.");
  return { id: runId, prompt: input.prompt, stageName };
}) satisfies StageStateInitializer;
export default initializeState;
