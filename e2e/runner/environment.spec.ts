import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { readConfiguration, configurationProfile } from "./configuration.ts";
import { repositoryRoot } from "./options.ts";
import { loadEnvironment } from "./environment.ts";
import { executionLimits, modelSecrets, resolveProfile } from "./profile.ts";

test("E2E reads only the checkout .env and preserves defined environment precedence", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "intloom-e2e-env-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const checkout = join(root, "intloom");
  await mkdir(checkout);
  await writeFile(join(root, ".env"), "ZEN_API_KEY=parent-secret\n");
  await writeFile(join(checkout, ".env.local"), "ZEN_API_KEY=variant-secret\n");
  assert.equal(loadEnvironment({}, checkout).ZEN_API_KEY, undefined);
  await writeFile(
    join(checkout, ".env"),
    'export ZEN_API_KEY="file-secret"\nMODEL=fixture-model\n',
  );
  const before = process.env.ZEN_API_KEY;
  const environment = loadEnvironment({ ZEN_API_KEY: undefined }, checkout);
  assert.equal(environment.ZEN_API_KEY, "file-secret");
  assert.equal(process.env.ZEN_API_KEY, before);
  assert.equal(
    loadEnvironment({ ZEN_API_KEY: "startup" }, checkout).ZEN_API_KEY,
    "startup",
  );
  const model = {
    provider: "openai-compatible",
    model: "ENV.MODEL",
    secret: "ENV.ZEN_API_KEY",
  };
  const profile = resolveProfile({ user: model }, "mcp", environment);
  assert.equal(profile.user.model, "fixture-model");
  assert.deepEqual(modelSecrets(profile, environment), ["file-secret"]);
  assert.throws(
    () =>
      resolveProfile(
        { user: model },
        "mcp",
        loadEnvironment({ ZEN_API_KEY: "" }, checkout),
      ),
    { code: "MODEL_CREDENTIAL_MISSING" },
  );
});

test("Intent configuration supplies its own CMD roles and separate MCP worker", async () => {
  const input = await readConfiguration(
    join(repositoryRoot, "packages/intent/e2e"),
  );
  const environment = { ZEN_API_KEY: "fixture-only" };
  const cmd = configurationProfile(input, "cmd", environment);
  assert.deepEqual(
    Object.keys(cmd.service ?? {}).sort(),
    Object.keys(input.models.cmd ?? {}).sort(),
  );
  const mcp = configurationProfile(input, "mcp", environment);
  const worker = input.models.mcp?.worker;
  assert.equal(
    mcp.clientAgent?.model,
    typeof worker === "string" ? worker : worker?.model,
  );
  for (const model of [
    cmd.user,
    ...Object.values(cmd.service ?? {}),
    mcp.clientAgent,
  ]) {
    assert.equal(model?.baseURL, "https://opencode.ai/inference/v1");
    assert.equal(model?.secret, "ENV.ZEN_API_KEY");
  }
});

test("execution limits have no scale-derived duration or step budget and preserve explicit settings", () => {
  const model = {
    provider: "openai-compatible",
    model: "fixture",
    secret: "ENV.KEY",
  };
  const defaults = resolveProfile({ user: model }, "mcp", { KEY: "fixture" });
  assert.equal(executionLimits(defaults).maxDurationMs, undefined);
  assert.equal(executionLimits(defaults).maxUserSteps, undefined);
  assert.equal(executionLimits(defaults).modelConnectionRetries, 0);
  const profile = resolveProfile(
    {
      user: model,
      limits: {
        maxDurationMs: 1000,
        modelConnectionTimeoutMs: 500,
        modelIdleTimeoutMs: 1000,
        modelConnectionRetries: 0,
      },
    },
    "mcp",
    { KEY: "fixture" },
  );
  assert.equal(executionLimits(profile).maxDurationMs, 1000);
  assert.equal(executionLimits(profile).modelConnectionTimeoutMs, 500);
  assert.equal(executionLimits(profile).modelIdleTimeoutMs, 1000);
  assert.equal(executionLimits(profile).modelConnectionRetries, 0);
  assert.throws(() =>
    resolveProfile(
      { user: model, limits: { modelConnectionRetries: 3 } },
      "mcp",
      { KEY: "fixture" },
    ),
  );
});
