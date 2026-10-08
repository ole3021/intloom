import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";
import { stopEndpoint, stopProject } from "../../test/stop-fixture.ts";
import { writeMetadata } from "./discovery.ts";
import { stopService } from "./stop-service.ts";

test("clean offline stop is successful without creating metadata; invalid projects fail", async (t) => {
  const root = await stopProject(t);
  assert.deepEqual(await stopService(root), {
    projectRoot: root,
    stopped: false,
  });
  await assert.rejects(readFile(join(root, ".intloom/connection.json")), {
    code: "ENOENT",
  });
  await assert.rejects(stopService(join(root, "missing")), {
    code: "CLI_PROJECT_INVALID",
  });
});

test("cleanup completed between observation and process exit is accepted without resending stop", async (t) => {
  const f = await stopEndpoint(t);
  f.handlers.stop = async (response) => {
    response.writeHead(200).end();
  };
  t.mock.method(process, "kill", () => {
    for (const path of [
      ".intloom/service.json",
      ".intloom/service.lock",
      "intloom/store.lock",
    ])
      rmSync(join(f.root, path), { force: true });
    throw Object.assign(new Error("exited"), { code: "ESRCH" });
  });
  assert.equal((await stopService(f.root)).stopped, true);
  assert.equal(
    f.requests.filter((request) => request.path === "/_stop").length,
    1,
  );
});

test("offline stop preserves storage-only locks, unknown owners and corrupt metadata", async (t) => {
  const root = await stopProject(t);
  await mkdir(join(root, "intloom"), { recursive: true });
  const path = join(root, "intloom/store.lock");
  const original = JSON.stringify({
    pid: process.pid,
    createdAt: new Date().toISOString(),
  });
  await writeFile(path, original, { mode: 0o600 });
  t.mock.method(process, "kill", () => {
    throw Object.assign(new Error("unknown owner"), { code: "EPERM" });
  });
  await assert.rejects(stopService(root), { code: "CLI_SERVICE_BUSY" });
  assert.equal(await readFile(path, "utf8"), original);
  t.mock.restoreAll();
  await mkdir(join(root, ".intloom"), { recursive: true });
  await writeFile(join(root, ".intloom/connection.json"), "{broken", {
    mode: 0o600,
  });
  await assert.rejects(stopService(root), {
    code: "CLI_SERVICE_METADATA_INVALID",
  });
});

test("stop waits for storage release after service metadata disappears, sends once", async (t) => {
  const f = await stopEndpoint(t);
  let releaseStorage!: () => void;
  const storageDone = new Promise<void>((resolve) => {
    releaseStorage = resolve;
  });
  f.handlers.stop = async (response) => {
    response.writeHead(200).end();
    await f.release([".intloom/service.json", ".intloom/service.lock"]);
    await delay(100);
    await f.release(["intloom/store.lock"]);
    releaseStorage();
  };
  assert.equal((await stopService(f.root)).stopped, true);
  await storageDone;
  await assert.rejects(readFile(join(f.root, "intloom/store.lock")), {
    code: "ENOENT",
  });
  assert.deepEqual(
    f.requests.filter((x) => x.path === "/_stop").map((x) => x.instanceId),
    [f.info.instanceId],
  );
  assert.equal((await stopService(f.root)).stopped, false);
});

test("concurrent shutdown already in progress only waits for the pinned instance", async (t) => {
  const f = await stopEndpoint(t);
  f.handlers.status = async (response) => {
    response.writeHead(503).end();
    await delay(75);
    await f.release();
  };
  assert.equal((await stopService(f.root)).stopped, true);
  assert.equal(f.requests.filter((x) => x.path === "/_stop").length, 0);
});

test("lost shutdown response is confirmed by resource release without replay", async (t) => {
  const f = await stopEndpoint(t);
  f.handlers.stop = async (response) => {
    response.destroy();
    await delay(75);
    await f.release();
  };
  assert.equal((await stopService(f.root)).stopped, true);
  assert.equal(f.requests.filter((x) => x.path === "/_stop").length, 1);
});

