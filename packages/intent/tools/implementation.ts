import { defineAgentTool } from "@intloom/workflow-sdk";
import * as z from "zod";
import {
  implementationProposalSchema,
  implementationSubmissionResultSchema,
} from "../schemas/implementation-state.ts";
import {
  readImplementation,
  saveImplementation,
} from "../src/implementation/state.ts";
import { fail, json, project } from "../src/flow/shared.ts";
import { changeDiagnostics } from "../src/implementation/checks.ts";
export const readImplementationContext = defineAgentTool({
  id: "read_implementation",
  description:
    "Read confirmed requirements/design, initial hashes, host check plan, all repair feedback and submissionContext with exact cumulative changedPaths, validOriginRefs and expectedFeedbackCount. The change list is relative to initialSnapshot, never just the latest repair. Do not change approved requirements or architecture.",
  inputSchema: z.strictObject({}),
  outputSchema: z.json(),
  execute: async (_input, access) => {
    const state = readImplementation(access);
    return json({
      ...state,
      submissionContext: changeDiagnostics(
        state,
        await project(access).snapshot(),
      ),
    });
  },
});
export const submitImplementation = defineAgentTool({
  id: "submit_implementation",
  description:
    "Replace the complete cumulative list of all paths changed since initialSnapshot, retaining earlier implementation changes and copying expectedFeedbackCount. Use only specification/solution object IDs as origins, never check command IDs. saved=false returns all list issues for correction without restarting the Agent. After saved=true, return only ready; host Code runs the approved checks.",
  inputSchema: implementationProposalSchema,
  outputSchema: implementationSubmissionResultSchema,
  endsAgent: (output) => output.saved,
  execute: async (
    input,
    access,
  ): Promise<z.infer<typeof implementationSubmissionResultSchema>> => {
    const state = readImplementation(access);
    if (++state.iterations > 8)
      fail(
        "Implementation exceeded its repair budget.",
        "INTENT_BUDGET_EXCEEDED",
      );
    const candidate = {
      ...state,
      changes: input.changes,
      processedFeedbackCount: input.processedFeedbackCount,
    };
    const diagnostics = changeDiagnostics(
      candidate,
      await project(access).snapshot(),
    );
    if (
      diagnostics.missingPaths.length ||
      diagnostics.unchangedPaths.length ||
      diagnostics.unknownOriginRefs.length ||
      diagnostics.feedbackUnprocessed
    ) {
      await saveImplementation(access, state);
      return {
        saved: false,
        feedback: {
          rule: "IMPLEMENTATION_CHANGE_LIST_INVALID",
          ...diagnostics,
        },
      };
    }
    state.changes = input.changes;
    state.processedFeedbackCount = input.processedFeedbackCount;
    delete state.checkedSnapshot;
    state.checkResults = [];
    await saveImplementation(access, state);
    return { saved: true };
  },
});
