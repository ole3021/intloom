import { randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, copyFile, writeFile } from "node:fs/promises";
import { join, dirname, sep } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { createTool, type Tool } from "@mastra/core/tools";
import type { PublicSchema } from "@mastra/core/schema";
import { toolSchema } from "./schema.ts";
import { parseDocument } from "yaml";
import * as z from "zod";
import {
  E2eError,
  runSchema,
  type Options,
  type ProjectProfile,
  type Run,
} from "./contracts.ts";
import type { CaseData } from "./cases.ts";
import type { Evidence } from "./evidence.ts";
import { executionLimits } from "./profile.ts";
import { processResult, validateCommand, caseIntent } from "./commands.ts";
import { runAgent } from "./agent.ts";
import {
  answerTools,
  questionSubmissionSchema,
  confirmationSubmissionSchema,
  validateAnswer,
  validationIssues,
  type AnswerTool,
  type ModelToolCall,
} from "./answers.ts";

const taskSchema = z.object({
  instructions: z.string(),
  outputSchema: z.json(),
  skills: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      content: z.string(),
      assets: z.array(z.object({ id: z.string(), name: z.string() })),
    }),
  ),
  tools: z.array(
    z.object({
      id: z.string(),
      description: z.string(),
      inputSchema: z.json(),
    }),
  ),
});
const queryMcpTools = [
  "list_workflows",
  "get_run",
  "list_runs",
  "status",
  "get_record",
  "get_artifact",
  "list_artifacts",
] as const;
const humanMcpTools = new Set<string>(["flow", ...queryMcpTools]);

