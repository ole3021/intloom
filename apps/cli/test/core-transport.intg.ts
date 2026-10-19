import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { createCliCore } from "@intloom/cli";
import type { CoreMeta } from "@intloom/kernel/operations";

const sentinel = "PRIVATE_RESPONSE_AND_CREDENTIAL_SENTINEL";
type Handler = (
  request: IncomingMessage,
  response: ServerResponse,
  meta: CoreMeta,
) => void;

async function fixture(t: TestContext) {
  const projectPath = await realpath(
    await mkdtemp(join(tmpdir(), "intloom-core-transport-")),
  );
  const serviceInstanceId = randomUUID();
  const token = "t".repeat(43);
  let handler: Handler = (_request, response, meta) => {
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ ok: true, data: [], meta }));
  };
  let requests = 0;
  let status: object;
  let statusHandler: Handler = (_request, response) => {
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify(status));
  };
  const server = createServer((request, response) => {
    const meta = {
      requestId: String(request.headers["x-intloom-request-id"]),
      projectRoot: projectPath,
      serviceInstanceId,
    };
    if (request.url === "/_status") {
      statusHandler(request, response, meta);
      return;
    }
    requests++;
    handler(request, response, meta);
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  t.after(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await rm(projectPath, { recursive: true, force: true });
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const info = {
    version: 1,
    projectRoot: projectPath,
    pid: process.pid,
    instanceId: serviceInstanceId,
    url: `http://127.0.0.1:${address.port}/mcp`,
    startedAt: new Date().toISOString(),
    storage: "file",
  };
  status = {
    ...info,
    loomCount: 0,
    availableLoomCount: 0,
    runningRuns: 0,
    waitingRuns: 0,
    completedRuns: 0,
    failedRuns: 0,
  };
  await writeFile(join(projectPath, "intloom.yaml"), "looms: []\n");
  await mkdir(join(projectPath, ".intloom"), { mode: 0o700 });
  for (const [name, value] of [
    ["service.json", info],
    [
      "connection.json",
      {
        version: 1,
        projectRoot: projectPath,
        port: address.port,
        token,
        storage: "file",
      },
    ],
  ] as const)
    await writeFile(
      join(projectPath, ".intloom", name),
      JSON.stringify(value),
      {
        mode: 0o600,
      },
    );
  return {
    core: createCliCore(),
    input: { projectPath, serviceInstanceId },
    token,
    get requests() {
      return requests;
    },
    respond(next: Handler) {
      handler = next;
    },
    respondStatus(next: Handler) {
      statusHandler = next;
    },
  };
}

test("HTTP status does not replace a valid identity-matching business error", async (t) => {
  const project = await fixture(t);
  for (const status of [400, 401, 403, 404, 500]) {
    project.respond((_request, response, meta) => {
      response.writeHead(status, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          ok: false,
          error: {
            code: "NOT_FOUND",
            message: "The Run is missing.",
            retryable: true,
          },
          outcome: "not_applied",
          meta: { ...meta, runId: "RUN-missing" },
        }),
      );
    });
    const result = await project.core.getRun({
      ...project.input,
      runId: "RUN-missing",
    });
    assert.ok(!result.ok);
    assert.deepEqual(result.error, {
      code: "NOT_FOUND",
      message: "The Run is missing.",
      retryable: true,
    });
    assert.equal(result.outcome, "not_applied");
    assert.equal(result.meta.runId, "RUN-missing");
    assert.equal(
      result.meta.serviceInstanceId,
      project.input.serviceInstanceId,
    );
  }
});

