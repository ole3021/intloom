import assert from "node:assert/strict";
import { createServer } from "node:http";
import { lstat, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";
import { connectProject } from "@intloom/cli";
import {
  cli,
  connection,
  pending,
  projectFixture,
  untilRun,
} from "./project-fixture.ts";

async function crash(root: string) {
  const info = JSON.parse(
    await readFile(join(root, ".intloom/service.json"), "utf8"),
  );
  assert.equal(info.projectRoot, root);
  process.kill(info.pid, "SIGKILL");
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    try {
      process.kill(info.pid, 0);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ESRCH")
        return;
      throw error;
    }
    await delay(20);
  }
  assert.fail("The owned test host did not exit");
}

for (const backend of ["file", "sqlite"] as const)
  test(`${backend}: CLI diagnoses, previews and recovers a crashed host without changing durable data`, async (t) => {
    const root = await projectFixture(t, true, backend);
    assert.equal((await cli(root, ["start", "--json"])).code, 0);
    const client = await connectProject(root);
    const receipt = await client.run("fixture", {
      prompt: "recovery acceptance",
    });
    const waiting = await untilRun(
      client,
      receipt.runId,
      (run) => run.status === "waiting",
    );
    const confirmationReceipt = await client.answerAsk(
      waiting.runId,
      pending(waiting).id,
      [
        { questionId: "place", isSkipped: false, answer: "Local" },
        { questionId: "notes", isSkipped: true },
      ],
    );
    assert.equal(confirmationReceipt.status, "running");
    const confirming = await untilRun(
      client,
      waiting.runId,
      (run) =>
        run.status === "waiting" &&
        run.pendingAction?.id !== waiting.pendingAction?.id,
    );
    const doneReceipt = await client.answerAsk(
      waiting.runId,
      pending(confirming).id,
      {
        isConfirmed: true,
      },
    );
    assert.equal(doneReceipt.status, "running");
    const done = await untilRun(
      client,
      waiting.runId,
      (run) => run.status === "completed",
    );
    assert.equal(done.status, "completed");
    const record = await client.getRecord(done.runId);
    await client.close();
    const liveLock = await readFile(join(root, ".intloom/service.lock"));
    assert.equal((await cli(root, ["recover", "--json"])).code, 1);
    assert.deepEqual(
      await readFile(join(root, ".intloom/service.lock")),
      liveLock,
    );
    await crash(root);
    const dataFiles =
      backend === "file"
        ? ["store.json"]
        : ["storage.sqlite", "storage.sqlite-wal", "storage.sqlite-shm"];
    const saved = new Map<string, Buffer>();
    for (const filename of dataFiles) {
      const value = await readFile(join(root, "intloom", filename)).catch(
        () => undefined,
      );
      if (value) saved.set(filename, value);
    }
    const privateConnection = await readFile(
      join(root, ".intloom/connection.json"),
    );
    const availability = JSON.parse(
      (await cli(root, ["status", "--json"])).stdout,
    ).data;
    assert.equal(availability.status, "unavailable");
    const status = JSON.parse(
      (await cli(root, ["doctor", "--json"])).stdout,
    ).data;
    assert.equal(status.status, "recovery_required");
    assert.ok(
      status.owners.every(
        (owner: { status: string }) => owner.status === "absent",
      ),
    );
    const doctor = await cli(root, ["doctor", "--json"]);
    const { source, checks, ...serviceDiagnosis } = JSON.parse(
      doctor.stdout,
    ).data;
    const { source: _source, checks: _checks, ...expectedDiagnosis } = status;
    assert.deepEqual(serviceDiagnosis, expectedDiagnosis);
    assert.equal(source, "cli");
    assert.equal(
      checks.find((item: { name: string }) => item.name === "execution").status,
      "not_checked",
    );
    assert.ok(!doctor.stdout.includes((await connection(root)).token));
    const preview = await cli(root, ["recover", "--dry-run", "--json"]);
    assert.equal(preview.code, 0);
    assert.equal(JSON.parse(preview.stdout).data.dryRun, true);
    assert.equal(JSON.parse(preview.stdout).data.recovered, false);
    assert.deepEqual(
      await readFile(join(root, ".intloom/service.lock")),
      liveLock,
    );
    const recovered = await cli(root, ["recover", "--json"]);
    assert.equal(recovered.code, 0, recovered.stdout);
    assert.equal(JSON.parse(recovered.stdout).data.recovered, true);
    assert.deepEqual(
      await readFile(join(root, ".intloom/connection.json")),
      privateConnection,
    );
    for (const [filename, value] of saved)
      assert.deepEqual(await readFile(join(root, "intloom", filename)), value);
    for (const filename of [
      ".intloom/service.lock",
      ".intloom/service.json",
      ...(backend === "file" ? ["intloom/store.lock"] : []),
    ])
      await assert.rejects(lstat(join(root, filename)), {
        code: "ENOENT",
      });
    assert.equal(
      JSON.parse((await cli(root, ["status", "--json"])).stdout).data.status,
      "stopped",
    );
    assert.equal((await cli(root, ["start", "--json"])).code, 0);
    const next = await connectProject(root);
    try {
      assert.deepEqual(await next.getRecord(done.runId), record);
      const history = await next.listRuns();
      assert.deepEqual(
        history.map((run) => run.runId),
        [done.runId],
      );
      assert.equal(history[0]?.historical, true);
    } finally {
      await next.close();
    }
  });

