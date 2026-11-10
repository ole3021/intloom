import type { output, ZodType } from "zod";
import type { JsonValue } from "../contracts/json.ts";
import { checkSchemas, type MaybePromise } from "./components.ts";
import { DefinitionError } from "./errors.ts";
import type { OutputOf, SchemaDefinition } from "./io.ts";
import type { StepDataContext, StepInput, StepReference } from "./step.ts";

type Callback = (...args: never[]) => unknown;
export type WorkflowNode =
  | { readonly kind: "then"; readonly step: StepReference }
  | { readonly kind: "map"; readonly map: Callback }
  | { readonly kind: "parallel"; readonly steps: readonly StepReference[] }
  | {
      readonly kind: "branch";
      readonly branches: readonly (readonly [Callback, StepReference])[];
    }
  | {
      readonly kind: "foreach";
      readonly step: StepReference;
      readonly concurrency: number;
    }
  | {
      readonly kind: "dowhile" | "dountil";
      readonly step: StepReference;
      readonly condition: Callback;
    };
export interface WorkflowDefinition<
  Id extends string = string,
  I extends ZodType = ZodType,
  O extends ZodType = ZodType,
> extends SchemaDefinition<I, O> {
  readonly kind: "workflow";
  readonly id: Id;
  readonly type: "mastra";
  readonly nodes: readonly WorkflowNode[];
}
type Compatible<C, S extends StepReference> = [C] extends [StepInput<S>]
  ? unknown
  : { readonly incompatibleStepInput: never };
type Fresh<S extends StepReference, Used extends string> = S["id"] extends Used
  ? { readonly duplicateStepId: never }
  : unknown;
type StepMap<S extends readonly StepReference[]> = {
  [D in S[number] as D["id"]]: OutputOf<D>;
};
type ValidateSteps<
  C,
  S extends readonly StepReference[],
  Used extends string,
> = S extends readonly [
  infer H extends StepReference,
  ...infer T extends readonly StepReference[],
]
  ? readonly [
      H & Compatible<C, H> & Fresh<H, Used>,
      ...ValidateSteps<C, T, Used | H["id"]>,
    ]
  : S;
type Condition<C, I> = (args: StepDataContext<C, I>) => MaybePromise<boolean>;
type BranchSteps<S extends readonly StepReference[], C, I> = {
  readonly [K in keyof S]: readonly [Condition<C, I>, S[K]];
};
type LoopCompatible<S extends StepReference> = [OutputOf<S>] extends [
  StepInput<S>,
]
  ? unknown
  : { readonly incompatibleLoopOutput: never };

export class WorkflowBuilder<
  Id extends string,
  I extends ZodType,
  Current,
  O extends ZodType,
  Used extends string = never,
