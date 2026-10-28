import { bindCodeAccess, bindAgentToolAccess } from "../access/code.ts";
import type { AccessBindings } from "../access/contracts.ts";
import { recordRunCommit } from "./run-facts.ts";
import type { ProjectAccess } from "@intloom/loom-sdk";
import type { StorageAccess } from "@intloom/loom-sdk";
import type { RuntimeCall } from "./call-scope.ts";
import type { RunEntry } from "./run-entry.ts";
import { createInteraction } from "./interaction.ts";

function bindings(
  entry: RunEntry,
  call: RuntimeCall,
  storage: StorageAccess,
  project?: ProjectAccess,
): AccessBindings {
  const cursor = { ...entry.state.cursor };
  const executionId = entry.executionCount;
  return {
    scope: call,
    ...(entry.blueprint.capability
      ? {
          run: {
            id: entry.state.id,
            startedAt: entry.state.createdAt.toISOString(),
            host: structuredClone(
              entry.state.hostContext ?? {
                userId: "local",
                timeZone: "UTC",
                answerSource: "human",
                services: {},
              },
            ),
          },
        }
      : {}),
    agentInteractions: !!entry.blueprint.capability,
    bindState: (check) => entry.stageState.bind(check, true),
    storage,
    project,
    interaction: createInteraction(entry, call),
    committed: (result) => recordRunCommit(entry, cursor, executionId, result),
  };
}
export function createCodeAccess(
  entry: RunEntry,
  call: RuntimeCall,
  storage: StorageAccess,
  project?: ProjectAccess,
) {
  return bindCodeAccess(bindings(entry, call, storage, project));
}
export function createAgentAccess(
  entry: RunEntry,
  call: RuntimeCall,
  storage: StorageAccess,
  assertTool: () => void = () => {},
  project?: ProjectAccess,
) {
  return bindAgentToolAccess(
    bindings(entry, call, storage, project),
    assertTool,
  );
}
