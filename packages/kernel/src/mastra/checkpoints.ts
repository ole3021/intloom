import { IntloomError, type JsonObject } from "@intloom/loom-sdk";
import { copyJson, stableJson } from "@intloom/loom-sdk/json";
import { sha256 } from "@intloom/loom-sdk/package-format";
import type {
  PersistedExecutionEvidence,
  WaitDescriptor,
} from "../lifecycle/run-contracts.ts";
import type { WorkflowsStorage } from "@mastra/core/storage";

export interface Suspension {
  readonly __intloom: {
    readonly version: 2;
    readonly wait: WaitDescriptor;
    readonly payload?: unknown;
  };
}
interface StoredStep {
  status: string;
  output?: StoredStep[];
  metadata?: { nestedRunId?: string };
  suspendPayload?: Suspension & {
    __workflow_meta?: { foreachOutput?: StoredStep[]; runId?: string };
  };
}
interface GraphEntry {
  type: string;
  id?: string;
  workflowId?: string;
  step?: GraphEntry;
  steps?: GraphEntry[];
  serializedStepFlow?: GraphEntry[];
}

/** Reads native snapshots only; rebuilding questions must never execute an author callback. */
export async function inspectCheckpoint(
  store: WorkflowsStorage,
  workflowId: string,
  runId: string,
): Promise<PersistedExecutionEvidence> {
  const snapshots: unknown[] = [];
  const waits: WaitDescriptor[] = [];
  let unsettled = false;
  async function read(workflowName: string, nativeRunId: string) {
    const snapshot = await store.loadWorkflowSnapshot({
      workflowName,
      runId: nativeRunId,
    });
    if (!snapshot) return undefined;
    snapshots.push(snapshot);
    if (snapshot.status !== "suspended") return snapshot;
    const nested = new Map<string, string>();
    const graph = (entries: GraphEntry[]) => {
      for (const entry of entries) {
        if (entry.type === "workflow" && entry.id)
          nested.set(entry.id, entry.workflowId ?? entry.id);
        else {
          if (entry.step) graph([entry.step]);
          if (entry.steps) graph(entry.steps);
        }
      }
    };
    graph(snapshot.serializedStepGraph as GraphEntry[]);
    for (const [stepId, stored] of Object.entries(snapshot.context)) {
      if (stepId === "input") continue;
      const result = stored as StoredStep;
      if (result.status === "running") unsettled = true;
      if (result.status !== "suspended") continue;
      const iterations = result.suspendPayload?.__workflow_meta?.foreachOutput;
      const entries = iterations ?? [result];
      for (const item of entries) {
        if (item.status !== "suspended") continue;
        const childWorkflow = nested.get(stepId);
        if (childWorkflow) {
          const childId =
            item.metadata?.nestedRunId ??
            item.suspendPayload?.__workflow_meta?.runId;
          if (!childId)
            throw new IntloomError(
              "CHECKPOINT_UNAVAILABLE",
              "Nested execution identity is missing.",
            );
          const child = await read(childWorkflow, childId);
          if (!child)
            throw new IntloomError(
              "CHECKPOINT_UNAVAILABLE",
              "The nested execution snapshot is missing.",
            );
          if (child.status !== "suspended") unsettled = true;
        } else {
          const envelope = item.suspendPayload?.__intloom;
          if (envelope?.version !== 2)
            throw new IntloomError(
              "CHECKPOINT_INCOMPATIBLE",
              "The saved wait has no compatible Intloom metadata.",
            );
          waits.push({
            ...envelope.wait,
            locator: { label: envelope.wait.view.waitId },
          });
        }
      }
    }
    return snapshot;
  }
  const snapshot = await read(workflowId, runId);
  if (!snapshot) return { kind: "missing" };
  if (snapshot.status === "success")
    return { kind: "completed", output: copyJson(snapshot.result, "output") };
  if (unsettled || snapshot.status !== "suspended")
    return { kind: "unsettled" };
  if (waits.some(({ view }) => !snapshot.resumeLabels[view.waitId]))
    throw new IntloomError(
      "CHECKPOINT_INCOMPATIBLE",
      "The original wait has no native resume label.",
    );
  if (!waits.length)
    throw new IntloomError(
      "CHECKPOINT_UNAVAILABLE",
      "The suspended execution has no identifiable waits.",
    );
  const fingerprint = await sha256(
    new TextEncoder().encode(stableJson(JSON.parse(JSON.stringify(snapshots)))),
  );
  return {
    kind: "waiting",
    checkpoint: {
      id: `${runId}:${fingerprint}`,
      engineRef: { workflowId, runId } satisfies JsonObject,
      snapshotFingerprint: fingerprint,
      waitIds: waits.map(({ view }) => view.waitId),
      createdAt: new Date(snapshot.timestamp).toISOString(),
    },
    waits,
  };
}
