import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { projectFixture } from "../../test/project-fixture.ts";
import { claimServiceRecovery } from "./discovery.ts";
import { diagnoseProject, recoverProject } from "./recovery.ts";

test("diagnosis does not create resources; clean recovery is a no-op", async (t) => {
  const root = await projectFixture(t, false);
  assert.equal((await diagnoseProject(root)).status, "offline");
  assert.equal((await recoverProject(root)).recovered, false);
  await assert.rejects(readFile(join(root, ".intloom/service.lock")), {
    code: "ENOENT",
  });
});

test("unknown owner is blocked and malformed metadata is preserved", async (t) => {
  const root = await projectFixture(t, false);
  await mkdir(join(root, ".intloom"), { mode: 0o700 });
  const filename = join(root, ".intloom/service.lock");
  const original = JSON.stringify({
    pid: process.pid,
    instanceId: randomUUID(),
  });
  await writeFile(filename, original, { mode: 0o600 });
  t.mock.method(process, "kill", () => {
    throw Object.assign(new Error("no permission"), { code: "EPERM" });
  });
  const diagnosis = await diagnoseProject(root);
  assert.equal(diagnosis.status, "blocked");
  assert.equal(diagnosis.owners[0]?.status, "unknown");
  await assert.rejects(recoverProject(root), { code: "CLI_RECOVERY_BLOCKED" });
  assert.equal(await readFile(filename, "utf8"), original);
  t.mock.restoreAll();
  await writeFile(filename, "{broken");
  await assert.rejects(recoverProject(root), {
    code: "CLI_SERVICE_METADATA_INVALID",
  });
  assert.equal(await readFile(filename, "utf8"), "{broken");
});

test("recovery lock release never removes a replacement instance", async (t) => {
  const root = await projectFixture(t, false);
  await mkdir(join(root, ".intloom"), { mode: 0o700 });
  const filename = join(root, ".intloom/service.lock");
  const release = await claimServiceRecovery(root, undefined);
  const replacement = JSON.stringify({
    pid: process.pid,
    instanceId: randomUUID(),
  });
  await writeFile(filename, replacement);
  await release();
  assert.equal(await readFile(filename, "utf8"), replacement);
});

test("interrupted cleanup with an absent recovery owner can be resumed", async (t) => {
  const root = await projectFixture(t, false);
  const child = spawn(process.execPath, ["-e", ""], { stdio: "ignore" });
  await new Promise<void>((resolve) => child.once("exit", () => resolve()));
  assert.ok(child.pid);
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await mkdir(join(root, ".intloom"), { mode: 0o700 });
  await writeFile(
    join(root, ".intloom/connection.json"),
    JSON.stringify({
      version: 1,
      projectRoot: root,
      port: address.port,
      token: "A".repeat(43),
      storage: "file",
    }),
    { mode: 0o600 },
  );
  // Storage cleanup already finished; the interrupted recover process left its service lock.
  await writeFile(
    join(root, ".intloom/service.lock"),
    JSON.stringify({
      pid: child.pid,
      instanceId: randomUUID(),
    }),
    { mode: 0o600 },
  );
  assert.equal((await diagnoseProject(root)).status, "recovery_required");
  const result = await recoverProject(root);
  assert.equal(result.recovered, true);
  assert.deepEqual(result.paths, [".intloom/service.lock"]);
  assert.equal((await diagnoseProject(root)).status, "offline");
});
