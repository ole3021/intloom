import type {
  CodeExecutionAccess,
  AgentExecutionAccess,
  JsonValue,
  StorageReadAccess,
} from "@intloom/loom-sdk";
import { ERRORS } from "../errors.ts";
import type { AccessBindings, CallScope } from "./contracts.ts";
import { readUse, trackedUse } from "./tracked-use.ts";

const toolBindings = new WeakMap<
  AgentExecutionAccess<JsonValue>,
  { bindings: AccessBindings; assertTool: () => void }
>();

function common(
  bindings: AccessBindings,
  scope: CallScope,
): AgentExecutionAccess<JsonValue> {
  const { storage, project, bindState } = bindings;
  const requestInteraction = bindings.agentInteractions
    ? bindings.interaction?.request
    : undefined;
  const read: StorageReadAccess = Object.freeze({
    getArtifact: (loom, stage) =>
      trackedUse(scope, "storage_read", () => storage.getArtifact(loom, stage)),
    getArtifactById: (id) =>
      trackedUse(scope, "storage_read", () => storage.getArtifactById(id)),
    getLatestRecord: (loom, stage) =>
      trackedUse(scope, "storage_read", () =>
        storage.getLatestRecord(loom, stage),
      ),
    getRecordById: (id) =>
      trackedUse(scope, "storage_read", () => storage.getRecordById(id)),
    listArtifacts: (query) =>
      trackedUse(scope, "storage_read", () => storage.listArtifacts(query)),
    listRecords: (query) =>
      trackedUse(scope, "storage_read", () => storage.listRecords(query)),
  } satisfies StorageReadAccess);
  return Object.freeze({
    signal: scope.signal,
    ...(bindings.run
      ? {
          get run() {
            scope.assertCurrent();
            return structuredClone(bindings.run);
          },
        }
      : {}),
    state: Object.freeze({
      get value() {
        return readUse(
          scope,
          "state_read",
          () => bindState(() => scope.assertCurrent()).value,
        );
      },
      create: (value: JsonValue) =>
        trackedUse(scope, "state_write", (use) =>
          bindState(() => use.assertCurrent()).create(value),
        ),
      update: (value: JsonValue) =>
        trackedUse(scope, "state_write", (use) =>
          bindState(() => use.assertCurrent()).update(value),
        ),
      clear: () =>
        trackedUse(scope, "state_write", (use) =>
          bindState(() => use.assertCurrent()).clear(),
        ),
    }),
    storage: read,
    ...(requestInteraction
      ? {
          interaction: Object.freeze({
            request: (
              request: import("@intloom/loom-sdk").InteractionRequest,
            ) =>
              trackedUse(scope, "interaction", () =>
                requestInteraction(request),
              ),
          }),
        }
      : {}),
    ...(project
      ? {
          project: Object.freeze({
            snapshot: () =>
              trackedUse(scope, "project_read", () => project.snapshot()),
            read: (path: string) =>
              trackedUse(scope, "project_read", () => project.read(path)),
            write: (path: string, content: string) =>
              trackedUse(scope, "project_write", () =>
                project.write(path, content),
              ),
            remove: (path: string) =>
              trackedUse(scope, "project_write", () => project.remove(path)),
            run: (
              command: import("@intloom/loom-sdk").ProjectCommand,
              signal?: AbortSignal,
            ) =>
              trackedUse(scope, "project_run", () =>
                project.run(
                  command,
                  signal
                    ? AbortSignal.any([scope.signal, signal])
                    : scope.signal,
                ),
              ),
          }),
        }
      : {}),
  });
}