test("old API, malformed results and HTTP failures receive bounded distinct diagnostics", async (t) => {
  const project = await fixture(t);
  const cases = [
    [404, "text/plain", sentinel, "CLI_SERVICE_PROTOCOL_MISMATCH"],
    [200, "text/plain", sentinel, "CLI_RESULT_INVALID"],
    [200, "application/json", sentinel, "CLI_RESULT_INVALID"],
    [404, "application/json", sentinel, "CLI_RESULT_INVALID"],
    [400, "application/json", sentinel, "CLI_RESULT_INVALID"],
    [
      200,
      "application/json",
      JSON.stringify({ ok: true, data: sentinel }),
      "CLI_RESULT_INVALID",
    ],
    [401, "text/plain", sentinel, "CLI_SERVICE_UNAVAILABLE"],
    [403, "application/json", sentinel, "CLI_SERVICE_UNAVAILABLE"],
    [
      500,
      "application/json",
      JSON.stringify({ error: sentinel }),
      "CLI_SERVICE_UNAVAILABLE",
    ],
  ] as const;
  for (const [status, contentType, body, code] of cases) {
    project.respond((_request, response) => {
      response.writeHead(status, { "content-type": contentType });
      response.end(body);
    });
    const result = await project.core.listLooms(project.input);
    assert.ok(!result.ok, JSON.stringify(result));
    assert.equal(result.error.code, code);
    assert.equal(result.outcome, "not_applied");
    assert.ok(result.error.message.length < 512);
    assert.equal(JSON.stringify(result).includes(sentinel), false);
    assert.equal(JSON.stringify(result).includes(project.token), false);
    assert.equal(result.meta.projectRoot, project.input.projectPath);
    assert.equal(
      result.meta.serviceInstanceId,
      project.input.serviceInstanceId,
    );
  }
});

test("envelope schema and each trusted identity are validated before accepting a response", async (t) => {
  const project = await fixture(t);
  for (const change of [
    { requestId: sentinel },
    { projectRoot: sentinel },
    { serviceInstanceId: randomUUID() },
  ]) {
    project.respond((_request, response, meta) => {
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({ ok: true, data: [], meta: { ...meta, ...change } }),
      );
    });
    const result = await project.core.listLooms(project.input);
    assert.ok(!result.ok);
    assert.equal(result.error.code, "CLI_RESULT_INVALID");
    assert.equal(JSON.stringify(result).includes(sentinel), false);
  }
  project.respond((_request, response, meta) => {
    response.setHeader("content-type", "Application/JSON; charset=utf-8");
    response.end(JSON.stringify({ ok: true, data: [], meta }));
  });
  assert.ok((await project.core.listLooms(project.input)).ok);
});

test("request timeout and broken connection are distinguished without disclosing causes", async (t) => {
  const project = await fixture(t);
  const timeout = AbortSignal.timeout;
  t.mock.method(AbortSignal, "timeout", (ms: number) =>
    timeout(ms === 10000 ? 25 : ms),
  );
  project.respond(() => {});
  const stalled = await project.core.listLooms(project.input);
  assert.ok(!stalled.ok);
  assert.equal(stalled.error.code, "CLI_SERVICE_TIMEOUT");
  project.respond((request) => request.socket.destroy(new Error(sentinel)));
  const disconnected = await project.core.listLooms(project.input);
  assert.ok(!disconnected.ok);
  assert.equal(disconnected.error.code, "CLI_SERVICE_OFFLINE");
  assert.equal(JSON.stringify(disconnected).includes(sentinel), false);
  project.respond((_request, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.write('{"ok":');
  });
  const unfinished = await project.core.listLooms(project.input);
  assert.ok(!unfinished.ok);
  assert.equal(unfinished.error.code, "CLI_SERVICE_TIMEOUT");
});

test("sent writes remain unknown once, with original operation and Run references", async (t) => {
  const project = await fixture(t);
  const operationId = randomUUID();
  const runId = "RUN-original";
  project.respond((request) => request.socket.destroy(new Error(sentinel)));
  const result = await project.core.answerAsk({
    ...project.input,
    runId,
    operationId,
    actionId: "ACTION-original",
    answer: sentinel,
  });
  assert.ok(!result.ok);
  assert.equal(result.error.code, "REQUEST_OUTCOME_UNKNOWN");
  assert.match(result.error.message, /CLI_SERVICE_OFFLINE/u);
  assert.equal(result.outcome, "unknown");
  assert.equal(result.meta.operationId, operationId);
  assert.equal(result.meta.runId, runId);
  assert.equal(result.meta.projectRoot, project.input.projectPath);
  assert.equal(result.meta.serviceInstanceId, project.input.serviceInstanceId);
  assert.equal(project.requests, 1);
  assert.equal(JSON.stringify(result).includes(sentinel), false);
  assert.equal(JSON.stringify(result).includes(project.token), false);
});

