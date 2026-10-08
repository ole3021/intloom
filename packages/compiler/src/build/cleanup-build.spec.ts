import assert from "node:assert/strict";
import fs, {
  access,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  writeFile,
} from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { test, type TestContext } from "node:test";
import { LoomError } from "@intloom/utils";
import { cleanupBuild } from "./cleanup-build.ts";

async function workspace(t: TestContext) {
  const root = await realpath(
    await mkdtemp(resolve(tmpdir(), "compiler-cleanup-")),
  );
  const entry = resolve(root, "workflow.generated.ts");
  const temporary = resolve(root, ".intloom-build-test");
  await writeFile(entry, "generated entry");
  await mkdir(temporary);
  await writeFile(resolve(temporary, "previous-dist.txt"), "previous output");
  const remove = fs.rm;
  t.after(async () => {
    t.mock.restoreAll();
    syncBuiltinESMExports();
    await remove(root, { recursive: true, force: true });
  });
  return { entry, temporary, remove };
}

test("cleans temporary output before releasing the generated entry", async (t) => {
  const { entry, temporary, remove } = await workspace(t);
  const attempted: unknown[] = [];
  t.mock.method(
    fs,
    "rm",
    async (...[file, options]: Parameters<typeof fs.rm>) => {
      attempted.push(file);
      await remove(file, options);
    },
  );
  syncBuiltinESMExports();
  await cleanupBuild({ entry, temporary, preserveRecovery: false });
  assert.deepEqual(attempted, [temporary, entry]);
  await assert.rejects(access(entry), { code: "ENOENT" });
  await assert.rejects(access(temporary), { code: "ENOENT" });
});

for (const failedPaths of ["temporary", "entry", "both"] as const) {
  for (const buildFailed of [false, true]) {
    test(`retains ${failedPaths} cleanup failures with build failure=${buildFailed}`, async (t) => {
      const { entry, temporary, remove } = await workspace(t);
      const location = { file: "stage.yaml", line: 3, column: 5 };
      const original = new LoomError(
        "INVALID_OUTPUT",
        "Original build failure",
        {
          retryable: true,
          cause: { location, cause: new Error("Original cause") },
        },
      );
      const temporaryError = new Error("Temporary cleanup failed");
      const entryError = new Error("Entry cleanup failed");
      const attempted: unknown[] = [];
      const cleanupErrors: Error[] = [];
      if (failedPaths !== "entry") cleanupErrors.push(temporaryError);
      if (failedPaths !== "temporary") cleanupErrors.push(entryError);
      t.mock.method(
        fs,
        "rm",
        async (...[file, options]: Parameters<typeof fs.rm>) => {
          attempted.push(file);
          if (file === temporary && failedPaths !== "entry")
            throw temporaryError;
          if (file === entry && failedPaths !== "temporary") throw entryError;
          await remove(file, options);
        },
      );
      syncBuiltinESMExports();
      await assert.rejects(
        cleanupBuild({
          entry,
          temporary,
          preserveRecovery: false,
          failure: buildFailed ? { cause: original } : undefined,
        }),
        (error) => {
          assert.ok(LoomError.is(error));
          assert.equal(
            error.code,
            buildFailed ? original.code : "BUILD_FAILED",
          );
          assert.equal(error.retryable, buildFailed);
          if (buildFailed) {
            assert.equal(error.message, original.message);
            assert.notEqual(error, original);
          } else {
            assert.match(error.message, /output was updated/u);
          }
          const detail = error.cause as {
            location?: unknown;
            cause: AggregateError;
          };
          assert.equal(detail.location, buildFailed ? location : undefined);
          assert.ok(detail.cause instanceof AggregateError);
          assert.deepEqual(
            detail.cause.errors,
            buildFailed ? [original, ...cleanupErrors] : cleanupErrors,
          );
          return true;
        },
      );
      assert.deepEqual(attempted, [temporary, entry]);
      if (failedPaths === "temporary")
        await assert.rejects(access(entry), { code: "ENOENT" });
      if (failedPaths === "entry")
        await assert.rejects(access(temporary), { code: "ENOENT" });
    });
  }
}

test("preserves a recovery backup even when entry cleanup fails", async (t) => {
  const { entry, temporary } = await workspace(t);
  const original = new LoomError(
    "BUILD_FAILED",
    `Previous output is preserved at ${temporary}`,
  );
  const entryError = new Error("Entry cleanup failed");
  const attempted: unknown[] = [];
  t.mock.method(fs, "rm", async (...[file]: Parameters<typeof fs.rm>) => {
    attempted.push(file);
    throw entryError;
  });
  syncBuiltinESMExports();
  await assert.rejects(
    cleanupBuild({
      entry,
      temporary,
      preserveRecovery: true,
      failure: { cause: original },
    }),
    (error) => {
      assert.ok(LoomError.is(error));
      assert.equal(error.message, original.message);
      assert.deepEqual(
        (error.cause as { cause: AggregateError }).cause.errors,
        [original, entryError],
      );
      return true;
    },
  );
  assert.deepEqual(attempted, [entry]);
  assert.equal(
    await readFile(resolve(temporary, "previous-dist.txt"), "utf8"),
    "previous output",
  );
});

test("retains an unclassified build failure together with cleanup errors", async (t) => {
  const { entry } = await workspace(t);
  const original = new Error("Unclassified build failure");
  const cleanupError = new Error("Entry cleanup failed");
  t.mock.method(fs, "rm", async () => {
    throw cleanupError;
  });
  syncBuiltinESMExports();
  await assert.rejects(
    cleanupBuild({
      entry,
      preserveRecovery: false,
      failure: { cause: original },
    }),
    (error) => {
      assert.ok(LoomError.is(error));
      assert.equal(error.code, "BUILD_FAILED");
      assert.deepEqual(
        (error.cause as { cause: AggregateError }).cause.errors,
        [original, cleanupError],
      );
      return true;
    },
  );
});

for (const original of [
  new Error("Original error"),
  new LoomError("INVALID_OUTPUT", "Original error"),
  undefined,
]) {
  test(`successful cleanup rethrows the original ${original?.name ?? "undefined"} unchanged`, async (t) => {
    const { entry, temporary } = await workspace(t);
    let caught = false;
    try {
      await cleanupBuild({
        entry,
        temporary,
        preserveRecovery: false,
        failure: { cause: original },
      });
    } catch (error) {
      caught = true;
      assert.equal(error, original);
    }
    assert.equal(caught, true);
    await assert.rejects(access(entry), { code: "ENOENT" });
    await assert.rejects(access(temporary), { code: "ENOENT" });
  });
}
