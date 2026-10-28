import * as z from "zod";
import type { ZodType } from "zod";
import {
  agentModelTypeSchema,
  type AgentTool,
  type AgentSpec,
} from "./agent.ts";
import { loomInputsSchema } from "./inputs.ts";
import {
  loomNameSchema as name,
  codeIdSchema as codeId,
  agentIdSchema as agentId,
  type CodeId,
  type AgentId,
} from "./protocol.ts";
import type { Blueprint, StageStateInitializer } from "./blueprint.ts";
import type { ExecutableCode, StepResult } from "./execution.ts";
import type { JsonValue } from "./json.ts";

export interface LoomModule {
  readonly blueprint: Blueprint;
  readonly codes: Readonly<Record<CodeId, ExecutableCode>>;
  readonly agentSpecs: Readonly<Record<AgentId, AgentSpec>>;
}

/** Identifies Schemas through the public parsing API, allowing separate Zod installations in Loom and Kernel packages. */
const isSchema = (value: unknown) =>
  Boolean(
    value &&
      typeof value === "object" &&
      "safeParse" in value &&
      typeof value.safeParse === "function" &&
      "parse" in value &&
      typeof value.parse === "function" &&
      "safeParseAsync" in value &&
      typeof value.safeParseAsync === "function" &&
      "~standard" in value,
  );
const schema = z.custom<ZodType<JsonValue>>(isSchema);
const resultSchema = z.custom<ZodType<StepResult>>(isSchema);

const stepTarget = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("step"), stepName: name }),
  z.strictObject({ kind: z.literal("stage_end") }),
]);
const stageTarget = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("stage"), stageName: name }),
  z.strictObject({ kind: z.literal("loom_end") }),
]);
const execution = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("code"), codeId }),
  z.strictObject({ kind: z.literal("agent"), agentId }),
]);
const step = z.strictObject({
  stepName: name,
  execution,
  on: z.record(name, stepTarget),
});
const stage = z.strictObject({
  stageName: name,
  stateSchema: schema,
  initializeState: z.custom<StageStateInitializer>(
    (value) => typeof value === "function",
  ),
  entryStepName: name,
  steps: z.record(name, step),
  on: z.record(name, stageTarget),
});
export const agentToolSchema = z.custom<AgentTool>((value) =>
  Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      typeof value.id === "string" &&
      value.id.length > 0 &&
      "description" in value &&
      typeof value.description === "string" &&
      "execute" in value &&
      typeof value.execute === "function" &&
      "inputSchema" in value &&
      schema.safeParse(value.inputSchema).success &&
      "outputSchema" in value &&
      schema.safeParse(value.outputSchema).success &&
      (!("endsAgent" in value) || typeof value.endsAgent === "function"),
  ),
);

export const loomModuleSchema = z.strictObject({
  blueprint: z.strictObject({
    exclusive: z.boolean().optional(),
    loomName: name,
    inputs: loomInputsSchema,
    entryStageName: name,
    stages: z.record(name, stage),
  }),
  codes: z.record(
    codeId,
    z.custom<ExecutableCode>(
      (value) =>
        typeof value === "function" &&
        (!("recover" in value) || typeof value.recover === "function"),
    ),
  ),
  agentSpecs: z.record(
    agentId,
    z.strictObject({
      name,
      description: z.string(),
      instructions: z.string(),
      llm: agentModelTypeSchema,
      outputSchema: resultSchema,
      skills: z.array(
        z.strictObject({
          name,
          description: z.string(),
          content: z.string(),
          assets: z.array(z.string().min(1)),
        }),
      ),
      tools: z.array(agentToolSchema),
    }),
  ),
}) satisfies z.ZodType<LoomModule>;
