import {
  defineAgentTool,
  getAgentExecutionAccess,
} from "@intloom/workflow-sdk";
import type {
  AgentExecutionAccess,
  AgentTool,
  CodeExecutionAccess,
  ExecutableCode,
  JsonValue,
  ReadonlyJsonValue,
  ReadonlyValue,
  WorkflowModule,
} from "@intloom/workflow-sdk";
import * as z from "zod";

const transformed = defineAgentTool({
  id: "transform",
  description: "Return raw output for the host parser.",
  inputSchema: z.string().transform(Number),
  outputSchema: z.string().transform(Number).pipe(z.number()),
  execute(input) {
    input satisfies number;
    // @ts-expect-error Input has already been parsed.
    input satisfies string;
    return String(input + 1);
  },
});
transformed satisfies AgentTool<number, number, string>;
transformed.outputSchema.parse("42") satisfies number;

const asynchronous = defineAgentTool({
  id: "async_transform",
  description: "Return asynchronous raw output.",
  inputSchema: z.number(),
  outputSchema: z.string().transform(Number),
  execute: async (input) => String(input),
});
asynchronous satisfies AgentTool<number, number, string>;

defineAgentTool({
  id: "incorrect_output",
  description: "A parsed number is invalid input to this output parser.",
  inputSchema: z.strictObject({}),
  outputSchema: z.string().transform(Number),
  // @ts-expect-error Returning parsed output must not widen raw output inference.
  execute: () => 42,
});
defineAgentTool({
  id: "incorrect_async_output",
  description: "Promises must also contain raw parser input.",
  inputSchema: z.strictObject({}),
  outputSchema: z.string().transform(Number),
  // @ts-expect-error Asynchronous parsed output is not raw parser input.
  execute: async () => 42,
});
defineAgentTool({
  id: "incorrect_input",
  description: "The implementation cannot change the parsed input type.",
  inputSchema: z.string().transform(Number),
  outputSchema: z.string(),
  // @ts-expect-error Execute receives the parsed number.
  execute: (input: string) => input,
});

const legacy: AgentTool<number, string> = {
  id: "legacy",
  description: "Preserve the two existing generic meanings.",
  inputSchema: z.number(),
  outputSchema: z.string(),
  execute: (input) => String(input),
};
const tools: readonly AgentTool[] = [legacy, transformed, asynchronous];
void tools;

type Draft = {
  title: string;
  groups: { items: { count: number }[] }[];
  note?: string;
};

function checkViews(
  draft: ReadonlyValue<Draft>,
  generic: ReadonlyValue<JsonValue>,
) {
  draft.title satisfies string;
  draft.note satisfies string | undefined;
  // @ts-expect-error Read views preserve top-level readonly fields.
  draft.title = "Changed";
  // @ts-expect-error Read views preserve nested readonly arrays.
  draft.groups.push({ items: [] });
  if (draft.groups[0]?.items[0]) {
    draft.groups[0].items[0].count satisfies number;
    // @ts-expect-error Nested business fields are readonly.
    draft.groups[0].items[0].count = 1;
  }
  generic satisfies ReadonlyJsonValue;
  const values: ReadonlyValue<JsonValue[]> = [];
  // @ts-expect-error JSON read arrays cannot be mutated.
  values.push(null);
}
void checkViews;

function checkAccess(
  agent: AgentExecutionAccess<JsonValue>,
  code: CodeExecutionAccess<JsonValue>,
) {
  agent.signal satisfies AbortSignal;
  agent.state.clear() satisfies Promise<void>;
  code.storage.commit([]);
  // @ts-expect-error Agent Storage is read-only.
  agent.storage.commit([]);
  // @ts-expect-error Only Code owns human interactions.
  agent.interaction;
  getAgentExecutionAccess({
    get: () => agent,
  }) satisfies AgentExecutionAccess<JsonValue>;
  // @ts-expect-error Code access requires its cancellation signal.
  const incomplete: CodeExecutionAccess<JsonValue> = {
    state: code.state,
    storage: code.storage,
    interaction: code.interaction,
  };
  void incomplete;
}
void checkAccess;

const complete: ExecutableCode = () => ({ outcome: "complete" });
// @ts-expect-error Every Code result must provide a routing outcome.
const invalidCode: ExecutableCode = () => ({});
void complete;
void invalidCode;

function checkModule(module: WorkflowModule) {
  const exports: WorkflowModule = {
    blueprint: module.blueprint,
    codes: module.codes,
    agentSpecs: module.agentSpecs,
  };
  // @ts-expect-error Compiled Workflows must include Agent specifications.
  const incomplete: WorkflowModule = {
    blueprint: module.blueprint,
    codes: module.codes,
  };
  void exports;
  void incomplete;
}
void checkModule;
