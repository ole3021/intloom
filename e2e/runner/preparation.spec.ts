import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { loadCase } from "./cases.ts";
import { Evidence } from "./evidence.ts";
import { Session } from "./session.ts";
import { parseDocument } from "yaml";
import { noopObserve } from "@mastra/core/tools";

async function setup(
  t: TestContext,
  prepare: (session: Session) => Promise<void>,
) {
  const root = await mkdtemp(join(tmpdir(), "e2e-preparation-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const caseDirectory = join(root, "Alpha");
  const project = join(root, "project");
  await mkdir(caseDirectory);
  await mkdir(project);
  await writeFile(join(caseDirectory, "case.yaml"), "intents: [Local scope]\n");
  await writeFile(join(caseDirectory, "knowledge.md"), "Authorized scope.");
  await writeFile(join(project, "intloom.yaml"), "workflows: []\n");
  const evidence = new Evidence(join(root, "evidence"));
  await evidence.prepare();
  const session = new Session(
    {
      entry: "cmd",
      root,
      suite: root,
      casesRoot: root,
      cli: "/unused",
      workflow: "/unused",
      seed: "test",
    },
    { storage: "file", limits: {}, mcpExecutor: "mcp_client" },
    await loadCase(caseDirectory),
    project,
    evidence,
    new AbortController().signal,
    {},
    prepare,
  );
  session.initialized = true;
  return session;
}

test("Workflow preparation waits for both file setup helpers and runs once in either order", async (t) => {
  for (const first of ["configure", "seed"] as const) {
    let calls = 0;
    const session = await setup(t, async (session) => {
      assert.equal(session.configured, true);
      assert.equal(session.seeded, true);
      assert.equal(session.activeRunId, undefined);
      calls++;
    });
    await session[first]();
    assert.equal(calls, 0);
    await session[first === "configure" ? "seed" : "configure"]();
    assert.equal(calls, 1);
    assert.equal(session.preparationStatus, "passed");
    await assert.rejects(session.configure(), { code: "SETUP_ORDER_INVALID" });
    assert.equal(calls, 1);
  }
});

test("failed preparation aborts execution without a Run or automatic replay", async (t) => {
  let calls = 0;
  const session = await setup(t, async () => {
    calls++;
    throw new Error("Fixture copy failed.");
  });
  await session.seed();
  await assert.rejects(session.configure(), { code: "PREPARATION_FAILED" });
  assert.equal(session.preparationStatus, "failed");
  assert.equal(session.signal.aborted, true);
  assert.equal(session.executionFailure?.code, "PREPARATION_FAILED");
  assert.equal(session.runs.size, 0);
  assert.equal(calls, 1);
});

test("shared model option objects never emit aliases into the alias-free project config", async (t) => {
  const session = await setup(t, async () => {});
  const model = {
    provider: "openai-compatible" as const,
    model: "fixture",
    secret: "ENV.FIXTURE_KEY",
    providerOptions: { openai: { reasoningEffort: "low" } },
  };
  session.profile.service = { default: model, reasoning: model };
  await session.configure();
  const config = parseDocument(
    await readFile(join(session.project, "intloom.yaml"), "utf8"),
  ).toJS({ maxAliasCount: 0 });
  assert.deepEqual(config.llms.default.providerOptions, model.providerOptions);
  assert.deepEqual(
    config.llms.reasoning.providerOptions,
    model.providerOptions,
  );
});

test("a rejected startup command stops before another setup attempt", async (t) => {
  const session = await setup(t, async () => {});
  await session.seed();
  await session.configure();
  let starts = 0;
  session.cli = async () => {
    starts++;
    return {
      code: 1,
      stdout: "",
      stderr: "",
      data: {
        error: {
          code: "INVALID_REQUEST",
          message: "Invalid generated configuration.",
        },
      },
    };
  };
  const tool = session.userTools().intloom_command;
  assert.ok(tool?.execute);
  await assert.rejects(
    tool.execute({ args: ["start"] }, { observe: noopObserve }),
    {
      code: "INVALID_REQUEST",
    },
  );
  await assert.rejects(
    tool.execute({ args: ["start"] }, { observe: noopObserve }),
    {
      code: "INVALID_REQUEST",
    },
  );
  assert.equal(starts, 1);
  assert.equal(session.signal.aborted, true);
});
