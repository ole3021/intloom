import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { createOperationReceipts } from "./receipts.ts";
import { deferred, runtimeFixture } from "../../test/runtime-fixture.ts";
import { createRun } from "../runtime/create-run.ts";
import { toRunView } from "../runtime/to-run-view.ts";

function fixture() {
  const instance = randomUUID();
  const ledger = createOperationReceipts(instance);
  const request = {
    serviceInstanceId: instance,
    operationId: randomUUID(),
    kind: "run" as const,
    source: "cli" as const,
    parameters: { input: { prompt: "private" }, loomName: "fixture" },
  };
  const view = toRunView(
    createRun(runtimeFixture().blueprint, { prompt: "test" }),
  );
  return { instance, ledger, request, view };
}
test("pending duplicates share one application; canonical parameters and source bind the identity", async () => {
  const f = fixture();
  const gate = deferred();
  let calls = 0;
  const first = f.ledger.admit(f.request, async () => {
    calls++;
    await gate.promise;
    return { status: "applied", value: f.view };
  });
  assert.equal(
    (
      await f.ledger.admit(
        {
          ...f.request,
          parameters: { loomName: "fixture", input: { prompt: "private" } },
        },
        async () => {
          throw new Error("replayed");
        },
      )
    ).status,
    "pending",
  );
  for (const changed of [
    { ...f.request, source: "studio" as const },
    { ...f.request, parameters: { input: { prompt: "changed" } } },
  ])
    await assert.rejects(
      f.ledger.admit(changed, async () => {
        throw new Error("replayed");
      }),
      { code: "OPERATION_CONFLICT" },
    );
  gate.resolve();
  const accepted = await first;
  assert.equal(accepted.status, "accepted");
  assert.equal(calls, 1);
  assert.deepEqual(
    await f.ledger.admit(f.request, async () => {
      throw new Error("replayed");
    }),
    accepted,
  );
  assert.equal(JSON.stringify(accepted).includes("private"), false);
});
test("unknown effects remain indeterminate; instance turnover never repeats an old request", async () => {
  const f = fixture();
  const uncertain = await f.ledger.admit(f.request, async () => {
    throw new Error("PRIVATE_FAILURE");
  });
  assert.equal(uncertain.status, "indeterminate");
  assert.equal(JSON.stringify(uncertain).includes("PRIVATE_FAILURE"), false);
  assert.deepEqual(f.ledger.get(f.instance, f.request.operationId), {
    status: "found",
    receipt: uncertain,
  });
  assert.equal(f.ledger.get(f.instance, randomUUID()).status, "not_found");
  assert.equal(
    f.ledger.get(randomUUID(), f.request.operationId).status,
    "instance_changed",
  );
  await assert.rejects(
    f.ledger.admit(
      { ...f.request, serviceInstanceId: randomUUID() },
      async () => {
        throw new Error("replayed");
      },
    ),
    { code: "SERVICE_INSTANCE_CHANGED" },
  );
});
test("all accepted and rejected receipts remain queryable for the service lifetime", async () => {
  const f = fixture();
  const ids: string[] = [];
  for (let i = 0; i < 600; i++) {
    const operationId = randomUUID();
    ids.push(operationId);
    await f.ledger.admit({ ...f.request, operationId }, async () =>
      i % 2
        ? { status: "applied", value: f.view }
        : { status: "not_applied", error: new Error("validation") },
    );
  }
  for (const id of ids)
    assert.equal(f.ledger.get(f.instance, id).status, "found");
});
