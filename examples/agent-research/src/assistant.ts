import { agent } from "@intloom/loom-sdk";
import { z } from "zod";

export const reviewer = agent({
  instructions: "Review the supplied report. Identify unsupported claims.",
  returns: z.object({ passed: z.boolean(), issues: z.array(z.string()) }),
});

export const researcher = agent({
  instructions: async (context) =>
    context.mode === "chat"
      ? "Help the user frame a research request. Start a Run for a new report or a PATCH to revise one."
      : `Research the supplied topic and write summary.md under ${context.workDir}. Review the draft before saving.`,
  loomInput: (input) =>
    [input.prompt ?? "Research these materials.", ...(input.files ?? [])].join(
      "\n",
    ),
  skills: ["./skills/research"],
  tools: {
    read: "fs.read",
    write: "fs.write",
    ask: "user.ask",
    review: {
      exec: reviewer,
      description: "Review a draft for unsupported claims.",
    },
  },
});
