import { bindProjectAccess } from "../project/access.ts";
import type { ProjectAccess } from "@intloom/workflow-sdk";
import type { JsonValue } from "../shared/json.ts";
import type {
  AgentExecutionAccess,
  CodeExecutionAccess,
} from "../effector/execution.ts";
import type { StorageAccess, StorageReadAccess } from "../storage/contracts.ts";
import { RUNTIME_ERRORS } from "../errors/runtime.ts";
import { assertCallOwnership } from "./call-scope.ts";
import type { RunEntry } from "./run-entry.ts";
import { createInteraction } from "./interaction.ts";

export function createCodeAccess(
  entry: RunEntry,
  call: AbortController,
  storage: StorageAccess,
  project?: ProjectAccess,
): CodeExecutionAccess<JsonValue> {
  const read = createStorageReadAccess(entry, call, storage);
  return Object.freeze({
    signal: call.signal,
    ...(project
      ? {
          project: bindProjectAccess(
            project,
            () => assertCallOwnership(entry, call),
            call.signal,
          ),
        }
      : {}),
    state: entry.stageState.bind(() => assertCallOwnership(entry, call)),
    storage: Object.freeze({
      ...read,
      commit: (operations) =>
        storageOperation(entry, call, () => storage.commit(operations), true),
    } satisfies StorageAccess),
    interaction: createInteraction(entry, call),
  });
}

export function createAgentAccess(
  entry: RunEntry,
  call: AbortController,
  storage: StorageAccess,
  assertTool: () => void = () => {},
  project?: ProjectAccess,
): AgentExecutionAccess<JsonValue> {
  const check = () => {
    assertCallOwnership(entry, call);
    assertTool();
  };
  return Object.freeze({
    signal: call.signal,
    ...(project
      ? { project: bindProjectAccess(project, check, call.signal) }
      : {}),
    state: entry.stageState.bind(check, true),
    // The actual object excludes commit; writable methods must not merely be hidden by types.
    storage: createStorageReadAccess(entry, call, storage, assertTool),
  });
}

function createStorageReadAccess(
  entry: RunEntry,
  call: object,
  storage: StorageReadAccess,
  assertScope: () => void = () => {},
): StorageReadAccess {
  return Object.freeze({
    getArtifact: (flow, stage) =>
      storageOperation(
        entry,
        call,
        () => storage.getArtifact(flow, stage),
        false,
        assertScope,
      ),
    getArtifactById: (id) =>
      storageOperation(
        entry,
        call,
        () => storage.getArtifactById(id),
        false,
        assertScope,
      ),
    getLatestRecord: (flow, stage) =>
      storageOperation(
        entry,
        call,
        () => storage.getLatestRecord(flow, stage),
        false,
        assertScope,
      ),
    getRecordById: (id) =>
      storageOperation(
        entry,
        call,
        () => storage.getRecordById(id),
        false,
        assertScope,
      ),
    listArtifacts: (query) =>
      storageOperation(
        entry,
        call,
        () => storage.listArtifacts(query),
        false,
        assertScope,
      ),
    listRecords: (query) =>
      storageOperation(
        entry,
        call,
        () => storage.listRecords(query),
        false,
        assertScope,
      ),
  } satisfies StorageReadAccess);
}

async function storageOperation<T>(
  entry: RunEntry,
  call: object,
  operation: () => Promise<T>,
  write = false,
  assertScope: () => void = () => {},
): Promise<T> {
  assertCallOwnership(entry, call);
  assertScope();
  if (write && entry.state.status !== "running")
    throw RUNTIME_ERRORS.create("EXECUTION_OWNERSHIP_LOST");
  // Reject stale results after completion; external side effects already produced by the Adapter cannot be undone.
  const result = await operation();
  assertCallOwnership(entry, call);
  assertScope();
  if (write && entry.state.status !== "running")
    throw RUNTIME_ERRORS.create("EXECUTION_OWNERSHIP_LOST");
  return result;
}
