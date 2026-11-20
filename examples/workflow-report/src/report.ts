import {
  agent,
  type CodeContext,
  type LoomInput,
  workflow,
} from "@intloom/loom-sdk";
import { z } from "zod";

export const writer = agent({
  instructions: "Write or revise the requested report.",
});
export const reviewer = agent({
  instructions:
    "Review the report and return the text, whether it passes, and issues to address.",
  returns: z.object({
    text: z.string(),
    passed: z.boolean(),
    issues: z.array(z.string()),
  }),
});

const revision = workflow<string>()
  .step("write", { exec: writer, input: ({ input }) => input })
  .step("review", { exec: reviewer, input: ({ steps }) => steps.write })
  .returns(({ steps }) => steps.review)
  .build();

async function save(input: string, context: CodeContext): Promise<void> {
  if (context.mode === "chat")
    throw new Error("Saving a report requires a Run or PATCH.");
  await context.fs.write({
    path: `${context.workDir}/summary.md`,
    content: input,
  });
}

export default workflow<LoomInput>()
  .step("draft", {
    exec: writer,
    input: ({ input }) => input.prompt ?? "Write a report.",
  })
  .step("review", {
    exec: reviewer,
    input: ({ steps }) => steps.draft,
    next: [
      { when: ({ result }) => result.passed, to: "save" },
      { to: "polish" },
    ],
  })
  .repeat("polish", {
    exec: revision,
    input: ({ steps }) => `${steps.draft}\n\n${steps.review.issues.join("\n")}`,
    until: ({ result }) => result.passed,
    nextInput: ({ result, iteration }) =>
      `Revision ${iteration + 1}:\n${result.text}\n${result.issues.join("\n")}`,
    max: 3,
  })
  .step("confirm", {
    when: ({ input }) => input.prompt?.includes("confirm") ?? false,
    exec: async (question: string, context: CodeContext) =>
      (await context.user.ask({ question, mode: "confirm" })).value,
    input: () => "Save this reviewed report?",
    next: [{ when: ({ result }) => result, to: "save" }, { to: null }],
  })
  .step("save", {
    exec: save,
    input: ({ steps }) => steps.polish?.text ?? steps.draft,
  })
  .build();
