import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import * as z from "zod";
import {
  schemaFromJson,
  parseSchemaValue,
  interactionResponse,
  checkResultSchema,
  type LoomCode,
  type LoomContext,
  type JsonValue,
  type ReadonlyJsonValue,
  type ExecutableCode,
  type Blueprint,
  type AgentTool,
  type CodeExecutionAccess,
  type AgentExecutionAccess,
} from "@intloom/loom-sdk";
import {
  validateCompiledLoom,
  type CompiledLoom,
  type PlanStep,
  type CapabilityAgentSpec,
} from "@intloom/loom-sdk/compiled";
import { ERRORS } from "../errors.ts";
import type { LoadedLoom, LoomPackage } from "./types.ts";

function required<T>(value: T | undefined): T {
  if (value === undefined) throw ERRORS.create("RUN_STATE_INVALID");
  return value;
}

export const capabilityStateSchema = z.strictObject({
  input: z.json(),
  values: z.record(z.string(), z.json()),
  candidate: z.json().optional(),
  checks: z.array(
    z.strictObject({
      id: z.string(),
      passed: z.boolean(),
      message: z.string().optional(),
      details: z.json().optional(),
    }),
  ),
  delivered: z.boolean().default(false),
});
export type CapabilityState = z.infer<typeof capabilityStateSchema>;
async function updateState(
  access: AgentExecutionAccess<JsonValue>,
  state: CapabilityState,
) {
  await access.state.update(z.json().parse(JSON.parse(JSON.stringify(state))));
}

export function boundValue(
  state: CapabilityState,
  binding: { from: string | readonly string[]; path?: string | undefined },
): JsonValue {
  const candidates =
    typeof binding.from === "string" ? [binding.from] : binding.from;
  const available = candidates.filter(
    (key) => key === "input" || Object.hasOwn(state.values, key),
  );
  if (available.length !== 1)
    throw ERRORS.create("STEP_EXECUTION_FAILED", {
      message: "A branch merge must have exactly one produced value",
    });
  const from = required(available[0]);
  let value: JsonValue | undefined =
    from === "input" ? state.input : state.values[from];
  if (value === undefined)
    throw ERRORS.create("STEP_EXECUTION_FAILED", {
      message: `Missing value: ${binding.from}`,
    });
  for (const part of binding.path ? binding.path.slice(1).split("/") : []) {
    const key = part.replaceAll("~1", "/").replaceAll("~0", "~");
    if (!value || typeof value !== "object" || !Object.hasOwn(value, key))
      throw ERRORS.create("STEP_EXECUTION_FAILED", {
        message: `Missing data path: ${binding.path}`,
      });
    value = (value as Record<string, JsonValue>)[key];
  }
  if (value === undefined) throw ERRORS.create("STEP_EXECUTION_FAILED");
  return structuredClone(value);
}
export function capabilityContext(
  module: Pick<CompiledLoom, "definition">,
  access: CodeExecutionAccess<JsonValue>,
): LoomContext {
  if (!access.run) throw ERRORS.create("RUN_STATE_INVALID");
  return {
    run: access.run,
    signal: access.signal,
    storage: access.storage,
    ...(access.project ? { project: access.project } : {}),
    interaction: {
      receipt: (id) => access.interaction.receipt?.(id),
      latest: (id) => access.interaction.latest?.(id),
      async request(id, context) {
        const definition = module.definition.interactions[id];
        if (!definition || !access.interaction.request)
          throw ERRORS.create("CAPABILITY_DENIED", {
            message: `Interaction is unavailable: ${id}`,
          });
        return access.interaction.request({
          interactionId: id,
          definition,
          context: parseSchemaValue(definition.context, context),
        });
      },
    },
  };
}
export function capabilityStepInput(
  blueprint: Blueprint,
  stepId: string,
  access: AgentExecutionAccess<JsonValue>,
):
  | { step: Extract<PlanStep, { kind: "agent" }>; input: JsonValue }
  | undefined {
  const capability = blueprint.capability;
  if (!capability) return;
  const step = capability.plan.steps.find((step) => step.id === stepId);
  if (step?.kind !== "agent") throw ERRORS.create("RUN_STATE_INVALID");
  const state = capabilityStateSchema.parse(access.state.value);
  const agent = capability.definition.agents[step.agent];
  if (!agent) throw ERRORS.create("RUN_STATE_INVALID");
  return {
    step,
    input: parseSchemaValue(agent.input, boundValue(state, step.input)),
  };
}
export async function saveCapabilityAgentOutput(
  blueprint: Blueprint,
  step: Extract<PlanStep, { kind: "agent" }>,
  value: unknown,
  access: AgentExecutionAccess<JsonValue>,
) {
  const agent = blueprint.capability?.definition.agents[step.agent];
  if (!agent) throw ERRORS.create("RUN_STATE_INVALID");
  const output = parseSchemaValue(agent.output, value);
  const state = capabilityStateSchema.parse(access.state.value);
  await updateState(access, {
    ...state,
    values: { ...state.values, [step.id]: output },
  });
  return { outcome: "complete" };
}
export function capabilityStepSkipped(
  blueprint: Blueprint,
  id: string,
  stateValue: ReadonlyJsonValue | undefined,
): boolean {
  const step = blueprint.capability?.plan.steps.find((step) => step.id === id);
  return Boolean(
    step &&
      "when" in step &&
      step.when &&
      !isDeepStrictEqual(
        boundValue(capabilityStateSchema.parse(stateValue), step.when.value),
        step.when.equals,
      ),
  );
}

