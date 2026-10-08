import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import { connectProject } from "@intloom/cli";
import { openFileStorage } from "@intloom/kernel/storage/file";
import { openSqliteStorage } from "@intloom/kernel/storage/sqlite";
import { artifact, artifactWorkflow } from "./artifact-fixture.ts";
import {
  bin,
  cli,
  mcpClient,
  projectFixture,
  refreshFixtureInstallation,
} from "./project-fixture.ts";

const execute = promisify(execFile);

for (const backend of ["file", "sqlite"] as const)
  test(`${backend}: built CLI and MCP read/export current Artifacts across updates and restart`, {
    timeout: 60_000,
  }, async (t) => {
    const root = await projectFixture(t, true, backend);
    await writeFile(
      join(
        root,
        ".intloom/workflows/node_modules/fixture-workflow/workflow.js",
      ),
      artifactWorkflow,
    );
    await refreshFixtureInstallation(root);
    const storage =
      backend === "file"
        ? await openFileStorage({
            directory: join(root, "intloom"),
            layout: "directories",
          })
        : await openSqliteStorage({
            filename: join(root, "intloom/storage.sqlite"),
            projectId: "project",
          });
    const otherId = "ART-other's $(touch marker)";
    try {
      await storage.access.commit([
        {
          type: "create_artifact",
          id: artifact.id,
          payload: {
            flowName: artifact.flowName,
            stageName: artifact.stageName,
            data: artifact.data,
          },
        },
        {
          type: "create_artifact",
          id: "ART-solution",
          payload: {
            flowName: "fixture",
            stageName: "solution",
            data: { text: "large data ".repeat(1000) },
          },
        },
        {
          type: "create_artifact",
          id: otherId,
          payload: {
            flowName: "other",
            stageName: "first",
            data: { independent: true },
          },
        },
        {
          type: "append_record",
          id: "REC-seeded",
          payload: {
            flowName: "fixture",
            stageName: "first",
            data: { previous: true },
          },
        },
      ]);
    } finally {
      await storage.dispose();
    }
    const started = await cli(root, ["start", "--json"]);
    assert.equal(started.code, 0, started.stdout);
    const client = await connectProject(root);
    t.after(() => client.close());
    const before = await client.getArtifact({ artifactId: artifact.id });
    assert.ok(before);
    assert.deepEqual(before.data, artifact.data);
    assert.deepEqual(
      await client.getArtifact({ flowName: "fixture", stageName: "first" }),
      before,
    );
    assert.equal(await client.getArtifact({ artifactId: "missing" }), null);
    assert.deepEqual(await client.listRuns(), []);

    const page = await client.listArtifacts({ flowName: "fixture", limit: 1 });
    assert.equal(page.data.length, 1);
    assert.ok(page.nextCursor);
    assert.ok(page.data.every((row) => !("data" in row)));
    const next = await client.listArtifacts({
      flowName: "fixture",
      limit: 1,
      cursor: page.nextCursor,
    });
    assert.equal(next.data.length, 1);
    assert.notEqual(page.data[0]?.id, next.data[0]?.id);
    assert.equal(next.nextCursor, undefined);
    await assert.rejects(
      client.listArtifacts({
        flowName: "other",
        limit: 1,
        cursor: page.nextCursor,
      }),
      { code: "INVALID_REQUEST" },
    );
    const stage = await client.listArtifacts({ stageName: "first" });
    assert.equal(stage.data.length, 2);
    assert.ok(stage.data.every((row) => row.stageName === "first"));
    assert.deepEqual(await client.listArtifacts({ flowName: "empty" }), {
      data: [],
    });

    const { client: protocol } = await mcpClient(t, root);
    const tools = await protocol.listTools();
    for (const name of ["get_artifact", "list_artifacts"]) {
      const tool = tools.tools.find((item) => item.name === name);
      assert.equal(tool?.annotations?.readOnlyHint, true);
      assert.equal(tool?.annotations?.destructiveHint, false);
    }
    const detail = await protocol.callTool({
      name: "get_artifact",
      arguments: { flowName: "fixture", stageName: "first" },
    });
    assert.equal(detail.isError, undefined);
    assert.deepEqual(detail.structuredContent, { artifact: before });
    const listing = await protocol.callTool({
      name: "list_artifacts",
      arguments: { flowName: "fixture", limit: 1 },
    });
    assert.deepEqual(listing.structuredContent, { artifacts: page });
    const missing = await cli(root, ["artifact", "missing", "--json"]);
    assert.equal(missing.code, 0);
    assert.deepEqual(JSON.parse(missing.stdout), { artifact: null });
    const byPosition = await cli(root, [
      "artifact",
      "--flow",
      "fixture",
      "--stage",
      "first",
      "--json",
    ]);
    assert.deepEqual(JSON.parse(byPosition.stdout), { artifact: before });
    const list = await cli(root, [
      "artifacts",
      "--flow",
      "fixture",
      "--limit",
      "1",
      "--json",
    ]);
    assert.equal(list.code, 0);
    assert.deepEqual(JSON.parse(list.stdout), { artifacts: page });
    assert.equal(list.stdout.trim().split("\n").length, 1);
    assert.equal(list.stdout.includes("\u001b"), false);
    assert.doesNotMatch(list.stdout, /large data/u);
    for (const args of [
      ["artifact", artifact.id, "--flow", "fixture", "--stage", "first"],
      ["artifact", "--flow", "fixture"],
      ["artifact"],
      ["artifacts", "--limit", "0"],
      ["artifacts", "--limit", "201"],
      ["artifact", artifact.id, "--overwrite"],
    ]) {
      const invalid = await cli(root, [...args, "--json"]);
      assert.equal(invalid.code, 1, JSON.stringify(args));
      assert.equal(JSON.parse(invalid.stdout).error.code, "INVALID_REQUEST");
    }

    const local = join(root, "client directory");
    await mkdir(local);
    const filename = join(local, "\u9700\u6c42 with spaces.json");
    const exported = await execute(
      process.execPath,
      [
        bin,
        "--project",
        root,
        "artifact",
        artifact.id,
        "--output",
        "\u9700\u6c42 with spaces.json",
        "--json",
      ],
      { cwd: local, timeout: 20_000 },
    );
    assert.equal(JSON.parse(exported.stdout).outputFile, filename);
    assert.deepEqual(JSON.parse(await readFile(filename, "utf8")), before);
    const refused = await cli(root, [
      "artifact",
      artifact.id,
      "--output",
      filename,
      "--json",
    ]);
    assert.equal(refused.code, 1);
    assert.equal(JSON.parse(refused.stdout).error.code, "CLI_OUTPUT_EXISTS");
    assert.deepEqual(JSON.parse(await readFile(filename, "utf8")), before);
    const absentFile = join(local, "missing.json");
    const absent = await cli(root, [
      "artifact",
      "missing",
      "--output",
      absentFile,
      "--json",
    ]);
    assert.equal(absent.code, 1);
    assert.equal(JSON.parse(absent.stdout).error.code, "NOT_FOUND");
    assert.deepEqual(await readdir(local), ["\u9700\u6c42 with spaces.json"]);
    assert.deepEqual(
      await client.getArtifact({ artifactId: artifact.id }),
      before,
    );
    assert.deepEqual(await client.listRuns(), []);

    const first = await cli(root, [
      "flow",
      "fixture",
      "--intent",
      "Todo first iteration",
      "--json",
    ]);
    assert.equal(first.code, 0, first.stdout);
    assert.equal(first.stdout.trim().split("\n").length, 1);
    const firstRun = JSON.parse(first.stdout).run;
    assert.equal(firstRun.status, "completed");
    const firstRecord = await client.getRecord(`REC-${firstRun.runId}`);
    assert.notEqual(firstRecord, null);
    assert.equal(await client.getRecord(firstRun.runId), null);
    const second = await cli(root, [
      "flow",
      "fixture",
      "--intent",
      "Todo second iteration",
    ]);
    assert.equal(second.code, 0, second.stdout);
    assert.match(second.stdout, /Completed/u);
    assert.match(second.stdout, /Current committed artifacts at query time/u);
    assert.match(second.stdout, /intloom artifact ART-todo/u);
    assert.match(second.stdout, /intloom artifacts --flow fixture/u);
    assert.match(second.stdout, /--project/u);
    assert.doesNotMatch(second.stdout, /REC-|committed by this Run/u);
    const current = await client.getArtifact({ artifactId: artifact.id });
    assert.ok(current);
    assert.ok(current.revision > before.revision);
    assert.equal(
      current.data &&
        typeof current.data === "object" &&
        "title" in current.data
        ? current.data.title
        : undefined,
      "Todo second iteration",
    );
    assert.deepEqual(
      await client.getRecord(`REC-${firstRun.runId}`),
      firstRecord,
    );
    assert.notEqual(await client.getRecord("REC-seeded"), null);
    const overwritten = await cli(root, [
      "artifact",
      artifact.id,
      "--output",
      filename,
      "--overwrite",
      "--json",
    ]);
    assert.equal(overwritten.code, 0, overwritten.stdout);
    assert.deepEqual(JSON.parse(await readFile(filename, "utf8")), current);
    assert.deepEqual(
      await client.getArtifact({ artifactId: artifact.id }),
      current,
    );
    assert.deepEqual(await readdir(local), ["\u9700\u6c42 with spaces.json"]);
    const completedRuns = await client.listRuns();
    await cli(root, ["artifacts", "--json"]);
    assert.deepEqual(await client.listRuns(), completedRuns);
    await client.close();
    await protocol.close();
    assert.equal((await cli(root, ["stop", "--json"])).code, 0);
    const offline = await cli(root, ["artifact", artifact.id, "--json"]);
    assert.equal(offline.code, 1);
    assert.equal(JSON.parse(offline.stdout).error.code, "CLI_SERVICE_OFFLINE");
    assert.equal((await cli(root, ["start", "--json"])).code, 0);
    const restarted = await connectProject(root);
    try {
      assert.deepEqual(await restarted.listRuns(), []);
      assert.deepEqual(
        await restarted.getArtifact({ artifactId: artifact.id }),
        current,
      );
      assert.deepEqual(
        await restarted.getRecord(`REC-${firstRun.runId}`),
        firstRecord,
      );
    } finally {
      await restarted.close();
    }
  });
