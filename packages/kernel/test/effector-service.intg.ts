import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { defineAgentTool } from "@intloom/workflow-sdk";
import { Agent } from "@mastra/core/agent";
import { noopLogger } from "@mastra/core/logger";
import * as z from "zod";
import { agentSpec, credential, testConfig } from "./agent-fixture.ts";
import { agentId, source } from "./workflow-fixture.ts";
import { createAgent } from "../src/effector/service/create-agent.ts";

test("assembles an actual Agent, inline Skill, Tools and model defaults without calling them", async (t) => {
  credential(t);
  const setLogger = Agent.prototype.__setLogger;
  let safeLoggerConfigured = false;
  t.mock.method(
    Agent.prototype,
    "__setLogger",
    function (this: Agent, logger: Parameters<typeof setLogger>[0]) {
      safeLoggerConfigured ||= logger === noopLogger;
      return setLogger.call(this, logger);
    },
  );
  const fetch = t.mock.method(globalThis, "fetch", async () => {
    throw new Error("Agent initialization must not call the model");
  });
  let called = false;
  const tool = defineAgentTool({
    id: "read_changes",
    description: "Reads changes",
    inputSchema: z.json(),
    outputSchema: z.json(),
    execute: async () => {
      called = true;
      return {};
    },
  });
  const config = testConfig();
  config.llms.default.parameters = {
    temperature: 0.2,
    maxOutputTokens: 800,
    topP: 0.8,
  };
  config.llms.default.providerOptions = { openai: { reasoningEffort: "low" } };
  const spec = {
    ...agentSpec(),
    tools: [tool],
    skills: [
      {
        name: "review",
        description: "Review changes",
        content: "Inspect references.",
        assets: [],
      },
    ],
  };
  const result = await createAgent(spec, { agentId, source, config });
  assert.equal(result.agentId, agentId);
  assert.equal(safeLoggerConfigured, true);
  assert.equal(result.executable.outputSchema, spec.outputSchema);
  assert.equal(
    await result.executable.agent.getInstructions(),
    spec.instructions,
  );
  const model = await result.executable.agent.getModel();
  assert.equal(model.modelId, "test-model");
  assert.ok(Object.hasOwn(await result.executable.agent.listTools(), tool.id));
  assert.equal(
    (await result.executable.agent.getSkill("review"))?.instructions,
    "Inspect references.",
  );
  const defaults = await result.executable.agent.getDefaultOptions();
  assert.deepEqual(defaults.modelSettings, config.llms.default.parameters);
  assert.deepEqual(
    defaults.providerOptions,
    config.llms.default.providerOptions,
  );
  assert.equal(called, false);
  assert.equal(fetch.mock.calls.length, 0);
});

test("selects the role's native Anthropic model and retains its custom address", async (t) => {
  credential(t);
  const requests: { url: string; headers: Headers }[] = [];
  t.mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request, init?: RequestInit) => {
      requests.push({
        url: String(input),
        headers: new Headers(init?.headers),
      });
      return Response.json({
        id: "fixture-message",
        type: "message",
        role: "assistant",
        model: "test-anthropic",
        content: [{ type: "text", text: "Reviewed" }],
        stop_reason: "end_turn",
        usage: { input_tokens: 1, output_tokens: 1 },
      });
    },
  );
  const config = testConfig();
  config.llms.reasoning = {
    provider: "anthropic",
    model: "test-anthropic",
    secret: "DENV.INTLOOM_WORKFLOW_TEST_KEY",
    baseURL: "https://anthropic.invalid/v1",
  };
  const { executable } = await createAgent(agentSpec(), {
    agentId,
    source,
    config,
  });
  const model = await executable.agent.getModel();
  assert.equal(model.modelId, "test-anthropic");
  assert.match(model.provider, /^anthropic/);
  assert.ok(model.specificationVersion === "v3");
  assert.equal(requests.length, 0);
  // Mock SDK requests to verify the URL and native protocol without network calls.
  await model.doGenerate({
    prompt: [{ role: "user", content: [{ type: "text", text: "Review" }] }],
  });
  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.url, "https://anthropic.invalid/v1/messages");
  assert.equal(requests[0]?.headers.get("x-api-key"), "fixture-credential");
});