export function bindCodeAccess(
  bindings: AccessBindings,
): CodeExecutionAccess<JsonValue> {
  const access = common(bindings, bindings.scope);
  const interaction = bindings.interaction;
  if (!interaction) throw ERRORS.create("CAPABILITY_DENIED");
  const requestInteraction = interaction.request;
  return Object.freeze({
    ...access,
    storage: Object.freeze({
      ...access.storage,
      commit: (operations) =>
        trackedUse(bindings.scope, "storage_commit", async () => {
          const result = await bindings.storage.commit(operations);
          bindings.committed?.(result);
          return result;
        }),
    } satisfies CodeExecutionAccess<JsonValue>["storage"]),
    interaction: Object.freeze({
      ...(interaction.receipt
        ? {
            receipt: (id: string) => {
              bindings.scope.assertCurrent();
              return interaction.receipt?.(id);
            },
          }
        : {}),
      ...(interaction.latest
        ? {
            latest: (id: string) => {
              bindings.scope.assertCurrent();
              return interaction.latest?.(id);
            },
          }
        : {}),
      ...(requestInteraction
        ? {
            request: (
              request: import("@intloom/loom-sdk").InteractionRequest,
            ) =>
              trackedUse(bindings.scope, "interaction", () =>
                requestInteraction(request),
              ),
          }
        : {}),
      askQuestions: (questions) => {
        bindings.scope.assertCurrent();
        return trackedUse(bindings.scope, "interaction", () =>
          interaction.askQuestions(questions),
        );
      },
      confirm: (context) => {
        bindings.scope.assertCurrent();
        return trackedUse(bindings.scope, "interaction", () =>
          interaction.confirm(context),
        );
      },
    } satisfies CodeExecutionAccess<JsonValue>["interaction"]),
  });
}

export function bindAgentToolAccess(
  bindings: AccessBindings,
  assertTool: () => void,
): AgentExecutionAccess<JsonValue> {
  const parent = bindings.scope;
  const scope: CallScope = {
    runId: parent.runId,
    callId: parent.callId,
    signal: parent.signal,
    assertCurrent() {
      parent.assertCurrent();
      assertTool();
    },
    beginUse(kind) {
      assertTool();
      if (
        (kind === "interaction" && !bindings.agentInteractions) ||
        kind === "storage_commit"
      )
        throw ERRORS.create("CAPABILITY_DENIED");
      const use = parent.beginUse(kind);
      return {
        assertCurrent() {
          use.assertCurrent();
          assertTool();
        },
        finish: () => use.finish(),
      };
    },
  };
  // The actual object exposes neither Interaction nor Storage.commit.
  const access = common(bindings, scope);
  toolBindings.set(access, { bindings, assertTool });
  return access;
}

/** The child lifetime is shorter than its Agent call, including asynchronous State validation. */
export function createToolAccess(parent: AgentExecutionAccess<JsonValue>) {
  const source = toolBindings.get(parent);
  if (!source)
    throw ERRORS.create("CAPABILITY_DENIED", {
      message: "Agent execution requires a live Access binding.",
    });
  let open = true;
  let uses = 0;
  const assertCurrent = () => {
    if (!open) throw ERRORS.create("EXECUTION_OWNERSHIP_LOST");
    source.assertTool();
  };
  const controller = new AbortController();
  const scope = source.bindings.scope;
  const child: CallScope = {
    runId: scope.runId,
    callId: scope.callId,
    signal: AbortSignal.any([scope.signal, controller.signal]),
    assertCurrent() {
      assertCurrent();
      scope.assertCurrent();
    },
    beginUse(kind) {
      assertCurrent();
      if (
        kind === "storage_commit" ||
        (kind === "interaction" && !source.bindings.agentInteractions)
      )
        throw ERRORS.create("CAPABILITY_DENIED");
      const use = scope.beginUse(kind);
      uses++;
      let done = false;
      return {
        assertCurrent() {
          assertCurrent();
          use.assertCurrent();
        },
        finish() {
          if (done) return;
          done = true;
          uses--;
          use.finish();
        },
      };
    },
  };
  return {
    access: common(source.bindings, child),
    assertSettled() {
      if (uses) throw ERRORS.create("CALL_UNSETTLED");
    },
    close() {
      open = false;
      controller.abort(ERRORS.create("EXECUTION_OWNERSHIP_LOST"));
    },
  };
}

