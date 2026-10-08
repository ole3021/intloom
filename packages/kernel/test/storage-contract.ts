import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import type { StorageHandle } from "../src/storage/contracts.ts";
import type { StorageOperation, StoragePayload } from "../src/storage/types.ts";

export const payload: StoragePayload = {
  flowName: "flow",
  stageName: "stage",
  data: { text: "original" },
};
export const create = {
  type: "create_artifact",
  id: "artifact",
  payload,
} satisfies StorageOperation;
export const append = {
  type: "append_record",
  id: "record",
  payload,
} satisfies StorageOperation;

const cleanups = new WeakMap<TestContext, (() => unknown)[]>();
export function storageCleanup(t: TestContext, cleanup: () => unknown): void {
  cleanups.get(t)?.push(cleanup);
}
export async function storageDirectory(t: TestContext): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "intloom-storage-"));
  const callbacks: (() => unknown)[] = [];
  cleanups.set(t, callbacks);
  t.after(async () => {
    try {
      for (const callback of callbacks.toReversed()) await callback();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  return root;
}

export function storageContract(
  name: string,
  open: (directory: string) => Promise<StorageHandle>,
): void {
  async function fixture(t: TestContext) {
    const directory = await storageDirectory(t);
    const handle = await open(directory);
    storageCleanup(t, () => handle.dispose());
    return { directory, handle, access: handle.access };
  }
  test(`${name}: input/output isolation, atomic content and persistent reopening`, async (t) => {
    const { directory, access, handle } = await fixture(t);
    assert.equal(await access.getArtifact("flow", "stage"), undefined);
    assert.equal(await access.getLatestRecord("flow", "stage"), undefined);
    const input = { ...payload, data: { text: "saved" } };
    const pending = access.commit([{ ...create, payload: input }, append]);
    input.data.text = "changed";
    const result = await pending;
    const artifact = result.writtenArtifacts[0];
    assert.ok(artifact);
    assert.deepEqual(artifact.data, { text: "saved" });
    assert.equal(artifact.createdAt, artifact.updatedAt);
    (artifact.data as { text: string }).text = "mutated return";
    assert.deepEqual((await access.getArtifactById("artifact"))?.data, {
      text: "saved",
    });
    assert.equal((await access.getLatestRecord("flow", "stage"))?.id, "record");
    await handle.dispose();
    const reopened = await open(directory);
    storageCleanup(t, () => reopened.dispose());
    assert.deepEqual(
      (await reopened.access.getArtifact("flow", "stage"))?.data,
      { text: "saved" },
    );
    assert.deepEqual(
      (await reopened.access.getRecordById("record"))?.data,
      payload.data,
    );
  });
  test(`${name}: stage uniqueness, category identity and immutable ownership`, async (t) => {
    const { access } = await fixture(t);
    const saved = await access.commit([create, { ...append, id: "artifact" }]);
    const revision = saved.writtenArtifacts[0]?.revision;
    assert.ok(revision);
    await assert.rejects(access.commit([{ ...create, id: "other" }]), {
      code: "CONFLICT",
      retryable: false,
    });
    await assert.rejects(
      access.commit([
        { ...create, payload: { ...payload, stageName: "other" } },
      ]),
      { code: "CONFLICT" },
    );
    await assert.rejects(
      access.commit([
        {
          type: "replace_artifact",
          id: "artifact",
          expectedRevision: revision,
          payload: { ...payload, stageName: "other" },
        },
      ]),
      { code: "CONFLICT" },
    );
    await assert.rejects(access.commit([{ ...append, id: "artifact" }]), {
      code: "CONFLICT",
    });
    assert.equal((await access.listRecords({})).data.length, 1);
  });
  test(`${name}: rollback includes earlier writes and allocated revisions`, async (t) => {
    const { access } = await fixture(t);
    const initial = (await access.commit([create, append])).writtenArtifacts[0];
    assert.ok(initial);
    await assert.rejects(
      access.commit([
        {
          type: "replace_artifact",
          id: "artifact",
          expectedRevision: initial.revision,
          payload: { ...payload, data: "failed update" },
        },
        append,
      ]),
      { code: "CONFLICT" },
    );
    assert.deepEqual(await access.getArtifactById("artifact"), initial);
    await assert.rejects(
      access.commit([
        { ...append, id: "rolled-back" },
        {
          type: "replace_artifact",
          id: "artifact",
          expectedRevision: initial.revision + 10,
          payload,
        },
      ]),
      { code: "CONFLICT" },
    );
    assert.equal(await access.getRecordById("rolled-back"), undefined);
    const next = (
      await access.commit([
        {
          type: "replace_artifact",
          id: "artifact",
          expectedRevision: initial.revision,
          payload,
        },
      ])
    ).writtenArtifacts[0];
    assert.ok(next);
    assert.ok(next.revision > initial.revision);
    assert.equal(next.createdAt, initial.createdAt);
  });
  test(`${name}: delete/recreate never revives a stale version, including reopening`, async (t) => {
    const { access, handle, directory } = await fixture(t);
    const first = (await access.commit([create, append])).writtenArtifacts[0];
    assert.ok(first);
    await access.commit([
      { ...create, id: "other", payload: { ...payload, stageName: "other" } },
    ]);
    await assert.rejects(
      access.commit([
        {
          type: "remove_artifact",
          id: first.id,
          expectedRevision: first.revision + 1,
        },
      ]),
      { code: "CONFLICT" },
    );
    const removed = await access.commit([
      {
        type: "remove_artifact",
        id: first.id,
        expectedRevision: first.revision,
      },
      { type: "remove_record", id: "record" },
    ]);
    assert.deepEqual(removed.removedArtifactIds, [first.id]);
    assert.deepEqual(removed.removedRecordIds, ["record"]);
    assert.equal(await access.getArtifact("flow", "stage"), undefined);
    assert.equal(await access.getRecordById("record"), undefined);
    await handle.dispose();
    const reopened = await open(directory);
    storageCleanup(t, () => reopened.dispose());
    const second = (await reopened.access.commit([create])).writtenArtifacts[0];
    assert.ok(second);
    assert.ok(second.revision > first.revision);
    await assert.rejects(
      reopened.access.commit([
        {
          type: "replace_artifact",
          id: first.id,
          expectedRevision: first.revision,
          payload,
        },
      ]),
      { code: "CONFLICT" },
    );
  });
  test(`${name}: only one concurrent conditional update succeeds`, async (t) => {
    const { access } = await fixture(t);
    const artifact = (await access.commit([create])).writtenArtifacts[0];
    assert.ok(artifact);
    const updates = await Promise.allSettled(
      ["one", "two"].map((id) =>
        access.commit([
          {
            type: "replace_artifact",
            id: artifact.id,
            expectedRevision: artifact.revision,
            payload: { ...payload, data: id },
          },
          { ...append, id },
        ]),
      ),
    );
    assert.equal(updates.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal((await access.listRecords({})).data.length, 1);
  });
  test(`${name}: validates full batches and missing targets without partial writes`, async (t) => {
    const { access } = await fixture(t);
    assert.deepEqual(await access.commit([]), {
      writtenArtifacts: [],
      appendedRecords: [],
      removedArtifactIds: [],
      removedRecordIds: [],
    });
    await assert.rejects(access.getArtifactById(""), {
      code: "INVALID_REQUEST",
    });
    await assert.rejects(access.getRecordById(""), { code: "INVALID_REQUEST" });
    await assert.rejects(access.getLatestRecord("", "stage"), {
      code: "INVALID_REQUEST",
    });
    await assert.rejects(access.commit([create, create]), {
      code: "INVALID_REQUEST",
    });
    await assert.rejects(
      access.commit([
        create,
        { ...append, payload: { ...payload, data: Number.NaN } },
      ]),
      { code: "INVALID_REQUEST" },
    );
    for (const operation of [
      { type: "remove_record", id: "missing" },
      { type: "remove_artifact", id: "missing", expectedRevision: 1 },
      { type: "replace_artifact", id: "missing", expectedRevision: 1, payload },
    ] satisfies StorageOperation[])
      await assert.rejects(access.commit([append, operation]), {
        code: "NOT_FOUND",
      });
    assert.equal((await access.listArtifacts({})).data.length, 0);
    assert.equal((await access.listRecords({})).data.length, 0);
  });
  test(`${name}: stable cursor ordering, filters, boundary times and query binding`, async (t) => {
    const { access, directory } = await fixture(t);
    const ids = ["z", "a", "é", "😀", "\u4e2d"];
    await access.commit(ids.map((id) => ({ ...append, id })));
    const sorted = [...ids].sort((a, b) =>
      Buffer.compare(Buffer.from(a), Buffer.from(b)),
    );
    const first = await access.listRecords({ order: "created_asc", limit: 2 });
    assert.deepEqual(
      first.data.map((r) => r.id),
      sorted.slice(0, 2),
    );
    assert.ok(first.nextCursor);
    const rest = await access.listRecords({
      order: "created_asc",
      cursor: first.nextCursor,
    });
    assert.deepEqual(
      rest.data.map((r) => r.id),
      sorted.slice(2),
    );
    assert.equal(rest.nextCursor, undefined);
    assert.equal(
      (await access.getLatestRecord("flow", "stage"))?.id,
      sorted.at(-1),
    );
    const timestamp = first.data[0]?.createdAt;
    assert.ok(timestamp);
    assert.equal(
      (await access.listRecords({ createdAfter: timestamp })).data.length,
      0,
    );
    assert.equal(
      (await access.listRecords({ createdBefore: timestamp })).data.length,
      0,
    );
    assert.equal(
      (await access.listRecords({ flowName: "wrong" })).data.length,
      0,
    );
    assert.equal(
      (await access.listRecords({ stageName: "wrong" })).data.length,
      0,
    );
    assert.equal((await access.listRecords({ ids: [] })).data.length, 0);
    assert.equal(
      (await access.listRecords({ ids: ["a", "a"] })).data.length,
      1,
    );
    await assert.rejects(access.listRecords({ cursor: first.nextCursor }), {
      code: "INVALID_REQUEST",
    });
    await assert.rejects(
      access.listArtifacts({ order: "created_asc", cursor: first.nextCursor }),
      { code: "INVALID_REQUEST" },
    );
    const other = await open(join(directory, "other"));
    storageCleanup(t, () => other.dispose());
    await assert.rejects(
      other.access.listRecords({
        order: "created_asc",
        cursor: first.nextCursor,
      }),
      { code: "INVALID_REQUEST" },
    );
    for (const query of [
      { limit: 0 },
      { limit: 201 },
      { cursor: "broken" },
      { createdAfter: "yesterday" },
      { createdAfter: timestamp, createdBefore: timestamp },
    ]) {
      await assert.rejects(access.listRecords(query), {
        code: "INVALID_REQUEST",
      });
    }
  });
  test(`${name}: drains accepted writes, rejects new work, dispose is idempotent`, async (t) => {
    const { handle, access, directory } = await fixture(t);
    const write = access.commit([create, append]);
    const closing = handle.dispose();
    assert.equal(handle.dispose(), closing);
    await assert.rejects(access.commit([]), {
      code: "KERNEL_UNAVAILABLE",
      retryable: false,
    });
    await write;
    await closing;
    await assert.rejects(access.listRecords({}), {
      code: "KERNEL_UNAVAILABLE",
    });
    const next = await open(directory);
    storageCleanup(t, () => next.dispose());
    assert.equal((await next.access.listRecords({})).data.length, 1);
  });
}
