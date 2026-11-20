import type { JsonData, JsonResult } from "../json.ts";
import type { LoomInput } from "../loom/input.ts";
import type { AgentDefinition } from "./agent.ts";
import type { CodeContext, RunContext } from "./context.ts";
import type { WorkflowDefinition } from "./workflow.ts";

export type Code<Input = LoomInput, Output = void, Context = CodeContext> = (
  input: Input,
  context: Context,
) => Promise<Output>;
export type LoomEntry = Code<LoomInput, void, RunContext>;
export type Exec =
  | ((input: never, context: never) => Promise<unknown>)
  | AgentDefinition
  | WorkflowDefinition;

export type ExecInput<E> = E extends AgentDefinition
  ? string
  : E extends WorkflowDefinition<infer I>
    ? I
    : E extends (input: infer I, ...args: never[]) => unknown
      ? I
      : never;

export type ExecOutput<E> =
  E extends AgentDefinition<infer R>
    ? R
    : E extends WorkflowDefinition<unknown, infer O>
      ? O
      : E extends (...args: never[]) => infer R
        ? Awaited<R>
        : never;

export type ValidExec<E> =
  ExecInput<E> extends JsonData<ExecInput<E>>
    ? ExecOutput<E> extends JsonResult<ExecOutput<E>>
      ? unknown
      : never
    : never;

export function getExecKind(
  value: unknown,
): "code" | "agent" | "workflow" | undefined {
  if (typeof value === "function") return "code";
  if (typeof value !== "object" || value === null || !("kind" in value))
    return undefined;
  return value.kind === "agent" || value.kind === "workflow"
    ? value.kind
    : undefined;
}