/** A caught capability failure still invalidates the Tool result. */
export function guardAgentAccess(
  access: AgentExecutionAccess<JsonValue>,
  onFailure: (cause: unknown) => void,
): AgentExecutionAccess<JsonValue> {
  function read<T>(operation: () => T): T {
    try {
      access.signal.throwIfAborted();
      return operation();
    } catch (cause) {
      onFailure(cause);
      throw cause;
    }
  }
  function invoke<T>(operation: () => Promise<T>): Promise<T> {
    const result = (async () => {
      try {
        access.signal.throwIfAborted();
        const value = await operation();
        access.signal.throwIfAborted();
        return value;
      } catch (cause) {
        onFailure(cause);
        throw cause;
      }
    })();
    void result.catch(() => {});
    return result;
  }
  const project = access.project;
  const requestInteraction = access.interaction?.request;
  const guarded = Object.freeze({
    signal: access.signal,
    ...(access.run
      ? {
          get run() {
            return read(() => access.run as NonNullable<typeof access.run>);
          },
        }
      : {}),
    ...(requestInteraction
      ? {
          interaction: Object.freeze({
            request: (
              request: import("@intloom/loom-sdk").InteractionRequest,
            ) => invoke(() => requestInteraction(request)),
          }),
        }
      : {}),
    ...(project
      ? {
          project: Object.freeze({
            snapshot: () => invoke(() => project.snapshot()),
            read: (path: string) => invoke(() => project.read(path)),
            write: (path: string, content: string) =>
              invoke(() => project.write(path, content)),
            remove: (path: string) => invoke(() => project.remove(path)),
            run: (command: import("@intloom/loom-sdk").ProjectCommand) =>
              invoke(() => project.run(command, access.signal)),
          }),
        }
      : {}),
    state: Object.freeze({
      get value() {
        return read(() => access.state.value);
      },
      create: (value: JsonValue) => invoke(() => access.state.create(value)),
      update: (value: JsonValue) => invoke(() => access.state.update(value)),
      clear: () => invoke(() => access.state.clear()),
    }),
    storage: Object.freeze({
      getArtifact: (loom, stage) =>
        invoke(() => access.storage.getArtifact(loom, stage)),
      getArtifactById: (id) => invoke(() => access.storage.getArtifactById(id)),
      getLatestRecord: (loom, stage) =>
        invoke(() => access.storage.getLatestRecord(loom, stage)),
      getRecordById: (id) => invoke(() => access.storage.getRecordById(id)),
      listArtifacts: (query) =>
        invoke(() => access.storage.listArtifacts(query)),
      listRecords: (query) => invoke(() => access.storage.listRecords(query)),
    } satisfies AgentExecutionAccess<JsonValue>["storage"]),
  });
  const source = toolBindings.get(access);
  if (source) toolBindings.set(guarded, source);
  return guarded;
}

/** Model cancellation narrows authority without replacing the underlying capability binding. */
export function withAgentSignal(
  access: AgentExecutionAccess<JsonValue>,
  signal: AbortSignal,
) {
  const source = toolBindings.get(access);
  if (!source)
    throw ERRORS.create("CAPABILITY_DENIED", {
      message: "Agent execution requires a live Access binding.",
    });
  const parent = source.bindings.scope;
  const assertCurrent = () => {
    signal.throwIfAborted();
    parent.assertCurrent();
    source.assertTool();
  };
  const scope: CallScope = {
    runId: parent.runId,
    callId: parent.callId,
    signal: AbortSignal.any([parent.signal, signal]),
    assertCurrent,
    beginUse(kind) {
      assertCurrent();
      const use = parent.beginUse(kind);
      return {
        assertCurrent() {
          assertCurrent();
          use.assertCurrent();
        },
        finish: () => use.finish(),
      };
    },
  };
  return bindAgentToolAccess({ ...source.bindings, scope }, assertCurrent);
}
