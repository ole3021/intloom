import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { testConfig } from "../../../test/agent-fixture.ts";
import { resolveModelConfig } from "./agent-model.ts";
import { createCredentialResolver } from "./credentials.ts";

async function directory(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), "intloom-credentials-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test("ENV falls back to the selected project's plain dotenv without mutating process.env", async (t) => {
  const root = await directory(t);
  const key = "INTLOOM_DOTENV_ONLY_TEST_KEY";
  const previous = process.env[key];
  await writeFile(join(root, ".env"), `export ${key}='file credential'\n`);
  const credentials = createCredentialResolver(root, {});
  assert.equal(credentials(`ENV.${key}`), "file credential");
  assert.equal(process.env[key], previous);
  assert.equal(credentials(`DENV.${key}`), undefined);
});

test("defined startup credentials win, including invalid empty or encrypted values", async (t) => {
  const root = await directory(t);
  // A file that cannot be read proves successful environment lookups never inspect it.
  await mkdir(join(root, ".env"));
  const config = testConfig();
  const key = config.llms.default.secret.slice(4);
  for (const value of ["startup credential", "", "  ", "encrypted:private"]) {
    const credentials = createCredentialResolver(root, { [key]: value });
    assert.equal(credentials(config.llms.default.secret), value);
    if (value === "startup credential")
      assert.equal(
        resolveModelConfig("thinking", config, "test", credentials).apiKey,
        value,
      );
    else
      assert.throws(
        () => resolveModelConfig("thinking", config, "test", credentials),
        {
          code: "INVALID_REQUEST",
          message: /Missing decrypted credential/u,
        },
      );
  }
});

test("file credentials stay isolated and keep a snapshot until the project is reopened", async (t) => {
  const a = await directory(t),
    b = await directory(t);
  await writeFile(join(a, ".env"), "KEY=first\n");
  await writeFile(join(b, ".env"), "KEY=second\n");
  const first = createCredentialResolver(a, {});
  assert.equal(first("ENV.KEY"), "first");
  assert.equal(createCredentialResolver(b, {})("ENV.KEY"), "second");
  await writeFile(join(a, ".env"), "KEY=updated\n");
  assert.equal(first("ENV.KEY"), "first");
  assert.equal(createCredentialResolver(a, {})("ENV.KEY"), "updated");
});

test("only the root .env is read, with no ancestor, variant or symlink fallback", async (t) => {
  const root = await directory(t);
  const child = join(root, "child");
  await mkdir(child);
  await writeFile(join(root, ".env"), "KEY=parent-secret\n");
  await writeFile(join(child, ".env.local"), "KEY=local-secret\n");
  assert.equal(createCredentialResolver(child, {})("ENV.KEY"), undefined);
  await symlink(join(root, ".env"), join(child, ".env"));
  assert.throws(() => createCredentialResolver(child, {})("ENV.KEY"), {
    code: "INVALID_REQUEST",
    message: "Cannot read the project's .env as a regular dotenv file.",
  });
  assert.equal(
    createCredentialResolver(child, { KEY: "startup" })("ENV.KEY"),
    "startup",
  );
});
