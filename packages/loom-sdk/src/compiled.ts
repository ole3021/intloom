import * as z from "zod";
import { agentToolSchema } from "./module.ts";
import type { AgentTool, SkillSpec } from "./agent.ts";
import type { JsonValue } from "./json.ts";
import type { LoomCode, AcceptanceCheck } from "./capability.ts";
import {
  modelProfileSchema,
  interactionDefinitionSchema,
  valueBindingSchema,
  resultPresentationSchema,
} from "./capability.ts";
import { jsonSchemaSchema, schemaFromJson } from "./schema.ts";

export const compiledLoomProtocolVersion = "2026-10-27.2";
export const capabilityProtocolVersions: readonly string[] = [
  "2026-10-27",
  "2026-10-27.1",
  compiledLoomProtocolVersion,
];
export const compiledAgentSchema = z.strictObject({
  name: z.string().min(1),
  description: z.string(),
  instructions: z.string(),
  resume: z.string().optional(),
  modelProfile: modelProfileSchema,
  input: jsonSchemaSchema,
  output: jsonSchemaSchema,
  interactions: z.array(z.string()),
  skills: z.array(
    z.strictObject({
      name: z.string(),
      description: z.string(),
      content: z.string(),
      assets: z.array(z.string()),
    }),
  ),
  tools: z.array(z.string()),
});
export type CompiledAgent = z.infer<typeof compiledAgentSchema>;
export const compiledAppSchema = z.strictObject({
  type: z.literal("html"),
  entry: z
    .string()
    .regex(
      /^apps\/[A-Za-z][A-Za-z0-9_-]*\/(?!.*(?:^|\/)\.\.?\/)[^\\?#]+\.html$/,
    ),
  mimeType: z.literal("text/html;profile=mcp-app"),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  protocolVersion: z.literal("1"),
});
export type CompiledApp = z.infer<typeof compiledAppSchema>;
export const compiledDefinitionSchema = z.strictObject({
  name: z.string().min(1),
  version: z.string(),
  description: z.string(),
  input: jsonSchemaSchema,
  output: jsonSchemaSchema,
  agents: z.record(z.string(), compiledAgentSchema),
  apps: z.record(z.string(), compiledAppSchema).optional(),
  presentation: resultPresentationSchema.optional(),
  interactions: z.record(z.string(), interactionDefinitionSchema),
  acceptance: z.strictObject({
    checks: z.array(
      z.strictObject({
        id: z.string(),
        binding: z.string(),
        description: z.string().optional(),
      }),
    ),
    confirmation: z.string().optional(),
  }),
});
export type CompiledDefinition = z.infer<typeof compiledDefinitionSchema>;
const location = z.strictObject({
  file: z.string(),
  pointer: z.string().optional(),
});
export const planStepSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    id: z.string(),
    kind: z.literal("code"),
    binding: z.string(),
    input: valueBindingSchema,
    when: z
      .strictObject({ value: valueBindingSchema, equals: z.json() })
      .optional(),
    source: location,
  }),
  z.strictObject({
    id: z.string(),
    kind: z.literal("agent"),
    agent: z.string(),
    input: valueBindingSchema,
    when: z
      .strictObject({ value: valueBindingSchema, equals: z.json() })
      .optional(),
    source: location,
  }),
  z.strictObject({
    id: z.string(),
    kind: z.literal("output"),
    input: valueBindingSchema,
    source: location,
  }),
  z.strictObject({
    id: z.string(),
    kind: z.literal("check"),
    check: z.string(),
    source: location,
  }),
  z.strictObject({
    id: z.string(),
    kind: z.literal("confirm"),
    interaction: z.string(),
    source: location,
  }),
  z.strictObject({
    id: z.string(),
    kind: z.literal("deliver"),
    source: location,
  }),
]);
export type PlanStep = z.infer<typeof planStepSchema>;
export const executionPlanSchema = z.strictObject({
  steps: z.array(planStepSchema).min(3),
});
export type ExecutionPlan = z.infer<typeof executionPlanSchema>;
/** Compiled registry erases individual inputs; only the linked plan may invoke a binding. */
export interface CodeBinding<Output = unknown> {
  (
    input: never,
    context: import("./capability.ts").LoomContext,
  ): Output | Promise<Output>;
  recover?: (
    saved: Parameters<NonNullable<LoomCode["recover"]>>[0],
    input: never,
    context: import("./capability.ts").LoomContext,
  ) => Output | Promise<Output>;
}
export interface LoomBindings {
  readonly codes: Readonly<Record<string, CodeBinding>>;
  readonly checks: Readonly<Record<string, AcceptanceCheck>>;
  readonly tools: Readonly<Record<string, AgentTool>>;
  readonly validators?: Readonly<
    Record<string, import("./capability.ts").InteractionValidator>
  >;
  readonly continuations?: Readonly<
    Record<string, import("./capability.ts").AgentContinuation>
  >;
}
const fn = z.custom<(...args: never[]) => unknown>(
  (value) => typeof value === "function",
);
export const compiledLoomSchema = z.strictObject({
  definition: compiledDefinitionSchema,
  plan: executionPlanSchema,
  bindings: z.strictObject({
    codes: z.record(z.string(), fn),
    checks: z.record(z.string(), fn),
    tools: z.record(z.string(), agentToolSchema),
    validators: z.record(z.string(), fn).optional(),
    continuations: z.record(z.string(), fn).optional(),
  }),
});
export interface CompiledLoom {
  readonly definition: CompiledDefinition;
  readonly plan: ExecutionPlan;
  readonly bindings: LoomBindings;
}

