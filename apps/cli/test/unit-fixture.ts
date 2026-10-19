import type { PendingUserAction, RunView } from "@intloom/kernel";

export const action: PendingUserAction = {
  id: "ACTION-original",
  loomName: "test",
  cursor: { stageName: "first", stepName: "ask" },
  kind: "user_ask_questions",
  request: [
    {
      id: "required",
      question: "Where should it be deployed?",
      options: [
        { id: "a", label: "  local\ndeployment  " },
        { id: "b", label: "Cloud" },
      ],
      isSkippable: false,
    },
    { id: "optional", question: "Any additional notes?", isSkippable: true },
  ],
  createdAt: "2026-10-07T00:00:00.000Z",
};
export const view: RunView = {
  runId: "RUN-original",
  execution: { source: "cli", agentExecutor: "service" },
  loomName: "test",
  cursor: action.cursor,
  status: "waiting",
  pendingAction: action,
  createdAt: action.createdAt,
  updatedAt: action.createdAt,
};
