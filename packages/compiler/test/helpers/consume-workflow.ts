import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const [consumer, root] = process.argv.slice(2);
assert.ok(consumer);
assert.ok(root);
const require = createRequire(resolve(consumer, "package.json"));
const entry = require.resolve("@intloom/compiler-fixture");
assert.equal(entry, resolve(root, "dist/workflow.generated.js"));
const output = await import(pathToFileURL(entry).href);
assert.deepEqual(Object.keys(output).sort(), [
  "agentSpecs",
  "blueprint",
  "codes",
]);
const { blueprint, codes, agentSpecs } = output;
assert.equal(blueprint.flowName, "compiler_fixture");
assert.equal(blueprint.entryStageName, "first");
assert.deepEqual(Object.keys(blueprint.stages), ["first", "second"]);
const { first, second } = blueprint.stages;
assert.equal(first.stageName, "first");
assert.equal(first.entryStepName, "run");
assert.deepEqual(Object.keys(first.steps), ["run", "review"]);
assert.deepEqual(first.steps.run.on, {
  complete: { kind: "step", stepName: "review" },
});
assert.deepEqual(first.steps.review.on, {
  retry: { kind: "step", stepName: "run" },
  complete: { kind: "stage_end" },
});
assert.deepEqual(first.on, {
  complete: { kind: "stage", stageName: "second" },
});
assert.deepEqual(second.on, { complete: { kind: "workflow_end" } });
assert.deepEqual(second.steps.run.on, { complete: { kind: "stage_end" } });
assert.equal(first.steps.run.execution.kind, "code");
assert.equal(first.steps.review.execution.kind, "agent");
const codeId = first.steps.run.execution.codeId;
assert.match(codeId, /^CODE-[\w-]{21}$/);
assert.equal(second.steps.run.execution.codeId, codeId);
assert.deepEqual(Object.keys(codes), [codeId]);
assert.equal(typeof codes[codeId], "function");
assert.deepEqual(await codes[codeId]("hello"), {
  outcome: "complete",
  value: "HELLO",
});
assert.equal(first.stateSchema.safeParse({ value: "valid" }).success, true);
assert.equal(first.stateSchema.safeParse({ value: 42 }).success, false);
assert.equal(first.stateSchema, second.stateSchema);
assert.equal(first.initializeState, second.initializeState);
await assert.rejects(access(resolve(root, "stage-initialized.txt")), {
  code: "ENOENT",
});
const seed = await first.initializeState({
  runId: "RUN-consumer",
  flowName: blueprint.flowName,
  stageName: "first",
  intent: "seed text",
});
assert.deepEqual(first.stateSchema.parse(seed), { value: "seed text" });
assert.equal(
  await readFile(resolve(root, "stage-initialized.txt"), "utf8"),
  "initialized",
);

const agentId = first.steps.review.execution.agentId;
assert.match(agentId, /^AGENT-[\w-]{21}$/);
assert.deepEqual(Object.keys(agentSpecs), [agentId]);
const spec = agentSpecs[agentId];
assert.equal(spec.name, "fixture-reviewer");
assert.equal(spec.description, "Review the fixture value.");
assert.equal(
  spec.instructions,
  "Read state, apply the review skill, and return an outcome.",
);
assert.equal(spec.llm, "reasoning");
assert.equal(spec.outputSchema.safeParse({ outcome: "retry" }).success, true);
assert.equal(
  spec.outputSchema.safeParse({ outcome: "missing" }).success,
  false,
);
assert.equal(spec.tools.length, 1);
assert.equal(spec.tools[0].id, "echo");
assert.equal(await spec.tools[0].execute("value"), "echo:value");
assert.equal(spec.skills.length, 1);
const skill = spec.skills[0];
assert.equal(skill.name, "fixture-review");
assert.equal(skill.description, "Review using the bundled template.");
assert.equal(skill.content, "Check the value using template.txt.");
assert.deepEqual([...skill.assets].sort(), [
  "skills/review/SKILL.md",
  "skills/review/template.txt",
]);
for (const asset of skill.assets) {
  assert.deepEqual(
    await readFile(resolve(root, "dist", asset)),
    await readFile(resolve(root, asset)),
  );
}
assert.equal(
  await readFile(resolve(root, "module-loaded.txt"), "utf8"),
  "loaded",
);
