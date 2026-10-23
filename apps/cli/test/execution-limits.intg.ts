import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { startProjectHost } from "@intloom/cli";
import { projectFixture } from "./project-fixture.ts";

test("built Host rejects invalid execution limits and releases startup resources", {
  timeout: 60_000,
}, async (t) => {
  const root = await projectFixture(t, false);
  await mkdir(join(root, "intloom"), { recursive: true });
  const limitsFile = join(root, "intloom/host.json");
  await writeFile(
    limitsFile,
    JSON.stringify({ unsupported: "PRIVATE_SENTINEL" }),
  );
  await assert.rejects(
    startProjectHost({ projectRoot: root }),
    (error: unknown) => {
      assert.ok(error instanceof Error && "code" in error);
      assert.equal(error.code, "CLI_EXECUTION_LIMITS_INVALID");
      assert.match(error.message, /intloom\/host\.json/u);
      assert.doesNotMatch(error.message, /PRIVATE_SENTINEL/u);
      return true;
    },
  );
  await writeFile(limitsFile, JSON.stringify({ run: { maxModelCalls: 3 } }));
  const host = await startProjectHost({ projectRoot: root });
  await host.close();
});
