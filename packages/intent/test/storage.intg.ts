import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import type { Blueprint, ExecutableCode } from "@intloom/kernel";
import { openFileStorage } from "@intloom/kernel/storage/file";
import { openSqliteStorage } from "@intloom/kernel/storage/sqlite";
import { runtime } from "./runtime.ts";

async function compiledCodes() {
  const output = await import("@intloom/workflow-intent");
  const blueprint: Blueprint = output.blueprint;
  const codes: Readonly<Record<string, ExecutableCode>> = output.codes;
  const stage = blueprint.stages.specification;
  assert.ok(stage);
  return (name: string) => {
    const step = stage.steps[name];
    assert.ok(step);
    if (step.execution.kind !== "code") throw new Error("Expected Code");
    const execute = codes[step.execution.codeId];
    assert.ok(execute);
    return execute;
  };
}

for (const backend of ["file", "sqlite"] as const) {
  test(`compiled Intent finalize with ${backend}: durable commit survives clear failure without duplicate submission`, async () => {
    const root = await mkdtemp(join(tmpdir(), "intent-storage-"));
    const open = () =>
      backend === "file"
        ? openFileStorage({ directory: root })
        : openSqliteStorage({
            filename: join(root, "store.sqlite"),
            projectId: "intent",
          });
    const handle = await open();
    try {
      const code = await compiledCodes();
      const fixture = runtime();
      const access = { ...fixture.access, storage: handle.access };
      access.interaction.confirm = async () => ({ isConfirmed: true });
      await code("init")(null, access);
      assert.deepEqual(await code("check")(null, access), { outcome: "ready" });
      await code("confirm")(null, access);
      fixture.flags.failClear = true;
      await assert.rejects(
        async () => code("finalize")(null, access),
        /clear failed/,
      );
      assert.ok(fixture.state);
      const artifact = await handle.access.getArtifact(
        "intent",
        "specification",
      );
      assert.ok(artifact);
      assert.ok(await handle.access.getRecordById("RUN-test"));
      fixture.flags.failClear = false;
      await code("finalize")(null, access);
      assert.equal(fixture.state, undefined);
      assert.deepEqual(
        await handle.access.getArtifactById(artifact.id),
        artifact,
      );
      assert.equal((await handle.access.listRecords({})).data.length, 1);
      await handle.dispose();
      const reopened = await open();
      try {
        assert.deepEqual(
          await reopened.access.getArtifactById(artifact.id),
          artifact,
        );
      } finally {
        await reopened.dispose();
      }
    } finally {
      await handle.dispose();
      await rm(root, { recursive: true, force: true });
    }
  });
  test(`compiled Intent finalize with ${backend}: a competing record rolls back the Artifact and retains State`, async () => {
    const root = await mkdtemp(join(tmpdir(), "intent-conflict-"));
    const handle =
      backend === "file"
        ? await openFileStorage({ directory: root })
        : await openSqliteStorage({
            filename: join(root, "store.sqlite"),
            projectId: "intent",
          });
    try {
      const code = await compiledCodes();
      const fixture = runtime();
      const access = {
        ...fixture.access,
        storage: {
          ...handle.access,
          commit: async (
            operations: Parameters<typeof handle.access.commit>[0],
          ) => {
            // A competing writer wins after finalize's baseline reads, before its real transaction.
            await handle.access.commit([
              {
                type: "append_record",
                id: "RUN-test",
                payload: {
                  flowName: "intent",
                  stageName: "specification",
                  data: "competing record",
                },
              },
            ]);
            return handle.access.commit(operations);
          },
        },
      };
      access.interaction.confirm = async () => ({ isConfirmed: true });
      await code("init")(null, access);
      await code("check")(null, access);
      await code("confirm")(null, access);
      const before = fixture.state;
      await assert.rejects(async () => code("finalize")(null, access), {
        code: "CONFLICT",
      });
      assert.deepEqual(fixture.state, before);
      assert.equal(
        await handle.access.getArtifact("intent", "specification"),
        undefined,
      );
      assert.equal(
        (await handle.access.getRecordById("RUN-test"))?.data,
        "competing record",
      );
    } finally {
      await handle.dispose();
      await rm(root, { recursive: true, force: true });
    }
  });
}
