import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer, type ServerResponse } from "node:http";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TestContext } from "node:test";
import { writeMetadata } from "../src/service/discovery.ts";
import type { ServiceStatus } from "../src/service/contracts.ts";

export async function stopProject(t: TestContext) {
  const root = await realpath(await mkdtemp(join(tmpdir(), "intloom-stop-")));
  await writeFile(join(root, "intloom.yaml"), "intent:\n  apps: []\n");
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

export async function stopEndpoint(t: TestContext) {
  const root = await stopProject(t);
  const requests: { path: string; instanceId?: string }[] = [];
  const errors: unknown[] = [];
  const handlers: {
    status?: (response: ServerResponse) => Promise<void>;
    stop?: (response: ServerResponse) => Promise<void>;
  } = {};
  const server = createServer((request, response) => {
    void (async () => {
      const chunks = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const body = chunks.length
        ? JSON.parse(Buffer.concat(chunks).toString())
        : {};
      requests.push({ path: request.url ?? "", ...body });
      if (request.url === "/_status") {
        if (handlers.status) await handlers.status(response);
        else
          response
            .writeHead(200, { "content-type": "application/json" })
            .end(JSON.stringify(status));
      } else if (handlers.stop) await handlers.stop(response);
      else response.writeHead(200).end();
    })().catch((error) => {
      errors.push(error);
      response.writeHead(500).end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const info = {
    version: 1 as const,
    projectRoot: root,
    pid: process.pid,
    instanceId: randomUUID(),
    url: `http://127.0.0.1:${address.port}/mcp`,
    startedAt: new Date().toISOString(),
    storage: "file" as const,
  };
  const status: ServiceStatus = {
    ...info,
    workflowCount: 0,
    availableWorkflowCount: 0,
    runningRuns: 0,
    waitingRuns: 0,
    completedRuns: 0,
    failedRuns: 0,
  };
  await writeMetadata(root, "connection.json", {
    version: 1,
    projectRoot: root,
    port: address.port,
    token: "A".repeat(43),
    storage: "file",
  });
  await writeMetadata(root, "service.json", info);
  await writeMetadata(root, "service.lock", {
    pid: info.pid,
    instanceId: info.instanceId,
  });
  await mkdir(join(root, "intloom"));
  await writeFile(
    join(root, "intloom/store.lock"),
    JSON.stringify({ pid: info.pid, createdAt: info.startedAt }),
    { mode: 0o600 },
  );
  t.after(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections();
    });
    assert.deepEqual(errors, []);
  });
  const release = async (
    paths = [
      ".intloom/service.json",
      ".intloom/service.lock",
      "intloom/store.lock",
    ],
  ) => {
    for (const path of paths) await rm(join(root, path), { force: true });
  };
  return { root, info, status, handlers, requests, release };
}
