import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import type { LoomConfig } from "@intloom/kernel";
import {
  discoverWorkflows,
  initializeWorkflows,
  loadWorkflow,
} from "@intloom/kernel/workflow";

const run = promisify(execFile);
const root = fileURLToPath(new URL("../", import.meta.url));

function modelConfig(version: string): LoomConfig {
  return {
    intent: { apps: [] },
    localStorage: "file",
    workflows: [
      { name: "@intloom/workflow-intent", version, sha256: "a".repeat(64) },
    ],
    useMcpAgent: true,
    llms: {
      default: {
        provider: "openai-compatible",
        model: "fixture-model",
        secret: "ENV.INTLOOM_PACKED_TEST_KEY",
        baseURL: "https://model.invalid/v1",
      },
    },
  };
}

test("loads local workspace Intent with resources relative to its resolved entry", async (t) => {
  const previous = process.env.INTLOOM_PACKED_TEST_KEY;
  process.env.INTLOOM_PACKED_TEST_KEY = "fixture-credential";
  t.after(() => {
    if (previous === undefined) delete process.env.INTLOOM_PACKED_TEST_KEY;
    else process.env.INTLOOM_PACKED_TEST_KEY = previous;
  });
  t.mock.method(globalThis, "fetch", async () => {
    throw new Error("Initialization must not call the model");
  });
  const project = await mkdtemp(resolve(tmpdir(), "intent-local-"));
  t.after(() => rm(project, { recursive: true, force: true }));
  const installation = resolve(project, ".intloom/workflows");
  await mkdir(resolve(installation, "node_modules/@intloom"), {
    recursive: true,
  });
  await symlink(
    root,
    resolve(installation, "node_modules/@intloom/workflow-intent"),
    "dir",
  );
  const manifest = JSON.parse(
    await readFile(resolve(root, "package.json"), "utf8"),
  );
  const config = modelConfig(manifest.version);
  const {
    sources: [source],
    failures,
  } = await discoverWorkflows(installation, config.workflows);
  assert.deepEqual(failures, []);
  assert.ok(source);
  assert.equal(source.assetRoot, resolve(source.packageRoot, "dist"));
  const workflow = await loadWorkflow(source);
  assert.equal(workflow.blueprint.flowName, "intent");
  const result = await initializeWorkflows({
    projectRoot: project,
    config,
  });
  assert.deepEqual(result.workflows, [
    {
      packageName: "@intloom/workflow-intent",
      flowName: "intent",
      isAvailable: true,
    },
  ]);
  for (const agent of Object.values(result.registries.agents)) {
    assert.equal(
      agent.spec.skills.length,
      agent.spec.name === "intent-analyst" ? 3 : 0,
    );
    assert.ok(agent.spec.tools.length >= 2);
  }
});

