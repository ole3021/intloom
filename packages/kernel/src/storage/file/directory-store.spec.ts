import assert from "node:assert/strict";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import {
  append,
  create,
  storageDirectory,
  storageCleanup,
} from "../../../test/storage-contract.ts";
import { openFileStorage } from "./open.ts";

test("directory layout publishes Artifact and Record together; failed publication and orphan content do not advance the visible store", async (t) => {
  const directory = await storageDirectory(t);
  const handle = await openFileStorage({ directory, layout: "directories" });
  storageCleanup(t, () => handle.dispose());
  await assert.rejects(openFileStorage({ directory }), { code: "BUSY" });
  await rename(join(directory, "store.json"), join(directory, "saved.json"));
  await mkdir(join(directory, "store.json"));
  await assert.rejects(handle.access.commit([create, append]), {
    code: "STORAGE_ERROR",
  });
  assert.equal(await handle.access.getArtifactById("artifact"), undefined);
  assert.equal(await handle.access.getRecordById("record"), undefined);
  await rm(join(directory, "store.json"), { recursive: true });
  await rename(join(directory, "saved.json"), join(directory, "store.json"));
  await handle.dispose();
  const next = await openFileStorage({ directory, layout: "directories" });
  storageCleanup(t, () => next.dispose());
  assert.equal((await next.access.listArtifacts({})).data.length, 0);
  assert.equal((await next.access.listRecords({})).data.length, 0);
  await next.access.commit([create, append]);
  const manifest = JSON.parse(
    await readFile(join(directory, "store.json"), "utf8"),
  );
  assert.equal(manifest.version, 2);
  assert.equal(
    JSON.parse(
      await readFile(
        join(directory, "artifacts", `${manifest.artifacts[0]}.json`),
        "utf8",
      ),
    ).id,
    "artifact",
  );
  assert.equal(
    JSON.parse(
      await readFile(
        join(directory, "records", `${manifest.records[0]}.json`),
        "utf8",
      ),
    ).id,
    "record",
  );
});

test("durable data survives deleting local locks; missing or damaged content is never reset", async (t) => {
  const root = await storageDirectory(t);
  const directory = join(root, "intloom");
  await mkdir(join(root, ".intloom"));
  const options = { directory, layout: "directories" as const };
  const handle = await openFileStorage(options);
  await handle.access.commit([create, append]);
  await handle.dispose();
  await rm(join(root, ".intloom"), { recursive: true });
  const reopened = await openFileStorage(options);
  assert.equal(
    (await reopened.access.getArtifactById("artifact"))?.id,
    "artifact",
  );
  await reopened.dispose();
  const manifest = await readFile(join(directory, "store.json"), "utf8");
  const filename = join(
    directory,
    "records",
    `${JSON.parse(manifest).records[0]}.json`,
  );
  await writeFile(filename, "{}");
  await assert.rejects(openFileStorage(options), { code: "STORAGE_ERROR" });
  await rm(filename);
  await assert.rejects(openFileStorage(options), { code: "STORAGE_ERROR" });
  assert.equal(await readFile(join(directory, "store.json"), "utf8"), manifest);
  await assert.rejects(readFile(join(directory, "store.lock")), {
    code: "ENOENT",
  });
  await rm(join(directory, "store.json"));
  await assert.rejects(openFileStorage(options), { code: "STORAGE_ERROR" });
  await assert.rejects(readFile(join(directory, "store.json")), {
    code: "ENOENT",
  });
});
