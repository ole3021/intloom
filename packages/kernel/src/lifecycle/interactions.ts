import {
  IntloomError,
  type InteractionResponse,
  type ResponseSource,
  type JsonValue,
} from "@intloom/loom-sdk";
import type {
  LoomRuntime,
  RunRepository,
  WaitRecord,
} from "./run-contracts.ts";

export async function findInteraction(
  repository: RunRepository,
  requestId: string,
) {
  const record = await repository.findInteraction(requestId);
  if (record) {
    const interaction = record.interactions?.find(
      ({ request }) => request.id === requestId,
    );
    if (interaction) return { record, interaction };
  }
  throw new IntloomError(
    "INTERACTION_NOT_FOUND",
    "Interaction was not found.",
    { requestId },
  );
}
export async function recordResponse(
  {
    repository,
    runtime,
    id,
    now,
  }: {
    repository: RunRepository;
    runtime: LoomRuntime;
    id(): string;
    now(): string;
  },
  requestId: string,
  response: InteractionResponse,
  source: ResponseSource,
  commit: <T>(action: () => Promise<T>) => Promise<T>,
) {
  let { record, interaction } = await findInteraction(repository, requestId);
  if (
    interaction.request.status !== "pending" ||
    !["waiting", "running"].includes(record.view.status)
  )
    throw new IntloomError(
      "INTERACTION_NOT_ANSWERABLE",
      "The interaction cannot accept another response.",
      {
        status: interaction.request.status,
        ...(interaction.request.answerResponseId
          ? { answerResponseId: interaction.request.answerResponseId }
          : {}),
      },
    );
  const wait = record.waits?.find(
    ({ view }) => view.requestId === requestId,
  ) as WaitRecord;
  let value: JsonValue | undefined;
  if (response.action === "submit") {
    if (
      interaction.request.responsePolicy === "human" &&
      source.kind !== "human"
    )
      throw new IntloomError(
        "RESPONSE_SOURCE_NOT_ALLOWED",
        "This interaction requires a human response channel.",
      );
    value = await runtime.normalizeResume(record, wait, response.value);
  }
  return commit(async () => {
    ({ record, interaction } = await findInteraction(repository, requestId));
    if (
      interaction.request.status !== "pending" ||
      !["waiting", "running"].includes(record.view.status)
    )
      throw new IntloomError(
        "INTERACTION_NOT_ANSWERABLE",
        "The interaction cannot accept another response.",
      );
    const responseId = id();
    const receivedAt = now();
    const answered = response.action === "submit";
    const updated = {
      request: answered
        ? {
            ...interaction.request,
            status: "answered" as const,
            answerResponseId: responseId,
          }
        : interaction.request,
      responses: [
        ...interaction.responses,
        {
          ...(answered
            ? {
                action: "submit" as const,
                value: value as JsonValue,
              }
            : response),
          id: responseId,
          requestId,
          source: structuredClone(source),
          receivedAt,
        },
      ],
    };
    await repository.save(
      {
        ...record,
        view: {
          ...record.view,
          updatedAt: receivedAt,
          pendingInteractionIds: answered
            ? record.view.pendingInteractionIds.filter((id) => id !== requestId)
            : record.view.pendingInteractionIds,
        },
        waits: answered
          ? (record.waits ?? []).map((item) =>
              item.view.waitId === wait.view.waitId
                ? {
                    ...item,
                    accepted: value === undefined ? {} : { data: value },
                  }
                : item,
            )
          : (record.waits ?? []),
        interactions: (record.interactions ?? []).map((item) =>
          item === interaction ? updated : item,
        ),
      },
      [
        {
          type: "interaction.responded",
          executionId: interaction.request.executionId,
          origin: interaction.request.origin,
          details: {
            requestId,
            responseId,
            action: response.action,
            kind: interaction.request.kind,
            source,
            ...(interaction.request.kind === "approval" && answered
              ? { approved: (value as { approved: boolean }).approved }
              : {}),
          },
        },
      ],
    );
    const receipt = {
      runId: record.view.id,
      requestId,
      responseId,
      requestStatus: answered ? ("answered" as const) : ("pending" as const),
    };
    return { receipt, resumeWaitId: answered ? wait.view.waitId : undefined };
  });
}
