import assert from "node:assert/strict";
import { test } from "node:test";
import {
  LoomError,
  silentLogger,
  withLogger,
  type LogFields,
} from "@intloom/utils";
import { createOperations } from "./project.ts";
import type { OperationsPorts } from "./ports.ts";
import type { AgentTask } from "../execution/delegated/contracts.ts";
import { view } from "../../test/interaction-fixture.ts";

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
  const read = async <T>(value: T): Promise<T> => {
    if (failure) throw failure;
    return value;
  };
  const unexpected = (): never => {
    throw new Error("Unexpected operation in query logging test");
  };
  const task: AgentTask = {
    runId: "RUN-query",
    callId: "call",
    agentId: "agent",
    cursor: { stageName: "first", stepName: "review" },
    instructions: "Review",
    skills: [],
    tools: [],
    outputSchema: {},
  };
  const ports: OperationsPorts = {
    projectRoot: "/fixture",
    assertOpen() {},
    receipts: { get: unexpected, admit: unexpected },
    runtime: {
      getRun: () => read({ ...view, runId: "RUN-query" }),
      listRuns: unexpected,
      watchRun: unexpected,
      findRun: unexpected,
      submitAnswer: unexpected,
      pauseRun: unexpected,
      cancelRun: unexpected,
      resumeRun: unexpected,
    },
    delegated: {
      getAgentCall: () =>
        read({
          pending: {
            id: "call",
            agentId: "agent",
            phase: "available",
            createdAt: view.createdAt,
          },
          task,
          receipts: [],
        }),
      readAgentAsset: () => read({ content: "fixture", encoding: "utf8" }),
      claimAgentCall: () => read({ task, ownerToken: "private-owner" }),
      callAgentTool: unexpected,
      completeAgentCall: unexpected,
      failAgentCall: unexpected,
    },
    storage: {
      getArtifact: unexpected,
      getArtifactById: unexpected,
      getLatestRecord: unexpected,
      getRecordById: unexpected,
      listArtifacts: unexpected,
      listRecords: unexpected,
    },
    startRun: unexpected,
    listLooms: unexpected,
    status: unexpected,
    restoreMirror: unexpected,
    presentRun: (run) => run,
  };
  return {
    application: createOperations(ports, "agent_ide"),
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
