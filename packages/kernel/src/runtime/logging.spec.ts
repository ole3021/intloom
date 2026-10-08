import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { openLog, getLogger, withLogger, silentLogger } from "@intloom/utils";
import { runtimeFixture } from "../../test/runtime-fixture.ts";
import { createRuntime } from "./create-runtime.ts";

test("repeated steps and resumed Code retain distinct execution identities across concurrent Runs", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "intloom-runtime-log-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const logs = await openLog({ directory: root });
  t.after(() => logs.close());
  const f = runtimeFixture();
  const visits = new Map<string, number>();
  f.codes.start = async (_input, access) => {
    const intent = String((access.state.value as { intent: string }).intent);
    const visit = (visits.get(intent) ?? 0) + 1;
    visits.set(intent, visit);
    if (visit === 1) return { outcome: "retry" };
    getLogger().debug("before_wait");
    await access.interaction.confirm("PRIVATE_QUESTION");
    getLogger().debug("after_wait");
    return { outcome: "complete" };
  };
  const runtime = createRuntime({ ...f.options, logger: logs.logger });
  const requestEvents: string[] = [];
  const requestLogger = {
    ...silentLogger,
    debug(event: string) {
      requestEvents.push(event);
    },
  };
  const views = await Promise.all([
    withLogger(requestLogger, () => runtime.flow(f.blueprint, "PRIVATE_A")),
    runtime.flow(f.blueprint, "PRIVATE_B"),
  ]);
  for (const view of views) {
    assert.ok(view.pendingAction);
    assert.equal(
      (
        await runtime.answerAsk(view.runId, view.pendingAction.id, {
          isConfirmed: true,
        })
      ).status,
      "completed",
    );
  }
  await logs.close();
  const text = await readFile(logs.filePath, "utf8");
  assert.doesNotMatch(text, /PRIVATE_/u);
  const rows = text
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.ok(requestEvents.includes("run_requested"));
  for (const view of views) {
    const own = rows.filter((row) => row.runId === view.runId);
    assert.equal(own.filter((row) => row.event === "run_started").length, 1);
    const starts = own.filter((row) => row.event === "step_started");
    assert.equal(
      new Set(starts.map((row) => row.executionId)).size,
      starts.length,
    );
    const before = own.find((row) => row.event === "before_wait");
    const after = own.find((row) => row.event === "after_wait");
    assert.ok(before && after);
    assert.equal(before.executionId, after.executionId);
    assert.ok(own.some((row) => row.event === "run_completed"));
  }
});
