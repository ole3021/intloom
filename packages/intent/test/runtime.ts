import assert from "node:assert/strict";
import type {
  JsonValue,
  AgentExecutionAccess,
  StorageOperation,
  StoredArtifact,
  StoredRecord,
} from "@intloom/kernel";
import * as z from "zod";
import type { IntentCodeAccess } from "../src/specification/interaction.ts";
import initializeState from "../initializers/specification.ts";
import { specificationStateSchema } from "../schemas/specification-state.ts";
import type { SpecificationArtifact } from "../schemas/specification-artifact.ts";

export function agentAccess(
  access: IntentCodeAccess,
): AgentExecutionAccess<JsonValue> {
  const { commit: _commit, ...storage } = access.storage;
  return { state: access.state, storage, signal: access.signal };
}

/** In-memory boundary double; it does not stand in for a Kernel runtime implementation. */
export function runtime(baseline?: SpecificationArtifact) {
  let value: JsonValue | undefined = z.json().parse(
    specificationStateSchema.parse(
      initializeState({
        runId: "RUN-test",
        flowName: "intent",
        stageName: "specification",
        intent: "Save the user's explicit requirements",
      }),
    ),
  );
  let artifact: StoredArtifact | undefined = baseline
    ? {
        id: "ART-existing",
        flowName: "intent",
        stageName: "specification",
        revision: 1,
        data: z.json().parse(baseline),
        createdAt: "t0",
        updatedAt: "t0",
      }
    : undefined;
  const records = new Map<string, StoredRecord>();
  const calls: (readonly StorageOperation[])[] = [];
  const flags = { failCommit: false, failClear: false };
  const access: IntentCodeAccess = {
    signal: new AbortController().signal,
    state: {
      get value() {
        return structuredClone(value);
      },
      create: async (next) => {
        assert.equal(value, undefined);
        value = structuredClone(next);
      },
      update: async (next) => {
        value = z.json().parse(specificationStateSchema.parse(next));
      },
      clear: async () => {
        if (flags.failClear) throw new Error("clear failed");
        value = undefined;
      },
    },
    storage: {
      getArtifact: async () => structuredClone(artifact),
      getArtifactById: async (id) =>
        artifact?.id === id ? structuredClone(artifact) : undefined,
      getRecordById: async (id) => structuredClone(records.get(id)),
      getLatestRecord: async () => undefined,
      listArtifacts: async () => ({
        data: artifact ? [structuredClone(artifact)] : [],
      }),
      listRecords: async () => ({ data: [...records.values()] }),
      commit: async (operations) => {
        if (flags.failCommit) throw new Error("commit failed");
        let nextArtifact = structuredClone(artifact);
        const nextRecords = new Map(records);
        for (const op of operations) {
          if (op.type === "create_artifact") {
            assert.equal(nextArtifact, undefined);
            nextArtifact = {
              id: op.id,
              ...op.payload,
              revision: 1,
              createdAt: "t1",
              updatedAt: "t1",
            };
          } else if (op.type === "replace_artifact") {
            assert.equal(nextArtifact?.id, op.id);
            assert.equal(nextArtifact?.revision, op.expectedRevision);
            nextArtifact = {
              id: op.id,
              ...op.payload,
              revision: op.expectedRevision + 1,
              createdAt: "t0",
              updatedAt: "t1",
            };
          } else if (op.type === "append_record") {
            assert.equal(nextRecords.has(op.id), false);
            nextRecords.set(op.id, {
              id: op.id,
              ...op.payload,
              createdAt: "t1",
            });
          } else throw new Error("Unexpected operation");
        }
        artifact = nextArtifact;
        for (const [key, record] of nextRecords) records.set(key, record);
        calls.push(structuredClone(operations));
        return {
          writtenArtifacts: artifact ? [artifact] : [],
          appendedRecords: [...nextRecords.values()],
          removedArtifactIds: [],
          removedRecordIds: [],
        };
      },
    },
    interaction: {
      askQuestions: async () => {
        throw new Error("Test must provide a real simulated reply");
      },
      confirm: async () => {
        throw new Error("Test must provide a real simulated confirmation");
      },
    },
  };
  return {
    access,
    calls,
    flags,
    records,
    get state() {
      return value === undefined
        ? undefined
        : specificationStateSchema.parse(value);
    },
    get artifact() {
      return artifact;
    },
    setArtifact(next: StoredArtifact) {
      artifact = structuredClone(next);
    },
  };
}
