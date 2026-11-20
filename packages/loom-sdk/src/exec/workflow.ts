import type { JsonResult, ReadonlyData } from "../json.ts";
import { z } from "zod";
import {
  getExecKind,
  type Exec,
  type ExecInput,
  type ExecOutput,
  type ValidExec,
} from "./types.ts";

declare const workflowTypes: unique symbol;

export interface WorkflowView<Input, Steps> {
  readonly input: ReadonlyData<Input>;
  readonly steps: ReadonlyData<Steps>;
}

export type WorkflowNext<View> =
  | string
  | null
  | readonly {
      readonly when?: (view: View) => boolean;
      readonly to: string | null;
    }[];

export interface StepOptions<Input, Steps, E extends Exec> {
  readonly exec: E;
  readonly input: (view: WorkflowView<Input, Steps>) => ExecInput<E>;
  readonly when?: (view: WorkflowView<Input, Steps>) => boolean;
  readonly next?: WorkflowNext<
    WorkflowView<Input, Steps> & {
      readonly result: ReadonlyData<ExecOutput<E>>;
    }
  >;
}

export interface RepeatOptions<Input, Steps, E extends Exec>
  extends StepOptions<Input, Steps, E> {
  readonly until: (view: {
    readonly result: ReadonlyData<ExecOutput<E>>;
    readonly iteration: number;
  }) => boolean;
  readonly nextInput: (view: {
    readonly result: ReadonlyData<ExecOutput<E>>;
    readonly iteration: number;
  }) => ExecInput<E>;
  readonly max: number;
}

export interface WorkflowNode {
  readonly name: string;
  readonly kind: "step" | "repeat";
  readonly exec: Exec;
  readonly input: (view: never) => unknown;
  readonly when?: ((view: never) => boolean) | undefined;
  readonly next?: WorkflowNext<never> | undefined;
  readonly until?: (view: never) => boolean;
  readonly nextInput?: (view: never) => unknown;
  readonly max?: number;
}

export interface WorkflowDefinition<Input = unknown, Output = unknown> {
  readonly kind: "workflow";
  readonly steps: readonly WorkflowNode[];
  readonly mapResult?: (view: never) => unknown;
  readonly [workflowTypes]?: { readonly input: Input; readonly output: Output };
}

const mappingSchema = z.custom<(view: never) => unknown>(
  (value) =>
    typeof value === "function" && value.constructor.name !== "AsyncFunction",
  "Expected a synchronous mapping function",
);
const conditionSchema = z.custom<(view: never) => boolean>(
  (value) => mappingSchema.safeParse(value).success,
  "Expected a synchronous condition function",
);
const nextSchema = z.union([
  z.string().min(1),
  z.null(),
  z
    .array(
      z.strictObject({
        to: z.string().min(1).nullable(),
        when: conditionSchema.optional(),
      }),
    )
    .min(1)
    .superRefine((rules, context) => {
      for (const [index, rule] of rules.entries()) {
        if ((index === rules.length - 1) !== (rule.when === undefined)) {
          context.addIssue({
            code: "custom",
            path: [index],
            message:
              "Only the final next rule must be an unconditional fallback",
          });
        }
      }
    }),
]);
const nodeFields = {
  name: z.string().trim().min(1),
  exec: z.custom<Exec>(
    (value) => getExecKind(value) !== undefined,
    "Expected a Code, Agent or Workflow",
  ),
  input: mappingSchema,
  when: conditionSchema.optional(),
  next: nextSchema.optional(),
};
export const workflowDefinitionSchema = z
  .strictObject({
    kind: z.literal("workflow"),
    steps: z.array(
      z.discriminatedUnion("kind", [
        z.strictObject({ ...nodeFields, kind: z.literal("step") }),
        z.strictObject({
          ...nodeFields,
          kind: z.literal("repeat"),
          until: conditionSchema,
          nextInput: mappingSchema,
          max: z.number().int().positive(),
        }),
      ]),
    ),
    mapResult: mappingSchema.optional(),
  })
  .superRefine((definition, context) => {
    const names = new Map<string, number>();
    for (const [index, step] of definition.steps.entries()) {
      if (names.has(step.name))
        context.addIssue({
          code: "custom",
          path: ["steps", index, "name"],
          message: `Duplicate step '${step.name}'`,
        });
      names.set(step.name, index);
    }
    for (const [index, step] of definition.steps.entries()) {
      const targets = Array.isArray(step.next)
        ? step.next.map((rule) => rule.to)
        : [step.next];
      for (const target of targets) {
        if (target == null) continue;
        const destination = names.get(target);
        if (destination === undefined || destination <= index) {
          context.addIssue({
            code: "custom",
            path: ["steps", index, "next"],
            message: `Target '${target}' must name a later step in this Workflow`,
          });
        }
      }
    }
  });

