import assert from "node:assert/strict";
import {
  cp,
  lstat,
  mkdir,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { findPackageJSON } from "node:module";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import type { Client } from "@modelcontextprotocol/client";
import { connectProject, startProjectHost } from "@intloom/cli";
import { openFileStorage } from "@intloom/kernel/storage/file";
import type { AgentTask, RunView } from "@intloom/kernel";
import { specificationArtifactSchema } from "../../../packages/intent/schemas/specification-artifact.ts";
import { solutionArtifactSchema } from "../../../packages/intent/schemas/solution-artifact.ts";
import { json } from "../../../packages/intent/src/flow/shared.ts";
import {
  cli,
  mcpClient,
  refreshFixtureInstallation,
  untilRun,
} from "./project-fixture.ts";
import { temporaryDirectory } from "./directory-fixture.ts";
import { packDirectory, packSpecification } from "./workflow-fixture.ts";

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

/** This fixture enters Validation only; it is not a complete Intent Run. */
async function packValidationOnly(base: string) {
  await packSpecification(base);
  const directory = join(base, "intent-package");
  await writeFile(
    join(directory, "workflow.generated.js"),
    `import { blueprint as full, codes as fullCodes, agentSpecs as fullAgents } from "./workflow.full.js";
import { targets } from "./src/validation/review.js";
const stage = full.stages.validation;
const fixtureCodeId = "CODE-123456789012345678901";
const agentId = stage.steps.validate.execution.agentId;
export const blueprint = {
  flowName: full.flowName,
  entryStageName: "validation",
  stages: {
    validation: {
      ...stage,
      entryStepName: "fixture_init",
      steps: {
        fixture_init: {
          stepName: "fixture_init",
          execution: { kind: "code", codeId: fixtureCodeId },
          on: { complete: { kind: "step", stepName: "validate" } },
        },
        validate: stage.steps.validate,
        check: stage.steps.check,
        finalize: stage.steps.finalize,
      },
      on: { complete: { kind: "workflow_end" } },
    },
  },
};
export const codes = {
  ...fullCodes,
  [fixtureCodeId]: async (_input, access) => {
    const specification = await access.storage.getArtifact("intent", "specification");
    const solution = await access.storage.getArtifact("intent", "solution");
    if (!specification || !solution || !access.project) throw Error("Fixture basis missing");
    const snapshot = await access.project.snapshot();
    await access.state.update({
      ...access.state.value,
      specification: {
        id: specification.id,
        revision: specification.revision,
        data: specification.data,
      },
      solution: { id: solution.id, revision: solution.revision, data: solution.data },
      implementationRecordId: "REC-fixture-implementation",
      fileSnapshot: snapshot,
      commandResults: [],
      scope: {
        specification: targets(specification.data),
        solution: targets(solution.data),
      },
      baseline: null,
    });
    return { outcome: "complete" };
  },
};
export const agentSpecs = { [agentId]: fullAgents[agentId] };
`,
  );
  return packDirectory(directory, base);
}

const specification = json(
  specificationArtifactSchema.parse({
    domains: [],
    features: [],
    requirements: [],
    constraints: [
      {
        id: "SCON-validation-fixture",
        status: "active",
        description: "The fixture exposes one observable constraint.",
        record_refs: [],
      },
    ],
    relations: [],
    deferreds: [],
  }),
);
const solution = json(
  solutionArtifactSchema.parse({
    structure: { apps: [], packages: [], resources: [], relations: [] },
    scenarios: [],
    concepts: [],
    decisions: [],
    risks: [],
    diagrams: [],
  }),
);

const privateSentinel = "PRIVATE_VALIDATION_SENTINEL";
const mismatchedReport = {
  specification_checks: [
    {
      target: { type: "constraint", ref: "SCON-validation-fixture" },
      evidences: [
        {
          id: "VEVD-validation-fixture",
          method: "code",
          code_path: [{ path: "src/validation-fixture.ts", lines: [1] }],
          target_ref: "SCON-validation-fixture",
          result: "violated",
        },
      ],
      result: { status: "partial", reason: privateSentinel },
    },
  ],
  solution_checks: [],
  tests_checks: [],
  code_issues: [],
  findings: [],
};
const correctedReport = {
  ...mismatchedReport,
  specification_checks: [
    {
      ...mismatchedReport.specification_checks[0],
      result: { status: "failed", reason: "Observed violation in fixture." },
    },
  ],
};

test("controlled Validation stage: public MCP correction saves failed report; second rejection leaves no new report", {
  timeout: 120_000,
}, async (t) => {
  const hosts: Awaited<ReturnType<typeof startProjectHost>>[] = [];
  const base = await temporaryDirectory(t, async () => {
    for (const host of hosts) await host.close();
  });
  const root = join(base, "validation-only-project");
  const archive = await packValidationOnly(base);
  const initialized = await cli(root, [
    "init",
    "--workflow",
    archive,
    "--json",
  ]);
  assert.equal(initialized.code, 0, initialized.stdout);
  // The Workflow's own Utils must have a distinct module identity from Host Utils.
  const installation = join(root, ".intloom/workflows/node_modules");
  const installedUtils = join(installation, "@intloom/utils");
  const sourceUtilsManifest = findPackageJSON(
    "@intloom/utils",
    import.meta.url,
  );
  assert.ok(sourceUtilsManifest);
  await rm(installedUtils, { recursive: true, force: true });
  await mkdir(installedUtils, { recursive: true });
  await cp(sourceUtilsManifest, join(installedUtils, "package.json"));
  await cp(
    resolve(dirname(sourceUtilsManifest), "dist"),
    join(installedUtils, "dist"),
    {
      recursive: true,
    },
  );
  for (const name of ["nanoid", "pino"]) {
    const path = join(installation, name);
    const existing = await lstat(path).catch((error: unknown) => {
      if (error instanceof Error && "code" in error && error.code === "ENOENT")
        return null;
      throw error;
    });
    if (existing) continue;
    const dependency = findPackageJSON(
      name,
      pathToFileURL(sourceUtilsManifest),
    );
    assert.ok(dependency);
    await symlink(dirname(dependency), path, "dir");
  }
  assert.notEqual(await realpath(installedUtils), dirname(sourceUtilsManifest));
  await refreshFixtureInstallation(root);
  const configPath = join(root, "intloom.yaml");
  const config = await readFile(configPath, "utf8");
  assert.doesNotMatch(config, /^llms:/mu);
  await mkdir(join(root, "src"), { recursive: true });
  await writeFile(
    join(root, "src/validation-fixture.ts"),
    "export const observedConstraint = false;\n",
  );
  const storage = await openFileStorage({
    directory: join(root, "intloom"),
    layout: "directories",
  });
  try {
    await storage.access.commit([
      {
        type: "create_artifact",
        id: "ART-intent-specification",
        payload: {
          flowName: "intent",
          stageName: "specification",
          data: specification,
        },
      },
      {
        type: "create_artifact",
        id: "ART-intent-solution",
        payload: { flowName: "intent", stageName: "solution", data: solution },
      },
      {
        type: "append_record",
        id: "REC-fixture-implementation",
        payload: {
          flowName: "intent",
          stageName: "implementation",
          data: { fixture: "validation-only" },
        },
      },
    ]);
  } finally {
    await storage.dispose();
  }
  const host = await startProjectHost({ projectRoot: root });
  hosts.push(host);
  const local = await connectProject(root);
  t.after(() => local.close());
  const protocol = (await mcpClient(t, root, {}, "")).client;
  async function warnings(runId: string) {
    const history = await cli(root, ["logs", runId, "--json", "--debug"]);
    assert.equal(history.code, 0, "public logs command failed");
    assert.equal(history.stdout.includes(privateSentinel), false);
    assert.equal(
      history.stdout.includes("Observed violation in fixture."),
      false,
    );
    return (
      JSON.parse(history.stdout).data as Record<string, unknown>[]
    ).filter((row) => row.event === "intent_validation_rejected");
  }
  function assertMismatchWarning(
    row: Record<string, unknown> | undefined,
    runId: string,
  ) {
    assert.ok(row, "missing public intent_validation_rejected warning");
    assert.equal(row.rule, "VIOLATION_STATUS_MISMATCH");
    assert.equal(row.runId, runId);
    assert.equal(row.stageName, "validation");
    assert.equal(row.stepName, "validate");
    assert.ok(
      Number.isSafeInteger(row.executionId) && Number(row.executionId) > 0,
    );
    assert.equal(row.scopeGroup, "specification");
    assert.equal(row.targetRef, "SCON-validation-fixture");
  }
  const tools = await protocol.listTools();
  for (const name of [
    "flow",
    "claim_agent_call",
    "call_agent_tool",
    "complete_agent_call",
    "get_artifact",
    "get_record",
  ])
    assert.ok(tools.tools.some((tool) => tool.name === name));

  async function claimRun(intent: string, claimId: string) {
    const created = await invoke<{ run: RunView }>(protocol, "flow", {
      flowName: "intent",
      intent,
    });
    const run = await untilRun(
      local,
      created.run.runId,
      (view) =>
        view.status === "waiting" && view.pendingAgentCall !== undefined,
    );
    assert.equal(run.cursor.stageName, "validation");
    assert.equal(run.cursor.stepName, "validate");
    assert.ok(run.pendingAgentCall);
    const ref = { runId: run.runId, callId: run.pendingAgentCall.id };
    const claim = await invoke<{ task: AgentTask; ownerToken: string }>(
      protocol,
      "claim_agent_call",
      { ...ref, claimId },
    );
    assert.deepEqual(claim.task.tools.map((tool) => tool.id).sort(), [
      "list_project_files",
      "read_project_file",
      "read_validation",
      "submit_validation",
    ]);
    const owner = { ...ref, ownerToken: claim.ownerToken };
    const read = await invoke<{ output: Record<string, unknown> }>(
      protocol,
      "call_agent_tool",
      {
        ...owner,
        toolCallId: `${claimId}-read`,
        toolId: "read_validation",
        input: {},
      },
    );
    assert.deepEqual(read.output.scope, {
      specification: [{ type: "constraint", ref: "SCON-validation-fixture" }],
      solution: [],
    });
    return owner;
  }

  const first = await claimRun("controlled correction", "claim-correct");
  const rejected = await invoke<{
    output: {
      saved: boolean;
      attemptsRemaining: number;
      feedback: { rule: string; scopeGroup?: string; targetRef?: string };
    };
  }>(protocol, "call_agent_tool", {
    ...first,
    toolCallId: "first-bad-report",
    toolId: "submit_validation",
    input: mismatchedReport,
  });
  assert.equal(rejected.output.saved, false);
  assert.equal(rejected.output.attemptsRemaining, 1);
  assert.equal(rejected.output.feedback.rule, "VIOLATION_STATUS_MISMATCH");
  assert.equal(rejected.output.feedback.scopeGroup, "specification");
  assert.equal(rejected.output.feedback.targetRef, "SCON-validation-fixture");
  assertMismatchWarning((await warnings(first.runId))[0], first.runId);
  assert.equal(
    (
      await invoke<{ artifact: unknown }>(protocol, "get_artifact", {
        flowName: "intent",
        stageName: "validation",
      })
    ).artifact,
    null,
  );
  const saved = await invoke<{ output: { saved: boolean } }>(
    protocol,
    "call_agent_tool",
    {
      ...first,
      toolCallId: "corrected-failed-report",
      toolId: "submit_validation",
      input: correctedReport,
    },
  );
  assert.equal(saved.output.saved, true);
  const completedReceipt = await invoke<{ run: RunView }>(
    protocol,
    "complete_agent_call",
    { ...first, result: { outcome: "ready" } },
  );
  const completed = await untilRun(
    local,
    completedReceipt.run.runId,
    (view) => view.status === "completed",
  );
  assert.equal(completed.status, "completed");
  const artifact = (
    await invoke<{
      artifact: {
        id: string;
        revision: number;
        data: {
          id: string;
          specification_checks: { result: { status: string } }[];
        };
      };
    }>(protocol, "get_artifact", {
      flowName: "intent",
      stageName: "validation",
    })
  ).artifact;
  assert.ok(artifact);
  assert.equal(artifact.data.id, completed.runId);
  assert.equal(artifact.data.specification_checks[0]?.result.status, "failed");
  const seededRecord = await invoke<{ record: { id: string; data: unknown } }>(
    protocol,
    "get_record",
    { recordId: "REC-fixture-implementation" },
  );
  assert.equal(seededRecord.record.id, "REC-fixture-implementation");
  assert.deepEqual(seededRecord.record.data, { fixture: "validation-only" });
  assert.equal(
    (
      await invoke<{ record: unknown }>(protocol, "get_record", {
        recordId: `REC-${completed.runId}-validation`,
      })
    ).record,
    null,
    "Validation finalize creates an Artifact, not a Validation Record",
  );

  const second = await claimRun("controlled second rejection", "claim-fail");
  const firstRejection = await invoke<{ output: { saved: boolean } }>(
    protocol,
    "call_agent_tool",
    {
      ...second,
      toolCallId: "second-run-bad-one",
      toolId: "submit_validation",
      input: mismatchedReport,
    },
  );
  assert.equal(firstRejection.output.saved, false);
  const secondRejection = await protocol.callTool(
    {
      name: "call_agent_tool",
      arguments: {
        ...second,
        toolCallId: "second-run-bad-two",
        toolId: "submit_validation",
        input: mismatchedReport,
      },
    },
    { timeout: 10_000 },
  );
  assert.equal(secondRejection.isError, true);
  const rejectedPayload = (secondRejection.structuredContent ??
    JSON.parse(
      secondRejection.content.find((item) => item.type === "text")?.text ??
        "null",
    )) as { error: { code: string; retryable: boolean } };
  assert.equal(rejectedPayload.error.code, "TOOL_EXECUTION_FAILED");
  assert.equal(rejectedPayload.error.retryable, false);
  const failed = await untilRun(
    local,
    second.runId,
    (view) => view.status === "failed",
  );
  assert.equal(failed.lastError?.code, "TOOL_EXECUTION_FAILED");
  assert.equal(failed.lastError?.retryable, false);
  const secondWarnings = await warnings(second.runId);
  assert.equal(secondWarnings.length, 2);
  for (const warning of secondWarnings)
    assertMismatchWarning(warning, second.runId);
  const afterFailure = (
    await invoke<{
      artifact: { id: string; revision: number; data: { id: string } };
    }>(protocol, "get_artifact", {
      flowName: "intent",
      stageName: "validation",
    })
  ).artifact;
  assert.equal(afterFailure.id, artifact.id);
  assert.equal(afterFailure.revision, artifact.revision);
  assert.equal(afterFailure.data.id, completed.runId);
  await local.close();
  await protocol.close();
  await host.close();
});
