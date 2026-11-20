import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { once } from "node:events";
import { chmod, stat } from "node:fs/promises";
import { test } from "node:test";
import {
  openKernel,
  openKernelData,
  openStore,
  RunInterruptedError,
} from "../dist/index.js";
import { interaction, runtimeFixture } from "./fixtures/runtime.mjs";

test("entry failure stops unresponsive children and preserves the primary conclusion", {
  timeout: 20_000,
}, async (t) => {
  const { kernel, start } = await runtimeFixture(t, {
    runtime: { cancellationGraceMs: 100 },
    source: `export default async function main(input, context) {
      context.exec(async () => new Promise(() => {}), {}).catch(() => {});
      if (input.prompt === "rejected") context.reject({ reason: "primary rejection" });
      throw new Error("primary failure");
    }`,
  });
  for (const prompt of ["failed", "rejected"]) {
    const { runId } = await start({ prompt });
    const result = await kernel.waitRun(runId);
    assert.deepEqual(result.execution, {
      status: prompt,
      reason: prompt === "failed" ? "primary failure" : "primary rejection",
    });
    const run = await kernel.getRun(runId);
    assert.deepEqual(run.processes, []);
    assert.ok(
      (await kernel.listExecutions({ runId })).entries.every(
        (record) => record.completion,
      ),
    );
  }
});

test("cooperative cancellation preserves finally and forced cancellation stops blocking Code", {
  timeout: 20_000,
}, async (t) => {
  const { kernel, start } = await runtimeFixture(t, {
    runtime: { cancellationGraceMs: 150 },
    source: `export default async function main(input, context) {
      try { await context.user.ask({ question: "Waiting", mode: "text" }); }
      finally {
        if (input.prompt === "block") { while (true) {} }
        throw new Error("cooperative finally ran");
      }
    }`,
  });
  for (const prompt of ["cooperate", "block"]) {
    const { runId } = await start({ prompt });
    await interaction(kernel, runId);
    const started = Date.now();
    await kernel.cancelRun(runId, "user stop");
    assert.equal((await kernel.getRun(runId)).phase, "cancelling");
    const result = await kernel.waitRun(runId);
    assert.deepEqual(result.execution, {
      status: "cancelled",
      reason: "user stop",
    });
    const run = await kernel.getRun(runId);
    const entry = await kernel.getExecution(run.entryExecutionId);
    assert.equal(run.interactions[0].status, "cancelled");
    if (prompt === "cooperate")
      assert.equal(entry.completion.result.reason, "cooperative finally ran");
    else assert.ok(Date.now() - started >= 140);
    await assert.rejects(stat(run.tempDir), { code: "ENOENT" });
    assert.deepEqual(run.processes, []);
  }
});

test("cancellation stops approved command processes and closes pending questions", {
  timeout: 20_000,
}, async (t) => {
  const { kernel, start } = await runtimeFixture(t, {
    source: `export default async function main(_, context) {
      await withTempDir(context, async directory => {
        const running = context.process.run({ command: process.execPath, args: ["-e", "setInterval(()=>{},1000)"], cwd: directory });
        running.catch(() => {});
        await context.user.ask({ question: "Command running", mode: "text" });
        await running;
      });
    }`,
  });
  const { runId } = await start();
  const authorization = await interaction(
    kernel,
    runId,
    undefined,
    (item) => item.kind === "authorization",
  );
  await kernel.submitAnswer(authorization.data.id, "once");
  let commandPid;
  for await (const event of kernel.observeRun(runId, {
    cursor: authorization.cursor,
  })) {
    if (
      event.type === "process" &&
      event.data.active &&
      event.data.process.kind === "command"
    ) {
      commandPid = event.data.process.pid;
      break;
    }
  }
  await kernel.cancelRun(runId);
  assert.equal((await kernel.waitRun(runId)).execution.status, "cancelled");
  assert.throws(() => process.kill(commandPid, 0), { code: "ESRCH" });
  const run = await kernel.getRun(runId);
  assert.ok(
    run.interactions.every(
      (item) => item.status === "answered" || item.status === "cancelled",
    ),
  );
  await assert.rejects(stat(run.tempDir), { code: "ENOENT" });
});

