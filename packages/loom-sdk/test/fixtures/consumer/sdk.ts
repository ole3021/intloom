import { defineAgentTool } from "@intloom/loom-sdk";
import type {
  AgentExecutionAccess,
  AgentTool,
  CodeExecutionAccess,
  ExecutableCode,
  JsonValue,
  ReadonlyJsonValue,
  ReadonlyValue,
  LoomModule,
} from "@intloom/loom-sdk";
import * as z from "zod";

const transformed = defineAgentTool({
  id: "transform",
  description: "Return raw output for the host parser.",
  inputSchema: z.string().transform(Number),
  outputSchema: z.string().transform(Number).pipe(z.number()),
  endsAgent(output) {
    output satisfies number;
    // @ts-expect-error Completion checks receive parsed output, not raw parser input.
    output satisfies string;
    return output > 0;
  },
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

const ordinary: AgentTool<number, string> = {
  id: "ordinary",
  description: "Describe a Tool without transformations.",
  inputSchema: z.number(),
  outputSchema: z.string(),
  execute: (input) => String(input),
};
const tools: readonly AgentTool[] = [ordinary, transformed, asynchronous];
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

function checkModule(module: LoomModule) {
  const exports: LoomModule = {
    blueprint: module.blueprint,
    codes: module.codes,
    agentSpecs: module.agentSpecs,
  };
  // @ts-expect-error Compiled Looms must include Agent specifications.
  const incomplete: LoomModule = {
    blueprint: module.blueprint,
    codes: module.codes,
  };
  void exports;
  void incomplete;
}
void checkModule;

function checkRecovery(recovery: import("@intloom/loom-sdk").CodeRecovery) {
  if (recovery.kind === "user_ask_confirmation") {
    recovery.request.context satisfies string;
    recovery.answer.isConfirmed satisfies boolean;
    // @ts-expect-error Confirmation answers cannot become question answers.
    recovery.answer[0];
    // @ts-expect-error Recovered values are read-only.
    recovery.answer.isConfirmed = true;
  } else {
    recovery.request[0]?.question satisfies string | undefined;
    recovery.answer[0]?.questionId satisfies string | undefined;
    // @ts-expect-error Nested recovery arrays cannot be mutated.
    recovery.answer.push({ questionId: "q", isSkipped: true });
  }
}
void checkRecovery;
const invalidAgentSchema: Pick<
  import("@intloom/loom-sdk").AgentSpec,
  "outputSchema"
> = {
  // @ts-expect-error Final Agent output must contain a routing outcome.
  outputSchema: z.string(),
};
void invalidAgentSchema;
// @ts-expect-error Code has one capability argument and no arbitrary input.
const legacyCode: ExecutableCode = (_input, _access) => ({ outcome: "done" });
void legacyCode;
