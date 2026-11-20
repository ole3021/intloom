import assert from "node:assert/strict";
import { readFile, stat, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { runResultSchema } from "@intloom/loom-sdk";
import { openKernelData } from "../dist/index.js";
import { interaction, runtimeFixture } from "./fixtures/runtime.mjs";

test("concurrent Runs have distinct processes and cancellation does not stop a sibling", {
  timeout: 20_000,
}, async (t) => {
  const { kernel, start } = await runtimeFixture(t, {
    output: { summary: { type: "markdown", path: "summary.md" } },
    source: `export default async function main(input, context) {
      await context.user.ask({ question: "Ready " + input.prompt, mode: "confirm" });
      await context.fs.write({ path: "summary.md", content: input.prompt });
    }`,
  });
  const [first, second] = await Promise.all([
    start({ prompt: "first" }),
    start({ prompt: "second" }),
  ]);
  const [, answer] = await Promise.all([
    interaction(kernel, first.runId),
    interaction(kernel, second.runId),
  ]);
  const [a, b] = await Promise.all([
    kernel.getRun(first.runId),
    kernel.getRun(second.runId),
  ]);
  assert.notEqual(a.processes[0].pid, b.processes[0].pid);
  assert.notEqual(a.workDir, b.workDir);
  await kernel.cancelRun(first.runId);
  await kernel.submitAnswer(answer.data.id, {
    status: "answered",
    value: true,
  });
  const [cancelled, succeeded] = await Promise.all([
    kernel.waitRun(first.runId),
    kernel.waitRun(second.runId),
  ]);
  assert.equal(cancelled.execution.status, "cancelled");
  assert.equal(succeeded.execution.status, "succeeded");
  assert.equal(
    await readFile(succeeded.outputs.result.summary.path, "utf8"),
    "second",
  );
});

test("loading errors retain task identity and finalize the recorded entry", {
  timeout: 20_000,
}, async (t) => {
  const { kernel, start } = await runtimeFixture(t, {
    source: `throw new Error("module binding failure"); export default async function main() {}`,
  });
  const { runId } = await start();
  const result = await kernel.waitRun(runId);
  assert.equal(result.runId, runId);
  assert.deepEqual(result.execution, {
    status: "failed",
    reason: "module binding failure",
  });
  const run = await kernel.getRun(runId);
  assert.equal(
    (await kernel.getExecution(run.entryExecutionId)).completion.result.status,
    "failed",
  );
  await assert.rejects(stat(run.tempDir), { code: "ENOENT" });
});

test("real Code runs share one process, retain closures and separate Exec values", {
  timeout: 20_000,
}, async (t) => {
  const { kernel, start, dataDir } = await runtimeFixture(t, {
    output: { summary: { type: "markdown", path: "summary.md" } },
    source: `export default async function main(input, context) {
      const pid = process.pid;
      const add = 4;
      const answer = await context.exec(async (value, child) => {
        if (process.pid !== pid || child.workDir !== context.workDir) throw new Error("binding");
        await child.store.set("child", value + add);
        return value + add;
      }, 3);
      await context.exec(async () => null, {});
      await context.exec(async () => {}, {});
      try { await context.exec(async (_, child) => child.reject({ reason: "caught rejection" }), {}); }
      catch (error) { if (error.name !== "ExecutionRejectedError") throw error; }
      context.exec(async (_, child) => {
        await new Promise(resolve => setTimeout(resolve, 30));
        await child.fs.write({ path: "summary.md", content: String(answer) });
      }, {});
    }`,
  });
  const { runId } = await start();
  const result = await kernel.waitRun(runId);
  assert.deepEqual(result.execution, { status: "succeeded" });
  assert.equal(result.outputs.status, "ready");
  assert.deepEqual(runResultSchema.parse(result), result);
  const run = await kernel.getRun(runId);
  assert.equal(await readFile(join(run.workDir, "summary.md"), "utf8"), "7");
  await assert.rejects(stat(run.tempDir), { code: "ENOENT" });
  assert.equal(await (await kernel.getStore(run.package.name)).get("child"), 7);
  const executions = (await kernel.listExecutions({ runId })).entries;
  assert.equal(executions.length, 6);
  assert.equal(executions[1].completion.value, 7);
  assert.equal(executions[2].completion.value, null);
  assert.equal("value" in executions[3].completion, false);
  assert.equal(executions[4].completion.result.status, "rejected");
  assert.ok(
    executions
      .slice(1)
      .every(
        (item) => item.parentId === run.entryExecutionId && item.mode === "run",
      ),
  );
  const events = [];
  for await (const event of kernel.observeRun(runId)) events.push(event);
  assert.equal(events[0].type, "created");
  assert.equal(events.at(-1).type, "finished");
  const cursor = events[2].cursor;
  const replay = [];
  for await (const event of kernel.observeRun(runId, { cursor }))
    replay.push(event);
  assert.deepEqual(replay, events.slice(3));
  await kernel.close();
  const data = await openKernelData({ dataDir });
  t.after(() => data.close());
  assert.deepEqual(await data.getRun(runId), run);
  assert.deepEqual(
    (await data.listRunEvents(runId, { cursor })).entries,
    replay,
  );
});

test("workspace uses original resolved input paths, independent cwd and current files", {
  timeout: 20_000,
}, async (t) => {
  const { kernel, start, root, workspace } = await runtimeFixture(t, {
    scope: "workspace",
    input: { files: { required: true } },
    output: { summary: { type: "markdown", path: "summary.md" } },
    source: `export default async function main(input, context) {
      if (process.cwd() !== context.workDir) throw new Error("cwd");
      await context.fs.write({ path: "summary.md", content: await context.fs.read({ path: input.files[0] }) });
      throw new Error("business failed after writing");
    }`,
  });
  const source = join(root, "original.txt");
  const link = join(root, "input-link.txt");
  await writeFile(source, "original material");
  await symlink(source, link);
  const { runId } = await start({ files: [link], folders: [] });
  const result = await kernel.waitRun(runId);
  const run = await kernel.getRun(runId);
  assert.equal(run.workDir, workspace);
  assert.deepEqual(run.input, { files: [source], folders: [] });
  assert.equal(result.execution.status, "failed");
  assert.equal(result.outputs.status, "ready");
  assert.deepEqual(result.outputs.current, result.outputs.result);
  assert.equal(
    await readFile(join(workspace, "summary.md"), "utf8"),
    "original material",
  );
});

test("questions preserve executable refinements, retry, defer and skip through IPC", {
  timeout: 20_000,
}, async (t) => {
  const { kernel, start } = await runtimeFixture(t, {
    source: `export default async function main(_, context) {
      const secret = "precise answer";
      const response = await context.user.ask({
        question: "Evidence?", mode: "text", allowDefer: true,
        schema: z.string().refine(value => value === secret, "Use the precise answer"),
      });
      await context.store.set("answer", response);
      await context.user.ask({ question: "Optional?", mode: "confirm", allowSkip: true });
      const answer = await context.user.ask({ question: "Continue?", mode: "confirm" });
      if (answer.value !== false) throw new Error("expected false without rejecting");
    }`,
  });
  const { runId } = await start();
  const first = await interaction(kernel, runId);
  const deferred = await kernel.submitAnswer(first.data.id, {
    status: "deferred",
  });
  assert.equal(deferred.interaction.status, "deferred");
  const invalid = await kernel.submitAnswer(first.data.id, {
    status: "answered",
    value: "wrong",
  });
  assert.equal(invalid.status, "pending");
  assert.match(invalid.interaction.issues[0].message, /precise/);
  assert.equal(invalid.interaction.draft, "wrong");
  assert.deepEqual(
    await kernel.submitAnswer(first.data.id, {
      status: "answered",
      value: "precise answer",
    }),
    { status: "accepted" },
  );
  const second = await interaction(
    kernel,
    runId,
    first.cursor,
    (item) => item.id !== first.data.id,
  );
  await kernel.submitAnswer(second.data.id, { status: "skipped" });
  const third = await interaction(
    kernel,
    runId,
    second.cursor,
    (item) => item.id !== second.data.id,
  );
  await kernel.submitAnswer(third.data.id, {
    status: "answered",
    value: false,
  });
  assert.equal((await kernel.waitRun(runId)).execution.status, "succeeded");
  const run = await kernel.getRun(runId);
  assert.deepEqual(
    run.interactions.map((item) => item.status),
    ["answered", "skipped", "answered"],
  );
  const answers = (await kernel.listRunEvents(runId)).entries.filter(
    (event) => event.type === "answer",
  );
  assert.equal(answers.length, 5);
});

test("output checks are independent of conclusion and include partial files and empty folders", {
  timeout: 20_000,
}, async (t) => {
  const { kernel, start } = await runtimeFixture(t, {
    output: {
      summary: { type: "markdown", path: "missing.md" },
      files: { type: "files", paths: ["one.txt", "two.txt"] },
      folder: { type: "folder", path: "empty" },
    },
    source: `export default async function main(_, context) {
      await context.fs.mkdir({ path: "empty" });
      await context.fs.write({ path: "one.txt", content: "" });
    }`,
  });
  const { runId } = await start();
  const result = await kernel.waitRun(runId);
  assert.equal(result.execution.status, "succeeded");
  assert.equal(result.outputs.status, "incomplete");
  assert.equal(result.outputs.issues.length, 3);
  assert.equal(result.outputs.result.files.paths.length, 1);
  assert.equal(result.outputs.result.folder.type, "folder");
  assert.deepEqual(result.outputs.current, {});
});

test("validation errors precede records; ignored child failures and invalid results fail recorded Runs", {
  timeout: 20_000,
}, async (t) => {
  const { kernel, installation, start } = await runtimeFixture(t, {
    input: { prompt: { required: true } },
    source: `export default async function main(input, context) {
      if (input.prompt === "bad-json") return new Date();
      context.exec(async () => { throw new Error("unhandled child"); }, {});
    }`,
  });
  await assert.rejects(start(), /Required input/);
  assert.equal((await kernel.listRuns()).entries.length, 0);
  await assert.rejects(
    kernel.startRun({
      package: installation.package,
      input: { prompt: "ok" },
      workDir: "/unused",
    }),
    /own workDir/,
  );
  for (const prompt of ["bad-json", "unhandled"]) {
    const { runId } = await start({ prompt });
    const result = await kernel.waitRun(runId);
    assert.equal(result.execution.status, "failed");
    assert.match(
      result.execution.reason,
      prompt === "bad-json" ? /plain JSON/ : /unhandled child/,
    );
  }
});
