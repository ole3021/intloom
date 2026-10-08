import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Client } from "@modelcontextprotocol/client";
import { connectProject, startProjectHost } from "@intloom/cli";
import type {
  AgentTask,
  RunView,
  StoredArtifact,
  StoredRecord,
} from "@intloom/kernel";
import { cli, mcpClient } from "./project-fixture.ts";
import { temporaryDirectory } from "./directory-fixture.ts";
import { packSpecification } from "./workflow-fixture.ts";

async function invoke<T>(
  client: Client,
  name: string,
  args: Record<string, unknown>,
): Promise<T> {
  const result = await client.callTool(
    { name, arguments: args },
    { timeout: 10_000 },
  );
  assert.equal(result.isError, undefined, JSON.stringify(result));
  return (result.structuredContent ??
    JSON.parse(
      result.content.find((item) => item.type === "text")?.text ?? "null",
    )) as T;
}
interface SpecificationRead {
  intent: string;
  feedbacks: unknown[];
  questions: {
    id: string;
    question: string;
    isBlock: boolean;
    answer?: string;
  }[];
}

for (const storage of ["file", "sqlite"] as const) {
  test(`${storage}: packed Intent completes through generic and Codex MCP Agent tasks without service models`, {
    timeout: 120_000,
  }, async (t) => {
    const hosts: Awaited<ReturnType<typeof startProjectHost>>[] = [];
    const base = await temporaryDirectory(t, async () => {
      for (const host of hosts) await host.close();
    });
    const root = join(base, "project");
    const archive = await packSpecification(base);
    const initialized = await cli(root, [
      "init",
      "--workflow",
      archive,
      "--json",
    ]);
    assert.equal(initialized.code, 0, initialized.stdout);
    const configPath = join(root, "intloom.yaml");
    const yaml = (await readFile(configPath, "utf8")).replace(
      "localStorage: file",
      `localStorage: ${storage}`,
    );
    assert.doesNotMatch(yaml, /^llms:/m);
    await writeFile(configPath, yaml);
    const host = await startProjectHost({ projectRoot: root });
    hosts.push(host);
    const local = await connectProject(root);
    t.after(() => local.close());
    let generic = (await mcpClient(t, root, {}, "")).client;
    const codex = (await mcpClient(t, root)).client;
    const tools = await generic.listTools();
    for (const name of [
      "get_agent_call",
      "claim_agent_call",
      "call_agent_tool",
      "read_agent_asset",
      "complete_agent_call",
      "fail_agent_call",
    ])
      assert.ok(tools.tools.some((tool) => tool.name === name));
    const created = await invoke<{ run: RunView }>(generic, "flow", {
      flowName: "intent",
      intent: "Store todo data on this device.",
    });
    let run = created.run;
    const originalRunId = run.runId;
    const agentIds: string[] = [];
    async function analyze(
      client: Client,
      outcome: string,
      description: string,
    ) {
      assert.equal(run.status, "waiting");
      assert.ok(run.pendingAgentCall);
      agentIds.push(run.pendingAgentCall.id);
      const ref = { runId: run.runId, callId: run.pendingAgentCall.id };
      const claim = await invoke<{ task: AgentTask; ownerToken: string }>(
        client,
        "claim_agent_call",
        { ...ref, claimId: `client_${agentIds.length}` },
      );
      assert.equal(claim.task.tools.length, 2);
      assert.equal(claim.task.skills.length, 3);
      assert.equal(JSON.stringify(claim.task).includes(root), false);
      if (agentIds.length === 1) {
        await client.close();
        client = (await mcpClient(t, root, {}, "")).client;
        generic = client;
        assert.deepEqual(
          await invoke(client, "claim_agent_call", {
            ...ref,
            claimId: "client_1",
          }),
          claim,
        );
      }
      const owner = { ...ref, ownerToken: claim.ownerToken };
      const read = await invoke<{ output: SpecificationRead }>(
        client,
        "call_agent_tool",
        {
          ...owner,
          toolCallId: "read",
          toolId: "read_specification",
          input: {},
        },
      );
      const input = {
        changes: [
          {
            target_ref: "SCON-local",
            reason: "Save the requested local-storage constraint",
            patch: [
              {
                op: "add",
                path: "",
                value: {
                  id: "SCON-local",
                  status: "active",
                  description,
                  record_refs: [],
                },
              },
            ],
          },
        ],
        questions: [
          {
            id: "QST-1",
            question: "Where should todo data be stored?",
            isBlock: true,
          },
        ],
        processedFeedbackCount: read.output.feedbacks.length,
      };
      if (agentIds.length > 1)
        assert.equal(read.output.questions[0]?.answer, "On this device");
      const request = {
        ...owner,
        toolCallId: "submit",
        toolId: "submit_specification",
        input,
      };
      assert.deepEqual(
        (await invoke<{ output: unknown }>(client, "call_agent_tool", request))
          .output,
        { saved: true },
      );
      assert.deepEqual(
        (await invoke<{ output: unknown }>(client, "call_agent_tool", request))
          .output,
        { saved: true },
      );
      run = (
        await invoke<{ run: RunView }>(client, "complete_agent_call", {
          ...owner,
          result: { outcome },
        })
      ).run;
      assert.equal(run.runId, originalRunId);
      assert.deepEqual(run.execution, {
        source: "agent_ide",
        agentExecutor: "mcp_client",
      });
    }
    await analyze(
      generic,
      "clarification_required",
      "Store todo data on this device.",
    );
    assert.equal(run.pendingAction?.kind, "user_ask_questions");
    assert.ok(run.pendingAction);
    run = await local.answerAsk(run.runId, run.pendingAction.id, [
      {
        questionId: "QST-1",
        isSkipped: false,
        answer: "On this device",
      },
    ]);
    await analyze(codex, "ready", "Store todo data on this device.");
    assert.equal(run.pendingAction?.kind, "user_ask_confirmation");
    assert.ok(run.pendingAction);
    run = await local.answerAsk(run.runId, run.pendingAction.id, {
      isConfirmed: false,
      feedback: "Keep the data after restart.",
    });
    await analyze(
      generic,
      "ready",
      "Store todo data on this device and retain it after restart.",
    );
    assert.ok(run.pendingAction);
    run = await local.answerAsk(run.runId, run.pendingAction.id, {
      isConfirmed: true,
    });
    assert.equal(run.status, "completed", JSON.stringify(run.lastError));
    assert.equal(new Set(agentIds).size, 3);
    const record = await local.getRecord(run.runId);
    const artifact = await local.getArtifact({
      flowName: "intent",
      stageName: "specification",
    });
    assert.ok(record && artifact);
    assert.match(JSON.stringify(artifact.data), /retain it after restart/);
    assert.equal((await host.storage.access.listRecords({})).data.length, 1);
    assert.deepEqual(host.execution.executionStatus(), {
      useMcpAgent: true,
      serviceConfigured: false,
      preparedServiceAgents: 0,
    });
    await assert.rejects(local.flow("intent", "CLI requires a model"), {
      code: "INVALID_REQUEST",
    });
    await local.close();
    await generic.close();
    await codex.close();
    await host.close();
    const reopened = await startProjectHost({ projectRoot: root });
    hosts.push(reopened);
    const reader = await connectProject(root);
    t.after(() => reader.close());
    assert.deepEqual(
      (await reader.getRecord(record.id)) as StoredRecord,
      record,
    );
    assert.deepEqual(
      (await reader.getArtifact({ artifactId: artifact.id })) as StoredArtifact,
      artifact,
    );
    await reader.close();
    await reopened.close();
    assert.equal(await readFile(configPath, "utf8"), yaml);
  });
}
