import assert from "node:assert/strict";
import { test } from "node:test";
import { artifacts, invalidOutput } from "../../test/helpers/artifacts.ts";
import { verifyArtifacts } from "./verify-artifacts.ts";
import { mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import path, { resolve } from "node:path";
import { LoomError } from "@intloom/utils";
import { listOutputFiles } from "./output-files.ts";

test("uses Windows separators when excluding test directories", async (t) => {
  const { root, output, loom } = await artifacts(t);
  const file = resolve(output, "test/helper.d.ts");
  await mkdir(resolve(output, "test"));
  await writeFile(file, "export {};");
  const descriptor = Object.getOwnPropertyDescriptor(path, "sep");
  assert.ok(descriptor);
  const nativeRelative = path.relative;
  const nativeSeparator = path.sep;
  t.mock.method(path, "relative", (from: string, to: string) => {
    const relative = nativeRelative(from, to);
    return from === output
      ? relative.replaceAll(nativeSeparator, "\\")
      : relative;
  });
  Object.defineProperty(path, "sep", { ...descriptor, value: "\\" });
  syncBuiltinESMExports();
  try {
    await assert.rejects(verifyArtifacts(root, output, loom), (error) => {
      invalidOutput(/Tests must not enter output/u)(error);
      assert.ok(LoomError.is(error));
      assert.equal(
        (error.cause as { location: { file: string } }).location.file,
        file,
      );
      return true;
    });
  } finally {
    t.mock.restoreAll();
    Object.defineProperty(path, "sep", descriptor);
    syncBuiltinESMExports();
  }
});

test("accepts a complete output tree without importing or executing modules", async (t) => {
  const { root, output, loom, codeFile } = await artifacts(t);
  await writeFile(
    codeFile,
    'throw new Error("must not execute"); export default function run() {}',
  );
  assert.equal(await verifyArtifacts(root, output, loom), undefined);
  assert.deepEqual(
    (await listOutputFiles(output))
      .map((file) => file.slice(output.length + 1))
      .sort(),
    [
      "codes/run.js",
      "loom.generated.d.ts",
      "loom.generated.js",
      "loom.generated.js.map",
      "package.json",
    ],
  );
});

for (const [label, change, message] of [
  [
    "missing entry",
    (x) => {
      x.exports["."] = {};
    },
    /exports/,
  ],
  [
    "wrong JS entry",
    (x) => {
      x.exports["."].default = "./index.js";
    },
    /exports/,
  ],
  [
    "wrong declaration entry",
    (x) => {
      x.exports["."].types = "./src/index.ts";
    },
    /exports/,
  ],
  [
    "unsupported condition",
    (x) => {
      x.exports["."].require = "./index.cjs";
    },
    /Unsupported package entry/,
  ],
  [
    "inconsistent import condition",
    (x) => {
      x.exports["."].import = "./other.js";
    },
    /Unsupported package entry/,
  ],
  [
    "incomplete files declaration",
    (x) => {
      x.files = ["src"];
    },
    /files must include/,
  ],
] satisfies [
  string,
  (x: Awaited<ReturnType<typeof artifacts>>["manifest"]) => void,
  RegExp,
][]) {
  test(`rejects package metadata with ${label}`, async (t) => {
    const x = await artifacts(t);
    change(x.manifest);
    await writeFile(
      resolve(x.output, "package.json"),
      JSON.stringify(x.manifest),
    );
    await assert.rejects(
      verifyArtifacts(x.root, x.output, x.loom),
      invalidOutput(message),
    );
  });
}

test("accepts an import condition pointing to the same generated entry", async (t) => {
  const x = await artifacts(t);
  x.manifest.exports["."].import = "./loom.generated.js";
  await writeFile(
    resolve(x.output, "package.json"),
    JSON.stringify(x.manifest),
  );
  await verifyArtifacts(x.root, x.output, x.loom);
});

for (const suffix of [".js", ".d.ts", ".js.map"]) {
  test(`rejects a missing entry ${suffix}`, async (t) => {
    const { root, output, loom } = await artifacts(t);
    await rm(resolve(output, `loom.generated${suffix}`));
    await assert.rejects(
      verifyArtifacts(root, output, loom),
      invalidOutput(/Missing entry artifact/),
    );
  });
}

for (const name of ["blueprint", "codes", "agentSpecs"]) {
  test(`rejects a missing ${name} named export`, async (t) => {
    const { root, output, loom } = await artifacts(t);
    const entry = resolve(output, "loom.generated.js");
    await writeFile(
      entry,
      (await readFile(entry, "utf8")).replace(
        `export const ${name}`,
        `const ${name}`,
      ),
    );
    await assert.rejects(
      verifyArtifacts(root, output, loom),
      invalidOutput(new RegExp(`Missing named export: ${name}`)),
    );
  });
}

for (const name of ["check.spec.js", "check.intg.d.ts", "test/helper.js"]) {
  test(`rejects test artifact ${name}`, async (t) => {
    const { root, output, loom } = await artifacts(t);
    await mkdir(resolve(output, "test"), { recursive: true });
    await writeFile(resolve(output, name), "");
    await assert.rejects(
      verifyArtifacts(root, output, loom),
      invalidOutput(/Tests must not enter output/),
    );
  });
}

test("rejects output symlinks", async (t) => {
  const { root, output, loom, codeFile } = await artifacts(t);
  await symlink(codeFile, resolve(output, "linked.js"));
  await assert.rejects(
    verifyArtifacts(root, output, loom),
    invalidOutput(/must not contain symlinks/),
  );
});
