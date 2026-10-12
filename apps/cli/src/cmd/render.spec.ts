import assert from "node:assert/strict";
import { test } from "node:test";
import type { CoreResult, ServiceRunView } from "../core/index.ts";
import { view } from "../../test/unit-fixture.ts";
import { formatDetails, formatResult } from "./render.ts";

const meta = {
  requestId: "request",
  serviceInstanceId: "instance",
  operationId: "operation",
};
const success = (data: unknown): CoreResult<unknown> => ({
  ok: true,
  data,
  meta,
});
const run: ServiceRunView = {
  ...view,
  serviceInstanceId: "instance",
  revision: 1,
};

test("human output preserves partial setup and unknown-outcome identities without JSON", () => {
  const partial: CoreResult<unknown> = {
    ok: false,
    error: {
      code: "INSTALL_FAILED",
      message: "Archive not found.",
      retryable: false,
    },
    outcome: "applied",
    meta,
    data: {
      projectRoot: "/project",
      steps: [
        { name: "scaffold", status: "completed" },
        { name: "workflows", status: "failed", message: "Archive not found." },
      ],
    },
  };
  const text = formatResult(partial, { command: "init" });
  assert.match(text, /INSTALL_FAILED: Archive not found/u);
  assert.match(text, /successful changes are retained/u);
  assert.match(text, /completed\s+scaffold/u);
  assert.match(text, /failed\s+workflows/u);
  assert.doesNotMatch(text, /"steps"|"ok"/u);
  const unknown = formatResult({
    ...partial,
    outcome: "unknown",
    data: undefined,
  });
  assert.match(unknown, /Operation: operation/u);
  assert.match(unknown, /Instance: instance/u);
  assert.match(unknown, /intloom operation operation --instance instance/u);
});

test("admission status remains visible with or without a Run snapshot", () => {
  for (const status of ["pending", "accepted", "rejected"]) {
    const receipt = {
      status,
      operationId: "operation",
      serviceInstanceId: "instance",
      runId: "RUN-original",
      error: { code: "NOT_FOUND", message: "Workflow missing." },
    };
    const text = formatResult(
      success({ receipt, ...(status === "accepted" ? { run } : {}) }),
      { command: "flow" },
    );
    assert.match(text, new RegExp(`^Request ${status}`));
    assert.match(text, /Operation: operation/u);
    if (status === "rejected")
      assert.match(text, /NOT_FOUND: Workflow missing/u);
    if (status === "accepted") {
      assert.match(text, /Pending action/u);
      assert.match(text, /intloom answer RUN-original --action/u);
    }
  }
});

test("Workflow and Run lists expose empty states and loading diagnostics", () => {
  assert.match(
    formatResult(success([]), { command: "flows" }),
    /No Workflows loaded/u,
  );
  assert.match(formatResult(success([]), { command: "runs" }), /No Runs/u);
  const text = formatResult(
    success([
      {
        packageName: "good",
        flowName: "ready",
        isAvailable: true,
        readiness: { status: "available" },
      },
      {
        packageName: "broken",
        isAvailable: false,
        phase: "load",
        error: {
          code: "WORKFLOW_LOAD_FAILED",
          message: "Cannot load package.",
        },
      },
    ]),
    { command: "flows" },
  );
  assert.match(text, /WORKFLOW\s+READINESS\s+PACKAGE/u);
  assert.match(text, /ready\s+available\s+good/u);
  assert.match(text, /broken: WORKFLOW_LOAD_FAILED — Cannot load package/u);
});

test("data text preserves nested arrays, multiline text, zero, false and null without mutating the result", () => {
  const data = {
    id: "REC-1",
    flowName: "fixture",
    stageName: "first",
    createdAt: "2026-10-11",
    data: {
      count: 0,
      enabled: false,
      optional: null,
      items: [{ text: "中文\nsecond line" }],
      empty: [],
    },
  };
  const before = structuredClone(data);
  const text = formatResult(success(data), { command: "record" });
  assert.match(text, /^Record REC-1/u);
  assert.match(text, /count: 0/u);
  assert.match(text, /enabled: no/u);
  assert.match(text, /optional: none/u);
  assert.match(text, /中文\n\s+second line/u);
  assert.match(text, /empty:\n\s+\(empty\)/u);
  assert.doesNotMatch(text, /"data"|"count"|\[object Object\]/u);
  assert.deepEqual(data, before);
  assert.equal(
    formatDetails({ note: "\u001b[31m\rhidden" }).includes("\u001b"),
    false,
  );
});

test("pages retain the full cursor and exports show a destination instead of dumping data", () => {
  const artifact = {
    id: "ART-1",
    flowName: "fixture",
    stageName: "first",
    revision: 2,
    createdAt: "date",
    data: { verbose: "business data" },
  };
  const text = formatResult(
    success({ data: [artifact], nextCursor: "cursor-full" }),
    { command: "artifacts" },
  );
  assert.match(text, /ART-1/u);
  assert.match(text, /Next cursor: cursor-full/u);
  assert.doesNotMatch(text, /business data/u);
  const exported = formatResult(success(artifact), {
    command: "artifact",
    exportedTo: "/out/artifact.json",
  });
  assert.match(exported, /Exported to: \/out\/artifact.json/u);
  assert.doesNotMatch(exported, /business data/u);
});

test("read and follow logs use the same readable lines", () => {
  const record = {
    time: "2026-10-11T09:00:00Z",
    level: 30,
    event: "model_step_completed",
    model: "fixture",
    inputTokens: 0,
    outputTokens: 12,
  };
  const text = formatResult(success([record]), { command: "logs" });
  assert.equal(text, formatResult(success(record), { command: "logs" }));
  assert.match(text, /INFO\s+model step completed/u);
  assert.match(text, /in=0.*out=12/u);
  assert.doesNotMatch(text, /"event"|"level"/u);
});
