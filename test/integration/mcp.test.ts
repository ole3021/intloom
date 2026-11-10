import { cliArgs } from "../fixtures/cli.mjs";
import type {
  ServiceMethods,
  CallArguments,
} from "../../apps/cli/dist/service/protocol.js";
import { writeFixturePackage } from "./fixture-package.ts";
import assert from "node:assert/strict";
import { spawn, execFile } from "node:child_process";
import { once } from "node:events";
import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
  readdir,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  Client,
  StreamableHTTPClientTransport,
  type CallToolResult,
  type InputRequiredResult,
} from "@modelcontextprotocol/client";
import { compileLoom } from "../../packages/compiler/dist/index.js";
import { openService } from "../../apps/cli/dist/service/server.js";
import { requestService } from "../../apps/cli/dist/service/client.js";
import type {
  ArtifactRecord,
  InstalledLoomRef,
  InteractionRequest,
  RunView,
  RunResult,
} from "../../packages/loom-sdk/dist/index.js";

const root = fileURLToPath(new URL("../../", import.meta.url));
const binary = join(root, "apps/cli/dist/bin.js");
const exec = promisify(execFile);
const hasCode = (code: string | number) => (error: unknown) =>
  (error as { code?: unknown }).code === code;
const result = <T>(value: CallToolResult): T => {
  const envelope = value.structuredContent as {
    ok: boolean;
    data: T;
    error?: unknown;
  };
  assert.equal(envelope.ok, true, JSON.stringify(envelope));
  return envelope.data;
};
async function fixture(
  t: TestContext,
  filename = "outcomes-outcome.ts.fixture",
  replace?: (text: string) => string,
) {
  const directory = await mkdtemp(join(tmpdir(), "intloom-mcp-"));
  const author = join(directory, "author");
  await mkdir(author);
  await symlink(
    join(root, "packages/compiler/node_modules"),
    join(author, "node_modules"),
  );
  let source = await readFile(join(root, "test/fixtures", filename), "utf8");
  if (replace) source = replace(source);
  await writeFile(join(author, "loom.ts"), source);
  await writeFixturePackage(join(author, "loom.ts"));
  const compiled = await compileLoom({
    entryFile: join(author, "loom.ts"),
    outDir: join(directory, "compiled"),
    target: "node22",
  });
  assert.ok(compiled.ok, JSON.stringify(compiled));
  const dataDir = join(directory, "data");
  const host = await openService({
    dataDir,
    mcpPort: 0,
    nativeResponseSource: { kind: "test", via: "mcp" },
  });
  t.after(async () => {
    await host.close();
    await rm(directory, { recursive: true, force: true });
  });
  const call = <M extends keyof ServiceMethods>(
    method: M,
    ...args: CallArguments<Parameters<ServiceMethods[M]>>
  ) => requestService(dataDir, method, ...args);
  const loom = (await call("installLoom", [
    { source: compiled.artifactDir },
  ])) as InstalledLoomRef;
  return { directory, dataDir, call, loom, host };
}
async function connected(t: TestContext, dataDir: string, form = false) {
  const client = new Client(
    { name: "intloom-protocol-tests", version: "0.3.0" },
    {
      versionNegotiation: { mode: { pin: "2026-07-28" } },
      capabilities: form ? { elicitation: { form: {} } } : {},
      inputRequired: { autoFulfill: false },
    },
  );
  const endpoint = JSON.parse(
    await readFile(join(dataDir, "service.json"), "utf8"),
  );
  await client.connect(
    new StreamableHTTPClientTransport(new URL(endpoint.mcpUrl), {
      requestInit: { headers: { Authorization: `Bearer ${endpoint.token}` } },
    }),
  );
  t.after(() => client.close());
  return client;
}
async function settle(
  call: Awaited<ReturnType<typeof fixture>>["call"],
  id: string,
) {
  for (let i = 0; i < 500; i++) {
    const run = (await call("getRun", [id])) as RunView;
    if (!["created", "running", "stopping"].includes(run.status)) return run;
    await delay(10);
  }
  throw new Error("Run did not settle");
}
async function waitRun(f: Awaited<ReturnType<typeof fixture>>) {
  const run = (await f.call("createRun", [
    { loom: f.loom, input: 2 },
  ])) as RunView;
  await f.call("startRun", [run.id]);
  assert.equal((await settle(f.call, run.id)).status, "waiting");
  return {
    run,
    request: (
      (await f.call("listInteractions", [
        { runId: run.id },
      ])) as InteractionRequest[]
    )[0] as InteractionRequest,
  };
}

