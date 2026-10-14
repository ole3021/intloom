import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  codexArguments,
  codexCalls,
  codexTools,
  mcpData,
  prepareCodex,
} from "./codex.ts";
import type { Session } from "./session.ts";
import type { CodexExecution } from "./codex.ts";
import { Evidence } from "./evidence.ts";
import { parseOptions } from "./options.ts";

test("Codex evidence requires successful actual MCP call results, not final prose or incomplete calls", () => {
  const call = {
    type: "item.completed",
    item: {
      id: "one",
      type: "mcp_tool_call",
      server: "intloom",
      tool: "get_run",
      status: "completed",
      arguments: { runId: "RUN-one" },
      result: {
        content: [
          { type: "text", text: JSON.stringify({ run: { runId: "RUN-one" } }) },
        ],
      },
    },
  };
  assert.deepEqual(
    codexCalls([{ phase: "query", event: call }]).map((entry) => entry.data),
    [{ run: { runId: "RUN-one" } }],
  );
  for (const event of [
    { ...call, type: "item.started" },
    { ...call, item: { ...call.item, status: "in_progress" } },
    { ...call, item: { ...call.item, server: "another-server" } },
    { ...call, item: { ...call.item, error: { message: "failed" } } },
    {
      ...call,
      item: { ...call.item, result: { ...call.item.result, isError: true } },
    },
    {
      type: "item.completed",
      item: { type: "agent_message", text: "Everything passed" },
    },
  ])
    assert.equal(codexCalls([{ phase: "query", event }]).length, 0);
  assert.deepEqual(mcpData({ structured_content: { saved: true } }), {
    saved: true,
  });
});

test("Codex sessions separate Agent execution, knowledge-based human answers and read-only queries", () => {
  assert.ok(codexTools("agent").includes("claim_agent_call"));
  assert.equal(codexTools("agent").includes("answer_ask"), false);
  assert.deepEqual(codexTools("human"), ["get_run", "answer_ask"]);
  assert.ok(codexTools("query").includes("get_artifact"));
  for (const phase of ["agent", "human", "query"]) {
    assert.equal(codexTools(phase).includes("resume_run"), false);
    assert.equal(codexTools(phase).includes("mirror_restore"), false);
  }
});

test("Codex entry has its own credential-free profile and bounded options", async () => {
  const options = await parseOptions([
    "codex",
    "--root",
    "/tmp/e2e",
    "--case",
    "m01",
    "--codex-model",
    "selected-model",
  ]);
  assert.ok(options);
  assert.match(options.profile ?? "", /fixtures\/codex\/config\.json$/u);
  assert.equal(options.codexModel, "selected-model");
  assert.equal(await parseOptions(["codex", "--help"]), null);
  await assert.rejects(
    parseOptions(["codex", "--root", "/tmp/e2e", "--workflow", "/other.tgz"]),
    { code: "OPTIONS_INVALID" },
  );
  await assert.rejects(
    parseOptions(["mcp", "--root", "/tmp/e2e", "--codex", "/other"]),
    { code: "OPTIONS_INVALID" },
  );
});

test("Codex launch preserves generated connection paths and confines approval to role-allowed MCP Tools", () => {
  const session = { project: "/owned project" } as Session;
  const execution = {
    model: "selected-model",
    configuration:
      '[mcp_servers.intloom]\ncommand="/pinned node"\nargs=["/pinned bin.js","mcp","serve","--project","/owned project","--ide","codex"]\ncwd="/owned project"\nstartup_timeout_sec=20\ntool_timeout_sec=300\n',
  } as CodexExecution;
  const args = codexArguments(
    session,
    execution,
    "/owned evidence/schema.json",
    "human",
  );
  assert.equal(args[args.indexOf("--sandbox") + 1], "read-only");
  assert.ok(args.includes("--ignore-user-config"));
  assert.ok(args.includes("--ephemeral"));
  assert.ok(args.includes("shell_tool"));
  assert.ok(args.includes('mcp_servers.intloom.command="/pinned node"'));
  assert.ok(
    args.includes('mcp_servers.intloom.enabled_tools=["get_run","answer_ask"]'),
  );
  assert.ok(
    args.includes('mcp_servers.intloom.default_tools_approval_mode="approve"'),
  );
  assert.equal(
    args.some((arg) => arg.includes("dangerously-bypass")),
    false,
  );
});

test("Missing Codex blocks before preparing a project or invoking a model", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "e2e-codex-preflight-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const options = await parseOptions([
    "codex",
    "--root",
    directory,
    "--codex",
    join(directory, "missing"),
  ]);
  assert.ok(options);
  await assert.rejects(
    prepareCodex(
      options,
      directory,
      new Evidence(join(directory, "evidence")),
      {},
    ),
    { code: "CODEX_UNAVAILABLE", status: "blocked" },
  );
});
