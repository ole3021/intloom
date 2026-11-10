import type { input, output, ZodType } from "zod";
import type { ComponentUses } from "../context/runtime-context.ts";
import type { JsonValue } from "../contracts/json.ts";
import { ApprovalAnswerSchema } from "../contracts/interaction.ts";
import { assertPortableSchema } from "../schema/portable.ts";
import {
  checkSchemas,
  type ExecuteArgs,
  freezeUses,
  type MaybePromise,
} from "./components.ts";
import { checkId, DefinitionError } from "./errors.ts";
import type {
  DefinitionIO,
  InputOf,
  NormalizedInputOf,
  OutputOf,
  SchemaDefinition,
} from "./io.ts";
import type { LoomEntry, LoomRef } from "./loom.ts";

declare const suspended: unique symbol;
export interface Suspended {
  readonly [suspended]: true;
}
export type StepExecutionResult<O> = O | Suspended;
export interface StepReference<
  Id extends string = string,
  I = unknown,
  N = unknown,
  O = unknown,
> extends DefinitionIO<I, N, O> {
  readonly kind: "step";
  readonly id: Id;
  readonly source: "inline" | "component" | "loom";
}
/** Invoke the external command declared in the package manifest as a child Run. */
export function loomCommandStep<const Id extends string>(
  id: Id,
  packageName: string,
  command: string,
) {
  checkId(id);
  checkId(command);
  if (!/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(packageName))
    throw new DefinitionError(
      "DEFINITION_INVALID",
      id,
      "Expected a full npm package name",
    );
  const step: StepReference<
    Id,
    unknown,
    unknown,
    import("../contracts/outcome.ts").ArtifactRef
  > & {
    source: "loom";
    resource: { kind: "loom_command"; packageName: string; command: string };
  } = {
    kind: "step",
    source: "loom",
    id,
    resource: { kind: "loom_command", packageName, command },
  };
  return Object.freeze(step);
}
export type StepResult<D extends StepReference> = OutputOf<D> | null;
export type StepInput<D extends StepReference> = D["source"] extends "loom"
  ? InputOf<D>
  : NormalizedInputOf<D>;
export interface StepDataContext<I, Initial = unknown> {
  readonly inputData: I;
  getInitData(): Initial;
  getStepResult<D extends StepReference>(step: D): StepResult<D>;
}
export type InteractionDefinition<S> = {
  readonly message: (args: { readonly suspendData: S }) => string;
  readonly context?: (args: { readonly suspendData: S }) => JsonValue;
} & (
  | { readonly kind?: "ask"; readonly responsePolicy?: "any" | "human" }
  | { readonly kind: "approval"; readonly responsePolicy?: "human" }
);
type SchemaValue<S> = S extends ZodType ? output<S> : never;
export type StepExecuteArgs<I, S, R, U extends ComponentUses> = ExecuteArgs<
  I,
  U
> &
  StepDataContext<I> & {
    readonly resumeData?: R;
    readonly suspendData?: S;
  } & ([S] extends [never]
    ? { readonly suspend?: never }
    : { suspend(payload: S): Promise<Suspended> });

export interface StepDefinition<
  Id extends string = string,
  I extends ZodType = ZodType,
  O extends ZodType = ZodType,
  S extends ZodType | undefined = undefined,
  R extends ZodType | undefined = undefined,
  U extends ComponentUses = ComponentUses,
> extends StepReference<Id, input<I>, output<I>, output<O>>,
    SchemaDefinition<I, O> {
  readonly id: Id;
  readonly source: "inline";
  readonly uses?: U;
  readonly suspendSchema?: S;
  readonly resumeSchema?: R;
  readonly interaction?: [S, R] extends [ZodType, ZodType]
    ? InteractionDefinition<SchemaValue<S>>
    : never;
  readonly execute: (
    args: StepExecuteArgs<output<I>, SchemaValue<S>, SchemaValue<R>, U>,
  ) => MaybePromise<StepExecutionResult<output<O>>>;
}