/** Pure reference checks: no business module or custom Tool schema is executed. */
export function validateCompiledLoom(value: unknown): CompiledLoom {
  const parsed = compiledLoomSchema.parse(value);
  const { definition, plan, bindings } = parsed;
  const require = (ok: unknown, message: string) => {
    if (!ok) throw new Error(message);
  };
  const ids = new Set<string>();
  const values = new Set<string>();
  let outputSeen = false;
  const checks: string[] = [];
  let confirmation: string | undefined;
  for (const [index, step] of plan.steps.entries()) {
    require(step.id !== "input" &&
      !["__proto__", "prototype", "constructor"].includes(
        step.id,
      ), "Reserved plan step ID");
    require(!ids.has(step.id), `Duplicate plan step: ${step.id}`);
    const binding = (ref: { from: string | readonly string[] }) => {
      for (const from of typeof ref.from === "string" ? [ref.from] : ref.from)
        require(from === "input" ||
          values.has(from), `Unknown or forward data binding: ${from}`);
      if (Array.isArray(ref.from))
        require(new Set(ref.from).size ===
          ref.from.length, "Duplicate merge source");
    };
    if (step.kind === "code" || step.kind === "agent") {
      require(!outputSeen, "Execution must precede output validation");
      binding(step.input);
      if (step.when) binding(step.when.value);
      values.add(step.id);
      require(step.kind === "code"
        ? Object.hasOwn(bindings.codes, step.binding)
        : Object.hasOwn(
            definition.agents,
            step.agent,
          ), `Missing execution resource: ${step.id}`);
    } else if (step.kind === "output") {
      require(values.size > 0, "Plan requires execution");
      require(!outputSeen, "Duplicate output validation");
      binding(step.input);
      outputSeen = true;
    } else {
      require(outputSeen, "Delivery requires output validation");
      if (step.kind === "check") {
        require(!confirmation, "Checks must precede confirmation");
        checks.push(step.check);
      }
      if (step.kind === "confirm") {
        require(!confirmation, "Duplicate confirmation");
        confirmation = step.interaction;
      }
      if (step.kind === "deliver")
        require(index ===
          plan.steps.length - 1, "Delivery must be the last step");
    }
    ids.add(step.id);
  }
  require(plan.steps.at(-1)?.kind === "deliver", "Missing delivery step");
  require(JSON.stringify(checks) ===
    JSON.stringify(
      definition.acceptance.checks.map((check) => check.id),
    ), "Plan checks differ from acceptance");
  require(new Set(checks).size === checks.length, "Duplicate acceptance check");
  require(confirmation ===
    definition.acceptance
      .confirmation, "Plan confirmation differs from acceptance");
  if (confirmation)
    require(definition.interactions[confirmation]?.kind ===
      "confirm", "Final confirmation must reference a confirm interaction");
  for (const check of definition.acceptance.checks)
    require(Object.hasOwn(
      bindings.checks,
      check.binding,
    ), `Missing check: ${check.id}`);
  schemaFromJson(definition.input);
  schemaFromJson(definition.output);
  const requireApp = (id: string) =>
    require(Object.hasOwn(definition.apps ?? {}, id), `Missing App: ${id}`);
  if (definition.presentation) requireApp(definition.presentation.result.app);
  for (const interaction of Object.values(definition.interactions)) {
    if (interaction.app) requireApp(interaction.app);
    schemaFromJson(interaction.context);
    if (interaction.validate)
      require(Object.hasOwn(
        bindings.validators ?? {},
        interaction.validate,
      ), "Missing interaction validator");
    if (interaction.kind !== "confirm") schemaFromJson(interaction.response);
  }
  for (const agent of Object.values(definition.agents)) {
    if (agent.resume)
      require(Object.hasOwn(
        bindings.continuations ?? {},
        agent.resume,
      ), "Missing Agent continuation");
    schemaFromJson(agent.input);
    schemaFromJson(agent.output);
    for (const id of agent.interactions)
      require(Object.hasOwn(
        definition.interactions,
        id,
      ), `Missing interaction: ${id}`);
    for (const id of agent.tools)
      require(Object.hasOwn(bindings.tools, id), `Missing Tool: ${id}`);
  }
  return parsed as CompiledLoom;
}

/** Prepared resource contract shared by the Kernel adapters; contains no model instance. */
export interface CapabilityAgentSpec {
  readonly name: string;
  readonly description: string;
  readonly instructions: string;
  readonly modelProfile: z.infer<typeof modelProfileSchema>;
  readonly outputSchema: z.ZodType<JsonValue>;
  readonly skills: readonly SkillSpec[];
  readonly tools: readonly AgentTool[];
}
