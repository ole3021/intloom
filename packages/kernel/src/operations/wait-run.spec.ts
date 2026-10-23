import assert from "node:assert/strict";
import { getEventListeners } from "node:events";
import { test } from "node:test";
import { view } from "../../test/interaction-fixture.ts";
import type { RunView } from "../runtime/run-view.ts";
import { waitForRun } from "./wait-run.ts";

test("an immediate waiting snapshot resolves and unsubscribes exactly once", async () => {
  let unsubscribed = 0;
  const controller = new AbortController();
  const result = await waitForRun(
    {
      watchRun(id, observe) {
        assert.equal(id, view.runId);
        observe(view);
        return () => {
          unsubscribed++;
        };
      },
    },
    view.runId,
    controller.signal,
  );
  assert.equal(result, view);
  assert.equal(unsubscribed, 1);
  assert.equal(getEventListeners(controller.signal, "abort").length, 0);
});

test("running snapshots keep observation open until an authoritative stable snapshot arrives", async () => {
  let observe: ((view: RunView) => void) | undefined;
  let unsubscribed = 0;
  const waiting = waitForRun(
    {
      watchRun(_id, listener) {
        observe = listener;
        const { pendingAction: _pendingAction, ...running } = view;
        listener({ ...running, status: "running" });
        return () => {
          unsubscribed++;
        };
      },
    },
    view.runId,
  );
  assert.equal(unsubscribed, 0);
  assert.ok(observe);
  observe(view);
  assert.equal(await waiting, view);
  assert.equal(unsubscribed, 1);
});

for (const alreadyAborted of [false, true]) {
  test(`observer cancellation releases only its subscription (already aborted: ${alreadyAborted})`, async () => {
    const controller = new AbortController();
    const reason = new Error("observer closed");
    let subscribed = 0;
    let unsubscribed = 0;
    if (alreadyAborted) controller.abort(reason);
    const waiting = waitForRun(
      {
        watchRun() {
          subscribed++;
          return () => {
            unsubscribed++;
          };
        },
      },
      view.runId,
      controller.signal,
    );
    controller.abort(reason);
    await assert.rejects(waiting, (error) => error === reason);
    assert.equal(subscribed, alreadyAborted ? 0 : 1);
    assert.equal(unsubscribed, subscribed);
    assert.equal(getEventListeners(controller.signal, "abort").length, 0);
  });
}

test("a failed subscription preserves the error and removes its abort listener", async () => {
  const controller = new AbortController();
  const reason = new Error("Run unavailable");
  await assert.rejects(
    waitForRun(
      {
        watchRun() {
          throw reason;
        },
      },
      view.runId,
      controller.signal,
    ),
    (error) => error === reason,
  );
  assert.equal(getEventListeners(controller.signal, "abort").length, 0);
});
