import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { buildPackage } from "../../packages/compiler/dist/index.js";
import { requestService } from "../../apps/cli/dist/service/client.js";
import { setTimeout as delay } from "node:timers/promises";
import { cliArgs, shutdown } from "../fixtures/cli.mjs";

const exec = promisify(execFile);
const root = fileURLToPath(new URL("../../", import.meta.url));
const bin = join(root, "apps/cli/dist/bin.js");

test("installed npm Looms compose by named command and retain one immutable child delivery", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "intloom-npm-command-"));
  const project = join(dir, "project"),
    parent = join(dir, "author"),
    data = join(dir, "data");
  await Promise.all([project, parent].map((path) => mkdir(path)));
  t.after(async () => {
    await shutdown(bin, data).catch(() => {});
    await rm(dir, { recursive: true, force: true });
  });
  const env = {
    ...process.env,
    npm_config_prefix: join(dir, "global"),
    npm_config_cache: join(dir, "cache"),
  };
  async function cli(...args: string[]) {
    const { stdout } = await exec(
      process.execPath,
      cliArgs(bin, data, ...args, "--plain"),
      { cwd: project, env },
    );
    const line = stdout.trim().split("\n").at(-1);
    assert.ok(line);
    return JSON.parse(line).data;
  }
  await writeFile(
    join(project, "package.json"),
    JSON.stringify({ name: "consumer", version: "1.0.0", private: true }),
  );
  const childRoot = join(root, "test/integration/fixtures/file-report");
  await cli("install", await buildPackage(childRoot, dir));
  await symlink(join(root, "node_modules"), join(parent, "node_modules"));
  await writeFile(
    join(parent, "package.json"),
    JSON.stringify({ name: "report-parent", version: "1.0.0", type: "module" }),
  );
  await writeFile(
    join(parent, "loom.yaml"),
    `name: Report parent
description: Delegate to the installed report writer.
looms: {file-report: "^0.4.0"}
commands:
  forward:
    description: Deliver the child report.
    entry: flow.ts
    input: {type: object, properties: {message: {type: string}}, required: [message]}
    output: Text file written by the child.
`,
  );
  await writeFile(
    join(parent, "flow.ts"),
    `import {defineWorkflow,loomCommandStep,ArtifactRefSchema} from "@intloom/loom-sdk";
import {z} from "zod";
export default defineWorkflow({id:"flow",inputSchema:z.object({message:z.string()}),outputSchema:ArtifactRefSchema}).then(loomCommandStep("report","file-report","write")).commit();`,
  );
  await cli("install", await buildPackage(parent, dir), "--project", project);
  assert.equal((await cli("run", "report-parent")).defaultCommand, "forward");
  const run = await cli(
    "run",
    "report-parent",
    "--input",
    '{"message":"one saved file"}',
  );
  assert.equal(run.status, "succeeded");
  const child = (await cli("status", run.output.runId)).run;
  assert.equal(child.parentRunId, run.id);
  assert.equal(child.loom.version, "0.4.0");
  assert.equal(child.command, "write");
  const saved = join(dir, "export.txt");
  await writeFile(
    join(child.location.dataDir, "work", child.id, "report.txt"),
    "changed",
  );
  await cli("artifact", "export", run.output.id, "--out", saved);
  assert.equal(await readFile(saved, "utf8"), "one saved file\n");
  assert.equal(
    dirname(child.location.directory),
    dirname(run.location.directory),
  );
  // Request confirmation on the parent: the candidate is the child's frozen file.
  const gated = await cli(
    "run",
    "create",
    "report-parent",
    "--confirm-delivery",
    "--input",
    '{"message":"review this version"}',
  );
  await cli("run", "start", gated.id);
  const status = async (expected: string) => {
    for (let i = 0; i < 200; i++) {
      const view = (await requestService(data, "getRun", [
        gated.id,
      ])) as import("../../packages/loom-sdk/dist/index.js").RunView;
      if (view.status === expected) return view;
      await delay(20);
    }
    throw Error(`Run did not reach ${expected}`);
  };
  const pending = await status("waiting");
  assert.equal(pending.deliveryStatus, "pending");
  const [request] = pending.pendingInteractionIds;
  assert.ok(request);
  const answer = {
    action: "submit" as const,
    value: { approved: false, reason: "Revise the report" },
  };
  await assert.rejects(
    requestService(data, "respondInteraction", [
      request,
      answer,
      { source: { kind: "agent", via: "api" } },
    ]),
    { code: "RESPONSE_SOURCE_NOT_ALLOWED" },
  );
  await requestService(data, "respondInteraction", [
    request,
    answer,
    { source: { kind: "human", via: "api", actorId: "simulated-reviewer" } },
  ]);
  const rejected = await status("succeeded");
  assert.equal(rejected.deliveryStatus, "rejected");
  assert.equal(rejected.output, undefined);
  const report = (await requestService(data, "getRunResult", [
    gated.id,
  ])) as import("../../packages/loom-sdk/dist/index.js").RunResult;
  assert.equal(report.rejectionReason, "Revise the report");
  assert.equal(report.outcome?.deliveries, undefined);
  assert.ok(report.candidate);
  assert.notEqual(report.candidate.runId, gated.id);
  await cli(
    "artifact",
    "export",
    report.candidate.id,
    "--out",
    join(dir, "rejected.txt"),
  );
  assert.equal(
    await readFile(join(dir, "rejected.txt"), "utf8"),
    "review this version\n",
  );
});
