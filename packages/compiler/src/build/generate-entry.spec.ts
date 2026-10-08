import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { test } from "node:test";
import { LoomError } from "@intloom/utils";
import { stripTypeScriptTypes } from "node:module";
import { parse as parseModule, type AnyNode } from "acorn";
import type { LinkedWorkflow } from "../analyze/model.ts";
import { generateEntry } from "./generate-entry.ts";

function model() {
  const root = resolve(tmpdir(), "compiler-entry");
  const location = { file: resolve(root, "workflow.yaml") };
  const schema = {
    sourceFile: resolve(root, "schemas/state.ts"),
    exportName: "default",
  };
  const code = {
    resourceKey: "run",
    location,
    module: {
      sourceFile: resolve(root, "codes/run.ts"),
      exportName: "execute",
    },
  };
  const agent = {
    resourceKey: "reviewer",
    location,
    name: "reviewer",
    description: "Review changes",
    instructions: 'Review "quotes"\n```ts\nconst path = "C:\\work";\n```',
    llm: "reasoning",
    outputSchema: schema,
    skills: [
      {
        location,
        name: "review",
        description: "Review skill",
        content: "Skill content",
        assets: [
          {
            sourceFile: resolve(root, "skills/review/SKILL.md"),
            outputPath: "skills/review/SKILL.md",
          },
        ],
      },
    ],
    tools: [
      { sourceFile: resolve(root, "tools/search.ts"), exportName: "search" },
    ],
  };
  const workflow = {
    model: {
      options: { packageRoot: root },
      flowName: "example",
      version: "1.0.0",
      entryStageName: "main",
      stages: {
        main: {
          stageName: "main",
          location,
          stateSchema: schema,
          initializeState: {
            sourceFile: resolve(root, "initializers/state.ts"),
            exportName: "default",
          },
          entryStepName: "run",
          steps: {
            run: {
              stepName: "run",
              location,
              execution: { kind: "code", resourceKey: "run" },
              on: { complete: { kind: "step", stepName: "review" } },
            },
            review: {
              stepName: "review",
              location,
              execution: { kind: "agent", resourceKey: "reviewer" },
              on: { complete: { kind: "stage_end" } },
            },
          },
          on: { complete: { kind: "workflow_end" } },
        },
      },
      codes: { run: code },
      agents: { reviewer: agent },
      assets: [],
    },
    codeIds: { run: "CODE-fixed" },
    agentIds: { reviewer: "AGENT-fixed" },
  } satisfies LinkedWorkflow;
  return { workflow, code, agent };
}

function parse(workflow: LinkedWorkflow) {
  return parseModule(stripTypeScriptTypes(generateEntry(workflow)), {
    ecmaVersion: 2023,
    sourceType: "module",
  });
}

function property(node: AnyNode, name: string): AnyNode {
  assert.equal(node.type, "ObjectExpression");
  assert.ok(node.type === "ObjectExpression");
  const entry = node.properties.find(
    (item) =>
      item.type === "Property" &&
      (item.key.type === "Identifier"
        ? item.key.name === name
        : item.key.type === "Literal" && item.key.value === name),
  );
  assert.ok(entry?.type === "Property", `Missing property ${name}`);
  return entry.value;
}

function exported(source: ReturnType<typeof parse>, name: string): AnyNode {
  for (const statement of source.body) {
    if (
      statement.type !== "ExportNamedDeclaration" ||
      statement.declaration?.type !== "VariableDeclaration"
    )
      continue;
    for (const declaration of statement.declaration.declarations) {
      if (
        declaration.id.type === "Identifier" &&
        declaration.id.name === name &&
        declaration.init
      )
        return declaration.init;
    }
  }
  assert.fail(`Missing export ${name}`);
}

function string(node: AnyNode): string {
  assert.ok(node.type === "Literal" && typeof node.value === "string");
  return node.value;
}

function identifier(node: AnyNode): string {
  assert.ok(node.type === "Identifier");
  return node.name;
}

