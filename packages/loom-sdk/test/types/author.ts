import {
  AcceptanceReportSchema,
  ArtifactRefSchema,
  defineAgent,
  defineCode,
  defineLoom,
  defineSkill,
  defineStep,
  defineTool,
  defineWorkflow,
  resource,
  withDefault,
  type InputOf,
  type NormalizedInputOf,
  type OutputOf,
  type LoomRef,
  type AcceptanceResult,
} from "../../src/index.ts";
import { z } from "zod";

const request = z.strictObject({
  count: withDefault(z.number().int().positive(), 3),
});
const code = defineCode({
  id: "count",
  inputSchema: request,
  outputSchema: z.number(),
  execute: ({ inputData }) => inputData.count,
});
const raw: InputOf<typeof code> = {};
const normalized: NormalizedInputOf<typeof code> = { count: 2 };
const result: OutputOf<typeof code> = 2;
// @ts-expect-error Internal input must already contain defaults.
const unnormalized: NormalizedInputOf<typeof code> = {};
// @ts-expect-error Output is inferred from the schema.
const wrongResult: OutputOf<typeof code> = "2";
// @ts-expect-error Default must match the output type.
withDefault(z.number(), "2");
// @ts-expect-error Default functions are prohibited.
withDefault(z.number(), () => 2);
defineCode({
  id: "bad",
  inputSchema: z.number(),
  outputSchema: z.string(),
  // @ts-expect-error Execute must return the declared output.
  execute: () => 2,
});

const local = defineTool({
  id: "lookup",
  description: "Lookup",
  inputSchema: request,
  outputSchema: z.string(),
  execute: ({ inputData }) => String(inputData.count),
});
const host = defineTool({
  id: "host",
  description: "Host",
  inputSchema: z.string(),
  outputSchema: z.string(),
  binding: "host",
});
// @ts-expect-error Tool implementations are mutually exclusive.
defineTool({
  id: "both",
  description: "bad",
  inputSchema: z.string(),
  outputSchema: z.string(),
  binding: "host",
  execute: () => "bad",
});
// @ts-expect-error Tool implementation required.
defineTool({
  id: "neither",
  description: "bad",
  inputSchema: z.string(),
  outputSchema: z.string(),
});

const guide = resource({ id: "guide", path: "guide.md" });
const other = resource({ id: "other", path: "other.md" });
const reference = resource({ id: "reference", path: "reference.md" });
const skill = defineSkill({
  id: "writing",
  description: "Guide",
  instructions: guide,
});
const detailedSkill = defineSkill({
  id: "detailed",
  description: "Detailed",
  instructions: guide,
  resources: [reference],
});
defineAgent({
  id: "implicit-resources",
  inputSchema: z.string(),
  outputSchema: z.string(),
  instructions: guide,
  skills: [detailedSkill],
  model: { slot: "writer" },
  outputMode: "text",
  prompt: async ({ context }) => {
    await context.resources.readText(guide);
    await context.resources.readText(reference);
    // @ts-expect-error Unrelated resource is still unavailable without uses.
    await context.resources.readText(other);
    return "ready";
  },
});
const agent = defineAgent({
  id: "writer",
  inputSchema: request,
  outputSchema: z.string(),
  instructions: guide,
  tools: [local],
  skills: [skill],
  uses: { resources: [guide] },
  model: { slot: "writer" },
  outputMode: "text",
  prompt: async ({ inputData, context }) => {
    await context.resources.readText(guide);
    // @ts-expect-error Prompt cannot invoke tools.
    void context.tools;
    // @ts-expect-error Resource not declared.
    await context.resources.readText(other);
    return String(inputData.count);
  },
});
defineAgent({
  id: "bad",
  inputSchema: z.string(),
  // @ts-expect-error Text mode requires string output.
  outputSchema: z.number(),
  instructions: "Do it",
  model: { slot: "writer" },
  outputMode: "text",
  prompt: () => "hello",
});
defineCode({
  id: "compose",
  inputSchema: request,
  outputSchema: z.string(),
  uses: { agents: [agent], tools: [local], resources: [guide] },
  execute: async ({ inputData, context }) => {
    const value: string = await context.tools.call(local, inputData);
    await context.agents.generate(agent, inputData);
    await context.resources.readText(guide);
    // @ts-expect-error Component call requires normalized input.
    await context.tools.call(local, {});
    // @ts-expect-error Tool not in uses.
    await context.tools.call(host, "hello");
    // @ts-expect-error Resource not in uses.
    await context.resources.readText(other);
    return value;
  },
});
defineCode({
  id: "no-uses",
  inputSchema: z.string(),
  outputSchema: z.string(),
  execute: async ({ inputData, context }) => {
    // @ts-expect-error Absent uses gives no component access.
    await context.tools.call(host, inputData);
    return inputData;
  },
});

