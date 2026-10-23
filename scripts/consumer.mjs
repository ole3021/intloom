import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { compileLoom } from "@intloom/compiler";
import { loomProtocolVersion } from "@intloom/loom-sdk";
import { blueprint } from "@intloom/intent";

assert.equal(typeof compileLoom, "function");
assert.equal(
  loomProtocolVersion,
  createRequire(import.meta.url)("@intloom/intent/package.json").loom.version,
);
assert.equal(blueprint.loomName, "intent");
await assert.rejects(import("@intloom/kernel"), {
  code: "ERR_MODULE_NOT_FOUND",
});
const require = createRequire(import.meta.resolve("@intloom/cli"));
for (const [specifier, options] of [
  ["file", { directory: resolve("consumer-file-store") }],
  [
    "sqlite",
    { filename: resolve("consumer-store.sqlite"), projectId: "consumer" },
  ],
]) {
  const storage = await import(
    pathToFileURL(require.resolve(`@intloom/kernel/storage/${specifier}`)).href
  );
  const handle = await (specifier === "file"
    ? storage.openFileStorage(options)
    : storage.openSqliteStorage(options));
  try {
    await handle.access.commit([
      {
        type: "append_record",
        id: "consumer",
        payload: {
          loomName: "intent",
          stageName: "specification",
          data: "verified",
        },
      },
    ]);
    assert.equal(
      (await handle.access.getRecordById("consumer")).data,
      "verified",
    );
  } finally {
    await handle.dispose();
  }
}
