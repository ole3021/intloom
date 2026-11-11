import { runtimeVersions } from "../execution/versions.ts";
import { stableJson } from "@intloom/loom-sdk/json";
import { IntloomError, type ExecutionError } from "@intloom/loom-sdk";
import type {
  RunRepository,
  LoomRuntime,
  RunRecord,
  PersistedExecutionEvidence,
} from "./run-contracts.ts";
import type { createTransitions } from "./transitions.ts";
import { terminal, diagnostic } from "./state.ts";

export async function reconcileRuns({
  repository,
  runtime,
  transitions,
  now,
  wasStopped,
  recoverUpgrade,
}: {
  repository: RunRepository;
  runtime: LoomRuntime;
  transitions: Pick<
    ReturnType<typeof createTransitions>,
    "closedInteractions" | "end" | "boundary"
  >;
  recoverUpgrade?: boolean;
  now(): string;
  wasStopped(runId: string): boolean;
}) {
  const { closedInteractions, end, boundary } = transitions;
  const get = async (runId: string) => {
    const record = await repository.get(runId);
    if (!record)
      throw new IntloomError("RUN_NOT_FOUND", "Run was not found.", { runId });
    return record;
  };
  const updateIssue = async (record: RunRecord, issue?: ExecutionError) => {
    if (stableJson(record.view.recoveryIssue) === stableJson(issue)) return;
    const { recoveryIssue: _, ...view } = record.view;
    await repository.save(
      {
        ...record,
        view: {
          ...view,
          updatedAt: now(),
          ...(issue ? { recoveryIssue: issue } : {}),
        },
      },
      [{ type: "run.recovery.changed" }],
    );
  };
  // Reconcile persisted facts before exposing views. No author modules, credentials or execution are invoked here.
  for (const saved of await repository.listUnfinished()) {
    try {
      const record = await get(saved.view.id);
      if (terminal(record.view.status)) continue;
      if (wasStopped(record.view.id)) {
        const interrupted =
          record.view.status === "running" ||
          (record.view.status === "stopping" &&
            record.stoppingWithActivity !== false);
        await repository.save(
          end(
            {
              ...record,
              view: {
                ...record.view,
                stopReason: {
                  kind: "cancel",
                  message:
                    "A saved stop request was applied after storage became available.",
                },
              },
            },
            interrupted ? "interrupted" : "cancelled",
            interrupted
              ? {
                  code: "EXECUTION_INTERRUPTED",
                  message:
                    "The previous service exited before managed work was confirmed stopped.",
                }
              : undefined,
          ),
          [
            ...closedInteractions(record),
            { type: interrupted ? "run.interrupted" : "run.cancelled" },
          ],
        );
        continue;
      }
      if (record.view.status === "created") continue;
      if (record.binding.formatVersion !== 1)
        throw new IntloomError(
          "PACKAGE_INCOMPATIBLE",
          "Run records require a compatible Kernel.",
        );
      if (
        record.view.status === "stopping" &&
        record.stoppingWithActivity === false &&
        record.view.stopReason?.kind === "cancel"
      ) {
        const cancelQuiet = async (current: RunRecord): Promise<void> => {
          for (const child of current.children ?? []) {
            const value = await get(child.childRunId);
            if (!terminal(value.view.status))
              await cancelQuiet({
                ...value,
                view: {
                  ...value.view,
                  stopReason: {
                    kind: "cancel",
                    message: "Parent Run stopped.",
                  },
                },
              });
          }
          await repository.save(end(current, "cancelled"), [
            ...closedInteractions(current),
            { type: "run.cancelled" },
          ]);
        };
        await cancelQuiet(record);

        continue;
      }
      // A claimed delivery decision only settles metadata for a frozen file.
      // Business execution has already ended and must never be replayed here.
      if (
        record.view.status === "running" &&
        record.checkpoint?.engineRef.kind === "delivery"
      ) {
        const decision = record.waits?.find(
          (w) => !w.consumed && w.view.waitId === record.checkpoint?.waitIds[0],
        )?.accepted?.data;
        if (
          decision &&
          typeof decision === "object" &&
          !Array.isArray(decision) &&
          typeof decision.approved === "boolean"
        ) {
          await boundary(record, {
            kind: "delivery-decision",
            approved: decision.approved,
            ...(typeof decision.reason === "string"
              ? { reason: decision.reason }
              : {}),
          });
          continue;
        }
      }
      let evidence: PersistedExecutionEvidence;
      try {
        evidence = await runtime.inspect(record);
      } catch (error) {
        if (record.view.status !== "waiting")
          throw new IntloomError(
            "RECOVERY_UNAVAILABLE",
            "An unfinished Run cannot be reconciled while its execution store is unavailable.",
          );
        await updateIssue(record, diagnostic(error));
        continue;
      }
      if (record.view.status === "stopping") {
        await repository.save(
          end(record, "interrupted", {
            code: "EXECUTION_INTERRUPTED",
            message:
              "The previous Intloom service exited before managed work was confirmed stopped.",
          }),
          [...closedInteractions(record), { type: "run.interrupted" }],
        );
      } else if (evidence.kind === "completed") {
        await boundary(record, evidence);
      } else if (evidence.kind === "waiting") {
        const sameWait =
          record.view.status === "waiting" &&
          record.checkpoint?.id === evidence.checkpoint.id &&
          stableJson(record.view.waits) ===
            stableJson(evidence.waits.map((wait) => wait.view));
        if (!sameWait) await boundary(record, evidence);
        const current = sameWait ? record : await get(record.view.id);
        let issue: ExecutionError | undefined;
        try {
          if (
            recoverUpgrade &&
            (current.recoveredKernelVersion ??
              current.binding.runtime.version) !== runtimeVersions.kernel
          ) {
            const migrated = {
              ...current,
              recoveredKernelVersion: runtimeVersions.kernel,
            };
            await runtime.check(migrated);
            const { recoveryIssue: _, ...view } = current.view;
            await repository.save(
              { ...migrated, view: { ...view, updatedAt: now() } },
              [{ type: "run.recovery.changed" }],
            );
            continue;
          }
          await runtime.check(current);
        } catch (error) {
          issue = diagnostic(error);
        }
        await updateIssue(current, issue);
      } else if (
        record.view.status === "waiting" &&
        evidence.kind === "missing"
      ) {
        await updateIssue(record, {
          code: "CHECKPOINT_UNAVAILABLE",
          message: "The original wait snapshot is missing.",
        });
      } else {
        await repository.save(
          end(record, "interrupted", {
            code: "EXECUTION_INTERRUPTED",
            message:
              "The previous Intloom service exited without a persisted execution boundary. This Run cannot be replayed.",
          }),
          [...closedInteractions(record), { type: "run.interrupted" }],
        );
      }
    } catch (error) {
      if (
        recoverUpgrade &&
        !(
          error instanceof IntloomError &&
          ["STORAGE_FAILED", "STORAGE_UNAVAILABLE"].includes(error.code)
        )
      ) {
        const issue = diagnostic(error);
        const current = await get(saved.view.id);
        if (current.view.status === "waiting")
          await updateIssue(current, issue);
        else if (!terminal(current.view.status))
          await repository.save(end(current, "interrupted", issue), [
            ...closedInteractions(current),
            { type: "run.interrupted" },
          ]);
        continue;
      }
      if (
        !(error instanceof IntloomError) ||
        error.code !== "STORAGE_UNAVAILABLE"
      )
        throw error;
      await updateIssue(saved, error.toJSON()).catch((failure: unknown) => {
        if (
          !(failure instanceof IntloomError) ||
          failure.code !== "STORAGE_UNAVAILABLE"
        )
          throw failure;
      });
    }
  }
}