test("sent writes retain a valid business rejection but keep malformed receipts unknown", async (t) => {
  const project = await fixture(t);
  const input = {
    ...project.input,
    operationId: randomUUID(),
    loomName: "missing",
    input: { prompt: sentinel },
  };
  project.respond((_request, response, meta) => {
    response.writeHead(404, { "content-type": "application/json" });
    response.end(
      JSON.stringify({
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "The Loom is missing.",
          retryable: false,
        },
        outcome: "not_applied",
        meta: { ...meta, operationId: input.operationId },
      }),
    );
  });
  const rejected = await project.core.run(input);
  assert.ok(!rejected.ok);
  assert.equal(rejected.error.code, "NOT_FOUND");
  assert.equal(rejected.outcome, "not_applied");
  assert.equal(rejected.meta.operationId, input.operationId);
  for (const [status, contentType, diagnosis] of [
    [404, "text/plain", "CLI_SERVICE_PROTOCOL_MISMATCH"],
    [200, "application/json", "CLI_RESULT_INVALID"],
    [503, "text/plain", "CLI_SERVICE_UNAVAILABLE"],
  ] as const) {
    const before = project.requests;
    project.respond((_request, response) => {
      response.writeHead(status, { "content-type": contentType });
      response.end(sentinel);
    });
    const invalid = await project.core.run(input);
    assert.ok(!invalid.ok);
    assert.equal(invalid.error.code, "REQUEST_OUTCOME_UNKNOWN");
    assert.ok(invalid.error.message.includes(diagnosis));
    assert.equal(invalid.outcome, "unknown");
    assert.equal(invalid.meta.operationId, input.operationId);
    assert.equal(project.requests, before + 1);
    assert.equal(JSON.stringify(invalid).includes(sentinel), false);
  }
});

test("status-probe timeout and invalid JSON are classified before a write is sent", async (t) => {
  const project = await fixture(t);
  const operationId = randomUUID();
  const input = {
    ...project.input,
    operationId,
    loomName: "fixture",
    input: { prompt: sentinel },
  };
  for (const body of [sentinel, JSON.stringify({ instanceId: sentinel })]) {
    project.respondStatus((_request, response) => {
      response.setHeader("content-type", "application/json");
      response.end(body);
    });
    const invalid = await project.core.run(input);
    assert.ok(!invalid.ok);
    assert.equal(invalid.error.code, "CLI_RESULT_INVALID");
    assert.equal(invalid.outcome, "not_applied");
    assert.equal(JSON.stringify(invalid).includes(sentinel), false);
  }
  const timeout = AbortSignal.timeout;
  t.mock.method(AbortSignal, "timeout", (ms: number) =>
    timeout(ms === 5000 ? 25 : ms),
  );
  project.respondStatus(() => {});
  const stalled = await project.core.run(input);
  assert.ok(!stalled.ok);
  assert.equal(stalled.error.code, "CLI_SERVICE_TIMEOUT");
  assert.equal(stalled.outcome, "not_applied");
  assert.equal(stalled.meta.operationId, operationId);
  assert.equal(project.requests, 0);
  project.respondStatus((_request, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.write('{"version":');
  });
  const unfinished = await project.core.run(input);
  assert.ok(!unfinished.ok);
  assert.equal(unfinished.error.code, "CLI_SERVICE_TIMEOUT");
  assert.equal(unfinished.outcome, "not_applied");
  assert.equal(project.requests, 0);
});
