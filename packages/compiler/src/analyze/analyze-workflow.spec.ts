import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { test, type TestContext } from "node:test";
import { LoomError } from "@intloom/utils";
import type {
  SourceDocument,
  SourceResource,
  SourceSet,
} from "../source/types.ts";
import { analyzeWorkflow } from "./analyze-workflow.ts";

function input(root = resolve(tmpdir(), "compiler-analyze-model")) {
  const packageInfo = {
    name: "example",
    version: "1.0.0",
    type: "module",
    intloom: { type: "workflow", version: "2026-10-08" },
  };
  const step = {
    type: "code",
    code: "@codes/run",
    on: { complete: { end: true } },
  };
  const stage = {
    name: "main",
    state: { schema: "@schemas/state", initialize: "@initializers/state" },
    entry: "run",
    steps: { run: step } as Record<string, Record<string, unknown>>,
  };
  const workflow = {
    name: "example",
    entry: "main",
    stages: {
      main: {
        stage: "@stages/main",
        on: { complete: { end: true } } as Record<
          string,
          { end: boolean } | { target: string }
        >,
      },
    },
  };
  const document = (name: string, value: unknown): SourceDocument => ({
    source: { file: resolve(root, name), text: "" },
    value,
    locations: { "": { file: resolve(root, name), line: 1, column: 1 } },
  });
  const stageDocument = document("stages/main.yaml", { stage });
  const agentMetadata = { name: "reviewer", description: "Review changes" };
  const resources: SourceResource[] = [
    {
      kind: "initializer",
      source: { file: resolve(root, "initializers/state.ts"), text: "" },
    },
    { kind: "workflow", document: document("workflow.yaml", { workflow }) },
    { kind: "stage", document: stageDocument },
    { kind: "code", source: { file: resolve(root, "codes/run.ts"), text: "" } },
    {
      kind: "schema",
      source: { file: resolve(root, "schemas/state.ts"), text: "" },
    },
    {
      kind: "agent",
      metadata: document("agents/reviewer.md", agentMetadata),
      content: "Review instructions",
    },
    {
      kind: "tool",
      source: { file: resolve(root, "tools/search.ts"), text: "" },
    },
    {
      kind: "skill",
      metadata: document("skills/review/SKILL.md", {
        name: "review",
        description: "Review skill",
      }),
      content: "Skill instructions",
    },
  ];
  const sources: SourceSet = {
    options: { packageRoot: root },
    packageJson: document("package.json", packageInfo),
    resources,
  };
  return {
    sources,
    resources,
    workflow,
    stage,
    step,
    stageDocument,
    packageInfo,
    agentMetadata,
  };
}

function agentStep() {
  return {
    type: "agent",
    agent: "@agents/reviewer",
    llm: "reasoning",
    outputSchema: "@schemas/state",
    on: { complete: { end: true } },
  };
}

async function skillDirectory(
  t: TestContext,
  extra: Record<string, string> = {},
) {
  const root = await realpath(
    await mkdtemp(resolve(tmpdir(), "compiler-skill-")),
  );
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const [name, value] of Object.entries({
    "SKILL.md": "instructions",
    ...extra,
  })) {
    const file = resolve(root, "skills/review", name);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, value);
  }
  return root;
}

test("normalizes Code, State Schema and routes, with complete ID mapping", async () => {
  const { sources, stage } = input();
  stage.steps.again = {
    type: "code",
    code: "@codes/run.ts:default",
    on: { repeat: { target: "run" } },
  };
  stage.steps.named = {
    type: "code",
    code: "@codes/run:other",
    on: { complete: { end: true } },
  };
  const result = await analyzeWorkflow(sources);
  assert.equal(result.model.flowName, "example");
  assert.equal(result.model.entryStageName, "main");
  assert.equal(Object.keys(result.model.codes).length, 2);
  const main = result.model.stages.main;
  assert.ok(main);
  assert.deepEqual(main.stateSchema, {
    sourceFile: resolve(sources.options.packageRoot, "schemas/state.ts"),
    exportName: "default",
  });
  assert.deepEqual(main.initializeState, {
    sourceFile: resolve(sources.options.packageRoot, "initializers/state.ts"),
    exportName: "default",
  });
  assert.deepEqual(main.steps.run?.on, { complete: { kind: "stage_end" } });
  assert.deepEqual(main.steps.again?.on, {
    repeat: { kind: "step", stepName: "run" },
  });
  assert.deepEqual(main.on, { complete: { kind: "workflow_end" } });
  assert.equal(
    main.steps.run?.execution.resourceKey,
    main.steps.again?.execution.resourceKey,
  );
  assert.notEqual(
    main.steps.run?.execution.resourceKey,
    main.steps.named?.execution.resourceKey,
  );
  assert.deepEqual(
    Object.keys(result.codeIds).sort(),
    Object.keys(result.model.codes).sort(),
  );
  assert.equal(new Set(Object.values(result.codeIds)).size, 2);
  for (const id of Object.values(result.codeIds))
    assert.match(id, /^CODE-[\w-]{21}$/);
});