test("recovery refuses a live storage owner and an occupied port; concurrent recovery/start preserves new locks", async (t) => {
  const root = await projectFixture(t, false);
  assert.equal((await cli(root, ["start", "--json"])).code, 0);
  await crash(root);
  const filename = join(root, "intloom/store.lock");
  const original = await readFile(filename, "utf8");
  await writeFile(
    filename,
    JSON.stringify({ ...JSON.parse(original), pid: process.pid }),
  );
  assert.equal((await cli(root, ["recover", "--json"])).code, 1);
  assert.equal(JSON.parse(await readFile(filename, "utf8")).pid, process.pid);
  await writeFile(filename, original);
  const server = createServer((_request, response) =>
    response.writeHead(503).end(),
  );
  const { port } = await connection(root);
  await new Promise<void>((resolve) =>
    server.listen(port, "127.0.0.1", resolve),
  );
  try {
    assert.equal((await cli(root, ["recover", "--json"])).code, 1);
    assert.equal(await readFile(filename, "utf8"), original);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  const results = await Promise.all([
    cli(root, ["recover", "--json"]),
    cli(root, ["recover", "--json"]),
    cli(root, ["start", "--json"]),
  ]);
  assert.ok(
    results.filter(
      (result) =>
        result.code === 0 && JSON.parse(result.stdout).data.recovered === true,
    ).length === 1,
  );
  for (const result of results)
    assert.ok(
      result.code === 0 ||
        [
          "CLI_RECOVERY_BLOCKED",
          "CLI_SERVICE_BUSY",
          "CLI_SERVICE_UNAVAILABLE",
          // Recovery's temporary port guard returns 503 while owning the port.
          "CLI_SERVICE_CLOSING",
        ].includes(JSON.parse(result.stdout).error.code),
      result.stdout,
    );
  assert.equal((await cli(root, ["start", "--json"])).code, 0);
  const availability = JSON.parse(
    (await cli(root, ["status", "--json"])).stdout,
  ).data;
  assert.equal(availability.status, "running");
  const status = JSON.parse(
    (await cli(root, ["doctor", "--json"])).stdout,
  ).data;
  assert.equal(
    JSON.parse(await readFile(join(root, ".intloom/service.lock"), "utf8"))
      .instanceId,
    status.service.instanceId,
  );
});
