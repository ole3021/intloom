import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { answerAsk, flow } from "@intloom/kernel";
import { fullFlowFixture, sourcePath } from "./full-flow-fixture.ts";
import { implementationRecordSchema } from "../schemas/implementation-state.ts";
import { validationContextSchema } from "../schemas/validation-state.ts";
import { recordId } from "../src/flow/shared.ts";

for (const scenario of [
  { backend: "file", source: "cli", repair: false },
  { backend: "sqlite", source: "cli", repair: false },
  { backend: "file", source: "agent_ide", repair: false },
  { backend: "file", source: "cli", repair: true },
] as const) {
  test(`${scenario.backend}/${scenario.source}: complete unmodified Intent through both confirmations, host checks and durable results${scenario.repair ? " after a real failed check" : ""}`, {
    timeout: 30000,
  }, async (t) => {
    const f = await fullFlowFixture(t, scenario.backend, scenario.repair);
    const intent =
      "  Implement a Unicode greeting\nwithout adding dependencies.  ";
    let run = await flow(f.execution, "intent", intent, scenario.source);
    const runId = run.runId;
    await assert.rejects(
      flow(f.execution, "intent", "another Run", scenario.source),
      { code: "BUSY" },
    );
    const confirmations: string[] = [];
    for (
      let boundary = 0;
      boundary < 12 && run.status === "waiting";
      boundary++
    ) {
      assert.equal(run.runId, runId);
      if (run.pendingAgentCall) run = await f.completeClientAgent(run);
      else {
        assert.ok(run.pendingAction);
        assert.equal(run.pendingAction.kind, "user_ask_confirmation");
        confirmations.push(run.cursor.stageName);
        run = await answerAsk(f.execution, runId, run.pendingAction.id, {
          isConfirmed: true,
        });
      }
    }
    assert.equal(run.status, "completed", JSON.stringify(run.lastError));
    assert.deepEqual(run.cursor, {
      stageName: "validation",
      stepName: "finalize",
    });
    assert.deepEqual(confirmations, ["specification", "solution"]);
    assert.deepEqual(
      [...new Set(f.reads.map((read) => read.tool))],
      [
        "read_specification",
        "read_solution",
        "read_implementation",
        "read_validation",
      ],
    );
    assert.equal(f.modelRequests.length > 0, scenario.source === "cli");
    assert.match(await readFile(join(f.root, sourcePath), "utf8"), /Hello/);
    const artifacts = await f.handle.access.listArtifacts({});
    const records = await f.handle.access.listRecords({});
    assert.equal(artifacts.data.length, 3);
    assert.equal(records.data.length, 3);
    const implementation = implementationRecordSchema.parse(
      (await f.handle.access.getRecordById(recordId(runId, "implementation")))
        ?.data,
    );
    assert.equal(implementation.id, runId);
    assert.equal(implementation.intent, intent);
    assert.equal(implementation.checks[0]?.exitCode, 0);
    assert.match(
      implementation.checks[0]?.stdout ?? "",
      /greeting preserves Unicode/,
    );
    assert.deepEqual(
      implementation.changes.flatMap((change) =>
        change.paths.map((path) => path.path),
      ),
      [sourcePath],
    );
    const validation = validationContextSchema.parse(
      f.reads.find((read) => read.tool === "read_validation")?.state,
    );
    assert.equal(
      validation.implementationRecordId,
      recordId(runId, "implementation"),
    );
    assert.equal(validation.commandResults[0]?.exitCode, 0);
    const report = await f.handle.access.getArtifact("intent", "validation");
    assert.ok(
      report?.data &&
        typeof report.data === "object" &&
        "implementationRecordId" in report.data,
    );
    assert.equal(
      report.data.implementationRecordId,
      recordId(runId, "implementation"),
    );
    assert.ok(
      f.reads.filter((read) => read.tool === "read_implementation").length ===
        (scenario.repair ? 2 : 1),
    );
    if (scenario.repair) {
      const failed = implementation.feedbacks.find(
        (feedback) => feedback.source === "check",
      );
      assert.ok(failed);
      assert.match(failed.content, /Project checks failed/);
      assert.match(failed.content, /"exitCode":1/);
    }
    await f.handle.dispose();
    const reopened = await f.open();
    try {
      assert.deepEqual(await reopened.access.listArtifacts({}), artifacts);
      assert.deepEqual(await reopened.access.listRecords({}), records);
    } finally {
      await reopened.dispose();
    }
  });
}