export type StepResource =
  | LoomEntry
  | (SchemaDefinition & {
      readonly kind: "tool";
      readonly description: string;
    } & (
        | { readonly execute: (...args: never[]) => unknown }
        | { readonly binding: string }
      ))
  | LoomRef<unknown, unknown, unknown>;
export interface ResourceStepDefinition<
  Id extends string,
  D extends StepResource,
> extends StepReference<Id, InputOf<D>, NormalizedInputOf<D>, OutputOf<D>> {
  readonly source: D extends LoomRef<unknown, unknown, unknown>
    ? "loom"
    : "component";
  readonly resource: D;
}

export function defineStep<const Id extends string, D extends StepResource>(
  resource: D,
  options: { readonly id: Id },
): ResourceStepDefinition<Id, D>;
export function defineStep<
  const Id extends string,
  I extends ZodType,
  O extends ZodType,
  S extends ZodType | undefined = undefined,
  R extends ZodType | undefined = undefined,
  const U extends ComponentUses = Record<never, never>,
>(
  definition: Omit<
    StepDefinition<Id, I, O, S, R, U>,
    "kind" | "source" | "interaction"
  > &
    ([S, R] extends [ZodType, ZodType]
      ? { readonly interaction?: InteractionDefinition<SchemaValue<S>> }
      : { readonly interaction?: never }),
): StepDefinition<Id, I, O, S, R, U>;
export function defineStep(
  definition: StepResource | SchemaDefinition,
  options?: { readonly id: string },
): object {
  if (options) {
    checkId(options.id);
    if (
      !("kind" in definition) ||
      !["code", "agent", "tool", "workflow", "loom_ref"].includes(
        definition.kind,
      )
    )
      throw new DefinitionError(
        "ENTRY_INVALID",
        options.id,
        "Expected an executable component, committed Workflow, or LoomRef.",
      );
    if (Object.keys(options).some((key) => key !== "id"))
      throw new DefinitionError(
        "DEFINITION_INVALID",
        options.id,
        "Resource steps inherit their schemas; only id can be provided.",
      );
    return Object.freeze({
      kind: "step",
      id: options.id,
      source: definition.kind === "loom_ref" ? "loom" : "component",
      resource: definition,
    });
  }
  const inline = definition as StepDefinition<
    string,
    ZodType,
    ZodType,
    ZodType,
    ZodType
  >;
  checkSchemas(inline);
  if (inline.suspendSchema)
    assertPortableSchema(
      inline.suspendSchema,
      "suspend",
      `${inline.id}.suspendSchema`,
    );
  if (inline.resumeSchema)
    assertPortableSchema(
      inline.resumeSchema,
      "resume",
      `${inline.id}.resumeSchema`,
    );
  if (inline.interaction && (!inline.suspendSchema || !inline.resumeSchema))
    throw new DefinitionError(
      "DEFINITION_INVALID",
      `${inline.id}.interaction`,
      "Interaction requires suspendSchema and resumeSchema.",
    );
  if (
    inline.interaction?.kind === "approval" &&
    (inline.resumeSchema !== ApprovalAnswerSchema ||
      (inline.interaction.responsePolicy !== undefined &&
        inline.interaction.responsePolicy !== "human"))
  )
    throw new DefinitionError(
      "DEFINITION_INVALID",
      `${inline.id}.interaction`,
      "Approval requires ApprovalAnswerSchema and a human response policy.",
    );
  return Object.freeze({
    ...inline,
    kind: "step",
    source: "inline",
    ...(inline.uses ? { uses: freezeUses(inline.uses) } : {}),
    ...(inline.interaction
      ? {
          interaction: Object.freeze({
            responsePolicy:
              inline.interaction.kind === "approval" ? "human" : "any",
            ...inline.interaction,
          }),
        }
      : {}),
  });
}