test("emits the three named exports and preserves routing and execution IDs", () => {
  const { workflow } = model();
  const source = parse(workflow);
  const names = source.body.flatMap((statement) =>
    statement.type === "ExportNamedDeclaration" &&
    statement.declaration?.type === "VariableDeclaration"
      ? statement.declaration.declarations.map((declaration) =>
          identifier(declaration.id),
        )
      : [],
  );
  assert.deepEqual(names.sort(), ["agentSpecs", "blueprint", "codes"]);
  const blueprint = exported(source, "blueprint");
  assert.equal(string(property(blueprint, "flowName")), "example");
  assert.equal(string(property(blueprint, "entryStageName")), "main");
  const main = property(property(blueprint, "stages"), "main");
  assert.equal(string(property(main, "stageName")), "main");
  assert.equal(string(property(main, "entryStepName")), "run");
  const steps = property(main, "steps");
  const run = property(steps, "run");
  const review = property(steps, "review");
  assert.equal(
    string(property(property(run, "execution"), "codeId")),
    "CODE-fixed",
  );
  assert.equal(
    string(property(property(review, "execution"), "agentId")),
    "AGENT-fixed",
  );
  assert.equal(
    string(property(property(property(run, "on"), "complete"), "stepName")),
    "review",
  );
  assert.equal(
    string(property(property(property(review, "on"), "complete"), "kind")),
    "stage_end",
  );
  assert.equal(
    string(property(property(property(main, "on"), "complete"), "kind")),
    "workflow_end",
  );
  assert.equal(
    property(exported(source, "codes"), "CODE-fixed").type,
    "Identifier",
  );
  assert.ok(property(exported(source, "agentSpecs"), "AGENT-fixed"));
});

test("uses relative imports, preserves export selectors and shares repeated Schema bindings", () => {
  const source = parse(model().workflow);
  const imports = source.body
    .filter((item) => item.type === "ImportDeclaration")
    .map((item) => {
      const binding = item.specifiers[0];
      assert.ok(binding?.type === "ImportSpecifier");
      return {
        path: string(item.source),
        exported:
          binding.imported.type === "Identifier"
            ? binding.imported.name
            : string(binding.imported),
        local: binding.local.name,
      };
    });
  assert.deepEqual(
    imports
      .map(({ path, exported }) => ({ path, exported }))
      .sort((a, b) => a.path.localeCompare(b.path)),
    [
      { path: "./codes/run.ts", exported: "execute" },
      { path: "./initializers/state.ts", exported: "default" },
      { path: "./schemas/state.ts", exported: "default" },
      { path: "./tools/search.ts", exported: "search" },
    ],
  );
  const schema = imports.find((item) => item.path === "./schemas/state.ts");
  assert.ok(schema);
  const main = property(
    property(exported(source, "blueprint"), "stages"),
    "main",
  );
  const agent = property(exported(source, "agentSpecs"), "AGENT-fixed");
  assert.equal(identifier(property(main, "stateSchema")), schema.local);
  assert.equal(identifier(property(agent, "outputSchema")), schema.local);
  const code = imports.find((item) => item.path === "./codes/run.ts");
  assert.ok(code);
  assert.equal(
    identifier(property(exported(source, "codes"), "CODE-fixed")),
    code.local,
  );
  const tools = property(agent, "tools");
  assert.ok(tools.type === "ArrayExpression" && tools.elements[0]);
  assert.equal(
    identifier(tools.elements[0]),
    imports.find((item) => item.path === "./tools/search.ts")?.local,
  );
});

test("preserves Agent text, configuration and relative Skill assets without executing modules", () => {
  const { workflow, agent } = model();
  // Referenced source paths do not exist: generation consumes only the model.
  const source = parse(workflow);
  const result = property(exported(source, "agentSpecs"), "AGENT-fixed");
  for (const key of ["name", "description", "instructions", "llm"] as const)
    assert.equal(string(property(result, key)), agent[key]);
  const skills = property(result, "skills");
  assert.ok(skills.type === "ArrayExpression" && skills.elements[0]);
  const skill = skills.elements[0];
  assert.equal(string(property(skill, "name")), "review");
  assert.equal(string(property(skill, "content")), "Skill content");
  const assets = property(skill, "assets");
  assert.ok(assets.type === "ArrayExpression" && assets.elements[0]);
  assert.equal(string(assets.elements[0]), "skills/review/SKILL.md");
});

test("includes Code callability and Zod Schema assertions", () => {
  const text = generateEntry(model().workflow);
  assert.match(text, /satisfies \(\.\.\.args: never\[\]\) => unknown/);
  assert.match(text, /satisfies import\("zod"\)\.ZodType/);
});

for (const kind of ["code", "agent"] as const) {
  test(`rejects a missing ${kind} ID`, () => {
    const { workflow } = model();
    const missing: LinkedWorkflow = {
      ...workflow,
      ...(kind === "code" ? { codeIds: {} } : { agentIds: {} }),
    };
    assert.throws(
      () => generateEntry(missing),
      (error) =>
        LoomError.is(error) &&
        error.code === "INVALID_WORKFLOW" &&
        /Missing resource ID/.test(error.message),
    );
  });
}
