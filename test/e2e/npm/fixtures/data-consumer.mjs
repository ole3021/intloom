import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { openKernelData, openStore } from "@intloom/kernel";

const dataDir = await mkdtemp(join(tmpdir(), "intloom-data-consumer-"));
try {
  const data = await openKernelData({ dataDir });
  let executionId;
  let eventCursor;
  let installation;
  try {
    installation = await data.registerInstallation({
      directory: process.cwd(),
      packagePath: "node_modules/@intloom-example/code-report",
      source: "independent npm archive consumer",
    });
    assert.ok(
      installation.dependencies.some(
        (entry) => entry.name === "@intloom/loom-sdk",
      ),
    );
    const installedPackage = resolve(
      installation.directory,
      installation.packagePath,
    );
    const manifest = JSON.parse(
      await readFile(join(installedPackage, "loom.json"), "utf8"),
    );
    assert.deepEqual(manifest.package, installation.package);
    const module = await import(
      pathToFileURL(resolve(installedPackage, manifest.entry.module)).href
    );
    assert.equal(typeof module[manifest.entry.export], "function");
    const store = await data.getStore(installation.package.name);
    await store.set("", null);
    await store.set("业务/one", { nested: [false, 1, "陈🌍"] });
    await assert.rejects(store.set("业务/one", new Date()));
    const firstPage = await store.list({ limit: 1 });
    assert.deepEqual(firstPage.entries, [{ key: "", value: null }]);
    assert.equal(
      (await store.list({ cursor: firstPage.nextCursor })).entries[0].key,
      "业务/one",
    );
    const execution = await data.createExecution({
      package: installation.package,
      kind: "code",
      mode: "chat",
      input: { prompt: "Persistence fixture" },
    });
    executionId = execution.executionId;
    await data.completeExecution(executionId, {
      result: { status: "rejected", reason: "Record-only verification" },
    });
    eventCursor = (await data.listEvents(executionId, { limit: 1 })).nextCursor;
    assert.ok(eventCursor);
  } finally {
    await data.close();
  }
  const reopened = await openKernelData({ dataDir });
  try {
    assert.deepEqual(
      await reopened.getInstallation(installation.package),
      installation,
    );
    assert.equal(
      (await reopened.getExecution(executionId)).completion.result.status,
      "rejected",
    );
    assert.equal(
      (await reopened.listEvents(executionId, { cursor: eventCursor }))
        .entries[0].type,
      "completed",
    );
    assert.equal(
      (await reopened.listExecutions({ status: "rejected" })).entries.length,
      1,
    );
    const store = await openStore(installation.package.name, { dataDir });
    const global = await openStore(undefined, { dataDir });
    try {
      assert.equal(await store.get(""), null);
      assert.deepEqual(await store.get("业务/one"), {
        nested: [false, 1, "陈🌍"],
      });
      assert.equal(await global.get("业务/one"), undefined);
    } finally {
      await Promise.all([store.close(), global.close()]);
    }
  } finally {
    await reopened.close();
  }
  console.log(
    "Kernel data archive consumer passed: installation binding, SQLite Store, records, events and reopen.",
  );
} finally {
  await rm(dataDir, { recursive: true, force: true });
}
