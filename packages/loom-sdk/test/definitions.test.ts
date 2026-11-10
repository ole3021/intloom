import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import {
  AcceptanceRefSchema,
  ApprovalAnswerSchema,
  AcceptanceReportSchema,
  ArtifactRefSchema,
  DefinitionError,
  defineAgent,
  defineCode,
  defineLoom,
  defineSkill,
  defineStep,
  defineTool,
  defineWorkflow,
  resource,
  withDefault,
} from "../src/index.ts";

const error = (code: string, path: string) => (value: unknown) =>
  value instanceof DefinitionError &&
  value.code === code &&
  value.path.includes(path);

test("approval declarations require the fixed answer contract and human source", () => {
  const definition = {
    id: "approve",
    inputSchema: z.string(),
    outputSchema: z.boolean(),
    suspendSchema: z.string(),
    resumeSchema: ApprovalAnswerSchema,
    interaction: {
      kind: "approval" as const,
      message: () => "Approve this report?",
    },
    execute: async () => true,
  };
  assert.equal(defineStep(definition).interaction?.responsePolicy, "human");
  assert.deepEqual(ApprovalAnswerSchema.parse({ approved: false }), {
    approved: false,
  });
  assert.throws(() => ApprovalAnswerSchema.parse({ approved: "yes" }));
  assert.throws(
    () =>
      defineStep({
        ...definition,
        resumeSchema: z.object({ approved: z.boolean() }),
      }),
    error("DEFINITION_INVALID", "interaction"),
  );
  assert.throws(
    () =>
      defineStep({
        ...definition,
        interaction: {
          ...definition.interaction,
          responsePolicy: "any" as never,
        },
      }),
    error("DEFINITION_INVALID", "interaction"),
  );
});

test("author construction stores definitions without invoking business callbacks", () => {
  const unexpected = () => {
    throw new Error("Business executed during definition");
  };
  const guide = resource({ id: "guide", path: "guide.md" });
  const skill = defineSkill({
    id: "skill",
    description: "Guide",
    instructions: guide,
  });
  const code = defineCode({
    id: "code",
    inputSchema: z.string(),
    outputSchema: z.string(),
    uses: { resources: [guide] },
    execute: unexpected,
  });
  const tool = defineTool({
    id: "tool",
    description: "Tool",
    inputSchema: z.string(),
    outputSchema: z.string(),
    execute: unexpected,
  });
  const agent = defineAgent({
    id: "agent",
    inputSchema: z.string(),
    outputSchema: z.string(),
    model: { slot: "writer" },
    tools: [tool],
    skills: [skill],
    instructions: guide,
    prompt: unexpected,
    outputMode: "text",
  });
  const step = defineStep(code, { id: "code-call" });
  const review = defineStep({
    id: "review",
    inputSchema: z.string(),
    outputSchema: z.string(),
    suspendSchema: z.string(),
    resumeSchema: z.string(),
    interaction: { message: unexpected, context: unexpected },
    execute: unexpected,
  });
  const base = defineWorkflow({
    id: "workflow",
    inputSchema: z.string(),
    outputSchema: z.string(),
  });
  const workflow = base.then(step).map(unexpected).then(review).commit();
  const loom = defineLoom({
    id: "example",
    version: "1.2.3-rc.1+local",
    description: "Example",
    entry: workflow,
  });
  assert.equal(loom.entry.nodes.length, 3);
  assert.equal(base.commit().nodes.length, 0);
  assert.equal(workflow.type, "mastra");
  assert.equal(agent.generation?.maxSteps, 5);
  assert.deepEqual(agent.model.capabilities, ["tool_use"]);
  assert.equal(review.interaction?.responsePolicy, "any");
  assert.equal(step.resource, code);
  assert.equal(step.resource.inputSchema, code.inputSchema);
  assert.ok(Object.isFrozen(workflow.nodes));
  assert.ok(Object.isFrozen(code.uses?.resources));
});