test("official client: fixed tools, discovery, errors, complete outcomes and artifact resources", async (t) => {
  const f = await fixture(t);
  const client = await connected(t, f.dataDir);
  const listing = await client.listTools();
  assert.equal(listing.tools.length, 20);
  assert.equal(new Set(listing.tools.map((x) => x.name)).size, 20);
  assert.doesNotMatch(
    JSON.stringify(listing),
    /actorId|"source"|"dataDir"|serviceShutdown|installLoom/,
  );
  const call = (name: string, args: Record<string, unknown>) =>
    client.callTool({ name: `intloom_${name}`, arguments: args });
  const looms = result<{ items: unknown[] }>(await call("looms_list", {}));
  assert.equal(looms.items.length, 1);
  assert.equal(
    result<{ ref: InstalledLoomRef }>(await call("loom_get", { loom: f.loom }))
      .ref.artifactDigest,
    f.loom.artifactDigest,
  );
  await assert.rejects(
    client.callTool({ name: "intloom_unknown", arguments: {} }),
    hasCode(-32602),
  );
  await assert.rejects(
    call("run_get", { runId: "missing", source: { kind: "human" } }),
    (e: unknown) => (e as { code: number }).code === -32602,
  );
  const missing = await call("run_get", { runId: "missing" });
  assert.equal(missing.isError, true);
  assert.equal(
    (missing.structuredContent as { error: { code: string } }).error.code,
    "RUN_NOT_FOUND",
  );
  const created = result<RunView>(
    await call("run_create", {
      loom: f.loom,
      input: { mode: "reject", size: 1024 * 1024 + 7 },
    }),
  );
  assert.equal(created.status, "created");
  result(await call("run_start", { runId: created.id }));
  assert.equal((await settle(f.call, created.id)).status, "succeeded");
  assert.equal(
    result<RunView>(await call("run_get", { runId: created.id })).status,
    "succeeded",
  );
  assert.equal(
    result<RunResult>(await call("run_result", { runId: created.id })).quality,
    "rejected",
  );
  assert.equal(
    result<{ items: unknown[] }>(await call("runs_list", {})).items.length,
    1,
  );
  assert.ok(
    result<{ items: RunView[] }>(await call("runs_list", {})).items.every(
      (run) => !("output" in run),
    ),
  );
  assert.ok(
    result<{ items: unknown[] }>(
      await call("run_events", { runId: created.id }),
    ).items.length,
  );
  assert.deepEqual(
    result(await call("run_activity", { runId: created.id })),
    await f.call("getRunActivity", [created.id]),
  );
  const artifacts = result<{ items: ArtifactRecord[] }>(
    await call("artifacts_list", { runId: created.id }),
  );
  const binaryArtifact = artifacts.items.find(
    (a) => a.mediaType === "application/octet-stream",
  );
  assert.ok(binaryArtifact);
  const meta = result<ArtifactRecord & { uri: string }>(
    await call("artifact_get", { artifactId: binaryArtifact.id }),
  );
  assert.equal(meta.uri, `intloom://artifacts/${meta.id}`);
  const range = result<{ data: string; eof: boolean; length: number }>(
    await call("artifact_read", { artifactId: meta.id }),
  );
  assert.equal(range.eof, false);
  assert.equal(range.length, 1024 * 1024);
  const acceptances = result<{ items: { id: string }[] }>(
    await call("acceptances_list", { runId: created.id }),
  );
  assert.equal(
    result<{ status: string }>(
      await call("acceptance_get", { acceptanceId: acceptances.items[0]?.id }),
    ).status,
    "rejected",
  );
  const resources = await client.listResources();
  assert.equal(resources.resources.length, 2);
  const bytes = await client.readResource({ uri: meta.uri });
  assert.ok(bytes.contents[0] && "blob" in bytes.contents[0]);
  const blob = Buffer.from(bytes.contents[0]?.blob as string, "base64");
  assert.equal(createHash("sha256").update(blob).digest("hex"), meta.digest);
  const text = resources.resources.find((r) => r.mimeType === "text/plain");
  assert.ok(text);
  assert.equal(
    (
      (await client.readResource({ uri: text.uri })).contents[0] as {
        text: string;
      }
    ).text,
    "draft",
  );
  assert.equal(
    (await client.listResourceTemplates()).resourceTemplates.length,
    0,
  );
  await assert.rejects(client.readResource({ uri: "file:///etc/passwd" }));
  const cancelled = result<RunView>(
    await call("run_create", {
      loom: f.loom,
      input: { mode: "pass", size: 1 },
    }),
  );
  result(
    await call("run_stop", {
      runId: cancelled.id,
      reason: "test cancellation",
    }),
  );
  assert.equal(
    result<RunResult>(await call("run_result", { runId: cancelled.id }))
      .runStatus,
    "cancelled",
  );
});

