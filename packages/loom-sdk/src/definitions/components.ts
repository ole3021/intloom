import type { core, output, ZodType } from "zod";
import type {
  ComponentUses,
  PromptContext,
  RuntimeContext,
  ToolRef,
} from "../context/runtime-context.ts";
import { assertPortableSchema } from "../schema/portable.ts";
import { checkId, DefinitionError } from "./errors.ts";
import type { SchemaDefinition } from "./io.ts";
import type { ResourceRef, SkillDefinition } from "./resources.ts";

export type MaybePromise<T> = T | Promise<T>;
export interface ExecuteArgs<I, U extends ComponentUses = ComponentUses> {
  readonly inputData: I;
  readonly context: RuntimeContext<U>;
}
export interface CodeDefinition<
  I extends ZodType = ZodType,
  O extends ZodType = ZodType,
  U extends ComponentUses = ComponentUses,
> extends SchemaDefinition<I, O> {
  readonly kind: "code";
  readonly uses?: U;
  readonly execute: (
    args: ExecuteArgs<output<I>, U>,
  ) => MaybePromise<output<O>>;
}

export function checkSchemas(definition: SchemaDefinition): void {
  checkId(definition.id);
  assertPortableSchema(
    definition.inputSchema,
    "input",
    `${definition.id}.inputSchema`,
  );
  assertPortableSchema(
    definition.outputSchema,
    "output",
    `${definition.id}.outputSchema`,
  );
}

export function freezeUses<U extends ComponentUses>(uses: U): U {
  return Object.freeze({
    ...uses,
    ...(uses.agents ? { agents: Object.freeze([...uses.agents]) } : {}),
    ...(uses.tools ? { tools: Object.freeze([...uses.tools]) } : {}),
    ...(uses.resources
      ? { resources: Object.freeze([...uses.resources]) }
      : {}),
  });
}

export function defineCode<
  const Id extends string,
  I extends ZodType,
  O extends ZodType,
  const U extends ComponentUses = Record<never, never>,
>(
  definition: Omit<CodeDefinition<I, O, U>, "kind" | "id"> & {
    readonly id: Id;
  },
): CodeDefinition<I, O, U> & { readonly id: Id } {
  checkSchemas(definition);
  return Object.freeze({
    ...definition,
    kind: "code",
    ...(definition.uses ? { uses: freezeUses(definition.uses) } : {}),
  });
}

type ToolImplementation<
  I extends ZodType,
  O extends ZodType,
  U extends ComponentUses,
> =
  | {
      readonly execute: (
        args: ExecuteArgs<output<I>, U>,
      ) => MaybePromise<output<O>>;
      readonly uses?: U;
      readonly binding?: never;
    }
  | {
      readonly binding: string;
      readonly execute?: never;
      readonly uses?: never;
    };
export type ToolDefinition<
  I extends ZodType = ZodType,
  O extends ZodType = ZodType,
  U extends ComponentUses = ComponentUses,
> = SchemaDefinition<I, O> & {
  readonly kind: "tool";
  readonly description: string;
  readonly summarize?: (output: output<O>) => string | undefined;
} & ToolImplementation<I, O, U>;

export function defineTool<
  const Id extends string,
  I extends ZodType,
  O extends ZodType,
  const U extends ComponentUses = Record<never, never>,
>(
  definition: SchemaDefinition<I, O> & {
    readonly id: Id;
    readonly description: string;
    readonly summarize?: (output: output<O>) => string | undefined;
  } & ToolImplementation<I, O, U>,
): ToolDefinition<I, O, U> & { readonly id: Id } {
  checkSchemas(definition);
  if (
    definition.summarize !== undefined &&
    typeof definition.summarize !== "function"
  )
    throw new DefinitionError(
      "DEFINITION_INVALID",
      `${definition.id}.summarize`,
      "Tool summarize must be a function.",
    );
  if (
    (typeof definition.execute === "function") ===
    (typeof definition.binding === "string")
  )
    throw new DefinitionError(
      "DEFINITION_INVALID",
      `${definition.id}.implementation`,
      "Provide exactly one of execute and binding.",
    );
  if (definition.binding !== undefined) {
    checkId(definition.binding, `${definition.id}.binding`);
    return Object.freeze({ ...definition, kind: "tool" });
  }
  return Object.freeze({
    ...definition,
    kind: "tool",
    ...(definition.uses ? { uses: freezeUses(definition.uses) } : {}),
  });
}

export type ModelCapability = "tool_use" | "structured_output";
export interface AgentDefinition<
  I extends ZodType = ZodType,
  O extends ZodType = ZodType,
  R extends ResourceRef = ResourceRef,
