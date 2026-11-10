import { kernelCheckpoint, kernelWait } from "../lifecycle/kernel-wait.ts";
import { clarificationTurn } from "../harness/clarification.ts";
import { satisfies } from "semver";
import { withSkillReader } from "../harness/skills.ts";
import { executeAgent } from "../mastra/agent.ts";
import type { AgentHarnessHost, RunAgent } from "../harness/contracts.ts";
import type { WorkflowServices } from "../mastra/adapter.ts";
import { checkOpenCode, runOpenCode } from "../harness/opencode.ts";
import { stripVTControlCharacters } from "node:util";
import { mkdir, readFile, realpath, stat } from "node:fs/promises";
import { configuredHarness } from "./config.ts";
import {
  checkInstalledTree,
  locateNpmLoom,
  npmRoot,
  readNpmLoom,
} from "../packages/npm.ts";
import { basename, dirname, join, relative, isAbsolute } from "node:path";
import {
  IntloomError,
  type ComponentUses,
  type AgentDefinition,
  type RuntimeBindings,
  type ExecutionError,
  type ExecutionOrigin,
  type ResourceRef,
  type PromptContext,
  type JsonObject,
  type RuntimeContext,
  type JsonValue,
} from "@intloom/loom-sdk";
import { copyJson, stableJson } from "@intloom/loom-sdk/json";
import type {
  LoomRuntime,
  ExecutionBoundary,
  AcceptedResume,
} from "../lifecycle/run-contracts.ts";
import type { openMastraRuntime } from "../mastra/index.ts";
import type { ExecutableComponent, InlineStep } from "./types.ts";
import { selectBindings, resolveCredential } from "./bindings.ts";
import type { PackageStore } from "../packages/store.ts";
import { createLoomLoader } from "./loader.ts";
import { createRunPreparation } from "./preparation.ts";
import {
  withExecutionScope,
  redactDiagnostic,
  redactDiagnosticValue,
} from "./diagnostics.ts";
import { createObservation } from "./observation.ts";
class BusinessFailure extends IntloomError {
  constructor(readonly businessCode: string) {
    super("EXECUTION_FAILED", "The component reported a business failure.");
  }
  override toJSON(): ExecutionError {
    return { ...super.toJSON(), businessCode: this.businessCode };
  }
}
export function createLoomRuntime(
  packages: PackageStore,
  getBindings: (
    projectDir: string | undefined,
    needsModels: boolean,
  ) => Promise<RuntimeBindings>,
  engineFor: (
    record: import("../lifecycle/run-contracts.ts").RunRecord,
  ) => Promise<Awaited<ReturnType<typeof openMastraRuntime>>>,
  globalDir: string,
): LoomRuntime {
  const load = createLoomLoader(packages);
  const preparation = createRunPreparation(
    packages,
    getBindings,
    load,
    globalDir,
  );
  return {
    ...preparation,
    async inspect(record) {
      const checkpoint = kernelCheckpoint(record);
      if (checkpoint)
        return record.view.status === "waiting"
          ? {
              kind: "waiting",
              checkpoint,
              waits: (record.waits ?? []).filter((w) => !w.consumed),
            }
          : { kind: "missing" };
      if (record.binding.entry.kind !== "workflow") return { kind: "missing" };
      return (await engineFor(record)).inspect(
        record.binding.entry.id,
        record.view.id,
      );
    },
    async init(record, log, stop, services) {
      let engine: Awaited<ReturnType<typeof engineFor>> | undefined;
      await preparation.check(record);
      const value = await load(
        record.binding.loom,
        typeof record.binding.config.installedDirectory === "string"
          ? record.binding.config.installedDirectory
          : undefined,
      );
      if (
        Object.values(value.manifest.components).some(
          (c) => c.kind === "workflow",
        )
      )
        engine = await engineFor(record);
      const nativeCommand = record.binding.config.command;

      const workDir = join(
        record.binding.location.dataDir,
        "work",
        record.view.id,
      );
      let harness = record.binding.config.harness as
        | "mastra"
        | "opencode"
        | undefined;
      let requirements = value.manifest.requirements;
      let declaredLooms: Readonly<Record<string, string>> = {};
      let strengths: Record<string, string> | undefined;
      if (nativeCommand) {
        const root = dirname(
          dirname(String(record.binding.config.installedDirectory)),
        );
        const pkg = await readNpmLoom(root);
        if (!pkg) throw new Error(`Missing installed Loom: ${root}`);
        for (const binding of requirements.tools)
          if (!pkg.manifest.permissions?.includes(binding))
            throw new IntloomError(
              "BINDING_UNAVAILABLE",
              `Declare host tool permission in loom.yaml: ${binding}`,
            );
        declaredLooms = pkg.manifest.looms ?? {};
        strengths = Object.fromEntries(
          Object.entries(pkg.manifest.models ?? {}).map(([slot, need]) => [
            slot,
            need.strength,
          ]),
        );
        const models = Object.fromEntries(
          Object.entries(pkg.manifest.models ?? {}).map(([slot, need]) => [
            slot,
            need.capabilities,
          ]),
        );
        for (const [slot, capabilities] of Object.entries(requirements.models))
          models[slot] = [
            ...new Set([...(models[slot] ?? []), ...capabilities]),
          ];
        requirements = { ...requirements, models };
        if (Object.keys(requirements.models).length && !harness)
          harness = await configuredHarness(
            globalDir,
            record.binding.projectDir,
          );
        if (!record.checkpoint) {
          await checkInstalledTree(
            root,
            await npmRoot(true),
            record.binding.projectDir,
          );
          if (harness === "opencode") await checkOpenCode();
          await value.check?.();
        }
        await mkdir(workDir, { recursive: true });
      }
      const host = await getBindings(
        record.binding.projectDir,
        Boolean(
          Object.keys(requirements.models).length ||
            (record.binding.bindings &&
              Object.keys(record.binding.bindings.models).length),
        ),
      );
      const selected = selectBindings(
        { ...value.manifest, requirements },
        host,
        record.binding.bindings?.models,
        strengths,
      );
      if (nativeCommand && !record.binding.bindings)
        await services.bindEnvironment(harness, selected.descriptions);
      const binding = {
        ...value.binding,
        ...(record.binding.location
          ? { location: record.binding.location }
          : {}),
        ...(record.binding.projectDir
          ? { projectDir: record.binding.projectDir }
          : {}),
        ...(record.binding.bindings ? { bindings: selected.descriptions } : {}),
      };
      if (!nativeCommand && stableJson(binding) !== stableJson(record.binding))
        throw new IntloomError(
          "BINDING_MISMATCH",
          "The saved Run binding does not match this runtime.",
        );
      if (record.checkpoint && !kernelCheckpoint(record)) {
        const evidence = await engine?.inspect(
          record.binding.entry.id,
          record.view.id,
        );
        if (
          evidence?.kind !== "waiting" ||
          evidence.checkpoint.snapshotFingerprint !==
            record.checkpoint.snapshotFingerprint
        )
          throw new IntloomError(
            "RECOVERY_UNAVAILABLE",
            "The original checkpoint is unavailable or has changed.",
          );
      }
      const credentials = new Map<string, string>();
      for (const reference of new Set([
        ...Object.values(selected.descriptions.models).map(
          (model) => model.credentialRef,
        ),
        ...Object.values(selected.tools).flatMap((tool) =>
          tool.credentialRef ? [tool.credentialRef] : [],
        ),
      ])) {
        const credential = await resolveCredential(host, reference).catch(
          () => {
            throw new IntloomError(
              "BINDING_UNAVAILABLE",
              "The configured credential reference is unavailable.",
            );
          },
        );
        credentials.set(reference, credential);
      }
      const credentialFor = (reference: string) => {
        const credential = credentials.get(reference);
        if (credential === undefined)
          throw new IntloomError(
            "BINDING_UNAVAILABLE",
            "The configured credential reference is unavailable.",
          );
        return credential;
      };
      const controller = new AbortController();
      const scope = {
        runId: record.view.id,
        loomId: record.view.loom.id,
        secrets: [...credentials.values()],
      };
      let cancelled = false;
      const observation = createObservation(services, () => cancelled);
      let failure: ExecutionError | undefined;
      const active = new Set<Promise<unknown>>();
      let adapter: ReturnType<NonNullable<typeof engine>["init"]> | undefined;
      const failed = async (error: unknown, origin?: ExecutionOrigin) => {
        if (!cancelled && !failure) {
          const diagnostic =
            error instanceof IntloomError
              ? error.toJSON()
              : {
                  code: "EXECUTION_FAILED",
                  message: origin
                    ? `Component "${origin.componentId}" failed during execution.`
                    : "Component execution failed.",
                  ...(error instanceof Error && {
                    details: {
                      name: error.name,
                      message: redactDiagnostic(error.message, scope.secrets),
                      ...(error.stack && {
                        stack: redactDiagnostic(error.stack, scope.secrets),
                      }),
                      ...(error.cause instanceof Error && {
                        cause: redactDiagnostic(
                          error.cause.stack ?? error.cause.message,
                          scope.secrets,
                        ),
                      }),
                    },
                  }),
                };
          failure = redactDiagnosticValue(
            { ...diagnostic, ...(origin && { origin }) },
            scope.secrets,
          );
          try {
            await stop(failure);
          } finally {
            controller.abort();
            await adapter?.cancel();
          }
        }
      };
      const track = <T>(
        action: () => Promise<T>,
        origin?: ExecutionOrigin,
      ): Promise<T> => {
        const task = Promise.resolve()
          .then(() => {
            if (controller.signal.aborted)
              throw new IntloomError(
                "EXECUTION_CANCELLED",
                "Execution was stopped.",
              );
            return withExecutionScope(
              { ...scope, ...(origin && { componentId: origin.componentId }) },
              action,
            );
          })
          .catch(async (error: unknown) => {
            await failed(error, origin);
            throw error;
          });
        active.add(task);
        void task.then(
          () => active.delete(task),
          () => active.delete(task),
        );
        return task;
      };
      const resources = (refs: readonly ResourceRef[] = []) => ({
        async readBytes(ref: ResourceRef) {
          if (!refs.includes(ref))
            throw new IntloomError(
              "RESOURCE_UNDECLARED",
              "This component did not declare the resource.",
            );
          return new Uint8Array(value.resources.get(ref.id) as Uint8Array);
        },
        async readText(ref: ResourceRef) {
          return new TextDecoder("utf-8", { fatal: true }).decode(
            await this.readBytes(ref),
          );
        },
      });
      const run = {
        location: record.binding.location,
        ...(record.view.parentRunId
          ? { parentRunId: record.view.parentRunId }
          : {}),
        runId: record.view.id,
        loom: {
          id: record.view.loom.id,
          version: record.view.loom.version,
        },
      };
      const context = (
        origin: ExecutionOrigin,
        uses: ComponentUses = {},
      ): RuntimeContext => {
        const outcomes = services.outcomes(observation.execution());
        const logger =
          (level: string) => (message: string, details?: JsonObject) => {
            const data = copyJson(
              {
                level,
                message: redactDiagnostic(message, scope.secrets),
                ...(details ? { data: details } : {}),
              },
              "log",
            ) as JsonObject;
            log({
              type: "log",
              ...observation.fields(),
              origin,
              details: redactDiagnosticValue(data, scope.secrets) as {
                level: string;
                message: string;
                data?: JsonObject;
              },
            });
          };
        return {
          run,
          signal: controller.signal,
          resources: resources(uses.resources),
          fail(businessCode) {
            if (
              typeof businessCode !== "string" ||
              !/^[A-Z][A-Z0-9_]{0,63}$/.test(businessCode)
            )
              throw new IntloomError(
                "EXECUTION_FAILED",
                "Invalid business error code.",
              );
            throw new BusinessFailure(businessCode);
          },
          logger: {
            info: logger("info"),
            warn: logger("warn"),
            error: logger("error"),
          },
          agents: {
            generate: async (ref, input) => {
              if (!uses.agents?.includes(ref))
                throw new IntloomError(
                  "COMPONENT_UNDECLARED",
                  "This Agent was not declared in uses.",
                );
              return execute(ref as unknown as AgentDefinition, input, {
                ...origin,
                componentId: ref.id,
              }) as never;
            },
          },
          tools: {
            call: async (ref, input) => {
              if (!uses.tools?.includes(ref))
                throw new IntloomError(
                  "COMPONENT_UNDECLARED",
                  "This Tool was not declared in uses.",
                );
              return execute(ref as unknown as ExecutableComponent, input, {
                ...origin,
                componentId: ref.id,
              }) as never;
            },
          },
          artifacts: {
            write: (value) =>
              track(() => outcomes.artifacts.write(value), origin),
            readBytes: (ref) =>
              track(() => outcomes.artifacts.readBytes(ref), origin),
            readText: (ref) =>
              track(() => outcomes.artifacts.readText(ref), origin),
          },
          acceptance: {
            record: (value) =>
              track(() => outcomes.acceptance.record(value), origin),
          },
        };
      };
      const promptContext = (agent: AgentDefinition): PromptContext => ({
        run,
        resources: resources([
          ...(agent.uses?.resources ?? []),
          ...(typeof agent.instructions === "string"
            ? []
            : [agent.instructions]),
          ...(agent.skills ?? []).flatMap((skill) => [
            skill.instructions,
            ...(skill.resources ?? []),
          ]),
        ]),
      });
      let agentResume: AcceptedResume | undefined;
      let questionBoundary: ExecutionBoundary | undefined;
      const execute = (
        component: ExecutableComponent,
        input: unknown,
        origin: ExecutionOrigin = { componentId: component.id },
      ): Promise<unknown> => {
        const summarize =
          component.kind === "tool" ? component.summarize : undefined;
        return track(
          () =>
            observation.run(
              component.kind,
              origin,
              async () => {
                if (component.kind === "agent") {
                  const agent = nativeCommand
                    ? await withSkillReader(component, promptContext(component))
                    : component;
                  const runner: RunAgent =
                    harness === "opencode" ? runOpenCode : executeAgent;
                  const model =
                    selected.descriptions.models[component.model.slot];
                  if (!model)
                    throw new IntloomError(
                      "BINDING_UNAVAILABLE",
                      "The model binding is missing.",
                    );
                  const host: AgentHarnessHost = {
                    signal: controller.signal,
                    model,
                    context: promptContext(component),
                    observation,
                    id: services.id,
                    recordEvent: services.recordEvent,
                    credential: async () => credentialFor(model.credentialRef),
                    callTool: execute,
                    fail: failed,
                  };
                  if (
                    !nativeCommand ||
                    component !== value.entry ||
                    !requirements.models[component.model.slot]?.includes(
                      "tool_use",
                    )
                  )
                    return runner(host, agent, input, origin);
                  const turn = await clarificationTurn(
                    agent,
                    input,
                    promptContext(component),
                    agentResume,
                  );
                  const output = await runner(
                    {
                      ...host,
                      callTool: async (tool, args, at) => {
                        if (turn.waiting())
                          return "Waiting for a clarification.";
                        const result = await host.callTool(tool, args, at);
                        turn.note(tool.id, args, result);
                        return result;
                      },
                    },
                    turn.definition,
                    input,
                    origin,
                    turn.waiting,
                  );
                  const pending = turn.snapshot();
                  if (pending)
                    questionBoundary = kernelWait(
                      record,
                      {
                        message: pending.question,
                        origin,
                        executionId: observation.execution().executionId,
                      },
                      pending.state,
                      services.id,
                      services.now,
                    );
                  return output;
                }
                if (component.kind === "workflow")
                  return getAdapter().workflow(component, input);
                if (
                  component.kind === "tool" &&
                  component.binding !== undefined
                ) {
                  const tool = selected.tools[component.binding];
                  if (!tool)
                    throw new IntloomError(
                      "BINDING_UNAVAILABLE",
                      "The tool binding is missing.",
                    );
                  const result = await tool.execute({
                    input,
                    signal: controller.signal,
                    config: tool.config ?? {},
                    ...(tool.credentialRef
                      ? {
                          credential: credentialFor(tool.credentialRef),
                        }
                      : {}),
                  });
                  const parsed = component.outputSchema.safeParse(result);
                  if (!parsed.success)
                    throw new IntloomError(
                      "TOOL_OUTPUT_INVALID",
                      "Tool output did not satisfy its contract.",
                    );
                  return parsed.data;
                }
                return component.execute({
                  inputData: input,
                  context: context(origin, component.uses),
                });
              },
              summarize
                ? (output) => {
                    const summary = summarize(output);
                    if (summary === undefined) return;
                    if (typeof summary !== "string")
                      throw new TypeError("Tool summarize must return text.");
                    const text = stripVTControlCharacters(
                      redactDiagnostic(summary, scope.secrets),
                    )
                      .replace(/\s+/gu, " ")
                      .replace(/\p{Cc}/gu, "")
                      .trim();
                    const chars = [...text];
                    return chars.length > 200
                      ? `${chars.slice(0, 199).join("")}…`
                      : text || undefined;
                  }
                : undefined,
            ),
          origin,
        );
      };
      const workflowServices = (): WorkflowServices => ({
        runId: record.view.id,
        kernel: services,
        observation,
        signal: controller.signal,
        async resolveCommand(packageName, command) {
          const range = declaredLooms[packageName];
          if (!range)
            throw new IntloomError(
              "COMPONENT_UNDECLARED",
              `Declare the child Loom in loom.yaml: ${packageName}`,
            );
          const found = await locateNpmLoom(
            packageName,
            await npmRoot(true),
            record.binding.projectDir,
          );
          if (!found || !satisfies(found.version, range))
            throw new IntloomError(
              "LOOM_NOT_FOUND",
              `${packageName}@${range} unavailable`,
            );
          const entry = found.manifest.commands[command];
          if (!entry)
            throw new IntloomError(
              "LOOM_NOT_FOUND",
              `${packageName} has no command ${command}`,
            );
          return packages.installLoom({
            source: dirname(join(found.directory, entry.entry)),
            installedDirectory: true,
            snapshotOnly: true,
          });
        },
        execute,
        evaluate: track,
        inline: (step: InlineStep, data, origin) =>
          track(
            async () =>
              step.execute({
                ...data,
                context: context(origin, step.uses),
              }),
            origin,
          ),
      });
      const getAdapter = () => {
        if (!engine)
          throw new IntloomError(
            "COMPONENT_INVALID",
            "The workflow runtime is unavailable.",
          );
        adapter ??= engine.init(workflowServices());
        return adapter;
      };
      const advance = async (
        input: JsonValue,
        resume?: AcceptedResume,
      ): Promise<ExecutionBoundary> => {
        agentResume = resume;
        observation.begin(resume);
        let boundary: ExecutionBoundary | undefined;
        try {
          for (const path of record.inputFiles ?? []) {
            const file = await stat(path).catch(
              (error: NodeJS.ErrnoException) => {
                if (error.code === "ENOENT" || error.code === "ENOTDIR")
                  return undefined;
                throw error;
              },
            );
            if (!file?.isFile())
              throw new IntloomError(
                "INPUT_FILE_MISSING",
                `Input file is unavailable: ${path}`,
                { path },
              );
          }
          if (value.entry.kind === "workflow")
            boundary = await observation.run(
              "workflow",
              {
                componentId: value.entry.id,
                workflowId: value.entry.id,
                stepPath: [],
              },
              () => getAdapter().workflow(value.entry as never, input, resume),
            );
          else {
            const output = await execute(
              value.entry as ExecutableComponent,
              structuredClone(input),
            );
            try {
              boundary = questionBoundary ?? {
                kind: "completed",
                output: copyJson(output, "output"),
              };
            } catch {
              throw new IntloomError(
                "STORAGE_FAILED",
                "Execution output cannot be saved as finite JSON data.",
              );
            }
          }
          if (
            nativeCommand &&
            boundary?.kind === "completed" &&
            !(
              boundary.output &&
              typeof boundary.output === "object" &&
              !Array.isArray(boundary.output) &&
              boundary.output.kind === "artifact"
            )
          ) {
            const candidate = boundary.output;
            if (
              !candidate ||
              typeof candidate !== "object" ||
              Array.isArray(candidate) ||
              candidate.kind !== "file" ||
              typeof candidate.path !== "string" ||
              typeof candidate.mediaType !== "string"
            )
              throw new Error("The command must return a work file reference");
            const file = await realpath(join(workDir, candidate.path));
            const inside = relative(await realpath(workDir), file);
            if (
              !inside ||
              inside.startsWith(".." + "/") ||
              inside === ".." ||
              isAbsolute(inside)
            )
              throw new Error("Result file must belong to this Run");
            const artifact = await services
              .outcomes(observation.execution())
              .artifacts.write({
                name: basename(file),
                mediaType: candidate.mediaType,
                data: await readFile(file),
              });
            boundary = {
              kind: "completed",
              output: copyJson(artifact, "result"),
            };
          }
        } catch (error) {
          await failed(error);
        }
        while (active.size) await Promise.allSettled([...active]);
        if (cancelled) return { kind: "cancelled" };
        if (failure) return { kind: "failed", error: failure };
        if (boundary?.kind === "waiting")
          return { ...boundary, events: observation.takeWaitingEvents() };
        return boundary as ExecutionBoundary;
      };
      return {
        start: (input) => withExecutionScope(scope, () => advance(input)),
        resume: (input) =>
          withExecutionScope(scope, () => advance(record.input, input)),
        async cancel() {
          cancelled = true;
          controller.abort();
          await adapter?.cancel();
        },
        async release() {
          await adapter?.release();
        },
      };
    },
  };
}
