import { RequestContext } from "@mastra/core/request-context";
import type { JsonValue } from "../../shared/json.ts";
import type { StateAccess } from "../state-access.ts";
import type { AgentExecutionAccess } from "../execution.ts";

import { agentExecutionContextKey } from "@intloom/workflow-sdk";
export {
  agentExecutionContextKey,
  getAgentExecutionAccess,
} from "@intloom/workflow-sdk";

/** The new context references only the current call; access failures remain failures even if the SDK converts them to Tool results. */
export function bindAgentContext(
  access: AgentExecutionAccess<JsonValue>,
  onFailure: (cause: unknown) => void,
): RequestContext {
  function read<T>(operation: () => T): T {
    try {
      access.signal.throwIfAborted();
      return operation();
    } catch (cause) {
      onFailure(cause);
      throw cause;
    }
  }
  async function invoke<T>(operation: () => Promise<T>): Promise<T> {
    try {
      access.signal.throwIfAborted();
      const value = await operation();
      access.signal.throwIfAborted();
      return value;
    } catch (cause) {
      onFailure(cause);
      throw cause;
    }
  }
  const state: StateAccess<JsonValue> = Object.freeze({
    get value() {
      return read(() => access.state.value);
    },
    create: (value: JsonValue) => invoke(() => access.state.create(value)),
    update: (value: JsonValue) => invoke(() => access.state.update(value)),
    clear: () => invoke(() => access.state.clear()),
  });
  const storage = access.storage;
  const binding: AgentExecutionAccess<JsonValue> = Object.freeze({
    state,
    ...(access.project ? { project: access.project } : {}),
    signal: access.signal,
    storage: Object.freeze({
      getArtifact: (flow, stage) =>
        invoke(() => storage.getArtifact(flow, stage)),
      getArtifactById: (id) => invoke(() => storage.getArtifactById(id)),
      getLatestRecord: (flow, stage) =>
        invoke(() => storage.getLatestRecord(flow, stage)),
      getRecordById: (id) => invoke(() => storage.getRecordById(id)),
      listArtifacts: (query) => invoke(() => storage.listArtifacts(query)),
      listRecords: (query) => invoke(() => storage.listRecords(query)),
    } satisfies AgentExecutionAccess<JsonValue>["storage"]),
  });
  const context = new RequestContext();
  context.set(agentExecutionContextKey, binding);
  return context;
}