test("MRTR keeps the original request, validates handles, records test source and maps all actions", async (t) => {
  const f = await fixture(t, "recovery-workflow.ts.fixture");
  const client = await connected(t, f.dataDir, true);
  const call = (requestId: string, state?: string, response?: unknown) =>
    client.request(
      {
        method: "tools/call",
        params: {
          name: "intloom_interaction_prompt",
          arguments: { requestId },
          ...(state ? { requestState: state } : {}),
          ...(response ? { inputResponses: { answer: response } } : {}),
        },
      },
      { allowInputRequired: true },
    );
  const first = await waitRun(f);
  assert.equal(
    result<{ items: unknown[] }>(
      await client.callTool({
        name: "intloom_interactions_list",
        arguments: { runId: first.run.id },
      }),
    ).items.length,
    1,
  );
  result(
    await client.callTool({
      name: "intloom_interaction_get",
      arguments: { requestId: first.request.id },
    }),
  );
  const opened = (await call(
    first.request.id,
  )) as unknown as InputRequiredResult;
  assert.equal(opened.resultType, "input_required");
  assert.ok(opened.inputRequests?.answer);
  assert.equal(
    (
      (await f.call("getInteraction", [first.request.id])) as {
        responses: readonly unknown[];
      }
    ).responses.length,
    0,
  );
  await assert.rejects(
    call(first.request.id, "forged", { action: "accept", content: { add: 9 } }),
  );
  const second = await waitRun(f);
  const wrong = (await call(second.request.id, opened.requestState, {
    action: "accept",
    content: { add: 8 },
  })) as CallToolResult;
  assert.equal(wrong.isError, true);
  const invalid = (await call(first.request.id, opened.requestState, {
    action: "accept",
    content: { add: "wrong" },
  })) as CallToolResult;
  assert.equal(
    (invalid.structuredContent as { error: { code: string } }).error.code,
    "RESPONSE_INVALID",
  );
  const accepted = result<{ responseId: string }>(
    (await call(first.request.id, opened.requestState, {
      action: "accept",
      content: {},
    })) as CallToolResult,
  );
  assert.equal((await settle(f.call, first.run.id)).status, "succeeded");
  assert.equal(
    ((await f.call("getRunResult", [first.run.id])) as RunResult).output,
    6,
  );
  assert.equal(
    result<{ responseId: string }>(
      (await call(first.request.id, opened.requestState, {
        action: "accept",
        content: { add: 100 },
      })) as CallToolResult,
    ).responseId,
    accepted.responseId,
  );
  const record = (await f.call("getInteraction", [first.request.id])) as {
    responses: readonly { source: unknown }[];
  };
  assert.equal(record.responses.length, 1);
  assert.deepEqual(record.responses[0]?.source, { kind: "test", via: "mcp" });
  assert.equal(
    result<{ request: InteractionRequest }>(
      (await call(first.request.id)) as CallToolResult,
    ).request.status,
    "answered",
  );
  for (const action of ["decline", "cancel"] as const) {
    const round = (await call(
      second.request.id,
    )) as unknown as InputRequiredResult;
    const receipt = result<{ requestStatus: string; responseId: string }>(
      (await call(second.request.id, round.requestState, {
        action,
      })) as CallToolResult,
    );
    assert.equal(receipt.requestStatus, "pending");
    await call(second.request.id, round.requestState, { action });
  }
  const declined = (await f.call("getInteraction", [second.request.id])) as {
    responses: readonly { action: string }[];
  };
  assert.deepEqual(
    declined.responses.map((r) => r.action),
    ["decline", "dismiss"],
  );
  assert.equal(
    ((await f.call("getRun", [second.run.id])) as RunView).status,
    "waiting",
  );
  const resumed = await client.callTool({
    name: "intloom_run_resume",
    arguments: { runId: second.run.id, requestId: second.request.id },
  });
  assert.equal(resumed.isError, true);
  result(
    await client.callTool({
      name: "intloom_interaction_respond",
      arguments: {
        requestId: second.request.id,
        response: { action: "submit", value: { add: 0 } },
      },
    }),
  );
  await settle(f.call, second.run.id);
  const answered = (await f.call("getInteraction", [second.request.id])) as {
    responses: readonly { source: { kind: string } }[];
  };
  assert.equal(answered.responses.at(-1)?.source.kind, "agent");
});

