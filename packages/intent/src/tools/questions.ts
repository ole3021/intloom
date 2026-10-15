import { fail } from "../errors.ts";
import * as z from "zod";
import { defineAgentTool } from "@intloom/loom-sdk";
import { questionSchema, resultSchema } from "../schema/common.ts";
import { rawState } from "../project.ts";
import { assertRevision, save, toolResult } from "../state.ts";
import { unanswered } from "../questions.ts";
export const requestClarification = defineAgentTool({
  id: "request_clarification",
  description:
    "Request real missing information through the next Code step. Reuse an existing question key only with identical wording. On saved=true finish with the returned outcome; never invent the user's answer.",
  inputSchema: z.strictObject({
    revision: z.number(),
    questions: z.array(questionSchema).min(1),
  }),
  outputSchema: resultSchema,
  endsAgent: (output) => output.saved,
  execute: async (input, access) => {
    const s = rawState(access);
    try {
      assertRevision(s, input.revision, [
        "analyze",
        "draft",
        "design",
        "implement",
        "observe",
      ]);
      const questions = unanswered(s, input.questions);
      if (!questions.length)
        fail(
          "These questions were already answered. Read the actual answers and complete the assigned submission.",
        );
      s.resumeTask = s.task;
      s.questions = questions;
      await save(access, s);
      return {
        ...toolResult(s),
        outcome: s.questions.length ? "needs_input" : "ready",
      };
    } catch (e) {
      return toolResult(s, e);
    }
  },
});
