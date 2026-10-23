import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import { test } from "node:test";
import { createCliCore, type CoreResult } from "../../core/index.ts";
import { view } from "../../../test/unit-fixture.ts";
import { createOutput } from "./index.ts";

function output(json: boolean, command = "attach") {
  const stdout: string[] = [],
    stderr: string[] = [];
  const io = {
    input: new PassThrough(),
    output: new PassThrough(),
    error: new PassThrough(),
    cwd: process.cwd(),
    isTTY: false,
  };
  io.output.on("data", (chunk) => stdout.push(String(chunk)));
  io.error.on("data", (chunk) => stderr.push(String(chunk)));
  return { output: createOutput(io, { json }, [command]), stdout, stderr };
}

test("JSON output preserves stopped Runs as one unchanged result without extra queries or ANSI", async (t) => {
  const { pendingAction: _action, ...run } = view;
  const result: CoreResult<unknown> = {
    ok: true,
    data: {
      ...run,
      status: "failed",
      lastError: { code: "RUN_STOPPED", message: "Stopped", retryable: false },
    },
    meta: { requestId: "request", projectRoot: "/project" },
  };
  const before = structuredClone(result);
  const core = createCliCore();
  const logs = t.mock.method(core, "readLogs", () => {
    throw new Error("Unexpected query");
  });
  const artifacts = t.mock.method(core, "listArtifacts", () => {
    throw new Error("Unexpected query");
  });
  const capture = output(true);
  capture.output.print(result);
  await capture.output.diagnostics(core);
  assert.deepEqual(capture.stdout, [`${JSON.stringify(before)}\n`]);
  assert.deepEqual(capture.stderr, []);
  assert.deepEqual(result, before);
  assert.equal(capture.output.exitCode, 1);
  assert.equal(logs.mock.callCount(), 0);
  assert.equal(artifacts.mock.callCount(), 0);
  const human = output(false, "cancel");
  human.output.print(result);
  assert.match(human.stdout.join(""), /Stopped/);
  assert.doesNotMatch(human.stdout.join(""), /Execution failed/);
  assert.equal(human.stdout.join("").includes("\u001b"), false);
  assert.equal(human.output.exitCode, 0);
});

test("machine failures use stdout and human failures use stderr with a nonzero exit", () => {
  const result: CoreResult<unknown> = {
    ok: false,
    error: {
      code: "CLI_RESULT_INVALID",
      message: "Invalid status JSON.",
      retryable: false,
    },
    outcome: "not_applied",
    meta: { requestId: "request" },
  };
  for (const json of [true, false]) {
    const capture = output(json);
    capture.output.print(result);
    assert.equal(capture.output.exitCode, 1);
    if (json) {
      assert.deepEqual(capture.stdout, [`${JSON.stringify(result)}\n`]);
      assert.deepEqual(capture.stderr, []);
    } else {
      assert.deepEqual(capture.stdout, []);
      assert.match(
        capture.stderr.join(""),
        /CLI_RESULT_INVALID: Invalid status JSON/,
      );
    }
  }
});