test("fallback preserves the question and human policy; disconnect does not cancel the Run", async (t) => {
  const f = await fixture(t, "recovery-workflow.ts.fixture", (text) =>
    text.replace(
      "interaction: { message:",
      "interaction: { responsePolicy: 'human', message:",
    ),
  );
  const { run, request } = await waitRun(f);
  const client = await connected(t, f.dataDir);
  const fallback = result<{
    presentation: string;
    request: InteractionRequest;
    cli: { args: string[] };
    canRespondWithTool: boolean;
  }>(
    await client.callTool({
      name: "intloom_interaction_prompt",
      arguments: { requestId: request.id },
    }),
  );
  assert.equal(fallback.presentation, "fallback");
  assert.equal(fallback.request.message, request.message);
  assert.ok(!fallback.cli.args.includes("--data-dir"));
  assert.equal(fallback.canRespondWithTool, false);
  const response = await client.callTool({
    name: "intloom_interaction_respond",
    arguments: {
      requestId: request.id,
      response: { action: "submit", value: { add: 0 } },
    },
  });
  assert.equal(
    (response.structuredContent as { error: { code: string } }).error.code,
    "RESPONSE_SOURCE_NOT_ALLOWED",
  );
  await client.close();
  assert.equal(
    ((await f.call("getRun", [run.id])) as RunView).status,
    "waiting",
  );
  assert.equal(
    (
      (await f.call("getInteraction", [request.id])) as {
        responses: readonly unknown[];
      }
    ).responses.length,
    0,
  );
});

