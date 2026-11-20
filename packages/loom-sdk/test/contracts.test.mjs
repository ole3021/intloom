import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import {
  agent,
  agentDefinitionSchema,
  askRequestSchema,
  createAnswerSchema,
  decodeUtf8,
  describeQuestion,
  encodeUtf8,
  executionResultSchema,
  inputDeclarationSchema,
  createLoomInputSchema,
  loomInputSchema,
  loomManifestSchema,
  skillMetadataSchema,
  workflow,
  workflowDefinitionSchema,
  TextEncodingError,
} from "../dist/index.js";

const manifest = {
  schemaVersion: "0.5",
  name: "Report",
  entry: "./src/main.ts",
  execution: { scope: "intloom" },
};

test("UTF-8 helpers reject invalid input while preserving BOM, Unicode and line endings", () => {
  const content = "\ufeff陈🌍\r\n\n";
  assert.equal(decodeUtf8(encodeUtf8(content)), content);
  assert.throws(() => decodeUtf8(new Uint8Array([0xff])), TextEncodingError);
  assert.throws(() => encodeUtf8("\udfff"), TextEncodingError);
});

test("input constraints enforce count, extensions and exclusivity while preserving omission", () => {
  const declaration = inputDeclarationSchema.parse({
    prompt: {},
    files: { minItems: 1, maxItems: 1, extensions: [".txt", ".md"] },
    folders: { maxItems: 0 },
    exactlyOne: ["prompt", "files"],
  });
  const schema = createLoomInputSchema(declaration);
  assert.deepEqual(schema.parse({ prompt: "source" }), { prompt: "source" });
  assert.equal(
    schema.safeParse({ prompt: "source", files: [] }).success,
    false,
  );
  assert.equal(
    schema.safeParse({ prompt: " ", files: ["/source.MD"] }).success,
    true,
  );
  for (const input of [
    {},
    { files: [] },
    { files: ["/source.pdf"] },
    { files: ["/a.md", "/b.txt"] },
    { prompt: "source", files: ["/a.md"] },
    { prompt: "source", folders: ["/folder"] },
  ])
    assert.equal(schema.safeParse(input).success, false);
  for (const input of [
    { files: { minItems: 2, maxItems: 1 } },
    { folders: { required: true, maxItems: 0 } },
    { prompt: {}, files: {}, exactlyOne: ["prompt", "prompt"] },
  ])
    assert.equal(inputDeclarationSchema.safeParse(input).success, false);
});

test("questions preserve executable validators and expose only serializable descriptions", () => {
  const schema = z
    .string()
    .trim()
    .min(1)
    .refine((answer) => answer !== "forbidden", "Choose a different name");
  const request = askRequestSchema.parse({
    question: "Your name?",
    context: "A plain explanation",
    mode: "text",
    schema,
  });
  assert.equal(request.schema, schema);
  const answer = createAnswerSchema(request);
  assert.equal(answer.safeParse(" forbidden ").success, false);
  assert.equal(answer.parse(" Ada "), "Ada");
  assert.equal(describeQuestion(request).schema.type, "string");
  assert.equal(
    JSON.parse(JSON.stringify(describeQuestion(request))).question,
    "Your name?",
  );
  for (const input of [
    { question: "?", mode: "text", multiline: true },
    { mode: "text", content: "Markdown" },
    {
      question: "?",
      mode: "single",
      options: [
        { value: "x", label: "one" },
        { value: "x", label: "two" },
      ],
    },
  ])
    assert.equal(askRequestSchema.safeParse(input).success, false);
  for (const status of ["failed", "rejected", "cancelled"])
    assert.equal(
      executionResultSchema.safeParse({ status, reason: "Explanation" })
        .success,
      true,
    );
});

