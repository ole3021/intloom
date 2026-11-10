import {
  createStep,
  createWorkflow,
  type AnyWorkflow,
} from "@mastra/core/workflows";
import {
  IntloomError,
  type ResourceStepDefinition,
  type StepDataContext,
  type StepReference,
  type WorkflowDefinition,
  type Suspended,
  type LoomRef,
} from "@intloom/loom-sdk";
import { copyJson } from "@intloom/loom-sdk/json";
import { projectSchema } from "@intloom/loom-sdk/package-format";
import type { WaitDescriptor } from "../lifecycle/run-contracts.ts";
import type { Suspension } from "./checkpoints.ts";
import { z, type ZodType } from "zod";
import type { WorkflowServices } from "./adapter.ts";
import type { ExecutableComponent, InlineStep } from "../execution/types.ts";
export function buildWorkflow(
  services: WorkflowServices,
  definition: WorkflowDefinition,
  id = definition.id,
  path: string[] = [],
): AnyWorkflow {
  const workflowOrigin = {
    workflowId: definition.id,
    componentId: definition.id,
    stepPath: path,
  };
  const scope = new Set<StepReference>();
  for (const node of definition.nodes) {
    if ("step" in node) scope.add(node.step);
    if (node.kind === "parallel")
      for (const step of node.steps) scope.add(step);
    if (node.kind === "branch")
      for (const [, step] of node.branches) scope.add(step);
  }
  const data = (args: {
    inputData: unknown;
    getInitData(): unknown;
    getStepResult(id: string): unknown;
  }): StepDataContext<unknown> => ({
    inputData: args.inputData,
    getInitData: () => args.getInitData(),
    getStepResult: (ref) =>
      (scope.has(ref) ? args.getStepResult(ref.id) : null) as never,
  });
  const observed = (
    native: ReturnType<typeof createStep>,
    origin: import("@intloom/loom-sdk").ExecutionOrigin,
  ) => {
    const execute = native.execute;
    native.execute = (args) =>
      services.observation.run("step", origin, () => execute(args));
    return native;
  };
  const step = (reference: StepReference): ReturnType<typeof createStep> => {
    const origin = {
      workflowId: definition.id,
      stepPath: [...path, reference.id],
      componentId: reference.id,
    };
    if (reference.source === "loom") {
      const ref = (
        reference as StepReference & {
          resource:
            | LoomRef<unknown, unknown, unknown>
            | { kind: "loom_command"; packageName: string; command: string };
        }
      ).resource;
      return observed(
        createStep({
          id: reference.id,
          inputSchema: z.unknown(),
          outputSchema: z.unknown(),
          retries: 0,
          execute: (args) =>
            services.evaluate(async () => {
              const previous = (args.suspendData as Suspension | undefined)
                ?.__intloom;
              const callId = previous?.wait.view.waitId ?? services.kernel.id();
              const child = await services.kernel.child(
                callId,
                ref.kind === "loom_command"
                  ? () => services.resolveCommand(ref.packageName, ref.command)
                  : {
                      id: ref.id,
                      version: ref.version,
                      artifactDigest: ref.artifactDigest,
                    },
                args.inputData,
                services.observation.execution(),
              );
              if (
                child.status === "succeeded" &&
                child.deliveryStatus !== "rejected"
              )
                return child.output;
              if (
                child.deliveryStatus === "rejected" ||
                ["failed", "cancelled", "interrupted"].includes(child.status)
              )
                throw new IntloomError(
                  "CHILD_RUN_FAILED",
                  "The child Loom did not complete successfully.",
                  {
                    childRunId: child.id,
                    ...(child.error ? { reason: child.error.message } : {}),
                  },
                );
              const wait: WaitDescriptor = {
                executions: services.observation.suspend(),
                view: {
                  waitId: callId,
                  kind: "child",
                  childRunId: child.id,
                  origin,
                },
                definitionPath: [...path, reference.id],
                locator: {},
              };
              return args.suspend(
                { __intloom: { version: 2, wait } } satisfies Suspension,
                { resumeLabel: callId },
              );
            }, origin),
        }),
        origin,
      );
    }
    if (reference.source === "inline") {
      const inline = reference as InlineStep;
      return observed(
        createStep({
          id: inline.id,
          inputSchema: inline.inputSchema,
          outputSchema: inline.outputSchema,
          retries: 0,
          execute: (args) => {
            const previous = (args.suspendData as Suspension | undefined)
              ?.__intloom;
            return services.inline(
              inline,
              {
                ...data(args),
                ...(previous ? { suspendData: previous.payload } : {}),
                ...(args.resumeData === undefined
                  ? {}
                  : { resumeData: args.resumeData }),
                suspend: async (payload) => {
                  const waitId = services.kernel.id();
                  const request = inline.interaction
                    ? {
                        id: services.kernel.id(),
                        runId: services.runId,
                        kind: inline.interaction.kind ?? "ask",
                        executionId:
                          services.observation.execution().executionId,
                        origin,
                        message: inline.interaction.message({
                          suspendData: payload,
                        }),
                        ...(inline.interaction.context
                          ? {
                              context: copyJson(
                                inline.interaction.context({
                                  suspendData: payload,
                                }),
                                "interaction.context",
                              ),
                            }
                          : {}),
                        answerSchema: projectSchema(
                          inline.resumeSchema as ZodType,
                          "resume",
                          "input",
                          inline.id,
                        ),
                        responsePolicy:
                          inline.interaction.responsePolicy ?? "any",
                        status: "pending" as const,
                        createdAt: services.kernel.now(),
                      }
                    : undefined;
                  const wait: WaitDescriptor = {
                    executions: services.observation.suspend(),
                    view: {
                      waitId,
                      kind: request ? "interaction" : "external",
                      origin,
                      ...(request ? { requestId: request.id } : {}),
                    },
                    definitionPath: [...path, inline.id],
                    locator: {},
                    ...(request ? { request } : {}),
                  };
                  await args.suspend(
                    {
                      __intloom: {
                        version: 2,
                        wait,
                        payload: copyJson(payload, "suspendData"),
                      },
                    } satisfies Suspension,
                    { resumeLabel: waitId },
                  );
                  return undefined as unknown as Suspended;
                },
              },
              origin,
            );
          },
        }),
        origin,
      );
    }
    const component = (
      reference as ResourceStepDefinition<string, ExecutableComponent>
    ).resource;
    // Mastra's nested Workflow is a Step at runtime; its optional description declaration includes undefined.
    if (component.kind === "workflow") {
      const nestedPath = [...path, reference.id];
      const nested = buildWorkflow(
        services,
        component,
        reference.id,
        nestedPath,
      );
      const execute = nested.execute.bind(nested);
      nested.execute = (args) =>
        services.observation.run("step", origin, () =>
          services.observation.run(
            "workflow",
            {
              componentId: component.id,
              workflowId: component.id,
              stepPath: nestedPath,
            },
            () =>
              execute({
                ...args,
                suspend: (...values) => {
                  services.observation.suspend();
                  return args.suspend(...values);
                },
              }),
          ),
        );
      return nested as unknown as ReturnType<typeof createStep>;
    }
    return observed(
      createStep({
        id: reference.id,
        inputSchema: component.inputSchema,
        outputSchema: component.outputSchema,
        retries: 0,
        execute: ({ inputData }) =>
          services.execute(component, inputData, {
            ...origin,
            componentId: component.id,
          }),
      }),
      origin,
    );
  };
  let value: AnyWorkflow = createWorkflow({
    id,
    inputSchema: definition.inputSchema,
    outputSchema: definition.outputSchema,
    options: { validateInputs: false, autoRestartActiveRuns: false },
    retryConfig: { attempts: 0, delay: 0 },
  });
  for (const [index, node] of definition.nodes.entries()) {
    const options = { id: `intloom:${index}` };
    switch (node.kind) {
      case "then":
        value = value.then(step(node.step));
        break;
      case "map":
        value = value.map(
          (args) =>
            services.evaluate(
              async () =>
                (node.map as (data: StepDataContext<unknown>) => unknown)(
                  data(args),
                ),
              workflowOrigin,
            ),
          options,
        );
        break;
      case "parallel":
        value = value.parallel(node.steps.map(step), options);
        break;
      case "branch":
        value = value.branch(
          node.branches.map(([condition, ref]) => [
            (args) =>
              services.evaluate(
                async () =>
                  Boolean(
                    await (
                      condition as (data: StepDataContext<unknown>) => unknown
                    )(data(args)),
                  ),
                workflowOrigin,
              ),
            step(ref),
          ]),
          options,
        );
        break;
      case "foreach":
        value = value.foreach(step(node.step), {
          ...options,
          concurrency: node.concurrency,
        });
        break;
      case "dowhile":
      case "dountil":
        value = value[node.kind](
          step(node.step),
          (args) =>
            services.evaluate(
              async () =>
                Boolean(
                  await (
                    node.condition as (
                      data: StepDataContext<unknown>,
                    ) => unknown
                  )(data(args)),
                ),
              workflowOrigin,
            ),
          options,
        );
        break;
    }
  }
  if (!definition.nodes.length)
    value = value.map(async ({ inputData }) => inputData, {
      id: "intloom:identity",
    });
  return value.commit();
}