test("CLI init, full raw reads, safe export, JSON ranges and quality exit status", async (t) => {
  const f = await fixture(t);
  const cli = (argv: string[]) =>
    exec(process.execPath, [...cliArgs(binary, f.dataDir), ...argv], {
      maxBuffer: 4 * 1024 * 1024,
    });
  const initDir = join(f.directory, "new-loom");
  await cli(["dev", "init", initDir, "--name", "hello-mcp", "--plain"]);
  assert.equal(
    JSON.parse(await readFile(join(initDir, "package.json"), "utf8")).version,
    "0.1.0",
  );
  await assert.rejects(cli(["dev", "init", initDir, "--name", "hello-mcp"]));
  await symlink(
    join(root, "packages/compiler/node_modules"),
    join(initDir, "node_modules"),
  );
  const { buildPackage } = await import(
    "../../packages/compiler/dist/index.js"
  );
  const archive = await buildPackage(
    initDir,
    join(f.directory, "template-built"),
  );
  assert.equal(
    archive,
    join(f.directory, "template-built", "new-loom-0.1.0.tgz"),
  );
  await assert.rejects(
    cli([
      "run",
      "outcomes-outcome@1.0.0",
      "--input",
      JSON.stringify({ mode: "reject", size: 1024 * 1024 + 11 }),
      "--plain",
    ]),
    (error: unknown) => {
      const e = error as { code: number; stdout: string; stderr: string };
      assert.equal(e.code, 5);
      assert.equal(JSON.parse(e.stdout).data.status, "succeeded");
      assert.match(e.stderr, /quality: rejected/);
      return true;
    },
  );
  const run = ((await f.call("listRuns")) as { items: RunView[] }).items[0];
  assert.ok(run);
  const artifacts = (
    (await f.call("listArtifacts", [{ runId: run.id }])) as {
      items: ArtifactRecord[];
    }
  ).items;
  const artifact = artifacts.find(
    (a) => a.mediaType === "application/octet-stream",
  );
  assert.ok(artifact);
  const raw = await exec(
    process.execPath,
    [...cliArgs(binary, f.dataDir), "artifact", "read", artifact.id],
    { encoding: "buffer", maxBuffer: 4 * 1024 * 1024 },
  );
  assert.equal(raw.stdout.length, artifact.size);
  assert.equal(
    createHash("sha256").update(raw.stdout).digest("hex"),
    artifact.digest,
  );
  const range = JSON.parse(
    (await cli(["artifact", "read", artifact.id, "--plain"])).stdout,
  ).data;
  assert.equal(range.eof, false);
  const destination = join(f.directory, "export.bin");
  await writeFile(destination, "previous");
  await assert.rejects(
    cli(["artifact", "export", artifact.id, "--out", destination]),
  );
  assert.equal(await readFile(destination, "utf8"), "previous");
  await cli([
    "artifact",
    "export",
    artifact.id,
    "--out",
    destination,
    "--overwrite",
  ]);
  assert.deepEqual(await readFile(destination), raw.stdout);
  assert.ok(
    !(await readdir(f.directory)).some((name) =>
      name.startsWith(".intloom-export-"),
    ),
  );
  assert.equal(
    JSON.parse((await cli(["status", run.id, "--plain"])).stdout).data.result
      .quality,
    "rejected",
  );
  await assert.rejects(
    cli(["artifact", "read", artifact.id, "--length", "0", "--plain"]),
    (error: unknown) => (error as { code: number }).code === 2,
  );
});

