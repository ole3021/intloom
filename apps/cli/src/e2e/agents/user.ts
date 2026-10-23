import { setTimeout as delay } from "node:timers/promises";
import { createTool, type Tool } from "@mastra/core/tools";
import * as z from "zod";
import type { LoomInput } from "@intloom/loom-sdk";
import {
  E2eError,
  type Configuration,
  type Models,
  type Run,
} from "../contracts.ts";
import { McpDriver, type Driver } from "../drivers/mcp.ts";
import type { Evidence } from "../evidence.ts";
import {
  questionSubmissionSchema,
  confirmationSubmissionSchema,
  validateAnswer,
} from "../answers.ts";
import {
  userDecisionSchema,
  userDecisionToolSchema,
} from "../final-response.ts";
import { runAgent } from "../agent.ts";
import { toolSchema } from "../schema.ts";
import { executeWorker } from "./worker.ts";
import { runProgress } from "../progress.ts";

const instructions = `Act as the simulated owner of this test case. Use only the supplied active knowledge and previous completed rounds. All answers and explanations must be English.
The project is prepared. Call start_run once with {} to submit this round's exact input through the real selected entry. Use observe_run to wait locally for the original Run. Never restart or repair a Run. You do not implement business changes or execute Loom Tools yourself.
Answer actual questions with submit_questions, citing supplied knowledgeRefs and a short decision. For each question provide questionId, isSkipped, and answer unless explicitly skippable. Do not invent business decisions when knowledge is insufficient.
Confirm only a proposal consistent with current and previously authorized requirements. Approval is isConfirmed=true with no feedback; put the rationale in decision. Use feedback only for a real requested change. Partial delivery or ending evidence collection requires explicit authority in the knowledge. Missing authority is blocked, never inferred consent.
When the original Run is completed and settled, finish through the client completion Tool with {"status":"finished"}. This does not declare the case passed: independent checks run afterwards. For missing knowledge use {"status":"blocked","category":"scenario","reason":"..."}. A failed or paused Run ends this attempt. MCP Agent tasks are handled independently while observe_run waits.`;

type RoundContext = {
  driver: Driver;
  loomName: string;
  input: LoomInput;
  index: number;
  roundId: string;
  knowledge: { content: string; ids: string[] };
  previous: unknown[];
  config: Configuration;
  models: Models;
  evidence: Evidence;
  environment: NodeJS.ProcessEnv;
  signal: AbortSignal;
};