test("Workflow preserves all confirmed control constructs and separate scopes", () => {
  const number = z.number();
  const first = defineStep({
    id: "first",
    inputSchema: number,
    outputSchema: number,
    execute: ({ inputData }) => inputData,
  });
  const second = defineStep({ ...first, id: "second" });
  const base = defineWorkflow({
    id: "flow",
    inputSchema: number,
    outputSchema: number,
  });
  const parallel = base
    .parallel([first, second])
    .map(({ inputData }) => inputData.first + inputData.second)
    .commit();
  const branch = base
    .branch([
      [() => true, first],
      [() => true, second],
    ])
    .map(({ inputData }) => inputData.first ?? 0)
    .commit();
  const each = defineWorkflow({
    id: "each",
    inputSchema: z.array(number),
    outputSchema: z.array(number),
  })
    .foreach(first)
    .commit();
  const loop = base
    .dowhile(first, () => false)
    .dountil(second, () => true)
    .commit();
  const nested = defineStep(base.then(first).commit(), { id: "nested" });
  assert.equal(base.then(first).then(nested).commit().nodes.length, 2);
  assert.deepEqual(
    parallel.nodes.map((node) => node.kind),
    ["parallel", "map"],
  );
  assert.equal(branch.nodes[0]?.kind, "branch");
  assert.equal(
    each.nodes[0]?.kind === "foreach" && each.nodes[0].concurrency,
    1,
  );
  assert.deepEqual(
    loop.nodes.map((node) => node.kind),
    ["dowhile", "dountil"],
  );
  assert.throws(
    () => base.then(first).then(first as never),
    error("STEP_ID_DUPLICATE", "first"),
  );
  assert.throws(
    () => base.parallel([first, first] as never),
    error("STEP_ID_DUPLICATE", "first"),
  );
  assert.throws(
    () =>
      base.branch([
        [() => true, first],
        [() => false, first],
      ] as never),
    error("STEP_ID_DUPLICATE", "first"),
  );
  assert.throws(
    () =>
      defineWorkflow({
        id: "bad",
        inputSchema: number,
        outputSchema: number,
        type: "unknown" as never,
      }),
    error("TARGET_UNSUPPORTED", "type"),
  );
  assert.throws(
    () =>
      defineWorkflow({
        id: "each",
        inputSchema: z.array(number),
        outputSchema: z.array(number),
      }).foreach(first, { concurrency: 0 }),
    error("DEFINITION_INVALID", "concurrency"),
  );
});

test("illegal entries, identities, resource overrides and incomplete interactions are diagnosed", () => {
  const schema = z.string();
  const code = defineCode({
    id: "code",
    inputSchema: schema,
    outputSchema: schema,
    execute: ({ inputData }) => inputData,
  });
  const tool = defineTool({
    id: "tool",
    description: "Tool",
    inputSchema: schema,
    outputSchema: schema,
    binding: "lookup",
  });
  const builder = defineWorkflow({
    id: "flow",
    inputSchema: schema,
    outputSchema: schema,
  });
  for (const entry of [tool, builder])
    assert.throws(
      () =>
        defineLoom({
          id: "bad",
          version: "1.0.0",
          description: "Bad",
          entry: entry as never,
        }),
      error("ENTRY_INVALID", "entry"),
    );
  assert.throws(
    () => defineCode({ ...code, id: "" }),
    error("DEFINITION_INVALID", "id"),
  );
  assert.throws(
    () => defineStep(code, { id: "step", inputSchema: schema } as never),
    error("DEFINITION_INVALID", "step"),
  );
  assert.throws(
    () => defineStep(builder as never, { id: "bad" }),
    error("ENTRY_INVALID", "bad"),
  );
  assert.throws(
    () =>
      defineStep({
        id: "bad",
        inputSchema: schema,
        outputSchema: schema,
        interaction: { message: () => "?" },
        execute: () => "ok",
      } as never),
    error("DEFINITION_INVALID", "interaction"),
  );
  assert.throws(
    () => defineTool({ ...tool, execute: () => "ok" } as never),
    error("DEFINITION_INVALID", "implementation"),
  );
  for (const path of [
    "../secret",
    "/etc/file",
    "dir/../../file",
    "C:\\file",
    "dir\\file",
    "",
  ])
    assert.throws(
      () => resource({ id: "bad", path }),
      error("DEFINITION_INVALID", "path"),
    );
  for (const version of ["1", "v1.0.0", "1.0.0-01", "01.0.0"])
    assert.throws(
      () =>
        defineLoom({ id: "test", version, description: "Test", entry: code }),
      error("DEFINITION_INVALID", "version"),
    );
  assert.deepEqual(
    defineLoom({
      id: "parent",
      version: "1.0.0",
      description: "Parent",
      entry: code,
      dependencies: { analyze: { id: "@test/analyze", version: "^1.0.0" } },
    }).dependencies?.analyze,
    { id: "@test/analyze", version: "^1.0.0" },
  );
});