test("plain CLI preserves waiting exits and explicit program responses without prompts", async (t) => {
  const f = await fixture(t, "recovery-workflow.ts.fixture");
  const cli = (args: string[]) =>
    exec(
      process.execPath,
      [...cliArgs(binary, f.dataDir), ...args, "--plain"],
      { timeout: 10_000 },
    );
  await assert.rejects(cli(["run", "consumer-wait"]), (error: unknown) => {
    const e = error as { code: number; stdout: string; stderr: string };
    assert.equal(e.code, 2);
    assert.equal(JSON.parse(e.stdout).error.code, "INPUT_INVALID");
    assert.ok(!e.stderr.includes("\x1b"));
    assert.doesNotMatch(e.stderr, /▰|▱|─/);
    return true;
  });
  await assert.rejects(
    cli(["run", "consumer-wait", "--input", "2"]),
    (error: unknown) => {
      const e = error as { code: number; stderr: string };
      assert.equal(e.code, 3);
      assert.match(e.stderr, /Choose an increment/);
      assert.match(e.stderr, /interaction respond/);
      assert.ok(!e.stderr.includes("\x1b"));
      assert.doesNotMatch(e.stderr, /▰|▱|Recent logs|Submit this answer/);
      return true;
    },
  );
  const [run] = ((await f.call("listRuns")) as { items: RunView[] }).items;
  assert.ok(run);
  const [request] = (await f.call("listInteractions", [
    { runId: run.id },
  ])) as InteractionRequest[];
  assert.ok(request);
  await assert.rejects(cli(["interaction", "respond", request.id]), hasCode(2));
  assert.equal(
    (
      (await f.call("getInteraction", [request.id])) as {
        responses: readonly unknown[];
      }
    ).responses.length,
    0,
  );
  await assert.rejects(
    cli(["status", run.id, "--watch", "--timeout", "0"]),
    hasCode(4),
  );
  assert.equal(
    ((await f.call("getRun", [run.id])) as RunView).status,
    "waiting",
  );
  const response = await cli([
    "interaction",
    "respond",
    request.id,
    "--value",
    "{}",
  ]);
  assert.equal(JSON.parse(response.stdout).data.requestStatus, "answered");
  assert.equal((await settle(f.call, run.id)).status, "succeeded");
});

test("resource pagination, UTF-8 blob fallback and full-resource size errors are explicit", async (t) => {
  const f = await fixture(t, "outcomes-outcome.ts.fixture", (text) =>
    text.replace(
      'await context.artifacts.write({ name: "report.bin", mediaType: "text/plain", data: "draft" });',
      'for (let i = 0; i < 21; i++) await context.artifacts.write({ name: "item-" + i, mediaType: "text/plain", data: "item" }); await context.artifacts.write({name:"invalid-utf8",mediaType:"text/plain",data:new Uint8Array([255,254])});',
    ),
  );
  const run = (await f.call("createRun", [
    { loom: f.loom, input: { mode: "pass", size: 7 * 1024 * 1024 } },
  ])) as RunView;
  await f.call("startRun", [run.id]);
  await settle(f.call, run.id);
  const client = await connected(t, f.dataDir);
  const first = await client.request({ method: "resources/list", params: {} });
  assert.equal(first.resources.length, 20);
  assert.ok(first.nextCursor);
  const second = await client.listResources({ cursor: first.nextCursor });
  assert.equal(second.resources.length, 3);
  assert.equal(second.nextCursor, undefined);
  const all = [...first.resources, ...second.resources];
  assert.equal(new Set(all.map((a) => a.uri)).size, 23);
  const invalid = all.find((a) => a.name === "invalid-utf8");
  assert.ok(invalid);
  const contents = (await client.readResource({ uri: invalid.uri }))
    .contents[0];
  assert.ok(contents && "blob" in contents);
  assert.equal(contents.blob, "//4=");
  const big = all.find((a) => a.mimeType === "application/octet-stream");
  assert.ok(big);
  await assert.rejects(
    client.readResource({ uri: big.uri }),
    (error: unknown) => {
      const e = error as {
        data: { code: string; details: { runId: string } };
        message: string;
      };
      assert.equal(e.data.code, "RESULT_TOO_LARGE");
      assert.equal(e.data.details.runId, run.id);
      assert.match(e.message, /intloom_artifact_read/);
      return true;
    },
  );
  await assert.rejects(
    client.listResources({ cursor: "garbage" }),
    hasCode(-32602),
  );
  await assert.rejects(
    client.listResources({
      cursor: Buffer.from(
        JSON.stringify({ catalog: "runs", after: "x" }),
      ).toString("base64url"),
    }),
    hasCode(-32602),
  );
});

