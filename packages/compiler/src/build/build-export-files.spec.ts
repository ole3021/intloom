import assert from "node:assert/strict";
import fs, {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { basename, resolve } from "node:path";
import { test } from "node:test";
import { LoomError } from "@intloom/utils";
import type { LinkedLoom } from "../analyze/model.ts";
import { buildExportFiles } from "./build-export-files.ts";

for (const scenario of [
  "outside config",
  "missing config",
  "non-directory dist",
] as const) {
  test(`rejects ${scenario} before compilation and preserves existing files`, async (t) => {
    const root = await realpath(
      await mkdtemp(resolve(tmpdir(), "compiler-preflight-")),
    );
    t.after(() => rm(root, { recursive: true, force: true }));
    const destination = resolve(root, "dist");
    if (scenario === "non-directory dist")
      await writeFile(destination, "author file");
    else {
      await mkdir(destination);
      await writeFile(resolve(destination, "previous.txt"), "previous output");
    }
    if (scenario !== "missing config")
      await writeFile(resolve(root, "tsconfig.build.json"), "{}");
    const loom: LinkedLoom = {
      model: {
        manifest: {
          name: "example",
          version: "1.0.0",
          type: "module",
          loom: {
            type: "loom",
            version: "2026-10-15",
            name: "example",
            inputs: [],
            entry: "main",
            stages: {},
          },
        },
        inputs: [],
        options: {
          packageRoot: root,
          ...(scenario === "outside config"
            ? { tsconfigFile: "../outside.json" }
            : {}),
        },
        loomName: "example",
        version: "1.0.0",
        entryStageName: "main",
        stages: {},
        codes: {},
        agents: {},
        assets: [],
      },
      codeIds: {},
      agentIds: {},
      diagnostics: [],
    };
    const before = (await readdir(root)).sort();
    await assert.rejects(buildExportFiles(loom), (error) => {
      assert.ok(LoomError.is(error));
      assert.equal(error.code, "INVALID_BUILD_CONFIG");
      assert.equal(
        (error.cause as { location: { file: string } }).location.file,
        scenario === "outside config"
          ? resolve(root, "../outside.json")
          : scenario === "missing config"
            ? resolve(root, "tsconfig.build.json")
            : destination,
      );
      return true;
    });
    assert.deepEqual((await readdir(root)).sort(), before);
    if (scenario === "non-directory dist")
      assert.equal(await readFile(destination, "utf8"), "author file");
    else
      assert.equal(
        await readFile(resolve(destination, "previous.txt"), "utf8"),
        "previous output",
      );
  });
}

test("preserves build diagnostics and attempts all cleanup after configuration generation fails", async (t) => {
  const root = await realpath(
    await mkdtemp(resolve(tmpdir(), "compiler-cleanup-build-")),
  );
  const write = fs.writeFile;
  const remove = fs.rm;
  t.after(async () => {
    t.mock.restoreAll();
    syncBuiltinESMExports();
    await remove(root, { recursive: true, force: true });
  });
  await write(resolve(root, "tsconfig.build.json"), "{}");
  await mkdir(resolve(root, "dist"));
  await write(resolve(root, "dist/previous.txt"), "previous output");
  let entry = "";
  const original = new LoomError(
    "INVALID_BUILD_CONFIG",
    "Configuration generation failed",
    {
      cause: { location: { file: resolve(root, "tsconfig.build.json") } },
    },
  );
  const cleanupError = new Error("Entry cleanup failed");
  const attempted: string[] = [];
  t.mock.method(
    fs,
    "writeFile",
    async (...args: Parameters<typeof fs.writeFile>) => {
      const [file] = args;
      if (String(file).endsWith("tsconfig.json")) throw original;
      return write(...args);
    },
  );
  t.mock.method(
    fs,
    "rm",
    async (...[file, options]: Parameters<typeof fs.rm>) => {
      attempted.push(String(file));
      if (basename(String(file)) === "loom.generated.ts") {
        entry = String(file);
        throw cleanupError;
      }
      return remove(file, options);
    },
  );
  syncBuiltinESMExports();
  const loom: LinkedLoom = {
    model: {
      manifest: {
        name: "example",
        version: "1.0.0",
        type: "module",
        loom: {
          type: "loom",
          version: "2026-10-15",
          name: "example",
          inputs: [],
          entry: "main",
          stages: {},
        },
      },
      inputs: [],
      options: { packageRoot: root },
      loomName: "example",
      version: "1.0.0",
      entryStageName: "main",
      stages: {},
      codes: {},
      agents: {},
      assets: [],
    },
    codeIds: {},
    agentIds: {},
    diagnostics: [],
  };
  await assert.rejects(buildExportFiles(loom), (error) => {
    assert.ok(LoomError.is(error));
    assert.equal(error.code, original.code);
    assert.equal(error.message, original.message);
    const detail = error.cause as { location: unknown; cause: AggregateError };
    assert.deepEqual(
      detail.location,
      (original.cause as { location: unknown }).location,
    );
    assert.deepEqual(detail.cause.errors, [original, cleanupError]);
    return true;
  });
  assert.equal(attempted.length, 2);
  assert.ok(attempted[0]);
  assert.match(attempted[0], /\.intloom-build-/u);
  assert.equal(attempted[1], entry);
  assert.equal(
    await readFile(resolve(root, "dist/previous.txt"), "utf8"),
    "previous output",
  );
  assert.equal(
    (await readdir(root)).some((name) => name.startsWith(".intloom-build-")),
    false,
  );
});