test("one runtime owns a dataDir; observation closes independently and normal close finalizes", {
  timeout: 20_000,
}, async (t) => {
  const { kernel, start, dataDir, installation } = await runtimeFixture(t, {
    source: `export default async function main(_, context) { await context.user.ask({ question: "Wait", mode: "text" }); }`,
  });
  await assert.rejects(openKernel({ dataDir }), /already owns/);
  const reader = await openKernelData({ dataDir });
  const store = await openStore(installation.package.name, { dataDir });
  try {
    const { runId } = await start();
    const question = await interaction(kernel, runId);
    const observer = kernel.observeRun(runId, { cursor: question.cursor });
    const next = observer.next();
    await observer.return();
    assert.equal((await next).done, true);
    assert.equal((await kernel.getRun(runId)).phase, "running");
    await store.set("independent", true);
    await kernel.close();
    const run = await reader.getRun(runId);
    assert.equal(run.result.execution.status, "cancelled");
    assert.equal(await store.get("independent"), true);
    const replacement = await openKernel({ dataDir });
    await replacement.close();
  } finally {
    await reader.close();
    await store.close();
  }
});

test("execution crashes preserve failed conclusion and still inspect available outputs", {
  timeout: 20_000,
}, async (t) => {
  const { kernel, start } = await runtimeFixture(t, {
    output: { summary: { type: "markdown", path: "summary.md" } },
    source: `export default async function main(_, context) {
      await context.fs.write({ path: "summary.md", content: "crash evidence" });
      process.exit(17);
    }`,
  });
  const { runId } = await start();
  const result = await kernel.waitRun(runId);
  assert.equal(result.execution.status, "failed");
  assert.match(result.execution.reason, /17/);
  assert.equal(result.outputs.status, "ready");
  assert.deepEqual(result.outputs.current, {});
});

test("host crash preserves the last phase and requires explicit stopped-process finalization", {
  timeout: 20_000,
}, async (t) => {
  const { kernel, dataDir, installation } = await runtimeFixture(t, {
    source: `export default async function main(_, context) { await context.user.ask({ question: "Crash host", mode: "text" }); }`,
  });
  await kernel.close();
  const host = fork(
    new URL("./fixtures/runtime.mjs", import.meta.url),
    ["host", dataDir, JSON.stringify(installation.package)],
    { stdio: ["ignore", "ignore", "inherit", "ipc"] },
  );
  t.after(() => host.kill("SIGKILL"));
  const [message] = await once(host, "message");
  const exited = once(host, "exit");
  host.kill("SIGKILL");
  await exited;
  for (const processInfo of message.record.processes) {
    try {
      process.kill(processInfo.pid, "SIGKILL");
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
  }
  const reopened = await openKernel({ dataDir });
  try {
    const run = await reopened.getRun(message.runId);
    assert.equal(run.phase, "running");
    assert.equal(run.interruption.phase, "running");
    assert.equal(run.result, undefined);
    await assert.rejects(reopened.waitRun(run.runId), RunInterruptedError);
    await assert.rejects(
      reopened.finalizeInterruptedRun(run.runId, { processesStopped: false }),
    );
    const result = await reopened.finalizeInterruptedRun(run.runId, {
      processesStopped: true,
    });
    assert.equal(result.execution.status, "failed");
    assert.match(result.execution.reason, /host exited/);
    const finished = await reopened.getRun(run.runId);
    assert.equal(finished.interruption.detectedAt, run.interruption.detectedAt);
    assert.equal(finished.interactions[0].status, "cancelled");
    assert.deepEqual(await reopened.waitRun(run.runId), result);
    await assert.rejects(stat(run.tempDir), { code: "ENOENT" });
  } finally {
    await reopened.close();
  }
});

test("cleanup failures are separate and preserve business rejection and failure", {
  timeout: 20_000,
  skip: process.getuid?.() === 0,
}, async (t) => {
  const { kernel, start } = await runtimeFixture(t, {
    source: `export default async function main(input, context) {
      await context.fs.mkdtemp({ directory: context.tempDir });
      await context.user.ask({ question: "Finish", mode: "confirm" });
      if (input.prompt === "rejected") context.reject({ reason: "business rejection" });
      if (input.prompt === "failed") throw new Error("business failure");
    }`,
  });
  for (const prompt of ["success", "rejected", "failed"]) {
    const { runId } = await start({ prompt });
    const question = await interaction(kernel, runId);
    const run = await kernel.getRun(runId);
    await chmod(run.tempDir, 0o500);
    try {
      await kernel.submitAnswer(question.data.id, {
        status: "answered",
        value: true,
      });
      const result = await kernel.waitRun(runId);
      assert.equal(
        result.execution.status,
        prompt === "rejected" ? "rejected" : "failed",
      );
      assert.match(
        result.execution.reason,
        prompt === "success" ? /finalization/ : /business/,
      );
      assert.ok((await kernel.getRun(runId)).cleanupFailures.length >= 1);
    } finally {
      await chmod(run.tempDir, 0o700).catch(() => {});
    }
  }
});