test("incompatible form schema falls back unchanged and external wait resumes through MCP", async (t) => {
  const f = await fixture(
    t,
    "recovery-workflow.ts.fixture",
    () => `import {defineLoom,defineStep,defineWorkflow} from '@intloom/loom-sdk'; import {z} from 'zod';
  const review=defineStep({id:'review',inputSchema:z.boolean(),outputSchema:z.boolean(),suspendSchema:z.string(),resumeSchema:z.object({nested:z.object({approved:z.boolean()})}),interaction:{message:({suspendData})=>suspendData},execute:async({resumeData,suspend})=>resumeData===undefined?suspend('Nested question'):resumeData.nested.approved});
  const external=defineStep({id:'external',inputSchema:z.boolean(),outputSchema:z.boolean(),suspendSchema:z.string(),resumeSchema:z.boolean(),execute:async({resumeData,suspend})=>resumeData===undefined?suspend('External signal'):resumeData});
  export default defineLoom({id:'mcp-nested',version:'1.0.0',description:'Nested review then external wait',entry:defineWorkflow({id:'flow',inputSchema:z.boolean(),outputSchema:z.boolean()}).then(review).then(external).commit()});`,
  );
  const run = (await f.call("createRun", [
    { loom: f.loom, input: false },
  ])) as RunView;
  await f.call("startRun", [run.id]);
  await settle(f.call, run.id);
  const request = (
    (await f.call("listInteractions", [
      { runId: run.id },
    ])) as InteractionRequest[]
  )[0];
  assert.ok(request);
  const client = await connected(t, f.dataDir, true);
  const fallback = result<{ reason: string; request: InteractionRequest }>(
    await client.callTool({
      name: "intloom_interaction_prompt",
      arguments: { requestId: request.id },
    }),
  );
  assert.equal(fallback.reason, "schema_not_supported");
  assert.deepEqual(fallback.request.answerSchema, request.answerSchema);
  result(
    await client.callTool({
      name: "intloom_interaction_respond",
      arguments: {
        requestId: request.id,
        response: { action: "submit", value: { nested: { approved: false } } },
      },
    }),
  );
  const waiting = await settle(f.call, run.id);
  assert.equal(waiting.waits[0]?.kind, "external");
  result(
    await client.callTool({
      name: "intloom_run_resume",
      arguments: {
        runId: run.id,
        waitId: waiting.waits[0]?.waitId,
        resumeData: false,
      },
    }),
  );
  assert.equal((await settle(f.call, run.id)).status, "succeeded");
  assert.equal(
    ((await f.call("getRunResult", [run.id])) as RunResult).output,
    false,
  );
});

test("CLI interrupted observation preserves the wait; invalid answers exit 2", async (t) => {
  const f = await fixture(t, "recovery-workflow.ts.fixture");
  const { run, request } = await waitRun(f);
  const child = spawn(
    process.execPath,
    [...cliArgs(binary, f.dataDir), "status", run.id, "--watch", "--plain"],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  t.after(() => child.kill("SIGKILL"));
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk;
  });
  const [watching] = await once(child.stderr, "data");
  assert.match(String(watching), /Run|Intloom/);
  child.kill("SIGINT");
  assert.equal((await once(child, "exit"))[0], 130);
  assert.equal(JSON.parse(output).data.run.status, "waiting");
  assert.equal(
    ((await f.call("getRun", [run.id])) as RunView).status,
    "waiting",
  );
  await assert.rejects(
    exec(process.execPath, [
      ...cliArgs(binary, f.dataDir),
      "interaction",
      "respond",
      request.id,
      "--value",
      '{"add":"bad"}',
      "--plain",
    ]),
    (error: unknown) => (error as { code: number }).code === 2,
  );
  assert.equal(
    (
      (await f.call("getInteraction", [request.id])) as {
        responses: readonly unknown[];
      }
    ).responses.length,
    0,
  );
});