test("author declarations normalize defaults while preserving missing and empty inputs", () => {
  assert.deepEqual(loomManifestSchema.parse(manifest).output, {});
  assert.deepEqual(loomInputSchema.parse({}), {});
  assert.deepEqual(loomInputSchema.parse({ files: [] }), { files: [] });
  const input = createLoomInputSchema({
    prompt: { required: true },
    files: { required: true },
  });
  assert.equal(input.safeParse({ prompt: " \n", files: [] }).success, false);
  assert.equal(
    input.safeParse({ prompt: "Report", files: ["/materials/source.md"] })
      .success,
    true,
  );
  assert.equal(
    loomInputSchema.safeParse({ files: ["relative.txt"] }).success,
    false,
  );
  assert.equal(
    loomInputSchema.safeParse({ files: ["C:\\materials\\source.md"] }).success,
    true,
  );
  for (const path of [
    "../secret",
    "/absolute",
    "C:\\absolute",
    "reports/*.md",
    "reports/{a,b}.md",
    ".",
  ]) {
    assert.equal(
      loomManifestSchema.safeParse({
        ...manifest,
        output: { report: { type: "file", path } },
      }).success,
      false,
      path,
    );
  }
  assert.equal(
    loomManifestSchema.safeParse({
      ...manifest,
      output: { summary: { type: "file", path: "a.txt" } },
    }).success,
    false,
  );
  assert.equal(
    loomManifestSchema.safeParse({ ...manifest, schemaVersion: 0.5 }).success,
    false,
  );
  assert.equal(
    loomManifestSchema.safeParse({
      ...manifest,
      output: { data: { type: "stream" } },
    }).success,
    false,
  );
});

test("Agent definitions retain callbacks and schemas without invoking them", () => {
  const instructions = async () => {
    throw new Error("Must not execute");
  };
  const returns = z.object({ passed: z.boolean() });
  const reviewer = agent({ instructions, returns });
  assert.equal(reviewer.instructions, instructions);
  assert.equal(reviewer.returns, returns);
  assert.equal(agentDefinitionSchema.safeParse(reviewer).success, true);
  assert.equal(
    agentDefinitionSchema.safeParse(
      agent({ instructions: " ", tools: { bad: "unknown" } }),
    ).success,
    false,
  );
  const code = async (input) => input;
  assert.equal(
    agentDefinitionSchema.safeParse(
      agent({
        instructions: "Go",
        tools: { code: { exec: code, description: "Code" } },
      }),
    ).success,
    false,
  );
  assert.equal(
    agentDefinitionSchema.safeParse(
      agent({
        instructions: "Go",
        tools: {
          review: { exec: reviewer, description: "Review", input: z.string() },
        },
      }),
    ).success,
    false,
  );
});

test("Workflow declarations preserve functions and validate control graphs without executing", () => {
  const exec = async () => {
    throw new Error("Must not execute");
  };
  const input = () => {
    throw new Error("Must not map");
  };
  const base = workflow().step("first", { exec, input });
  const branch = base.step("branch", {
    exec,
    input,
    next: [{ when: () => true, to: "finish" }, { to: null }],
  });
  const flow = branch
    .repeat("finish", {
      exec,
      input,
      until: () => true,
      nextInput: input,
      max: 2,
    })
    .returns(input)
    .build();
  assert.equal(base.steps.length, 1);
  assert.equal(workflowDefinitionSchema.safeParse(base).success, false);
  assert.equal(flow.steps[0].input, input);
  assert.equal(flow.mapResult, input);
  assert.equal(workflowDefinitionSchema.safeParse(flow).success, true);
  const invalid = [
    base.step("first", { exec, input }),
    base.step("back", { exec, input, next: "first" }),
    base.step("missing", { exec, input, next: "absent" }),
    base.step("fallback", {
      exec,
      input,
      next: [{ when: () => true, to: null }],
    }),
    base.step("earlyFallback", {
      exec,
      input,
      next: [{ to: null }, { to: null }],
    }),
    base.repeat("loop", {
      exec,
      input,
      until: () => true,
      nextInput: input,
      max: 0,
    }),
    base.step("async", { exec, input: async () => "x" }),
  ];
  for (const value of invalid)
    assert.equal(
      workflowDefinitionSchema.safeParse(value.build()).success,
      false,
    );
});

test("Skills use standard frontmatter metadata limits", () => {
  assert.equal(
    skillMetadataSchema.safeParse({
      name: "research",
      description: "Research a topic",
      metadata: { version: "1" },
    }).success,
    true,
  );
  for (const name of [
    "Research",
    "bad--name",
    "-bad",
    "bad_",
    "x".repeat(65),
  ]) {
    assert.equal(
      skillMetadataSchema.safeParse({ name, description: "Research" }).success,
      false,
    );
  }
});