test("installs root-layout tarballs and loads Intent without repository sources or Compiler", {
  timeout: 120_000,
}, async (t) => {
  const temporary = await mkdtemp(resolve(tmpdir(), "intent-install-"));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const archives = resolve(temporary, "archives");
  const project = resolve(temporary, "consumer/.intloom/workflows");
  await mkdir(archives);
  await mkdir(project, { recursive: true });
  const packages: Record<string, string> = {};
  for (const [name, directory] of [
    ["workflow-intent", resolve(root, "dist")],
    ["cli", resolve(root, "../../apps/cli/.publish")],
    ["workflow-sdk", resolve(root, "../workflow-sdk")],
    ["utils", resolve(root, "../utils")],
  ]) {
    const { stdout } = await run(
      "bun",
      ["pm", "pack", "--destination", archives, "--ignore-scripts", "--quiet"],
      { cwd: directory },
    );
    packages[`@intloom/${name}`] = resolve(archives, stdout.trim());
  }
  await writeFile(
    resolve(project, "package.json"),
    JSON.stringify({
      type: "module",
      dependencies: Object.fromEntries(
        Object.entries(packages).map(([name, file]) => [name, `file:${file}`]),
      ),
      // Resolve internal dependencies and peers to the tarballs produced by this test.
      overrides: Object.fromEntries(
        Object.entries(packages).map(([name, file]) => [name, `file:${file}`]),
      ),
    }),
  );
  try {
    // npm exercises bundled dependencies and native installation; Node runs consumers.
    await run("npm", ["install", "--no-audit", "--no-fund"], {
      cwd: project,
      timeout: 90_000,
      maxBuffer: 1024 * 1024,
    });
  } catch (cause) {
    throw new Error(
      `Tarball installation failed: ${cause instanceof Error && "stderr" in cause ? String(cause.stderr) : String(cause)}`,
      { cause },
    );
  }
  const kernelFiles = await readdir(
    resolve(project, "node_modules/@intloom/cli/node_modules/@intloom/kernel"),
    { recursive: true },
  );
  assert.ok(
    kernelFiles.includes("migrations/storage-sqlite/meta/_journal.json"),
  );
  assert.ok(
    kernelFiles.some(
      (file) =>
        file.startsWith("migrations/storage-sqlite/") && file.endsWith(".sql"),
    ),
  );
  const installed = resolve(project, "node_modules/@intloom/workflow-intent");
  const manifest = JSON.parse(
    await readFile(resolve(installed, "package.json"), "utf8"),
  );
  assert.equal(manifest.exports["."].default, "./workflow.generated.js");
  const utilsManifest = JSON.parse(
    await readFile(resolve(root, "../utils/package.json"), "utf8"),
  );
  assert.equal(manifest.dependencies["@intloom/utils"], utilsManifest.version);
  assert.ok(manifest.dependencies["@intloom/workflow-sdk"]);
  assert.equal(manifest.dependencies["@intloom/kernel"], undefined);
  assert.equal(manifest.peerDependencies?.["@intloom/kernel"], undefined);
  for (const field of ["private", "scripts", "devDependencies"])
    assert.equal(Object.hasOwn(manifest, field), false);
  const files = await readdir(installed, { recursive: true });
  assert.equal(files.includes("dist"), false);
  assert.equal(files.includes("workflow.yaml"), false);
  assert.equal(
    files.some((file) => /(?:\.spec\.|\.intg\.|^test\/|^build\/)/.test(file)),
    false,
  );
  assert.equal(
    files.some((file) => file.endsWith(".ts") && !file.endsWith(".d.ts")),
    false,
  );
  assert.ok(files.includes("workflow.generated.d.ts"));
  const consumer = `
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
const require = createRequire(import.meta.resolve("@intloom/cli"));
const kernel = specifier => import(pathToFileURL(require.resolve(specifier)).href);
const { discoverWorkflows, initializeWorkflows, loadWorkflow } = await kernel("@intloom/kernel/workflow");
process.env.INTLOOM_PACKED_TEST_KEY = "fixture-credential";
globalThis.fetch = async () => { throw new Error("Initialization must not call the model"); };
const config = ${JSON.stringify(modelConfig(manifest.version))};
const { sources, failures } = await discoverWorkflows(process.cwd(), config.workflows);
assert.deepEqual(failures, []);
assert.equal(sources.length, 1);
const source = sources[0];
assert.equal(source.assetRoot, source.packageRoot);
const workflow = await loadWorkflow(source);
assert.equal(workflow.blueprint.flowName, "intent");
const stage = workflow.blueprint.stages.specification;
const seed = await stage.initializeState({ runId: "RUN-packed", flowName: "intent", stageName: "specification", intent: "  packed input  " });
const state = stage.stateSchema.parse(seed);
assert.equal(state.id, "RUN-packed");
assert.deepEqual(state.changes, []);
assert.equal(state.intent, "  packed input  ");
assert.ok(Object.values(workflow.codes).every(code => typeof code === "function"));
for (const agent of Object.values(workflow.agentSpecs)) {
  assert.ok(agent.tools.length >= 2);
  for (const skill of agent.skills) for (const asset of skill.assets) assert.ok((await readFile(resolve(source.assetRoot, asset))).length);
}
const result = await initializeWorkflows({ projectRoot: resolve(process.cwd(), "../.."), config });
assert.deepEqual(result.workflows, [{ packageName: "@intloom/workflow-intent", flowName: "intent", isAvailable: true }]);
assert.deepEqual(Object.keys(result.registries.codes), Object.keys(workflow.codes));
assert.deepEqual(Object.keys(result.registries.agents), Object.keys(workflow.agentSpecs));
for (const agent of Object.values(result.registries.agents)) {
  assert.equal(agent.spec.skills.length, agent.spec.name === "intent-analyst" ? 3 : 0);
  assert.ok(agent.spec.tools.length >= 2);
}
const { openFileStorage } = await kernel("@intloom/kernel/storage/file");
const { openSqliteStorage } = await kernel("@intloom/kernel/storage/sqlite");
for (const handle of [
  await openFileStorage({ directory: resolve(process.cwd(), "file-store") }),
  await openSqliteStorage({ filename: resolve(process.cwd(), "store.sqlite"), projectId: "packed" }),
]) {
  try {
    await handle.access.commit([{ type: "append_record", id: "packed", payload: { flowName: "intent", stageName: "specification", data: "installed" } }]);
    assert.equal((await handle.access.getRecordById("packed")).data, "installed");
  } finally { await handle.dispose(); }
}
await assert.rejects(import("@intloom/kernel"), { code: "ERR_MODULE_NOT_FOUND" });
await assert.rejects(import("@intloom/compiler"), { code: "ERR_MODULE_NOT_FOUND" });
console.log("PACKED_WORKFLOW_OK");
`;
  await writeFile(resolve(project, "consumer.mjs"), consumer);
  const { stdout } = await run(
    process.execPath,
    [resolve(project, "consumer.mjs")],
    { cwd: project },
  );
  assert.match(stdout, /PACKED_WORKFLOW_OK/);
  // Consume installed declarations without source paths mappings.
  await writeFile(
    resolve(project, "consumer.ts"),
    `import { blueprint, codes } from "@intloom/workflow-intent";
import type { Blueprint, BlueprintStep, BlueprintStepExecution, CodeExecutionAccess, ExecutableCode, JsonValue, StageStateInitializer, StepResult, UserAnswerQuestions, WorkflowModule } from "@intloom/workflow-sdk";
import type { ProjectHost } from "@intloom/cli";
blueprint satisfies Blueprint;
codes satisfies Readonly<Record<string, ExecutableCode>>;
declare const access: CodeExecutionAccess<JsonValue>;
declare const host: ProjectHost;
host.execution.runtime satisfies object;
const initializeState: StageStateInitializer = ({ runId, intent }) => ({ id: runId, intent });
// @ts-expect-error Code access must provide interaction.
const missingInteraction: CodeExecutionAccess<JsonValue> = { state: access.state, storage: access.storage };
// @ts-expect-error Business data belongs in Stage State.
const invalidResult: StepResult = { outcome: "ready", data: {} };
// @ts-expect-error Hook execution is not a supported Step kind.
const hook: BlueprintStepExecution = { kind: "hook", hookId: "HOOK-1" };
// @ts-expect-error Question interaction is Code, not a special Step kind.
const question: BlueprintStepExecution = { kind: "kernel", operation: "ask" };
// @ts-expect-error Initializer output must satisfy the JSON boundary.
const initialize: StageStateInitializer = () => ({ intent: undefined });
// @ts-expect-error One question has one textual answer.
const answers: UserAnswerQuestions = [{ questionId: "Q1", isSkipped: false, answer: ["yes"] }];
const code = Object.values(codes)[0]!;
// @ts-expect-error Code input must be JSON and access must provide State/Storage.
code(() => null, {});
declare const workflow: WorkflowModule;
workflow.blueprint satisfies Blueprint;
`,
  );
  const repository = resolve(root, "../..");
  await writeFile(
    resolve(project, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        target: "ES2023",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        strict: true,
        // Match repository settings; this does not check all Mastra dependency declarations.
        skipLibCheck: true,
        noEmit: true,
        types: ["node"],
      },
      files: ["consumer.ts"],
    }),
  );
  // Install type dependencies too; do not link repository sources or declarations.
  await run(
    "bun",
    ["add", "--dev", "@types/node@24", "--ignore-scripts", "--no-progress"],
    { cwd: project, timeout: 30_000 },
  );
  try {
    await run(
      process.execPath,
      [
        resolve(repository, "node_modules/typescript/bin/tsc"),
        "-p",
        resolve(project, "tsconfig.json"),
      ],
      { cwd: project, maxBuffer: 1024 * 1024 },
    );
  } catch (cause) {
    throw new Error(
      cause instanceof Error && "stdout" in cause
        ? String(cause.stdout)
        : String(cause),
      { cause },
    );
  }
});
