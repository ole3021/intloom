import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { openFileStorage } from "@intloom/kernel/storage/file";
import { openSqliteStorage } from "@intloom/kernel/storage/sqlite";

const run = promisify(execFile);
const cwd = fileURLToPath(new URL("../", import.meta.url));

test("built Storage subpaths reopen in another Node process and resolve shipped migrations", async () => {
  const root = await mkdtemp(join(tmpdir(), "storage-built-"));
  try {
    for (const backend of ["file", "sqlite"] as const) {
      assert.match(
        import.meta.resolve(`@intloom/kernel/storage/${backend}`),
        /\/dist\/storage\//u,
      );
      const options =
        backend === "file"
          ? { directory: join(root, "file") }
          : { filename: join(root, "store.sqlite"), projectId: "project" };
      const handle =
        backend === "file"
          ? await openFileStorage({ directory: join(root, "file") })
          : await openSqliteStorage({
              filename: join(root, "store.sqlite"),
              projectId: "project",
            });
      try {
        await handle.access.commit([
          {
            type: "append_record",
            id: "persisted",
            payload: {
              flowName: "flow",
              stageName: "stage",
              data: [1, true, null, "\u4e2d"],
            },
          },
        ]);
      } finally {
        await handle.dispose();
      }
      const { stdout } = await run(
        process.execPath,
        [
          "--input-type=module",
          "--eval",
          `
        import assert from 'node:assert/strict';
        import { ${backend === "file" ? "openFileStorage" : "openSqliteStorage"} as open } from '@intloom/kernel/storage/${backend}';
        const handle = await open(JSON.parse(process.argv[1]));
        try { assert.deepEqual((await handle.access.getRecordById('persisted')).data, [1,true,null,'\u4e2d']); }
        finally { await handle.dispose(); }
        console.log('REOPENED');
      `,
          JSON.stringify(options),
        ],
        { cwd },
      );
      assert.match(stdout, /REOPENED/);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

for (const initialized of [false, true]) {
  test(`SQLite concurrent process writers preserve every record (${initialized ? "existing database" : "first open with bounded BUSY retries"})`, async () => {
    const root = await mkdtemp(join(tmpdir(), "storage-concurrent-"));
    const filename = join(root, "store.sqlite");
    try {
      if (initialized) {
        const handle = await openSqliteStorage({
          filename,
          projectId: "project",
        });
        await handle.dispose();
      }
      const writers = await Promise.allSettled(
        ["one", "two", "three"].map((id) =>
          run(
            process.execPath,
            [
              fileURLToPath(
                new URL("./fixtures/sqlite-writer.ts", import.meta.url),
              ),
              filename,
              id,
              initialized ? "1" : "5",
            ],
            { cwd },
          ),
        ),
      );
      for (const writer of writers) {
        if (writer.status === "rejected") throw writer.reason;
      }
      const handle = await openSqliteStorage({
        filename,
        projectId: "project",
      });
      try {
        assert.deepEqual(
          (await handle.access.listRecords({})).data
            .map((record) => [record.id, record.data])
            .sort(),
          [
            ["one", "one"],
            ["three", "three"],
            ["two", "two"],
          ],
        );
      } finally {
        await handle.dispose();
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
}

test("file process exit leaves a lock requiring explicit recovery and preserves committed content", async () => {
  const directory = await mkdtemp(join(tmpdir(), "storage-exit-"));
  try {
    await run(
      process.execPath,
      [
        "--input-type=module",
        "--eval",
        `
      import { openFileStorage } from '@intloom/kernel/storage/file';
      const handle = await openFileStorage({directory:process.argv[1]});
      await handle.access.commit([{type:'append_record',id:'record',payload:{flowName:'flow',stageName:'stage',data:'saved'}}]);
      process.exit(0);
    `,
        directory,
      ],
      { cwd },
    );
    assert.ok(
      JSON.parse(await readFile(join(directory, "store.lock"), "utf8")).pid,
    );
    await assert.rejects(openFileStorage({ directory }), { code: "BUSY" });
    // The child has exited; this is the operator's explicit stale-lock recovery.
    await rm(join(directory, "store.lock"));
    const handle = await openFileStorage({ directory });
    try {
      assert.equal(
        (await handle.access.getRecordById("record"))?.data,
        "saved",
      );
    } finally {
      await handle.dispose();
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