export class UserRound {
  run: Run | undefined;
  readonly confirmations: {
    runId: string;
    stageName: string;
    actionId: string;
    confirmed: boolean;
  }[] = [];
  private attempted = false;
  private answered = new Set<string>();
  private workers = new Set<string>();
  private rejected = new Map<string, number>();
  private observed = "";
  private progress = "";
  failure: unknown;
  readonly context: RoundContext;
  private controller = new AbortController();
  constructor(context: RoundContext) {
    this.context = {
      ...context,
      signal: AbortSignal.any([context.signal, this.controller.signal]),
    };
  }
  private async save(run: Run) {
    this.run = run;
    const progress = runProgress(run);
    const signature = JSON.stringify(progress);
    if (signature !== this.progress) {
      this.progress = signature;
      await this.context.evidence.event("run_progress", progress);
    }
    const state = JSON.stringify([
      run.status,
      run.cursor,
      run.pendingAction?.id,
      run.pendingAgentCall?.id,
      run.settled,
    ]);
    if (state !== this.observed) {
      this.observed = state;
      await this.context.evidence.event("run_observed", run);
    }
    return run;
  }
  async observe(): Promise<Run> {
    if (!this.run)
      throw new E2eError("RUN_MISSING", "Start this round first.", "runner");
    const c = this.context;
    while (true) {
      c.signal.throwIfAborted();
      const run = await this.save(await c.driver.get(this.run.runId, c.signal));
      if (run.status === "failed" || run.status === "paused")
        throw new E2eError(
          run.lastError?.code ?? "RUN_PAUSED",
          run.lastError?.message ?? "The original Run paused.",
          "system",
        );
      if (run.status === "completed" && run.settled) return run;
      if (run.pendingAgentCall && c.driver instanceof McpDriver) {
        const callId = run.pendingAgentCall.id;
        if (this.workers.has(callId))
          throw new E2eError(
            "AGENT_TASK_STALE",
            "A completed MCP task is still pending; it will not be replayed.",
            "system",
          );
        this.workers.add(callId);
        await executeWorker({
          ...c,
          driver: c.driver,
          runId: run.runId,
          callId,
        });
        continue;
      }
      if (run.pendingAction) return run;
      await delay(100, undefined, { signal: c.signal });
    }
  }
  private async answer(
    input: {
      runId: string;
      actionId: string;
      answer: unknown;
      knowledgeRefs: string[];
      decision: string;
    },
    kind: string,
  ) {
    const c = this.context;
    if (input.runId !== this.run?.runId)
      throw new E2eError("ANSWER_INVALID", "Use this round's Run ID.", "model");
    const run = await this.save(await c.driver.get(input.runId, c.signal));
    try {
      if (
        run.pendingAction?.id !== input.actionId ||
        this.answered.has(input.actionId)
      )
        throw new Error("Use the current unacknowledged action.");
      validateAnswer(run, kind, input.answer);
      if (
        !input.knowledgeRefs.length ||
        input.knowledgeRefs.some((id) => !c.knowledge.ids.includes(id))
      )
        throw new Error("Cite existing active knowledge sections.");
    } catch (cause) {
      const attempts = (this.rejected.get(input.actionId) ?? 0) + 1;
      this.rejected.set(input.actionId, attempts);
      await c.evidence.event("answer_rejected", {
        input,
        attempts,
        reason: String(cause),
      });
      if (attempts < 2) return { error: String(cause), correctionRemaining: 1 };
      throw new E2eError(
        "ANSWER_INVALID",
        "Repeated invalid answer; inspect the current action and preserved evidence.",
        "model",
      );
    }
    await c.evidence.event("human_answer", {
      ...input,
      question: run.pendingAction,
      cursor: run.cursor,
    });
    const next = await c.driver.answer(
      run.runId,
      input.actionId,
      input.answer,
      c.signal,
    );
    this.answered.add(input.actionId);
    if (kind === "user_ask_confirmation")
      this.confirmations.push({
        runId: run.runId,
        stageName: run.cursor.stageName,
        actionId: input.actionId,
        confirmed: (input.answer as { isConfirmed: boolean }).isConfirmed,
      });
    await c.evidence.event("answer_accepted", {
      runId: run.runId,
      actionId: input.actionId,
      kind,
    });
    return this.save(next);
  }
  tools(): Record<string, Tool> {
    const c = this.context;
    const tool = <T>(
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
        execute: async (value) => {
          try {
            return await action(schema.parse(value));
          } catch (cause) {
            this.failure = cause;
            this.controller.abort(cause);
            throw cause;
          }
        },
      });
    return {
      start_run: tool(
        "start_run",
        "Submit exactly the current case input once through the selected public entry.",
        z.strictObject({}),
        async () => {
          if (this.attempted)
            throw new E2eError(
              "RUN_ALREADY_ATTEMPTED",
              "Do not replay Run admission.",
              "runner",
            );
          this.attempted = true;
          const run = await this.save(
            await c.driver.start(c.loomName, c.input, c.signal),
          );
          if (run.loomName !== c.loomName)
            throw new E2eError(
              "RUN_IDENTITY_INVALID",
              "The entry admitted a different Loom.",
              "system",
            );
          return run;
        },
      ),
      observe_run: tool(
        "observe_run",
        "Wait locally for this Run's next human action or terminal result. Handles MCP workers independently.",
        z.strictObject({}),
        () => this.observe(),
      ),
      submit_questions: tool(
        "submit_questions",
        "Answer each current question using authorized knowledge; include knowledgeRefs and decision.",
        questionSubmissionSchema,
        ({ answers, ...rest }) =>
          this.answer({ ...rest, answer: answers }, "user_ask_questions"),
      ),
      submit_confirmation: tool(
        "submit_confirmation",
        "Approve with isConfirmed=true and no feedback. Only request actual revisions with feedback.",
        confirmationSubmissionSchema,
        ({ isConfirmed, feedback, ...rest }) =>
          this.answer(
            {
              ...rest,
              answer: {
                isConfirmed,
                ...(feedback === undefined ? {} : { feedback }),
              },
            },
            "user_ask_confirmation",
          ),
      ),
      read_result: tool(
        "read_result",
        "Read a formal result referenced by the current Run.",
        z.strictObject({
          kind: z.enum(["artifact", "record"]),
          id: z.string(),
        }),
        async ({ kind, id }) => {
          if (!this.run?.results?.some((r) => r.kind === kind && r.id === id))
            throw new E2eError(
              "RESULT_OUT_OF_SCOPE",
              "Read an actual result reference from this Run.",
              "model",
            );
          return c.driver.result(kind, id, c.signal);
        },
      ),
    };
  }
  async execute() {
    const c = this.context;
    try {
      const output = await runAgent({
        id: `simulated-user-${c.index}`,
        instructions,
        prompt: JSON.stringify({
          roundId: c.roundId,
          input: c.input,
          entry: c.driver instanceof McpDriver ? "mcp" : "cmd",
          previousRounds: c.previous,
          knowledge: c.knowledge.content,
          knowledgeRefs: c.knowledge.ids,
        }),
        model: c.models.user,
        tools: this.tools(),
        outputSchema: z.toJSONSchema(userDecisionToolSchema),
        taskCompletion: true,
        maxSteps: c.config.limits.maxUserSteps,
        connectionTimeoutMs: c.config.limits.modelConnectionTimeoutMs,
        connectionRetries: c.config.limits.modelConnectionRetries,
        idleTimeoutMs: c.config.limits.modelIdleTimeoutMs,
        signal: c.signal,
        evidence: c.evidence,
        environment: c.environment,
      });
      if (this.failure) throw this.failure;
      const decision = userDecisionSchema.parse(output);
      if (decision.status === "blocked")
        throw new E2eError(
          "USER_BLOCKED",
          decision.reason,
          decision.category,
          "blocked",
        );
      if (!this.run)
        throw new E2eError(
          "RUN_MISSING",
          "The user did not submit this round.",
          "model",
        );
      const run = await this.save(await c.driver.get(this.run.runId, c.signal));
      if (run.status !== "completed" || !run.settled)
        throw new E2eError(
          run.lastError?.code ?? "RUN_INCOMPLETE",
          run.lastError?.message ??
            "The original Run did not complete and settle.",
          "system",
        );
      const mcp = c.driver instanceof McpDriver;
      if (
        run.execution.source !== (mcp ? "agent_ide" : "cli") ||
        run.execution.agentExecutor !== (mcp ? "mcp_client" : "service")
      )
        throw new E2eError(
          "EXECUTION_ENTRY_INVALID",
          "Unexpected entry or executor.",
          "system",
        );
      if (run.control?.captureDisabled || run.control?.pauseCause)
        throw new E2eError(
          "MIRROR_CAPTURE_FAILED",
          "Mirror capture did not complete.",
          "system",
        );
      return run;
    } catch (cause) {
      throw this.failure ?? cause;
    }
  }
}