type AddResult<S, N extends string, R, Optional extends boolean> = S &
  (Optional extends true ? { [K in N]?: R } : { [K in N]: R });
type NewName<N extends string, S> = N extends keyof S ? never : N;
type CheckedStep<I, S, E extends Exec> = StepOptions<I, S, E> & {
  readonly exec: E & ValidExec<E>;
};
type CheckedRepeat<I, S, E extends Exec> = RepeatOptions<I, S, E> & {
  readonly exec: E & ValidExec<E>;
};
type Conditional<I, S> = {
  readonly when: (view: WorkflowView<I, S>) => boolean;
};
type Branch<I, S, E> = {
  readonly next: WorkflowNext<
    WorkflowView<I, S> & { readonly result: ReadonlyData<ExecOutput<E>> }
  >;
};

export class WorkflowBuilder<
  Input,
  Steps = Record<never, never>,
  Branched extends boolean = false,
> {
  constructor(readonly steps: readonly WorkflowNode[] = []) {}

  step<const N extends string, E extends Exec>(
    name: NewName<N, Steps>,
    options: CheckedStep<Input, Steps, E> & { when?: never; next?: never },
  ): WorkflowBuilder<
    Input,
    AddResult<Steps, N, ExecOutput<E>, Branched>,
    Branched
  >;
  step<const N extends string, E extends Exec>(
    name: NewName<N, Steps>,
    options: CheckedStep<Input, Steps, E> &
      Conditional<Input, Steps> & { next?: never },
  ): WorkflowBuilder<Input, AddResult<Steps, N, ExecOutput<E>, true>, Branched>;
  step<const N extends string, E extends Exec>(
    name: NewName<N, Steps>,
    options: CheckedStep<Input, Steps, E> &
      Branch<Input, Steps, E> & { when?: never },
  ): WorkflowBuilder<Input, AddResult<Steps, N, ExecOutput<E>, Branched>, true>;
  step<const N extends string, E extends Exec>(
    name: NewName<N, Steps>,
    options: CheckedStep<Input, Steps, E> &
      Branch<Input, Steps, E> &
      Conditional<Input, Steps>,
  ): WorkflowBuilder<Input, AddResult<Steps, N, ExecOutput<E>, true>, true>;
  step(name: string, options: StepOptions<Input, Steps, Exec>) {
    return new WorkflowBuilder<Input>([
      ...this.steps,
      { ...options, name, kind: "step" },
    ]);
  }

  repeat<const N extends string, E extends Exec>(
    name: NewName<N, Steps>,
    options: CheckedRepeat<Input, Steps, E> & { when?: never; next?: never },
  ): WorkflowBuilder<
    Input,
    AddResult<Steps, N, ExecOutput<E>, Branched>,
    Branched
  >;
  repeat<const N extends string, E extends Exec>(
    name: NewName<N, Steps>,
    options: CheckedRepeat<Input, Steps, E> &
      Conditional<Input, Steps> & { next?: never },
  ): WorkflowBuilder<Input, AddResult<Steps, N, ExecOutput<E>, true>, Branched>;
  repeat<const N extends string, E extends Exec>(
    name: NewName<N, Steps>,
    options: CheckedRepeat<Input, Steps, E> &
      Branch<Input, Steps, E> & { when?: never },
  ): WorkflowBuilder<Input, AddResult<Steps, N, ExecOutput<E>, Branched>, true>;
  repeat<const N extends string, E extends Exec>(
    name: NewName<N, Steps>,
    options: CheckedRepeat<Input, Steps, E> &
      Branch<Input, Steps, E> &
      Conditional<Input, Steps>,
  ): WorkflowBuilder<Input, AddResult<Steps, N, ExecOutput<E>, true>, true>;
  repeat(name: string, options: RepeatOptions<Input, Steps, Exec>) {
    return new WorkflowBuilder<Input>([
      ...this.steps,
      { ...options, name, kind: "repeat" },
    ]);
  }

  returns<Result>(
    map: (view: WorkflowView<Input, Steps>) => Result & JsonResult<Result>,
  ): WorkflowResultBuilder<Input, Result> {
    return new WorkflowResultBuilder(this.steps, map);
  }

  build(): WorkflowDefinition<Input, void> {
    return { kind: "workflow", steps: this.steps };
  }
}

export class WorkflowResultBuilder<Input, Result> {
  constructor(
    readonly steps: readonly WorkflowNode[],
    private readonly mapResult: (view: never) => Result,
  ) {}

  build(): WorkflowDefinition<Input, Result> {
    return { kind: "workflow", steps: this.steps, mapResult: this.mapResult };
  }
}

export function workflow<Input>() {
  return new WorkflowBuilder<Input>();
}
