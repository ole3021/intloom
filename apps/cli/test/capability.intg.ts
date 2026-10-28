import assert from "node:assert/strict";
import { test } from "node:test";
import { join } from "node:path";
import { compiledLoomProtocolVersion } from "@intloom/loom-sdk/compiled";
import { runtimeFixture } from "../../../packages/kernel/test/runtime-fixture.ts";
import { scaffoldLoom, compileLoom } from "@intloom/compiler";
import { cp, mkdir, appendFile } from "node:fs/promises";
import { connectProject, startService } from "@intloom/cli";
import {
  projectFixture,
  configureProject,
  refreshFixtureInstallation,
  untilRun,
  cli,
} from "./project-fixture.ts";

test("compiled capability accepts CLI JSON and resumes named confirmation through the public client without models", async (t) => {
  const root = await projectFixture(t, false);
  const source = join(root, "approved-capability");
  await scaffoldLoom(source);
  await appendFile(
    join(source, "loom.yaml"),
    `
interactions:
  approve:
    kind: confirm
    title: Approve result
    context: { type: string }
acceptance:
  confirmation: approve
`,
  );
  await compileLoom({ packageRoot: source });
  const installed = join(
    root,
    ".intloom/looms/node_modules/approved-capability",
  );
  await mkdir(installed, { recursive: true });
  await cp(join(source, "dist"), installed, { recursive: true });
  await configureProject(root, {
    llms: undefined,
    useMcpAgent: false,
    looms: [
      { name: "approved-capability", version: "1.0.0", sha256: "a".repeat(64) },
    ],
  });
  await refreshFixtureInstallation(root);
  await startService({ projectRoot: root });
  const client = await connectProject(root);
  t.after(() => client.close());
  const [available] = await client.listLooms();
  assert.ok(available?.isAvailable && available.contract);
  assert.deepEqual(available.contract.input, { type: "string", minLength: 1 });
  const started = await cli(root, [
    "run",
    "approved-capability",
    "--input",
    JSON.stringify("  deliver me  "),
    "--json",
  ]);
  assert.equal(started.code, 0, started.stdout + started.stderr);
  const runs = await client.listRuns();
  assert.equal(runs.length, 1);
  const run = runs[0];
  assert.ok(run);
  const waiting = await untilRun(
    client,
    run.runId,
    (run) => run.status === "waiting",
  );
  assert.equal(waiting.output, undefined);
  assert.equal(waiting.pendingAction?.kind, "user_ask_interaction");
  assert.ok(waiting.pendingAction);
  await assert.rejects(
    client.answerAsk(run.runId, waiting.pendingAction.id, { confirmed: "yes" }),
    { code: "INVALID_REQUEST" },
  );
  await client.answerAsk(run.runId, waiting.pendingAction.id, {
    confirmed: true,
  });
  const done = await untilRun(
    client,
    run.runId,
    (run) => run.status === "completed",
  );
  assert.equal(done.output, "deliver me");
});

test("compiled package loads through the public Host without model configuration and exposes its contract", async (t) => {
  const { scaffoldLoom, compileLoom } = await import("@intloom/compiler");
  const { cp, rm, mkdir } = await import("node:fs/promises");
  const { projectFixture } = await import(
    "../../../packages/kernel/test/project-fixture.ts"
  );
  const { initializeProject, createExecution } = await import(
    "@intloom/kernel/host"
  );
  const { listLooms } = await import(
    "../../../packages/kernel/src/operations/looms.ts"
  );
  const { run } = await import(
    "../../../packages/kernel/test/operations-harness.ts"
  );
  const project = await projectFixture(t),
    root = join(project.root, "source-capability");
  await scaffoldLoom(root);
  await compileLoom({ packageRoot: root });
  const destination = await project.add(
    "source-capability",
    "",
    false,
    compiledLoomProtocolVersion,
  );
  await rm(destination, { recursive: true });
  await mkdir(destination);
  await cp(join(root, "dist"), destination, { recursive: true });
  await project.configure({ useMcpAgent: false });
  const execution = await initializeProject(project.root, {
    storage: runtimeFixture().storage,
    executor: createExecution(),
  });
  t.after(() => execution.runtime.suspend());
  const available = await listLooms(execution);
  assert.equal(available[0]?.isAvailable, true, JSON.stringify(available));
  assert.ok(available[0]?.isAvailable && available[0].contract);
  const result = await run(
    execution,
    "source-capability",
    "  from application  ",
  );
  assert.equal(result.status, "completed");
  assert.equal(result.output, "from application");
});
