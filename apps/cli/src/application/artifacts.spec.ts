import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseArtifactQuery,
  parseArtifactSelector,
  getArtifact,
  listArtifacts,
} from "./artifacts.ts";
import type { StorageReadAccess } from "@intloom/kernel";
import { artifact } from "../../test/artifact-fixture.ts";

test("Artifact selectors accept exactly one identity and reject incomplete or unsafe inputs", () => {
  assert.deepEqual(parseArtifactSelector({ artifactId: "ART-todo" }), {
    artifactId: "ART-todo",
  });
  assert.deepEqual(
    parseArtifactSelector({ flowName: "fixture", stageName: "first" }),
    { flowName: "fixture", stageName: "first" },
  );
  for (const input of [
    {},
    { flowName: "fixture" },
    { stageName: "first" },
    { artifactId: "ART-todo", flowName: "fixture", stageName: "first" },
    { artifactId: " " },
    { artifactId: "x\u001b[31m" },
    { artifactId: "x", output: "/tmp/x" },
  ])
    assert.throws(() => parseArtifactSelector(input), {
      code: "INVALID_REQUEST",
    });
});

test("Artifact pagination validates bounds without retaining explicit undefined", () => {
  assert.deepEqual(parseArtifactQuery({ flowName: undefined, limit: 1 }), {
    limit: 1,
  });
  for (const input of [
    { limit: 0 },
    { limit: 201 },
    { limit: 1.5 },
    { cursor: "" },
    { flowName: "\n" },
    { order: "created_asc" },
  ])
    assert.throws(() => parseArtifactQuery(input), { code: "INVALID_REQUEST" });
});

test("Artifact reads use the selected Storage method, preserve null and project metadata only", async () => {
  const calls: unknown[] = [];
  const unsupported = async (): Promise<never> => {
    throw new Error("Unexpected storage operation");
  };
  const storage: StorageReadAccess = {
    getArtifact: async (...args) => {
      calls.push(args);
      return artifact;
    },
    getArtifactById: async (id) => {
      calls.push(id);
      return undefined;
    },
    listArtifacts: async (query) => {
      calls.push(query);
      return { data: [artifact], nextCursor: "next" };
    },
    getLatestRecord: unsupported,
    getRecordById: unsupported,
    listRecords: unsupported,
  };
  assert.equal(await getArtifact(storage, { artifactId: "missing" }), null);
  assert.equal(
    await getArtifact(storage, { flowName: "fixture", stageName: "first" }),
    artifact,
  );
  const page = await listArtifacts(storage, { flowName: "fixture", limit: 1 });
  assert.deepEqual(calls, [
    "missing",
    ["fixture", "first"],
    { flowName: "fixture", limit: 1 },
  ]);
  assert.equal(page.nextCursor, "next");
  assert.deepEqual(Object.keys(page.data[0] ?? {}).sort(), [
    "createdAt",
    "flowName",
    "id",
    "revision",
    "stageName",
    "updatedAt",
  ]);
  assert.deepEqual(artifact.data, {
    title: "Todo requirements",
    requirements: ["Add tasks", "Browser persistence"],
    note: "  original\ncontent  ",
  });
});
