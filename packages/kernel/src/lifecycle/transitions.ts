import assert from "node:assert/strict";
import { kernelWait } from "./kernel-wait.ts";
import { copyJson } from "@intloom/loom-sdk/json";
import {
  ArtifactRefSchema,
  IntloomError,
  type RunView,
  type ExecutionError,
} from "@intloom/loom-sdk";
import type {
  RunRecord,
  RunRepository,
  ExecutionBoundary,
  EventInput,
  WaitRecord,
} from "./run-contracts.ts";
import type {
  OutcomeServices,
  OutcomeProjection,
} from "../outcomes/contracts.ts";

export function createTransitions({
  repository,
  outcomes,
  id,
  now,
}: {
  repository: RunRepository;
  outcomes: OutcomeServices;
  id(): string;
  now(): string;
}) {
  const closedInteractions = (record: RunRecord): EventInput[] =>
    (record.interactions ?? [])
      .filter(({ request }) => request.status === "pending")
      .map(({ request }) => ({
        type: "interaction.closed",
        executionId: request.executionId,
        origin: request.origin,
        details: { requestId: request.id, reason: "run_ended" },
      }));
  function end(
    record: RunRecord,
    status: RunView["status"],
    error?: ExecutionError,
    output?: RunView["output"],
  ): RunRecord {
    const time = now();
    const cancelledDelivery =
      status === "cancelled" && record.view.deliveryStatus === "pending";
    return {
      ...record,
      ...(cancelledDelivery && record.result
        ? { result: { ...record.result, deliveryStatus: "cancelled" as const } }
        : {}),
      view: {
        ...record.view,
        status,
        ...(cancelledDelivery ? { deliveryStatus: "cancelled" as const } : {}),
        updatedAt: time,
        finishedAt: time,
        waits: [],
        pendingInteractionIds: [],
        ...(error ? { error } : {}),
        ...(status === "succeeded" && output !== undefined ? { output } : {}),
      },
      interactions: (record.interactions ?? []).map((item) =>
        item.request.status === "pending"
          ? {
              ...item,
              request: {
                ...item.request,
                status: "closed",
                closed: { at: time, reason: "run_ended" },
              },
            }
          : item,
      ),
    };
  }
  async function startValidation(runId: string) {
    const executionId = id();
    await repository.log(runId, { type: "validation.started", executionId });
    return executionId;
  }
  async function validate(
    record: RunRecord,
    output: RunRecord["input"],
    executionId: string,
  ): Promise<{
    event: EventInput;
    projection?: OutcomeProjection;
    failure?: ExecutionError;
  }> {
    const began = performance.now();
    try {
      const projection = await outcomes.complete(record, output);
      return {
        projection,
        event: {
          type: "validation.finished",
          executionId,
          details: {
            status: "passed",
            durationMs: Math.round(performance.now() - began),
          },
        },
      };
    } catch (error) {
      if (
        !(error instanceof IntloomError) ||
        ![
          "OUTCOME_CONTRACT_UNSATISFIED",
          "ACCEPTANCE_EXECUTION_FAILED",
        ].includes(error.code)
      )
        throw error;
      return {
        failure: error.toJSON(),
        event: {
          type: "validation.finished",
          executionId,
          details: {
            status: "failed",
            code: error.code,
            durationMs: Math.round(performance.now() - began),
          },
        },
      };
    }
  }
  async function boundary(
    record: RunRecord,
    result: ExecutionBoundary,
    validation?: Awaited<ReturnType<typeof validate>>,
  ) {
    if (result.kind === "delivery-decision") {
      assert.ok(record.checkpoint);
      const state = record.checkpoint.engineRef;
      const candidate = ArtifactRefSchema.parse(state.candidate);
      const projection = state.projection as unknown as OutcomeProjection;
      const deliveryStatus = result.approved ? "approved" : "rejected";
      const settled = end(
        {
          ...record,
          view: { ...record.view, deliveryStatus },
          result: {
            ...(result.approved
              ? projection
              : { quality: "rejected" as const }),
            candidate,
            deliveryStatus,
            ...(result.reason ? { rejectionReason: result.reason } : {}),
          },
          waits: record.waits?.map((w) => ({ ...w, consumed: true })) ?? [],
        },
        "succeeded",
        undefined,
        result.approved ? candidate : undefined,
      );
      await repository.save(settled, [
        ...(result.approved
          ? [
              {
                type: "outcome.delivered" as const,
                details: { quality: projection.quality },
              },
            ]
          : []),
        { type: "run.succeeded" },
      ]);
      return;
    }
    if (result.kind === "waiting") {
      const interactions = [...(record.interactions ?? [])];
      for (const wait of result.waits) {
        if (
          wait.request &&
          !interactions.some(({ request }) => request.id === wait.request?.id)
        )
          interactions.push({ request: wait.request, responses: [] });
      }
      const waits = (record.waits ?? []).map((wait) => ({
        ...wait,
        consumed: !result.waits.some(
          ({ view }) => view.waitId === wait.view.waitId,
        ),
      }));
      for (const wait of result.waits) {
        const index = waits.findIndex(
          ({ view }) => view.waitId === wait.view.waitId,
        );
        if (index < 0) waits.push({ ...wait, consumed: false });
        else
          waits[index] = {
            ...(waits[index] as WaitRecord),
            ...wait,
            consumed: false,
          };
      }
      const { recoveryIssue: _, ...view } = record.view;
      await repository.save(
        {
          ...record,
          checkpoint: result.checkpoint,
          waits,
          interactions,
          view: {
            ...view,
            status: "waiting",
            updatedAt: now(),
            waits: result.waits.map(({ view }) => view),
            pendingInteractionIds: interactions
              .filter(({ request }) => request.status === "pending")
              .map(({ request }) => request.id),
          },
        },
        [
          ...(result.events ??
            [
              ...new Map(
                result.waits
                  .flatMap((wait) => wait.executions)
                  .map((scope) => [scope.executionId, scope]),
              ).values(),
            ]
              .filter(
                (scope) =>
                  !(record.waits ?? []).some(
                    (wait) =>
                      !wait.consumed &&
                      wait.executions.some(
                        (saved) => saved.executionId === scope.executionId,
                      ),
                  ),
              )
              .map(
                (scope): EventInput => ({
                  type: `${scope.kind}.waiting`,
                  executionId: scope.executionId,
                  ...(scope.parentExecutionId
                    ? { parentExecutionId: scope.parentExecutionId }
                    : {}),
                  origin: scope.origin,
                  details: { history: "unavailable" },
                }),
              )),
          ...result.waits
            .filter(
              (wait) =>
                wait.request &&
                !(record.interactions ?? []).some(
                  ({ request }) => request.id === wait.request?.id,
                ),
            )
            .flatMap((wait): EventInput[] =>
              wait.request
                ? [
                    {
                      type: "interaction.requested",
                      executionId: wait.request.executionId,
                      origin: wait.request.origin,
                      details: {
                        requestId: wait.request.id,
                        waitId: wait.view.waitId,
                        kind: wait.request.kind,
                      },
                    },
                  ]
                : [],
            ),
          {
            type: "run.waiting",
            details: { waitIds: result.waits.map((wait) => wait.view.waitId) },
          },
        ],
      );
    } else {
      const checked =
        validation ??
        (!record.view.stopReason && result.kind === "completed"
          ? await validate(
              record,
              result.output,
              await startValidation(record.view.id),
            )
          : undefined);
      const failed =
        record.view.stopReason?.kind === "error"
          ? record.view.stopReason.error
          : result.kind === "failed"
            ? result.error
            : checked?.failure;
      const projection = checked?.projection;
      if (
        record.binding.config.confirmDelivery &&
        result.kind === "completed" &&
        projection &&
        projection.quality !== "rejected" &&
        !record.view.stopReason
      ) {
        const candidate = ArtifactRefSchema.parse(result.output);
        const request = kernelWait(
          record,
          {
            message: "Approve delivery of this file version?",
            context: { candidate },
            origin: { componentId: "delivery" },
            executionId: id(),
          },
          {
            kind: "delivery",
            candidate,
            projection: copyJson(projection, "validated outcome"),
          },
          id,
          now,
        );
        await boundary(
          {
            ...record,
            view: { ...record.view, deliveryStatus: "pending" },
            result: {
              quality: "not_requested",
              candidate,
              deliveryStatus: "pending",
            },
          },
          { ...request, events: checked ? [checked.event] : [] },
        );
        return;
      }
      const status = failed
        ? "failed"
        : record.view.stopReason?.kind === "cancel" ||
            result.kind === "cancelled"
          ? "cancelled"
          : "succeeded";
      await repository.save(
        end(
          {
            ...record,
            ...(projection ? { result: projection } : {}),
            waits: (record.waits ?? []).map((wait) => ({
              ...wait,
              consumed: wait.consumed || result.kind === "completed",
            })),
          },
          status,
          failed,
          result.kind === "completed" ? result.output : undefined,
        ),
        [
          ...(checked ? [checked.event] : []),
          ...closedInteractions(record),
          ...(projection?.outcome
            ? [
                {
                  type: "outcome.delivered" as const,
                  details: { quality: projection.quality },
                },
              ]
            : []),
          { type: `run.${status}` },
        ],
      );
    }
  }
  return { closedInteractions, end, boundary, startValidation, validate };
}
