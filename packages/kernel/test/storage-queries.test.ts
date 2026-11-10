import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { createClient } from "@libsql/client";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import type { RunRecord } from "../src/lifecycle/run-contracts.ts";
import { openStorage } from "../src/persistence/storage.ts";

test("indexed interaction lookup, unfinished queries and outcome pages preserve history across restart", async () => {
  const directory = await mkdtemp(join(tmpdir(), "intloom-storage-query-"));
  let repository = await openStorage(directory);
  const now = "2026-11-06T00:00:00.000Z";
  try {
    for (let i = 0; i < 3; i++) {
      const id = `run-${i}`;
      const loom = {
        id: `loom-${i}`,
        version: "1.0.0",
        artifactDigest: "a".repeat(64),
      };
      const location = {
        storage: "global" as const,
        dataDir: join(directory, `store-${i}`),
      };
      const record: RunRecord = {
        input: null,
        binding: {
          location,
          formatVersion: 1,
          loom,
          dependencies: [],
          entry: { kind: "code", id: "main" },
          runtime: { kind: "code", version: "0.3.0", nodeMajor: 26 },
          config: {},
        },
        view: {
          id,
          loom,
          location,
          status: i ? "succeeded" : "created",
          createdAt: now,
          updatedAt: now,
          waits: [],
          pendingInteractionIds: [],
          ...(i ? { output: "x".repeat(1024 * 1024) } : {}),
        },
        interactions: [
          {
            request: {
              id: `request-${i}`,
              runId: id,
              executionId: "execution",
              kind: "ask",
              origin: { componentId: "main" },
              message: "Continue?",
              answerSchema: { type: "boolean" },
              responsePolicy: "any",
              status: "closed",
              closed: { at: now, reason: "run_ended" },
              createdAt: now,
            },
            responses: [],
          },
        ],
      };
      await repository.save(record, [{ type: "run.created" }]);
      for (let n = 0; n < 15; n++) {
        const suffix = `${String(n).padStart(2, "0")}-${i}`;
        const scope = {
          runId: id,
          createdAt: now,
          executionId: "execution",
          origin: { componentId: "main" },
        };
        await repository.saveArtifact({
          ...scope,
          id: `artifact-${suffix}`,
          name: "output.txt",
          mediaType: "text/plain",
          digest: "b".repeat(64),
          size: 1,
        });
        await repository.saveAcceptance({
          ...scope,
          id: `acceptance-${suffix}`,
          subject: n,
          subjectDigest: "c".repeat(64),
          criteria: [],
          result: { checks: [] },
          status: "passed",
        });
      }
    }
    assert.deepEqual(
      (await repository.listUnfinished()).map((r) => r.view.id),
      ["run-0"],
    );
    assert.equal(
      (await repository.findInteraction("request-2"))?.view.id,
      "run-2",
    );
    for (const otherId of ["run-2", "artifact-00-2", "acceptance-00-2"])
      assert.equal(await repository.findInteraction(otherId), undefined);
    assert.deepEqual(repository.issues(), []);
    const overview = await repository.overview();
    assert.equal(overview.totalRuns, 3);
    assert.deepEqual(
      overview.recent.map((r) => r.id),
      ["run-2", "run-1"],
    );
    assert.ok(overview.recent.every((r) => !("output" in r)));
    assert.deepEqual(
      (await repository.listViews({ unfinished: true, limit: 100 })).map(
        (r) => r.id,
      ),
      ["run-0"],
    );
    const ids: string[] = [];
    let after: string | undefined;
    for (;;) {
      const page = await repository.listArtifacts({ after, limit: 4 });
      assert.ok(page.length <= 4);
      ids.push(...page.map((a) => a.id));
      const last = page.at(-1);
      if (!last) break;
      after = `${last.createdAt}/${last.id}`;
    }
    assert.equal(ids.length, 45);
    assert.equal(new Set(ids).size, 45);
    assert.deepEqual(ids, [...ids].sort());
    assert.equal(
      (await repository.listArtifacts({ runId: "run-1", limit: 3 })).length,
      3,
    );
    assert.equal(
      (await repository.listAcceptances({ runId: "run-1", limit: 2 })).length,
      2,
    );
    const before = await repository.get("run-2");
    await repository.close();
    // Rebuild only derived indexes for a database written before request locators were introduced.
    const index = createClient({ url: `file:${join(directory, "index.db")}` });
    await index.execute("DELETE FROM locations WHERE kind = 'interaction'");
    index.close();
    const store = createClient({
      url: `file:${join(directory, "store-2/kernel.db")}`,
    });
    await store.execute("DROP TABLE interaction_runs");
    store.close();
    repository = await openStorage(directory);
    assert.deepEqual(await repository.findInteraction("request-2"), before);
    assert.equal(await repository.findInteraction("missing"), undefined);
    assert.deepEqual(await repository.get("run-2"), before);
    await repository.close();
    repository = await openStorage(directory);
    assert.equal(
      (await repository.findInteraction("request-2"))?.view.id,
      "run-2",
    );
    assert.deepEqual(
      (await repository.listUnfinished()).map((r) => r.view.id),
      ["run-0"],
    );
  } finally {
    await repository.close();
    await rm(directory, { recursive: true, force: true });
  }
});