test("model requirements are additive and generation limits are explicit", () => {
  const tool = defineTool({
    id: "tool",
    description: "Tool",
    inputSchema: z.string(),
    outputSchema: z.string(),
    binding: "lookup",
  });
  const agent = defineAgent({
    id: "agent",
    inputSchema: z.string(),
    outputSchema: z.strictObject({ text: z.string() }),
    prompt: () => "Prompt",
    instructions: "Guide",
    model: { slot: "writer", capabilities: [] },
    tools: [tool],
    outputMode: "structured",
    generation: { maxSteps: 2 },
  });
  assert.deepEqual(agent.model.capabilities, ["tool_use", "structured_output"]);
  assert.equal(agent.generation?.maxSteps, 2);
  assert.throws(
    () => defineAgent({ ...agent, generation: { maxSteps: 0 } }),
    error("DEFINITION_INVALID", "maxSteps"),
  );
  assert.throws(
    () => defineAgent({ ...agent, outputMode: "text" } as never),
    error("DEFINITION_INVALID", "outputSchema"),
  );
});

test("Outcome validates pointers, criteria and self-reference; shared references use strict schemas", () => {
  const entry = defineCode({
    id: "output",
    inputSchema: z.null(),
    outputSchema: z.null(),
    execute: () => null,
  });
  const define = (outcome: Parameters<typeof defineLoom>[0]["outcome"]) =>
    defineLoom({
      id: "output",
      version: "1.0.0",
      description: "Output",
      entry,
      ...(outcome ? { outcome } : {}),
    });
  const valid = {
    artifacts: { report: { at: "/deliverable/a~1b~0c" } },
    acceptance: {
      at: "/acceptance",
      subjectAt: "/deliverable",
      criteria: [{ id: "sources", description: "Sources" }],
    },
  };
  assert.ok(define(valid).outcome);
  const declared = define(valid);
  valid.acceptance.criteria.push({ id: "later", description: "Later edit" });
  assert.equal(declared.outcome?.acceptance?.criteria.length, 1);
  assert.equal(declared.outcome?.artifacts?.report?.multiple, false);
  assert.equal(declared.outcome?.artifacts?.report?.required, true);
  assert.ok(define({ artifacts: { root: { at: "" } } }).outcome);
  assert.throws(
    () => define({ artifacts: { report: { at: "/bad~2" } } }),
    error("DEFINITION_INVALID", ".at"),
  );
  assert.throws(
    () => define({ acceptance: { ...valid.acceptance, subjectAt: "" } }),
    error("DEFINITION_INVALID", "subjectAt"),
  );
  assert.throws(
    () => define({ acceptance: { ...valid.acceptance, criteria: [] } }),
    error("DEFINITION_INVALID", "criteria"),
  );
  assert.throws(
    () =>
      define({
        acceptance: {
          ...valid.acceptance,
          criteria: [
            ...valid.acceptance.criteria,
            ...valid.acceptance.criteria,
          ],
        },
      }),
    error("DEFINITION_INVALID", "criteria"),
  );
  assert.ok(
    ArtifactRefSchema.safeParse({ kind: "artifact", id: "a", runId: "run" })
      .success,
  );
  assert.ok(
    AcceptanceRefSchema.safeParse({ kind: "acceptance", id: "a", runId: "run" })
      .success,
  );
  assert.equal(
    ArtifactRefSchema.safeParse({
      kind: "artifact",
      id: "a",
      runId: "run",
      path: "/secret",
    }).success,
    false,
  );
  assert.ok(
    AcceptanceReportSchema.safeParse({
      checks: [{ criterionId: "sources", status: "rejected" }],
    }).success,
  );
  assert.equal(
    AcceptanceReportSchema.safeParse({
      error: { code: "CHECK_FAILED", message: "Failed" },
    }).success,
    false,
  );
  assert.equal(
    AcceptanceReportSchema.safeParse({
      checks: [],
      error: { code: "ERROR", message: "Wrong" },
    }).success,
    false,
  );
});

test("input normalization remains an external boundary, not definition or Step construction", () => {
  const schema = z.strictObject({ count: withDefault(z.number(), 2) });
  const code = defineCode({
    id: "code",
    inputSchema: schema,
    outputSchema: z.number(),
    execute: ({ inputData }) => inputData.count,
  });
  const step = defineStep(code, { id: "call" });
  defineWorkflow({
    id: "workflow",
    inputSchema: schema,
    outputSchema: z.number(),
  })
    .then(step)
    .commit();
  assert.equal(step.resource.inputSchema, schema);
  assert.deepEqual(schema.parse({}), { count: 2 });
  assert.deepEqual(schema.parse({ count: 0 }), { count: 0 });
});