test("replacement during status validation is preserved and receives no shutdown request", async (t) => {
  const f = await stopEndpoint(t);
  const replacement = {
    ...f.info,
    instanceId: randomUUID(),
    startedAt: "2026-10-08T01:00:00.000Z",
  };
  f.handlers.status = async (response) => {
    await writeMetadata(f.root, "service.json", replacement);
    await writeMetadata(f.root, "service.lock", {
      pid: replacement.pid,
      instanceId: replacement.instanceId,
    });
    await writeFile(
      join(f.root, "intloom/store.lock"),
      JSON.stringify({
        pid: replacement.pid,
        createdAt: replacement.startedAt,
      }),
    );
    response
      .writeHead(200, { "content-type": "application/json" })
      .end(JSON.stringify({ ...f.status, ...replacement }));
  };
  assert.equal((await stopService(f.root)).stopped, true);
  assert.equal(f.requests.filter((x) => x.path === "/_stop").length, 0);
  assert.equal(
    JSON.parse(await readFile(join(f.root, ".intloom/service.json"), "utf8"))
      .instanceId,
    replacement.instanceId,
  );
});

test("invalid service identity is rejected before any HTTP request", async (t) => {
  const f = await stopEndpoint(t);
  await writeMetadata(f.root, "service.json", {
    ...f.info,
    url: "http://127.0.0.1:1/mcp",
  });
  await assert.rejects(stopService(f.root), {
    code: "CLI_SERVICE_METADATA_INVALID",
  });
  assert.deepEqual(f.requests, []);
  await writeMetadata(f.root, "service.json", f.info);
  const foreignLock = JSON.stringify({
    pid: process.pid + 1,
    createdAt: f.info.startedAt,
  });
  await writeFile(join(f.root, "intloom/store.lock"), foreignLock);
  await assert.rejects(stopService(f.root), { code: "CLI_SERVICE_CONFLICT" });
  assert.equal(
    await readFile(join(f.root, "intloom/store.lock"), "utf8"),
    foreignLock,
  );
  assert.deepEqual(f.requests, []);
});

test("replacement instance survives a rejected old-instance shutdown; no retry", async (t) => {
  const f = await stopEndpoint(t);
  const replacement = {
    ...f.info,
    instanceId: randomUUID(),
    startedAt: "2026-10-08T01:00:00.000Z",
  };
  f.handlers.stop = async (response) => {
    await writeMetadata(f.root, "service.json", replacement);
    await writeMetadata(f.root, "service.lock", {
      pid: replacement.pid,
      instanceId: replacement.instanceId,
    });
    await writeFile(
      join(f.root, "intloom/store.lock"),
      JSON.stringify({
        pid: replacement.pid,
        createdAt: replacement.startedAt,
      }),
    );
    response.writeHead(409).end();
  };
  assert.equal((await stopService(f.root)).stopped, true);
  assert.equal(
    JSON.parse(await readFile(join(f.root, ".intloom/service.lock"), "utf8"))
      .instanceId,
    replacement.instanceId,
  );
  assert.deepEqual(
    f.requests.filter((x) => x.path === "/_stop").map((x) => x.instanceId),
    [f.info.instanceId],
  );
});

test("authentication rejection and unconfirmed release remain errors with metadata preserved", async (t) => {
  const f = await stopEndpoint(t);
  const path = join(f.root, ".intloom/service.lock");
  const original = await readFile(path, "utf8");
  f.handlers.stop = async (response) => {
    response.writeHead(401).end();
  };
  await assert.rejects(stopService(f.root), {
    code: "CLI_SERVICE_UNAVAILABLE",
  });
  f.handlers.stop = async (response) => {
    response.writeHead(409).end();
  };
  await assert.rejects(stopService(f.root), { code: "CLI_SERVICE_CONFLICT" });
  let clock = 0;
  t.mock.method(Date, "now", () => clock);
  f.handlers.stop = async (response) => {
    clock = 10_001;
    response.writeHead(200).end();
  };
  await assert.rejects(stopService(f.root), { code: "CLI_SERVICE_TIMEOUT" });
  assert.equal(await readFile(path, "utf8"), original);
});