test("loads a packaged Skill directory with its relative references", async (t) => {
  credential(t);
  const root = await mkdtemp(resolve(tmpdir(), "agent-skills-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(resolve(root, "skills/review/references"), { recursive: true });
  await writeFile(
    resolve(root, "skills/review/SKILL.md"),
    "---\nname: review\ndescription: Review changes\n---\nInspect changes.\n",
  );
  await writeFile(
    resolve(root, "skills/review/references/checklist.md"),
    "Check IDs.",
  );
  const spec = {
    ...agentSpec(),
    skills: [
      {
        name: "review",
        description: "Review changes",
        content: "Inspect changes.",
        assets: [
          "skills/review/SKILL.md",
          "skills/review/references/checklist.md",
        ],
      },
    ],
  };
  const result = await createAgent(spec, {
    agentId,
    source: { ...source, assetRoot: root },
    config: testConfig(),
  });
  const skill = await result.executable.agent.getSkill("review");
  assert.match(skill?.instructions ?? "", /Inspect changes/);
  assert.ok(skill?.references.includes("checklist.md"));
  await writeFile(
    resolve(root, "skills/review/SKILL.md"),
    "---\nname: different\ndescription: Review changes\n---\nInspect changes.\n",
  );
  await assert.rejects(
    createAgent(spec, {
      agentId,
      source: { ...source, assetRoot: root },
      config: testConfig(),
    }),
    /Incomplete Skill assembly/,
  );
});

test("rejects unknown roles, missing credentials and encrypted values", async (t) => {
  credential(t);
  await assert.rejects(
    createAgent(
      { ...agentSpec(), llm: "reasonig" },
      { agentId, source, config: testConfig() },
    ),
    /Unknown model role/,
  );
  for (const value of [undefined, "", "encrypted:fixture"]) {
    if (value === undefined) delete process.env.INTLOOM_WORKFLOW_TEST_KEY;
    else process.env.INTLOOM_WORKFLOW_TEST_KEY = value;
    await assert.rejects(
      createAgent(agentSpec(), { agentId, source, config: testConfig() }),
      /Missing decrypted credential/,
    );
  }
});

test("rejects duplicate Tools, duplicate Skills and invalid provider options", async (t) => {
  credential(t);
  const tool = defineAgentTool({
    id: "read",
    description: "Reads",
    inputSchema: z.json(),
    outputSchema: z.json(),
    execute: async () => ({}),
  });
  await assert.rejects(
    createAgent(
      { ...agentSpec(), tools: [tool, tool] },
      { agentId, source, config: testConfig() },
    ),
    /Duplicate Tool ID/,
  );
  const skill = {
    name: "review",
    description: "Review",
    content: "Review",
    assets: [],
  };
  await assert.rejects(
    createAgent(
      { ...agentSpec(), skills: [skill, skill] },
      { agentId, source, config: testConfig() },
    ),
    /Duplicate Skill name/,
  );
  const config = testConfig();
  config.llms.default.providerOptions = { openai: "invalid" };
  await assert.rejects(
    createAgent(agentSpec(), { agentId, source, config }),
    /Invalid provider options/,
  );
});

test("actual SDK gate and Tool failures never print raw errors through internal stream Workflows", () => {
  const createAgentUrl = pathToFileURL(
    resolve(import.meta.dirname, "../src/effector/service/create-agent.ts"),
  ).href;
  const accessUrl = pathToFileURL(
    resolve(import.meta.dirname, "effector-fixture.ts"),
  ).href;
  const agentFixtureUrl = pathToFileURL(
    resolve(import.meta.dirname, "agent-fixture.ts"),
  ).href;
  const workflowFixtureUrl = pathToFileURL(
    resolve(import.meta.dirname, "workflow-fixture.ts"),
  ).href;
  const script = String.raw`
    import assert from "node:assert/strict";
    import * as z from "zod";
    import { defineAgentTool } from "@intloom/workflow-sdk";
    import { LoomError, silentLogger, withLogger } from "@intloom/utils";
    import { createAgent } from ${JSON.stringify(createAgentUrl)};
    import { executionAccess } from ${JSON.stringify(accessUrl)};
    import { agentSpec, testConfig } from ${JSON.stringify(agentFixtureUrl)};
    import { agentId, source } from ${JSON.stringify(workflowFixtureUrl)};
    const mode = process.argv[1];
    const sentinel = "PRIVATE_SDK_CAUSE_SENTINEL";
    let requests = 0;
    globalThis.fetch = async () => {
      requests++;
      const events = [
        { id: "fixture", object: "chat.completion.chunk", created: 1, model: "test-model", choices: [{ index: 0, delta: { role: "assistant", tool_calls: [{ index: 0, id: "call-1", type: "function", function: { name: "explode", arguments: "{}" } }] }, finish_reason: null }] },
        { id: "fixture", object: "chat.completion.chunk", created: 1, model: "test-model", choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }] },
      ];
      return new Response(events.map((event) => "data: " + JSON.stringify(event) + "\n\n").join("") + "data: [DONE]\n\n", { headers: { "content-type": "text/event-stream" } });
    };
    const tool = defineAgentTool({
      id: "explode", description: "controlled failure", inputSchema: z.strictObject({}), outputSchema: z.json(),
      execute: async () => { throw new Error(sentinel, { cause: new Error(sentinel) }); },
    });
    const { executable } = await createAgent({ ...agentSpec(), tools: mode === "tool" ? [tool] : [] }, { agentId, source, config: testConfig() });
    assert.equal(requests, 0);
    const rows = [];
    const logger = { ...silentLogger, debug(event, fields = {}) { rows.push({ event, fields }); } };
    let failed = false;
    let code;
    try {
      await withLogger(logger, () => executable.execute(null, executionAccess().agent, 2, {
        beforeStep() { if (mode === "gate") throw new LoomError("RUN_STOPPED", sentinel, { cause: new Error(sentinel) }); },
        afterStep() {},
      }));
    } catch (error) {
      failed = true;
      assert.ok(LoomError.is(error));
      code = error.code;
    }
    assert.equal(failed, true);
    assert.equal(requests, mode === "gate" ? 0 : 1);
    assert.equal(rows.filter((row) => row.event === "agent_failed").length, 1);
    assert.equal(JSON.stringify(rows).includes(sentinel), false);
    process.stdout.write(JSON.stringify({ code, requests, safeFailureLogged: true }));
  `;
  for (const mode of ["gate", "tool"]) {
    const result = spawnSync(
      process.execPath,
      ["--input-type=module", "--eval", script, mode],
      {
        encoding: "utf8",
        cwd: resolve(import.meta.dirname, ".."),
        timeout: 20000,
        env: {
          ...process.env,
          INTLOOM_WORKFLOW_TEST_KEY: "fixture-credential",
        },
      },
    );
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, `SDK ${mode} regression child failed`);
    assert.equal(result.stderr.includes("PRIVATE_SDK_CAUSE_SENTINEL"), false);
    assert.equal(result.stderr, "");
    const report = JSON.parse(result.stdout);
    assert.equal(report.safeFailureLogged, true);
    assert.equal(report.requests, mode === "gate" ? 0 : 1);
    assert.equal(
      report.code,
      mode === "tool" ? "TOOL_EXECUTION_FAILED" : "STEP_EXECUTION_FAILED",
    );
  }
});
