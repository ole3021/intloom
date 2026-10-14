import assert from "node:assert/strict";
import { test } from "node:test";
import {
  LoomError,
  silentLogger,
  withLogger,
  type LogFields,
} from "@intloom/utils";
import { createProjectApplication } from "../src/service/application/project.ts";
import type { ProjectHost } from "../src/service/host.ts";

function fixture() {
  const rows: { event: string; fields: LogFields }[] = [];
  const logger = {
    ...silentLogger,
    debug(event: string, fields: LogFields = {}) {
      rows.push({ event, fields });
    },
    warn(event: string, fields: LogFields = {}) {
      rows.push({ event, fields });
    },
  };
  let failure: Error | undefined;
  const read = async () => {
    if (failure) throw failure;
    return undefined;
  };
  // Only this application's logging boundary is under test; no Runtime behavior is replaced in integration acceptance.
  const host = {
    assertOpen() {},
    execution: {
      runtime: {
        getRun: read,
        getAgentCall: read,
        readAgentAsset: read,
        claimAgentCall: read,
      },
    },
    presentRun: (run: unknown) => run,
  } as unknown as ProjectHost;
  return {
    application: createProjectApplication(host, "agent_ide"),
    rows,
    logger,
    fail() {
      failure = new LoomError("NOT_FOUND", "PRIVATE_QUERY_FAILURE_SENTINEL");
    },
  };
}

test("polling Run, Agent task and asset reads does not emit run_requested", async () => {
  const f = fixture();
  await withLogger(f.logger, async () => {
    for (let index = 0; index < 3; index++) {
      await f.application.getRun("RUN-query");
      await f.application.getAgentCall({ runId: "RUN-query", callId: "call" });
      await f.application.readAgentAsset({
        runId: "RUN-query",
        callId: "call",
        ownerToken: "private-owner",
        assetId: "asset",
      });
    }
    await f.application.claimAgentCall({
      runId: "RUN-query",
      callId: "call",
      claimId: "claim",
    });
  });
  assert.deepEqual(f.rows, [
    { event: "run_requested", fields: { runId: "RUN-query" } },
  ]);
});

test("failed Run, Agent task and asset reads retain only safe Run association", async () => {
  const f = fixture();
  f.fail();
  await withLogger(f.logger, async () => {
    await assert.rejects(f.application.getRun("RUN-query"), {
      code: "NOT_FOUND",
    });
    await assert.rejects(
      f.application.getAgentCall({ runId: "RUN-query", callId: "call" }),
      { code: "NOT_FOUND" },
    );
    await assert.rejects(
      f.application.readAgentAsset({
        runId: "RUN-query",
        callId: "call",
        ownerToken: "private-owner",
        assetId: "asset",
      }),
      { code: "NOT_FOUND" },
    );
  });
  assert.equal(f.rows.length, 3);
  for (const row of f.rows)
    assert.deepEqual(row, {
      event: "run_query_failed",
      fields: { runId: "RUN-query", errorCode: "NOT_FOUND" },
    });
  assert.equal(
    JSON.stringify(f.rows).includes("PRIVATE_QUERY_FAILURE_SENTINEL"),
    false,
  );
  assert.equal(JSON.stringify(f.rows).includes("private-owner"), false);
});
