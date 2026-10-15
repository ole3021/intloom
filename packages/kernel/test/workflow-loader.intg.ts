import assert from "node:assert/strict";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { createRequire, findPackageJSON } from "node:module";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { test, type TestContext } from "node:test";
import { discoverLooms, loadLoom } from "@intloom/kernel/loom";
import { getLogger, silentLogger, withLogger } from "@intloom/utils";

async function fixture(
  t: TestContext,
  local: boolean,
  asset = "skills/attachment.txt",
) {
  const root = await realpath(
    await mkdtemp(resolve(tmpdir(), "workflow-loader-")),
  );
  t.after(() => rm(root, { recursive: true, force: true }));
  const packageRoot = resolve(root, "node_modules/@test/flow");
  const assetRoot = local ? resolve(packageRoot, "dist") : packageRoot;
  await mkdir(resolve(assetRoot, "skills"), { recursive: true });
  await writeFile(
    resolve(root, "package.json"),
    JSON.stringify({ type: "module", dependencies: { "@test/flow": "1.0.0" } }),
  );
  await writeFile(
    resolve(packageRoot, "package.json"),
    JSON.stringify({
      name: "@test/flow",
      version: "1.0.0",
      type: "module",
      loom: { type: "loom", version: "2026-10-15" },
      exports: {
        ".": {
          types: local ? "./dist/flow.d.ts" : "./flow.d.ts",
          default: local ? "./dist/flow.js" : "./flow.js",
        },
        "./package.json": "./package.json",
      },
    }),
  );
  const zodFile = findPackageJSON("zod", import.meta.url);
  assert.ok(zodFile);
  await symlink(dirname(zodFile), resolve(root, "node_modules/zod"), "dir");
  const module = `
import * as z from "zod";
export const blueprint = { loomName: "fixture", inputs: ["prompt"], entryStageName: "first", stages: {
  first: { stageName: "first", initializeState: () => ({ value: "initial" }), stateSchema: z.object({ value: z.string() }), entryStepName: "run",
    steps: { run: { stepName: "run", execution: { kind: "code", codeId: "CODE-abcdefghijklmnopqrstu" }, on: { complete: { kind: "stage_end" } } } },
    on: { complete: { kind: "loom_end" } } }
} };
export const codes = { "CODE-abcdefghijklmnopqrstu": () => { throw new Error("loader must not invoke Code"); } };
export const agentSpecs = { "AGENT-abcdefghijklmnopqrstu": {
  name: "review", description: "", instructions: "review", llm: "thinking", outputSchema: z.object({ outcome: z.string() }),
  skills: [{ name: "review", description: "", content: "review", assets: ["skills/SKILL.md", ${JSON.stringify(asset)}] }], tools: [{
    id: "probe", description: "loader boundary probe", inputSchema: z.json(), outputSchema: z.json(),
    execute: function () { throw new Error("loader must not invoke Tool"); }
  }]
} };
`;
  await writeFile(resolve(assetRoot, "flow.js"), module);
  await writeFile(
    resolve(assetRoot, "skills/SKILL.md"),
    '---\nname: review\ndescription: ""\n---\nreview',
  );
  await writeFile(resolve(assetRoot, "skills/attachment.txt"), "attachment");
  const {
    sources: [source],
    failures,
  } = await discoverLooms(root);
  assert.deepEqual(failures, []);
  assert.ok(source);
  return { source, assetRoot, packageRoot, root };
}

for (const local of [true, false]) {
  test(`loads ${local ? "local dist" : "published root"} through package exports`, async (t) => {
    const { source, assetRoot } = await fixture(t, local);
    assert.equal(source.assetRoot, assetRoot);
    const workflow = await loadLoom(source);
    assert.equal(workflow.blueprint.loomName, "fixture");
    assert.equal(
      workflow.blueprint.stages.first?.stateSchema.safeParse({ value: "ok" })
        .success,
      true,
    );
    assert.equal(Object.keys(workflow.codes).length, 1);
    const original = await import(source.entryUrl);
    assert.equal(
      workflow.codes["CODE-abcdefghijklmnopqrstu"],
      original.codes["CODE-abcdefghijklmnopqrstu"],
    );
    assert.equal(
      workflow.agentSpecs["AGENT-abcdefghijklmnopqrstu"]?.tools[0]?.execute,
      original.agentSpecs["AGENT-abcdefghijklmnopqrstu"].tools[0].execute,
    );
  });
}

