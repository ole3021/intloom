import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import {
  serviceStatus as kernelStatus,
  writeMetadata,
} from "@intloom/kernel/host";
import {
  serviceStatus,
  discoverProjectConnection,
  connectProject,
} from "../index.ts";
import { temporaryDirectory } from "../../test/directory-fixture.ts";

async function fixture(t: TestContext) {
  const root = await temporaryDirectory(t);
  await writeFile(join(root, "intloom.yaml"), "looms: []\n");
  const connection = {
    version: 1 as const,
    projectRoot: root,
    port: 12345,
    token: "x".repeat(43),
    storage: "file" as const,
  };
  const info = {
    version: 1 as const,
    projectRoot: root,
    pid: process.pid,
    instanceId: randomUUID(),
    url: "http://127.0.0.1:12345/mcp",
    startedAt: new Date().toISOString(),
    storage: "file" as const,
  };
  await writeMetadata(root, "connection.json", connection);
  await writeMetadata(root, "service.json", info);
  return {
    root,
    connection,
    info,
    status: {
      ...info,
      loomCount: 0,
      availableLoomCount: 0,
      runningRuns: 0,
      waitingRuns: 0,
      completedRuns: 0,
      failedRuns: 0,
    },
  };
}

test("public status and CLI/Studio discovery use the Kernel identity checks", async (t) => {
  const f = await fixture(t);
  assert.equal(serviceStatus, kernelStatus);
  t.mock.method(globalThis, "fetch", async (url: URL, options: RequestInit) => {
    assert.equal(url.href, "http://127.0.0.1:12345/_status");
    assert.equal(options.redirect, "error");
    assert.equal(
      new Headers(options.headers).get("authorization"),
      `Bearer ${f.connection.token}`,
    );
    return Response.json(f.status);
  });
  assert.deepEqual(await serviceStatus(f.root), f.status);
  for (const source of ["cli", "studio"] as const) {
    const connection = await discoverProjectConnection(f.root, source);
    assert.equal(
      new URL(connection.url).pathname,
      source === "cli" ? "/internal/mcp" : "/internal/mcp/studio",
    );
    assert.equal(connection.token, f.connection.token);
  }
});

const timeout = () => new DOMException("fixture timeout", "TimeoutError");
const brokenBody = (error: Error) =>
  new Response(
    new ReadableStream({
      start(controller) {
        controller.error(error);
      },
    }),
  );

for (const [name, response, code] of [
  ["invalid JSON", () => new Response("not-json"), "CLI_RESULT_INVALID"],
  ["invalid status shape", () => Response.json({}), "CLI_RESULT_INVALID"],
  [
    "closing service",
    () => new Response(null, { status: 503 }),
    "CLI_SERVICE_CLOSING",
  ],
  [
    "rejected status",
    () => new Response(null, { status: 401 }),
    "CLI_SERVICE_UNAVAILABLE",
  ],
  [
    "interrupted body",
    () => brokenBody(new TypeError("connection reset")),
    "CLI_SERVICE_OFFLINE",
  ],
  ["timed out body", () => brokenBody(timeout()), "CLI_SERVICE_TIMEOUT"],
] as const) {
  test(`public clients classify ${name} using Kernel errors`, async (t) => {
    const f = await fixture(t);
    t.mock.method(globalThis, "fetch", async () => response());
    for (const entry of [
      serviceStatus,
      discoverProjectConnection,
      connectProject,
    ])
      await assert.rejects(entry(f.root), { code });
  });
}

for (const timedOut of [false, true]) {
  test(`status request ${timedOut ? "timeout" : "connection failure"} retains its classification`, async (t) => {
    const f = await fixture(t);
    if (timedOut)
      t.mock.method(AbortSignal, "timeout", () => AbortSignal.abort(timeout()));
    t.mock.method(globalThis, "fetch", async () => {
      throw new TypeError("fetch failed");
    });
    for (const entry of [
      serviceStatus,
      discoverProjectConnection,
      connectProject,
    ])
      await assert.rejects(entry(f.root), {
        code: timedOut ? "CLI_SERVICE_TIMEOUT" : "CLI_SERVICE_OFFLINE",
      });
  });
}

test("public clients reject mismatched live identities before opening MCP", async (t) => {
  const f = await fixture(t);
  for (const changed of [
    { instanceId: randomUUID() },
    { projectRoot: `${f.root}/other` },
    { pid: process.pid + 1 },
    { url: "http://127.0.0.1:12346/mcp" },
  ]) {
    const mock = t.mock.method(globalThis, "fetch", async () =>
      Response.json({ ...f.status, ...changed }),
    );
    for (const entry of [
      serviceStatus,
      discoverProjectConnection,
      connectProject,
    ])
      await assert.rejects(entry(f.root), {
        code: "CLI_SERVICE_METADATA_INVALID",
      });
    assert.equal(mock.mock.callCount(), 3);
    mock.mock.restore();
  }
});

test("untrusted metadata URLs never receive the project token", async (t) => {
  const f = await fixture(t);
  await writeMetadata(f.root, "service.json", {
    ...f.info,
    url: "https://example.invalid/mcp",
  });
  const fetch = t.mock.method(globalThis, "fetch", async () => {
    throw new Error("Unexpected request");
  });
  await assert.rejects(discoverProjectConnection(f.root), {
    code: "CLI_SERVICE_METADATA_INVALID",
  });
  assert.equal(fetch.mock.callCount(), 0);
});