> {
  readonly kind = "workflow_builder";
  readonly #definition: Omit<WorkflowDefinition<Id, I, O>, "kind" | "nodes">;
  readonly #nodes: readonly WorkflowNode[];
  readonly #ids: ReadonlySet<string>;

  constructor(
    definition: Omit<WorkflowDefinition<Id, I, O>, "kind" | "nodes">,
    nodes: readonly WorkflowNode[] = [],
    ids: ReadonlySet<string> = new Set(),
  ) {
    this.#definition = definition;
    this.#nodes = nodes;
    this.#ids = ids;
  }

  #append<Next, Added extends string = never>(
    node: WorkflowNode,
    steps: readonly StepReference[] = [],
  ): WorkflowBuilder<Id, I, Next, O, Used | Added> {
    const ids = new Set(this.#ids);
    for (const step of steps) {
      if (step.kind !== "step")
        throw new DefinitionError(
          "ENTRY_INVALID",
          this.#definition.id,
          "Workflow constructors require a Step definition.",
        );
      if (ids.has(step.id))
        throw new DefinitionError(
          "STEP_ID_DUPLICATE",
          `${this.#definition.id}.${step.id}`,
          "Each position in a Workflow requires a unique Step id.",
        );
      ids.add(step.id);
    }
    return new WorkflowBuilder(
      this.#definition,
      Object.freeze([...this.#nodes, Object.freeze(node)]),
      ids,
    );
  }

  // biome-ignore lint/suspicious/noThenProperty: The confirmed synchronous builder API uses then; only commit() returns a loadable definition.
  then<S extends StepReference>(
    step: S & Compatible<Current, S> & Fresh<S, Used>,
  ): WorkflowBuilder<Id, I, OutputOf<S>, O, Used | S["id"]> {
    return this.#append({ kind: "then", step }, [step]);
  }
  map<Next extends JsonValue>(
    map: (args: StepDataContext<Current, output<I>>) => MaybePromise<Next>,
  ): WorkflowBuilder<Id, I, Awaited<Next>, O, Used> {
    return this.#append({ kind: "map", map });
  }
  parallel<const S extends readonly [StepReference, ...StepReference[]]>(
    steps: S & ValidateSteps<Current, S, Used>,
  ): WorkflowBuilder<Id, I, StepMap<S>, O, Used | S[number]["id"]> {
    if (!steps.length)
      throw new DefinitionError(
        "DEFINITION_INVALID",
        this.#definition.id,
        "parallel requires at least one step.",
      );
    return this.#append(
      { kind: "parallel", steps: Object.freeze([...steps]) },
      steps,
    );
  }
  branch<const S extends readonly [StepReference, ...StepReference[]]>(
    branches: BranchSteps<S, Current, output<I>> &
      BranchSteps<ValidateSteps<Current, S, Used>, Current, output<I>>,
  ): WorkflowBuilder<Id, I, Partial<StepMap<S>>, O, Used | S[number]["id"]> {
    if (!branches.length)
      throw new DefinitionError(
        "DEFINITION_INVALID",
        this.#definition.id,
        "branch requires at least one route.",
      );
    return this.#append(
      {
        kind: "branch",
        branches: Object.freeze(
          branches.map(([condition, step]) =>
            Object.freeze([condition, step] as const),
          ),
        ),
      },
      branches.map(([, step]) => step),
    );
  }
  foreach<S extends StepReference>(
    step: S &
      Compatible<Current extends readonly (infer Item)[] ? Item : never, S> &
      ([Current] extends [readonly unknown[]]
        ? unknown
        : { readonly arrayInputRequired: never }) &
      Fresh<S, Used>,
    options: { readonly concurrency?: number } = {},
  ): WorkflowBuilder<Id, I, OutputOf<S>[], O, Used | S["id"]> {
    const concurrency = options.concurrency ?? 1;
    if (!Number.isSafeInteger(concurrency) || concurrency < 1)
      throw new DefinitionError(
        "DEFINITION_INVALID",
        `${this.#definition.id}.foreach.concurrency`,
        "Expected a positive integer.",
      );
    return this.#append({ kind: "foreach", step, concurrency }, [step]);
  }
  dowhile<S extends StepReference>(
    step: S & Compatible<Current, S> & LoopCompatible<S> & Fresh<S, Used>,
    condition: Condition<OutputOf<S>, output<I>>,
  ): WorkflowBuilder<Id, I, OutputOf<S>, O, Used | S["id"]> {
    return this.#append({ kind: "dowhile", step, condition }, [step]);
  }
  dountil<S extends StepReference>(
    step: S & Compatible<Current, S> & LoopCompatible<S> & Fresh<S, Used>,
    condition: Condition<OutputOf<S>, output<I>>,
  ): WorkflowBuilder<Id, I, OutputOf<S>, O, Used | S["id"]> {
    return this.#append({ kind: "dountil", step, condition }, [step]);
  }
  commit(
    ..._check: [Current] extends [output<O>]
      ? []
      : [incompatibleWorkflowOutput: never]
  ): WorkflowDefinition<Id, I, O> {
    return Object.freeze({
      ...this.#definition,
      kind: "workflow",
      nodes: this.#nodes,
    });
  }
}

export function defineWorkflow<
  const Id extends string,
  I extends ZodType,
  O extends ZodType,
>(
  definition: SchemaDefinition<I, O> & {
    readonly id: Id;
    readonly type?: "mastra";
  },
): WorkflowBuilder<Id, I, output<I>, O> {
  checkSchemas(definition);
  if (definition.type !== undefined && definition.type !== "mastra")
    throw new DefinitionError(
      "TARGET_UNSUPPORTED",
      `${definition.id}.type`,
      "Only the mastra workflow definition is supported.",
    );
  return new WorkflowBuilder(Object.freeze({ ...definition, type: "mastra" }));
}