/** Adapts an already compiled plan; does not parse source documents or invent routing. */
export function loadCapabilityModule(
  source: LoomPackage,
  value: unknown,
): LoadedLoom {
  const module = validateCompiledLoom(value);
  const { definition, plan, bindings } = module;
  const codes: Record<string, ExecutableCode> = Object.create(null);
  const agents: Record<string, CapabilityAgentSpec> = Object.create(null);
  const steps: Record<string, import("@intloom/loom-sdk").BlueprintStep> =
    Object.create(null);
  const id = (prefix: string, key: string) =>
    `${prefix}-${createHash("sha256")
      .update(JSON.stringify([source.packageName, definition.name, key]))
      .digest("base64url")
      .slice(0, 21)}`;
  for (const [key, agent] of Object.entries(definition.agents)) {
    const tools: AgentTool[] = agent.tools.map((key) =>
      required(bindings.tools[key]),
    );
    for (const interactionId of agent.interactions) {
      const interaction = required(definition.interactions[interactionId]);
      tools.push({
        id: `interaction_${interactionId}`,
        description: `${interaction.title}${interaction.description ? `: ${interaction.description}` : ""}`,
        inputSchema: z.strictObject({
          context: schemaFromJson(interaction.context),
        }),
        outputSchema: schemaFromJson(interactionResponse(interaction)),
        async execute(input, access) {
          if (!access.interaction?.request)
            throw ERRORS.create("CAPABILITY_DENIED");
          return access.interaction.request({
            interactionId,
            definition: interaction,
            context: z.object({ context: z.json() }).parse(input).context,
          });
        },
      });
    }
    if (new Set(tools.map((tool) => tool.id)).size !== tools.length)
      throw ERRORS.create("RUN_STATE_INVALID", {
        message: `Duplicate Tool in Agent: ${key}`,
      });
    agents[id("AGENT", key)] = {
      name: agent.name,
      description: agent.description,
      instructions: agent.instructions,
      modelProfile: agent.modelProfile,
      outputSchema: schemaFromJson(agent.output),
      tools,
      skills: agent.skills,
    };
  }
  for (const [index, step] of plan.steps.entries()) {
    const next = plan.steps[index + 1];
    const execution =
      step.kind === "agent"
        ? {
            kind: "agent" as const,
            agentId: id("AGENT", step.agent),
            ...(definition.agents[step.agent]?.resume
              ? { recoveryCodeId: id("CODE", `resume-${step.id}`) }
              : {}),
          }
        : { kind: "code" as const, codeId: id("CODE", step.id) };
    steps[step.id] = {
      stepName: step.id,
      execution,
      on: {
        complete: next
          ? { kind: "step", stepName: next.id }
          : { kind: "stage_end" },
      },
    };
    if (execution.kind === "agent") {
      if (step.kind !== "agent") throw ERRORS.create("RUN_STATE_INVALID");
      const resumeId = definition.agents[step.agent]?.resume;
      if (resumeId && execution.recoveryCodeId) {
        const resume = required(bindings.continuations?.[resumeId]);
        const recovery: ExecutableCode = () => {
          throw ERRORS.create("RUN_INTERRUPTED");
        };
        recovery.recover = async (saved, access) => {
          if (
            saved.kind !== "user_ask_interaction" ||
            !definition.agents[step.agent]?.interactions.includes(
              saved.request.interactionId,
            )
          )
            throw ERRORS.create("RUN_STATE_INVALID");
          const input = parseSchemaValue(
            required(definition.agents[step.agent]).input,
            boundValue(
              capabilityStateSchema.parse(access.state.value),
              step.input,
            ),
          );
          const output = await resume(
            { request: saved.request, answer: saved.answer },
            input,
            capabilityContext(module, access),
          );
          return saveCapabilityAgentOutput(blueprint, step, output, access);
        };
        codes[execution.recoveryCodeId] = recovery;
      }
      continue;
    }
    const run = async (
      access: CodeExecutionAccess<JsonValue>,
      saved?: Parameters<NonNullable<ExecutableCode["recover"]>>[0],
    ) => {
      access.signal.throwIfAborted();
      const state = capabilityStateSchema.parse(access.state.value);
      const context = capabilityContext(module, access);
      if (step.kind === "code") {
        if (
          step.when &&
          !isDeepStrictEqual(
            boundValue(state, step.when.value),
            step.when.equals,
          )
        )
          return { outcome: "complete" };
        const code = bindings.codes[step.binding] as unknown as LoomCode;
        const input = boundValue(state, step.input);
        const output = saved
          ? await (() => {
              if (!code.recover || saved.kind !== "user_ask_interaction")
                throw ERRORS.create("RUN_INTERRUPTED", {
                  message: "Code has no compatible interaction continuation",
                });
              return code.recover(
                { request: saved.request, answer: saved.answer },
                input,
                context,
              );
            })()
          : await code(input, context);
        await updateState(access, {
          ...capabilityStateSchema.parse(access.state.value),
          values: { ...state.values, [step.id]: z.json().parse(output) },
        });
      } else if (step.kind === "output") {
        await updateState(access, {
          ...state,
          candidate: parseSchemaValue(
            definition.output,
            boundValue(state, step.input),
          ),
        });
      } else if (step.kind === "check") {
        if (state.candidate === undefined)
          throw ERRORS.create("RUN_STATE_INVALID");
        const check = required(
          definition.acceptance.checks.find((item) => item.id === step.check),
        );
        const result = checkResultSchema.parse(
          await required(bindings.checks[check.binding])(
            {
              input: structuredClone(state.input),
              output: structuredClone(state.candidate),
            },
            context,
          ),
        );
        await updateState(access, {
          ...state,
          checks: [...state.checks, { id: check.id, ...result }],
        });
        if (!result.passed)
          throw ERRORS.create("STEP_EXECUTION_FAILED", {
            message: `Acceptance check failed: ${check.id}${result.message ? `: ${result.message}` : ""}`,
          });
      } else if (step.kind === "confirm") {
        if (state.candidate === undefined)
          throw ERRORS.create("RUN_STATE_INVALID");
        const answer = saved
          ? saved.answer
          : await context.interaction.request(
              step.interaction,
              state.candidate,
            );
        if (
          saved &&
          (saved.kind !== "user_ask_interaction" ||
            saved.request.interactionId !== step.interaction ||
            !isDeepStrictEqual(saved.request.context, state.candidate))
        )
          throw ERRORS.create("RUN_STATE_INVALID");
        if (
          !answer ||
          typeof answer !== "object" ||
          Array.isArray(answer) ||
          !("confirmed" in answer) ||
          answer.confirmed !== true
        )
          throw ERRORS.create("STEP_EXECUTION_FAILED", {
            message: "Delivery was declined",
          });
      } else if (step.kind === "deliver") {
        if (
          state.candidate === undefined ||
          state.checks.some((check) => !check.passed)
        )
          throw ERRORS.create("RUN_STATE_INVALID");
        await updateState(access, { ...state, delivered: true });
      }
      return { outcome: "complete" };
    };
    const code: ExecutableCode = (access) => run(access);
    if (
      step.kind === "confirm" ||
      (step.kind === "code" && bindings.codes[step.binding]?.recover)
    )
      code.recover = (saved, access) => run(access, saved);
    codes[execution.codeId] = code;
  }
  const blueprint: Blueprint = {
    loomName: definition.name,
    inputs: [],
    entryStageName: "capability",
    capability: {
      definition,
      plan,
      ...(bindings.validators ? { validators: bindings.validators } : {}),
    },
    stages: {
      capability: {
        stageName: "capability",
        stateSchema: capabilityStateSchema.transform((value) =>
          z.json().parse(JSON.parse(JSON.stringify(value))),
        ),
        initializeState: (context) => ({
          input: z
            .json()
            .parse(
              Object.hasOwn(context, "invocationInput")
                ? context.invocationInput
                : context.input,
            ),
          values: {},
          checks: [],
          delivered: false,
        }),
        entryStepName: required(plan.steps[0]).id,
        steps,
        on: { complete: { kind: "loom_end" } },
      },
    },
  };
  return { source, blueprint, codes, agentSpecs: agents };
}