export class Session {
  readonly options: Options;
  readonly profile: ProjectProfile;
  readonly caseData: CaseData;
  readonly project: string;
  readonly evidence: Evidence;
  readonly signal: AbortSignal;
  readonly environment: NodeJS.ProcessEnv;
  readonly limits;
  readonly runs = new Map<string, Run>();
  readonly confirmations: {
    runId: string;
    stageName: string;
    confirmed: boolean;
  }[] = [];
  initialized = false;
  configured = false;
  seeded = false;
  preparationStatus: "not_configured" | "not_run" | "passed" | "failed";
  diagnosed = false;
  flowAttempted = false;
  roundIndex = -1;
  activeRunId: string | undefined;
  clientAgentCalls = 0;
  executionFailure: E2eError | undefined;
  private client: Client | undefined;
  private mcpTools: Awaited<ReturnType<Client["listTools"]>>["tools"] = [];
  private transport: StdioClientTransport | undefined;
  private workerCalls = new Set<string>();
  private readonly controller = new AbortController();
  private readonly answerRejections: {
    at: string;
    runId: string;
    actionId: string;
    attempt: number;
    reason: string;
    issues: string[];
    inputType: string;
    cursor: Run["cursor"] | undefined;
  }[] = [];
  private readonly acceptedActions = new Set<string>();
  private readonly invalidCalls = new Set<string>();
  private readonly observationKeys = new Map<string, string>();
  private readonly prepareProject:
    | ((session: Session) => Promise<void>)
    | undefined;
  constructor(
    options: Options,
    profile: ProjectProfile,
    caseData: CaseData,
    project: string,
    evidence: Evidence,
    signal: AbortSignal,
    environment: NodeJS.ProcessEnv = process.env,
    prepareProject?: (session: Session) => Promise<void>,
  ) {
    this.options = options;
    this.profile = profile;
    this.caseData = caseData;
    this.project = project;
    this.evidence = evidence;
    this.signal = AbortSignal.any([signal, this.controller.signal]);
    this.environment = environment;
    this.limits = executionLimits(profile);
    this.prepareProject = prepareProject;
    this.preparationStatus = prepareProject ? "not_run" : "not_configured";
  }
  get intent() {
    return this.caseData.manifest.intents[
      Math.max(0, this.roundIndex)
    ] as string;
  }
  beginRound(index: number) {
    if (
      index !== this.roundIndex + 1 ||
      index >= this.caseData.manifest.intents.length ||
      (this.roundIndex >= 0 &&
        (!this.activeRunId ||
          this.runs.get(this.activeRunId)?.status !== "completed" ||
          !this.runs.get(this.activeRunId)?.settled))
    )
      throw new E2eError(
        "ITERATION_ORDER_INVALID",
        "Complete the current Run before starting the next Intent.",
        "runner",
      );
    this.roundIndex = index;
    this.flowAttempted = false;
    this.activeRunId = undefined;
  }
  private async flow(action: () => Promise<unknown>) {
    this.admission();
    const before = new Set(this.runs.keys());
    const result = await action();
    const admitted = [...this.runs.values()].filter(
      (run) => !before.has(run.runId),
    );
    if (
      admitted.length !== 1 ||
      admitted[0]?.flowName !== this.options.flowName
    )
      this.stop(
        new E2eError(
          "FLOW_ADMISSION_FAILED",
          "The public entry did not admit exactly one Run for the configured Workflow. Do not replay flow.",
          "system",
        ),
      );
    this.activeRunId = admitted[0]?.runId;
    return result;
  }
  async finishRound() {
    if (!this.activeRunId)
      throw new E2eError(
        "RUN_MISSING",
        "The simulated user did not create the current Intent Run.",
        "model",
      );
    let run = await this.getRun(this.activeRunId, this.signal);
    while (["completed", "failed"].includes(run.status) && !run.settled) {
      await delay(100, undefined, { signal: this.signal });
      run = await this.getRun(this.activeRunId, this.signal);
    }
    if (run.status !== "completed" || !run.settled)
      throw new E2eError(
        run.lastError?.code ?? "RUN_INCOMPLETE",
        run.lastError?.message ??
          "The original Run did not complete. Remaining intents were not executed.",
        "system",
      );
    if (
      run.execution.source !==
        (this.options.entry === "cmd" ? "cli" : "agent_ide") ||
      run.execution.agentExecutor !==
        (this.options.entry === "cmd" ? "service" : "mcp_client")
    )
      throw new E2eError(
        "EXECUTION_ENTRY_INVALID",
        "The Run used a different entry or executor.",
        "system",
      );
    if (run.control?.captureDisabled || run.control?.pauseCause)
      throw new E2eError(
        "MIRROR_CAPTURE_FAILED",
        "Mirror capture was interrupted. Inspect the original Run and preserved mirror directory.",
        "system",
      );
    return run;
  }
  private observe(value: unknown): void {
    const parsed = runSchema.safeParse(value);
    if (parsed.success) {
      this.runs.set(parsed.data.runId, parsed.data);
      return;
    }
    if (Array.isArray(value)) {
      for (const part of value) this.observe(part);
      return;
    }
    if (value && typeof value === "object")
      for (const part of Object.values(value)) this.observe(part);
  }
  async cli(args: string[], signal?: AbortSignal, capture = true) {
    const actual =
      args[0] === "init" ? ["init", this.project, ...args.slice(1)] : args;
    const result = await processResult(
      process.execPath,
      [
        this.options.cli,
        ...(args[0] === "init" ? [] : ["--project", this.project]),
        ...actual,
        "--json",
        "--no-color",
        "--no-interactive",
      ],
      dirname(this.project),
      this.limits.commandTimeoutMs,
      signal,
      {
        ...this.environment,
        npm_config_cache: join(dirname(this.project), ".npm-cache"),
      },
    );
    let data: unknown;
    try {
      data = JSON.parse(result.stdout);
    } catch {
      data = null;
    }
    if (capture || result.code !== 0)
      await this.evidence.event("cli", { args: actual, result, data });
    this.observe(data);
    if (args[0] === "doctor" && result.code === 0) this.diagnosed = true;
    if (args[0] === "init" && result.code === 0) this.initialized = true;
    return { ...result, data };
  }
  async connectMcp() {
    if (this.client) return { connected: true, tools: this.mcpProtocol() };
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [this.options.cli, "mcp", "serve", "--project", this.project],
      cwd: this.project,
      stderr: "pipe",
      env: Object.fromEntries(
        Object.entries(this.environment).filter(
          (entry): entry is [string, string] =>
            entry[1] !== undefined &&
            !["NODE_OPTIONS", "NODE_TEST_CONTEXT"].includes(entry[0]),
        ),
      ),
    });
    let diagnostics = "";
    transport.stderr?.on("data", (chunk) => {
      if (diagnostics.length < 65536) diagnostics += String(chunk);
    });
    const client = new Client({ name: "intloom-e2e", version: "1.0.0" });
    try {
      await client.connect(transport, {
        timeout: this.limits.commandTimeoutMs,
      });
    } catch {
      await client.close().catch(() => {});
      await this.evidence.event("mcp_connection_failed", { diagnostics });
      throw new E2eError(
        "MCP_CONNECTION_FAILED",
        "The installed CLI MCP proxy could not connect. See connection evidence.",
        "system",
      );
    }
    this.client = client;
    this.transport = transport;
    const tools = await client.listTools();
    this.mcpTools = tools.tools;
    await this.evidence.event("mcp_connected", { tools, diagnostics });
    return {
      connected: true,
      tools: this.mcpProtocol(),
    };
  }
  mcpProtocol() {
    return this.mcpTools
      .filter((tool) => humanMcpTools.has(tool.name))
      .map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      }));
  }
  async mcp(
    name: string,
    args: Record<string, unknown>,
    signal?: AbortSignal,
    capture = true,
  ) {
    await this.connectMcp();
    let result: Awaited<ReturnType<Client["callTool"]>> | undefined;
    try {
      result = await this.client?.callTool(
        { name, arguments: args },
        {
          timeout: this.limits.commandTimeoutMs,
          ...(signal ? { signal } : {}),
        },
      );
    } catch {
      await this.evidence.event("mcp_outcome_unknown", { name, args });
      throw new E2eError(
        "MCP_OUTCOME_UNKNOWN",
        "The MCP request outcome is unknown. Mutations are not replayed.",
        "system",
      );
    }
    let data: unknown;
    const text =
      result?.content
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("\n") ?? "";
    try {
      data = result?.structuredContent ?? JSON.parse(text || "null");
    } catch {
      if (result?.isError)
        data = { error: { code: "MCP_TOOL_ERROR", message: text } };
      else {
        await this.evidence.event("mcp_response_invalid", {
          name,
          args,
          result,
        });
        throw new E2eError(
          "MCP_RESPONSE_INVALID",
          "The successful MCP response did not contain valid structured data.",
          "system",
        );
      }
    }
    this.evidence.protect(data);
    if (capture || result?.isError)
      await this.evidence.event("mcp", { name, args, result, data });
    this.observe(data);
    return { isError: result?.isError === true, data };
  }
  async getRun(runId: string, signal?: AbortSignal) {
    let run: Run;
    if (this.options.entry === "mcp") {
      const result = await this.mcp("get_run", { runId }, signal, false);
      if (result.isError)
        throw new E2eError(
          "RUN_QUERY_FAILED",
          "The MCP Run query failed.",
          "system",
        );
      run = z.object({ run: runSchema }).parse(result.data).run;
    } else {
      const result = await this.cli(["attach", runId], signal, false);
      if (
        !z
          .object({ ok: z.literal(true), data: z.unknown() })
          .safeParse(result.data).success
      )
        throw new E2eError(
          "RUN_QUERY_FAILED",
          "The CLI Run query did not return valid JSON.",
          "system",
        );
      run = z
        .object({ ok: z.literal(true), data: runSchema })
        .parse(result.data).data;
    }
    if (run.runId !== runId)
      throw new E2eError(
        "RUN_QUERY_FAILED",
        "No authoritative Run snapshot was returned.",
        "system",
      );
    this.runs.set(runId, run);
    const observation = {
      runId,
      status: run.status,
      cursor: run.cursor,
      settled: run.settled,
      actionId: run.pendingAction?.id,
      actionKind: run.pendingAction?.kind,
      agentCallId: run.pendingAgentCall?.id,
      stepVisitId: run.control?.stepVisitId,
      captureDisabled: run.control?.captureDisabled,
      pauseCause: run.control?.pauseCause,
      lastError: run.lastError,
    };
    const key = JSON.stringify(observation);
    if (this.observationKeys.get(runId) !== key) {
      this.observationKeys.set(runId, key);
      await this.evidence.event("run_observed", {
        ...observation,
        timing: (run.metrics as { timing?: unknown } | undefined)?.timing,
      });
    }
    return run;
  }
  async observeRun(runId: string) {
    let run = await this.getRun(runId, this.signal);
    while (
      ["running", "waiting"].includes(run.status) &&
      !run.pendingAction &&
      !run.pendingAgentCall
    ) {
      await delay(1000, undefined, { signal: this.signal });
      run = await this.getRun(runId, this.signal);
    }
    const snapshot = {
      runId: run.runId,
      flowName: run.flowName,
      status: run.status,
      cursor: run.cursor,
      execution: run.execution,
      pendingAction: run.pendingAction,
      pendingAgentCall: run.pendingAgentCall,
      results: run.results,
      settled: run.settled,
      lastError: run.lastError,
    };
    return {
      run: snapshot,
      ...(run.pendingAction
        ? {
            answerContract: {
              tool:
                run.pendingAction.kind === "user_ask_questions"
                  ? "submit_questions"
                  : "submit_confirmation",
              inputSchema: z.toJSONSchema(
                run.pendingAction.kind === "user_ask_questions"
                  ? questionSubmissionSchema
                  : confirmationSubmissionSchema,
              ),
              correctionLimit: 1,
            },
          }
        : {}),
    };
  }
  diagnostics() {
    const run =
      [...this.runs.values()].find((item) => item.pendingAction) ??
      [...this.runs.values()].at(-1);
    return {
      phase: this.options.entry === "codex" ? "codex_client" : "simulated_user",
      runId: run?.runId ?? null,
      status: run?.status ?? null,
      cursor: run?.cursor ?? null,
      pendingAction: run?.pendingAction
        ? { id: run.pendingAction.id, kind: run.pendingAction.kind }
        : null,
      rejectedAnswers: this.answerRejections.length,
      firstRejection: this.answerRejections[0] ?? null,
      lastRejection: this.answerRejections.at(-1) ?? null,
    };
  }
  private stop(cause: E2eError): never {
    this.executionFailure = cause;
    this.controller.abort(cause);
    throw cause;
  }
  private async rejectAnswer(input: unknown, issues: string[], run?: Run) {
    const value =
      input && typeof input === "object"
        ? (input as Record<string, unknown>)
        : {};
    run ??=
      this.runs.get(String(value.runId)) ??
      [...this.runs.values()].find((item) => item.pendingAction);
    const actionId = run?.pendingAction?.id ?? "unavailable";
    const attempt =
      this.answerRejections.filter((item) => item.actionId === actionId)
        .length + 1;
    const answer = value.answers ?? value.answer;
    const rejection = {
      at: new Date().toISOString(),
      runId: run?.runId ?? "unavailable",
      actionId,
      attempt,
      reason: issues.join("; "),
      issues,
      inputType: Array.isArray(answer) ? "array" : typeof answer,
      cursor: run?.cursor,
    };
    this.answerRejections.push(rejection);
    await this.evidence.event("answer_rejected", rejection);
    if (attempt >= 2)
      this.stop(
        new E2eError(
          "USER_ACTION_PROTOCOL_ERROR",
          `Two invalid submissions for action ${actionId}. The test AI could not satisfy the public answer protocol. See first/last rejection evidence.`,
          "model",
        ),
      );
    throw new E2eError(
      "USER_ANSWER_INVALID",
      `${rejection.reason} Read the current action; one correction is allowed.`,
      "model",
    );
  }
  async inspectAnswerCalls(calls: ModelToolCall[]) {
    for (const call of calls) {
      if (
        !Object.hasOwn(answerTools, call.toolName) &&
        call.toolName !== "submit_answer"
      )
        continue;
      if (this.invalidCalls.has(call.toolCallId)) continue;
      const parsed = Object.hasOwn(answerTools, call.toolName)
        ? answerTools[call.toolName as AnswerTool].safeParse(call.args)
        : undefined;
      if (parsed?.success) continue;
      this.invalidCalls.add(call.toolCallId);
      try {
        await this.rejectAnswer(
          call.args,
          parsed
            ? validationIssues(parsed.error)
            : [
                "Use submit_questions or submit_confirmation, with typed input.",
              ],
        );
      } catch (cause) {
        this.signal.throwIfAborted();
        if (!(cause instanceof E2eError)) throw cause;
      }
    }
  }
  async configure() {
    if (!this.initialized || this.configured)
      throw new E2eError(
        "SETUP_ORDER_INVALID",
        "Configure the initialized project exactly once before service startup.",
        "runner",
      );
    const config = parseDocument(
      await readFile(join(this.project, "intloom.yaml"), "utf8"),
    );
    config.set("localStorage", this.profile.storage);
    config.set("useMcpAgent", this.profile.mcpExecutor === "mcp_client");
    config.set("mirror", { enabled: true });
    if (this.profile.service)
      config.set(
        "llms",
        config.createNode(this.profile.service, {
          aliasDuplicateObjects: false,
        }),
      );
    await writeFile(join(this.project, "intloom.yaml"), config.toString(), {
      mode: 0o600,
    });
    if (this.limits.maxAgentSteps !== undefined)
      await writeFile(
        join(this.project, "intloom", "host.json"),
        JSON.stringify(
          {
            maxAgentSteps: this.limits.maxAgentSteps,
          },
          null,
          2,
        ),
        { flag: "wx", mode: 0o600 },
      );
    this.configured = true;
    await this.evidence.event("configuration", {
      configuration: config.toJS(),
      limits: this.limits,
    });
    await this.prepare();
    return {
      configured: true,
      mirrorEnabled: true,
      storage: this.profile.storage,
      execution:
        this.options.entry === "cmd" ? "service" : this.profile.mcpExecutor,
    };
  }
  async seed() {
    if (!this.initialized || this.seeded)
      throw new E2eError(
        "SETUP_ORDER_INVALID",
        "Seed an initialized project exactly once before service startup.",
        "runner",
      );
    for (const file of this.caseData.files.filter((part) =>
      part.path.startsWith(`workspace${sep}`),
    )) {
      const target = join(
        this.project,
        file.path.slice("workspace".length + 1),
      );
      await mkdir(dirname(target), { recursive: true });
      await copyFile(join(this.caseData.directory, file.path), target, 1);
    }
    this.seeded = true;
    await this.evidence.event("workspace_seeded", {
      files: this.caseData.files.filter((part) =>
        part.path.startsWith(`workspace${sep}`),
      ),
    });
    await this.prepare();
    return { seeded: true };
  }
  private async prepare() {
    if (
      !this.configured ||
      !this.seeded ||
      this.preparationStatus !== "not_run"
    )
      return;
    try {
      await this.prepareProject?.(this);
      this.preparationStatus = "passed";
    } catch (cause) {
      this.preparationStatus = "failed";
      this.stop(
        cause instanceof E2eError
          ? cause
          : new E2eError(
              "PREPARATION_FAILED",
              "Workflow project preparation failed. No Run was started.",
              "scenario",
            ),
      );
    }
  }
  private admission() {
    if (
      !this.initialized ||
      !this.configured ||
      !this.seeded ||
      ["not_run", "failed"].includes(this.preparationStatus) ||
      !this.diagnosed
    )
      throw new E2eError(
        "SETUP_INCOMPLETE",
        "Initialize, seed, configure and diagnose the project before flow.",
        "runner",
      );
    if (this.flowAttempted)
      throw new E2eError(
        "FLOW_ALREADY_ATTEMPTED",
        "Flow was already attempted. Inspect the original Run; never replay it.",
        "runner",
      );
    this.flowAttempted = true;
  }
  async answer(
    input: {
      runId: string;
      actionId: string;
      answer: z.infer<ReturnType<typeof z.json>>;
      knowledgeRefs: string[];
      decision: string;
    },
    kind: "user_ask_questions" | "user_ask_confirmation",
  ) {
    const run = await this.getRun(input.runId, this.signal);
    try {
      if (run.pendingAction?.id !== input.actionId)
        throw new Error("Read the current pending action ID before answering.");
      if (this.acceptedActions.has(input.actionId))
        throw new Error(
          "This action was already accepted; observe the Run without resubmitting it.",
        );
      validateAnswer(run, kind, input.answer);
      if (
        !input.knowledgeRefs.length ||
        input.knowledgeRefs.some(
          (id) => !this.caseData.knowledgeIds.includes(id),
        )
      )
        throw new Error("Answers must cite existing case knowledge sections.");
    } catch (cause) {
      await this.rejectAnswer(input, validationIssues(cause), run);
    }
    await this.evidence.event("human_answer", {
      ...input,
      question: run.pendingAction?.request,
      cursor: run.cursor,
    });
    let result:
      | Awaited<ReturnType<Session["cli"]>>
      | Awaited<ReturnType<Session["mcp"]>>;
    if (this.options.entry === "cmd") {
      const filename = join(
        this.evidence.directory,
        `answer-${randomUUID()}.json`,
      );
      await writeFile(filename, JSON.stringify(input.answer), {
        mode: 0o600,
        flag: "wx",
      });
      result = await this.cli(
        [
          "answer",
          input.runId,
          "--action",
          input.actionId,
          "--answer-file",
          filename,
        ],
        this.signal,
      );
    } else
      result = await this.mcp(
        "answer_ask",
        { runId: input.runId, actionId: input.actionId, answer: input.answer },
        this.signal,
      );
    const success =
      "code" in result
        ? result.code === 0 &&
          Boolean(
            result.data &&
              typeof result.data === "object" &&
              "ok" in result.data &&
              result.data.ok,
          )
        : !result.isError;
    if (!success) {
      await this.evidence.event("answer_submission_rejected", {
        runId: input.runId,
        actionId: input.actionId,
        result,
      });
      this.stop(
        new E2eError(
          "ANSWER_SUBMISSION_REJECTED",
          "The real CLI/MCP rejected a locally validated answer. See the original receipt and action evidence.",
          "system",
        ),
      );
    }
    this.acceptedActions.add(input.actionId);
    const confirmed =
      kind === "user_ask_confirmation"
        ? Boolean(
            input.answer &&
              typeof input.answer === "object" &&
              "isConfirmed" in input.answer &&
              input.answer.isConfirmed === true,
          )
        : undefined;
    await this.evidence.event("answer_accepted", {
      runId: input.runId,
      actionId: input.actionId,
      kind,
      ...(confirmed === undefined ? {} : { confirmed }),
    });
    if (kind === "user_ask_confirmation")
      this.confirmations.push({
        runId: run.runId,
        stageName: run.cursor.stageName,
        confirmed: confirmed === true,
      });
    return result;
  }
  async executeClientAgent(runId: string, callId: string) {
    const run = await this.getRun(runId, this.signal);
    if (run.pendingAgentCall?.id !== callId || this.workerCalls.has(callId))
      throw new E2eError(
        "AGENT_TASK_STALE",
        "Execute each current MCP Agent task once.",
        "runner",
      );
    this.workerCalls.add(callId);
    const claimed = await this.mcp(
      "claim_agent_call",
      { runId, callId, claimId: randomUUID() },
      this.signal,
    );
    if (claimed.isError) return claimed;
    const claim = z
      .object({ task: taskSchema, ownerToken: z.string() })
      .parse(claimed.data);
    this.evidence.secrets.push(claim.ownerToken);
    const owner = { runId, callId, ownerToken: claim.ownerToken };
    const tools: Record<string, Tool> = Object.create(null);
    for (const definition of claim.task.tools)
      tools[definition.id] = createTool({
        id: definition.id,
        description: definition.description,
        inputSchema: toolSchema(definition.inputSchema),
        strict: false,
        execute: async (input) => {
          const result = await this.mcp(
            "call_agent_tool",
            {
              ...owner,
              toolCallId: randomUUID(),
              toolId: definition.id,
              input,
            },
            this.signal,
          );
          if (result.isError) {
            const hostError = z
              .object({
                error: z.object({ code: z.string(), message: z.string() }),
              })
              .safeParse(result.data);
            const error = new E2eError(
              hostError.success
                ? hostError.data.error.code
                : "AGENT_TOOL_FAILED",
              hostError.success
                ? hostError.data.error.message
                : "A host business Tool failed. See MCP evidence.",
              "system",
            );
            if (error.code !== "INVALID_REQUEST") this.stop(error);
            throw error;
          }
          return z.object({ output: z.json() }).parse(result.data).output;
        },
      });
    tools.read_skill_asset = createTool({
      id: "read_skill_asset",
      description: "Read a declared Skill asset by its ID.",
      inputSchema: toolSchema(
        z.toJSONSchema(z.object({ assetId: z.string() })),
      ),
      execute: async (input) =>
        this.mcp(
          "read_agent_asset",
          {
            ...owner,
            assetId: z.object({ assetId: z.string() }).parse(input).assetId,
          },
          this.signal,
        ),
    });
    try {
      const model = this.profile.clientAgent ?? this.profile.user;
      if (!model)
        throw new E2eError(
          "MODEL_CONFIGURATION_MISSING",
          "A generic MCP worker requires a configured model.",
          "environment",
          "blocked",
        );
      const output = await runAgent({
        id: `workflow-agent-${callId}`,
        model,
        instructions: `${claim.task.instructions}\n\nSkills:\n${JSON.stringify(claim.task.skills)}\n\nThe listed Skill contents are already loaded from the host task; apply them directly. Use read_skill_asset only for a declared asset when needed.\n\nFinal output JSON Schema:\n${JSON.stringify(claim.task.outputSchema)}\nUse host business Tools for all business reads and changes. Read current State before submitting changes. Obey each Tool's description and actual receipt. When a successful submission says to end the Agent, immediately complete with the required outcome; do not submit again or call read Tools. A host error saying the final submission was saved also requires completion, not a retry. The client supplies a separate completion Tool for that outcome. You cannot answer or confirm user actions. Finish with only the declared outcome data fields. Never include JSON Schema metadata such as $schema in the outcome. All generated prose must be English.`,
        prompt:
          "Execute this assigned IntLoom Agent task and submit its business changes through the supplied Tools.",
        tools,
        outputSchema: claim.task.outputSchema as PublicSchema,
        taskCompletion: true,
        maxSteps: this.limits.maxAgentSteps,
        connectionTimeoutMs: this.limits.modelConnectionTimeoutMs,
        idleTimeoutMs: this.limits.modelIdleTimeoutMs,
        connectionRetries: this.limits.modelConnectionRetries,
        signal: this.signal,
        evidence: this.evidence,
        environment: this.environment,
      });
      this.clientAgentCalls++;
      const completed = await this.mcp(
        "complete_agent_call",
        { ...owner, result: output },
        this.signal,
      );
      if (completed.isError) {
        const hostError = z
          .object({
            error: z.object({ code: z.string(), message: z.string() }),
          })
          .safeParse(completed.data);
        throw new E2eError(
          hostError.success
            ? hostError.data.error.code
            : "AGENT_COMPLETION_FAILED",
          hostError.success
            ? hostError.data.error.message
            : "The host rejected MCP Agent completion. See preserved evidence.",
          "system",
        );
      }
      return completed;
    } catch (cause) {
      if (cause instanceof E2eError) this.executionFailure = cause;
      if (!this.signal.aborted)
        await this.mcp(
          "fail_agent_call",
          {
            ...owner,
            message:
              "The E2E client Agent failed; consult the execution evidence.",
          },
          this.signal,
        ).catch(() => {});
      if (cause instanceof E2eError) this.stop(cause);
      throw cause;
    }
  }
  userTools(): Record<string, Tool> {
    const wrap = <T>(
      name: string,
      description: string,
      schema: z.ZodType<T>,
      action: (input: T) => Promise<unknown>,
    ) =>
      createTool({
        id: name,
        description,
        inputSchema: toolSchema(z.toJSONSchema(schema)),
        strict: false,
        execute: async (input) => {
          this.signal.throwIfAborted();
          await this.evidence.event("user_action", { name, input });
          try {
            return await action(schema.parse(input));
          } catch (cause) {
            this.signal.throwIfAborted();
            await this.evidence.event("user_action_error", {
              name,
              error:
                cause instanceof E2eError
                  ? { code: cause.code, message: cause.message }
                  : {
                      code: "ACTION_FAILED",
                      message:
                        "The action failed; inspect execution diagnostics.",
                    },
            });
            if (cause instanceof z.ZodError)
              return {
                error: {
                  code: "TOOL_INPUT_INVALID",
                  issues: validationIssues(cause),
                },
              };
            if (cause instanceof E2eError)
              return { error: { code: cause.code, message: cause.message } };
            throw cause;
          }
        },
      });
    const tools: Record<string, Tool> = {
      intloom_command: wrap(
        "intloom_command",
        "Execute a real bounded CLI command in this test project. Supply args, starting with the command. init takes no target. Use configure_project and seed_workspace after init. Use submit_questions and submit_confirmation for human actions.",
        z.object({ args: z.array(z.string()).min(1) }),
        async ({ args }) => {
          if (args[0] === "flow" && args.length === 4 && args[2] === "--intent")
            args = [...args.slice(0, 3), caseIntent(args[3], this.intent)];
          validateCommand(
            args,
            this.options.entry,
            this.options.workflow,
            this.intent,
            this.options.flowName,
          );
          if (
            ["start", "workflow"].includes(args[0] ?? "") &&
            !this.initialized
          )
            throw new E2eError(
              "SETUP_ORDER_INVALID",
              "Initialize the project first.",
              "runner",
            );
          if (
            args[0] === "start" &&
            (!this.configured ||
              !this.seeded ||
              ["not_run", "failed"].includes(this.preparationStatus))
          )
            throw new E2eError(
              "SETUP_INCOMPLETE",
              "Configure and seed the project before starting the service.",
              "runner",
            );
          if (args[0] === "flow")
            return this.flow(() => this.cli(args, this.signal));
          const result = await this.cli(args, this.signal);
          if (
            result.code !== 0 &&
            ["init", "workflow", "start", "doctor"].includes(args[0] ?? "")
          ) {
            const receipt = z
              .object({
                error: z.object({ code: z.string(), message: z.string() }),
              })
              .safeParse(result.data);
            this.stop(
              new E2eError(
                receipt.success
                  ? receipt.data.error.code
                  : "PROJECT_SETUP_FAILED",
                receipt.success
                  ? receipt.data.error.message
                  : "A project setup command failed. See preserved evidence.",
                "system",
              ),
            );
          }
          return result;
        },
      ),
      configure_project: wrap(
        "configure_project",
        "Configure the initialized project with the Workflow suite's models and optional limits, and enable mirror. Preserve installed Workflow declarations.",
        z.object({}),
        () => this.configure(),
      ),
      seed_workspace: wrap(
        "seed_workspace",
        "Copy the selected case's initial business files into the new initialized project without overwriting existing files.",
        z.object({}),
        () => this.seed(),
      ),
      submit_questions: wrap(
        "submit_questions",
        "Answer every current question exactly once. answers is an actual array, never a JSON string. Each item requires questionId and isSkipped; answered items require a nonempty English answer. Cite knowledge sections. One invalid submission may be corrected.",
        questionSubmissionSchema,
        ({ answers, ...input }) =>
          this.answer({ ...input, answer: answers }, "user_ask_questions"),
      ),
      submit_confirmation: wrap(
        "submit_confirmation",
        "Confirm with isConfirmed=true and omit feedback; place approval rationale in decision. Decline with isConfirmed=false and feedback only when requesting actual revisions. Cite knowledge sections. Positive feedback also causes reconfirmation.",
        confirmationSubmissionSchema,
        ({ isConfirmed, feedback, ...input }) =>
          this.answer(
            {
              ...input,
              answer: {
                isConfirmed,
                ...(feedback === undefined ? {} : { feedback }),
              },
            },
            "user_ask_confirmation",
          ),
      ),
      observe_run: wrap(
        "observe_run",
        "Wait for the same Run's next question, Agent task, pause or terminal. This tool observes locally until a decision is needed, cancellation or an optional time limit; it never restarts execution. Use it instead of repeatedly querying a running Run.",
        z.object({ runId: z.string() }),
        ({ runId }) => this.observeRun(runId),
      ),
    };
    if (this.options.entry === "mcp") {
      tools.connect_mcp = wrap(
        "connect_mcp",
        "Connect to this project's external MCP endpoint through the real installed CLI stdio proxy.",
        z.object({}),
        () => this.connectMcp(),
      );
      tools.mcp_flow = wrap(
        "mcp_flow",
        "Start the supplied Workflow once through the public MCP flow Tool, using the complete original Intent.",
        z.strictObject({ flowName: z.string(), intent: z.string() }),
        async (args) => {
          args.intent = caseIntent(args.intent, this.intent);
          if (args.flowName !== this.options.flowName)
            throw new E2eError(
              "INTENT_CHANGED",
              "Use the supplied Workflow name and complete original intent.",
              "scenario",
            );
          return this.flow(() => this.mcp("flow", args, this.signal));
        },
      );
      tools.mcp_tool = wrap(
        "mcp_tool",
        "Invoke a public query MCP Tool with its advertised arguments. Use mcp_flow to start a Run, submit_questions/submit_confirmation for human responses and execute_agent_call for pending client Agent work.",
        z.object({
          name: z.enum(queryMcpTools),
          arguments: z.record(z.string(), z.json()),
        }),
        async ({ name, arguments: args }) => {
          return this.mcp(name, args, this.signal);
        },
      );
      if (this.profile.mcpExecutor === "mcp_client")
        tools.execute_agent_call = wrap(
          "execute_agent_call",
          "Execute the current pending client Agent task in an isolated AI session with the host-declared instructions and Tools. The worker cannot read your user knowledge.",
          z.object({ runId: z.string(), callId: z.string() }),
          ({ runId, callId }) => this.executeClientAgent(runId, callId),
        );
    }
    return tools;
  }
  async close() {
    const client = this.client,
      transport = this.transport;
    this.client = undefined;
    this.transport = undefined;
    if (client) await client.close();
    else await transport?.close();
  }
  async cleanup() {
    await this.close();
    const info = await lstat(join(this.project, ".intloom/service.json")).catch(
      () => undefined,
    );
    if (!info) return { status: "not_needed" };
    const runs = await this.cli(["runs"]);
    if (runs.code !== 0)
      throw new E2eError(
        "CLEANUP_FAILED",
        "The test service could not be inspected during cleanup.",
        "system",
      );
    for (const run of this.runs.values())
      if (!["completed", "failed"].includes(run.status))
        await this.cli(["cancel", run.runId]);
    const stopped = await this.cli(["stop"]);
    if (stopped.code !== 0)
      throw new E2eError(
        "CLEANUP_FAILED",
        "The test service did not stop cleanly. The project was preserved.",
        "system",
      );
    return { status: "stopped" };
  }
}