test("export digest failure preserves destination; oversized result identifies the original Run", async (t) => {
  const f = await fixture(t);
  const run = (await f.call("createRun", [
    { loom: f.loom, input: { mode: "pass", size: 8 } },
  ])) as RunView;
  await f.call("startRun", [run.id]);
  await settle(f.call, run.id);
  const artifact = (
    (await f.call("listArtifacts", [{ runId: run.id }])) as {
      items: ArtifactRecord[];
    }
  ).items.find((a) => a.mediaType === "application/octet-stream");
  assert.ok(artifact);
  const destination = join(f.directory, "keep.txt");
  await writeFile(destination, "keep");
  const { location } = await f.call("getRun", [run.id]);
  assert.ok(location);
  await writeFile(
    join(location.dataDir, "artifacts", artifact.id),
    new Uint8Array(8),
  );
  await assert.rejects(
    exec(process.execPath, [
      ...cliArgs(binary, f.dataDir),
      "artifact",
      "export",
      artifact.id,
      "--out",
      destination,
      "--overwrite",
      "--plain",
    ]),
  );
  assert.equal(await readFile(destination, "utf8"), "keep");
  assert.ok(
    !(await readdir(f.directory)).some((name) =>
      name.startsWith(".intloom-export-"),
    ),
  );
  const big = await fixture(
    t,
    "outcomes-outcome.ts.fixture",
    () =>
      `import {defineCode,defineLoom} from '@intloom/loom-sdk';import {z} from 'zod';export default defineLoom({id:'large-output',version:'1.0.0',description:'Large output',entry:defineCode({id:'big',inputSchema:z.number(),outputSchema:z.string(),execute:({inputData})=>'x'.repeat(inputData)})});`,
  );
  const large = (await big.call("createRun", [
    { loom: big.loom, input: 8 * 1024 * 1024 },
  ])) as RunView;
  await big.call("startRun", [large.id]);
  for (let i = 0; i < 500; i++) {
    const events = (await big.call("listRunEvents", [{ runId: large.id }])) as {
      items: readonly { type: string }[];
    };
    if (events.items.some((event) => event.type === "run.succeeded")) break;
    await delay(10);
  }
  const client = await connected(t, big.dataDir);
  const reply = await client.callTool({
    name: "intloom_run_result",
    arguments: { runId: large.id },
  });
  assert.equal(reply.isError, true);
  const error = (
    reply.structuredContent as {
      error: { code: string; details: { runId: string } };
    }
  ).error;
  assert.equal(error.code, "RESULT_TOO_LARGE");
  assert.equal(error.details.runId, large.id);
  assert.deepEqual((await client.listResources()).resources, []);
});

test("CLI, MCP and API track only accepted file references", async (t) => {
  const f = await fixture(
    t,
    undefined,
    () => `
    import {defineLoom,defineCode,InputFileRefSchema} from "@intloom/loom-sdk"; import {z} from "zod";
    export default defineLoom({id:"file-contract",version:"1.0.0",description:"files",
      entry:defineCode({id:"main",inputSchema:z.object({amount:z.number(),file:InputFileRefSchema.optional()}),
      outputSchema:z.number(), execute:({inputData})=>inputData.amount})});`,
  );
  const mcp = await connected(t, f.dataDir);
  const missing = {
    kind: "input-file",
    path: join(f.directory, "missing.txt"),
  };
  for (const key of ["irrelevant", "file"]) {
    const input = { amount: 15, [key]: missing };
    const cli = await exec(
      process.execPath,
      [
        ...cliArgs(binary, f.dataDir),
        "run",
        "create",
        "file-contract",
        "--input",
        JSON.stringify(input),
        "--plain",
      ],
      { cwd: f.directory },
    );
    const runs = [
      JSON.parse(cli.stdout).data as RunView,
      await f.host.kernel.createRun({ loom: f.loom, input }),
      result<RunView>(
        await mcp.callTool({
          name: "intloom_run_create",
          arguments: { loom: f.loom, input },
        }),
      ),
    ];
    for (const run of runs) {
      await f.call("startRun", [run.id]);
      const settled = await settle(f.call, run.id);
      if (key === "file")
        assert.equal(settled.error?.code, "INPUT_FILE_MISSING");
      else assert.equal(settled.output, 15);
    }
  }
});