test("leaves Code and Tool functions unchanged when Workflow resolves the host Utils copy", async (t) => {
  const { source, root } = await fixture(t, false);
  const manifest = findPackageJSON("@intloom/utils", import.meta.url);
  assert.ok(manifest);
  await mkdir(resolve(root, "node_modules/@intloom"), { recursive: true });
  await symlink(
    dirname(manifest),
    resolve(root, "node_modules/@intloom/utils"),
    "dir",
  );
  const loaded = await loadLoom(source);
  const original = await import(source.entryUrl);
  assert.equal(
    loaded.codes["CODE-abcdefghijklmnopqrstu"],
    original.codes["CODE-abcdefghijklmnopqrstu"],
  );
  assert.equal(
    loaded.agentSpecs["AGENT-abcdefghijklmnopqrstu"]?.tools[0]?.execute,
    original.agentSpecs["AGENT-abcdefghijklmnopqrstu"].tools[0].execute,
  );
});

test("bridges a physically separate Workflow Utils logger only when Code, recover or Tool runs", async (t) => {
  const { source, assetRoot, root } = await fixture(t, false);
  const manifest = findPackageJSON("@intloom/utils", import.meta.url);
  assert.ok(manifest);
  const copyRoot = resolve(root, "node_modules/@intloom/utils");
  await mkdir(copyRoot, { recursive: true });
  await cp(manifest, resolve(copyRoot, "package.json"));
  await cp(resolve(dirname(manifest), "dist"), resolve(copyRoot, "dist"), {
    recursive: true,
  });
  for (const name of ["nanoid", "pino"]) {
    const dependency = findPackageJSON(name, pathToFileURL(manifest));
    assert.ok(dependency);
    await symlink(
      dirname(dependency),
      resolve(root, "node_modules", name),
      "dir",
    );
  }
  const flowFile = resolve(assetRoot, "flow.js");
  const original = await readFile(flowFile, "utf8");
  const oldCode =
    'export const codes = { "CODE-abcdefghijklmnopqrstu": () => { throw new Error("loader must not invoke Code"); } };';
  assert.ok(original.includes(oldCode));
  await writeFile(
    flowFile,
    original
      .replace(
        'execute: function () { throw new Error("loader must not invoke Tool"); }',
        `execute: function (input) {
        if (input.expectedThis !== undefined && this !== input.expectedThis) throw new Error("Tool this changed");
        if (input.error) throw input.error;
        if (input.marker === "tool-sync") {
          getLogger().warn("workflow_tool_called", { marker: input.marker });
          return { saved: true };
        }
        return Promise.resolve().then(() => {
          getLogger().warn("workflow_tool_called", { marker: input.marker });
          if (input.asyncError) throw input.asyncError;
          return { saved: true };
        });
      }`,
      )
      .replace(
        oldCode,
        `
import { getLogger } from "@intloom/utils";
const code = function (access) {
  if (access.expectedThis !== undefined && this !== access.expectedThis) throw new Error("Code this changed");
  if (access.marker === "sync-throw") throw new Error("fixture synchronous failure");
  if (access.marker === "sync") {
    getLogger().warn("workflow_code_called", { marker: access.marker });
    return { outcome: "complete" };
  }
  return Promise.resolve().then(() => {
    getLogger().warn("workflow_code_called", { marker: access.marker });
    if (access.marker === "throw") throw new Error("fixture Code failure");
    return { outcome: "complete" };
  });
};
code.recover = function (recovery, access) {
  if (access.expectedThis !== undefined && this !== access.expectedThis) throw new Error("recover this changed");
  return Promise.resolve().then(() => {
    getLogger().warn("workflow_code_recovered", { marker: access.marker, answer: recovery.answer });
    return { outcome: "complete" };
  });
};
export const codes = { "CODE-abcdefghijklmnopqrstu": code };`,
      ),
  );
  const separateEntry = createRequire(source.entryUrl).resolve(
    "@intloom/utils",
  );
  const separate = await import(pathToFileURL(separateEntry).href);
  assert.notEqual(separate.getLogger, getLogger);
  const rows: {
    owner: string;
    event: string;
    marker: unknown;
    answer?: unknown;
  }[] = [];
  const logger = (owner: string) => ({
    ...silentLogger,
    warn(event: string, fields?: Readonly<Record<string, unknown>>) {
      rows.push({
        owner,
        event,
        marker: fields?.marker,
        ...(fields?.answer === undefined ? {} : { answer: fields.answer }),
      });
    },
  });
  const loaded = await withLogger(logger("load"), () => loadLoom(source));
  assert.deepEqual(rows, []);
  const code = loaded.codes["CODE-abcdefghijklmnopqrstu"];
  assert.ok(code?.recover);
  assert.equal(separate.getLogger(), separate.silentLogger);
  const [first, second] = await Promise.all([
    withLogger(logger("A"), () => code({ marker: "first" } as never)),
    withLogger(logger("B"), () => code({ marker: "second" } as never)),
  ]);
  assert.deepEqual(
    [first, second],
    [{ outcome: "complete" }, { outcome: "complete" }],
  );
  const recover = code.recover;
  assert.deepEqual(
    await withLogger(logger("R"), () =>
      recover(
        {
          actionId: "A",
          kind: "user_ask_confirmation",
          request: { context: "Continue?" },
          answer: { isConfirmed: true },
        },
        { marker: "restore" } as never,
      ),
    ),
    { outcome: "complete" },
  );
  await assert.rejects(
    async () =>
      withLogger(logger("E"), () => code({ marker: "throw" } as never)),
    /fixture Code failure/,
  );
  const synchronous = withLogger(logger("S"), () =>
    code({ marker: "sync" } as never),
  );
  assert.deepEqual(synchronous, { outcome: "complete" });
  const receiver = { name: "receiver" };
  assert.deepEqual(
    await withLogger(logger("T"), () =>
      code.call(receiver, {
        marker: "receiver",
        expectedThis: receiver,
      } as never),
    ),
    { outcome: "complete" },
  );
  assert.deepEqual(
    await withLogger(logger("U"), () =>
      recover.call(
        receiver,
        {
          actionId: "A",
          kind: "user_ask_confirmation",
          request: { context: "Continue?" },
          answer: { isConfirmed: false },
        },
        { marker: "recover-receiver", expectedThis: receiver } as never,
      ),
    ),
    { outcome: "complete" },
  );
  assert.throws(
    () =>
      withLogger(logger("X"), () => code({ marker: "sync-throw" } as never)),
    /fixture synchronous failure/,
  );
  const tool = loaded.agentSpecs["AGENT-abcdefghijklmnopqrstu"]?.tools[0];
  assert.ok(tool);
  const originalModule = await import(source.entryUrl);
  const originalTool =
    originalModule.agentSpecs["AGENT-abcdefghijklmnopqrstu"].tools[0];
  const toolResults = await Promise.all([
    withLogger(logger("TA"), () =>
      tool.execute({ marker: "tool-first" }, {} as never),
    ),
    withLogger(logger("TB"), () =>
      tool.execute({ marker: "tool-second" }, {} as never),
    ),
  ]);
  assert.deepEqual(toolResults, [{ saved: true }, { saved: true }]);
  const syncTool = withLogger(logger("TS"), () =>
    tool.execute({ marker: "tool-sync" }, {} as never),
  );
  assert.deepEqual(syncTool, { saved: true });
  assert.deepEqual(
    await withLogger(logger("TM"), () =>
      tool.execute(
        { marker: "tool-method", expectedThis: originalTool },
        {} as never,
      ),
    ),
    { saved: true },
  );
  assert.deepEqual(
    await withLogger(logger("TT"), () =>
      tool.execute.call(
        receiver,
        { marker: "tool-receiver", expectedThis: receiver },
        {} as never,
      ),
    ),
    { saved: true },
  );
  const toolError = new Error("original Tool failure");
  assert.throws(
    () =>
      withLogger(logger("TX"), () =>
        tool.execute({ error: toolError }, {} as never),
      ),
    (cause) => cause === toolError,
  );
  await assert.rejects(
    async () =>
      withLogger(logger("TE"), () =>
        tool.execute(
          { marker: "tool-throw", asyncError: toolError },
          {} as never,
        ),
      ),
    (cause) => cause === toolError,
  );
  assert.equal(separate.getLogger(), separate.silentLogger);
  assert.deepEqual(rows, [
    { owner: "A", event: "workflow_code_called", marker: "first" },
    { owner: "B", event: "workflow_code_called", marker: "second" },
    {
      owner: "R",
      event: "workflow_code_recovered",
      marker: "restore",
      answer: { isConfirmed: true },
    },
    { owner: "E", event: "workflow_code_called", marker: "throw" },
    { owner: "S", event: "workflow_code_called", marker: "sync" },
    { owner: "T", event: "workflow_code_called", marker: "receiver" },
    {
      owner: "U",
      event: "workflow_code_recovered",
      marker: "recover-receiver",
      answer: { isConfirmed: false },
    },
    { owner: "TA", event: "workflow_tool_called", marker: "tool-first" },
    { owner: "TB", event: "workflow_tool_called", marker: "tool-second" },
    { owner: "TS", event: "workflow_tool_called", marker: "tool-sync" },
    { owner: "TM", event: "workflow_tool_called", marker: "tool-method" },
    { owner: "TT", event: "workflow_tool_called", marker: "tool-receiver" },
    { owner: "TE", event: "workflow_tool_called", marker: "tool-throw" },
  ]);
});

