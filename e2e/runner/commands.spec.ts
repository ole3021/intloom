import assert from "node:assert/strict";
import { test } from "node:test";
import { validateCommand, caseIntent } from "./commands.ts";
import { resolveProfile } from "./profile.ts";
import { parseOptions } from "./options.ts";

test("case intent tolerates only boundary whitespace and forwards the exact original text", () => {
  const original = "  Complete the task.\nKeep the workspace.\n";
  assert.equal(
    caseIntent("Complete the task.\nKeep the workspace.", original),
    original,
  );
  for (const changed of [
    "Complete the task.",
    "Complete the task. Keep the workspace.",
    "Complete the  task.\nKeep the workspace.",
    null,
  ])
    assert.throws(() => caseIntent(changed, original), {
      code: "INTENT_CHANGED",
    });
});

test("commands cannot retarget, overwrite, restore, resume or bypass the selected entry", () => {
  for (const args of [
    ["status", "--project=/other"],
    ["mirror", "restore", "id"],
    ["run", "resume", "id"],
    ["artifact", "id", "--output", "/other"],
    ["workflow", "add", "/other.tgz"],
    ["init", "/other"],
    ["flow", "intent", "--intent", "changed"],
  ])
    assert.throws(() =>
      validateCommand(args, "cmd", "/pinned.tgz", "original"),
    );
  assert.throws(() =>
    validateCommand(
      ["flow", "intent", "--intent", "original"],
      "mcp",
      "/pinned.tgz",
      "original",
      "intent",
    ),
  );
  assert.doesNotThrow(() =>
    validateCommand(
      ["flow", "intent", "--intent", "original"],
      "cmd",
      "/pinned.tgz",
      "original",
      "intent",
    ),
  );
});

test("profiles validate only the executor actually used, and reject encrypted credentials", () => {
  const model = {
    provider: "openai-compatible",
    model: "ENV.TEST_MODEL",
    secret: "ENV.TEST_KEY",
  };
  const environment = { TEST_MODEL: "model", TEST_KEY: "fixture-key" };
  const profile = resolveProfile({ user: model }, "mcp", environment);
  assert.equal(profile.clientAgent?.model, "model");
  assert.equal(profile.service, undefined);
  assert.throws(() => resolveProfile({ user: model }, "cmd", environment), {
    code: "PROFILE_INVALID",
  });
  assert.throws(
    () =>
      resolveProfile({ user: model }, "mcp", {
        ...environment,
        TEST_KEY: "encrypted:value",
      }),
    { code: "MODEL_CREDENTIAL_MISSING" },
  );
});

test("root is explicit and help does not prepare candidates", async () => {
  assert.equal(await parseOptions(["cmd", "--help"]), null);
  await assert.rejects(parseOptions(["cmd"]), { code: "ROOT_REQUIRED" });
  for (const entry of ["cli", "tui"])
    await assert.rejects(parseOptions([entry, "--help"]));
  for (const entry of ["cmd", "mcp"]) {
    const local = await parseOptions([entry, "--root", "/tmp/e2e"]);
    assert.equal(local?.workspaceWorkflow, true);
    assert.match(local?.suite ?? "", /packages\/intent\/e2e$/u);
    const archive = await parseOptions([
      entry,
      "--root",
      "/tmp/e2e",
      "--workflow",
      "/explicit.tgz",
    ]);
    assert.equal(archive?.workspaceWorkflow, undefined);
    assert.equal(archive?.workflow, "/explicit.tgz");
  }
  const published = await parseOptions([
    "mcp",
    "--root",
    "/tmp/e2e",
    "--suite",
    "/third-party/e2e",
    "--workflow",
    "@example/workflow@1.2.3",
  ]);
  assert.equal(published?.workflow, "@example/workflow@1.2.3");
  assert.equal(published?.casesRoot, "/third-party/e2e/cases");
});