const increment = defineStep({
  id: "increment",
  inputSchema: z.number(),
  outputSchema: z.number(),
  execute: ({ inputData, getInitData, getStepResult }) => {
    const initial: unknown = getInitData();
    void initial;
    // @ts-expect-error Reusable steps cannot invent a root input type.
    const invented: number = getInitData();
    void invented;
    // @ts-expect-error No type assertion generic or dynamic string lookup.
    getStepResult<number>("earlier");
    return inputData + 1;
  },
});
const stringify = defineStep({
  id: "stringify",
  inputSchema: z.number(),
  outputSchema: z.string(),
  execute: ({ inputData }) => String(inputData),
});
const count = defineStep(code, { id: "count-call" });
const builder = defineWorkflow({
  id: "counting",
  inputSchema: request,
  outputSchema: z.string(),
});
const workflow = builder
  .then(count)
  .then(increment)
  .map(({ inputData, getInitData, getStepResult }) => {
    const count: number = getInitData().count;
    const previous: number | null = getStepResult(increment);
    // @ts-expect-error Unavailable result is nullable.
    const available: number = getStepResult(increment);
    void available;
    void previous;
    return inputData + count;
  })
  .then(stringify)
  .commit();
const loom = defineLoom({
  id: "@test/count",
  version: "1.0.0",
  description: "Count",
  entry: workflow,
});
const loomInput: InputOf<typeof loom> = {};
const loomOutput: OutputOf<typeof loom> = "3";
const incompleteEntry = {
  kind: "code" as const,
  id: "incomplete",
  inputSchema: z.string(),
  outputSchema: z.string(),
};
defineLoom({
  id: "incomplete",
  version: "1.0.0",
  description: "Incomplete",
  // @ts-expect-error A code entry must include its execution callback.
  entry: incompleteEntry,
});
// @ts-expect-error Resource steps require a complete executable definition.
defineStep(incompleteEntry, { id: "incomplete-call" });
void loomInput;
void loomOutput;
defineLoom({
  id: "bad",
  version: "1.0.0",
  description: "Bad",
  // @ts-expect-error Workflow has not been committed.
  entry: builder,
});
// @ts-expect-error Tool cannot be a direct Loom entry.
defineLoom({ id: "bad", version: "1.0.0", description: "Bad", entry: host });
// @ts-expect-error Builder is not a Step resource.
defineStep(builder, { id: "bad" });
// @ts-expect-error Cannot override a resource's schema.
defineStep(code, { id: "bad", inputSchema: z.string() });
defineWorkflow({
  id: "bad",
  inputSchema: z.string(),
  outputSchema: z.number(),
  // @ts-expect-error String input cannot feed numeric step.
}).then(increment);
defineWorkflow({ id: "bad", inputSchema: z.number(), outputSchema: z.string() })
  .then(increment)
  // @ts-expect-error Output is not compatible with declared final schema.
  .commit();
