import { z } from "zod";
import {
  agent,
  type CodeContext,
  type ExecInput,
  type ExecOutput,
  type LoomEntry,
  workflow,
} from "../../src/index.ts";

const reviewer = agent({
  instructions: async (context) => `${context.mode}: ${context.prompt}`,
  returns: z.object({ passed: z.boolean(), text: z.string() }),
});
const writer = agent({ instructions: "Write a report." });
const extract = async (input: { source: string }) => ({ text: input.source });

agent({
  instructions: "Delegate work.",
  tools: {
    read: "fs.read",
    review: { exec: reviewer, description: "Review a report." },
    extract: {
      exec: extract,
      description: "Extract text.",
      input: z.object({ source: z.string() }),
    },
  },
});
agent({
  instructions: "Extract.",
  // @ts-expect-error Code tools require an input schema.
  tools: { extract: { exec: extract, description: "Extract." } },
});
agent({
  instructions: "Extract.",
  tools: {
    extract: {
      exec: extract,
      description: "Extract.",
      // @ts-expect-error A schema's parsed value must match the target input.
      input: z.object({ source: z.number() }),
    },
  },
});
agent({
  instructions: "Review.",
  tools: {
    // @ts-expect-error Agent tools have the fixed prompt adapter.
    review: { exec: reviewer, description: "Review.", input: z.string() },
  },
});
// @ts-expect-error Structured Agent results must be JSON data.
agent({ instructions: "Date.", returns: z.date() });
agent({
  instructions: "Optional fields.",
  returns: z.object({ note: z.string().optional() }),
});

const flow = workflow<string>()
  .step("write", { exec: writer, input: ({ input }) => input })
  .step("review", {
    exec: reviewer,
    input: ({ steps }) => steps.write,
    next: [
      { when: ({ result }) => result.passed, to: "save" },
      { to: "revise" },
    ],
  })
  .step("revise", { exec: writer, input: ({ steps }) => steps.review.text })
  .step("save", {
    exec: writer,
    input: ({ steps }) => steps.revise ?? steps.write,
  })
  .returns(({ steps }) => steps.save ?? steps.write)
  .build();

const loop = workflow<string>()
  .repeat("polish", {
    exec: reviewer,
    input: ({ input }) => input,
    until: ({ result, iteration }) => result.passed || iteration > 1,
    nextInput: ({ result }) => result.text,
    max: 3,
  })
  .returns(({ steps }) => steps.polish.text)
  .build();

workflow<string>()
  .step("optional", {
    exec: writer,
    input: ({ input }) => input,
    when: () => false,
  })
  .step("next", {
    exec: writer,
    // @ts-expect-error A skipped result is not a required string.
    input: ({ steps }) => steps.optional,
  });

workflow<string>().step("write", {
  exec: writer,
  // @ts-expect-error Input mappings must be synchronous.
  input: async ({ input }) => input,
});
// @ts-expect-error Return mappings must be synchronous JSON/void mappings.
workflow<string>().returns(async () => "text");

workflow<{ values: string[] }>().step("write", {
  exec: writer,
  input: ({ input }) => {
    // @ts-expect-error Workflow views are deeply readonly.
    input.values.push("mutation");
    return input.values.join(",");
  },
});

export const main: LoomEntry = async (input, context) => {
  await context.fs.write({
    path: `${context.workDir}/summary.md`,
    content: input.prompt ?? "Hello",
  });
};

export async function checkContext(context: CodeContext) {
  // @ts-expect-error Builders must be finalized before execution.
  await context.exec(workflow<string>(), "text");
  const answer = await context.user.ask({
    question: "Name?",
    mode: "text",
    schema: z.string().trim().min(1),
  });
  const name: string = answer.value;
  const skip = await context.user.ask({
    question: "Name?",
    mode: "text",
    allowSkip: true,
  });
  if (skip.status === "answered") {
    const value: string = skip.value;
    void value;
  }
  // @ts-expect-error Skip feedback has no answer value until narrowed.
  skip.value;
  const optional = await context.user.ask({
    question: "Agree?",
    mode: "confirm",
    allowSkip: Boolean(name),
  });
  if (optional.status === "answered") {
    const value: boolean = optional.value;
    void value;
  }
  // @ts-expect-error A text answer schema must preserve a text result.
  await context.user.ask({
    question: "Name?",
    mode: "text",
    schema: z.string().transform(Number),
  });
  // @ts-expect-error Selection options belong to choice modes.
  await context.user.ask({ question: "Agree?", mode: "confirm", options: [] });
  // @ts-expect-error Question content is required plain text.
  await context.user.ask({ mode: "text", content: "Markdown" });
  const review = await context.exec(reviewer, "text");
  const passed: boolean = review.passed;
  const text: string = await context.exec(writer, "text");
  const mapped: string = await context.exec(flow, text);
  const repeated: string = await context.exec(loop, mapped);
  const result = await context.exec(extract, { source: repeated });
  // @ts-expect-error Agent input is always a string.
  await context.exec(reviewer, { prompt: "text" });
  // @ts-expect-error Code input is inferred from the target.
  await context.exec(extract, { source: 123 });
  // @ts-expect-error Exec results cannot carry Date instances.
  await context.exec(async (_input: string) => new Date(), "text");
  // @ts-expect-error Undefined object properties are not JSON values.
  await context.exec(async (_input: string) => ({ value: undefined }), "text");
  const empty: Promise<void> = context.exec(
    async (_input: string) => {},
    "text",
  );
  await empty;
  if (context.mode === "chat") {
    // @ts-expect-error Chat does not have Run directories.
    context.workDir;
  } else {
    const path: string = context.workDir;
    if (context.mode === "patch") {
      const patch: `PCH-${string}` = context.patchId;
      void patch;
    }
    void path;
  }
  return { passed, result };
}

const input: ExecInput<typeof flow> = "text";
const output: ExecOutput<typeof reviewer> = { passed: true, text: input };
void output;
