import { AsyncLocalStorage } from "node:async_hooks";
import {
  IntloomError,
  type EventScope,
  type ExecutionScope,
  type ExecutionKind,
  type ExecutionOrigin,
} from "@intloom/loom-sdk";
import type {
  AcceptedResume,
  EventInput,
  ObservedExecution,
  RunServices,
} from "../lifecycle/run-contracts.ts";

interface Scope {
  readonly executionId: string;
  readonly parentExecutionId?: string;
  readonly kind: ExecutionKind;
  readonly origin: ExecutionOrigin;
  readonly parent?: Scope;
  waiting?: boolean;
}

/** Invocation-local context; only explicit author summaries may describe Tool output. */
export function createObservation(host: RunServices, cancelled: () => boolean) {
  const current = new AsyncLocalStorage<Scope>();
  const pending: EventInput[] = [];
  let resumed: ObservedExecution[] = [];
  const fields = (scope = current.getStore()): EventScope =>
    scope
      ? {
          executionId: scope.executionId,
          ...(scope.parentExecutionId
            ? { parentExecutionId: scope.parentExecutionId }
            : {}),
          origin: scope.origin,
        }
      : {};
  return {
    fields,
    execution(): ExecutionScope {
      return fields(current.getStore()) as ExecutionScope;
    },
    begin(resume?: AcceptedResume) {
      resumed = [...(resume?.wait.executions ?? [])];
    },
    takeWaitingEvents() {
      return pending.splice(0);
    },
    suspend(): readonly ObservedExecution[] {
      const chain: ObservedExecution[] = [];
      for (let scope = current.getStore(); scope; scope = scope.parent) {
        if (scope.kind !== "step" && scope.kind !== "workflow") continue;
        scope.waiting = true;
        chain.unshift({
          executionId: scope.executionId,
          ...(scope.parentExecutionId
            ? { parentExecutionId: scope.parentExecutionId }
            : {}),
          kind: scope.kind,
          origin: scope.origin,
        });
      }
      return chain;
    },
    async run<T>(
      kind: Exclude<ExecutionKind, "model">,
      origin: ExecutionOrigin,
      action: () => Promise<T>,
      summarize?: (output: T) => string | undefined,
    ): Promise<T> {
      const parent = current.getStore();
      const index = resumed.findIndex(
        (scope) =>
          scope.kind === kind &&
          scope.origin.componentId === origin.componentId &&
          JSON.stringify(scope.origin.stepPath) ===
            JSON.stringify(origin.stepPath),
      );
      const saved = index < 0 ? undefined : resumed.splice(index, 1)[0];
      const scope: Scope = {
        kind,
        origin,
        executionId: saved?.executionId ?? host.id(),
        ...(parent ? { parent, parentExecutionId: parent.executionId } : {}),
      };
      const event = {
        ...fields(scope),
        executionId: scope.executionId,
        origin,
      };
      const start =
        saved && (kind === "step" || kind === "workflow")
          ? (`${kind}.resumed` as const)
          : (`${kind}.started` as const);
      await host.recordEvent({ ...event, type: start });
      const began = performance.now();
      return current.run(scope, async () => {
        let status: "succeeded" | "failed" | "cancelled" = "succeeded";
        let storageFailed = false;
        let summary: string | undefined;
        try {
          const result = await action();
          if (summarize && !cancelled()) {
            try {
              summary = summarize(structuredClone(result));
            } catch {
              // Presentation failures must not invalidate an otherwise successful Tool call.
              await host.recordEvent({
                ...event,
                type: "log",
                details: {
                  level: "warn",
                  message: "Tool result summary unavailable.",
                },
              });
            }
          }
          return result;
        } catch (error) {
          status = cancelled() ? "cancelled" : "failed";
          storageFailed =
            error instanceof IntloomError &&
            ["STORAGE_FAILED", "STORAGE_UNAVAILABLE"].includes(error.code);
          throw error;
        } finally {
          if (!storageFailed) {
            const durationMs = Math.max(
              0,
              Math.round(performance.now() - began),
            );
            if (
              scope.waiting &&
              status === "succeeded" &&
              !cancelled() &&
              (kind === "step" || kind === "workflow")
            )
              pending.push({
                ...event,
                type: `${kind}.waiting`,
                details: { durationMs },
              });
            else
              await host.recordEvent({
                ...event,
                type: `${kind}.finished`,
                details: {
                  status: cancelled() ? "cancelled" : status,
                  durationMs,
                  ...(kind === "tool" &&
                  status === "succeeded" &&
                  !cancelled() &&
                  summary !== undefined
                    ? { summary }
                    : {}),
                },
              });
          }
        }
      });
    },
    model<T>(
      executionId: string,
      origin: ExecutionOrigin,
      action: () => Promise<T>,
    ): Promise<T> {
      const parent = current.getStore();
      return current.run(
        {
          executionId,
          kind: "model",
          origin,
          ...(parent ? { parent, parentExecutionId: parent.executionId } : {}),
        },
        action,
      );
    },
  };
}
export type Observation = ReturnType<typeof createObservation>;
