// biome-ignore-all lint/suspicious/noUndeclaredEnvVars: The Node artifact tests run outside Turbo.
import { cliArgs, shutdown } from "./cli.mjs";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { mkdir, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
import { compileLoom, packLoom } from "@intloom/compiler";
import { serve } from "@intloom/kernel";

const archives = resolve(process.argv[2] ?? ".", "looms");
await mkdir(archives, { recursive: true });
for (const name of ["order-total", "reviewed-report"]) {
  const built = await compileLoom({
    entryFile: `examples/${name}/loom.ts`,
    outDir: `${name}-compiled`,
    target: "node22",
  });
  assert.ok(built.ok, JSON.stringify(built));
  const archive = join(archives, `${name}-${built.manifest.version}.tgz`);
  if (process.env.INTLOOM_REQUIRE_ARCHIVES !== "1")
    await packLoom({ artifactDir: built.artifactDir, outFile: archive });
  const cli = resolve("node_modules/.bin/intloom");
  if (name === "order-total") {
    const cwd = resolve("examples/order-total");
    const args = {
      cwd,
      encoding: "utf8",
    };
    const devData = resolve("dev-data");
    const command = (...argv) =>
      execFileSync(process.execPath, cliArgs(cli, devData, ...argv), args);
    try {
      command("dev", "build");
      const trial = JSON.parse(
        command("dev", "test", "--input", '{"prices":[19,23]}', "--plain"),
      );
      assert.equal(trial.data.output, 42);
      const status = JSON.parse(command("status", trial.data.id, "--plain"));
      assert.equal(status.data.result.output, 42);
      assert.equal(
        JSON.parse(command("dev", "publish", "--dry-run", "--plain")).data
          .published,
        false,
      );
    } finally {
      await shutdown(cli, devData);
    }
  }
  const report = JSON.parse(
    execFileSync(cli, ["loom", "describe", archive, "--plain"], {
      encoding: "utf8",
    }),
  ).data.root;
  assert.equal(report.artifactDigest, built.artifactDigest);
  assert.ok(report.files.includes("README.md"));
  assert.deepEqual(
    report.possibleInteractions,
    name === "reviewed-report"
      ? [{ workflow: "report-flow", step: "review", responsePolicy: "any" }]
      : [],
  );
  assert.match(
    execFileSync(cli, ["loom", "describe", archive], { encoding: "utf8" }),
    name === "reviewed-report" ? /report-flow\/review/ : /quantity.*default 1/,
  );
  await rm(`${name}-compiled`, { recursive: true });
}
await rm("examples", { recursive: true });
let host = await serve({ dataDir: "examples-data" });
try {
  const simple = await host.installLoom({
    source: join(archives, "order-total-1.0.0.tgz"),
  });
  const report = await host.installLoom({
    source: join(archives, "reviewed-report-1.0.0.tgz"),
  });
  const total = await host.createRun({
    loom: simple,
    input: { prices: [19, 23] },
  });
  await host.startRun(total.id);
  const reviews = [];
  for (const approved of [true, false]) {
    const run = await host.createRun({
      loom: report,
      input: { title: "Delivery", body: "Ready for review." },
    });
    reviews.push({ run, approved });
    await host.startRun(run.id);
  }
  await host.close();
  host = await serve({ dataDir: "examples-data" });
  assert.equal((await host.getRunResult(total.id)).output, 42);
  for (const { run, approved } of reviews) {
    assert.equal((await host.getRun(run.id)).status, "waiting");
    const [request] = await host.listInteractions({ runId: run.id });
    assert.equal(request.status, "pending");
    const artifacts = await host.listArtifacts({ runId: run.id });
    assert.equal(artifacts.items.length, 1);
    const artifact = artifacts.items[0];
    assert.equal(artifact.id, request.context.report.id);
    assert.equal(
      Buffer.from(
        (await host.readArtifact({ artifactId: artifact.id })).data,
      ).toString(),
      "# Delivery\n\nReady for review.\n",
    );
    const receipt = await host.respondInteraction(
      request.id,
      { action: "submit", value: { approved } },
      { source: { kind: "test", via: "api" } },
    );
    assert.equal(receipt.continuation.status, "requested");
  }
  await host.close();
  host = await serve({ dataDir: "examples-data" });
  for (const { run, approved } of reviews) {
    const result = await host.getRunResult(run.id);
    assert.equal(result.runStatus, "succeeded");
    assert.equal(result.quality, approved ? "passed" : "rejected");
    const [request] = await host.listInteractions({ runId: run.id });
    const interaction = await host.getInteraction(request.id);
    assert.equal(interaction.responses.length, 1);
    assert.equal(interaction.responses[0].source.kind, "test");
    const artifacts = await host.listArtifacts({ runId: run.id });
    assert.equal(
      artifacts.items.length,
      1,
      "The completed draft must not replay after restart",
    );
    assert.equal(result.output.deliverable.report.id, artifacts.items[0].id);
    assert.equal(
      (await host.getAcceptance(result.acceptance.id)).status,
      result.quality,
    );
  }
} finally {
  await host.close();
}
console.log(
  "examples-consumer: public Code and review examples, default input, exact archives, persisted waits, single draft, explicit test answers, passed/rejected quality and saved reports verified",
);
