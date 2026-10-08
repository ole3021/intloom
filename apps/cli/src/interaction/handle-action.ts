import type { RunView } from "@intloom/kernel";
import { failure } from "../errors.ts";
import type {
  ActionHandling,
  ActionPresenter,
  AnswerAsk,
} from "./contracts.ts";

/** Shared by terminal and MCP; dismissing presentation preserves the action and does not become a business rejection. */
export async function handlePendingAction<T>(
  view: RunView,
  presenter: ActionPresenter<T>,
  answerAsk: AnswerAsk,
): Promise<ActionHandling<T>> {
  if (view.status !== "waiting") return { run: view, interaction: "none" };
  if (view.pendingAgentCall) return { run: view, interaction: "unavailable" };
  const action = view.pendingAction;
  if (!action)
    throw failure("CLI_RESULT_INVALID", "A waiting Run has no pending action.");
  const presentation = await presenter.present(action);
  if (presentation.kind === "answered") {
    const next = await answerAsk(view.runId, action.id, presentation.answer);
    return { run: next, interaction: "answered" };
  }
  if (presentation.kind === "input_required")
    return {
      run: view,
      interaction: "input_required",
      continuation: presentation.continuation,
    };
  return { run: view, interaction: presentation.kind };
}
