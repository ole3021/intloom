import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  answerAsk,
  getRun,
  flow,
  cancelRun,
  type UserAskConfirmation,
} from "@intloom/kernel";
import { executionFixture, proposal, pending } from "./execution-fixture.ts";
import type { SpecificationArtifact } from "../schemas/specification-artifact.ts";
import type { SpecificationRecord } from "../schemas/specification-record.ts";
import type { SpecificationState } from "../schemas/specification-state.ts";

for (const backend of ["file", "sqlite"] as const) {
  describe(`Intent persistence (${backend})`, () => {
    test("actual initialization, Agent Tools, confirmation, commit and reopening", async (t) => {
      const f = await executionFixture(t, backend, {
        decide: (state) => ({ proposal: proposal(state), outcome: "ready" }),
      });
      const intent = "  Store requirements locally without cloud services.  ";
      const waiting = await flow(f.execution, "intent", intent);
      assert.equal(
        waiting.status,
        "waiting",
        JSON.stringify(waiting.lastError),
      );
      assert.equal(waiting.cursor.stepName, "confirm");
      assert.equal(waiting.pendingAction?.kind, "user_ask_confirmation");
      assert.ok(waiting.pendingAction);
      const context = (waiting.pendingAction.request as UserAskConfirmation)
        .context;
      assert.match(context, /^Specification ready to save/);
      assert.ok(context.includes(intent));
      assert.doesNotMatch(context, /"baseline"|"changes"|"record_refs"/);
      const access = f.accesses.at(-1);
      assert.ok(access);
      const snapshot = (access.state.value as SpecificationState).confirmation
        ?.context;
      assert.equal(snapshot?.id, waiting.runId);
      assert.equal(snapshot?.intent, intent);
      assert.equal((await f.handle.access.listRecords({})).data.length, 0);
      const completed = await answerAsk(
        f.execution,
        waiting.runId,
        waiting.pendingAction.id,
        { isConfirmed: true },
      );
      assert.equal(
        completed.status,
        "completed",
        JSON.stringify(completed.lastError),
      );
      assert.equal(completed.cursor.stepName, "finalize");
      assert.equal(completed.pendingAction, undefined);
      assert.equal(completed.lastError, undefined);
      assert.deepEqual(await getRun(f.execution, waiting.runId), completed);
      assert.deepEqual(
        f.codeCalls.map((call) => call.name),
        ["init", "check", "confirm", "finalize"],
      );
      const record = await f.handle.access.getRecordById(waiting.runId);
      const artifact = await f.handle.access.getArtifact(
        "intent",
        "specification",
      );
      assert.ok(record && artifact);
      assert.equal((record.data as SpecificationRecord).intent, intent);
      assert.deepEqual(
        (artifact.data as SpecificationArtifact).constraints[0]?.record_refs,
        [waiting.runId],
      );
      for (const access of f.accesses) {
        assert.equal(access.signal.aborted, true);
        assert.throws(() => access.state.value, {
          code: "EXECUTION_OWNERSHIP_LOST",
        });
      }
      await f.handle.dispose();
      const reopened = await f.open();
      try {
        assert.deepEqual(
          await reopened.access.getArtifactById(artifact.id),
          artifact,
        );
        assert.deepEqual(
          await reopened.access.getRecordById(waiting.runId),
          record,
        );
      } finally {
        await reopened.dispose();
      }
    });

    test("a stale confirmation cannot overwrite a concurrently committed Artifact", async (t) => {
      const f = await executionFixture(t, backend, {
        decide: (state) => ({ proposal: proposal(state), outcome: "ready" }),
      });
      const [a, b] = await Promise.all([
        flow(f.execution, "intent", "first writer"),
        flow(f.execution, "intent", "second writer"),
      ]);
      const actionA = pending(a, "user_ask_confirmation", "confirm");
      const actionB = pending(b, "user_ask_confirmation", "confirm");
      assert.equal(
        (
          await answerAsk(f.execution, a.runId, actionA.id, {
            isConfirmed: true,
          })
        ).status,
        "completed",
      );
      const before = await f.handle.access.getArtifact(
        "intent",
        "specification",
      );
      const failed = await answerAsk(f.execution, b.runId, actionB.id, {
        isConfirmed: true,
      });
      assert.equal(failed.status, "failed");
      assert.equal(failed.cursor.stepName, "confirm");
      assert.equal(failed.lastError?.code, "STEP_EXECUTION_FAILED");
      assert.equal(await f.handle.access.getRecordById(b.runId), undefined);
      assert.deepEqual(
        await f.handle.access.getArtifact("intent", "specification"),
        before,
      );
      assert.equal((await f.handle.access.listRecords({})).data.length, 1);
    });

    test("a transaction conflict rolls back the new Artifact and never reports completion", async (t) => {
      const f = await executionFixture(t, backend, {
        decide: (state) => ({ proposal: proposal(state), outcome: "ready" }),
        storage(access) {
          return {
            ...access,
            async commit(operations) {
              const record = operations.find(
                (operation) => operation.type === "append_record",
              );
              assert.ok(record);
              await access.commit([
                {
                  type: "append_record",
                  id: record.id,
                  payload: {
                    flowName: "intent",
                    stageName: "specification",
                    data: "competing writer",
                  },
                },
              ]);
              return access.commit(operations);
            },
          };
        },
      });
      const waiting = await flow(f.execution, "intent", "commit race");
      const action = pending(waiting, "user_ask_confirmation", "confirm");
      const failed = await answerAsk(f.execution, waiting.runId, action.id, {
        isConfirmed: true,
      });
      assert.equal(failed.status, "failed");
      assert.equal(failed.cursor.stepName, "finalize");
      assert.equal(failed.pendingAction, undefined);
      assert.equal(
        await f.handle.access.getArtifact("intent", "specification"),
        undefined,
      );
      assert.equal(
        (await f.handle.access.getRecordById(waiting.runId))?.data,
        "competing writer",
      );
      assert.equal(
        f.codeCalls.filter((call) => call.name === "finalize").length,
        1,
      );
    });

    test("post-commit clear failure retains a durable Record without replaying Finalize", async (t) => {
      const f = await executionFixture(t, backend, {
        decide: (state) => ({ proposal: proposal(state), outcome: "ready" }),
        code({ name, access, proceed }) {
          if (name !== "finalize") return proceed();
          return proceed({
            ...access,
            state: {
              get value() {
                return access.state.value;
              },
              create: (value) => access.state.create(value),
              update: (value) => access.state.update(value),
              clear: async () => {
                throw new Error("injected clear failure");
              },
            },
          });
        },
      });
      const waiting = await flow(
        f.execution,
        "intent",
        "query a committed result after failure",
      );
      const action = pending(waiting, "user_ask_confirmation", "confirm");
      const failed = await answerAsk(f.execution, waiting.runId, action.id, {
        isConfirmed: true,
      });
      assert.equal(failed.status, "failed");
      assert.equal(failed.lastError?.code, "STEP_EXECUTION_FAILED");
      const record = await f.handle.access.getRecordById(waiting.runId);
      const artifact = await f.handle.access.getArtifact(
        "intent",
        "specification",
      );
      assert.ok(record && artifact);
      assert.equal((record.data as SpecificationRecord).id, waiting.runId);
      await cancelRun(f.execution, waiting.runId);
      await assert.rejects(
        answerAsk(f.execution, waiting.runId, action.id, { isConfirmed: true }),
        { code: "CONFLICT" },
      );
      assert.deepEqual(await getRun(f.execution, waiting.runId), failed);
      assert.deepEqual(
        await f.handle.access.getArtifactById(artifact.id),
        artifact,
      );
      assert.equal((await f.handle.access.listRecords({})).data.length, 1);
      assert.equal(
        f.codeCalls.filter((call) => call.name === "finalize").length,
        1,
      );
    });

    test("Check refreshes a competing baseline before a conditional Artifact replacement", async (t) => {
      const baseline = {
        domains: [],
        features: [],
        requirements: [],
        relations: [],
        deferreds: [],
        constraints: [
          {
            id: "SCON-existing",
            status: "active",
            description: "Original constraint",
            record_refs: ["RUN-history"],
          },
        ],
      } satisfies SpecificationArtifact;
      const constraint = baseline.constraints[0];
      assert.ok(constraint);
      let competing = false;
      const f = await executionFixture(t, backend, {
        decide(state, iteration) {
          assert.ok(state.baseline);
          const old = state.baseline.data.constraints[0];
          assert.ok(old);
          assert.equal(
            old.description,
            iteration === 1 ? "Original constraint" : "External revision",
          );
          return {
            outcome: "ready",
            proposal: {
              changes: [
                {
                  target_ref: "SCON-existing",
                  reason: "Revise the existing constraint in this iteration",
                  patch: [
                    {
                      op: "test",
                      path: "/description",
                      value: old.description,
                    },
                    {
                      op: "replace",
                      path: "/description",
                      value: state.intent,
                    },
                  ],
                },
              ],
              questions: [],
              processedFeedbackCount: state.feedbacks.length,
            },
          };
        },
        async code({ name, access, proceed }) {
          if (name === "check" && !competing) {
            competing = true;
            const previous = await access.storage.getArtifact(
              "intent",
              "specification",
            );
            assert.ok(previous);
            await access.storage.commit([
              {
                type: "replace_artifact",
                id: previous.id,
                expectedRevision: previous.revision,
                payload: {
                  flowName: "intent",
                  stageName: "specification",
                  data: {
                    ...baseline,
                    constraints: [
                      { ...constraint, description: "External revision" },
                    ],
                  },
                },
              },
            ]);
          }
          return proceed();
        },
      });
      await f.handle.access.commit([
        {
          type: "create_artifact",
          id: "ART-existing",
          payload: {
            flowName: "intent",
            stageName: "specification",
            data: baseline,
          },
        },
      ]);
      const waiting = await flow(
        f.execution,
        "intent",
        "Revision confirmed in this iteration",
      );
      const action = pending(waiting, "user_ask_confirmation", "confirm");
      assert.equal(f.reads.length, 2);
      assert.equal(f.reads[1]?.feedbacks[0]?.source, "check");
      const external = await f.handle.access.getArtifactById("ART-existing");
      assert.ok(external);
      const access = f.accesses.at(-1);
      assert.ok(access);
      const snapshot = (access.state.value as SpecificationState).confirmation
        ?.context;
      assert.equal(snapshot?.baseline?.revision, external.revision);
      const context = (action.request as UserAskConfirmation).context;
      assert.match(context, /Revision confirmed in this iteration/);
      assert.doesNotMatch(context, /External revision|"baseline"|"patch"/);
      assert.equal(
        (
          await answerAsk(f.execution, waiting.runId, action.id, {
            isConfirmed: true,
          })
        ).status,
        "completed",
      );
      const updated = await f.handle.access.getArtifactById("ART-existing");
      const record = await f.handle.access.getRecordById(waiting.runId);
      assert.ok(updated && record);
      assert.ok(updated.revision > external.revision);
      assert.equal(
        (updated.data as SpecificationArtifact).constraints[0]?.description,
        "Revision confirmed in this iteration",
      );
      assert.deepEqual(
        (updated.data as SpecificationArtifact).constraints[0]?.record_refs,
        ["RUN-history", waiting.runId],
      );
      assert.deepEqual((record.data as SpecificationRecord).origin_refs, [
        "SCON-existing",
      ]);
      assert.deepEqual(
        f.codeCalls.map((call) => call.name),
        ["init", "check", "check", "confirm", "finalize"],
      );
    });
  });
}
