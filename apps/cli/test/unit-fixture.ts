import { PassThrough } from "node:stream";
import type { PendingUserAction, RunView } from "@intloom/kernel";
import type { PromptApi } from "../src/ui/terminal.ts";
import { createTerminalUi } from "../src/ui/terminal.ts";

export const action: PendingUserAction = {
  id: "ACTION-original",
  flowName: "test",
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
  flowName: "test",
  cursor: action.cursor,
  status: "waiting",
  pendingAction: action,
  createdAt: action.createdAt,
  updatedAt: action.createdAt,
};
export const confirmation: PendingUserAction = {
  ...action,
  kind: "user_ask_confirmation",
  request: { context: "Confirm saving?" },
};

export function terminal(
  answers: readonly (string | undefined)[],
  interactive = true,
  json = false,
) {
  const queue = [...answers];
  const messages: string[] = [];
  const api: PromptApi = {
    async choose(message) {
      messages.push(message);
      return queue.shift();
    },
    async text(message) {
      messages.push(message);
      return queue.shift();
    },
  };
  const output = new PassThrough();
  const error = new PassThrough();
  let stdout = "";
  let stderr = "";
  output.on("data", (data) => {
    stdout += data.toString();
  });
  error.on("data", (data) => {
    stderr += data.toString();
  });
  const ui = createTerminalUi({
    input: new PassThrough(),
    output,
    error,
    interactive,
    json,
    color: false,
    prompts: api,
  });
  return {
    ui,
    messages,
    get stdout() {
      return stdout;
    },
    get stderr() {
      return stderr;
    },
  };
}
