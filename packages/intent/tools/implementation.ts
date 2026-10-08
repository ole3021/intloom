import { defineAgentTool } from "@intloom/workflow-sdk";
import * as z from "zod";
import { implementationProposalSchema } from "../schemas/implementation-state.ts";
import {
  readImplementation,
  saveImplementation,
} from "../src/implementation/state.ts";
import { fail, json } from "../src/flow/shared.ts";
export const readImplementationContext = defineAgentTool({
  id: "read_implementation",
  description:
    "Read confirmed requirements/design, initial file hashes, the user-confirmed check plan and repair feedback. Use native IDE editing when available; otherwise project Tools. Do not change approved requirements or architecture.",
  inputSchema: z.strictObject({}),
  outputSchema: z.json(),
  execute: async (_input, access) => json(readImplementation(access)),
});
export const submitImplementation = defineAgentTool({
  id: "submit_implementation",
  description:
    "Record all actual file changes and their requirement/design origins. The host independently executes the confirmed check plan; declaring success here does not complete the Stage.",
  inputSchema: implementationProposalSchema,
  outputSchema: z.strictObject({ saved: z.boolean() }),
  execute: async (input, access) => {
    const state = readImplementation(access);
    if (++state.iterations > 8)
      fail(
        "Implementation exceeded its repair budget.",
        "INTENT_BUDGET_EXCEEDED",
      );
    if (
      input.processedFeedbackCount < state.processedFeedbackCount ||
      input.processedFeedbackCount > state.feedbacks.length
    )
      fail("Invalid feedback count.");
    state.changes = input.changes;
    state.processedFeedbackCount = input.processedFeedbackCount;
    delete state.checkedSnapshot;
    state.checkResults = [];
    await saveImplementation(access, state);
    return { saved: true };
  },
});