> extends SchemaDefinition<I, O> {
  readonly kind: "agent";
  readonly instructions: string | ResourceRef;
  readonly prompt: (args: {
    readonly inputData: output<I>;
    readonly context: PromptContext<R>;
  }) => MaybePromise<string>;
  readonly model: {
    readonly slot: string;
    readonly profile?: string;
    readonly capabilities?: readonly ModelCapability[];
  };
  readonly tools?: readonly ToolRef[];
  readonly skills?: readonly SkillDefinition[];
  readonly uses?: { readonly resources?: readonly R[] };
  readonly outputMode: "text" | "structured";
  /** Use the actual result of this tool as the Agent output. */
  readonly resultTool?: string;
  readonly generation?: {
    readonly temperature?: number;
    readonly maxOutputTokens?: number;
    readonly maxSteps?: number;
  };
}

type AgentResources<
  R extends ResourceRef,
  Instructions,
  Skills extends readonly SkillDefinition[],
> =
  | R
  | Extract<Instructions, ResourceRef>
  | Skills[number]["instructions"]
  | NonNullable<Skills[number]["resources"]>[number];

export function defineAgent<
  const Id extends string,
  I extends ZodType,
  O extends ZodType,
  const Mode extends "text" | "structured",
  const Instructions extends string | ResourceRef,
  const Skills extends readonly SkillDefinition[] = readonly [],
  R extends ResourceRef = never,
>(
  definition: Omit<
    AgentDefinition<I, O, R>,
    "kind" | "id" | "outputMode" | "instructions" | "skills" | "prompt"
  > & {
    readonly id: Id;
    readonly instructions: Instructions;
    readonly skills?: Skills;
    readonly prompt: (args: {
      readonly inputData: output<I>;
      readonly context: PromptContext<AgentResources<R, Instructions, Skills>>;
    }) => MaybePromise<string>;
    readonly outputMode: Mode;
    readonly outputSchema: O &
      (Mode extends "text"
        ? output<O> extends string
          ? unknown
          : never
        : unknown);
  },
): AgentDefinition<I, O, AgentResources<R, Instructions, Skills>> & {
  readonly id: Id;
  readonly outputMode: Mode;
} {
  checkSchemas(definition);
  if (definition.model.profile !== undefined)
    checkId(definition.model.profile, `${definition.id}.model.profile`);
  checkId(definition.model.slot, `${definition.id}.model.slot`);
  const isText = (schema: core.$ZodType): boolean => {
    const def = schema._zod.def as core.$ZodTypes["_zod"]["def"];
    if (def.type === "string") return true;
    if (def.type === "literal")
      return def.values.every((value) => typeof value === "string");
    if (def.type === "enum")
      return Object.values(def.entries).every(
        (value) => typeof value === "string",
      );
    return def.type === "union" && def.options.every(isText);
  };
  if (definition.outputMode === "text" && !isText(definition.outputSchema))
    throw new DefinitionError(
      "DEFINITION_INVALID",
      `${definition.id}.outputSchema`,
      "Text mode requires a string schema.",
    );
  const generation = {
    ...definition.generation,
    maxSteps: definition.generation?.maxSteps ?? 5,
  };
  for (const key of ["maxSteps", "maxOutputTokens"] as const) {
    if (
      generation[key] !== undefined &&
      (!Number.isSafeInteger(generation[key]) || generation[key] <= 0)
    )
      throw new DefinitionError(
        "DEFINITION_INVALID",
        `${definition.id}.generation.${key}`,
        "Expected a positive integer.",
      );
  }
  if (
    generation.temperature !== undefined &&
    !Number.isFinite(generation.temperature)
  )
    throw new DefinitionError(
      "DEFINITION_INVALID",
      `${definition.id}.generation.temperature`,
      "Expected a finite number.",
    );
  if (
    definition.resultTool &&
    !definition.tools?.some((tool) => tool.id === definition.resultTool)
  )
    throw new DefinitionError(
      "DEFINITION_INVALID",
      definition.id,
      "Result tool must be included in this Agent’s tools.",
    );
  const capabilities = new Set<ModelCapability>(definition.model.capabilities);
  if (definition.tools?.length) capabilities.add("tool_use");
  if (definition.outputMode === "structured" && !definition.resultTool)
    capabilities.add("structured_output");
  return Object.freeze({
    ...definition,
    kind: "agent",
    model: Object.freeze({
      ...definition.model,
      capabilities: Object.freeze([...capabilities]),
    }),
    generation: Object.freeze(generation),
    ...(definition.tools
      ? { tools: Object.freeze([...definition.tools]) }
      : {}),
    ...(definition.skills
      ? { skills: Object.freeze([...definition.skills]) }
      : {}),
    ...(definition.uses ? { uses: freezeUses(definition.uses) } : {}),
  });
}
