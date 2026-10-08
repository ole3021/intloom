import type { AgentTool } from "@intloom/workflow-sdk";
import type { ZodType } from "zod";
import * as z from "zod";
import type { JsonValue } from "../../shared/json.ts";
import type { StageStateInitializer } from "../blueprint.ts";
import type { ExecutableCode } from "../../effector/execution.ts";

const name = z
  .string()
  .min(1)
  .refine(
    (value) =>
      value.trim() === value &&
      !["__proto__", "prototype", "constructor"].includes(value),
    "Invalid or reserved name",
  );

/** Identifies Schemas through the public parsing API, allowing separate Zod installations in Workflow and Kernel packages. */
const schema = z.custom<ZodType<JsonValue>>((value) =>
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
  ),
);
const codeId = z.string().regex(/^CODE-[\w-]{21}$/);
const agentId = z.string().regex(/^AGENT-[\w-]{21}$/);
export const agentModelRoleSchema = z.enum(["reasoning", "coding", "review"]);
const stepTarget = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("step"), stepName: name }),
  z.strictObject({ kind: z.literal("stage_end") }),
]);
const stageTarget = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("stage"), stageName: name }),
  z.strictObject({ kind: z.literal("workflow_end") }),
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
const tool = z.custom<AgentTool>((value) =>
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
      schema.safeParse(value.outputSchema).success,
  ),
);

export const workflowModuleSchema = z.strictObject({
  blueprint: z.strictObject({
    exclusive: z.boolean().optional(),
    flowName: name,
    entryStageName: name,
    stages: z.record(name, stage),
  }),
  codes: z.record(
    codeId,
    z.custom<ExecutableCode>((value) => typeof value === "function"),
  ),
  agentSpecs: z.record(
    agentId,
    z.strictObject({
      name,
      description: z.string(),
      instructions: z.string(),
      llm: agentModelRoleSchema,
      outputSchema: schema,
      skills: z.array(
        z.strictObject({
          name,
          description: z.string(),
          content: z.string(),
          assets: z.array(z.string().min(1)),
        }),
      ),
      tools: z.array(tool),
    }),
  ),
});