defineWorkflow({ id: "bad", inputSchema: z.number(), outputSchema: z.number() })
  .then(increment)
  // @ts-expect-error Step ids are unique within a Workflow.
  .then(increment);
defineWorkflow({
  id: "bad",
  // @ts-expect-error Only mastra workflow definitions supported.
  type: "other",
  inputSchema: z.number(),
  outputSchema: z.number(),
});

defineWorkflow({
  id: "parallel",
  inputSchema: z.number(),
  outputSchema: z.strictObject({
    increment: z.number(),
    stringify: z.string(),
  }),
})
  .parallel([increment, stringify])
  .commit();
defineWorkflow({
  id: "bad",
  inputSchema: z.number(),
  outputSchema: z.number(),
  // @ts-expect-error Duplicate ids inside parallel.
}).parallel([increment, increment]);
defineWorkflow({
  id: "bad",
  inputSchema: z.string(),
  outputSchema: z.number(),
  // @ts-expect-error Parallel inputs are incompatible.
}).parallel([increment]);
const branched = defineWorkflow({
  id: "branch",
  inputSchema: z.number(),
  outputSchema: z.number(),
}).branch([
  [({ inputData, getInitData }) => inputData > getInitData(), increment],
  [({ inputData }) => inputData > 0, stringify],
]);
branched
  .map(({ inputData }) => {
    const optional: string | undefined = inputData.stringify;
    // @ts-expect-error Branch result may be absent.
    const required: number = inputData.increment;
    void optional;
    void required;
    return inputData.increment ?? 0;
  })
  .commit();
defineWorkflow({
  id: "bad",
  inputSchema: z.string(),
  outputSchema: z.number(),
  // @ts-expect-error Branch inputs are incompatible.
}).branch([[() => true, increment]]);
defineWorkflow({
  id: "bad",
  inputSchema: z.number(),
  outputSchema: z.number(),
  // @ts-expect-error Branch condition must be boolean.
}).branch([[() => "yes", increment]]);
defineWorkflow({
  id: "bad",
  inputSchema: z.number(),
  outputSchema: z.number(),
}).branch([
  [() => true, increment],
  // @ts-expect-error Duplicate ids inside branch.
  [() => false, increment],
]);
defineWorkflow({
  id: "each",
  inputSchema: z.array(z.number()),
  outputSchema: z.array(z.string()),
})
  .foreach(stringify, { concurrency: 2 })
  .commit();
defineWorkflow({
  id: "bad",
  inputSchema: z.number(),
  outputSchema: z.number(),
  // @ts-expect-error foreach requires an array.
}).foreach(increment);
defineWorkflow({
  id: "bad",
  inputSchema: z.array(z.string()),
  outputSchema: z.number(),
  // @ts-expect-error foreach item type incompatible.
}).foreach(increment);
defineWorkflow({
  id: "loop",
  inputSchema: z.number(),
  outputSchema: z.number(),
})
  .dowhile(
    increment,
    ({ inputData, getInitData }) => inputData < getInitData() + 3,
  )
  .commit();
defineWorkflow({
  id: "until",
  inputSchema: z.number(),
  outputSchema: z.number(),
})
  .dountil(increment, ({ inputData }) => inputData > 3)
  .commit();
defineWorkflow({
  id: "bad",
  inputSchema: z.number(),
  outputSchema: z.string(),
  // @ts-expect-error A loop must feed its own next input.
}).dowhile(stringify, () => false);
defineWorkflow({
  id: "bad",
  inputSchema: z.number(),
  outputSchema: z.string(),
  // @ts-expect-error A loop must feed its own next input.
}).dountil(stringify, () => true);