test("rejects a resolved Workflow Utils without the logger context API", async (t) => {
  const { source, root } = await fixture(t, false);
  const copyRoot = resolve(root, "node_modules/@intloom/utils");
  await mkdir(copyRoot, { recursive: true });
  await writeFile(
    resolve(copyRoot, "package.json"),
    JSON.stringify({
      name: "@intloom/utils",
      type: "module",
      exports: { ".": "./index.js" },
    }),
  );
  await writeFile(
    resolve(copyRoot, "index.js"),
    "export const getLogger = () => undefined;\n",
  );
  await assert.rejects(loadLoom(source), {
    code: "LOOM_LOAD_FAILED",
  });
});

test("rejects an installed Workflow Utils with a missing entry target", async (t) => {
  const { source, root } = await fixture(t, false);
  const copyRoot = resolve(root, "node_modules/@intloom/utils");
  await mkdir(copyRoot, { recursive: true });
  await writeFile(
    resolve(copyRoot, "package.json"),
    JSON.stringify({
      name: "@intloom/utils",
      type: "module",
      exports: { ".": "./missing.js" },
    }),
  );
  await assert.rejects(loadLoom(source), { code: "LOOM_LOAD_FAILED" });
});

test("rejects malformed metadata for an installed Workflow Utils copy", async (t) => {
  const { source, root } = await fixture(t, false);
  const copyRoot = resolve(root, "node_modules/@intloom/utils");
  await mkdir(copyRoot, { recursive: true });
  await writeFile(resolve(copyRoot, "package.json"), "{malformed");
  await assert.rejects(loadLoom(source), { code: "LOOM_LOAD_FAILED" });
});

test("rejects missing attachments", async (t) => {
  const { source } = await fixture(t, false, "skills/missing.txt");
  await assert.rejects(loadLoom(source), { code: "LOOM_LOAD_FAILED" });
});

test("rejects attachment traversal and symlink escape", async (t) => {
  const first = await fixture(t, false, "../outside.txt");
  await assert.rejects(loadLoom(first.source), {
    code: "INVALID_LOOM",
  });
  const second = await fixture(t, true);
  await rm(resolve(second.assetRoot, "skills/attachment.txt"));
  await writeFile(resolve(second.root, "outside.txt"), "outside");
  await symlink(
    resolve(second.root, "outside.txt"),
    resolve(second.assetRoot, "skills/attachment.txt"),
  );
  await assert.rejects(loadLoom(second.source), /escapes resource root/);
});

test("rejects broken module exports without reporting a loaded Workflow", async (t) => {
  const { source, assetRoot } = await fixture(t, false);
  await writeFile(
    resolve(assetRoot, "flow.js"),
    "export const blueprint = {};",
  );
  await assert.rejects(loadLoom(source), { code: "INVALID_LOOM" });
});