test("allows Step and Stage loops", async () => {
  const { sources, stage, workflow } = input();
  stage.steps.run = {
    type: "code",
    code: "@codes/run",
    on: { repeat: { target: "run" }, complete: { end: true } },
  };
  workflow.stages.main.on.complete = { target: "main" };
  const { model } = await analyzeWorkflow(sources);
  assert.deepEqual(model.stages.main?.on.complete, {
    kind: "stage",
    stageName: "main",
  });
});

test("reuses identical Agent configurations and keeps assembly definitions", async () => {
  const { sources, stage } = input();
  stage.steps.run = agentStep();
  stage.steps.again = agentStep();
  const result = await analyzeWorkflow(sources);
  assert.equal(Object.keys(result.model.agents).length, 1);
  assert.deepEqual(result.codeIds, {});
  const agent = Object.values(result.model.agents)[0];
  assert.ok(agent);
  assert.equal(agent.instructions, "Review instructions");
  assert.equal(agent.llm, "reasoning");
  assert.deepEqual(agent.skills, []);
  assert.deepEqual(agent.tools, []);
  assert.deepEqual(Object.keys(result.agentIds), [agent.resourceKey]);
  assert.match(result.agentIds[agent.resourceKey] ?? "", /^AGENT-[\w-]{21}$/);
  assert.equal(
    result.model.stages.main?.steps.run?.execution.resourceKey,
    result.model.stages.main?.steps.again?.execution.resourceKey,
  );
});

for (const [label, override] of [
  ["model role", { llm: "fast" }],
  ["output Schema", { outputSchema: "@schemas/state:other" }],
  ["Tools", { tools: ["@tools/search"] }],
  ["Skills", { skills: ["@skills/review"] }],
] satisfies [string, Record<string, unknown>][]) {
  test(`separates Agent IDs when ${label} changes`, async (t) => {
    const root = await skillDirectory(t);
    const { sources, stage } = input(root);
    stage.steps.run = agentStep();
    stage.steps.changed = { ...agentStep(), ...override };
    const result = await analyzeWorkflow(sources);
    assert.equal(Object.keys(result.model.agents).length, 2);
    assert.equal(new Set(Object.values(result.agentIds)).size, 2);
    assert.notEqual(
      result.model.stages.main?.steps.run?.execution.resourceKey,
      result.model.stages.main?.steps.changed?.execution.resourceKey,
    );
  });
}

for (const [label, mutate, code, message] of [
  [
    "Workflow entry",
    (x) => {
      x.workflow.entry = "missing";
    },
    "INVALID_WORKFLOW",
    /Unknown entry stage/,
  ],
  [
    "Stage entry",
    (x) => {
      x.stage.entry = "missing";
    },
    "INVALID_WORKFLOW",
    /Unknown entry step/,
  ],
  [
    "Stage name",
    (x) => {
      x.stage.name = "other";
    },
    "INVALID_WORKFLOW",
    /Stage name must match/,
  ],
  [
    "Step target",
    (x) => {
      x.stage.steps.run = {
        ...x.step,
        on: { complete: { target: "missing" } },
      };
    },
    "INVALID_WORKFLOW",
    /Unknown target step/,
  ],
  [
    "Stage target",
    (x) => {
      x.workflow.stages.main.on.complete = { target: "missing" };
    },
    "INVALID_WORKFLOW",
    /Unknown target stage/,
  ],
  [
    "missing Stage outcome",
    (x) => {
      x.workflow.stages.main.on = {};
    },
    "INVALID_WORKFLOW",
    /missing outcome route/,
  ],
  [
    "empty Step routes",
    (x) => {
      x.stage.steps.run = { ...x.step, on: {} };
    },
    "INVALID_WORKFLOW",
    /outcome route/,
  ],
  [
    "missing required field",
    (x) => {
      x.stage.steps.run = { type: "code", on: x.step.on };
    },
    "INVALID_WORKFLOW",
    /Invalid/,
  ],
  [
    "input binding",
    (x) => {
      x.stage.steps.run = { ...x.step, input: {} };
    },
    "INVALID_WORKFLOW",
    /Unrecognized/,
  ],
  [
    "preHook",
    (x) => {
      x.stage.steps.run = { ...x.step, preHook: "@codes/run" };
    },
    "INVALID_WORKFLOW",
    /Unrecognized/,
  ],
  [
    "postHook",
    (x) => {
      x.stage.steps.run = { ...x.step, postHook: "@codes/run" };
    },
    "INVALID_WORKFLOW",
    /Unrecognized/,
  ],
  [
    "Kernel Step",
    (x) => {
      x.stage.steps.run = { type: "kernel", on: x.step.on };
    },
    "INVALID_WORKFLOW",
    /Invalid/,
  ],
  [
    "unknown field",
    (x) => {
      x.stage.steps.run = { ...x.step, typo: true };
    },
    "INVALID_WORKFLOW",
    /Unrecognized/,
  ],
  [
    "wrong resource kind",
    (x) => {
      x.step.code = "@agents/reviewer";
    },
    "INVALID_REFERENCE",
    /Expected code/,
  ],
  [
    "missing resource",
    (x) => {
      x.step.code = "@codes/missing";
    },
    "INVALID_REFERENCE",
    /Expected code/,
  ],
  [
    "wrong Schema kind",
    (x) => {
      x.stage.state.schema = "@codes/run";
    },
    "INVALID_REFERENCE",
    /Expected schema/,
  ],
  [
    "wrong initializer kind",
    (x) => {
      x.stage.state.initialize = "@codes/run";
    },
    "INVALID_REFERENCE",
    /Expected initializer/,
  ],
  [
    "missing initializer field",
    (x) => {
      Reflect.deleteProperty(x.stage.state, "initialize");
    },
    "INVALID_WORKFLOW",
    /Invalid/,
  ],
  [
    "wrong Tool kind",
    (x) => {
      x.stage.steps.run = { ...agentStep(), tools: ["@codes/run"] };
    },
    "INVALID_REFERENCE",
    /Expected tool/,
  ],
  [
    "wrong Skill kind",
    (x) => {
      x.stage.steps.run = { ...agentStep(), skills: ["@agents/reviewer"] };
    },
    "INVALID_REFERENCE",
    /Expected skill/,
  ],
  [
    "unsupported protocol",
    (x) => {
      x.packageInfo.intloom.version = "unknown";
    },
    "INVALID_WORKFLOW",
    /Invalid/,
  ],
  [
    "non-ESM package",
    (x) => {
      x.packageInfo.type = "commonjs";
    },
    "INVALID_WORKFLOW",
    /Invalid/,
  ],
] satisfies [string, (x: ReturnType<typeof input>) => void, string, RegExp][]) {
  test(`rejects ${label}`, async () => {
    const x = input();
    mutate(x);
    await assert.rejects(analyzeWorkflow(x.sources), (error) => {
      assert.ok(LoomError.is(error));
      assert.equal(error.code, code);
      assert.match(error.message, message);
      return true;
    });
  });
}