const approval = defineStep({
  id: "approval",
  inputSchema: z.string(),
  outputSchema: z.boolean(),
  suspendSchema: z.strictObject({ message: z.string() }),
  resumeSchema: withDefault(z.boolean(), false),
  interaction: {
    message: ({ suspendData }) => suspendData.message,
    responsePolicy: "human",
  },
  execute: async ({ inputData, resumeData, suspendData, suspend }) => {
    const old: string | undefined = suspendData?.message;
    void old;
    if (resumeData === undefined) return suspend({ message: inputData });
    return resumeData;
  },
});
defineStep({
  id: "ordinary",
  inputSchema: z.string(),
  outputSchema: z.string(),
  execute: ({ inputData, suspend }) => {
    // @ts-expect-error No suspendSchema, no suspend capability.
    suspend("waiting");
    return inputData;
  },
});
defineStep({
  id: "bad",
  inputSchema: z.string(),
  outputSchema: z.string(),
  // @ts-expect-error Interaction requires suspend and resume schemas.
  interaction: { message: () => "?" },
  execute: ({ inputData }) => inputData,
});

const dependency: LoomRef<{ count?: number }, { count: number }, number> = {
  kind: "loom_ref",
  id: "child",
  version: "1.0.0",
  artifactDigest: "a".repeat(64),
  contracts: { input: {}, normalizedInput: {}, output: {} },
};
const child = defineStep(dependency, { id: "child" });
defineWorkflow({
  id: "child-parent",
  inputSchema: z.strictObject({}),
  outputSchema: z.number(),
})
  .then(child)
  .commit();
defineWorkflow({
  id: "bad",
  inputSchema: z.strictObject({}),
  outputSchema: z.number(),
  // @ts-expect-error Internal component boundary cannot apply defaults again.
}).then(count);
const nested = defineStep(workflow, { id: "nested" });
defineWorkflow({
  id: "nested-parent",
  inputSchema: request,
  outputSchema: z.string(),
})
  .then(nested)
  .commit();
defineStep(agent, { id: "writer-call" });
defineStep(local, { id: "lookup-call" });
defineLoom({
  id: "parent",
  version: "1.0.0",
  description: "Parent",
  entry: code,
  dependencies: { child: { id: "child", version: "^1.0.0" } },
});
defineAgent({
  id: "evaluator",
  inputSchema: ArtifactRefSchema,
  outputSchema: AcceptanceReportSchema,
  instructions: "Evaluate",
  model: { slot: "evaluator" },
  outputMode: "structured",
  prompt: ({ inputData }) => inputData.id,
});
void raw;
void normalized;
void result;
void unnormalized;
void wrongResult;
void approval;
const failedAcceptance: AcceptanceResult = {
  error: {
    code: "CHECK_FAILED",
    message: "Failure",
    details: { nested: [{ values: [1, null] }] },
  },
};
const checkedAcceptance: AcceptanceResult = {
  checks: [{ criterionId: "quality", status: "passed" }],
};
// @ts-expect-error A report cannot contain both technical failure and quality checks.
const ambiguousAcceptance: AcceptanceResult = {
  ...failedAcceptance,
  ...checkedAcceptance,
};
void failedAcceptance;
void checkedAcceptance;
void ambiguousAcceptance;
defineWorkflow({
  id: "json-map",
  inputSchema: z.string(),
  outputSchema: z.string(),
})
  // @ts-expect-error Mapped step data must be JSON, not an execution object.
  .map(() => new Date());

const summarized = defineTool({
  id: "summarized",
  description: "Search",
  inputSchema: z.string(),
  outputSchema: z.object({ matches: z.number() }),
  execute: () => ({ matches: 12 }),
  summarize: (result) => {
    const count: number = result.matches;
    // @ts-expect-error Summary receives the declared output, not Tool input.
    const wrong: string = result.matches;
    void wrong;
    return `${count} matches`;
  },
});
void summarized;
defineTool({
  id: "invalid-summary",
  description: "Search",
  inputSchema: z.string(),
  outputSchema: z.number(),
  execute: () => 12,
  // @ts-expect-error Summary is synchronous display text.
  summarize: async () => "12 matches",
});
