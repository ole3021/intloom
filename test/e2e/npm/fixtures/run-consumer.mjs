import assert from "node:assert/strict";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openKernel } from "@intloom/kernel";
import { runResultSchema } from "@intloom/loom-sdk";

const root = await realpath(
  await mkdtemp(join(tmpdir(), "intloom-run-consumer-")),
);
const dataDir = join(root, "data");
const kernel = await openKernel({ dataDir, cancellationGraceMs: 150 });
try {
  for (const scope of ["intloom", "workspace"]) {
    const name = `@intloom-example/code-report${scope === "workspace" ? "-workspace" : ""}`;
    const installation = await kernel.registerInstallation({
      directory: process.cwd(),
      packagePath: `node_modules/${name}`,
      source: "independent archived Code Run",
    });
    const workspace = join(root, "workspace");
    if (scope === "workspace") await mkdir(workspace);
    const { runId } = await kernel.startRun({
      package: installation.package,
      input: { prompt: `Archived report: ${scope}` },
      ...(scope === "workspace" ? { workDir: workspace } : {}),
    });
    const result = await kernel.waitRun(runId);
    assert.equal(result.execution.status, "succeeded", JSON.stringify(result));
    assert.equal(result.outputs.status, "ready");
    assert.deepEqual(runResultSchema.parse(result), result);
    assert.equal(
      await readFile(result.outputs.result.summary.path, "utf8"),
      `# Report\n\nArchived report: ${scope}\n`,
    );
    const run = await kernel.getRun(runId);
    assert.equal(run.scope, scope);
    if (scope === "workspace") assert.equal(run.workDir, workspace);
    await assert.rejects(stat(run.tempDir), { code: "ENOENT" });
    assert.equal(
      (await kernel.getExecution(run.entryExecutionId)).completion.result
        .status,
      "succeeded",
    );
    const events = [];
    for await (const event of kernel.observeRun(runId)) events.push(event);
    assert.equal(events.at(-1).type, "finished");
  }

  const prepared = join(root, "prepared-probe");
  await mkdir(prepared);
  await cp(
    join(process.cwd(), "node_modules"),
    join(prepared, "node_modules"),
    { recursive: true, verbatimSymlinks: true },
  );
  const identity = { name: "@fixture/archived-runtime", version: "1.0.0" };
  await writeFile(
    join(prepared, "package.json"),
    JSON.stringify({ ...identity, type: "module", loom: "./loom.json" }),
  );
  await writeFile(
    join(prepared, "loom.json"),
    JSON.stringify({
      schemaVersion: "0.5",
      package: identity,
      name: "Archived runtime probe",
      entry: { module: "main.js", export: "default", kind: "code" },
      execution: { scope: "intloom" },
      resources: [],
      skills: [],
    }),
  );
  await writeFile(
    join(prepared, "main.js"),
    `
    import { z } from "zod";
    import { readFile } from "node:fs/promises";
    import { withTempDir, ExecutionRejectedError, ExecutionCancelledError, TextEncodingError } from "@intloom/loom-sdk";
    export default async function main(input, context) {
      if (input.prompt === "block" || input.prompt === "cancel") {
        try { await context.user.ask({ question: "Stop?", mode: "confirm" }); }
        catch (error) {
          if (!(error instanceof ExecutionCancelledError)) throw new Error("cancellation identity lost");
          if (input.prompt === "block") { while (true) {} }
          throw error;
        }
      }
      try { await context.exec(async (_, child) => child.reject({ reason: "typed rejection" }), {}); }
      catch (error) { if (!(error instanceof ExecutionRejectedError)) throw new Error("rejection identity lost"); }
      try { await context.fs.write({ path: "invalid.txt", content: String.fromCharCode(0xd800) }); }
      catch (error) { if (!(error instanceof TextEncodingError)) throw new Error("encoding error identity lost"); }
      const prefix = "closure";
      const value = await context.exec(async value => prefix + value, "-kept");
      if (value !== "closure-kept") throw new Error("closure");
      const answer = await context.user.ask({
        question: "Exact?", mode: "text",
        schema: z.string().refine(value => value === "correct", "Exact answer required"),
      });
      if (answer.value !== "correct") throw new Error("answer");
      try { await readFile(input.prompt); throw new Error("direct access escaped"); }
      catch (error) { if (error.code !== "ERR_ACCESS_DENIED") throw error; }
      await withTempDir(context, async cwd => {
        const receipt = await context.process.run({ command: process.execPath, args: ["-e", "console.log('archived command')"], cwd });
        if (receipt.stdout.trim() !== "archived command") throw new Error("command");
      });
      await context.store.set("success", true);
    }
  `,
  );
  const installation = await kernel.registerInstallation({
    directory: prepared,
    packagePath: ".",
  });
  const external = join(root, "input.txt");
  await writeFile(external, "ungranted");
  const { runId } = await kernel.startRun({
    package: identity,
    input: { prompt: external },
  });
  let retried = false;
  for await (const event of kernel.observeRun(runId)) {
    if (event.type !== "interaction" || event.data.status !== "pending")
      continue;
    if (event.data.kind === "authorization")
      await kernel.submitAnswer(event.data.id, "once");
    else if (!retried) {
      retried = true;
      const result = await kernel.submitAnswer(event.data.id, {
        status: "answered",
        value: "wrong",
      });
      assert.equal(result.status, "pending");
      assert.match(result.interaction.issues[0].message, /Exact answer/);
    } else
      await kernel.submitAnswer(event.data.id, {
        status: "answered",
        value: "correct",
      });
  }
  assert.equal((await kernel.waitRun(runId)).execution.status, "succeeded");
  assert.equal(
    await (await kernel.getStore(identity.name)).get("success"),
    true,
  );
  for (const prompt of ["cancel", "block"]) {
    const blocking = await kernel.startRun({
      package: installation.package,
      input: { prompt },
    });
    for await (const event of kernel.observeRun(blocking.runId)) {
      if (event.type === "interaction") {
        await kernel.cancelRun(blocking.runId);
        break;
      }
    }
    assert.equal(
      (await kernel.waitRun(blocking.runId)).execution.status,
      "cancelled",
    );
    const run = await kernel.getRun(blocking.runId);
    assert.equal(
      (await kernel.getExecution(run.entryExecutionId)).completion.result
        .status,
      "cancelled",
    );
  }
  await kernel.close();
  const reopened = await openKernel({ dataDir });
  try {
    assert.equal((await reopened.waitRun(runId)).execution.status, "succeeded");
  } finally {
    await reopened.close();
  }
  console.log(
    `Kernel Run archive consumer passed on ${process.platform} ${process.version}: intloom/workspace, closures, Zod retries, Node permissions, approved command, Store, forced cancellation and reopen.`,
  );
} finally {
  await kernel.close();
  await rm(root, { recursive: true, force: true });
}