test("reports the exact unknown field location", async () => {
  const x = input();
  x.stage.steps.run = { ...x.step, typo: true };
  const location = { file: x.stageDocument.source.file, line: 9, column: 5 };
  const sources: SourceSet = {
    ...x.sources,
    resources: x.resources.map((resource) =>
      resource.kind === "stage"
        ? {
            kind: "stage",
            document: {
              ...x.stageDocument,
              locations: { "/stage/steps/run/typo": location },
            },
          }
        : resource,
    ),
  };
  await assert.rejects(analyzeWorkflow(sources), (error) => {
    assert.ok(LoomError.is(error));
    assert.deepEqual((error.cause as { location: unknown }).location, location);
    return true;
  });
});

test("reports missing Workflow source", async () => {
  const { sources } = input();
  await assert.rejects(
    analyzeWorkflow({ ...sources, resources: [] }),
    (error) => LoomError.is(error) && error.code === "INVALID_WORKFLOW",
  );
});

test("collects nested Skill resources once and ignores non-resource directories", async (t) => {
  const root = await skillDirectory(t, {
    "nested/template.txt": "template",
    ".env.example": "example",
    ".env.encrypted": "encrypted",
    ".git/config": "ignored",
    "node_modules/tool.js": "ignored",
    ".DS_Store": "ignored",
  });
  const { sources, stage } = input(root);
  stage.steps.run = { ...agentStep(), skills: ["@skills/review"] };
  stage.steps.again = {
    ...agentStep(),
    llm: "fast",
    skills: ["@skills/review"],
  };
  const { model } = await analyzeWorkflow(sources);
  const paths = [
    "skills/review/.env.encrypted",
    "skills/review/.env.example",
    "skills/review/SKILL.md",
    "skills/review/nested/template.txt",
  ].sort();
  assert.deepEqual(model.assets.map((asset) => asset.outputPath).sort(), paths);
  for (const agent of Object.values(model.agents)) {
    assert.equal(agent.skills[0]?.content, "Skill instructions");
    assert.deepEqual(
      agent.skills[0]?.assets.map((asset) => asset.outputPath).sort(),
      paths,
    );
  }
});

for (const file of [".env", ".env.keys", ".dev.vars", "nested/.env.local"]) {
  test(`rejects private Skill resource ${file}`, async (t) => {
    const root = await skillDirectory(t, { [file]: "placeholder" });
    const { sources, stage } = input(root);
    stage.steps.run = { ...agentStep(), skills: ["@skills/review"] };
    await assert.rejects(
      analyzeWorkflow(sources),
      (error) => LoomError.is(error) && error.code === "INVALID_REFERENCE",
    );
  });
}

test("rejects Skill resource symlinks even to package-local files", async (t) => {
  const root = await skillDirectory(t);
  await symlink(
    resolve(root, "skills/review/SKILL.md"),
    resolve(root, "skills/review/link"),
  );
  const { sources, stage } = input(root);
  stage.steps.run = { ...agentStep(), skills: ["@skills/review"] };
  await assert.rejects(
    analyzeWorkflow(sources),
    (error) => LoomError.is(error) && error.code === "INVALID_REFERENCE",
  );
});
