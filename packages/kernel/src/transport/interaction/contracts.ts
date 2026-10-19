import type { PendingUserAction, RunView } from "../../runtime/run-view.ts";
import type { ReadonlyJsonValue } from "@intloom/loom-sdk";

export type Presentation<Continuation = never> =
  | { kind: "answered"; answer: ReadonlyJsonValue }
  | { kind: "dismissed" }
  | { kind: "unavailable" }
  | { kind: "input_required"; continuation: Continuation };
export interface ActionPresenter<Continuation = never> {
  present(action: PendingUserAction): Promise<Presentation<Continuation>>;
}
export interface ActionHandling<Continuation = never> {
  readonly run: RunView;
  readonly interaction:
    | "answered"
    | "dismissed"
    | "unavailable"
    | "input_required"
    | "none";
  readonly continuation?: Continuation;
}
export type AnswerAsk = (
  runId: string,
  actionId: string,
  answer: ReadonlyJsonValue,
) => Promise<RunView>;
